/**
 * API Interceptor to redirect all axios requests to the correct server
 *
 * This interceptor modifies all axios requests to use the local development server
 * during development, and the production server in production.
 */

import axios from 'axios';
import { API_BASE_URL, SERVER_URL } from './apiConfig';

// Configure axios interceptor to redirect all requests to the right server
const setupApiInterceptor = () => {
  // Log the redirection setup
  console.log('Setting up API interceptor - redirecting to:', API_BASE_URL);
  
  // Create an interceptor for all axios requests
  axios.interceptors.request.use((config) => {
    // Check if this is a request to the production server
    if (config.url && config.url.includes('socialfooddelivery-2.onrender.com')) {
      // Replace the production URL with the configured API URL
      const originalUrl = config.url;
      
      // Extract the path from the full URL
      let path = originalUrl.split('socialfooddelivery-2.onrender.com')[1];
      
      // If the path starts with /api/v1, just use the path portion
      if (path.startsWith('/api/v1')) {
        // Remove /api/v1 prefix as it's already in API_BASE_URL
        path = path.replace('/api/v1', '');
        config.url = `${API_BASE_URL}${path}`;
      } else {
        // For URLs without /api/v1, use the SERVER_URL
        config.url = `${SERVER_URL}${path}`;
      }
      
      console.log(`Redirected: ${originalUrl} → ${config.url}`);
    }
    
    // Ensure credentials are included with every request (this enables cookies)
    config.withCredentials = true;
    
    // Add Authorization header if token exists in localStorage
    // Some backends expect token in Authorization header
    const token = localStorage.getItem("token");
    if (token) {
      // Set the Authorization header
      config.headers.Authorization = `Bearer ${token}`;
      
      // Also set token in cookie (this is critical for the backend)
      if (typeof document !== 'undefined') {
        // Set cookie based on environment
        if (window.location.protocol === 'https:') {
          document.cookie = `token=${token}; path=/; SameSite=None; Secure`;
        } else {
          // For development on HTTP
          document.cookie = `token=${token}; path=/; SameSite=Lax; max-age=86400`;
        }
      }
    } else {
      // For debugging purposes only
      console.warn('No token found in localStorage - user may not be authenticated');
      
      // Try to find token in cookies and use it (fallback)
      if (typeof document !== 'undefined' && document.cookie) {
        const cookies = document.cookie.split(';');
        const tokenCookie = cookies.find(cookie => cookie.trim().startsWith('token='));
        
        if (tokenCookie) {
          const cookieToken = tokenCookie.trim().substring('token='.length);
          console.log('Found token in cookies, using it for request');
          config.headers.Authorization = `Bearer ${cookieToken}`;
          
          // Sync back to localStorage for consistency
          localStorage.setItem('token', cookieToken);
        }
      }
    }
    
    // Enable credentials (cookies) for cross-origin requests
    config.withCredentials = true;
    
    return config;
  }, (error) => {
    return Promise.reject(error);
  });
  
  // Add response interceptor to handle common errors
  axios.interceptors.response.use(
    (response) => response,
    (error) => {
      // Handle common API errors
      if (error.response) {
        if (error.response.status === 401) {
          console.log('Authentication error - user needs to login');
          // You could redirect to login page or dispatch a logout action here
        }
      }
      return Promise.reject(error);
    }
  );
};

export default setupApiInterceptor;
