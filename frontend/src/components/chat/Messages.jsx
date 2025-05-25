import React, { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import { Avatar, Button, IconButton, Menu, MenuItem, Tooltip } from "@mui/material";
import { Check, CheckCheck, FileText, Download, Video, Play, Pause, Volume2, VolumeX, MoreVertical } from "lucide-react";

import useGetAllMessage from "../../hooks/useGetAllMessage";
import useGetRTM from "../../hooks/useGetRTM";

const Messages = ({ selectedUser }) => {
  useGetRTM();
  const { messagesLoaded } = useGetAllMessage();
  const { messages } = useSelector((store) => store.chat);
  const { user } = useSelector((store) => store.auth);
  
  // Log when messages are loaded or changed
  useEffect(() => {
    if (messages && messages.length > 0) {
      console.log(`${messages.length} messages loaded for conversation`);
      
      // Force scrolling to the latest message after messages load
      const scrollEvent = new CustomEvent('chat-messages-loaded');
      window.dispatchEvent(scrollEvent);
    }
  }, [messages, messagesLoaded]);
  
  const formatTimestamp = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  // State for video controls
  const [playingVideo, setPlayingVideo] = useState(null);
  const [videoMuted, setVideoMuted] = useState({});
  const videoRefs = useRef({});
  const [messageMenu, setMessageMenu] = useState(null);
  const [selectedMessage, setSelectedMessage] = useState(null);
  
  // Handle video play/pause
  const toggleVideoPlay = (videoId) => {
    if (!videoRefs.current[videoId]) return;
    
    const videoElement = videoRefs.current[videoId];
    
    if (playingVideo === videoId) {
      videoElement.pause();
      setPlayingVideo(null);
    } else {
      // Pause any currently playing video
      if (playingVideo && videoRefs.current[playingVideo]) {
        videoRefs.current[playingVideo].pause();
      }
      
      videoElement.play();
      setPlayingVideo(videoId);
    }
  };
  
  // Toggle video mute
  const toggleVideoMute = (videoId) => {
    if (!videoRefs.current[videoId]) return;
    
    const videoElement = videoRefs.current[videoId];
    videoElement.muted = !videoElement.muted;
    
    setVideoMuted(prev => ({
      ...prev,
      [videoId]: !prev[videoId]
    }));
  };
  
  // Handle message menu
  const openMessageMenu = (event, msg) => {
    setMessageMenu(event.currentTarget);
    setSelectedMessage(msg);
  };
  
  const closeMessageMenu = () => {
    setMessageMenu(null);
    setSelectedMessage(null);
  };
  
  // Handle message actions
  const handleDeleteMessage = () => {
    // Implement delete functionality if needed
    closeMessageMenu();
  };
  
  const handleForwardMessage = () => {
    // Implement forward functionality if needed
    closeMessageMenu();
  };
  
  // Download file attachment
  const downloadFile = (url, fileName) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName || 'download';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  // Function to render file attachments
  const renderFileAttachment = (msg) => {
    if (!msg.fileUrl) return null;
    
    const videoId = `video-${msg._id}`;
    const isMuted = videoMuted[videoId] || false;
    
    if (msg.fileType === 'image') {
      return (
        <div className="mb-2 relative group">
          <img 
            src={msg.fileUrl} 
            alt="Image attachment" 
            className="max-w-full rounded-lg max-h-60 object-contain cursor-pointer"
            onClick={() => window.open(msg.fileUrl, '_blank')}
          />
          <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <IconButton size="small" className="bg-black bg-opacity-50 text-white" onClick={() => downloadFile(msg.fileUrl, msg.fileName)}>
              <Download size={16} />
            </IconButton>
          </div>
        </div>
      );
    } else if (msg.fileType === 'video') {
      return (
        <div className="mb-2 relative rounded-lg overflow-hidden bg-black">
          <video 
            ref={el => { videoRefs.current[videoId] = el }}
            src={msg.fileUrl} 
            className="max-w-full max-h-60 object-contain"
            muted={isMuted}
            onEnded={() => setPlayingVideo(null)}
            onClick={() => toggleVideoPlay(videoId)}
          />
          <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 flex items-center p-1 justify-between">
            <IconButton size="small" onClick={() => toggleVideoPlay(videoId)} sx={{ color: 'white' }}>
              {playingVideo === videoId ? <Pause size={16} /> : <Play size={16} />}
            </IconButton>
            <div className="flex items-center">
              <IconButton size="small" onClick={() => toggleVideoMute(videoId)} sx={{ color: 'white' }}>
                {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </IconButton>
              <IconButton size="small" onClick={() => downloadFile(msg.fileUrl, msg.fileName)} sx={{ color: 'white' }}>
                <Download size={16} />
              </IconButton>
            </div>
          </div>
        </div>
      );
    } else {
      return (
        <div className="flex items-center gap-2 mb-2 bg-gray-100 p-2 rounded">
          <FileText size={20} />
          <span className="text-sm truncate max-w-[150px]">{msg.fileName || 'File'}</span>
          <button 
            onClick={() => downloadFile(msg.fileUrl, msg.fileName)}
            className="ml-auto text-blue-600 hover:text-blue-800 transition-colors"
          >
            <Download size={18} />
          </button>
        </div>
      );
    }
  };
  
  return (
    <div className="overflow-y-auto h-[70vh] flex-1 p-4 ">
      <div className="flex justify-center mb-4">
        <div className="flex flex-col items-center justify-center">
          <span>{selectedUser?.username}</span>
          <Link to={`/profile/${selectedUser?._id}`}>
            <Button className="h-8 my-2" variant="secondary">
              View Profile
            </Button>
          </Link>
        </div>
      </div>
      
      <div className="flex flex-col gap-3">
        {messages && messages.length > 0 ? (
          messages.map((msg, index) => {
            const isCurrentUser = msg.senderId === user?._id;
            const messageTime = msg.createdAt ? formatTimestamp(msg.createdAt) : '';
            return (
              <div
                key={msg._id || index}
                className={`flex ${
                  isCurrentUser ? "justify-end" : "justify-start"
                } group mb-2`}
              >
                {!isCurrentUser && (
                  <div className="self-end mb-1 mr-1">
                    <Avatar
                      src={selectedUser?.profilePicture}
                      alt={selectedUser?.username}
                      sx={{ width: 24, height: 24 }}
                    />
                  </div>
                )}
                
                <div className="flex flex-col relative max-w-[70%]">
                  <div
                    className={`flex flex-col relative ${
                      isCurrentUser
                        ? "bg-blue-500 text-white rounded-tl-lg rounded-tr-lg rounded-bl-lg"
                        : "bg-gray-200 text-black rounded-tl-lg rounded-tr-lg rounded-br-lg"
                    } p-2 shadow-sm`}
                  >
                    {/* Message content */}
                    {renderFileAttachment(msg)}
                    {msg.message && <div className="break-words">{msg.message}</div>}
                    
                    {/* Context menu button */}
                    <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <IconButton 
                        size="small" 
                        className={`${isCurrentUser ? 'text-white' : 'text-gray-600'} opacity-70 hover:opacity-100`}
                        onClick={(e) => openMessageMenu(e, msg)}
                      >
                        <MoreVertical size={14} />
                      </IconButton>
                    </div>
                  </div>
                  
                  {/* Message metadata */}
                  <div className="flex items-center mt-1 text-xs text-gray-500">
                    {isCurrentUser ? (
                      <>
                        <span className="mr-1 text-xs">{messageTime}</span>
                        <span className="flex items-center">
                          {msg.isRead ? (
                            <CheckCheck size={12} className="text-blue-500" />
                          ) : (
                            <Check size={12} />
                          )}
                        </span>
                      </>
                    ) : (
                      <span className="text-xs">{messageTime}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <p className="text-center text-gray-500">No messages yet. Start a conversation!</p>
        )}
        
        {/* Message context menu */}
        <Menu
          anchorEl={messageMenu}
          open={Boolean(messageMenu)}
          onClose={closeMessageMenu}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'right',
          }}
          transformOrigin={{
            vertical: 'top',
            horizontal: 'right',
          }}
        >
          {selectedMessage?.fileUrl && (
            <MenuItem onClick={() => {
              downloadFile(selectedMessage.fileUrl, selectedMessage.fileName);
              closeMessageMenu();
            }}>
              Download
            </MenuItem>
          )}
          <MenuItem onClick={handleForwardMessage}>Forward</MenuItem>
          {selectedMessage?.senderId === user?._id && (
            <MenuItem onClick={handleDeleteMessage}>Delete</MenuItem>
          )}
        </Menu>
      </div>
    </div>
  );
};

export default Messages;
