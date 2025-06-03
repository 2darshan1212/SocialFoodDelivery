#!/usr/bin/env node

/**
 * Build Script for Render Deployment
 * 
 * This script optimizes the build process for mobile deployment on Render.com
 * It handles environment variables, build optimizations, and post-build tasks.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

const log = (message, color = 'reset') => {
  console.log(`${colors[color]}${message}${colors.reset}`);
};

const logStep = (step, message) => {
  log(`\n${colors.bright}[${step}]${colors.reset} ${message}`, 'cyan');
};

const logSuccess = (message) => {
  log(`✅ ${message}`, 'green');
};

const logWarning = (message) => {
  log(`⚠️  ${message}`, 'yellow');
};

const logError = (message) => {
  log(`❌ ${message}`, 'red');
};

// Configuration
const config = {
  // Render production URLs
  PRODUCTION_API_URL: 'https://socialfooddelivery-2.onrender.com/api/v1',
  PRODUCTION_SERVER_URL: 'https://socialfooddelivery-2.onrender.com',
  
  // Build settings
  NODE_ENV: 'production',
  BUILD_PATH: './dist',
  
  // Mobile optimization settings
  MOBILE_OPTIMIZATION: true,
  ENABLE_PWA: true,
  ENABLE_SERVICE_WORKER: false, // Disabled for now
  
  // Performance settings
  BUNDLE_ANALYZER: false,
  SOURCEMAPS: false,
  MINIFY: true
};

// Set environment variables for the build
const setEnvironmentVariables = () => {
  logStep('ENV', 'Setting environment variables for production build');
  
  const envVars = {
    NODE_ENV: config.NODE_ENV,
    VITE_NODE_ENV: config.NODE_ENV,
    VITE_API_URL: config.PRODUCTION_API_URL,
    VITE_SERVER_URL: config.PRODUCTION_SERVER_URL,
    VITE_ENABLE_MOBILE_OPTIMIZATION: 'true',
    VITE_ENABLE_RETRY_MECHANISM: 'true',
    VITE_ENABLE_NETWORK_MONITORING: 'true',
    VITE_DEBUG_API: 'false',
    VITE_DEBUG_AUTH: 'false',
    VITE_DEBUG_NETWORK: 'false',
    VITE_API_TIMEOUT: '45000',
    VITE_MAX_RETRIES: '5',
    VITE_MOBILE_TIMEOUT_MULTIPLIER: '2.0',
    VITE_MOBILE_MAX_RETRIES: '5',
    VITE_ENABLE_HTTPS_REDIRECT: 'true',
    VITE_SECURE_COOKIES: 'true',
    VITE_SAME_SITE_COOKIES: 'None'
  };
  
  // Set environment variables
  Object.entries(envVars).forEach(([key, value]) => {
    process.env[key] = value;
    log(`  ${key}=${value}`, 'blue');
  });
  
  logSuccess('Environment variables configured');
};

// Clean previous build
const cleanBuild = () => {
  logStep('CLEAN', 'Cleaning previous build');
  
  try {
    if (fs.existsSync(config.BUILD_PATH)) {
      execSync(`rm -rf ${config.BUILD_PATH}`, { stdio: 'inherit' });
      logSuccess('Previous build cleaned');
    } else {
      log('No previous build found', 'yellow');
    }
  } catch (error) {
    logWarning(`Failed to clean build directory: ${error.message}`);
  }
};

// Install dependencies
const installDependencies = () => {
  logStep('DEPS', 'Installing dependencies');
  
  try {
    log('Installing production dependencies...', 'blue');
    execSync('npm ci --only=production', { stdio: 'inherit' });
    
    log('Installing dev dependencies for build...', 'blue');
    execSync('npm install --only=dev', { stdio: 'inherit' });
    
    logSuccess('Dependencies installed');
  } catch (error) {
    logError(`Failed to install dependencies: ${error.message}`);
    process.exit(1);
  }
};

// Run the build
const runBuild = () => {
  logStep('BUILD', 'Running Vite build');
  
  try {
    execSync('npx vite build', { 
      stdio: 'inherit',
      env: { ...process.env }
    });
    logSuccess('Build completed successfully');
  } catch (error) {
    logError(`Build failed: ${error.message}`);
    process.exit(1);
  }
};

// Post-build optimizations
const postBuildOptimizations = () => {
  logStep('OPTIMIZE', 'Running post-build optimizations');
  
  const distPath = path.resolve(config.BUILD_PATH);
  
  if (!fs.existsSync(distPath)) {
    logError('Build directory not found!');
    process.exit(1);
  }
  
  // Create .htaccess for Apache (if needed)
  createHtaccess(distPath);
  
  // Create _redirects for Netlify/static hosting (if needed)
  createRedirects(distPath);
  
  // Add mobile-specific meta tags to index.html
  optimizeIndexHtml(distPath);
  
  // Generate build manifest
  generateBuildManifest(distPath);
  
  logSuccess('Post-build optimizations completed');
};

// Create .htaccess file
const createHtaccess = (distPath) => {
  const htaccessContent = `
# Enable gzip compression
<IfModule mod_deflate.c>
    AddOutputFilterByType DEFLATE text/plain
    AddOutputFilterByType DEFLATE text/html
    AddOutputFilterByType DEFLATE text/xml
    AddOutputFilterByType DEFLATE text/css
    AddOutputFilterByType DEFLATE application/xml
    AddOutputFilterByType DEFLATE application/xhtml+xml
    AddOutputFilterByType DEFLATE application/rss+xml
    AddOutputFilterByType DEFLATE application/javascript
    AddOutputFilterByType DEFLATE application/x-javascript
</IfModule>

# Cache control
<IfModule mod_expires.c>
    ExpiresActive on
    ExpiresByType text/css "access plus 1 year"
    ExpiresByType application/javascript "access plus 1 year"
    ExpiresByType image/png "access plus 1 year"
    ExpiresByType image/jpg "access plus 1 year"
    ExpiresByType image/jpeg "access plus 1 year"
    ExpiresByType image/gif "access plus 1 year"
    ExpiresByType image/svg+xml "access plus 1 year"
</IfModule>

# React Router support
<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteBase /
    RewriteRule ^index\\.html$ - [L]
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteRule . /index.html [L]
</IfModule>

# Security headers
<IfModule mod_headers.c>
    Header always set X-Content-Type-Options nosniff
    Header always set X-Frame-Options DENY
    Header always set X-XSS-Protection "1; mode=block"
    Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains"
</IfModule>
`.trim();

  try {
    fs.writeFileSync(path.join(distPath, '.htaccess'), htaccessContent);
    log('Created .htaccess file', 'blue');
  } catch (error) {
    logWarning(`Failed to create .htaccess: ${error.message}`);
  }
};

// Create _redirects file for Netlify-style hosting
const createRedirects = (distPath) => {
  const redirectsContent = `
# Redirect all traffic to index.html for React Router
/*    /index.html   200

# API proxy rules (if needed)
/api/*  ${config.PRODUCTION_API_URL}/:splat  200!
`.trim();

  try {
    fs.writeFileSync(path.join(distPath, '_redirects'), redirectsContent);
    log('Created _redirects file', 'blue');
  } catch (error) {
    logWarning(`Failed to create _redirects: ${error.message}`);
  }
};

// Optimize index.html for mobile
const optimizeIndexHtml = (distPath) => {
  const indexPath = path.join(distPath, 'index.html');
  
  if (!fs.existsSync(indexPath)) {
    logWarning('index.html not found');
    return;
  }
  
  try {
    let html = fs.readFileSync(indexPath, 'utf8');
    
    // Add mobile optimization meta tags
    const mobileMetaTags = `
    <!-- Mobile Optimization -->
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="default">
    <meta name="apple-mobile-web-app-title" content="Social Food Delivery">
    <meta name="application-name" content="Social Food Delivery">
    <meta name="theme-color" content="#2563eb">
    <meta name="msapplication-TileColor" content="#2563eb">
    
    <!-- Performance Optimization -->
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="renderer" content="webkit">
    <meta name="force-rendering" content="webkit">
    
    <!-- Preload critical resources -->
    <link rel="preload" href="/src/main.jsx" as="script">
    <link rel="dns-prefetch" href="${config.PRODUCTION_SERVER_URL}">
    <link rel="preconnect" href="${config.PRODUCTION_SERVER_URL}">
    `;
    
    // Insert meta tags before </head>
    html = html.replace('</head>', `${mobileMetaTags}\n  </head>`);
    
    fs.writeFileSync(indexPath, html);
    log('Optimized index.html for mobile', 'blue');
  } catch (error) {
    logWarning(`Failed to optimize index.html: ${error.message}`);
  }
};

// Generate build manifest
const generateBuildManifest = (distPath) => {
  const manifest = {
    buildTime: new Date().toISOString(),
    environment: 'production',
    apiUrl: config.PRODUCTION_API_URL,
    serverUrl: config.PRODUCTION_SERVER_URL,
    mobileOptimized: true,
    version: require('../package.json').version,
    gitCommit: getGitCommit(),
    buildConfig: {
      nodeEnv: config.NODE_ENV,
      minified: config.MINIFY,
      sourcemaps: config.SOURCEMAPS,
      bundleAnalyzer: config.BUNDLE_ANALYZER
    }
  };
  
  try {
    fs.writeFileSync(
      path.join(distPath, 'build-manifest.json'), 
      JSON.stringify(manifest, null, 2)
    );
    log('Generated build manifest', 'blue');
  } catch (error) {
    logWarning(`Failed to generate build manifest: ${error.message}`);
  }
};

// Get git commit hash
const getGitCommit = () => {
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  } catch (error) {
    return 'unknown';
  }
};

// Display build statistics
const displayBuildStats = () => {
  logStep('STATS', 'Build Statistics');
  
  const distPath = path.resolve(config.BUILD_PATH);
  
  if (!fs.existsSync(distPath)) {
    logError('Build directory not found!');
    return;
  }
  
  try {
    const stats = execSync(`du -sh ${distPath}`, { encoding: 'utf8' });
    log(`Total build size: ${stats.trim().split('\t')[0]}`, 'green');
    
    // List main files
    const files = fs.readdirSync(distPath);
    log('\nBuild contents:', 'blue');
    files.forEach(file => {
      const filePath = path.join(distPath, file);
      const stat = fs.statSync(filePath);
      if (stat.isFile()) {
        const size = (stat.size / 1024).toFixed(1);
        log(`  ${file}: ${size} KB`, 'blue');
      }
    });
  } catch (error) {
    logWarning(`Failed to get build stats: ${error.message}`);
  }
};

// Main build process
const main = async () => {
  log('\n🚀 Starting Render-optimized build process\n', 'bright');
  
  try {
    setEnvironmentVariables();
    cleanBuild();
    installDependencies();
    runBuild();
    postBuildOptimizations();
    displayBuildStats();
    
    log('\n🎉 Build completed successfully!', 'green');
    log('\nYour app is ready for deployment on Render.com', 'bright');
    log(`Build output: ${config.BUILD_PATH}`, 'blue');
    
  } catch (error) {
    logError(`\nBuild failed: ${error.message}`);
    process.exit(1);
  }
};

// Run the build if this script is executed directly
if (require.main === module) {
  main();
}

module.exports = {
  main,
  config,
  setEnvironmentVariables,
  cleanBuild,
  installDependencies,
  runBuild,
  postBuildOptimizations
}; 