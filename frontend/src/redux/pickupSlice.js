import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '../utils/axiosInstance';
import { toast } from 'react-toastify';

// Async thunks for pickup operations
export const fetchOrderDetails = createAsyncThunk(
  'pickup/fetchOrderDetails',
  async (orderId, { rejectWithValue }) => {
    try {
      console.log(`🔍 Fetching order details for order: ${orderId}`);
      const response = await axiosInstance.get(`/orders/${orderId}`);
      console.log("✅ Order details fetched successfully:", response.data);
      return response.data.order;
    } catch (error) {
      console.error('❌ Failed to fetch order details:', error);
      const errorMessage = error.response?.data?.message || 'Failed to fetch order details';
      return rejectWithValue(errorMessage);
    }
  }
);

export const verifyPickupCode = createAsyncThunk(
  'pickup/verifyPickupCode',
  async ({ orderId, pickupCode }, { rejectWithValue }) => {
    try {
      console.log(`🔑 Verifying pickup code for order: ${orderId}`);
      const response = await axiosInstance.post('/orders/verify-pickup', {
        orderId,
        pickupCode
      });
      console.log("✅ Pickup code verified successfully:", response.data);
      toast.success('Pickup code verified successfully!');
      return response.data.order;
    } catch (error) {
      console.error('❌ Failed to verify pickup code:', error);
      const errorMessage = error.response?.data?.message || 'Failed to verify pickup code';
      toast.error(errorMessage);
      return rejectWithValue(errorMessage);
    }
  }
);

export const completePickup = createAsyncThunk(
  'pickup/completePickup',
  async ({ orderId, pickupCode }, { rejectWithValue }) => {
    try {
      console.log(`🚗 Completing pickup for order: ${orderId} with code: ${pickupCode}`);
      console.log('📤 Making API call to /orders/complete-pickup');
      
      const response = await axiosInstance.post('/orders/complete-pickup', {
        orderId,
        pickupCode
      });
      
      console.log("✅ Complete pickup API response:", response);
      console.log("✅ Complete pickup response data:", response.data);
      
      if (response.data && response.data.order) {
        console.log("🎉 Pickup completed successfully - order data:", response.data.order);
        return response.data.order;
      } else {
        console.error("❌ Invalid response structure:", response.data);
        throw new Error('Invalid response from server');
      }
    } catch (error) {
      console.error('❌ Complete pickup error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        config: {
          url: error.config?.url,
          method: error.config?.method,
          baseURL: error.config?.baseURL
        }
      });
      
      const errorMessage = error.response?.data?.message || 
                          error.response?.data?.error || 
                          error.message || 
                          'Failed to complete pickup';
      
      return rejectWithValue(errorMessage);
    }
  }
);

// Initial state
const initialState = {
  // Order fetching
  orderLoading: false,
  orderError: null,
  
  // Pickup code verification
  verificationLoading: false,
  verificationError: null,
  verifiedOrder: null,
  
  // Pickup completion
  completionLoading: false,
  completionError: null,
  completedOrder: null,
  
  // UI state
  showPickupModal: false,
  selectedOrderId: null,
  pickupCodeInput: '',
  
  // Current notification order data (for immediate display)
  currentNotificationOrder: null,
  
  // Full order details (fetched from API)
  fullOrderDetails: null,
  
  // Pickup notifications (orders received by post authors)
  pickupNotifications: [],
  unreadPickupCount: 0,
};

// Slice
const pickupSlice = createSlice({
  name: 'pickup',
  initialState,
  reducers: {
    // UI actions
    setShowPickupModal: (state, action) => {
      state.showPickupModal = action.payload;
    },
    setSelectedOrderId: (state, action) => {
      state.selectedOrderId = action.payload;
    },
    setPickupCodeInput: (state, action) => {
      state.pickupCodeInput = action.payload;
    },
    // Store current notification order data for immediate display
    setCurrentNotificationOrder: (state, action) => {
      state.currentNotificationOrder = action.payload;
    },
    clearPickupState: (state) => {
      state.orderLoading = false;
      state.orderError = null;
      state.fullOrderDetails = null;
      state.verificationError = null;
      state.completionError = null;
      state.verifiedOrder = null;
      state.completedOrder = null;
      state.pickupCodeInput = '';
      state.showPickupModal = false;
      state.selectedOrderId = null;
      state.currentNotificationOrder = null;
    },
    
    // Notification management
    addPickupNotification: (state, action) => {
      const notification = action.payload;
      // Only add if it's a pickup order notification
      if (notification.order?.deliveryMethod === 'pickup') {
        // Check if it already exists
        const exists = state.pickupNotifications.some(
          (n) => n.order?._id === notification.order?._id
        );
        if (!exists) {
          state.pickupNotifications.unshift(notification);
          state.unreadPickupCount += 1;
        }
      }
    },
    markPickupNotificationRead: (state, action) => {
      const orderId = action.payload;
      const notification = state.pickupNotifications.find(
        (n) => n.order?._id === orderId
      );
      if (notification && !notification.read) {
        notification.read = true;
        state.unreadPickupCount = Math.max(0, state.unreadPickupCount - 1);
      }
    },
    markAllPickupNotificationsRead: (state) => {
      state.pickupNotifications.forEach((notification) => {
        notification.read = true;
      });
      state.unreadPickupCount = 0;
    },
    clearPickupNotifications: (state) => {
      state.pickupNotifications = [];
      state.unreadPickupCount = 0;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch order details
      .addCase(fetchOrderDetails.pending, (state) => {
        state.orderLoading = true;
        state.orderError = null;
        state.fullOrderDetails = null;
      })
      .addCase(fetchOrderDetails.fulfilled, (state, action) => {
        state.orderLoading = false;
        state.orderError = null;
        state.fullOrderDetails = action.payload;
      })
      .addCase(fetchOrderDetails.rejected, (state, action) => {
        state.orderLoading = false;
        state.orderError = action.payload;
        state.fullOrderDetails = null;
        toast.error(action.payload);
      })
      
      // Verify pickup code
      .addCase(verifyPickupCode.pending, (state) => {
        state.verificationLoading = true;
        state.verificationError = null;
        state.verifiedOrder = null;
      })
      .addCase(verifyPickupCode.fulfilled, (state, action) => {
        state.verificationLoading = false;
        state.verificationError = null;
        state.verifiedOrder = action.payload;
        toast.success('Pickup code verified! Order details loaded.');
      })
      .addCase(verifyPickupCode.rejected, (state, action) => {
        state.verificationLoading = false;
        state.verificationError = action.payload;
        state.verifiedOrder = null;
        toast.error(action.payload);
      })
      
      // Complete pickup
      .addCase(completePickup.pending, (state) => {
        state.completionLoading = true;
        state.completionError = null;
      })
      .addCase(completePickup.fulfilled, (state, action) => {
        state.completionLoading = false;
        state.completionError = null;
        state.completedOrder = action.payload;
        state.verifiedOrder = null;
        state.pickupCodeInput = '';
        
        // Clear the pickup notification from the list
        if (state.selectedOrderId) {
          state.pickupNotifications = state.pickupNotifications.filter(
            (n) => n.order?._id !== state.selectedOrderId
          );
          state.unreadPickupCount = Math.max(0, state.unreadPickupCount - 1);
        }
      })
      .addCase(completePickup.rejected, (state, action) => {
        state.completionLoading = false;
        state.completionError = action.payload;
      });
  },
});

// Export actions
export const {
  setShowPickupModal,
  setSelectedOrderId,
  setPickupCodeInput,
  setCurrentNotificationOrder,
  clearPickupState,
  addPickupNotification,
  markPickupNotificationRead,
  markAllPickupNotificationsRead,
  clearPickupNotifications,
} = pickupSlice.actions;

// Selectors
export const selectPickupState = (state) => state.pickup;
export const selectPickupNotifications = (state) => state.pickup.pickupNotifications;
export const selectUnreadPickupCount = (state) => state.pickup.unreadPickupCount;
export const selectVerifiedOrder = (state) => state.pickup.verifiedOrder;
export const selectPickupLoading = (state) => state.pickup.verificationLoading || state.pickup.completionLoading || state.pickup.orderLoading;
export const selectCurrentNotificationOrder = (state) => state.pickup.currentNotificationOrder;
export const selectFullOrderDetails = (state) => state.pickup.fullOrderDetails;
export const selectOrderLoading = (state) => state.pickup.orderLoading;

export default pickupSlice.reducer; 