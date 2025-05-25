import React, { useState } from "react";
import { Avatar, IconButton, Menu, MenuItem, Tooltip } from "@mui/material";
import { FiMoreVertical, FiHeart, FiMessageSquare } from "react-icons/fi";
import { formatDistanceToNow } from 'date-fns';

const Comment = ({ comment, onReply, currentUser }) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const [liked, setLiked] = useState(false);
  
  const isOwnComment = currentUser?._id === comment?.author?._id;
  const formattedDate = comment?.createdAt 
    ? formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })
    : "";
  
  const handleMenuClick = (event) => {
    setAnchorEl(event.currentTarget);
  };
  
  const handleMenuClose = () => {
    setAnchorEl(null);
  };
  
  const handleLike = () => {
    setLiked(!liked);
  };
  
  return (
    <div className="group flex gap-2 items-start py-2 relative hover:bg-gray-50 rounded-lg px-2 transition-colors duration-200">
      <Avatar
        alt={comment?.author?.username}
        src={comment?.author?.profilePicture}
        sx={{ width: 32, height: 32 }}
      />
      <div className="flex-1 flex flex-col">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">
            {comment?.author?.username}
            {isOwnComment && (
              <span className="ml-2 text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                You
              </span>
            )}
          </span>
          <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Tooltip title="Reply">
              <IconButton size="small" onClick={() => onReply(comment)}>
                <FiMessageSquare size={14} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Like">
              <IconButton size="small" onClick={handleLike}>
                <FiHeart size={14} className={liked ? "text-red-500 fill-red-500" : ""} />
              </IconButton>
            </Tooltip>
            <IconButton size="small" onClick={handleMenuClick}>
              <FiMoreVertical size={14} />
            </IconButton>
            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={handleMenuClose}
            >
              <MenuItem onClick={() => { onReply(comment); handleMenuClose(); }}>Reply</MenuItem>
              {isOwnComment && <MenuItem onClick={handleMenuClose}>Delete</MenuItem>}
              {!isOwnComment && <MenuItem onClick={handleMenuClose}>Report</MenuItem>}
            </Menu>
          </div>
        </div>
        
        <div className="mt-1">
          <span className="text-sm text-gray-700 break-words">{comment?.text}</span>
        </div>
        
        <div className="flex items-center mt-1 gap-3">
          <span className="text-xs text-gray-500">{formattedDate}</span>
          <button 
            onClick={() => onReply(comment)}
            className="text-xs text-gray-500 hover:text-blue-500 transition-colors"
          >
            Reply
          </button>
          {liked && <span className="text-xs text-red-500">Liked</span>}
        </div>
        
        {comment.parentId && (
          <div className="mt-1">
            <span className="text-xs text-blue-500">Reply to @{comment.parentAuthor?.username || "user"}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default Comment;
