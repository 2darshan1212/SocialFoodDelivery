import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { MdMyLocation, MdRefresh, MdLocationOff, MdInfo, MdDirections, MdRestaurant, MdHome } from 'react-icons/md';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { setAgentLocation } from '../../redux/deliverySlice';
import { toast } from 'react-hot-toast';
// Define calculateDistance locally rather than importing it
import { FiPackage } from 'react-icons/fi';

// Fix leaflet icon issues
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

// Need to explicitly set the default icon for Leaflet
const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

// Custom DeliveryMap component for active deliveries
const DeliveryMap = ({ 
  agentLocation, 
  pickupLocation, 
  deliveryLocation,
  orderStatus,
  height = "400px",
  zoom = 13,
  orderDetails = null // Added parameter for order details
}) => {
  // Get admin orders and confirmed orders to check for better coordinates
  const adminOrders = useSelector(state => state.admin?.orders?.data) || [];
  
  // Make sure we're accessing the confirmed orders correctly - they might be stored differently
  // Try multiple possible paths in the Redux store
  const adminConfirmedOrders = useSelector(state => {
    // Try all possible paths where confirmedOrders might be stored
    return state.admin?.confirmedOrders || // Direct access
           state.admin?.orders?.confirmedOrders || // Nested in orders
           (state.admin?.orders?.data || []).filter(order => order.status === 'confirmed') || // Filter from all orders
           [];
  });
  
  // Get delivery orders from the delivery slice for the My Deliveries view
  const myAssignedOrders = useSelector(state => state.delivery?.assignedOrders) || [];
  const myNearbyOrders = useSelector(state => state.delivery?.nearbyOrders) || [];
  const myAcceptedOrders = useSelector(state => state.delivery?.acceptedOrders) || [];
  
  // Log delivery orders for debugging
  console.log('%c Delivery store data:', 'background: #fff0e6; color: #cc6600; font-weight: bold;', {
    assignedCount: myAssignedOrders.length,
    nearbyCount: myNearbyOrders.length,
    acceptedCount: myAcceptedOrders.length,
    firstAssigned: myAssignedOrders.length > 0 ? {
      id: myAssignedOrders[0]._id,
      coordinates: myAssignedOrders[0].pickupLocation?.coordinates,
      lat: myAssignedOrders[0].pickupLatitude,
      lng: myAssignedOrders[0].pickupLongitude
    } : null
  });
  
  // Log the complete Redux state structure for debugging
  console.log('%c Complete Redux State Structure:', 'background: #ffe6e6; color: #990000; font-weight: bold;', {
    adminState: useSelector(state => state.admin),
    deliveryState: useSelector(state => state.delivery)
  });
  
  // For debugging - log the admin store structure and sample orders
  console.log('%c Admin store structure:', 'background: #f8f8f8; color: #0066cc; font-weight: bold;', {
    ordersCount: adminOrders.length,
    confirmedOrdersCount: adminConfirmedOrders.length,
    ordersWithCoordinates: adminOrders.filter(o => o.pickupLatitude || o.pickupLongitude).length,
    confirmedWithCoordinates: adminConfirmedOrders.filter(o => o.pickupLatitude || o.pickupLongitude).length,
    sampleOrder: adminOrders.length > 0 ? {
      id: adminOrders[0]._id,
      pickupLat: adminOrders[0].pickupLatitude,
      pickupLng: adminOrders[0].pickupLongitude,
      deliveryLat: adminOrders[0].deliveryLatitude,
      deliveryLng: adminOrders[0].deliveryLongitude,
      pickupLocation: adminOrders[0].pickupLocation?.coordinates,
      deliveryLocation: adminOrders[0].deliveryLocation?.coordinates
    } : null,
    sampleConfirmed: adminConfirmedOrders.length > 0 ? {
      id: adminConfirmedOrders[0]._id,
      pickupLat: adminConfirmedOrders[0].pickupLatitude,
      pickupLng: adminConfirmedOrders[0].pickupLongitude,
      deliveryLat: adminConfirmedOrders[0].deliveryLatitude,
      deliveryLng: adminConfirmedOrders[0].deliveryLongitude,
      pickupLocation: adminConfirmedOrders[0].pickupLocation?.coordinates,
      deliveryLocation: adminConfirmedOrders[0].deliveryLocation?.coordinates
    } : null
  });
  
  // Helper function to check if coordinates are valid (not 0,0, not null, not NaN)
  const isValidCoordinate = (coord) => {
    if (!coord || !Array.isArray(coord) || coord.length < 2) return false;
    if (isNaN(coord[0]) || isNaN(coord[1])) return false;
    if (coord[0] === 0 && coord[1] === 0) return false;
    return true;
  };
  
  // Function to find matching admin order with better coordinates
  const getAdminOrderCoordinates = (orderId) => {
    if (!orderId) return null;
    
    // Check both admin orders and confirmed orders collections
    const allAdminOrders = [...adminOrders, ...adminConfirmedOrders];
    
    // Find matching order in admin store
    const adminOrder = allAdminOrders.find(o => o._id === orderId);
    if (!adminOrder) return null;
    
    console.log('%c Found matching admin order:', 'background: #e6ffee; color: #006633; font-weight: bold;', {
      orderId,
      // Direct lat/long fields
      pickupLat: adminOrder.pickupLatitude,
      pickupLng: adminOrder.pickupLongitude,
      deliveryLat: adminOrder.deliveryLatitude, 
      deliveryLng: adminOrder.deliveryLongitude,
      // GeoJSON format
      pickupGeoJSON: adminOrder.pickupLocation?.coordinates,
      deliveryGeoJSON: adminOrder.deliveryLocation?.coordinates,
      // Order details
      status: adminOrder.status,
      createdAt: adminOrder.createdAt
    });
    
    // Try different coordinate formats and pick the best available
    let pickupCoords = null;
    let deliveryCoords = null;
    
    // Check direct lat/long first
    if (adminOrder.pickupLatitude && adminOrder.pickupLongitude && 
        (adminOrder.pickupLatitude !== 0 || adminOrder.pickupLongitude !== 0)) {
      pickupCoords = [adminOrder.pickupLatitude, adminOrder.pickupLongitude];
      console.log('Using admin direct lat/long for pickup:', pickupCoords);
    } 
    // Fall back to GeoJSON format
    else if (adminOrder.pickupLocation?.coordinates && 
             adminOrder.pickupLocation.coordinates.length === 2 &&
             (adminOrder.pickupLocation.coordinates[0] !== 0 || adminOrder.pickupLocation.coordinates[1] !== 0)) {
      // GeoJSON uses [longitude, latitude] format, so we need to reverse for Leaflet
      pickupCoords = [adminOrder.pickupLocation.coordinates[1], adminOrder.pickupLocation.coordinates[0]];
      console.log('Using admin GeoJSON for pickup:', pickupCoords);
    }
    
    // Same for delivery coordinates
    if (adminOrder.deliveryLatitude && adminOrder.deliveryLongitude && 
        (adminOrder.deliveryLatitude !== 0 || adminOrder.deliveryLongitude !== 0)) {
      deliveryCoords = [adminOrder.deliveryLatitude, adminOrder.deliveryLongitude];
      console.log('Using admin direct lat/long for delivery:', deliveryCoords);
    } 
    // Fall back to GeoJSON format
    else if (adminOrder.deliveryLocation?.coordinates && 
             adminOrder.deliveryLocation.coordinates.length === 2 &&
             (adminOrder.deliveryLocation.coordinates[0] !== 0 || adminOrder.deliveryLocation.coordinates[1] !== 0)) {
      // GeoJSON uses [longitude, latitude] format, so we need to reverse for Leaflet
      deliveryCoords = [adminOrder.deliveryLocation.coordinates[1], adminOrder.deliveryLocation.coordinates[0]];
      console.log('Using admin GeoJSON for delivery:', deliveryCoords);
    }
    
    // Final validation check
    if (!isValidCoordinate(pickupCoords)) {
      console.warn('Invalid pickup coordinates after all checks:', pickupCoords);
      pickupCoords = null;
    }
    
    if (!isValidCoordinate(deliveryCoords)) {
      console.warn('Invalid delivery coordinates after all checks:', deliveryCoords);
      deliveryCoords = null;
    }
    
    return {
      pickup: pickupCoords,
      delivery: deliveryCoords
    };
  };

  const mapRef = useRef(null);
  const mapContainerRef = useRef(null);
  const agentMarkerRef = useRef(null);
  const pickupMarkerRef = useRef(null);
  const deliveryMarkerRef = useRef(null);
  const routeLineRef = useRef(null);
  const boundsTimerRef = useRef(null);
  const [isMapInitialized, setIsMapInitialized] = useState(false);
  const [mapError, setMapError] = useState(null);
  // Tracking previous coordinates to avoid unnecessary updates
  const prevAgentCoordsRef = useRef(null);
  const prevPickupCoordsRef = useRef(null); 
  const prevDeliveryCoordsRef = useRef(null);

    // Simple self-contained distance calculator to prevent reference errors
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    // Handle invalid coordinates with a simple check
    if (!lat1 || !lon1 || !lat2 || !lon2 || 
        isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2)) {
      return 9999; // Large value as fallback
    }
    
    // All-in-one calculation to avoid function references
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    const distance = R * c;
    
    // Return with 1 decimal place for simplicity
    return Math.round(distance * 10) / 10;
  };

  // Utility function to check if coordinates are valid (non-zero, non-NaN)
  const hasValidCoordinates = useCallback((coords) => {
    return coords && 
           Array.isArray(coords) && 
           coords.length === 2 && 
           (coords[0] !== 0 || coords[1] !== 0) &&
           !isNaN(coords[0]) && 
           !isNaN(coords[1]);
  }, []);

  // Extract and process coordinates as a separate function to ensure it reruns
  // when the agent location changes
  const getCoordinates = useCallback(() => {
    console.log('===== DeliveryMap Coordinate Processing =====');
    
    // Agent coordinates from position object or coordinates array
    let agentCoords = null;
    
    // First check if we're in My Deliveries view and agent has location
    // In My Deliveries view, the agent is the delivery person
    if (agentLocation?.coordinates && hasValidCoordinates(agentLocation.coordinates)) {
      // GeoJSON format is [longitude, latitude], reverse for Leaflet which uses [lat, lng]
      agentCoords = [agentLocation.coordinates[1], agentLocation.coordinates[0]];
      console.log('Agent coordinates (valid):', agentCoords);
    } else if (agentLocation?.latitude && agentLocation?.longitude) {
      agentCoords = [agentLocation.latitude, agentLocation.longitude];
      console.log('Agent plain coordinates (valid):', agentCoords);
    } else {
      console.warn('Invalid agent coordinates:', agentLocation);
    }
    
    // Process pickup coordinates - handle various data formats
    let pickupCoords = null;
    
    // Debug all possible pickup location sources
    console.log('Pickup coordinate sources:', {
      pickupLocation: pickupLocation?.coordinates,
      orderDetailsPickup: orderDetails?.pickupLocation?.coordinates,
      restaurantLocation: orderDetails?.restaurant?.location?.coordinates,
      postAuthorLocation: orderDetails?.items?.[0]?.post?.author?.location?.coordinates,
      myDeliveryOrders: {
        assigned: myAssignedOrders.length > 0 ? myAssignedOrders[0].pickupLocation?.coordinates : null,
        nearby: myNearbyOrders.length > 0 ? myNearbyOrders[0].pickupLocation?.coordinates : null,
        accepted: myAcceptedOrders.length > 0 ? myAcceptedOrders[0].pickupLocation?.coordinates : null
      }
    });
    
    // Try multiple sources for pickup coordinates - prioritized by most direct source first
    // 1. Direct pickupLocation parameter
    if (pickupLocation?.coordinates && hasValidCoordinates(pickupLocation.coordinates)) {
      pickupCoords = [pickupLocation.coordinates[1], pickupLocation.coordinates[0]];
      console.log('Using pickupLocation coordinates (direct parameter):', pickupCoords);
    } 
    // 2. Order details pickup location
    else if (orderDetails?.pickupLocation?.coordinates && hasValidCoordinates(orderDetails.pickupLocation.coordinates)) {
      pickupCoords = [orderDetails.pickupLocation.coordinates[1], orderDetails.pickupLocation.coordinates[0]];
      console.log('Using orderDetails.pickupLocation coordinates:', pickupCoords);
    }
    // 3. Check for coordinates in assigned delivery orders
    else if (myAssignedOrders.length > 0 && myAssignedOrders[0].pickupLocation?.coordinates && 
             hasValidCoordinates(myAssignedOrders[0].pickupLocation.coordinates)) {
      pickupCoords = [myAssignedOrders[0].pickupLocation.coordinates[1], myAssignedOrders[0].pickupLocation.coordinates[0]];
      console.log('Using myAssignedOrders pickup coordinates:', pickupCoords);
    }
    // 4. Check for coordinates in accepted delivery orders
    else if (myAcceptedOrders.length > 0 && myAcceptedOrders[0].pickupLocation?.coordinates && 
             hasValidCoordinates(myAcceptedOrders[0].pickupLocation.coordinates)) {
      pickupCoords = [myAcceptedOrders[0].pickupLocation.coordinates[1], myAcceptedOrders[0].pickupLocation.coordinates[0]];
      console.log('Using myAcceptedOrders pickup coordinates:', pickupCoords);
    }
    // 5. Check for coordinates in nearby delivery orders
    else if (myNearbyOrders.length > 0 && myNearbyOrders[0].pickupLocation?.coordinates && 
             hasValidCoordinates(myNearbyOrders[0].pickupLocation.coordinates)) {
      pickupCoords = [myNearbyOrders[0].pickupLocation.coordinates[1], myNearbyOrders[0].pickupLocation.coordinates[0]];
      console.log('Using myNearbyOrders pickup coordinates:', pickupCoords);
    }
    // 3. Restaurant location
    else if (orderDetails?.restaurant?.location?.coordinates && hasValidCoordinates(orderDetails.restaurant.location.coordinates)) {
      pickupCoords = [orderDetails.restaurant.location.coordinates[1], orderDetails.restaurant.location.coordinates[0]];
      console.log('Using restaurant location coordinates for pickup:', pickupCoords);
    }
    // 4. Post author location as last resort
    else if (orderDetails?.items?.[0]?.post?.author?.location?.coordinates && 
             hasValidCoordinates(orderDetails.items[0].post.author.location.coordinates)) {
      pickupCoords = [orderDetails.items[0].post.author.location.coordinates[1], 
                     orderDetails.items[0].post.author.location.coordinates[0]];
      console.log('Using post author location coordinates for pickup:', pickupCoords);
    } else {
      console.warn('No valid pickup coordinates found from any source');
    }
    
    // Process delivery coordinates - handle various data formats
    let deliveryCoords = null;
    
    // Debug all possible delivery location sources
    console.log('Delivery coordinate sources:', {
      deliveryLocation: deliveryLocation?.coordinates,
      orderDetailsDelivery: orderDetails?.deliveryLocation?.coordinates,
      userLocation: orderDetails?.userLocation?.coordinates,
      userObjectLocation: orderDetails?.user?.location?.coordinates,
      myDeliveryOrders: {
        assigned: myAssignedOrders.length > 0 ? myAssignedOrders[0].deliveryLocation?.coordinates : null,
        nearby: myNearbyOrders.length > 0 ? myNearbyOrders[0].deliveryLocation?.coordinates : null,
        accepted: myAcceptedOrders.length > 0 ? myAcceptedOrders[0].deliveryLocation?.coordinates : null
      }
    });
    
    // Try multiple sources for delivery coordinates - prioritized by most direct source first
    // 1. Direct deliveryLocation parameter
    if (deliveryLocation?.coordinates && hasValidCoordinates(deliveryLocation.coordinates)) {
      deliveryCoords = [deliveryLocation.coordinates[1], deliveryLocation.coordinates[0]];
      console.log('Using deliveryLocation coordinates (direct parameter):', deliveryCoords);
    }
    // 2. Order details delivery location
    else if (orderDetails?.deliveryLocation?.coordinates && hasValidCoordinates(orderDetails.deliveryLocation.coordinates)) {
      deliveryCoords = [orderDetails.deliveryLocation.coordinates[1], orderDetails.deliveryLocation.coordinates[0]];
      console.log('Using orderDetails.deliveryLocation coordinates:', deliveryCoords);
    }
    // 3. Check for coordinates in assigned delivery orders
    else if (myAssignedOrders.length > 0 && myAssignedOrders[0].deliveryLocation?.coordinates && 
             hasValidCoordinates(myAssignedOrders[0].deliveryLocation.coordinates)) {
      deliveryCoords = [myAssignedOrders[0].deliveryLocation.coordinates[1], myAssignedOrders[0].deliveryLocation.coordinates[0]];
      console.log('Using myAssignedOrders delivery coordinates:', deliveryCoords);
    }
    // 4. Check for coordinates in accepted delivery orders
    else if (myAcceptedOrders.length > 0 && myAcceptedOrders[0].deliveryLocation?.coordinates && 
             hasValidCoordinates(myAcceptedOrders[0].deliveryLocation.coordinates)) {
      deliveryCoords = [myAcceptedOrders[0].deliveryLocation.coordinates[1], myAcceptedOrders[0].deliveryLocation.coordinates[0]];
      console.log('Using myAcceptedOrders delivery coordinates:', deliveryCoords);
    }
    // 5. Check for coordinates in nearby delivery orders
    else if (myNearbyOrders.length > 0 && myNearbyOrders[0].deliveryLocation?.coordinates && 
             hasValidCoordinates(myNearbyOrders[0].deliveryLocation.coordinates)) {
      deliveryCoords = [myNearbyOrders[0].deliveryLocation.coordinates[1], myNearbyOrders[0].deliveryLocation.coordinates[0]];
      console.log('Using myNearbyOrders delivery coordinates:', deliveryCoords);
    }
    // 6. User location from order object
    else if (orderDetails?.userLocation?.coordinates && hasValidCoordinates(orderDetails.userLocation.coordinates)) {
      deliveryCoords = [orderDetails.userLocation.coordinates[1], orderDetails.userLocation.coordinates[0]];
      console.log('Using userLocation coordinates for delivery:', deliveryCoords);
    } 
    // 7. User object location as fallback
    else if (orderDetails?.user?.location?.coordinates && hasValidCoordinates(orderDetails.user.location.coordinates)) {
      deliveryCoords = [orderDetails.user.location.coordinates[1], orderDetails.user.location.coordinates[0]];
      console.log('Using user.location coordinates for delivery:', deliveryCoords);
    } else {
      console.warn('No valid delivery coordinates found from any source');
    }
    
    // Check if we have at least one valid set of coordinates
    const hasValidPoints = 
      (agentCoords && Array.isArray(agentCoords) && agentCoords.length === 2 && 
       !isNaN(agentCoords[0]) && !isNaN(agentCoords[1]) && 
       (agentCoords[0] !== 0 || agentCoords[1] !== 0)) ||
      (pickupCoords && Array.isArray(pickupCoords) && pickupCoords.length === 2 && 
       !isNaN(pickupCoords[0]) && !isNaN(pickupCoords[1]) && 
       (pickupCoords[0] !== 0 || pickupCoords[1] !== 0)) ||
      (deliveryCoords && Array.isArray(deliveryCoords) && deliveryCoords.length === 2 && 
       !isNaN(deliveryCoords[0]) && !isNaN(deliveryCoords[1]) && 
       (deliveryCoords[0] !== 0 || deliveryCoords[1] !== 0));
    
    // Log final coordinate results
    console.log('Final coordinates for map:', {
      agent: agentCoords,
      pickup: pickupCoords,
      delivery: deliveryCoords,
      hasValidPoints: hasValidPoints
    });
    
    // Return coordinates and validity check
    return {
      agentCoords,
      pickupCoords,
      deliveryCoords,
      // Map is valid if we have at least one valid set of coordinates
      isValid: hasValidPoints
    };
  }, [agentLocation, pickupLocation, deliveryLocation]);

  // Helper to check if coordinates have changed significantly
  const haveCoordsChanged = useCallback((oldCoords, newCoords) => {
    if (!oldCoords || !newCoords) return true;
    if (!oldCoords[0] || !newCoords[0]) return true;
    
    // Only update if difference is more than 0.00001 (about 1 meter)
    const threshold = 0.00001;
    return Math.abs(oldCoords[0] - newCoords[0]) > threshold ||
           Math.abs(oldCoords[1] - newCoords[1]) > threshold;
  }, []);

  // Initialize the map once when the component mounts
  useEffect(() => {
    // Flag to track if component is mounted
    let isMounted = true;
    
    // Function to safely set state only if component is still mounted
    const safeSetState = (stateSetter, newValue) => {
      if (isMounted) {
        stateSetter(newValue);
      }
    };
    
    // Function to check if map container exists and initialize map
    const initMapWithDelay = () => {
      let attemptCount = 0;
      const maxAttempts = 10;
      
      // Function that will repeatedly try to initialize the map
      const attemptInit = () => {
        try {
          if (!mapContainerRef.current) {
            console.log(`Map container not ready, attempt ${attemptCount + 1}/${maxAttempts}`);
            if (attemptCount < maxAttempts && isMounted) {
              attemptCount++;
              // Try again in 500ms
              setTimeout(attemptInit, 500);
            } else if (isMounted) {
              console.error("Max attempts reached, map container not available");
              safeSetState(setMapError, "Could not initialize map: container not found");
            }
            return;
          }
        
        // If map is already initialized, don't try to initialize again
        if (mapRef.current) {
          console.log("Map already initialized");
          return;
        }
        
        // Force map container to be visible before initializing
        if (mapContainerRef.current) {
          mapContainerRef.current.style.height = height;
          mapContainerRef.current.style.visibility = 'visible';
          mapContainerRef.current.style.display = 'block';
        }
        
        // Even if coordinates are invalid, we'll initialize the map with defaults
        // This ensures the map container is always visible
        console.log("Initializing map with coordinates valid =", isValid);
        
        console.log("Initializing map...");
        
        // Calculate center point and bounds for initial view
        let allPoints = [];
        if (agentCoords && agentCoords[0] && agentCoords[1]) allPoints.push(agentCoords);
        if (pickupCoords && pickupCoords[0] && pickupCoords[1]) allPoints.push(pickupCoords);
        if (deliveryCoords && deliveryCoords[0] && deliveryCoords[1]) allPoints.push(deliveryCoords);
        
        // If we don't have any valid points, check if this is the My Deliveries view
        // and use a fallback point based on the user's likely location
        if (allPoints.length === 0) {
          console.log("No valid coordinates found, using fallback");
          
          // These are just example fallback coordinates (New York City) - adjust as needed
          // In a real app, you'd use the user's last known location or city center
          const fallbackCoords = [40.7128, -74.0060]; // NYC coordinates
          allPoints.push(fallbackCoords);
          
          // Don't show the error message if we're using fallback coordinates
          setMapError("Using default map view. Location data unavailable.");
        }
        
        // Use a reasonable default center if no coordinates are available
        // Default to somewhere in the center of most cities (adjust as needed)
        const defaultCenter = [40.7128, -74.0060]; // NYC coordinates as fallback
        const initialCenter = allPoints.length > 0 ? allPoints[0] : defaultCenter;
        
        mapRef.current = L.map(mapContainerRef.current, {
          center: initialCenter,
          zoom: zoom,
          zoomControl: true,
          attributionControl: true,
          // Disable animations that may cause flickering
          fadeAnimation: false,
          zoomAnimation: false,
          markerZoomAnimation: false
        });
        
        // Add a better tile layer with higher contrast and better colors
        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
          subdomains: 'abcd',
          maxZoom: 19,
          className: 'map-tiles'
        }).addTo(mapRef.current);
        
        // Add scale control
        L.control.scale({ 
          imperial: false, 
          position: 'bottomright'
        }).addTo(mapRef.current);
        
        // Make sure the map is properly sized
        mapRef.current.invalidateSize({ animate: false });
        
        // Fit map to show all points
        if (allPoints.length > 1) {
          const bounds = L.latLngBounds(allPoints);
          mapRef.current.fitBounds(bounds, { 
            padding: [50, 50],
            animate: false
          });
        } else if (allPoints.length === 1) {
          mapRef.current.setView(allPoints[0], zoom, { animate: false });
        }
        
        safeSetState(setIsMapInitialized, true);
        console.log("Map initialized successfully");
      } catch (error) {
        console.error("Error initializing map:", error);
        safeSetState(setMapError, `Error initializing map: ${error.message}`);
      }
    };
    
    // Start the initialization process with a small delay
    const initTimeout = setTimeout(() => initMapWithDelay(), 300);
    
    // Cleanup on unmount only
    return () => {
      // Mark component as unmounted to prevent setState calls
      isMounted = false;
      
      // Clear any pending timeouts first
      clearTimeout(initTimeout);
      if (boundsTimerRef.current) {
        clearTimeout(boundsTimerRef.current);
        boundsTimerRef.current = null;
      }

      // Always nullify these refs first to prevent React from trying to access them later
      prevAgentCoordsRef.current = null;
      prevPickupCoordsRef.current = null;
      prevDeliveryCoordsRef.current = null;

      // Safely remove map and all its layers to prevent memory leaks
      try {
        // First, clear all layers if the map exists
        if (mapRef.current) {
          console.log("Cleaning up map resources");
          
          // Explicitly remove all markers before removing the map
          if (agentMarkerRef.current) {
            agentMarkerRef.current.remove();
            agentMarkerRef.current = null;
          }
          
          if (pickupMarkerRef.current) {
            pickupMarkerRef.current.remove();
            pickupMarkerRef.current = null;
          }
          
          if (deliveryMarkerRef.current) {
            deliveryMarkerRef.current.remove();
            deliveryMarkerRef.current = null;
          }
          
          if (routeLineRef.current) {
            routeLineRef.current.remove();
            routeLineRef.current = null;
          }
          
          // Finally remove the map itself
          mapRef.current.remove();
          mapRef.current = null;
        }
      } catch (error) {
        console.error("Error during map cleanup:", error);
      }
    };
  }, []); // Empty dependency array, only run once on mount

  // Create or update markers on the map
  const createOrUpdateMarkers = useCallback(() => {
    if (!mapRef.current || !isMapInitialized) return;
    
    try {
      console.log('Creating or updating map markers...');
      
      // Get latest coordinate data
      const { agentCoords, pickupCoords, deliveryCoords } = getCoordinates();
      
      // Store valid points for bounds calculation
      const validPoints = [];
      
      // Create or update agent marker
      if (agentCoords && agentCoords[0] && agentCoords[1] && 
          !isNaN(agentCoords[0]) && !isNaN(agentCoords[1])) {
        
        validPoints.push(agentCoords);
        console.log('Creating/updating agent marker at:', agentCoords);
        
        if (agentMarkerRef.current) {
          agentMarkerRef.current.setLatLng(agentCoords);
        } else {
          // Create a better agent marker with custom icon
          const agentIcon = L.divIcon({
            className: 'agent-marker',
            html: `<div class="flex items-center justify-center w-8 h-8 rounded-full bg-blue-500 border-2 border-white shadow-lg">
                   <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor">
                     <path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6z" />
                   </svg>
                 </div>`,
            iconSize: [32, 32],
            iconAnchor: [16, 16]
          });
          
          agentMarkerRef.current = L.marker(agentCoords, { icon: agentIcon })
            .addTo(mapRef.current)
            .bindTooltip('Your Location');
        }
        prevAgentCoordsRef.current = [...agentCoords];
      } else if (!agentCoords && agentMarkerRef.current) {
        mapRef.current.removeLayer(agentMarkerRef.current);
        agentMarkerRef.current = null;
        prevAgentCoordsRef.current = null;
        console.warn('Invalid agent coordinates for marker', agentCoords);
      }
      
      // Create or update pickup marker
      if (pickupCoords && pickupCoords[0] && pickupCoords[1] && 
          !isNaN(pickupCoords[0]) && !isNaN(pickupCoords[1])) {
        
        validPoints.push(pickupCoords);
        console.log('Creating/updating pickup marker at:', pickupCoords);
        
        if (pickupMarkerRef.current) {
          pickupMarkerRef.current.setLatLng(pickupCoords);
        } else {
          // Create a better pickup marker with custom icon
          const pickupIcon = L.divIcon({
            className: 'pickup-marker',
            html: `<div class="pickup-marker-icon" style="position: relative;">
                    <div class="pickup-marker-bg" style="background-color: #FF5722; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 0 4px rgba(255, 87, 34, 0.4), 0 0 0 8px rgba(255, 87, 34, 0.2);">
                      <svg viewBox="0 0 24 24" width="18" height="18" stroke="white" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
                      </svg>
                    </div>
                    <div style="position: absolute; top: -12px; left: 50%; transform: translateX(-50%); background-color: #FF5722; color: white; font-weight: bold; padding: 2px 6px; border-radius: 4px; font-size: 10px; white-space: nowrap;">PICKUP</div>
                  </div>`,
            iconSize: [40, 40],
            iconAnchor: [20, 20]
          });
          
          // Create a more detailed popup content for the pickup location
          const restaurantName = orderDetails?.restaurant?.name || "Restaurant";
          const orderId = orderDetails?._id ? `#${orderDetails._id.slice(-6)}` : "";
          const orderItems = orderDetails?.items?.length || 0;
          
          const popupContent = `
            <div style="min-width: 180px;">
              <div style="font-weight: bold; color: #FF5722; font-size: 14px; margin-bottom: 4px;">
                ${restaurantName}
              </div>
              <div style="font-size: 12px; margin-bottom: 4px;">
                <span style="font-weight: bold;">Pickup for Order:</span> ${orderId}
              </div>
              <div style="font-size: 12px; margin-bottom: 4px;">
                <span style="font-weight: bold;">Items:</span> ${orderItems}
              </div>
              <div style="font-size: 12px; margin-bottom: 4px;">
                <span style="font-weight: bold;">Status:</span> ${orderStatus || 'confirmed'}
              </div>
              <div style="font-size: 12px; margin-bottom: 4px;">
                <span style="font-weight: bold;">Coordinates:</span> ${pickupCoords[0].toFixed(5)}, ${pickupCoords[1].toFixed(5)}
              </div>
              <div style="background-color: #f0f0f0; padding: 6px; border-radius: 4px; margin-top: 6px; font-size: 11px;">
                This is the pickup location for your order. After pickup, proceed to the delivery location.
              </div>
            </div>
          `;
          
          pickupMarkerRef.current = L.marker(pickupCoords, { 
            icon: pickupIcon,
            riseOnHover: true,
            title: `Pickup: ${restaurantName}`,
            zIndexOffset: 900 // High z-index to ensure it's visible
          })
            .addTo(mapRef.current)
            .bindPopup(popupContent, {
              maxWidth: 250,
              closeButton: true
            });
        }
        prevPickupCoordsRef.current = [...pickupCoords];
      } else if (!pickupCoords && pickupMarkerRef.current) {
        mapRef.current.removeLayer(pickupMarkerRef.current);
        pickupMarkerRef.current = null;
        prevPickupCoordsRef.current = null;
        console.warn('Invalid pickup coordinates for marker', pickupCoords);
      }
      
      // Try to get admin coordinates if the current order coordinates are missing or zero
      if (orderDetails?._id && 
          (!deliveryCoords || 
           !deliveryCoords[0] || 
           (deliveryCoords[0] === 0 && deliveryCoords[1] === 0))) {
        
        // Use the getAdminOrderCoordinates function we defined at component level
        const adminCoordinates = getAdminOrderCoordinates(orderDetails._id);
        
        if (adminCoordinates) {
          // Use admin delivery coordinates if available
          if (adminCoordinates.delivery) {
            deliveryCoords = adminCoordinates.delivery;
            console.log('Using admin store delivery coordinates:', deliveryCoords);
          }
          
          // Use admin pickup coordinates if available and needed
          if (adminCoordinates.pickup && 
              (!pickupCoords || (pickupCoords[0] === 0 && pickupCoords[1] === 0))) {
            pickupCoords = adminCoordinates.pickup;
            console.log('Using admin store pickup coordinates:', pickupCoords);
            
            // If we've already processed the pickup marker, remove it so we can recreate with new coords
            if (prevPickupCoordsRef.current && pickupMarkerRef.current) {
              mapRef.current.removeLayer(pickupMarkerRef.current);
              pickupMarkerRef.current = null;
              prevPickupCoordsRef.current = null;
            }
          }
        }
      }
      
      // Create or update delivery marker
      if (deliveryCoords && deliveryCoords[0] && deliveryCoords[1] && 
          !isNaN(deliveryCoords[0]) && !isNaN(deliveryCoords[1])) {
        
        validPoints.push(deliveryCoords);
        console.log('Creating/updating delivery marker at:', deliveryCoords);
        
        if (deliveryMarkerRef.current) {
          deliveryMarkerRef.current.setLatLng(deliveryCoords);
        } else {
          // Create a better delivery marker with custom icon
          const deliveryIcon = L.divIcon({
            className: 'delivery-marker',
            html: `<div class="delivery-marker-icon" style="position: relative;">
                    <div class="delivery-marker-bg" style="background-color: #10b981; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.4), 0 0 0 8px rgba(16, 185, 129, 0.2);">
                      <svg viewBox="0 0 24 24" width="18" height="18" stroke="white" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                        <polyline points="9 22 9 12 15 12 15 22"></polyline>
                      </svg>
                    </div>
                    <div style="position: absolute; top: -12px; left: 50%; transform: translateX(-50%); background-color: #10b981; color: white; font-weight: bold; padding: 2px 6px; border-radius: 4px; font-size: 10px; white-space: nowrap;">DELIVERY</div>
                  </div>`,
            iconSize: [40, 40],
            iconAnchor: [20, 20]
          });
          
          // Create a more detailed popup for delivery location
          const customerName = orderDetails?.user?.username || "Customer";
          const deliveryAddress = orderDetails?.deliveryAddress || "Address not available";
          const contactNumber = orderDetails?.contactNumber || "No contact number";
          
          const deliveryPopupContent = `
            <div style="min-width: 180px;">
              <div style="font-weight: bold; color: #10b981; font-size: 14px; margin-bottom: 4px;">
                Delivery Location
              </div>
              <div style="font-size: 12px; margin-bottom: 4px;">
                <span style="font-weight: bold;">Customer:</span> ${customerName}
              </div>
              <div style="font-size: 12px; margin-bottom: 4px;">
                <span style="font-weight: bold;">Address:</span> ${deliveryAddress}
              </div>
              <div style="font-size: 12px; margin-bottom: 4px;">
                <span style="font-weight: bold;">Contact:</span> ${contactNumber}
              </div>
              <div style="font-size: 12px; margin-bottom: 4px;">
                <span style="font-weight: bold;">Coordinates:</span> ${deliveryCoords[0].toFixed(5)}, ${deliveryCoords[1].toFixed(5)}
              </div>
              <div style="background-color: #f0f0f0; padding: 6px; border-radius: 4px; margin-top: 6px; font-size: 11px;">
                This is the delivery destination. Complete the delivery and mark as delivered when done.
              </div>
            </div>
          `;
          
          deliveryMarkerRef.current = L.marker(deliveryCoords, { 
            icon: deliveryIcon,
            riseOnHover: true,
            title: "Delivery Location",
            zIndexOffset: 800 // High z-index but lower than pickup
          })
            .addTo(mapRef.current)
            .bindPopup(deliveryPopupContent, {
              maxWidth: 250,
              closeButton: true
            });
        }
        prevDeliveryCoordsRef.current = [...deliveryCoords];
      } else if (!deliveryCoords && deliveryMarkerRef.current) {
        mapRef.current.removeLayer(deliveryMarkerRef.current);
        deliveryMarkerRef.current = null;
        prevDeliveryCoordsRef.current = null;
        console.warn('Invalid delivery coordinates for marker', deliveryCoords);
      }
      
      // If we have at least two valid points, fit bounds to include all points
      if (validPoints.length >= 2) {
        console.log(`Fitting map to ${validPoints.length} valid points:`, validPoints);
        mapRef.current.fitBounds(validPoints, {
          padding: [50, 50],
          maxZoom: 15
        });
      } else if (validPoints.length === 1) {
        // If only one valid point, center on it
        console.log('Centering map on single valid point:', validPoints[0]);
        mapRef.current.setView(validPoints[0], 15);
      }
      
      return validPoints.length > 0;
    } catch (error) {
      console.error('Error creating/updating markers:', error);
      setMapError(`Error updating map markers: ${error.message}`);
      return false;
    }
  }, [agentLocation, pickupLocation, deliveryLocation, orderDetails, orderStatus, isMapInitialized, getCoordinates, hasValidCoordinates]);

  // Update markers and routes separately from map initialization
  useEffect(() => {
    if (!mapRef.current || !isMapInitialized) return;
    
    try {
      const { agentCoords, pickupCoords, deliveryCoords, isValid } = getCoordinates();
      if (!isValid) return;
      
      // Check if any coordinate has changed significantly before updating
      const agentChanged = haveCoordsChanged(prevAgentCoordsRef.current, agentCoords);
      const pickupChanged = haveCoordsChanged(prevPickupCoordsRef.current, pickupCoords);
      const deliveryChanged = haveCoordsChanged(prevDeliveryCoordsRef.current, deliveryCoords);
      
      if (!agentChanged && !pickupChanged && !deliveryChanged && 
          agentMarkerRef.current && 
          ((pickupMarkerRef.current && pickupCoords) || !pickupCoords) && 
          ((deliveryMarkerRef.current && deliveryCoords) || !deliveryCoords)) {
        // No significant changes, skip update
        return;
      }
      
      console.log("Updating map markers and routes");
      
      // Safe invalidate size without animations to prevent flickering
      mapRef.current.invalidateSize({ animate: false });
      
      // Update markers
      const markersCreated = createOrUpdateMarkers();
      if (!markersCreated) return;
      
      // Draw route lines based on order status and available points
      // Use coordinate values directly from the refs to avoid redeclaration
      if (routeLineRef.current) {
        mapRef.current.removeLayer(routeLineRef.current);
        routeLineRef.current = null;
      }
      
      // Draw route lines based on order status and available points
      try {
        const routePoints = [];
        
        // Create the appropriate routes based on order status
        if (orderStatus === "confirmed" || orderStatus === "preparing" || !orderStatus) {
          // If we're in pickup phase, show route from agent to pickup
          if (agentMarkerRef.current && pickupMarkerRef.current) {
            const agentPos = agentMarkerRef.current.getLatLng();
            const pickupPos = pickupMarkerRef.current.getLatLng();
            
            if (agentPos && pickupPos) {
              console.log('Drawing route from agent to pickup');
              routePoints.push([agentPos.lat, agentPos.lng], [pickupPos.lat, pickupPos.lng]);
              
              try {
                // Create a route line
                routeLineRef.current = L.polyline(routePoints, {
                  color: '#3B82F6', // Blue route
                  weight: 4,
                  opacity: 0.7,
                  dashArray: '10, 10',
                  lineJoin: 'round'
                }).addTo(mapRef.current);
              } catch (routeError) {
                console.error('Error creating pickup route line:', routeError);
              }
            }
          }
        } else if (orderStatus === "picked_up" || orderStatus === "on_the_way") {
          // If we're in delivery phase, show route from agent to delivery
          if (agentMarkerRef.current && deliveryMarkerRef.current) {
            const agentPos = agentMarkerRef.current.getLatLng();
            const deliveryPos = deliveryMarkerRef.current.getLatLng();
            
            if (agentPos && deliveryPos) {
              console.log('Drawing route from agent to delivery');
              routePoints.push([agentPos.lat, agentPos.lng], [deliveryPos.lat, deliveryPos.lng]);
              
              try {
                // Create a route line
                routeLineRef.current = L.polyline(routePoints, {
                  color: '#10B981', // Green route for delivery
                  weight: 4,
                  opacity: 0.7,
                  dashArray: '10, 10',
                  lineJoin: 'round'
                }).addTo(mapRef.current);
              } catch (routeError) {
                console.error('Error creating delivery route line:', routeError);
              }
            }
          }
        }
      } catch (error) {
        console.error('Error drawing route lines:', error);
      }
      
      // Create or update pickup marker
      if (pickupCoords && pickupCoords[0] && pickupCoords[1] && 
          !isNaN(pickupCoords[0]) && !isNaN(pickupCoords[1])) {
          
        validPoints.push(pickupCoords);
        console.log('Creating/updating pickup marker at:', pickupCoords);
          
        if (pickupMarkerRef.current && !pickupChanged) {
          // No need to update the marker if coordinates haven't changed
        } else if (pickupMarkerRef.current && pickupChanged) {
          pickupMarkerRef.current.setLatLng(pickupCoords);
        } else {
          // Create pickup marker with a custom icon
          const pickupIcon = L.divIcon({
            className: 'pickup-marker',
            html: `<div class="pickup-marker-icon" style="position: relative;">
                    <div class="pickup-marker-bg" style="background-color: #3B82F6; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.4), 0 0 0 8px rgba(59, 130, 246, 0.2);">
                      <svg viewBox="0 0 24 24" width="18" height="18" stroke="white" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                        <circle cx="12" cy="10" r="3"></circle>
                      </svg>
                    </div>
                    <div style="position: absolute; top: -12px; left: 50%; transform: translateX(-50%); background-color: #3B82F6; color: white; font-weight: bold; padding: 2px 6px; border-radius: 4px; font-size: 10px; white-space: nowrap;">PICKUP</div>
                  </div>`,
            iconSize: [40, 40],
            iconAnchor: [20, 20]
          });
          
          // Create a more detailed popup for pickup location
          const restaurantName = orderDetails?.restaurant?.name || "Restaurant";
          const restaurantAddress = orderDetails?.restaurant?.address || "Address not available";
          const popupContent = `
            <div style="min-width: 180px;">
              <div style="font-weight: bold; color: #3B82F6; font-size: 14px; margin-bottom: 4px;">
                Pickup Location
              </div>
              <div style="font-size: 12px; margin-bottom: 4px;">
                <span style="font-weight: bold;">Restaurant:</span> ${restaurantName}
              </div>
              <div style="font-size: 12px; margin-bottom: 4px;">
                <span style="font-weight: bold;">Address:</span> ${restaurantAddress}
              </div>
              <div style="background-color: #f0f0f0; padding: 6px; border-radius: 4px; margin-top: 6px; font-size: 11px;">
                Pick up the order from this restaurant and mark as picked up when done.
              </div>
            </div>
          `;
          
          pickupMarkerRef.current = L.marker(pickupCoords, { 
            icon: pickupIcon,
            riseOnHover: true,
            title: `Pickup: ${restaurantName}`,
            zIndexOffset: 900 // High z-index to ensure it's visible
          })
            .addTo(mapRef.current)
            .bindPopup(popupContent, {
              maxWidth: 250,
              closeButton: true
            });
            
          // Auto-open the popup to highlight the pickup location
          pickupMarkerRef.current.openPopup();
        }
        
        prevPickupCoordsRef.current = [...pickupCoords];
      } else if (!pickupCoords && pickupMarkerRef.current) {
        mapRef.current.removeLayer(pickupMarkerRef.current);
        pickupMarkerRef.current = null;
        prevPickupCoordsRef.current = null;
      }
      
      // Update delivery marker
      if (deliveryCoords && deliveryCoords[0] && deliveryCoords[1]) {
        if (deliveryMarkerRef.current && !deliveryChanged) {
          // No need to update
        } else if (deliveryMarkerRef.current && deliveryChanged) {
          deliveryMarkerRef.current.setLatLng(deliveryCoords);
        } else {
          const deliveryIcon = L.divIcon({
            className: 'delivery-marker',
            html: `<div class="delivery-marker-icon" style="position: relative;">
                    <div class="delivery-marker-bg" style="background-color: #10b981; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.4), 0 0 0 8px rgba(16, 185, 129, 0.2);">
                      <svg viewBox="0 0 24 24" width="18" height="18" stroke="white" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                        <polyline points="9 22 9 12 15 12 15 22"></polyline>
                      </svg>
                    </div>
                    <div style="position: absolute; top: -12px; left: 50%; transform: translateX(-50%); background-color: #10b981; color: white; font-weight: bold; padding: 2px 6px; border-radius: 4px; font-size: 10px; white-space: nowrap;">DELIVERY</div>
                  </div>`,
            iconSize: [40, 40],
            iconAnchor: [20, 20]
          });
          
          // Create a more detailed popup for delivery location
          const customerName = orderDetails?.user?.username || "Customer";
          const deliveryAddress = orderDetails?.deliveryAddress || "Address not available";
          const contactNumber = orderDetails?.contactNumber || "No contact number";
          
          const deliveryPopupContent = `
            <div style="min-width: 180px;">
              <div style="font-weight: bold; color: #10b981; font-size: 14px; margin-bottom: 4px;">
                Delivery Location
              </div>
              <div style="font-size: 12px; margin-bottom: 4px;">
                <span style="font-weight: bold;">Customer:</span> ${customerName}
              </div>
              <div style="font-size: 12px; margin-bottom: 4px;">
                <span style="font-weight: bold;">Address:</span> ${deliveryAddress}
              </div>
              <div style="font-size: 12px; margin-bottom: 4px;">
                <span style="font-weight: bold;">Contact:</span> ${contactNumber}
              </div>
              <div style="background-color: #f0f0f0; padding: 6px; border-radius: 4px; margin-top: 6px; font-size: 11px;">
                This is the delivery destination. Complete the delivery and mark as delivered when done.
              </div>
            </div>
          `;
          
          deliveryMarkerRef.current = L.marker(deliveryCoords, { 
            icon: deliveryIcon,
            riseOnHover: true,
            title: "Delivery Location",
            zIndexOffset: 800 // High z-index but lower than pickup
          })
            .addTo(mapRef.current)
            .bindPopup(deliveryPopupContent, {
              maxWidth: 250,
              closeButton: true
            });
        }
        
        prevDeliveryCoordsRef.current = [...deliveryCoords];
      } else if (!deliveryCoords && deliveryMarkerRef.current) {
        mapRef.current.removeLayer(deliveryMarkerRef.current);
        deliveryMarkerRef.current = null;
        prevDeliveryCoordsRef.current = null;
      }
      
      // Fit map bounds to include all markers
      if (validPoints.length >= 2) {
        try {
          console.log('Fitting map bounds to include all markers:', validPoints);
          const bounds = L.latLngBounds(validPoints);
          mapRef.current.fitBounds(bounds, { 
            padding: [50, 50],
            maxZoom: 15
          });
        } catch (error) {
          console.error('Error fitting map bounds:', error);
        }
      } else if (validPoints.length === 1) {
        // If only one valid point, center on it
        console.log('Centering map on single valid point:', validPoints[0]);
        mapRef.current.setView(validPoints[0], 15);
      }
      
      return validPoints.length > 0;
    } catch (error) {
      console.error('Error creating/updating markers:', error);
      setMapError(`Error updating map markers: ${error.message}`);
      return false;
    }
  }, [agentLocation, pickupLocation, deliveryLocation, orderDetails, orderStatus, isMapInitialized, getCoordinates, hasValidCoordinates]);
  
  // If no valid coordinates, show fallback
  const { agentCoords, isValid } = getCoordinates();
    
  if (!isValid) {
    return (
      <div 
        className="bg-gray-100 rounded-lg flex items-center justify-center"
        style={{ height }}
      >
        <div className="text-center text-gray-500">
          <MdMyLocation size={24} className="mx-auto mb-2" />
          <p className="text-sm">Location not available</p>
          <button 
            className="mt-2 px-2 py-1 text-xs bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200"
            onClick={() => window.location.reload()}
          >
            Reload page
          </button>
        </div>
      </div>
    );
  }

  // If error occurred during map initialization
  if (mapError) {
    return (
      <div 
        className="bg-red-50 rounded-lg flex items-center justify-center border border-red-200"
        style={{ height }}
      >
        <div className="text-center text-red-500 p-4">
          <MdInfo size={30} className="mx-auto mb-2" />
          <p className="text-sm mb-2">{mapError}</p>
          <button 
            className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 mr-2"
            onClick={() => window.location.reload()}
          >
            Reload page
          </button>
        </div>
      </div>
    );
  }

  // Display distance information
  const getDistanceInfo = () => {
    const { agentCoords, pickupCoords, deliveryCoords } = getCoordinates();
      
    let distanceInfo = null;

    if (orderStatus === "confirmed" || orderStatus === "preparing") {
      if (agentCoords?.[0] && pickupCoords && pickupCoords[0]) {
        const distance = calculateDistance(
          agentCoords[0], agentCoords[1], 
          pickupCoords[0], pickupCoords[1]
        );
        distanceInfo = { 
          text: `${distance} km to pickup location`,
          type: 'pickup'
        };
      }
    } else if (orderStatus === "out_for_delivery" || orderStatus === "picked_up" || orderStatus === "on_the_way") {
      if (agentCoords?.[0] && deliveryCoords && deliveryCoords[0]) {
        const distance = calculateDistance(
          agentCoords[0], agentCoords[1], 
          deliveryCoords[0], deliveryCoords[1]
        );
        distanceInfo = { 
          text: `${distance} km to delivery location`,
          type: 'delivery'
        };
      }
      // This fallback to admin coordinates isn't needed in getDistanceInfo
      // The coordinates should already be properly set in the getCoordinates function
    }
    
    return distanceInfo;
  };

  // Get destination coordinates based on order status
  const getDestinationCoords = () => {
    // Extract coordinates from getCoordinates for consistency
    const { pickupCoords, deliveryCoords } = getCoordinates();
    
    if (orderStatus === "confirmed" || orderStatus === "preparing") {
      return pickupCoords;
    } else if (orderStatus === "out_for_delivery" || orderStatus === "picked_up" || orderStatus === "on_the_way") {
      return deliveryCoords;
    }
    return null;
  };

  // Force map refresh manually
  const handleMapRefresh = () => {
    if (mapRef.current) {
      console.log("Manually refreshing map");
      
      // Force a map size recalculation
      mapRef.current.invalidateSize({ animate: false });
      
      // Reset previous coordinates to force marker updates
      prevAgentCoordsRef.current = null;
      prevPickupCoordsRef.current = null;
      prevDeliveryCoordsRef.current = null;
      
      // Trigger a recalculation of markers on next render
      // This will be handled by useEffect
    }
  };

  const distanceInfo = getDistanceInfo();
  const destinationCoords = getDestinationCoords();

  return (
    <div className="relative">
      <div 
        ref={mapContainerRef} 
        className="rounded-lg overflow-hidden border border-gray-200"
        style={{ height }}
      />
      
      {distanceInfo && (
        <div className="absolute bottom-3 left-0 right-0 mx-auto w-max bg-white px-4 py-2 rounded-full shadow-md z-[1000] text-sm flex items-center">
          <MdDirections className="mr-2 text-indigo-600" size={16} />
          <span>{distanceInfo.text}</span>
          
          {destinationCoords && Array.isArray(destinationCoords) && destinationCoords.length === 2 && (
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${destinationCoords[0]},${destinationCoords[1]}&origin=${agentLocation?.coordinates ? agentLocation.coordinates[1] : 0},${agentLocation?.coordinates ? agentLocation.coordinates[0] : 0}`}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-3 bg-indigo-600 text-white px-2 py-1 rounded-md text-xs hover:bg-indigo-700 transition-colors"
            >
              Open Maps
            </a>
          )}
          
          <button
            onClick={handleMapRefresh}
            className="ml-2 bg-gray-200 text-gray-700 p-1 rounded hover:bg-gray-300 focus:outline-none"
            title="Refresh map"
          >
            <MdRefresh size={16} />
          </button>
        </div>
      )}
      
      <style jsx>{`
        .agent-marker-icon {
          position: relative;
        }
        .agent-marker-dot {
          width: 14px;
          height: 14px;
          background-color: #3B82F6;
          border-radius: 50%;
          border: 3px solid white;
          box-shadow: 0 0 5px rgba(0, 0, 0, 0.3);
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          z-index: 2;
        }
        .agent-marker-pulse {
          width: 40px;
          height: 40px;
          background-color: rgba(59, 130, 246, 0.4);
          border-radius: 50%;
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          z-index: 1;
          animation: pulse 1.5s infinite;
        }
        
        .pickup-marker-icon, .delivery-marker-icon {
          position: relative;
        }
        .pickup-marker-bg {
          width: 36px;
          height: 36px;
          background-color: #f97316;
          border-radius: 50%;
          border: 3px solid white;
          box-shadow: 0 0 5px rgba(0, 0, 0, 0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
        }
        .delivery-marker-bg {
          width: 36px;
          height: 36px;
          background-color: #10b981;
          border-radius: 50%;
          border: 3px solid white;
          box-shadow: 0 0 5px rgba(0, 0, 0, 0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
        }
        .pickup-icon::before {
          content: "";
          display: block;
          width: 16px;
          height: 16px;
          background-color: white;
          clip-path: polygon(50% 0%, 100% 60%, 75% 100%, 25% 100%, 0% 60%);
        }
        .delivery-icon::before {
          content: "";
          display: block;
          width: 16px;
          height: 16px;
          background-color: white;
          clip-path: polygon(0% 20%, 60% 20%, 60% 0%, 100% 50%, 60% 100%, 60% 80%, 0% 80%);
        }
        
        .route-line {
          stroke-dasharray: 10, 10;
          animation: dash 30s linear infinite;
        }
        
        @keyframes dash {
          to {
            stroke-dashoffset: 1000;
          }
        }
        
        @keyframes pulse {
          0% {
            transform: translate(-50%, -50%) scale(1);
            opacity: 0.8;
          }
          50% {
            transform: translate(-50%, -50%) scale(1.5);
            opacity: 0.4;
          }
          100% {
            transform: translate(-50%, -50%) scale(1);
            opacity: 0.8;
          }
        }
        
        /* Make sure the map container is visible */
        .leaflet-container {
          width: 100%;
          height: 100%;
          background-color: #f8fafc;
        }
        
        /* Improve marker visibility */
        .leaflet-marker-icon {
          filter: drop-shadow(0 2px 2px rgba(0, 0, 0, 0.3));
        }
        
        /* Enhance popup style */
        .leaflet-popup-content-wrapper {
          border-radius: 8px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        
        .leaflet-popup-content {
          margin: 10px 12px;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        }
      `}</style>
    </div>
  );
};

export default DeliveryMap; 