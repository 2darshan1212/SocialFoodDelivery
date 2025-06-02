import React, { useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchOrders } from '../../redux/cartSlice';
import { 
  Box, 
  Typography, 
  Card, 
  CardContent, 
  Grid, 
  Chip, 
  Button, 
  Divider, 
  CircularProgress,
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow, 
  Paper,
  Alert,
  Badge,
  Container
} from '@mui/material';
import { formatDistanceToNow } from 'date-fns';
import { cancelOrder, reorderPreviousOrder } from '../../services/orderService';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import NoOrders from './NoOrders';
import { testApiConnection } from '../../utils/apiTester';
import { 
  Home, 
  Bell, 
  PlusSquare, 
  MessageCircle,
  Menu as MenuIcon
} from 'lucide-react';
import Header from "../header/Header";
import Leftsidebar from "../left/Leftsidebar";
import MobileNavItem from "../left/MobileNavItem";
import MobileSidebar from "../left/MobileSidebar";

const OrderHistory = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  
  const { orders = [], orderStatus } = useSelector(state => state.cart);
  const [loadError, setLoadError] = useState(null);
  const [isConnected, setIsConnected] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Mobile sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Subscribe to socket order updates via Redux
  const socketOrderUpdates = useSelector(state => state.socket.orderStatusUpdates || []);
  const socketConnected = useSelector(state => state.socket.connected);
  
  // Track last update timestamp to prevent redundant refreshes
  const [lastUpdateTime, setLastUpdateTime] = useState(0);
  
  // Keep a local copy of orders that can be updated instantly on status changes
  const [localOrders, setLocalOrders] = useState([]);
  
  // Toggle mobile sidebar
  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };
  
  // Update local orders when Redux orders change
  useEffect(() => {
    if (orders && orders.length > 0) {
      console.log('Updating local orders from Redux state:', orders);
      setLocalOrders(orders);
    }
  }, [orders]);
  
  const checkConnection = async () => {
    const result = await testApiConnection();
    setIsConnected(result.success);
    if (!result.success) {
      setLoadError(`Backend API is not reachable: ${result.error}`);
    }
    return result.success;
  };
  
  // Function to load orders with proper error handling
  const loadOrders = useCallback(async () => {
    try {
      setRefreshing(true);
      const connected = await checkConnection();
      if (!connected) {
        setRefreshing(false);
        return;
      }
      
      console.log('Fetching orders...');
      const result = await dispatch(fetchOrders()).unwrap();
      console.log('Orders fetched successfully:', result);
      setLastUpdateTime(Date.now());
      setLoadError(null);
    } catch (error) {
      console.error('Error fetching orders:', error);
      setLoadError(error.message || 'Failed to load orders');
      toast.error(error.message || 'Failed to load orders');
    } finally {
      setRefreshing(false);
    }
  }, [dispatch]);
  
  // Initial orders fetch
  useEffect(() => {
    loadOrders();
  }, [loadOrders]);
  
  // Listen for order status updates and update local state immediately
  useEffect(() => {
    // Only process if we have socket updates and they are newer than our last fetch
    if (socketOrderUpdates && socketOrderUpdates.length > 0) {
      // Get the latest update
      const latestUpdate = socketOrderUpdates[socketOrderUpdates.length - 1];
      const updateTime = new Date(latestUpdate.timestamp || Date.now()).getTime();
      
      // If this update is newer than our last refresh
      if (updateTime > lastUpdateTime) {
        console.log('Processing order update:', latestUpdate);
        
        // Update the local orders immediately without waiting for a full refresh
        if (latestUpdate.orderId && latestUpdate.status) {
          setLocalOrders(prevOrders => 
            prevOrders.map(order => {
              if (order._id === latestUpdate.orderId) {
                console.log(`Updating local order ${order._id} status from ${order.status} to ${latestUpdate.status}`);
                return {
                  ...order,
                  status: latestUpdate.status,
                  updatedAt: latestUpdate.timestamp || new Date().toISOString()
                };
              }
              return order;
            })
          );
          
          // Show a toast notification about the update
          const formattedStatus = latestUpdate.status.replace(/_/g, ' ').toUpperCase();
          toast.info(`Order status updated to ${formattedStatus}`);
          
          // Also trigger a full refresh from the server to get complete data
          // But do it with a slight delay to prevent over-fetching
          setTimeout(() => {
            console.log('Triggering full order refresh');
            loadOrders();
          }, 2000);
        }
      }
    }
  }, [socketOrderUpdates, lastUpdateTime, loadOrders]);

  // Monitor socket connection status
  useEffect(() => {
    if (socketConnected) {
      console.log('Socket connected - checking for order updates');
      // Refresh orders when socket reconnects to ensure we have latest data
      loadOrders();
    } else {
      console.log('Socket disconnected');
    }
  }, [socketConnected, loadOrders]);
  
  // Function to handle order cancellation
  const handleCancelOrder = async (orderId) => {
    try {
      await cancelOrder(orderId);
      toast.success('Order cancelled successfully');
      
      // Update local state immediately
      setLocalOrders(prevOrders => 
        prevOrders.map(order => {
          if (order._id === orderId) {
            return {
              ...order,
              status: 'cancelled',
              updatedAt: new Date().toISOString()
            };
          }
          return order;
        })
      );
      
      // Then refresh from server
      loadOrders();
    } catch (error) {
      toast.error(error.message || 'Error cancelling order');
    }
  };
  
  // Function to handle reordering
  const handleReorder = async (orderId) => {
    try {
      const response = await reorderPreviousOrder(orderId);
      toast.success('Order placed successfully');
      // Navigate to order detail
      navigate(`/orders/${response.order._id}`);
    } catch (error) {
      toast.error(error.message || 'Error reordering');
    }
  };
  
  // Function to get status chip color
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
  
  // Function to format date
  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      return `${date.toLocaleDateString()} (${formatDistanceToNow(date, { addSuffix: true })})`;
    } catch (error) {
      console.error('Error formatting date:', error, dateString);
      return 'Invalid date';
    }
  };
  
  // Render loading state
  if (orderStatus === 'loading' && !localOrders.length) {
    return (
      <div>
        <div className="min-h-screen flex flex-col">
          <Header />
          <div className="flex flex-1 flex-col md:flex-row gap-4 p-4 pb-24 md:pb-4">
            <aside className="hidden md:flex md:flex-col md:w-20 lg:w-64">
              <Leftsidebar />
            </aside>
            <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
                <CircularProgress />
              </Box>
            </Box>
          </div>
        </div>
      </div>
    );
  }
  
  // Render connection error state
  if (!isConnected) {
    return (
      <div>
        <div className="min-h-screen flex flex-col">
          <Header />
          <div className="flex flex-1 flex-col md:flex-row gap-4 p-4 pb-24 md:pb-4">
            <aside className="hidden md:flex md:flex-col md:w-20 lg:w-64">
              <Leftsidebar />
            </aside>
            <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
              <Alert severity="error" sx={{ mb: 3 }}>
                <Typography variant="subtitle1" gutterBottom>Backend Service Unavailable</Typography>
                <Typography variant="body2">
                  We are unable to connect to the order service. Please try again later.
                </Typography>
              </Alert>
              <Button variant="contained" onClick={checkConnection}>
                Check Connection
              </Button>
            </Box>
          </div>
        </div>
      </div>
    );
  }
  
  // Render error state
  if (loadError && !localOrders.length) {
    return (
      <div>
        <div className="min-h-screen flex flex-col">
          <Header />
          <div className="flex flex-1 flex-col md:flex-row gap-4 p-4 pb-24 md:pb-4">
            <aside className="hidden md:flex md:flex-col md:w-20 lg:w-64">
              <Leftsidebar />
            </aside>
            <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
              <Alert severity="error" sx={{ mb: 3 }}>{loadError}</Alert>
              <Button variant="contained" onClick={loadOrders}>
                Try Again
              </Button>
            </Box>
          </div>
        </div>
      </div>
    );
  }
  
  // Render no orders
  if (!localOrders || localOrders.length === 0) {
    return (
      <div>
        <div className="min-h-screen flex flex-col">
          <Header />
          <div className="flex flex-1 flex-col md:flex-row gap-4 p-4 pb-24 md:pb-4">
            <aside className="hidden md:flex md:flex-col md:w-20 lg:w-64">
              <Leftsidebar />
            </aside>
            <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
                <NoOrders />
              </Box>
            </Box>
          </div>

          {/* Mobile Sidebar Drawer */}
          <MobileSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
          
          {/* Mobile Bottom Navigation */}
          <div className="fixed bottom-0 left-0 right-0 block md:hidden bg-white border-t shadow-lg z-50">
            <div className="flex justify-around items-center h-16">
              <MobileNavItem icon={<Home size={24} />} label="Home" path="/" />
              <MobileNavItem icon={<Bell size={24} />} label="Notifications" path="/notifications" />
              <MobileNavItem icon={<PlusSquare size={24} />} label="Post" path="/create-post" isPostButton={true} />
              <MobileNavItem icon={<MessageCircle size={24} />} label="Messages" path="/chat/chatpage" />
              <button 
                onClick={toggleSidebar} 
                className="flex flex-col items-center justify-center p-2 text-gray-600 hover:text-primary-600 focus:outline-none"
              >
                <MenuIcon size={24} />
                <span className="text-xs mt-1">Menu</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  console.log('Rendering orders:', localOrders);
  
  return (
    <div>
      <div className="min-h-screen flex flex-col">
        <Header />
        {/* Main Layout */}
        <div className="flex flex-1 flex-col md:flex-row gap-4 p-4 pb-24 md:pb-4">
          {/* Left Sidebar sticky on md+ */}
          <aside className="hidden md:flex md:flex-col md:w-20 lg:w-64">
            <Leftsidebar />
          </aside>

          {/* Center Content */}
          <Container maxWidth="xl" sx={{ px: { xs: 2, sm: 3 }, py: { xs: 2, sm: 3 } }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
              <div>
                <Typography variant="h4" gutterBottom>Order History</Typography>
                <Typography variant="body1" color="text.secondary">
                  View and manage your orders
                </Typography>
              </div>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                {socketConnected ? (
                  <Badge color="success" variant="dot" sx={{ mr: 2 }}>
                    <Typography variant="caption">Live updates active</Typography>
                  </Badge>
                ) : (
                  <Badge color="error" variant="dot" sx={{ mr: 2 }}>
                    <Typography variant="caption">Live updates disconnected</Typography>
                  </Badge>
                )}
                <Button 
                  onClick={loadOrders} 
                  variant="outlined" 
                  disabled={refreshing}
                >
                  {refreshing ? <CircularProgress size={24} /> : 'Refresh'}
                </Button>
              </Box>
            </Box>
            
            {loadError && (
              <Alert severity="warning" sx={{ mb: 3 }}>
                {loadError} <Button size="small" onClick={loadOrders}>Retry</Button>
              </Alert>
            )}
            
            <Grid container spacing={3}>
              {localOrders.map((order) => (
                <Grid item xs={12} key={order._id}>
                  <Card 
                    sx={{ 
                      mb: 2, 
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                      transition: 'transform 0.2s',
                      '&:hover': {
                        transform: 'translateY(-4px)',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                      }
                    }}
                  >
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                        <Box>
                          <Typography variant="h6">Order #{order._id.substring(order._id.length - 6)}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            {formatDate(order.createdAt)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Last updated: {formatDate(order.updatedAt || order.createdAt)}
                          </Typography>
                        </Box>
                        <Box>
                          <Chip 
                            label={order.status.replace(/_/g, ' ').toUpperCase()} 
                            color={getStatusColor(order.status)} 
                            variant="filled" 
                            sx={{ fontWeight: 'bold' }}
                          />
                        </Box>
                      </Box>
                      
                      <Divider sx={{ my: 2 }} />
                      
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="subtitle2" gutterBottom>Order Items:</Typography>
                        <TableContainer component={Paper} variant="outlined">
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell>Item</TableCell>
                                <TableCell align="right">Quantity</TableCell>
                                <TableCell align="right">Price</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {order.items?.map((item, index) => (
                                <TableRow key={index}>
                                  <TableCell>
                                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                      {item.image && (
                                        <Box 
                                          component="img" 
                                          src={item.image} 
                                          alt={item.name}
                                          sx={{ 
                                            width: 40, 
                                            height: 40, 
                                            borderRadius: 1, 
                                            mr: 1,
                                            objectFit: 'cover'
                                          }}
                                        />
                                      )}
                                      <Typography variant="body2">{item.name}</Typography>
                                    </Box>
                                  </TableCell>
                                  <TableCell align="right">{item.quantity}</TableCell>
                                  <TableCell align="right">₹{item.price}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      </Box>
                      
                      <Grid container spacing={2} sx={{ mb: 2 }}>
                        <Grid item xs={12} sm={6}>
                          <Typography variant="subtitle2" gutterBottom>Delivery Address:</Typography>
                          <Typography variant="body2">{order.deliveryAddress || 'No address provided'}</Typography>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <Typography variant="subtitle2" gutterBottom>Contact Number:</Typography>
                          <Typography variant="body2">{order.contactNumber || 'No contact provided'}</Typography>
                        </Grid>
                      </Grid>
                      
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Box>
                          <Typography variant="h6" color="primary">
                            Total: ₹{order.total}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Payment: {order.paymentMethod}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <Button 
                            size="small" 
                            variant="outlined"
                            onClick={() => navigate(`/orders/${order._id}`)}
                          >
                            View Details
                          </Button>
                          {order.status === 'processing' && (
                            <Button 
                              size="small" 
                              variant="outlined" 
                              color="error"
                              onClick={() => handleCancelOrder(order._id)}
                            >
                              Cancel
                            </Button>
                          )}
                          {['delivered', 'cancelled'].includes(order.status) && (
                            <Button 
                              size="small" 
                              variant="contained"
                              onClick={() => handleReorder(order._id)}
                            >
                              Reorder
                            </Button>
                          )}
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Container>
        </div>

        {/* Mobile Sidebar Drawer */}
        <MobileSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        
        {/* Mobile Bottom Navigation */}
        <div className="fixed bottom-0 left-0 right-0 block md:hidden bg-white border-t shadow-lg z-50">
          <div className="flex justify-around items-center h-16">
            <MobileNavItem icon={<Home size={24} />} label="Home" path="/" />
            <MobileNavItem icon={<Bell size={24} />} label="Notifications" path="/notifications" />
            <MobileNavItem icon={<PlusSquare size={24} />} label="Post" path="/create-post" isPostButton={true} />
            <MobileNavItem icon={<MessageCircle size={24} />} label="Messages" path="/chat/chatpage" />
            <button 
              onClick={toggleSidebar} 
              className="flex flex-col items-center justify-center p-2 text-gray-600 hover:text-primary-600 focus:outline-none"
            >
              <MenuIcon size={24} />
              <span className="text-xs mt-1">Menu</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderHistory; 