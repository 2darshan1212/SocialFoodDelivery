import React, { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { 
  Avatar, 
  Button, 
  CircularProgress, 
  Paper, 
  Drawer,
  IconButton,
  useMediaQuery,
  useTheme,
  Badge,
  Tooltip,
  Divider,
  LinearProgress
} from "@mui/material";
import { 
  MessageCircleCode, 
  Menu, 
  X, 
  Paperclip, 
  ImageIcon, 
  FileIcon, 
  VideoIcon, 
  Image as ImageLucide, 
  Play, 
  Pause, 
  Volume2, 
  VolumeX,
  MoreVertical
} from "lucide-react";
import axios from "axios";

import Messages from "./Messages";
import ConversationList from "./ConversationList";
import SuggestedUsers from "../right/SuggestedUsers";
import { setMessages } from "../../redux/chatSlice";
import { setSelectedUser } from "../../redux/authSlice";
import useGetSuggestedUser from "../../hooks/useGetSuggestedUser";

const ChatPage = () => {
  const dispatch = useDispatch();
  const { selectedUser } = useSelector((store) => store.auth);
  const { messages } = useSelector((store) => store.chat);
  const { unreadCounts } = useSelector((store) => store.chat);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  // Get suggested users
  useGetSuggestedUser();

  const [textMessage, setTextMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [fileType, setFileType] = useState(null); // 'image', 'video', 'document'
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const videoPreviewRef = useRef(null);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const fileInputRef = useRef(null);

  // Auto scroll to bottom
  useEffect(() => {
    // Check if we should auto-scroll based on how far the user has scrolled up
    const shouldAutoScroll = () => {
      if (!messagesContainerRef.current) return true;
      
      const container = messagesContainerRef.current;
      const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
      
      // If the user is already near the bottom (within 150px), auto-scroll
      return distanceFromBottom < 150;
    };
    
    // Scroll to bottom if appropriate
    if (messagesEndRef.current && shouldAutoScroll()) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Force scroll to bottom when conversation changes
  useEffect(() => {
    if (messagesEndRef.current) {
      setTimeout(() => {
        messagesEndRef.current.scrollIntoView({ behavior: "auto" });
      }, 100);
    }
  }, [selectedUser]);

  // Listen for messages loaded event
  useEffect(() => {
    const handleMessagesLoaded = () => {
      if (messagesEndRef.current) {
        console.log("Messages loaded event received, scrolling to bottom");
        messagesEndRef.current.scrollIntoView({ behavior: "auto" });
      }
    };
    
    // Add event listener for custom event from Messages component
    window.addEventListener('chat-messages-loaded', handleMessagesLoaded);
    
    return () => {
      window.removeEventListener('chat-messages-loaded', handleMessagesLoaded);
    };
  }, []);

  // Force scroll to bottom on initial load
  useEffect(() => {
    // Wait for messages to be loaded and DOM to be updated
    const initialScrollTimeout = setTimeout(() => {
      if (messagesEndRef.current && messages && messages.length > 0) {
        messagesEndRef.current.scrollIntoView({ behavior: "auto" });
        console.log("Scrolled to latest messages on initial load");
      }
    }, 300);

    return () => clearTimeout(initialScrollTimeout);
  }, []); // Empty dependency array means this runs once on mount

  // Reset selected user on unmount
  useEffect(() => {
    return () => dispatch(setSelectedUser(null));
  }, []);

  // Clean up file preview when component unmounts
  useEffect(() => {
    return () => {
      if (filePreview) {
        URL.revokeObjectURL(filePreview);
      }
    };
  }, [filePreview]);

  // Handle file selection
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Log file details for debugging
    console.log("Selected file:", file);
    
    setSelectedFile(file);
    
    // Determine file type and create preview
    if (file.type.startsWith('image/')) {
      setFileType('image');
      const objectUrl = URL.createObjectURL(file);
      setFilePreview(objectUrl);
    } else if (file.type.startsWith('video/')) {
      setFileType('video');
      const objectUrl = URL.createObjectURL(file);
      setFilePreview(objectUrl);
      // Reset video playing state
      setIsVideoPlaying(false);
    } else {
      setFileType('document');
      setFilePreview(null);
    }
  };

  // Format file size for display
  const formatFileSize = (bytes) => {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Reset file selection
  const handleCancelFile = () => {
    setSelectedFile(null);
    setFileType(null);
    if (filePreview) {
      URL.revokeObjectURL(filePreview);
      setFilePreview(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    // Reset video state
    setIsVideoPlaying(false);
    setIsMuted(false);
  };
  
  // Toggle video play/pause
  const toggleVideoPlay = () => {
    if (!videoPreviewRef.current) return;
    
    if (isVideoPlaying) {
      videoPreviewRef.current.pause();
    } else {
      videoPreviewRef.current.play();
    }
    setIsVideoPlaying(!isVideoPlaying);
  };
  
  // Toggle video mute
  const toggleMute = () => {
    if (!videoPreviewRef.current) return;
    
    videoPreviewRef.current.muted = !videoPreviewRef.current.muted;
    setIsMuted(!isMuted);
  };

  const sendMessageHandler = async (receiverId) => {
    if (!textMessage.trim() && !selectedFile) return;

    try {
      setIsSending(true);
      if (selectedFile) {
        setIsUploading(true);
        setUploadProgress(0);
      }
      
      // Create form data for file upload
      const formData = new FormData();
      // Always include a text message (empty string if there's no text)
      formData.append('textMessage', textMessage.trim() || '');
      
      if (selectedFile) {
        // Special handling for video files
        if (fileType === 'video') {
          // Ensure proper content type and naming
          const videoExtension = selectedFile.name.split('.').pop().toLowerCase();
          const validExtensions = ['mp4', 'mov', 'avi', 'webm'];
          
          // Check if it's a supported video format
          if (!validExtensions.includes(videoExtension)) {
            toast.error('Unsupported video format. Please use MP4, MOV, AVI or WEBM.');
            setIsSending(false);
            setIsUploading(false);
            return;
          }
          
          // Ensure file size is reasonable (limit to 25MB for videos)
          const maxVideoSize = 25 * 1024 * 1024; // 25MB in bytes
          if (selectedFile.size > maxVideoSize) {
            toast.error('Video file is too large. Maximum size is 25MB.');
            setIsSending(false);
            setIsUploading(false);
            return;
          }
          
          console.log(`Processing video file: ${selectedFile.name} (${formatFileSize(selectedFile.size)})`);
        }
        
        // Add file to form data
        formData.append('file', selectedFile);
        formData.append('fileType', fileType || 'document'); // Ensure fileType is always sent
        formData.append('fileName', selectedFile.name); // Send original filename
        
        console.log("Appending file to form data:", selectedFile.name, fileType);
      }
      
      console.log("Sending message to:", receiverId);
      
      // More verbose server URL and error handling
      const apiUrl = `https://socialfooddelivery-2.onrender.com/api/v1/message/send/${receiverId}`;
      console.log(`Sending request to: ${apiUrl}`);
      
      const res = await axios.post(
        apiUrl,
        formData,
        {
          headers: { 
            'Content-Type': 'multipart/form-data',
          },
          withCredentials: true,
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(percentCompleted);
            console.log(`Upload progress: ${percentCompleted}%`);
          },
          // Increase timeout for large files
          timeout: 60000, // 60 seconds timeout
        }
      );

      console.log("Response:", res.data);

      if (res.data.success) {
        // Use a function updater to ensure we're working with the latest state
        dispatch(setMessages(prevMessages => [...(prevMessages || []), res.data.newMessage]));
        setTextMessage("");
        handleCancelFile();
        
        // Force scroll to bottom after sending a message
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 100);
        
        // Show success message
        if (selectedFile && fileType === 'video') {
          toast.success('Video sent successfully!');
        }
      }
    } catch (error) {
      console.error("Failed to send message:", error);
      
      // More descriptive error messages
      if (error.response) {
        // The request was made and the server responded with a status code
        console.error("Server error response:", error.response.data);
        toast.error(`Server error: ${error.response.data.message || 'Failed to send file'}`);
      } else if (error.request) {
        // The request was made but no response was received
        console.error("No response received:", error.request);
        toast.error('No response from server. Check your internet connection.');
      } else {
        // Something happened in setting up the request
        toast.error(`Error: ${error.message || 'Failed to send message'}`);
      }
      
    } finally {
      setIsSending(false);
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const toggleDrawer = () => {
    setDrawerOpen(!drawerOpen);
  };

  // Handle conversation selection
  const handleConversationSelected = () => {
    // Close drawer whenever a conversation is selected, regardless of screen size
    setDrawerOpen(false);
  };

  // Calculate total unread messages
  const totalUnreadCount = unreadCounts ? 
    Object.values(unreadCounts).reduce((sum, count) => sum + count, 0) : 0;

  // Menu button component with badge
  const MenuButton = () => (
    <IconButton 
      onClick={toggleDrawer} 
      color="primary"
      size="large"
      sx={{
        backgroundColor: 'rgba(63, 81, 181, 0.1)',
        '&:hover': {
          backgroundColor: 'rgba(63, 81, 181, 0.2)',
        },
        zIndex: 100
      }}
    >
      <Badge 
        badgeContent={totalUnreadCount > 0 ? totalUnreadCount : null} 
        color="error"
      >
        <Menu size={24} />
      </Badge>
    </IconButton>
  );

  return (
    <div className="h-[calc(100vh-100px)] relative mb-16">
      {/* Always show menu button on small screens */}
      {isMobile && (
        <div className="absolute top-2 right-2 z-50">
          <MenuButton />
        </div>
      )}
      
      {/* Chat Area - Full width */}
      <Paper className="h-full p-0 overflow-hidden flex flex-col">
        {selectedUser ? (
          <section className="flex flex-col h-full">
            {/* Chat Header */}
            <div className="flex items-center justify-between px-3 sm:px-4 py-2 sm:py-3 border-b border-gray-300 bg-white sticky top-0 z-10">
              <div className="flex items-center gap-2 sm:gap-3">
                <Avatar
                  alt={selectedUser.username}
                  src={selectedUser.profilePicture}
                  sx={{ width: 40, height: 40 }}
                />
                <div className="flex flex-col">
                  <span className="font-semibold text-gray-800">
                    {selectedUser.username}
                  </span>
                  <span className="text-xs text-gray-500">Chatting now</span>
                </div>
              </div>
            </div>

            {/* Chat Messages */}
            <div 
              ref={messagesContainerRef}
              className="flex-1 overflow-y-auto px-2 py-4 space-y-2 scrollbar-thin scrollbar-thumb-gray-300"
            >
              <Messages selectedUser={selectedUser} />
              <div ref={messagesEndRef} />
            </div>

            {/* File Preview */}
            {selectedFile && (
              <div className="px-4 py-2 border-t border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {fileType === 'image' && filePreview ? (
                      <div className="relative">
                        <img 
                          src={filePreview} 
                          alt="Upload preview" 
                          className="max-h-40 max-w-full object-contain rounded"
                        />
                      </div>
                    ) : fileType === 'video' && filePreview ? (
                      <div className="relative w-full max-w-md">
                        <div className="rounded overflow-hidden bg-black relative">
                          <video 
                            ref={videoPreviewRef}
                            src={filePreview} 
                            className="max-h-40 max-w-full object-contain"
                            onPlay={() => setIsVideoPlaying(true)}
                            onPause={() => setIsVideoPlaying(false)}
                            muted={isMuted}
                          />
                          <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 flex items-center p-1 justify-between">
                            <IconButton size="small" onClick={toggleVideoPlay} sx={{ color: 'white' }}>
                              {isVideoPlaying ? <Pause size={16} /> : <Play size={16} />}
                            </IconButton>
                            <IconButton size="small" onClick={toggleMute} sx={{ color: 'white' }}>
                              {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                            </IconButton>
                          </div>
                        </div>
                        <div className="text-xs text-gray-500 mt-1 flex justify-between">
                          <span>{selectedFile.name}</span>
                          <span>{formatFileSize(selectedFile.size)}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 bg-gray-100 p-2 rounded">
                        <FileIcon size={20} />
                        <div className="flex flex-col">
                          <span className="text-sm truncate max-w-[200px]">{selectedFile.name}</span>
                          <span className="text-xs text-gray-500">{formatFileSize(selectedFile.size)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                  <IconButton size="small" onClick={handleCancelFile}>
                    <X size={18} />
                  </IconButton>
                </div>
                
                {/* Upload progress bar */}
                {isUploading && (
                  <div className="mt-2">
                    <LinearProgress variant="determinate" value={uploadProgress} />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>Uploading...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Message Input */}
            <div className="flex items-center gap-1 sm:gap-2 p-2 sm:p-3 border-t border-gray-300 bg-white">
              {/* File upload button */}
              <input
                type="file"
                id="file-upload"
                className="hidden"
                onChange={handleFileChange}
                ref={fileInputRef}
              />
              
              {/* Three dots menu for attachments */}
              <div className="relative">
                <Tooltip title="Attachment options">
                  <IconButton 
                    color="primary" 
                    onClick={(e) => {
                      const menu = document.getElementById('attachment-menu');
                      if (menu.style.display === 'flex') {
                        menu.style.display = 'none';
                      } else {
                        menu.style.display = 'flex';
                      }
                    }}
                    disabled={isSending}
                    size="small"
                  >
                    <MoreVertical size={20} />
                  </IconButton>
                </Tooltip>
                
                {/* Attachment menu that appears when 3 dots is clicked */}
                <div 
                  id="attachment-menu" 
                  className="absolute bottom-10 left-0 bg-white shadow-lg rounded-lg p-2 z-10 flex-col gap-2" 
                  style={{display: 'none'}}
                >
                  <Tooltip title="Attach image">
                    <IconButton 
                      color="primary" 
                      onClick={() => {
                        fileInputRef.current.setAttribute('accept', 'image/*');
                        fileInputRef.current.click();
                        document.getElementById('attachment-menu').style.display = 'none';
                      }}
                      disabled={isSending}
                      size="small"
                    >
                      <ImageLucide size={20} />
                    </IconButton>
                  </Tooltip>
                  
                  <Tooltip title="Attach video">
                    <IconButton 
                      color="primary" 
                      onClick={() => {
                        fileInputRef.current.setAttribute('accept', 'video/*');
                        fileInputRef.current.click();
                        document.getElementById('attachment-menu').style.display = 'none';
                      }}
                      disabled={isSending}
                      size="small"
                    >
                      <VideoIcon size={20} />
                    </IconButton>
                  </Tooltip>
                  
                  <Tooltip title="Attach file">
                    <IconButton 
                      color="primary" 
                      onClick={() => {
                        fileInputRef.current.setAttribute('accept', '*');
                        fileInputRef.current.click();
                        document.getElementById('attachment-menu').style.display = 'none';
                      }}
                      disabled={isSending}
                      size="small"
                    >
                      <Paperclip size={20} />
                    </IconButton>
                  </Tooltip>
                </div>
              </div>
              
              <input
                value={textMessage}
                onChange={(e) => setTextMessage(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" && !e.shiftKey && sendMessageHandler(selectedUser?._id)
                }
                placeholder="Type a message..."
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm sm:text-base sm:px-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <Button
                variant="contained"
                color="primary"
                disabled={(!textMessage.trim() && !selectedFile) || isSending}
                onClick={() => sendMessageHandler(selectedUser?._id)}
                sx={{ 
                  minWidth: { xs: "60px", sm: "80px" },
                  px: { xs: 1, sm: 2 },
                  fontSize: { xs: "0.75rem", sm: "0.875rem" }
                }}
              >
                {isSending ? (
                  <CircularProgress size={22} color="inherit" />
                ) : (
                  "Send"
                )}
              </Button>
            </div>
          </section>
        ) : (
          // No user selected UI
          <div className="flex flex-col items-center justify-center h-full text-center text-gray-600 relative px-4">
            <MessageCircleCode className="w-16 h-16 sm:w-24 sm:h-24 mb-3 sm:mb-4 text-blue-500" />
            <h1 className="text-lg sm:text-xl font-bold">Your Messages</h1>
            <p className="text-xs sm:text-sm px-2 max-w-xs">
              {isMobile 
                ? "Tap the menu icon in the top right to select a conversation" 
                : "No conversation selected. Select a conversation to start chatting."}
            </p>
          </div>
        )}
      </Paper>

      {/* Conversations Drawer - Only for mobile users */}
      {isMobile && (
        <Drawer
          anchor="bottom"
          open={drawerOpen}
          onClose={toggleDrawer}
          PaperProps={{
            sx: {
              width: '100%',
              height: '80vh',
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
            }
          }}
        >
          <div className="p-3 flex justify-between items-center border-b">
            <h2 className="text-lg font-semibold">Conversations</h2>
            <IconButton onClick={toggleDrawer}>
              <X size={20} />
            </IconButton>
          </div>
          <div className="overflow-auto h-full">
            <div className="px-2 py-1">
              <ConversationList onSelectConversation={handleConversationSelected} />
            </div>
            
            <Divider sx={{ my: 2 }} />
            
            <div className="px-4 py-2">
              <SuggestedUsers isConversationTab={true} onMessageClick={toggleDrawer} />
            </div>
          </div>
        </Drawer>
      )}
    </div>
  );
};

export default ChatPage;
