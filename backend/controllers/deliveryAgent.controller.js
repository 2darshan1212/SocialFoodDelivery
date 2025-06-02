import DeliveryAgent from "../models/deliveryAgent.model.js";
import Order from "../models/order.model.js";
import { User } from "../models/user.model.js";
import { io } from "../socket/socket.js";
import createError from "../utils/error.js";

// Helper function to calculate distance between two points using Haversine formula
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI/180; // φ, λ in radians
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  const d = R * c; // in meters
  return d;
};

// Register as a delivery agent
export const registerAsDeliveryAgent = async (req, res, next) => {
  try {
    const {
      vehicleType,
      vehicleNumber,
    } = req.body;

    // Check if user is already a delivery agent
    const existingAgent = await DeliveryAgent.findOne({ user: req.user.id });
    if (existingAgent) {
      return next(createError(400, "You are already registered as a delivery agent"));
    }

    // Create new delivery agent
    const newAgent = new DeliveryAgent({
      user: req.user.id,
      vehicleType,
      vehicleNumber,
      isAvailable: true,
      isVerified: false, // Requires admin approval
    });

    const savedAgent = await newAgent.save();

    // Update user role to include delivery agent
    await User.findByIdAndUpdate(
      req.user.id,
      { $addToSet: { roles: "delivery_agent" } },
      { new: true }
    );

    return res.status(201).json({
      success: true,
      message: "Registered as delivery agent successfully. Awaiting verification.",
      agent: savedAgent,
    });
  } catch (error) {
    console.error("Error registering as delivery agent:", error);
    return next(createError(500, "Error registering as delivery agent: " + error.message));
  }
};

// Update delivery agent availability
export const updateAvailability = async (req, res, next) => {
  try {
    const { isAvailable } = req.body;

    if (typeof isAvailable !== 'boolean') {
      return next(createError(400, "isAvailable must be a boolean value"));
    }

    const agent = await DeliveryAgent.findOne({ user: req.user.id });
    if (!agent) {
      return next(createError(404, "Delivery agent profile not found"));
    }

    agent.isAvailable = isAvailable;
    await agent.save();

    return res.status(200).json({
      success: true,
      message: `Availability updated to ${isAvailable ? 'available' : 'unavailable'}`,
      agent,
    });
  } catch (error) {
    console.error("Error updating agent availability:", error);
    return next(createError(500, "Error updating availability: " + error.message));
  }
};

// Update current location
export const updateLocation = async (req, res, next) => {
  try {
    const { longitude, latitude } = req.body;

    // Validate coordinates
    if (!longitude || !latitude || typeof longitude !== 'number' || typeof latitude !== 'number') {
      return next(createError(400, "Valid longitude and latitude coordinates are required"));
    }

    const agent = await DeliveryAgent.findOne({ user: req.user.id });
    if (!agent) {
      return next(createError(404, "Delivery agent profile not found"));
    }

    // Update agent location
    agent.currentLocation = {
      type: "Point",
      coordinates: [longitude, latitude],
    };
    await agent.save();

    // If agent has active orders, broadcast location update
    if (agent.activeOrders && agent.activeOrders.length > 0) {
      // Get all active orders with details
      const orders = await Order.find({
        _id: { $in: agent.activeOrders },
        status: { $in: ["confirmed", "preparing", "out_for_delivery"] }
      });

      // Broadcast location update to each order's user
      for (const order of orders) {
        io.to(`order_${order._id}`).emit("deliveryLocationUpdate", {
          orderId: order._id,
          agentId: agent._id,
          location: agent.currentLocation,
          timestamp: new Date()
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: "Location updated successfully",
      currentLocation: agent.currentLocation,
    });
  } catch (error) {
    console.error("Error updating location:", error);
    return next(createError(500, "Error updating location: " + error.message));
  }
};

// Get nearby orders available for delivery
export const getNearbyOrders = async (req, res, next) => {
  try {
    // Check if we should include all confirmed orders regardless of distance
    const includeAllConfirmed = req.query.includeAllConfirmed === 'true';
    
    const agent = await DeliveryAgent.findOne({ user: req.user.id });
    if (!agent) {
      return next(createError(404, "Delivery agent profile not found"));
    }

    if (!agent.isVerified) {
      return next(createError(403, "Your account is not yet verified to accept orders"));
    }

    if (!agent.isAvailable) {
      return next(createError(400, "You are currently set as unavailable for deliveries"));
    }

    // Get agent's current location
    const [longitude, latitude] = agent.currentLocation.coordinates;
    
    // Maximum distance in meters (2km radius)
    const maxDistance = 2000;

    // Prepare rejected orders filter
    const rejectedOrderIds = agent.rejectedOrders || [];

    // Prepare query based on whether we want all confirmed orders or just nearby ones
    let orderQuery = {
      _id: { $nin: rejectedOrderIds }, // Exclude rejected orders
      deliveryAgent: { $exists: false },
      status: "confirmed"
    };
    
    // Only add location filter if we're not including all confirmed orders
    if (!includeAllConfirmed) {
      orderQuery.pickupLocation = {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [longitude, latitude]
          },
          $maxDistance: maxDistance
        }
      };
    }

    // Find orders ready for delivery assignment
    const allConfirmedOrders = await Order.find(orderQuery).populate({
      path: 'user',
      select: 'username avatar'
    });
    
    // Calculate exact distance for each order and add it to the response
    const ordersWithDistance = allConfirmedOrders.map(order => {
      try {
        // Get pickup coordinates
        const [orderLongitude, orderLatitude] = order.pickupLocation.coordinates;
        
        // Calculate exact distance in meters using Haversine formula
        const exactDistance = calculateDistance(
          latitude, longitude,
          orderLatitude, orderLongitude
        );
        
        // Convert the order to a plain object so we can add properties
        const orderObj = order.toObject();
        
        // Add distance information
        orderObj.distance = {
          value: exactDistance,
          unit: 'meters',
          text: exactDistance < 1000 ? 
            `${Math.round(exactDistance)} m` : 
            `${(exactDistance / 1000).toFixed(2)} km`
        };
        
        // Add a field to indicate if the order is within delivery range
        orderObj.withinDeliveryRange = exactDistance <= maxDistance;
        
        return orderObj;
      } catch (err) {
        // Handle orders with invalid coordinates
        console.error(`Error processing order ${order._id}:`, err);
        const orderObj = order.toObject();
        orderObj.distance = {
          value: Number.MAX_SAFE_INTEGER,
          unit: 'meters',
          text: 'Unknown',
          error: 'Invalid coordinates'
        };
        orderObj.withinDeliveryRange = false;
        return orderObj;
      }
    });
    
    // Sort by distance (closest first)
    ordersWithDistance.sort((a, b) => a.distance.value - b.distance.value);

    // Find agent's active orders - without distance restriction
    const activeOrders = await Order.find({
      _id: { $in: agent.activeOrders },
      status: "out_for_delivery"
    }).populate({
      path: 'user',
      select: 'username avatar'
    });

    // Calculate distance for active orders too
    const activeOrdersWithDistance = await Promise.all(activeOrders.map(async order => {
      // Get pickup coordinates
      const [orderLongitude, orderLatitude] = order.pickupLocation.coordinates;
      
      // Calculate exact distance
      const exactDistance = calculateDistance(
        latitude, longitude,
        orderLatitude, orderLongitude
      );
      
      // Convert to plain object
      const orderObj = order.toObject();
      
      // Add distance information
      orderObj.distance = {
        value: exactDistance,
        unit: 'meters',
        text: exactDistance < 1000 ? 
          `${Math.round(exactDistance)} m` : 
          `${(exactDistance / 1000).toFixed(2)} km`
      };
      
      return orderObj;
    }));

    // Combine the new orders and active orders
    const allOrders = [...ordersWithDistance, ...activeOrdersWithDistance];

    return res.status(200).json({
      success: true,
      message: includeAllConfirmed ? "All confirmed orders fetched successfully" : "Nearby orders fetched successfully",
      count: allOrders.length,
      includeAllConfirmed,
      maxDistance,
      orders: allOrders
    });
  } catch (error) {
    console.error("Error fetching nearby orders:", error);
    return next(createError(500, "Error fetching nearby orders: " + error.message));
  }
};

// Accept an order for delivery
export const acceptOrder = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    
    // Get delivery agent
    const agent = await DeliveryAgent.findOne({ user: req.user.id });
    if (!agent) {
      return next(createError(404, "Delivery agent profile not found"));
    }

    if (!agent.isVerified) {
      return next(createError(403, "Your account is not yet verified to accept orders"));
    }

    // Check if agent is available
    if (!agent.isAvailable) {
      return next(createError(400, "You need to set yourself as available to accept orders"));
    }

    // Find and check order status
    const order = await Order.findById(orderId);
    if (!order) {
      return next(createError(404, "Order not found"));
    }

    if (order.deliveryAgent) {
      return next(createError(400, "This order has already been assigned to a delivery agent"));
    }

    if (order.status !== "confirmed") {
      return next(createError(400, "Order is not available for delivery"));
    }

    // Calculate estimated delivery time (30 minutes from now)
    const estimatedDeliveryTime = new Date();
    estimatedDeliveryTime.setMinutes(estimatedDeliveryTime.getMinutes() + 30);

    // Update order with delivery agent and status
    order.deliveryAgent = agent._id;
    order.status = "out_for_delivery";
    order.estimatedDeliveryTime = estimatedDeliveryTime;
    
    // Add status history entry
    order.statusHistory.push({
      status: "out_for_delivery",
      timestamp: new Date(),
      location: agent.currentLocation,
      note: `Assigned to delivery agent: ${req.user.username}`
    });
    
    await order.save();

    // Update agent's active orders
    agent.activeOrders.push(order._id);
    await agent.save();

    // Populate the order with all necessary data before returning
    await order.populate([
      {
        path: 'user',
        select: 'username email avatar location'
      },
      {
        path: 'restaurant',
        select: 'name location address'
      },
      {
        path: 'items.post',
        populate: {
          path: 'author',
          select: 'username location'
        }
      },
      {
        path: 'deliveryAgent',
        select: 'user vehicleType vehicleNumber'
      }
    ]);

    // Create the order object with enhanced location data
    const orderObj = order.toObject();
    
    // Log original coordinates for debugging
    console.log(`Backend acceptOrder - Original order ${order._id} coordinates:`, {
      pickup: orderObj.pickupLocation?.coordinates,
      delivery: orderObj.deliveryLocation?.coordinates,
      restaurant: orderObj.restaurant?.location?.coordinates,
      user: orderObj.user?.location?.coordinates
    });
    
    // Ensure pickup location has valid coordinates
    if (!orderObj.pickupLocation?.coordinates || 
        (orderObj.pickupLocation.coordinates[0] === 0 && orderObj.pickupLocation.coordinates[1] === 0)) {
      
      // Use restaurant location for pickup if available
      if (orderObj.restaurant?.location?.coordinates && 
          Array.isArray(orderObj.restaurant.location.coordinates) && 
          orderObj.restaurant.location.coordinates.length === 2 &&
          (orderObj.restaurant.location.coordinates[0] !== 0 || orderObj.restaurant.location.coordinates[1] !== 0)) {
        
        orderObj.pickupLocation = {
          type: "Point",
          coordinates: [...orderObj.restaurant.location.coordinates]
        };
        console.log(`Backend - Fixed pickup location for accepted order ${orderObj._id} using restaurant coordinates`);
      }
      // Fallback to post author location if restaurant location not available
      else if (orderObj.items && orderObj.items.length > 0 && 
               orderObj.items[0]?.post?.author?.location?.coordinates) {
        
        orderObj.pickupLocation = {
          type: "Point",
          coordinates: [...orderObj.items[0].post.author.location.coordinates]
        };
        console.log(`Backend - Fixed pickup location for accepted order ${orderObj._id} using post author coordinates`);
      }
    }
    
    // Ensure delivery location has valid coordinates
    if (!orderObj.deliveryLocation?.coordinates || 
        (orderObj.deliveryLocation.coordinates[0] === 0 && orderObj.deliveryLocation.coordinates[1] === 0)) {
      
      // Use user location for delivery if available
      if (orderObj.user?.location?.coordinates && 
          Array.isArray(orderObj.user.location.coordinates) && 
          orderObj.user.location.coordinates.length === 2 &&
          (orderObj.user.location.coordinates[0] !== 0 || orderObj.user.location.coordinates[1] !== 0)) {
        
        orderObj.deliveryLocation = {
          type: "Point",
          coordinates: [...orderObj.user.location.coordinates]
        };
        console.log(`Backend - Fixed delivery location for accepted order ${orderObj._id} using user coordinates`);
      }
    }
    
    // Log final coordinates being sent
    console.log(`Backend acceptOrder - Final order ${orderObj._id} coordinates being sent:`, {
      pickup: orderObj.pickupLocation?.coordinates,
      delivery: orderObj.deliveryLocation?.coordinates
    });

    // Notify user that order is out for delivery
    io.to(`user_${order.user._id || order.user}`).emit("orderStatusUpdate", {
      orderId: order._id,
      status: "out_for_delivery",
      estimatedDeliveryTime,
      agent: {
        id: agent._id,
        name: req.user.username,
        vehicleType: agent.vehicleType,
        vehicleNumber: agent.vehicleNumber
      }
    });

    return res.status(200).json({
      success: true,
      message: "Order accepted for delivery",
      order: orderObj, // Return the enhanced order object
    });
  } catch (error) {
    console.error("Error accepting order:", error);
    return next(createError(500, "Error accepting order: " + error.message));
  }
};

// Complete a delivery
export const completeDelivery = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    
    // Get delivery agent
    const agent = await DeliveryAgent.findOne({ user: req.user.id });
    if (!agent) {
      return next(createError(404, "Delivery agent profile not found"));
    }

    // Check if order exists and is being delivered by this agent
    const order = await Order.findById(orderId);
    if (!order) {
      return next(createError(404, "Order not found"));
    }

    if (!order.deliveryAgent || !order.deliveryAgent.equals(agent._id)) {
      return next(createError(403, "This order is not assigned to you"));
    }

    if (order.status !== "out_for_delivery") {
      return next(createError(400, "Order is not out for delivery"));
    }

    // Update order status
    order.status = "delivered";
    order.actualDeliveryTime = new Date();
    
    // Add status history entry
    order.statusHistory.push({
      status: "delivered",
      timestamp: new Date(),
      location: agent.currentLocation,
      note: "Order delivered successfully"
    });
    
    await order.save();

    // Update agent's records
    agent.activeOrders = agent.activeOrders.filter(id => !id.equals(order._id));
    agent.deliveryHistory.push(order._id);
    await agent.save();

    // Notify user that order is delivered
    io.to(`user_${order.user}`).emit("orderStatusUpdate", {
      orderId: order._id,
      status: "delivered",
      deliveredAt: order.actualDeliveryTime
    });

    return res.status(200).json({
      success: true,
      message: "Delivery completed successfully",
      order,
    });
  } catch (error) {
    console.error("Error completing delivery:", error);
    return next(createError(500, "Error completing delivery: " + error.message));
  }
};

// Get delivery agent profile
export const getAgentProfile = async (req, res, next) => {
  try {
    const agent = await DeliveryAgent.findOne({ user: req.user.id })
      .populate({
        path: 'activeOrders',
        populate: {
          path: 'user',
          select: 'username email avatar'
        }
      })
      .populate({
        path: 'user',
        select: 'username email avatar'
      });

    if (!agent) {
      return next(createError(404, "Delivery agent profile not found"));
    }

    // Count completed deliveries
    const completedDeliveriesCount = agent.deliveryHistory.length;

    return res.status(200).json({
      success: true,
      agent,
      stats: {
        completedDeliveries: completedDeliveriesCount,
        rating: agent.rating,
        totalRatings: agent.totalRatings,
      }
    });
  } catch (error) {
    console.error("Error fetching agent profile:", error);
    return next(createError(500, "Error fetching agent profile: " + error.message));
  }
};

// Admin function: verify delivery agent
export const verifyDeliveryAgent = async (req, res, next) => {
  try {
    const { agentId } = req.params;
    const { isVerified } = req.body;

    if (typeof isVerified !== 'boolean') {
      return next(createError(400, "isVerified must be a boolean value"));
    }

    const agent = await DeliveryAgent.findById(agentId);
    if (!agent) {
      return next(createError(404, "Delivery agent not found"));
    }

    agent.isVerified = isVerified;
    await agent.save();

    return res.status(200).json({
      success: true,
      message: `Agent ${isVerified ? 'verified' : 'unverified'} successfully`,
      agent,
    });
  } catch (error) {
    console.error("Error verifying agent:", error);
    return next(createError(500, "Error verifying agent: " + error.message));
  }
};

// Get all delivery agents (admin)
export const getAllAgents = async (req, res, next) => {
  try {
    const agents = await DeliveryAgent.find()
      .populate({
        path: 'user',
        select: 'username email avatar'
      });

    return res.status(200).json({
      success: true,
      count: agents.length,
      agents,
    });
  } catch (error) {
    console.error("Error fetching all agents:", error);
    return next(createError(500, "Error fetching all agents: " + error.message));
  }
};

// Get orders with 'confirmed' status that need delivery
export const getConfirmedOrders = async (req, res, next) => {
  try {
    // Get delivery agent
    const agent = await DeliveryAgent.findOne({ user: req.user.id });
    if (!agent) {
      return next(createError(404, "Delivery agent profile not found"));
    }

    // Find all orders with status "confirmed"
    const confirmedOrders = await Order.find({ 
      status: "confirmed",
      deliveryAgent: null // Not assigned to any agent yet
    })
    .populate({
      path: 'user',
      select: 'username email avatar location' // Added location to get user coordinates
    })
    .populate({
      path: 'restaurant',
      select: 'name location'
    })
    .populate({
      path: 'items.post',
      select: 'author location' // Get post author location as another coordinate source
    });

    // Get agent's current location
    const agentLocation = agent.currentLocation;
    const [agentLongitude, agentLatitude] = agentLocation?.coordinates || [0, 0];

    // Process and enhance each order with proper location data
    const ordersWithDetails = confirmedOrders.map(order => {
      const orderObj = order.toObject();
      
      // Log original order coordinates for debugging
      console.log(`Backend - Original order ${order._id} coordinates:`, {
        pickup: order.pickupLocation?.coordinates,
        delivery: order.deliveryLocation?.coordinates,
        restaurant: order.restaurant?.location?.coordinates,
        user: order.user?.location?.coordinates
      });
      
      // Ensure pickup location has valid coordinates
      if (!orderObj.pickupLocation?.coordinates || 
          (orderObj.pickupLocation.coordinates[0] === 0 && orderObj.pickupLocation.coordinates[1] === 0)) {
        
        // Use restaurant location for pickup if available
        if (orderObj.restaurant?.location?.coordinates && 
            Array.isArray(orderObj.restaurant.location.coordinates) && 
            orderObj.restaurant.location.coordinates.length === 2 &&
            (orderObj.restaurant.location.coordinates[0] !== 0 || orderObj.restaurant.location.coordinates[1] !== 0)) {
          
          orderObj.pickupLocation = {
            type: "Point",
            coordinates: [...orderObj.restaurant.location.coordinates]
          };
          console.log(`Backend - Fixed pickup location for order ${orderObj._id} using restaurant coordinates`);
        }
        // Fallback to post author location if restaurant location not available
        else if (orderObj.items && orderObj.items.length > 0 && 
                 orderObj.items[0]?.post?.author?.location?.coordinates) {
          
          orderObj.pickupLocation = {
            type: "Point",
            coordinates: [...orderObj.items[0].post.author.location.coordinates]
          };
          console.log(`Backend - Fixed pickup location for order ${orderObj._id} using post author coordinates`);
        }
      }
      
      // Ensure delivery location has valid coordinates
      if (!orderObj.deliveryLocation?.coordinates || 
          (orderObj.deliveryLocation.coordinates[0] === 0 && orderObj.deliveryLocation.coordinates[1] === 0)) {
        
        // Use user location for delivery if available
        if (orderObj.user?.location?.coordinates && 
            Array.isArray(orderObj.user.location.coordinates) && 
            orderObj.user.location.coordinates.length === 2 &&
            (orderObj.user.location.coordinates[0] !== 0 || orderObj.user.location.coordinates[1] !== 0)) {
          
          orderObj.deliveryLocation = {
            type: "Point",
            coordinates: [...orderObj.user.location.coordinates]
          };
          console.log(`Backend - Fixed delivery location for order ${orderObj._id} using user coordinates`);
        }
      }
      
      // Calculate distance if agent has location and order pickup location exists
      if (agentLocation?.coordinates && orderObj.pickupLocation?.coordinates) {
        const [pickupLong, pickupLat] = orderObj.pickupLocation.coordinates;
        
        // Calculate distance using Haversine formula (implement or use existing function)
        // For now we'll leave this to the frontend
      }
      
      // Log enhanced order coordinates
      console.log(`Backend - Enhanced order ${orderObj._id} coordinates:`, {
        pickup: orderObj.pickupLocation?.coordinates,
        delivery: orderObj.deliveryLocation?.coordinates
      });
      
      return orderObj;
    });

    return res.status(200).json({
      success: true,
      message: "Confirmed orders fetched successfully",
      count: ordersWithDetails.length,
      orders: ordersWithDetails
    });
  } catch (error) {
    console.error("Error fetching confirmed orders:", error);
    return next(createError(500, "Error fetching confirmed orders: " + error.message));
  }
};

// Reject an order (don't want to deliver it)
export const rejectOrder = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    
    if (!orderId) {
      return next(createError(400, "Order ID is required"));
    }
    
    // Get delivery agent
    const agent = await DeliveryAgent.findOne({ user: req.user.id });
    if (!agent) {
      return next(createError(404, "Delivery agent profile not found"));
    }

    // Check if agent is verified and available
    if (!agent.isVerified) {
      return next(createError(403, "Your account is not yet verified to reject orders"));
    }
    
    if (!agent.isAvailable) {
      return next(createError(400, "You need to set yourself as available to manage orders"));
    }

    // Find order
    const order = await Order.findById(orderId);
    if (!order) {
      return next(createError(404, "Order not found"));
    }

    if (order.deliveryAgent) {
      return next(createError(400, "This order has already been assigned to a delivery agent"));
    }

    // Initialize rejectedOrders array if it doesn't exist
    if (!agent.rejectedOrders) {
      agent.rejectedOrders = [];
    }
    
    // Add order to agent's rejected orders list
    if (!agent.rejectedOrders.includes(order._id)) {
      agent.rejectedOrders.push(order._id);
      await agent.save();
    }

    return res.status(200).json({
      success: true,
      message: "Order rejected successfully",
      orderId: order._id
    });
  } catch (error) {
    console.error("Error rejecting order:", error);
    return next(createError(500, "Error rejecting order: " + error.message));
  }
};