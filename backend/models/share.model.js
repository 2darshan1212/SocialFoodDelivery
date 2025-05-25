import mongoose from "mongoose";

const shareSchema = new mongoose.Schema(
  {
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      required: true,
    },
    sharedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    sharedWith: {
      type: String,
      enum: ["followers", "specific", "public", "external"],
      default: "public",
    },
    recipients: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    externalPlatform: {
      type: String,
      enum: ["whatsapp", "telegram", "twitter", "facebook", "instagram", "email", "sms", "copy", "linkedin", "pinterest", "reddit"],
      default: null,
    },
    message: {
      type: String,
      default: "",
    },
    shareLink: {
      type: String,
      default: "",
    },
    deepLink: {
      type: String,
      default: "",
    },
    richContent: {
      title: {
        type: String,
        default: ""
      },
      description: {
        type: String,
        default: ""
      },
      imageUrl: {
        type: String,
        default: ""
      },
      metadata: {
        type: Map,
        of: String,
        default: () => new Map()
      }
    },
    status: {
      type: String,
      enum: ["pending", "delivered", "viewed", "expired"],
      default: "pending",
    },
    expiresAt: {
      type: Date,
      default: function() {
        // Default expiry is 7 days from now
        const now = new Date();
        now.setDate(now.getDate() + 7);
        return now;
      },
    },
    analytics: {
      clicks: {
        type: Number,
        default: 0
      },
      views: {
        type: Number,
        default: 0
      },
      lastClicked: Date,
      referrers: [{
        source: String,
        count: Number,
        lastVisit: Date
      }],
      devices: [{
        type: String,
        count: Number
      }]
    }
  },
  { timestamps: true }
);

// Compound index to track unique shares (one user can share a post to another user only once)
shareSchema.index({ post: 1, sharedBy: 1, recipients: 1 }, { unique: true });

// Pre-save hook to generate share link and populate rich content metadata
shareSchema.pre("save", async function(next) {
  try {
    // Generate share link if not provided
    if (!this.shareLink) {
      const baseUrl = process.env.FRONTEND_URL || "http://localhost:3000";
      this.shareLink = `${baseUrl}/shared/${this._id}`;
    }
    
    // If this is a new share, populate rich content
    if (this.isNew && !this.richContent.title) {
      // Populate with post information
      const postData = await mongoose.model("Post").findById(this.post).populate('author', 'username profilePicture');
      
      if (postData) {
        this.richContent.title = postData.caption || "Delicious Food Post";
        this.richContent.description = postData.description || "Check out this amazing food post";
        this.richContent.imageUrl = postData.image || postData.video || "";
        
        // Add metadata
        if (postData.price) this.richContent.metadata.set('price', `₹${postData.price}`);
        if (postData.category) this.richContent.metadata.set('category', postData.category);
        if (postData.vegetarian !== undefined) this.richContent.metadata.set('vegetarian', postData.vegetarian ? 'Yes' : 'No');
        if (postData.rating?.average) this.richContent.metadata.set('rating', postData.rating.average.toFixed(1));
        if (postData.author?.username) this.richContent.metadata.set('author', postData.author.username);
      }
    }
    
    next();
  } catch (error) {
    next(error);
  }
});

export const Share = mongoose.model("Share", shareSchema);