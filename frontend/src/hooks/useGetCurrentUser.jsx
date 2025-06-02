import axios from "axios";
import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { setAuthUser } from "../redux/authSlice";
import { toast } from "react-toastify";

const API_BASE_URL = import.meta.env.VITE_API_URL || "https://socialfooddelivery-2.onrender.com";

const useGetCurrentUser = () => {
  const dispatch = useDispatch();
  const { user } = useSelector((store) => store.auth);

  useEffect(() => {
    const fetchCurrentUser = async () => {
      // Only fetch if we don't have complete user data or if user data seems incomplete
      if (!user || !user.profilePicture || !user.username) {
        try {
          console.log("Fetching current user data...");
          const response = await axios.get(
            `${API_BASE_URL}/api/v1/user/me`,
            {
              withCredentials: true,
              headers: {
                Authorization: `Bearer ${localStorage.getItem('token')}`
              }
            }
          );

          if (response.data.success && response.data.user) {
            console.log("Current user data fetched successfully:", response.data.user);
            dispatch(setAuthUser({
              ...response.data.user,
              isAdmin: response.data.user.isAdmin || false,
            }));
          }
        } catch (error) {
          // Only show error if it's not a 401 (unauthorized) - that means user isn't logged in
          if (error.response?.status !== 401) {
            console.error("Error fetching current user:", error);
            toast.error("Failed to load user profile data");
          }
        }
      }
    };

    // Only fetch if we have a token but incomplete user data
    const token = localStorage.getItem('token');
    if (token && (!user || !user.profilePicture || !user.username)) {
      fetchCurrentUser();
    }
  }, [dispatch, user]);

  return user;
};

export default useGetCurrentUser; 