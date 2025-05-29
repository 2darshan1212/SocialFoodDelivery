import axios from 'axios';
import { API_BASE_URL } from '../../utils/apiConfig';

// Simple script to directly test the login endpoint
const testLogin = async () => {
  try {
    console.log('API Base URL:', API_BASE_URL);
    
    // Test credentials - replace with valid ones
    const credentials = {
      email: 'test@example.com',
      password: 'password123'
    };
    
    console.log('Attempting direct login with:', credentials);
    
    // Try the exact endpoint from the routes file
    const response = await axios.post(`${API_BASE_URL}/login`, credentials, {
      headers: {
        'Content-Type': 'application/json'
      },
      withCredentials: true
    });
    
    console.log('Login Response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Login Error:', error);
    console.error('Error Details:', error.response?.data || error.message);
    throw error;
  }
};

export default testLogin;
