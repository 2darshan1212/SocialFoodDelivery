import express from "express";
import { verifyToken } from "../middlewares/verifyToken.js";
import { verifyAdmin } from "../middlewares/verifyAdmin.js";
import { 
  createOrder, 
  getUserOrders, 
  getOrderById, 
  cancelOrder, 
  reorder,
  getAllOrders,
  updateOrderStatus,
  getOrderStats,
  getOrderStatusHistory,
  assignOrderAgent,
  verifyPickupCode,
  completePickup,
  getPickupCodeDebug
} from "../controllers/order.controller.js";
import isAuthenticated from "../middlewares/isAuthenticated.js";

const router = express.Router();

// User endpoints
// Create a new order
router.post("/create", verifyToken, createOrder);

// Get all orders for the current user
router.get("/user-orders", verifyToken, getUserOrders);

// Get a specific order by ID
router.get("/:id", verifyToken, getOrderById);

// Cancel an order
router.put("/:id/cancel", verifyToken, cancelOrder);

// Reorder (create a new order from previous order)
router.post("/:id/reorder", verifyToken, reorder);

// Update order status (can be used by regular users)
router.put("/:id/status", verifyToken, updateOrderStatus);

// Pickup verification endpoints
// Verify pickup code (for post authors)
router.post("/verify-pickup", verifyToken, verifyPickupCode);

// Complete pickup (for post authors)
router.post("/complete-pickup", verifyToken, completePickup);

// Debug endpoint to check pickup code (development only)
router.get("/pickup-debug/:orderId", verifyToken, getPickupCodeDebug);

// Test notification route (for debugging)
router.post('/test-notification', isAuthenticated, async (req, res) => {
  try {
    const { recipientId, message = "Test order notification" } = req.body;
    
    if (!recipientId) {
      return res.status(400).json({ success: false, message: "Recipient ID is required" });
    }

    // Import here to avoid circular dependency
    const { createNotification } = await import("../controllers/notification.controller.js");
    const { io, getReceiverSocketId, getConnectedUsers } = await import("../socket/socket.js");
    const { User } = await import("../models/user.model.js");
    
    console.log(`=== TESTING NOTIFICATION SYSTEM ===`);
    console.log(`Sender: ${req.user.username} (${req.user.id})`);
    console.log(`Recipient: ${recipientId}`);
    
    // Debug: Show all connected users
    getConnectedUsers();
    
    // Create fake order data
    const fakeOrder = {
      _id: "test-order-" + Date.now(),
      total: 299.99,
      status: "processing",
      createdAt: new Date()
    };
    
    // Create database notification
    const dbNotification = await createNotification(
      req.user.id,
      recipientId,
      "order",
      message,
      null,
      null,
      fakeOrder._id
    );
    
    // Send socket notification
    const authorSocketId = getReceiverSocketId(recipientId);
    if (authorSocketId) {
      const realtimeNotification = {
        type: "order",
        sender: {
          _id: req.user.id,
          username: req.user.username,
          profilePicture: req.user.profilePicture
        },
        recipient: recipientId,
        order: fakeOrder,
        message: message,
        createdAt: new Date().toISOString(),
        read: false
      };

      console.log(`Sending test notification via socket...`);
      io.to(authorSocketId).emit("newNotification", realtimeNotification);
    }

    res.json({
      success: true,
      message: "Test notification sent",
      data: {
        socketConnected: !!authorSocketId,
        dbNotificationId: dbNotification?._id
      }
    });
  } catch (error) {
    console.error("Test notification error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Admin endpoints
// Get all orders with filters and pagination
router.get("/admin/all", verifyToken, verifyAdmin, getAllOrders);

// Get order statistics
router.get("/admin/stats", verifyToken, verifyAdmin, getOrderStats);

// Update order status
router.put("/admin/:id/status", verifyToken, verifyAdmin, updateOrderStatus);

// Get order status history
router.get("/admin/:id/status-history", verifyToken, verifyAdmin, getOrderStatusHistory);

// Assign delivery agent
router.put("/admin/:id/assign-agent", verifyToken, verifyAdmin, assignOrderAgent);

export default router; 