import Order from "../models/order.model.js";
import { User } from "../models/user.model.js";
import { Post } from "../models/post.model.js";
import createError from "../utils/error.js";
import { createNotification } from "./notification.controller.js";
import { io, getReceiverSocketId, getConnectedUsers } from "../socket/socket.js";

// Create a new order
export const createOrder = async (req, res, next) => {
  try {
    console.log("Order creation request received:", req.body);
    
    const {
      items,
      deliveryAddress,
      deliveryMethod,
      paymentMethod,
      deliveryInstructions,
      contactNumber,
      subtotal,
      tax,
      deliveryFee,
      discount,
      total,
      promoCodeApplied,
      pickupCoordinates, // [longitude, latitude]
      deliveryCoordinates // [longitude, latitude]
    } = req.body;

    // Validate required fields
    if (!items || items.length === 0) {
      return next(createError(400, "Order must contain items"));
    }

    if (!deliveryAddress) {
      return next(createError(400, "Delivery address is required"));
    }

    if (!contactNumber) {
      return next(createError(400, "Contact number is required"));
    }
    
    // Validate items array and collect post authors for notifications
    const postAuthors = new Set(); // Use Set to avoid duplicate notifications to same author
    
    for (const item of items) {
      if (!item.productId) {
        return next(createError(400, "Each item must have a product ID"));
      }
      
      if (!item.quantity || item.quantity <= 0) {
        return next(createError(400, "Each item must have a valid quantity"));
      }
      
      // Verify product exists and collect author info
      try {
        const product = await Post.findById(item.productId).populate('author', 'username profilePicture');
        if (!product) {
          return next(createError(404, `Product not found: ${item.productId}`));
        }
        
        // Add the post author to our notification list
        if (product.author && product.author._id.toString() !== req.user.id) {
          postAuthors.add({
            authorId: product.author._id.toString(),
            authorUsername: product.author.username,
            authorProfilePicture: product.author.profilePicture,
            postId: product._id,
            postCaption: product.caption,
            postImage: product.image
          });
        }
        
        // Always allow ordering any quantity, regardless of available stock
        // Removed the stock quantity check that was here
      } catch (err) {
        console.error("Error checking product:", err);
        return next(createError(500, "Error validating product availability"));
      }
    }

    // Prepare pickup and delivery locations
    const pickupLocation = {
      type: "Point",
      coordinates: pickupCoordinates || [0, 0] // Default to [0,0] if not provided
    };
    
    const deliveryLocation = {
      type: "Point",
      coordinates: deliveryCoordinates || [0, 0] // Default to [0,0] if not provided
    };
    
    // Create initial status history entry
    const statusHistory = [{
      status: 'processing',
      timestamp: new Date(),
      note: 'Order received'
    }];

    // Generate pickup code for pickup orders
    let pickupCode = null;
    let pickupCodeExpiresAt = null;
    
    if (deliveryMethod === 'pickup') {
      // Generate 4-digit pickup code
      pickupCode = Math.floor(1000 + Math.random() * 9000).toString();
      // Set expiration time to 24 hours from now
      pickupCodeExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    }

    // Create the order with a default status of 'processing'
    const newOrder = new Order({
      user: req.user.id,
      items,
      deliveryAddress,
      pickupLocation,
      deliveryLocation,
      deliveryMethod,
      deliveryInstructions,
      contactNumber,
      subtotal,
      tax,
      deliveryFee,
      discount,
      total,
      promoCodeApplied,
      status: 'processing',
      paymentMethod,
      paymentStatus: paymentMethod === 'cash' ? 'pending' : 'paid',
      statusHistory,
      pickupCode,
      pickupCodeExpiresAt
    });

    // Save the order
    const savedOrder = await newOrder.save();
    console.log("Order saved successfully:", savedOrder._id);

    // Get the customer details for notification
    const customer = await User.findById(req.user.id).select('username profilePicture');

    // Send notifications to all post authors whose items were ordered
    console.log(`Found ${postAuthors.size} unique post authors to notify:`, Array.from(postAuthors).map(a => a.authorUsername));
    
    // Debug: Show all connected users
    console.log('=== DEBUG: Connected users at notification time ===');
    getConnectedUsers();
    
    for (const authorInfo of postAuthors) {
      try {
        console.log(`Processing notification for author: ${authorInfo.authorUsername} (${authorInfo.authorId})`);
        
        // Create notification message
        const orderItemsCount = items.filter(item => 
          item.productId && savedOrder.items.some(orderItem => 
            orderItem.productId.toString() === item.productId.toString()
          )
        ).length;
        
        const isPickupOrder = deliveryMethod === 'pickup';
        const notificationMessage = isPickupOrder 
          ? `${customer.username} placed a pickup order for ${orderItemsCount} item(s) from your post - Total: ₹${total.toFixed(2)}`
          : `${customer.username} placed an order for ${orderItemsCount} item(s) from your post - Total: ₹${total.toFixed(2)}`;

        console.log(`Creating database notification for ${authorInfo.authorUsername} with message: ${notificationMessage}`);

        // Create notification in database
        const dbNotification = await createNotification(
          req.user.id, // sender (customer)
          authorInfo.authorId, // recipient (post author)
          "order", // notification type
          notificationMessage,
          authorInfo.postId, // post reference
          null, // no comment reference
          savedOrder._id // order reference
        );
        
        if (dbNotification) {
          console.log(`Database notification created successfully with ID: ${dbNotification._id}`);
        } else {
          console.error(`Failed to create database notification for ${authorInfo.authorUsername}`);
        }

        // Send real-time socket notification to post author
        const authorSocketId = getReceiverSocketId(authorInfo.authorId);
        console.log(`Socket ID for ${authorInfo.authorUsername}: ${authorSocketId}`);
        
        if (authorSocketId) {
          const realtimeNotification = {
            type: "order",
            sender: {
              _id: req.user.id,
              username: customer.username,
              profilePicture: customer.profilePicture
            },
            recipient: authorInfo.authorId,
            post: {
              _id: authorInfo.postId,
              caption: authorInfo.postCaption,
              image: authorInfo.postImage
            },
            order: {
              _id: savedOrder._id,
              total: total,
              itemsCount: orderItemsCount,
              deliveryMethod: deliveryMethod,
              status: savedOrder.status,
              createdAt: savedOrder.createdAt,
              contactNumber: contactNumber,
              items: items.filter(item => 
                savedOrder.items.some(orderItem => 
                  orderItem.productId.toString() === item.productId.toString()
                )
              ).map(item => ({
                productId: item.productId,
                quantity: item.quantity,
                price: item.price,
                name: item.name
              }))
            },
            message: notificationMessage,
            createdAt: new Date().toISOString(),
            read: false
          };

          console.log(`Sending real-time notification to ${authorInfo.authorUsername}:`, JSON.stringify(realtimeNotification, null, 2));
          io.to(authorSocketId).emit("newNotification", realtimeNotification);
          console.log(`Real-time notification sent successfully to ${authorInfo.authorUsername}`);
        } else {
          console.log(`Post author ${authorInfo.authorUsername} is not online, notification saved to database only`);
        }

      } catch (notificationError) {
        console.error(`Failed to send notification to post author ${authorInfo.authorId}:`, notificationError);
        // Continue with order creation even if notification fails
      }
    }

    // Update product stock/inventory but don't enforce quantity limits
    for (const item of items) {
      // Get current product
      const product = await Post.findById(item.productId);
      
      // Update the quantity, ensuring it doesn't go below 1
      // This ensures the product always stays in stock
      let newQuantity = product.quantity - item.quantity;
      if (newQuantity < 1) newQuantity = 1;
      
      // Update available quantity in post
      await Post.findByIdAndUpdate(
        item.productId,
        { quantity: newQuantity },
        { new: true }
      );
    }

    return res.status(201).json({
      success: true,
      message: "Order placed successfully",
      order: savedOrder
    });
  } catch (error) {
    console.error("Error creating order:", error);
    return next(createError(500, "Error creating order: " + error.message));
  }
};

// Get orders for current user
export const getUserOrders = async (req, res, next) => {
  try {
    console.log(`Fetching orders for user: ${req.user.username} (ID: ${req.user.id})`);
    
    // Make sure we have a valid user ID
    if (!req.user || !req.user.id) {
      console.error("No authenticated user found in request");
      return next(createError(401, "Authentication required"));
    }
    
    // Find orders for this specific user only
    const orders = await Order.find({ user: req.user.id })
      .sort({ createdAt: -1 }) // Sort by newest first
      .populate({ 
        path: 'items.productId',
        select: 'caption image price category vegetarian'
      });
      
    console.log(`Found ${orders.length} orders for user ${req.user.id}`);

    // Format orders for response
    const formattedOrders = orders.map(order => {
      // Combine order data with product details
      const formattedItems = order.items.map(item => {
        const product = item.productId; 
        return {
          productId: product?._id || item.productId,
          name: product?.caption || item.name,
          price: item.price,
          quantity: item.quantity,
          image: product?.image || null
        };
      });

      return {
        _id: order._id,
        user: order.user, // Include user ID so frontend can verify
        items: formattedItems,
        deliveryAddress: order.deliveryAddress,
        deliveryMethod: order.deliveryMethod,
        paymentMethod: order.paymentMethod,
        deliveryInstructions: order.deliveryInstructions,
        contactNumber: order.contactNumber,
        subtotal: order.subtotal,
        tax: order.tax,
        deliveryFee: order.deliveryFee,
        discount: order.discount,
        total: order.total,
        promoCodeApplied: order.promoCodeApplied,
        status: order.status,
        paymentStatus: order.paymentStatus,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt
      };
    });

    return res.status(200).json({
      success: true,
      message: "Orders fetched successfully",
      count: formattedOrders.length,
      userId: req.user.id,
      orders: formattedOrders
    });
  } catch (error) {
    console.error("Error fetching user orders:", error);
    return next(createError(500, "Error fetching orders"));
  }
};

// Get order by ID
export const getOrderById = async (req, res, next) => {
  try {
    const orderId = req.params.id;

    // Find the order
    const order = await Order.findById(orderId)
      .populate({
        path: 'items.productId',
        select: 'caption image price category vegetarian'
      })
      .populate({
        path: 'deliveryAgent',
        select: 'vehicleType vehicleNumber currentLocation',
        populate: {
          path: 'user',
          select: 'username avatar' 
        }
      });

    if (!order) {
      return next(createError(404, "Order not found"));
    }

    // Check if the order belongs to the user or if user is admin, or if user is author of items in a pickup order
    const isOrderOwner = order.user.toString() === req.user.id;
    const isAdmin = req.user.isAdmin;
    
    // For pickup orders, check if the current user is an author of any items in the order
    let isItemAuthor = false;
    if (order.deliveryMethod === 'pickup') {
      // Populate the items to check authorship
      await order.populate({
        path: 'items.productId',
        select: 'author',
        populate: {
          path: 'author',
          select: '_id'
        }
      });
      
      isItemAuthor = order.items.some(item => 
        item.productId && 
        item.productId.author && 
        item.productId.author._id.toString() === req.user.id
      );
    }
    
    if (!isOrderOwner && !isAdmin && !isItemAuthor) {
      return next(createError(403, "You are not authorized to access this order"));
    }

    // Re-populate items with full details for response
    await order.populate({
      path: 'items.productId',
      select: 'caption image price category vegetarian'
    });

    // Format order items with product details
    const formattedItems = order.items.map(item => {
      const product = item.productId;
      return {
        productId: product?._id || item.productId,
        name: product?.caption || item.name,
        price: item.price,
        quantity: item.quantity,
        image: product?.image || null
      };
    });

    // Format delivery agent info if present
    let deliveryAgentInfo = null;
    if (order.deliveryAgent) {
      deliveryAgentInfo = {
        id: order.deliveryAgent._id,
        name: order.deliveryAgent.user?.username || 'Delivery Agent',
        avatar: order.deliveryAgent.user?.avatar || null,
        vehicleType: order.deliveryAgent.vehicleType,
        vehicleNumber: order.deliveryAgent.vehicleNumber,
        currentLocation: order.deliveryAgent.currentLocation
      };
    }

    // Get the latest status history entry
    const latestStatus = order.statusHistory && order.statusHistory.length > 0
      ? order.statusHistory[order.statusHistory.length - 1]
      : null;

    const formattedOrder = {
      _id: order._id,
      items: formattedItems,
      deliveryAddress: order.deliveryAddress,
      deliveryMethod: order.deliveryMethod,
      paymentMethod: order.paymentMethod,
      deliveryInstructions: order.deliveryInstructions,
      contactNumber: order.contactNumber,
      subtotal: order.subtotal,
      tax: order.tax,
      deliveryFee: order.deliveryFee,
      discount: order.discount,
      total: order.total,
      promoCodeApplied: order.promoCodeApplied,
      status: order.status,
      paymentStatus: order.paymentStatus,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      deliveryLocation: order.deliveryLocation,
      pickupLocation: order.pickupLocation,
      estimatedDeliveryTime: order.estimatedDeliveryTime,
      actualDeliveryTime: order.actualDeliveryTime,
      deliveryAgent: deliveryAgentInfo,
      statusHistory: order.statusHistory || [],
      latestStatus: latestStatus
    };

    // Add customer information for pickup orders when accessed by post authors
    if (order.deliveryMethod === 'pickup' && isItemAuthor) {
      await order.populate({
        path: 'user',
        select: 'username profilePicture'
      });
      
      formattedOrder.customer = {
        username: order.user.username,
        profilePicture: order.user.profilePicture,
        contactNumber: order.contactNumber
      };
    }

    return res.status(200).json({
      success: true,
      message: "Order fetched successfully",
      order: formattedOrder
    });
  } catch (error) {
    console.error("Error fetching order:", error);
    return next(createError(500, "Error fetching order"));
  }
};

// Cancel an order
export const cancelOrder = async (req, res, next) => {
  try {
    const orderId = req.params.id;

    // Find the order
    const order = await Order.findById(orderId);

    if (!order) {
      return next(createError(404, "Order not found"));
    }

    // Check if the order belongs to the user
    if (order.user.toString() !== req.user.id) {
      return next(createError(403, "You are not authorized to cancel this order"));
    }

    // Check if the order is in a cancellable state
    if (['delivered', 'cancelled'].includes(order.status)) {
      return next(createError(400, `Can't cancel an order that is already ${order.status}`));
    }

    // Update order status
    order.status = 'cancelled';
    await order.save();

    // Restore product inventory
    for (const item of order.items) {
      // Update post quantity (add back to inventory)
      await Post.findByIdAndUpdate(
        item.productId,
        { $inc: { quantity: item.quantity } },
        { new: true }
      );
    }

    return res.status(200).json({
      success: true,
      message: "Order cancelled successfully",
      order
    });
  } catch (error) {
    console.error("Error cancelling order:", error);
    return next(createError(500, "Error cancelling order"));
  }
};

// Reorder (create a new order from an existing one)
export const reorder = async (req, res, next) => {
  try {
    const orderId = req.params.id;

    // Find the original order
    const originalOrder = await Order.findById(orderId);

    if (!originalOrder) {
      return next(createError(404, "Original order not found"));
    }

    // Check if the order belongs to the user
    if (originalOrder.user.toString() !== req.user.id) {
      return next(createError(403, "You are not authorized to reorder this order"));
    }

    // Create a new order with the same details
    const newOrder = new Order({
      user: req.user.id,
      items: originalOrder.items,
      deliveryAddress: originalOrder.deliveryAddress,
      deliveryMethod: originalOrder.deliveryMethod,
      paymentMethod: originalOrder.paymentMethod,
      deliveryInstructions: originalOrder.deliveryInstructions,
      contactNumber: originalOrder.contactNumber,
      subtotal: originalOrder.subtotal,
      tax: originalOrder.tax,
      deliveryFee: originalOrder.deliveryFee,
      discount: 0, // No discount for reorders
      total: originalOrder.subtotal + originalOrder.tax + originalOrder.deliveryFee, // Recalculate total without discount
      status: 'processing',
      paymentStatus: originalOrder.paymentMethod === 'cash' ? 'pending' : 'paid'
    });

    // Save the new order
    const savedOrder = await newOrder.save();

    // Update product stock/inventory
    for (const item of originalOrder.items) {
      // Update available quantity in post
      await Post.findByIdAndUpdate(
        item.productId,
        { $inc: { quantity: -item.quantity } },
        { new: true }
      );
    }

    return res.status(201).json({
      success: true,
      message: "Order reordered successfully",
      order: savedOrder
    });
  } catch (error) {
    console.error("Error reordering:", error);
    return next(createError(500, "Error reordering"));
  }
};

// Admin: Get all orders
export const getAllOrders = async (req, res, next) => {
  try {
    // Parse pagination params
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Parse filter params
    const status = req.query.status;
    const search = req.query.search;
    const sortBy = req.query.sortBy || 'createdAt';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
    
    // Build filter object
    const filter = {};
    if (status && status !== 'all') {
      filter.status = status;
    }
    
    // Add search functionality
    if (search && search.trim() !== '') {
      const searchRegex = new RegExp(search.trim(), 'i');
      
      // Search in user's name/username/email if populated
      const usersWithMatchingName = await User.find({
        $or: [
          { name: searchRegex },
          { username: searchRegex },
          { email: searchRegex }
        ]
      }).select('_id');
      
      const userIds = usersWithMatchingName.map(user => user._id);
      
      // Build the search filter
      filter.$or = [
        { _id: search.length >= 24 ? search : null }, // Match by exact ID if valid MongoDB ID format
        { user: { $in: userIds } },                   // Match by user
        { 'items.name': searchRegex },                // Match by item name
        { contactNumber: searchRegex },               // Match by contact number
        { deliveryAddress: searchRegex }              // Match in address
      ];
    }
    
    // Count total orders matching the filter
    const totalOrders = await Order.countDocuments(filter);
    
    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder;
    
    // Query orders with pagination, sorting, and filtering
    const orders = await Order.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate('user', 'username email profilePicture name')
      .populate({
        path: 'items.productId',
        select: 'caption image price category'
      });
    
    // Calculate pagination info
    const totalPages = Math.ceil(totalOrders / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;
    
    return res.status(200).json({
      success: true,
      message: "Orders fetched successfully",
      pagination: {
        totalOrders,
        totalPages,
        currentPage: page,
        limit,
        hasNextPage,
        hasPrevPage
      },
      orders
    });
  } catch (error) {
    console.error("Error fetching all orders:", error);
    return next(createError(500, "Error fetching orders"));
  }
};

// Admin: Update order status
export const updateOrderStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, note } = req.body;
    
    // Validate status value
    const validStatuses = ['processing', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return next(createError(400, "Invalid status value"));
    }
    
    // Find the order
    const order = await Order.findById(id);
    if (!order) {
      return next(createError(404, "Order not found"));
    }
    
    // Update status
    const oldStatus = order.status;
    order.status = status;
    
    // Add status change to history
    order.statusHistory.push({
      status,
      timestamp: new Date(),
      note: note || `Status changed from ${oldStatus} to ${status}`
    });
    
    // Additional processing based on status
    switch (status) {
      case 'confirmed':
        // Notify customer that order is confirmed
        break;
      case 'preparing':
        // Notify customer that order is being prepared
        break;
      case 'out_for_delivery':
        // If no delivery agent assigned yet, this is just a status change
        // Agent assignment is handled in the assignOrderAgent function
        break;
      case 'delivered':
        order.actualDeliveryTime = new Date();
        break;
      case 'cancelled':
        // Handle refund process if needed
        if (order.paymentStatus === 'paid') {
          order.paymentStatus = 'refunded';
        }
        break;
      default:
        // No additional processing needed
        break;
    }
    
    // Save the updated order
    await order.save();
    
    // Notify user about order status change via socket
    const io = req.app.get('io');
    if (io) {
      io.to(`user_${order.user}`).emit("orderStatusUpdate", {
        orderId: order._id,
        status: order.status,
        timestamp: new Date()
      });
    }
    
    return res.status(200).json({
      success: true,
      message: `Order status updated to ${status}`,
      order
    });
  } catch (error) {
    console.error("Error updating order status:", error);
    return next(createError(500, "Error updating order status: " + error.message));
  }
};

// Admin: Get order statistics
export const getOrderStats = async (req, res, next) => {
  try {
    // Get total count by status
    const statusCounts = await Order.aggregate([
      { 
        $group: { 
          _id: "$status", 
          count: { $sum: 1 },
          revenue: { $sum: "$total" }
        } 
      },
      { $sort: { _id: 1 } }
    ]);
    
    // Get total count by payment status
    const paymentStatusCounts = await Order.aggregate([
      { 
        $group: { 
          _id: "$paymentStatus", 
          count: { $sum: 1 },
          amount: { $sum: "$total" }
        } 
      },
      { $sort: { _id: 1 } }
    ]);
    
    // Get daily order count for the past 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const dailyOrders = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: sevenDaysAgo }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 },
          revenue: { $sum: "$total" }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    
    // Format the data for easier consumption
    const formattedStatusCounts = statusCounts.reduce((acc, curr) => {
      acc[curr._id] = { count: curr.count, revenue: curr.revenue };
      return acc;
    }, {});
    
    const formattedPaymentStatusCounts = paymentStatusCounts.reduce((acc, curr) => {
      acc[curr._id] = { count: curr.count, amount: curr.amount };
      return acc;
    }, {});
    
    // Calculate total orders and revenue
    const totalOrders = await Order.countDocuments();
    const totalRevenue = await Order.aggregate([
      { $group: { _id: null, total: { $sum: "$total" } } }
    ]);
    
    return res.status(200).json({
      success: true,
      message: "Order statistics fetched successfully",
      stats: {
        totalOrders,
        totalRevenue: totalRevenue.length > 0 ? totalRevenue[0].total : 0,
        byStatus: formattedStatusCounts,
        byPaymentStatus: formattedPaymentStatusCounts,
        dailyOrders
      }
    });
  } catch (error) {
    console.error("Error fetching order statistics:", error);
    return next(createError(500, "Error fetching order statistics"));
  }
};

// Admin: Get order status history
export const getOrderStatusHistory = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Validate input
    if (!id) {
      return next(createError(400, "Order ID is required"));
    }
    
    // Find the order
    const order = await Order.findById(id);
    
    if (!order) {
      return next(createError(404, "Order not found"));
    }
    
    // For now, we'll create a mock status history since the model doesn't track it
    // In a real application, you would have a separate collection for status history
    
    const mockStatusHistory = [
      {
        status: 'processing',
        timestamp: new Date(order.createdAt),
        notes: 'Order received'
      }
    ];
    
    // Add additional statuses based on order's current status
    const statusFlow = ['processing', 'confirmed', 'preparing', 'out_for_delivery', 'delivered'];
    const currentStatusIndex = statusFlow.indexOf(order.status);
    
    // If order is cancelled, add only the cancelled status
    if (order.status === 'cancelled') {
      mockStatusHistory.push({
        status: 'cancelled',
        timestamp: new Date(order.updatedAt),
        notes: 'Order was cancelled'
      });
    } else {
      // Add history entries for each status up to the current one
      for (let i = 1; i <= currentStatusIndex; i++) {
        const timeOffset = i * 30 * 60000; // 30 minutes between statuses
        mockStatusHistory.push({
          status: statusFlow[i],
          timestamp: new Date(new Date(order.createdAt).getTime() + timeOffset),
          notes: `Status updated to ${statusFlow[i]}`
        });
      }
    }
    
    return res.status(200).json({
      success: true,
      message: "Status history fetched successfully",
      statusHistory: mockStatusHistory
    });
  } catch (error) {
    console.error("Error fetching status history:", error);
    return next(createError(500, "Error fetching status history"));
  }
};

// Admin: Assign delivery agent to an order
export const assignOrderAgent = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { agentId } = req.body;
    
    // Validate input
    if (!id) {
      return next(createError(400, "Order ID is required"));
    }
    
    if (!agentId) {
      return next(createError(400, "Agent ID is required"));
    }
    
    // Find the order
    const order = await Order.findById(id);
    
    if (!order) {
      return next(createError(404, "Order not found"));
    }
    
    // In a real application, you would verify that the agent exists
    // and is available for delivery
    
    // For now, we'll just create a mock agent object
    const mockAgent = {
      id: agentId,
      name: agentId === 'agent1' ? 'John Doe' : 
            agentId === 'agent2' ? 'Jane Smith' : 'Mike Johnson'
    };
    
    // Update the order with the delivery agent info
    const updatedOrder = await Order.findByIdAndUpdate(
      id,
      {
        $set: {
          deliveryAgent: mockAgent,
          // Also update status to out_for_delivery if it's not already delivered or cancelled
          status: (order.status !== 'delivered' && order.status !== 'cancelled') ? 'out_for_delivery' : order.status
        }
      },
      { new: true }
    )
    .populate('user', 'username email profilePicture')
    .populate({
      path: 'items.productId',
      select: 'caption image price category'
    });
    
    return res.status(200).json({
      success: true,
      message: "Delivery agent assigned successfully",
      order: updatedOrder
    });
  } catch (error) {
    console.error("Error assigning delivery agent:", error);
    return next(createError(500, "Error assigning delivery agent"));
  }
};

// Test notification function (for debugging)
export const testNotification = async (req, res, next) => {
  try {
    const { recipientId, message = "Test order notification" } = req.body;
    
    if (!recipientId) {
      return next(createError(400, "Recipient ID is required"));
    }

    console.log(`=== TESTING NOTIFICATION SYSTEM ===`);
    console.log(`Sender: ${req.user.username} (${req.user.id})`);
    console.log(`Recipient: ${recipientId}`);
    console.log(`Message: ${message}`);
    
    // Debug: Show all connected users
    console.log('=== DEBUG: Connected users at test time ===');
    getConnectedUsers();
    
    // Get customer details
    const customer = await User.findById(req.user.id).select('username profilePicture');
    
    // Create a fake order for testing
    const fakeOrder = {
      _id: "test-order-" + Date.now(),
      total: 299.99,
      status: "processing",
      createdAt: new Date()
    };
    
    // Get post author details
    const postAuthor = await User.findById(recipientId).select('username profilePicture');
    if (!postAuthor) {
      return next(createError(404, "Post author not found"));
    }
    
    console.log(`Creating database notification for ${postAuthor.username}...`);
    
    // Create notification in database
    const dbNotification = await createNotification(
      req.user.id, // sender (customer)
      recipientId, // recipient (post author)
      "order", // notification type
      message,
      null, // no post reference for test
      null, // no comment reference
      fakeOrder._id // fake order reference
    );
    
    if (dbNotification) {
      console.log(`Database notification created successfully with ID: ${dbNotification._id}`);
    } else {
      console.error(`Failed to create database notification for ${postAuthor.username}`);
    }

    // Send real-time socket notification to post author
    const authorSocketId = getReceiverSocketId(recipientId);
    console.log(`Socket ID for ${postAuthor.username}: ${authorSocketId}`);
    
    if (authorSocketId) {
      const realtimeNotification = {
        type: "order",
        sender: {
          _id: req.user.id,
          username: customer.username,
          profilePicture: customer.profilePicture
        },
        recipient: recipientId,
        post: null, // no post for test
        order: fakeOrder,
        message: message,
        createdAt: new Date().toISOString(),
        read: false
      };

      console.log(`Sending real-time test notification to ${postAuthor.username}:`, JSON.stringify(realtimeNotification, null, 2));
      io.to(authorSocketId).emit("newNotification", realtimeNotification);
      console.log(`Real-time notification sent successfully to ${postAuthor.username}`);
    } else {
      console.log(`Post author ${postAuthor.username} is not online, notification saved to database only`);
    }

    return res.status(200).json({
      success: true,
      message: "Test notification sent",
      data: {
        recipient: postAuthor.username,
        socketConnected: !!authorSocketId,
        dbNotificationId: dbNotification?._id
      }
    });
  } catch (error) {
    console.error("Error sending test notification:", error);
    return next(createError(500, "Error sending test notification: " + error.message));
  }
};

// Verify pickup code for self-pickup orders
export const verifyPickupCode = async (req, res, next) => {
  try {
    const { orderId, pickupCode } = req.body;

    if (!orderId || !pickupCode) {
      return next(createError(400, "Order ID and pickup code are required"));
    }

    // Find the order
    const order = await Order.findById(orderId)
      .populate('user', 'username contactNumber')
      .populate({
        path: 'items.productId',
        select: 'caption author image',
        populate: {
          path: 'author',
          select: '_id username'
        }
      });

    if (!order) {
      return next(createError(404, "Order not found"));
    }

    // Check if this is a pickup order
    if (order.deliveryMethod !== 'pickup') {
      return next(createError(400, "This is not a pickup order"));
    }

    // Check if the pickup code matches
    if (order.pickupCode !== pickupCode) {
      console.log("❌ Pickup code mismatch:", { provided: pickupCode, stored: order.pickupCode });
      return next(createError(400, `Invalid pickup code. Provided: ${pickupCode}, Expected: ${order.pickupCode} (Debug info for development)`));
    }

    // Check if the pickup code has expired
    if (order.pickupCodeExpiresAt && new Date() > order.pickupCodeExpiresAt) {
      return next(createError(400, "Pickup code has expired"));
    }

    // Check if pickup is already completed
    if (order.isPickupCompleted) {
      return next(createError(400, "Order has already been picked up"));
    }

    // Verify that the current user is one of the post authors for this order
    const userIsAuthor = order.items.some(item => {
      const authorId = item.productId?.author?._id?.toString();
      const currentUserId = req.user.id.toString();
      const isAuthor = item.productId && item.productId.author && authorId === currentUserId;
      console.log(`📝 Checking item ${item.productId?._id}: author=${authorId}, currentUser=${currentUserId}, isAuthor=${isAuthor}`);
      return isAuthor;
    });

    if (!userIsAuthor) {
      return next(createError(403, "You are not authorized to complete this pickup"));
    }

    return res.status(200).json({
      success: true,
      message: "Pickup code verified successfully",
      order: {
        _id: order._id,
        customer: {
          username: order.user.username,
          contactNumber: order.user.contactNumber || order.contactNumber
        },
        items: order.items,
        total: order.total,
        createdAt: order.createdAt
      }
    });
  } catch (error) {
    console.error("Error verifying pickup code:", error);
    return next(createError(500, "Error verifying pickup code: " + error.message));
  }
};

// Complete pickup for self-pickup orders
export const completePickup = async (req, res, next) => {
  try {
    console.log("🚗 === COMPLETE PICKUP ENDPOINT CALLED ===");
    console.log("📋 Request body:", req.body);
    console.log("👤 User:", req.user.username, req.user.id);
    
    const { orderId, pickupCode } = req.body;

    if (!orderId || !pickupCode) {
      console.log("❌ Missing required fields:", { orderId: !!orderId, pickupCode: !!pickupCode });
      return next(createError(400, "Order ID and pickup code are required"));
    }

    console.log(`🔍 Looking for order: ${orderId} with pickup code: ${pickupCode}`);

    // Find the order
    const order = await Order.findById(orderId)
      .populate('user', 'username profilePicture')
      .populate({
        path: 'items.productId',
        select: 'caption author image',
        populate: {
          path: 'author',
          select: '_id username'
        }
      });

    if (!order) {
      console.log("❌ Order not found in database");
      return next(createError(404, "Order not found"));
    }

    console.log("✅ Order found:", {
      id: order._id,
      deliveryMethod: order.deliveryMethod,
      status: order.status,
      isPickupCompleted: order.isPickupCompleted,
      storedPickupCode: order.pickupCode
    });

    // Check if this is a pickup order
    if (order.deliveryMethod !== 'pickup') {
      console.log("❌ Not a pickup order:", order.deliveryMethod);
      return next(createError(400, "This is not a pickup order"));
    }

    // Check if the pickup code matches
    if (order.pickupCode !== pickupCode) {
      console.log("❌ Pickup code mismatch:", { provided: pickupCode, stored: order.pickupCode });
      return next(createError(400, "Invalid pickup code"));
    }

    // Check if the pickup code has expired
    if (order.pickupCodeExpiresAt && new Date() > order.pickupCodeExpiresAt) {
      console.log("❌ Pickup code expired:", order.pickupCodeExpiresAt);
      return next(createError(400, "Pickup code has expired"));
    }

    // Check if pickup is already completed
    if (order.isPickupCompleted) {
      console.log("❌ Order already picked up");
      return next(createError(400, "Order has already been picked up"));
    }

    // Verify that the current user is one of the post authors for this order
    console.log("🔐 Authorization check starting...");
    console.log("📋 Current user ID:", req.user.id);
    console.log("📦 Order items with authors:", order.items.map(item => ({
      productId: item.productId?._id,
      authorId: item.productId?.author?._id,
      authorUsername: item.productId?.author?.username
    })));
    
    const userIsAuthor = order.items.some(item => {
      const authorId = item.productId?.author?._id?.toString();
      const currentUserId = req.user.id.toString();
      const isAuthor = item.productId && item.productId.author && authorId === currentUserId;
      console.log(`📝 Checking item ${item.productId?._id}: author=${authorId}, currentUser=${currentUserId}, isAuthor=${isAuthor}`);
      return isAuthor;
    });

    console.log("🔐 Final authorization result:", userIsAuthor);

    if (!userIsAuthor) {
      console.log("❌ User not authorized for this pickup");
      return next(createError(403, "You are not authorized to complete this pickup"));
    }

    console.log("✅ All validations passed, updating order...");

    // Update the order to mark pickup as completed
    const updatedOrder = await Order.findByIdAndUpdate(
      orderId,
      {
        isPickupCompleted: true,
        status: 'delivered',
        actualDeliveryTime: new Date(),
        $push: {
          statusHistory: {
            status: 'delivered',
            timestamp: new Date(),
            note: 'Order picked up by customer'
          }
        }
      },
      { new: true }
    ).populate('user', 'username profilePicture').populate('items.productId', 'caption author image');

    console.log("✅ Order updated successfully");

    // Send notification to customer about successful pickup
    try {
      console.log("📩 Sending pickup completion notification to customer...");
      const pickupNotificationMessage = `🎉 Your pickup order has been completed! Thank you for choosing us.`;
      
      const dbNotification = await createNotification(
        req.user.id, // sender (post author)
        order.user._id, // recipient (customer)
        "order", // notification type
        pickupNotificationMessage,
        null, // no post reference
        null, // no comment reference
        order._id // order reference
      );

      console.log("✅ Database notification created:", dbNotification._id);

      // Send real-time notification to customer
      const customerSocketId = getReceiverSocketId(order.user._id.toString());
      console.log("🔍 Customer socket status:", { customerId: order.user._id, socketId: customerSocketId });
      
      if (customerSocketId) {
        const realtimeNotification = {
          type: "order",
          sender: {
            _id: req.user.id,
            username: req.user.username,
            profilePicture: req.user.profilePicture
          },
          recipient: order.user._id,
          order: {
            _id: order._id,
            status: 'delivered',
            total: order.total,
            deliveryMethod: 'pickup',
            actualDeliveryTime: updatedOrder.actualDeliveryTime
          },
          message: pickupNotificationMessage,
          createdAt: new Date().toISOString(),
          read: false
        };

        console.log("📡 Sending real-time notification to customer:", order.user.username);
        io.to(customerSocketId).emit("newNotification", realtimeNotification);
        io.to(customerSocketId).emit("orderStatusUpdate", {
          orderId: order._id,
          status: 'delivered',
          timestamp: new Date().toISOString()
        });
      } else {
        console.log("⚠️ Customer not connected to socket");
      }
    } catch (notificationError) {
      console.error("⚠️ Failed to send pickup completion notification:", notificationError);
      // Continue even if notification fails
    }

    console.log("🎉 Pickup completion successful! Sending response...");

    return res.status(200).json({
      success: true,
      message: "Pickup completed successfully",
      order: updatedOrder
    });
  } catch (error) {
    console.error("❌ Error completing pickup:", error);
    return next(createError(500, "Error completing pickup: " + error.message));
  }
};

// Debug endpoint to check pickup code for an order (development only)
export const getPickupCodeDebug = async (req, res, next) => {
  try {
    const { orderId } = req.params;

    if (!orderId) {
      return next(createError(400, "Order ID is required"));
    }

    // Find the order and populate product details including author
    const order = await Order.findById(orderId)
      .populate({
        path: 'items.productId',
        select: 'caption author image',
        populate: {
          path: 'author',
          select: '_id username'
        }
      })
      .populate('user', 'username profilePicture');

    if (!order) {
      return next(createError(404, "Order not found"));
    }

    // Return pickup code info for debugging with author information
    return res.status(200).json({
      success: true,
      orderId: order._id,
      pickupCode: order.pickupCode,
      pickupCodeExpiresAt: order.pickupCodeExpiresAt,
      deliveryMethod: order.deliveryMethod,
      isPickupCompleted: order.isPickupCompleted,
      status: order.status,
      items: order.items.map(item => ({
        productId: item.productId?._id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        author: item.productId?.author?._id,
        authorUsername: item.productId?.author?.username
      })),
      customer: {
        _id: order.user?._id,
        username: order.user?.username,
        profilePicture: order.user?.profilePicture
      }
    });
  } catch (error) {
    console.error("Error getting pickup code debug info:", error);
    return next(createError(500, "Error getting pickup code debug info: " + error.message));
  }
}; 