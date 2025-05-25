import React, { useState, useEffect } from "react";
import axios from "axios";
import { API_BASE_URL } from "../utils/apiConfig";
import axiosInstance from "../utils/axiosInstance";
import { useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { setAuthUser } from "../redux/authSlice";

const LoginTest = () => {
  const [credentials, setCredentials] = useState({
    email: "",
    password: "",
  });
  const [status, setStatus] = useState({
    message: "",
    type: "", // success, error, info
  });
  const [authInfo, setAuthInfo] = useState({
    token: null,
    cookies: null,
    isLoggedIn: false,
  });
  
  const navigate = useNavigate();
  const dispatch = useDispatch();

  // Check current authentication status on load
  useEffect(() => {
    // Check for token in localStorage
    const token = localStorage.getItem("token");
    
    // Check for cookies
    const cookies = document.cookie
      .split(';')
      .map(cookie => cookie.trim())
      .filter(cookie => cookie.startsWith('token='))
      .map(cookie => cookie.substring(6));
    
    setAuthInfo({
      token: token ? `${token.substring(0, 10)}...` : "None",
      cookies: cookies.length > 0 ? `${cookies[0].substring(0, 10)}...` : "None",
      isLoggedIn: !!(token || cookies.length > 0)
    });
  }, [status]);

  const handleChange = (e) => {
    setCredentials({
      ...credentials,
      [e.target.name]: e.target.value
    });
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setStatus({ message: "Logging in...", type: "info" });
    
    try {
      // Use our configured axios instance
      const response = await axiosInstance.post(
        "/user/login",
        credentials
      );
      
      console.log("Login response:", response.data);
      
      if (response.data.success) {
        // Store user data in Redux state
        const userData = {
          ...response.data.user,
          isAdmin: response.data.user.isAdmin || false,
        };
        
        // Save auth token to localStorage and cookies if it exists in the response
        if (response.data.token) {
          console.log('Saving auth token to localStorage and cookies');
          const token = response.data.token;
          
          // Store in localStorage for frontend use
          localStorage.setItem('token', token);
          
          // Set cookie for backend authentication
          // Use different cookie settings based on protocol
          if (window.location.protocol === 'https:') {
            document.cookie = `token=${token}; path=/; SameSite=None; Secure`;
          } else {
            // For development on HTTP (not HTTPS)
            document.cookie = `token=${token}; path=/; SameSite=Lax; max-age=86400`;
          }
          
          // Log the set cookie for debugging
          console.log('Set cookies:', document.cookie);
        } else {
          console.warn('No token received in login response');
        }
        
        // Update Redux state
        dispatch(setAuthUser(userData));
        
        setStatus({
          message: `Login successful! User: ${userData.username || userData.email}`,
          type: "success"
        });
      } else {
        setStatus({
          message: response.data.message || "Login failed with unknown error",
          type: "error"
        });
      }
    } catch (error) {
      console.error("Login error:", error);
      setStatus({
        message: error.response?.data?.message || error.message || "Login failed",
        type: "error"
      });
    }
  };

  const handleTestAuth = async () => {
    setStatus({ message: "Testing authentication...", type: "info" });
    
    try {
      // Try to access a protected endpoint
      const response = await axiosInstance.get("/user/me");
      
      setStatus({
        message: `Auth test successful! User: ${response.data.user?.username || response.data.user?.email}`,
        type: "success"
      });
    } catch (error) {
      console.error("Auth test error:", error);
      setStatus({
        message: error.response?.data?.message || error.message || "Authentication test failed",
        type: "error"
      });
    }
  };

  const handleLogout = () => {
    // Clear token from localStorage
    localStorage.removeItem("token");
    
    // Clear token cookie
    document.cookie = "token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    
    // Clear Redux state (you might need to implement this action)
    dispatch({ type: 'auth/logout' });
    
    setStatus({
      message: "Logged out successfully",
      type: "success"
    });
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold text-center mb-6">Authentication Test</h1>
        
        <div className="mb-6 p-4 bg-gray-50 rounded">
          <h2 className="text-lg font-medium mb-2">Current Auth Status:</h2>
          <p><strong>Token in localStorage:</strong> {authInfo.token}</p>
          <p><strong>Token in cookies:</strong> {authInfo.cookies}</p>
          <p><strong>Status:</strong> {authInfo.isLoggedIn ? "Logged In" : "Not Logged In"}</p>
          <p><strong>API URL:</strong> {API_BASE_URL}</p>
        </div>
        
        <form onSubmit={handleLogin} className="mb-6">
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Email
            </label>
            <input
              type="email"
              name="email"
              value={credentials.email}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          
          <div className="mb-6">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Password
            </label>
            <input
              type="password"
              name="password"
              value={credentials.password}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          
          <div className="flex gap-2">
            <button
              type="submit"
              className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Login
            </button>
            
            <button
              type="button"
              onClick={handleTestAuth}
              className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              Test Auth
            </button>
            
            <button
              type="button"
              onClick={handleLogout}
              className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              Logout
            </button>
          </div>
        </form>
        
        {status.message && (
          <div
            className={`p-4 rounded mb-4 ${
              status.type === "success"
                ? "bg-green-100 text-green-800"
                : status.type === "error"
                ? "bg-red-100 text-red-800"
                : "bg-blue-100 text-blue-800"
            }`}
          >
            {status.message}
          </div>
        )}
        
        <div className="text-center mt-4">
          <button
            onClick={() => navigate("/")}
            className="text-blue-500 hover:text-blue-700"
          >
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginTest;
