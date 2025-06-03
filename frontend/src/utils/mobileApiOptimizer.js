/**
 * Mobile API Optimizer
 * 
 * Specialized utility for handling API requests on mobile devices
 * Addresses common mobile network issues, timeouts, and authentication problems
 */

import axiosInstance from './axiosInstance';
import tokenManager from './tokenManager';
import { toast } from 'react-toastify';

// Mobile-specific configuration
const MOBILE_CONFIG = {
  // Timeout configurations (mobile networks can be slower)
  TIMEOUT_SHORT: 8000,    // 8 seconds for quick operations
  TIMEOUT_MEDIUM: 15000,  // 15 seconds for normal operations
  TIMEOUT_LONG: 30000,    // 30 seconds for heavy operations
  
  // Retry configurations
  MAX_RETRIES: 3,
  RETRY_DELAY_BASE: 1000, // Base delay of 1 second
  
  // Mobile detection
  isMobile: () => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
           window.innerWidth <= 768;
  },
  
  // Network quality detection
  getNetworkQuality: () => {
    if (navigator.connection) {
      const connection = navigator.connection;
      const { effectiveType, downlink, rtt } = connection;
      
      if (effectiveType === '4g' && downlink > 10) return 'good';
      if (effectiveType === '4g' || effectiveType === '3g') return 'medium';
      return 'poor';
    }
    return 'unknown';
  }
};

// Enhanced error handler for mobile scenarios
const handleMobileError = (error, context = '') => {
  console.error(`[MobileAPI] Error in ${context}:`, {
    message: error.message,
    status: error.response?.status,
    code: error.code,
    network: navigator.onLine ? 'online' : 'offline'
  });
  
  // Network-specific error messages
  if (!navigator.onLine) {
    return {
      userMessage: 'No internet connection. Please check your network and try again.',
      retryable: true,
      delay: 2000
    };
  }
  
  if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
    return {
      userMessage: 'Request timed out. Please check your connection and try again.',
      retryable: true,
      delay: 1500
    };
  }
  
  if (error.code === 'NETWORK_ERROR' || error.message.includes('Network Error')) {
    return {
      userMessage: 'Network error. Please check your internet connection.',
      retryable: true,
      delay: 2000
    };
  }
  
  if (error.response?.status === 401) {
    return {
      userMessage: 'Please log in to continue.',
      retryable: false,
      requiresAuth: true
    };
  }
  
  if (error.response?.status === 403) {
    return {
      userMessage: 'Access denied. Please log in again.',
      retryable: false,
      requiresAuth: true
    };
  }
  
  if (error.response?.status === 429) {
    return {
      userMessage: 'Too many requests. Please wait a moment and try again.',
      retryable: true,
      delay: 5000
    };
  }
  
  if (error.response?.status >= 500) {
    return {
      userMessage: 'Server error. Please try again in a moment.',
      retryable: true,
      delay: 3000
    };
  }
  
  return {
    userMessage: error.response?.data?.message || error.message || 'Something went wrong. Please try again.',
    retryable: error.response?.status !== 400, // Don't retry client errors
    delay: 1000
  };
};

// Network quality-based timeout adjustment
const getTimeoutForOperation = (operation = 'medium') => {
  const quality = MOBILE_CONFIG.getNetworkQuality();
  const isMobile = MOBILE_CONFIG.isMobile();
  
  let multiplier = 1;
  
  // Adjust based on network quality
  if (quality === 'poor') multiplier = 2.5;
  else if (quality === 'medium') multiplier = 1.5;
  else if (quality === 'good') multiplier = 1;
  else multiplier = 1.8; // Unknown, be conservative
  
  // Additional mobile adjustment
  if (isMobile) multiplier *= 1.3;
  
  const baseTimeout = MOBILE_CONFIG[`TIMEOUT_${operation.toUpperCase()}`] || MOBILE_CONFIG.TIMEOUT_MEDIUM;
  return Math.round(baseTimeout * multiplier);
};

// Enhanced axios request with mobile optimizations
const createMobileRequest = (config = {}) => {
  const isMobile = MOBILE_CONFIG.isMobile();
  const networkQuality = MOBILE_CONFIG.getNetworkQuality();
  
  return {
    ...config,
    timeout: config.timeout || getTimeoutForOperation(config.operation || 'medium'),
    headers: {
      ...config.headers,
      'X-Client-Platform': isMobile ? 'mobile' : 'desktop',
      'X-Network-Quality': networkQuality,
      'X-User-Agent': navigator.userAgent,
      'X-Screen-Width': window.innerWidth,
      'X-Connection-Type': navigator.connection?.effectiveType || 'unknown'
    },
    // Mobile-specific axios configurations
    validateStatus: (status) => status < 500, // Don't throw on 4xx errors
    maxRedirects: 3,
    // Retry configuration
    'axios-retry': {
      retries: MOBILE_CONFIG.MAX_RETRIES,
      retryDelay: (retryCount) => {
        return Math.min(1000 * Math.pow(2, retryCount), 5000);
      },
      retryCondition: (error) => {
        const errorInfo = handleMobileError(error);
        return errorInfo.retryable;
      }
    }
  };
};

// Main API request wrapper with retry logic
export const makeRequest = async (requestConfig, options = {}) => {
  const {
    maxRetries = MOBILE_CONFIG.MAX_RETRIES,
    onRetry = null,
    context = 'API request',
    showToasts = true
  } = options;
  
  let lastError = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[MobileAPI] ${context} - Attempt ${attempt}/${maxRetries}`);
      
      // Create mobile-optimized request config
      const mobileConfig = createMobileRequest(requestConfig);
      
      // Make the request
      const response = await axiosInstance(mobileConfig);
      
      // Handle successful response
      if (response.status >= 200 && response.status < 300) {
        console.log(`[MobileAPI] ${context} - Success on attempt ${attempt}`);
        
        // Show success toast for retry scenarios
        if (attempt > 1 && showToasts) {
          toast.success('Request completed successfully');
        }
        
        return {
          success: true,
          data: response.data,
          response
        };
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
    } catch (error) {
      lastError = error;
      const errorInfo = handleMobileError(error, context);
      
      console.warn(`[MobileAPI] ${context} - Attempt ${attempt}/${maxRetries} failed:`, errorInfo);
      
      // Don't retry if not retryable
      if (!errorInfo.retryable) {
        console.error(`[MobileAPI] ${context} - Error not retryable, stopping`);
        break;
      }
      
      // Handle authentication errors
      if (errorInfo.requiresAuth) {
        console.error(`[MobileAPI] ${context} - Authentication required`);
        // Clear tokens and redirect to login could be handled here
        tokenManager.clearToken();
        break;
      }
      
      // Wait before retry (exponential backoff with jitter)
      if (attempt < maxRetries) {
        const delay = errorInfo.delay || (MOBILE_CONFIG.RETRY_DELAY_BASE * Math.pow(2, attempt - 1));
        const jitter = Math.random() * 500; // Add randomness to prevent thundering herd
        const totalDelay = Math.min(delay + jitter, 10000); // Cap at 10 seconds
        
        console.log(`[MobileAPI] ${context} - Waiting ${Math.round(totalDelay)}ms before retry...`);
        
        if (onRetry) {
          onRetry(attempt, maxRetries, totalDelay);
        }
        
        await new Promise(resolve => setTimeout(resolve, totalDelay));
      }
    }
  }
  
  // All retries failed
  const errorInfo = handleMobileError(lastError, context);
  console.error(`[MobileAPI] ${context} - All retries failed:`, errorInfo);
  
  if (showToasts) {
    toast.error(errorInfo.userMessage);
  }
  
  return {
    success: false,
    error: errorInfo.userMessage,
    details: lastError,
    requiresAuth: errorInfo.requiresAuth
  };
};

// Specialized methods for common operations
export const MobileAPI = {
  // GET request with mobile optimizations
  get: async (url, params = {}, options = {}) => {
    return makeRequest({
      method: 'GET',
      url,
      params,
      operation: options.operation || 'medium'
    }, {
      ...options,
      context: options.context || `GET ${url}`
    });
  },
  
  // POST request with mobile optimizations
  post: async (url, data = {}, options = {}) => {
    return makeRequest({
      method: 'POST',
      url,
      data,
      operation: options.operation || 'medium'
    }, {
      ...options,
      context: options.context || `POST ${url}`
    });
  },
  
  // PUT request with mobile optimizations
  put: async (url, data = {}, options = {}) => {
    return makeRequest({
      method: 'PUT',
      url,
      data,
      operation: options.operation || 'medium'
    }, {
      ...options,
      context: options.context || `PUT ${url}`
    });
  },
  
  // DELETE request with mobile optimizations
  delete: async (url, options = {}) => {
    return makeRequest({
      method: 'DELETE',
      url,
      operation: options.operation || 'short'
    }, {
      ...options,
      context: options.context || `DELETE ${url}`
    });
  },
  
  // Upload with mobile-specific handling
  upload: async (url, formData, options = {}) => {
    return makeRequest({
      method: 'POST',
      url,
      data: formData,
      operation: 'long',
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      onUploadProgress: options.onProgress
    }, {
      ...options,
      maxRetries: 2, // Fewer retries for uploads
      context: options.context || `UPLOAD ${url}`
    });
  }
};

// Network status monitoring
export const NetworkMonitor = {
  isOnline: () => navigator.onLine,
  
  // Listen for network changes
  addNetworkListener: (callback) => {
    const handleOnline = () => callback({ online: true, type: 'online' });
    const handleOffline = () => callback({ online: false, type: 'offline' });
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Return cleanup function
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  },
  
  // Get connection info
  getConnectionInfo: () => {
    if (!navigator.connection) return null;
    
    const { effectiveType, downlink, rtt, saveData } = navigator.connection;
    return {
      effectiveType,
      downlink,
      rtt,
      saveData,
      quality: MOBILE_CONFIG.getNetworkQuality()
    };
  }
};

export default MobileAPI; 