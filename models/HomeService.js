import mongoose from "mongoose";

const homeServiceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please provide service name"],
      trim: true
    },
    category: {
      type: String,
      required: true,
      enum: ["cleaning", "plumbing", "electrical", "carpentry", "painting", "gardening", "pest-control", "hvac"],
      index: true
    },
    description: {
      type: String,
      required: [true, "Please provide description"],
      trim: true
    },
    
    // Service details
    services: {
      offered: [String], // List of specific services offered
      specialties: [String], // Specializations
      experience: {
        type: Number, // Years of experience
        default: 0
      }
    },
    
    // Provider information
    provider: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    businessName: {
      type: String,
      trim: true
    },
    
    // Location
    location: {
      city: {
        type: String,
        required: true,
        index: true
      },
      address: {
        type: String,
        required: true
      },
      coordinates: {
        type: {
          type: String,
          enum: ["Point"],
          default: "Point"
        },
        coordinates: {
          type: [Number],
          default: [0, 0]
        }
      },
      serviceRadius: {
        type: Number, // km
        default: 25
      }
    },
    
    // Pricing
    pricing: {
      baseRate: {
        type: Number,
        required: true
      },
      rateType: {
        type: String,
        enum: ["hourly", "fixed", "per-room", "per-sqft"],
        required: true
      },
      currency: {
        type: String,
        default: "KES"
      },
      additionalFees: [{
        name: String,
        amount: Number,
        description: String
      }],
      minimumCharge: {
        type: Number,
        default: 0
      }
    },
    
    // Availability
    availability: {
      hours: {
        type: String,
        default: "9:00 AM - 6:00 PM"
      },
      days: [{
        type: String,
        enum: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
      }],
      responseTime: {
        type: String,
        default: "Within 2 hours"
      },
      emergencyService: {
        type: Boolean,
        default: false
      }
    },
    
    // Contact information
    contact: {
      phone: {
        type: String,
        required: true
      },
      email: String,
      whatsapp: String,
      website: String
    },
    
    // Media
    images: [String],
    portfolioImages: [String],
    portfolioDetails: [{
      category: String,
      description: String,
      beforeImage: String,
      afterImage: String
    }],
    
    // Certifications and qualifications
    certifications: [{
      name: String,
      issuer: String,
      issuedDate: Date,
      expiryDate: Date,
      certificateNumber: String
    }],
    
    // Languages
    languages: [String],
    
    // Team information
    teamInfo: {
      teamSize: Number,
      members: [{
        name: String,
        role: String,
        experience: Number
      }]
    },
    
    // Verification
    verification: {
      verified: {
        type: Boolean,
        default: false
      },
      documents: [{
        type: String,
        url: String,
        verified: Boolean,
        verifiedAt: Date
      }],
      badges: [{
        type: {
          type: String,
          enum: ["identity_verified", "business_verified", "professional_verified", "background_checked", "insured"]
        },
        verifiedAt: {
          type: Date,
          default: Date.now
        }
      }]
    },
    
    // Reviews
    reviews: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      },
      rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5
      },
      comment: String,
      createdAt: {
        type: Date,
        default: Date.now
      }
    }],
    
    // Statistics
    stats: {
      views: {
        type: Number,
        default: 0
      },
      bookings: {
        type: Number,
        default: 0
      },
      completedJobs: {
        type: Number,
        default: 0
      },
      rating: {
        type: Number,
        default: 0
      },
      reviewCount: {
        type: Number,
        default: 0
      },
      responseRate: {
        type: Number,
        default: 0
      }
    },
    
    // Featured and promotion
    featured: {
      type: Boolean,
      default: false,
      index: true
    },
    promotionEndDate: {
      type: Date,
      default: null
    },
    
    // Status
    status: {
      type: String,
      enum: ["pending", "active", "suspended", "deleted"],
      default: "pending",
      index: true
    }
  },
  { 
    timestamps: true,
    index: { 
      location: "2dsphere" 
    }
  }
);

// Auto-unfeature expired promotions
homeServiceSchema.pre("save", function (next) {
  if (this.featured && this.promotionEndDate && new Date() > this.promotionEndDate) {
    this.featured = false;
    this.promotionEndDate = null;
  }
  next();
});

// Create geospatial index for location queries
homeServiceSchema.index({ "location.coordinates": "2dsphere" });

const HomeService = mongoose.models.HomeService || mongoose.model("HomeService", homeServiceSchema, "homeServices");

export default HomeService;