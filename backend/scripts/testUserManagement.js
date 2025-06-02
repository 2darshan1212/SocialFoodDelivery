// Test script for user management endpoints
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User } from '../models/user.model.js';

// Load environment variables
dotenv.config();

// MongoDB connection
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

// Test user management functionality
const testUserManagement = async () => {
  try {
    // Connect to database
    await connectDB();

    console.log('=== User Management Test ===');
    
    // Get all users with pagination
    const users = await User.find({})
      .select('username email isAdmin isBlocked profilePicture createdAt')
      .sort({ createdAt: -1 })
      .limit(5);
    
    console.log(`\nFound ${users.length} users:`);
    users.forEach(user => {
      console.log(`- ${user.username} (${user.email}) - Admin: ${user.isAdmin ? 'Yes' : 'No'}, Blocked: ${user.isBlocked ? 'Yes' : 'No'}`);
    });
    
    // Test admin user search
    const adminUsers = await User.find({ isAdmin: true });
    console.log(`\nAdmin users: ${adminUsers.length}`);
    adminUsers.forEach(user => {
      console.log(`- ${user.username} (${user.email})`);
    });
    
    // Test search functionality
    if (users.length > 0) {
      const searchTerm = users[0].username.substring(0, 3);
      const searchResults = await User.find({
        $or: [
          { username: { $regex: searchTerm, $options: "i" } },
          { email: { $regex: searchTerm, $options: "i" } }
        ]
      });
      console.log(`\nSearch results for "${searchTerm}": ${searchResults.length} users`);
    }
    
    console.log('\n✅ User management test completed successfully!');
    
    // Disconnect
    mongoose.disconnect();
    console.log('MongoDB disconnected');
    process.exit(0);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

// Run the test
testUserManagement(); 