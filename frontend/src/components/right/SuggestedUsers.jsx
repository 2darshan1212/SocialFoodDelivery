import React, { useState, useEffect } from "react";
import { Avatar, Tooltip, CircularProgress } from "@mui/material";
import { useDispatch, useSelector } from "react-redux";
import { Link, useNavigate } from "react-router-dom";
import useFollowUser from "../../hooks/useFollowUser";
import { getUserStats } from "../../redux/userSlice";
import { toast } from "react-toastify";

const SuggestedUsers = ({ isConversationTab = false, onMessageClick }) => {
  const { suggestedUsers } = useSelector((store) => store.auth);
  const { userStats = {} } = useSelector((state) => state.user);
  const { user } = useSelector((store) => store.auth);
  const userReduxState = useSelector((state) => state.user);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [showAll, setShowAll] = useState(false);
  
  // Use the new follow hook
  const { 
    toggleFollow, 
    isFollowing, 
    isProcessing, 
    getFollowingStatus,
    followings 
  } = useFollowUser();

  // Debug logging
  useEffect(() => {
    console.log("🔍 SuggestedUsers Debug:");
    console.log("Current user:", user);
    console.log("Suggested users:", suggestedUsers);
    console.log("Followings from hook:", followings);
    console.log("Full user Redux state:", userReduxState);
    console.log("User stats:", userStats);
  }, [user, suggestedUsers, followings, userReduxState, userStats]);

  // Fetch stats for all users when component mounts
  useEffect(() => {
    if (suggestedUsers && suggestedUsers.length > 0) {
      suggestedUsers.forEach(user => {
        if (user && user._id) {
          dispatch(getUserStats(user._id));
        }
      });
    }
  }, [suggestedUsers, dispatch]);

  const handleFollowClick = async (user) => {
    if (!user?._id || !user?.username) {
      toast.error("Invalid user");
      return;
    }
    
    console.log("🎯 Follow button clicked for:", {
      userId: user._id,
      username: user.username,
      currentlyFollowing: isFollowing(user._id),
      isProcessing: isProcessing(user._id)
    });
    
    const result = await toggleFollow(user._id, user.username);
    
    console.log("✅ Toggle follow result:", result);
    
    if (result.success) {
      // Refresh user stats after successful follow/unfollow
      dispatch(getUserStats(user._id));
    }
  };

  // Safety check in case suggestedUsers is undefined
  const usersToShow = suggestedUsers ? 
    (showAll ? suggestedUsers : suggestedUsers.slice(0, 4)) : 
    [];

  return (
    <div>
      <div className="flex items-center justify-between mb-3 ">
        <h2 className="font-semibold text-sm text-gray-700">
          Suggested for you
        </h2>
        {suggestedUsers && !showAll && suggestedUsers.length > 4 && (
          <button
            onClick={() => setShowAll(true)}
            className="text-blue-500 text-xs font-medium hover:underline"
          >
            View All
          </button>
        )}
      </div>

      <div className="space-y-2">
        {usersToShow.map((user) => {
          if (!user || !user._id) return null;
          
          // Get following status for this user
          const followingStatus = getFollowingStatus(user._id);
          const stats = userStats && userStats[user._id];

          return (
            <div
              key={user._id}
              className="flex items-center justify-between p-1 hover:bg-gray-50 rounded-md transition"
            >
              <div className="flex items-center gap-3" >
                <Link to={`/profile/${user._id}`}>
                  <Avatar
                    alt={user.username}
                    src={user.profilePicture}
                    className="w-9 h-9"
                  />
                </Link>
                <div className="text-sm">
                  <>
                    <p className="font-medium text-gray-800">{user.username}</p>
                  </>
                  <p className="text-xs text-gray-500 truncate w-36">
                    {user.bio || "No bio"}
                  </p>
                  
                  {stats && (
                    <p className="text-xs text-gray-500 mt-1">
                      <span className="font-medium">{stats.followerCount}</span> followers
                    </p>
                  )}
                </div>
              </div>
              
              {isConversationTab ? (
                <Tooltip title="Message">
                  <p
                    onClick={() => {
                      // Set selected user and navigate to chat
                      dispatch({ 
                        type: 'auth/setSelectedUser', 
                        payload: user 
                      });
                      // Call the callback to close the drawer if provided
                      if (onMessageClick && typeof onMessageClick === 'function') {
                        onMessageClick();
                      }
                    }}
                    className={`px-4 py-2 cursor-pointer mr-1 rounded-sm mx-[-2rem] text-sm font-medium transition duration-200 
                      bg-blue-600 text-white hover:bg-blue-700`}
                  >
                    Message
                  </p>
                </Tooltip>
              ) : (
                <Tooltip title={followingStatus.isFollowing ? "Unfollow" : "Follow"}>
                  <p
                    onClick={() => handleFollowClick(user)}
                    className={`px-4 py-2 cursor-pointer mr-1 rounded-sm mx-[-2rem] text-sm font-medium transition duration-200 ${
                      followingStatus.isProcessing 
                        ? "bg-gray-200 text-gray-500"
                        : followingStatus.isFollowing
                        ? "bg-gray-300 text-black hover:bg-gray-400"
                        : "bg-blue-600 text-white hover:bg-blue-700"
                    }`}
                    style={{ pointerEvents: followingStatus.isProcessing ? 'none' : 'auto' }}
                  >
                    {followingStatus.isProcessing ? (
                      <CircularProgress size={16} color="inherit" />
                    ) : followingStatus.isFollowing ? (
                      "Unfollow"
                    ) : (
                      "Follow"
                    )}
                  </p>
                </Tooltip>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SuggestedUsers;
