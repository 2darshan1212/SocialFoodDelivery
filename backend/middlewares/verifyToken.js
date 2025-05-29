import jwt from "jsonwebtoken";
import createError from "../utils/error.js";
import { User } from "../models/user.model.js";

export const verifyToken = async (req, res, next) => {
  try {
    // Extract token from all possible sources with detailed logging
    const possibleTokenSources = [
      { source: 'cookie-token', value: req.cookies?.token },
      { source: 'cookie-auth_token', value: req.cookies?.auth_token },
      { source: 'cookie-jwt', value: req.cookies?.jwt },
      { source: 'header-authorization', value: req.headers?.authorization?.startsWith('Bearer ') ? req.headers.authorization.substring(7) : null },
      { source: 'header-x-auth-token', value: req.headers?.['x-auth-token'] },
      { source: 'header-access-token', value: req.headers?.['access-token'] },
      { source: 'header-token', value: req.headers?.token },
      { source: 'query-param', value: req.query?._auth },
      { source: 'body-token', value: req.body?.token }
    ];
    
    // Find the first valid token
    let token = null;
    let tokenSource = null;
    
    for (const source of possibleTokenSources) {
      if (source.value && typeof source.value === 'string' && source.value.length > 20) {
        token = source.value;
        tokenSource = source.source;
        break;
      }
    }
    
    // Log token source for debugging
    if (token) {
      console.log(`Token found in: ${tokenSource}`);
    } else {
      console.log("No valid token found in any source");
      return res.status(401).json({ 
        success: false, 
        message: "You are not authenticated. Please log in."
      });
    }
    
    // Try multiple possible secret keys for verification
    const possibleSecrets = [
      process.env.SECRET_KEY,
      process.env.JWT_SECRET,
      process.env.COOKIE_SECRET,
      'food-delivery-secret' // Fallback secret
    ].filter(Boolean); // Filter out undefined values
    
    // Verify token with each secret until one works
    let decoded = null;
    let verificationError = null;
    
    for (const secret of possibleSecrets) {
      try {
        decoded = jwt.verify(token, secret);
        console.log('Token verified successfully');
        break;
      } catch (err) {
        verificationError = err;
        // Continue to the next secret
      }
    }
    
    // If token verification failed with all secrets
    if (!decoded) {
      console.error("Token verification failed with all secrets:", verificationError);
      
      // Attempt to refresh the token automatically
      return res.status(401).json({
        success: false,
        message: "Token expired or invalid. Please log in again.",
        tokenExpired: true
      });
    }
    
    // Extract user ID from the decoded token
    const userId = decoded.userId || decoded.id || decoded.sub;
    
    if (!userId) {
      console.error("No user ID found in token");
      return res.status(401).json({
        success: false,
        message: "Invalid token format"
      });
    }
    
    // Find the user by ID
    const user = await User.findById(userId);
    if (!user) {
      console.log(`User not found for ID: ${userId}`);
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }
    
    console.log(`Authenticated user: ${user.username} (${user._id})`);
    
    // Refresh the token if it's close to expiry (optional)
    const tokenExp = decoded.exp;
    const currentTime = Math.floor(Date.now() / 1000);
    const timeUntilExpiry = tokenExp - currentTime;
    
    // If token is about to expire in less than 1 hour, issue a new one
    if (timeUntilExpiry < 3600) {
      console.log("Token close to expiry, refreshing...");
      const newToken = jwt.sign({ userId: user._id }, process.env.SECRET_KEY, { expiresIn: "1d" });
      
      // Set the new token in cookie
      const isProduction = process.env.NODE_ENV === 'production';
      res.cookie("token", newToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'none' : 'lax',
        maxAge: 24 * 60 * 60 * 1000, // 1 day
        path: '/'
      });
    }
    
    // Add user info to request object
    req.user = {
      id: user._id,
      username: user.username,
      email: user.email,
      isAdmin: user.isAdmin || false
    };
    
    next();
  } catch (error) {
    console.error("Token verification error:", error.message);
    return res.status(401).json({
      success: false,
      message: "Authentication failed. Please log in again."
    });
  }
}; 