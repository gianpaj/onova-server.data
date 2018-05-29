// @flow

import mongoose from 'mongoose';

/**
 * User blocking Schema
 */
const BlockSchema = new mongoose.Schema({
  sourceUser: {
    ref: 'User',
    required: true,
    type: mongoose.Schema.Types.ObjectId,
  },
  targetUser: {
    ref: 'User',
    required: true,
    type: mongoose.Schema.Types.ObjectId,
  },
  createdAt: {
    default: Date.now,
    required: true,
    type: Date,
  },
});

export class BlockDoc /*:: extends Mongoose$Document */ {
  sourceUser: MongoId;
  targetUser: MongoId;
  createdAt: Date;
}

BlockSchema.loadClass(BlockDoc);

// Never return '__v' or 'id' fields in the JSON representation
// Note that this doesn't effect `toObject`
BlockSchema.set('toJSON', {
  getters: true,
  transform: (doc, ret) => {
    delete ret.id;
    delete ret.__v;
    return ret;
  },
});

BlockSchema.index({ sourceUser: 1, createdAt: -1 });
BlockSchema.index({ sourceUser: 1, targetUser: 1 }, { unique: true });

export default mongoose.model('Block', BlockSchema);
