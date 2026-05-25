// fileUploadSecurity.js - Secure File Upload Validation
import path from 'path';

// Allowed file types with their MIME types
const ALLOWED_FILE_TYPES = {
  images: {
    extensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'],
    mimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
    maxSize: 5 * 1024 * 1024, // 5MB
  },
  documents: {
    extensions: ['.pdf', '.doc', '.docx', '.txt'],
    mimeTypes: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'],
    maxSize: 10 * 1024 * 1024, // 10MB
  },
};

// Dangerous file extensions to block
const DANGEROUS_EXTENSIONS = [
  '.exe', '.bat', '.cmd', '.sh', '.ps1', '.vbs', '.js', '.jar',
  '.php', '.asp', '.aspx', '.jsp', '.py', '.rb', '.pl', '.cgi',
  '.dll', '.so', '.dylib', '.app', '.deb', '.rpm', '.msi',
  '.scr', '.pif', '.com', '.vbe', '.wsf', '.wsc', '.ws',
  '.reg', '.inf', '.sys', '.drv', '.cpl', '.msc', '.msp',
];

// Dangerous MIME types to block
const DANGEROUS_MIME_TYPES = [
  'application/x-executable',
  'application/x-msdownload',
  'application/x-msdos-program',
  'application/x-sh',
  'application/x-shar',
  'application/x-shellscript',
  'text/x-php',
  'application/x-php',
  'text/x-python',
  'application/x-python',
  'text/x-perl',
  'application/x-perl',
  'text/x-ruby',
  'application/x-ruby',
  'application/javascript',
  'text/javascript',
  'application/x-javascript',
];

// Validate file type
export const validateFileType = (file, category = 'images') => {
  const allowed = ALLOWED_FILE_TYPES[category];
  
  if (!allowed) {
    return { isValid: false, error: 'Invalid file category' };
  }
  
  const ext = path.extname(file.originalname).toLowerCase();
  const mimeType = file.mimetype.toLowerCase();
  
  // Check extension
  if (!allowed.extensions.includes(ext)) {
    return { isValid: false, error: `File type ${ext} is not allowed` };
  }
  
  // Check MIME type
  if (!allowed.mimeTypes.includes(mimeType)) {
    return { isValid: false, error: `MIME type ${mimeType} is not allowed` };
  }
  
  // Check for dangerous extensions
  if (DANGEROUS_EXTENSIONS.includes(ext)) {
    return { isValid: false, error: 'Dangerous file type detected' };
  }
  
  // Check for dangerous MIME types
  if (DANGEROUS_MIME_TYPES.includes(mimeType)) {
    return { isValid: false, error: 'Dangerous MIME type detected' };
  }
  
  return { isValid: true };
};

// Validate file size
export const validateFileSize = (file, category = 'images') => {
  const allowed = ALLOWED_FILE_TYPES[category];
  
  if (!allowed) {
    return { isValid: false, error: 'Invalid file category' };
  }
  
  if (file.size > allowed.maxSize) {
    const maxSizeMB = allowed.maxSize / (1024 * 1024);
    return { isValid: false, error: `File size exceeds ${maxSizeMB}MB limit` };
  }
  
  return { isValid: true };
};

// Sanitize filename
export const sanitizeFilename = (filename) => {
  // Remove path traversal attempts
  const sanitized = filename.replace(/\.\./g, '').replace(/\//g, '').replace(/\\/g, '');
  
  // Remove special characters except dots, hyphens, underscores
  const cleaned = sanitized.replace(/[^a-zA-Z0-9._-]/g, '_');
  
  // Ensure filename is not empty
  if (!cleaned) {
    return `file_${Date.now()}`;
  }
  
  return cleaned;
};

// Validate file content (basic magic number check)
export const validateFileContent = (file) => {
  return new Promise((resolve) => {
    // This is a basic check - in production, you'd want more sophisticated validation
    // For now, we rely on MIME type and extension validation
    
    // Check if file is actually an image by reading first few bytes
    if (file.mimetype.startsWith('image/')) {
      const buffer = file.buffer;
      
      // JPEG magic number
      if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
        resolve({ isValid: true });
        return;
      }
      
      // PNG magic number
      if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
        resolve({ isValid: true });
        return;
      }
      
      // GIF magic number
      if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
        resolve({ isValid: true });
        return;
      }
      
      // WebP magic number
      if (buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) {
        resolve({ isValid: true });
        return;
      }
      
      resolve({ isValid: false, error: 'File content does not match declared type' });
    } else {
      resolve({ isValid: true });
    }
  });
};

// Comprehensive file validation middleware
export const fileValidationMiddleware = (category = 'images') => {
  return async (req, res, next) => {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }
    
    const validationErrors = [];
    
    for (const file of req.files) {
      // Validate file type
      const typeValidation = validateFileType(file, category);
      if (!typeValidation.isValid) {
        validationErrors.push(`${file.originalname}: ${typeValidation.error}`);
        continue;
      }
      
      // Validate file size
      const sizeValidation = validateFileSize(file, category);
      if (!sizeValidation.isValid) {
        validationErrors.push(`${file.originalname}: ${sizeValidation.error}`);
        continue;
      }
      
      // Validate file content
      const contentValidation = await validateFileContent(file);
      if (!contentValidation.isValid) {
        validationErrors.push(`${file.originalname}: ${contentValidation.error}`);
        continue;
      }
      
      // Sanitize filename
      file.originalname = sanitizeFilename(file.originalname);
    }
    
    if (validationErrors.length > 0) {
      return res.status(400).json({
        error: 'File validation failed',
        details: validationErrors,
      });
    }
    
    next();
  };
};

// Check for file upload attacks
export const detectUploadAttack = (req, res, next) => {
  const suspiciousPatterns = [
    /\.\./, // Path traversal
    /%2e%2e/, // URL-encoded path traversal
    /\0/, // Null byte injection
    /<script/i, // Script tags
    /<iframe/i, // Iframe tags
    /<object/i, // Object tags
    /<embed/i, // Embed tags
    /javascript:/i, // JavaScript protocol
    /data:/i, // Data protocol (potential XSS)
  ];
  
  const checkValue = (value) => {
    if (typeof value === 'string') {
      for (const pattern of suspiciousPatterns) {
        if (pattern.test(value)) {
          return true;
        }
      }
    } else if (typeof value === 'object' && value !== null) {
      for (const key in value) {
        if (checkValue(value[key])) {
          return true;
        }
      }
    }
    return false;
  };
  
  // Check all request data
  if (checkValue(req.body) || checkValue(req.query) || checkValue(req.params)) {
    console.log('🚨 File upload attack detected');
    return res.status(400).json({ error: 'Malicious request detected' });
  }
  
  next();
};

// Limit number of files per upload
export const fileCountLimiter = (maxFiles = 10) => {
  return (req, res, next) => {
    if (req.files && req.files.length > maxFiles) {
      return res.status(400).json({
        error: `Too many files. Maximum ${maxFiles} files allowed per upload`,
      });
    }
    next();
  };
};

// Generate secure filename
export const generateSecureFilename = (originalFilename) => {
  const ext = path.extname(originalFilename);
  const baseName = path.basename(originalFilename, ext);
  const sanitized = sanitizeFilename(baseName);
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  
  return `${sanitized}_${timestamp}_${random}${ext}`;
};

export default {
  validateFileType,
  validateFileSize,
  sanitizeFilename,
  validateFileContent,
  fileValidationMiddleware,
  detectUploadAttack,
  fileCountLimiter,
  generateSecureFilename,
  ALLOWED_FILE_TYPES,
};
