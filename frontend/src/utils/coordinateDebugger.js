// Coordinate debugging utility to help track coordinate flow
export class CoordinateDebugger {
  static isEnabled = process.env.NODE_ENV === 'development';
  
  static log(message, data = null) {
    if (this.isEnabled) {
      console.log(`🗺️ ${message}`, data || '');
    }
  }
  
  static warn(message, data = null) {
    if (this.isEnabled) {
      console.warn(`⚠️ ${message}`, data || '');
    }
  }
  
  static error(message, data = null) {
    if (this.isEnabled) {
      console.error(`❌ ${message}`, data || '');
    }
  }
  
  static success(message, data = null) {
    if (this.isEnabled) {
      console.log(`✅ ${message}`, data || '');
    }
  }
  
  static validateCoordinate(coordinate) {
    if (!coordinate) return false;
    if (!Array.isArray(coordinate)) return false;
    if (coordinate.length !== 2) return false;
    if (typeof coordinate[0] !== 'number' || typeof coordinate[1] !== 'number') return false;
    if (isNaN(coordinate[0]) || isNaN(coordinate[1])) return false;
    if (coordinate[0] === 0 && coordinate[1] === 0) return false;
    if (Math.abs(coordinate[0]) > 180 || Math.abs(coordinate[1]) > 90) return false;
    return true;
  }
  
  static validateOrder(order, context = '') {
    if (!order) {
      this.error(`No order provided for validation`, { context });
      return { hasValidPickup: false, hasValidDelivery: false };
    }
    
    const hasValidPickup = this.validateCoordinate(order.pickupLocation?.coordinates);
    const hasValidDelivery = this.validateCoordinate(order.deliveryLocation?.coordinates);
    
    this.log(`Order validation - ${context}`, {
      orderId: order._id,
      hasValidPickup,
      hasValidDelivery,
      pickupCoords: order.pickupLocation?.coordinates,
      deliveryCoords: order.deliveryLocation?.coordinates,
      pickupLatLng: [order.pickupLatitude, order.pickupLongitude],
      deliveryLatLng: [order.deliveryLatitude, order.deliveryLongitude],
      hasRestaurantCoords: this.validateCoordinate(order.restaurant?.location?.coordinates),
      hasUserCoords: this.validateCoordinate(order.user?.location?.coordinates),
      restaurantCoords: order.restaurant?.location?.coordinates,
      userCoords: order.user?.location?.coordinates
    });
    
    if (!hasValidPickup) {
      this.warn(`Invalid pickup coordinates detected`, {
        orderId: order._id,
        coordinates: order.pickupLocation?.coordinates,
        context
      });
    }
    
    if (!hasValidDelivery) {
      this.warn(`Invalid delivery coordinates detected`, {
        orderId: order._id,
        coordinates: order.deliveryLocation?.coordinates,
        context
      });
    }
    
    return { hasValidPickup, hasValidDelivery };
  }
  
  static logAcceptanceFlow(step, data) {
    this.log(`ACCEPTANCE FLOW - ${step}`, data);
  }
  
  static logCoordinatePreservation(before, after, orderId) {
    this.log(`COORDINATE PRESERVATION CHECK`, {
      orderId,
      before: {
        pickup: before.pickupLocation?.coordinates,
        delivery: before.deliveryLocation?.coordinates
      },
      after: {
        pickup: after.pickupLocation?.coordinates,
        delivery: after.deliveryLocation?.coordinates
      },
      pickupPreserved: JSON.stringify(before.pickupLocation?.coordinates) === JSON.stringify(after.pickupLocation?.coordinates),
      deliveryPreserved: JSON.stringify(before.deliveryLocation?.coordinates) === JSON.stringify(after.deliveryLocation?.coordinates)
    });
  }
  
  static logReduxState(section, data) {
    this.log(`REDUX STATE - ${section}`, {
      count: Array.isArray(data) ? data.length : 'N/A',
      sampleData: Array.isArray(data) && data.length > 0 ? {
        id: data[0]._id,
        pickup: data[0].pickupLocation?.coordinates,
        delivery: data[0].deliveryLocation?.coordinates,
        status: data[0].status || data[0].deliveryStatus
      } : 'No data'
    });
  }
  
  static trackCoordinateFlow(action, orderId, coordinates) {
    this.log(`COORDINATE FLOW - ${action}`, {
      orderId,
      timestamp: new Date().toISOString(),
      pickup: coordinates.pickup,
      delivery: coordinates.delivery,
      isPickupValid: this.validateCoordinate(coordinates.pickup),
      isDeliveryValid: this.validateCoordinate(coordinates.delivery)
    });
  }
  
  static debugActiveDeliveriesState(activeDeliveries) {
    this.log('ACTIVE DELIVERIES STATE DEBUG', {
      count: activeDeliveries.length,
      orders: activeDeliveries.map(order => ({
        id: order._id,
        status: order.status || order.deliveryStatus,
        pickup: order.pickupLocation?.coordinates,
        delivery: order.deliveryLocation?.coordinates,
        pickupValid: this.validateCoordinate(order.pickupLocation?.coordinates),
        deliveryValid: this.validateCoordinate(order.deliveryLocation?.coordinates),
        hasZeroCoords: {
          pickup: order.pickupLocation?.coordinates?.[0] === 0 && order.pickupLocation?.coordinates?.[1] === 0,
          delivery: order.deliveryLocation?.coordinates?.[0] === 0 && order.deliveryLocation?.coordinates?.[1] === 0
        }
      }))
    });
  }
}

export default CoordinateDebugger; 