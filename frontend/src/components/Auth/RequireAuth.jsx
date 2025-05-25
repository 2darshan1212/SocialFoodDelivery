import React, { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { Navigate, useLocation } from 'react-router-dom';

// Component to redirect unauthenticated users to signup
const RequireAuth = ({ children }) => {
  const { user } = useSelector((store) => store.auth);
  const location = useLocation();

  // Check if the user has visited before using localStorage
  const hasVisitedBefore = localStorage.getItem('hasVisitedBefore') === 'true';

  useEffect(() => {
    // Mark that the user has visited before
    if (!hasVisitedBefore) {
      localStorage.setItem('hasVisitedBefore', 'true');
    }
  }, [hasVisitedBefore]);

  // If the user is authenticated, render the children
  if (user) {
    return children;
  }

  // If not authenticated and hasn't visited before, redirect to signup
  if (!hasVisitedBefore) {
    return <Navigate to="/signup" state={{ from: location }} replace />;
  }

  // If they've visited before but not logged in, redirect to login
  return <Navigate to="/login" state={{ from: location }} replace />;
};

export default RequireAuth;
