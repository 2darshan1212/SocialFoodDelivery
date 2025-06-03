import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axiosInstance from "../utils/axiosInstance";
import { toast } from "react-toastify";
import { addPickupNotification } from './pickupSlice';

// Async thunk for fetching notifications
export const fetchNotifications = createAsyncThunk(
  "notifications/fetchNotifications",
  async (_, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.get("/notifications");
      return response.data.notifications || [];
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to fetch notifications"
      );
    }
  }
);

// Async thunk for marking all notifications as read
export const markAllNotificationsRead = createAsyncThunk(
  "notifications/markAllRead",
  async (_, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.patch("/notifications/mark-all-read");
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to mark notifications as read"
      );
    }
  }
);

// Async thunk for marking a single notification as read
export const markNotificationRead = createAsyncThunk(
  "notifications/markRead",
  async (notificationId, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.patch(`/notifications/mark-read/${notificationId}`);
      return { notificationId, ...response.data };
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to mark notification as read"
      );
    }
  }
);

// Initial state with empty arrays to ensure they're always iterable
const initialState = {
  notifications: [], // DB-stored notifications
  realtimeNotifications: [], // Socket notifications (not yet in DB)
  loading: false,
  error: null,
  unseenCount: 0,
};

const rtnSlice = createSlice({
  name: "realTimeNotification",
  initialState,
  reducers: {
    // Add a new notification from socket
    addNotification: (state, action) => {
      // Ensure realtimeNotifications is an array
      if (!Array.isArray(state.realtimeNotifications)) {
        state.realtimeNotifications = [];
      }

      // Normalize notification data to handle different formats
      const normalizedNotification = {
        ...action.payload,
        // Add timestamp if not present
        createdAt: action.payload.createdAt || new Date().toISOString(),
        // Ensure we have a read property
        read: false,
        // For post-related notifications, ensure post ID is saved consistently
        post: action.payload.post || action.payload.postId,
        // For order notifications, preserve order data
        order: action.payload.order || action.payload.orderId,
        // Generate a temporary ID if not present (for socket notifications)
        _id:
          action.payload._id ||
          `temp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      };

      // Add message if not present based on type
      if (!normalizedNotification.message) {
        if (normalizedNotification.type === "like") {
          normalizedNotification.message = "liked your post";
        } else if (normalizedNotification.type === "comment") {
          normalizedNotification.message = "commented on your post";
        } else if (normalizedNotification.type === "follow") {
          normalizedNotification.message = "started following you";
        } else if (normalizedNotification.type === "message") {
          normalizedNotification.message = "sent you a message";
        } else if (normalizedNotification.type === "order") {
          normalizedNotification.message = action.payload.message || "placed an order from your post";
        }
      }

      // Check if the notification already exists in DB-stored notifications
      const existsInDB =
        Array.isArray(state.notifications) &&
        state.notifications.some((notification) => {
          // For order notifications, check order ID
          if (normalizedNotification.type === "order" && notification.type === "order") {
            const existingOrderId = notification.order?._id || notification.orderId;
            const newOrderId = normalizedNotification.order?._id || normalizedNotification.orderId;
            return existingOrderId && newOrderId && existingOrderId === newOrderId;
          }
          
          // For other notifications, check the usual conditions
          return (
            notification.type === normalizedNotification.type &&
            (notification.sender?._id === normalizedNotification.sender?._id ||
              notification.sender?._id === normalizedNotification.sender ||
              notification.sender === normalizedNotification.sender?._id ||
              notification.sender === normalizedNotification.sender) &&
            (notification.post === normalizedNotification.post ||
              notification.postId === normalizedNotification.post ||
              notification.post?._id === normalizedNotification.post?._id)
          );
        });

      // Check if the notification already exists in realtime notifications
      const existsInRealtime = state.realtimeNotifications.some((notification) => {
        // For order notifications, check order ID
        if (normalizedNotification.type === "order" && notification.type === "order") {
          const existingOrderId = notification.order?._id || notification.orderId;
          const newOrderId = normalizedNotification.order?._id || normalizedNotification.orderId;
          return existingOrderId && newOrderId && existingOrderId === newOrderId;
        }
        
        // For other notifications, check the usual conditions
        return (
          notification.type === normalizedNotification.type &&
          (notification.sender === normalizedNotification.sender?._id ||
            notification.sender?._id === normalizedNotification.sender?._id ||
            notification.sender?._id === normalizedNotification.sender ||
            notification.sender === normalizedNotification.sender) &&
          (notification.post === normalizedNotification.post ||
            notification.postId === normalizedNotification.post ||
            notification.post?._id === normalizedNotification.post?._id)
        );
      });

      // Only add if it doesn't exist in either collection
      if (!existsInDB && !existsInRealtime) {
        state.realtimeNotifications.unshift(normalizedNotification);
        state.unseenCount += 1;
        
        // Handle order notifications
        if (normalizedNotification.type === "order") {
          const senderName = normalizedNotification.sender?.username || "Someone";
          const orderTotal = normalizedNotification.order?.total 
            ? ` - ₹${normalizedNotification.order.total.toFixed(2)}`
            : "";
          
          // Check if this is a pickup order
          const isPickupOrder = normalizedNotification.order?.deliveryMethod === 'pickup';
          
          if (isPickupOrder) {
            // Show pickup-specific toast
            toast.success(`🚗 ${senderName} placed a pickup order${orderTotal}`, {
              position: "top-right",
              autoClose: 7000,
              hideProgressBar: false,
              closeOnClick: true,
              pauseOnHover: true,
              draggable: true,
            });
          } else {
            // Show regular order toast
          toast.success(`🛒 ${senderName} placed an order${orderTotal}`, {
            position: "top-right",
            autoClose: 5000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
          });
          }
        }
      }
    },

    // Mark all realtime notifications as seen locally
    markNotificationsSeen: (state) => {
      state.unseenCount = 0;
    },

    // Clear all notifications (local state only)
    clearNotifications: (state) => {
      state.realtimeNotifications = [];
      state.unseenCount = 0;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch notifications
      .addCase(fetchNotifications.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        state.loading = false;
        state.notifications = Array.isArray(action.payload)
          ? action.payload
          : [];
        state.realtimeNotifications = Array.isArray(state.realtimeNotifications)
          ? state.realtimeNotifications
          : [];
        state.unseenCount = Array.isArray(state.notifications)
          ? state.notifications.filter((n) => !n.read).length
          : 0;
      })
      .addCase(fetchNotifications.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        // Ensure arrays are initialized even on error
        if (!Array.isArray(state.notifications)) state.notifications = [];
        if (!Array.isArray(state.realtimeNotifications))
          state.realtimeNotifications = [];
      })

      // Mark all as read
      .addCase(markAllNotificationsRead.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(markAllNotificationsRead.fulfilled, (state) => {
        state.loading = false;
        // Ensure notifications is an array before mapping
        if (Array.isArray(state.notifications)) {
          state.notifications = state.notifications.map((notification) => ({
            ...notification,
            read: true,
          }));
        } else {
          state.notifications = [];
        }
        state.unseenCount = 0;
      })
      .addCase(markAllNotificationsRead.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Mark one as read
      .addCase(markNotificationRead.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(markNotificationRead.fulfilled, (state, action) => {
        state.loading = false;
        
        // Ensure notifications is an array
        if (!Array.isArray(state.notifications)) {
          state.notifications = [];
          return;
        }

        const notification = state.notifications.find(
          (n) => n._id === action.payload.notificationId
        );
        if (notification && !notification.read) {
          notification.read = true;
          state.unseenCount = Math.max(0, state.unseenCount - 1);
        }
      })
      .addCase(markNotificationRead.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { addNotification, markNotificationsSeen, clearNotifications } =
  rtnSlice.actions;

export default rtnSlice.reducer;
