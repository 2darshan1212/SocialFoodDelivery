/**
 * Environment Configuration
 * 
 * This file centralizes environment configuration for the backend,
 * making it easier to maintain consistent settings across the application.
 */

// Determine environment
const NODE_ENV = process.env.NODE_ENV || 'development';
const isDevelopment = NODE_ENV === 'development';
const isProduction = NODE_ENV === 'production';

// Base URLs
const PRODUCTION_URL = 'https://socialfooddelivery-2.onrender.com';
const DEVELOPMENT_URL = 'http://localhost:5173';
const BACKEND_DEV_URL = 'http://localhost:3000';

// CORS origins
const ALLOWED_ORIGINS = [
  PRODUCTION_URL,
  DEVELOPMENT_URL,
  // Add any additional origins here if needed
];

// Base path for API endpoints
const API_PATH = '/api/v1';

// Export environment configuration
export default {
  // Environment identification
  NODE_ENV,
  isDevelopment,
  isProduction,
  
  // Server configuration
  PORT: process.env.PORT || 3000,
  
  // URLs
  PRODUCTION_URL,
  DEVELOPMENT_URL,
  BACKEND_DEV_URL,
  
  // API
  API_PATH,
  
  // CORS configuration
  cors: {
    ALLOWED_ORIGINS,
    METHODS: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    ALLOWED_HEADERS: ['Content-Type', 'Authorization'],
    CREDENTIALS: true
  },
  
  // Other environment-specific configurations
  mongoUri: process.env.MONGO_URI,
  jwtSecret: process.env.JWT_SECRET,
  
  // Get full API URL
  getApiUrl: (path = '') => {
    const cleanPath = path.startsWith('/') ? path.substring(1) : path;
    const baseUrl = isProduction ? PRODUCTION_URL : BACKEND_DEV_URL;
    return `${baseUrl}${API_PATH}/${cleanPath}`;
  }
};
