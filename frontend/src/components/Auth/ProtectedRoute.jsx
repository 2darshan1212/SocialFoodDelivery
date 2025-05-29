import React, { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSelector } from 'react-redux';
import tokenManager from '../../utils/tokenManager';

// Loading spinner component
const LoadingSpinner = () => (
  <div className="flex justify-center items-center h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
    <p className="ml-3 text-blue-500">Authenticating...</p>
  </div>
);

/**
 * Protected Route component that handles authentication
 * Redirects to login if user is not authenticated
 */
const ProtectedRoute = ({ redirectPath = '/login' }) => {
  const { isAuthenticated, loading, user } = useAuth();
  const [initialCheck, setInitialCheck] = useState(false);
  const location = useLocation();
  
  // Also check Redux store for authentication state as backup
  const reduxUser = useSelector((state) => state.auth?.user);
  const hasReduxUser = !!reduxUser && !!reduxUser._id;
  
  // Local state for authentication decisions
  const [authDecision, setAuthDecision] = useState({
    isLoading: true,
    isAuthenticated: false
  });
  
  useEffect(() => {
    // Ensure tokens are synchronized across all storage mechanisms
    tokenManager.initializeTokens();
    
    // Get token using the centralized token manager
    const token = tokenManager.getToken();
    
    // Check all authentication sources
    const authenticated = isAuthenticated || hasReduxUser || !!token;
    
    // Log authentication state for debugging
    console.log(`Auth check (${location.pathname})`, {
      contextAuth: isAuthenticated,
      reduxAuth: hasReduxUser, 
      tokenManagerAuth: !!token,
      finalDecision: authenticated
    });
    
    // Update auth decision
    setAuthDecision({
      isLoading: loading && !initialCheck,
      isAuthenticated: authenticated
    });
    
    if (!initialCheck) {
      setInitialCheck(true);
    }
  }, [isAuthenticated, loading, hasReduxUser, initialCheck, location.pathname, tokenManager]);
  
  // Force reinforcement of token on component mount and location changes
  useEffect(() => {
    const token = tokenManager.getToken();
    if (token) {
      // Use tokenManager to ensure token is properly stored in all mechanisms
      tokenManager.setToken(token);
      console.log(`Protected route: Token reinforced via tokenManager (${location.pathname})`);
    }
  }, [location.pathname]);

  // Show loading spinner while checking authentication
  if (authDecision.isLoading) {
    return <LoadingSpinner />;
  }

  // Redirect to login if not authenticated
  if (!authDecision.isAuthenticated) {
    console.log('User not authenticated, redirecting to', redirectPath, 'from', location.pathname);
    // Store the attempted URL for redirect after login
    sessionStorage.setItem('redirectAfterLogin', location.pathname);
    return <Navigate to={redirectPath} replace state={{ from: location }} />;
  }

  // Render the protected route
  return <Outlet />;
};

export default ProtectedRoute;
