// @flow

import mongoose from 'mongoose';
import User from '../models/user.model';
const Schema = mongoose.Schema;

/** @namespace */
var FollowSchema = new Schema({
  follower: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  following: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  dateCreated: {
    type: Date,
    default: Date.now,
    required: true,
  },
});

export class FollowDoc /*:: extends Mongoose$Document */ {
  userId: MongoId;
  dateCreated: Date;
}

FollowSchema.loadClass(FollowDoc);

FollowSchema.post('save', function(doc, next) {
  User.updateOne({ _id: doc.follower }, { $inc: { followingCount: 1 } }).then();
  // eslint-disable-next-line
  User.updateOne({ _id: doc.following }, { $inc: { followersCount: 1 } }).then();
  next();
});

FollowSchema.post('remove', function(next) {
  // eslint-disable-next-line
  User.updateOne({ id: this.follower }, { $inc: { followingCount: -1 } }).then();
  // eslint-disable-next-line
  User.updateOne({ id: this.following }, { $inc: { followersCount: -1 } }).then();
  next();
});

// Never return '__v' fields in the JSON representation
// Note that this doesn't effect `toObject`
FollowSchema.set('toJSON', {
  getters: true,
  transform: (doc, ret) => {
    delete ret.id;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

FollowSchema.index({ follower: 1, dateCreated: 1 });
FollowSchema.index({ following: 1, dateCreated: 1 });

export default mongoose.model('Follow', FollowSchema);
