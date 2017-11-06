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
const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true
  },
  displayName: {
    type: String,
    required: true
  },
  mobileNumber: {
    type: String,
    trim: true,
    match: [validation.mobileNumber, 'Invalid mobile number.']
  },
  emailAddress: {
    type: String,
    required: true,
    unique: true,
    // validated at API level via 'joi' and 'isemail' npm packages
    // match: [validation.emailAddress, 'Invalid email address']
  },
  password: {
    type: String,
    required: true
  },
  accountStatus: {
    type: String,
    required: true,
    default: 'notverified',
    enum: ['verified', 'notverified', 'banned', 'deleted']
  }
  // assigns 'createdAt' and 'updatedAt' fields to your schema
}, {  timestamps: 1 });

/**
 * Add your
 * - pre-save hooks
 * - validations
 * - virtuals
 */

/**
 * Helper method for validating user's password.
 */
UserSchema.methods.comparePassword = function (candidatePassword, cb) {
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
  get(id) {
    return this.findById(id)
      .exec()
      .then((user) => {
        if (!user) {
          return Promise.reject();
        }
        return user;
      })
      .catch(e =>{
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
  }
};

/**
 * Password hash middleware.
 */
UserSchema.pre('save', function (next) {
  const user = this;
  const saltRounds = parseInt(config.saltRounds);

  // only hash the password if it has been modified (or is new)
  if (!user.isModified('password')) return next();
  bcrypt.hash(user.password, saltRounds, (err, hash) => {
    if (err) { return next(err); }

    user.password = hash;
    next();
  });
});


UserSchema.index({ emailAddress: 1}, { unique: true });
UserSchema.index({ username: 1 });

/**
 * @typedef User
 */
export default mongoose.model('User', UserSchema);
