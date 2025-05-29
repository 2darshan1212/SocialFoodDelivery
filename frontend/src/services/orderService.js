import axios from "axios";
import { API_BASE_URL } from "../utils/apiConfig";
import axiosInstance from "../utils/axiosInstance";

// We'll use the centralized axiosInstance instead of creating a new one
// This ensures consistent configuration across the application
const api = axiosInstance;

// Log the API URL being used for orders
console.log('Orders service using API base URL:', API_BASE_URL);

// Add request interceptor to include auth token
api.interceptors.request.use(
  (config) => {
    // Get token from localStorage
    const token = localStorage.getItem("token");
    if (token) {
      // Add token to authorization header
      config.headers.Authorization = `Bearer ${token}`;
      console.log("Adding auth token to request");
    } else {
      console.warn("No auth token found in localStorage");
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

    // Handle authentication errors
    if (error.response.status === 401) {
      return Promise.reject({
        message: "You need to be logged in to place an order",
      });
    }

    // Return a structured error
    return Promise.reject(
      error.response?.data || { message: error.message || "An error occurred" }
    );
  }
);

// Create a new order
export const createNewOrder = async (orderData) => {
  try {
    // Ensure cash orders are marked as confirmed
    if (orderData.paymentMethod === "cash" && (!orderData.status || orderData.status === "processing")) {
      console.log("Cash on delivery order detected, setting status to confirmed");
      orderData.status = "confirmed";
    }
    
    console.log("Creating order with data:", { 
      ...orderData,
      paymentMethod: orderData.paymentMethod,
      status: orderData.status
    });
    
    const response = await api.post("/orders/create", orderData);
    
    // If it's a cash order but the status was changed by the server, override it back to confirmed
    if (orderData.paymentMethod === "cash" && 
        response.data && 
        response.data.order && 
        response.data.order.status !== "confirmed") {
      console.log("Overriding server response to ensure cash order is confirmed");
      response.data.order.status = "confirmed";
    }
    
    console.log("Order creation response status:", response.data?.order?.status);
    return response.data;
  } catch (error) {
    console.error("Order creation error:", error);
    throw error; // The interceptor will format this error
  }
};

// Get all orders for current user
export const getUserOrders = async () => {
  try {
    // Check if token exists for debugging
    const token = localStorage.getItem("token");
    console.log(
      `Auth token exists: ${!!token}`,
      token ? token.substring(0, 15) + "..." : "No token"
    );

    console.log("Fetching orders for current user with auth token");
    // Remove duplicate /api/v1 path since it's already in the baseURL
    const response = await api.get("/orders/user-orders");

    console.log("Orders API response:", {
      success: response.data?.success,
      count: response.data?.orders?.length || 0,
      userId: response.data?.userId,
      message: response.data?.message,
    });

    // Check if orders have user property
    if (response.data?.orders && response.data.orders.length > 0) {
      const sample = response.data.orders[0];
      console.log("Sample order:", {
        id: sample._id,
        hasUserField: !!sample.user,
        user: sample.user,
        items: sample.items.length,
      });
    }

    return response.data;
  } catch (error) {
    console.error("Failed to fetch orders:", error);
    throw error.response?.data || { message: "Error fetching orders" };
  }
};

// Get a specific order by ID
export const getOrderById = async (orderId) => {
  try {
    const response = await api.get(`/orders/${orderId}`);
    return response.data;
  } catch (error) {
    throw error.response?.data || { message: "Error fetching order" };
  }
};

// Get order status history
export const getOrderStatusHistory = async (orderId) => {
  try {
    const response = await api.get(`/orders/${orderId}/status-history`);
    return response.data;
  } catch (error) {
    console.error("Failed to fetch order status history:", error);
    throw error;
  }
};

// Update order status
export const updateOrderStatus = async (orderId, status, note = "") => {
  try {
    console.log(`Updating order ${orderId} status to ${status}`);
    const response = await api.put(`/orders/${orderId}/status`, {
      status,
      note,
    });
    return response.data;
  } catch (error) {
    console.error(`Failed to update order status to ${status}:`, error);
    throw error;
  }
};

// Cancel an order
export const cancelOrder = async (orderId) => {
  try {
    const response = await api.put(`/orders/${orderId}/cancel`);
    return response.data;
  } catch (error) {
    throw error.response?.data || { message: "Error cancelling order" };
  }
};

// Reorder a previous order
export const reorderPreviousOrder = async (orderId) => {
  try {
    const response = await api.post(`/orders/${orderId}/reorder`);
    return response.data;
  } catch (error) {
    throw error.response?.data || { message: "Error reordering" };
  }
};
