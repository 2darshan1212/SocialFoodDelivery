import { io } from "socket.io-client";

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

// Dynamically select the socket server URL based on the current environment
const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

// Set the socket server URL accordingly
const SOCKET_SERVER_URL = isDevelopment 
  ? "http://localhost:3000"  // Local development server
  : "https://socialfooddelivery-2.onrender.com"; // Production server

// Initialize socket connection
export const initSocket = (userId, isDeliveryAgent = false, agentId = null) => {
  if (socket) return socket;

  try {
    // Prepare query parameters
    const query = {
      userId,
    };
    
    // Add delivery agent info if applicable
    if (isDeliveryAgent && agentId) {
      query.isDeliveryAgent = true;
      query.agentId = agentId;
    }
    
    // Connect to the appropriate server
    socket = io(SOCKET_SERVER_URL, {
      query,
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      withCredentials: true,
    });

    console.log(`Socket connection initialized to ${SOCKET_SERVER_URL}`);
    
    // Setup reconnection logging
    socket.on('connect', () => {
      console.log('Socket connected successfully');
    });
    
    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
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
