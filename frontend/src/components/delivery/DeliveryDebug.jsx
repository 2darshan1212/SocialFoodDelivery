import React from 'react';
import { useSelector } from 'react-redux';

const DeliveryDebug = () => {
  const nearbyOrders = useSelector(state => state.delivery?.nearbyOrders) || [];
  const activeDeliveries = useSelector(state => state.delivery?.activeDeliveries) || [];
  
  return (
    <div className="p-4 bg-gray-100 rounded">
      <h3 className="font-bold mb-2">Delivery Redux State Debug</h3>
      
      <div className="mb-4">
        <h4 className="font-semibold">Nearby Orders ({nearbyOrders.length}):</h4>
        {nearbyOrders.map(order => (
          <div key={order._id} className="text-xs bg-white p-2 rounded mb-1">
            <div>ID: {order._id}</div>
            <div>Pickup: {JSON.stringify(order.pickupLocation?.coordinates)}</div>
            <div>Delivery: {JSON.stringify(order.deliveryLocation?.coordinates)}</div>
          </div>
        ))}
      </div>
      
      <div>
        <h4 className="font-semibold">Active Deliveries ({activeDeliveries.length}):</h4>
        {activeDeliveries.map(order => (
          <div key={order._id} className="text-xs bg-white p-2 rounded mb-1">
            <div>ID: {order._id}</div>
            <div>Pickup: {JSON.stringify(order.pickupLocation?.coordinates)}</div>
            <div>Delivery: {JSON.stringify(order.deliveryLocation?.coordinates)}</div>
            <div>Status: {order.deliveryStatus || order.status}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DeliveryDebug; 