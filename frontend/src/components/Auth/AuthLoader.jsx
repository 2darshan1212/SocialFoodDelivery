import React, { useEffect, useState } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';

/**
 * A component that handles authentication loading state
 * with a fail-safe mechanism to prevent infinite loading
 */
const AuthLoader = ({ children, loading, authFailed }) => {
  const [showChildren, setShowChildren] = useState(false);
  const [showTimeoutMessage, setShowTimeoutMessage] = useState(false);

  // Force show content after 3 seconds even if loading is true
  useEffect(() => {
    // If not loading, show content immediately
    if (!loading) {
      setShowChildren(true);
      return;
    }

    // If loading, set a timeout to force show content after 3 seconds
    const forceShowTimeout = setTimeout(() => {
      console.log('Force showing content due to loading timeout');
      setShowChildren(true);
    }, 3000);

    // Cleanup timeout
    return () => clearTimeout(forceShowTimeout);
  }, [loading]);

  useEffect(() => {
    // No timeout messages will be shown
    return () => {};
  }, [loading]);

  // If we're showing children (either normally or forced), return them without any delay messages
  if (showChildren) {
    return children;
  }

  // Standard loading state - will only show for max 3 seconds
  return (
    <Box
      display="flex"
      flexDirection="column"
      justifyContent="center"
      alignItems="center"
      height="100vh"
    >
      <CircularProgress size={60} thickness={4} />
      <Typography variant="h6" sx={{ mt: 2 }}>
        Authenticating...
      </Typography>
      <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
        {authFailed ? 'Having trouble connecting to the server' : 'Please wait a moment'}
      </Typography>
    </Box>
  );
};

export default AuthLoader;
