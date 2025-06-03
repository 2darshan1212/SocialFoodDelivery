/**
 * Network Status Indicator Component
 * 
 * Provides visual feedback about network connectivity and API status
 * Especially useful for mobile users with unreliable connections
 */

import React, { useState, useEffect } from 'react';
import { 
  Alert, 
  AlertTitle, 
  Button, 
  Chip, 
  Collapse,
  IconButton,
  Typography,
  Box 
} from '@mui/material';
import {
  FiWifi,
  FiWifiOff,
  FiAlertTriangle,
  FiCheckCircle,
  FiRefreshCw,
  FiX,
  FiInfo
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import { testApiConnectivity } from '../../utils/apiConfig';
import { NetworkMonitor } from '../../utils/mobileApiOptimizer';

const NetworkStatusIndicator = ({ 
  showDetails = false,
  autoHide = true,
  position = 'top' // 'top', 'bottom', 'fixed'
}) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [apiStatus, setApiStatus] = useState('unknown'); // 'connected', 'disconnected', 'checking', 'unknown'
  const [networkInfo, setNetworkInfo] = useState(null);
  const [showAlert, setShowAlert] = useState(false);
  const [isTestingApi, setIsTestingApi] = useState(false);
  const [lastCheckTime, setLastCheckTime] = useState(null);

  // Network change handler
  useEffect(() => {
    const cleanup = NetworkMonitor.addNetworkListener((status) => {
      setIsOnline(status.online);
      
      if (status.online) {
        toast.success('Internet connection restored', { 
          position: 'top-center',
          autoClose: 3000
        });
        checkApiStatus();
      } else {
        toast.error('Internet connection lost', { 
          position: 'top-center',
          autoClose: 5000
        });
        setApiStatus('disconnected');
      }
      
      setShowAlert(true);
    });

    return cleanup;
  }, []);

  // Network info monitoring
  useEffect(() => {
    const updateNetworkInfo = () => {
      const info = NetworkMonitor.getConnectionInfo();
      setNetworkInfo(info);
    };

    updateNetworkInfo();
    
    // Update network info periodically
    const interval = setInterval(updateNetworkInfo, 30000); // Every 30 seconds
    
    return () => clearInterval(interval);
  }, []);

  // Initial API status check
  useEffect(() => {
    if (isOnline) {
      checkApiStatus();
    }
  }, [isOnline]);

  // Auto-hide alert after success
  useEffect(() => {
    if (autoHide && showAlert && apiStatus === 'connected' && isOnline) {
      const timer = setTimeout(() => {
        setShowAlert(false);
      }, 5000); // Hide after 5 seconds
      
      return () => clearTimeout(timer);
    }
  }, [showAlert, apiStatus, isOnline, autoHide]);

  const checkApiStatus = async () => {
    if (!isOnline) {
      setApiStatus('disconnected');
      return;
    }

    setIsTestingApi(true);
    setApiStatus('checking');
    
    try {
      const isConnected = await testApiConnectivity();
      setApiStatus(isConnected ? 'connected' : 'disconnected');
      setLastCheckTime(new Date());
      
      if (!isConnected) {
        setShowAlert(true);
      }
    } catch (error) {
      console.error('API status check failed:', error);
      setApiStatus('disconnected');
      setShowAlert(true);
    } finally {
      setIsTestingApi(false);
    }
  };

  const handleRetry = () => {
    checkApiStatus();
    toast.info('Checking connection...', { 
      position: 'top-center',
      autoClose: 2000 
    });
  };

  const getStatusColor = () => {
    if (!isOnline) return 'error';
    if (apiStatus === 'connected') return 'success';
    if (apiStatus === 'checking') return 'info';
    return 'warning';
  };

  const getStatusIcon = () => {
    if (!isOnline) return <FiWifiOff />;
    if (apiStatus === 'connected') return <FiCheckCircle />;
    if (apiStatus === 'checking') return <FiRefreshCw className="animate-spin" />;
    return <FiAlertTriangle />;
  };

  const getStatusText = () => {
    if (!isOnline) return 'No Internet';
    if (apiStatus === 'connected') return 'Connected';
    if (apiStatus === 'checking') return 'Checking...';
    if (apiStatus === 'disconnected') return 'Server Offline';
    return 'Unknown';
  };

  const getDetailedMessage = () => {
    if (!isOnline) {
      return 'No internet connection. Please check your network settings and try again.';
    }
    
    if (apiStatus === 'disconnected') {
      return 'Cannot connect to the server. This might be a temporary issue. Please try again.';
    }
    
    if (apiStatus === 'connected') {
      return 'All systems are working normally.';
    }
    
    return 'Checking server connection...';
  };

  const shouldShowAlert = showAlert || (!isOnline || apiStatus === 'disconnected');
  
  // Don't render if everything is fine and not showing details
  if (!showDetails && !shouldShowAlert) {
    return null;
  }

  const positionStyles = {
    top: {
      position: 'sticky',
      top: 0,
      zIndex: 1100,
      marginBottom: 2
    },
    bottom: {
      position: 'sticky',
      bottom: 0,
      zIndex: 1100,
      marginTop: 2
    },
    fixed: {
      position: 'fixed',
      top: 16,
      right: 16,
      zIndex: 1300,
      maxWidth: 400
    }
  };

  return (
    <Box sx={positionStyles[position]}>
      {/* Compact Status Indicator */}
      {showDetails && (
        <Box 
          sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 1, 
            p: 1,
            backgroundColor: 'background.paper',
            borderRadius: 1,
            mb: shouldShowAlert ? 1 : 0
          }}
        >
          <Chip
            icon={getStatusIcon()}
            label={getStatusText()}
            color={getStatusColor()}
            size="small"
            variant="outlined"
          />
          
          {networkInfo && (
            <Typography variant="caption" color="text.secondary">
              {networkInfo.effectiveType?.toUpperCase() || 'Unknown'} • 
              {networkInfo.quality} quality
            </Typography>
          )}
          
          {lastCheckTime && (
            <Typography variant="caption" color="text.secondary">
              Last checked: {lastCheckTime.toLocaleTimeString()}
            </Typography>
          )}
          
          <IconButton 
            size="small" 
            onClick={handleRetry}
            disabled={isTestingApi}
            title="Check connection"
          >
            <FiRefreshCw className={isTestingApi ? 'animate-spin' : ''} />
          </IconButton>
        </Box>
      )}

      {/* Detailed Alert */}
      <Collapse in={shouldShowAlert}>
        <Alert 
          severity={getStatusColor()}
          action={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Button 
                color="inherit" 
                size="small" 
                onClick={handleRetry}
                disabled={isTestingApi}
                startIcon={<FiRefreshCw className={isTestingApi ? 'animate-spin' : ''} />}
              >
                {isTestingApi ? 'Checking...' : 'Retry'}
              </Button>
              
              {autoHide && (
                <IconButton
                  aria-label="close"
                  color="inherit"
                  size="small"
                  onClick={() => setShowAlert(false)}
                >
                  <FiX />
                </IconButton>
              )}
            </Box>
          }
          sx={{ 
            mb: 1,
            '& .MuiAlert-message': {
              width: '100%'
            }
          }}
        >
          <AlertTitle>
            {!isOnline ? 'No Internet Connection' : 
             apiStatus === 'disconnected' ? 'Server Connection Failed' :
             apiStatus === 'connected' ? 'Connection Restored' :
             'Checking Connection'}
          </AlertTitle>
          
          <Typography variant="body2" sx={{ mb: 1 }}>
            {getDetailedMessage()}
          </Typography>
          
          {/* Technical Details */}
          {showDetails && networkInfo && (
            <Box sx={{ mt: 1, p: 1, backgroundColor: 'action.hover', borderRadius: 1 }}>
              <Typography variant="caption" color="text.secondary" component="div">
                <strong>Connection Details:</strong>
              </Typography>
              <Typography variant="caption" color="text.secondary" component="div">
                • Type: {networkInfo.effectiveType?.toUpperCase() || 'Unknown'}
              </Typography>
              <Typography variant="caption" color="text.secondary" component="div">
                • Quality: {networkInfo.quality}
              </Typography>
              <Typography variant="caption" color="text.secondary" component="div">
                • Downlink: {networkInfo.downlink ? `${networkInfo.downlink} Mbps` : 'Unknown'}
              </Typography>
              <Typography variant="caption" color="text.secondary" component="div">
                • RTT: {networkInfo.rtt ? `${networkInfo.rtt}ms` : 'Unknown'}
              </Typography>
              {networkInfo.saveData && (
                <Typography variant="caption" color="text.secondary" component="div">
                  • Data Saver: Enabled
                </Typography>
              )}
            </Box>
          )}
        </Alert>
      </Collapse>
    </Box>
  );
};

export default NetworkStatusIndicator; 