import Promise from 'bluebird';
import mongoose from 'mongoose';
import httpStatus from 'http-status';
import bcrypt from 'bcrypt';

import APIError from '../helpers/APIError';
import validation from '../helpers/validation';
import config from '../../config/config';

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
  dateCreated: {
    type: Date,
    default: Date.now
  },
  password: {
    type: String,
    required: true
  },
  accountStatus: {
    type: String,
    required: true,
    default: 'notverified',
    enum: ['verified', 'notverified', 'banned']
  }
});

/**
 * Add your
 * - pre-save hooks
 * - validations
 * - virtuals
 */

/**
 * Methods
 */
UserSchema.method({
  /**
   * Helper method for validating user's password.
   */
  comparePassword: (candidatePassword, hash, cb) => {
    bcrypt.compare(candidatePassword, hash, (err, isMatch) => {
      if (err) return cb(err);
      cb(null, isMatch);
    });
  }
});

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
        if (user) {
          return user;
        }
        const err = new APIError('No such user exists!', httpStatus.NOT_FOUND);
        return Promise.reject(err);
      });
  },

  /**
   * List users in descending order of 'dateCreated' timestamp.
   *
   * @param {number} skip - Number of users to be skipped.
   * @param {number} limit - Limit number of users to be returned.
   * @returns {Promise<User[]>}
   */
  list({ skip = 0, limit = 50 } = {}) {
    return this.find()
      .sort({ dateCreated: -1 })
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


UserSchema.index({ emailAddress: 1, unique: true });
UserSchema.index({ username: 1 });

/**
 * @typedef User
 */
export default mongoose.model('User', UserSchema);
