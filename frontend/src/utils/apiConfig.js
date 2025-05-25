/**
 * API Configuration Utility
 * 
 * This utility provides consistent API URLs across the application,
 * ensuring proper detection of production vs development environments.
 * Special handling for the render.com deployment.
 */

// Environment detection with multiple checks to ensure reliability
const isRenderDeploy = window.location.hostname.includes('render.com') || 
                        window.location.hostname === 'socialfooddelivery-2.onrender.com';
const isLocalhost = window.location.hostname === 'localhost' || 
                    window.location.hostname === '127.0.0.1';
const forceLocalBackend = localStorage.getItem('useLocalBackend') === 'true';

// Use this for final environment determination
// Priority: 1. Manual override, 2. Hostname check, 3. NODE_ENV
const isDevelopment = forceLocalBackend || 
                      (!isRenderDeploy && isLocalhost) || 
                      (process.env.NODE_ENV === 'development');

// Production API URL (Render deployment)
const PRODUCTION_API_URL = 'https://socialfooddelivery-2.onrender.com/api/v1';
const PRODUCTION_SERVER_URL = 'https://socialfooddelivery-2.onrender.com';

// Development API URL (localhost)
const DEVELOPMENT_API_URL = 'http://localhost:8000/api/v1';
const DEVELOPMENT_SERVER_URL = 'http://localhost:8000';

// Set appropriate timeout (longer for production)
export const API_TIMEOUT = isDevelopment ? 10000 : 30000; // 10s for dev, 30s for production

// ⚠️ IMPORTANT: Production deployment configuration
// When deploying both frontend and backend to production, ensure we use the production URLs
// Set forceProdUrls to true if you want to force using production URLs even in development
const forceProdUrls = localStorage.getItem('forceProdUrls') === 'true';
const useProductionUrls = isRenderDeploy || !isLocalhost || forceProdUrls;

// Set appropriate URLs based on environment with production as the default for safety
export const API_BASE_URL = useProductionUrls ? PRODUCTION_API_URL : DEVELOPMENT_API_URL;
export const SERVER_URL = useProductionUrls ? PRODUCTION_SERVER_URL : DEVELOPMENT_SERVER_URL;

// Allow quick toggling between environments for testing
window.toggleApiEnvironment = () => {
  const current = localStorage.getItem('forceProdUrls');
  const newValue = current !== 'true';
  localStorage.setItem('forceProdUrls', newValue);
  console.log(`API environment switched to ${newValue ? 'PRODUCTION' : 'DEVELOPMENT'}`);
  console.log('Please refresh the page for changes to take effect');
};

// Detailed logging to help with deployment debugging
console.log('=== API CONFIGURATION ===');
console.log(`Environment detection:`);
console.log(`- Is Render deploy: ${isRenderDeploy}`);
console.log(`- Is localhost: ${isLocalhost}`);
console.log(`- Force local backend: ${forceLocalBackend}`);
console.log(`- process.env.NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`Final environment: ${isDevelopment ? 'DEVELOPMENT' : 'PRODUCTION'}`);
console.log(`Using API URL: ${API_BASE_URL}`);
console.log(`Using Server URL: ${SERVER_URL}`);
console.log(`API timeout: ${API_TIMEOUT}ms`);
console.log('=========================');

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
