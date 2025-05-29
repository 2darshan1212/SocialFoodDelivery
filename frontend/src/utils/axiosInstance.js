// utils/axiosInstance.js
/**
 * Enhanced Axios instance for Social Food Delivery
 * Configured to work reliably in both development and production environments
 * Specifically optimized for the render.com deployment
 */
import axios from "axios";
import { API_BASE_URL, API_TIMEOUT, SERVER_URL } from "./apiConfig";
import tokenManager from "./tokenManager";

// Get the current environment information
const isProduction = !window.location.hostname.includes('localhost');
const isRenderDeploy = window.location.hostname.includes('render.com') || 
                       window.location.hostname === 'socialfooddelivery-2.onrender.com';

// Show detailed connection information in console
console.log('=== API CONNECTION CONFIG ===');
console.log('Base URL:', API_BASE_URL);
console.log('Is Production:', isProduction);
console.log('Is Render Deploy:', isRenderDeploy);
console.log('Current Hostname:', window.location.hostname);
console.log('===========================');

// Create axios instance with production-optimized settings
// Make the instance available globally for direct access from token manager
const instance = window.axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // This ensures cookies are sent with requests
  timeout: API_TIMEOUT || 30000, // 30 second timeout for production to handle slow render.com cold starts
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest'
  }
});

// Request interceptor for adding auth token - IMPROVED REDUNDANT TOKEN HANDLING
instance.interceptors.request.use((config) => {
  try {
    // Multi-source token acquisition strategy for maximum reliability
    // 1. Try from localStorage directly
    let token = localStorage.getItem('token');
    
    // 2. Try from sessionStorage if not in localStorage
    if (!token) {
      token = sessionStorage.getItem('token');
    }
    
    // 3. Try from cookies
    if (!token) {
      const cookies = document.cookie.split(';');
      for (let i = 0; i < cookies.length; i++) {
        const cookie = cookies[i].trim();
        if (cookie.startsWith('token=')) {
          token = cookie.substring('token='.length);
          break;
        }
      }
    }
    
    // 4. As last resort, try from tokenManager
    if (!token) {
      // Force token initialization to ensure we have the latest token
      tokenManager.initializeTokens();
      token = tokenManager.getToken();
    }
    
    if (token) {
      // Force token to use string interpolation to ensure it's a string
      token = `${token}`;
      
      console.log(`Auth token found (${token.substring(0, 10)}...) for request: ${config.url}`);
      
      // CRITICAL FIX: Set authentication headers in multiple formats for maximum compatibility
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
      config.headers["x-auth-token"] = token;
      config.headers.token = token;
      
      // Ensure cookies are sent with the request
      config.withCredentials = true;
      
      // Add token to URL query parameters for absolute cross-origin reliability
      // This is the most reliable method as it bypasses CORS header restrictions
      const separator = config.url.includes('?') ? '&' : '?';
      config.url = `${config.url}${separator}_auth=${token}`;
      
      // Log the configured request for debugging
      console.log(`Request to ${config.url} configured with auth token in:`);
      console.log('- Authorization header');
      console.log('- x-auth-token header');
      console.log('- token header');
      console.log('- _auth query parameter');
      
      // If token found directly in storage but not in tokenManager, reinforce it
      if (token !== tokenManager.getToken()) {
        console.log('Reinforcing token in token manager');
        tokenManager.setToken(token);
      }
      
      // Log full request details for debugging
      console.log(`Request details:\n- Method: ${config.method?.toUpperCase() || 'GET'}\n- URL: ${config.url}\n- Headers: ${JSON.stringify(Object.keys(config.headers))}`);
    } else {
      console.warn('⚠️ No token available for request:', config.url);
      
      // If this is not a login or public route, consider redirecting to login
      const isAuthRoute = config.url.includes('/login') || config.url.includes('/signup') || 
                          config.url.includes('/refresh-token') || config.url.includes('/public');
      if (!isAuthRoute && typeof window !== 'undefined' && window.location.pathname !== '/login') {
        console.warn('⚠️ Unauthenticated request to protected route - redirecting to login');
        // Use setTimeout to prevent this from blocking the current request
        setTimeout(() => {
          window.location.href = '/login';
        }, 100);
      }
    }
  
  return config;
  } catch (error) {
    console.error('Error in request interceptor:', error);
    return config;
  }
});

// Response interceptor for handling errors and token refresh
instance.interceptors.response.use(
  // For successful responses
  (response) => response,
  
  // For error responses
  async (error) => {
    // Log error details
    console.log(`API Error: ${error.response?.status || 'Network Error'}`);
    console.log(`Request URL: ${error.config?.url || 'Unknown'}`);
    
    // Check for 401 Unauthorized errors
    if (error.response?.status === 401 && !error.config?._retry) {
      console.log('Unauthorized error - attempting token refresh');
      
      try {
        // Mark this request as retried
        error.config._retry = true;
        
        // Get current token
        const currentToken = tokenManager.getToken();
        if (!currentToken) {
          throw new Error('No token available for refresh');
        }
        
        // Try to refresh the token
        const refreshResponse = await axios.post(
          `${API_BASE_URL}/api/v1/user/refresh-token`,
          { token: currentToken },
          { withCredentials: true }
        );
        
        if (refreshResponse.data?.token) {
          // Store the new token using token manager
          const newToken = refreshResponse.data.token;
          tokenManager.saveToken(newToken);
          
          // Update request headers
          error.config.headers.Authorization = `Bearer ${newToken}`;
          error.config.headers["x-auth-token"] = newToken;
          
          // Add token to URL
          const separator = error.config.url.includes('?') ? '&' : '?';
          error.config.url = `${error.config.url}${separator}_auth=${newToken}`;
          
          // Retry the request
          return instance(error.config);
        }
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError);
        
        // Clear auth tokens on definite authentication failure
        if (refreshError.response?.status === 401 || refreshError.response?.status === 403) {
          tokenManager.clearToken();
          window.location.href = '/login';
        }
      }
    }
    
    // Return the error for further handling
    return Promise.reject(error);
  }
);

export default instance;

// Also export the base URL for direct use where needed
export { API_BASE_URL };
