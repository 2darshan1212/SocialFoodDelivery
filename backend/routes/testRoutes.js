import express from 'express';
const router = express.Router();
import verifyToken from '../middlewares/verifyToken.js';

/**
 * @route   GET /api/public-test
 * @desc    Public test endpoint that doesn't require authentication
 * @access  Public
 */
router.get('/public-test', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Public API endpoint successful',
    timestamp: new Date().toISOString(),
    cookies: req.cookies // Show what cookies are being received
  });
});

/**
 * @route   GET /api/private-test
 * @desc    Protected test endpoint that requires authentication
 * @access  Private
 */
router.get('/private-test', verifyToken, (req, res) => {
  // The verifyToken middleware adds the user object to the request if authenticated
  res.status(200).json({
    success: true,
    message: 'Protected API endpoint successful - you are authenticated',
    user: {
      id: req.user.id,
      email: req.user.email,
      role: req.user.role
    },
    timestamp: new Date().toISOString(),
    authMethod: req.authMethod || 'unknown' // Shows whether auth came from cookie or header
  });
});

/**
 * @route   GET /api/auth-debug
 * @desc    Endpoint to debug authentication issues
 * @access  Public (but shows auth status)
 */
router.get('/auth-debug', (req, res) => {
  // Extract token from various sources
  const headerToken = req.headers.authorization ? 
    req.headers.authorization.split(' ')[1] : null;
  const cookieToken = req.cookies.token || null;
  
  // Check what's being received
  const debugInfo = {
    authenticated: false,
    headerTokenPresent: !!headerToken,
    cookieTokenPresent: !!cookieToken,
    headers: {
      authorization: req.headers.authorization || 'not present',
      cookie: req.headers.cookie || 'not present'
    },
    cookies: req.cookies,
    message: 'Authentication debug information'
  };
  
  res.status(200).json(debugInfo);
});

export default router;
