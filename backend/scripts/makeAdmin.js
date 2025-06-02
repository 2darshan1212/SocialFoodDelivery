// Script to make a user an admin
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

// Make user an admin
const makeAdmin = async (email) => {
  try {
    // Connect to database
    await connectDB();

    if (!email) {
      console.error('Please provide an email address');
      console.log('Usage: node makeAdmin.js <email>');
      process.exit(1);
    }

    // Find user by email
    const user = await User.findOne({ email });

    if (!user) {
      console.error(`User with email ${email} not found`);
      
      // List available users
      const users = await User.find({}).select('username email isAdmin').limit(10);
      if (users.length > 0) {
        console.log('\nAvailable users:');
        users.forEach(u => {
          console.log(`- ${u.email} (${u.username}) - Admin: ${u.isAdmin ? 'Yes' : 'No'}`);
        });
      }
      
      process.exit(1);
    }

    if (user.isAdmin) {
      console.log(`User ${user.username} (${user.email}) is already an admin`);
      process.exit(0);
    }

    // Update user to admin
    user.isAdmin = true;
    await user.save();

    console.log(`✅ User ${user.username} (${user.email}) is now an admin`);
    
    // Disconnect
    mongoose.disconnect();
    console.log('MongoDB disconnected');
    process.exit(0);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

// Get email from command line arguments
const email = process.argv[2];
makeAdmin(email); 