// utils/axiosInstance.js
import axios from "axios";
import { API_BASE_URL, API_TIMEOUT } from "./apiConfig";

// Determine environment
const isDevelopment = process.env.NODE_ENV === 'development' || API_BASE_URL.includes('localhost');

// Log the API URL being used (helpful for debugging)
console.log('Using API base URL:', API_BASE_URL);

const instance = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // This ensures cookies are sent with requests
  credentials: 'include', // Also include credentials
  timeout: API_TIMEOUT || 10000, // Default 10 second timeout to prevent hanging requests
  timeoutErrorMessage: 'Request timeout - server took too long to respond',
});

// Request interceptor for adding auth token
instance.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  
  if (token) {
    // Set Authorization header
    config.headers.Authorization = `Bearer ${token}`;
    
    // Also ensure the token is set in cookies for each request
    // This is needed because the backend middleware checks for tokens in cookies
    if (typeof document !== 'undefined') {
      const protocol = window.location.protocol;
      if (protocol === 'https:') {
        document.cookie = `token=${token}; path=/; SameSite=None; Secure`;
      } else {
        // For development on HTTP
        document.cookie = `token=${token}; path=/; SameSite=Lax; max-age=86400`;
      }
      
      console.log('Set token cookie:', document.cookie);
    }
  } else {
    console.warn('No token found in localStorage for API request');
  }
  
  return config;
});

// Response interceptor for handling common errors
instance.interceptors.response.use(
  (response) => response,
  (error) => {
    // Log errors in development or local environment
    if (isDevelopment) {
      console.error('API Error:', error.response?.data || error.message);
    }
    
    // Handle specific error cases
    if (error.code === 'ECONNABORTED') {
      console.log('Request timeout - server took too long to respond');
      // Show error toast or notification to user
    }
    
    if (error.response?.status === 401) {
      // Handle unauthorized access
      console.log('Unauthorized access - you may need to log in again');
      
      // Clear invalid tokens
      localStorage.removeItem('token');
      document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      
      // You could redirect to login or dispatch a logout action here
      // Uncomment the line below to auto-redirect to login
      // window.location.href = '/login';
    }
    
    return Promise.reject(error);
  }
);

export default instance;

// Also export the base URL for direct use where needed
export { API_BASE_URL };
