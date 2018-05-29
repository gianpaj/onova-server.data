// @flow

import httpStatus from 'http-status';

import APIError from '../helpers/APIError';
import User, { UserDoc } from '../models/user.model';
import Blocked from '../models/block.model';

declare class session$Request extends express$Request {
  user: UserDoc;
}

/**
 * Blocked users (no unblocking for now)
 *
 * POST /api/blocked
 *
 * @property {*} req - Express request
 * @property {*} req.body - Express body parameters
 * @property {string} req.body.targetUser
 */
async function create(
  req: session$Request,
  res: express$Response,
  next: express$NextFunction
) {
  const { targetUser } = req.body;

  let foundUser;
  try {
    foundUser = await User.findById(targetUser);
    if (!foundUser) {
      throw new APIError('User not found', httpStatus.NOT_FOUND);
    }
    if (foundUser._id.toString() === req.user._id.toString()) {
      throw new APIError('Cannot block yourself', httpStatus.BAD_REQUEST);
    }
    if (foundUser.accountStatus == 'deleted') {
      throw new APIError('Cannot block a deleted user', httpStatus.BAD_REQUEST);
    }
  } catch (err) {
    return next(err);
  }

  const blocked = new Blocked({
    targetUser: foundUser._id,
    sourceUser: req.user._id,
  });

  return blocked
    .save()
    .then(blocked => {
      return res.status(httpStatus.CREATED).json({ data: blocked });
    })
    .catch(err => {
      if (!(err instanceof APIError)) {
        // mongoose validation error for neither 'user' or 'product' fields
        if (err.name == 'ValidationError') {
          err = new APIError(
            'Blocked a user or product',
            httpStatus.BAD_REQUEST
          );
        } else {
          err = new APIError(
            'Error blocking',
            httpStatus.INTERNAL_SERVER_ERROR
          );
        }
      }
      next(err);
    });
}

export default {
  create,
};
