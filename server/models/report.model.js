// @flow

import mongoose from 'mongoose';

/**
 * User, Comment or Product reporting Schema
 */
const ReportSchema = new mongoose.Schema({
  blocked: {
    type: Boolean,
  },
  // comment: {
  //   type: mongoose.Schema.Types.ObjectId,
  // },
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: function() {
      return !this.user;
    },
  },
  reporter: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User',
  },
  text: {
    type: String,
    required: true,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: function() {
      return !this.product;
    },
  },
  createdAt: {
    type: Date,
    default: Date.now,
    required: true,
  },
});

export class ReportDoc /*:: extends Mongoose$Document */ {
  blocked: Boolean;
  // comment: MongoId;
  product: MongoId;
  reporter: MongoId;
  text: String;
  user: MongoId;
  createdAt: Date;
}

ReportSchema.loadClass(ReportDoc);

// Never return '__v' or 'id' fields in the JSON representation
// Note that this doesn't effect `toObject`
ReportSchema.set('toJSON', {
  getters: true,
  transform: (doc, ret) => {
    delete ret.id;
    delete ret.__v;
    return ret;
  },
});

ReportSchema.index({ reporter: 1, date: -1 });
ReportSchema.index({ reporter: 1, user: 1 }, { unique: true });
ReportSchema.index({ reporter: 1, product: 1 }, { unique: true });
// ReportSchema.index({ reporter: 1, commentId: 1 }, { unique: true });

export default mongoose.model('Report', ReportSchema);
