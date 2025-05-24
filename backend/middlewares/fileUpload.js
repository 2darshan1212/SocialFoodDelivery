import multer from "multer";
import path from "path";
import DatauriParser from "datauri/parser.js";
import cloudinary from "../cloudinaryConfig.js";

// Configure multer for memory storage
const storage = multer.memoryStorage();

// File filter to check acceptable file types
const fileFilter = (req, file, cb) => {
  const allowedFileTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ];

  console.log("File upload attempt:", file.mimetype, file.originalname);

  if (allowedFileTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    console.log("Rejected file type:", file.mimetype);
    cb(new Error(`Unsupported file type: ${file.mimetype}`), false);
  }
};

// Create multer instance with configuration
export const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max file size
  fileFilter
});

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
    console.log("Cloudinary config check:", {
      cloud_name_set: !!cloudinary.config().cloud_name,
      api_key_set: !!cloudinary.config().api_key,
      api_secret_set: !!cloudinary.config().api_secret
    });
    
    try {
      const fileFormat = formatBufferToDataURI(file);
      
      if (!fileFormat || !fileFormat.content) {
        console.error("Format failed", { fileFormatExists: !!fileFormat, contentExists: !!(fileFormat && fileFormat.content) });
        throw new Error("Failed to format file");
      }
      
      console.log(`Uploading to Cloudinary... (file type: ${file.mimetype})`);
      const result = await cloudinary.uploader.upload(fileFormat.content, {
        resource_type: "auto",
        folder: "chat_files",
        timeout: 120000, // Increase timeout for larger files
      });
      
      console.log("Cloudinary upload successful:", result.secure_url);
      
      return {
        url: result.secure_url,
        publicId: result.public_id,
        fileType: file.mimetype.startsWith('image/') ? 'image' : 'document'
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