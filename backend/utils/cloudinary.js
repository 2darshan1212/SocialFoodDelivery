import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";
dotenv.config({});

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "dkb9eibj2", // Fallback to a default value
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET,
});

// Log Cloudinary configuration status (without revealing secrets)
console.log("Cloudinary configuration status:", {
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "dkb9eibj2",
  api_key_present: !!process.env.API_KEY,
  api_secret_present: !!process.env.API_SECRET
});
export default cloudinary;
