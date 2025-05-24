import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";
dotenv.config({});

// Log environment variables available (without revealing secrets)
console.log("Environment variables check:", {
  CLOUD_NAME: process.env.CLOUD_NAME ? "Set" : "Not set",
  API_KEY: process.env.API_KEY ? "Set" : "Not set",
  API_SECRET: process.env.API_SECRET ? "Set" : "Not set"
});

// Use the exact environment variable names from the .env file
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME, // Use CLOUD_NAME as in the .env
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET,
});

// Log Cloudinary configuration status (without revealing secrets)
console.log("Cloudinary Configuration:", {
  cloud_name: cloudinary.config().cloud_name,
  api_key_set: !!cloudinary.config().api_key,
  api_secret_set: !!cloudinary.config().api_secret
});

// Verify the configuration
const configValid = 
  cloudinary.config().cloud_name && 
  cloudinary.config().api_key && 
  cloudinary.config().api_secret;

if (!configValid) {
  console.error("WARNING: Cloudinary configuration is incomplete. File uploads will fail.");
} else {
  console.log("Cloudinary configuration appears to be valid.");
}
// Cloudinary instance is ready to use
export default cloudinary;
