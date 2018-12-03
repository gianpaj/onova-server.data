// @flow

import mongoose from 'mongoose';

const { Schema } = mongoose;

const DiscardedSchema = new Schema({
  by: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    required: true,
    expires: '168h', // 7 days
  },
  discarded: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
});

export class DiscardedDoc /*:: extends Mongoose$Document */ {
  _id: MongoId;
  by: MongoId;
  createdAt: Date;
  discarded: MongoId;
}

DiscardedSchema.index({ by: 1, discarded: 1 }, { unique: true });

export default mongoose.model('Discarded', DiscardedSchema);
