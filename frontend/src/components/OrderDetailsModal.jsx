import React, { useState, useEffect } from 'react';
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
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import {
  Close,
  ShoppingBag,
  Person,
  LocationOn,
  Phone,
  Payment,
  AccessTime,
  LocalShipping,
  Restaurant,
  ExpandMore,
  Info,
  CheckCircle,
  Schedule
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import axios from 'axios';

const OrderDetailsModal = ({ open, onClose, orderId, orderData = null }) => {
  const [order, setOrder] = useState(orderData);
  const [loading, setLoading] = useState(!orderData);
  const [error, setError] = useState(null);

  // Fetch order details if not provided
  useEffect(() => {
    if (open && orderId && !orderData) {
      fetchOrderDetails();
    } else if (orderData) {
      setOrder(orderData);
      setLoading(false);
    }
  }, [open, orderId, orderData]);

  const fetchOrderDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const token = localStorage.getItem('token');
      const response = await axios.get(`/api/v1/orders/${orderId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        setOrder(response.data.order);
      } else {
        setError('Failed to load order details');
      }
    } catch (err) {
      console.error('Error fetching order details:', err);
      setError('Error loading order details');
      toast.error('Failed to load order details');
    } finally {
      setLoading(false);
    }
  };

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

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getDeliveryMethodIcon = (method) => {
    switch (method) {
      case 'pickup':
        return <Restaurant />;
      case 'express':
        return <LocalShipping />;
      default:
        return <LocalShipping />;
    }
  };

  const getDeliveryMethodLabel = (method) => {
    switch (method) {
      case 'pickup':
        return 'Self Pickup';
      case 'express':
        return 'Express Delivery';
      case 'standard':
        return 'Standard Delivery';
      default:
        return 'Delivery';
    }
  };

  const handleClose = () => {
    setOrder(null);
    setError(null);
    setLoading(false);
    onClose();
  };

  if (!open) return null;

  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { borderRadius: 2 }
      }}
    >
      <DialogTitle sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        borderBottom: '1px solid',
        borderColor: 'divider',
        pb: 2
      }}>
        <Box display="flex" alignItems="center" gap={1}>
          <ShoppingBag color="primary" />
          <Typography variant="h6">
            Order Details
          </Typography>
          {order && (
            <Chip 
              label={`#${order._id?.substring(order._id.length - 6)}`}
              size="small"
              variant="outlined"
            />
          )}
        </Box>
        <IconButton onClick={handleClose} size="small">
          <Close />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 3 }}>
        {loading ? (
          <Box display="flex" justifyContent="center" alignItems="center" py={4}>
            <CircularProgress />
            <Typography variant="body2" sx={{ ml: 2 }}>
              Loading order details...
            </Typography>
          </Box>
        ) : error ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
            <Button 
              size="small" 
              onClick={fetchOrderDetails}
              sx={{ ml: 2 }}
            >
              Retry
            </Button>
          </Alert>
        ) : order ? (
          <Box>
            {/* Order Status and Basic Info */}
            <Card sx={{ mb: 3, bgcolor: 'primary.light', color: 'primary.contrastText' }}>
              <CardContent>
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs={12} sm={6}>
                    <Box display="flex" alignItems="center" gap={1} mb={1}>
                      <CheckCircle />
                      <Typography variant="h6">
                        Order Status
                      </Typography>
                    </Box>
                    <Chip 
                      label={order.status?.replace(/_/g, ' ').toUpperCase()}
                      color={getStatusColor(order.status)}
                      size="large"
                      sx={{ fontWeight: 'bold' }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Box display="flex" alignItems="center" gap={1} mb={1}>
                      <AccessTime />
                      <Typography variant="h6">
                        Order Date
                      </Typography>
                    </Box>
                    <Typography variant="body1">
                      {formatDate(order.createdAt)}
                    </Typography>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            {/* Customer Information */}
            <Accordion defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Box display="flex" alignItems="center" gap={1}>
                  <Person color="primary" />
                  <Typography variant="h6">Customer Information</Typography>
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <Grid container spacing={3}>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Contact Number
                    </Typography>
                    <Box display="flex" alignItems="center" gap={1}>
                      <Phone fontSize="small" />
                      <Typography variant="body1">
                        {order.contactNumber}
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Delivery Method
                    </Typography>
                    <Box display="flex" alignItems="center" gap={1}>
                      {getDeliveryMethodIcon(order.deliveryMethod)}
                      <Typography variant="body1">
                        {getDeliveryMethodLabel(order.deliveryMethod)}
                      </Typography>
                    </Box>
                  </Grid>
                  {order.deliveryMethod !== 'pickup' && (
                    <Grid item xs={12}>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Delivery Address
                      </Typography>
                      <Box display="flex" alignItems="flex-start" gap={1}>
                        <LocationOn fontSize="small" sx={{ mt: 0.5 }} />
                        <Typography variant="body1">
                          {order.deliveryAddress}
                        </Typography>
                      </Box>
                    </Grid>
                  )}
                  {order.deliveryInstructions && (
                    <Grid item xs={12}>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Special Instructions
                      </Typography>
                      <Box display="flex" alignItems="flex-start" gap={1}>
                        <Info fontSize="small" sx={{ mt: 0.5 }} />
                        <Typography variant="body1">
                          {order.deliveryInstructions}
                        </Typography>
                      </Box>
                    </Grid>
                  )}
                </Grid>
              </AccordionDetails>
            </Accordion>

            {/* Order Items */}
            <Accordion defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Box display="flex" alignItems="center" gap={1}>
                  <ShoppingBag color="primary" />
                  <Typography variant="h6">
                    Order Items ({order.items?.length || 0})
                  </Typography>
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <Box>
                  {order.items && order.items.map((item, index) => (
                    <Box key={index}>
                      <Box display="flex" justifyContent="space-between" alignItems="center" py={2}>
                        <Box display="flex" alignItems="center" gap={2}>
                          {item.image && (
                            <Avatar 
                              src={item.image} 
                              variant="rounded" 
                              sx={{ width: 50, height: 50 }}
                            />
                          )}
                          <Box>
                            <Typography variant="body1" fontWeight="medium">
                              {item.name}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Quantity: {item.quantity}
                            </Typography>
                          </Box>
                        </Box>
                        <Box textAlign="right">
                          <Typography variant="body1" fontWeight="medium">
                            ₹{(item.price * item.quantity).toFixed(2)}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            ₹{item.price} each
                          </Typography>
                        </Box>
                      </Box>
                      {index < order.items.length - 1 && <Divider />}
                    </Box>
                  ))}
                </Box>
              </AccordionDetails>
            </Accordion>

            {/* Payment Summary */}
            <Accordion defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Box display="flex" alignItems="center" gap={1}>
                  <Payment color="primary" />
                  <Typography variant="h6">Payment Summary</Typography>
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <Box>
                  <Box display="flex" justifyContent="space-between" py={1}>
                    <Typography variant="body2">Subtotal</Typography>
                    <Typography variant="body2">₹{order.subtotal?.toFixed(2)}</Typography>
                  </Box>
                  <Box display="flex" justifyContent="space-between" py={1}>
                    <Typography variant="body2">Tax</Typography>
                    <Typography variant="body2">₹{order.tax?.toFixed(2)}</Typography>
                  </Box>
                  <Box display="flex" justifyContent="space-between" py={1}>
                    <Typography variant="body2">Delivery Fee</Typography>
                    <Typography variant="body2">₹{order.deliveryFee?.toFixed(2)}</Typography>
                  </Box>
                  {order.discount > 0 && (
                    <Box display="flex" justifyContent="space-between" py={1}>
                      <Typography variant="body2" color="success.main">
                        Discount {order.promoCodeApplied && `(${order.promoCodeApplied})`}
                      </Typography>
                      <Typography variant="body2" color="success.main">
                        -₹{order.discount?.toFixed(2)}
                      </Typography>
                    </Box>
                  )}
                  <Divider sx={{ my: 1 }} />
                  <Box display="flex" justifyContent="space-between" py={1}>
                    <Typography variant="h6">Total</Typography>
                    <Typography variant="h6" color="primary">
                      ₹{order.total?.toFixed(2)}
                    </Typography>
                  </Box>
                  <Box display="flex" justifyContent="space-between" py={1}>
                    <Typography variant="body2" color="text.secondary">
                      Payment Method
                    </Typography>
                    <Typography variant="body2">
                      {order.paymentMethod === 'cash' ? 'Cash on Delivery' : 
                       order.paymentMethod === 'card' ? 'Credit/Debit Card' : 
                       order.paymentMethod === 'wallet' ? 'Digital Wallet' : 
                       order.paymentMethod}
                    </Typography>
                  </Box>
                </Box>
              </AccordionDetails>
            </Accordion>
          </Box>
        ) : (
          <Alert severity="warning">
            No order data available
          </Alert>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={handleClose} variant="contained">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default OrderDetailsModal; 