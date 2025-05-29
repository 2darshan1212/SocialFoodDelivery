import jwt from "jsonwebtoken";
import { User } from "../models/user.model.js";
import generateToken from "../utils/generateToken.js";

/**
 * Refresh token controller
 * This endpoint verifies an existing token and issues a new one if valid
 * Helps solve 401 unauthorized errors in production by providing a way to refresh tokens
 */
export const refreshToken = async (req, res) => {
  try {
    // Get token from cookies, headers, or request body
    const token = 
      req.cookies.token || 
      req.cookies.auth_token || 
      req.headers.authorization?.split(" ")[1] || 
      req.headers["x-auth-token"] ||
      req.body.token;

    if (!token) {
      return res.status(401).json({
        message: "No token provided for refresh",
        success: false
      });
    }

    // Verify the token with multiple possible secret keys for robustness
    let decoded;
    try {
      // Try different possible secret keys that might have been used
      // This helps with environments where the key name might have changed
      const possibleSecrets = [
        process.env.JWT_SECRET,
        process.env.SECRET_KEY,
        process.env.COOKIE_SECRET
      ].filter(Boolean); // Filter out undefined secrets
      
      // Try each secret until one works
      let verificationError;
      for (const secret of possibleSecrets) {
        try {
          decoded = jwt.verify(token, secret);
          console.log('Token verified successfully with secret key');
          break; // Successfully verified, exit the loop
        } catch (err) {
          verificationError = err;
          // Continue to the next secret
        }
      }
      
      // If we still don't have a decoded token, throw the last error
      if (!decoded) {
        throw verificationError || new Error('Failed to verify token with all available secrets');
      }
    } catch (error) {
      console.error("Token verification failed:", error);
      return res.status(401).json({
        message: "Invalid or expired token",
        success: false
      });
    }

    // Find the user
    const user = await User.findById(decoded.id).select("-password");
    if (!user) {
      return res.status(404).json({
        message: "User not found",
        success: false
      });
    }

    // Generate a new token
    const newToken = generateToken(user._id);

    // Configure cookie options based on environment
    const isProduction = process.env.NODE_ENV === 'production';
    
    // Set proper cookie settings for cross-domain support in production
    // Match the same cookie settings used in the login function for consistency
    const cookieOptions = {
      httpOnly: true,
      secure: isProduction, // Only use secure in production
      sameSite: isProduction ? 'none' : 'lax', // 'none' allows cross-site cookies in production
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days expiration to match login function
      path: '/' // Ensure cookie is available throughout the site
    };
    
    // Set the cookie
    res.cookie("token", newToken, cookieOptions);
    
    // Log successful token refresh
    console.log('Token refreshed successfully');

    // Return the new token and user info
    return res.status(200).json({
      message: "Token refreshed successfully",
      success: true,
      token: newToken,
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        profilePic: user.profilePic,
        isAdmin: user.isAdmin || false,
        followers: user.followers,
        following: user.following
      }
    });
  } catch (error) {
    console.error("Error refreshing token:", error);
    return res.status(500).json({
      message: "Server error while refreshing token",
      success: false
    });
  }
};
