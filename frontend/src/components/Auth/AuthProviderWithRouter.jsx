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
  
  // Disable authentication delay warnings completely
  useEffect(() => {
    // No timeouts - this prevents the auth delay message
    return () => {};
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
