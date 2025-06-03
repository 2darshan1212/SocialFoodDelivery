import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Paper,
  Card,
  CardContent,
  Button,
  Chip,
  Divider,
  Alert,
  CircularProgress,
  Grid,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  LocationOn,
  AccessTime,
  QrCode,
  Phone,
  Refresh,
  DirectionsWalk,
  Navigation,
  CheckCircle,
  MyLocation
} from '@mui/icons-material';
import { useSelector, useDispatch } from 'react-redux';
import { toast } from 'react-toastify';
import { syncOrderStatus } from '../../redux/cartSlice';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix leaflet icon issues
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

// Set default icon for Leaflet
const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

const PickupSuccessScreen = ({ orderData, onClose }) => {
  const dispatch = useDispatch();
  const [otp, setOtp] = useState('');
  const [timeRemaining, setTimeRemaining] = useState(1200); // 20 minutes in seconds
  const [mapLoaded, setMapLoaded] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [pickupLocation, setPickupLocation] = useState(null);
  const [loadingLocation, setLoadingLocation] = useState(true);
  const [mapError, setMapError] = useState(null);
  const [distance, setDistance] = useState(null);
  const [orderCompleted, setOrderCompleted] = useState(false);
  const [completionTime, setCompletionTime] = useState(null);
  const [redirectCountdown, setRedirectCountdown] = useState(7);
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const userMarkerRef = useRef(null);
  const pickupMarkerRef = useRef(null);
  const routeLineRef = useRef(null);
  
  const { user } = useSelector(store => store.auth);
  const { orders, orderStatus } = useSelector(store => store.cart);
  const { orderStatusUpdates } = useSelector(store => store.socket);

  // Monitor order status changes from Redux
  useEffect(() => {
    if (orderData?.orderId) {
      console.log('🔍 Monitoring order status for:', orderData.orderId);
      
      // Check current order status in Redux store
      const currentOrder = orders.find(order => order._id === orderData.orderId);
      if (currentOrder) {
        console.log('📦 Current order status in Redux:', currentOrder.status);
        
        if (currentOrder.status === 'delivered' && !orderCompleted) {
          console.log('🎉 Order completion detected in Redux store!');
          setOrderCompleted(true);
          setCompletionTime(currentOrder.actualDeliveryTime || currentOrder.updatedAt || new Date().toISOString());
          
          // Show completion toast
          toast.success('🎉 Your pickup order has been completed! Thank you for choosing us.', {
            position: "top-center",
            autoClose: 6000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true
          });
        }
      }
    }
  }, [orders, orderData?.orderId, orderCompleted]);

  // Monitor socket order status updates
  useEffect(() => {
    if (orderData?.orderId && orderStatusUpdates.length > 0) {
      const relevantUpdate = orderStatusUpdates.find(update => 
        update.orderId === orderData.orderId && update.status === 'delivered'
      );
      
      if (relevantUpdate && !orderCompleted) {
        console.log('🎉 Order completion detected via socket!', relevantUpdate);
        setOrderCompleted(true);
        setCompletionTime(relevantUpdate.timestamp || new Date().toISOString());
        
        // Update Redux store if not already updated
        dispatch(syncOrderStatus({
          orderId: orderData.orderId,
          status: 'delivered',
          actualDeliveryTime: relevantUpdate.timestamp || new Date().toISOString()
        }));
        
        // Show completion toast
        toast.success('🎉 Your pickup order has been completed! Thank you for choosing us.', {
          position: "top-center",
          autoClose: 6000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true
        });
      }
    }
  }, [orderStatusUpdates, orderData?.orderId, orderCompleted, dispatch]);

  // Auto-redirect after order completion
  useEffect(() => {
    if (orderCompleted) {
      console.log('🔄 Order completed, setting auto-redirect timer...');
      setRedirectCountdown(7); // Reset countdown to 7 seconds
      
      const countdownInterval = setInterval(() => {
        setRedirectCountdown(prev => {
          if (prev <= 1) {
            clearInterval(countdownInterval);
            console.log('🏠 Auto-redirecting to home after order completion');
            toast.info('🏠 Redirecting to home page...', {
              position: "top-center",
              autoClose: 2000
            });
            
            // Close the pickup screen after a short delay to show the toast
            setTimeout(() => {
              if (onClose) {
                onClose();
              }
            }, 2000);
            return 0;
          }
          return prev - 1;
        });
      }, 1000); // Update countdown every second

      return () => {
        clearInterval(countdownInterval);
      };
    }
  }, [orderCompleted, onClose]);

  // Use the actual pickup code from order data, fallback to random generation for demo
  useEffect(() => {
    if (orderData?.pickupCode) {
      // Use the actual pickup code from the backend
      setOtp(orderData.pickupCode);
      console.log("✅ Using actual pickup code from order:", orderData.pickupCode);
    } else {
      // Fallback to generate random OTP if pickup code is not available (for demo/testing)
      const generateOTP = () => {
        return Math.floor(1000 + Math.random() * 9000).toString();
      };
      const generatedOtp = generateOTP();
      setOtp(generatedOtp);
      console.warn("⚠️ No pickup code in order data, using generated OTP for demo:", generatedOtp);
      console.log("📋 Full order data received:", {
        hasPickupCode: !!orderData?.pickupCode,
        pickupCodeValue: orderData?.pickupCode || 'NOT PROVIDED',
        orderDataKeys: orderData ? Object.keys(orderData) : 'NO ORDER DATA',
        orderId: orderData?.orderId
      });
    }
  }, [orderData]);

  // Countdown timer
  useEffect(() => {
    // Calculate initial time remaining based on pickup code expiration
    let initialTime = 1200; // Default 20 minutes
    
    if (orderData?.pickupCodeExpiresAt) {
      const expirationTime = new Date(orderData.pickupCodeExpiresAt).getTime();
      const currentTime = new Date().getTime();
      const timeLeft = Math.max(0, Math.floor((expirationTime - currentTime) / 1000));
      
      if (timeLeft > 0) {
        initialTime = timeLeft;
        console.log("✅ Using actual pickup code expiration:", {
          expiresAt: orderData.pickupCodeExpiresAt,
          timeLeftSeconds: timeLeft,
          timeLeftMinutes: Math.floor(timeLeft / 60)
        });
      } else {
        console.warn("⚠️ Pickup code has already expired!");
        toast.warning("⚠️ Pickup code has expired. Please contact the restaurant.");
      }
    } else {
      console.log("📅 No expiration time provided, using default 20 minutes");
    }
    
    setTimeRemaining(initialTime);
    
    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          toast.error("⏰ Pickup code has expired! Please contact the restaurant for assistance.");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [orderData?.pickupCodeExpiresAt]);

  // Calculate distance between two points
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    return R * c;
  };

  // Get pickup location from order data or fetch from backend
  useEffect(() => {
    const fetchPickupLocation = async () => {
      try {
        if (orderData.pickupPoint && Array.isArray(orderData.pickupPoint)) {
          // Use coordinates from order data
          const [lng, lat] = orderData.pickupPoint;
          setPickupLocation({ lat, lng });
          console.log('Using pickup coordinates from order data:', { lat, lng });
        } else if (orderData.items && orderData.items.length > 0) {
          // Try to get seller/food poster location from the first item
          const firstItem = orderData.items[0];
          
          // Check if we have seller information
          if (firstItem.sellerId || firstItem.userId || firstItem.author) {
            const sellerId = firstItem.sellerId || firstItem.userId || firstItem.author;
            console.log('Fetching location for seller:', sellerId);
            
            // Get authentication token
            const token = localStorage.getItem('token');
            if (!token) {
              console.error('No auth token available for location request');
              setPickupLocation({ lat: 19.0760, lng: 72.8777 });
              return;
            }
            
            const headers = {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            };
            
            try {
              // First try: user location endpoint
              const response = await fetch(`/api/v1/user/${sellerId}/location`, { headers });
              if (response.ok) {
                const userData = await response.json();
                if (userData.success && userData.location && userData.location.coordinates) {
                  const [lng, lat] = userData.location.coordinates;
                  setPickupLocation({ lat, lng });
                  console.log('Got seller location from user endpoint:', { lat, lng });
                  return;
                }
              }
            } catch (error) {
              console.error('User location endpoint failed:', error);
            }
            
            try {
              // Second try: post author location endpoint if we have a post ID
              if (firstItem._id || firstItem.productId) {
                const postId = firstItem._id || firstItem.productId;
                const response = await fetch(`/api/v1/user/post/${postId}/author-location`, { headers });
                if (response.ok) {
                  const data = await response.json();
                  if (data.success && data.location && data.location.coordinates) {
                    const [lng, lat] = data.location.coordinates;
                    setPickupLocation({ lat, lng });
                    console.log('Got seller location from post author endpoint:', { lat, lng });
                    return;
                  }
                }
              }
            } catch (error) {
              console.error('Post author location endpoint failed:', error);
            }
            
            // If all API calls fail, use fallback
            console.log('All API endpoints failed, using fallback location');
            setPickupLocation({ lat: 19.0760, lng: 72.8777 });
            
          } else {
            // No seller ID available, use fallback
            setPickupLocation({ lat: 19.0760, lng: 72.8777 });
            console.log('No seller ID available, using fallback location');
          }
        } else {
          // No items data, use fallback
          setPickupLocation({ lat: 19.0760, lng: 72.8777 });
          console.log('No items data, using fallback location');
        }
      } catch (error) {
        console.error('Error in fetchPickupLocation:', error);
        setPickupLocation({ lat: 19.0760, lng: 72.8777 });
      }
    };

    fetchPickupLocation();
  }, [orderData]);

  // Get user's current location
  useEffect(() => {
    const getUserLocation = () => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const location = {
              lat: position.coords.latitude,
              lng: position.coords.longitude
            };
            setUserLocation(location);
            setLoadingLocation(false);
            console.log('Got user current location:', location);
          },
          (error) => {
            console.error('Error getting user location:', error);
            setMapError(`Location access denied: ${error.message}`);
            // Use a default location near Mumbai for demo
            setUserLocation({ lat: 19.0860, lng: 72.8677 });
            setLoadingLocation(false);
            toast.warning('Location access denied. Using approximate location for demo.');
          },
          { 
            enableHighAccuracy: true, 
            timeout: 10000, 
            maximumAge: 60000 
          }
        );
      } else {
        console.error('Geolocation not supported');
        setMapError('Geolocation is not supported by this browser');
        setUserLocation({ lat: 19.0860, lng: 72.8677 });
        setLoadingLocation(false);
        toast.error('Geolocation is not supported by this browser');
      }
    };

    getUserLocation();
  }, []);

  // Initialize map when both locations are available
  useEffect(() => {
    if (userLocation && pickupLocation && mapRef.current && !mapLoaded) {
      initializeMap();
    }
  }, [userLocation, pickupLocation, mapLoaded]);

  const initializeMap = async () => {
    try {
      console.log('Initializing OpenStreetMap with locations:', {
        user: userLocation,
        pickup: pickupLocation
      });

      // Calculate center point between user and pickup locations
      const centerLat = (userLocation.lat + pickupLocation.lat) / 2;
      const centerLng = (userLocation.lng + pickupLocation.lng) / 2;

      // Create map with OpenStreetMap tiles
      const map = L.map(mapRef.current, {
        center: [centerLat, centerLng],
        zoom: 13,
        zoomControl: true,
        attributionControl: true,
      });

      // Add OpenStreetMap tile layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      mapInstance.current = map;

      // Create custom user marker icon
      const userIcon = L.divIcon({
        className: 'user-marker',
        html: `
          <div style="
            width: 32px; 
            height: 32px; 
            background-color: #2196F3; 
            border: 3px solid white; 
            border-radius: 50%; 
            display: flex; 
            align-items: center; 
            justify-content: center;
            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          ">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
            </svg>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });

      // Create custom pickup marker icon
      const pickupIcon = L.divIcon({
        className: 'pickup-marker',
        html: `
          <div style="
            width: 40px; 
            height: 40px; 
            background-color: #FF6B35; 
            border: 3px solid white; 
            border-radius: 50%; 
            display: flex; 
            align-items: center; 
            justify-content: center;
            box-shadow: 0 3px 8px rgba(0,0,0,0.4);
            position: relative;
          ">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
            </svg>
          </div>
          <div style="
            position: absolute; 
            top: -25px; 
            left: 50%; 
            transform: translateX(-50%); 
            background-color: #FF6B35; 
            color: white; 
            font-weight: bold; 
            padding: 4px 8px; 
            border-radius: 4px; 
            font-size: 10px; 
            white-space: nowrap;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
          ">
            🍽️ PICKUP
          </div>
        `,
        iconSize: [40, 40],
        iconAnchor: [20, 20]
      });

      // Add user location marker
      userMarkerRef.current = L.marker([userLocation.lat, userLocation.lng], { 
        icon: userIcon 
      }).addTo(map);

      // Add pickup location marker
      pickupMarkerRef.current = L.marker([pickupLocation.lat, pickupLocation.lng], { 
        icon: pickupIcon 
      }).addTo(map);

      // Add popup content for markers
      userMarkerRef.current.bindPopup(`
        <div style="text-align: center; padding: 8px;">
          <h4 style="margin: 0 0 4px 0; color: #2196F3;">📍 Your Location</h4>
          <p style="margin: 0; font-size: 12px;">Current position</p>
          <p style="margin: 4px 0 0 0; font-size: 10px; color: #666;">
            ${userLocation.lat.toFixed(4)}, ${userLocation.lng.toFixed(4)}
          </p>
        </div>
      `);

      pickupMarkerRef.current.bindPopup(`
        <div style="text-align: center; padding: 8px;">
          <h4 style="margin: 0 0 4px 0; color: #FF6B35;">🍽️ Pickup Location</h4>
          <p style="margin: 0; font-size: 12px;">${orderData.pickupAddress || 'Restaurant Location'}</p>
          <p style="margin: 4px 0 0 0; font-size: 11px; color: #666;">
            Show your OTP: <strong>${otp}</strong>
          </p>
          <p style="margin: 4px 0 0 0; font-size: 10px; color: #666;">
            ${pickupLocation.lat.toFixed(4)}, ${pickupLocation.lng.toFixed(4)}
          </p>
        </div>
      `);

      // Draw route line between locations
      const routeCoordinates = [
        [userLocation.lat, userLocation.lng],
        [pickupLocation.lat, pickupLocation.lng]
      ];

      routeLineRef.current = L.polyline(routeCoordinates, {
        color: '#FF6B35',
        weight: 4,
        opacity: 0.8,
        dashArray: '10, 10'
      }).addTo(map);

      // Calculate and display distance
      const dist = calculateDistance(
        userLocation.lat, userLocation.lng,
        pickupLocation.lat, pickupLocation.lng
      );
      setDistance(dist);

      // Fit map to show both markers
      const bounds = L.latLngBounds([
        [userLocation.lat, userLocation.lng],
        [pickupLocation.lat, pickupLocation.lng]
      ]);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });

      setMapLoaded(true);
      setMapError(null);
      console.log('OpenStreetMap initialized successfully');

      // Show distance info
      if (dist) {
        toast.info(`📍 Distance to pickup: ${dist.toFixed(1)} km`);
      }

    } catch (error) {
      console.error('Error initializing map:', error);
      setMapError('Failed to initialize map. Please refresh the page.');
    }
  };

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const copyOTP = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(otp)
        .then(() => toast.success('OTP copied to clipboard! 📋'))
        .catch(() => {
          // Fallback for older browsers
          const textArea = document.createElement('textarea');
          textArea.value = otp;
          document.body.appendChild(textArea);
          textArea.select();
          document.execCommand('copy');
          document.body.removeChild(textArea);
          toast.success('OTP copied to clipboard! 📋');
        });
    }
  };

  const openDirections = () => {
    if (pickupLocation && userLocation) {
      // Use Google Maps for external navigation
      const url = `https://www.google.com/maps/dir/${userLocation.lat},${userLocation.lng}/${pickupLocation.lat},${pickupLocation.lng}`;
      window.open(url, '_blank');
    } else {
      toast.error('Location data not available');
    }
  };

  const refreshLocation = () => {
    setLoadingLocation(true);
    setMapError(null);
    
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setUserLocation(location);
          setLoadingLocation(false);
          setMapLoaded(false); // Trigger map re-initialization
          toast.success('Location updated! 📍');
        },
        (error) => {
          console.error('Error refreshing location:', error);
          setLoadingLocation(false);
          toast.error('Could not refresh location');
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    }
  };

  return (
    <Box sx={{ p: 3, maxWidth: 1000, mx: 'auto' }}>
      {/* Order Completion Screen */}
      {orderCompleted ? (
        <>
          {/* Order Completion Header */}
          <Paper sx={{ p: 4, mb: 3, textAlign: 'center', bgcolor: 'success.main', color: 'white' }}>
            <CheckCircle sx={{ fontSize: 80, mb: 2 }} />
            <Typography variant="h4" gutterBottom fontWeight="bold">
              🎉 Order Completed Successfully!
            </Typography>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Your pickup order has been successfully received
            </Typography>
            <Typography variant="body1">
              Thank you for choosing us! We hope you enjoyed your meal.
            </Typography>
            {redirectCountdown > 0 && (
              <Typography variant="body2" sx={{ mt: 2, opacity: 0.8 }}>
                🏠 Automatically redirecting to home in {redirectCountdown} seconds...
              </Typography>
            )}
          </Paper>

          <Grid container spacing={3}>
            {/* Completion Summary */}
            <Grid item xs={12} md={6}>
              <Card sx={{ height: '100%', border: '2px solid', borderColor: 'success.main' }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom display="flex" alignItems="center" color="success.main">
                    <CheckCircle sx={{ mr: 1 }} />
                    Pickup Completed
                  </Typography>
                  
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      Order ID
                    </Typography>
                    <Typography variant="body1" fontWeight="medium" fontFamily="monospace">
                      #{orderData.orderId?.substring(-8) || 'N/A'}
                    </Typography>
                  </Box>

                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      Completion Time
                    </Typography>
                    <Typography variant="body1" color="success.main" fontWeight="medium">
                      {completionTime ? new Date(completionTime).toLocaleString() : 'Just now'}
                    </Typography>
                  </Box>

                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      Total Amount
                    </Typography>
                    <Typography variant="h6" color="primary">
                      ₹{orderData.total?.toFixed(2) || '0.00'}
                    </Typography>
                  </Box>

                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      Items Collected
                    </Typography>
                    <Typography variant="body1">
                      {orderData.items?.length || 0} items
                    </Typography>
                  </Box>

                  <Alert severity="success" sx={{ mt: 2 }}>
                    <Typography variant="body2">
                      ✅ Your order has been successfully picked up from the self-pickup point.
                    </Typography>
                  </Alert>
                </CardContent>
              </Card>
            </Grid>

            {/* Order Review & Feedback */}
            <Grid item xs={12} md={6}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    🌟 How was your experience?
                  </Typography>
                  
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    We'd love to hear about your pickup experience!
                  </Typography>

                  <Box sx={{ textAlign: 'center', py: 3 }}>
                    <Typography variant="h2" sx={{ mb: 2 }}>
                      🎉
                    </Typography>
                    <Typography variant="h6" color="success.main" fontWeight="bold">
                      Thank You!
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                      Your feedback helps us improve our service
                    </Typography>
                  </Box>

                  <Button
                    variant="outlined"
                    fullWidth
                    sx={{ mt: 2 }}
                    onClick={() => {
                      toast.info('⭐ Thank you for your feedback!');
                    }}
                  >
                    ⭐ Rate Your Experience
                  </Button>
                </CardContent>
              </Card>
            </Grid>

            {/* Completion Actions */}
            <Grid item xs={12}>
              <Box display="flex" gap={2} justifyContent="center" flexWrap="wrap">
                <Button
                  variant="outlined"
                  onClick={() => {
                    // Navigate to order history
                    toast.info('📋 Redirecting to order history...');
                  }}
                >
                  📋 View Order History
                </Button>
                <Button
                  variant="contained"
                  size="large"
                  onClick={onClose}
                  sx={{ bgcolor: 'success.main', '&:hover': { bgcolor: 'success.dark' } }}
                >
                  ✅ Close
                </Button>
              </Box>
            </Grid>
          </Grid>
        </>
      ) : (
        <>
          {/* Regular Pickup Screen (when order is not completed) */}
          {/* Success Header */}
          <Paper sx={{ p: 3, mb: 3, textAlign: 'center', bgcolor: 'success.light', color: 'success.contrastText' }}>
            <CheckCircle sx={{ fontSize: 48, mb: 2 }} />
            <Typography variant="h5" gutterBottom>
              🎉 Order Placed Successfully!
            </Typography>
            <Typography variant="body1">
              Your self-pickup order is being prepared
            </Typography>
          </Paper>

          <Grid container spacing={3}>
            {/* OTP Section */}
            <Grid item xs={12} md={6}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom display="flex" alignItems="center">
                    <QrCode sx={{ mr: 1 }} />
                    Pickup Code
                  </Typography>
                  
                  <Box sx={{ textAlign: 'center', my: 3 }}>
                    <Typography 
                      variant="h2" 
                      color="primary" 
                      fontWeight="bold" 
                      letterSpacing={4}
                      sx={{ 
                        fontSize: { xs: '2rem', md: '3rem' },
                        fontFamily: 'monospace',
                        border: '2px dashed',
                        borderColor: 'primary.main',
                        borderRadius: 2,
                        p: 2,
                        bgcolor: 'primary.light',
                        color: 'primary.contrastText'
                      }}
                    >
                      {otp}
                    </Typography>
                    <Button 
                      variant="outlined" 
                      size="small" 
                      onClick={copyOTP}
                      sx={{ mt: 2 }}
                      startIcon={<QrCode />}
                    >
                      Copy Code
                    </Button>
                  </Box>

                  <Alert severity="info" sx={{ mb: 2 }}>
                    <strong>Show this 4-digit code to the restaurant staff</strong> to collect your order
                  </Alert>

                  <Box display="flex" alignItems="center" justifyContent="center">
                    <AccessTime sx={{ mr: 1, color: timeRemaining < 300 ? 'error.main' : 'warning.main' }} />
                    <Typography 
                      variant="body2" 
                      color={timeRemaining < 300 ? 'error.main' : 'warning.main'}
                      fontWeight="medium"
                    >
                      Code expires in: <strong>{formatTime(timeRemaining)}</strong>
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            {/* Order Details */}
            <Grid item xs={12} md={6}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    📋 Order Details
                  </Typography>
                  
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      Order ID
                    </Typography>
                    <Typography variant="body1" fontWeight="medium" fontFamily="monospace">
                      #{orderData.orderId?.substring(-8) || 'N/A'}
                    </Typography>
                  </Box>

                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      Total Amount
                    </Typography>
                    <Typography variant="h6" color="primary">
                      ₹{orderData.total?.toFixed(2) || '0.00'}
                    </Typography>
                  </Box>

                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      Items
                    </Typography>
                    <Typography variant="body1">
                      {orderData.items?.length || 0} items
                    </Typography>
                  </Box>

                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      Payment Method
                    </Typography>
                    <Chip 
                      label={orderData.paymentMethod === 'cash' ? 'Pay at Pickup' : orderData.paymentMethod} 
                      size="small" 
                      color="primary"
                    />
                  </Box>

                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Estimated Ready Time
                    </Typography>
                    <Typography variant="body1" color="success.main" fontWeight="medium">
                      ⏱️ 15-20 minutes
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            {/* Map Section */}
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={2} flexWrap="wrap" gap={1}>
                    <Typography variant="h6" display="flex" alignItems="center">
                      <LocationOn sx={{ mr: 1 }} />
                      📍 Pickup Location & Route {distance && `(${distance.toFixed(1)} km)`}
                    </Typography>
                    <Box display="flex" gap={1} flexWrap="wrap">
                      <Button
                        variant="outlined"
                        startIcon={<MyLocation />}
                        onClick={refreshLocation}
                        size="small"
                        disabled={loadingLocation}
                      >
                        Refresh Location
                      </Button>
                      <Button
                        variant="contained"
                        startIcon={<Navigation />}
                        onClick={openDirections}
                        size="small"
                        disabled={!userLocation || !pickupLocation}
                      >
                        Get Directions
                      </Button>
                    </Box>
                  </Box>

                  {mapError ? (
                    <Alert severity="error" sx={{ mb: 2 }}>
                      {mapError}
                      <Button 
                        size="small" 
                        onClick={() => window.location.reload()} 
                        sx={{ ml: 2 }}
                      >
                        Reload Page
                      </Button>
                    </Alert>
                  ) : loadingLocation ? (
                    <Box display="flex" justifyContent="center" alignItems="center" height={400}>
                      <CircularProgress />
                      <Typography variant="body2" sx={{ ml: 2 }}>
                        Loading map and locations...
                      </Typography>
                    </Box>
                  ) : (
                    <Box 
                      ref={mapRef} 
                      sx={{ 
                        height: 400, 
                        width: '100%', 
                        borderRadius: 2, 
                        bgcolor: 'grey.100',
                        border: '1px solid',
                        borderColor: 'grey.300'
                      }} 
                    />
                  )}

                  <Box mt={2}>
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="body2" color="text.secondary">
                          📍 Your Location:
                        </Typography>
                        <Typography variant="body1">
                          {userLocation ? `${userLocation.lat.toFixed(4)}, ${userLocation.lng.toFixed(4)}` : 'Getting location...'}
                        </Typography>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="body2" color="text.secondary">
                          🍽️ Pickup Address:
                        </Typography>
                        <Typography variant="body1">
                          {orderData.pickupAddress || 'Restaurant Location'}
                        </Typography>
                      </Grid>
                    </Grid>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            {/* Action Buttons */}
            <Grid item xs={12}>
              <Box display="flex" gap={2} justifyContent="center" flexWrap="wrap">
                <Button
                  variant="outlined"
                  startIcon={<Phone />}
                  onClick={() => {
                    // Add restaurant contact functionality
                    toast.info('📞 Restaurant contact: +91-9999999999');
                  }}
                >
                  Call Restaurant
                </Button>
                <Button
                  variant="contained"
                  onClick={onClose}
                  size="large"
                >
                  ✅ Done
                </Button>
              </Box>
            </Grid>
          </Grid>
        </>
      )}
    </Box>
  );
};

export default PickupSuccessScreen; 