import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { fetchAllOrders, assignDeliveryAgent } from '../../redux/adminSlice';
import { fetchAgentProfile, addToActiveDeliveries, acceptDeliveryOrder } from '../../redux/deliverySlice';
import { toast } from 'react-hot-toast';
import { 
  MdRestaurant, 
  MdRefresh, 
  MdLocationOn, 
  MdDirectionsBike, 
  MdPerson,
  MdAccessTime,
  MdPayment,
  MdPhone
} from 'react-icons/md';
import { BsCheck2Circle, BsXCircle } from 'react-icons/bs';
import { calculateDistance } from '../../utils/distanceUtils';

const AdminConfirmedOrdersList = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [acceptingOrderId, setAcceptingOrderId] = useState(null);
  const [rejectingOrderId, setRejectingOrderId] = useState(null);
  const [declinedOrders, setDeclinedOrders] = useState([]);
  
  // Get admin orders data from the Redux store
  const adminOrders = useSelector(state => state.admin.orders.data || []);
  const adminOrdersStatus = useSelector(state => state.admin.orders.status);
  const adminOrdersError = useSelector(state => state.admin.orders.error);
  
  // Get agent location for distance calculation
  const { currentLocation } = useSelector(state => state.delivery);
  
  // Get user information
  const { user } = useSelector(state => state.auth);
  const [authChecked, setAuthChecked] = useState(false);
  
  // Filter for only confirmed orders and orders without assigned delivery agents
  const confirmedOrders = useMemo(() => {
    return adminOrders.filter(order => {
      // Only show orders with confirmed status
      if (order.status !== 'confirmed') return false;
      
      // Don't show orders that already have an assigned delivery agent
      if (order.deliveryAgent && order.deliveryAgent._id) return false;
      
      return true;
    });
  }, [adminOrders]);
  
  // Filter out locally declined orders
  const availableOrders = useMemo(() => {
    return confirmedOrders.filter(order => !declinedOrders.includes(order._id));
  }, [confirmedOrders, declinedOrders]);
  
  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(amount || 0);
  };
  
  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  // Format distance
  const formatDistance = (distance) => {
    if (distance === null || distance === undefined) return 'Unknown';
    if (distance < 1) {
      return `${Math.round(distance * 1000)} m`;
    }
    return `${distance.toFixed(1)} km`;
  };
  
  // Check if coordinates are valid
  const hasValidCoordinates = (coords) => {
    return coords && 
           Array.isArray(coords) && 
           coords.length === 2 && 
           (coords[0] !== 0 || coords[1] !== 0) &&
           !isNaN(coords[0]) && 
           !isNaN(coords[1]);
  };
  
  // Log order counts and coordinate details for debugging
  useEffect(() => {
    console.log(`AdminConfirmedOrdersList: Found ${adminOrders.length} total orders, ${confirmedOrders.length} available for delivery`);
    
    if (confirmedOrders.length > 0) {
      // Log coordinate details for each confirmed order
      confirmedOrders.forEach(order => {
        console.log(`Order ${order._id} coordinate validation:`, {
          id: order._id,
          status: order.status,
          hasDeliveryAgent: !!order.deliveryAgent,
          paymentMethod: order.paymentMethod,
          pickupCoordinates: order.pickupLocation?.coordinates,
          deliveryCoordinates: order.deliveryLocation?.coordinates,
          pickupValid: hasValidCoordinates(order.pickupLocation?.coordinates),
          deliveryValid: hasValidCoordinates(order.deliveryLocation?.coordinates),
          restaurantCoordinates: order.restaurant?.location?.coordinates,
          userCoordinates: order.user?.location?.coordinates
        });
      });
    }
  }, [adminOrders, confirmedOrders]);
  
  // Verify auth on component mount
  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    if (!storedToken) {
      console.warn('No authentication token found in localStorage');
    } else {
      console.log('Token found in localStorage, length:', storedToken.length);
    }
    setAuthChecked(true);
  }, []);
  
  // Fetch confirmed orders when authentication is verified
  useEffect(() => {
    if (authChecked) {
      const currentToken = localStorage.getItem('token');
      if (currentToken) {
        console.log('Authentication verified, fetching orders');
        handleRefreshOrders();
      } else {
        console.warn('Authentication checked but no token found');
      }
    }
  }, [authChecked, dispatch]);
  
  // Handle refresh button click
  const handleRefreshOrders = async () => {
    if (isLoading) return;
    
    // Verify token before making request
    const currentToken = localStorage.getItem('token');
    if (!currentToken) {
      toast.error('Authentication required. Please log in.');
      return;
    }
    
    setIsLoading(true);
    
    try {
      console.log('Fetching admin orders with token:', currentToken.substring(0, 10) + '...');
      
      // Add delay to allow console logging before request
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const result = await dispatch(fetchAllOrders({ 
        page: 1, 
        limit: 100, 
        status: 'confirmed' 
      })).unwrap();
      
      console.log('Admin orders fetch response:', {
        ordersCount: result?.orders?.length || 0,
        pagination: result?.pagination
      });
      
      toast.success('Available orders refreshed');
    } catch (error) {
      console.error('Error refreshing orders:', error);
      
      // Handle specific error types
      if (error?.message?.includes('not authenticated') || 
          error?.message?.includes('authentication') || 
          error?.response?.status === 401) {
        toast.error('Authentication failed. Please log in again.');
      } else {
        toast.error('Failed to refresh orders: ' + (error.message || 'Unknown error'));
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle accepting an order
  const handleAcceptOrder = async (orderId) => {
    if (acceptingOrderId) return;
    setAcceptingOrderId(orderId);
    
    try {
      // Get the current user's ID
      const userId = user?._id;
      
      if (!userId) {
        toast.error('User ID not found. Please log in again.');
        setAcceptingOrderId(null);
        return;
      }
      
      console.log(`Accepting order ${orderId} as delivery agent ${userId}`);
      
      // Display a loading toast
      toast.loading('Accepting order...', { id: 'acceptOrder' });
      
      // 1. Find the order in the confirmed orders list
      const acceptedOrder = confirmedOrders.find(order => order._id === orderId);
      
      if (!acceptedOrder) {
        toast.error('Order not found in the available orders list', { id: 'acceptOrder' });
        setAcceptingOrderId(null);
        return;
      }
      
      // 2. Assign the delivery agent in the admin system
      const adminResult = await dispatch(assignDeliveryAgent({
        orderId: orderId,
        agentId: userId
      })).unwrap();
      
      console.log('Admin order assignment result:', adminResult);
      
      // 3. Then use the delivery system's accept order function
      const deliveryResult = await dispatch(acceptDeliveryOrder(orderId)).unwrap();
      console.log('Delivery order acceptance result:', deliveryResult);
      
      // 4. Prepare order with properly normalized coordinates for active deliveries
      const orderForActiveDelivery = {
        ...acceptedOrder,
        deliveryAgent: { _id: userId },
        status: 'in-transit', // Update status to ensure it's processed
        deliveryStatus: 'accepted',
        acceptedAt: new Date().toISOString()
      };
      
      // Log coordinate information before adding to active deliveries
      console.log('Adding order to active deliveries with coordinates:', {
        id: orderForActiveDelivery._id,
        pickupCoordinates: orderForActiveDelivery.pickupLocation?.coordinates,
        deliveryCoordinates: orderForActiveDelivery.deliveryLocation?.coordinates,
        restaurantCoordinates: orderForActiveDelivery.restaurant?.location?.coordinates,
        userCoordinates: orderForActiveDelivery.user?.location?.coordinates,
        pickupValid: hasValidCoordinates(orderForActiveDelivery.pickupLocation?.coordinates),
        deliveryValid: hasValidCoordinates(orderForActiveDelivery.deliveryLocation?.coordinates)
      });
      
      // Add to active deliveries (the slice will normalize coordinates using our utility function)
      dispatch(addToActiveDeliveries(orderForActiveDelivery));
      
      // 5. Update the toast with success message
      toast.success(`Order accepted! You are now the delivery agent.`, { id: 'acceptOrder' });
      
      // 6. Refresh agent profile to update active orders list
      await dispatch(fetchAgentProfile());
      
      // 7. Store in localStorage to sync across tabs
      localStorage.setItem('lastAcceptedOrder', orderId);
      localStorage.setItem('orderAcceptedTimestamp', Date.now().toString());
      
      // 8. Refresh confirmed orders list
      await dispatch(fetchAllOrders({ page: 1, limit: 100, status: 'confirmed' }));
      
      // 9. Finally navigate to My Deliveries page
      navigate('/deliver/my-deliveries');
      
      // 10. Remove from local confirmed orders list
      setDeclinedOrders(prev => [...prev, orderId]);
      
      return true; // Success indicator
    } catch (error) {
      console.error('Error accepting order:', error);
      
      // Handle specific error cases
      if (error?.message?.includes('already assigned') || 
          error?.message?.includes('has a delivery agent')) {
        toast.error('This order has already been assigned to another delivery agent.');
      } else {
        toast.error('Failed to accept order: ' + (error.message || 'Unknown error'));
      }
    } finally {
      setAcceptingOrderId(null);
      setIsLoading(false);
    }
  };
  
  // Handle rejecting an order
  const handleRejectOrder = (orderId) => {
    if (rejectingOrderId) return;
    setRejectingOrderId(orderId);
    
    try {
      // Just add to declined orders list (local state only)
      setDeclinedOrders(prev => [...prev, orderId]);
      toast.success(`Order ${orderId.substring(0, 6)} removed from your list`);
    } catch (error) {
      console.error('Error rejecting order:', error);
      toast.error('Failed to reject order');
    } finally {
      setRejectingOrderId(null);
    }
  };

  return (
    <div className="admin-confirmed-orders-list">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium">Available Orders for Delivery</h3>
        <button
          onClick={handleRefreshOrders}
          className="flex items-center text-sm bg-purple-100 hover:bg-purple-200 text-purple-700 px-3 py-1 rounded transition-colors"
          disabled={isLoading}
        >
          <MdRefresh className={`mr-1 ${isLoading ? 'animate-spin' : ''}`} />
          {isLoading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>
      
      {adminOrdersError && (
        <div className="bg-red-50 text-red-700 p-3 rounded-md mb-4">
          <p>Error loading orders: {adminOrdersError}</p>
          <div className="mt-2">
            {adminOrdersError.includes('authenticated') || adminOrdersError.includes('login') ? (
              <div>
                <p className="text-sm mb-1">Please make sure you are logged in with admin or delivery agent privileges.</p>
                <button 
                  onClick={() => {
                    // Force logout and redirect to login
                    localStorage.removeItem('token');
                    window.location.href = '/login';
                  }}
                  className="text-sm bg-red-600 text-white px-3 py-1 rounded mr-2"
                >
                  Go to Login
                </button>
              </div>
            ) : (
              <button 
                onClick={handleRefreshOrders}
                className="text-sm underline"
              >
                Try again
              </button>
            )}
          </div>
        </div>
      )}
      
      {availableOrders.length === 0 && adminOrdersStatus === 'succeeded' ? (
        <div className="text-center py-8 bg-gray-50 rounded-lg">
          <MdRestaurant className="mx-auto text-4xl text-gray-400 mb-2" />
          <p className="text-gray-600">No available orders at the moment</p>
          <button 
            onClick={handleRefreshOrders}
            className="text-sm text-purple-600 hover:text-purple-800 mt-2 underline"
          >
            Refresh to check again
          </button>
        </div>
      ) : (
        <div className="space-y-4 mt-4">
          {availableOrders.map((order) => (
            <div 
              key={order._id} 
              className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h4 className="font-medium text-gray-900">
                    {order.restaurant?.name || 'Restaurant'}
                  </h4>
                  <p className="text-sm text-gray-600">
                    Order #{order._id.substring(order._id.length - 6)}
                  </p>
                </div>
                <div className="text-right">
                  <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full font-medium">
                    {order.status}
                  </span>
                  {order.distance !== null && (
                    <p className="text-sm text-gray-600 mt-1 flex items-center justify-end">
                      <MdLocationOn className="text-gray-500 mr-1" />
                      {formatDistance(order.distance)}
                    </p>
                  )}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="flex items-center">
                  <MdPerson className="text-gray-500 mr-2" />
                  <span className="text-sm">
                    {order.user?.name || 'Customer'}
                  </span>
                </div>
                <div className="flex items-center">
                  <MdAccessTime className="text-gray-500 mr-2" />
                  <span className="text-sm">
                    {formatDate(order.createdAt)}
                  </span>
                </div>
                <div className="flex items-center">
                  <MdPayment className="text-gray-500 mr-2" />
                  <span className="text-sm">
                    {formatCurrency(order.totalAmount || order.total)}
                  </span>
                </div>
                <div className="flex items-center">
                  <MdDirectionsBike className="text-gray-500 mr-2" />
                  <span className="text-sm">
                    {order.items?.length || 0} items
                  </span>
                </div>
              </div>
              
              {order.items && order.items.length > 0 && (
                <div className="mb-3">
                  <p className="text-sm text-gray-700 mb-1 font-medium">Order Items:</p>
                  <ul className="text-sm text-gray-600 pl-2">
                    {order.items.slice(0, 3).map((item, index) => (
                      <li key={index} className="truncate">
                        • {item.quantity || 1}x {item.name || item.productName || 'Item'}
                      </li>
                    ))}
                    {order.items.length > 3 && (
                      <li className="text-gray-500">
                        • ...and {order.items.length - 3} more items
                      </li>
                    )}
                  </ul>
                </div>
              )}
              
              <div className="flex justify-between mt-3 pt-3 border-t border-gray-100">
                <button
                  onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${order.pickupLocation?.coordinates?.[1]},${order.pickupLocation?.coordinates?.[0]}`, '_blank')}
                  className="flex items-center text-blue-600 hover:text-blue-800 text-sm"
                  disabled={!order.pickupLocation?.coordinates}
                >
                  <MdLocationOn className="mr-1" />
                  Directions
                </button>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleRejectOrder(order._id)}
                    className="flex items-center bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1 rounded transition-colors text-sm"
                    disabled={rejectingOrderId === order._id}
                  >
                    <BsXCircle className="mr-1" />
                    {rejectingOrderId === order._id ? 'Rejecting...' : 'Reject'}
                  </button>
                  <button
                    onClick={() => handleAcceptOrder(order._id)}
                    className="flex items-center bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded transition-colors text-sm"
                    disabled={acceptingOrderId === order._id}
                  >
                    <BsCheck2Circle className="mr-1" />
                    {acceptingOrderId === order._id ? 'Accepting...' : 'Accept'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminConfirmedOrdersList;
