// @flow

import httpStatus from 'http-status';

import APIError from '../helpers/APIError';
import User, { UserDoc } from '../models/user.model';
import Product from '../models/product.model';
import Report from '../models/report.model';
import config from '../config/config';

declare class session$Request extends express$Request {
  user: UserDoc;
}

/**
 * Report products, comments and users
 *
 * GET /api/report
 *
 * @property {*} req - Express request
 * @property {*} req.body - Express body parameters
 */
function get(
  req: session$Request,
  res: express$Response,
  next: express$NextFunction
) {
  const { limit = 50, categoryIds, description, tag, typeIds } = req.body;

  if (config.env !== 'test') {
    query = { ...query, photoURIs: { $exists: true, $not: { $size: 0 } } };
  }

  if (categoryIds) query = { ...query, categoryIds: { $in: categoryIds } };
  if (description) {
    query = { ...query, description: regex };
  }
  if (tag) query = { ...query, tags: tag };
  if (typeIds) query = { ...query, typeIds: { $in: typeIds } };

  const projection = { comments: 0 };

  // use static method from ProductSchema
  // flow-disable-next-line
  Product.find(query, projection)
    .sort({ _id: -1 }) // faster than createdAt: -1 - same ordering
    .populate({
      path: 'seller',
      select: 'username',
    })
    .limit(+limit)
    .then(data => res.json({ data }))
    .catch(e => next(e));
}

/**
 * Report products or users
 *
 * POST /api/report
 *
 * @property {*} req - Express request
 * @property {*} req.body - Express body parameters
 * @property {string} req.body.product
 * @property {string} req.body.text
 * @property {string} req.body.user
 */
async function create(
  req: session$Request,
  res: express$Response,
  next: express$NextFunction
) {
  const { product, text, user } = req.body;

  const report = new Report({ text });

  if (user) {
    try {
      const foundUser = await User.findById(user);
      if (!foundUser) {
        throw new APIError('User not found', httpStatus.NOT_FOUND);
      }
    } catch (err) {
      return next(err);
    }

    report.user = user;
  }

  if (user && product) {
    const APIerr = new APIError(
      'Report a user or product',
      httpStatus.BAD_REQUEST
    );
    return next(APIerr);
  }

  if (product) {
    try {
      const foundProduct = await Product.findById(product);
      if (!foundProduct) {
        throw new APIError('Product not found', httpStatus.NOT_FOUND);
      }
    } catch (err) {
      return next(err);
    }

    report.product = product;
  }

  report.reporter = req.user._id;

  return report
    .save()
    .then(report => {
      return res.status(httpStatus.CREATED).json({ data: report });
    })
    .catch(err => {
      if (!(err instanceof APIError)) {
        console.error(err);
        err = new APIError('Error reporting', httpStatus.INTERNAL_SERVER_ERROR);
      }
    });
}

export default {
  // get,
  create,
};
