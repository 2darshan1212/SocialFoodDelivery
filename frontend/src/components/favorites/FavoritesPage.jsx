import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import axios from "axios";
import toast from "react-hot-toast";
import {
  CircularProgress,
  Box,
  IconButton,
  Tabs,
  Tab,
  Typography,
  Paper,
  Grid,
  Card,
  CardMedia,
  CardContent,
  Avatar,
  Button,
  Chip,
  Menu,
  MenuItem,
  Divider,
  Alert,
  Container
} from "@mui/material";
import {
  ArrowLeft,
  Heart,
  Bookmark,
  Star,
  MessageCircle,
  Filter,
  Search,
  Tag,
  Clock,
  MapPin,
  BarChart2,
  Award,
  RefreshCcw,
  Home,
  Bell,
  PlusSquare,
  Menu as MenuIcon
} from "lucide-react";
import Header from "../header/Header";
import Leftsidebar from "../left/Leftsidebar";
import MobileNavItem from "../left/MobileNavItem";
import MobileSidebar from "../left/MobileSidebar";
import PostCard from "../post/PostCard";
import { setPosts } from "../../redux/postSlice";
import { updateBookmarks, syncUserBookmarks } from "../../redux/authSlice";
import "./favorites.css"; // Import custom CSS

const FavoritesPage = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  
  const { user, bookmarksLoading, bookmarksError } = useSelector(
    (store) => store.auth
  );
  const { posts } = useSelector((store) => store.post);

  // Mobile sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [syncingBookmarks, setSyncingBookmarks] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  const [filterMenuAnchor, setFilterMenuAnchor] = useState(null);
  const [sortBy, setSortBy] = useState("newest");
  const [favoritePosts, setFavoritePosts] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState([]);

  // Toggle mobile sidebar
  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  // Define applyFiltersAndSort first, before we use it in loadFavorites
  // Apply filters and sorting to posts
  const applyFiltersAndSort = useCallback(
    (posts) => {
      // Filter by search query
      let filtered = posts;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        filtered = filtered.filter(
          (post) =>
            post.caption?.toLowerCase().includes(query) ||
            post.author?.username?.toLowerCase().includes(query) ||
            post.category?.toLowerCase().includes(query)
        );
      }

      // Apply category/tag filters
      if (activeFilters.length > 0) {
        filtered = filtered.filter(
          (post) =>
            activeFilters.includes(post.category) ||
            (post.tags && post.tags.some((tag) => activeFilters.includes(tag)))
        );
      }

      // Sort posts
      return filtered.sort((a, b) => {
        switch (sortBy) {
          case "newest":
            return new Date(b.createdAt) - new Date(a.createdAt);
          case "oldest":
            return new Date(a.createdAt) - new Date(b.createdAt);
          case "most_liked":
            return (b.likes?.length || 0) - (a.likes?.length || 0);
          case "most_commented":
            return (b.comments?.length || 0) - (a.comments?.length || 0);
          case "highest_rated":
            return (b.ratings || 0) - (a.ratings || 0);
          default:
            return new Date(b.createdAt) - new Date(a.createdAt);
        }
      });
    },
    [sortBy, searchQuery, activeFilters]
  );

  // Now define loadFavorites, which depends on applyFiltersAndSort
  const loadFavorites = useCallback(async () => {
    if (!user) {
      console.log("No user found, cannot show favorites");
      setFavoritePosts([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      console.log(
        "User:",
        user._id,
        "Bookmarks:",
        user.bookmarks ? user.bookmarks.length : 0
      );

      // Check if user has bookmarks array initialized
      if (
        !user.bookmarks ||
        !Array.isArray(user.bookmarks) ||
        user.bookmarks.length === 0
      ) {
        console.log("No bookmarks found");
        setFavoritePosts([]);
        setLoading(false);
        return;
      }

      // Always fetch fresh data from API to ensure we have latest bookmarks
      try {
        console.log("Fetching bookmarked posts from API");
        const bookmarksResponse = await axios.get(
          `${
            import.meta.env.VITE_API_URL ||
            "https://socialfooddelivery-2.onrender.com"
          }/api/v1/post/bookmarked`,
          {
            withCredentials: true,
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
          }
        );

        if (
          bookmarksResponse.data.success &&
          Array.isArray(bookmarksResponse.data.posts)
        ) {
          const fetchedPosts = bookmarksResponse.data.posts;
          console.log(
            "Successfully fetched bookmarked posts:",
            fetchedPosts.length
          );

          if (fetchedPosts.length > 0) {
            // Apply filters and sorting
            setFavoritePosts(applyFiltersAndSort(fetchedPosts));

            // Update Redux store with these posts
            dispatch(
              setPosts([
                ...posts.filter(
                  (p) => !fetchedPosts.find((fp) => fp._id === p._id)
                ),
                ...fetchedPosts,
              ])
            );

            // Make sure Redux bookmarks array is in sync
            const bookmarkIds = fetchedPosts.map((post) => post._id);
            if (
              JSON.stringify(bookmarkIds.sort()) !==
              JSON.stringify([...user.bookmarks].sort())
            ) {
              console.log("Updating Redux bookmarks to match backend");
              await dispatch(syncUserBookmarks()).unwrap();
            }

            setLoading(false);
            return;
          }
        }
      } catch (directError) {
        console.error("Bookmarks endpoint failed:", directError.message);
      }

      // Fallback to Redux data
      const reduxFavorites = posts.filter(
        (post) => post._id && user.bookmarks.includes(post._id)
      );

      if (reduxFavorites.length > 0) {
        console.log(
          "Using favorites from Redux store as fallback:",
          reduxFavorites.length
        );
        setFavoritePosts(applyFiltersAndSort(reduxFavorites));
        setLoading(false);
        return;
      }

      // Final fallback: all posts filtered by bookmarks
      try {
        const response = await axios.get(
          `${
            import.meta.env.VITE_API_URL ||
            "https://socialfooddelivery-2.onrender.com"
          }/api/v1/post/all`,
          {
            withCredentials: true,
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
          }
        );

        if (response.data.success && Array.isArray(response.data.posts)) {
          // Update Redux store with all posts
          dispatch(setPosts(response.data.posts));

          // Filter to get bookmarked posts
          const bookmarkedPosts = response.data.posts.filter((post) =>
            user.bookmarks.includes(post._id)
          );

          console.log(
            `Found ${bookmarkedPosts.length} bookmarked posts from all posts API`
          );

          // Set filtered and sorted favorites
          setFavoritePosts(applyFiltersAndSort(bookmarkedPosts));
        } else {
          toast.error("Failed to fetch posts");
          setFavoritePosts([]);
        }
      } catch (error) {
        console.error("Error fetching all posts:", error);
        toast.error(
          error?.response?.data?.message ||
            error.message ||
            "Error loading posts"
        );
        setFavoritePosts([]);
      }
    } catch (error) {
      console.error("Error in loadFavorites:", error);
      toast.error(
        error?.response?.data?.message ||
          error.message ||
          "Error loading favorites"
      );
      setFavoritePosts([]);
    } finally {
      setLoading(false);
    }
  }, [user, posts, dispatch, applyFiltersAndSort]);

  // Sync user bookmarks when component mounts
  useEffect(() => {
    const syncBookmarks = async () => {
      if (user?._id) {
        setSyncingBookmarks(true);
        try {
          await dispatch(syncUserBookmarks()).unwrap();
          console.log("Bookmarks synced on mount");
        } catch (err) {
          console.error("Failed to sync bookmarks on mount:", err);
        } finally {
          setSyncingBookmarks(false);
        }
      }
    };

    syncBookmarks();
  }, [dispatch, user?._id]);

  // Load favorites when user, bookmarks, or filters change
  useEffect(() => {
    loadFavorites();
  }, [loadFavorites]);

  // All of the handlers and functions below
  // Handle tab change
  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  // Handle filter menu
  const openFilterMenu = (event) => {
    setFilterMenuAnchor(event.currentTarget);
  };

  const closeFilterMenu = () => {
    setFilterMenuAnchor(null);
  };

  // Apply a sort option
  const handleSort = (sortOption) => {
    setSortBy(sortOption);
    closeFilterMenu();
  };

  // Toggle a filter
  const toggleFilter = (filter) => {
    if (activeFilters.includes(filter)) {
      setActiveFilters(activeFilters.filter((f) => f !== filter));
    } else {
      setActiveFilters([...activeFilters, filter]);
    }
  };

  // Remove bookmark
  const handleRemoveBookmark = async (postId) => {
    try {
      const res = await axios.get(
        `${
          import.meta.env.VITE_API_URL ||
          "https://socialfooddelivery-2.onrender.com"
        }/api/v1/post/${postId}/bookmark`,
        {
          withCredentials: true,
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );

      if (res.data.success) {
        // Update bookmarks in Redux
        dispatch(updateBookmarks(postId));
        toast.success(res.data.message || "Removed from favorites");

        // Reload favorites to reflect changes
        setTimeout(() => loadFavorites(), 300);
      }
    } catch (error) {
      toast.error(
        error?.response?.data?.message || "Error removing from favorites"
      );
    }
  };

  // Reset all filters
  const resetFilters = () => {
    setSearchQuery("");
    setActiveFilters([]);
    setSortBy("newest");
    closeFilterMenu();
  };

  // Add a handleRefreshBookmarks function to manually refresh bookmarks
  const handleRefreshBookmarks = async () => {
    setSyncingBookmarks(true);
    try {
      await dispatch(syncUserBookmarks()).unwrap();
      await loadFavorites();
      toast.success("Bookmarks refreshed successfully");
    } catch (error) {
      console.error("Failed to refresh bookmarks:", error);
      toast.error("Failed to refresh bookmarks");
    } finally {
      setSyncingBookmarks(false);
    }
  };

  // Get unique categories from favorites
  const uniqueCategories = [
    ...new Set(
      favoritePosts.filter((post) => post.category).map((post) => post.category)
    ),
  ];

  const TabPanel = (props) => {
    const { children, value, index, ...other } = props;

    return (
      <div
        role="tabpanel"
        hidden={value !== index}
        id={`favorites-tabpanel-${index}`}
        aria-labelledby={`favorites-tab-${index}`}
        {...other}
      >
        {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
      </div>
    );
  };

  return (
    <div>
      <div className="min-h-screen flex flex-col">
        <Header />
        {/* Main Layout */}
        <div className="flex flex-1 flex-col md:flex-row gap-4 p-4 pb-24 md:pb-4">
          {/* Left Sidebar sticky on md+ */}
          <aside className="hidden md:flex md:flex-col md:w-20 lg:w-64">
            <Leftsidebar />
          </aside>

          {/* Center Content */}
          <Container maxWidth="xl" sx={{ px: { xs: 2, sm: 3 }, py: { xs: 2, sm: 3 } }}>
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between mb-4 sm:mb-6">
              <div className="flex items-center mb-2 sm:mb-0">
                <h1 className="text-lg sm:text-xl font-semibold ml-1 sm:ml-2">My Favorites</h1>
                <IconButton
                  onClick={handleRefreshBookmarks}
                  disabled={syncingBookmarks}
                  title="Refresh bookmarks"
                  color="primary"
                  size="small"
                  sx={{ ml: { xs: 0.5, sm: 1 }, padding: { xs: 0.5, sm: 1 } }}
                >
                  <RefreshCcw
                    size={14}
                    className={syncingBookmarks ? "animate-spin" : ""}
                  />
                </IconButton>
              </div>

              <div className="flex flex-wrap items-center gap-1 sm:gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:flex-initial">
                  <input
                    type="text"
                    placeholder="Search favorites..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-7 sm:pl-8 pr-3 sm:pr-4 py-1.5 sm:py-2 text-sm rounded-full border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-transparent search-input w-full"
                  />
                  <Search
                    className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400"
                    size={16}
                  />
                </div>

                <IconButton
                  aria-label="filter"
                  onClick={openFilterMenu}
                  className={activeFilters.length > 0 ? "bg-orange-50" : ""}
                >
                  <Filter
                    size={20}
                    className={activeFilters.length > 0 ? "text-orange-500" : ""}
                  />
                </IconButton>

                <Menu
                  anchorEl={filterMenuAnchor}
                  open={Boolean(filterMenuAnchor)}
                  onClose={closeFilterMenu}
                  PaperProps={{
                    elevation: 3,
                    sx: { width: 240, padding: 1, maxHeight: 500 },
                  }}
                >
                  <div style={{ padding: "8px 16px" }}>
                    <Typography variant="subtitle2" className="font-semibold mb-2">
                      Sort By
                    </Typography>
                    <MenuItem
                      onClick={() => handleSort("newest")}
                      selected={sortBy === "newest"}
                      dense
                    >
                      <Clock size={16} style={{ marginRight: 8 }} /> Newest First
                    </MenuItem>
                    <MenuItem
                      onClick={() => handleSort("oldest")}
                      selected={sortBy === "oldest"}
                      dense
                    >
                      <Clock size={16} style={{ marginRight: 8 }} /> Oldest First
                    </MenuItem>
                    <MenuItem
                      onClick={() => handleSort("most_liked")}
                      selected={sortBy === "most_liked"}
                      dense
                    >
                      <Heart size={16} style={{ marginRight: 8 }} /> Most Liked
                    </MenuItem>
                    <MenuItem
                      onClick={() => handleSort("most_commented")}
                      selected={sortBy === "most_commented"}
                      dense
                    >
                      <MessageCircle size={16} style={{ marginRight: 8 }} /> Most
                      Commented
                    </MenuItem>
                    <MenuItem
                      onClick={() => handleSort("highest_rated")}
                      selected={sortBy === "highest_rated"}
                      dense
                    >
                      <Star size={16} style={{ marginRight: 8 }} /> Highest Rated
                    </MenuItem>

                    <Divider sx={{ my: 2 }} />

                    <Typography variant="subtitle2" className="font-semibold mb-2">
                      Filter By Category
                    </Typography>

                    {uniqueCategories.length > 0 ? (
                      uniqueCategories.map((category) => (
                        <MenuItem
                          key={category}
                          onClick={() => toggleFilter(category)}
                          selected={activeFilters.includes(category)}
                          dense
                        >
                          <Tag size={16} style={{ marginRight: 8 }} /> {category}
                        </MenuItem>
                      ))
                    ) : (
                      <MenuItem disabled dense>
                        No categories available
                      </MenuItem>
                    )}

                    <Divider sx={{ my: 2 }} />

                    <Button
                      variant="outlined"
                      fullWidth
                      size="small"
                      onClick={resetFilters}
                      disabled={
                        !activeFilters.length && sortBy === "newest" && !searchQuery
                      }
                    >
                      Reset Filters
                    </Button>
                  </div>
                </Menu>
              </div>
            </div>

            {/* Show error message if bookmarks syncing failed */}
            {bookmarksError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                Error syncing bookmarks: {bookmarksError}
              </Alert>
            )}

            {/* Active filters display */}
            {activeFilters.length > 0 && (
              <Box sx={{ mb: 2, display: "flex", flexWrap: "wrap", gap: 1 }}>
                {activeFilters.map((filter) => (
                  <Chip
                    key={filter}
                    label={filter}
                    onDelete={() => toggleFilter(filter)}
                    color="primary"
                    variant="outlined"
                    size="small"
                    className="category-tag"
                  />
                ))}
              </Box>
            )}

            {/* Tabs */}
            <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
              <Tabs
                value={tabValue}
                onChange={handleTabChange}
                variant="scrollable"
                scrollButtons="auto"
                TabIndicatorProps={{
                  className: "custom-tab-indicator",
                }}
                sx={{ 
                  '& .MuiTab-root': { 
                    fontSize: { xs: '0.75rem', sm: '0.875rem' },
                    minHeight: { xs: '48px', sm: '48px' },
                    py: { xs: 1, sm: 1.5 },
                    px: { xs: 1, sm: 2 }
                  }
                }}
              >
                <Tab
                  label="All Favorites"
                  icon={<Bookmark size={14} />}
                  iconPosition="start"
                />
                <Tab
                  label="Food Items"
                  icon={<Star size={14} />}
                  iconPosition="start"
                />
                <Tab
                  label="Food Locations"
                  icon={<MapPin size={14} />}
                  iconPosition="start"
                />
              </Tabs>
            </Box>

            {/* Loading state */}
            {loading ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
                <CircularProgress />
              </Box>
            ) : (
              <>
                {/* All Favorites Tab */}
                <TabPanel value={tabValue} index={0}>
                  {favoritePosts.length > 0 ? (
                    <div className="space-y-4 favorites-container">
                      {favoritePosts.map((post) => (
                        <PostCard key={post._id} post={post} />
                      ))}
                    </div>
                  ) : (
                    <div className="empty-favorites">
                      <Bookmark size={48} className="mx-auto mb-4 bookmark-pulse" />
                      <Typography variant="h6" gutterBottom>
                        No favorites found
                      </Typography>
                      <Typography variant="body2" color="textSecondary" gutterBottom>
                        You haven't added any posts to your favorites yet.
                      </Typography>
                      <Button
                        variant="contained"
                        color="primary"
                        onClick={() => navigate("/")}
                        sx={{ mt: 2 }}
                      >
                        Explore Posts
                      </Button>
                    </div>
                  )}
                </TabPanel>

                {/* Food Items Tab */}
                <TabPanel value={tabValue} index={1}>
                  {favoritePosts.filter(
                    (post) => post.category === "Food" || post.category === "Dessert"
                  ).length > 0 ? (
                    <Grid container spacing={{ xs: 1, sm: 2, md: 3 }} className="favorites-container">
                      {favoritePosts
                        .filter(
                          (post) =>
                            post.category === "Food" || post.category === "Dessert"
                        )
                        .map((post) => (
                          <Grid item xs={6} sm={6} md={4} lg={3} key={post._id}>
                            <Card className="h-full flex flex-col favorite-card">
                              <CardMedia
                                component="img"
                                height="140"
                                image={post.image}
                                alt={post.caption}
                                sx={{ height: 180, objectFit: "cover" }}
                                onClick={() => navigate(`/post/${post._id}`)}
                                className="cursor-pointer"
                              />
                              <CardContent className="flex-1">
                                <Typography variant="h6" component="div" className="mb-2 line-clamp-2">
                                  {post.caption}
                                </Typography>
                                <div className="flex items-center gap-2 mb-2">
                                  <Avatar src={post.author?.profilePicture} sx={{ width: 24, height: 24 }} />
                                  <Typography variant="body2" color="textSecondary">
                                    {post.author?.username}
                                  </Typography>
                                </div>
                                {post.category && (
                                  <Chip
                                    label={post.category}
                                    size="small"
                                    variant="outlined"
                                    className="mb-2 category-tag"
                                  />
                                )}
                                <div className="mt-auto pt-2 flex justify-between items-center">
                                  <div className="flex items-center gap-2">
                                    <span className="text-yellow-500 font-bold">
                                      {"⭐".repeat(post.ratings || 0)}
                                    </span>
                                    <Typography
                                      variant="caption"
                                      color="textSecondary"
                                    >
                                      {post.likes?.length || 0} likes
                                    </Typography>
                                  </div>
                                  {post.price && (
                                    <Typography variant="subtitle2" color="primary">
                                      ₹{post.price}
                                    </Typography>
                                  )}
                                </div>
                              </CardContent>
                            </Card>
                          </Grid>
                        ))}
                    </Grid>
                  ) : (
                    <div className="empty-favorites">
                      <Star size={48} className="mx-auto mb-4" />
                      <Typography variant="h6" gutterBottom>
                        No favorite food items
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        You haven't added any food items to your favorites yet.
                      </Typography>
                    </div>
                  )}
                </TabPanel>

                {/* Food Locations Tab */}
                <TabPanel value={tabValue} index={2}>
                  {favoritePosts.filter((post) => post.location).length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 favorites-container">
                      {favoritePosts
                        .filter((post) => post.location)
                        .map((post) => (
                          <Paper
                            key={post._id}
                            elevation={1}
                            className="p-2 sm:p-4 flex gap-2 sm:gap-4 favorite-card"
                          >
                            <img
                              src={post.image}
                              alt={post.caption}
                              className="w-16 h-16 sm:w-24 sm:h-24 object-cover rounded-md cursor-pointer flex-shrink-0"
                              onClick={() => navigate(`/post/${post._id}`)}
                            />
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-sm sm:text-base truncate mb-1">
                                {post.caption}
                              </h3>
                              <div className="flex items-center gap-1 sm:gap-2 mb-1">
                                <Avatar src={post.author?.profilePicture} sx={{ width: 16, height: 16 }} />
                                <span className="text-xs text-gray-600 truncate">
                                  {post.author?.username}
                                </span>
                              </div>
                              <div className="flex items-center text-xs text-gray-500 mb-1">
                                <MapPin size={12} className="mr-0.5 sm:mr-1 flex-shrink-0" />
                                <span className="truncate">{post.location}</span>
                              </div>
                              <div className="flex items-center gap-2 sm:gap-3 mt-1 sm:mt-2">
                                <span className="text-yellow-500 font-bold text-xs sm:text-sm">
                                  {"⭐".repeat(post.ratings || 0)}
                                </span>
                                <span className="text-xs text-gray-500 flex items-center">
                                  <Heart size={12} className="mr-0.5 sm:mr-1 flex-shrink-0" />{" "}
                                  {post.likes?.length || 0}
                                </span>
                                <span className="text-xs text-gray-500 flex items-center">
                                  <MessageCircle size={12} className="mr-0.5 sm:mr-1 flex-shrink-0" />{" "}
                                  {post.comments?.length || 0}
                                </span>
                              </div>
                            </div>
                          </Paper>
                        ))}
                    </div>
                  ) : (
                    <div className="empty-favorites">
                      <MapPin size={48} className="mx-auto mb-4" />
                      <Typography variant="h6" gutterBottom>
                        No favorite food locations
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        You haven't added any food locations to your favorites yet.
                      </Typography>
                    </div>
                  )}
                </TabPanel>
              </>
            )}

            {/* Stats at the bottom */}
            {!loading && favoritePosts.length > 0 && (
              <Paper elevation={0} className="mt-4 sm:mt-6 p-3 sm:p-4 stats-card">
                <Typography variant="subtitle2" gutterBottom className="stats-title" sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                  <BarChart2 size={16} style={{ marginRight: 6 }} /> Favorites
                  Statistics
                </Typography>
                <Grid container spacing={1} className="mt-0.5 sm:mt-1">
                  <Grid item xs={6} sm={3}>
                    <div className="text-center">
                      <Typography variant="h6" className="stat-value">
                        {favoritePosts.length}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="textSecondary"
                        className="stat-label"
                      >
                        Total Favorites
                      </Typography>
                    </div>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <div className="text-center">
                      <Typography variant="h6" className="stat-value">
                        {uniqueCategories.length}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="textSecondary"
                        className="stat-label"
                      >
                        Categories
                      </Typography>
                    </div>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <div className="text-center">
                      <Typography variant="h6" className="stat-value">
                        {favoritePosts.reduce(
                          (sum, post) => sum + (post.likes?.length || 0),
                          0
                        )}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="textSecondary"
                        className="stat-label"
                      >
                        Total Likes
                      </Typography>
                    </div>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <div className="text-center">
                      <Typography variant="h6" className="stat-value">
                        {favoritePosts.reduce(
                          (sum, post) => sum + (post.comments?.length || 0),
                          0
                        )}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="textSecondary"
                        className="stat-label"
                      >
                        Total Comments
                      </Typography>
                    </div>
                  </Grid>
                </Grid>
              </Paper>
            )}
          </Container>
        </div>

        {/* Mobile Sidebar Drawer */}
        <MobileSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        
        {/* Mobile Bottom Navigation */}
        <div className="fixed bottom-0 left-0 right-0 block md:hidden bg-white border-t shadow-lg z-50">
          <div className="flex justify-around items-center h-16">
            <MobileNavItem icon={<Home size={24} />} label="Home" path="/" />
            <MobileNavItem icon={<Bell size={24} />} label="Notifications" path="/notifications" />
            <MobileNavItem icon={<PlusSquare size={24} />} label="Post" path="/create-post" isPostButton={true} />
            <MobileNavItem icon={<MessageCircle size={24} />} label="Messages" path="/chat/chatpage" />
            <button 
              onClick={toggleSidebar} 
              className="flex flex-col items-center justify-center p-2 text-gray-600 hover:text-primary-600 focus:outline-none"
            >
              <MenuIcon size={24} />
              <span className="text-xs mt-1">Menu</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FavoritesPage;
