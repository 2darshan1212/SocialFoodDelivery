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
      // Fix BigInt global availability
      global: 'globalThis',
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
      
      // Target modern browsers that support BigInt
      target: ['es2020', 'chrome67', 'firefox68', 'safari14', 'edge79'],
      
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
            utils: ['axios', 'moment', 'date-fns'],
            // Separate crypto/blockchain libraries to isolate BigInt issues
            crypto: ['@solana/web3.js', '@solana/wallet-adapter-base', '@solana/wallet-adapter-react'],
            wallet: ['@solana/wallet-adapter-react-ui', '@solana/wallet-adapter-wallets'],
            blockchain: ['ethers', '@story-protocol/core-sdk']
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
      
      // Terser options for better minification with BigInt support
      terserOptions: {
        compress: {
          drop_console: isProduction, // Remove console.logs in production
          drop_debugger: true,
          pure_funcs: isProduction ? ['console.log', 'console.debug', 'console.info'] : [],
          // Preserve BigInt operations
          keep_infinity: true,
          passes: 2
        },
        mangle: {
          safari10: true, // Fix Safari 10 issues
          // Keep BigInt-related functions intact
          reserved: ['BigInt', 'BigUint64Array', 'BigInt64Array']
        },
        format: {
          // Preserve BigInt literals
          preserve_annotations: true,
          comments: false
        }
      },
      
      // Asset optimization
      assetsInlineLimit: 4096, // Inline assets smaller than 4kb
      cssCodeSplit: true, // Split CSS for better caching
      
      // Chunk size warning limit (increased for crypto libraries)
      chunkSizeWarningLimit: 2000,
    },
    
    // Preview server configuration (for production testing)
    preview: {
      port: 4173,
      host: true,
      cors: true
    },
    
    // Optimize dependencies with BigInt support
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
      ],
      // Exclude problematic crypto dependencies from pre-bundling
      exclude: [
        '@solana/web3.js',
        '@solana/wallet-adapter-base',
        '@solana/wallet-adapter-react',
        '@solana/wallet-adapter-react-ui',
        '@solana/wallet-adapter-wallets',
        'ethers',
        '@story-protocol/core-sdk'
      ],
      // Force ESM for better BigInt support
      esbuildOptions: {
        target: 'es2020',
        // Define global for crypto libraries
        define: {
          global: 'globalThis'
        }
      }
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
