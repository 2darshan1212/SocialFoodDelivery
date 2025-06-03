import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchCurrentUserFollowings } from "../redux/userSlice";

const useFollowingsManager = () => {
  const dispatch = useDispatch();
  const { user } = useSelector((store) => store.auth);
  const { followings, lastAction } = useSelector((store) => store.user);

  // Fetch followings when user logs in
  useEffect(() => {
    if (user && user._id) {
      console.log("User logged in, fetching followings...");
      dispatch(fetchCurrentUserFollowings());
    }
  }, [user, dispatch]);

  // Refresh followings after follow/unfollow actions
  useEffect(() => {
    if (lastAction && lastAction.timestamp && user && user._id) {
      // Check if this is a recent action (within the last 3 seconds)
      const isRecent = Date.now() - lastAction.timestamp < 3000;
      
      if (isRecent) {
        console.log("Recent follow/unfollow action detected, refreshing followings...");
        // Delay the refresh slightly to ensure server state is updated
        setTimeout(() => {
          dispatch(fetchCurrentUserFollowings());
        }, 500);
      }
    }
  }, [lastAction, user, dispatch]);

  return {
    followings,
    isLoggedIn: !!user,
    refreshFollowings: () => {
      if (user && user._id) {
        dispatch(fetchCurrentUserFollowings());
      }
    }
  };
};

export default useFollowingsManager; 