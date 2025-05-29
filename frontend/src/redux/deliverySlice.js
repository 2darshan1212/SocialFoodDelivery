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
  async (_, { rejectWithValue }) => {
    try {
      const response = await getNearbyOrders();
      return response;
    } catch (error) {
      return rejectWithValue(error.message || "Failed to fetch nearby orders");
    }
  }
);

// Async thunk for accepting an order
export const acceptDeliveryOrder = createAsyncThunk(
  "delivery/acceptOrder",
  async (orderId, { rejectWithValue }) => {
    try {
      const response = await acceptOrder(orderId);
      return response;
    } catch (error) {
      return rejectWithValue(error.message || "Failed to accept order");
    }
  }
);

// Async thunk for rejecting an order
export const rejectDeliveryOrder = createAsyncThunk(
  "delivery/rejectOrder",
  async (orderId, { rejectWithValue }) => {
    try {
      const response = await rejectOrder(orderId);
      return response;
    } catch (error) {
      return rejectWithValue(error.message || "Failed to reject order");
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
    addToActiveDeliveries: (state, action) => {
      // First check if this order is already in active deliveries
      const orderExists = state.activeDeliveries.some(order => order._id === action.payload._id);
      if (!orderExists) {
        // Get the order to add
        const orderToAdd = {...action.payload};
        
        // Process pickup location
        if (!orderToAdd.pickupLocation || 
            !orderToAdd.pickupLocation.coordinates || 
            (orderToAdd.pickupLocation.coordinates[0] === 0 && orderToAdd.pickupLocation.coordinates[1] === 0)) {
          
          // Try to get pickup location from restaurant
          if (orderToAdd.restaurant && orderToAdd.restaurant.location && 
              orderToAdd.restaurant.location.coordinates && 
              orderToAdd.restaurant.location.coordinates.length === 2) {
            
            orderToAdd.pickupLocation = {
              type: 'Point',
              coordinates: [...orderToAdd.restaurant.location.coordinates]
            };
            console.log('Active delivery: Using restaurant coordinates for pickup', orderToAdd.pickupLocation);
          }
        }
        
        // Process delivery location
        if (!orderToAdd.deliveryLocation || 
            !orderToAdd.deliveryLocation.coordinates || 
            (orderToAdd.deliveryLocation.coordinates[0] === 0 && orderToAdd.deliveryLocation.coordinates[1] === 0)) {
          
          // Try to get delivery location from userLocation
          if (orderToAdd.userLocation && orderToAdd.userLocation.coordinates && 
              orderToAdd.userLocation.coordinates.length === 2) {
            
            orderToAdd.deliveryLocation = {
              type: 'Point',
              coordinates: [...orderToAdd.userLocation.coordinates]
            };
            console.log('Active delivery: Using userLocation coordinates for delivery', orderToAdd.deliveryLocation);
          } 
          // Otherwise try from user object directly
          else if (orderToAdd.user && orderToAdd.user.location && 
                   orderToAdd.user.location.coordinates && 
                   orderToAdd.user.location.coordinates.length === 2) {
            
            orderToAdd.deliveryLocation = {
              type: 'Point',
              coordinates: [...orderToAdd.user.location.coordinates]
            };
            console.log('Active delivery: Using user object coordinates for delivery', orderToAdd.deliveryLocation);
          }
        }
        
        // Add the processed order to active deliveries
        state.activeDeliveries.push(orderToAdd);
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
    // Register as delivery agent
    builder.addCase(registerAgent.pending, (state) => {
      state.isRegistering = true;
      state.isRegistrationError = false;
      state.registrationError = null;
    });
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
      state.nearbyOrders = action.payload.orders || [];
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
        // Debug: Log the incoming order data to verify its structure
        console.log('Accept delivery order payload:', action.payload.order);
        console.log('Order pickup location:', action.payload.order.pickupLocation);
        console.log('Order delivery location:', action.payload.order.deliveryLocation);
        console.log('Order restaurant location:', action.payload.order.restaurant?.location);
        console.log('Order user location:', action.payload.order.userLocation);
        // Add order to active deliveries
        const order = action.payload.order;
        
        // Make sure pickup location is properly set from restaurant location
        let pickupLocation = order.pickupLocation;
        
        // If pickupLocation is missing but restaurant location exists, use that instead
        if ((!pickupLocation || !pickupLocation.coordinates) && 
            order.restaurant && order.restaurant.location) {
          pickupLocation = {
            type: 'Point',
            coordinates: order.restaurant.location.coordinates ? 
              [...order.restaurant.location.coordinates] : // Use restaurant location
              [0, 0] // Placeholder until real coordinates are available
          };
          console.log('Created pickup location from restaurant:', pickupLocation);
        }
        
        // Extract delivery location from user data if it exists
        let deliveryLocation = order.deliveryLocation;
        if ((!deliveryLocation || !deliveryLocation.coordinates || deliveryLocation.coordinates[0] === 0) && 
             order.userLocation && order.userLocation.coordinates) {
          deliveryLocation = {
            type: 'Point',
            coordinates: order.userLocation.coordinates
          };
          console.log('Created delivery location from userLocation:', deliveryLocation);
        } else if ((!deliveryLocation || !deliveryLocation.coordinates || deliveryLocation.coordinates[0] === 0) && 
                   order.user && order.user.location && order.user.location.coordinates) {
          // Try to get from user object directly if available
          deliveryLocation = {
            type: 'Point',
            coordinates: order.user.location.coordinates
          };
          console.log('Created delivery location from user object:', deliveryLocation);
        }
        
        // Add current location for tracking
        const enhancedOrder = {
          ...order,
          // Ensure pickup location is properly set with valid coordinates
          pickupLocation: {
            type: 'Point',
            coordinates: pickupLocation && pickupLocation.coordinates && 
                         pickupLocation.coordinates.length === 2 && 
                         (pickupLocation.coordinates[0] !== 0 || pickupLocation.coordinates[1] !== 0) ?
              [...pickupLocation.coordinates] :
              // Fallback to restaurant coordinates
              order.restaurant && order.restaurant.location && order.restaurant.location.coordinates ?
                [...order.restaurant.location.coordinates] :
                // Last resort fallback
                [0, 0]
          },
          // Ensure delivery location is properly set with valid coordinates
          deliveryLocation: {
            type: 'Point',
            coordinates: deliveryLocation && deliveryLocation.coordinates && 
                         deliveryLocation.coordinates.length === 2 && 
                         (deliveryLocation.coordinates[0] !== 0 || deliveryLocation.coordinates[1] !== 0) ?
              [...deliveryLocation.coordinates] :
              // Fallback to user location coordinates
              order.userLocation && order.userLocation.coordinates ?
                [...order.userLocation.coordinates] :
                // Try user object location
                order.user && order.user.location && order.user.location.coordinates ?
                  [...order.user.location.coordinates] :
                  // Last resort fallback
                  [0, 0]
          },
          // Add agent's current location
          agentLocation: {
            type: 'Point',
            coordinates: state.currentLocation ? 
              [state.currentLocation.longitude, state.currentLocation.latitude] : 
              [0, 0]
          },
          acceptedAt: new Date().toISOString(),
          estimatedPickupTime: null,
          estimatedDeliveryTime: null,
          deliveryStatus: 'accepted' // 'accepted', 'picked_up', 'on_way', 'delivered'
        };
        
        // Calculate estimated times if we have coordinates
        if (state.currentLocation && state.currentLocation.latitude && 
            enhancedOrder.pickupLocation && enhancedOrder.pickupLocation.coordinates) {
          
          // Calculate distance to pickup
          const pickupDistance = calculateDistance(
            state.currentLocation.latitude,
            state.currentLocation.longitude,
            enhancedOrder.pickupLocation.coordinates[1],
            enhancedOrder.pickupLocation.coordinates[0]
          );
          
          // Estimate pickup time (assume 30 km/h average speed)
          const pickupTimeMinutes = Math.round((pickupDistance / 30) * 60);
          const pickupTime = new Date();
          pickupTime.setMinutes(pickupTime.getMinutes() + pickupTimeMinutes);
          enhancedOrder.estimatedPickupTime = pickupTime.toISOString();
          
          // Calculate distance and time from pickup to delivery if we have delivery coordinates
          if (enhancedOrder.deliveryLocation && enhancedOrder.deliveryLocation.coordinates && 
              enhancedOrder.deliveryLocation.coordinates[0] !== 0 && 
              enhancedOrder.deliveryLocation.coordinates[1] !== 0) {
            const deliveryDistance = calculateDistance(
              enhancedOrder.pickupLocation.coordinates[1],
              enhancedOrder.pickupLocation.coordinates[0],
              enhancedOrder.deliveryLocation.coordinates[1],
              enhancedOrder.deliveryLocation.coordinates[0]
            );
            
            // Estimate delivery time (add pickup time + delivery distance time)
            const deliveryTimeMinutes = Math.round((deliveryDistance / 30) * 60);
            const deliveryTime = new Date(pickupTime);
            deliveryTime.setMinutes(deliveryTime.getMinutes() + deliveryTimeMinutes + 5); // Add 5 mins for pickup
            enhancedOrder.estimatedDeliveryTime = deliveryTime.toISOString();
          }
        }
        
        // Find and remove from confirmedOrders if it exists there
        state.confirmedOrders = state.confirmedOrders.filter(co => co._id !== order._id);
        
        // Add to active deliveries
        const deliveryExists = state.activeDeliveries.some(del => del._id === order._id);
        if (!deliveryExists) {
          state.activeDeliveries.push(enhancedOrder);
        }
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
      // Remove the rejected order from the nearby orders list
      state.nearbyOrders = state.nearbyOrders.filter(
        (order) => order._id !== action.payload.orderId
      );
      // Add order ID to rejected orders list
      state.rejectedOrderIds.push(action.payload.orderId);
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
      state.confirmedOrders = action.payload.orders || [];
      state.lastConfirmedOrdersUpdate = new Date().toISOString();
      
      // Extract pickup points from confirmed orders
      const pickupPoints = [];
      
      state.confirmedOrders.forEach(order => {
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
  updateActiveDeliveryStatus
} = deliverySlice.actions;

export default deliverySlice.reducer;