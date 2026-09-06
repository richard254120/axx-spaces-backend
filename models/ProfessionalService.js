import mongoose from "mongoose";

const professionalServiceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please provide professional name"],
      trim: true
    },
    category: {
      type: String,
      required: true,
      enum: ["legal", "accounting", "consulting", "tutoring", "medical", "engineering", "architecture", "other"],
      index: true
    },
    description: {
      type: String,
      required: [true, "Please provide description"],
      trim: true
    },
    
    // Professional information
    professional: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    professionalInfo: {
      title: {
        type: String,
        default: "Professional"
      },
      experience: {
        type: Number, // Years of experience
        default: 0
      },
      specializations: [String],
      education: [{
        degree: String,
        institution: String,
        field: String,
        graduationYear: Number
      }],
      certifications: [{
        name: String,
        issuer: String,
        obtainedDate: Date,
        expiryDate: Date,
        certificateNumber: String
      }],
      languages: [String],
      professionalSummary: String
    },
    
    // Business information
    businessInfo: {
      companyName: String,
      registrationNumber: String,
      taxId: String,
      website: String,
      foundedYear: Number,
      employees: Number,
      businessType: {
        type: String,
        enum: ["sole-proprietor", "partnership", "corporation", "llc", "ngo"],
        default: "sole-proprietor"
      }
    },
    
    // Services offered
    services: {
      offered: [String],
      consultationTypes: [{
        type: String,
        enum: ["in-person", "video-call", "phone", "email"]
      }],
      typicalDuration: String, // e.g., "1 hour", "30 minutes"
      followUpIncluded: {
        type: Boolean,
        default: false
      }
    },
    
    // Location
    location: {
      city: {
        type: String,
        required: true,
        index: true
      },
      address: String,
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
      remoteConsultation: {
        type: Boolean,
        default: true
      },
      serviceArea: [String] // Cities/regions served
    },
    
    // Pricing
    pricing: {
      hourlyRate: {
        type: Number,
        required: true
      },
      currency: {
        type: String,
        default: "KES"
      },
      consultationFee: {
        type: Number,
        default: 0
      },
      packageRates: [{
        name: String,
        description: String,
        price: Number,
        duration: String,
        includes: [String]
      }],
      minimumBilling: {
        type: Number,
        default: 0
      },
      paymentTerms: String
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
      noticeRequired: {
        type: String,
        default: "24 hours"
      },
      emergencyConsultation: {
        type: Boolean,
        default: false
      },
      timezone: String
    },
    
    // Contact information
    contact: {
      phone: {
        type: String,
        required: true
      },
      email: String,
      whatsapp: String,
      linkedin: String,
      website: String,
      officeAddress: String
    },
    
    // Media
    images: [String],
    credentials: [String], // Uploads of degrees, licenses, etc.
    
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
      licenses: [{
        type: String,
        number: String,
        issuingAuthority: String,
        expiryDate: Date,
        verified: Boolean
      }],
      professionalBody: String,
      licenseNumber: String,
      backgroundCheck: {
        completed: Boolean,
        date: Date,
        result: String
      }
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
      professionalFeedback: {
        expertise: Number,
        communication: Number,
        value: Number,
        timeliness: Number
      },
      consultationType: String,
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
      consultations: {
        type: Number,
        default: 0
      },
      clients: {
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
      },
      averageResponseTime: String
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
professionalServiceSchema.pre("save", function (next) {
  if (this.featured && this.promotionEndDate && new Date() > this.promotionEndDate) {
    this.featured = false;
    this.promotionEndDate = null;
  }
  next();
});

// Create geospatial index for location queries
professionalServiceSchema.index({ "location.coordinates": "2dsphere" });

const ProfessionalService = mongoose.models.ProfessionalService || mongoose.model("ProfessionalService", professionalServiceSchema, "professionalServices");

export default ProfessionalService;