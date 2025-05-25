import React, { createContext, useContext, useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import axiosInstance from '../utils/axiosInstance';
import { API_BASE_URL } from '../utils/apiConfig';
import { setAuthUser } from '../redux/authSlice';
import { toast } from 'react-toastify';

// Create context
const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children, navigate }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
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
      const response = await axiosInstance.get('/user/me');
      
      if (response.data && response.data.success) {
        console.log('Token is valid, user is authenticated');
        // Store user data in context and Redux
        setUser(response.data.user);
        dispatch(setAuthUser({
          ...response.data.user,
          isAdmin: response.data.user.isAdmin || false,
        }));
        setIsAuthenticated(true);
      } else {
        console.log('Invalid token response', response.data);
        setIsAuthenticated(false);
        setUser(null);
        // Clear invalid token
        localStorage.removeItem('token');
        document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      }
    } catch (error) {
      console.error('Error verifying token:', error);
      // Check if error is unauthorized
      if (error.response && error.response.status === 401) {
        // Token is invalid, clear it
        localStorage.removeItem('token');
        document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
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
        
        // First, check for token
        const token = localStorage.getItem('token');
        
        if (!token) {
          console.log('No token found, user is not authenticated');
          setIsAuthenticated(false);
          setUser(null);
          setLoading(false);
          return;
        }
        
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
        
        // Set the auth cookie regardless
        if (window.location.protocol === 'https:') {
          document.cookie = `token=${token}; path=/; SameSite=None; Secure`;
        } else {
          // For development on HTTP
          document.cookie = `token=${token}; path=/; SameSite=Lax; max-age=86400`;
        }
        console.log('Set auth cookie from localStorage token');
        
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
        
        // Save auth token
        if (response.data.token) {
          console.log('Saving auth token to localStorage and cookies');
          const token = response.data.token;
          
          // Store in localStorage for frontend use
          localStorage.setItem('token', token);
          
          // Set cookie for backend authentication
          if (window.location.protocol === 'https:') {
            document.cookie = `token=${token}; path=/; SameSite=None; Secure`;
          } else {
            // For development on HTTP
            document.cookie = `token=${token}; path=/; SameSite=Lax; max-age=86400`;
          }
          
          console.log('Set cookies:', document.cookie);
        }
        
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
    localStorage.removeItem('token');
    document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
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
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
