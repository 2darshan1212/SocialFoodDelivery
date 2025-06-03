import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Chip,
  Divider,
  Avatar,
  CircularProgress,
  Alert,
  IconButton,
  TextField,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Paper,
  InputAdornment,
  Fade,
  Collapse
} from '@mui/material';
import {
  Close,
  Person,
  Phone,
  Restaurant,
  AccessTime,
  CheckCircle,
  LocalShipping,
  ShoppingBag,
  QrCode,
  Visibility,
  VisibilityOff,
  Security,
  Timer,
  LocationOn
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import {
  verifyPickupCode,
  completePickup,
  setPickupCodeInput,
  clearPickupState,
  setShowPickupModal,
  markPickupNotificationRead,
  selectPickupState,
  selectVerifiedOrder,
  selectPickupLoading,
  selectCurrentNotificationOrder,
  selectFullOrderDetails,
  selectOrderLoading,
  fetchOrderDetails,
  setSelectedOrderId
} from '../../redux/pickupSlice';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../../utils/axiosInstance';

const PickupOrderDetailsModal = ({ open: propOpen, onClose: propOnClose }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const pickupState = useSelector(selectPickupState);
  const verifiedOrder = useSelector(selectVerifiedOrder);
  const isLoading = useSelector(selectPickupLoading);
  const currentNotificationOrder = useSelector(selectCurrentNotificationOrder);
  const fullOrderDetails = useSelector(selectFullOrderDetails);
  const isOrderLoading = useSelector(selectOrderLoading);
  
  // Get current user info for authorization debugging
  const { user } = useSelector(store => store.auth);
  
  // Get specific loading states for better UI feedback
  const completionLoading = useSelector(state => state.pickup.completionLoading);
  const verificationLoading = useSelector(state => state.pickup.verificationLoading);
  
  const [showPickupCode, setShowPickupCode] = useState(false);
  const [codeError, setCodeError] = useState('');
  
  // Use Redux state for open if prop not provided
  const open = propOpen !== undefined ? propOpen : pickupState.showPickupModal;
  const orderId = currentNotificationOrder?._id || pickupState.selectedOrderId;
  const pickupCodeInput = pickupState.pickupCodeInput;
  
  // Default onClose function if not provided
  const onClose = propOnClose || (() => {
    dispatch(clearPickupState());
    dispatch(setShowPickupModal(false));
  });
  
  // Debug effect to log state changes
  useEffect(() => {
    console.log("🏪 PickupModal State Update:", {
      propOpen,
      derivedOpen: open,
      showPickupModalFromRedux: pickupState.showPickupModal,
      orderId,
      hasCurrentNotificationOrder: !!currentNotificationOrder,
      hasFullOrderDetails: !!fullOrderDetails,
      hasVerifiedOrder: !!verifiedOrder,
      isOrderLoading,
      isLoading,
      pickupState: {
        showPickupModal: pickupState.showPickupModal,
        selectedOrderId: pickupState.selectedOrderId,
        orderError: pickupState.orderError
      }
    });
  }, [propOpen, open, pickupState.showPickupModal, orderId, currentNotificationOrder, fullOrderDetails, verifiedOrder, isOrderLoading, isLoading, pickupState]);
  
  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      console.log("🏪 PickupModal opening, NOT clearing state...");
      if (orderId) {
        dispatch(markPickupNotificationRead(orderId));
        
        // If we don't have current notification order but we have orderId, fetch order details
        if (!currentNotificationOrder && !fullOrderDetails) {
          console.log("🔄 No notification data available, fetching order details for:", orderId);
          dispatch(fetchOrderDetails(orderId));
        }
        
        console.log("🚗 Pickup Modal Opened:", {
          orderId,
          currentNotificationOrder,
          fullOrderDetails,
          verifiedOrder
        });
      }
    }
  }, [open, orderId, dispatch]);

  // Debug effect to track data changes
  useEffect(() => {
    console.log("📊 Pickup Modal Data Update:", {
      open,
      isOrderLoading,
      hasCurrentNotificationOrder: !!currentNotificationOrder,
      hasFullOrderDetails: !!fullOrderDetails,
      hasVerifiedOrder: !!verifiedOrder,
      pickupState,
      currentNotificationOrder: currentNotificationOrder ? {
        id: currentNotificationOrder._id,
        total: currentNotificationOrder.total,
        deliveryMethod: currentNotificationOrder.deliveryMethod
      } : null,
      fullOrderDetails: fullOrderDetails ? {
        id: fullOrderDetails._id,
        total: fullOrderDetails.total,
        itemsCount: fullOrderDetails.items?.length,
        deliveryMethod: fullOrderDetails.deliveryMethod
      } : null
    });
  }, [open, isOrderLoading, currentNotificationOrder, fullOrderDetails, verifiedOrder, pickupState]);

  // Handle completion success and auto-redirect
  useEffect(() => {
    if (pickupState.completedOrder) {
      console.log("🎉 Pickup completed! Setting up auto-redirect...");
      
      // Auto-redirect after 3 seconds
      const redirectTimer = setTimeout(() => {
        console.log("🏠 Auto-redirecting to home page...");
        dispatch(clearPickupState());
        navigate('/');
      }, 3000);
      
      return () => {
        clearTimeout(redirectTimer);
      };
    }
  }, [pickupState.completedOrder, dispatch, navigate]);

  const handlePickupCodeChange = (event) => {
    const value = event.target.value.replace(/\D/g, '').substring(0, 4);
    dispatch(setPickupCodeInput(value));
    if (codeError) setCodeError('');
  };

  const handleVerifyCode = () => {
    console.log("🔘 Complete Pickup button clicked!");
    
    // Try to find order ID from multiple sources
    const possibleOrderId = orderId || 
                           currentNotificationOrder?._id || 
                           fullOrderDetails?._id || 
                           pickupState.selectedOrderId;
    
    console.log("📋 Current state:", {
      pickupCodeInput,
      orderId,
      possibleOrderId,
      pickupCodeLength: pickupCodeInput.length,
      completionLoading,
      currentNotificationOrder: !!currentNotificationOrder,
      fullOrderDetails: !!fullOrderDetails,
      selectedOrderId: pickupState.selectedOrderId
    });
    
    if (!pickupCodeInput || pickupCodeInput.length !== 4) {
      console.log("❌ Invalid pickup code - showing error");
      setCodeError('Please enter a 4-digit pickup code');
      return;
    }

    if (!possibleOrderId) {
      console.log("❌ No order ID found anywhere");
      toast.error('Order ID not found. Please try refreshing the page or reopening the notification.');
      return;
    }

    // If we found an order ID but orderId is not set, set it
    if (possibleOrderId !== orderId) {
      console.log("🔧 Setting order ID from fallback source:", possibleOrderId);
      dispatch(setSelectedOrderId(possibleOrderId));
    }

    console.log("✅ All validations passed, starting pickup completion...");
    
    // Use the found order ID
    const useOrderId = possibleOrderId;
    
    // Directly complete the pickup (which includes verification)
    console.log("🚗 Starting pickup completion process with order ID:", useOrderId);
    dispatch(completePickup({ orderId: useOrderId, pickupCode: pickupCodeInput }))
      .unwrap()
      .then((completedOrder) => {
        console.log("🎉 Pickup completed successfully:", completedOrder);
        
        // Show success message to post author
        toast.success("🎉 Pickup completed! Customer has received their order.");
        
        // The useEffect will handle auto-redirect
      })
      .catch((error) => {
        console.error("❌ Pickup completion failed:", error);
        toast.error(`Failed to complete pickup: ${error}`);
      });
  };

  const handleClose = () => {
    onClose();
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getDisplayOrder = () => {
    return pickupState.completedOrder || fullOrderDetails || currentNotificationOrder;
  };

  const displayOrder = getDisplayOrder();

  if (!open) return null;

  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { borderRadius: 2, minHeight: '60vh' }
      }}
    >
      <DialogTitle sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        borderBottom: '1px solid',
        borderColor: 'divider',
        pb: 2,
        bgcolor: 'success.light',
        color: 'success.contrastText'
      }}>
        <Box display="flex" alignItems="center" gap={1}>
          <LocalShipping color="inherit" />
          <Typography variant="h6">
            🚗 Self-Pickup Order Verification
          </Typography>
          {displayOrder && (
            <Chip 
              label={`#${displayOrder._id?.substring(displayOrder._id.length - 6)}`}
              size="small"
              variant="outlined"
              sx={{ color: 'inherit', borderColor: 'currentColor' }}
            />
          )}
        </Box>
        <IconButton onClick={handleClose} size="small" sx={{ color: 'inherit' }}>
          <Close />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 3 }}>
        {/* No Order Data Fallback */}
        {!isOrderLoading && !currentNotificationOrder && !fullOrderDetails && !verifiedOrder && (
          <Card sx={{ mb: 3, bgcolor: 'warning.light' }}>
            <CardContent sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 4 }}>
              <Typography variant="h6" gutterBottom>
                ⚠️ No Order Data Available
              </Typography>
              <Typography variant="body2" color="text.secondary" textAlign="center" gutterBottom>
                The pickup modal was opened but no order information is available. This might be due to a notification issue.
              </Typography>
              <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ mb: 2 }}>
                Order ID: {orderId || 'Not provided'}
              </Typography>
              <Button 
                variant="outlined" 
                onClick={() => {
                  if (orderId) {
                    console.log("🔄 Retrying order fetch...");
                    dispatch(fetchOrderDetails(orderId));
                  } else {
                    handleClose();
                  }
                }}
                sx={{ mt: 2, mr: 1 }}
              >
                {orderId ? 'Retry Loading' : 'Close'}
              </Button>
              <Button 
                variant="outlined" 
                color="secondary"
                onClick={handleClose}
                sx={{ mt: 2 }}
              >
                Close
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Loading State for Order Details */}
        {isOrderLoading && (
          <Card sx={{ mb: 3, bgcolor: 'info.light' }}>
            <CardContent sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 4 }}>
              <CircularProgress size={24} sx={{ mr: 2 }} />
              <Typography variant="body1">Loading order details...</Typography>
            </CardContent>
          </Card>
        )}

        {/* Pickup Completion Success Screen */}
        {pickupState.completedOrder && (
          <Card sx={{ mb: 3, bgcolor: 'success.light', border: '2px solid', borderColor: 'success.main' }}>
            <CardContent sx={{ textAlign: 'center', py: 4 }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <CheckCircle sx={{ fontSize: 80, color: 'success.main' }} />
                <Typography variant="h4" color="success.main" fontWeight="bold">
                  🎉 Pickup Completed!
                </Typography>
                <Typography variant="h6" color="text.primary">
                  Customer has successfully received their order
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 400 }}>
                  The order has been marked as delivered. The customer has been notified about the successful pickup.
                </Typography>
                <Chip 
                  icon={<CheckCircle />}
                  label="Order Delivered Successfully" 
                  color="success" 
                  size="large"
                  sx={{ mt: 1, fontSize: '1rem', py: 2 }}
                />
                <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                  Redirecting to home page in a few seconds...
                </Typography>
              </Box>
            </CardContent>
          </Card>
        )}

        {/* Pickup Code Completion Section */}
        <Card sx={{ mb: 3, bgcolor: pickupState.completedOrder ? 'success.light' : 'warning.light' }}>
          <CardContent>
            <Box display="flex" alignItems="center" gap={1} mb={2}>
              <Security color={pickupState.completedOrder ? 'success' : 'warning'} />
              <Typography variant="h6" color={pickupState.completedOrder ? 'success.main' : 'warning.main'}>
                {pickupState.completedOrder ? 'Pickup Completed ✓' : 'Complete Pickup'}
              </Typography>
            </Box>
            
            {!pickupState.completedOrder ? (
              <Box>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Enter the customer's 4-digit pickup code to complete the delivery:
                </Typography>
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      value={pickupCodeInput}
                      onChange={handlePickupCodeChange}
                      placeholder="Enter 4-digit code"
                      variant="outlined"
                      size="medium"
                      error={!!codeError}
                      helperText={codeError}
                      inputProps={{
                        maxLength: 4,
                        style: { 
                          textAlign: 'center', 
                          fontSize: '1.5rem', 
                          letterSpacing: '0.5rem',
                          fontFamily: 'monospace'
                        }
                      }}
                      InputProps={{
                        type: showPickupCode ? 'text' : 'password',
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton
                              onClick={() => setShowPickupCode(!showPickupCode)}
                              edge="end"
                              size="small"
                            >
                              {showPickupCode ? <VisibilityOff /> : <Visibility />}
                            </IconButton>
                          </InputAdornment>
                        )
                      }}
                      disabled={completionLoading}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Button
                      variant="contained"
                      color="success"
                      onClick={handleVerifyCode}
                      disabled={pickupCodeInput.length !== 4 || completionLoading}
                      startIcon={completionLoading ? <CircularProgress size={20} /> : <CheckCircle />}
                      fullWidth
                      size="large"
                    >
                      {completionLoading ? 'Completing Pickup...' : 'Complete Pickup'}
                    </Button>
                  </Grid>
                </Grid>
              </Box>
            ) : null}
          </CardContent>
        </Card>

        {/* Order Details - Show basic info from notification, full details after completion */}
        {(currentNotificationOrder || fullOrderDetails || pickupState.completedOrder) && (
          <Fade in={!!(currentNotificationOrder || fullOrderDetails || pickupState.completedOrder)}>
            <Box>
              {/* Order Summary - Show notification data if we don't have full details yet */}
              {currentNotificationOrder && !fullOrderDetails && !pickupState.completedOrder && (
                <Card sx={{ mb: 3, bgcolor: 'info.light' }}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom display="flex" alignItems="center">
                      <ShoppingBag color="primary" sx={{ mr: 1 }} />
                      Order Preview
                    </Typography>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Loading full order details...
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={6}>
                        <Typography variant="body2" color="text.secondary">Order ID</Typography>
                        <Typography variant="body1" fontFamily="monospace">
                          #{currentNotificationOrder._id?.substring(currentNotificationOrder._id.length - 6)}
                        </Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="body2" color="text.secondary">Order Total</Typography>
                        <Typography variant="h6" color="primary">
                          ₹{currentNotificationOrder.total?.toFixed(2)}
                        </Typography>
                      </Grid>
                      <Grid item xs={12}>
                        <Typography variant="body2" color="text.secondary">Order Date</Typography>
                        <Typography variant="body1">
                          {formatDate(currentNotificationOrder.createdAt)}
                        </Typography>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              )}

              {/* Full Order Information - Show when we have fullOrderDetails */}
              {fullOrderDetails && !pickupState.completedOrder && (
                <Card sx={{ mb: 3, bgcolor: 'warning.light' }}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom display="flex" alignItems="center">
                      <ShoppingBag color="primary" sx={{ mr: 1 }} />
                      Order Details
                    </Typography>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Order information loaded. Enter pickup code to complete the delivery.
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={6}>
                        <Typography variant="body2" color="text.secondary">Order ID</Typography>
                        <Typography variant="body1" fontFamily="monospace">
                          #{fullOrderDetails._id?.substring(fullOrderDetails._id.length - 6)}
                        </Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="body2" color="text.secondary">Order Total</Typography>
                        <Typography variant="h6" color="primary">
                          ₹{fullOrderDetails.total?.toFixed(2)}
                        </Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="body2" color="text.secondary">Order Date</Typography>
                        <Typography variant="body1">
                          {formatDate(fullOrderDetails.createdAt)}
                        </Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="body2" color="text.secondary">Items Count</Typography>
                        <Typography variant="body1">
                          {fullOrderDetails.items?.length || 0} items
                        </Typography>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              )}

              {/* Full Customer Information - Show after completion */}
              {(fullOrderDetails?.customer || pickupState.completedOrder?.customer) && (
                <Card sx={{ mb: 3 }}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom display="flex" alignItems="center">
                      <Person color="primary" sx={{ mr: 1 }} />
                      Customer Information
                    </Typography>
                    <Grid container spacing={3}>
                      <Grid item xs={12} sm={6}>
                        <Box display="flex" alignItems="center" gap={2}>
                          <Avatar 
                            src={fullOrderDetails?.customer?.profilePicture || pickupState.completedOrder?.customer?.profilePicture}
                            sx={{ bgcolor: 'primary.main' }}
                          >
                            <Person />
                          </Avatar>
                          <Box>
                            <Typography variant="body2" color="text.secondary">
                              Customer Name
                            </Typography>
                            <Typography variant="h6">
                              {fullOrderDetails?.customer?.username || pickupState.completedOrder?.customer?.username || 'N/A'}
                            </Typography>
                          </Box>
                        </Box>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Box display="flex" alignItems="center" gap={1}>
                          <Phone color="primary" />
                          <Box>
                            <Typography variant="body2" color="text.secondary">
                              Contact Number
                            </Typography>
                            <Typography variant="body1">
                              {fullOrderDetails?.customer?.contactNumber || 
                               pickupState.completedOrder?.customer?.contactNumber || 
                               fullOrderDetails?.contactNumber || 
                               'Not provided'}
                            </Typography>
                          </Box>
                        </Box>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              )}

              {/* Order Items */}
              {(fullOrderDetails?.items || pickupState.completedOrder?.items) && (
                <Card sx={{ mb: 3 }}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom display="flex" alignItems="center">
                      <ShoppingBag color="primary" sx={{ mr: 1 }} />
                      Order Items ({fullOrderDetails?.items?.length || pickupState.completedOrder?.items?.length || 0})
                    </Typography>
                    <List>
                      {(fullOrderDetails?.items || pickupState.completedOrder?.items)?.map((item, index) => (
                        <ListItem key={index} divider={index < (fullOrderDetails?.items || pickupState.completedOrder?.items).length - 1}>
                          <ListItemAvatar>
                            <Avatar 
                              src={item.productId?.image || item.image} 
                              variant="rounded"
                              sx={{ width: 50, height: 50 }}
                            >
                              <Restaurant />
                            </Avatar>
                          </ListItemAvatar>
                          <ListItemText
                            primary={
                              <Typography variant="body1" fontWeight="medium">
                                {item.productId?.caption || item.name || 'Unknown Item'}
                              </Typography>
                            }
                            secondary={
                              <Box>
                                <Typography variant="body2" color="text.secondary">
                                  Quantity: {item.quantity} × ₹{item.price?.toFixed(2)}
                                </Typography>
                                <Typography variant="body1" fontWeight="medium" color="primary">
                                  Total: ₹{(item.quantity * item.price).toFixed(2)}
                                </Typography>
                              </Box>
                            }
                          />
                        </ListItem>
                      ))}
                    </List>
                    <Divider sx={{ my: 2 }} />
                    <Box display="flex" justifyContent="space-between" alignItems="center">
                      <Typography variant="h6">Order Total:</Typography>
                      <Typography variant="h5" color="primary" fontWeight="bold">
                        ₹{(fullOrderDetails?.total || pickupState.completedOrder?.total)?.toFixed(2)}
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              )}

              {/* Order Metadata */}
              {pickupState.completedOrder && (
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom display="flex" alignItems="center">
                      <AccessTime color="primary" sx={{ mr: 1 }} />
                      Order Information
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="body2" color="text.secondary">
                          Order Date
                        </Typography>
                        <Typography variant="body1">
                          {formatDate(pickupState.completedOrder.createdAt)}
                        </Typography>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="body2" color="text.secondary">
                          Delivery Method
                        </Typography>
                        <Chip 
                          icon={<LocalShipping />}
                          label="Self Pickup" 
                          color="primary" 
                          size="small"
                        />
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              )}
            </Box>
          </Fade>
        )}

        {/* Error Display */}
        {pickupState.orderError && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {pickupState.orderError}
          </Alert>
        )}
        
        {pickupState.verificationError && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {pickupState.verificationError}
          </Alert>
        )}
        
        {pickupState.completionError && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {pickupState.completionError}
          </Alert>
        )}

        {/* Temporary debug section for pickup code verification */}
        {process.env.NODE_ENV === 'development' && (
          <Card sx={{ mt: 2, bgcolor: 'warning.light' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                🔧 Debug: Pickup Code Verification
              </Typography>
              <Typography variant="body2" gutterBottom>
                If you're having issues with pickup code verification, use this debug tool:
              </Typography>
              <Button
                variant="outlined"
                onClick={async () => {
                  const debugInfo = {
                    pickupCodeInput,
                    orderId,
                    currentNotificationOrder,
                    fullOrderDetails,
                    pickupState,
                    selectedOrderId: pickupState.selectedOrderId,
                    currentOrderId: currentNotificationOrder?._id,
                    fullOrderId: fullOrderDetails?._id
                  };
                  console.log("🔧 FULL DEBUG INFO:");
                  console.log(JSON.stringify(debugInfo, null, 2));
                  
                  // Try to find order ID from any available source
                  const possibleOrderId = orderId || 
                                         currentNotificationOrder?._id || 
                                         fullOrderDetails?._id || 
                                         pickupState.selectedOrderId;
                  
                  if (possibleOrderId) {
                    try {
                      // Call the debug endpoint to get actual pickup code
                      const response = await axiosInstance.get(`/orders/pickup-debug/${possibleOrderId}`);
                      const actualPickupData = response.data;
                      
                      // Use current user info that's already available in component scope
                      const currentUserId = user?._id;
                      
                      const message = `🔧 DEBUG RESULTS:\n\n` +
                        `📋 ORDER INFO:\n` +
                        `Order ID: ${possibleOrderId}\n` +
                        `Your Input: ${pickupCodeInput}\n` +
                        `Actual Backend Code: ${actualPickupData.pickupCode}\n` +
                        `Codes Match: ${pickupCodeInput === actualPickupData.pickupCode ? '✅ YES' : '❌ NO'}\n\n` +
                        `📊 ORDER STATUS:\n` +
                        `Order Status: ${actualPickupData.status}\n` +
                        `Delivery Method: ${actualPickupData.deliveryMethod}\n` +
                        `Already Completed: ${actualPickupData.isPickupCompleted ? 'YES' : 'NO'}\n` +
                        `Code Expires: ${actualPickupData.pickupCodeExpiresAt}\n` +
                        `Code Expired: ${new Date(actualPickupData.pickupCodeExpiresAt) < new Date() ? 'YES' : 'NO'}\n\n` +
                        `🔐 AUTHORIZATION INFO:\n` +
                        `Current User ID: ${currentUserId}\n` +
                        `Post Author ID: ${actualPickupData.items?.[0]?.author || 'Not found'}\n` +
                        `Post Author Username: ${actualPickupData.items?.[0]?.authorUsername || 'Not found'}\n` +
                        `You Are Post Author: ${currentUserId === actualPickupData.items?.[0]?.author ? '✅ YES' : '❌ NO - This is why you get 403!'}\n\n` +
                        `👤 CUSTOMER INFO:\n` +
                        `Customer ID: ${actualPickupData.customer?._id || 'Not found'}\n` +
                        `Customer Username: ${actualPickupData.customer?.username || 'Not found'}\n\n` +
                        `💡 SOLUTION:\n` +
                        `${currentUserId === actualPickupData.items?.[0]?.author ? 
                          'You should be able to complete this pickup!' : 
                          'You need to login as the account that created this food post, OR create a test order with your current account.'}`;
                      
                      alert(message);
                      
                      console.log("🔧 Actual pickup data from backend:", actualPickupData);
                      console.log("🔐 Current user:", user);
                      console.log("📝 Post author comparison:", {
                        currentUserId,
                        postAuthorId: actualPickupData.items?.[0]?.author,
                        postAuthorUsername: actualPickupData.items?.[0]?.authorUsername,
                        isAuthorized: currentUserId === actualPickupData.items?.[0]?.author
                      });
                    } catch (error) {
                      console.error("Failed to fetch pickup debug info:", error);
                      alert(`Found Order ID: ${possibleOrderId}\nPickup Code Input: ${pickupCodeInput}\n\n❌ Failed to fetch actual pickup code from backend.\nError: ${error.message}`);
                    }
                  } else {
                    alert("❌ No Order ID found anywhere!\nThis indicates a problem with the notification system.");
                  }
                }}
                size="small"
                sx={{ mt: 1 }}
              >
                🔍 Check Actual Pickup Code from Backend
              </Button>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                This will show you the exact pickup code stored in the backend vs what was entered.
              </Typography>
            </CardContent>
          </Card>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
        <Button onClick={handleClose} variant="outlined">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PickupOrderDetailsModal; 