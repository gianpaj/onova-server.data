// @flow

import Promise from 'bluebird';
import mongoose from 'mongoose';
import httpStatus from 'http-status';
import bcrypt from 'bcrypt';

import APIError from '../helpers/APIError';
import validation from '../helpers/validation';
import config from '../config/config';

/**
 * User Schema
 */
const UserSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      unique: true,
      required: true,
      set: (v: string) => v.toLowerCase().trim(),
    },
    displayName: {
      type: String,
      // required: true
    },
    mobileNumber: {
      type: String,
      trim: true,
      match: [validation.mobileNumber, 'Invalid mobile number.'],
    },
    emailAddress: {
      type: String,
      required: true,
      unique: true,
      set: (v: string) => v.toLowerCase().trim(),
      // validated at API level via 'Joi' and 'isEmail' npm packages
    },
    password: {
      type: String,
      required: true,
    },
    accountStatus: {
      type: String,
      required: true,
      default: 'notverified',
      enum: ['verified', 'notverified', 'banned', 'deleted'],
    },
    paymentInfo: {
      payment_method: {
        type: String,
        enum: ['paypal', 'c2c'],
      },
      third_party_token: String,
      // temp
      last_four: String,
      exp_month: String,
      exp_year: String,
    },
    // assigns 'createdAt' and 'updatedAt' fields to your schema
  },
  { timestamps: true }
);

export class UserDoc /*:: extends Mongoose$Document */ {
  // MongoId?
  _id: any;
  username: string;
  displayName: ?string;
  mobileNumber: string;
  emailAddress: string;
  password: string;
  accountStatus: string;
  paymentInfo: any;
}

UserSchema.loadClass(UserDoc);

/**
 * Add your
 * - pre-save hooks
 * - validations
 * - virtuals
 */

/**
 * Helper method for validating user's password.
 */
UserSchema.methods.comparePassword = function(candidatePassword, cb) {
  bcrypt.compare(candidatePassword, this.password, (err, isMatch) => {
    cb(err, isMatch);
  });
};

/**
 * Statics
 */
UserSchema.statics = {
  /**
   * Get user
   *
   * @param {ObjectId} id - The objectId of user.
   * @returns {Promise<User, APIError>}
   */
  get(id: string) {
    return this.findById(id)
      .exec()
      .then((user: UserDoc) => {
        if (!user) {
          return Promise.reject();
        }
        return user;
      })
      .catch(() => {
        const err = new APIError('Invalid user', httpStatus.BAD_REQUEST);
        return Promise.reject(err);
      });
  },

  /**
   * List users in descending order of 'createdAt' timestamp.
   *
   * @param {number} skip - Number of users to be skipped.
   * @param {number} limit - Limit number of users to be returned.
   * @returns {Promise<User[]>}
   */
  list({ skip = 0, limit = 50 } = {}) {
    return this.find()
      .sort({ createdAt: -1 })
      .skip(+skip)
      .limit(+limit)
      .exec();
  },
};

/**
 * Password hash middleware.
 */
UserSchema.pre('save', function(next) {
  const user = this;
  const saltRounds = parseInt(config.saltRounds);

  // only hash the password if it has been modified (or is new)
  if (!user.isModified('password')) return next();
  bcrypt.hash(user.password, saltRounds, (err, hash) => {
    if (err) {
      return next(err);
    }

    user.password = hash;
    next();
  });
});

// Never return 'password' and '__v' fields in the JSON representation
// Note that this doesn't effect `toObject`
UserSchema.set('toJSON', {
  getters: true,
  transform: (doc, ret) => {
    delete ret.password;
    delete ret.__v;
    return ret;
  },
});

UserSchema.index({ emailAddress: 1 }, { unique: true });
UserSchema.index({ username: 1 }, { unique: true });

/**
 * @typedef User
 */
export default mongoose.model('User', UserSchema);
