// passwordValidator.js - Password Strength Validation

// Password strength requirements
const PASSWORD_REQUIREMENTS = {
  minLength: 8,
  maxLength: 128,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
};

// Common weak passwords to block
const COMMON_PASSWORDS = [
  'password', '123456', '12345678', 'qwerty', 'abc123',
  'monkey', 'master', 'dragon', '111111', 'baseball',
  'iloveyou', 'trustno1', 'sunshine', 'princess', 'admin',
  'welcome', 'shadow', 'ashley', 'football', 'jesus',
  'michael', 'ninja', 'mustang', 'password1', '123456789',
  'adobe123', 'admin123', 'letmein', 'photoshop', '1234567',
  'password123', 'qwerty123', '123123', 'qwertyuiop', '654321',
  '7777777', '1111111', '1234', '12345', '1234567890',
  'passw0rd', 'admin1234', 'welcome1', 'login', 'root',
];

// Validate password strength
export const validatePassword = (password) => {
  const errors = [];
  
  // Check length
  if (password.length < PASSWORD_REQUIREMENTS.minLength) {
    errors.push(`Password must be at least ${PASSWORD_REQUIREMENTS.minLength} characters long`);
  }
  
  if (password.length > PASSWORD_REQUIREMENTS.maxLength) {
    errors.push(`Password must not exceed ${PASSWORD_REQUIREMENTS.maxLength} characters`);
  }
  
  // Check for common passwords
  if (COMMON_PASSWORDS.includes(password.toLowerCase())) {
    errors.push('Password is too common. Please choose a stronger password');
  }
  
  // Check character requirements
  if (PASSWORD_REQUIREMENTS.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (PASSWORD_REQUIREMENTS.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (PASSWORD_REQUIREMENTS.requireNumbers && !/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  if (PASSWORD_REQUIREMENTS.requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  
  // Check for sequential characters
  const hasSequentialChars = /(012|123|234|345|456|567|678|789|890|abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz)/i;
  if (hasSequentialChars.test(password)) {
    errors.push('Password must not contain sequential characters');
  }
  
  // Check for repeated characters
  const hasRepeatedChars = /(.)\1{2,}/;
  if (hasRepeatedChars.test(password)) {
    errors.push('Password must not contain repeated characters');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
};

// Middleware to validate password in requests
export const passwordValidationMiddleware = (req, res, next) => {
  const { password } = req.body;
  
  if (!password) {
    return res.status(400).json({ error: 'Password is required' });
  }
  
  const validation = validatePassword(password);
  
  if (!validation.isValid) {
    return res.status(400).json({
      error: 'Password does not meet security requirements',
      details: validation.errors,
    });
  }
  
  next();
};

// Check if password needs to be changed (for expired passwords)
export const isPasswordExpired = (passwordChangedAt, maxAge = 90) => {
  const ninetyDaysInMs = maxAge * 24 * 60 * 60 * 1000;
  return Date.now() - new Date(passwordChangedAt).getTime() > ninetyDaysInMs;
};

// Generate password requirements message
export const getPasswordRequirements = () => {
  const requirements = [];
  
  requirements.push(`At least ${PASSWORD_REQUIREMENTS.minLength} characters`);
  requirements.push(`At most ${PASSWORD_REQUIREMENTS.maxLength} characters`);
  
  if (PASSWORD_REQUIREMENTS.requireUppercase) {
    requirements.push('At least one uppercase letter');
  }
  
  if (PASSWORD_REQUIREMENTS.requireLowercase) {
    requirements.push('At least one lowercase letter');
  }
  
  if (PASSWORD_REQUIREMENTS.requireNumbers) {
    requirements.push('At least one number');
  }
  
  if (PASSWORD_REQUIREMENTS.requireSpecialChars) {
    requirements.push('At least one special character');
  }
  
  return requirements.join(', ');
};

export default {
  validatePassword,
  passwordValidationMiddleware,
  isPasswordExpired,
  getPasswordRequirements,
  PASSWORD_REQUIREMENTS,
};
