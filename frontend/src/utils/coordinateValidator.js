// Utility functions for coordinate validation and debugging

export const hasValidCoordinates = (coords) => {
  return coords && 
         Array.isArray(coords) && 
         coords.length === 2 && 
         (coords[0] !== 0 || coords[1] !== 0) &&
         !isNaN(coords[0]) && 
         !isNaN(coords[1]);
};

export const validateOrderCoordinates = (order, source = '') => {
  const issues = [];
  
  if (!order) {
    issues.push('Order is null or undefined');
    return { valid: false, issues };
  }
  
  // Check pickup location
  if (!order.pickupLocation) {
    issues.push('No pickupLocation field');
  } else if (!order.pickupLocation.coordinates) {
    issues.push('No pickupLocation.coordinates');
  } else if (!hasValidCoordinates(order.pickupLocation.coordinates)) {
    issues.push(`Invalid pickup coordinates: ${JSON.stringify(order.pickupLocation.coordinates)}`);
  }
  
  // Check delivery location
  if (!order.deliveryLocation) {
    issues.push('No deliveryLocation field');
  } else if (!order.deliveryLocation.coordinates) {
    issues.push('No deliveryLocation.coordinates');
  } else if (!hasValidCoordinates(order.deliveryLocation.coordinates)) {
    issues.push(`Invalid delivery coordinates: ${JSON.stringify(order.deliveryLocation.coordinates)}`);
  }
  
  const valid = issues.length === 0;
  
  // Log validation results
  if (!valid) {
    console.warn(`🚨 Order ${order._id} coordinate validation failed (${source}):`, {
      orderId: order._id,
      issues,
      pickupLocation: order.pickupLocation,
      deliveryLocation: order.deliveryLocation,
      restaurant: order.restaurant?.location,
      user: order.user?.location
    });
  } else {
    console.log(`✅ Order ${order._id} coordinates valid (${source})`, {
      pickup: order.pickupLocation?.coordinates,
      delivery: order.deliveryLocation?.coordinates
    });
  }
  
  return { valid, issues };
};

export const logOrderCoordinatesFlow = (orderId, stage, coordinates) => {
  console.log(`📍 [${stage}] Order ${orderId} coordinates:`, {
    pickup: coordinates.pickup,
    delivery: coordinates.delivery,
    timestamp: new Date().toISOString()
  });
}; 