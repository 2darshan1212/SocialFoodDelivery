import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";
import axiosInstance from "../utils/axiosInstance";
import tokenManager from "../utils/tokenManager";

// API base URL from environment or default to localhost
const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:8000";
  
console.log('Redux auth slice using API_BASE_URL:', API_BASE_URL);

// Login thunk action with enhanced error handling and token storage
export const loginUser = createAsyncThunk(
  "auth/loginUser",
  async (userData, { rejectWithValue, dispatch }) => {
    try {
      console.log('Attempting login with credentials:', { email: userData.email });
      
      // Using the correct endpoint path based on the routes file
      console.log('Using API_BASE_URL:', API_BASE_URL);
      
      // Based on the routes file, the correct login endpoint is /login
      // without any prefix or /user prefix
      console.log('Using correct login endpoint: /login');
      const response = await axiosInstance.post('/login', userData, {
        headers: {
          'X-Auth-Skip-Timeout': 'true'
        }
      });
      
      // Pre-store the token immediately for fast access
      if (response && response.data?.token) {
        // Store in memory for immediate access by axiosInstance
        window._authToken = response.data.token;
        
        // Update axios default headers for all future requests
        axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${response.data.token}`;
      }
      
      // Check for successful login
      if (response.data.success) {
        // Extract token if provided in the response
        if (response.data.token) {
          // Use centralized tokenManager for consistent token storage
          console.log('Storing token using tokenManager');
          tokenManager.setToken(response.data.token);
          
          // Verify token was properly stored
          setTimeout(() => {
            const storedToken = tokenManager.getToken();
            if (storedToken) {
              console.log('Token successfully stored and retrieved with tokenManager');
            } else {
              console.error('Failed to store token with tokenManager');
            }
          }, 100);
        } else {
          // The backend should have set the cookie, but log for debugging
          console.log('No explicit token in response, relying on HttpOnly cookie from server');
        }
        
        // Log success
        console.log('Login successful, user:', response.data.user.username);
        
        return response.data;
      }

      return rejectWithValue(response.data.message || 'Login failed without specific error');
    } catch (error) {
      console.error('Login error:', error);
      
      const message =
        error.response && error.response.data.message
          ? error.response.data.message
          : error.message || 'Network error during login';
      
      // Enhanced error logging
      if (error.response) {
        console.error('Server response error:', {
          status: error.response.status,
          message: error.response.data.message,
          data: error.response.data
        });
      } else if (error.request) {
        console.error('No response received:', error.request);
      } else {
        console.error('Request setup error:', error.message);
      }
      
      return rejectWithValue(message);
    }
  }
);

// Create a thunk to sync bookmarks with the backend
export const syncUserBookmarks = createAsyncThunk(
  "auth/syncUserBookmarks",
  async (_, { getState, rejectWithValue, dispatch }) => {
    try {
      const { user } = getState().auth;

      if (!user || !user._id) {
        return rejectWithValue("User not authenticated");
      }

      console.log("Fetching bookmarks for user:", user._id);

      // First try: dedicated endpoint to get current user profile with bookmarks
      try {
        const response = await axiosInstance.get('/user/profile');

        if (
          response.data.success &&
          response.data.user &&
          response.data.user.bookmarks
        ) {
          console.log(
            "Successfully fetched user bookmarks:",
            response.data.user.bookmarks
          );
          return response.data.user.bookmarks;
        }
      } catch (profileError) {
        console.warn(
          "Profile endpoint failed, trying bookmarked posts endpoint:",
          profileError.message
        );
      }

      // Second try: use bookmarked posts endpoint
      try {
        const postsResponse = await axiosInstance.get('/post/bookmarked');

        if (
          postsResponse.data.success &&
          Array.isArray(postsResponse.data.posts)
        ) {
          // Extract post IDs from the response
          const bookmarkIds = postsResponse.data.posts.map((post) => post._id);
          console.log("Successfully fetched bookmarked posts:", bookmarkIds);
          return bookmarkIds;
        }
      } catch (postsError) {
        console.warn("Bookmarked posts endpoint failed:", postsError.message);
      }

      // If both attempts fail, return current bookmarks (don't update but don't fail)
      console.warn("All bookmark sync attempts failed, keeping current state");
      return user.bookmarks || [];
    } catch (error) {
      console.error("Error syncing bookmarks:", error);
      return rejectWithValue(
        error?.response?.data?.message ||
          error.message ||
          "Error syncing bookmarks"
      );
    }
  }
);

const authSlice = createSlice({
  name: "auth",
  initialState: {
    user: null,
    loading: false,
    error: null,
    isAuthenticated: false,
    lastLoginAt: null,
    suggestedUsers: [],
    userProfile: null,
    selectedUser: null,
    shorts: null,
    bookmarksLoading: false,
    bookmarksError: null,
    lastBookmarkUpdate: null,
  },
  reducers: {
    setAuthUser: (state, action) => {
      state.user = action.payload;
    },
    setSuggestedUsers: (state, action) => {
      state.suggestedUsers = action.payload;
    },
    setUserProfile: (state, action) => {
      state.userProfile = action.payload;
    },
    setUserShorts: (state, action) => {
      state.shorts = action.payload;
    },
    setSelectedUser: (state, action) => {
      state.selectedUser = action.payload;
    },
    updateBookmarks: (state, action) => {
      if (state.user) {
        const postId = action.payload;
        console.log(`Updating bookmarks for post: ${postId}`);

        // Ensure bookmarks is initialized as an array
        if (!state.user.bookmarks || !Array.isArray(state.user.bookmarks)) {
          state.user.bookmarks = [];
        }

        const isCurrentlyBookmarked = state.user.bookmarks.includes(postId);

        if (isCurrentlyBookmarked) {
          // Remove from bookmarks
          console.log(`Removing bookmark for post: ${postId}`);
          state.user.bookmarks = state.user.bookmarks.filter(
            (id) => id !== postId
          );
        } else {
          // Add to bookmarks
          console.log(`Adding bookmark for post: ${postId}`);
          state.user.bookmarks.push(postId);
        }

        // Record the timestamp of the last update
        state.lastBookmarkUpdate = Date.now();

        // Log updated bookmarks
        console.log("Updated bookmarks:", state.user.bookmarks);
      } else {
        console.warn("Cannot update bookmarks: No authenticated user");
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // Login user reducer cases
      .addCase(loginUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user;
        // Store login timestamp
        state.lastLoginAt = Date.now();
        // Log successful login in redux state
        console.log('Login successful, user stored in Redux state');
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        state.user = null;
        // Log login failure
        console.error('Login failed:', action.payload);
      })
      
      // Sync bookmarks reducer cases
      .addCase(syncUserBookmarks.pending, (state) => {
        state.bookmarksLoading = true;
        state.bookmarksError = null;
      })
      .addCase(syncUserBookmarks.fulfilled, (state, action) => {
        state.bookmarksLoading = false;
        if (state.user) {
          // Only update if we got a valid array
          if (Array.isArray(action.payload)) {
            state.user.bookmarks = action.payload;
            state.lastBookmarkSync = Date.now();
          } else {
            console.warn("Received non-array bookmarks data:", action.payload);
          }
        } else {
          console.warn("Cannot update bookmarks: user state is null");
        }
      })
      .addCase(syncUserBookmarks.rejected, (state, action) => {
        state.bookmarksLoading = false;
        state.bookmarksError = action.payload;
        console.error("Bookmark sync rejected:", action.payload);
      });
  },
});

export default authSlice.reducer;
export const {
  setAuthUser,
  setSuggestedUsers,
  setUserProfile,
  setUserShorts,
  setSelectedUser,
  updateBookmarks,
} = authSlice.actions;
