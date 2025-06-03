// utils/axiosInstance.js
/**
 * Enhanced Axios instance for Social Food Delivery
 * Optimized for mobile devices and production deployment on Render.com
 * Includes robust retry mechanisms, token management, and error handling
 */
import axios from "axios";
import { API_BASE_URL, API_TIMEOUT, RETRY_CONFIG, environment } from "./apiConfig";
import tokenManager from "./tokenManager";

// Get the current environment information
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
const isProduction = environment.isProduction;

// Show detailed connection information in console
console.log('=== AXIOS INSTANCE CONFIG ===');
console.log('Base URL:', API_BASE_URL);
console.log('Environment:', isProduction ? 'Production' : 'Development');
console.log('Mobile device:', isMobile);
console.log('Timeouts:', API_TIMEOUT);
console.log('Retry config:', RETRY_CONFIG);
console.log('================================');

// Create axios instance with production-optimized settings
const instance = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // Critical for cookies and authentication
  timeout: API_TIMEOUT.medium, // Default timeout
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
    'X-Client-Platform': isMobile ? 'mobile' : 'desktop',
    'X-Client-Version': '1.0.0',
    'X-Environment': isProduction ? 'production' : 'development'
  },
  // Enhanced request validation
  validateStatus: (status) => {
    // Don't throw for client errors, let the app handle them
    return status < 500;
  },
  // Maximum redirects
  maxRedirects: 3,
  // Request/response transformation
  transformRequest: [
    (data, headers) => {
      // Add network quality information if available
      if (navigator.connection) {
        headers['X-Connection-Type'] = navigator.connection.effectiveType || 'unknown';
        headers['X-Connection-Downlink'] = navigator.connection.downlink || 0;
      }
      
      // Add timestamp for debugging
      headers['X-Request-Timestamp'] = Date.now();
      
      return data;
    },
    ...axios.defaults.transformRequest
  ]
});

// Make the instance available globally for debugging
window.axiosInstance = instance;

// Enhanced request interceptor with comprehensive token handling
instance.interceptors.request.use(
  (config) => {
    try {
      // Multi-source token acquisition strategy
      let token = tokenManager.getToken();
      
      // If no token from manager, try direct storage access
      if (!token) {
        token = localStorage.getItem('token') || 
                sessionStorage.getItem('token') || 
                getCookieValue('token');
      }
      
      if (token) {
        console.log(`[AxiosInstance] Token found for request: ${config.method?.toUpperCase()} ${config.url}`);
        
        // Set authentication headers in multiple formats for maximum compatibility
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${token}`;
        config.headers["x-auth-token"] = token;
        config.headers["auth-token"] = token;
        config.headers.token = token;
        
        // Set secure cookie for cross-origin requests
        if (typeof document !== 'undefined') {
          const isSecure = window.location.protocol === 'https:';
          const sameSite = isSecure ? 'None' : 'Lax';
          const secureFlag = isSecure ? '; Secure' : '';
          
          document.cookie = `token=${token}; path=/; SameSite=${sameSite}${secureFlag}; max-age=86400`;
        }
        
        // Add token to URL as fallback for problematic networks
        if (config.url && !config.url.includes('_auth=')) {
          const separator = config.url.includes('?') ? '&' : '?';
          config.url = `${config.url}${separator}_auth=${encodeURIComponent(token)}`;
        }
      } else {
        console.warn('[AxiosInstance] No authentication token available');
        
        // Check if this is a protected route
        const isPublicRoute = config.url?.includes('/login') || 
                             config.url?.includes('/signup') || 
                             config.url?.includes('/health') ||
                             config.url?.includes('/public');
        
        if (!isPublicRoute) {
          console.warn('[AxiosInstance] Making request to protected route without token');
        }
      }
      
      // Adjust timeout based on request type and network conditions
      if (!config.timeout) {
        if (config.method === 'post' && config.data instanceof FormData) {
          config.timeout = API_TIMEOUT.upload; // File uploads
        } else if (config.method === 'get') {
          config.timeout = API_TIMEOUT.medium; // Regular GET requests
        } else {
          config.timeout = API_TIMEOUT.medium; // Default
        }
      }
      
      // Add retry metadata
      config.retryCount = config.retryCount || 0;
      config.retryDelay = config.retryDelay || RETRY_CONFIG.baseDelay;
      
      // Log request details for debugging
      console.log(`[AxiosInstance] ${config.method?.toUpperCase()} ${config.url}`, {
        timeout: config.timeout,
        retryCount: config.retryCount,
        hasAuth: !!token
      });
      
      return config;
    } catch (error) {
      console.error('[AxiosInstance] Request interceptor error:', error);
      return config;
    }
  },
  (error) => {
    console.error('[AxiosInstance] Request setup error:', error);
    return Promise.reject(error);
  }
);

// Enhanced response interceptor with intelligent retry logic
instance.interceptors.response.use(
  // Successful responses
  (response) => {
    // Log successful requests
    const { config, status, data } = response;
    console.log(`[AxiosInstance] ✅ ${config?.method?.toUpperCase()} ${config?.url} - ${status}`, {
      success: data?.success,
      retryCount: config?.retryCount || 0
    });
    
    return response;
  },
  
  // Error responses with intelligent retry
  async (error) => {
    const { config, response, code, message } = error;
    
    console.error(`[AxiosInstance] ❌ ${config?.method?.toUpperCase()} ${config?.url}`, {
      status: response?.status,
      code,
      message,
      retryCount: config?.retryCount || 0
    });
    
    // Don't retry if no config (prevents infinite loops)
    if (!config) {
      return Promise.reject(error);
    }
    
    // Check if we should retry this request
    const shouldRetry = determineRetryStrategy(error, config);
    
    if (shouldRetry.retry && config.retryCount < RETRY_CONFIG.maxRetries) {
      console.log(`[AxiosInstance] Retrying in ${shouldRetry.delay}ms... (attempt ${config.retryCount + 1}/${RETRY_CONFIG.maxRetries})`);
      
      // Mark this request as being retried
      config.retryCount = (config.retryCount || 0) + 1;
      config._retry = true;
      
      // Handle token refresh for auth errors
      if (shouldRetry.refreshToken) {
        try {
          await refreshAuthToken(config);
        } catch (refreshError) {
          console.error('[AxiosInstance] Token refresh failed:', refreshError);
          // Clear invalid tokens
          tokenManager.clearToken();
          
          // Redirect to login if in browser
          if (typeof window !== 'undefined' && window.location) {
            setTimeout(() => {
              window.location.href = '/login';
            }, 1000);
          }
          
          return Promise.reject(error);
        }
      }
      
      // Wait before retry with exponential backoff + jitter
      const jitter = Math.random() * 500; // Add randomness
      const totalDelay = Math.min(shouldRetry.delay + jitter, RETRY_CONFIG.maxDelay);
      
      await new Promise(resolve => setTimeout(resolve, totalDelay));
      
      // Retry the request
      return instance(config);
    }
    
    // No more retries, reject with enhanced error info
    const enhancedError = enhanceErrorInfo(error);
    return Promise.reject(enhancedError);
  }
);

// Utility function to get cookie value
function getCookieValue(name) {
  if (typeof document === 'undefined') return null;
  
  const cookies = document.cookie.split(';');
  for (let cookie of cookies) {
    const [cookieName, cookieValue] = cookie.trim().split('=');
    if (cookieName === name) {
      return cookieValue;
    }
  }
  return null;
}

// Determine retry strategy based on error type
function determineRetryStrategy(error, config) {
  const { response, code, message } = error;
  const status = response?.status;
  
  // Network errors - always retry
  if (!response || code === 'ECONNABORTED' || code === 'NETWORK_ERROR') {
    return {
      retry: true,
      delay: RETRY_CONFIG.baseDelay * Math.pow(RETRY_CONFIG.exponentialBase, config.retryCount || 0),
      reason: 'Network error'
    };
  }
  
  // Timeout errors - retry with longer delay
  if (code === 'ECONNABORTED' || message.includes('timeout')) {
    return {
      retry: true,
      delay: RETRY_CONFIG.baseDelay * 2 * Math.pow(RETRY_CONFIG.exponentialBase, config.retryCount || 0),
      reason: 'Timeout error'
    };
  }
  
  // Server errors (5xx) - retry
  if (status >= 500) {
    return {
      retry: true,
      delay: RETRY_CONFIG.baseDelay * Math.pow(RETRY_CONFIG.exponentialBase, config.retryCount || 0),
      reason: 'Server error'
    };
  }
  
  // Rate limiting - retry with longer delay
  if (status === 429) {
    const retryAfter = response.headers['retry-after'];
    const delay = retryAfter ? parseInt(retryAfter) * 1000 : RETRY_CONFIG.baseDelay * 4;
    
    return {
      retry: true,
      delay: Math.min(delay, RETRY_CONFIG.maxDelay),
      reason: 'Rate limited'
    };
  }
  
  // Auth errors - try token refresh
  if (status === 401 && !config._tokenRefreshAttempted) {
    return {
      retry: true,
      refreshToken: true,
      delay: 1000,
      reason: 'Auth token expired'
    };
  }
  
  // Client errors (4xx except 401, 408, 429) - don't retry
  if (status >= 400 && status < 500 && status !== 408 && status !== 429) {
    return {
      retry: false,
      reason: 'Client error - not retryable'
    };
  }
  
  // Default - retry with standard delay
  return {
    retry: true,
    delay: RETRY_CONFIG.baseDelay * Math.pow(RETRY_CONFIG.exponentialBase, config.retryCount || 0),
    reason: 'General error'
  };
}

// Token refresh function
async function refreshAuthToken(config) {
  try {
    const currentToken = tokenManager.getToken();
    if (!currentToken) {
      throw new Error('No token to refresh');
    }
    
    console.log('[AxiosInstance] Attempting token refresh...');
    
    const refreshResponse = await axios.post(
      `${API_BASE_URL}/user/refresh-token`,
      { token: currentToken },
      { 
        withCredentials: true,
        timeout: API_TIMEOUT.short,
        // Don't retry token refresh requests
        retryCount: RETRY_CONFIG.maxRetries
      }
    );
    
    if (refreshResponse.data?.token) {
      const newToken = refreshResponse.data.token;
      tokenManager.saveToken(newToken);
      
      // Update the original request config with new token
      config.headers.Authorization = `Bearer ${newToken}`;
      config.headers["x-auth-token"] = newToken;
      config._tokenRefreshAttempted = true;
      
      console.log('[AxiosInstance] Token refreshed successfully');
      return newToken;
    } else {
      throw new Error('Invalid refresh response');
    }
  } catch (refreshError) {
    console.error('[AxiosInstance] Token refresh failed:', refreshError);
    throw refreshError;
  }
}

// Enhance error information for better debugging
function enhanceErrorInfo(error) {
  const enhanced = { ...error };
  
  enhanced.isNetworkError = !error.response;
  enhanced.isTimeoutError = error.code === 'ECONNABORTED';
  enhanced.isServerError = error.response?.status >= 500;
  enhanced.isClientError = error.response?.status >= 400 && error.response?.status < 500;
  enhanced.isAuthError = error.response?.status === 401 || error.response?.status === 403;
  enhanced.userFriendlyMessage = getUserFriendlyErrorMessage(error);
  
  return enhanced;
}

// Generate user-friendly error messages
function getUserFriendlyErrorMessage(error) {
  if (!navigator.onLine) {
    return 'No internet connection. Please check your network and try again.';
  }
  
  if (error.code === 'ECONNABORTED') {
    return 'Request timed out. Please check your connection and try again.';
  }
  
  if (!error.response) {
    return 'Network error. Please check your internet connection.';
  }
  
  const status = error.response.status;
  
  switch (status) {
    case 401:
      return 'Please log in to continue.';
    case 403:
      return 'Access denied. Please check your permissions.';
    case 404:
      return 'The requested resource was not found.';
    case 429:
      return 'Too many requests. Please wait a moment and try again.';
    case 500:
      return 'Server error. Please try again later.';
    case 503:
      return 'Service temporarily unavailable. Please try again later.';
    default:
      return error.response?.data?.message || 'Something went wrong. Please try again.';
  }
}

export default instance;
export { API_BASE_URL };
