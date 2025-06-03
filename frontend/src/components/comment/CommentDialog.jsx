import React, { useEffect, useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  Button,
  Avatar,
  Menu,
  MenuItem,
  IconButton,
  CircularProgress,
  Tooltip,
  useMediaQuery,
  DialogTitle,
  DialogActions,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { Link, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import Comment from "./Comment";
import axiosInstance from "../../utils/axiosInstance";
import { getApiUrl } from "../../utils/apiConfig";
import { setPosts } from "../../redux/postSlice";
import { FiSend, FiX, FiMoreVertical, FiHeart, FiShare, FiRefreshCw } from "react-icons/fi";
import { toast } from "react-toastify";
import { SafeMath } from '../../utils/bigintPolyfill';

// Mobile-optimized API service for comments
const CommentAPI = {
  // Fetch comments with retry mechanism
  async fetchComments(postId, page = 1, limit = 20) {
    const maxRetries = 3;
    let lastError = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[CommentAPI] Fetching comments for post ${postId}, page ${page}, attempt ${attempt}/${maxRetries}`);
        
        const response = await axiosInstance.get(
          `/post/${postId}/comments`,
          {
            params: { page, limit },
            timeout: 15000, // 15 second timeout for mobile
            // Mobile-specific headers
            headers: {
              'X-Client-Platform': navigator.userAgent.includes('Mobile') ? 'mobile' : 'desktop',
              'X-Request-Source': 'comment-dialog'
            }
          }
        );
        
        if (response.data?.success) {
          console.log(`[CommentAPI] Successfully fetched ${response.data.comments?.length || 0} comments`);
          return {
            success: true,
            comments: response.data.comments || [],
            hasMore: response.data.hasMore !== false && (response.data.comments?.length || 0) === limit
          };
        } else {
          throw new Error(response.data?.message || 'Invalid response format');
        }
        
      } catch (error) {
        lastError = error;
        
        console.warn(`[CommentAPI] Attempt ${attempt}/${maxRetries} failed:`, {
          message: error.message,
          status: error.response?.status,
          code: error.code
        });
        
        // Don't retry on authentication errors
        if (error.response?.status === 401 || error.response?.status === 403) {
          console.error('[CommentAPI] Authentication error - not retrying');
          break;
        }
        
        // Don't retry on client errors (400-499 except 408, 429)
        if (error.response?.status >= 400 && error.response?.status < 500 && 
            error.response?.status !== 408 && error.response?.status !== 429) {
          console.error('[CommentAPI] Client error - not retrying');
          break;
        }
        
        // Wait before retry (exponential backoff)
        if (attempt < maxRetries) {
          const delay = SafeMath.min(1000 * SafeMath.pow(2, attempt - 1), 5000);
          console.log(`[CommentAPI] Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    // All retries failed
    console.error('[CommentAPI] All retry attempts failed:', lastError);
    return {
      success: false,
      error: lastError?.message || 'Failed to fetch comments',
      details: lastError
    };
  },

  // Send comment with retry mechanism
  async sendComment(postId, text, parentId = null) {
    const maxRetries = 2; // Fewer retries for write operations
    let lastError = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[CommentAPI] Sending comment to post ${postId}, attempt ${attempt}/${maxRetries}`);
        
        const response = await axiosInstance.post(
          `/post/${postId}/comment`,
          { 
            text: text.trim(), 
            parentId 
          },
          {
            timeout: 10000, // 10 second timeout for write operations
            headers: {
              'X-Client-Platform': navigator.userAgent.includes('Mobile') ? 'mobile' : 'desktop',
              'X-Request-Source': 'comment-dialog'
            }
          }
        );
        
        if (response.data?.success) {
          console.log('[CommentAPI] Comment sent successfully');
          return {
            success: true,
            comment: response.data.comment
          };
        } else {
          throw new Error(response.data?.message || 'Invalid response format');
        }
        
      } catch (error) {
        lastError = error;
        
        console.warn(`[CommentAPI] Send attempt ${attempt}/${maxRetries} failed:`, {
          message: error.message,
          status: error.response?.status,
          code: error.code
        });
        
        // Don't retry on authentication or validation errors
        if (error.response?.status === 401 || error.response?.status === 403 || error.response?.status === 400) {
          console.error('[CommentAPI] Client error - not retrying');
          break;
        }
        
        // Wait before retry
        if (attempt < maxRetries) {
          const delay = 1000; // 1 second delay for send retries
          console.log(`[CommentAPI] Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    // All retries failed
    console.error('[CommentAPI] Failed to send comment:', lastError);
    return {
      success: false,
      error: lastError?.message || 'Failed to send comment',
      details: lastError
    };
  }
};

const CommentDialog = ({ open, setOpen, post }) => {
  const [text, setText] = useState("");
  const [parentId, setParentId] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [comments, setComments] = useState([]);
  const [anchorEl, setAnchorEl] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMoreComments, setHasMoreComments] = useState(true);
  const [page, setPage] = useState(1);
  const [error, setError] = useState(null);
  const [isRetrying, setIsRetrying] = useState(false);
  
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { selectedPost, posts } = useSelector((store) => store.post);
  const { user } = useSelector((store) => store.auth);
  const inputRef = useRef(null);
  const commentsEndRef = useRef(null);
  const commentsContainerRef = useRef(null);
  
  // For responsive design
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.between('sm', 'md'));
  
  const openMenu = Boolean(anchorEl);

  // Fetch comments when dialog opens
  useEffect(() => {
    if (open && selectedPost?._id) {
      fetchComments();
    } else {
      // Reset state when dialog closes
      setComments([]);
      setPage(1);
      setHasMoreComments(true);
      setError(null);
    }
  }, [open, selectedPost?._id]);
  
  // Scroll to bottom when new comment is added
  useEffect(() => {
    if (commentsEndRef.current && comments.length > 0) {
      commentsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [comments.length]);
  
  // Focus input when replying to someone
  useEffect(() => {
    if (replyingTo && inputRef.current) {
      inputRef.current.focus();
    }
  }, [replyingTo]);
  
  const fetchComments = async (loadMore = false) => {
    if (!selectedPost?._id) return;
    
    try {
      setError(null);
      setIsLoading(loadMore ? false : true);
      setLoadingMore(loadMore);
      
      const currentPage = loadMore ? page + 1 : 1;
      
      console.log(`[CommentDialog] Fetching comments for post ${selectedPost._id}, page ${currentPage}`);
      
      const result = await CommentAPI.fetchComments(selectedPost._id, currentPage, 20);
      
      if (result.success) {
        const newComments = result.comments || [];
        
        if (loadMore) {
          setComments(prev => [...prev, ...newComments]);
          setPage(currentPage);
        } else {
          setComments(newComments);
          setPage(1);
        }
        
        setHasMoreComments(result.hasMore);
        
        console.log(`[CommentDialog] Successfully loaded ${newComments.length} comments`);
        
        // Show success toast only for retry scenarios
        if (isRetrying) {
          toast.success("Comments loaded successfully");
          setIsRetrying(false);
        }
        
      } else {
        throw new Error(result.error || 'Failed to fetch comments');
      }
      
    } catch (error) {
      console.error("[CommentDialog] Error fetching comments:", error);
      setError(error.message || "Failed to load comments");
      
      // Show user-friendly error message
      if (error.message?.includes('Network Error') || error.code === 'ECONNABORTED') {
        toast.error("Network connection issue. Please check your internet and try again.");
      } else if (error.response?.status === 401) {
        toast.error("Please log in to view comments");
      } else {
        toast.error("Failed to load comments. Tap retry to try again.");
      }
      
    } finally {
      setIsLoading(false);
      setLoadingMore(false);
    }
  };
  
  // Handle scroll to load more comments
  const handleScroll = () => {
    if (!commentsContainerRef.current || loadingMore || !hasMoreComments || error) return;
    
    const { scrollTop, scrollHeight, clientHeight } = commentsContainerRef.current;
    const scrollPosition = scrollTop + clientHeight;
    
    // If scrolled to 80% of the container height, load more comments
    if (scrollPosition > scrollHeight * 0.8) {
      fetchComments(true);
    }
  };

  const changeEventHandler = (e) => {
    setText(e.target.value);
  };

  const handleCloseDialog = () => {
    setText("");
    setParentId(null);
    setReplyingTo(null);
    setError(null);
    setOpen(false);
  };

  const handleMenuClick = (event) => setAnchorEl(event.currentTarget);
  const handleMenuClose = () => setAnchorEl(null);

  // Handle replying to a comment
  const handleReply = (comment) => {
    setParentId(comment._id);
    setReplyingTo(comment.author.username);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };
  
  // Cancel reply
  const cancelReply = () => {
    setParentId(null);
    setReplyingTo(null);
  };

  // Retry loading comments
  const handleRetry = () => {
    setIsRetrying(true);
    fetchComments();
  };
  
  // Send a comment
  const sendMessageHandler = async () => {
    if (!text.trim() || isSending) return;
    
    try {
      setIsSending(true);
      setError(null);
      
      console.log(`[CommentDialog] Sending comment to post ${selectedPost._id}`);
      
      const result = await CommentAPI.sendComment(selectedPost._id, text, parentId);
      
      if (result.success) {
        const newComment = result.comment;
        const updatedComments = [...comments, newComment];

        setComments(updatedComments);
        setText("");
        setParentId(null);
        setReplyingTo(null);

        // Update Redux state
        const updatedPostData = posts.map((p) =>
          p._id === selectedPost._id ? { ...p, comments: updatedComments } : p
        );
        dispatch(setPosts(updatedPostData));
        
        console.log('[CommentDialog] Comment sent and UI updated');
        
        // Scroll to the new comment
        setTimeout(() => {
          if (commentsEndRef.current) {
            commentsEndRef.current.scrollIntoView({ behavior: 'smooth' });
          }
        }, 100);
        
        // Show success feedback
        toast.success("Comment posted!");
        
      } else {
        throw new Error(result.error || 'Failed to send comment');
      }
      
    } catch (error) {
      console.error("[CommentDialog] Error sending comment:", error);
      
      // Show user-friendly error message
      if (error.message?.includes('Network Error') || error.code === 'ECONNABORTED') {
        toast.error("Network issue. Please check your connection and try again.");
      } else if (error.response?.status === 401) {
        toast.error("Please log in to post comments");
      } else if (error.response?.status === 400) {
        toast.error("Please enter a valid comment");
      } else {
        toast.error("Failed to post comment. Please try again.");
      }
      
    } finally {
      setIsSending(false);
    }
  };

  // Handle Enter key for sending comments
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessageHandler();
    }
  };

  // Render error state
  const renderErrorState = () => (
    <div className="flex flex-col items-center justify-center h-full text-center py-8 px-4">
      <div className="text-red-500 mb-4">
        <FiX size={48} />
      </div>
      <p className="text-gray-600 mb-2 font-medium">Failed to load comments</p>
      <p className="text-sm text-gray-500 mb-4">{error}</p>
      <Button
        variant="outlined"
        onClick={handleRetry}
        disabled={isRetrying}
        startIcon={isRetrying ? <CircularProgress size={16} /> : <FiRefreshCw />}
        className="text-blue-500 border-blue-500 hover:bg-blue-50"
      >
        {isRetrying ? 'Retrying...' : 'Try Again'}
      </Button>
    </div>
  );

  // Render loading state
  const renderLoadingState = () => (
    <div className="flex justify-center items-center h-full">
      <div className="text-center">
        <CircularProgress size={32} className="mb-2" />
        <p className="text-sm text-gray-500">Loading comments...</p>
      </div>
    </div>
  );

  // Render empty state
  const renderEmptyState = () => (
    <div className="flex flex-col items-center justify-center h-full text-center py-8">
      <p className="text-gray-500 mb-2">No comments yet.</p>
      <p className="text-sm text-gray-400">Be the first to leave a comment!</p>
    </div>
  );

  return (
    <Dialog
      open={open}
      onClose={handleCloseDialog}
      fullWidth
      maxWidth="md"
      closeAfterTransition
      disableRestoreFocus
      className="comment-dialog"
      PaperProps={{
        sx: {
          borderRadius: '12px',
          height: isMobile ? '100%' : 'auto',
          maxHeight: isMobile ? '100%' : '90vh',
          margin: isMobile ? '0' : undefined,
          width: isMobile ? '100%' : undefined,
          overflowY: 'hidden',
        },
      }}
    >
      {isMobile && (
        <DialogTitle className="flex justify-between items-center py-2 px-3 border-b">
          <span className="font-medium">Comments</span>
          <IconButton onClick={handleCloseDialog} edge="end" size="small">
            <FiX />
          </IconButton>
        </DialogTitle>
      )}
      
      <DialogContent className="p-0">
        <div className={`flex ${isMobile ? 'flex-col' : 'h-[80vh]'}`}>
          {/* Media section - full width on mobile, half width on desktop */}
          {!isMobile && (
            <div className="w-1/2 bg-gray-100 flex items-center justify-center">
              {post?.mediaType === "video" ? (
                <video
                  src={post?.video}
                  controls
                  autoPlay
                  loop
                  className="w-full h-full object-cover"
                />
              ) : (
                <img
                  src={post?.image}
                  alt="Post"
                  className="w-full h-full object-cover"
                />
              )}
            </div>
          )}

          {/* Content section */}
          <div className={`${isMobile ? 'w-full' : 'w-1/2'} flex flex-col h-full`}>
            {/* Header with user info */}
            <div className="flex justify-between items-center p-3 border-b">
              <div className="flex items-center gap-2">
                <Link to={`/profile/${selectedPost?.author?._id}`}>
                  <Avatar
                    src={selectedPost?.author?.profilePicture}
                    alt={selectedPost?.author?.username}
                    sx={{ width: 36, height: 36 }}
                  />
                </Link>
                <div>
                  <span
                    onClick={() => navigate(`/profile/${selectedPost?.author?._id}`)}
                    className="cursor-pointer font-semibold text-sm block"
                  >
                    {selectedPost?.author?.username}
                  </span>
                  <span className="text-xs text-gray-500">
                    {selectedPost?.caption?.length > 25 
                      ? `${selectedPost?.caption?.substring(0, 25)}...` 
                      : selectedPost?.caption}
                  </span>
                </div>
              </div>
              <div>
                <IconButton onClick={handleMenuClick} size="small">
                  <FiMoreVertical />
                </IconButton>
                <Menu
                  anchorEl={anchorEl}
                  open={openMenu}
                  onClose={handleMenuClose}
                >
                  <MenuItem onClick={handleMenuClose}>Unfollow</MenuItem>
                  <MenuItem onClick={handleMenuClose}>
                    Add to Favorites
                  </MenuItem>
                </Menu>
              </div>
            </div>

            {/* Comments section with infinite scroll */}
            <div 
              className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar"
              ref={commentsContainerRef}
              onScroll={handleScroll}
            >
              {error ? renderErrorState() : 
               isLoading && !loadingMore ? renderLoadingState() :
               comments?.length > 0 ? (
                <>
                  {comments.map((comment) => (
                    <Comment 
                      key={comment._id} 
                      comment={comment} 
                      onReply={() => handleReply(comment)}
                      currentUser={user}
                    />
                  ))}
                  {loadingMore && (
                    <div className="flex justify-center py-2">
                      <CircularProgress size={24} />
                    </div>
                  )}
                  <div ref={commentsEndRef} />
                </>
              ) : renderEmptyState()}
            </div>

            {/* Reply indicator */}
            {replyingTo && (
              <div className="px-3 py-2 bg-gray-50 flex justify-between items-center">
                <span className="text-sm">
                  Replying to <span className="font-medium text-blue-500">@{replyingTo}</span>
                </span>
                <button 
                  onClick={cancelReply}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  Cancel
                </button>
              </div>
            )}

            {/* Input box */}
            <div className="flex items-center p-3 border-t gap-2">
              <Avatar 
                src={user?.profilePicture} 
                alt={user?.username}
                sx={{ width: 32, height: 32 }}
              />
              <div className="flex-1 relative">
                <input
                  ref={inputRef}
                  value={text}
                  onChange={changeEventHandler}
                  onKeyPress={handleKeyPress}
                  placeholder={replyingTo ? `Reply to ${replyingTo}...` : "Add a comment..."}
                  className="w-full border border-gray-300 rounded-full px-4 py-2 pr-10 focus:outline-none focus:border-blue-400 bg-gray-50"
                  disabled={isSending || error}
                  maxLength={2000}
                />
                <IconButton 
                  size="small" 
                  disabled={!text.trim() || isSending || error}
                  onClick={sendMessageHandler}
                  className="absolute right-1 top-1/2 transform -translate-y-1/2 text-blue-500"
                  sx={{ 
                    color: (text.trim() && !error) ? '#3b82f6' : '#9ca3af',
                    '&:disabled': { color: '#d1d5db' } 
                  }}
                >
                  {isSending ? <CircularProgress size={16} /> : <FiSend />}
                </IconButton>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
      
      {/* Mobile view only - show image/video in bottom sheet */}
      {isMobile && (
        <DialogActions className="p-0">
          <div className="w-full bg-black">
            {post?.mediaType === "video" ? (
              <video
                src={post?.video}
                controls
                className="w-full max-h-[300px] object-contain"
              />
            ) : (
              <img
                src={post?.image}
                alt="Post"
                className="w-full max-h-[300px] object-contain"
              />
            )}
          </div>
        </DialogActions>
      )}
    </Dialog>
  );
};

export default CommentDialog;
