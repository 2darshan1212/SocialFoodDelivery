import { useState, useEffect } from 'react';

/**
 * A custom hook to detect the current device type (mobile or desktop)
 * and provide information about the browser/device capabilities.
 * 
 * @returns {Object} Device information and capabilities
 */
const useDeviceDetect = () => {
  const [device, setDevice] = useState({
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    userAgent: '',
    canShare: false,
    hasCamera: false,
    hasNotifications: false,
    supportsWebShare: false,
    supportsPushAPI: false,
    supportsDeepLinks: false,
    mightHaveInstagramApp: false,
    isInstagramBrowser: false
  });

  useEffect(() => {
    const checkDevice = () => {
      // Get window width
      const width = window.innerWidth;
      const isMobileView = width < 768;
      const isTabletView = width >= 768 && width < 1024;
      const isDesktopView = width >= 1024;
      
      // Detect user agent
      const userAgent = navigator.userAgent || '';
      
      // Check for sharing capabilities
      const canShare = !!navigator.share;
      
      // Check for various browser features
      const hasNotifications = 'Notification' in window;
      const supportsPushAPI = 'PushManager' in window;
      
      // Check for camera access (approx)
      let hasCamera = false;
      if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
        // We can't actually check without user permission, so this is just a capability check
        hasCamera = true;
      }
      
      // Check for deep link capability (very rough approximation)
      // This is better determined by the app's configuration and platform
      const isAndroid = /android/i.test(userAgent);
      const isIOS = /iphone|ipad|ipod/i.test(userAgent);
      const supportsDeepLinks = isAndroid || isIOS;
      
      // Detect if Instagram app might be installed (we can only guess based on platform)
      // Real detection requires actual app invocation to see if it responds
      const mightHaveInstagramApp = isAndroid || isIOS;
      
      // Detection for if we're inside the Instagram in-app browser
      const isInstagramBrowser = /Instagram/.test(userAgent);

      setDevice({
        isMobile: isMobileView,
        isTablet: isTabletView,
        isDesktop: isDesktopView,
        userAgent,
        canShare,
        hasCamera,
        hasNotifications,
        supportsWebShare: canShare,
        supportsPushAPI,
        supportsDeepLinks,
        mightHaveInstagramApp,
        isInstagramBrowser
      });
    };

    // Initial check
    checkDevice();

    // Re-check on resize
    window.addEventListener('resize', checkDevice);
    
    return () => {
      window.removeEventListener('resize', checkDevice);
    };
  }, []);

  return device;
};

export default useDeviceDetect;
