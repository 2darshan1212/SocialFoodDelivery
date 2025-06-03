import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '');
  
  const isProduction = mode === 'production';
  const isDevelopment = mode === 'development';
  
  console.log(`[Vite] Building for ${mode} mode`);
  console.log(`[Vite] API URL: ${env.VITE_API_URL || 'https://socialfooddelivery-2.onrender.com/api/v1'}`);

  return {
    plugins: [tailwindcss(), react()],
    
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    
    // Environment variables configuration
    define: {
      __DEV__: isDevelopment,
      __PROD__: isProduction,
    },
    
    // Development server configuration
    server: {
      port: 5173,
      host: true, // Allow external connections
      cors: true,
      // Proxy configuration for development
      proxy: isDevelopment ? {
        '/api': {
          target: env.VITE_API_URL || 'http://localhost:8000',
          changeOrigin: true,
          secure: false,
          configure: (proxy, _options) => {
            proxy.on('error', (err, _req, _res) => {
              console.log('proxy error', err);
            });
            proxy.on('proxyReq', (proxyReq, req, _res) => {
              console.log('Sending Request to the Target:', req.method, req.url);
            });
            proxy.on('proxyRes', (proxyRes, req, _res) => {
              console.log('Received Response from the Target:', proxyRes.statusCode, req.url);
            });
          },
        }
      } : undefined
    },
    
    // Build configuration optimized for production
    build: {
      outDir: 'dist',
      sourcemap: false, // Disable sourcemaps for production to reduce bundle size
      minify: 'terser',
      
      // Optimize build for mobile devices
      rollupOptions: {
        output: {
          // Manual chunk splitting for better caching
          manualChunks: {
            // Vendor chunks
            vendor: ['react', 'react-dom'],
            router: ['react-router-dom'],
            redux: ['@reduxjs/toolkit', 'react-redux', 'redux-persist'],
            ui: ['@mui/material', '@mui/icons-material'],
            utils: ['axios', 'moment', 'date-fns']
          },
          // Optimize chunk file names
          chunkFileNames: (chunkInfo) => {
            const facadeModuleId = chunkInfo.facadeModuleId ? 
              chunkInfo.facadeModuleId.split('/').pop().replace('.js', '') : 
              'chunk';
            return `js/${facadeModuleId}-[hash].js`;
          }
        },
        
        // External dependencies for faster builds
        external: isProduction ? [] : undefined
      },
      
      // Terser options for better minification
      terserOptions: {
        compress: {
          drop_console: isProduction, // Remove console.logs in production
          drop_debugger: true,
          pure_funcs: isProduction ? ['console.log', 'console.debug', 'console.info'] : []
        },
        mangle: {
          safari10: true // Fix Safari 10 issues
        }
      },
      
      // Asset optimization
      assetsInlineLimit: 4096, // Inline assets smaller than 4kb
      cssCodeSplit: true, // Split CSS for better caching
      
      // Chunk size warning limit
      chunkSizeWarningLimit: 1600,
      
      // Target modern browsers but include mobile compatibility
      target: ['es2015', 'chrome58', 'firefox57', 'safari11', 'edge79']
    },
    
    // Preview server configuration (for production testing)
    preview: {
      port: 4173,
      host: true,
      cors: true
    },
    
    // Optimize dependencies
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-router-dom',
        '@reduxjs/toolkit',
        'react-redux',
        'axios',
        '@mui/material',
        'react-icons/fi'
      ]
    },
    
    // CSS configuration
    css: {
      devSourcemap: isDevelopment,
      preprocessorOptions: {
        scss: {
          additionalData: `$injectedColor: orange;`
        }
      }
    },
    
    // Environment variables that will be available in the client
    envPrefix: ['VITE_'],
    
    // Base URL configuration for deployment
    base: '/',
    
    // Worker configuration for better performance
    worker: {
      format: 'es'
    }
  };
});
