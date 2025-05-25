import React, { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import axios from "axios";
import { toast } from "react-toastify";
import {
  Box,
  CircularProgress,
  Paper,
  Typography,
  Button,
  Avatar,
  Divider,
  Chip,
  IconButton,
  Card,
  CardMedia,
  CardContent,
} from "@mui/material";
import { ArrowLeft, Share2, Clock, MapPin, AlertCircle, ExternalLink, Star, ShoppingBag, Smartphone } from "lucide-react";
import PostCard from "../post/PostCard";
import ShareDialog from "./ShareDialog";
import useDeviceDetect from "../../hooks/useDeviceDetect";

// API base URL from environment or default to localhost
const API_BASE_URL =
  import.meta.env.VITE_API_URL || "https://socialfooddelivery-2.onrender.com";

const SharedPost = () => {
  const { shareId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [share, setShare] = useState(null);
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [attemptedDeepLink, setAttemptedDeepLink] = useState(false);
  const { user } = useSelector((state) => state.auth);
  const device = useDeviceDetect();

  // Function to handle deep link redirection
  const handleDeepLinkRedirect = (deepLink) => {
    if (!deepLink || attemptedDeepLink) return;
    
    setAttemptedDeepLink(true);
    
    // Only attempt deep linking on mobile devices that support it
    if (device.supportsDeepLinks && (device.isMobile || device.isTablet)) {
      // Create an iframe (hidden) to try to trigger the app
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = deepLink;
      document.body.appendChild(iframe);
      
      // Set a timeout to remove the iframe
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 2000);
      
      // After a delay, check if we need to show an app store prompt
      // This is a simplified approach - ideally you'd detect if the app opened
      setTimeout(() => {
        // If the user is still here after trying to open the app, show app install prompt
        const showAppPrompt = document.getElementById('app-install-prompt');
        if (showAppPrompt) {
          showAppPrompt.style.display = 'block';
        }
      }, 3000);
    }
  };

  // Handle direct navigation to post
  const handleViewPost = () => {
    if (post && post._id) {
      navigate(`/post/${post._id}`);
    }
  };

  // Open share dialog
  const handleSharePost = () => {
    setShowShareDialog(true);
  };

  // Track share analytics
  const trackShareAnalytics = async (shareId, action) => {
    try {
      await axios.post(
        `${API_BASE_URL}/api/v1/analytics/record`,
        {
          type: 'share_interaction',
          shareId,
          action,
          deviceType: device.isMobile ? 'mobile' : device.isTablet ? 'tablet' : 'desktop',
          referrer: document.referrer || 'direct'
        },
        { withCredentials: true }
      );
    } catch (error) {
      console.error('Error recording share analytics:', error);
      // Continue even if analytics fails
    }
  };

  useEffect(() => {
    const fetchSharedPost = async () => {
      if (!shareId) {
        setError("Share ID is missing");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        // Fetch share data
        const response = await axios.get(
          `${API_BASE_URL}/api/v1/share/${shareId}`,
          { withCredentials: true }
        );

        if (response.data.success) {
          const shareData = response.data.share;
          setShare(shareData);
          setPost(shareData.post);

          // Try to redirect to the app via deep link if available
          if (shareData.deepLink) {
            handleDeepLinkRedirect(shareData.deepLink);
          }

          // Update meta tags for better sharing experience
          if (shareData.post) {
            const postData = shareData.post;
            
            // Use rich content if available, otherwise fallback to post data
            const title = shareData.richContent?.title || `${postData.caption} | Food App`;
            const description = shareData.richContent?.description || 
              `${postData.category} dish${postData.vegetarian ? " (Vegetarian)" : ""} shared by ${
                postData.author?.username || "a user"
              }${postData.price ? ` - ₹${postData.price}` : ""}${
                postData.rating?.average ? ` - ${postData.rating.average.toFixed(1)}★` : ""
              }`;
            const image = shareData.richContent?.imageUrl || postData.image;
            const url = window.location.href;

            // Use the global function defined in index.html
            if (window.updateMetaTags) {
              window.updateMetaTags(title, description, image, url);
            }

            // Also update document title
            document.title = title;
          }

          // Mark share as viewed if user is logged in
          if (user) {
            try {
              await axios.put(
                `${API_BASE_URL}/api/v1/share/${shareId}/view`,
                {},
                { withCredentials: true }
              );
              
              // Record analytics for view
              trackShareAnalytics(shareId, 'view');
            } catch (viewError) {
              console.error("Error marking share as viewed:", viewError);
              // Continue even if marking viewed fails
            }
          }
        } else {
          setError(response.data.message || "Error fetching shared post");
        }
      } catch (err) {
        console.error("Error fetching shared post:", err);

        // Extract error message from response if available
        let errorMessage = "Error fetching shared post";

        if (err.response) {
          errorMessage = err.response.data?.message || errorMessage;

          // If it's an expired share
          if (err.response.status === 410) {
            errorMessage = "This shared post has expired";
          }
          // If share not found
          else if (err.response.status === 404) {
            errorMessage =
              "This shared post does not exist or has been removed";
          }
        } else if (err.request) {
          errorMessage = "Unable to connect to server";
        }

        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    fetchSharedPost();

    // Cleanup function to reset meta tags and title
    return () => {
      if (window.updateMetaTags) {
        window.updateMetaTags(
          "Social Food Delivery System",
          "Discover and share delicious food from local vendors. Order, rate and connect with food lovers in your area!",
          "/og-image.jpg",
          window.location.origin
        );
      }
      document.title = "Social Food Delivery System";
    };
  }, [shareId, user, dispatch, attemptedDeepLink]);

  // Handle user not logged in
  const handleLoginRedirect = () => {
    navigate("/login", { state: { from: location.pathname } });
  };

  return (
    <div className="max-w-4xl mx-auto py-6 px-4">
      {/* App install prompt (hidden by default) */}
      <div id="app-install-prompt" className="mb-4 hidden">
        <Paper elevation={2} className="p-4 bg-blue-50 rounded-lg">
          <div className="flex items-center gap-2">
            <Smartphone size={20} className="text-blue-600" />
            <Typography variant="subtitle2" className="text-blue-700">
              For a better experience, open this in our app
            </Typography>
          </div>
          <div className="mt-2 flex gap-2">
            <Button 
              variant="contained" 
              size="small" 
              className="bg-blue-600"
              onClick={() => window.open('https://play.google.com/store/apps/details?id=com.socialfooddelivery', '_blank')}
            >
              Download App
            </Button>
            <Button 
              variant="outlined" 
              size="small" 
              className="text-blue-600 border-blue-600"
              onClick={() => {
                const prompt = document.getElementById('app-install-prompt');
                if (prompt) prompt.style.display = 'none';
              }}
            >
              Continue on Web
            </Button>
          </div>
        </Paper>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Button
            startIcon={<ArrowLeft size={18} />}
            onClick={() => navigate(-1)}
            variant="text"
          >
            Go Back
          </Button>
          <h1 className="text-xl font-semibold ml-2 hidden sm:block">Shared Post</h1>
        </div>
        
        {post && (
          <div className="flex gap-2">
            <Button 
              variant="outlined" 
              startIcon={<ExternalLink size={16} />}
              onClick={handleViewPost}
              size={device.isMobile ? "small" : "medium"}
            >
              {device.isMobile ? "View" : "View Post"}
            </Button>
            <Button 
              variant="contained" 
              startIcon={<Share2 size={16} />}
              onClick={handleSharePost}
              size={device.isMobile ? "small" : "medium"}
            >
              {device.isMobile ? "Share" : "Share Post"}
            </Button>
          </div>
        )}
      </div>

      {loading ? (
        <Box className="flex justify-center py-8">
          <CircularProgress />
        </Box>
      ) : error ? (
        <Paper elevation={2} className="p-6 bg-red-50 text-red-600 rounded-md">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle size={24} />
            <Typography variant="h6">{error}</Typography>
          </div>
          <Typography variant="body2" className="mb-4">
            The post you're trying to access may have been removed or the link has expired.
          </Typography>
          <Button
            variant="contained"
            color="primary"
            onClick={() => navigate("/")}
            className="mt-2"
          >
            Go to Homepage
          </Button>
        </Paper>
      ) : post ? (
        <>
          {/* Share information */}
          {share && (
            <Paper elevation={1} className="p-4 mb-4 rounded-lg">
              <div className="flex items-center gap-3">
                <Avatar
                  src={share.sharedBy?.profilePicture}
                  alt={share.sharedBy?.username}
                  sx={{ width: 48, height: 48 }}
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <Typography variant="subtitle1" className="font-medium">
                      Shared by {share.sharedBy?.username}
                    </Typography>
                    <Chip 
                      size="small" 
                      icon={<Clock size={14} />} 
                      label={new Date(share.createdAt).toLocaleDateString()} 
                      variant="outlined"
                      className="text-xs"
                    />
                  </div>
                  <Typography variant="caption" color="textSecondary">
                    via {share.externalPlatform ? share.externalPlatform.charAt(0).toUpperCase() + share.externalPlatform.slice(1) : 'App'}
                  </Typography>
                </div>
              </div>

              {share.message && (
                <Typography
                  variant="body2"
                  className="mt-3 p-3 bg-gray-50 rounded-lg italic"
                >
                  "{share.message}"
                </Typography>
              )}
              
              {/* Display additional metadata if available */}
              {share.richContent && share.richContent.metadata && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {Object.entries(share.richContent.metadata).map(([key, value]) => (
                    <Chip 
                      key={key}
                      size="small"
                      label={`${key}: ${value}`}
                      className="text-xs bg-gray-100"
                    />
                  ))}
                </div>
              )}
            </Paper>
          )}

          {/* Enhanced Post Display */}
          <div className="mb-4">
            <Card elevation={2} className="overflow-hidden rounded-lg">
              {/* Post Media */}
              <div className="relative">
                {post.video ? (
                  <CardMedia
                    component="video"
                    src={post.video}
                    controls
                    className="w-full h-64 sm:h-80 object-cover"
                    poster={post.image || undefined}
                  />
                ) : post.image ? (
                  <CardMedia
                    component="img"
                    src={post.image}
                    alt={post.caption}
                    className="w-full h-64 sm:h-80 object-cover"
                  />
                ) : (
                  <div className="w-full h-64 sm:h-80 bg-gray-100 flex items-center justify-center">
                    <Typography variant="subtitle1" color="textSecondary">
                      No media available
                    </Typography>
                  </div>
                )}
                
                {/* Price Badge */}
                {post.price && (
                  <Chip
                    label={`₹${post.price}`}
                    color="primary"
                    className="absolute top-3 right-3 font-bold"
                  />
                )}
              </div>
              
              <CardContent>
                {/* Post Caption and Details */}
                <Typography variant="h6" className="mb-2">
                  {post.caption}
                </Typography>
                
                <div className="flex flex-wrap gap-2 mb-3">
                  {post.category && (
                    <Chip size="small" label={post.category} className="bg-gray-100" />
                  )}
                  {post.vegetarian !== undefined && (
                    <Chip 
                      size="small" 
                      label={post.vegetarian ? "Vegetarian" : "Non-Vegetarian"}
                      className={post.vegetarian ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}
                    />
                  )}
                  {post.rating?.average && (
                    <Chip 
                      size="small" 
                      icon={<Star size={14} />}
                      label={post.rating.average.toFixed(1)}
                      className="bg-amber-100 text-amber-800"
                    />
                  )}
                </div>
                
                {post.description && (
                  <Typography variant="body2" color="textSecondary" className="mb-3">
                    {post.description}
                  </Typography>
                )}
                
                {/* Action Buttons */}
                <div className="flex gap-2 mt-4">
                  <Button 
                    variant="contained" 
                    color="primary"
                    startIcon={<ShoppingBag size={16} />}
                    onClick={() => user ? handleViewPost() : handleLoginRedirect()}
                    fullWidth
                  >
                    {user ? "Order Now" : "Sign In to Order"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Standard PostCard as fallback if needed */}
          {/* <PostCard post={post} hideOptions={!user} /> */}

          {/* Login CTA if user is not logged in */}
          {!user && (
            <Paper
              elevation={1}
              className="p-4 mt-4 border border-gray-200 rounded-lg bg-gray-50"
            >
              <Typography variant="subtitle1" gutterBottom className="font-medium">
                Sign in to interact with this post
              </Typography>
              <Typography variant="body2" color="textSecondary" className="mb-3">
                Create an account or log in to like, comment, save or order from
                this post.
              </Typography>
              <div className="flex gap-2">
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleLoginRedirect}
                >
                  Sign In
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => navigate("/signup")}
                >
                  Create Account
                </Button>
              </div>
            </Paper>
          )}
        </>
      ) : null}
      
      {/* Share Dialog */}
      {post && (
        <ShareDialog
          open={showShareDialog}
          onClose={() => setShowShareDialog(false)}
          post={post}
          onShareSuccess={() => {
            toast.success("Post shared successfully!");
            trackShareAnalytics(shareId, 'reshare');
          }}
        />
      )}
    </div>
  );
};

export default SharedPost;
