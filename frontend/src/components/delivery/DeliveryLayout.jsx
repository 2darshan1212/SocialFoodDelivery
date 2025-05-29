import React, { useEffect, useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import DeliveryHeader from './DeliveryHeader';
import DeliverySidebar from './DeliverySidebar';
import useLocationTracking from '../../hooks/useLocationTracking';
import { toast } from 'react-hot-toast';
import NavigationButton from './NavigationButton';
import { 
  Home, 
  MapPin, 
  Clock, 
  History, 
  UserCircle2, 
  Package 
} from 'lucide-react';

const DeliveryLayout = () => {
  const { isDeliveryAgent, isAvailable } = useSelector(state => state.delivery);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  
  // Initialize location tracking at the layout level
  const { isTracking, error: locationError } = useLocationTracking(
    isDeliveryAgent, // Always track if they're a delivery agent
    1000 // Update every second
  );
  
  // Show location access errors
  useEffect(() => {
    if (locationError) {
      toast.error(locationError, {
        id: 'location-error', // Use an ID to prevent duplicate toasts
        duration: 5000
      });
    }
  }, [locationError]);
  
  // Show tracking status notifications
  useEffect(() => {
    if (isDeliveryAgent) {
      if (isTracking) {
        toast.success('Location tracking active', {
          id: 'location-tracking-active',
          duration: 3000
        });
      } else if (isAvailable && !isTracking) {
        toast.error('Location tracking failed. Please enable location services.', {
          id: 'location-tracking-failed',
          duration: 3000
        });
      }
    }
  }, [isTracking, isDeliveryAgent, isAvailable]);
  
  return (
    <div className="min-h-screen bg-gray-50">
      <DeliveryHeader />
      <div className="flex flex-1 min-h-[calc(100vh-64px)]">
        {/* Sidebar for desktop */}
        <div className="hidden md:block w-64 bg-white border-r border-gray-200">
          <DeliverySidebar />
        </div>
        
        {/* Main content */}
        <div className="flex-1 p-4 md:p-6 overflow-auto pb-24">
          <Outlet />
        </div>
      </div>
      
      {/* Mobile Sidebar */}
      <div 
        className={`fixed inset-y-0 right-0 transform ${sidebarOpen ? 'translate-x-0' : 'translate-x-full'} w-64 bg-white shadow-xl z-50 transition-transform duration-300 ease-in-out md:hidden`}
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between p-4 border-b">
            <h2 className="text-xl font-semibold">Delivery Menu</h2>
            <button 
              onClick={() => setSidebarOpen(false)}
              className="p-2 rounded-full hover:bg-gray-100"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            <DeliverySidebar isMobile={true} />
          </div>
        </div>
      </div>
      
      {/* Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-25 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        ></div>
      )}

      {/* Mobile bottom navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg z-30">
        <div className="flex justify-around items-center h-16">
          <NavigationButton
            icon={<Home size={24} />}
            label="Dashboard"
            path="/deliver/dashboard"
            currentPath={location.pathname}
          />
          <NavigationButton
            icon={<MapPin size={24} />}
            label="Nearby"
            path="/deliver/nearby-orders"
            currentPath={location.pathname}
          />
          <NavigationButton
            icon={<Package size={24} />}
            label="Active"
            path="/deliver/my-deliveries"
            currentPath={location.pathname}
          />
          <NavigationButton
            icon={<History size={24} />}
            label="History"
            path="/deliver/history"
            currentPath={location.pathname}
          />
          <NavigationButton
            icon={<UserCircle2 size={24} />}
            label="Profile"
            path="/deliver/profile"
            currentPath={location.pathname}
          />
        </div>
      </div>
    </div>
  );
};

export default DeliveryLayout;