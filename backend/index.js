import express, { urlencoded } from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// ES Module equivalent of __dirname and __filename
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import connectDB from "./utils/db.js";
import mongoose from "mongoose";
import {
  setupChangeStreams,
  closeChangeStreams,
} from "./utils/changeStreams.js";
import env from "./config/environment.js";
import userRoute from "./routes/user.route.js";
import postRoute from "./routes/post.route.js";
import storyRoute from "./routes/storyRoutes.js";
import messageRoute from "./routes/message.route.js";
import notificationRoute from "./routes/notification.route.js";
import shareRoute from "./routes/share.route.js";
import orderRoute from "./routes/order.route.js";
import categoryRoute from "./routes/category.route.js";
import deliveryAgentRoute from "./routes/deliveryAgent.route.js";
import testRoute from "./routes/test.route.js";
import authDebugRoute from "./routes/authDebug.route.js";
import diagnosticsRoute from "./routes/diagnostics.route.js";
import { app, server, io } from "./socket/socket.js";

dotenv.config({});

const PORT = env.PORT;
//middlewares
// Configure CORS to accept requests from both production and development environments
// Enhanced CORS with better cross-origin authentication support
const allowedOrigins = env.cors.ALLOWED_ORIGINS || ['http://localhost:5173', 'http://localhost:3000'];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, postman)
    if (!origin) return callback(null, true);
    
    // Check if origin is allowed
    if (allowedOrigins.indexOf(origin) !== -1 || origin.includes('localhost')) {
      console.log('CORS: Allowed origin:', origin);
      return callback(null, true);
    } else {
      console.log('CORS: Blocked origin:', origin);
      return callback(null, false);
    }
  },
  credentials: true, // Important for cookies/auth
  exposedHeaders: ['Authorization', 'x-auth-token', 'token', 'set-cookie'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token', 'token', 'x-requested-with']
}));

// Add detailed CORS debugging middleware
app.use((req, res, next) => {
  // Log detailed information for OPTIONS requests (preflight)
  if (req.method === 'OPTIONS') {
    console.log('CORS Preflight Request:');
    console.log(`- Origin: ${req.headers.origin}`);
    console.log(`- Request Method: ${req.headers['access-control-request-method']}`);
    console.log(`- Request Headers: ${req.headers['access-control-request-headers']}`);
  }
  
  next();
});

// Make io available throughout the app
app.set("io", io);

app.use(express.json());

// Enhanced cookie parser configuration with production settings
app.use(cookieParser(process.env.COOKIE_SECRET || process.env.SECRET_KEY || 'food-delivery-secret'));

// Support for URL-encoded bodies
app.use(urlencoded({ extended: true }));

// Set secure headers
app.use((req, res, next) => {
  // Add security headers for production
  if (process.env.NODE_ENV === 'production') {
    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    // Enable XSS protection in browsers
    res.setHeader('X-XSS-Protection', '1; mode=block');
    // Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');
  }
  next();
});

//api's
app.use("/api/v1/user", userRoute);
app.use("/api/v1/post", postRoute);
app.use("/api/v1/message", messageRoute);
app.use("/api/v1/story", storyRoute);
app.use("/api/v1/notifications", notificationRoute);
app.use("/api/v1/share", shareRoute);
app.use("/api/v1/orders", orderRoute);
app.use("/api/v1/category", categoryRoute);
app.use("/api/v1/delivery", deliveryAgentRoute);
app.use("/api/v1/test", testRoute);
app.use("/api/v1/auth-debug", authDebugRoute);
app.use("/api/v1/diagnostics", diagnosticsRoute);

// Also add a direct echo route for testing the base API structure
app.get('/api/echo', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'API echo endpoint is working',
    timestamp: new Date().toISOString()
  });
});

//Routes

// API health check
app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    message: "Server is running",
    time: new Date().toISOString(),
    routes: {
      orders: "/api/v1/orders",
      posts: "/api/v1/post",
      users: "/api/v1/user",
      delivery: "/api/v1/delivery",
    },
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("Error:", err);
  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  res.status(statusCode).json({
    success: false,
    statusCode,
    message,
  });
});

// Correctly set up static file serving
const distPath = path.join(__dirname, "../frontend/dist");

// First, check if the directory exists before serving
if (fs.existsSync(distPath)) {
  // Serve static files with proper caching
  app.use(express.static(distPath, {
    // Set cache control headers for better performance
    etag: true,
    lastModified: true,
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.html')) {
        // Don't cache HTML files
        res.setHeader('Cache-Control', 'no-cache');
      } else if (filePath.match(/\.(js|css)$/)) {
        // Cache JS and CSS for 1 day
        res.setHeader('Cache-Control', 'public, max-age=86400');
      } else if (filePath.match(/\.(jpg|jpeg|png|gif|ico|svg)$/)) {
        // Cache images for 7 days
        res.setHeader('Cache-Control', 'public, max-age=604800');
      }
    }
  }));

  // Handle client-side routing - AFTER API routes but before sending 404s
  app.get("*", (req, res) => {
    // Skip API routes - they should be handled by their own handlers
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ success: false, message: 'API endpoint not found' });
    }
    
    // Check if index.html exists
    const indexPath = path.join(distPath, "index.html");
    if (fs.existsSync(indexPath)) {
      // For client routes, send the index.html file
      return res.sendFile(indexPath);
    } else {
      return res.status(404).send('Application files not found. The app may not be built yet.');
    }
  });
}

server.listen(PORT, async () => {
  await connectDB();
  console.log(`Server is running on port ${PORT}`);

  // Set up MongoDB change streams for real-time updates
  await setupChangeStreams();
});

// Graceful shutdown handling
const gracefulShutdown = async (signal) => {
  // Set the shutdown flag to prevent infinite loops
  isShuttingDown = true;
  console.log(`Received ${signal}. Starting graceful shutdown...`);

  try {
    // Close change streams first
    console.log("Closing change streams...");
    await closeChangeStreams();

    // Create a promise that resolves when the server closes
    const closeServer = () => {
      return new Promise((resolve) => {
        console.log("Closing HTTP server...");
        server.close(() => {
          console.log("HTTP server closed.");
          resolve();
        });
      });
    };

    // Wait for server to close
    await closeServer();

    // Close database connection using Promise-based approach
    console.log("Closing database connection...");
    try {
      await mongoose.connection.close();
      console.log("Database connection closed successfully.");
    } catch (dbError) {
      console.error("Error closing database connection:", dbError.message);
      // Continue shutdown even if DB connection close fails
    }

    console.log("Shutdown complete. Exiting process.");
    // Exit gracefully
    process.exit(0);
  } catch (error) {
    console.error("Error during shutdown:", error);
    process.exit(1);
  } finally {
    // Force close after timeout as a fallback
    setTimeout(() => {
      console.error("Forced shutdown after timeout!");
      process.exit(1);
    }, 10000);
  }
};

// Set up signal handlers for graceful shutdown
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  gracefulShutdown("uncaughtException");
});

// Keep track of shutdown state to prevent infinite loops
let isShuttingDown = false;

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  
  // Only trigger graceful shutdown if we're not already shutting down
  // This prevents infinite loops when shutdown itself causes rejections
  if (!isShuttingDown) {
    isShuttingDown = true;
    gracefulShutdown("unhandledRejection");
  } else {
    console.warn("Ignoring unhandled rejection during shutdown process");
  }
});
