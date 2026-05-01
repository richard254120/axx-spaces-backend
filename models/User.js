import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phone: { type: String, required: true },
  
  // ✅ NEW - Role system
  role: { type: String, enum: ['landlord', 'caretaker', 'admin'], default: 'landlord' },
  
  // ✅ NEW - For caretakers: who they work for
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  
  // ✅ NEW - For landlords: list of caretakers they've hired
  caretakers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  
  isApproved: { type: Boolean, default: false } // Admin changes this
}, { timestamps: true });

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