// Redux middleware to preserve coordinates when orders are accepted
const coordinatePreservationMiddleware = (store) => (next) => (action) => {
  // Safety check: ensure action exists and has a type
  if (!action || typeof action !== 'object' || typeof action.type !== 'string') {
    if (action === undefined || action === null) {
      console.warn('⚠️ Coordinate Preservation Middleware: Undefined or null action received, ignoring');
      // Don't pass undefined/null actions to next middleware - just return
      return;
    }
    if (typeof action !== 'object') {
      console.warn('⚠️ Coordinate Preservation Middleware: Non-object action received:', typeof action, action);
      // For non-object actions, still pass them through in case they're valid
      return next(action);
    }
    if (typeof action.type !== 'string') {
      console.warn('⚠️ Coordinate Preservation Middleware: Action missing type property:', action);
      // Still pass through actions without proper type, let Redux handle the error
      return next(action);
    }
  }

  // Monitor acceptDeliveryOrder.fulfilled actions
  if (action.type === 'delivery/acceptOrder/fulfilled') {
    console.log('🔍 Coordinate Preservation Middleware - Intercepting acceptOrder.fulfilled');
    
    const state = store.getState();
    const incomingOrder = action.payload?.order;
    
    if (incomingOrder) {
      // Find the order in nearbyOrders or confirmedOrders
      const nearbyOrder = state.delivery.nearbyOrders.find(o => o._id === incomingOrder._id);
      const confirmedOrder = state.delivery.confirmedOrders.find(o => o._id === incomingOrder._id);
      const originalOrder = nearbyOrder || confirmedOrder;
      
      if (originalOrder) {
        console.log('📍 Original order coordinates:', {
          id: originalOrder._id,
          pickup: originalOrder.pickupLocation?.coordinates,
          delivery: originalOrder.deliveryLocation?.coordinates
        });
        
        console.log('📍 Incoming order coordinates:', {
          id: incomingOrder._id,
          pickup: incomingOrder.pickupLocation?.coordinates,
          delivery: incomingOrder.deliveryLocation?.coordinates
        });
        
        // Check if incoming order has invalid coordinates
        const incomingPickupInvalid = !incomingOrder.pickupLocation?.coordinates || 
          (incomingOrder.pickupLocation.coordinates[0] === 0 && incomingOrder.pickupLocation.coordinates[1] === 0);
        const incomingDeliveryInvalid = !incomingOrder.deliveryLocation?.coordinates || 
          (incomingOrder.deliveryLocation.coordinates[0] === 0 && incomingOrder.deliveryLocation.coordinates[1] === 0);
        
        // Check if original order has valid coordinates
        const originalPickupValid = originalOrder.pickupLocation?.coordinates && 
          (originalOrder.pickupLocation.coordinates[0] !== 0 || originalOrder.pickupLocation.coordinates[1] !== 0);
        const originalDeliveryValid = originalOrder.deliveryLocation?.coordinates && 
          (originalOrder.deliveryLocation.coordinates[0] !== 0 || originalOrder.deliveryLocation.coordinates[1] !== 0);
        
        // If incoming has invalid coordinates but original has valid ones, preserve them
        if ((incomingPickupInvalid && originalPickupValid) || 
            (incomingDeliveryInvalid && originalDeliveryValid)) {
          
          console.warn('⚠️ Middleware: Detected coordinate loss, preserving original coordinates');
          
          // Create a modified action with preserved coordinates
          const modifiedOrder = {
            ...incomingOrder,
            // Preserve pickup location if needed
            pickupLocation: incomingPickupInvalid && originalPickupValid 
              ? { ...originalOrder.pickupLocation }
              : incomingOrder.pickupLocation,
            // Preserve delivery location if needed
            deliveryLocation: incomingDeliveryInvalid && originalDeliveryValid
              ? { ...originalOrder.deliveryLocation }
              : incomingOrder.deliveryLocation,
            // Also preserve restaurant location if available
            restaurant: {
              ...incomingOrder.restaurant,
              location: originalOrder.restaurant?.location || incomingOrder.restaurant?.location
            },
            // Preserve lat/lng fields
            pickupLatitude: incomingOrder.pickupLatitude || originalOrder.pickupLatitude,
            pickupLongitude: incomingOrder.pickupLongitude || originalOrder.pickupLongitude,
            deliveryLatitude: incomingOrder.deliveryLatitude || originalOrder.deliveryLatitude,
            deliveryLongitude: incomingOrder.deliveryLongitude || originalOrder.deliveryLongitude
          };
          
          console.log('✅ Middleware: Coordinates preserved:', {
            pickup: modifiedOrder.pickupLocation?.coordinates,
            delivery: modifiedOrder.deliveryLocation?.coordinates
          });
          
          // Create modified action with preserved coordinates
          action = {
            ...action,
            payload: {
              ...action.payload,
              order: modifiedOrder
            }
          };
        }
      }
    }
  }
  
  // Pass the action (possibly modified) to the next middleware
  return next(action);
};

export default coordinatePreservationMiddleware; 