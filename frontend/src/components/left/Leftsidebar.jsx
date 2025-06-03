import React, { useState, useEffect, useRef } from "react";
import {
  Home,
  MessageCircle,
  Bell,
  ShoppingCart,
  User,
  Heart,
  PlusSquare,
  Check,
  Trash2,
  X,
  Package,
  Receipt,
  Settings,
  Truck
} from "lucide-react";
import CreatePost from "../post/CreatePost";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import moment from "moment"; // npm install moment
import { 
  clearNotifications, 
  markNotificationsSeen, 
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead
} from "../../redux/rtnSlice";
import { 
  setShowPickupModal,
  setSelectedOrderId,
  clearPickupState,
  addPickupNotification,
  setCurrentNotificationOrder,
  fetchOrderDetails
} from "../../redux/pickupSlice";
import { setSelectedUser } from "../../redux/authSlice";
import { toast } from "react-toastify";
import OrderDetailsModal from '../OrderDetailsModal';
import PickupOrderDetailsModal from '../pickup/PickupOrderDetailsModal';

import { 
  Avatar, 
  Badge, 
  Popover, 
  Typography, 
  Box, 
  Tab, 
  Tabs,
  Button,
  IconButton,
  Divider,
  CircularProgress,
  useMediaQuery,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  SwipeableDrawer
} from "@mui/material";


const Leftsidebar = () => {
  const [openPost, setOpenPost] = useState(false);
  const [showFavorites, setShowFavorites] = useState(false);
  const navigate = useNavigate();
  const { user } = useSelector((store) => store.auth);
  const { unreadCounts } = useSelector((store) => store.chat);
  const { posts } = useSelector((store) => store.post);
  const { showPickupModal, selectedOrderId: pickupOrderId } = useSelector((store) => store.pickup);
  const isMobile = useMediaQuery('(max-width:768px)');
  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [selectedOrderData, setSelectedOrderData] = useState(null);
  
  // Calculate total unread messages
  const totalUnreadMessages = unreadCounts ? 
    Object.values(unreadCounts).reduce((sum, count) => sum + count, 0) : 0;
 
  const createPostHandler = () => {
    setOpenPost(true);
  };
  
  const sidebarHandler = (textType) => {
    if (textType == "Post") {
      createPostHandler();
    } else if (textType == "Profile") {
      if (user && user._id) {
        navigate(`/profile/${user._id}`);
      } else {
        toast.error("User profile not available. Please refresh the page.");
        console.error("User data missing:", user);
      }
    } else if (textType == "Home") {
      navigate("/");
      setShowFavorites(false);
    } else if (textType == "Messages") {
      navigate("/chat/chatpage");
      setShowFavorites(false);
    } else if (textType == "Favorites") {
      setShowFavorites(true);
      navigate("/favorites");
    } else if (textType == "Cart") {
      navigate("/cartPage");
      setShowFavorites(false);
    } else if (textType == "Orders") {
      navigate("/orders");
      setShowFavorites(false);
    } else if (textType == "Admin") {
      navigate("/admin/dashboard");
      setShowFavorites(false);
    } else if (textType == "Delivery") {
      navigate("/deliver/dashboard");
      setShowFavorites(false);
    }
  };

  // Get favorite posts
  const favoritePosts = React.useMemo(() => {
    if (!user?.bookmarks || !posts) return [];
    return posts.filter(post => user.bookmarks.includes(post._id));
  }, [user?.bookmarks, posts]);

  const handleNotificationClick = (notification) => {
    console.log("🔔 Notification clicked:", notification);
    console.log("🔔 Notification type:", notification.type);
    console.log("🔔 Full notification object:", JSON.stringify(notification, null, 2));
    
    // Close the notifications popover
    setAnchorEl(null);
    
    // Mark notification as read if it has an ID
    if (notification._id) {
      dispatch(markNotificationRead(notification._id));
    }
    
    // Navigate based on notification type
    if (notification.type === 'like' || notification.type === 'comment') {
      // Handle both formats - older socket notifications vs database notifications
      const postId = notification.post || notification.postId;
      if (postId) {
        console.log(`Navigating to post: ${postId}`);
        
        // First navigate to the post
        navigate(`/post/${postId}`);
        
        // Close the drawer after a short delay to ensure navigation starts
        setTimeout(() => {
          handleClose();
        }, 300);
      } else {
        console.error("No post ID found in notification:", notification);
        toast.error("Could not find the referenced post");
      }
    } else if (notification.type === 'follow') {
      // Handle both formats
      const senderId = notification.sender?._id || notification.sender || notification.userId;
      if (senderId) {
        console.log(`Navigating to profile: ${senderId}`);
        
        // First navigate to the profile
        navigate(`/profile/${senderId}`);
        
        // Close the drawer after a short delay to ensure navigation starts
        setTimeout(() => {
          handleClose();
        }, 300);
      } else {
        console.error("No sender ID found in notification:", notification);
        toast.error("Could not find the referenced user");
      }
    } else if (notification.type === 'order') {
      console.log("🛒 Processing order notification...");
      
      // Handle order notifications - check if it's a pickup order
      // Handle both formats: object with _id or direct string ID
      const orderId = typeof notification.order === 'string' 
        ? notification.order 
        : notification.order?._id || notification.orderId;
      
      const deliveryMethod = typeof notification.order === 'object' 
        ? notification.order?.deliveryMethod 
        : undefined;
      
      // Log notification data to debug pickup detection
      console.log("🔍 Order notification received:", {
        notification,
        orderId,
        deliveryMethod,
        hasOrderObject: !!notification.order,
        orderKeys: notification.order ? Object.keys(notification.order) : [],
        orderType: typeof notification.order,
        messageContent: notification.message
      });
      
      // Multiple ways to detect pickup orders
      const isPickupOrder = deliveryMethod === 'pickup' || 
                           notification.message?.toLowerCase().includes('pickup') ||
                           notification.message?.toLowerCase().includes('self-pickup');
      
      console.log("🚗 Is pickup order?", isPickupOrder);
      console.log("🚗 Delivery method:", deliveryMethod);
      console.log("🚗 Message includes 'pickup':", notification.message?.toLowerCase().includes('pickup'));
      
      if (orderId) {
        console.log(`Opening ${isPickupOrder ? 'pickup' : 'regular'} order details for order: ${orderId}`);
        
        if (isPickupOrder) {
          // For pickup orders, use Redux pickup slice
          console.log("🚗 Setting up pickup modal with order data:", notification.order);
          
          // Add safety checks before dispatching
          if (orderId && typeof orderId === 'string') {
            console.log("🚗 Dispatching setSelectedOrderId:", orderId);
            dispatch(setSelectedOrderId(orderId));
          }
          
          // Only set current notification order if it's an object
          if (notification.order && typeof notification.order === 'object') {
            console.log("🚗 Dispatching setCurrentNotificationOrder:", notification.order);
            dispatch(setCurrentNotificationOrder(notification.order));
          }
          
          console.log("🚗 Dispatching setShowPickupModal(true)");
          dispatch(setShowPickupModal(true));
          
          // Always fetch full order details from the API
          console.log("🚗 Dispatching fetchOrderDetails:", orderId);
          dispatch(fetchOrderDetails(orderId));
          
          // Add the notification to pickup notifications
          console.log("🚗 Dispatching addPickupNotification");
          dispatch(addPickupNotification(notification));
          
          console.log("🚗 Pickup modal setup complete!");
        } else {
          // For regular orders or when delivery method is unclear
          console.log("📦 Setting up regular order modal or fetching details to determine type...");
          dispatch(setSelectedOrderId(orderId));
          dispatch(fetchOrderDetails(orderId)).then((result) => {
            console.log("Order fetch result:", result);
            if (result.payload && result.payload.deliveryMethod === 'pickup') {
              console.log("🚗 Order confirmed as pickup, opening pickup modal");
              dispatch(setCurrentNotificationOrder(result.payload));
              dispatch(setShowPickupModal(true));
              dispatch(addPickupNotification(notification));
            } else {
              console.log("📦 Order confirmed as regular delivery, opening regular modal");
              setSelectedOrderData(result.payload || notification.order);
        setOrderModalOpen(true);
            }
          }).catch((error) => {
            console.error("Failed to fetch order details:", error);
            // Fallback to regular modal
            setSelectedOrderData(typeof notification.order === 'object' ? notification.order : null);
            setOrderModalOpen(true);
          });
        }
      } else {
        console.error("No order ID found in notification:", notification);
        toast.error("Could not find the referenced order");
      }
    } else {
      console.warn("Unknown notification type:", notification.type);
      toast.warning("This notification type is not supported yet");
    }
  };

  const dispatch = useDispatch();
  const [anchorEl, setAnchorEl] = useState(null);
  const [tabValue, setTabValue] = useState(0);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const buttonRef = useRef(null);
  
  const { 
    notifications, 
    realtimeNotifications, 
    unseenCount,
    loading 
  } = useSelector((store) => store.realTimeNotification);
  
  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const handleClose = () => {
    setAnchorEl(null);
    setIsDrawerOpen(false);
  };

  const handleMarkAllRead = () => {
    dispatch(markAllNotificationsRead());
    handleClose(); // Close the popover after marking all as read
  };

  const open = Boolean(anchorEl);
  const id = open ? "notifications-popover" : undefined;

  // Function to render a single notification
  const renderNotification = (notification, index, context = '') => {
    let content = '';
    let icon = null;
    let timestamp = notification.createdAt ? moment(notification.createdAt).fromNow() : 'just now';
    
    // Format content based on notification type
    switch(notification.type) {
      case 'like':
        content = 'liked your post';
        icon = <Heart size={16} className="text-red-500" />;
        break;
      case 'comment':
        content = notification.message 
          ? `commented: "${notification.message.substring(0, 20)}${notification.message.length > 20 ? '...' : ''}"`
          : 'commented on your post';
        icon = <MessageCircle size={16} className="text-blue-500" />;
        break;
      case 'follow':
        content = 'started following you';
        icon = <User size={16} className="text-green-500" />;
        break;
      case 'message':
        // Message notifications should be handled in the conversations list
        // but include handling here for any that might still appear
        content = notification.message 
          ? notification.message.includes('sent you a message') 
            ? notification.message 
            : `sent you a message: "${notification.message.substring(0, 20)}${notification.message.length > 20 ? '...' : ''}"`
          : 'sent you a message';
        icon = <MessageCircle size={16} className="text-purple-500" />;
        break;
      case 'order':
        content = notification.message || 'placed an order from your post';
        icon = <ShoppingCart size={16} className="text-orange-500" />;
        break;
      default:
        content = notification.message || 'interacted with you';
        icon = <Bell size={16} className="text-gray-500" />;
    }
    
    // Get user information
    const username = notification.sender?.username || 
                     notification.userDetails?.username || 
                     'Unknown user';
    
    const profilePic = notification.sender?.profilePicture || 
                      notification.userDetails?.profilePicture;
    
    // Handle click with proper event handling
    const handleItemClick = (e) => {
      e.preventDefault();
      e.stopPropagation(); // Prevent event bubbling
      
      // Use setTimeout to ensure the click ripple effect completes
      setTimeout(() => {
        handleNotificationClick(notification);
      }, 150);
    };
    
    // Create unique key by combining notification ID, context, and index
    const uniqueKey = notification._id 
      ? `${context}-${notification._id}` 
      : `${context}-${notification.type}-${notification.sender?._id || 'unknown'}-${index}-${notification.createdAt || Date.now()}`;
    
    return (
      <div
        key={uniqueKey}
        className={`flex gap-3 items-start p-4 hover:bg-gray-100 active:bg-gray-200 cursor-pointer transition-colors duration-150 ${
          !notification.read ? 'bg-blue-50' : ''
        }`}
        onClick={handleItemClick}
        role="button"
        tabIndex={0}
      >
        <Avatar
          alt={username}
          src={profilePic}
          sx={{ width: 42, height: 42 }}
        />
        <div className="flex-1 min-w-0"> {/* prevent overflow */}
          <div className="flex flex-wrap items-center gap-1">
            <span className="font-bold text-sm mr-1">
              {username}
            </span>
            <span className="text-xs text-gray-700 flex items-center gap-1 flex-wrap">
              {icon} {content}
            </span>
          </div>
          {notification.message && notification.type !== 'comment' && (
            <p className="text-xs text-gray-600 mt-1 break-words">{notification.message}</p>
          )}
          <p className="text-xs text-gray-500 mt-1">
            {timestamp}
          </p>
        </div>
        {!notification.read && (
          <div className="flex-shrink-0">
            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
          </div>
        )}
      </div>
    );
  };

  // Remove duplicates and filter out message notifications
  const removeDuplicates = (notificationList) => {
    const uniqueMap = new Map();
    notificationList.forEach(notification => {
      const key = notification._id || `${notification.type}-${notification.sender?._id}-${notification.createdAt}`;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, notification);
      }
    });
    return Array.from(uniqueMap.values());
  };

  const allNotifications = removeDuplicates([
    ...(Array.isArray(notifications) ? notifications : []), 
    ...(Array.isArray(realtimeNotifications) ? realtimeNotifications : [])
  ])
  .filter(notification => notification.type !== 'message') // Filter out message notifications
  .sort((a, b) => new Date(b.createdAt || Date.now()) - new Date(a.createdAt || Date.now()));

  // Filter by type for the other tabs
  const followNotifications = allNotifications.filter(n => n.type === 'follow');
  const likeNotifications = allNotifications.filter(n => n.type === 'like');
  const commentNotifications = allNotifications.filter(n => n.type === 'comment');
  const orderNotifications = allNotifications.filter(n => n.type === 'order');

  // Notification tab panel content
  const NotificationTabsContent = () => (
    <Box sx={{ width: '100%' }}>
      <Tabs value={tabValue} onChange={handleTabChange} variant="fullWidth" sx={{ mb: 2 }}>
        <Tab 
          label={
            <Badge badgeContent={allNotifications.length} color="primary" max={99}>
              All
            </Badge>
          } 
        />
        <Tab 
          label={
            <Badge badgeContent={followNotifications.length} color="secondary" max={99}>
              Follows
            </Badge>
          } 
        />
        <Tab 
          label={
            <Badge badgeContent={likeNotifications.length} color="error" max={99}>
              Likes
            </Badge>
          } 
        />
        <Tab 
          label={
            <Badge badgeContent={commentNotifications.length} color="warning" max={99}>
              Comments
            </Badge>
          } 
        />
        <Tab 
          label={
            <Badge badgeContent={orderNotifications.length} color="success" max={99}>
              Orders
            </Badge>
          } 
        />
      </Tabs>

      {/* Tab Panels */}
      <Box sx={{ overflowY: 'auto', maxHeight: isMobile ? '60vh' : '300px' }}>
        {tabValue === 0 && (
          <div>
            {allNotifications.length === 0 ? (
              <p className="p-4 text-sm text-gray-600 text-center">
                No notifications
              </p>
            ) : (
              allNotifications.map((notification, index) => renderNotification(notification, index, 'all'))
            )}
          </div>
        )}
        {tabValue === 1 && (
          <div>
            {followNotifications.length === 0 ? (
              <p className="p-4 text-sm text-gray-600 text-center">
                No follow notifications
              </p>
            ) : (
              followNotifications.map((notification, index) => renderNotification(notification, index, 'follow'))
            )}
          </div>
        )}
        {tabValue === 2 && (
          <div>
            {likeNotifications.length === 0 ? (
              <p className="p-4 text-sm text-gray-600 text-center">
                No like notifications
              </p>
            ) : (
              likeNotifications.map((notification, index) => renderNotification(notification, index, 'like'))
            )}
          </div>
        )}
        {tabValue === 3 && (
          <div>
            {commentNotifications.length === 0 ? (
              <p className="p-4 text-sm text-gray-600 text-center">
                No comment notifications
              </p>
            ) : (
              commentNotifications.map((notification, index) => renderNotification(notification, index, 'comment'))
            )}
          </div>
        )}
        {tabValue === 4 && (
          <div>
            {orderNotifications.length === 0 ? (
              <p className="p-4 text-sm text-gray-600 text-center">
                No order notifications
              </p>
            ) : (
              orderNotifications.map((notification, index) => renderNotification(notification, index, 'order'))
            )}
          </div>
        )}
      </Box>
    </Box>
  );

  return (
    <nav className="flex md:flex-col relative items-center md:items-start gap-4 w-full border-r-1 h-full max-sm:border-hidden sm:p-4">
      <SidebarItem
        icon={<Home />}
        label="Home"
        sidebarHandler={sidebarHandler}
        active={!showFavorites}
      />
      <SidebarItem
        icon={<Bell />}
        label="Notifications"
        sidebarHandler={sidebarHandler}
      />
      <SidebarItem
        icon={<PlusSquare />}
        label="Post"
        sidebarHandler={sidebarHandler}
      />
      <SidebarItem
        icon={<Heart />}
        label="Favorites"
        sidebarHandler={sidebarHandler}
        active={showFavorites}
        badgeCount={user?.bookmarks?.length || 0}
      />
      <SidebarItem
        icon={<MessageCircle />}
        label="Messages"
        badgeCount={totalUnreadMessages}
        sidebarHandler={sidebarHandler}
      />
      {/* <SidebarItem
        icon={<ShoppingCart />}
        label="Cart"
        sidebarHandler={sidebarHandler}
      />
      <SidebarItem
        icon={<Receipt />}
        label="Orders"
        sidebarHandler={sidebarHandler}
      /> */}
      <SidebarItem
        icon={<User />}
        label="Profile"
        sidebarHandler={sidebarHandler}
      />
      
      {/* Delivery Dashboard Link */}
      <SidebarItem
        icon={<Truck />}
        label="Delivery"
        sidebarHandler={sidebarHandler}
      />
      
      {/* Only show Admin link to admin users */}
      {user?.isAdmin && (
        <SidebarItem
          icon={<Settings />}
          label="Admin"
          sidebarHandler={sidebarHandler}
          badgeCount="★"
        />
      )}
      
      <CreatePost open={openPost} setOpen={setOpenPost} />
      
      {/* Favorites Drawer - Only shown on mobile when Favorites is active */}
      {isMobile && showFavorites && (
        <SwipeableDrawer
          anchor="bottom"
          open={showFavorites}
          onClose={() => setShowFavorites(false)}
          onOpen={() => setShowFavorites(true)}
        >
          <Box sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Favorites
            </Typography>
            {favoritePosts.length > 0 ? (
              favoritePosts.map(post => (
                <Box 
                  key={post._id} 
                  sx={{ 
                    mb: 2, 
                    p: 2, 
                    borderRadius: 1, 
                    border: '1px solid #eee',
                    cursor: 'pointer'
                  }}
                  onClick={() => navigate(`/post/${post._id}`)}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <Avatar src={post.author?.profilePicture} sx={{ mr: 1, width: 32, height: 32 }} />
                    <Typography variant="subtitle2">{post.author?.username}</Typography>
                  </Box>
                  <Typography variant="body2" noWrap>{post.caption}</Typography>
                </Box>
              ))
            ) : (
              <Typography variant="body2">No favorites yet.</Typography>
            )}
          </Box>
        </SwipeableDrawer>
      )}
      
      {/* Order Details Modal */}
      <OrderDetailsModal
        open={orderModalOpen}
        onClose={() => {
          setOrderModalOpen(false);
          setSelectedOrderId(null);
          setSelectedOrderData(null);
        }}
        orderId={selectedOrderId}
        orderData={selectedOrderData}
      />
      
      {/* Pickup Order Details Modal */}
      <PickupOrderDetailsModal
        open={showPickupModal}
        onClose={() => {
          dispatch(clearPickupState());
          setSelectedOrderId(null);
          setSelectedOrderData(null);
        }}
      />
    </nav>
  );
};

// Custom tab panel for notification types
function TabPanel(props) {
  const { children, value, index, ...other } = props;
  const isMobile = useMediaQuery('(max-width:768px)');

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`notification-tabpanel-${index}`}
      aria-labelledby={`notification-tab-${index}`}
      className={value === index ? 'block' : 'hidden'}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 0, overflowY: 'auto', maxHeight: isMobile ? '60vh' : '300px' }}>
          {children}
        </Box>
      )}
    </div>
  );
}

const SidebarItem = ({ icon, label, badgeCount, sidebarHandler, active = false }) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const [tabValue, setTabValue] = useState(0);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [selectedOrderData, setSelectedOrderData] = useState(null);
  const isMobile = useMediaQuery('(max-width:768px)');
  const buttonRef = useRef(null);
  
  const { 
    notifications, 
    realtimeNotifications, 
    unseenCount,
    loading 
  } = useSelector((store) => store.realTimeNotification);
  
  const { showPickupModal } = useSelector((store) => store.pickup);
  
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const handleClick = (event) => {
    if (label === "Notifications") {
      // Toggle the notification panel state
      if (isMobile) {
        setIsDrawerOpen(!isDrawerOpen);
      } else {
        setAnchorEl(anchorEl ? null : event.currentTarget);
      }
      
      if (unseenCount > 0) {
        dispatch(markNotificationsSeen());
      }
      
      // Refresh notifications when opening the panel
      dispatch(fetchNotifications());
    } else {
      sidebarHandler(label);
    }
  };

  const handleClose = () => {
    setAnchorEl(null);
    setIsDrawerOpen(false);
  };

  const handleNotificationClick = (notification) => {
    console.log("🔔 Notification clicked:", notification);
    console.log("🔔 Notification type:", notification.type);
    console.log("🔔 Full notification object:", JSON.stringify(notification, null, 2));
    
    // Close the notifications popover
    setAnchorEl(null);
    
    // Mark notification as read if it has an ID
    if (notification._id) {
      dispatch(markNotificationRead(notification._id));
    }
    
    // Navigate based on notification type
    if (notification.type === 'like' || notification.type === 'comment') {
      // Handle both formats - older socket notifications vs database notifications
      const postId = notification.post || notification.postId;
      if (postId) {
        console.log(`Navigating to post: ${postId}`);
        
        // First navigate to the post
        navigate(`/post/${postId}`);
        
        // Close the drawer after a short delay to ensure navigation starts
        setTimeout(() => {
          handleClose();
        }, 300);
      } else {
        console.error("No post ID found in notification:", notification);
        toast.error("Could not find the referenced post");
      }
    } else if (notification.type === 'follow') {
      // Handle both formats
      const senderId = notification.sender?._id || notification.sender || notification.userId;
      if (senderId) {
        console.log(`Navigating to profile: ${senderId}`);
        
        // First navigate to the profile
        navigate(`/profile/${senderId}`);
        
        // Close the drawer after a short delay to ensure navigation starts
        setTimeout(() => {
          handleClose();
        }, 300);
      } else {
        console.error("No sender ID found in notification:", notification);
        toast.error("Could not find the referenced user");
      }
    } else if (notification.type === 'order') {
      console.log("🛒 Processing order notification...");
      
      // Handle order notifications - check if it's a pickup order
      // Handle both formats: object with _id or direct string ID
      const orderId = typeof notification.order === 'string' 
        ? notification.order 
        : notification.order?._id || notification.orderId;
      
      const deliveryMethod = typeof notification.order === 'object' 
        ? notification.order?.deliveryMethod 
        : undefined;
      
      // Log notification data to debug pickup detection
      console.log("🔍 Order notification received:", {
        notification,
        orderId,
        deliveryMethod,
        hasOrderObject: !!notification.order,
        orderKeys: notification.order ? Object.keys(notification.order) : [],
        orderType: typeof notification.order,
        messageContent: notification.message
      });
      
      // Multiple ways to detect pickup orders
      const isPickupOrder = deliveryMethod === 'pickup' || 
                           notification.message?.toLowerCase().includes('pickup') ||
                           notification.message?.toLowerCase().includes('self-pickup');
      
      console.log("🚗 Is pickup order?", isPickupOrder);
      console.log("🚗 Delivery method:", deliveryMethod);
      console.log("🚗 Message includes 'pickup':", notification.message?.toLowerCase().includes('pickup'));
      
      if (orderId) {
        console.log(`Opening ${isPickupOrder ? 'pickup' : 'regular'} order details for order: ${orderId}`);
        
        if (isPickupOrder) {
          // For pickup orders, use Redux pickup slice
          console.log("🚗 Setting up pickup modal with order data:", notification.order);
          
          // Add safety checks before dispatching
          if (orderId && typeof orderId === 'string') {
            console.log("🚗 Dispatching setSelectedOrderId:", orderId);
            dispatch(setSelectedOrderId(orderId));
          }
          
          // Only set current notification order if it's an object
          if (notification.order && typeof notification.order === 'object') {
            console.log("🚗 Dispatching setCurrentNotificationOrder:", notification.order);
            dispatch(setCurrentNotificationOrder(notification.order));
          }
          
          console.log("🚗 Dispatching setShowPickupModal(true)");
          dispatch(setShowPickupModal(true));
          
          // Always fetch full order details from the API
          console.log("🚗 Dispatching fetchOrderDetails:", orderId);
          dispatch(fetchOrderDetails(orderId));
          
          // Add the notification to pickup notifications
          console.log("🚗 Dispatching addPickupNotification");
          dispatch(addPickupNotification(notification));
          
          console.log("🚗 Pickup modal setup complete!");
        } else {
          // For regular orders or when delivery method is unclear
          console.log("📦 Setting up regular order modal or fetching details to determine type...");
          dispatch(setSelectedOrderId(orderId));
          dispatch(fetchOrderDetails(orderId)).then((result) => {
            console.log("Order fetch result:", result);
            if (result.payload && result.payload.deliveryMethod === 'pickup') {
              console.log("🚗 Order confirmed as pickup, opening pickup modal");
              dispatch(setCurrentNotificationOrder(result.payload));
              dispatch(setShowPickupModal(true));
              dispatch(addPickupNotification(notification));
            } else {
              console.log("📦 Order confirmed as regular delivery, opening regular modal");
              setSelectedOrderData(result.payload || notification.order);
        setOrderModalOpen(true);
            }
          }).catch((error) => {
            console.error("Failed to fetch order details:", error);
            // Fallback to regular modal
            setSelectedOrderData(typeof notification.order === 'object' ? notification.order : null);
            setOrderModalOpen(true);
          });
        }
      } else {
        console.error("No order ID found in notification:", notification);
        toast.error("Could not find the referenced order");
      }
    } else {
      console.warn("Unknown notification type:", notification.type);
      toast.warning("This notification type is not supported yet");
    }
  };

  const handleMarkAllRead = () => {
    dispatch(markAllNotificationsRead());
    handleClose(); // Close the popover after marking all as read
  };

  const open = Boolean(anchorEl);
  const id = open ? "notifications-popover" : undefined;

  // Function to render a single notification
  const renderNotification = (notification, index, context = '') => {
    let content = '';
    let icon = null;
    let timestamp = notification.createdAt ? moment(notification.createdAt).fromNow() : 'just now';
    
    // Format content based on notification type
    switch(notification.type) {
      case 'like':
        content = 'liked your post';
        icon = <Heart size={16} className="text-red-500" />;
        break;
      case 'comment':
        content = notification.message 
          ? `commented: "${notification.message.substring(0, 20)}${notification.message.length > 20 ? '...' : ''}"`
          : 'commented on your post';
        icon = <MessageCircle size={16} className="text-blue-500" />;
        break;
      case 'follow':
        content = 'started following you';
        icon = <User size={16} className="text-green-500" />;
        break;
      case 'message':
        // Message notifications should be handled in the conversations list
        // but include handling here for any that might still appear
        content = notification.message 
          ? notification.message.includes('sent you a message') 
            ? notification.message 
            : `sent you a message: "${notification.message.substring(0, 20)}${notification.message.length > 20 ? '...' : ''}"`
          : 'sent you a message';
        icon = <MessageCircle size={16} className="text-purple-500" />;
        break;
      case 'order':
        content = notification.message || 'placed an order from your post';
        icon = <ShoppingCart size={16} className="text-orange-500" />;
        break;
      default:
        content = notification.message || 'interacted with you';
        icon = <Bell size={16} className="text-gray-500" />;
    }
    
    // Get user information
    const username = notification.sender?.username || 
                     notification.userDetails?.username || 
                     'Unknown user';
    
    const profilePic = notification.sender?.profilePicture || 
                      notification.userDetails?.profilePicture;
    
    // Handle click with proper event handling
    const handleItemClick = (e) => {
      e.preventDefault();
      e.stopPropagation(); // Prevent event bubbling
      
      // Use setTimeout to ensure the click ripple effect completes
      setTimeout(() => {
        handleNotificationClick(notification);
      }, 150);
    };
    
    // Create unique key by combining notification ID, context, and index
    const uniqueKey = notification._id 
      ? `${context}-${notification._id}` 
      : `${context}-${notification.type}-${notification.sender?._id || 'unknown'}-${index}-${notification.createdAt || Date.now()}`;
    
    return (
      <div
        key={uniqueKey}
        className={`flex gap-3 items-start p-4 hover:bg-gray-100 active:bg-gray-200 cursor-pointer transition-colors duration-150 ${
          !notification.read ? 'bg-blue-50' : ''
        }`}
        onClick={handleItemClick}
        role="button"
        tabIndex={0}
      >
        <Avatar
          alt={username}
          src={profilePic}
          sx={{ width: 42, height: 42 }}
        />
        <div className="flex-1 min-w-0"> {/* prevent overflow */}
          <div className="flex flex-wrap items-center gap-1">
            <span className="font-bold text-sm mr-1">
              {username}
            </span>
            <span className="text-xs text-gray-700 flex items-center gap-1 flex-wrap">
              {icon} {content}
            </span>
          </div>
          {notification.message && notification.type !== 'comment' && (
            <p className="text-xs text-gray-600 mt-1 break-words">{notification.message}</p>
          )}
          <p className="text-xs text-gray-500 mt-1">
            {timestamp}
          </p>
        </div>
        {!notification.read && (
          <div className="flex-shrink-0">
            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
          </div>
        )}
      </div>
    );
  };

  // Remove duplicates and filter out message notifications
  const removeDuplicates = (notificationList) => {
    const uniqueMap = new Map();
    notificationList.forEach(notification => {
      const key = notification._id || `${notification.type}-${notification.sender?._id}-${notification.createdAt}`;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, notification);
      }
    });
    return Array.from(uniqueMap.values());
  };

  const allNotifications = removeDuplicates([
    ...(Array.isArray(notifications) ? notifications : []), 
    ...(Array.isArray(realtimeNotifications) ? realtimeNotifications : [])
  ])
  .filter(notification => notification.type !== 'message') // Filter out message notifications
  .sort((a, b) => new Date(b.createdAt || Date.now()) - new Date(a.createdAt || Date.now()));

  // Filter by type for the other tabs
  const followNotifications = allNotifications.filter(n => n.type === 'follow');
  const likeNotifications = allNotifications.filter(n => n.type === 'like');
  const commentNotifications = allNotifications.filter(n => n.type === 'comment');
  const orderNotifications = allNotifications.filter(n => n.type === 'order');

  // Notification tab panel content
  const NotificationTabsContent = () => (
    <Box sx={{ width: '100%' }}>
      <Tabs value={tabValue} onChange={handleTabChange} variant="fullWidth" sx={{ mb: 2 }}>
        <Tab 
          label={
            <Badge badgeContent={allNotifications.length} color="primary" max={99}>
              All
            </Badge>
          } 
        />
        <Tab 
          label={
            <Badge badgeContent={followNotifications.length} color="secondary" max={99}>
              Follows
            </Badge>
          } 
        />
        <Tab 
          label={
            <Badge badgeContent={likeNotifications.length} color="error" max={99}>
              Likes
            </Badge>
          } 
        />
        <Tab 
          label={
            <Badge badgeContent={commentNotifications.length} color="warning" max={99}>
              Comments
            </Badge>
          } 
        />
        <Tab 
          label={
            <Badge badgeContent={orderNotifications.length} color="success" max={99}>
              Orders
            </Badge>
          } 
        />
      </Tabs>

      {/* Tab Panels */}
      <Box sx={{ overflowY: 'auto', maxHeight: isMobile ? '60vh' : '300px' }}>
        {tabValue === 0 && (
          <div>
            {allNotifications.length === 0 ? (
              <p className="p-4 text-sm text-gray-600 text-center">
                No notifications
              </p>
            ) : (
              allNotifications.map((notification, index) => renderNotification(notification, index, 'all'))
            )}
          </div>
        )}
        {tabValue === 1 && (
          <div>
            {followNotifications.length === 0 ? (
              <p className="p-4 text-sm text-gray-600 text-center">
                No follow notifications
              </p>
            ) : (
              followNotifications.map((notification, index) => renderNotification(notification, index, 'follow'))
            )}
          </div>
        )}
        {tabValue === 2 && (
          <div>
            {likeNotifications.length === 0 ? (
              <p className="p-4 text-sm text-gray-600 text-center">
                No like notifications
              </p>
            ) : (
              likeNotifications.map((notification, index) => renderNotification(notification, index, 'like'))
            )}
          </div>
        )}
        {tabValue === 3 && (
          <div>
            {commentNotifications.length === 0 ? (
              <p className="p-4 text-sm text-gray-600 text-center">
                No comment notifications
              </p>
            ) : (
              commentNotifications.map((notification, index) => renderNotification(notification, index, 'comment'))
            )}
          </div>
        )}
        {tabValue === 4 && (
          <div>
            {orderNotifications.length === 0 ? (
              <p className="p-4 text-sm text-gray-600 text-center">
                No order notifications
              </p>
            ) : (
              orderNotifications.map((notification, index) => renderNotification(notification, index, 'order'))
            )}
          </div>
        )}
      </Box>
    </Box>
  );

  return (
    <>
    <div
      ref={buttonRef}
      onClick={(event) => {
        handleClick(event);
      }}
      className={`flex items-center justify-center md:justify-start gap-2 p-2 w-full hover:bg-orange-100 rounded-md cursor-pointer transition
        ${active ? "bg-orange-100 text-orange-500" : "hover:bg-gray-100 text-gray-600"}
      `}
    >
      {label === "Notifications" ? (
        <>
          <Badge
            badgeContent={unseenCount > 0 ? unseenCount : null}
            color="secondary"
            onClick={(e) => e.stopPropagation()} // Prevent parent div click from triggering twice
          >
            <div className="text-gray-700">{icon}</div>
          </Badge>

          {/* Desktop: Popover for notifications */}
          {!isMobile && (
            <Popover
              id={id}
              open={open}
              anchorEl={anchorEl}
              onClose={handleClose}
              anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
              transformOrigin={{ vertical: "top", horizontal: "left" }}
              PaperProps={{
                sx: { 
                  width: 320, 
                  maxHeight: 400,
                  transition: 'opacity 150ms cubic-bezier(0.4, 0, 0.2, 1) 0ms'
                },
                onClick: (e) => e.stopPropagation() // Prevent popover clicks from bubbling
              }}
              TransitionProps={{
                timeout: 250
              }}
              disableRestoreFocus
              onClick={(e) => e.stopPropagation()} // Stop event bubbling
            >
              <NotificationTabsContent />
            </Popover>
          )}

          {/* Mobile: Bottom drawer for notifications */}
          {isMobile && (
            <SwipeableDrawer
              anchor="bottom"
              open={isDrawerOpen}
              onClose={handleClose}
              onOpen={() => setIsDrawerOpen(true)}
              disableSwipeToOpen
              disableDiscovery={true}
              PaperProps={{
                sx: {
                  borderTopLeftRadius: 16,
                  borderTopRightRadius: 16,
                  maxHeight: '85vh',
                  overflowY: 'visible' // Allow content to handle its own scrolling
                },
                elevation: 8,
                onClick: (e) => e.stopPropagation() // Prevent clicks from closing the drawer
              }}
              hysteresis={0.3} // Require more swipe distance to close
              swipeAreaWidth={30} // Small swipe area at the top
              ModalProps={{
                keepMounted: true, // Better performance on mobile
              }}
            >
              <Box 
                sx={{ 
                  position: 'sticky', 
                  top: 0, 
                  zIndex: 2, 
                  backgroundColor: 'white', 
                  pb: 1, 
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}
              >
                {/* Visual indicator for swipe */}
                <div className="h-1 w-16 bg-gray-300 rounded-full mx-auto mt-2 mb-1"></div>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2 }}>
                  <Typography variant="h6">Notifications</Typography>
                  <IconButton 
                    onClick={handleClose} 
                    edge="end"
                    sx={{
                      bgcolor: 'rgba(0,0,0,0.05)',
                      '&:hover': {
                        bgcolor: 'rgba(0,0,0,0.1)',
                      }
                    }}
                  >
                    <X size={20} />
                  </IconButton>
                </Box>
                <Divider />
              </Box>
              <div className="p-0" onClick={(e) => e.stopPropagation()}>
                <NotificationTabsContent />
              </div>
            </SwipeableDrawer>
          )}

          <span className="text-gray-700 text-sm hidden lg:inline">
            {label}
          </span>
        </>
      ) : label === "Messages" ? (
        <>
          <Badge
            badgeContent={badgeCount > 0 ? badgeCount : null}
            color="primary"
            onClick={(e) => e.stopPropagation()} // Prevent parent div click from triggering twice
          >
            <div className="text-gray-700">{icon}</div>
          </Badge>
          <span className="text-gray-700 text-sm hidden lg:inline">
            {label}
          </span>
        </>
      ) : (
        <>
          <div className="text-gray-700">{icon}</div>
          <span className="text-gray-700 text-sm hidden lg:inline">
            {label}
          </span>
        </>
      )}
    </div>
      
      {/* Order Details Modal */}
      <OrderDetailsModal
        open={orderModalOpen}
        onClose={() => {
          setOrderModalOpen(false);
          setSelectedOrderId(null);
          setSelectedOrderData(null);
        }}
        orderId={selectedOrderId}
        orderData={selectedOrderData}
      />
      
      {/* Pickup Order Details Modal */}
      <PickupOrderDetailsModal
        open={showPickupModal}
        onClose={() => {
          dispatch(clearPickupState());
          setSelectedOrderId(null);
          setSelectedOrderData(null);
        }}
      />
    </>
  );
};

export default Leftsidebar;
