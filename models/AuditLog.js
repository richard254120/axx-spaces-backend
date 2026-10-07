const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema({
  admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  action: { type: String, required: true }, // e.g., 'approve_review', 'approve_material'
  targetId: { type: mongoose.Schema.Types.ObjectId, required: false },
  targetType: { type: String, required: false }, // e.g., 'Review', 'Material', 'Verification'
  details: { type: mongoose.Schema.Types.Mixed }, // arbitrary extra info
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('AuditLog', AuditLogSchema);
