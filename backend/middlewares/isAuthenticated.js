import jwt from "jsonwebtoken";
import { User } from "../models/user.model.js";

/**
 * Helper function to determine where the token was found
 * Useful for debugging authentication issues
 */
/**
 * Enhanced token source detection with improved cross-origin support
 * This function helps identify exactly where the token was found
 * for debugging authentication issues across environments
 */
function getTokenSource(req) {
  // Production origin detection - special handling for cross-origin requests
  const isProdOrigin = req.headers.origin && (
    req.headers.origin.includes('render.com') || 
    req.headers.origin === 'https://socialfooddelivery-2.onrender.com'
  );
  
  // Check in priority order optimized for cross-origin requests
  // 1. Query parameters (highest priority for cross-origin requests)
  if (req.query?._auth) return `query:_auth${isProdOrigin ? ' (production)' : ''}`;
  if (req.query?.token) return `query:token${isProdOrigin ? ' (production)' : ''}`;
  if (req.query?.auth) return `query:auth${isProdOrigin ? ' (production)' : ''}`;
  
  // 2. Direct headers (these work well cross-origin if properly configured)
  if (req.headers?.token) return `header:token${isProdOrigin ? ' (production)' : ''}`;
  if (req.headers?.['auth-token']) return `header:auth-token${isProdOrigin ? ' (production)' : ''}`;
  if (req.headers?.['access-token']) return `header:access-token${isProdOrigin ? ' (production)' : ''}`;
  if (req.headers?.['x-auth-token']) return `header:x-auth-token${isProdOrigin ? ' (production)' : ''}`;
  if (req.headers?.jwt) return `header:jwt${isProdOrigin ? ' (production)' : ''}`;
  
  // 3. Authorization header
  if (req.headers?.authorization?.startsWith('Bearer ')) {
    return `header:authorization${isProdOrigin ? ' (production)' : ''}`;
  }
  
  // 4. Cookies (these typically don't work cross-origin without special configuration)
  if (req.cookies?.token) return `cookie:token${isProdOrigin ? ' (production)' : ''}`;
  if (req.cookies?.auth_token) return `cookie:auth_token${isProdOrigin ? ' (production)' : ''}`;
  if (req.cookies?.jwt) return `cookie:jwt${isProdOrigin ? ' (production)' : ''}`;
  
  // No token found
  return isProdOrigin ? 'not-found (production origin)' : 'not-found';
}

/**
 * Enhanced authentication middleware that checks for tokens in multiple places
 * This ensures compatibility with both local development and production deployments
 */
const isAuthenticated = async (req, res, next) => {
  try {
    // Production origin detection - special handling for cross-origin requests
    const isProdOrigin = req.headers.origin && (
      req.headers.origin.includes('render.com') || 
      req.headers.origin === 'https://socialfooddelivery-2.onrender.com'
    );
    
    if (isProdOrigin) {
      console.log('📱 Production frontend detected - using enhanced token extraction');
    }
    
    // Check for token in multiple places to maximize compatibility
    // The order is optimized based on what works best for cross-origin requests
    const token = 
      // 1. Query parameters (highest priority especially for cross-origin)
      req.query._auth ||
      req.query.token ||
      req.query.auth ||
      
      // 2. All possible header formats (many production frontends use these)
      req.headers.token ||
      req.headers["auth-token"] ||
      req.headers["access-token"] ||
      req.headers["x-auth-token"] ||
      req.headers.jwt ||
      
      // 3. Authorization header (Bearer token format)
      (req.headers.authorization && req.headers.authorization.startsWith('Bearer ') 
        ? req.headers.authorization.split(' ')[1] : null) ||
      
      // 4. Cookies (may not work in cross-origin requests without special config)
      req.cookies?.token || 
      req.cookies?.auth_token ||
      req.cookies?.jwt;
      
    // Log detailed information about the request for debugging
    console.log('Authentication request details:');
    console.log('- URL:', req.originalUrl);
    console.log('- Method:', req.method);
    console.log('- Origin:', req.headers.origin);
    console.log('- Has query parameters:', Object.keys(req.query).length > 0 ? 'Yes' : 'No');
    console.log('- Query keys:', Object.keys(req.query).join(', '));
    
    // Log token source for debugging
    console.log(`Auth source: ${getTokenSource(req)}`);
    
    if (!token) {
      console.log('Authentication failed: No token found in request');
      console.log('Request headers:', JSON.stringify(req.headers));
      console.log('Request cookies:', req.cookies ? JSON.stringify(req.cookies) : 'No cookies');
      
      return res.status(401).json({
        message: "User Not Authenticated",
        success: false,
      });
    }
    
    // Verify the token using the correct secret key
    // Try both SECRET_KEY and JWT_SECRET for backward compatibility
    let decode;
    try {
      decode = jwt.verify(token, process.env.SECRET_KEY || process.env.JWT_SECRET);
    } catch (verifyError) {
      console.log('Token verification failed:', verifyError.message);
      return res.status(401).json({
        message: "Invalid Token",
        success: false,
      });
    }
    
    if (!decode) {
      return res.status(401).json({
        message: "Invalid Token",
        success: false,
      });
    }
    
    // Store the user ID in req.id for backward compatibility
    req.id = decode.userId;
    
    // Also fetch user to get admin status
    const user = await User.findById(decode.userId);
    if (!user) {
      return res.status(404).json({
        message: "User Not Found",
        success: false,
      });
    }
    
    // Add user object with admin status (like verifyToken does)
    req.user = {
      id: user._id,
      username: user.username,
      email: user.email,
      isAdmin: user.isAdmin || false
    };
    
    next();
  } catch (error) {
    console.error("Authentication error:", error);
    return res.status(401).json({
      message: "Authentication Failed",
      success: false,
      error: error.message
    });
  }
};

export default isAuthenticated;
