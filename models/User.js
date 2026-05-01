import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phone: { type: String, required: true },
  isApproved: { type: Boolean, default: false } // Admin changes this
}, { timestamps: true });

/**
 * ✅ FIX 2: PREVENT DOUBLE HASHING
 * This runs before .save(). If you are just approving a user, 
 * the password is NOT modified, so we skip hashing.
 */
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

export default mongoose.model('User', userSchema);  