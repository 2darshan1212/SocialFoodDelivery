import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { FaMapMarkerAlt, FaUser, FaPhoneAlt, FaMotorcycle, FaCheckCircle, FaTruck, FaBox } from 'react-icons/fa';
import { updateActiveDeliveryStatus, completeDeliveryOrder } from '../../redux/deliverySlice';
import { formatDistanceToNow } from 'date-fns';
import DeliveryMap from './DeliveryMap';

const ActiveDeliveries = () => {
  const dispatch = useDispatch();
  const { activeDeliveries, isLoading, error, currentLocation } = useSelector(state => ({
    activeDeliveries: state.delivery.activeDeliveries,
    isLoading: state.delivery.isCompletingDelivery,
    error: state.delivery.completeDeliveryError,
    currentLocation: state.delivery.currentLocation
  }));

  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showMap, setShowMap] = useState(false);

  if (!activeDeliveries || activeDeliveries.length === 0) {
    return (
      <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded">
        <p className="text-blue-700">No active deliveries. Accept orders from the confirmed orders list to start delivering.</p>
      </div>
    );
  }

  const handleStatusUpdate = (orderId, status) => {
    dispatch(updateActiveDeliveryStatus({
      orderId,
      status,
      additionalInfo: {
        statusUpdatedAt: new Date().toISOString(),
        deliveryStatus: status
      }
    }));
  };

  const handleCompleteDelivery = (orderId) => {
    dispatch(completeDeliveryOrder(orderId));
  };

  const handleShowMap = (order) => {
    setSelectedOrder(order);
    setShowMap(true);
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'accepted':
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">Accepted</span>;
      case 'picked_up':
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-indigo-100 text-indigo-800">Picked Up</span>;
      case 'on_way':
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">On the Way</span>;
      case 'delivered':
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">Delivered</span>;
      default:
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">Processing</span>;
    }
  };

  // Calculate estimated arrival times
  const getEstimatedTime = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="active-deliveries-container">
      <h3 className="text-xl font-semibold text-gray-800 mb-4">Active Deliveries ({activeDeliveries.length})</h3>
      
      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded mb-4">
          <p className="text-red-700">{error}</p>
        </div>
      )}
      
      {showMap && selectedOrder && (
        <div className="mb-6">
          <div className="border rounded-lg shadow-sm overflow-hidden">
            <div className="flex justify-between items-center px-4 py-3 bg-gray-50 border-b">
              <h5 className="font-medium text-gray-700">Delivery Map</h5>
              <button 
                className="px-3 py-1 border border-gray-300 text-gray-600 text-sm rounded hover:bg-gray-100"
                onClick={() => setShowMap(false)}
              >
                Close Map
              </button>
            </div>
            <div className="h-96">
              <DeliveryMap 
                deliveryOrder={selectedOrder}
                agentLocation={currentLocation}
              />
            </div>
          </div>
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {activeDeliveries.map(order => (
          <div key={order._id} className="border rounded-lg shadow-sm overflow-hidden h-full">
            <div className="flex justify-between items-center px-4 py-3 bg-gray-50 border-b">
              <h5 className="font-medium text-gray-800 truncate">{order.restaurant?.name}</h5>
              {getStatusBadge(order.deliveryStatus || 'accepted')}
            </div>
            <div className="p-4">
              <ul className="space-y-3 mb-4">
                <li className="flex justify-between py-2 border-b border-gray-100">
                  <div className="flex items-center text-gray-600">
                    <FaUser className="mr-2" /> Customer:
                  </div>
                  <span className="font-medium">{order.user?.name || 'Customer'}</span>
                </li>
                <li className="flex justify-between py-2 border-b border-gray-100">
                  <div className="flex items-center text-gray-600">
                    <FaMapMarkerAlt className="mr-2" /> Delivery to:
                  </div>
                  <span className="font-medium truncate max-w-[180px]">{order.deliveryAddress || 'Not specified'}</span>
                </li>
                <li className="flex justify-between py-2 border-b border-gray-100">
                  <div className="flex items-center text-gray-600">
                    <FaBox className="mr-2" /> Items:
                  </div>
                  <span className="font-medium">{order.items?.length || 0}</span>
                </li>
                <li className="flex justify-between py-2 border-b border-gray-100">
                  <div className="text-gray-600">Order Amount:</div>
                  <span className="font-medium">${order.totalAmount?.toFixed(2) || '0.00'}</span>
                </li>
                <li className="flex justify-between py-2 border-b border-gray-100">
                  <div className="text-gray-600">Est. Pickup:</div>
                  <span className="font-medium">{getEstimatedTime(order.estimatedPickupTime)}</span>
                </li>
                <li className="flex justify-between py-2 border-b border-gray-100">
                  <div className="text-gray-600">Est. Delivery:</div>
                  <span className="font-medium">{getEstimatedTime(order.estimatedDeliveryTime)}</span>
                </li>
                <li className="flex justify-between py-2 border-b border-gray-100">
                  <div className="text-gray-600">Accepted:</div>
                  <span className="font-medium">{order.acceptedAt ? formatDistanceToNow(new Date(order.acceptedAt), { addSuffix: true }) : 'Just now'}</span>
                </li>
              </ul>
              
              <div className="space-y-2">
                <button 
                  className="w-full flex justify-center items-center bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded transition-colors"
                  onClick={() => handleShowMap(order)}
                >
                  <FaMapMarkerAlt className="mr-2" /> Show Map
                </button>
                
                {/* Status update buttons based on current status */}
                {(!order.deliveryStatus || order.deliveryStatus === 'accepted') && (
                  <button 
                    className="w-full flex justify-center items-center bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded transition-colors"
                    onClick={() => handleStatusUpdate(order._id, 'picked_up')}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <span className="animate-spin h-4 w-4 mr-2 border-2 border-white border-t-transparent rounded-full"></span>
                    ) : (
                      <FaBox className="mr-2" />
                    )}
                    Mark as Picked Up
                  </button>
                )}
                
                {order.deliveryStatus === 'picked_up' && (
                  <button 
                    className="w-full flex justify-center items-center bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded transition-colors"
                    onClick={() => handleStatusUpdate(order._id, 'on_way')}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <span className="animate-spin h-4 w-4 mr-2 border-2 border-white border-t-transparent rounded-full"></span>
                    ) : (
                      <FaTruck className="mr-2" />
                    )}
                    On the Way
                  </button>
                )}
                
                {(order.deliveryStatus === 'on_way' || order.deliveryStatus === 'picked_up') && (
                  <button 
                    className="w-full flex justify-center items-center bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded transition-colors"
                    onClick={() => handleCompleteDelivery(order._id)}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <span className="animate-spin h-4 w-4 mr-2 border-2 border-white border-t-transparent rounded-full"></span>
                    ) : (
                      <FaCheckCircle className="mr-2" />
                    )}
                    Complete Delivery
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ActiveDeliveries;
