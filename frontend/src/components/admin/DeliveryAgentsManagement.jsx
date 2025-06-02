import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { getAllAgents } from '../../services/deliveryService';
import { verifyDeliveryAgent, clearVerificationStatus } from '../../redux/deliverySlice';
import { toast } from 'react-hot-toast';
import {
  Box,
  Container,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Button,
  Chip,
  Avatar,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Card,
  CardContent,
  CardActions,
  Grid,
  useMediaQuery,
  useTheme,
  Fab,
  Stack,
  Divider,
  Tooltip,
  Alert
} from '@mui/material';
import {
  CheckCircle,
  Cancel,
  DirectionsBike,
  Phone,
  Email,
  CalendarToday,
  DeliveryDining,
  Refresh,
  Person,
  Verified,
  Block
} from '@mui/icons-material';

const DeliveryAgentsManagement = () => {
  const dispatch = useDispatch();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  const { verificationStatus } = useSelector((state) => state.delivery);
  
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  
  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(isMobile ? 5 : 10);
  
  // Confirmation dialog
  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    agentId: null,
    agentName: '',
    action: null, // 'verify' or 'revoke'
  });
  
  // Load agents on component mount
  useEffect(() => {
    fetchAgents();
  }, []);
  
  // Watch for verification status changes
  useEffect(() => {
    if (verificationStatus.success) {
      toast.success('Agent verification status updated successfully!');
      fetchAgents(); // Refresh agent list
      dispatch(clearVerificationStatus());
    }
    
    if (verificationStatus.error) {
      toast.error(verificationStatus.error || 'Failed to update agent status');
      dispatch(clearVerificationStatus());
    }
  }, [verificationStatus.success, verificationStatus.error, dispatch]);
  
  const fetchAgents = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getAllAgents();
      setAgents(response.agents || []);
    } catch (err) {
      setError('Failed to load delivery agents');
      toast.error('Failed to load delivery agents');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  
  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };
  
  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Handle refresh
  const handleRefresh = () => {
    setRefreshing(true);
    fetchAgents();
  };
  
  const handleVerifyAction = (agent, action) => {
    setConfirmDialog({
      open: true,
      agentId: agent._id,
      agentName: agent.user?.username || 'Agent',
      action,
    });
  };
  
  const confirmVerificationAction = () => {
    const { agentId, action } = confirmDialog;
    
    dispatch(
      verifyDeliveryAgent({
        agentId,
        isVerified: action === 'verify',
      })
    );
    
    // Close dialog
    setConfirmDialog((prev) => ({
      ...prev,
      open: false,
    }));
  };
  
  // Mobile-friendly Agent Card Component
  const AgentCard = ({ agent }) => {
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
              src={agent.user?.profilePic} 
              alt={agent.user?.username}
              sx={{ width: 48, height: 48, mr: 2 }}
            >
              {agent.user?.username?.charAt(0).toUpperCase() || 'A'}
            </Avatar>
            <Box sx={{ flex: 1 }}>
              <Typography variant="h6" sx={{ fontSize: '1.1rem', fontWeight: 'bold' }}>
                {agent.user?.username || 'Unknown Agent'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {agent.user?.email || 'No email'}
              </Typography>
            </Box>
            <Box>
              {agent.isVerified ? (
                <Chip
                  label="Verified"
                  color="success"
                  size="small"
                  icon={<Verified />}
                />
              ) : (
                <Chip
                  label="Pending"
                  color="warning"
                  size="small"
                  icon={<Block />}
                />
              )}
            </Box>
          </Box>
          
          {/* Vehicle Info */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <DirectionsBike sx={{ fontSize: '1rem', color: 'text.secondary' }} />
            <Typography variant="body2">
              {agent.vehicleType || 'Not specified'}
              {agent.vehicleNumber && ` - ${agent.vehicleNumber}`}
            </Typography>
          </Box>
          
          {/* Stats */}
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={6}>
              <Box sx={{ textAlign: 'center', p: 1, bgcolor: 'grey.50', borderRadius: 1 }}>
                <Typography variant="h6" color="primary">
                  {agent.completedDeliveries || 0}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Completed
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6}>
              <Box sx={{ textAlign: 'center', p: 1, bgcolor: 'grey.50', borderRadius: 1 }}>
                <Typography variant="h6" color="primary">
                  {agent.rating || 'N/A'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Rating
                </Typography>
              </Box>
            </Grid>
          </Grid>
          
          {/* Join Date */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CalendarToday sx={{ fontSize: '1rem', color: 'text.secondary' }} />
            <Typography variant="body2" color="text.secondary">
              Joined: {new Date(agent.createdAt).toLocaleDateString()}
            </Typography>
          </Box>
        </CardContent>
        
        <CardActions sx={{ justifyContent: 'space-between', px: 2, pb: 2 }}>
          {agent.isVerified ? (
            <Button
              size="small"
              variant="outlined"
              color="error"
              startIcon={<Block />}
              onClick={() => handleVerifyAction(agent, 'revoke')}
            >
              Revoke
            </Button>
          ) : (
            <Button
              size="small"
              variant="outlined"
              color="success"
              startIcon={<CheckCircle />}
              onClick={() => handleVerifyAction(agent, 'verify')}
            >
              Verify
            </Button>
          )}
          
          <Button
            size="small"
            variant="outlined"
            startIcon={<Person />}
            onClick={() => {/* Navigate to agent details */}}
          >
            Details
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
            Delivery Agents Management
          </Typography>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={handleRefresh}
            disabled={refreshing}
            size={isMobile ? "small" : "medium"}
          >
            {refreshing ? "Refreshing..." : "Refresh"}
          </Button>
        </Box>
      </Paper>

      {/* Loading state */}
      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {/* Error state */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
          <Button
            variant="outlined"
            onClick={fetchAgents}
            sx={{ ml: 2 }}
            size="small"
          >
            Retry
          </Button>
        </Alert>
      )}

      {/* Agents content */}
      {!loading && !error && (
        <>
          {/* Mobile view - Cards */}
          {isMobile ? (
            <Box>
              {agents.length === 0 ? (
                <Paper sx={{ p: 4, textAlign: 'center' }}>
                  <Typography variant="h6" color="text.secondary">
                    No delivery agents found
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    No agents have registered yet
                  </Typography>
                </Paper>
              ) : (
                agents
                  .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                  .map((agent) => (
                    <AgentCard key={agent._id} agent={agent} />
                  ))
              )}
            </Box>
          ) : (
            /* Desktop view - Table */
            <Paper>
              <TableContainer sx={{ maxHeight: 600 }}>
                <Table stickyHeader aria-label="delivery agents table">
                  <TableHead>
                    <TableRow>
                      <TableCell>Agent</TableCell>
                      <TableCell>Vehicle</TableCell>
                      <TableCell>Registration Date</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Deliveries</TableCell>
                      <TableCell align="center">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {agents.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} align="center">
                          <Typography color="text.secondary">
                            No delivery agents found
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      agents
                        .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                        .map((agent) => (
                          <TableRow key={agent._id} hover>
                            <TableCell>
                              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                <Avatar 
                                  src={agent.user?.profilePic} 
                                  alt={agent.user?.username} 
                                  sx={{ mr: 2, width: 40, height: 40 }} 
                                >
                                  {agent.user?.username?.charAt(0).toUpperCase() || 'A'}
                                </Avatar>
                                <div>
                                  <Typography variant="body1">
                                    {agent.user?.username || 'Unknown User'}
                                  </Typography>
                                  <Typography variant="body2" color="textSecondary">
                                    {agent.user?.email || 'No email'}
                                  </Typography>
                                </div>
                              </Box>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                                {agent.vehicleType || 'Not specified'}
                                {agent.vehicleNumber && (
                                  <Box component="span" sx={{ display: 'block', color: 'text.secondary', mt: 0.5 }}>
                                    {agent.vehicleNumber}
                                  </Box>
                                )}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              {new Date(agent.createdAt).toLocaleDateString(undefined, {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                              })}
                            </TableCell>
                            <TableCell>
                              {agent.isVerified ? (
                                <Chip
                                  label="Verified"
                                  color="success"
                                  size="small"
                                  icon={<CheckCircle />}
                                />
                              ) : (
                                <Chip
                                  label="Pending Verification"
                                  color="warning"
                                  size="small"
                                  icon={<Cancel />}
                                />
                              )}
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2">
                                {agent.completedDeliveries || 0} completed
                              </Typography>
                              {agent.rating && (
                                <Typography variant="body2" color="textSecondary">
                                  Rating: {agent.rating}/5
                                </Typography>
                              )}
                            </TableCell>
                            <TableCell align="center">
                              <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                                {agent.isVerified ? (
                                  <Tooltip title="Revoke Verification">
                                    <Button
                                      size="small"
                                      variant="outlined"
                                      color="error"
                                      onClick={() => handleVerifyAction(agent, 'revoke')}
                                    >
                                      Revoke
                                    </Button>
                                  </Tooltip>
                                ) : (
                                  <Tooltip title="Verify Agent">
                                    <Button
                                      size="small"
                                      variant="outlined"
                                      color="success"
                                      onClick={() => handleVerifyAction(agent, 'verify')}
                                    >
                                      Verify
                                    </Button>
                                  </Tooltip>
                                )}
                              </Box>
                            </TableCell>
                          </TableRow>
                        ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          )}

          {/* Pagination */}
          {agents.length > 0 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
              <TablePagination
                component="div"
                count={agents.length}
                page={page}
                onPageChange={handleChangePage}
                rowsPerPage={rowsPerPage}
                onRowsPerPageChange={handleChangeRowsPerPage}
                rowsPerPageOptions={isMobile ? [5, 10, 25] : [5, 10, 25, 50]}
                sx={{
                  '& .MuiTablePagination-toolbar': {
                    flexWrap: isMobile ? 'wrap' : 'nowrap',
                  },
                  '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': {
                    fontSize: isMobile ? '0.875rem' : '1rem',
                  },
                }}
              />
            </Box>
          )}
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

      {/* Verification Confirmation Dialog */}
      <Dialog
        open={confirmDialog.open}
        onClose={() => setConfirmDialog((prev) => ({ ...prev, open: false }))}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>
          {confirmDialog.action === 'verify' ? 'Verify Agent' : 'Revoke Verification'}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to{' '}
            {confirmDialog.action === 'verify' ? 'verify' : 'revoke verification for'}{' '}
            {confirmDialog.agentName}?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setConfirmDialog((prev) => ({ ...prev, open: false }))}
          >
            Cancel
          </Button>
          <Button
            onClick={confirmVerificationAction}
            variant="contained"
            color={confirmDialog.action === 'verify' ? 'success' : 'error'}
            disabled={verificationStatus.loading}
          >
            {verificationStatus.loading ? (
              <CircularProgress size={24} />
            ) : (
              confirmDialog.action === 'verify' ? 'Verify' : 'Revoke'
            )}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default DeliveryAgentsManagement; 