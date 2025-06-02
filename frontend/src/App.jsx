import React, { useEffect, useState } from "react";
import SolanaWalletProvider from "./components/wallet/SolanaWalletProvider";
import StoryProtocolProvider from "./providers/StoryProtocolProvider";
import { SocketProvider } from "./context/SocketContext.jsx";
import tokenManager from "./utils/tokenManager";
import AuthProviderWithRouter from "./components/Auth/AuthProviderWithRouter";
import ProtectedRoute from "./components/Auth/ProtectedRoute";
import { createBrowserRouter, RouterProvider, Navigate, Outlet } from "react-router-dom";
import Signup from "./components/Auth/Signup";
import AuthTest from "./pages/AuthTest";
import MainLayout from "./components/mainlayout/MainLayout";
import Login from "./components/Auth/Login";
import LoginTest from "./pages/LoginTest";
import Feeds from "./components/feeds/Feeds";
import Profile from "./components/profile/Profile";
import EditProfile from "./components/editProfile/EditProfile";
import CategoryPage from "./components/category/CategoryPage";
import Cart from "./components/cart/Cart";
import ChatLayout from "./components/chat/ChatLayout";
import ChatPage from "./components/chat/ChatPage";
import { useDispatch, useSelector } from "react-redux";
import { setOnlineUsers } from "./redux/chatSlice";
import { addNotification, fetchNotifications } from "./redux/rtnSlice";
import { setSocketConnected, resetSocketState, addOrderStatusUpdate } from "./redux/socketSlice";
import { fetchCurrentUserFollowings } from "./redux/userSlice";
import { setCurrentUser, migrateCart, syncOrderStatus, fetchOrders } from "./redux/cartSlice";
import { 
  initSocket, 
  closeSocket, 
  onEvent, 
  offEvent,
  getSocket
} from "./services/socketManager";
import PostDetail from "./components/post/PostDetail";
import FavoritesPage from "./components/favorites/FavoritesPage";
import SharedPost from "./components/share/SharedPost";
import OrdersPage from "./components/orders/OrdersPage";
import AdminLayout from "./components/admin/AdminLayout";
import AdminDashboard from "./components/admin/AdminDashboard";
import OrdersManagement from "./components/admin/OrdersManagement";
import AdminCheck from "./pages/AdminCheck";
import CategoriesManagement from "./components/admin/CategoriesManagement";
import UsersManagement from "./components/admin/UsersManagement";
import { toast } from "react-hot-toast";
import DeliveryLayout from "./components/delivery/DeliveryLayout";
import Dashboard from "./components/delivery/Dashboard";
import Register from "./components/delivery/Register";
import NearbyOrders from "./components/delivery/NearbyOrders";
import MyDeliveries from "./components/delivery/MyDeliveries";
import DeliveryHistory from "./components/delivery/DeliveryHistory";
import DeliveryProfile from "./components/delivery/Profile";
import DeliveryAgentsManagement from "./components/admin/DeliveryAgentsManagement";

// Root layout that wraps the auth provider
const RootLayout = () => {
  return (
    <AuthProviderWithRouter>
      <Outlet />
    </AuthProviderWithRouter>
  );
};

// Create browser router configuration
const browserRouter = createBrowserRouter([
  // Root route with AuthProviderWithRouter for proper navigation
  {
    path: "/",
    element: <RootLayout />,
    children: [
      // Public routes that don't require authentication
      {
        path: "signup",
        element: <Signup />
      },
      {
        path: "login",
        element: <Login />
      },
      {
        path: "login-test",
        element: <LoginTest />
      },
      {
        path: "auth-test",
        element: <AuthTest />
      },
      
      // Public main layout routes
      {
        path: "",
        element: <MainLayout />,
        children: [
          {
            path: "",
            element: <Feeds />
          },
          {
            path: "category/:category",
            element: <CategoryPage />
          },
          {
            path: "post/:id",
            element: <PostDetail />
          }
        ]
      },
      
      // Protected routes with original URL paths
      // Profile routes
      {
        path: "profile/:id",
        element: <ProtectedRoute />,
        children: [
          {
            path: "",
            element: <Profile />
          }
        ]
      },
      {
        path: "profile/:id/account/edit",
        element: <ProtectedRoute />,
        children: [
          {
            path: "",
            element: <EditProfile />
          }
        ]
      },
      
      // Cart and favorites
      {
        path: "cartPage",
        element: <ProtectedRoute />,
        children: [
          {
            path: "",
            element: <Cart />
          }
        ]
      },
      {
        path: "favorites",
        element: <ProtectedRoute />,
        children: [
          {
            path: "",
            element: <FavoritesPage />
          }
        ]
      },
      
      // Orders
      {
        path: "orders/*",
        element: <ProtectedRoute />,
        children: [
          {
            path: "",
            element: <OrdersPage />
          }
        ]
      },
      
      // Shared posts
      {
        path: "shared/:shareId",
        element: <ProtectedRoute />,
        children: [
          {
            path: "",
            element: <SharedPost />
          }
        ]
      },
      
      // Chat routes
      {
        path: "chat",
        element: <ProtectedRoute />,
        children: [
          {
            path: "",
            element: <ChatLayout />,
            children: [
              {
                path: "chatpage",
                element: <ChatPage />
              }
            ]
          }
        ]
      },
      
      // Admin routes
      {
        path: "admin",
        element: <ProtectedRoute />,
        children: [
          {
            path: "",
            element: <AdminLayout />,
            children: [
              {
                index: true,
                element: <Navigate to="/admin/dashboard" replace />
              },
              {
                path: "dashboard",
                element: <AdminDashboard />
              },
              {
                path: "orders",
                element: <OrdersManagement />
              },
              {
                path: "categories",
                element: <CategoriesManagement />
              },
              {
                path: "users",
                element: <UsersManagement />
              },
              {
                path: "delivery-agents",
                element: <DeliveryAgentsManagement />
              },
              {
                path: "check",
                element: <AdminCheck />
              }
            ]
          }
        ]
      },
      
      // Admin debug route
      {
        path: "admin-check",
        element: <ProtectedRoute />,
        children: [
          {
            path: "",
            element: <AdminCheck />
          }
        ]
      },
      
      // Delivery routes
      {
        path: "deliver",
        element: <ProtectedRoute />,
        children: [
          {
            path: "",
            element: <DeliveryLayout />,
            children: [
              {
                path: "dashboard",
                element: <Dashboard />
              },
              {
                path: "register",
                element: <Register />
              },
              {
                path: "nearby-orders",
                element: <NearbyOrders />
              },
              {
                path: "my-deliveries",
                element: <MyDeliveries />
              },
              {
                path: "history",
                element: <DeliveryHistory />
              },
              {
                path: "profile",
                element: <DeliveryProfile />
              }
            ]
          }
        ]
      }
    ]
  }
]);

// Main App component
const App = () => {
  const { user } = useSelector((store) => store.auth);
  const { connected } = useSelector((store) => store.socket);
  const { unreadCounts } = useSelector((store) => store.chat); 
  const dispatch = useDispatch();
  
  // Initialize tokens when app loads to ensure proper authentication
  useEffect(() => {
    console.log('Initializing authentication tokens on app start');
    tokenManager.initializeTokens();
  }, []);
  
  // Token initialization handled by tokenManager above
  
  // Initialize user-specific cart when user logs in or out
  useEffect(() => {
    // Set current user ID for cart (or null if logged out)
    const userId = user?._id || null;
    console.log("Setting current user ID in cart state:", userId);
    dispatch(setCurrentUser(userId));
    
    // If user is logged in, migrate any existing cart items to their user-specific cart
    if (userId) {
      dispatch(migrateCart(userId));
      
      // Also fetch user's orders
      dispatch(fetchOrders());
    }
  }, [user, dispatch]);
  
  useEffect(() => {
    if (user) {
      dispatch(fetchNotifications());
    }
  }, [user, dispatch]);
  
  // Fetch user followings when logged in
  useEffect(() => {
    if (user) {
      dispatch(fetchCurrentUserFollowings());
    }
  }, [user, dispatch]);
  
  // Setup socket connection
  useEffect(() => {
    if (user) {
      try {
        const socket = initSocket(user._id);
        
        if (socket) {
          // Set socket connection status in Redux
          dispatch(setSocketConnected({
            connected: socket.connected,
            socketId: socket.id
          }));
          
          // Update connection status when it changes
          onEvent('connect', () => {
            console.log('Socket connected');
            dispatch(setSocketConnected({
              connected: true,
              socketId: socket.id
            }));
            
            // When reconnected, refresh notifications
            dispatch(fetchNotifications());
          });
          
          onEvent('disconnect', () => {
            console.log('Socket disconnected');
            dispatch(setSocketConnected({
              connected: false,
              socketId: null
            }));
          });
          
          // Handle connection errors
          onEvent('connect_error', (err) => {
            console.error("Socket connection error:", err.message);
            dispatch(setSocketConnected({
              connected: false,
              socketId: null
            }));
          });
          
          // Listening for all events
          onEvent('getOnlineUsers', (onlineUsers) => {
            console.log('Online users updated:', onlineUsers.length);
            dispatch(setOnlineUsers(onlineUsers));
          });

          // Handle all notification types with the same function
          const handleNotification = (notification) => {
            console.log('Received notification:', notification);
            dispatch(addNotification(notification));
          };
          
          // Register notification handlers
          onEvent('notification', handleNotification);
          onEvent('newNotification', handleNotification);

          // Register order status update handler
          onEvent('order_status_update', (data) => {
            console.log('Order status update received:', data);
            
            // Make sure data has the required fields
            if (!data || !data.orderId) {
              console.error('Invalid order status update received:', data);
              return;
            }
            
            // Add timestamp if not present
            const orderUpdate = {
              ...data,
              timestamp: data.timestamp || new Date().toISOString()
            };
            
            // Add to order status updates in socket slice
            dispatch(addOrderStatusUpdate(orderUpdate));
            
            // Synchronize order status in user's order history
            if (orderUpdate.orderId && orderUpdate.status) {
              console.log('Dispatching syncOrderStatus with:', orderUpdate);
              
              dispatch(syncOrderStatus({
                orderId: orderUpdate.orderId,
                status: orderUpdate.status,
                paymentStatus: orderUpdate.paymentStatus
              }));
              
              // Show notification for order updates with better formatting
              const formattedStatus = orderUpdate.status.replace(/_/g, ' ').toUpperCase();
              const orderId = orderUpdate.orderId.substring(0, 8);
              
              toast.info(
                `Order #${orderId}... status updated to ${formattedStatus}`,
                {
                  position: "bottom-right",
                  autoClose: 5000
                }
              );
            }
          });
        }

        return () => {
          // Clean up all event listeners
          offEvent('connect');
          offEvent('disconnect');
          offEvent('connect_error');
          offEvent('getOnlineUsers');
          offEvent('notification');
          offEvent('newNotification');
          offEvent('order_status_update');
          
          closeSocket();
          dispatch(resetSocketState());
          dispatch(setOnlineUsers([]));
        };
      } catch (error) {
        console.error("Socket setup error:", error);
      }
    } else {
      closeSocket();
      dispatch(resetSocketState());
      dispatch(setOnlineUsers([]));
    }
  }, [user, dispatch]);
  
  return (
    <SocketProvider>
      <SolanaWalletProvider>
        <StoryProtocolProvider>
          <RouterProvider 
            router={browserRouter}
            fallbackElement={<div>Loading...</div>}
          />
        </StoryProtocolProvider>
      </SolanaWalletProvider>
    </SocketProvider>
  );
};

export default App;
