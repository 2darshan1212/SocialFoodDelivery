import React, { createContext, useContext, useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import axiosInstance from '../utils/axiosInstance';
import { API_BASE_URL } from '../utils/apiConfig';
import { setAuthUser } from '../redux/authSlice';
import { toast } from 'react-toastify';
import tokenManager from '../utils/tokenManager';

// Create context
const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children, navigate }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [authMessage, setAuthMessage] = useState("");
  const [suppressAuthMessages, setSuppressAuthMessages] = useState(false);
  const dispatch = useDispatch();

  // Helper function to safely get cached user data from Redux storage
  const tryGetCachedUser = () => {
    try {
      const authUserFromRedux = localStorage.getItem('persist:auth');
      if (authUserFromRedux) {
        const parsedAuth = JSON.parse(authUserFromRedux);
        const parsedUser = parsedAuth.user ? JSON.parse(parsedAuth.user) : null;
        
        if (parsedUser && parsedUser._id) {
          return parsedUser;
        }
      }
      return null;
    } catch (e) {
      console.error('Error parsing Redux auth data:', e);
      return null;
    }
  };

  // Background verification that doesn't affect the UI loading
  const verifyTokenInBackground = async (token) => {
    try {
      console.log('Verifying token validity with backend...');
      
      // CRITICAL: Ensure token is attached to the request in all formats
      // 1. Add token to the Authorization header manually
      const requestConfig = {
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-auth-token': token,
          'token': token
        },
        // Add token as query parameter
        params: {
          _auth: token
        },
        // Ensure cookies are sent
        withCredentials: true
      };
      
      // First test the basic diagnostic endpoint to ensure connectivity
      try {
        console.log('Testing basic connectivity with echo endpoint...');
        const echoUrl = `${SERVER_URL}/api/v1/diagnostics/echo`;
        const echoResponse = await axios.get(echoUrl);
        console.log('Echo test successful:', echoResponse.data);
        
        // Now test if we can properly pass authentication data
        console.log('Testing auth headers reception...');
        const headersUrl = `${SERVER_URL}/api/v1/diagnostics/headers`;
        const headersResponse = await axios.get(headersUrl, requestConfig);
        console.log('Headers test successful:', headersResponse.data);
        
        // Test the auth-test endpoint to see which token source is being detected
        console.log('Testing which token source is detected...');
        const authTestUrl = `${SERVER_URL}/api/v1/diagnostics/auth-test`;
        const authTestResponse = await axios.get(authTestUrl, requestConfig);
        console.log('Auth test successful:', authTestResponse.data);
        
        // Finally, verify the token directly with the backend
        console.log('Directly verifying token with backend...');
        const verifyUrl = `${SERVER_URL}/api/v1/diagnostics/verify-token`;
        const verifyResponse = await axios.post(verifyUrl, { token });
        console.log('Token verification result:', verifyResponse.data);
        
        if (verifyResponse.data.success) {
          console.log('Token is valid! Using it to get user data');
          
          // With verified token, now try the actual user endpoint
          const userUrl = `${SERVER_URL}/api/v1/user/me`;
          console.log('Attempting to get user data from:', userUrl);
          const response = await axios.get(userUrl, requestConfig);
          console.log('User data retrieved successfully!');
          
          // If we get here, we have a valid user response
          return response;
        }
      } catch (error) {
        console.error('Diagnostic tests failed:', error.message);
        console.log('Details:', error?.response?.data || 'No response data');
        throw error;
      }
      
      // If we reach here, we couldn't get a valid user response
      console.log('Could not complete authentication verification');
      
      // Try to use cached user data as a fallback
      const cachedUser = tryGetCachedUser();
      if (cachedUser) {
        console.log('Using cached user data as fallback');
        setUser(cachedUser);
        setIsAuthenticated(true);
        return;
      }

      // If no cached data, we have to consider the auth failed
      console.log('No cached user data available, authentication failed');
      setIsAuthenticated(false);
      setUser(null);
      
      // Clear potentially invalid token
      tokenManager.clearToken();
      throw new Error('Authentication verification failed');
    } catch (error) {
      console.error('Error verifying token:', error);
      // Check if error is unauthorized
      if (error.response && error.response.status === 401) {
        // Token is invalid, clear it using tokenManager
        tokenManager.clearToken();
        setIsAuthenticated(false);
        setUser(null);
      } else {
        // For other errors (like network issues), assume token is still valid
        // This prevents logout on temporary network issues
        console.log('Non-auth error occurred, maintaining login state');
        // Ensure we're still using cached user data
        const cachedUser = tryGetCachedUser();
        if (cachedUser) {
          setUser(cachedUser);
          setIsAuthenticated(true);
        }
      }
    }
  };

  // Check authentication status on app load
  useEffect(() => {
    let authTimeout = null;
    
    const checkAuthStatus = async () => {
      try {
        console.log('Starting authentication check...');
        setLoading(true);
        
        // Initialize and synchronize tokens across all storage mechanisms
        tokenManager.initializeTokens();
        
        // Get token using the centralized token manager
        const token = tokenManager.getToken();
        
        // If token exists, ensure it's properly stored in all mechanisms
        if (token) {
          tokenManager.setToken(token);
        }
        console.log('Ensured token is available in all storage mechanisms');
        
        // IMMEDIATELY USE CACHED DATA IF AVAILABLE BEFORE ANY API CALLS
        // This ensures the UI loads without waiting for network
        const cachedUser = tryGetCachedUser();
        if (cachedUser) {
          console.log('User data found in Redux, immediately using cached data');
          setUser(cachedUser);
          setIsAuthenticated(true);
          setLoading(false);
        } else {
          console.log('No cached user data found, will wait for API response');
        }
        
        // Log token status for debugging
        console.log('Using authentication token:', token ? 'Present (Hidden for security)' : 'Not found');
        console.log('Token is being managed by tokenManager');
        
        // Set a timeout to force complete loading if backend verification takes too long
        // This only affects the loading indicator, not the authentication state
        authTimeout = setTimeout(() => {
          console.log('Authentication verification timed out');
          // Ensure loading is complete regardless of verification status
          setLoading(false);
        }, 3000); // 3 seconds is plenty
        
        // Verify token in background even if we already set the user from cache
        verifyTokenInBackground(token);
      } catch (error) {
        console.error('Initial auth check error:', error);
        // In case of any error, fall back to cached data
        const cachedUser = tryGetCachedUser();
        if (cachedUser) {
          setUser(cachedUser);
          setIsAuthenticated(true);
        } else {
          setIsAuthenticated(false);
          setUser(null);
        }
        setLoading(false);
      }
    };
    
    // Call the authentication check function
    checkAuthStatus();
    
    // Cleanup function that runs when component unmounts
    return () => {
      if (authTimeout) {
        clearTimeout(authTimeout);
        console.log('Auth timeout cleared on unmount');
      }
    };
  }, [dispatch]); // Include dispatch in dependencies since it's used in verifyTokenInBackground

  const login = async (credentials) => {
    try {
      setLoading(true);
      console.log('Logging in with API URL:', API_BASE_URL);
      
      const response = await axiosInstance.post('/user/login', credentials);
      console.log('Login response:', response.data);
      
      if (response.data.success) {
        // Store user data
        const userData = {
          ...response.data.user,
          isAdmin: response.data.user.isAdmin || false,
        };
        
        // Save auth token using centralized tokenManager
        if (response.data.token) {
          console.log('Saving auth token using tokenManager');
          const token = response.data.token;
          
          // Store token in all storage mechanisms
          tokenManager.setToken(token);
          
          console.log('Token set successfully using tokenManager');
        }
        
        // Skip showing auth delay messages completely
        setSuppressAuthMessages(true);
        
        // Set a timeout to verify the user's authentication in the background
        setTimeout(() => {
          // Clear the delay message timeout if verification starts before message shows
          clearTimeout(authDelayMessageId);
          verifyTokenInBackground(response.data.token);
        }, 500);
        
        setUser(userData);
        dispatch(setAuthUser(userData));
        setIsAuthenticated(true);
        
        // Redirect to home page or specified redirect
        navigate && navigate('/');
        return true;
      } else {
        console.log('Login failed:', response.data.message);
        return false;
      }
    } catch (error) {
      console.error('Login error:', error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    // Use tokenManager to clear token from all storage mechanisms
    tokenManager.clearToken();
    setIsAuthenticated(false);
    setUser(null);
    
    // Redirect to login page
    navigate && navigate('/login');
  };

  // Context value
  const value = {
    isAuthenticated,
    loading,
    user,
    authMessage: suppressAuthMessages ? "" : authMessage,
    login,
    logout,
    setAuthMessage, // Allow components to clear the message
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
