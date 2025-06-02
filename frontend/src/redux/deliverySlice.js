import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { 
  registerAsDeliveryAgent, 
  getAgentProfile, 
  updateAvailability, 
  updateLocation,
  getNearbyOrders,
  acceptOrder,
  rejectOrder,
  completeDelivery,
  verifyDeliveryAgent as verifyDeliveryAgentAPI,
  getDeliveryHistory,
  getConfirmedOrders
} from "../services/deliveryService";
import { calculateDistance } from "../utils/distanceUtils";
import CoordinateDebugger from "../utils/coordinateDebugger";

// Utility functions for coordinate handling
const isValidCoordinate = (coord) => {
  if (!Array.isArray(coord) || coord.length !== 2) return false;
  const [lng, lat] = coord;
  return (
    typeof lng === 'number' && 
    typeof lat === 'number' && 
    !isNaN(lng) && 
    !isNaN(lat) && 
    lng >= -180 && 
    lng <= 180 && 
    lat >= -90 && 
    lat <= 90 &&
    !(lng === 0 && lat === 0) // Consider [0,0] invalid as it's often a default value
  );
};

const validateOrderCoordinates = (order) => {
  const hasValidPickup = isValidCoordinate(order?.pickupLocation?.coordinates);
  const hasValidDelivery = isValidCoordinate(order?.deliveryLocation?.coordinates);
  return { hasValidPickup, hasValidDelivery };
};

// Utility function to check if coordinates are valid and non-zero
const hasValidCoordinates = (coords) => {
  return coords && 
         Array.isArray(coords) && 
         coords.length === 2 && 
         (coords[0] !== 0 || coords[1] !== 0) &&
         !isNaN(coords[0]) && 
         !isNaN(coords[1]);
};

// Utility function to normalize order coordinates
const normalizeOrderCoordinates = (order) => {
  if (!order) return order;
  
  const normalizedOrder = { ...order };
  
  // Log original coordinates for debugging
  console.log(`Normalizing order ${order._id} coordinates:`, {
    original: {
      pickup: order.pickupLocation?.coordinates,
      delivery: order.deliveryLocation?.coordinates,
      restaurant: order.restaurant?.location?.coordinates,
      user: order.user?.location?.coordinates,
      // Add admin store potential coordinate locations
      restaurantLatitude: order.restaurantLatitude,
      restaurantLongitude: order.restaurantLongitude,
      pickupLatitude: order.pickupLatitude,
      pickupLongitude: order.pickupLongitude,
      deliveryLatitude: order.deliveryLatitude,
      deliveryLongitude: order.deliveryLongitude
    }
  });

  // Fix pickup location coordinates
  if (!hasValidCoordinates(normalizedOrder.pickupLocation?.coordinates)) {
    // First check if we have direct lat/long values from admin store
    if (normalizedOrder.pickupLatitude && normalizedOrder.pickupLongitude && 
        (normalizedOrder.pickupLatitude !== 0 || normalizedOrder.pickupLongitude !== 0)) {
      normalizedOrder.pickupLocation = {
        type: 'Point',
        coordinates: [normalizedOrder.pickupLongitude, normalizedOrder.pickupLatitude]
      };
      console.log(`Fixed pickup coordinates for order ${normalizedOrder._id} using direct lat/long values`);
    }
    // Or if we have restaurant lat/long values
    else if (normalizedOrder.restaurantLatitude && normalizedOrder.restaurantLongitude && 
             (normalizedOrder.restaurantLatitude !== 0 || normalizedOrder.restaurantLongitude !== 0)) {
      normalizedOrder.pickupLocation = {
        type: 'Point',
        coordinates: [normalizedOrder.restaurantLongitude, normalizedOrder.restaurantLatitude]
      };
      console.log(`Fixed pickup coordinates for order ${normalizedOrder._id} using restaurant lat/long values`);
    }
    // Try restaurant location next
    else if (hasValidCoordinates(normalizedOrder.restaurant?.location?.coordinates)) {
      normalizedOrder.pickupLocation = {
        type: 'Point',
        coordinates: [...normalizedOrder.restaurant.location.coordinates]
      };
      console.log(`Fixed pickup coordinates for order ${normalizedOrder._id} using restaurant location`);
    }
    // Try post author location as fallback
    else if (normalizedOrder.items?.length > 0 && 
             hasValidCoordinates(normalizedOrder.items[0]?.post?.author?.location?.coordinates)) {
      normalizedOrder.pickupLocation = {
        type: 'Point',
        coordinates: [...normalizedOrder.items[0].post.author.location.coordinates]
      };
      console.log(`Fixed pickup coordinates for order ${normalizedOrder._id} using post author location`);
    }
  }

  // Fix delivery location coordinates
  if (!hasValidCoordinates(normalizedOrder.deliveryLocation?.coordinates)) {
    // First check if we have direct lat/long values from admin store
    if (normalizedOrder.deliveryLatitude && normalizedOrder.deliveryLongitude && 
        (normalizedOrder.deliveryLatitude !== 0 || normalizedOrder.deliveryLongitude !== 0)) {
      normalizedOrder.deliveryLocation = {
        type: 'Point',
        coordinates: [normalizedOrder.deliveryLongitude, normalizedOrder.deliveryLatitude]
      };
      console.log(`Fixed delivery coordinates for order ${normalizedOrder._id} using direct lat/long values`);
    }
    // Try direct userLocation reference
    else if (hasValidCoordinates(normalizedOrder.userLocation?.coordinates)) {
      normalizedOrder.deliveryLocation = {
        type: 'Point',
        coordinates: [...normalizedOrder.userLocation.coordinates]
      };
      console.log(`Fixed delivery coordinates for order ${normalizedOrder._id} using userLocation`);
    }
    // Try user object location
    else if (hasValidCoordinates(normalizedOrder.user?.location?.coordinates)) {
      normalizedOrder.deliveryLocation = {
        type: 'Point',
        coordinates: [...normalizedOrder.user.location.coordinates]
      };
      console.log(`Fixed delivery coordinates for order ${normalizedOrder._id} using user.location`);
    }
  }

  // Log normalized coordinates
  console.log(`Normalized order ${normalizedOrder._id} coordinates:`, {
    result: {
      pickup: normalizedOrder.pickupLocation?.coordinates,
      delivery: normalizedOrder.deliveryLocation?.coordinates
    }
  });

  return normalizedOrder;
};

// Async thunk for registering as delivery agent
export const registerAgent = createAsyncThunk(
  "delivery/registerAgent",
  async (data, { rejectWithValue }) => {
    try {
      const response = await registerAsDeliveryAgent(data);
      return response;
    } catch (error) {
      return rejectWithValue(error.message || "Failed to register as delivery agent");
    }
  }
);

// Async thunk for fetching agent profile
export const fetchAgentProfile = createAsyncThunk(
  "delivery/fetchProfile",
  async (_, { rejectWithValue }) => {
    try {
      const response = await getAgentProfile();
      return response;
    } catch (error) {
      return rejectWithValue(error.message || "Failed to fetch agent profile");
    }
  }
);

// Async thunk for fetching active deliveries
export const fetchActiveDeliveries = createAsyncThunk(
  "delivery/fetchActiveDeliveries",
  async (_, { rejectWithValue }) => {
    try {
      console.log('Fetching active deliveries...');
      // Use the getDeliveryHistory API with a filter for active deliveries
      const response = await getDeliveryHistory();
      
      // Filter for active deliveries (status is not 'delivered' or 'cancelled')
      const activeDeliveries = response.deliveries?.filter(delivery => 
        delivery.status !== 'delivered' && 
        delivery.status !== 'cancelled'
      ) || [];
      
      console.log(`Found ${activeDeliveries.length} active deliveries`);
      return activeDeliveries;
    } catch (error) {
      console.error('Error fetching active deliveries:', error);
      return rejectWithValue(error.message || "Failed to fetch active deliveries");
    }
  }
);

// Async thunk for updating delivery status
export const updateDeliveryStatus = createAsyncThunk(
  "delivery/updateStatus",
  async ({ orderId, status }, { rejectWithValue, dispatch }) => {
    try {
      console.log(`Updating delivery status for order ${orderId} to ${status}`);
      
      // We'll use the API endpoint based on the status
      let response;
      
      // For simplicity, use acceptOrder API for status changes
      // In a real implementation, you would have specific API endpoints for each status
      if (status === 'picked_up') {
        // This would typically be a different API endpoint
        response = await acceptOrder(orderId, { status: 'picked_up' });
      } else if (status === 'out_for_delivery') {
        response = await acceptOrder(orderId, { status: 'out_for_delivery' });
      } else if (status === 'delivered') {
        response = await completeDelivery(orderId);
      } else {
        response = await acceptOrder(orderId, { status });
      }
      
      console.log(`Status updated successfully for order ${orderId}`, response);
      
      // Refresh active deliveries after status update
      dispatch(fetchActiveDeliveries());
      
      return { orderId, status, updatedAt: new Date().toISOString() };
    } catch (error) {
      console.error(`Error updating delivery status for order ${orderId}:`, error);
      return rejectWithValue(error.message || `Failed to update delivery status to ${status}`);
    }
  }
);

// Async thunk for fetching delivery history
export const fetchDeliveryHistory = createAsyncThunk(
  "delivery/fetchHistory",
  async (_, { rejectWithValue }) => {
    try {
      const response = await getDeliveryHistory();
      return response;
    } catch (error) {
      return rejectWithValue(error.message || "Failed to fetch delivery history");
    }
  }
);

// Async thunk for updating availability
export const setAgentAvailability = createAsyncThunk(
  "delivery/setAvailability",
  async (isAvailable, { rejectWithValue }) => {
    try {
      const response = await updateAvailability(isAvailable);
      return response;
    } catch (error) {
      return rejectWithValue(error.message || "Failed to update availability");
    }
  }
);

// Async thunk for updating location
export const setAgentLocation = createAsyncThunk(
  "delivery/setLocation",
  async ({ longitude, latitude }, { rejectWithValue }) => {
    try {
      const response = await updateLocation(longitude, latitude);
      return response;
    } catch (error) {
      return rejectWithValue(error.message || "Failed to update location");
    }
  }
);

// Async thunk for fetching nearby orders
export const fetchNearbyOrders = createAsyncThunk(
  "delivery/fetchNearbyOrders",
  async (_, { rejectWithValue, getState }) => {
    try {
      const response = await getNearbyOrders();
      const state = getState();
      
      // Get all possible locations of admin orders
      console.log('%c FULL REDUX STATE:', 'background: #ffe6cc; color: #663300; font-weight: bold;', state);
      
      // Try different paths to get admin orders
      const adminOrdersData = state.admin?.orders?.data || [];
      const adminConfirmedOrders = state.admin?.confirmedOrders || [];
      const filteredConfirmedOrders = adminOrdersData.filter(order => order.status === 'confirmed');
      
      // Debug all possible sources of admin orders
      console.log('%c Admin order sources:', 'background: #ccffcc; color: #006600; font-weight: bold;', {
        'admin.orders.data': adminOrdersData.length,
        'admin.confirmedOrders': adminConfirmedOrders.length,
        'filtered confirmed': filteredConfirmedOrders.length,
        'sample admin.orders.data': adminOrdersData.length > 0 ? {
          id: adminOrdersData[0]._id,
          status: adminOrdersData[0].status,
          pickupLatitude: adminOrdersData[0].pickupLatitude,
          pickupLongitude: adminOrdersData[0].pickupLongitude
        } : null,
        'sample filtered': filteredConfirmedOrders.length > 0 ? {
          id: filteredConfirmedOrders[0]._id,
          status: filteredConfirmedOrders[0].status,
          pickupLatitude: filteredConfirmedOrders[0].pickupLatitude,
          pickupLongitude: filteredConfirmedOrders[0].pickupLongitude
        } : null
      });
      
      // Combine all admin orders that have coordinates
      const allAdminOrders = [...adminOrdersData, ...adminConfirmedOrders, ...filteredConfirmedOrders];
      
      // Create a map for quick lookup
      const adminOrdersMap = {};
      allAdminOrders.forEach(order => {
        if (order && order._id) {
          adminOrdersMap[order._id] = order;
        }
      });
      
      // Debug nearby orders vs admin orders
      console.log('%c Nearby vs Admin Orders:', 'background: #ffccff; color: #660066; font-weight: bold;', {
        nearbyCount: response.orders?.length || 0,
        adminMapCount: Object.keys(adminOrdersMap).length,
        nearbyIds: response.orders?.map(o => o._id) || [],
        adminIds: Object.keys(adminOrdersMap)
      });
      
      // Find matching IDs between nearby and admin orders
      const matchingIds = (response.orders || []).filter(o => adminOrdersMap[o._id]).map(o => o._id);
      console.log('%c Matching order IDs:', 'background: #e6ccff; color: #330066; font-weight: bold;', matchingIds);
      
      if (response.orders && response.orders.length > 0) {
        response.orders = response.orders.map(order => {
          const adminOrder = adminOrdersMap[order._id];
          
          if (adminOrder) {
            console.log(`%c Syncing order ${order._id}:`, 'background: #ccffff; color: #006666; font-weight: bold;', {
              before: {
                pickup: order.pickupLocation?.coordinates,
                delivery: order.deliveryLocation?.coordinates,
                pickupLat: order.pickupLatitude,
                pickupLng: order.pickupLongitude
              },
              adminValues: {
                pickupLat: adminOrder.pickupLatitude,
                pickupLng: adminOrder.pickupLongitude,
                deliveryLat: adminOrder.deliveryLatitude,
                deliveryLng: adminOrder.deliveryLongitude
              }
            });
            
            // Create enhanced order with admin coordinates
            const enhancedOrder = {
              ...order,
              pickupLatitude: adminOrder.pickupLatitude || order.pickupLatitude,
              pickupLongitude: adminOrder.pickupLongitude || order.pickupLongitude,
              deliveryLatitude: adminOrder.deliveryLatitude || order.deliveryLatitude,
              deliveryLongitude: adminOrder.deliveryLongitude || order.deliveryLongitude,
              restaurantLatitude: adminOrder.restaurantLatitude || order.restaurantLatitude,
              restaurantLongitude: adminOrder.restaurantLongitude || order.restaurantLongitude
            };
            
            // Add coordinates in GeoJSON format if missing but we have lat/lng
            if ((!enhancedOrder.pickupLocation?.coordinates || 
                (enhancedOrder.pickupLocation.coordinates[0] === 0 && enhancedOrder.pickupLocation.coordinates[1] === 0)) && 
                enhancedOrder.pickupLatitude && enhancedOrder.pickupLongitude) {
              enhancedOrder.pickupLocation = {
                type: 'Point',
                coordinates: [enhancedOrder.pickupLongitude, enhancedOrder.pickupLatitude]
              };
              console.log('Created GeoJSON pickup location from lat/lng');
            }
            
            // Same for delivery location
            if ((!enhancedOrder.deliveryLocation?.coordinates || 
                (enhancedOrder.deliveryLocation.coordinates[0] === 0 && enhancedOrder.deliveryLocation.coordinates[1] === 0)) && 
                enhancedOrder.deliveryLatitude && enhancedOrder.deliveryLongitude) {
              enhancedOrder.deliveryLocation = {
                type: 'Point',
                coordinates: [enhancedOrder.deliveryLongitude, enhancedOrder.deliveryLatitude]
              };
              console.log('Created GeoJSON delivery location from lat/lng');
            }
            
            // Special fix for cases where we have no lat/lng but have GeoJSON in admin order
            if ((!enhancedOrder.pickupLocation?.coordinates || 
                (enhancedOrder.pickupLocation.coordinates[0] === 0 && enhancedOrder.pickupLocation.coordinates[1] === 0)) && 
                adminOrder.pickupLocation?.coordinates && 
                (adminOrder.pickupLocation.coordinates[0] !== 0 || adminOrder.pickupLocation.coordinates[1] !== 0)) {
              enhancedOrder.pickupLocation = {
                type: 'Point',
                coordinates: [...adminOrder.pickupLocation.coordinates]
              };
              console.log('Copied GeoJSON pickup location from admin order');
            }
            
            // Same for delivery location
            if ((!enhancedOrder.deliveryLocation?.coordinates || 
                (enhancedOrder.deliveryLocation.coordinates[0] === 0 && enhancedOrder.deliveryLocation.coordinates[1] === 0)) && 
                adminOrder.deliveryLocation?.coordinates && 
                (adminOrder.deliveryLocation.coordinates[0] !== 0 || adminOrder.deliveryLocation.coordinates[1] !== 0)) {
              enhancedOrder.deliveryLocation = {
                type: 'Point',
                coordinates: [...adminOrder.deliveryLocation.coordinates]
              };
              console.log('Copied GeoJSON delivery location from admin order');
            }
            
            return enhancedOrder;
          }
          return order;
        });
      }
      return response;
    } catch (error) {
      return rejectWithValue(error.message || "Failed to fetch nearby orders");
    }
  }
);

// Async thunk for accepting an order
export const acceptDeliveryOrder = createAsyncThunk(
  "delivery/acceptOrder",
  async (orderId, { rejectWithValue, getState }) => {
    try {
      // Get the original order from state to preserve coordinates
      const state = getState();
      const nearbyOrder = state.delivery?.nearbyOrders?.find(o => o._id === orderId);
      const confirmedOrder = state.delivery?.confirmedOrders?.find(o => o._id === orderId);
      const originalOrder = nearbyOrder || confirmedOrder;
      
      // Call the service with the original order for coordinate preservation
      const response = await acceptOrder(orderId, originalOrder);
      return response;
    } catch (error) {
      return rejectWithValue(error.message || "Failed to accept order");
    }
  }
);

// Async thunk for rejecting an order
export const rejectDeliveryOrder = createAsyncThunk(
  "delivery/rejectOrder",
  async (orderId, { rejectWithValue, dispatch, getState }) => {
    try {
      console.log(`rejectDeliveryOrder thunk called with orderId: ${orderId}`);
      
      // Log the current state to debug
      const currentState = getState().delivery;
      console.log('Current nearby orders before rejection:', 
        currentState.nearbyOrders.map(o => ({ id: o._id })));
      
      // Call the service function to reject the order
      const response = await rejectOrder(orderId);
      
      // Make sure we return the orderId with the response
      console.log(`Order ${orderId} successfully rejected, response:`, response);
      
      return { 
        ...response, 
        orderId,
        rejectedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error(`Error in rejectDeliveryOrder thunk for order ${orderId}:`, error);
      return rejectWithValue(typeof error === 'string' ? error : error.message || "Failed to reject order");
    }
  }
);


// Async thunk for completing a delivery
export const completeDeliveryOrder = createAsyncThunk(
  "delivery/completeDelivery",
  async (orderId, { rejectWithValue }) => {
    try {
      const response = await completeDelivery(orderId);
      return response;
    } catch (error) {
      return rejectWithValue(error.message || "Failed to complete delivery");
    }
  }
);

// Async thunk for verifying a delivery agent (admin only)
export const verifyDeliveryAgent = createAsyncThunk(
  "delivery/verifyAgent",
  async ({ agentId, isVerified }, { rejectWithValue }) => {
    try {
      const response = await verifyDeliveryAgentAPI(agentId, isVerified);
      return response;
    } catch (error) {
      return rejectWithValue(error.message || "Failed to verify agent");
    }
  }
);

// Async thunk for fetching confirmed orders (status = 'confirmed')
export const fetchConfirmedOrders = createAsyncThunk(
  "delivery/fetchConfirmedOrders",
  async (_, { rejectWithValue }) => {
    try {
      const response = await getConfirmedOrders();
      return response;
    } catch (error) {
      return rejectWithValue(error.message || "Failed to fetch confirmed orders");
    }
  }
);

const initialState = {
  isDeliveryAgent: false,
  isRegistering: false,
  isRegistrationError: false,
  registrationError: null,
  profile: null,
  isAvailable: false,
  isProfileLoading: false,
  isProfileError: false,
  profileError: null,
  activeDeliveries: [],
  isLoadingActiveDeliveries: false,
  activeDeliveriesError: null,
  currentLocation: {
    longitude: 0,
    latitude: 0,
  },
  isLocationUpdating: false,
  nearbyOrders: [],
  isNearbyOrdersLoading: false,
  isNearbyOrdersError: false,
  nearbyOrdersError: null,
  activeOrders: [],
  isActionPending: false,
  isAcceptingOrder: false,
  acceptOrderError: null,
  actionError: null,
  deliveryHistory: [],
  stats: {
    completedDeliveries: 0,
    rating: 0,
    totalRatings: 0,
  },
  verificationStatus: {
    isPending: false,
    error: null,
    success: false
  },
  isRejecting: false,
  rejectedOrderIds: [],
  // Enhanced confirmed orders state
  confirmedOrders: [],
  pickupPoints: [],
  distances: {}, // Map of orderId to distance from agent
  pickupToDeliveryDistances: {}, // Map of orderId to distance from pickup to delivery point
  estimatedTravelTimes: {}, // Map of orderId to estimated travel time
  isLoadingConfirmedOrders: false,
  confirmedOrdersError: null,
  lastConfirmedOrdersUpdate: null,
};

const deliverySlice = createSlice({
  name: "delivery",
  initialState,
  reducers: {
    setCurrentLocation: (state, action) => {
      state.currentLocation = action.payload;
      
      // If we have confirmed orders, recalculate distances when location changes
      if (state.pickupPoints.length > 0 && state.currentLocation.latitude && state.currentLocation.longitude) {
        const newDistances = {};
        const newTravelTimes = {};
        
        state.pickupPoints.forEach(point => {
          if (point.latitude && point.longitude) {
            // Calculate distance from agent to pickup point
            const distance = calculateDistance(
              state.currentLocation.latitude,
              state.currentLocation.longitude,
              point.latitude,
              point.longitude
            );
            newDistances[point.orderId] = distance;
            
            // Estimate travel time (assuming average speed of 30 km/h)
            // Convert distance to time in minutes
            const travelTimeMinutes = Math.round((distance / 30) * 60);
            newTravelTimes[point.orderId] = travelTimeMinutes;
          }
        });
        
        state.distances = newDistances;
        state.estimatedTravelTimes = newTravelTimes;
      }
    },
    updatePickupPoints: (state, action) => {
      state.pickupPoints = action.payload;
      
      // Calculate distances if we have a current location
      if (state.currentLocation.latitude && state.currentLocation.longitude) {
        const newDistances = {};
        const newTravelTimes = {};
        const newPickupToDeliveryDistances = {};
        
        state.pickupPoints.forEach(point => {
          if (point.latitude && point.longitude) {
            // Calculate distance from agent to pickup point
            const distance = calculateDistance(
              state.currentLocation.latitude,
              state.currentLocation.longitude,
              point.latitude,
              point.longitude
            );
            newDistances[point.orderId] = distance;
            
            // Estimate travel time (assuming average speed of 30 km/h)
            // Convert distance to time in minutes
            const travelTimeMinutes = Math.round((distance / 30) * 60);
            newTravelTimes[point.orderId] = travelTimeMinutes;
            
            // If delivery location is available, calculate pickup to delivery distance
            if (point.deliveryLatitude && point.deliveryLongitude) {
              const pickupToDeliveryDistance = calculateDistance(
                point.latitude,
                point.longitude,
                point.deliveryLatitude,
                point.deliveryLongitude
              );
              newPickupToDeliveryDistances[point.orderId] = pickupToDeliveryDistance;
            }
          }
        });
        
        state.distances = newDistances;
        state.estimatedTravelTimes = newTravelTimes;
        state.pickupToDeliveryDistances = newPickupToDeliveryDistances;
      }
    },
    
    // Add a dedicated action for manually refreshing confirmed orders
    refreshConfirmedOrders: (state) => {
      state.isLoadingConfirmedOrders = true;
      state.confirmedOrdersError = null;
    },
    resetDeliveryState: () => initialState,
    clearVerificationStatus: (state) => {
      state.verificationStatus = {
        isPending: false,
        error: null,
        success: false
      };
    },
    
    // Fix active delivery coordinates manually
    fixActiveDeliveryCoordinates: (state) => {
      if (!state.activeDeliveries || state.activeDeliveries.length === 0) {
        console.log('No active deliveries to fix');
        return;
      }
      
      console.log(`Fixing coordinates for ${state.activeDeliveries.length} active deliveries`);
      
      state.activeDeliveries = state.activeDeliveries.map(order => {
        const updatedOrder = { ...order };
        
        // Fix pickup location if it's [0,0] or missing
        if (!updatedOrder.pickupLocation?.coordinates ||
            (updatedOrder.pickupLocation.coordinates[0] === 0 && updatedOrder.pickupLocation.coordinates[1] === 0)) {
          
          // Try restaurant location first
          if (updatedOrder.restaurant?.location?.coordinates &&
              updatedOrder.restaurant.location.coordinates.length === 2 &&
              (updatedOrder.restaurant.location.coordinates[0] !== 0 || updatedOrder.restaurant.location.coordinates[1] !== 0)) {
            
            updatedOrder.pickupLocation = {
              type: 'Point',
              coordinates: [...updatedOrder.restaurant.location.coordinates]
            };
            console.log(`Fixed pickup coordinates for order ${updatedOrder._id} using restaurant location`);
          }
        }
        
        // Fix delivery location if it's [0,0] or missing
        if (!updatedOrder.deliveryLocation?.coordinates ||
            (updatedOrder.deliveryLocation.coordinates[0] === 0 && updatedOrder.deliveryLocation.coordinates[1] === 0)) {
          
          // Try userLocation first
          if (updatedOrder.userLocation?.coordinates &&
              updatedOrder.userLocation.coordinates.length === 2 &&
              (updatedOrder.userLocation.coordinates[0] !== 0 || updatedOrder.userLocation.coordinates[1] !== 0)) {
            
            updatedOrder.deliveryLocation = {
              type: 'Point',
              coordinates: [...updatedOrder.userLocation.coordinates]
            };
            console.log(`Fixed delivery coordinates for order ${updatedOrder._id} using userLocation`);
          }
          // Then try user.location
          else if (updatedOrder.user?.location?.coordinates &&
                   updatedOrder.user.location.coordinates.length === 2 &&
                   (updatedOrder.user.location.coordinates[0] !== 0 || updatedOrder.user.location.coordinates[1] !== 0)) {
            
            updatedOrder.deliveryLocation = {
              type: 'Point',
              coordinates: [...updatedOrder.user.location.coordinates]
            };
            console.log(`Fixed delivery coordinates for order ${updatedOrder._id} using user.location`);
          }
        }
        
        return updatedOrder;
      });
    },
    
    // New action to sync coordinates from admin store
    syncOrderCoordinatesFromAdmin: (state, action) => {
      const { orderId, adminOrder } = action.payload;
      
      if (!orderId || !adminOrder) return;
      
      // Find and update order in active deliveries
      const activeIndex = state.activeDeliveries.findIndex(order => order._id === orderId);
      if (activeIndex !== -1) {
        const currentOrder = state.activeDeliveries[activeIndex];
        
        // Create an updated order with synced coordinates
        const updatedOrder = {
          ...currentOrder,
          // Update coordinate fields from admin order
          pickupLatitude: adminOrder.pickupLatitude || currentOrder.pickupLatitude,
          pickupLongitude: adminOrder.pickupLongitude || currentOrder.pickupLongitude,
          deliveryLatitude: adminOrder.deliveryLatitude || currentOrder.deliveryLatitude,
          deliveryLongitude: adminOrder.deliveryLongitude || currentOrder.deliveryLongitude,
        };
        
        // Update GeoJSON coordinates if we have valid lat/lng
        if (updatedOrder.pickupLatitude && updatedOrder.pickupLongitude && 
            (updatedOrder.pickupLatitude !== 0 || updatedOrder.pickupLongitude !== 0)) {
          updatedOrder.pickupLocation = {
            type: 'Point',
            coordinates: [updatedOrder.pickupLongitude, updatedOrder.pickupLatitude]
          };
        }
        
        if (updatedOrder.deliveryLatitude && updatedOrder.deliveryLongitude && 
            (updatedOrder.deliveryLatitude !== 0 || updatedOrder.deliveryLongitude !== 0)) {
          updatedOrder.deliveryLocation = {
            type: 'Point',
            coordinates: [updatedOrder.deliveryLongitude, updatedOrder.deliveryLatitude]
          };
        }
        
        state.activeDeliveries[activeIndex] = updatedOrder;
        console.log(`Synced coordinates for order ${orderId} from admin store`);
      }
      
      // Also update in nearbyOrders if present
      const nearbyIndex = state.nearbyOrders.findIndex(order => order._id === orderId);
      if (nearbyIndex !== -1) {
        const currentOrder = state.nearbyOrders[nearbyIndex];
        
        // Update with admin coordinates
        state.nearbyOrders[nearbyIndex] = {
          ...currentOrder,
          pickupLatitude: adminOrder.pickupLatitude || currentOrder.pickupLatitude,
          pickupLongitude: adminOrder.pickupLongitude || currentOrder.pickupLongitude,
          deliveryLatitude: adminOrder.deliveryLatitude || currentOrder.deliveryLatitude,
          deliveryLongitude: adminOrder.deliveryLongitude || currentOrder.deliveryLongitude,
          pickupLocation: adminOrder.pickupLatitude && adminOrder.pickupLongitude ? {
            type: 'Point',
            coordinates: [adminOrder.pickupLongitude, adminOrder.pickupLatitude]
          } : currentOrder.pickupLocation,
          deliveryLocation: adminOrder.deliveryLatitude && adminOrder.deliveryLongitude ? {
            type: 'Point',
            coordinates: [adminOrder.deliveryLongitude, adminOrder.deliveryLatitude]
          } : currentOrder.deliveryLocation
        };
      }
    },
    addToActiveDeliveries: (state, action) => {
      // First check if this order is already in active deliveries
      const orderExists = state.activeDeliveries.some(order => order._id === action.payload._id);
      if (!orderExists) {
        CoordinateDebugger.log('Adding order to active deliveries', { orderId: action.payload._id });
        
        // Validate the incoming order
        CoordinateDebugger.validateOrder(action.payload, 'incoming order for active deliveries');
        
        // Find matching nearby order to preserve coordinates
        const nearbyOrder = state.nearbyOrders.find(order => order._id === action.payload._id);
        
        if (nearbyOrder) {
          CoordinateDebugger.log('Found matching nearby order for coordinate preservation');
          CoordinateDebugger.validateOrder(nearbyOrder, 'nearby order');
        }
        
        // Normalize and validate the incoming order
        let normalizedOrder = normalizeOrderCoordinates(action.payload);
        const { hasValidPickup, hasValidDelivery } = validateOrderCoordinates(normalizedOrder);
        
        CoordinateDebugger.log('Normalized order validation', {
          orderId: normalizedOrder._id,
          hasValidPickup,
          hasValidDelivery
        });
        
        // If coordinates are invalid, try to get them from the nearby order
        if (nearbyOrder) {
          const nearbyValidation = validateOrderCoordinates(nearbyOrder);
          
          if (!hasValidPickup && nearbyValidation.hasValidPickup) {
            CoordinateDebugger.log('Using pickup coordinates from nearby order');
            normalizedOrder.pickupLocation = { ...nearbyOrder.pickupLocation };
            normalizedOrder.pickupLatitude = nearbyOrder.pickupLatitude;
            normalizedOrder.pickupLongitude = nearbyOrder.pickupLongitude;
          }
          
          if (!hasValidDelivery && nearbyValidation.hasValidDelivery) {
            CoordinateDebugger.log('Using delivery coordinates from nearby order');
            normalizedOrder.deliveryLocation = { ...nearbyOrder.deliveryLocation };
            normalizedOrder.deliveryLatitude = nearbyOrder.deliveryLatitude;
            normalizedOrder.deliveryLongitude = nearbyOrder.deliveryLongitude;
          }
        }
        
        // Add the normalized order to active deliveries
        state.activeDeliveries.push(normalizedOrder);
        
        // Log the final coordinates for debugging
        const finalValidation = validateOrderCoordinates(normalizedOrder);
        CoordinateDebugger.log('Order added to active deliveries - final state', {
          orderId: normalizedOrder._id,
          pickup: normalizedOrder.pickupLocation?.coordinates,
          delivery: normalizedOrder.deliveryLocation?.coordinates,
          isPickupValid: finalValidation.hasValidPickup,
          isDeliveryValid: finalValidation.hasValidDelivery,
          totalActiveDeliveries: state.activeDeliveries.length
        });
        
        // Log the entire active deliveries state
        CoordinateDebugger.logReduxState('activeDeliveries', state.activeDeliveries);
      } else {
        CoordinateDebugger.warn('Order already exists in active deliveries', { orderId: action.payload._id });
      }
    },
    removeFromActiveDeliveries: (state, action) => {
      state.activeDeliveries = state.activeDeliveries.filter(order => order._id !== action.payload);
    },
    updateActiveDeliveryStatus: (state, action) => {
      const { orderId, status, additionalInfo } = action.payload;
      const orderIndex = state.activeDeliveries.findIndex(order => order._id === orderId);
      
      if (orderIndex !== -1) {
        // Update the order status
        state.activeDeliveries[orderIndex].status = status;
        state.activeDeliveries[orderIndex].deliveryStatus = status;
        
        // If status is 'picked_up', update the timestamps
        if (status === 'picked_up') {
          state.activeDeliveries[orderIndex].pickedUpAt = new Date().toISOString();
          
          // Calculate estimated delivery time based on distance if we have coordinates
          const order = state.activeDeliveries[orderIndex];
          if (order.pickupLocation?.coordinates && order.deliveryLocation?.coordinates && 
              order.deliveryLocation.coordinates[0] !== 0 && order.deliveryLocation.coordinates[1] !== 0) {
            // Calculate distance from pickup to delivery
            const deliveryDistance = calculateDistance(
              order.pickupLocation.coordinates[1],
              order.pickupLocation.coordinates[0],
              order.deliveryLocation.coordinates[1],
              order.deliveryLocation.coordinates[0]
            );
            
            // Estimate delivery time (assume 30 km/h average speed)
            const deliveryTimeMinutes = Math.round((deliveryDistance / 30) * 60);
            const deliveryTime = new Date();
            deliveryTime.setMinutes(deliveryTime.getMinutes() + deliveryTimeMinutes);
            
            state.activeDeliveries[orderIndex].estimatedDeliveryTime = deliveryTime.toISOString();
          }
        }
        
        // If status is 'delivered', update the timestamp
        if (status === 'delivered') {
          state.activeDeliveries[orderIndex].deliveredAt = new Date().toISOString();
        }
        
        // If there's additional info to update (like estimated arrival time)
        if (additionalInfo) {
          state.activeDeliveries[orderIndex] = {
            ...state.activeDeliveries[orderIndex],
            ...additionalInfo
          };
        }
        
        console.log(`Updated order ${orderId} status to ${status}`, state.activeDeliveries[orderIndex]);
      }
    }
  },
  extraReducers: (builder) => {
    // Fetch active deliveries
    builder.addCase(fetchActiveDeliveries.pending, (state) => {
      state.activeDeliveriesLoading = true;
      state.activeDeliveriesError = null;
    });
    
    builder.addCase(fetchActiveDeliveries.fulfilled, (state, action) => {
      state.activeDeliveriesLoading = false;
      state.activeDeliveries = action.payload;
      state.activeDeliveriesError = null;
    });
    
    builder.addCase(fetchActiveDeliveries.rejected, (state, action) => {
      state.activeDeliveriesLoading = false;
      state.activeDeliveriesError = action.payload;
    });
    
    // Update delivery status
    builder.addCase(updateDeliveryStatus.pending, (state) => {
      state.statusUpdateLoading = true;
      state.statusUpdateError = null;
    });
    
    builder.addCase(updateDeliveryStatus.fulfilled, (state, action) => {
      state.statusUpdateLoading = false;
      const { orderId, status } = action.payload;
      
      // Update the delivery in activeDeliveries
      const deliveryIndex = state.activeDeliveries.findIndex(delivery => 
        delivery._id === orderId || delivery.orderId === orderId
      );
      
      if (deliveryIndex !== -1) {
        state.activeDeliveries[deliveryIndex].status = status;
        
        // If delivered, you might want to remove it from active deliveries
        if (status === 'delivered') {
          state.activeDeliveries = state.activeDeliveries.filter(delivery => 
            delivery._id !== orderId && delivery.orderId !== orderId
          );
        }
      }
    });
    
    builder.addCase(updateDeliveryStatus.rejected, (state, action) => {
      state.statusUpdateLoading = false;
      state.statusUpdateError = action.payload;
    });
    
    // Register as delivery agent
    builder.addCase(registerAgent.fulfilled, (state, action) => {
      state.isRegistering = false;
      state.isDeliveryAgent = true;
      state.profile = action.payload.agent;
    });
    builder.addCase(registerAgent.rejected, (state, action) => {
      state.isRegistering = false;
      state.isRegistrationError = true;
      state.registrationError = action.payload;
    });

    // Fetch agent profile
    builder.addCase(fetchAgentProfile.pending, (state) => {
      state.isProfileLoading = true;
      state.isProfileError = false;
      state.profileError = null;
    });
    builder.addCase(fetchAgentProfile.fulfilled, (state, action) => {
      state.isProfileLoading = false;
      state.profile = action.payload.agent;
      state.isDeliveryAgent = true;
      state.isAvailable = action.payload.agent.isAvailable;
      state.currentLocation = {
        longitude: action.payload.agent.currentLocation.coordinates[0],
        latitude: action.payload.agent.currentLocation.coordinates[1],
      };
      
      // Get active orders from payload
      const incomingActiveOrders = action.payload.agent.activeOrders || [];
      
      // Process each active order to ensure pickup and delivery locations are valid
      const processedOrders = incomingActiveOrders.map(order => {
        const updatedOrder = { ...order };
        
        // Fix pickup location if it's [0,0] or missing
        if (!updatedOrder.pickupLocation?.coordinates ||
            (updatedOrder.pickupLocation.coordinates[0] === 0 && updatedOrder.pickupLocation.coordinates[1] === 0)) {
          
          // Try restaurant location first
          if (updatedOrder.restaurant?.location?.coordinates &&
              updatedOrder.restaurant.location.coordinates.length === 2 &&
              (updatedOrder.restaurant.location.coordinates[0] !== 0 || updatedOrder.restaurant.location.coordinates[1] !== 0)) {
            
            updatedOrder.pickupLocation = {
              type: 'Point',
              coordinates: [...updatedOrder.restaurant.location.coordinates]
            };
            console.log(`Fixed pickup coordinates for order ${updatedOrder._id} using restaurant location`);
          }
        }
        
        // Fix delivery location if it's [0,0] or missing
        if (!updatedOrder.deliveryLocation?.coordinates ||
            (updatedOrder.deliveryLocation.coordinates[0] === 0 && updatedOrder.deliveryLocation.coordinates[1] === 0)) {
          
          // Try userLocation first
          if (updatedOrder.userLocation?.coordinates &&
              updatedOrder.userLocation.coordinates.length === 2 &&
              (updatedOrder.userLocation.coordinates[0] !== 0 || updatedOrder.userLocation.coordinates[1] !== 0)) {
            
            updatedOrder.deliveryLocation = {
              type: 'Point',
              coordinates: [...updatedOrder.userLocation.coordinates]
            };
            console.log(`Fixed delivery coordinates for order ${updatedOrder._id} using userLocation`);
          }
          // Then try user.location
          else if (updatedOrder.user?.location?.coordinates &&
                   updatedOrder.user.location.coordinates.length === 2 &&
                   (updatedOrder.user.location.coordinates[0] !== 0 || updatedOrder.user.location.coordinates[1] !== 0)) {
            
            updatedOrder.deliveryLocation = {
              type: 'Point',
              coordinates: [...updatedOrder.user.location.coordinates]
            };
            console.log(`Fixed delivery coordinates for order ${updatedOrder._id} using user.location`);
          }
        }
        
        return updatedOrder;
      });
      
      // Set the processed orders to state
      state.activeOrders = processedOrders;
      
      // Also apply the same processing to activeDeliveries array to ensure consistency
      if (state.activeDeliveries && state.activeDeliveries.length > 0) {
        state.activeDeliveries = state.activeDeliveries.map(delivery => {
          // Find the corresponding processed order if it exists
          const processedOrder = processedOrders.find(order => order._id === delivery._id);
          
          // If we have a processed version with fixed coordinates, use that
          if (processedOrder) {
            return {
              ...delivery,
              pickupLocation: processedOrder.pickupLocation,
              deliveryLocation: processedOrder.deliveryLocation
            };
          }
          
          // Otherwise, apply the same fix logic to this delivery
          const updatedDelivery = { ...delivery };
          
          // Fix pickup location
          if (!updatedDelivery.pickupLocation?.coordinates ||
              (updatedDelivery.pickupLocation.coordinates[0] === 0 && updatedDelivery.pickupLocation.coordinates[1] === 0)) {
            
            if (updatedDelivery.restaurant?.location?.coordinates &&
                updatedDelivery.restaurant.location.coordinates.length === 2) {
              
              updatedDelivery.pickupLocation = {
                type: 'Point',
                coordinates: [...updatedDelivery.restaurant.location.coordinates]
              };
              console.log(`Fixed activeDelivery pickup coordinates for ${updatedDelivery._id}`);
            }
          }
          
          // Fix delivery location
          if (!updatedDelivery.deliveryLocation?.coordinates ||
              (updatedDelivery.deliveryLocation.coordinates[0] === 0 && updatedDelivery.deliveryLocation.coordinates[1] === 0)) {
            
            if (updatedDelivery.userLocation?.coordinates &&
                updatedDelivery.userLocation.coordinates.length === 2) {
              
              updatedDelivery.deliveryLocation = {
                type: 'Point',
                coordinates: [...updatedDelivery.userLocation.coordinates]
              };
              console.log(`Fixed activeDelivery delivery coordinates for ${updatedDelivery._id}`);
            }
            else if (updatedDelivery.user?.location?.coordinates &&
                     updatedDelivery.user.location.coordinates.length === 2) {
              
              updatedDelivery.deliveryLocation = {
                type: 'Point',
                coordinates: [...updatedDelivery.user.location.coordinates]
              };
              console.log(`Fixed activeDelivery delivery coordinates from user for ${updatedDelivery._id}`);
            }
          }
          
          return updatedDelivery;
        });
        
        console.log('Fixed activeDeliveries coordinates:', state.activeDeliveries.length);
      }
      
      state.deliveryHistory = action.payload.agent.deliveryHistory || [];
      state.stats = action.payload.stats || initialState.stats;
    });
    builder.addCase(fetchAgentProfile.rejected, (state, action) => {
      state.isProfileLoading = false;
      state.isProfileError = true;
      state.profileError = action.payload;
      // If 404 not found, not a delivery agent
      if (action.payload && action.payload.includes("not found")) {
        state.isDeliveryAgent = false;
      }
    });

    // Update availability
    builder.addCase(setAgentAvailability.pending, (state) => {
      state.isActionPending = true;
      state.actionError = null;
    });
    builder.addCase(setAgentAvailability.fulfilled, (state, action) => {
      state.isActionPending = false;
      state.isAvailable = action.payload.agent.isAvailable;
    });
    builder.addCase(setAgentAvailability.rejected, (state, action) => {
      state.isActionPending = false;
      state.actionError = action.payload;
    });

    // Update location
    builder.addCase(setAgentLocation.pending, (state) => {
      state.isLocationUpdating = true;
    });
    builder.addCase(setAgentLocation.fulfilled, (state, action) => {
      state.isLocationUpdating = false;
      state.currentLocation = {
        longitude: action.payload.currentLocation.coordinates[0],
        latitude: action.payload.currentLocation.coordinates[1],
      };
      
      // Also update the agent location in all active deliveries
      if (state.activeDeliveries.length > 0) {
        state.activeDeliveries = state.activeDeliveries.map(delivery => ({
          ...delivery,
          agentLocation: {
            type: 'Point',
            coordinates: [action.payload.currentLocation.coordinates[0], action.payload.currentLocation.coordinates[1]]
          }
        }));
      }
    });
    builder.addCase(setAgentLocation.rejected, (state) => {
      state.isLocationUpdating = false;
    });

    // Fetch nearby orders
    builder.addCase(fetchNearbyOrders.pending, (state) => {
      state.isNearbyOrdersLoading = true;
      state.isNearbyOrdersError = false;
      state.nearbyOrdersError = null;
    });
    builder.addCase(fetchNearbyOrders.fulfilled, (state, action) => {
      state.isNearbyOrdersLoading = false;
      
      CoordinateDebugger.log('Nearby orders received from API', {
        count: action.payload.orders?.length || 0
      });
      
      // Apply the same normalization to nearby orders as we do for active deliveries
      const normalizedOrders = (action.payload.orders || []).map(order => {
        CoordinateDebugger.log(`Processing nearby order ${order._id}`);
        CoordinateDebugger.validateOrder(order, 'nearby order before normalization');
        
        const normalized = normalizeOrderCoordinates(order);
        
        CoordinateDebugger.validateOrder(normalized, 'nearby order after normalization');
        CoordinateDebugger.trackCoordinateFlow('normalize nearby order', order, normalized);
        
        return normalized;
      });
      
      CoordinateDebugger.log('All nearby orders processed', {
        totalOrders: normalizedOrders.length,
        validOrders: normalizedOrders.filter(order => {
          const validation = validateOrderCoordinates(order);
          return validation.hasValidPickup && validation.hasValidDelivery;
        }).length
      });
      
      state.nearbyOrders = normalizedOrders;
      
      // Log the final state
      CoordinateDebugger.logReduxState('nearbyOrders', state.nearbyOrders);
    });
    builder.addCase(fetchNearbyOrders.rejected, (state, action) => {
      state.isNearbyOrdersLoading = false;
      state.isNearbyOrdersError = true;
      state.nearbyOrdersError = action.payload;
    });

    // Accept order
    builder.addCase(acceptDeliveryOrder.pending, (state) => {
      state.isAcceptingOrder = true;
    });
    builder.addCase(acceptDeliveryOrder.fulfilled, (state, action) => {
      state.isAcceptingOrder = false;
      state.acceptOrderError = null;
      
      // Add the accepted order to active deliveries
      if (action.payload && action.payload.order) {
        const incomingOrder = action.payload.order;
        
        CoordinateDebugger.log('Accept delivery order received', {
          orderId: incomingOrder._id,
          incomingCoordinates: {
            pickup: incomingOrder.pickupLocation?.coordinates,
            delivery: incomingOrder.deliveryLocation?.coordinates
          }
        });
        
        // STEP 1: Find the original order with good coordinates
        const matchingNearbyOrder = state.nearbyOrders.find(o => o._id === incomingOrder._id);
        const matchingConfirmedOrder = state.confirmedOrders.find(o => o._id === incomingOrder._id);
        const originalOrder = matchingNearbyOrder || matchingConfirmedOrder;
        
        if (originalOrder) {
          CoordinateDebugger.log('Found original order with coordinates', {
            orderId: originalOrder._id,
            originalCoordinates: {
              pickup: originalOrder.pickupLocation?.coordinates,
              delivery: originalOrder.deliveryLocation?.coordinates
            }
          });
        } else {
          CoordinateDebugger.warn('No original order found for coordinate preservation');
        }
        
        // STEP 2: Create enhanced order ensuring coordinates are preserved
        let enhancedOrder;
        
        if (originalOrder) {
          // Use the original order as the base to ensure coordinates are preserved
          enhancedOrder = {
            // Start with the original order that has valid coordinates
            ...originalOrder,
            
            // Then overlay specific fields from the API response
            _id: incomingOrder._id,
            status: incomingOrder.status || 'accepted',
            deliveryAgent: incomingOrder.deliveryAgent || originalOrder.deliveryAgent,
            deliveryAgentId: incomingOrder.deliveryAgentId || originalOrder.deliveryAgentId,
            estimatedDeliveryTime: incomingOrder.estimatedDeliveryTime || originalOrder.estimatedDeliveryTime,
            statusHistory: incomingOrder.statusHistory || originalOrder.statusHistory || [],
            
            // Ensure pickup location coordinates are preserved from original
            pickupLocation: originalOrder.pickupLocation || incomingOrder.pickupLocation,
            pickupLatitude: originalOrder.pickupLatitude || incomingOrder.pickupLatitude,
            pickupLongitude: originalOrder.pickupLongitude || incomingOrder.pickupLongitude,
            
            // Ensure delivery location coordinates are preserved from original
            deliveryLocation: originalOrder.deliveryLocation || incomingOrder.deliveryLocation,
            deliveryLatitude: originalOrder.deliveryLatitude || incomingOrder.deliveryLatitude,
            deliveryLongitude: originalOrder.deliveryLongitude || incomingOrder.deliveryLongitude,
            
            // Preserve restaurant information
            restaurant: originalOrder.restaurant || incomingOrder.restaurant,
            restaurantLatitude: originalOrder.restaurantLatitude || incomingOrder.restaurantLatitude,
            restaurantLongitude: originalOrder.restaurantLongitude || incomingOrder.restaurantLongitude,
            
            // Add delivery-specific fields
            acceptedAt: new Date().toISOString(),
            deliveryStatus: 'accepted',
            agentLocation: state.currentLocation ? {
              type: 'Point',
              coordinates: [state.currentLocation.longitude, state.currentLocation.latitude]
            } : null
          };
          
          CoordinateDebugger.log('Enhanced order created from original', {
            orderId: enhancedOrder._id,
            preservedCoordinates: {
              pickup: enhancedOrder.pickupLocation?.coordinates,
              delivery: enhancedOrder.deliveryLocation?.coordinates
            }
          });
        } else {
          // No original order found, use incoming order but apply coordinate normalization
          enhancedOrder = {
            ...incomingOrder,
            acceptedAt: new Date().toISOString(),
            deliveryStatus: 'accepted',
            agentLocation: state.currentLocation ? {
              type: 'Point',
              coordinates: [state.currentLocation.longitude, state.currentLocation.latitude]
            } : null
          };
          
          // Apply coordinate normalization
          enhancedOrder = normalizeOrderCoordinates(enhancedOrder);
          
          CoordinateDebugger.warn('No original order found, normalized incoming order', {
            orderId: enhancedOrder._id,
            normalizedCoordinates: {
              pickup: enhancedOrder.pickupLocation?.coordinates,
              delivery: enhancedOrder.deliveryLocation?.coordinates
            }
          });
        }
        
        // STEP 3: Final coordinate validation and warning
        const { hasValidPickup, hasValidDelivery } = validateOrderCoordinates(enhancedOrder);
        
        if (!hasValidPickup || !hasValidDelivery) {
          CoordinateDebugger.error('CRITICAL: Order still has invalid coordinates after all enhancement attempts!', {
            orderId: enhancedOrder._id,
            hasValidPickup,
            hasValidDelivery,
            pickup: enhancedOrder.pickupLocation?.coordinates,
            delivery: enhancedOrder.deliveryLocation?.coordinates,
            originalPickup: originalOrder?.pickupLocation?.coordinates,
            originalDelivery: originalOrder?.deliveryLocation?.coordinates,
            incomingPickup: incomingOrder.pickupLocation?.coordinates,
            incomingDelivery: incomingOrder.deliveryLocation?.coordinates
          });
        } else {
          CoordinateDebugger.success('Order has valid coordinates!', {
            orderId: enhancedOrder._id,
            pickup: enhancedOrder.pickupLocation?.coordinates,
            delivery: enhancedOrder.deliveryLocation?.coordinates
          });
        }
        
        // STEP 4: Calculate estimated times if coordinates are valid
        if (hasValidPickup && state.currentLocation?.latitude && state.currentLocation?.longitude) {
          try {
            const pickupDistance = calculateDistance(
              state.currentLocation.latitude,
              state.currentLocation.longitude,
              enhancedOrder.pickupLocation.coordinates[1],
              enhancedOrder.pickupLocation.coordinates[0]
            );
            
            const pickupTimeMinutes = Math.round((pickupDistance / 30) * 60);
            const pickupTime = new Date();
            pickupTime.setMinutes(pickupTime.getMinutes() + pickupTimeMinutes);
            enhancedOrder.estimatedPickupTime = pickupTime.toISOString();
            
            if (hasValidDelivery) {
              const deliveryDistance = calculateDistance(
                enhancedOrder.pickupLocation.coordinates[1],
                enhancedOrder.pickupLocation.coordinates[0],
                enhancedOrder.deliveryLocation.coordinates[1],
                enhancedOrder.deliveryLocation.coordinates[0]
              );
              
              const deliveryTimeMinutes = Math.round((deliveryDistance / 30) * 60);
              const deliveryTime = new Date(pickupTime);
              deliveryTime.setMinutes(deliveryTime.getMinutes() + deliveryTimeMinutes + 5);
              enhancedOrder.estimatedDeliveryTime = deliveryTime.toISOString();
            }
          } catch (error) {
            CoordinateDebugger.error('Error calculating travel times', error);
          }
        }
        
        // STEP 5: Remove from source arrays and add to active deliveries
        state.nearbyOrders = state.nearbyOrders.filter(order => order._id !== incomingOrder._id);
        state.confirmedOrders = state.confirmedOrders.filter(order => order._id !== incomingOrder._id);
        
        // Add to active deliveries (prevent duplicates)
        const existingIndex = state.activeDeliveries.findIndex(del => del._id === enhancedOrder._id);
        if (existingIndex >= 0) {
          // Replace existing
          state.activeDeliveries[existingIndex] = { ...enhancedOrder };
          CoordinateDebugger.log('Replaced existing order in active deliveries');
        } else {
          // Add new
          state.activeDeliveries.push({ ...enhancedOrder });
          CoordinateDebugger.log('Added new order to active deliveries');
        }
        
        CoordinateDebugger.log('Order acceptance completed', {
          orderId: enhancedOrder._id,
          activeDeliveriesCount: state.activeDeliveries.length,
          finalCoordinates: {
            pickup: enhancedOrder.pickupLocation?.coordinates,
            delivery: enhancedOrder.deliveryLocation?.coordinates
          }
        });
      }
    });
    builder.addCase(acceptDeliveryOrder.rejected, (state, action) => {
      state.isAcceptingOrder = false;
      state.acceptOrderError = action.payload;
    });

    // Reject order
    builder.addCase(rejectDeliveryOrder.pending, (state) => {
      state.isRejecting = true;
      state.actionError = null;
    });
    builder.addCase(rejectDeliveryOrder.fulfilled, (state, action) => {
      state.isRejecting = false;
      state.actionError = null;
      
      // Get the orderId from the payload
      const rejectedOrderId = action.payload.orderId;
      
      console.log('Rejection successful, removing order from nearbyOrders:', rejectedOrderId);
      
      // Find the order in nearby orders before removing it (for debugging)
      const orderBeforeRemoval = state.nearbyOrders.find(order => order._id === rejectedOrderId);
      console.log('Order to be removed:', orderBeforeRemoval ? orderBeforeRemoval._id : 'Not found');
      
      // Remove the rejected order from the nearby orders list
      const previousLength = state.nearbyOrders.length;
      state.nearbyOrders = state.nearbyOrders.filter(
        (order) => order._id !== rejectedOrderId
      );
      console.log(`Removed ${previousLength - state.nearbyOrders.length} orders from nearbyOrders`);
      
      // Also remove from confirmed orders if present
      const previousConfirmedLength = state.confirmedOrders.length;
      state.confirmedOrders = state.confirmedOrders.filter(
        (order) => order._id !== rejectedOrderId
      );
      console.log(`Removed ${previousConfirmedLength - state.confirmedOrders.length} orders from confirmedOrders`);
      
      // Add order ID to rejected orders list if not already there
      if (!state.rejectedOrderIds.includes(rejectedOrderId)) {
        state.rejectedOrderIds.push(rejectedOrderId);
        console.log(`Added ${rejectedOrderId} to rejectedOrderIds list, now contains ${state.rejectedOrderIds.length} orders`);
      }
    });
    builder.addCase(rejectDeliveryOrder.rejected, (state, action) => {
      state.isRejecting = false;
      state.actionError = action.payload;
    });

    // Complete delivery
    builder.addCase(completeDeliveryOrder.pending, (state) => {
      state.isActionPending = true;
      state.actionError = null;
    });
    builder.addCase(completeDeliveryOrder.fulfilled, (state, action) => {
      state.isActionPending = false;
      state.activeOrders = state.activeOrders.filter(
        (order) => order._id !== action.payload.order._id
      );
      state.deliveryHistory = [...state.deliveryHistory, action.payload.order];
      state.stats.completedDeliveries += 1;
    });
    builder.addCase(completeDeliveryOrder.rejected, (state, action) => {
      state.isActionPending = false;
      state.actionError = action.payload;
    });

    // Fetch delivery history
    builder.addCase(fetchDeliveryHistory.pending, (state) => {
      state.isProfileLoading = true;
      state.isProfileError = false;
      state.profileError = null;
    });
    builder.addCase(fetchDeliveryHistory.fulfilled, (state, action) => {
      state.isProfileLoading = false;
      state.deliveryHistory = action.payload.deliveryHistory || [];
    });
    builder.addCase(fetchDeliveryHistory.rejected, (state, action) => {
      state.isProfileLoading = false;
      state.isProfileError = true;
      state.profileError = action.payload;
    });

    // Verify delivery agent (admin only)
    builder.addCase(verifyDeliveryAgent.pending, (state) => {
      state.verificationStatus.isPending = true;
      state.verificationStatus.error = null;
      state.verificationStatus.success = false;
    });
    builder.addCase(verifyDeliveryAgent.fulfilled, (state, action) => {
      state.verificationStatus.isPending = false;
      state.verificationStatus.success = true;
      
      // If this is the current user's agent profile, update it
      if (state.profile && state.profile._id === action.payload.agent._id) {
        state.profile.isVerified = action.payload.agent.isVerified;
      }
    });
    builder.addCase(verifyDeliveryAgent.rejected, (state, action) => {
      state.verificationStatus.isPending = false;
      state.verificationStatus.error = action.payload;
    });
    
    // Fetch confirmed orders
    builder.addCase(fetchConfirmedOrders.pending, (state) => {
      state.isLoadingConfirmedOrders = true;
      state.confirmedOrdersError = null;
    });
    builder.addCase(fetchConfirmedOrders.fulfilled, (state, action) => {
      state.isLoadingConfirmedOrders = false;
      
      console.log('Received confirmed orders from backend:', action.payload.orders);
      
      // Use the utility function to normalize all orders
      const normalizedOrders = (action.payload.orders || []).map(order => normalizeOrderCoordinates(order));
      
      // Update state with normalized orders
      state.confirmedOrders = normalizedOrders;
      state.lastConfirmedOrdersUpdate = new Date().toISOString();
      
      // Extract pickup points from confirmed orders
      const pickupPoints = [];
      
      normalizedOrders.forEach(order => {
        if (order.restaurant && order.restaurant.location) {
          const { coordinates } = order.restaurant.location;
          if (coordinates && coordinates.length === 2) {
            // Extract delivery address coordinates if available
            let deliveryLatitude = null;
            let deliveryLongitude = null;
            
            if (order.deliveryLocation && order.deliveryLocation.coordinates && 
                order.deliveryLocation.coordinates.length === 2) {
              deliveryLongitude = order.deliveryLocation.coordinates[0];
              deliveryLatitude = order.deliveryLocation.coordinates[1];
            }
            
            pickupPoints.push({
              orderId: order._id,
              restaurantId: order.restaurant._id,
              restaurantName: order.restaurant.name,
              longitude: coordinates[0],
              latitude: coordinates[1],
              deliveryLatitude,
              deliveryLongitude,
              deliveryAddress: order.deliveryAddress || 'No address provided',
              orderAmount: order.totalAmount,
              items: order.items?.length || 0,
              customerName: order.user?.name || 'Customer',
              orderTime: order.createdAt,
              status: order.status
            });
          }
        }
      });
      
      state.pickupPoints = pickupPoints;
      
      // Calculate all distances if we have a current location
      if (state.currentLocation.latitude && state.currentLocation.longitude) {
        const newDistances = {};
        const newTravelTimes = {};
        const newPickupToDeliveryDistances = {};
        
        pickupPoints.forEach(point => {
          if (point.latitude && point.longitude) {
            // Calculate distance from agent to pickup point
            const distance = calculateDistance(
              state.currentLocation.latitude,
              state.currentLocation.longitude,
              point.latitude,
              point.longitude
            );
            newDistances[point.orderId] = distance;
            
            // Estimate travel time (assuming average speed of 30 km/h)
            // Convert distance to time in minutes
            const travelTimeMinutes = Math.round((distance / 30) * 60);
            newTravelTimes[point.orderId] = travelTimeMinutes;
            
            // If delivery location is available, calculate pickup to delivery distance
            if (point.deliveryLatitude && point.deliveryLongitude) {
              const pickupToDeliveryDistance = calculateDistance(
                point.latitude,
                point.longitude,
                point.deliveryLatitude,
                point.deliveryLongitude
              );
              newPickupToDeliveryDistances[point.orderId] = pickupToDeliveryDistance;
            }
          }
        });
        
        state.distances = newDistances;
        state.estimatedTravelTimes = newTravelTimes;
        state.pickupToDeliveryDistances = newPickupToDeliveryDistances;
      }
    });
    builder.addCase(fetchConfirmedOrders.rejected, (state, action) => {
      state.isLoadingConfirmedOrders = false;
      state.confirmedOrdersError = action.payload;
    });
    
    // Handle the refreshConfirmedOrders action
    builder.addCase(refreshConfirmedOrders.type, (state) => {
      state.isLoadingConfirmedOrders = true;
      state.confirmedOrdersError = null;
    });
  },
});

export const { 
  setCurrentLocation, 
  resetDeliveryState, 
  clearVerificationStatus,
  fixActiveDeliveryCoordinates,
  updatePickupPoints,
  refreshConfirmedOrders,
  addToActiveDeliveries,
  removeFromActiveDeliveries,
  updateActiveDeliveryStatus,
  syncOrderCoordinatesFromAdmin
} = deliverySlice.actions;

export default deliverySlice.reducer;