import jwt from "jsonwebtoken";
import { User } from "../models/user.model.js";

// Simple in-memory cache for authenticated sessions
const authCache = new Map();

// Cache expiry time (10 minutes)
const CACHE_TTL = 10 * 60 * 1000;

// Periodic cache cleanup
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of authCache.entries()) {
    if (now > value.expiresAt) {
      authCache.delete(key);
    }
  }
}, 60000); // Clean up every minute

/**
 * Authentication middleware that checks for tokens in multiple places
 * This ensures compatibility with both local development and production deployments
 */
const isAuthenticated = async (req, res, next) => {
  try {
    // For logging
    console.log(`Auth request: ${req.method} ${req.originalUrl}`);
    
    // Token extraction
    let token = null;
    let authSource = 'not-found';
    
    // 1. Check if token already exists on request
    if (req.token) {
      token = req.token;
      authSource = 'req-token';
    }
    
    // 2. Check query parameters
    if (!token && req.query._auth) {
      token = req.query._auth;
      authSource = 'query-param';
    }
    
    // 3. Check Authorization header
    if (!token && req.headers.authorization) {
      if (req.headers.authorization.startsWith('Bearer ')) {
        token = req.headers.authorization.split(' ')[1];
        authSource = 'auth-header';
      } else {
        token = req.headers.authorization;
        authSource = 'auth-header-raw';
      }
    }
    
    // 4. Check cookies
    if (!token && req.cookies && req.cookies.token) {
      token = req.cookies.token;
      authSource = 'cookie';
    }

    // Log token source
    console.log(`Auth source: ${authSource}`);
    
    // Proceed with token verification if token exists
    if (token) {
      try {
        // Check cache first
        if (authCache.has(token)) {
          const cachedAuth = authCache.get(token);
          if (Date.now() < cachedAuth.expiresAt) {
            console.log('Using cached authentication');
            req.id = cachedAuth.userId;
            req.user = cachedAuth.user;
            return next();
          }
        }
    
        // Verify the token
        const decoded = jwt.verify(token, process.env.SECRET_KEY);
        req.id = decoded.userId;

        // Get user from database
        const user = await User.findById(decoded.userId).lean().select('-password');
        
        // Cache the result for future requests
        authCache.set(token, {
          userId: decoded.userId,
          user,
          expiresAt: Date.now() + CACHE_TTL
        });
        
        // Check if user exists
        if (!user) {
          console.log('Auth failed: Valid token but user not found');
          return res.status(401).json({
            message: 'User not found',
            success: false
          });
        }
        
        // Check if user is blocked
        if (user.isBlocked) {
          console.log('Auth failed: User is blocked');
          return res.status(403).json({
            message: 'Your account has been blocked',
            success: false
          });
        }
        
        // Set user on request
        req.user = user;
        
        return next();
      } catch (error) {
        console.log('Auth error:', error.message);
        return res.status(401).json({
          message: 'Invalid or expired token',
          success: false
        });
      }
    } else {
      // No token found
      console.log('No authentication token found');
      return res.status(401).json({
        message: 'Authentication required',
        success: false
      });
    }
  } catch (error) {
    console.error('Authentication middleware error:', error);
    return res.status(500).json({
      message: 'Server error during authentication',
      success: false
    });
  }
};

export default isAuthenticated;
