import multer from "multer";
import path from "path";
import DatauriParser from "datauri/parser.js";
import cloudinary from "../cloudinaryConfig.js";
import jwt from "jsonwebtoken";

// Environment detection
const isProduction = process.env.NODE_ENV === 'production';
console.log(`File upload middleware running in ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'} mode`);

// Configure multer for memory storage
const storage = multer.memoryStorage();

// File filter to check acceptable file types
const fileFilter = (req, file, cb) => {
  const allowedFileTypes = [
    // Image files
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    // Video files
    'video/mp4',
    'video/mpeg',
    'video/quicktime', // MOV files
    'video/x-msvideo', // AVI files
    'video/webm',
    'video/ogg',
    'video/3gpp',
    // Document files
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ];

  console.log("File upload attempt:", file.mimetype, file.originalname);

  if (allowedFileTypes.includes(file.mimetype)) {
    console.log("Accepted file type:", file.mimetype, file.originalname);
    cb(null, true);
  } else {
    console.log("Rejected file type:", file.mimetype);
    cb(new Error(`Unsupported file type: ${file.mimetype}`), false);
  }
};

/**
 * Production-ready multer configuration with custom authorization detection
 * for both local development and render.com deployment
 */

// Custom multer storage to check authentication before accepting uploads
const customMulterHandler = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max file size (increased to accommodate videos)
  fileFilter
});

// Create enhanced upload middleware that verifies token even in production
export const upload = {
  single: (fieldName) => {
    return [
      // Middleware to verify authentication even for file uploads in production
      (req, res, next) => {
        // For file uploads in production, the token may be in URL parameter
        // Extract it and set in request headers for authentication middleware
        const urlToken = req.query._auth || req.query.token;
        
        if (urlToken && !req.headers.authorization) {
          console.log('Using token from URL parameter for file upload');
          req.headers.authorization = `Bearer ${urlToken}`;
          
          // Also set in cookies to maximize compatibility
          if (!req.cookies) req.cookies = {};
          if (!req.cookies.token) req.cookies.token = urlToken;
        }
        
        // Check token integrity if present (but don't require it here, let auth middleware do that)
        if (urlToken) {
          try {
            const decoded = jwt.verify(urlToken, process.env.SECRET_KEY || process.env.JWT_SECRET);
            console.log('Valid upload token from URL for user:', decoded.userId || decoded.id);
          } catch (err) {
            console.log('Invalid upload token from URL:', err.message);
          }
        }
        
        next();
      },
      customMulterHandler.single(fieldName)
    ];
  },
  // Add other multer methods (array, fields, etc) as needed
  array: (fieldName, maxCount) => customMulterHandler.array(fieldName, maxCount),
  fields: (fields) => customMulterHandler.fields(fields),
  none: () => customMulterHandler.none()
};

// Convert buffer to data URI
const parser = new DatauriParser();
export const formatBufferToDataURI = (file) => {
  try {
    if (!file || !file.buffer) {
      throw new Error("Invalid file or missing buffer");
    }

    const extName = path.extname(file.originalname).toString();
    return parser.format(extName, file.buffer);
  } catch (error) {
    console.error("Error formatting buffer to data URI:", error);
    throw error;
  }
};

// Upload file to Cloudinary
export const uploadToCloudinary = async (file) => {
  try {
    console.log("Starting Cloudinary upload for:", file.originalname, "Size:", file.size, "bytes");
    
    if (!file || !file.buffer) {
      console.error("Missing file or buffer", { file: !!file, buffer: !!(file && file.buffer) });
      throw new Error("Invalid file or missing buffer");
    }
    
    // Log Cloudinary config status without sensitive data
    const cloudConfig = cloudinary.config();
    console.log("Cloudinary config check:", {
      cloud_name: cloudConfig.cloud_name ? cloudConfig.cloud_name.substring(0, 4) + '...' : 'missing',
      api_key_set: !!cloudConfig.api_key,
      api_secret_set: !!cloudConfig.api_secret
    });
    
    // Determine resource type based on mimetype
    let resourceType = "auto";
    if (file.mimetype.startsWith('image/')) {
      resourceType = "image";
    } else if (file.mimetype.startsWith('video/')) {
      resourceType = "video";
    }
    
    try {
      // Convert buffer to data URI
      const fileFormat = formatBufferToDataURI(file);
      
      if (!fileFormat || !fileFormat.content) {
        console.error("Format failed", { fileFormatExists: !!fileFormat, contentExists: !!(fileFormat && fileFormat.content) });
        throw new Error("Failed to format file");
      }
      
      console.log(`Uploading to Cloudinary as ${resourceType}... (file type: ${file.mimetype})`);
      
      // Use different folder based on file type for better organization
      const folder = file.mimetype.startsWith('image/') ? "images" : 
                   file.mimetype.startsWith('video/') ? "videos" : "documents";
      
      const result = await cloudinary.uploader.upload(fileFormat.content, {
        resource_type: resourceType,
        folder: folder,
        timeout: 120000, // Increase timeout for larger files
      });
      
      console.log("Cloudinary upload successful:", result.secure_url);
      
      return {
        url: result.secure_url,
        publicId: result.public_id,
        fileType: file.mimetype.startsWith('image/') ? 'image' : 
                 file.mimetype.startsWith('video/') ? 'video' : 'document'
      };
    } catch (formatError) {
      console.error("Error in formatting or uploading:", formatError);
      throw formatError;
    }
  } catch (error) {
    console.error("Error uploading to Cloudinary:", error);
    // Return null instead of throwing, allowing the API to continue
    // and provide a user-friendly error message
    return null;
  }
};