/**
 * API Configuration Utility - Enhanced for Production Deployment
 * 
 * This utility provides robust API URLs across all environments,
 * with special handling for mobile devices and production deployment issues.
 */

// Environment detection with multiple fallback methods
const getEnvironmentInfo = () => {
  // Check various indicators for environment
  const hostname = window.location.hostname;
  const protocol = window.location.protocol;
  const port = window.location.port;
  
  // Render.com deployment detection
  const isRenderDeploy = hostname.includes('render.com') || 
                        hostname.includes('onrender.com') ||
                        hostname === 'socialfooddelivery-2.onrender.com';
  
  // Local development detection
  const isLocalhost = hostname === 'localhost' || 
                     hostname === '127.0.0.1' ||
                     hostname === '0.0.0.0';
  
  // Production domain detection
  const isProductionDomain = isRenderDeploy || 
                           (protocol === 'https:' && !isLocalhost);
  
  // Manual overrides from localStorage (for testing)
  const forceLocalBackend = localStorage.getItem('useLocalBackend') === 'true';
  const forceProdUrls = localStorage.getItem('forceProdUrls') === 'true';
  const forceLocalUrls = localStorage.getItem('forceLocalUrls') === 'true';
  
  // Vite environment variables
  const viteApiUrl = import.meta.env.VITE_API_URL;
  const viteServerUrl = import.meta.env.VITE_SERVER_URL;
  const viteProd = import.meta.env.PROD;
  const viteDev = import.meta.env.DEV;
  
  console.log('[ApiConfig] Environment Detection:', {
    hostname,
    protocol,
    port,
    isRenderDeploy,
    isLocalhost,
    isProductionDomain,
    viteProd,
    viteDev,
    viteApiUrl,
    viteServerUrl
  });
  
  return {
    hostname,
    protocol,
    port,
    isRenderDeploy,
    isLocalhost,
    isProductionDomain,
    forceLocalBackend,
    forceProdUrls,
    forceLocalUrls,
    viteApiUrl,
    viteServerUrl,
    viteProd,
    viteDev
  };
};

const envInfo = getEnvironmentInfo();

// API URLs with multiple fallback options
const API_URLS = {
  production: {
    primary: 'https://socialfooddelivery-2.onrender.com/api/v1',
    fallback: 'https://socialfooddelivery.onrender.com/api/v1', // Alternative domain
    server: 'https://socialfooddelivery-2.onrender.com'
  },
  development: {
    primary: 'http://localhost:8000/api/v1',
    fallback: 'http://127.0.0.1:8000/api/v1',
    server: 'http://localhost:8000'
  }
};

// Determine which URLs to use
const determineApiUrls = () => {
  // Priority order:
  // 1. Environment variables (highest priority)
  // 2. Manual overrides
  // 3. Environment detection
  // 4. Fallbacks
  
  let apiUrl, serverUrl;
  
  // Check environment variables first
  if (envInfo.viteApiUrl) {
    apiUrl = envInfo.viteApiUrl;
    console.log('[ApiConfig] Using VITE_API_URL:', apiUrl);
  }
  
  if (envInfo.viteServerUrl) {
    serverUrl = envInfo.viteServerUrl;
    console.log('[ApiConfig] Using VITE_SERVER_URL:', serverUrl);
  }
  
  // If not set via env vars, determine based on environment
  if (!apiUrl || !serverUrl) {
    const shouldUseProduction = !envInfo.forceLocalUrls && 
                               (envInfo.forceProdUrls || 
                                envInfo.isProductionDomain || 
                                envInfo.viteProd);
    
    if (shouldUseProduction) {
      apiUrl = apiUrl || API_URLS.production.primary;
      serverUrl = serverUrl || API_URLS.production.server;
      console.log('[ApiConfig] Using production URLs');
    } else {
      apiUrl = apiUrl || API_URLS.development.primary;
      serverUrl = serverUrl || API_URLS.development.server;
      console.log('[ApiConfig] Using development URLs');
    }
  }
  
  return { apiUrl, serverUrl };
};

const { apiUrl: API_BASE_URL, serverUrl: SERVER_URL } = determineApiUrls();

// Timeout configurations based on environment and device
const getTimeoutConfig = () => {
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const isProduction = envInfo.viteProd || envInfo.isProductionDomain;
  const networkType = navigator.connection?.effectiveType || 'unknown';
  
  let baseTimeout = 15000; // 15 seconds default
  
  // Adjust for environment
  if (isProduction) {
    baseTimeout = 30000; // 30 seconds for production (Render can be slow)
  }
  
  // Adjust for mobile
  if (isMobile) {
    baseTimeout = Math.round(baseTimeout * 1.5); // 50% longer for mobile
  }
  
  // Adjust for network quality
  if (networkType === '2g' || networkType === 'slow-2g') {
    baseTimeout = Math.round(baseTimeout * 2); // Double for slow networks
  } else if (networkType === '3g') {
    baseTimeout = Math.round(baseTimeout * 1.3); // 30% longer for 3G
  }
  
  // Environment variable override
  const envTimeout = import.meta.env.VITE_API_TIMEOUT;
  if (envTimeout && !isNaN(parseInt(envTimeout))) {
    baseTimeout = parseInt(envTimeout);
  }
  
  return {
    short: Math.round(baseTimeout * 0.5),   // 50% of base
    medium: baseTimeout,                     // Base timeout
    long: Math.round(baseTimeout * 2),      // 200% of base
    upload: Math.round(baseTimeout * 3)     // 300% of base for uploads
  };
};

export const API_TIMEOUT = getTimeoutConfig();

// Retry configuration
export const RETRY_CONFIG = {
  maxRetries: parseInt(import.meta.env.VITE_MAX_RETRIES) || (envInfo.viteProd ? 5 : 3),
  baseDelay: 1000,
  maxDelay: 10000,
  exponentialBase: 2
};

// Export main configuration
export { API_BASE_URL, SERVER_URL };

/**
 * Helper function to build full API endpoint URLs
 * @param {string} endpoint - API endpoint path (without leading slash)
 * @returns {string} - Full API URL
 */
export const getApiUrl = (endpoint) => {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.substring(1) : endpoint;
  const url = `${API_BASE_URL}/${cleanEndpoint}`;
  console.log(`[ApiConfig] Built API URL: ${url}`);
  return url;
};

/**
 * Helper function to build full server URLs (non-API)
 * @param {string} path - Server path (without leading slash)
 * @returns {string} - Full server URL
 */
export const getServerUrl = (path = '') => {
  const cleanPath = path.startsWith('/') ? path.substring(1) : path;
  const url = cleanPath ? `${SERVER_URL}/${cleanPath}` : SERVER_URL;
  console.log(`[ApiConfig] Built server URL: ${url}`);
  return url;
};

/**
 * Test API connectivity
 * @returns {Promise<boolean>} - True if API is reachable
 */
export const testApiConnectivity = async () => {
  try {
    console.log('[ApiConfig] Testing API connectivity...');
    
    // Try primary API URL
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT.short);
    
    const response = await fetch(`${API_BASE_URL.replace('/api/v1', '')}/health`, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'X-Client-Test': 'connectivity'
      }
    });
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
      console.log('[ApiConfig] Primary API is reachable');
      return true;
    } else {
      console.warn('[ApiConfig] Primary API returned error:', response.status);
      return false;
    }
    
  } catch (error) {
    console.error('[ApiConfig] API connectivity test failed:', error);
    
    // Try fallback URL if available
    const isUsingPrimary = API_BASE_URL === API_URLS.production.primary;
    if (isUsingPrimary && envInfo.isProductionDomain) {
      console.log('[ApiConfig] Trying fallback API URL...');
      try {
        const fallbackResponse = await fetch(`${API_URLS.production.fallback.replace('/api/v1', '')}/health`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'X-Client-Test': 'connectivity-fallback'
          }
        });
        
        if (fallbackResponse.ok) {
          console.log('[ApiConfig] Fallback API is reachable');
          return true;
        }
      } catch (fallbackError) {
        console.error('[ApiConfig] Fallback API also failed:', fallbackError);
      }
    }
    
    return false;
  }
};

// Export current environment information for debugging
export const environment = {
  isDevelopment: envInfo.viteDev || (!envInfo.viteProd && envInfo.isLocalhost),
  isProduction: envInfo.viteProd || envInfo.isProductionDomain,
  isRenderDeployment: envInfo.isRenderDeploy,
  apiBaseUrl: API_BASE_URL,
  serverUrl: SERVER_URL,
  timeouts: API_TIMEOUT,
  retryConfig: RETRY_CONFIG,
  envInfo
};

// Log current configuration
console.log('[ApiConfig] Current Configuration:', {
  API_BASE_URL,
  SERVER_URL,
  environment: environment.isProduction ? 'production' : 'development',
  timeouts: API_TIMEOUT,
  retryConfig: RETRY_CONFIG
});

// Test connectivity on initialization (in production only)
if (environment.isProduction) {
  testApiConnectivity().then(isConnected => {
    if (!isConnected) {
      console.warn('[ApiConfig] ⚠️ API connectivity issues detected. Some features may not work properly.');
    } else {
      console.log('[ApiConfig] ✅ API connectivity confirmed');
    }
  });
}
