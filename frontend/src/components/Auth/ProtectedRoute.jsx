import React, { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSelector } from 'react-redux';

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
  
  // Also check Redux store for authentication state as backup
  const reduxUser = useSelector((state) => state.auth?.user);
  const hasReduxUser = !!reduxUser && !!reduxUser._id;
  
  // Local state for authentication decisions
  const [authDecision, setAuthDecision] = useState({
    isLoading: true,
    isAuthenticated: false
  });
  
  useEffect(() => {
    // First check if we have a token
    const token = localStorage.getItem('token');
    
    // Combine authentication sources: context auth state or Redux user or token existence
    const authenticated = isAuthenticated || hasReduxUser || !!token;
    
    // If we have initial data, update the decision
    if (!initialCheck || !authDecision.isLoading) {
      setAuthDecision({
        isLoading: loading && !initialCheck,
        isAuthenticated: authenticated
      });
      
      if (!initialCheck) {
        setInitialCheck(true);
      }
    }
  }, [isAuthenticated, loading, hasReduxUser, initialCheck]);
  
  // Force set token in cookie on component mount
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      // Set cookie based on environment
      if (window.location.protocol === 'https:') {
        document.cookie = `token=${token}; path=/; SameSite=None; Secure`;
      } else {
        // For development on HTTP
        document.cookie = `token=${token}; path=/; SameSite=Lax; max-age=86400`;
      }
      console.log('Protected route: Ensured token cookie is set');
    }
  }, []);

  // Show loading spinner while checking authentication
  if (authDecision.isLoading) {
    return <LoadingSpinner />;
  }

  // Redirect to login if not authenticated
  if (!authDecision.isAuthenticated) {
    console.log('User not authenticated, redirecting to', redirectPath);
    return <Navigate to={redirectPath} replace />;
  }

  // Render the protected route
  return <Outlet />;
};

export default ProtectedRoute;
