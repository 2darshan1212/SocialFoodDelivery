import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useDispatch } from "react-redux";
import { bindActionCreators } from "redux";
import * as actions from "../../redux/authSlice";
import { API_BASE_URL, SERVER_URL } from "../../utils/apiConfig";
import axiosInstance from "../../utils/axiosInstance";
import tokenManager from "../../utils/tokenManager";
import { useAuth } from "../../context/AuthContext";

const Login = () => {
  // State for form inputs
  const [input, setInput] = useState({
    email: "",
    password: "",
  });
  
  // Get auth context values
  const { login, authMessage: authContextMessage, setAuthMessage: setAuthContextMessage } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  
  // UI states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showAuthMessage, setShowAuthMessage] = useState(false);
  const [authMessage, setAuthMessage] = useState("");
  const [disableAuthMessages] = useState(true); // Disabled by default
  
  // Create memoized action creators
  const loginUser = useMemo(() => bindActionCreators(actions.loginUser, dispatch), [dispatch]);
  
  // Clear any auth messages when component mounts
  useEffect(() => {
    setAuthMessage('');
    return () => setAuthMessage('');
  }, [setAuthMessage]);
  
  // Show auth message when it becomes available
  useEffect(() => {
    if (authMessage) {
      setShowAuthMessage(true);
    } else {
      setShowAuthMessage(false);
    }
  }, [authMessage]);

  // Check if there's a redirect path in location state or session storage
  const [redirectPath, setRedirectPath] = useState("/");

  // Initialize redirect path from location state or session storage
  useEffect(() => {
    // First check location state (from react-router)
    const fromPath = location.state?.from?.pathname;
    
    // Then check session storage (from ProtectedRoute)
    const sessionRedirect = sessionStorage.getItem('redirectAfterLogin');
    
    // Use the first available redirect path
    const redirectTo = fromPath || sessionRedirect || "/";
    console.log("Login will redirect to:", redirectTo);
    setRedirectPath(redirectTo);
  }, [location]);

  const changeEventHandler = (e) => {
    setInput({ ...input, [e.target.name]: e.target.value });
  };
  
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setShowAuthMessage(false);
    setAuthMessage('');

    try {
      if (!input.email || !input.password) {
        toast.error('Email and password are required');
        setLoading(false);
        return;
      }

      console.log('Login credentials:', { email: input.email, rememberMe: input.rememberMe });
      
      // Using the exact format expected by your backend login controller
      const credentials = {
        email: input.email,
        password: input.password
      };

      console.log('Attempting login with exact endpoint and structure expected by backend');
      
      // CRITICAL FIX: Try all possible API routes to find the working one
      let response;
      let loginSuccessful = false;
      let loginError = null;
      
      // Try all possible endpoints in sequence
      const endpoints = [
        `${SERVER_URL}/api/v1/user/login`,  // Standard API path
        `${SERVER_URL}/login`,              // Root login path
        `${API_BASE_URL}/user/login`,       // Using API_BASE_URL that includes /api/v1
        'http://localhost:8000/api/v1/user/login',  // Hardcoded localhost
        'http://localhost:8000/login'       // Hardcoded localhost root login
      ];
      
      for (let i = 0; i < endpoints.length; i++) {
        try {
          console.log(`Trying login endpoint ${i+1}:`, endpoints[i]);
          response = await axios.post(
            endpoints[i],
            credentials,
            { withCredentials: true }
          );
          console.log(`Endpoint ${i+1} successful!`);
          loginSuccessful = true;
          break;
        } catch (error) {
          console.log(`Endpoint ${i+1} failed:`, error.message);
          loginError = error;
          // Continue to next endpoint
        }
      }
      
      if (!loginSuccessful) {
        // If all endpoints failed, throw the last error
        console.error('All login endpoints failed');
        throw loginError || new Error('Login failed - all endpoints returned errors');
      }
      
      console.log('Login response received:', response.data);

      // If we get here, the login was successful
      if (response.data.success) {
        console.log('Login successful via direct axios call');
        const userData = response.data.user;
        
        // Store token securely using tokenManager with explicit debugging
        if (response.data.token) {
          const token = response.data.token;
          console.log('Received token from backend:', token.substring(0, 10) + '...');
          
          // CRITICAL: Explicitly save token in all storage mechanisms for maximum reliability
          try {
            // 1. Direct localStorage and sessionStorage access
            localStorage.setItem('token', token);
            console.log('Token saved to localStorage');
            
            sessionStorage.setItem('token', token);
            console.log('Token saved to sessionStorage');
            
            // 2. Set cookie directly with very permissive settings
            document.cookie = `token=${token}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`;
            console.log('Token saved to cookies');
            
            // 3. Store in global variable for immediate use
            window._authToken = token;
            
            // 4. Update axiosInstance authorization headers
            axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${token}`;
            console.log('Token set in axiosInstance headers');
            
            // 5. Use tokenManager for complete storage
            await tokenManager.storeToken(token, input.rememberMe);
            console.log('Token saved through tokenManager');
            
            // 6. CRITICAL FIX: Verify token works by making a direct request to the auth debug endpoint
            try {
              console.log('Verifying token works with auth-debug endpoint...');
              const authDebugUrl = `${SERVER_URL}/api/v1/auth-debug/status`;
              console.log('Auth debug URL:', authDebugUrl);
              
              // Create a config with all token formats
              const authConfig = {
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'x-auth-token': token
                },
                withCredentials: true
              };
              
              const debugResponse = await axios.get(authDebugUrl, authConfig);
              console.log('Auth debug response:', debugResponse.data);
              
              // Now try the protected endpoint
              const protectedResponse = await axios.get(`${SERVER_URL}/api/v1/auth-debug/protected`, authConfig);
              console.log('Protected endpoint response:', protectedResponse.data);
              
              if (protectedResponse.data.success) {
                console.log('TOKEN VERIFICATION SUCCESSFUL!');
              }
            } catch (debugError) {
              console.error('Debug verification failed:', debugError.message);
            }
            
            // 6. Verify all storage mechanisms
            const verifyLocalStorage = localStorage.getItem('token');
            const verifySessionStorage = sessionStorage.getItem('token');
            const verifyAxiosHeaders = axiosInstance.defaults.headers.common['Authorization'];
            
            console.log('STORAGE VERIFICATION:', {
              localStorage: verifyLocalStorage ? 'PRESENT' : 'MISSING',
              sessionStorage: verifySessionStorage ? 'PRESENT' : 'MISSING',
              axiosHeaders: verifyAxiosHeaders ? 'PRESENT' : 'MISSING',
              cookieExists: document.cookie.includes('token=') ? 'PRESENT' : 'MISSING'
            });
            
            console.log('STORAGE VERIFICATION:', {
              localStorage: localStorage.getItem('token') ? 'PRESENT' : 'MISSING',
              sessionStorage: sessionStorage.getItem('token') ? 'PRESENT' : 'MISSING',
              cookie: document.cookie.includes('token=') ? 'PRESENT' : 'MISSING'
            });
          } catch (storageError) {
            console.error('Storage error:', storageError);
          }
          
          // Force re-initialization of axios instance to ensure it picks up the token
          axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          axiosInstance.defaults.headers.common['x-auth-token'] = token;
          
          // Make an immediate validation request
          setTimeout(() => {
            console.log('Making validation request with token:', token.substring(0, 10) + '...');
            // Add query parameter token for maximum compatibility
            axiosInstance.get('/user/me?_auth=' + token)
              .then(response => {
                console.log('Token validation successful:', response.status);
              })
              .catch(err => {
                console.error('Token validation failed:', err.message);
                // Try with direct fetch as fallback
                fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/user/me?_auth=${token}`, {
                  headers: {
                    'Authorization': `Bearer ${token}`,
                    'x-auth-token': token
                  },
                  credentials: 'include'
                }).then(res => console.log('Fetch validation status:', res.status))
                  .catch(fetchErr => console.error('Fetch validation failed:', fetchErr));
              });
          }, 500);
        } else {
          console.error('CRITICAL: No token received from login response');
        }
        
        // Clear redirect info from session storage
        sessionStorage.removeItem('redirectAfterLogin');
        
        // Navigate based on role and saved redirect path
        if (userData.isAdmin && redirectPath.includes("/admin")) {
          navigate("/admin/dashboard");
        } else if (redirectPath && redirectPath !== "/login") {
          console.log(`Redirecting to original destination: ${redirectPath}`);
          navigate(redirectPath);
        } else {
          navigate("/");
        }
        
        toast.success('Login successful');
        setInput({
          email: "",
          password: "",
        });
      } else {
        // Handle unexpected response format
        console.error('Login returned unexpected format:', response.data);
        setError('Login failed: Unexpected server response');
        toast.error('Login failed: Unexpected server response');
      }
    } catch (err) {
      console.error('Login error:', err);
      // Provide a more specific error message based on the error
      const errorMessage = err.response?.data?.message || 
                          err.message || 
                          'Network error. Please check your internet connection.';
      
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center w-screen h-screen justify-center">
      {/* Auth message toast - completely disabled */}
      {false && showAuthMessage && authMessage && (
        <div className="auth-message fixed top-4 right-4 z-50 max-w-md">
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 flex items-center shadow-md rounded">
            <div className="mr-3">
              <svg className="animate-spin h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
            <div className="text-blue-700 text-sm">{authMessage}</div>
          </div>
        </div>
      )}
      
      <form
        onSubmit={handleLogin}
        className="shadow-lg flex flex-col gap-5 p-8 rounded-lg bg-white w-full max-w-md"
      >
        <div className="mb-6">
          <h1 className="text-center font-bold text-2xl text-blue-600">Social Food Delivery</h1>
          <p className="text-sm text-center text-gray-600 mt-2">Login to your account</p>
        </div>
        
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4 text-red-700 text-sm">
            {error}
          </div>
        )}
        <div>
          <div className="text-blue-700 mb-1">Email</div>
          <input
            type="email"
            name="email"
            value={input.email}
            onChange={changeEventHandler}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
        <div>
          <div className="text-blue-700 mb-1">Password</div>
          <input
            type="password"
            name="password"
            value={input.password}
            onChange={changeEventHandler}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
        {loading ? (
          <button 
            disabled 
            className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-md flex items-center justify-center cursor-not-allowed opacity-70"
          >
            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Logging in...
          </button>
        ) : (
          <button 
            type="submit" 
            className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-md font-medium text-base transition-colors duration-200"
          >
            Login
          </button>
        )}

        <div className="text-center">
          Doesn't have an account?{" "}
          <Link to="/signup" className="text-blue-600">
            Signup
          </Link>
        </div>
      </form>
    </div>
  );
};

export default Login;
