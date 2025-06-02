import React, { useState, useEffect } from "react";
import axiosInstance from "../../utils/axiosInstance";
import {
  Box,
  Container,
  Typography,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  CircularProgress,
  Alert,
  Snackbar,
  Chip,
  Grid,
  Card,
  CardContent,
  CardActions,
  useMediaQuery,
  useTheme,
  Fab,
  Stack,
  Divider,
  Tooltip
} from "@mui/material";
import {
  Edit,
  Delete,
  Add,
  Refresh,
  Category,
  Restaurant,
  Fastfood,
  LocalDining
} from "@mui/icons-material";

const CategoriesManagement = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
  });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success",
  });

  // Fetch categories on component mount
  useEffect(() => {
    fetchCategories();
  }, []);

  // Fetch categories from the API
  const fetchCategories = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axiosInstance.get("/category/all", {
        withCredentials: true,
      });
      setCategories(response.data.categories || []);
    } catch (err) {
      console.error("Error fetching categories:", err);
      setError("Failed to load categories. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Handle file selection
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Open add category dialog
  const handleOpenAddDialog = () => {
    setFormData({ name: "", description: "" });
    setImageFile(null);
    setImagePreview("");
    setCreateDialogOpen(true);
  };

  // Open edit category dialog
  const handleOpenEditDialog = (category) => {
    setSelectedCategory(category);
    setFormData({
      name: category.name,
      description: category.description || "",
    });
    setImagePreview(category.image || "");
    setImageFile(null);
    setEditDialogOpen(true);
  };

  // Open delete category dialog
  const handleOpenDeleteDialog = (category) => {
    setSelectedCategory(category);
    setDeleteDialogOpen(true);
  };

  // Close all dialogs
  const handleCloseDialogs = () => {
    setCreateDialogOpen(false);
    setEditDialogOpen(false);
    setDeleteDialogOpen(false);
  };

  // Add a new category
  const handleAddCategory = async () => {
    try {
      setLoading(true);

      const formDataObj = new FormData();
      formDataObj.append("name", formData.name);
      formDataObj.append("description", formData.description);

      if (imageFile) {
        formDataObj.append("categoryImage", imageFile);
      }

      await axiosInstance.post("/category/create", formDataObj, {
        withCredentials: true,
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      setSnackbar({
        open: true,
        message: "Category added successfully!",
        severity: "success",
      });

      handleCloseDialogs();
      fetchCategories();
    } catch (err) {
      console.error("Error adding category:", err);
      setSnackbar({
        open: true,
        message: err.response?.data?.message || "Failed to add category",
        severity: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  // Update an existing category
  const handleUpdateCategory = async () => {
    try {
      setLoading(true);

      const formDataObj = new FormData();
      formDataObj.append("name", formData.name);
      formDataObj.append("description", formData.description);

      if (imageFile) {
        formDataObj.append("categoryImage", imageFile);
      }

      await axiosInstance.put(`/category/${selectedCategory._id}`, formDataObj, {
        withCredentials: true,
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      setSnackbar({
        open: true,
        message: "Category updated successfully!",
        severity: "success",
      });

      handleCloseDialogs();
      fetchCategories();
    } catch (err) {
      console.error("Error updating category:", err);
      setSnackbar({
        open: true,
        message: err.response?.data?.message || "Failed to update category",
        severity: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  // Delete a category
  const handleDeleteCategory = async () => {
    try {
      setLoading(true);

      await axiosInstance.delete(`/category/${selectedCategory._id}`, {
        withCredentials: true,
      });

      setSnackbar({
        open: true,
        message: "Category deleted successfully!",
        severity: "success",
      });

      handleCloseDialogs();
      fetchCategories();
    } catch (err) {
      console.error("Error deleting category:", err);
      setSnackbar({
        open: true,
        message: err.response?.data?.message || "Failed to delete category",
        severity: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  // Close notification
  const handleCloseNotification = () => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

  // Category icons mapping
  const getCategoryIcon = (categoryName) => {
    const name = categoryName.toLowerCase();
    if (name.includes('fast') || name.includes('burger') || name.includes('pizza')) {
      return <Fastfood />;
    } else if (name.includes('restaurant') || name.includes('dining')) {
      return <LocalDining />;
    } else if (name.includes('food') || name.includes('meal')) {
      return <Restaurant />;
    }
    return <Category />;
  };

  // Mobile-friendly Category Card Component
  const CategoryCard = ({ category }) => {
    return (
      <Card 
        sx={{ 
          mb: 2, 
          boxShadow: 2,
          '&:hover': { boxShadow: 4 },
          transition: 'box-shadow 0.2s'
        }}
      >
        <CardContent>
          {/* Header */}
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Box sx={{ mr: 2, color: 'primary.main' }}>
              {getCategoryIcon(category.name)}
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="h6" sx={{ fontSize: '1.1rem', fontWeight: 'bold' }}>
                {category.name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {category.description || 'No description'}
              </Typography>
            </Box>
          </Box>
          
          {/* Creation Date */}
          <Typography variant="caption" color="text.secondary">
            Created: {new Date(category.createdAt).toLocaleDateString()}
          </Typography>
        </CardContent>
        
        <CardActions sx={{ justifyContent: 'space-between', px: 2, pb: 2 }}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<Edit />}
            onClick={() => handleOpenEditDialog(category)}
          >
            Edit
          </Button>
          
          <Button
            size="small"
            variant="outlined"
            color="error"
            startIcon={<Delete />}
            onClick={() => handleOpenDeleteDialog(category)}
          >
            Delete
          </Button>
        </CardActions>
      </Card>
    );
  };

  return (
    <Container maxWidth="xl" sx={{ mt: 3, mb: 5 }}>
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h5" component="h1">
            Categories Management
          </Typography>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={handleOpenAddDialog}
            size={isMobile ? "small" : "medium"}
          >
            Add Category
          </Button>
        </Box>

        {/* Refresh button */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={fetchCategories}
            disabled={refreshing}
            size={isMobile ? "small" : "medium"}
          >
            {refreshing ? "Refreshing..." : "Refresh"}
          </Button>
        </Box>
      </Paper>

      {/* Loading state */}
      {loading && (
        <Box sx={{ display: "flex", justifyContent: "center", my: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {/* Error state */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Categories content */}
      {!loading && !error && (
        <>
          {/* Mobile view - Cards */}
          {isMobile ? (
            <Box>
              {categories.length === 0 ? (
                <Paper sx={{ p: 4, textAlign: 'center' }}>
                  <Typography variant="h6" color="text.secondary">
                    No categories found
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Create your first category to get started
                  </Typography>
                </Paper>
              ) : (
                categories.map((category) => (
                  <CategoryCard key={category._id} category={category} />
                ))
              )}
            </Box>
          ) : (
            /* Desktop view - Table */
            <Paper>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Image</TableCell>
                      <TableCell>Name</TableCell>
                      <TableCell>Description</TableCell>
                      <TableCell>Created</TableCell>
                      <TableCell align="center">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {categories.map((category) => (
                      <TableRow key={category._id} hover>
                        <TableCell>
                          {category.image ? (
                            <Box
                              component="img"
                              src={category.image}
                              alt={category.name}
                              sx={{
                                width: 50,
                                height: 50,
                                objectFit: "cover",
                                borderRadius: 1,
                              }}
                            />
                          ) : (
                            <Box
                              sx={{
                                width: 50,
                                height: 50,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                backgroundColor: "grey.100",
                                borderRadius: 1,
                              }}
                            >
                              {getCategoryIcon(category.name)}
                            </Box>
                          )}
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                            {category.name}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {category.description || "No description"}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {new Date(category.createdAt).toLocaleDateString()}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                            <Tooltip title="Edit Category">
                              <IconButton
                                color="primary"
                                onClick={() => handleOpenEditDialog(category)}
                                size="small"
                              >
                                <Edit />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Delete Category">
                              <IconButton
                                color="error"
                                onClick={() => handleOpenDeleteDialog(category)}
                                size="small"
                              >
                                <Delete />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          )}
        </>
      )}

      {/* Floating action button for mobile add */}
      {isMobile && (
        <Fab
          color="primary"
          sx={{
            position: 'fixed',
            bottom: 16,
            right: 16,
            zIndex: 1000,
          }}
          onClick={handleOpenAddDialog}
        >
          <Add />
        </Fab>
      )}

      {/* Add Category Dialog */}
      <Dialog
        open={createDialogOpen}
        onClose={handleCloseDialogs}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Add New Category</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                name="name"
                label="Category Name"
                value={formData.name}
                onChange={handleInputChange}
                fullWidth
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                name="description"
                label="Description"
                value={formData.description}
                onChange={handleInputChange}
                fullWidth
                multiline
                rows={3}
              />
            </Grid>
            <Grid item xs={12}>
              <Button
                variant="outlined"
                component="label"
                startIcon={<Category />}
                sx={{ mb: 2 }}
              >
                Upload Image
                <input
                  type="file"
                  hidden
                  accept="image/*"
                  onChange={handleFileChange}
                />
              </Button>
              {imagePreview && (
                <Box sx={{ mt: 2 }}>
                  <img
                    src={imagePreview}
                    alt="Preview"
                    style={{
                      maxWidth: "100%",
                      maxHeight: 200,
                      objectFit: "contain",
                    }}
                  />
                </Box>
              )}
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialogs}>Cancel</Button>
          <Button
            onClick={handleAddCategory}
            variant="contained"
            disabled={!formData.name || loading}
          >
            {loading ? <CircularProgress size={24} /> : "Add"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Category Dialog */}
      <Dialog
        open={editDialogOpen}
        onClose={handleCloseDialogs}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Edit Category</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                name="name"
                label="Category Name"
                value={formData.name}
                onChange={handleInputChange}
                fullWidth
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                name="description"
                label="Description"
                value={formData.description}
                onChange={handleInputChange}
                fullWidth
                multiline
                rows={3}
              />
            </Grid>
            <Grid item xs={12}>
              <Button
                variant="outlined"
                component="label"
                startIcon={<Category />}
                sx={{ mb: 2 }}
              >
                Change Image
                <input
                  type="file"
                  hidden
                  accept="image/*"
                  onChange={handleFileChange}
                />
              </Button>
              {imagePreview && (
                <Box sx={{ mt: 2 }}>
                  <img
                    src={imagePreview}
                    alt="Preview"
                    style={{
                      maxWidth: "100%",
                      maxHeight: 200,
                      objectFit: "contain",
                    }}
                  />
                </Box>
              )}
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialogs}>Cancel</Button>
          <Button
            onClick={handleUpdateCategory}
            variant="contained"
            disabled={!formData.name || loading}
          >
            {loading ? <CircularProgress size={24} /> : "Update"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Category Dialog */}
      <Dialog open={deleteDialogOpen} onClose={handleCloseDialogs}>
        <DialogTitle>Delete Category</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete the category "
            {selectedCategory?.name}"? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialogs}>Cancel</Button>
          <Button
            onClick={handleDeleteCategory}
            color="error"
            disabled={loading}
          >
            {loading ? <CircularProgress size={24} /> : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Notification Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseNotification}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={handleCloseNotification}
          severity={snackbar.severity}
          sx={{ width: "100%" }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default CategoriesManagement;
