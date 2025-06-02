import axios from "axios";
import { API_BASE_URL } from "../utils/apiConfig";
import axiosInstance from "../utils/axiosInstance";

// We'll use the centralized axiosInstance instead of creating a new one
// This ensures consistent configuration across the application
const api = axiosInstance;

// Log the API URL being used for delivery service
console.log('Delivery service using API base URL:', API_BASE_URL);

// Add request interceptor to include auth token
api.interceptors.request.use(
  (config) => {
    // Get token from localStorage
    const token = localStorage.getItem("token");
    if (token) {
      // Add token to authorization header
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor for better error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle request timeout
    if (error.code === "ECONNABORTED") {
      console.error("Request timed out");
      return Promise.reject({
        message: "Request timed out. Please try again.",
      });
    }

    // Handle network errors
    if (!error.response) {
      console.error("Network error:", error);
      return Promise.reject({
        message: "Network error. Please check your internet connection.",
      });
    }

    // Log the error for debugging
    console.error("API Error:", error.response?.data || error.message);

    // Return a structured error
    return Promise.reject(
      error.response?.data || { message: error.message || "An error occurred" }
    );
  }
);

// Register as a delivery agent
export const registerAsDeliveryAgent = async (data) => {
  try {
    const response = await api.post("/delivery/register", data);
    return response.data;
  } catch (error) {
    console.error("Failed to register as delivery agent:", error);
    throw error;
  }
};

// Get delivery agent profile
export const getAgentProfile = async () => {
  try {
    const response = await api.get("/delivery/profile");
    return response.data;
  } catch (error) {
    console.error("Failed to fetch delivery agent profile:", error);
    throw error;
  }
};

// Get delivery history
export const getDeliveryHistory = async () => {
  try {
    const response = await api.get("/delivery/history");
    return response.data;
  } catch (error) {
    console.error("Failed to fetch delivery history:", error);
    throw error;
  }
};

// Update availability status
export const updateAvailability = async (isAvailable) => {
  try {
    const response = await api.put("/delivery/availability", {
      isAvailable,
    });
    return response.data;
  } catch (error) {
    console.error("Failed to update availability:", error);
    throw error;
  }
};

// Update current location
export const updateLocation = async (longitude, latitude) => {
  try {
    // Validate coordinates
    if (
      typeof longitude !== "number" ||
      typeof latitude !== "number" ||
      isNaN(longitude) ||
      isNaN(latitude) ||
      longitude < -180 ||
      longitude > 180 ||
      latitude < -90 ||
      latitude > 90
    ) {
      throw new Error("Invalid coordinates provided");
    }

    // Round to 6 decimal places for precision (~11cm at the equator)
    const formattedLongitude = parseFloat(longitude.toFixed(6));
    const formattedLatitude = parseFloat(latitude.toFixed(6));

    console.log(
      `Updating location: [${formattedLongitude}, ${formattedLatitude}]`
    );

    const response = await api.put("/delivery/location", {
      longitude: formattedLongitude,
      latitude: formattedLatitude,
    });

    return response.data;
  } catch (error) {
    console.error("Failed to update location:", error);
    // Add more specific error handling
    if (error.message === "Invalid coordinates provided") {
      throw { message: error.message };
    }
    if (error.code === "ECONNABORTED") {
      throw { message: "Location update timed out. Server might be busy." };
    }
    throw error;
  }
};

// Get nearby orders available for delivery
export const getNearbyOrders = async () => {
  try {
    // Added includeAllConfirmed=true to fetch all confirmed orders regardless of distance
    const response = await api.get(
      "/delivery/nearby-orders?includeAllConfirmed=true"
    );
    return response.data;
  } catch (error) {
    console.error("Failed to fetch nearby orders:", error);
    throw error;
  }
};

// Accept an order for delivery
export const acceptOrder = async (orderId, originalOrder = null) => {
  try {
    console.log(`📤 Accepting order ${orderId}...`);
    
    if (originalOrder) {
      console.log('📍 Original order coordinates before API call:', {
        id: originalOrder._id,
        pickup: originalOrder.pickupLocation?.coordinates,
        delivery: originalOrder.deliveryLocation?.coordinates
      });
    }
    
    const response = await api.post(`/delivery/accept/${orderId}`);
    
    // Log the raw response for debugging
    console.log('📥 Accept order raw response:', response.data);
    
    // Validate and fix coordinates in the response
    if (response.data.order) {
      const order = response.data.order;
      console.log(`📍 Accepted order ${orderId} coordinates from backend:`, {
        pickupLocation: order.pickupLocation,
        deliveryLocation: order.deliveryLocation,
        restaurant: order.restaurant?.location,
        user: order.user?.location
      });
      
      // If backend returned invalid coordinates but we have good ones from original order, use those
      if (originalOrder) {
        let coordinatesFixed = false;
        
        // Fix pickup coordinates if needed
        if ((!order.pickupLocation?.coordinates || 
             (order.pickupLocation.coordinates[0] === 0 && order.pickupLocation.coordinates[1] === 0)) &&
            originalOrder.pickupLocation?.coordinates &&
            (originalOrder.pickupLocation.coordinates[0] !== 0 || originalOrder.pickupLocation.coordinates[1] !== 0)) {
          
          order.pickupLocation = { ...originalOrder.pickupLocation };
          coordinatesFixed = true;
          console.warn(`⚠️ Fixed pickup coordinates for order ${orderId} using original order data`);
        }
        
        // Fix delivery coordinates if needed
        if ((!order.deliveryLocation?.coordinates || 
             (order.deliveryLocation.coordinates[0] === 0 && order.deliveryLocation.coordinates[1] === 0)) &&
            originalOrder.deliveryLocation?.coordinates &&
            (originalOrder.deliveryLocation.coordinates[0] !== 0 || originalOrder.deliveryLocation.coordinates[1] !== 0)) {
          
          order.deliveryLocation = { ...originalOrder.deliveryLocation };
          coordinatesFixed = true;
          console.warn(`⚠️ Fixed delivery coordinates for order ${orderId} using original order data`);
        }
        
        // Also preserve restaurant location if missing
        if (!order.restaurant?.location && originalOrder.restaurant?.location) {
          if (!order.restaurant) order.restaurant = {};
          order.restaurant.location = { ...originalOrder.restaurant.location };
          coordinatesFixed = true;
        }
        
        // Preserve lat/lng fields if missing
        if (!order.pickupLatitude && originalOrder.pickupLatitude) {
          order.pickupLatitude = originalOrder.pickupLatitude;
          order.pickupLongitude = originalOrder.pickupLongitude;
        }
        if (!order.deliveryLatitude && originalOrder.deliveryLatitude) {
          order.deliveryLatitude = originalOrder.deliveryLatitude;
          order.deliveryLongitude = originalOrder.deliveryLongitude;
        }
        
        if (coordinatesFixed) {
          console.log('✅ Coordinates fixed using original order data:', {
            pickup: order.pickupLocation?.coordinates,
            delivery: order.deliveryLocation?.coordinates
          });
        }
      }
      
      // Final warning if coordinates are still invalid
      if (!order.pickupLocation?.coordinates || 
          (order.pickupLocation.coordinates[0] === 0 && order.pickupLocation.coordinates[1] === 0)) {
        console.error(`❌ Order ${orderId} still has invalid pickup coordinates!`);
      }
      
      if (!order.deliveryLocation?.coordinates || 
          (order.deliveryLocation.coordinates[0] === 0 && order.deliveryLocation.coordinates[1] === 0)) {
        console.error(`❌ Order ${orderId} still has invalid delivery coordinates!`);
      }
    }
    
    return response.data;
  } catch (error) {
    console.error("Failed to accept order:", error);
    throw error;
  }
};

// Reject an order (don't want to deliver it)
export const rejectOrder = async (orderId) => {
  try {
    console.log(`Calling reject API for order: ${orderId}`);
    
    // Make sure orderId is valid
    if (!orderId) {
      throw new Error('Invalid order ID provided to reject function');
    }
    
    // Log the full URL being called
    const url = `/delivery/reject/${orderId}`;
    console.log(`Making POST request to: ${url}`);
    
    const response = await api.post(url);
    console.log('Reject order API response:', response.data);
    
    // Return response with orderId included for easier tracking
    return {
      ...response.data,
      orderId
    };
  } catch (error) {
    console.error(`Failed to reject order ${orderId}:`, error);
    console.error('Error details:', error.response?.data || error.message);
    // Re-throw with more context
    throw error.response?.data?.message || error.message || 'Failed to reject order';
  }
};

// Mark an order as delivered
export const completeDelivery = async (orderId) => {
  try {
    const response = await api.put(`/delivery/complete/${orderId}`);
    return response.data;
  } catch (error) {
    console.error("Failed to complete delivery:", error);
    throw error;
  }
};

// Admin: Get all delivery agents
export const getAllAgents = async () => {
  try {
    const response = await api.get("/delivery/admin/all");
    return response.data;
  } catch (error) {
    console.error("Failed to fetch all delivery agents:", error);
    throw error;
  }
};

// Admin: Verify delivery agent
export const verifyDeliveryAgent = async (agentId, isVerified) => {
  try {
    const response = await api.put(`/delivery/admin/verify/${agentId}`, {
      isVerified,
    });
    return response.data;
  } catch (error) {
    console.error("Failed to verify delivery agent:", error);
    throw error;
  }
};

// Get orders with 'confirmed' status that need delivery
export const getConfirmedOrders = async () => {
  try {
    const response = await api.get("/delivery/confirmed-orders");
    return response.data;
  } catch (error) {
    console.error("Failed to fetch confirmed orders:", error);
    throw error;
  }
};
