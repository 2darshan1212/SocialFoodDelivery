import { useState, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { 
  followOrUnfollow, 
  addFollowing, 
  removeFollowing, 
  clearOptimisticUpdate,
  selectFollowings,
  selectUserLoading,
  selectIsFollowing,
  fetchCurrentUserFollowings
} from "../redux/userSlice";
import { toast } from "react-toastify";

const useFollowUser = () => {
  const dispatch = useDispatch();
  const { user } = useSelector((store) => store.auth);
  const followings = useSelector(selectFollowings);
  const loading = useSelector(selectUserLoading);
  
  const [processingUsers, setProcessingUsers] = useState(new Set());

  // Check if a user is being followed
  const isFollowing = useCallback((userId) => {
    if (!userId || !Array.isArray(followings)) return false;
    return followings.includes(userId);
  }, [followings]);

  // Check if a user is currently being processed
  const isProcessing = useCallback((userId) => {
    return processingUsers.has(userId);
  }, [processingUsers]);

  // Follow or unfollow a user
  const toggleFollow = useCallback(async (targetUserId, targetUsername = "user") => {
    // Validation checks
    if (!targetUserId) {
      toast.error("Invalid user");
      return { success: false, error: "Invalid user ID" };
    }

    if (!user?._id) {
      toast.error("Please login to follow users");
      return { success: false, error: "Not authenticated" };
    }

    if (user._id === targetUserId) {
      toast.error("You cannot follow yourself");
      return { success: false, error: "Cannot follow self" };
    }

    // Prevent multiple simultaneous requests for the same user
    if (processingUsers.has(targetUserId)) {
      console.log("Already processing follow/unfollow for user:", targetUserId);
      return { success: false, error: "Already processing" };
    }

    // Prevent action during global loading
    if (loading) {
      console.log("Global user loading state active, skipping action");
      return { success: false, error: "Please wait..." };
    }

    try {
      // Mark user as being processed
      setProcessingUsers(prev => new Set(prev).add(targetUserId));

      // Get current following status
      const currentlyFollowing = isFollowing(targetUserId);
      const willBeFollowing = !currentlyFollowing;

      console.log(`🎯 ${willBeFollowing ? 'Following' : 'Unfollowing'} user:`, {
        targetUserId,
        targetUsername,
        currentlyFollowing,
        willBeFollowing,
        currentFollowings: followings
      });

      // Optimistic update for immediate UI feedback
      if (willBeFollowing) {
        dispatch(addFollowing(targetUserId));
      } else {
        dispatch(removeFollowing(targetUserId));
      }

      // Show immediate feedback
      const action = willBeFollowing ? "Following" : "Unfollowing";
      toast.info(`${action} ${targetUsername}...`, { autoClose: 1000 });

      // Perform the actual API call
      const result = await dispatch(followOrUnfollow(targetUserId)).unwrap();

      console.log("✅ Follow/unfollow API result:", result);

      // Clear optimistic update since server state is now authoritative
      dispatch(clearOptimisticUpdate(targetUserId));

      // Show success message
      const actionPast = result.isFollowing ? "followed" : "unfollowed";
      toast.success(`Successfully ${actionPast} ${targetUsername}`);

      // Refresh followings
      dispatch(fetchCurrentUserFollowings());

      return {
        success: true,
        isFollowing: result.isFollowing,
        message: result.message
      };

    } catch (error) {
      console.error("❌ Follow/unfollow failed:", error);

      // Revert optimistic update on error
      // We need to revert to the ORIGINAL state, not flip it again
      const wasFollowingBefore = !willBeFollowing; // The opposite of what we tried to do
      if (wasFollowingBefore) {
        // If user was following before, add them back
        dispatch(addFollowing(targetUserId));
      } else {
        // If user was not following before, remove them
        dispatch(removeFollowing(targetUserId));
      }

      // Clear optimistic update
      dispatch(clearOptimisticUpdate(targetUserId));

      // Show error message
      const errorMessage = error?.message || "Failed to follow/unfollow user. Please try again.";
      toast.error(errorMessage);

      // Refresh followings
      dispatch(fetchCurrentUserFollowings());

      return {
        success: false,
        error: errorMessage
      };

    } finally {
      // Remove user from processing set
      setProcessingUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(targetUserId);
        return newSet;
      });
    }
  }, [dispatch, user, isFollowing, processingUsers, loading]);

  // Get following status for a specific user
  const getFollowingStatus = useCallback((userId) => {
    return {
      isFollowing: isFollowing(userId),
      isProcessing: isProcessing(userId),
      isLoading: loading
    };
  }, [isFollowing, isProcessing, loading]);

  // Get follower count for current user
  const getFollowerCount = useCallback(() => {
    return followings.length;
  }, [followings]);

  return {
    // Actions
    toggleFollow,
    
    // State queries
    isFollowing,
    isProcessing,
    getFollowingStatus,
    getFollowerCount,
    
    // Raw state
    followings,
    loading,
    
    // Utility
    isLoggedIn: !!user,
    currentUserId: user?._id
  };
};

export default useFollowUser; 