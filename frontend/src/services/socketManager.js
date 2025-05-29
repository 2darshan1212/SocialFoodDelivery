import { io } from "socket.io-client";
import { SERVER_URL } from "../utils/apiConfig";
import tokenManager from "../utils/tokenManager";

// Socket event constants
export const SOCKET_EVENTS = {
  // Chat events
  NEW_MESSAGE: "new_message",
  MESSAGE_RECEIVED: "message_received",

  // Notification events
  NEW_NOTIFICATION: "new_notification",
  
  // Post events
  NEW_POST: "new_post",

  // Delivery events
  ORDER_ASSIGNED: "order_assigned",
  ORDER_STATUS_UPDATED: "order_status_updated",
  DELIVERY_LOCATION_UPDATED: "delivery_location_updated",
  NEW_ORDER_AVAILABLE: "new_order_available",
  DELIVERY_COMPLETED: "delivery_completed",
};

// Singleton socket instance
let socket = null;

// Socket event listeners and their callbacks
const listeners = new Map();

// Use the SERVER_URL from apiConfig which already handles environment detection
const SOCKET_SERVER_URL = SERVER_URL;

// Log the socket server URL being used for debugging
console.log('Using socket server URL:', SOCKET_SERVER_URL);

// Initialize socket connection with improved error handling and authentication
export const initSocket = (userId, isDeliveryAgent = false, agentId = null) => {
  // Clean up any existing socket to avoid duplicates
  if (socket) {
    console.log('Cleaning up existing socket connection before creating a new one');
    socket.close();
    socket = null;
  }

  try {
    // Ensure we have a valid user ID
    if (!userId) {
      console.error('Cannot initialize socket: No user ID provided');
      return null;
    }

    // Ensure tokens are synchronized across all storage mechanisms
    tokenManager.initializeTokens();
    
    // Get token using the centralized token manager
    const token = tokenManager.getToken();
    
    // Log authentication status
    if (token) {
      console.log('Authentication token found for socket connection');
    } else {
      console.warn('No authentication token available for socket connection');
    }
    
    // Prepare query parameters
    const query = {
      userId,
      // Include token in query for socket authentication
      token: token || '',
      // Include token in auth header format as well (some servers check this)
      auth: token ? `Bearer ${token}` : ''
    };
    
    // Add delivery agent info if applicable
    if (isDeliveryAgent && agentId) {
      query.isDeliveryAgent = true;
      query.agentId = agentId;
    }
    
    // Log the auth state for debugging
    console.log('Socket authentication state:', {
      userId,
      hasToken: !!token,
      isDeliveryAgent,
      agentId: agentId || 'N/A'
    });
    
    console.log(`Initializing socket connection to ${SOCKET_SERVER_URL}`);
    
    // Connect to the appropriate server with improved options
    socket = io(SOCKET_SERVER_URL, {
      query,
      transports: ["websocket", "polling"], // Allow fallback to polling if websocket fails
      reconnection: true,
      reconnectionAttempts: 10,     // More attempts
      reconnectionDelay: 1000,      // Start with 1s delay
      reconnectionDelayMax: 10000,  // Max 10s between retries
      timeout: 20000,               // Longer connection timeout
      withCredentials: true,        // Send cookies for auth
      autoConnect: true,            // Connect immediately
      extraHeaders: {
        // Include token in headers for services that check headers
        'Authorization': token ? `Bearer ${token}` : '',
        'x-auth-token': token || '',
        'token': token || ''
      },
    });

    // Enhanced event handlers for better debugging
    socket.on('connect', () => {
      console.log(`Socket connected successfully with ID: ${socket.id}`);
    });
    
    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error.message);
      
      // Handle auth errors specifically
      if (error.message.includes('authentication')) {
        console.warn('Socket authentication failed - token may be invalid');
      }
    });
    
    socket.on('disconnect', (reason) => {
      console.log(`Socket disconnected: ${reason}`);
      
      // If server disconnected us, try to reconnect manually
      if (reason === 'io server disconnect') {
        // Server disconnected us, try to reconnect manually
        setTimeout(() => {
          console.log('Attempting manual reconnection...');
          socket.connect();
        }, 5000);
      }
    });
    
    socket.on('reconnect', (attemptNumber) => {
      console.log(`Socket reconnected after ${attemptNumber} attempts`);
    });
    
    socket.on('reconnect_attempt', (attemptNumber) => {
      console.log(`Socket reconnection attempt #${attemptNumber}`);
      
      // Ensure tokens are synchronized on reconnect attempts
      tokenManager.initializeTokens();
      const currentToken = tokenManager.getToken();
      
      // Update the socket query and headers with the token
      socket.io.opts.query = {
        ...socket.io.opts.query,
        token: currentToken || '',
        auth: currentToken ? `Bearer ${currentToken}` : ''
      };
      
      // Update headers as well for comprehensive token inclusion
      socket.io.opts.extraHeaders = {
        'Authorization': currentToken ? `Bearer ${currentToken}` : '',
        'x-auth-token': currentToken || '',
        'token': currentToken || ''
      };
      
      console.log(`Socket reconnection attempt #${attemptNumber} with updated token`);
    });
    
    return socket;
  } catch (error) {
    console.error("Failed to initialize socket:", error);
    return null;
  }
};

// Close socket connection
export const closeSocket = () => {
  if (socket) {
    socket.close();
    socket = null;
    listeners.clear();
    console.log("Socket connection closed");
  }
};

// Add event listener to socket
export const onEvent = (event, callback) => {
  if (!socket) return;

  // Store the callback in our map to be able to remove it later
  if (!listeners.has(event)) {
    listeners.set(event, []);
  }
  listeners.get(event).push(callback);

  // Attach the listener to the socket
  socket.on(event, callback);
};

// Remove event listener
export const offEvent = (event, callback) => {
  if (!socket) return;

  if (callback && listeners.has(event)) {
    // Remove specific callback
    listeners.set(
      event,
      listeners.get(event).filter((cb) => cb !== callback)
    );
    socket.off(event, callback);
  } else {
    // Remove all callbacks for this event
    listeners.delete(event);
    socket.off(event);
  }
};

// Emit event through socket
export const emitEvent = (event, data) => {
  if (!socket) return;
  socket.emit(event, data);
};

// Get socket connection status
export const getConnectionStatus = () => {
  return socket ? socket.connected : false;
};

// Get the socket instance - for any case where direct access is needed
// but this should be used with caution
export const getSocket = () => socket;
