import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true, select: false }, // Never return password by default
  phone: { type: String, required: true, unique: true },

  // Important fields
  role: { 
    type: String, 
    enum: ['landlord', 'caretaker', 'admin'], 
    default: 'landlord',
    immutable: true   // Prevents changing role after creation
  },

  isApproved: { 
    type: Boolean, 
    default: false 
  },

  // For landlords who invite caretakers
  caretakers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],

  assignedTo: {  // For caretakers
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }

}, { timestamps: true });

// Prevent double hashing
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

const User = mongoose.models.User || mongoose.model('User', userSchema);
export default User;