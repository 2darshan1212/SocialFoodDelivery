/**
 * API Configuration Utility
 * 
 * This utility provides consistent API URLs across the application,
 * automatically detecting whether to use production or development endpoints.
 */

// Detect if we're in a development environment
const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

// Base API URLs
export const API_BASE_URL = isDevelopment 
  ? "http://localhost:3000/api/v1"  // Local development API
  : "https://socialfooddelivery-2.onrender.com/api/v1"; // Production API

// Base server URL (without /api/v1)
export const SERVER_URL = isDevelopment 
  ? "http://localhost:3000"  // Local development server
  : "https://socialfooddelivery-2.onrender.com"; // Production server

/**
 * Helper function to build full API endpoint URLs
 * @param {string} endpoint - API endpoint path (without leading slash)
 * @returns {string} - Full API URL
 */
export const getApiUrl = (endpoint) => {
  // Remove leading slash if present
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.substring(1) : endpoint;
  return `${API_BASE_URL}/${cleanEndpoint}`;
};

/**
 * Helper function to build full server URLs (non-API)
 * @param {string} path - Server path (without leading slash)
 * @returns {string} - Full server URL
 */
export const getServerUrl = (path = '') => {
  // Remove leading slash if present
  const cleanPath = path.startsWith('/') ? path.substring(1) : path;
  return cleanPath ? `${SERVER_URL}/${cleanPath}` : SERVER_URL;
};

// Export current environment information
export const environment = {
  isDevelopment,
  isProduction: !isDevelopment,
  apiBaseUrl: API_BASE_URL,
  serverUrl: SERVER_URL
};
