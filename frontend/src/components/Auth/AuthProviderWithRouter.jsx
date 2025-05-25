import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '../../context/AuthContext';
import AuthLoader from './AuthLoader';

/**
 * Inner component that wraps children with the AuthLoader
 * to handle loading states and prevent infinite loading
 */
const AuthConsumer = ({ children }) => {
  const { loading } = useAuth();
  const [authFailed, setAuthFailed] = useState(false);
  
  // If authentication takes more than 5 seconds, assume there might be issues
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (loading) {
        setAuthFailed(true);
        console.warn('Authentication is taking longer than expected');
      }
    }, 5000);
    
    return () => clearTimeout(timeoutId);
  }, [loading]);
  
  return (
    <AuthLoader loading={loading} authFailed={authFailed}>
      {children}
    </AuthLoader>
  );
};

/**
 * Wrapper component that provides the navigate function to AuthProvider
 * This component must be used inside a Router context
 */
const AuthProviderWithRouter = ({ children }) => {
  const navigate = useNavigate();
  
  return (
    <AuthProvider navigate={navigate}>
      <AuthConsumer>
        {children}
      </AuthConsumer>
    </AuthProvider>
  );
};

export default AuthProviderWithRouter;
