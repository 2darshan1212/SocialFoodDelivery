import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { API_BASE_URL } from '../utils/axiosInstance';

/**
 * Test component to verify authentication and API connectivity
 * This component makes both authenticated and unauthenticated API requests
 * to help debug any authentication issues
 */
const AuthTest = () => {
  const { isAuthenticated, user, login, logout } = useAuth();
  const [publicData, setPublicData] = useState(null);
  const [privateData, setPrivateData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [credentials, setCredentials] = useState({
    email: '',
    password: ''
  });

  // Function to test a public API endpoint
  const testPublicEndpoint = async () => {
    setLoading(true);
    setError(null);
    try {
      // Public endpoint that doesn't require authentication
      const response = await axios.get(`${API_BASE_URL}/api/v1/test/public`);
      setPublicData(response.data);
      console.log('Public API response:', response.data);
    } catch (err) {
      setError(`Public API Error: ${err.message}`);
      console.error('Public API Error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Function to test a protected API endpoint
  const testProtectedEndpoint = async () => {
    setLoading(true);
    setError(null);
    try {
      // Set token in cookie before request to ensure it's available
      const token = localStorage.getItem('token');
      if (token) {
        // Set cookie manually
        if (window.location.protocol === 'https:') {
          document.cookie = `token=${token}; path=/; SameSite=None; Secure`;
        } else {
          document.cookie = `token=${token}; path=/; SameSite=Lax; max-age=86400`;
        }
        console.log('Set token cookie before request:', document.cookie);
      } else {
        console.warn('No token available in localStorage');
      }
      
      // Use our axiosInstance which already has token handling
      const response = await axios.get(`${API_BASE_URL}/api/v1/test/private`, {
        headers: {
          Authorization: `Bearer ${token}`
        },
        withCredentials: true
      });
      
      setPrivateData(response.data);
      console.log('Protected API response:', response.data);
    } catch (err) {
      setError(`Protected API Error: ${err.message}`);
      console.error('Protected API Error:', err);
      if (err.response) {
        console.error('Error response:', err.response.data);
        console.error('Status code:', err.response.status);
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle login form
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setCredentials({
      ...credentials,
      [name]: value
    });
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      await login(credentials.email, credentials.password);
    } catch (err) {
      setError(`Login Error: ${err.message}`);
      console.error('Login Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    setPrivateData(null);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Authentication Test Page</h1>
      
      <div className="bg-gray-100 p-4 rounded-lg mb-6">
        <h2 className="text-xl font-semibold mb-2">Authentication Status</h2>
        <p><strong>Status:</strong> {isAuthenticated ? 'Authenticated ✅' : 'Not Authenticated ❌'}</p>
        {user && (
          <div className="mt-2">
            <p><strong>User ID:</strong> {user._id}</p>
            <p><strong>Email:</strong> {user.email}</p>
          </div>
        )}
      </div>

      {!isAuthenticated ? (
        <div className="bg-white p-4 rounded-lg shadow-md mb-6">
          <h2 className="text-xl font-semibold mb-4">Login</h2>
          <form onSubmit={handleLogin}>
            <div className="mb-4">
              <label className="block mb-1">Email</label>
              <input
                type="email"
                name="email"
                value={credentials.email}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border rounded"
                required
              />
            </div>
            <div className="mb-4">
              <label className="block mb-1">Password</label>
              <input
                type="password"
                name="password"
                value={credentials.password}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border rounded"
                required
              />
            </div>
            <button
              type="submit"
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
              disabled={loading}
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>
        </div>
      ) : (
        <button
          onClick={handleLogout}
          className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 mb-6"
        >
          Logout
        </button>
      )}

      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6">
          <p>{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-4 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">Test Public API</h2>
          <button
            onClick={testPublicEndpoint}
            className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
            disabled={loading}
          >
            {loading ? 'Testing...' : 'Test Public Endpoint'}
          </button>
          
          {publicData && (
            <div className="mt-4 bg-gray-50 p-3 rounded">
              <h3 className="font-semibold">Response:</h3>
              <pre className="whitespace-pre-wrap text-sm mt-2">
                {JSON.stringify(publicData, null, 2)}
              </pre>
            </div>
          )}
        </div>

        <div className="bg-white p-4 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">Test Protected API</h2>
          <button
            onClick={testProtectedEndpoint}
            className="bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600"
            disabled={loading || !isAuthenticated}
          >
            {loading ? 'Testing...' : 'Test Protected Endpoint'}
          </button>
          
          {!isAuthenticated && (
            <p className="text-sm text-gray-600 mt-2">
              Please login first to test protected endpoints
            </p>
          )}
          
          {privateData && (
            <div className="mt-4 bg-gray-50 p-3 rounded">
              <h3 className="font-semibold">Response:</h3>
              <pre className="whitespace-pre-wrap text-sm mt-2">
                {JSON.stringify(privateData, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 bg-gray-100 p-4 rounded-lg">
        <h2 className="text-xl font-semibold mb-2">Authentication Debug Info</h2>
        <div className="grid grid-cols-1 gap-4">
          <div>
            <h3 className="font-semibold">LocalStorage Token</h3>
            <button 
              onClick={() => {
                // Force refresh token display
                setPrivateData(null);
                setPublicData(null);
              }}
              className="text-xs bg-blue-500 text-white px-2 py-1 rounded ml-2 hover:bg-blue-600"
            >
              Refresh
            </button>
            <pre className="whitespace-pre-wrap text-sm mt-2 bg-white p-2 rounded overflow-auto max-h-20">
              {localStorage.getItem('token') || 'No token found'}
            </pre>
          </div>
          <div>
            <h3 className="font-semibold">Cookies</h3>
            <pre className="whitespace-pre-wrap text-sm mt-2 bg-white p-2 rounded overflow-auto max-h-20">
              {document.cookie || 'No cookies found'}
            </pre>
          </div>
          <div>
            <h3 className="font-semibold">Fix Authentication</h3>
            <div className="mt-2">
              <button 
                onClick={() => {
                  // Manually set the token in cookie based on localStorage
                  const token = localStorage.getItem('token');
                  if (token) {
                    if (window.location.protocol === 'https:') {
                      document.cookie = `token=${token}; path=/; SameSite=None; Secure`;
                    } else {
                      document.cookie = `token=${token}; path=/; SameSite=Lax; max-age=86400`;
                    }
                    alert('Token cookie has been set: ' + document.cookie);
                  } else {
                    alert('No token found in localStorage to set as cookie');
                  }
                }}
                className="bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600 mr-2"
              >
                Set Token Cookie
              </button>
              <button 
                onClick={() => {
                  // Clear all auth data
                  localStorage.removeItem('token');
                  document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
                  alert('All auth data cleared. You are now logged out.');
                  window.location.reload();
                }}
                className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
              >
                Clear Auth Data
              </button>
            </div>
          </div>
        </div>
        
        <div className="mt-4 border-t pt-4">
          <h3 className="font-semibold">Auth Context State</h3>
          <pre className="whitespace-pre-wrap text-sm mt-2 bg-white p-2 rounded overflow-auto max-h-40">
            {JSON.stringify({isAuthenticated, user, loading}, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
};

export default AuthTest;
