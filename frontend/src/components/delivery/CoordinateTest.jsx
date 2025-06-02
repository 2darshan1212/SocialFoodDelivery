import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { fetchNearbyOrders, acceptDeliveryOrder, fixActiveDeliveryCoordinates } from '../../redux/deliverySlice';
import CoordinateDebugger from '../../utils/coordinateDebugger';
import { MdRefresh, MdCheck, MdError, MdWarning, MdInfo, MdBuild, MdLocationOn } from 'react-icons/md';

const CoordinateTest = () => {
  const dispatch = useDispatch();
  const { nearbyOrders, activeDeliveries, isNearbyOrdersLoading, confirmedOrders } = useSelector(state => state.delivery);
  const [testResults, setTestResults] = useState([]);
  const [lastAcceptTest, setLastAcceptTest] = useState(null);
  const [isFixing, setIsFixing] = useState(false);

  // Debug all orders in Redux store
  useEffect(() => {
    CoordinateDebugger.debugActiveDeliveriesState(activeDeliveries);
  }, [activeDeliveries]);

  useEffect(() => {
    // Run coordinate tests when orders change
    runCoordinateTests();
  }, [nearbyOrders, activeDeliveries, confirmedOrders]);

  const runCoordinateTests = () => {
    const results = [];

    // Test nearby orders coordinates
    results.push({
      category: 'Nearby Orders',
      tests: nearbyOrders.map(order => ({
        orderId: order._id,
        pickupValid: CoordinateDebugger.validateCoordinate(order.pickupLocation?.coordinates),
        deliveryValid: CoordinateDebugger.validateCoordinate(order.deliveryLocation?.coordinates),
        pickupCoords: order.pickupLocation?.coordinates,
        deliveryCoords: order.deliveryLocation?.coordinates,
        hasPickupLatLng: !!(order.pickupLatitude && order.pickupLongitude),
        hasDeliveryLatLng: !!(order.deliveryLatitude && order.deliveryLongitude),
        hasZeroPickup: order.pickupLocation?.coordinates?.[0] === 0 && order.pickupLocation?.coordinates?.[1] === 0,
        hasZeroDelivery: order.deliveryLocation?.coordinates?.[0] === 0 && order.deliveryLocation?.coordinates?.[1] === 0,
      }))
    });

    // Test confirmed orders coordinates  
    results.push({
      category: 'Confirmed Orders',
      tests: confirmedOrders.map(order => ({
        orderId: order._id,
        pickupValid: CoordinateDebugger.validateCoordinate(order.pickupLocation?.coordinates),
        deliveryValid: CoordinateDebugger.validateCoordinate(order.deliveryLocation?.coordinates),
        pickupCoords: order.pickupLocation?.coordinates,
        deliveryCoords: order.deliveryLocation?.coordinates,
        hasPickupLatLng: !!(order.pickupLatitude && order.pickupLongitude),
        hasDeliveryLatLng: !!(order.deliveryLatitude && order.deliveryLongitude),
        hasZeroPickup: order.pickupLocation?.coordinates?.[0] === 0 && order.pickupLocation?.coordinates?.[1] === 0,
        hasZeroDelivery: order.deliveryLocation?.coordinates?.[0] === 0 && order.deliveryLocation?.coordinates?.[1] === 0,
      }))
    });

    // Test active deliveries coordinates
    results.push({
      category: 'Active Deliveries',
      tests: activeDeliveries.map(order => ({
        orderId: order._id,
        pickupValid: CoordinateDebugger.validateCoordinate(order.pickupLocation?.coordinates),
        deliveryValid: CoordinateDebugger.validateCoordinate(order.deliveryLocation?.coordinates),
        pickupCoords: order.pickupLocation?.coordinates,
        deliveryCoords: order.deliveryLocation?.coordinates,
        hasPickupLatLng: !!(order.pickupLatitude && order.pickupLongitude),
        hasDeliveryLatLng: !!(order.deliveryLatitude && order.deliveryLongitude),
        hasZeroPickup: order.pickupLocation?.coordinates?.[0] === 0 && order.pickupLocation?.coordinates?.[1] === 0,
        hasZeroDelivery: order.deliveryLocation?.coordinates?.[0] === 0 && order.deliveryLocation?.coordinates?.[1] === 0,
      }))
    });

    setTestResults(results);
  };

  const manualCoordinateFix = async () => {
    setIsFixing(true);
    CoordinateDebugger.log('Starting manual coordinate fix for active deliveries');

    try {
      // First, try the built-in fix function
      dispatch(fixActiveDeliveryCoordinates());

      // Log current state after fix attempt
      setTimeout(() => {
        CoordinateDebugger.log('Active deliveries after fix attempt:', {
          count: activeDeliveries.length,
          details: activeDeliveries.map(order => ({
            id: order._id,
            pickup: order.pickupLocation?.coordinates,
            delivery: order.deliveryLocation?.coordinates,
            hasZeroPickup: order.pickupLocation?.coordinates?.[0] === 0 && order.pickupLocation?.coordinates?.[1] === 0,
            hasZeroDelivery: order.deliveryLocation?.coordinates?.[0] === 0 && order.deliveryLocation?.coordinates?.[1] === 0
          }))
        });

        // Check for any orders that still have invalid coordinates
        const ordersWithIssues = activeDeliveries.filter(order => 
          !CoordinateDebugger.validateCoordinate(order.pickupLocation?.coordinates) ||
          !CoordinateDebugger.validateCoordinate(order.deliveryLocation?.coordinates)
        );

        if (ordersWithIssues.length > 0) {
          CoordinateDebugger.warn(`${ordersWithIssues.length} orders still have coordinate issues after fix attempt`);
          
          // Try to find these orders in nearbyOrders or confirmedOrders and sync coordinates
          ordersWithIssues.forEach(activeOrder => {
            const nearbyMatch = nearbyOrders.find(o => o._id === activeOrder._id);
            const confirmedMatch = confirmedOrders.find(o => o._id === activeOrder._id);
            const sourceOrder = nearbyMatch || confirmedMatch;

            if (sourceOrder) {
              CoordinateDebugger.log(`Found source order for ${activeOrder._id}`, {
                sourcePickup: sourceOrder.pickupLocation?.coordinates,
                sourceDelivery: sourceOrder.deliveryLocation?.coordinates,
                activePickup: activeOrder.pickupLocation?.coordinates,
                activeDelivery: activeOrder.deliveryLocation?.coordinates
              });
            } else {
              CoordinateDebugger.warn(`No source order found for ${activeOrder._id} to restore coordinates`);
            }
          });
        } else {
          CoordinateDebugger.success('All active deliveries now have valid coordinates');
        }

        setIsFixing(false);
      }, 1000);

    } catch (error) {
      CoordinateDebugger.error('Manual coordinate fix failed', error);
      setIsFixing(false);
    }
  };

  const testOrderAcceptance = async (orderId) => {
    const nearbyOrder = nearbyOrders.find(o => o._id === orderId);
    if (!nearbyOrder) return;

    console.log('🧪 COORDINATE TEST: Starting order acceptance test for', orderId);
    
    // Record coordinates before acceptance
    const beforeCoords = {
      pickup: nearbyOrder.pickupLocation?.coordinates,
      delivery: nearbyOrder.deliveryLocation?.coordinates,
      pickupLatLng: [nearbyOrder.pickupLatitude, nearbyOrder.pickupLongitude],
      deliveryLatLng: [nearbyOrder.deliveryLatitude, nearbyOrder.deliveryLongitude]
    };

    console.log('🧪 BEFORE ACCEPTANCE:', beforeCoords);

    try {
      // Accept the order
      await dispatch(acceptDeliveryOrder(orderId)).unwrap();
      
      // Wait a bit for state to update
      setTimeout(() => {
        const activeOrder = activeDeliveries.find(o => o._id === orderId);
        if (activeOrder) {
          const afterCoords = {
            pickup: activeOrder.pickupLocation?.coordinates,
            delivery: activeOrder.deliveryLocation?.coordinates,
            pickupLatLng: [activeOrder.pickupLatitude, activeOrder.pickupLongitude],
            deliveryLatLng: [activeOrder.deliveryLatitude, activeOrder.deliveryLongitude]
          };

          console.log('🧪 AFTER ACCEPTANCE:', afterCoords);

          const pickupPreserved = JSON.stringify(beforeCoords.pickup) === JSON.stringify(afterCoords.pickup);
          const deliveryPreserved = JSON.stringify(beforeCoords.delivery) === JSON.stringify(afterCoords.delivery);

          const testResult = {
            orderId,
            timestamp: new Date().toISOString(),
            pickupPreserved,
            deliveryPreserved,
            beforeCoords,
            afterCoords,
            success: pickupPreserved && deliveryPreserved
          };

          setLastAcceptTest(testResult);
          console.log('🧪 COORDINATE TEST RESULT:', testResult);
        }
      }, 1000);
    } catch (error) {
      console.error('🧪 COORDINATE TEST FAILED:', error);
      setLastAcceptTest({
        orderId,
        timestamp: new Date().toISOString(),
        error: error.message,
        success: false
      });
    }
  };

  const refreshOrders = () => {
    dispatch(fetchNearbyOrders());
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Coordinate Preservation Tests</h3>
        <div className="flex space-x-2">
          <button 
            onClick={manualCoordinateFix}
            disabled={isFixing}
            className="bg-orange-500 text-white px-3 py-1 rounded text-sm disabled:opacity-50 flex items-center"
          >
            <MdBuild className={`mr-1 ${isFixing ? 'animate-spin' : ''}`} />
            {isFixing ? 'Fixing...' : 'Fix Coordinates'}
          </button>
          <button 
            onClick={refreshOrders}
            disabled={isNearbyOrdersLoading}
            className="bg-blue-500 text-white px-3 py-1 rounded text-sm disabled:opacity-50"
          >
            <MdRefresh className={`inline mr-1 ${isNearbyOrdersLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Coordinate Test Results */}
      {testResults.map((category, idx) => (
        <div key={idx} className="border rounded p-3">
          <h4 className="font-medium mb-2 flex items-center">
            <MdInfo className="mr-2" />
            {category.category} ({category.tests.length})
          </h4>
          
          {category.tests.length === 0 ? (
            <p className="text-gray-500 text-sm">No orders in this category</p>
          ) : (
            <div className="space-y-2">
              {category.tests.map((test, testIdx) => (
                <div key={testIdx} className="bg-gray-50 p-2 rounded text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono">{test.orderId.slice(-8)}</span>
                    <div className="flex space-x-2">
                      {test.pickupValid ? (
                        <MdCheck className="text-green-500" title="Valid pickup coordinates" />
                      ) : (
                        <MdError className="text-red-500" title="Invalid pickup coordinates" />
                      )}
                      {test.deliveryValid ? (
                        <MdCheck className="text-green-500" title="Valid delivery coordinates" />
                      ) : (
                        <MdError className="text-red-500" title="Invalid delivery coordinates" />
                      )}
                      {category.category === 'Nearby Orders' && (
                        <button 
                          onClick={() => testOrderAcceptance(test.orderId)}
                          className="bg-blue-500 text-white px-2 py-1 rounded text-xs"
                        >
                          Test Accept
                        </button>
                      )}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="text-gray-600">Pickup:</div>
                      <div className={`font-mono text-xs ${test.hasZeroPickup ? 'text-red-600 font-bold' : ''}`}>
                        {test.pickupCoords ? 
                          `[${test.pickupCoords[0].toFixed(4)}, ${test.pickupCoords[1].toFixed(4)}]` : 
                          'Missing'
                        }
                        {test.hasZeroPickup && <span className="text-red-500 ml-1">⚠️ ZERO COORDS!</span>}
                      </div>
                      {test.hasPickupLatLng && <div className="text-green-600 text-xs">✓ Has lat/lng</div>}
                    </div>
                    
                    <div>
                      <div className="text-gray-600">Delivery:</div>
                      <div className={`font-mono text-xs ${test.hasZeroDelivery ? 'text-red-600 font-bold' : ''}`}>
                        {test.deliveryCoords ? 
                          `[${test.deliveryCoords[0].toFixed(4)}, ${test.deliveryCoords[1].toFixed(4)}]` : 
                          'Missing'
                        }
                        {test.hasZeroDelivery && <span className="text-red-500 ml-1">⚠️ ZERO COORDS!</span>}
                      </div>
                      {test.hasDeliveryLatLng && <div className="text-green-600 text-xs">✓ Has lat/lng</div>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {/* Last Acceptance Test Result */}
      {lastAcceptTest && (
        <div className={`border rounded p-3 ${lastAcceptTest.success ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'}`}>
          <h4 className="font-medium mb-2 flex items-center">
            {lastAcceptTest.success ? (
              <MdCheck className="mr-2 text-green-500" />
            ) : (
              <MdError className="mr-2 text-red-500" />
            )}
            Last Acceptance Test
          </h4>
          
          <div className="text-sm">
            <div className="mb-2">
              <strong>Order:</strong> {lastAcceptTest.orderId?.slice(-8)}
              <br />
              <strong>Time:</strong> {new Date(lastAcceptTest.timestamp).toLocaleTimeString()}
              <br />
              <strong>Result:</strong> {lastAcceptTest.success ? 'SUCCESS' : 'FAILED'}
            </div>
            
            {lastAcceptTest.error ? (
              <div className="text-red-600">Error: {lastAcceptTest.error}</div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <strong>Pickup Preserved:</strong> {lastAcceptTest.pickupPreserved ? '✅' : '❌'}
                  <br />
                  <span className="text-xs font-mono">
                    Before: {JSON.stringify(lastAcceptTest.beforeCoords?.pickup)}
                    <br />
                    After: {JSON.stringify(lastAcceptTest.afterCoords?.pickup)}
                  </span>
                </div>
                
                <div>
                  <strong>Delivery Preserved:</strong> {lastAcceptTest.deliveryPreserved ? '✅' : '❌'}
                  <br />
                  <span className="text-xs font-mono">
                    Before: {JSON.stringify(lastAcceptTest.beforeCoords?.delivery)}
                    <br />
                    After: {JSON.stringify(lastAcceptTest.afterCoords?.delivery)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Summary Stats */}
      <div className="bg-blue-50 border border-blue-200 rounded p-3">
        <h4 className="font-medium mb-2">Summary</h4>
        <div className="text-sm">
          <div>Total Nearby Orders: {nearbyOrders.length}</div>
          <div>Total Confirmed Orders: {confirmedOrders.length}</div>
          <div>Total Active Deliveries: {activeDeliveries.length}</div>
          <div>
            Valid Nearby Orders: {nearbyOrders.filter(o => 
              CoordinateDebugger.validateCoordinate(o.pickupLocation?.coordinates) && 
              CoordinateDebugger.validateCoordinate(o.deliveryLocation?.coordinates)
            ).length}
          </div>
          <div>
            Valid Active Deliveries: {activeDeliveries.filter(o => 
              CoordinateDebugger.validateCoordinate(o.pickupLocation?.coordinates) && 
              CoordinateDebugger.validateCoordinate(o.deliveryLocation?.coordinates)
            ).length}
          </div>
          
          {/* Zero Coordinates Alert */}
          {(() => {
            const ordersWithZeroCoords = activeDeliveries.filter(o => 
              (o.pickupLocation?.coordinates?.[0] === 0 && o.pickupLocation?.coordinates?.[1] === 0) ||
              (o.deliveryLocation?.coordinates?.[0] === 0 && o.deliveryLocation?.coordinates?.[1] === 0)
            );
            
            if (ordersWithZeroCoords.length > 0) {
              return (
                <div className="mt-3 p-2 bg-red-100 border border-red-300 rounded">
                  <div className="flex items-center text-red-700">
                    <MdError className="mr-1" />
                    <strong>⚠️ {ordersWithZeroCoords.length} Active Deliveries with [0,0] coordinates!</strong>
                  </div>
                  <div className="text-xs text-red-600 mt-1">
                    Orders: {ordersWithZeroCoords.map(o => o._id.slice(-6)).join(', ')}
                  </div>
                  <div className="text-xs text-red-600 mt-1">
                    Click "Fix Coordinates" to attempt automatic repair.
                  </div>
                </div>
              );
            }
            return null;
          })()}
        </div>
      </div>
    </div>
  );
};

export default CoordinateTest; 