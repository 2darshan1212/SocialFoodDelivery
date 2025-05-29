import express from 'express';
import jwt from 'jsonwebtoken';
const router = express.Router();

/**
 * Special diagnostic endpoint for authentication debugging
 * This will help determine why the frontend is having trouble accessing protected routes
 */

// Simple echo endpoint
router.get('/echo', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Echo endpoint is working',
    timestamp: new Date().toISOString()
  });
});

// Show all received headers
router.get('/headers', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Headers received',
    headers: req.headers,
    timestamp: new Date().toISOString()
  });
});

// Test token verification directly
router.post('/verify-token', (req, res) => {
  const { token } = req.body;
  
  if (!token) {
    return res.status(400).json({
      success: false,
      message: 'No token provided'
    });
  }
  
  try {
    // Verify the token
    const decoded = jwt.verify(token, process.env.SECRET_KEY);
    
    return res.status(200).json({
      success: true,
      message: 'Token is valid',
      decoded,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid token',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Echo back authentication data
router.get('/auth-test', (req, res) => {
  // Extract token from various sources
  const headerAuth = req.headers.authorization || '';
  const tokenFromHeader = headerAuth.startsWith('Bearer ') ? headerAuth.substring(7) : null;
  const tokenFromCookie = req.cookies?.token || null;
  const tokenFromQuery = req.query?._auth || null;
  
  // Check for token in other custom headers
  const xAuthToken = req.headers['x-auth-token'] || null;
  const customToken = req.headers['token'] || null;
  
  return res.status(200).json({
    success: true,
    message: 'Authentication test',
    auth: {
      headerToken: tokenFromHeader ? `${tokenFromHeader.substring(0, 10)}...` : null,
      cookieToken: tokenFromCookie ? `${tokenFromCookie.substring(0, 10)}...` : null,
      queryToken: tokenFromQuery ? `${tokenFromQuery.substring(0, 10)}...` : null,
      xAuthToken: xAuthToken ? `${xAuthToken.substring(0, 10)}...` : null,
      customToken: customToken ? `${customToken.substring(0, 10)}...` : null
    },
    timestamp: new Date().toISOString()
  });
});

export default router;
