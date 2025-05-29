import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axiosInstance from "../utils/axiosInstance";
import { API_BASE_URL } from "../utils/apiConfig";

// Use the centralized axiosInstance with proper auth handling
const api = axiosInstance;

// Action to receive a new order into admin slice
export const receiveNewOrder = createAsyncThunk(
  "admin/receiveNewOrder",
  async (order, { rejectWithValue }) => {
    if (!order) {
      return rejectWithValue("No order data provided");
    }
    
    // Log the raw order data received
    console.log("Admin receiveNewOrder raw coordinates:", {
      pickup: order.pickupLocation?.coordinates,
      delivery: order.deliveryLocation?.coordinates,
      orderID: order._id
    });
    
    // For orders with missing coordinates, try to extract them from related data
    // Like user location, post author location, etc.
    let enhancedOrder = {...order};
    
    // If coordinates are missing or [0,0], try to get them from additional sources
    if (!order.pickupLocation?.coordinates || 
        (order.pickupLocation.coordinates[0] === 0 && order.pickupLocation.coordinates[1] === 0)) {
      // Try to get coordinates from seller/post author if available
      if (order.postAuthor && order.postAuthor.location && order.postAuthor.location.coordinates) {
        enhancedOrder.pickupLocation = {
          type: "Point",
          coordinates: order.postAuthor.location.coordinates
        };
        console.log("Using post author location for pickup:", enhancedOrder.pickupLocation.coordinates);
      }
    }
    
    if (!order.deliveryLocation?.coordinates || 
        (order.deliveryLocation.coordinates[0] === 0 && order.deliveryLocation.coordinates[1] === 0)) {
      // Try to get coordinates from buyer/user if available
      if (order.user && order.user.location && order.user.location.coordinates) {
        enhancedOrder.deliveryLocation = {
          type: "Point",
          coordinates: order.user.location.coordinates
        };
        console.log("Using user location for delivery:", enhancedOrder.deliveryLocation.coordinates);
      }
    }
    
    // Return the enhanced order with all available location data
    return { order: normalizeOrder(enhancedOrder) };
  }
);

// Normalize order data when receiving from API
const normalizeOrder = (order) => {
  if (!order) return null;
  
  // Set default status based on payment method
  // For cash on delivery, set status to confirmed if it's currently processing
  let defaultStatus = "processing";
  if (order.paymentMethod === "cash") {
    defaultStatus = "confirmed";
    console.log("Admin: Cash on delivery order detected, setting default status to confirmed");
  }
  
  // Create a normalized order object to return
  const normalizedOrder = {
    ...order,
    // Ensure these fields always exist
    totalAmount: order.totalAmount || order.total || 0,
    subtotal: order.subtotal || 0,
    tax: order.tax || 0,
    deliveryFee: order.deliveryFee || 0,
    // For cash orders, enforce confirmed status
    status: order.paymentMethod === "cash" ? "confirmed" : (order.status || defaultStatus),
    paymentStatus: order.paymentStatus || "pending",
    items: Array.isArray(order.items) ? order.items : [],
  };
  
  // Log status assignment
  console.log(`Order ${order._id} payment method: ${order.paymentMethod}, assigned status: ${normalizedOrder.status}`);
  
  // Explicitly handle pickup location
  if (order.pickupLocation) {
    // Preserve the entire pickupLocation object, just ensure coordinates exist
    normalizedOrder.pickupLocation = {
      type: order.pickupLocation.type || "Point",
      coordinates: Array.isArray(order.pickupLocation.coordinates) ? 
        order.pickupLocation.coordinates : [0, 0]
    };
  } else {
    // Create a default pickup location if none exists
    normalizedOrder.pickupLocation = {
      type: "Point",
      coordinates: [0, 0]
    };
  }
  
  // Explicitly handle delivery location
  if (order.deliveryLocation) {
    // Preserve the entire deliveryLocation object, just ensure coordinates exist
    normalizedOrder.deliveryLocation = {
      type: order.deliveryLocation.type || "Point",
      coordinates: Array.isArray(order.deliveryLocation.coordinates) ? 
        order.deliveryLocation.coordinates : [0, 0]
    };
  } else {
    // Create a default delivery location if none exists
    normalizedOrder.deliveryLocation = {
      type: "Point",
      coordinates: [0, 0]
    };
  }
  
  // Log the coordinates to help with debugging
  console.log(`Order ${order._id} normalized with coordinates:`, {
    pickup: normalizedOrder.pickupLocation.coordinates,
    delivery: normalizedOrder.deliveryLocation.coordinates
  });
  
  return normalizedOrder;
};

// Action to fetch all orders (admin)
export const fetchAllOrders = createAsyncThunk(
  "admin/fetchAllOrders",
  async (params, { rejectWithValue }) => {
    try {
      const { page = 1, limit = 10, status, sortBy, sortOrder } = params || {};

      let url = `/api/v1/orders/admin/all?page=${page}&limit=${limit}`;

      if (status && status !== "all") {
        url += `&status=${status}`;
      }

      if (sortBy) {
        url += `&sortBy=${sortBy}`;
      }

      if (sortOrder) {
        url += `&sortOrder=${sortOrder}`;
      }

      const response = await api.get(url);
      return response.data;
    } catch (error) {
      console.error("Error fetching orders:", error);
      return rejectWithValue(
        error.response?.data || { message: "Failed to fetch orders" }
      );
    }
  }
);

// Action to fetch order statistics
export const fetchOrderStats = createAsyncThunk(
  "admin/fetchOrderStats",
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get("/api/v1/orders/admin/stats");
      return response.data;
    } catch (error) {
      console.error("Error fetching order stats:", error);
      return rejectWithValue(
        error.response?.data || { message: "Failed to fetch order statistics" }
      );
    }
  }
);

// Action to update order status
export const updateOrderStatus = createAsyncThunk(
  "admin/updateOrderStatus",
  async (
    { orderId, status, paymentStatus, deliveryNotes },
    { rejectWithValue }
  ) => {
    try {
      const response = await api.put(`/api/v1/orders/admin/${orderId}/status`, {
        status,
        paymentStatus,
        deliveryNotes,
      });
      return response.data;
    } catch (error) {
      console.error("Error updating order status:", error);
      return rejectWithValue(
        error.response?.data || { message: "Failed to update order status" }
      );
    }
  }
);

// Action to fetch delivery status history
export const fetchDeliveryStatusHistory = createAsyncThunk(
  "admin/fetchDeliveryStatusHistory",
  async (orderId, { rejectWithValue }) => {
    try {
      const response = await api.get(
        `/api/v1/orders/admin/${orderId}/status-history`
      );
      return response.data;
    } catch (error) {
      console.error("Error fetching status history:", error);
      return rejectWithValue(
        error.response?.data || { message: "Failed to fetch status history" }
      );
    }
  }
);

// Action to assign a delivery agent
export const assignDeliveryAgent = createAsyncThunk(
  "admin/assignDeliveryAgent",
  async ({ orderId, agentId }, { rejectWithValue }) => {
    try {
      const response = await api.put(
        `/api/v1/orders/admin/${orderId}/assign-agent`,
        {
          agentId,
        }
      );
      return response.data;
    } catch (error) {
      console.error("Error assigning delivery agent:", error);
      return rejectWithValue(
        error.response?.data || { message: "Failed to assign delivery agent" }
      );
    }
  }
);

const adminSlice = createSlice({
  name: "admin",
  initialState: {
    orders: {
      data: [],
      pagination: {
        totalOrders: 0,
        totalPages: 0,
        currentPage: 1,
        limit: 10,
        hasNextPage: false,
        hasPrevPage: false,
      },
      status: "idle", // 'idle' | 'loading' | 'succeeded' | 'failed'
      error: null,
    },
    stats: {
      data: null,
      status: "idle",
      error: null,
    },
    updateStatus: {
      status: "idle",
      error: null,
    },
    deliveryStatusHistory: {
      data: [],
      status: "idle",
      error: null,
    },
    assignAgent: {
      status: "idle",
      error: null,
    },
  },
  reducers: {
    resetUpdateStatus: (state) => {
      state.updateStatus.status = "idle";
      state.updateStatus.error = null;
    },
    resetAssignAgentStatus: (state) => {
      state.assignAgent.status = "idle";
      state.assignAgent.error = null;
    },
    resetStatusHistory: (state) => {
      state.deliveryStatusHistory = {
        data: [],
        status: "idle",
        error: null,
      };
    },
  },
  extraReducers: (builder) => {
    builder
      // Handle receiveNewOrder action
      .addCase(receiveNewOrder.pending, (state) => {
        // No need to set loading state for a single order addition
      })
      .addCase(receiveNewOrder.fulfilled, (state, action) => {
        if (action.payload && action.payload.order) {
          // Check if the order already exists in the list
          const orderExists = state.orders.data.some(
            (order) => order._id === action.payload.order._id
          );
          
          // Only add if it doesn't exist already
          if (!orderExists) {
            // Add the new order to the beginning of the list
            state.orders.data.unshift(action.payload.order);
            
            // Update pagination counts if applicable
            if (state.orders.pagination) {
              state.orders.pagination.totalOrders = 
                (state.orders.pagination.totalOrders || 0) + 1;
            }
          }
        }
      })
      .addCase(receiveNewOrder.rejected, (state, action) => {
        console.error("Failed to add new order to admin:", action.payload);
      })
      
      // Handle fetchAllOrders
      .addCase(fetchAllOrders.pending, (state) => {
        state.orders.status = "loading";
      })
      .addCase(fetchAllOrders.fulfilled, (state, action) => {
        state.orders.status = "succeeded";
        state.orders.data = action.payload.orders
          ? action.payload.orders.map((order) => normalizeOrder(order))
          : [];
        state.orders.pagination = action.payload.pagination || {
          totalOrders: 0,
          totalPages: 0,
          currentPage: 1,
          limit: 10,
          hasNextPage: false,
          hasPrevPage: false,
        };
        state.orders.error = null;
      })
      .addCase(fetchAllOrders.rejected, (state, action) => {
        state.orders.status = "failed";
        state.orders.error =
          action.payload?.message || "Failed to fetch orders";
      })

      // Handle fetchOrderStats
      .addCase(fetchOrderStats.pending, (state) => {
        state.stats.status = "loading";
      })
      .addCase(fetchOrderStats.fulfilled, (state, action) => {
        state.stats.status = "succeeded";
        state.stats.data = action.payload.stats;
        state.stats.error = null;
      })
      .addCase(fetchOrderStats.rejected, (state, action) => {
        state.stats.status = "failed";
        state.stats.error =
          action.payload?.message || "Failed to fetch statistics";
      })

      // Handle updateOrderStatus
      .addCase(updateOrderStatus.pending, (state) => {
        state.updateStatus.status = "loading";
      })
      .addCase(updateOrderStatus.fulfilled, (state, action) => {
        state.updateStatus.status = "succeeded";
        state.updateStatus.error = null;

        // Update the order in the orders list
        if (action.payload && action.payload.order) {
          const updatedOrder = normalizeOrder(action.payload.order);
          const orderIndex = state.orders.data.findIndex(
            (order) => order._id === updatedOrder._id
          );

          if (orderIndex !== -1) {
            state.orders.data[orderIndex] = updatedOrder;
          }
        }
      })
      .addCase(updateOrderStatus.rejected, (state, action) => {
        state.updateStatus.status = "failed";
        state.updateStatus.error =
          action.payload?.message || "Failed to update order";
      })

      // Handle fetchDeliveryStatusHistory
      .addCase(fetchDeliveryStatusHistory.pending, (state) => {
        state.deliveryStatusHistory.status = "loading";
      })
      .addCase(fetchDeliveryStatusHistory.fulfilled, (state, action) => {
        state.deliveryStatusHistory.status = "succeeded";
        state.deliveryStatusHistory.data = action.payload.statusHistory;
        state.deliveryStatusHistory.error = null;
      })
      .addCase(fetchDeliveryStatusHistory.rejected, (state, action) => {
        state.deliveryStatusHistory.status = "failed";
        state.deliveryStatusHistory.error =
          action.payload?.message || "Failed to fetch status history";
      })

      // Handle assignDeliveryAgent
      .addCase(assignDeliveryAgent.pending, (state) => {
        state.assignAgent.status = "loading";
      })
      .addCase(assignDeliveryAgent.fulfilled, (state, action) => {
        state.assignAgent.status = "succeeded";
        state.assignAgent.error = null;

        // Update the order in the orders list
        if (action.payload && action.payload.order) {
          const updatedOrder = normalizeOrder(action.payload.order);
          const orderIndex = state.orders.data.findIndex(
            (order) => order._id === updatedOrder._id
          );

          if (orderIndex !== -1) {
            state.orders.data[orderIndex] = updatedOrder;
          }
        }
      })
      .addCase(assignDeliveryAgent.rejected, (state, action) => {
        state.assignAgent.status = "failed";
        state.assignAgent.error =
          action.payload?.message || "Failed to assign delivery agent";
      });
  },
});

export const { resetUpdateStatus, resetAssignAgentStatus, resetStatusHistory } =
  adminSlice.actions;

export default adminSlice.reducer;
