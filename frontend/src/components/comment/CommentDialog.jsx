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
import axios from "axios";
import { setPosts } from "../../redux/postSlice";
import { FiSend, FiX, FiMoreVertical, FiHeart, FiShare } from "react-icons/fi";
import { toast } from "react-toastify";

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
    }
  }, [open, selectedPost?._id]);
  
  // Scroll to bottom when new comment is added
  useEffect(() => {
    if (commentsEndRef.current) {
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
      setIsLoading(loadMore ? false : true);
      setLoadingMore(loadMore);
      
      const currentPage = loadMore ? page + 1 : 1;
      
      const response = await axios.get(
        `https://socialfooddelivery-2.onrender.com/api/v1/post/${selectedPost._id}/comments?page=${currentPage}&limit=20`,
        { withCredentials: true }
      );
      
      if (response.data.success) {
        const newComments = response.data.comments;
        
        // Check if we got fewer comments than requested, meaning we're at the end
        if (newComments.length < 20) {
          setHasMoreComments(false);
        }
        
        if (loadMore) {
          setComments(prev => [...prev, ...newComments]);
          setPage(currentPage);
        } else {
          setComments(newComments);
          setPage(1);
        }
      }
    } catch (error) {
      console.error("Error fetching comments:", error);
      toast.error("Failed to load comments");
    } finally {
      setIsLoading(false);
      setLoadingMore(false);
    }
  };
  
  // Handle scroll to load more comments
  const handleScroll = () => {
    if (!commentsContainerRef.current || loadingMore || !hasMoreComments) return;
    
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
  
  // Send a comment
  const sendMessageHandler = async () => {
    if (!text.trim()) return;
    
    try {
      setIsSending(true);
      
      const res = await axios.post(
        `https://socialfooddelivery-2.onrender.com/api/v1/post/${selectedPost?._id}/comment`,
        { text, parentId },
        {
          headers: {
            "Content-Type": "application/json",
          },
          withCredentials: true,
        }
      );

      if (res.data.success) {
        const newComment = res.data.comment;
        const updatedComments = [...comments, newComment];

        setComments(updatedComments); // Update local UI
        setText("");
        setParentId(null);
        setReplyingTo(null);

        // Update Redux state
        const updatedPostData = posts.map((p) =>
          p._id === selectedPost._id ? { ...p, comments: updatedComments } : p
        );
        dispatch(setPosts(updatedPostData));
        
        // Scroll to the new comment
        setTimeout(() => {
          if (commentsEndRef.current) {
            commentsEndRef.current.scrollIntoView({ behavior: 'smooth' });
          }
        }, 100);
      }
    } catch (error) {
      console.error("Comment send failed:", error);
      toast.error("Failed to send comment");
    } finally {
      setIsSending(false);
    }
  };

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
              {isLoading && !loadingMore ? (
                <div className="flex justify-center items-center h-full">
                  <CircularProgress size={32} />
                </div>
              ) : comments?.length > 0 ? (
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
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center py-8">
                  <p className="text-gray-500 mb-2">No comments yet.</p>
                  <p className="text-sm text-gray-400">Be the first to leave a comment!</p>
                </div>
              )}
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
                  placeholder={replyingTo ? `Reply to ${replyingTo}...` : "Add a comment..."}
                  className="w-full border border-gray-300 rounded-full px-4 py-2 pr-10 focus:outline-none focus:border-blue-400 bg-gray-50"
                  disabled={isSending}
                />
                <IconButton 
                  size="small" 
                  disabled={!text.trim() || isSending}
                  onClick={sendMessageHandler}
                  className="absolute right-1 top-1/2 transform -translate-y-1/2 text-blue-500"
                  sx={{ 
                    color: text.trim() ? '#3b82f6' : '#9ca3af',
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
