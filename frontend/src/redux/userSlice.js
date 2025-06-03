// src/redux/features/userSlice.js
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

// Thunk to fetch current user's followings
export const fetchCurrentUserFollowings = createAsyncThunk(
  "user/fetchCurrentUserFollowings",
  async (_, { rejectWithValue, getState }) => {
    try {
      console.log("🔄 Fetching current user followings...");
      
      const res = await axios.get(
        `${API_BASE_URL}/api/v1/user/followings`,
        {
          withCredentials: true,
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );
      
      const followings = res.data.followings || [];
      console.log("✅ Fetched user followings:", followings);
      
      return followings;
    } catch (err) {
      console.error("❌ Error fetching followings:", err);
      return rejectWithValue(
        err.response?.data?.message || "Failed to fetch followings"
      );
    }
  }
);

// Thunk to follow or unfollow a user
export const followOrUnfollow = createAsyncThunk(
  "user/followOrUnfollow",
  async (targetUserId, { rejectWithValue, getState }) => {
    try {
      console.log("🔄 Following/unfollowing user:", targetUserId);
      
      // Get current state to determine action
      const state = getState();
      const currentFollowings = state.user.followings || [];
      const wasFollowing = currentFollowings.includes(targetUserId);
      
      const res = await axios.post(
        `${API_BASE_URL}/api/v1/user/followorunfollow/${targetUserId}`,
        {},
        { 
          withCredentials: true,
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );

      console.log("✅ Follow/unfollow response:", res.data);

      // Return complete response data for state updates
      const result = {
        userId: targetUserId,
        message: res.data.message,
        isFollowing: res.data.isFollowing,
        wasFollowing,
        follower: res.data.follower,
        targetUser: res.data.targetUser,
        success: true
      };
      
      console.log("📊 Follow/unfollow result:", result);
      return result;
      
    } catch (err) {
      console.error("❌ Follow/unfollow error:", err);
      return rejectWithValue({
        message: err.response?.data?.message || "Failed to follow/unfollow user",
        status: err.response?.status || 500,
        userId: targetUserId
      });
    }
  }
);

// Thunk to get user statistics
export const getUserStats = createAsyncThunk(
  "user/getUserStats",
  async (userId, { rejectWithValue }) => {
    try {
      const res = await axios.get(
        `${API_BASE_URL}/api/v1/user/stats/${userId}`,
        { 
          withCredentials: true,
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );
      return res.data;
    } catch (err) {
      console.error("❌ Error fetching user stats:", err);
      return rejectWithValue(
        err.response?.data?.message || "Failed to fetch user statistics"
      );
    }
  }
);

// Initial state
const initialState = {
  followings: [], // Array of user IDs that current user follows
  loading: false,
  error: null,
  message: null,
  lastAction: null, // Track last follow/unfollow action
  userStats: {}, // Store follower/following counts for different users
  optimisticUpdates: {}, // Track optimistic updates
};

const userSlice = createSlice({
  name: "user",
  initialState,
  reducers: {
    // Manually set followings (for initialization)
    setFollowing: (state, action) => {
      state.followings = Array.isArray(action.payload) ? action.payload : [];
      console.log("📝 Set followings:", state.followings);
    },
    
    // Clear error and message
    clearMessage: (state) => {
      state.message = null;
    },
    clearError: (state) => {
      state.error = null;
    },
    
    // Set last action
    setLastAction: (state, action) => {
      state.lastAction = action.payload;
    },
    
    // Optimistic follow (immediate UI update)
    addFollowing: (state, action) => {
      const userId = action.payload;
      if (!state.followings.includes(userId)) {
        state.followings.push(userId);
        console.log("➕ Optimistically added following:", userId);
        
        // Track optimistic update
        state.optimisticUpdates[userId] = {
          type: 'follow',
          timestamp: Date.now()
        };
      }
    },
    
    // Optimistic unfollow (immediate UI update)
    removeFollowing: (state, action) => {
      const userId = action.payload;
      const beforeLength = state.followings.length;
      state.followings = state.followings.filter((id) => id !== userId);
      console.log(`➖ Optimistically removed following: ${userId}. Before: ${beforeLength}, After: ${state.followings.length}`);
      
      // Track optimistic update
      state.optimisticUpdates[userId] = {
        type: 'unfollow',
        timestamp: Date.now()
      };
    },
    
    // Clear optimistic update
    clearOptimisticUpdate: (state, action) => {
      const userId = action.payload;
      if (state.optimisticUpdates[userId]) {
        delete state.optimisticUpdates[userId];
        console.log("🧹 Cleared optimistic update for user:", userId);
      }
    },
    
    // Reset entire user state
    resetUserState: (state) => {
      return { ...initialState };
    }
  },
  
  extraReducers: (builder) => {
    builder
      // ===== fetchCurrentUserFollowings =====
      .addCase(fetchCurrentUserFollowings.pending, (state) => {
        state.loading = true;
        state.error = null;
        console.log("⏳ Fetching followings...");
      })
      .addCase(fetchCurrentUserFollowings.fulfilled, (state, action) => {
        const followings = Array.isArray(action.payload) ? action.payload : [];
        state.followings = followings;
        state.loading = false;
        state.error = null;
        console.log("✅ Successfully updated followings in state:", followings);
      })
      .addCase(fetchCurrentUserFollowings.rejected, (state, action) => {
        state.error = action.payload;
        state.loading = false;
        console.error("❌ Failed to fetch followings:", action.payload);
      })

      // ===== followOrUnfollow =====
      .addCase(followOrUnfollow.pending, (state, action) => {
        state.loading = true;
        state.error = null;
        const userId = action.meta.arg; // Get the userId from the action
        console.log("⏳ Processing follow/unfollow for user:", userId);
      })
      .addCase(followOrUnfollow.fulfilled, (state, action) => {
        const { userId, message, isFollowing, success } = action.payload;
        
        console.log("✅ Follow/unfollow successful:", { userId, isFollowing });
        
        // Clear any optimistic update for this user
        if (state.optimisticUpdates[userId]) {
          delete state.optimisticUpdates[userId];
        }
        
        // Update followings based on server response
        if (isFollowing) {
          // User is now being followed
          if (!state.followings.includes(userId)) {
            state.followings.push(userId);
            console.log("➕ Added user to followings:", userId);
          }
        } else {
          // User is no longer being followed
          const beforeLength = state.followings.length;
          state.followings = state.followings.filter((id) => id !== userId);
          console.log(`➖ Removed user from followings: ${userId}. Before: ${beforeLength}, After: ${state.followings.length}`);
        }
        
        // Update state
        state.message = message;
        state.loading = false;
        state.error = null;
        state.lastAction = {
          type: isFollowing ? "follow" : "unfollow",
          userId,
          timestamp: Date.now(),
          success: true
        };
        
        console.log("📊 Final followings state:", state.followings);
      })
      .addCase(followOrUnfollow.rejected, (state, action) => {
        const error = action.payload;
        const userId = error?.userId || action.meta.arg;
        
        console.error("❌ Follow/unfollow failed:", error);
        
        // Clear optimistic update on error
        if (state.optimisticUpdates[userId]) {
          delete state.optimisticUpdates[userId];
        }
        
        state.error = error?.message || "Follow/unfollow action failed";
        state.loading = false;
        state.lastAction = {
          type: "error",
          userId,
          timestamp: Date.now(),
          success: false,
          error: state.error
        };
      })

      // ===== getUserStats =====
      .addCase(getUserStats.pending, (state) => {
        // Don't set loading to true for stats to avoid UI interference
        console.log("⏳ Fetching user stats...");
      })
      .addCase(getUserStats.fulfilled, (state, action) => {
        const { userId, followerCount, followingCount } = action.payload;
        
        // Initialize userStats if needed
        if (!state.userStats) {
          state.userStats = {};
        }
        
        // Update stats for this user
        if (userId) {
          state.userStats[userId] = {
            followerCount: followerCount || 0,
            followingCount: followingCount || 0,
            lastUpdated: Date.now()
          };
          console.log("📊 Updated user stats:", { userId, followerCount, followingCount });
        }
      })
      .addCase(getUserStats.rejected, (state, action) => {
        console.error("❌ Failed to fetch user stats:", action.payload);
        // Don't set error state for stats failures as they're not critical
      });
  },
});

// Export actions
export const { 
  setFollowing, 
  clearMessage, 
  clearError, 
  setLastAction,
  addFollowing,
  removeFollowing,
  clearOptimisticUpdate,
  resetUserState
} = userSlice.actions;

// Export selectors for easier state access
export const selectFollowings = (state) => state.user.followings || [];
export const selectUserStats = (state) => state.user.userStats || {};
export const selectIsFollowing = (state, userId) => {
  return state.user.followings ? state.user.followings.includes(userId) : false;
};
export const selectUserLoading = (state) => state.user.loading;
export const selectUserError = (state) => state.user.error;
export const selectLastAction = (state) => state.user.lastAction;

export default userSlice.reducer;
