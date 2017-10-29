import mongoose from 'mongoose';

/**
 * User verification Schema
 */
const VerificationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User'
  },
  resetToken: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    required: true,
    expires: '24h'
  }
});

/**
 * @typedef Verification
 */
export default mongoose.model('Verification', VerificationSchema);
