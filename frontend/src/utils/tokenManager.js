/**
 * Token Manager Utility
 * 
 * Provides centralized token management for the Social Food Delivery app
 * with cross-platform compatibility and strong token persistence.
 */

// Storage keys
const TOKEN_KEY = 'token';
const TOKEN_EXPIRY_KEY = 'token_expiry';

/**
 * Get token from all possible storage locations
 * @returns {string|null} The first available token or null if none found
 */
export const getToken = () => {
  // Check localStorage
  const localToken = localStorage.getItem(TOKEN_KEY);
  
  // Check sessionStorage
  const sessionToken = sessionStorage.getItem(TOKEN_KEY);
  
  // Check cookies
  const cookieToken = getCookieToken(TOKEN_KEY);
  
  // Return the first available token
  return localToken || sessionToken || cookieToken;
};

/**
 * Helper to extract token from cookies
 * @param {string} name - Cookie name
 * @returns {string|null} Cookie value or null
 */
export const getCookieToken = (name) => {
  if (typeof document === 'undefined') return null;
  
  const cookies = document.cookie.split(';');
  for (let i = 0; i < cookies.length; i++) {
    const cookie = cookies[i].trim();
    if (cookie.startsWith(name + '=')) {
      return cookie.substring(name.length + 1);
    }
  }
  return null;
};

/**
 * Save token to all storage mechanisms
 * @param {string} token - The token to store
 * @param {number} expiryDays - Days until token expires (default: 7)
 */
export const saveToken = (token, expiryDays = 7) => {
  if (!token) {
    console.warn('Attempted to save empty token');
    return;
  }
  
  // Calculate expiry timestamp
  const expiryMs = Date.now() + (expiryDays * 24 * 60 * 60 * 1000);
  
  try {
    // Save to localStorage with expiry info
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(TOKEN_EXPIRY_KEY, expiryMs.toString());
    
    // Save to sessionStorage
    sessionStorage.setItem(TOKEN_KEY, token);
    
    // Save to cookies with appropriate attributes
    const isSecure = window.location.protocol === 'https:';
    const sameSite = isSecure ? 'None' : 'Lax';
    const secureFlag = isSecure ? '; Secure' : '';
    const maxAge = expiryDays * 24 * 60 * 60;
    
    document.cookie = `${TOKEN_KEY}=${token}; path=/; max-age=${maxAge}; SameSite=${sameSite}${secureFlag}`;
    
    console.log('Token saved to all storage mechanisms');
  } catch (error) {
    console.error('Error saving token:', error);
  }
};

/**
 * Clear token from all storage mechanisms
 */
export const clearToken = () => {
  // Clear from localStorage
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_EXPIRY_KEY);
  
  // Clear from sessionStorage
  sessionStorage.removeItem(TOKEN_KEY);
  
  // Clear from cookies
  document.cookie = `${TOKEN_KEY}=; path=/; max-age=0`;
  
  console.log('Token cleared from all storage mechanisms');
};

/**
 * Check if token exists and is not expired
 * @returns {boolean} True if valid token exists
 */
export const hasValidToken = () => {
  const token = getToken();
  if (!token) return false;
  
  // Check expiry
  const expiryStr = localStorage.getItem(TOKEN_EXPIRY_KEY);
  if (expiryStr) {
    const expiry = parseInt(expiryStr, 10);
    if (Date.now() > expiry) {
      clearToken();
      return false;
    }
  }
  
  return true;
};

/**
 * Initialize all token storage mechanisms from any valid source
 */
export const initializeTokens = () => {
  // Check all possible storage locations
  const localToken = localStorage.getItem('token');
  const sessionToken = sessionStorage.getItem('token');
  const cookieToken = getCookieToken('token');
  const memoryToken = window._authToken;
  
  // Use the first valid token found
  const token = memoryToken || localToken || sessionToken || cookieToken;
  
  if (token) {
    console.log('Token found during initialization - synchronizing across all mechanisms');
    // Store token in all locations
    localStorage.setItem('token', token);
    sessionStorage.setItem('token', token);
    document.cookie = `token=${token}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`;
    window._authToken = token;
    
    // Update axios headers directly
    if (window.axiosInstance?.defaults?.headers?.common) {
      window.axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
    
    console.log('Token fully synchronized across all storage mechanisms');
    return token;
  }
  
  console.log('No token found during initialization.');
  return null;
};

/**
 * Add token to URL (for special cross-origin cases)
 * @param {string} url - The URL to modify
 * @returns {string} URL with token parameter
 */
export const addTokenToUrl = (url) => {
  const token = getToken();
  if (!token) return url;
  
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}_auth=${token}`;
};

// Create a proper singleton object that correctly binds all methods
const tokenManagerSingleton = {
  getToken,
  getCookieToken,
  saveToken,
  setToken: saveToken, // Alias for better API naming
  clearToken,
  hasValidToken,
  initializeTokens,
  addTokenToUrl
};

export default tokenManagerSingleton;
