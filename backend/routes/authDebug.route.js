import express from 'express';
const router = express.Router();
import { verifyToken } from '../middlewares/verifyToken.js';

/**
 * @route   GET /api/v1/auth-debug/status
 * @desc    Returns detailed information about the current authentication state
 * @access  Public
 */
router.get('/status', (req, res) => {
  // Extract token from various sources
  const headerAuth = req.headers.authorization || 'not present';
  const tokenFromHeader = headerAuth.startsWith('Bearer ') ? headerAuth.substring(7) : null;
  const tokenFromCookie = req.cookies.token || null;
  
  // Check what's being received
  const debugInfo = {
    success: true,
    authenticated: false,
    message: 'Authentication debug information',
    tokens: {
      headerToken: {
        present: !!tokenFromHeader,
        value: tokenFromHeader ? `${tokenFromHeader.substring(0, 10)}...` : null 
      },
      cookieToken: {
        present: !!tokenFromCookie,
        value: tokenFromCookie ? `${tokenFromCookie.substring(0, 10)}...` : null
      }
    },
    headers: {
      authorization: req.headers.authorization || 'not present',
      cookie: req.headers.cookie || 'not present'
    },
    cookies: req.cookies,
    timestamp: new Date().toISOString()
  };
  
  res.status(200).json(debugInfo);
});

/**
 * @route   GET /api/v1/auth-debug/protected
 * @desc    Protected endpoint to test authentication
 * @access  Private
 */
router.get('/protected', verifyToken, (req, res) => {
  res.status(200).json({
    success: true,
    message: 'You are authenticated!',
    user: req.user,
    timestamp: new Date().toISOString()
  });
});

/**
 * @route   GET /api/v1/auth-debug/token-source
 * @desc    Endpoint that shows which token source is being used
 * @access  Public
 */
router.get('/token-source', (req, res) => {
  // Extract token from various sources
  const headerAuth = req.headers.authorization || '';
  const tokenFromHeader = headerAuth.startsWith('Bearer ') ? headerAuth.substring(7) : null;
  const tokenFromCookie = req.cookies.token || null;
  
  let tokenSource = 'none';
  let token = null;
  
  if (tokenFromCookie) {
    tokenSource = 'cookie';
    token = tokenFromCookie;
  } else if (tokenFromHeader) {
    tokenSource = 'header';
    token = tokenFromHeader;
  }
  
  res.status(200).json({
    success: true,
    tokenSource,
    tokenPresent: !!token,
    tokenPreview: token ? `${token.substring(0, 10)}...` : null,
    timestamp: new Date().toISOString()
  });
});

export default router;
