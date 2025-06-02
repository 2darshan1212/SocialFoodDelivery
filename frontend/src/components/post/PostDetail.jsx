import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import axios from "axios";
import { toast } from "react-toastify";
import {
  CircularProgress,
  Box,
  IconButton,
  Button,
  Divider,
  Paper,
  Rating,
  Typography,
  LinearProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Alert,
  Container,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import {
  ArrowLeft,
  MessageCircle,
  Heart,
  Star,
  Shield,
  ChevronDown,
} from "lucide-react";
import PostCard from "./PostCard";
import { setSelectedPost } from "../../redux/postSlice";
import CommentDialog from "../comment/CommentDialog";
import RecipeIPRegistration from "../story/RecipeIPRegistration";
import RecipeIPDetails from "../story/RecipeIPDetails";
import { useStoryProtocol } from "../../providers/StoryProtocolProvider";

// API base URL from environment or default to localhost
const API_BASE_URL =
  import.meta.env.VITE_API_URL || "https://socialfooddelivery-2.onrender.com";

const PostDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [commentDialogOpen, setCommentDialogOpen] = useState(false);
  const [ratings, setRatings] = useState(null);
  const [loadingRatings, setLoadingRatings] = useState(false);
  const [registrationComplete, setRegistrationComplete] = useState(false);
  
  const { user } = useSelector((store) => store.auth);
  const { isInitialized } = useStoryProtocol();

  // Check if post exists in Redux store
  const { posts } = useSelector((store) => store.post);
  const postInRedux = posts.find((p) => p._id === id);

  console.log(`Post detail - ID: ${id}, Found in Redux: ${!!postInRedux}`);

  // If post is in Redux, use it immediately
  useEffect(() => {
    if (postInRedux) {
      console.log("Using post from Redux:", postInRedux);
      setPost(postInRedux);
      setLoading(false); // Set loading to false immediately
    }
  }, [postInRedux]);

  // Fetch post data from API regardless of Redux state
  useEffect(() => {
    const fetchPost = async () => {
      if (!id || id.trim() === "") {
        setError("Post ID is missing");
        toast.error("Post ID is missing");
        setLoading(false);
        return;
      }

      try {
        console.log(`Fetching post data for ID: ${id}`);
        setLoading(!post); // Only show loading if we don't have the post yet

        const response = await axios.get(`${API_BASE_URL}/api/v1/post/${id}`, {
          withCredentials: true,
        });

        console.log("API response:", response.data);

        if (response.data.success) {
          if (response.data.post) {
            console.log("Post data structure:", response.data.post);
            console.log("User data:", user);
            setPost(response.data.post);
            // Update Redux with the latest post data
            dispatch(setSelectedPost(response.data.post));
          } else {
            setError("Post data is missing");
            toast.error("Post data is missing");
          }
        } else {
          setError(response.data.message || "Post not found");
          toast.error(response.data.message || "Post not found");
        }
      } catch (err) {
        console.error("Error fetching post:", err);
        // Extract error message from response if available
        let errorMessage = "Error fetching post";

        if (err.response) {
          // The request was made and the server responded with an error status
          errorMessage = err.response.data?.message || errorMessage;
          console.log(
            `Server returned error status ${err.response.status}: ${errorMessage}`
          );

          // If it's a "Post not found" or "Invalid post ID" error, display a more user-friendly message
          if (
            err.response.status === 404 ||
            (err.response.status === 400 && errorMessage.includes("ID"))
          ) {
            errorMessage = "This post does not exist or has been removed";
          }
        } else if (err.request) {
          // The request was made but no response was received
          console.log("No response received from server");
          errorMessage = "Unable to connect to server";
        }

        setError(errorMessage);
        toast.error(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchPost();
    } else {
      setError("Post ID is required");
      setLoading(false);
    }

    // Return cleanup function
    return () => {
      // Cleanup
    };
  }, [id, dispatch]);

  // Fetch ratings data
  useEffect(() => {
    const fetchRatings = async () => {
      if (!post || !id) return;

      setLoadingRatings(true);
      try {
        const response = await axios.get(
          `${API_BASE_URL}/api/v1/post/${id}/ratings`,
          { withCredentials: true }
        );

        if (response.data.success) {
          setRatings(response.data.ratings);
        }
      } catch (error) {
        console.error("Error fetching ratings:", error);
      } finally {
        setLoadingRatings(false);
      }
    };

    fetchRatings();
  }, [id, post]);

  const openComments = () => {
    if (post) {
      dispatch(setSelectedPost(post));
      setCommentDialogOpen(true);
    }
  };

  // Calculate percentage for star rating distribution
  const calculatePercentage = (count) => {
    if (!ratings || !ratings.count || ratings.count === 0) return 0;
    return Math.round((count / ratings.count) * 100);
  };

  // Render Rating Summary
  const renderRatingsSummary = () => {
    if (loadingRatings) {
      return (
        <Box sx={{ display: "flex", justifyContent: "center", p: 3 }}>
          <CircularProgress size={24} />
        </Box>
      );
    }

    if (!ratings) {
      return (
        <Typography
          color="text.secondary"
          variant="body2"
          sx={{ py: 2, textAlign: "center" }}
        >
          No ratings information available
        </Typography>
      );
    }

    return (
      <Box>
        <Box sx={{ 
          display: "flex", 
          flexDirection: { xs: 'column', sm: 'row' },
          alignItems: { xs: 'center', sm: 'flex-start' }, 
          mb: 2 
        }}>
          <Box sx={{ 
            textAlign: "center", 
            mr: { xs: 0, sm: 3 },
            mb: { xs: 2, sm: 0 }
          }}>
            <Typography
              variant={isMobile ? "h4" : "h3"}
              component="div"
              sx={{ fontWeight: "bold", color: "primary.main" }}
            >
              {ratings.average ? ratings.average.toFixed(1) : "0.0"}
            </Typography>
            <Rating
              value={ratings.average || 0}
              precision={0.5}
              readOnly
              size={isMobile ? "small" : "medium"}
            />
            <Typography variant="body2" color="text.secondary">
              {ratings.count || 0} {ratings.count === 1 ? "rating" : "ratings"}
            </Typography>
          </Box>

          <Box sx={{ flex: 1, width: '100%' }}>
            {[5, 4, 3, 2, 1].map((star) => (
              <Box key={star} sx={{ 
                display: "flex", 
                alignItems: "center", 
                gap: 1,
                mb: 0.5 
              }}>
                <Typography variant="body2" sx={{ 
                  minWidth: { xs: '20px', sm: '30px' },
                  fontSize: { xs: '0.875rem', sm: '1rem' }
                }}>
                  {star}
                </Typography>
                <Star size={isMobile ? 12 : 16} className="text-yellow-500" />
                <LinearProgress
                  variant="determinate"
                  value={calculatePercentage(ratings.distribution?.[star] || 0)}
                  sx={{
                    flex: 1,
                    height: isMobile ? 6 : 8,
                    borderRadius: 3,
                    backgroundColor: "grey.200",
                    "& .MuiLinearProgress-bar": {
                      backgroundColor: "warning.main",
                      borderRadius: 3,
                    },
                  }}
                />
                <Typography 
                  variant="body2" 
                  color="text.secondary"
                  sx={{ 
                    minWidth: { xs: '30px', sm: '40px' },
                    fontSize: { xs: '0.75rem', sm: '0.875rem' }
                  }}
                >
                  ({ratings.distribution?.[star] || 0})
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>

        {ratings.userRating && (
          <Box sx={{ 
            mt: 2, 
            p: { xs: 1.5, sm: 2 }, 
            bgcolor: "primary.50", 
            borderRadius: 1 
          }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Your Rating
            </Typography>
            <Box sx={{ display: "flex", alignItems: "center" }}>
              <Rating 
                value={ratings.userRating.value} 
                readOnly 
                size={isMobile ? "small" : "small"} 
              />
              <Typography 
                variant="body2" 
                sx={{ 
                  ml: 1,
                  fontSize: { xs: '0.75rem', sm: '0.875rem' }
                }}
              >
                {new Date(ratings.userRating.createdAt).toLocaleDateString()}
              </Typography>
            </Box>
            {ratings.userRating.comment && (
              <Typography 
                variant="body2" 
                sx={{ 
                  mt: 1, 
                  fontStyle: "italic",
                  fontSize: { xs: '0.875rem', sm: '1rem' }
                }}
              >
                "{ratings.userRating.comment}"
              </Typography>
            )}
          </Box>
        )}
      </Box>
    );
  };

  // Debug render state
  console.log("Render state:", { loading, error, hasPost: !!post });

  return (
    <Container 
      maxWidth="xl" 
      sx={{ 
        px: { xs: 2, sm: 3 }, 
        py: { xs: 2, sm: 3 },
        flex: 1 
      }}
    >
      {/* Header with responsive back button */}
      <div className="flex items-center mb-4 sm:mb-6">
        <IconButton 
          onClick={() => navigate(-1)}
          size={isMobile ? "small" : "medium"}
          sx={{ mr: 1 }}
        >
          <ArrowLeft size={isMobile ? 20 : 24} />
        </IconButton>
        <Typography 
          variant={isMobile ? "h6" : "h5"} 
          component="h1" 
          sx={{ fontWeight: 'bold' }}
        >
          Post Details
        </Typography>
      </div>

      {loading ? (
        <Box className="flex justify-center py-8">
          <CircularProgress size={isMobile ? 40 : 60} />
        </Box>
      ) : error && !post ? (
        <Paper 
          elevation={1}
          sx={{ 
            p: { xs: 3, sm: 4 }, 
            bgcolor: "error.50",
            border: 1,
            borderColor: "error.200",
            borderRadius: 2
          }}
        >
          <Typography 
            color="error.main" 
            sx={{ 
              mb: 2,
              fontSize: { xs: '0.875rem', sm: '1rem' }
            }}
          >
            {error}
          </Typography>
          <Button
            variant="outlined"
            color="primary"
            onClick={() => navigate(-1)}
            size={isMobile ? "small" : "medium"}
          >
            Go Back
          </Button>
        </Paper>
      ) : post ? (
        <>
          {/* Main Post Card */}
          <Box sx={{ mb: { xs: 2, sm: 3 } }}>
            <PostCard post={post} />
          </Box>

          {/* Ratings Summary Section */}
          <Paper 
            elevation={1} 
            sx={{ 
              p: { xs: 2, sm: 3 }, 
              mt: { xs: 2, sm: 3 }, 
              borderRadius: 2 
            }}
          >
            <Box
              sx={{
                display: "flex",
                flexDirection: { xs: 'column', sm: 'row' },
                justifyContent: "space-between",
                alignItems: { xs: 'flex-start', sm: 'center' },
                mb: 2,
                gap: { xs: 2, sm: 0 }
              }}
            >
              <Typography
                variant={isMobile ? "subtitle1" : "h6"}
                component="h2"
                sx={{ 
                  display: "flex", 
                  alignItems: "center",
                  fontWeight: 'bold'
                }}
              >
                <Star size={isMobile ? 18 : 20} className="mr-2" /> 
                Ratings & Reviews
              </Typography>
              <Button
                variant="contained"
                color="primary"
                size={isMobile ? "small" : "medium"}
                onClick={() =>
                  document
                    .querySelector(`button[data-post-id="${post._id}"]`)
                    ?.click()
                }
                sx={{ 
                  minWidth: { xs: 'auto', sm: 'auto' },
                  whiteSpace: 'nowrap'
                }}
              >
                {ratings?.userRating ? "Update Rating" : "Rate This Food"}
              </Button>
            </Box>
            <Divider sx={{ mb: 2 }} />
            {renderRatingsSummary()}
          </Paper>

          {/* Intellectual Property (IP) Section */}
          {user && (
            <Paper 
              elevation={1} 
              sx={{ 
                p: { xs: 2, sm: 3 }, 
                mt: { xs: 2, sm: 3 }, 
                borderRadius: 2 
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  flexDirection: { xs: 'column', sm: 'row' },
                  justifyContent: "space-between",
                  alignItems: { xs: 'flex-start', sm: 'center' },
                  mb: 2,
                  gap: { xs: 2, sm: 0 }
                }}
              >
                <Typography
                  variant={isMobile ? "subtitle1" : "h6"}
                  component="h2"
                  sx={{ 
                    display: "flex", 
                    alignItems: "center",
                    fontWeight: 'bold'
                  }}
                >
                  <Shield size={isMobile ? 18 : 20} className="mr-2" /> 
                  Intellectual Property Rights
                </Typography>

                {/* Show registration button for post owners */}
                {post.author?._id === user?._id &&
                  !registrationComplete &&
                  !post.ipRegistered && (
                    <RecipeIPRegistration
                      recipeData={{
                        id: post._id,
                        title: post.caption,
                        description: post.caption,
                        image: post.image,
                        category: post.category || "Recipe",
                        chef: post.author?.username,
                        prepTime: post.preparationTime || "30 mins",
                        cuisine: post.cuisine || "International",
                      }}
                      onRegistrationComplete={() =>
                        setRegistrationComplete(true)
                      }
                    />
                  )}
              </Box>

              <Divider sx={{ mb: 2 }} />

              {post.ipRegistered || registrationComplete ? (
                <Accordion defaultExpanded={!isMobile}>
                  <AccordionSummary expandIcon={<ChevronDown />}>
                    <Typography variant={isMobile ? "body1" : "subtitle1"}>
                      Recipe IP Information
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <RecipeIPDetails recipeId={post._id} />
                  </AccordionDetails>
                </Accordion>
              ) : (
                <Box>
                  {post.author?._id === user?._id ? (
                    <Alert severity="info" sx={{ mb: 2 }}>
                      <Typography 
                        variant={isMobile ? "body2" : "body1"}
                        sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}
                      >
                        You can register this recipe as intellectual property to
                        protect your creation. Complete the registration to
                        establish ownership and set licensing terms.
                      </Typography>
                    </Alert>
                  ) : (
                    <Alert severity="info" sx={{ mb: 2 }}>
                      <Typography 
                        variant={isMobile ? "body2" : "body1"}
                        sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}
                      >
                        This recipe has not been registered for intellectual
                        property protection yet.
                      </Typography>
                    </Alert>
                  )}

                  <Box sx={{ mt: 3 }}>
                    <Typography 
                      variant={isMobile ? "body1" : "subtitle2"}
                      gutterBottom
                      sx={{ fontWeight: 'bold' }}
                    >
                      What is IP protection for recipes?
                    </Typography>
                    <Typography 
                      variant="body2" 
                      color="text.secondary"
                      sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}
                    >
                      Registering a recipe with Story Protocol establishes
                      ownership rights and allows creators to set licensing
                      terms for commercial use, derivatives, and attribution
                      requirements. This can help protect unique recipe
                      creations and potentially earn royalties when others use
                      them commercially.
                    </Typography>
                  </Box>
                </Box>
              )}
            </Paper>
          )}

          {/* Extra interaction section */}
          <Paper 
            elevation={1}
            sx={{ 
              p: { xs: 2, sm: 3 }, 
              mt: { xs: 2, sm: 3 }, 
              borderRadius: 2 
            }}
          >
            <Box sx={{ 
              display: "flex", 
              flexDirection: { xs: 'column', sm: 'row' },
              justifyContent: "space-between", 
              alignItems: { xs: 'flex-start', sm: 'center' }, 
              mb: { xs: 2, sm: 3 },
              gap: { xs: 2, sm: 1 }
            }}>
              <Typography 
                variant={isMobile ? "h6" : "h5"} 
                component="h2"
                sx={{ fontWeight: 'bold' }}
              >
                Engagement
              </Typography>
              <Box sx={{ 
                display: "flex", 
                gap: { xs: 1, sm: 2 },
                flexWrap: 'wrap'
              }}>
                <Button
                  variant="outlined"
                  startIcon={<Heart size={isMobile ? 14 : 16} />}
                  color="error"
                  size={isMobile ? "small" : "medium"}
                >
                  {post.likes?.length || 0} Like{post.likes?.length !== 1 ? 's' : ''}
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<MessageCircle size={isMobile ? 14 : 16} />}
                  onClick={openComments}
                  color="primary"
                  size={isMobile ? "small" : "medium"}
                >
                  {post.comments?.length || 0} Comment{post.comments?.length !== 1 ? 's' : ''}
                </Button>
              </Box>
            </Box>

            <Divider sx={{ mb: { xs: 2, sm: 3 } }} />

            <Box>
              <Typography 
                variant={isMobile ? "subtitle1" : "h6"} 
                sx={{ 
                  fontWeight: 'medium', 
                  mb: { xs: 1, sm: 2 }
                }}
              >
                Recent Activity
              </Typography>
              
              {post.likes && post.likes.length > 0 ? (
                <Typography 
                  variant="body2"
                  sx={{ 
                    mb: 1,
                    fontSize: { xs: '0.875rem', sm: '1rem' }
                  }}
                >
                  Liked by {post.likes.length}{" "}
                  {post.likes.length === 1 ? "person" : "people"}
                </Typography>
              ) : (
                <Typography 
                  variant="body2" 
                  color="text.secondary"
                  sx={{ 
                    mb: 1,
                    fontSize: { xs: '0.875rem', sm: '1rem' }
                  }}
                >
                  No likes yet
                </Typography>
              )}

              {post.comments && post.comments.length > 0 ? (
                <Typography
                  variant="body2"
                  onClick={openComments}
                  sx={{
                    cursor: "pointer",
                    color: "primary.main",
                    "&:hover": { textDecoration: "underline" },
                    fontSize: { xs: '0.875rem', sm: '1rem' }
                  }}
                >
                  View all {post.comments.length} comment{post.comments.length !== 1 ? 's' : ''}
                </Typography>
              ) : (
                <Typography 
                  variant="body2" 
                  color="text.secondary"
                  sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}
                >
                  No comments yet
                </Typography>
              )}
            </Box>
          </Paper>
        </>
      ) : (
        <Paper 
          elevation={1}
          sx={{ 
            p: { xs: 3, sm: 4 }, 
            bgcolor: "grey.100",
            borderRadius: 2
          }}
        >
          <Typography 
            variant="body1" 
            color="text.secondary"
            sx={{ textAlign: 'center' }}
          >
            Post not found
          </Typography>
        </Paper>
      )}

      {/* Comment Dialog */}
      <CommentDialog
        open={commentDialogOpen}
        setOpen={setCommentDialogOpen}
        post={post}
      />
    </Container>
  );
};

export default PostDetail;
