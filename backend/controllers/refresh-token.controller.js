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

    // Verify the token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
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

    // Set the token in cookies for cross-environment compatibility
    // Set both secure and non-secure cookies to handle different environments
    res.cookie("token", newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    });

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
