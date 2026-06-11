import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure storage for verification documents
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, "../uploads/verification"));
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

// File filter to accept only specific file types
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "application/pdf",
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Invalid file type. Only JPEG, PNG, WebP, and PDF files are allowed."), false);
  }
};

// Configure multer for document uploads
const uploadVerificationDocuments = multer({
  storage: storage,
  limits: {
    fileSize: 15 * 1024 * 1024, // 15MB limit
  },
  fileFilter: fileFilter,
}).fields([
  { name: "idDocument", maxCount: 1 },
  { name: "addressDocument", maxCount: 1 },
  { name: "businessRegistration", maxCount: 1 },
  { name: "selfie", maxCount: 1 },
]);

// Middleware to process uploaded files and attach to request
export const processVerificationUploads = (req, res, next) => {
  if (!req.files) {
    return next();
  }

  const uploadedDocuments = [];
  let uploadedSelfie = null;

  // Process ID document
  if (req.files.idDocument && req.files.idDocument[0]) {
    const file = req.files.idDocument[0];
    uploadedDocuments.push({
      type: "national_id",
      url: `/uploads/verification/${file.filename}`,
      filename: file.filename,
      mimetype: file.mimetype,
      size: file.size,
    });
  }

  // Process address document
  if (req.files.addressDocument && req.files.addressDocument[0]) {
    const file = req.files.addressDocument[0];
    uploadedDocuments.push({
      type: "utility_bill",
      url: `/uploads/verification/${file.filename}`,
      filename: file.filename,
      mimetype: file.mimetype,
      size: file.size,
    });
  }

  // Process business registration
  if (req.files.businessRegistration && req.files.businessRegistration[0]) {
    const file = req.files.businessRegistration[0];
    uploadedDocuments.push({
      type: "business_registration",
      url: `/uploads/verification/${file.filename}`,
      filename: file.filename,
      mimetype: file.mimetype,
      size: file.size,
    });
  }

  // Process selfie
  if (req.files.selfie && req.files.selfie[0]) {
    const file = req.files.selfie[0];
    uploadedSelfie = {
      url: `/uploads/verification/${file.filename}`,
      filename: file.filename,
      mimetype: file.mimetype,
      size: file.size,
    };
  }

  req.uploadedDocuments = uploadedDocuments;
  req.uploadedSelfie = uploadedSelfie;

  next();
};

export default uploadVerificationDocuments;
