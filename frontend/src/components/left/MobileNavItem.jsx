import React, { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import CreatePost from "../post/CreatePost";
import { 
  Badge, 
  Box, 
  Tabs, 
  Tab, 
  Typography, 
  CircularProgress, 
  Avatar, 
  IconButton, 
  useMediaQuery,
  SwipeableDrawer
} from "@mui/material";
import moment from "moment";
import { Check, Bell, Heart, MessageCircle, User } from "lucide-react";
import { 
  markNotificationsSeen, 
  fetchNotifications, 
  markAllNotificationsRead, 
  markNotificationRead 
} from "../../redux/rtnSlice";
import { toast } from "react-toastify";

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

const MobileNavItem = ({ icon, label, path, isPostButton = false, badgeCount }) => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [openPost, setOpenPost] = useState(false);
  const [isNotificationDrawerOpen, setIsNotificationDrawerOpen] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  const buttonRef = useRef(null);
  const isMobile = useMediaQuery('(max-width:768px)');

  // Get notification data from Redux store
  const { 
    notifications, 
    realtimeNotifications, 
    unseenCount,
    loading 
  } = useSelector((store) => store.realTimeNotification);

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const handleClick = () => {
    if (isPostButton) {
      setOpenPost(true);
    } else if (label === "Notifications") {
      // Toggle notification drawer
      setIsNotificationDrawerOpen(!isNotificationDrawerOpen);
      
      if (unseenCount > 0) {
        dispatch(markNotificationsSeen());
      }
      
      // Refresh notifications when opening the panel
      dispatch(fetchNotifications());
    } else {
      navigate(path);
    }
  };

  const handleClose = () => {
    setIsNotificationDrawerOpen(false);
  };

  const handleMarkAllRead = () => {
    dispatch(markAllNotificationsRead());
    handleClose(); // Close the drawer after marking all as read
  };

  const handleNotificationClick = (notification) => {
    // If notification has an _id, mark it as read
    if (notification._id && !notification.read) {
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
    } else {
      console.warn("Unknown notification type:", notification.type);
      toast.warning("This notification type is not supported yet");
    }
  };

  // Function to render a single notification
  const renderNotification = (notification, index) => {
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
        content = notification.message 
          ? notification.message.includes('sent you a message') 
            ? notification.message 
            : `sent you a message: "${notification.message.substring(0, 20)}${notification.message.length > 20 ? '...' : ''}"`
          : 'sent you a message';
        icon = <MessageCircle size={16} className="text-purple-500" />;
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
    
    return (
      <div
        key={notification._id ? notification._id : `notification-${index}`}
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

  // Filter out message notifications from the allNotifications array
  const allNotifications = [
    ...(Array.isArray(notifications) ? notifications : []), 
    ...(Array.isArray(realtimeNotifications) ? realtimeNotifications : [])
  ]
  .filter(notification => notification.type !== 'message') // Filter out message notifications
  .sort((a, b) => new Date(b.createdAt || Date.now()) - new Date(a.createdAt || Date.now()));

  // Filter by type for the other tabs
  const followNotifications = allNotifications.filter(n => n.type === 'follow');
  const likeNotifications = allNotifications.filter(n => n.type === 'like');
  const commentNotifications = allNotifications.filter(n => n.type === 'comment');

  // Notification tab panel content
  const NotificationTabsContent = () => (
    <>
      <Box sx={{ borderBottom: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 2, py: 1, bgcolor: 'white', position: 'sticky', top: 0, zIndex: 1 }}>
        <Tabs 
          value={tabValue} 
          onChange={handleTabChange} 
          variant="scrollable"
          scrollButtons="auto"
          aria-label="notification tabs"
        >
          <Tab label="All" />
          <Tab label="Follows" />
          <Tab label="Likes" />
          <Tab label="Comments" />
        </Tabs>
        <IconButton 
          size="small" 
          onClick={(e) => {
            e.stopPropagation(); // Prevent bubbling
            handleMarkAllRead();
          }} 
          title="Mark all as read"
          color="primary"
          className="hover:bg-blue-100"
        >
          <Check size={16} />
        </IconButton>
      </Box>
      
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
          <CircularProgress size={24} />
        </Box>
      ) : (
        <>
          <TabPanel value={tabValue} index={0}>
            {allNotifications.length === 0 ? (
              <p className="p-4 text-sm text-gray-600 text-center">
                No notifications
              </p>
            ) : (
              allNotifications.map((notification, index) => renderNotification(notification, `all-${index}`))
            )}
          </TabPanel>
          
          <TabPanel value={tabValue} index={1}>
            {followNotifications.length === 0 ? (
              <p className="p-4 text-sm text-gray-600 text-center">
                No follow notifications
              </p>
            ) : (
              followNotifications.map((notification, index) => renderNotification(notification, `follow-${index}`))
            )}
          </TabPanel>
          
          <TabPanel value={tabValue} index={2}>
            {likeNotifications.length === 0 ? (
              <p className="p-4 text-sm text-gray-600 text-center">
                No like notifications
              </p>
            ) : (
              likeNotifications.map((notification, index) => renderNotification(notification, `like-${index}`))
            )}
          </TabPanel>
          
          <TabPanel value={tabValue} index={3}>
            {commentNotifications.length === 0 ? (
              <p className="p-4 text-sm text-gray-600 text-center">
                No comment notifications
              </p>
            ) : (
              commentNotifications.map((notification, index) => renderNotification(notification, `comment-${index}`))
            )}
          </TabPanel>
        </>
      )}
    </>
  );

  return (
    <>
      <button
        ref={buttonRef}
        onClick={handleClick}
        className="flex flex-col items-center justify-center p-2 text-gray-600 hover:text-primary-600 focus:outline-none relative"
      >
        {label === "Notifications" ? (
          <Badge
            badgeContent={unseenCount > 0 ? unseenCount : null}
            color="secondary"
          >
            <div className="text-gray-700">{icon}</div>
          </Badge>
        ) : (
          <>
            {badgeCount > 0 && (
              <span className="absolute top-0 right-0 -mt-1 -mr-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                {badgeCount > 99 ? "99+" : badgeCount}
              </span>
            )}
            {icon}
          </>
        )}
        <span className="text-xs mt-1">{label}</span>
      </button>

      {isPostButton && (
        <CreatePost open={openPost} setOpen={setOpenPost} />
      )}

      {/* Mobile: Bottom drawer for notifications */}
      {label === "Notifications" && (
        <SwipeableDrawer
          anchor="bottom"
          open={isNotificationDrawerOpen}
          onClose={handleClose}
          onOpen={() => setIsNotificationDrawerOpen(true)}
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
              bgcolor: 'background.paper',
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              pt: 1
            }}
          >
            <Box 
              sx={{ 
                width: 40, 
                height: 5, 
                bgcolor: 'grey.300', 
                borderRadius: 5, 
                mx: 'auto', 
                mb: 1 
              }} 
            />
            <Typography variant="h6" sx={{ px: 2, pb: 1, fontSize: '1.1rem' }}>
              Notifications
            </Typography>
          </Box>
          
          <NotificationTabsContent />
        </SwipeableDrawer>
      )}
    </>
  );
};

export default MobileNavItem;
