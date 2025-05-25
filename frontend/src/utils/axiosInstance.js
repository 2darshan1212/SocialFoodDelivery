// utils/axiosInstance.js
import axios from "axios";
import { API_BASE_URL, environment } from "./apiConfig";

// Reuse environment check from apiConfig
const { isDevelopment } = environment;

const instance = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // This ensures cookies are sent with requests
});

// Request interceptor for adding auth token
instance.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for handling common errors
instance.interceptors.response.use(
  (response) => response,
  (error) => {
    // Log errors in development
    if (isDevelopment) {
      console.error('API Error:', error.response?.data || error.message);
    }
    
    // Handle specific error cases if needed
    if (error.response?.status === 401) {
      // Handle unauthorized access
      console.log('Unauthorized access - you may need to log in again');
      // You could redirect to login or dispatch a logout action here
    }
    
    return Promise.reject(error);
  }
);

export default instance;

// Also export the base URL for direct use where needed
export { API_BASE_URL };
