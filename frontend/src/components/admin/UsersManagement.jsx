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
  Avatar,
  FormControlLabel,
  Switch,
  InputAdornment,
  Tooltip,
  Pagination,
  Grid,
  Card,
  CardContent,
  CardActions,
  useMediaQuery,
  useTheme,
  Fab,
  Stack,
  Divider
} from "@mui/material";
import {
  Edit,
  Delete,
  Search,
  Add,
  AdminPanelSettings,
  Block,
  Person,
  Email,
  Shield,
  ShieldOutlined,
  CheckCircle,
  Cancel,
  Refresh
} from "@mui/icons-material";

const UsersManagement = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success",
  });
  
  const ROWS_PER_PAGE = 10;

  // Fetch users on component mount and when search/page changes
  useEffect(() => {
    fetchUsers();
  }, [page, searchQuery]);

  // Fetch users from the API
  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);

      // Create query params
      const params = new URLSearchParams();
      params.append("page", page);
      params.append("limit", ROWS_PER_PAGE);
      if (searchQuery) {
        params.append("q", searchQuery);
      }

      const response = await axiosInstance.get(
        `/user/admin/users?${params.toString()}`
      );

      if (response.data.success) {
        setUsers(response.data.users || []);
        setTotalPages(response.data.pagination?.pages || 1);
      } else {
        throw new Error(response.data.message || "Failed to fetch users");
      }
    } catch (err) {
      console.error("Error fetching users:", err);
      setError("Failed to load users. Please try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Handle search input changes
  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
    setPage(1); // Reset to first page on new search
  };

  // Handle page change
  const handlePageChange = (event, newPage) => {
    setPage(newPage);
  };

  // Refresh user data
  const handleRefresh = () => {
    setRefreshing(true);
    fetchUsers();
  };

  // Open edit user dialog
  const handleEditUser = (user) => {
    setSelectedUser(user);
    setEditDialogOpen(true);
  };

  // Close edit user dialog
  const handleCloseEditDialog = () => {
    setEditDialogOpen(false);
  };

  // Update user details
  const handleUpdateUser = async () => {
    try {
      setLoading(true);

      const response = await axiosInstance.put(
        `/user/admin/${selectedUser._id}`,
        {
          username: selectedUser.username,
          email: selectedUser.email,
          isAdmin: selectedUser.isAdmin,
          isBlocked: selectedUser.isBlocked,
        }
      );

      if (response.data.success) {
        setSnackbar({
          open: true,
          message: "User updated successfully!",
          severity: "success",
        });

        handleCloseEditDialog();
        fetchUsers();
      } else {
        throw new Error(response.data.message || "Failed to update user");
      }
    } catch (err) {
      console.error("Error updating user:", err);
      setSnackbar({
        open: true,
        message: err.response?.data?.message || "Failed to update user",
        severity: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  // Toggle admin status
  const toggleAdminStatus = async (user) => {
    try {
      setLoading(true);

      const newAdminStatus = !user.isAdmin;
      const endpoint = newAdminStatus ? "make-admin" : "remove-admin";

      const response = await axiosInstance.put(
        `/user/admin/${user._id}/${endpoint}`,
        {}
      );

      if (response.data.success) {
        setSnackbar({
          open: true,
          message: `User ${
            newAdminStatus ? "promoted to admin" : "demoted from admin"
          } successfully!`,
          severity: "success",
        });

        handleCloseEditDialog();
        fetchUsers();
      } else {
        throw new Error(
          response.data.message ||
            `Failed to ${newAdminStatus ? "promote" : "demote"} user`
        );
      }
    } catch (err) {
      console.error("Error toggling admin status:", err);
      setSnackbar({
        open: true,
        message: err.response?.data?.message || "Failed to update admin status",
        severity: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  // Toggle block status
  const toggleUserBlock = async (user) => {
    try {
      setLoading(true);

      const newBlockStatus = !user.isBlocked;
      const endpoint = newBlockStatus ? "block" : "unblock";

      const response = await axiosInstance.put(
        `/user/admin/${user._id}/${endpoint}`,
        {}
      );

      if (response.data.success) {
        setSnackbar({
          open: true,
          message: `User ${
            newBlockStatus ? "blocked" : "unblocked"
          } successfully!`,
          severity: "success",
        });

        handleCloseEditDialog();
        fetchUsers();
      } else {
        throw new Error(
          response.data.message ||
            `Failed to ${newBlockStatus ? "block" : "unblock"} user`
        );
      }
    } catch (err) {
      console.error("Error toggling block status:", err);
      setSnackbar({
        open: true,
        message: err.response?.data?.message || "Failed to update block status",
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

  // Mobile-friendly User Card Component
  const UserCard = ({ user }) => {
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
            <Avatar 
              src={user.profilePicture} 
              sx={{ width: 48, height: 48, mr: 2 }}
            >
              {user.username.charAt(0).toUpperCase()}
            </Avatar>
            <Box sx={{ flex: 1 }}>
              <Typography variant="h6" sx={{ fontSize: '1.1rem', fontWeight: 'bold' }}>
                {user.username}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {user.email}
              </Typography>
            </Box>
          </Box>
          
          {/* Status Chips */}
          <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
            {user.isBlocked ? (
              <Chip
                label="Blocked"
                color="error"
                size="small"
                icon={<Block />}
              />
            ) : (
              <Chip
                label="Active"
                color="success"
                size="small"
                icon={<CheckCircle />}
              />
            )}
            
            {user.isAdmin ? (
              <Chip
                label="Admin"
                color="primary"
                size="small"
                icon={<AdminPanelSettings />}
              />
            ) : (
              <Chip
                label="User"
                variant="outlined"
                size="small"
                icon={<Person />}
              />
            )}
          </Stack>
          
          {/* Creation Date */}
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Joined: {new Date(user.createdAt).toLocaleDateString()}
          </Typography>
        </CardContent>
        
        <CardActions sx={{ justifyContent: 'space-between', px: 2, pb: 2 }}>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<Edit />}
              onClick={() => handleEditUser(user)}
            >
              Edit
            </Button>
            
            <Button
              size="small"
              variant="outlined"
              color={user.isAdmin ? "error" : "primary"}
              startIcon={<AdminPanelSettings />}
              onClick={() => toggleAdminStatus(user)}
            >
              {user.isAdmin ? "Remove Admin" : "Make Admin"}
            </Button>
          </Box>
          
          <Button
            size="small"
            variant="outlined"
            color={user.isBlocked ? "success" : "error"}
            startIcon={user.isBlocked ? <CheckCircle /> : <Block />}
            onClick={() => toggleUserBlock(user)}
          >
            {user.isBlocked ? "Unblock" : "Block"}
          </Button>
        </CardActions>
      </Card>
    );
  };

  return (
    <Container maxWidth="xl" sx={{ mt: 3, mb: 5 }}>
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h5" component="h1" gutterBottom>
          Users Management
        </Typography>
        
        {/* Search and controls */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} md={8}>
            <TextField
              fullWidth
              placeholder="Search by username or email..."
              value={searchQuery}
              onChange={handleSearchChange}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search />
                  </InputAdornment>
                ),
              }}
              size={isMobile ? "small" : "medium"}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <Button
              variant="outlined"
              startIcon={<Refresh />}
              onClick={handleRefresh}
              disabled={refreshing}
              fullWidth={isMobile}
              size={isMobile ? "small" : "medium"}
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </Button>
          </Grid>
        </Grid>
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

      {/* Users content */}
      {!loading && !error && (
        <>
          {/* Mobile view - Cards */}
          {isMobile ? (
            <Box>
              {users.length === 0 ? (
                <Paper sx={{ p: 4, textAlign: 'center' }}>
                  <Typography variant="h6" color="text.secondary">
                    No users found
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Try adjusting your search query
                  </Typography>
                </Paper>
              ) : (
                users.map((user) => (
                  <UserCard key={user._id} user={user} />
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
                      <TableCell>User</TableCell>
                      <TableCell>Email</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Role</TableCell>
                      <TableCell>Joined</TableCell>
                      <TableCell align="center">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user._id} hover>
                        <TableCell>
                          <Box sx={{ display: "flex", alignItems: "center" }}>
                            <Avatar 
                              src={user.profilePicture} 
                              sx={{ width: 40, height: 40, mr: 2 }}
                            >
                              {user.username.charAt(0).toUpperCase()}
                            </Avatar>
                            <Typography variant="body2">
                              {user.username}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {user.email}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {user.isBlocked ? (
                            <Chip
                              label="Blocked"
                              color="error"
                              size="small"
                              icon={<Block />}
                            />
                          ) : (
                            <Chip
                              label="Active"
                              color="success"
                              size="small"
                              icon={<CheckCircle />}
                            />
                          )}
                        </TableCell>
                        <TableCell>
                          {user.isAdmin ? (
                            <Chip
                              label="Admin"
                              color="primary"
                              size="small"
                              icon={<AdminPanelSettings />}
                            />
                          ) : (
                            <Chip
                              label="User"
                              variant="outlined"
                              size="small"
                              icon={<Person />}
                            />
                          )}
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {new Date(user.createdAt).toLocaleDateString()}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                            <Tooltip title="Edit User">
                              <IconButton
                                color="primary"
                                onClick={() => handleEditUser(user)}
                                size="small"
                              >
                                <Edit />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title={user.isAdmin ? "Remove Admin" : "Make Admin"}>
                              <IconButton
                                color={user.isAdmin ? "error" : "primary"}
                                onClick={() => toggleAdminStatus(user)}
                                size="small"
                              >
                                <AdminPanelSettings />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title={user.isBlocked ? "Unblock User" : "Block User"}>
                              <IconButton
                                color={user.isBlocked ? "success" : "error"}
                                onClick={() => toggleUserBlock(user)}
                                size="small"
                              >
                                {user.isBlocked ? <CheckCircle /> : <Block />}
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

          {/* Pagination */}
          <Box sx={{ display: "flex", justifyContent: "center", mt: 3 }}>
            <Pagination
              count={totalPages}
              page={page}
              onChange={handlePageChange}
              color="primary"
              size={isMobile ? "small" : "medium"}
              showFirstButton
              showLastButton
              sx={{
                '& .MuiPagination-ul': {
                  flexWrap: 'wrap',
                  justifyContent: 'center',
                }
              }}
            />
          </Box>
        </>
      )}

      {/* Floating action button for mobile refresh */}
      {isMobile && (
        <Fab
          color="primary"
          sx={{
            position: 'fixed',
            bottom: 16,
            right: 16,
            zIndex: 1000,
          }}
          onClick={handleRefresh}
        >
          <Refresh />
        </Fab>
      )}

      {/* Edit User Dialog */}
      <Dialog
        open={editDialogOpen}
        onClose={handleCloseEditDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Edit User</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                name="username"
                label="Username"
                value={selectedUser?.username}
                onChange={(e) => setSelectedUser((prev) => ({ ...prev, username: e.target.value }))}
                fullWidth
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                name="email"
                label="Email"
                value={selectedUser?.email}
                onChange={(e) => setSelectedUser((prev) => ({ ...prev, email: e.target.value }))}
                fullWidth
                required
                type="email"
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={selectedUser?.isAdmin}
                    onChange={(e) => setSelectedUser((prev) => ({ ...prev, isAdmin: e.target.checked }))}
                    name="isAdmin"
                    color="primary"
                  />
                }
                label="Admin Privileges"
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={selectedUser?.isBlocked}
                    onChange={(e) => setSelectedUser((prev) => ({ ...prev, isBlocked: e.target.checked }))}
                    name="isBlocked"
                    color="error"
                  />
                }
                label="Block User"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseEditDialog}>Cancel</Button>
          <Button
            onClick={handleUpdateUser}
            variant="contained"
            disabled={!selectedUser?.username || !selectedUser?.email || loading}
          >
            {loading ? <CircularProgress size={24} /> : "Update"}
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

export default UsersManagement;
