// @flow

import httpStatus from 'http-status';
const debug = require('debug')('express-mongoose-es6-rest-api:index');

import APIError from '../helpers/APIError';
import { UserDoc } from '../models/user.model';
import Product, { ProductDoc, CommentDoc } from '../models/product.model';
import notifCtrl, {
  NotifPayload,
} from '../controllers/notification.controller';

const i18n = {
  newComment: 'new comment from %s',
};

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
function get(req: session$Request, res: express$Response) {
  // const { limit = 50, lastId } = req.query;
  // TODO: paginate inside list of comments` array using limit & lastId

  const { comments, uuid } = req.product;
  res.json({ data: { uuid, comments } });
}

/**
 * Create new comment and create notification for seller
 *
 * TODO: create notification for @mention
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
      const lastCommment: CommentDoc =
        product.comments[product.comments.length - 1];
      const notif: NotifPayload = {
        data: {
          text: req.body.text,
          senderName: req.user.displayName || req.user.username,
          commentId: lastCommment._id,
        },
        notifI18n: i18n.newComment,
        targetUser: req.product.seller._id,
        triggeredBy: req.product._id,
        triggeredType: 'Product',
        onlyPush: false,
      };
      // only create a new notification if the comment is not by the seller
      if (product.seller.toString() !== req.user._id.toString()) {
        notifCtrl
          .createNotification(notif)
          .then(() => {
            debug('comment notification created');
          })
          .catch(err => {
            console.error(err);
          });
      }
      // if (config.env == 'prod') {
      //   mixpanel.track('new_comment', props);
      // }
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

  const comment: CommentDoc = product.comments.find(
    c => c._id == req.params.commentId
  );

  if (comment === undefined) {
    const APIerr = new APIError(
      'Comment not found on specific product.',
      httpStatus.NOT_FOUND
    );
    return next(APIerr);
  }

  if (req.user._id.toString() !== comment.user._id.toString()) {
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
      // only try to delete a new notification when the comment is not from the seller
      if (product.seller.toString() !== req.user._id.toString()) {
        notifCtrl
          .removeNotification('Comment', comment._id)
          .then(() => {
            debug('comment notification delete');
          })
          .catch(err => {
            console.error(err);
          });
      }
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
