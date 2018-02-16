// @flow

import mongoose from 'mongoose';
import httpStatus from 'http-status';

import APIError from '../helpers/APIError';
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
  follower: MongoId;
  following: MongoId;
  dateCreated: Date;
}

FollowSchema.loadClass(FollowDoc);

/**
 * Statics
 */
FollowSchema.statics = {
  /**
   * List of follow documents in descending order of 'createdAt' timestamp.
   *
   * @param {Object} query Express query parameters
   * @param {Object} DBquery DB Query parameters (to find followers/followings)
   * @param {number} query.skip Number of follow docs to be skipped
   * @param {number} query.limit Limit number of follow docs to be returned
   */
  list({ DBquery, skip = 0, limit = 50 }): Promise<FollowDoc[] | APIError> {
    const populateField = DBquery.hasOwnProperty('following')
      ? 'follower'
      : 'following';
    return this.find(DBquery)
      .sort({ createdAt: -1 })
      .skip(+skip)
      .limit(+limit)
      .populate({
        path: populateField,
        select: 'username',
      })
      .then((follows: FollowDoc[]) => {
        if (!follows) {
          return Promise.reject();
        }
        return follows;
      })
      .catch(() => {
        const err = new APIError('Invalid follows', httpStatus.BAD_REQUEST);
        return Promise.reject(err);
      });
  },
};

FollowSchema.post('save', function(error, doc, next) {
  if (error.name === 'MongoError' && error.code === 11000) {
    const APIerr = new APIError(
      'Duplicate follower<->following',
      httpStatus.BAD_REQUEST
    );
    return next(APIerr);
  }
  next(error);
});

FollowSchema.post('save', function(doc, next) {
  User.updateOne({ _id: doc.follower }, { $inc: { followingCount: 1 } }).exec();
  // eslint-disable-next-line
  User.updateOne({ _id: doc.following }, { $inc: { followersCount: 1 } }).exec();
  next();
});

FollowSchema.post('remove', function(doc, next) {
  // eslint-disable-next-line
  User.updateOne({ _id: doc.follower }, { $inc: { followingCount: -1 } }).exec();
  // eslint-disable-next-line
  User.updateOne({ _id: doc.following }, { $inc: { followersCount: -1 } }).exec();
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
FollowSchema.index({ follower: 1, following: 1 }, { unique: true });

export default mongoose.model('Follow', FollowSchema);
