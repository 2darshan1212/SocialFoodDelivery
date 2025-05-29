// utils/axiosInstance.js
/**
 * Enhanced Axios instance for Social Food Delivery
 * Configured to work reliably in both development and production environments
 * Specifically optimized for the render.com deployment
 */
import axios from "axios";
import { API_BASE_URL, API_TIMEOUT, SERVER_URL } from "./apiConfig";

// Get the current environment information
const isProduction = !window.location.hostname.includes('localhost');
const isRenderDeploy = window.location.hostname.includes('render.com') || 
                        window.location.hostname === 'socialfooddelivery-2.onrender.com';

// Special case: Production frontend (on render.com) talking to local development backend
// This handles the case shown in your logs where tokens aren't being transmitted
const isProdToLocalDev = isProduction && API_BASE_URL.includes('localhost');

if (isProdToLocalDev) {
  console.log('⚠️ SPECIAL CONFIGURATION: Production frontend connecting to local development backend');
  console.log('This requires special token handling for cross-origin requests');
}

// Show detailed connection information in console
console.log('=== API CONNECTION CONFIG ===');
console.log('Base URL:', API_BASE_URL);
console.log('Is Production:', isProduction);
console.log('Is Render Deploy:', isRenderDeploy);
console.log('Current Hostname:', window.location.hostname);
console.log('===========================');

// Create axios instance with production-optimized settings
const instance = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // This ensures cookies are sent with requests
  credentials: 'include', // Also include credentials for fetch API compatibility
  timeout: API_TIMEOUT || 30000, // 30 second timeout for production to handle slow render.com cold starts
  timeoutErrorMessage: 'Request timeout - server took too long to respond',
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest', // Helps some servers identify AJAX requests
    'Cache-Control': 'no-cache', // Prevent caching issues
    'Pragma': 'no-cache',
    'X-Client-Origin': window.location.origin // Help server identify the client origin
  }
});

// Request interceptor for adding auth token
instance.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  
  if (token) {
    // ALWAYS set both Authorization header AND cookie for all environments
    // This ensures maximum compatibility with different server configurations
    
    // 1. Set Authorization header (JWT Bearer format)
    config.headers.Authorization = `Bearer ${token}`;
    
    // 2. Set x-auth-token header (alternative format some servers use)
    config.headers["x-auth-token"] = token;
    
    // 3. Add a custom header that won't be stripped by CORS
    config.headers["access-token"] = token;
    
    // Special handling for production frontend talking to local development backend
    // This addresses the exact issue shown in the logs
    if (isProdToLocalDev) {
      // Add even more headers to maximize chances of transmission
      config.headers["token"] = token;
      config.headers["auth-token"] = token;
      config.headers["jwt"] = token;
      
      // Always include token in URL for all requests as highest priority method
      // Cross-origin requests cannot reliably send cookies, so URL params are essential
      const separator = config.url.includes('?') ? '&' : '?';
      config.url = `${config.url}${separator}_auth=${token}`;
      
      console.log('⚠️ Using special cross-origin auth for production-to-local requests');
    } else {
      // Standard handling for same-origin or production-to-production requests
      // 4. Add token as query parameter (helpful but not always needed in same-origin)
      const separator = config.url.includes('?') ? '&' : '?';
      config.url = `${config.url}${separator}_auth=${token}`;
    }
    
    // Log the complete URL and headers for debugging
    console.log(`Request to: ${config.method.toUpperCase()} ${config.url}`);
    console.log('Auth headers set:', {
      Authorization: 'Bearer [token]',
      'x-auth-token': '[present]',
      'access-token': '[present]'
    });
    
    // 5. Specifically handle file uploads with special content type
    if (config.headers['Content-Type'] === 'multipart/form-data') {
      console.log('File upload detected, ensuring token is included in URL and headers');
    }
    
    // 6. Ensure token is in cookies (the backend checks for tokens in cookies)
    if (typeof document !== 'undefined') {
      // Configure cookie based on environment
      const protocol = window.location.protocol;
      const isSecure = protocol === 'https:';
      const domain = window.location.hostname;
      
      // Set appropriate SameSite attribute based on environment
      if (isSecure || isRenderDeploy) {
        // Production (HTTPS) - cross-origin compatible
        // For render.com specifically, we need SameSite=None with Secure flag
        document.cookie = `token=${token}; path=/; SameSite=None; Secure; max-age=86400`;
      } else {
        // Development (HTTP) - more permissive for local testing
        document.cookie = `token=${token}; path=/; SameSite=Lax; max-age=86400`;
      }
      
      // Also set a backup cookie with no SameSite restriction as fallback
      document.cookie = `auth_token=${token}; path=/; max-age=86400${isSecure ? '; Secure' : ''}`;
      
      // For render.com, set additional cookie formats to maximize compatibility
      if (isRenderDeploy) {
        document.cookie = `jwt=${token}; path=/; SameSite=None; Secure; max-age=86400`;
        // Set cookie specifically for the render.com domain
        document.cookie = `token=${token}; path=/; domain=.onrender.com; SameSite=None; Secure; max-age=86400`;
      }
      
      console.log('Auth tokens set for request to:', config.url);
    }
  } else {
    console.warn('No token found in localStorage for API request');
  }
  
  return config;
});

// Response interceptor for handling errors and token refresh
instance.interceptors.response.use(
  // For successful responses
  (response) => response,
  
  // For error responses with comprehensive error handling
  async (error) => {
    // Capture the request config in case we need to retry
    const originalRequest = error.config;
    
    // Log detailed error info for debugging in production
    console.log(`API Error: ${error.response?.status || 'Network Error'}`);
    console.log(`Request URL: ${originalRequest?.url || 'Unknown'}`);
    console.log(`Method: ${originalRequest?.method?.toUpperCase() || 'Unknown'}`);
    
    // Production-specific error handling
    const isProduction = !window.location.hostname.includes('localhost');
    const isProdToLocalDev = isProduction && API_BASE_URL.includes('localhost');
    
    // Handle special case of production frontend talking to local dev backend
    if (isProdToLocalDev) {
      console.log('Production frontend to local backend detected - special handling');
    }
    
    // Check if the error is due to an expired token (401 Unauthorized)
    if (error.response?.status === 401 && !originalRequest._retry) {
      console.log('Received 401 Unauthorized, attempting to refresh token');
      
      // Flag this request as already retried to prevent infinite loops
      originalRequest._retry = true;
      
      try {
        // Try to get a new token from the refresh-token endpoint
        const refreshResponse = await axios.post(
          `${API_BASE_URL.replace('/api/v1', '')}/api/v1/user/refresh-token`,
          { token: localStorage.getItem('token') },
          { withCredentials: true }
        );
        
        if (refreshResponse.data?.token) {
          // Store the new token
          const newToken = refreshResponse.data.token;
          localStorage.setItem('token', newToken);
          
          // Use multiple methods to ensure the refresh token request succeeds
          const refreshResponse = await axios.post(
            `${API_BASE_URL}/api/v1/user/refresh-token`,
            {},
            { 
              withCredentials: true,
              // Send token via all possible methods for maximum compatibility
              headers: {
                'Authorization': `Bearer ${localStorage.getItem("token")}`,
                'X-Auth-Token': localStorage.getItem("token"),
                'Content-Type': 'application/json'
              }
            }
          );

          if (refreshResponse.data.token) {
            console.log('Token refresh successful, got new token');
            // Store the new token in multiple places
            token = refreshResponse.data.token;
            localStorage.setItem("token", token);
            
            // Also store in sessionStorage as backup
            sessionStorage.setItem("token", token);
            
            // Set a cookie as well for extra reliability
            document.cookie = `token=${token}; path=/; max-age=86400`;
          } else {
            console.warn('Refresh token endpoint returned success but no token');
            throw new Error('No token in refresh response');
          }
        } else {
          console.log('Using existing token from localStorage');
        }

        // Apply the token to the original request and retry
        originalRequest.headers.Authorization = `Bearer ${token}`;
        originalRequest.headers["x-auth-token"] = token;
        
        // For render.com deployments, add the token as a URL parameter as well
        if (isRenderDeploy || isProdToLocalDev) {
          const separator = originalRequest.url.includes('?') ? '&' : '?';
          originalRequest.url = `${originalRequest.url}${separator}_auth=${token}`;
        }
        
        console.log('Retrying original request with new token');
        return instance(originalRequest);
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError);
        
        // Only handle session expiration if this was an actual auth error
        // and not a network error or other issue
        if (refreshError.response && 
            (refreshError.response.status === 401 || refreshError.response.status === 403)) {
          console.log('Authentication definitely failed, clearing session');
          
          // Clear authentication state from all storage mechanisms
          localStorage.removeItem('token');
          sessionStorage.removeItem('token');
          
          // Clear all cookies related to authentication with proper attributes for production
          const cookieOptions = ['path=/', 'max-age=0'];
          if (isProduction) {
            cookieOptions.push('secure');
            cookieOptions.push('samesite=none');
          }
          
          document.cookie = `token=; ${cookieOptions.join('; ')}`;
          document.cookie = `auth_token=; ${cookieOptions.join('; ')}`;
          document.cookie = `jwt=; ${cookieOptions.join('; ')}`;
          
          // Show a friendly error message
          const message = 'Your session has expired. Please login again.';
          console.error(message);
          
          // Use a direct redirect instead of setTimeout to avoid the login loop issue
          window.location.href = '/login';
          
          // Return a rejected promise with a clearer error
          return Promise.reject(new Error('Authentication failed - redirecting to login'));
        }
      }
    }
    
    // For network errors in production, provide a user-friendly message
    if (!error.response && isProduction) {
      console.log('Network error in production environment');
      // Don't show alert to avoid annoying users, just log it
      console.error('Network error - please check your connection');
    }
    
    // Return the error for further handling
    return Promise.reject(error);
  }
);

export default instance;

// Also export the base URL for direct use where needed
export { API_BASE_URL };
