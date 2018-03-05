// @flow

import httpStatus from 'http-status';

import APIError from '../helpers/APIError';
import { UserDoc } from '../models/user.model';
import Product, { ProductDoc } from '../models/product.model';

declare class session$Request extends express$Request {
  user: UserDoc;
  product: ProductDoc;
}

/**
 * Get product's comments
 *
 * GET /api/product/:uuid/comment
 *
 * @property {*} req - express session
 * @property {*} req.params - express session parameters
 * @property {MongoId} req.params.uuid
 */
function get(
  req: session$Request,
  res: express$Response,
  next: express$NextFunction
) {
  const { limit = 50, lastId } = req.query;

  const { comments, uuid } = req.product;
  res.json({ data: { uuid, comments } });
}

/**
 * Create new comment
 *
 * POST /api/product/:uuid/comment
 *
 * @property {*} req Express request
 * @property {*} req.params Express params parameters
 * @property {string} req.params.uuid The product uuid
 * @property {*} req.body Express body parameters
 * @property {string} req.body.text The text of the comment
 */
function create(
  req: session$Request,
  res: express$Response,
  next: express$NextFunction
) {
  if (req.user.accountStatus !== 'verified') {
    throw new APIError(
      'Please verify your account before commenting on a product.',
      httpStatus.BAD_REQUEST
    );
  }

  if (req.product.status !== 'forsale' && req.product.status !== 'reserved') {
    throw new APIError(
      'Comment cannot be added to a product that`s not forsale or reserved.',
      httpStatus.BAD_REQUEST
    );
  }

  const comment = {
    text: req.body.text,
    user: req.user._id,
  };

  Product.findOneAndUpdate(
    { _id: req.product.id },
    { $push: { comments: comment } },
    { new: true }
  )
    .then((product: ProductDoc) => {
      const lastCommment = product.comments[product.comments.length - 1];
      return res
        .status(httpStatus.CREATED)
        .json({ data: { comment: lastCommment, uuid: product.uuid } });
    })
    .catch(err => {
      return next(err);
    });
}

/**
 * Delete a product comment (require authorization)
 *
 * DELETE /api/product/:uuid/comment/:commentId
 *
 * @property {*} req Express request
 * @property {*} req.params Express params parameters
 * @property {string} req.params.uuid The product uuid
 * @property {string} req.params.commentId
 */
function remove(
  req: session$Request,
  res: express$Response,
  next: express$NextFunction
) {
  const { product } = req;

  const comment = product.comments.find(c => (c._id = req.params.commentId));

  if (comment === undefined) {
    const APIerr = new APIError(
      'Comment not found on specific product.',
      httpStatus.NOT_FOUND
    );
    return next(APIerr);
  }

  if (req.user._id.toString() !== comment.user.toString()) {
    const APIerr = new APIError(
      'Cannot delete other people`s comment',
      httpStatus.BAD_REQUEST
    );
    return next(APIerr);
  }

  Product.findOneAndUpdate(
    { _id: req.product.id },
    { $pull: { comments: comment } },
    { new: true }
  )
    .then((product: ProductDoc) => {
      return res.json({
        data: { length: product.comments.length, uuid: product.uuid },
      });
    })
    .catch(err => {
      return next(err);
    });
}

export default {
  get,
  create,
  remove,
};
