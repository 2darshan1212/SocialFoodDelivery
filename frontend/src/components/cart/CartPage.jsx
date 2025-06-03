import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Box,
  Typography,
  Button,
  Divider,
  TextField,
  RadioGroup,
  Radio,
  FormControlLabel,
  FormControl,
  FormLabel,
  Stepper,
  Step,
  StepLabel,
  Card,
  CardContent,
  CardMedia,
  IconButton,
  Alert,
  Snackbar,
  Grid,
  CircularProgress,
  Tabs,
  Tab,
  Chip,
  Badge,
} from "@mui/material";
import { useDispatch, useSelector } from "react-redux";
import { 
  decreaseQuantity, 
  increaseQuantity, 
  removeFromCart,
  saveForLater,
  moveToCart,
  removeSavedItem,
  updateDeliveryAddress,
  updateDeliveryMethod,
  updatePaymentMethod,
  updateDeliveryInstructions,
  updateContactNumber,
  applyPromoCode,
  removePromoCode,
  clearCart,
  placeOrder,
  resetOrderStatus,
  resetOrderStatusAction,
  fetchOrders,
  syncOrderStatus,
  setDeliveryPoint,
  setCurrentPickupOrder,
  clearPickupOrder,
  setShowPickupScreen
} from "../../redux/cartSlice";
import { Delete, Favorite, ShoppingCart, LocalShipping, Payment, Refresh, Check, History, AccessTime, KeyboardArrowRight } from "@mui/icons-material";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import SolanaPayment from "../wallet/SolanaPayment";
import { resetPaymentStatus } from "../../redux/walletSlice";
import store from "../../redux/store";
import { updateOrderStatus } from "../../services/orderService";
import axios from "axios";
import { fetchConfirmedOrders } from "../../redux/deliverySlice";
import PickupSuccessScreen from "./PickupSuccessScreen";

const CartPage = () => {
  const { 
    cartItems = [], 
    savedItems = [], 
    checkout = {
      deliveryAddress: "",
      deliveryMethod: "standard",
      paymentMethod: "cash",
      deliveryInstructions: "",
      contactNumber: "",
      appliedPromoCode: null,
      discount: 0,
      deliveryFee: 0,
      deliveryPoint: null
    },
    orderStatus = "idle",
    orderError = null,
    stockErrors = {},
    orders = [],
    showPickupScreen = false,
    currentPickupOrder = null
  } = useSelector((store) => store.cart || {});
  const { user } = useSelector((store) => store.auth);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // Local state for UI
  const [activeTab, setActiveTab] = useState(0);
  const [activeStep, setActiveStep] = useState(0);
  

  const [promoCode, setPromoCode] = useState("");
  const [promoError, setPromoError] = useState("");
  const [promoSuccess, setPromoSuccess] = useState(false);
  const [loadingOrders, setLoadingOrders] = useState(false);

  // Calculate totals
  const subtotal = cartItems.reduce((total, item) => {
    return total + item.quantity * item.price;
  }, 0);

  const taxRate = 0.07;
  const tax = subtotal * taxRate;
  const deliveryFee = checkout?.deliveryFee || 0;
  const discount = checkout?.discount || 0;
  const total = subtotal + tax + deliveryFee - discount;

  // Steps for checkout
  const steps = ['Cart', 'Delivery', 'Payment', 'Review'];

  // Handle tab change
  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  // Navigate to next step
  const handleNext = () => {
    // Reset any previous order errors
    if (orderStatus === 'failed') {
      dispatch(resetOrderStatusAction());
    }
    
    // Validate current step
    if (activeStep === 0 && cartItems.length === 0) {
      toast.error("Your cart is empty");
      return;
    }

    if (activeStep === 1) {
      // For pickup orders, delivery address is optional (can be pickup location)
      if (checkout.deliveryMethod !== 'pickup' && !checkout.deliveryAddress) {
        toast.error("Please enter a delivery address");
        return;
      }
      if (!checkout.contactNumber) {
        toast.error("Please enter a contact number");
        return;
      }
    }

    setActiveStep((prevStep) => prevStep + 1);
  };

  // Navigate to previous step
  const handleBack = () => {
    setActiveStep((prevStep) => prevStep - 1);
  };

  // Apply promo code
  const handleApplyPromoCode = () => {
    if (!promoCode) {
      setPromoError("Please enter a promo code");
      return;
    }

    // Mock promo codes
    const promoCodes = {
      "WELCOME10": { discount: subtotal * 0.1, maxDiscount: 100 },
      "FREEDEL": { discount: deliveryFee, maxDiscount: deliveryFee },
      "SPECIAL20": { discount: subtotal * 0.2, maxDiscount: 200 }
    };

    if (promoCodes[promoCode]) {
      const { discount, maxDiscount } = promoCodes[promoCode];
      const finalDiscount = Math.min(discount, maxDiscount);
      
      dispatch(applyPromoCode({ code: promoCode, discount: finalDiscount }));
      setPromoSuccess(true);
      setPromoError("");
    } else {
      setPromoError("Invalid promo code");
      setPromoSuccess(false);
    }
  };

  // Remove promo code
  const handleRemovePromoCode = () => {
    dispatch(removePromoCode());
    setPromoCode("");
    setPromoSuccess(false);
  };

  // Validate geographic coordinates
  const validateCoordinates = (coords) => {
    if (!coords || !Array.isArray(coords) || coords.length !== 2) return false;
    const [longitude, latitude] = coords;
    
    // Check if coordinates are valid numbers within range
    return !isNaN(longitude) && !isNaN(latitude) && 
           longitude >= -180 && longitude <= 180 && 
           latitude >= -90 && latitude <= 90;
  };
  
  // Convert address to coordinates using Nominatim (OpenStreetMap)
  const geocodeAddress = async (address) => {
    try {
      // Format address for URL
      const formattedAddress = encodeURIComponent(address);
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${formattedAddress}&limit=1`);
      const data = await response.json();
      
      if (data && data.length > 0) {
        // Nominatim returns [lat, lon] but we need [lon, lat] for GeoJSON
        return [parseFloat(data[0].lon), parseFloat(data[0].lat)];
      }
      return null;
    } catch (error) {
      console.error('Geocoding error:', error);
      return null;
    }
  };
  
  // Get user's current location and store in Redux
  const getUserLocationForDelivery = () => {
    return new Promise((resolve) => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            // Format as [longitude, latitude] for GeoJSON
            const coordinates = [position.coords.longitude, position.coords.latitude];
            console.log("Got user location for delivery:", coordinates);
            
            // Store in Redux
            dispatch(setDeliveryPoint(coordinates));
            resolve(coordinates);
          },
          (error) => {
            console.warn("Geolocation error:", error);
            resolve(null);
          },
          { timeout: 5000, maximumAge: 60000 }
        );
      } else {
        console.warn("Geolocation not supported by this browser");
        resolve(null);
      }
    });
  };

  // Handle place order
  const handlePlaceOrder = async () => {
    // Check if user is logged in
    if (!user || !user._id) {
      toast.error("You need to be logged in to place an order");
      dispatch({ type: 'cart/placeOrder/rejected', payload: { message: "Authentication required" } });
      return;
    }
    
    // If payment method is Solana, verify wallet payment status
    if (checkout.paymentMethod === 'solana') {
      const walletState = store.getState().wallet;
      if (walletState.paymentStatus !== 'success') {
        toast.error("Please complete Solana payment before placing order");
        dispatch({ type: 'cart/placeOrder/rejected', payload: { message: "Solana payment required" } });
        return;
      }
    }
    
    // Set loading state manually
    dispatch({ type: 'cart/placeOrder/pending' });
    
    if (cartItems.length === 0) {
      toast.error("Your cart is empty");
      dispatch({ type: 'cart/placeOrder/rejected', payload: { message: "Cart is empty" } });
      return;
    }

    // Additional validation
    if (checkout.deliveryMethod !== 'pickup' && !checkout.deliveryAddress) {
      toast.error("Please enter a delivery address");
      setActiveStep(1); // Go back to delivery step
      dispatch({ type: 'cart/placeOrder/rejected', payload: { message: "Missing delivery address" } });
      return;
    }

    if (!checkout.contactNumber) {
      toast.error("Please enter a contact number");
      setActiveStep(1); // Go back to delivery step
      dispatch({ type: 'cart/placeOrder/rejected', payload: { message: "Missing contact number" } });
      return;
    }
    
    // Show loading state during processing
    if (checkout.deliveryMethod === 'pickup') {
      toast.info("Processing your pickup order...");
    } else {
      toast.info("Getting your location for delivery...");
    }
    dispatch({ type: 'cart/placeOrder/pending' });
    
    // Get and store the user's current location for delivery (skip for pickup)
    if (checkout.deliveryMethod !== 'pickup') {
      await getUserLocationForDelivery();
    }
    
    try {
      // Get current user location first
      let currentUserLocation = null;
      try {
        currentUserLocation = await new Promise((resolve) => {
          if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
              (position) => {
                const coords = [position.coords.longitude, position.coords.latitude];
                console.log("Got current user location:", coords);
                resolve(coords);
              },
              (error) => {
                console.warn("Geolocation error:", error);
                resolve(null);
              },
              { timeout: 5000, maximumAge: 60000 }
            );
          } else {
            console.warn("Geolocation not supported");
            resolve(null);
          }
        });
      } catch (error) {
        console.error("Error getting current location:", error);
        currentUserLocation = null;
      }

      // Get seller/food poster location from cart items
      let sellerLocation = null;
      if (cartItems.length > 0) {
        const firstItem = cartItems[0];
        
        // Try to get seller ID from various possible fields
        const sellerId = firstItem.sellerId || firstItem.userId || firstItem.author || firstItem.authorId;
        
        if (sellerId) {
          console.log("Fetching seller location for ID:", sellerId);
          
          // Get authentication token
          const token = localStorage.getItem('token');
          if (!token) {
            console.error('No auth token available for location request');
            sellerLocation = [72.8777, 19.0760]; // Mumbai fallback
          } else {
            const headers = {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            };
            
            try {
              // Try multiple API endpoints to get seller location
              let sellerData = null;
              
              // First try: user location endpoint
              try {
                const response = await fetch(`/api/v1/user/${sellerId}/location`, { headers });
                if (response.ok) {
                  const userData = await response.json();
                  if (userData.success && userData.location && userData.location.coordinates) {
                    sellerData = userData;
                    console.log("Got seller data from user location endpoint:", sellerData.location.coordinates);
                  }
                }
              } catch (profileError) {
                console.log("User location endpoint failed, trying alternatives");
              }
              
              // Second try: post author location endpoint if we have a post ID
              if (!sellerData && (firstItem._id || firstItem.productId)) {
                try {
                  const postId = firstItem._id || firstItem.productId;
                  const response = await fetch(`/api/v1/user/post/${postId}/author-location`, { headers });
                  if (response.ok) {
                    const data = await response.json();
                    if (data.success && data.location && data.location.coordinates) {
                      sellerData = data;
                      console.log("Got seller data from post author endpoint:", sellerData.location.coordinates);
                    }
                  }
                } catch (postError) {
                  console.log("Post author endpoint also failed");
                }
              }
              
              if (sellerData && sellerData.location && sellerData.location.coordinates) {
                sellerLocation = sellerData.location.coordinates;
                console.log("Successfully got seller location:", sellerLocation);
              } else {
                console.log("No seller location found, will use fallback");
              }
              
            } catch (error) {
              console.error("Error fetching seller location:", error);
            }
          }
        } else {
          console.log("No seller ID found in cart item");
        }
      }

      // Set up pickup and delivery coordinates
      let pickupCoordinates, deliveryCoordinates;
      
      if (checkout.deliveryMethod === 'pickup') {
        // For pickup orders: 
        // - pickup point = seller location (where food is)
        // - delivery point = current user location (for reference/directions)
        pickupCoordinates = sellerLocation || [72.8777, 19.0760]; // Mumbai fallback
        deliveryCoordinates = currentUserLocation || [72.8677, 19.0860]; // Mumbai with offset fallback
        
        console.log("Pickup order - Pickup at:", pickupCoordinates, "User at:", deliveryCoordinates);
      } else {
        // For delivery orders:
        // - pickup point = seller location (where food is picked up from)
        // - delivery point = current user location or delivery address
        pickupCoordinates = sellerLocation || [72.8777, 19.0760];
        deliveryCoordinates = currentUserLocation || [72.8677, 19.0860];
        
        console.log("Delivery order - Pickup from:", pickupCoordinates, "Deliver to:", deliveryCoordinates);
      }
      
      // Store coordinates in Redux for later use
      dispatch(setDeliveryPoint(deliveryCoordinates));
      dispatch({ type: 'cart/setPickupPoint', payload: pickupCoordinates });
      
      // Create the order data object with proper coordinates
      const orderData = {
        items: cartItems.map(item => ({
          productId: item._id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          sellerId: item.sellerId || item.userId || item.author || null,
          sellerName: item.sellerName || item.userName || null
        })),
        deliveryAddress: checkout.deliveryMethod === 'pickup' ? 'Self Pickup' : checkout.deliveryAddress,
        deliveryMethod: checkout.deliveryMethod,
        paymentMethod: checkout.paymentMethod,
        deliveryInstructions: checkout.deliveryInstructions,
        contactNumber: checkout.contactNumber,
        subtotal,
        tax,
        deliveryFee,
        discount,
        total,
        promoCodeApplied: checkout.appliedPromoCode,
        // Include coordinates in the proper format for MongoDB
        pickupLocation: {
          type: "Point",
          coordinates: pickupCoordinates
        },
        deliveryLocation: {
          type: "Point",
          coordinates: deliveryCoordinates
        },
        // Set initial status to confirmed to make sure it shows in delivery section
        status: 'confirmed'
      };
      
      // Log the final order data being sent
      console.log("Final order data with real coordinates:", {
        pickup: orderData.pickupLocation.coordinates,
        delivery: orderData.deliveryLocation.coordinates,
        method: orderData.deliveryMethod
      });

      const response = await dispatch(placeOrder(orderData)).unwrap();
      console.log("Order placed successfully:", response);
      
      // Handle pickup orders differently
      if (checkout.deliveryMethod === 'pickup' && response.order) {
        // For pickup orders, show the pickup success screen with OTP and real coordinates
        const pickupOrderData = {
          orderId: response.order._id,
          total: total,
          items: cartItems,
          paymentMethod: checkout.paymentMethod,
          pickupPoint: pickupCoordinates, // Real seller coordinates
          pickupAddress: cartItems[0]?.sellerAddress || cartItems[0]?.address || "Restaurant Location",
          contactNumber: checkout.contactNumber,
          estimatedReadyTime: "15-20 minutes",
          // Add seller information for location fetching
          sellerId: cartItems[0]?.sellerId || cartItems[0]?.userId || cartItems[0]?.author,
          userLocation: deliveryCoordinates, // Current user location
          // Include the pickup code from the backend response
          pickupCode: response.order.pickupCode,
          pickupCodeExpiresAt: response.order.pickupCodeExpiresAt
        };
        
        console.log("Setting pickup order data with real coordinates and pickup code:", {
          ...pickupOrderData,
          pickupCode: pickupOrderData.pickupCode ? '****' : 'NOT PROVIDED' // Log safely
        });
        dispatch(setCurrentPickupOrder(pickupOrderData));
        toast.success("Pickup order placed successfully!");
        
        // Clear the cart after successful order placement
        setTimeout(() => {
          dispatch(clearCart());
        }, 1000);
        
      } else {
        // For regular delivery orders, show normal success
        toast.success("Order placed successfully!");
        
        // Show success step
        setActiveStep(4);
        
        // Clear the cart after successful order placement
        setTimeout(() => {
          dispatch(clearCart());
        }, 1000);
      }
      
      // Store the orderId for navigation after showing success
      if (response.order && response.order._id) {
        localStorage.setItem('lastOrderId', response.order._id);
        
        // Update order status to confirmed
        updateOrderStatusToConfirmed(response.order._id)
          .then(() => {
            console.log('Order confirmed in the system successfully');
            
            // Directly add this order to the confirmed orders in Redux
            // This ensures immediate availability in the delivery dashboard
            dispatch(fetchConfirmedOrders())
              .unwrap()
              .then(result => {
                console.log('Successfully refreshed confirmed orders:', result);
                // Also force a refresh to ensure we have all confirmed orders
                dispatch(fetchOrders());
              })
              .catch(err => {
                console.error('Failed to refresh confirmed orders, falling back to fetch orders:', err);
                // If direct addition fails, fall back to just refreshing the list
                dispatch(fetchOrders());
              });
          })
          .catch(err => {
            console.error('Error confirming order:', err);
            // Even if status update fails, try to add to confirmed orders
            dispatch(fetchConfirmedOrders());
          });
        
        // Also update the Redux state directly to ensure immediate UI updates
        dispatch(syncOrderStatus({
          orderId: response.order._id,
          status: 'confirmed'
        }));
      }
      
      // Refresh orders list to ensure the new order appears in the history
      setTimeout(() => {
        dispatch(fetchOrders());
        
        // Also refresh confirmed orders in the delivery system
        dispatch(fetchOrders());
        
        // Update localStorage to trigger refresh in other open tabs
        localStorage.setItem('confirmedOrdersUpdated', Date.now().toString());
        
        // Trigger a custom event for real-time update
        window.dispatchEvent(new CustomEvent('new-confirmed-order', { 
          detail: { orderId: response.order?._id }
        }));
      }, 2000);
      
    } catch (error) {
      console.error("Order placement error:", error);
      toast.error(error?.message || "Failed to place order");
      
      // Reset order status to idle
      dispatch({ type: 'cart/placeOrder/rejected', payload: error || { message: "Unknown error" } });
      
      // If there's an authentication error, we could redirect to login
      if (error?.message?.toLowerCase().includes('logged in')) {
        // Could redirect to login page
        toast.error("Please log in to place an order");
      }
    }
  };

  // Handle increase quantity
  const handleIncreaseQuantity = (item) => {
    try {
      console.log("Increasing quantity for item:", item._id);
      dispatch(increaseQuantity({ _id: item._id, maxStock: 100 }));
    } catch (error) {
      console.error("Error increasing quantity:", error);
      toast.error("Failed to update quantity. Please try again.");
    }
  };

  // Handle decrease quantity
  const handleDecreaseQuantity = (item) => {
    try {
      console.log("Decreasing quantity for item:", item._id);
      dispatch(decreaseQuantity({ _id: item._id }));
    } catch (error) {
      console.error("Error decreasing quantity:", error);
      toast.error("Failed to update quantity. Please try again.");
    }
  };

  // Handle remove from cart
  const handleRemoveFromCart = (item) => {
    try {
      dispatch(removeFromCart(item));
      toast.info("Item removed from cart");
    } catch (error) {
      console.error("Error removing item from cart:", error);
      toast.error("Failed to remove item. Please try again.");
    }
  };

  // Handle save for later
  const handleSaveForLater = (item) => {
    try {
      dispatch(saveForLater(item));
      toast.info("Item saved for later");
    } catch (error) {
      console.error("Error saving item for later:", error);
      toast.error("Failed to save item for later. Please try again.");
    }
  };

  // Render cart items
  const renderCartItems = () => (
    <TableContainer component={Paper} sx={{ overflowX: "auto", mb: 3 }}>
      <Table sx={{ minWidth: { xs: 320, sm: 600 } }} aria-label="cart table">
        <TableHead>
          <TableRow>
            <TableCell sx={{ py: { xs: 1.5, sm: 2 }, px: { xs: 1, sm: 2 } }}>Item</TableCell>
            <TableCell align="right" sx={{ py: { xs: 1.5, sm: 2 }, px: { xs: 1, sm: 2 } }}>Quantity</TableCell>
            <TableCell align="right" sx={{ py: { xs: 1.5, sm: 2 }, px: { xs: 1, sm: 2 }, display: { xs: 'none', sm: 'table-cell' } }}>Unit Price</TableCell>
            <TableCell align="right" sx={{ py: { xs: 1.5, sm: 2 }, px: { xs: 1, sm: 2 } }}>Total</TableCell>
            <TableCell align="right" sx={{ py: { xs: 1.5, sm: 2 }, px: { xs: 1, sm: 2 } }}>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {cartItems && cartItems.length > 0 ? (
            cartItems.map((item) => (
              <TableRow key={item._id}>
                <TableCell sx={{ py: { xs: 1.5, sm: 2 }, px: { xs: 1, sm: 2 } }}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    {item.image && (
                      <CardMedia
                        component="img"
                        sx={{ 
                          width: { xs: 40, sm: 60 }, 
                          height: { xs: 40, sm: 60 }, 
                          objectFit: 'cover', 
                          borderRadius: 1, 
                          mr: { xs: 1, sm: 2 }
                        }}
                        image={item.image}
                        alt={item.name}
                      />
                    )}
                    <Typography variant="body2" sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem', md: '1rem' } }}>
                      {item.name}
                    </Typography>
                  </Box>
                </TableCell>
                <TableCell align="right" sx={{ py: { xs: 1.5, sm: 2 }, px: { xs: 1, sm: 2 } }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                    <Button
                      onClick={() => handleDecreaseQuantity(item)}
                      variant="outlined"
                      color="error"
                      size="small"
                      sx={{ 
                        minWidth: { xs: 24, sm: 30 }, 
                        width: { xs: 24, sm: 30 }, 
                        height: { xs: 24, sm: 30 }, 
                        p: 0 
                      }}
                    >
                      -
                    </Button>
                    <Typography sx={{ mx: { xs: 0.5, sm: 1 }, fontSize: { xs: '0.75rem', sm: 'inherit' } }}>
                      {item.quantity}
                    </Typography>
                    <Button
                      onClick={() => handleIncreaseQuantity(item)}
                      variant="outlined"
                      color="success"
                      size="small"
                      sx={{ 
                        minWidth: { xs: 24, sm: 30 }, 
                        width: { xs: 24, sm: 30 }, 
                        height: { xs: 24, sm: 30 }, 
                        p: 0 
                      }}
                    >
                      +
                    </Button>
                  </Box>
                  {stockErrors && stockErrors[item._id] && (
                    <Typography color="error" variant="caption" sx={{ display: 'block', textAlign: 'center', mt: 1 }}>
                      {stockErrors[item._id]}
                    </Typography>
                  )}
                </TableCell>
                <TableCell align="right" sx={{ py: { xs: 1.5, sm: 2 }, px: { xs: 1, sm: 2 }, display: { xs: 'none', sm: 'table-cell' } }}>₹{item.price}</TableCell>
                <TableCell align="right" sx={{ py: { xs: 1.5, sm: 2 }, px: { xs: 1, sm: 2 } }}>
                  <Typography sx={{ fontSize: { xs: '0.75rem', sm: 'inherit' } }}>₹{(item.quantity * item.price).toFixed(2)}</Typography>
                </TableCell>
                <TableCell align="right" sx={{ py: { xs: 1.5, sm: 2 }, px: { xs: 1, sm: 2 } }}>
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <IconButton 
                      color="primary" 
                      size="small" 
                      onClick={() => handleSaveForLater(item)}
                      title="Save for later"
                      sx={{ padding: { xs: 0.5, sm: 1 } }}
                    >
                      <Favorite sx={{ fontSize: { xs: 16, sm: 20 } }} />
                    </IconButton>
                    <IconButton 
                      color="error" 
                      size="small" 
                      onClick={() => handleRemoveFromCart(item)}
                      title="Remove from cart"
                      sx={{ padding: { xs: 0.5, sm: 1 } }}
                    >
                      <Delete sx={{ fontSize: { xs: 16, sm: 20 } }} />
                    </IconButton>
                  </Box>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={5} align="center">
                <Box sx={{ py: 3, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <ShoppingCart sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                  <Typography variant="h6" color="text.secondary" gutterBottom>
                    Your cart is empty
                  </Typography>
                  <Button 
                    variant="contained" 
                    color="primary" 
                    onClick={() => navigate('/')}
                    sx={{ mt: 1 }}
                  >
                    Continue Shopping
                  </Button>
                </Box>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );

  // Render saved items
  const renderSavedItems = () => (
    <Box sx={{ mt: 4 }}>
      <Typography variant="h6" gutterBottom>
        Saved For Later ({savedItems.length})
      </Typography>
      
      {savedItems.length > 0 ? (
        <Grid container spacing={2}>
          {savedItems.map(item => (
            <Grid item xs={12} sm={6} md={4} key={item._id}>
              <Card sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                {item.image && (
                  <CardMedia
                    component="img"
                    height="140"
                    image={item.image}
                    alt={item.name}
                  />
                )}
                <CardContent sx={{ flexGrow: 1 }}>
                  <Typography variant="h6" component="div" gutterBottom>
                    {item.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    ₹{item.price}
                  </Typography>
                  <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between' }}>
                    <Button 
                      size="small" 
                      variant="outlined" 
                      startIcon={<ShoppingCart />}
                      onClick={() => dispatch(moveToCart(item))}
                    >
                      Move to Cart
                    </Button>
                    <IconButton 
                      color="error" 
                      size="small" 
                      onClick={() => dispatch(removeSavedItem(item))}
                    >
                      <Delete />
                    </IconButton>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      ) : (
        <Paper sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="body1" color="text.secondary">
            No items saved for later
          </Typography>
        </Paper>
      )}
    </Box>
  );

  // Render delivery form
  const renderDeliveryForm = () => (
    <Box sx={{ mt: { xs: 1, sm: 2 } }}>
      <Paper sx={{ p: { xs: 2, sm: 3 } }}>
        <Typography variant="h6" sx={{ fontSize: { xs: '1.1rem', sm: '1.25rem' } }} gutterBottom>
          Delivery Information
        </Typography>
        
        <Grid container spacing={3}>
          {/* Delivery Method Selection */}
          <Grid item xs={12}>
            <FormControl component="fieldset">
              <FormLabel component="legend">Delivery Method</FormLabel>
              <RadioGroup
                value={checkout.deliveryMethod}
                onChange={(e) => dispatch(updateDeliveryMethod(e.target.value))}
              >
                <FormControlLabel 
                  value="standard" 
                  control={<Radio />} 
                  label={
                    <Box>
                      <Typography variant="body1">Standard Delivery (₹49)</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Estimated delivery: 45-60 minutes
                      </Typography>
                    </Box>
                  } 
                />
                <FormControlLabel 
                  value="express" 
                  control={<Radio />} 
                  label={
                    <Box>
                      <Typography variant="body1">Express Delivery (₹99)</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Estimated delivery: 25-30 minutes
                      </Typography>
                    </Box>
                  } 
                />
                <FormControlLabel 
                  value="pickup" 
                  control={<Radio />} 
                  label={
                    <Box>
                      <Typography variant="body1">🚗 Self Pickup (Free)</Typography>
                      <Typography variant="caption" color="success.main" sx={{ fontWeight: 'medium' }}>
                        Ready for pickup in 15-20 minutes • You'll get a 4-digit OTP • View pickup location on map
                      </Typography>
                    </Box>
                  } 
                />
              </RadioGroup>
            </FormControl>
          </Grid>
          
          {/* Conditional Address Field */}
          {checkout.deliveryMethod !== 'pickup' && (
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Delivery Address"
                variant="outlined"
                value={checkout.deliveryAddress}
                onChange={(e) => dispatch(updateDeliveryAddress(e.target.value))}
                required
                placeholder="Enter your complete delivery address"
              />
            </Grid>
          )}
          
          {/* Pickup Information Display */}
          {checkout.deliveryMethod === 'pickup' && (
            <Grid item xs={12}>
              <Alert severity="info" sx={{ mb: 2 }}>
                <Typography variant="body2" sx={{ fontWeight: 'medium', mb: 1 }}>
                  Self Pickup Selected - Here's what happens next:
                </Typography>
                <Typography variant="body2" component="div">
                  • After placing your order, you'll receive a <strong>4-digit OTP</strong><br />
                  • A map will show you the pickup location and directions<br />
                  • Your order will be ready in 15-20 minutes<br />
                  • Show the OTP to the restaurant staff to collect your order
                </Typography>
              </Alert>
              <Box 
                sx={{ 
                  p: 2, 
                  bgcolor: 'grey.50', 
                  borderRadius: 1,
                  border: '1px solid',
                  borderColor: 'grey.300'
                }}
              >
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Pickup Location:
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 'medium' }}>
                  {cartItems[0]?.sellerAddress || cartItems[0]?.address || "Restaurant Location"} 
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Exact location will be shown on map after placing order
                </Typography>
              </Box>
            </Grid>
          )}
          
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Contact Number"
              variant="outlined"
              value={checkout.contactNumber}
              onChange={(e) => dispatch(updateContactNumber(e.target.value))}
              required
              placeholder="Your phone number for order updates"
            />
          </Grid>
          
          <Grid item xs={12}>
            <TextField
              fullWidth
              label={checkout.deliveryMethod === 'pickup' ? "Special Instructions (optional)" : "Delivery Instructions (optional)"}
              variant="outlined"
              multiline
              rows={3}
              value={checkout.deliveryInstructions}
              onChange={(e) => dispatch(updateDeliveryInstructions(e.target.value))}
              placeholder={
                checkout.deliveryMethod === 'pickup' 
                  ? "Any special requests for your order preparation..."
                  : "E.g., Leave at the door, Call when arriving, etc."
              }
            />
          </Grid>
        </Grid>
      </Paper>
    </Box>
  );

  // Render payment form
  const renderPaymentForm = () => (
    <Box sx={{ mt: { xs: 1, sm: 2 } }}>
      <Paper sx={{ p: { xs: 2, sm: 3 } }}>
        <Typography variant="h6" sx={{ fontSize: { xs: '1.1rem', sm: '1.25rem' } }} gutterBottom>
          Payment Method
        </Typography>
        
        <FormControl component="fieldset">
          <RadioGroup
            value={checkout.paymentMethod}
            onChange={(e) => {
              dispatch(updatePaymentMethod(e.target.value));
              // Reset payment status when changing payment method
              if (e.target.value !== 'solana') {
                dispatch(resetPaymentStatus());
              }
            }}
          >
            <FormControlLabel 
              value="cash" 
              control={<Radio />} 
              label="Cash on Delivery" 
            />
            <FormControlLabel 
              value="card" 
              control={<Radio />} 
              label="Credit/Debit Card" 
            />
            <FormControlLabel 
              value="wallet" 
              control={<Radio />} 
              label="Digital Wallet" 
            />
            <FormControlLabel 
              value="solana" 
              control={<Radio />} 
              label="Solana Wallet" 
            />
          </RadioGroup>
        </FormControl>

        {checkout.paymentMethod === 'card' && (
          <Alert severity="info" sx={{ mt: 2 }}>
            Card payment will be collected at the time of delivery for your security.
          </Alert>
        )}
        
        {checkout.paymentMethod === 'solana' && (
          <Box sx={{ mt: 3 }}>
            <SolanaPayment
             
              amount={ Number(total/(170*85))} 
              onSuccess={(txId) => {
                toast.success("Payment successful!");
              }}
              onError={(error) => {
                toast.error(error || "Payment failed");
              }}
            />
          </Box>
        )}
      </Paper>
    </Box>
  );

  // Render order summary
  const renderOrderSummary = () => (
    <Paper sx={{ p: { xs: 2, sm: 3 }, mb: { xs: 2, sm: 3 } }}>
      <Typography variant="h6" sx={{ fontSize: { xs: '1.1rem', sm: '1.25rem' } }} gutterBottom>
        Order Summary
      </Typography>
      
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="body2" sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}>Subtotal</Typography>
        <Typography variant="body2" sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}>₹{subtotal.toFixed(2)}</Typography>
      </Box>
      
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="body2" sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}>Tax (7%)</Typography>
        <Typography variant="body2" sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}>₹{tax.toFixed(2)}</Typography>
      </Box>
      
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="body2" sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}>Delivery Fee</Typography>
        <Typography variant="body2" sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}>₹{deliveryFee.toFixed(2)}</Typography>
      </Box>
      
      {discount > 0 && (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="body1" color="success.main">
            Discount ({checkout.appliedPromoCode})
          </Typography>
          <Typography variant="body1" color="success.main">
            -₹{discount.toFixed(2)}
          </Typography>
        </Box>
      )}
      
      <Divider sx={{ my: 2 }} />
      
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="h6" sx={{ fontSize: { xs: '1.1rem', sm: '1.25rem' } }}>Total</Typography>
        <Typography variant="h6" sx={{ fontSize: { xs: '1.1rem', sm: '1.25rem' } }}>₹{total.toFixed(2)}</Typography>
      </Box>
      
      {/* Promo Code Section */}
      {activeStep >= 2 && (
        <Box sx={{ mt: 3 }}>
          <Typography variant="subtitle1" gutterBottom>
            Have a promo code?
          </Typography>
          
          <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 1 }}>
            <TextField
              size="small"
              label="Promo Code"
              variant="outlined"
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value)}
              disabled={checkout.appliedPromoCode !== null}
              error={!!promoError}
              helperText={promoError}
              sx={{ 
                mr: 1, 
                flexGrow: 1,
                '& .MuiInputBase-input': {
                  fontSize: { xs: '0.75rem', sm: '0.875rem' }
                },
                '& .MuiFormHelperText-root': {
                  fontSize: { xs: '0.65rem', sm: '0.75rem' }
                }
              }}
            />
            
            {checkout.appliedPromoCode ? (
              <Button
                variant="outlined"
                color="error"
                onClick={handleRemovePromoCode}
                startIcon={<Refresh size={16} />}
                size="small"
                sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}
              >
                Remove
              </Button>
            ) : (
              <Button
                variant="contained"
                onClick={handleApplyPromoCode}
                disabled={!promoCode}
                size="small"
                sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}
              >
                Apply
              </Button>
            )}
          </Box>
          
          {promoSuccess && (
            <Alert severity="success" sx={{ mt: 1 }}>
              Promo code applied successfully!
            </Alert>
          )}
        </Box>
      )}
    </Paper>
  );

  // Render order review
  const renderOrderReview = () => (
    <Box sx={{ mt: { xs: 1, sm: 2 } }}>
      <Paper sx={{ p: { xs: 2, sm: 3 } }}>
        <Typography variant="h6" sx={{ fontSize: { xs: '1.1rem', sm: '1.25rem' } }} gutterBottom>
          Review Your Order
        </Typography>
        
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle1" gutterBottom>
            Delivery Details
          </Typography>
          <Typography variant="body1">
            <strong>Address:</strong> {checkout.deliveryAddress}
          </Typography>
          <Typography variant="body1">
            <strong>Contact:</strong> {checkout.contactNumber}
          </Typography>
          <Typography variant="body1">
            <strong>Method:</strong> {checkout.deliveryMethod.charAt(0).toUpperCase() + checkout.deliveryMethod.slice(1)} Delivery
          </Typography>
          {checkout.deliveryInstructions && (
            <Typography variant="body1">
              <strong>Instructions:</strong> {checkout.deliveryInstructions}
            </Typography>
          )}
        </Box>
        
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle1" gutterBottom>
            Payment Method
          </Typography>
          <Typography variant="body1">
            {checkout.paymentMethod === 'cash' ? 'Cash on Delivery' : 
             checkout.paymentMethod === 'card' ? 'Credit/Debit Card' : 'Digital Wallet'}
          </Typography>
        </Box>
        
        <Typography variant="subtitle1" gutterBottom>
          Order Items
        </Typography>
        
        <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ py: { xs: 1, sm: 1.5 }, px: { xs: 1, sm: 2 }, fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>Item</TableCell>
                <TableCell align="right" sx={{ py: { xs: 1, sm: 1.5 }, px: { xs: 1, sm: 2 }, fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>Qty</TableCell>
                <TableCell align="right" sx={{ py: { xs: 1, sm: 1.5 }, px: { xs: 1, sm: 2 }, fontSize: { xs: '0.75rem', sm: '0.875rem' }, display: { xs: 'none', sm: 'table-cell' } }}>Price</TableCell>
                <TableCell align="right" sx={{ py: { xs: 1, sm: 1.5 }, px: { xs: 1, sm: 2 }, fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>Total</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {cartItems.map((item) => (
                <TableRow key={item._id}>
                  <TableCell sx={{ py: { xs: 1, sm: 1.5 }, px: { xs: 1, sm: 2 }, fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>{item.name}</TableCell>
                  <TableCell align="right" sx={{ py: { xs: 1, sm: 1.5 }, px: { xs: 1, sm: 2 }, fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>{item.quantity}</TableCell>
                  <TableCell align="right" sx={{ py: { xs: 1, sm: 1.5 }, px: { xs: 1, sm: 2 }, fontSize: { xs: '0.75rem', sm: '0.875rem' }, display: { xs: 'none', sm: 'table-cell' } }}>₹{item.price}</TableCell>
                  <TableCell align="right" sx={{ py: { xs: 1, sm: 1.5 }, px: { xs: 1, sm: 2 }, fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>₹{(item.quantity * item.price).toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );

  // Render success message
  const renderSuccessMessage = () => (
    <Box sx={{ mt: { xs: 1, sm: 2 }, textAlign: 'center' }}>
      <Paper sx={{ p: { xs: 3, sm: 4 } }}>
        <Check sx={{ fontSize: { xs: 48, sm: 64 }, color: 'success.main', mb: { xs: 1, sm: 2 } }} />
        
        <Typography variant="h5" sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' } }} gutterBottom>
          Order Placed Successfully!
        </Typography>
        
        <Typography variant="body1" sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }} paragraph>
          Thank you for your order. Your order has been placed and is being processed.
        </Typography>
        
        <Typography variant="body2" sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }} color="text.secondary" paragraph>
          You will receive an email confirmation shortly.
        </Typography>
        
        <Box sx={{ mt: { xs: 2, sm: 3 }, display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: { xs: 1, sm: 0 } }}>
          <Button 
            variant="contained" 
            color="primary" 
            onClick={() => navigate('/')}
            sx={{ 
              mr: { sm: 2 },
              mb: { xs: 1, sm: 0 },
              fontSize: { xs: '0.75rem', sm: '0.875rem' }
            }}
            size="small"
          >
            Continue Shopping
          </Button>
          <Button 
            variant="outlined"
            size="small" 
            sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}
            onClick={() => {
              const orderId = localStorage.getItem('lastOrderId');
              if (orderId) {
                navigate(`/orders/${orderId}`);
              } else {
                navigate('/orders');
              }
            }}
          >
            View Order Details
          </Button>
        </Box>
      </Paper>
    </Box>
  );

  // For debugging cart data
  const renderDebugInfo = () => {
    if (process.env.NODE_ENV !== 'production') {
      return (
        <Box sx={{ mt: 4, p: 2, border: '1px dashed grey', display: 'none' }}>
          <Typography variant="h6">Debug Cart Data</Typography>
          {cartItems.map(item => (
            <Box key={item._id} sx={{ mb: 1 }}>
              <Typography variant="body2">
                <strong>ID:</strong> {item._id}<br />
                <strong>Name:</strong> {item.name}<br />
                <strong>Quantity:</strong> {item.quantity}<br />
                <strong>Price:</strong> {item.price}<br />
                <strong>Max Stock:</strong> {item.maxStock}<br />
              </Typography>
              <Divider sx={{ my: 1 }} />
            </Box>
          ))}
        </Box>
      );
    }
    return null;
  };

  // Make local component state match global state
  useEffect(() => {
    if (orderStatus === 'loading') {
      setLoadingOrders(true);
    } else {
      setLoadingOrders(false);
    }
  }, [orderStatus]);

  // Set up a timeout to reset order status if it gets stuck when placing an order
  useEffect(() => {
    let orderStatusTimeout;
    
    // Only set up timeout for the order placement loading state (not fetching orders)
    if (orderStatus === 'loading' && activeStep === 3) {
      // If the order is in loading state for more than 15 seconds, reset it
      orderStatusTimeout = setTimeout(() => {
        console.log('Order processing timeout reached, resetting status');
        dispatch(resetOrderStatusAction());
        toast.error('Order processing took too long. Please try again.');
      }, 15000);
    }
    
    return () => {
      if (orderStatusTimeout) {
        clearTimeout(orderStatusTimeout);
      }
    };
  }, [orderStatus, activeStep, dispatch]);

  // Track when the user changes and refresh orders
  useEffect(() => {
    if (user && activeTab === 2) {
      // When user logs in or changes, refresh their orders
      dispatch(fetchOrders())
        .unwrap()
        .then((response) => {
          console.log(`Fetched ${response?.orders?.length || 0} orders for user ${user.username || user._id}`);
        })
        .catch((error) => {
          console.error("Error fetching orders:", error);
        });
    }
  }, [user?._id, activeTab, dispatch]);

  // Fetch orders if switching to Order History tab
  useEffect(() => {
    if (activeTab === 2 && user) {
      dispatch(fetchOrders())
        .unwrap()
        .then((response) => {
          console.log("Orders fetched successfully:", response);
        })
        .catch((error) => {
          console.error("Error fetching orders:", error);
          toast.error(error?.message || "Failed to load order history");
        });
    }
  }, [activeTab, user, dispatch]);

  // Handle refreshing order history
  const handleRefreshOrders = useCallback(() => {
    if (user) {
      dispatch(fetchOrders())
        .unwrap()
        .then((response) => {
          console.log("Orders refreshed successfully:", response);
          toast.success("Order history refreshed");
        })
        .catch((error) => {
          console.error("Error refreshing orders:", error);
          toast.error(error?.message || "Failed to refresh orders");
        });
    }
  }, [user, dispatch]);

  // Handle view order details 
  const handleViewOrderDetails = (orderId) => {
    if (orderId) {
      navigate(`/orders/${orderId}`);
    } else {
      toast.error("Invalid order ID");
    }
  };

  // Add the getStatusColor function from OrderHistory
  const getStatusColor = (status) => {
    switch (status) {
      case 'processing':
        return 'warning';
      case 'confirmed':
        return 'info';
      case 'preparing':
        return 'secondary';
      case 'out_for_delivery':
        return 'primary';
      case 'delivered':
        return 'success';
      case 'cancelled':
        return 'error';
      default:
        return 'default';
    }
  };

  // Format date helper
  const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  // Format price to currency
  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(price);
  };

  // Function to update order status to confirmed
  const updateOrderStatusToConfirmed = async (orderId) => {
    try {
      console.log('Automatically updating order status to confirmed:', orderId);
      const response = await updateOrderStatus(orderId, 'confirmed', 'Order confirmed automatically after placement');
      console.log('Order status updated successfully:', response);
      
      // Update the order status in Redux state
      if (response && response.success) {
        // Update order status in cart slice
        dispatch(syncOrderStatus({
          orderId: orderId,
          status: 'confirmed'
        }));
        
        // Update confirmed orders in confirmed orders slice
        dispatch(fetchConfirmedOrders())
          .unwrap()
          .then(result => {
            console.log('Successfully refreshed confirmed orders:', result);
            // Also force a refresh to ensure we have all confirmed orders
            dispatch(fetchOrders());
          })
          .catch(err => {
            console.error('Failed to refresh confirmed orders, falling back to fetch orders:', err);
            // If direct addition fails, fall back to just refreshing the list
            dispatch(fetchOrders());
          });
        
        // Refresh all orders to ensure we have the latest data
        dispatch(fetchOrders());
      }
    } catch (error) {
      console.error('Failed to update order status to confirmed:', error);
      // Don't show toast error to user since this is happening in the background
      // But we should try again after a short delay
      setTimeout(() => {
        console.log('Retrying order confirmation after failure');
        updateOrderStatusToConfirmed(orderId);
      }, 3000);
    }
    
    // Regardless of success/failure, schedule additional refreshes to ensure data consistency
    setTimeout(() => dispatch(fetchOrders()), 5000);
    setTimeout(() => dispatch(fetchOrders()), 10000);
  };

  // Filter orders to ensure they belong to current user
  const userOrders = useMemo(() => {
    if (!user || !user._id) return [];
    const userId = user._id;
    
    // Filter orders that have user ID and ensure it matches the current user
    return orders.filter(order => {
      // Skip orders without user ID or that don't match current user
      if (order.user && order.user.toString() !== userId) {
        console.warn(`Filtering out order ${order._id} that belongs to another user`);
        return false;
      }
      return true;
    });
  }, [orders, user]);

  // Auto-fill user address if user has location data
  useEffect(() => {
    if (user && user.location && user.location.coordinates) {
      const [lng, lat] = user.location.coordinates;
      dispatch(updateDeliveryAddress(`${lat.toFixed(4)}, ${lng.toFixed(4)}`));
      dispatch(setDeliveryPoint([lng, lat]));
    }
  }, [user, dispatch]);

  // Main render
  return (
    <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8 mb-16">
      {/* Show pickup success screen if pickup order is active */}
      {showPickupScreen && currentPickupOrder ? (
        <PickupSuccessScreen 
          orderData={currentPickupOrder} 
          onClose={() => dispatch(clearPickupOrder())}
        />
      ) : (
        <>
          <Typography variant="h5" sx={{ fontSize: { xs: '1.5rem', sm: '2rem' } }} gutterBottom>Your Cart</Typography>

          {/* Tabs */}
          <Tabs 
            value={activeTab} 
            onChange={handleTabChange} 
            aria-label="cart tabs"
            sx={{ 
              mb: { xs: 2, sm: 3 },
              '& .MuiTab-root': { 
                fontSize: { xs: '0.75rem', sm: '0.875rem' },
                minHeight: { xs: '48px', sm: '48px' },
                py: { xs: 1, sm: 1.5 },
                px: { xs: 1, sm: 2 }
              }
            }}
            variant="scrollable"
            scrollButtons="auto"
          >
            <Tab icon={<ShoppingCart size={18} />} label="Shopping Cart" />
            <Tab icon={<Favorite size={18} />} label="Saved Items" />
            <Tab icon={<History size={18} />} label="Order History" />
          </Tabs>

          {/* Shopping Cart Tab with Checkout Flow */}
          {activeTab === 0 && (
            <>
              {/* Show stepper only during checkout process */}
              <Stepper 
                activeStep={activeStep} 
                sx={{ 
                  mb: { xs: 2, sm: 4 },
                  '& .MuiStepLabel-label': {
                    fontSize: { xs: '0.7rem', sm: '0.875rem' }
                  },
                  '& .MuiStepIcon-root': {
                    fontSize: { xs: '1.2rem', sm: '1.5rem' }
                  },
                  '& .MuiSvgIcon-root': {
                    width: { xs: '1.2rem', sm: '1.5rem' },
                    height: { xs: '1.2rem', sm: '1.5rem' }
                  }
                }}
                alternativeLabel
              >
                {steps.map((label, index) => (
                  <Step key={label}>
                    <StepLabel>{label}</StepLabel>
                  </Step>
                ))}
              </Stepper>

              {activeStep === 0 ? (
                <div>
                  {renderCartItems()}
                  {cartItems.length > 0 && renderOrderSummary()}
                </div>
              ) : activeStep === 1 ? (
                <div>
                  {renderDeliveryForm()}
                  {renderOrderSummary()}
                </div>
              ) : activeStep === 2 ? (
                <div>
                  {renderPaymentForm()}
                  {renderOrderSummary()}
                </div>
              ) : activeStep === 3 ? (
                <div>
                  {renderOrderReview()}
                  {renderOrderSummary()}
                </div>
              ) : (
                <div>
                  {renderSuccessMessage()}
                </div>
              )}

              {/* Navigation buttons for checkout process */}
              <Box sx={{ 
                display: 'flex', 
                flexDirection: 'row', 
                pt: { xs: 1, sm: 2 },
                pb: { xs: 2, sm: 0 }
              }}>
                <Button
                  color="inherit"
                  disabled={activeStep === 0 || activeStep === steps.length}
                  onClick={handleBack}
                  sx={{ 
                    mr: 1,
                    fontSize: { xs: '0.75rem', sm: '0.875rem' },
                    py: { xs: 0.5, sm: 0.75 },
                    px: { xs: 1, sm: 2 }
                  }}
                  size="small"
                >
                  Back
                </Button>
                <Box sx={{ flex: '1 1 auto' }} />
                {activeStep === steps.length ? (
                  <Button 
                    onClick={() => navigate('/')}
                    sx={{ 
                      fontSize: { xs: '0.75rem', sm: '0.875rem' },
                      py: { xs: 0.5, sm: 0.75 },
                      px: { xs: 1, sm: 2 }
                    }}
                    size="small"
                  >
                    Continue Shopping
                  </Button>
                ) : (
                  <Button 
                    onClick={activeStep === steps.length - 1 ? handlePlaceOrder : handleNext}
                    variant="contained"
                    disabled={cartItems.length === 0 && activeStep === 0}
                    sx={{ 
                      fontSize: { xs: '0.75rem', sm: '0.875rem' },
                      py: { xs: 0.5, sm: 0.75 },
                      px: { xs: 1, sm: 2 }
                    }}
                    size="small"
                  >
                    {activeStep === steps.length - 1 ? 'Place Order' : 'Next'}
                  </Button>
                )}
              </Box>

              {/* Debug info - hidden by default */}
              {renderDebugInfo && renderDebugInfo()}
            </>
          )}

          {/* Saved Items Tab */}
          {activeTab === 1 && (
            <div>
              {renderSavedItems()}
            </div>
          )}
          
          {/* Order History Tab */}
          {activeTab === 2 && (
            <div>
              {!user ? (
                <Box sx={{ 
                  p: 4, 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center',
                  bgcolor: 'background.paper',
                  borderRadius: 2,
                  boxShadow: 1
                }}>
                  <Typography variant="h6" gutterBottom>
                    Please log in to view your orders
                  </Typography>
                  <Typography variant="body2" color="text.secondary" paragraph>
                    You need to be logged in to view your order history.
                  </Typography>
                  <Button 
                    variant="contained" 
                    color="primary" 
                    onClick={() => navigate('/login')}
                  >
                    Go to Login
                  </Button>
                </Box>
              ) : loadingOrders ? (
                <Box sx={{ 
                  display: 'flex', 
                  justifyContent: 'center', 
                  alignItems: 'center', 
                  py: 4 
                }}>
                  <CircularProgress />
                  <Typography variant="body2" sx={{ ml: 2 }}>
                    Loading your orders...
                  </Typography>
                </Box>
              ) : userOrders.length === 0 ? (
                <Box sx={{ 
                  p: 4, 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center',
                  bgcolor: 'background.paper',
                  borderRadius: 2,
                  boxShadow: 1
                }}>
                  <Typography variant="h6" gutterBottom>
                    No orders yet
                  </Typography>
                  <Typography variant="body2" color="text.secondary" paragraph>
                    You haven't placed any orders yet. Start shopping to see your orders here.
                  </Typography>
                  <Button 
                    variant="contained" 
                    color="primary" 
                    onClick={() => navigate('/')}
                  >
                    Browse Products
                  </Button>
                </Box>
              ) : (
                <Box>
                  <Box sx={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    mb: 3 
                  }}>
                    <Box>
                      <Typography variant="h6" gutterBottom>
                        {user.username ? `${user.username}'s Orders` : 'Your Orders'}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Showing {userOrders.length} orders from your account
                      </Typography>
                    </Box>
                    <Button 
                      startIcon={<Refresh />}
                      variant="outlined"
                      onClick={handleRefreshOrders}
                      disabled={loadingOrders}
                    >
                      Refresh
                    </Button>
                  </Box>

                  {userOrders.map((order) => (
                    <Card 
                      key={order._id} 
                      sx={{ 
                        mb: 3,
                        boxShadow: 'rgb(0 0 0 / 10%) 0px 2px 8px',
                        transition: 'transform 0.2s',
                        '&:hover': {
                          transform: 'translateY(-4px)'
                        },
                        cursor: 'pointer',
                        position: 'relative',
                        overflow: 'visible'
                      }}
                      onClick={() => handleViewOrderDetails(order._id)}
                    >
                      {/* Personal order badge */}
                      <Box
                        sx={{
                          position: 'absolute',
                          top: -10,
                          right: 15,
                          backgroundColor: 'primary.main',
                          color: 'white',
                          fontWeight: 'bold',
                          fontSize: '0.75rem',
                          py: 0.5,
                          px: 1.5,
                          borderRadius: 5,
                          zIndex: 1,
                          boxShadow: 1,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 0.5
                        }}
                      >
                        <Typography variant="caption" sx={{ fontWeight: 'bold' }}>Your Order</Typography>
                      </Box>
                      
                      <CardContent sx={{ p: 3 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap' }}>
                          <Typography variant="subtitle1">
                            Order #{order._id.substring(order._id.length - 6)}
                          </Typography>
                          <Chip 
                            label={order.status.replace(/_/g, ' ').toUpperCase()}
                            color={getStatusColor(order.status)}
                            size="small"
                          />
                        </Box>
                        
                        <Typography variant="body2" color="text.secondary">
                          Placed on {formatDate(order.createdAt)}
                        </Typography>
                        
                        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Box>
                            <Typography variant="body2">
                              {order.items.length} {order.items.length === 1 ? 'item' : 'items'}
                            </Typography>
                            <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                              Total: ₹{(order.total || order.totalAmount || 0).toFixed(2)}
                            </Typography>
                          </Box>
                          <Button 
                            variant="outlined"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewOrderDetails(order._id);
                            }}
                            endIcon={<KeyboardArrowRight />}
                          >
                            View Details
                          </Button>
                        </Box>

                        {order.items.length > 0 && (
                          <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid #eee' }}>
                            <Grid container spacing={1}>
                              {order.items.slice(0, 3).map((item, index) => (
                                <Grid item key={index}>
                                  {item.image ? (
                                    <Box
                                      component="img"
                                      src={item.image}
                                      alt={item.name}
                                      sx={{ 
                                        width: 40, 
                                        height: 40, 
                                        objectFit: 'cover', 
                                        borderRadius: 1,
                                        mr: 0.5 
                                      }}
                                    />
                                  ) : (
                                    <Box 
                                      sx={{ 
                                        width: 40, 
                                        height: 40, 
                                        bgcolor: 'grey.200',
                                        borderRadius: 1,
                                        mr: 0.5,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                      }}
                                    >
                                      <ShoppingCart color="action" fontSize="small" />
                                    </Box>
                                  )}
                                </Grid>
                              ))}
                              {order.items.length > 3 && (
                                <Grid item>
                                  <Box 
                                    sx={{ 
                                      width: 40, 
                                      height: 40, 
                                      bgcolor: 'grey.100',
                                      color: 'text.secondary',
                                      borderRadius: 1,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontWeight: 'bold'
                                    }}
                                  >
                                    +{order.items.length - 3}
                                  </Box>
                                </Grid>
                              )}
                            </Grid>
                          </Box>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                  
                  <Box sx={{ mt: 3, textAlign: 'center' }}>
                    <Button 
                      variant="contained"
                      onClick={() => navigate('/orders')}
                    >
                      View All Orders
                    </Button>
                  </Box>
                </Box>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default CartPage;
