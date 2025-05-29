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
import { app, server, io } from "./socket/socket.js";

dotenv.config({});

const PORT = env.PORT;
//middlewares
// Configure CORS to accept requests from both production and development environments
// Enhanced CORS middleware to ensure all requests from the production deployment work correctly
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigins = env.cors.ALLOWED_ORIGINS;
  
  // Check if the request origin is allowed or if using wildcard pattern matching
  const isAllowed = 
    allowedOrigins.includes(origin) || 
    allowedOrigins.some(allowed => {
      // Handle wildcard patterns like https://*.onrender.com
      if (allowed.includes('*')) {
        const pattern = allowed.replace('*', '.*');
        return new RegExp(pattern).test(origin);
      }
      return false;
    });

  // Set appropriate CORS headers based on origin
  if (isAllowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    console.log(`CORS: Allowed origin: ${origin}`);
  } else if (origin) {
    console.log(`CORS: Rejected origin: ${origin}`);
  }

    // Set other CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', env.cors.METHODS.join(', '));
  
  // Enhanced header handling to fix the cache-control CORS issue
  const allowedHeaders = env.cors.ALLOWED_HEADERS.join(', ');
  res.setHeader('Access-Control-Allow-Headers', allowedHeaders);
  
  // Additional exposed headers
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length, X-Requested-With, Authorization, set-cookie');
  
  // Detailed CORS logging for debugging
  if (req.method === 'OPTIONS') {
    console.log('CORS Preflight Request:');
    console.log(`- Origin: ${req.headers.origin}`);
    console.log(`- Request Method: ${req.headers['access-control-request-method']}`);
    console.log(`- Request Headers: ${req.headers['access-control-request-headers']}`);
    
    // Extended preflight response for browsers
    res.setHeader('Access-Control-Max-Age', '86400'); // Cache preflight for 24 hours
    return res.status(204).end();
  }
  
  return next();
});

// Make io available throughout the app
app.set("io", io);

app.use(express.json());
app.use(cookieParser());
app.use(urlencoded({ extended: true }));

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
  console.log(`Received ${signal}. Starting graceful shutdown...`);

  try {
    // Close change streams first
    console.log("Closing change streams...");
    await closeChangeStreams();

    // Close the server
    console.log("Closing HTTP server...");
    server.close(() => {
      console.log("HTTP server closed.");

      // Close database connection
      console.log("Closing database connection...");
      mongoose.connection.close(false, () => {
        console.log("Database connection closed.");
        process.exit(0);
      });
    });

    // Force close after timeout
    setTimeout(() => {
      console.error("Forced shutdown after timeout!");
      process.exit(1);
    }, 10000);
  } catch (error) {
    console.error("Error during shutdown:", error);
    process.exit(1);
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

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  gracefulShutdown("unhandledRejection");
});
