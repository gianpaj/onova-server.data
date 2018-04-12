// @flow

// import httpStatus from 'http-status';
// import stream from 'getstream-node';

// import APIError from '../helpers/APIError';
import { UserDoc } from '../models/user.model';
import Product from '../models/product.model';
import config from '../config/config';

declare class session$Request extends express$Request {
  user: UserDoc;
}

function escapeRegex(text) {
  return text.replace(/[^a-zA-Z0-9_]/g, '\\$&');
}

/**
 * Search for products
 *
 * GET /api/search
 *
 * e.g.
 * GET /api/search/?categoryIds[]=1&categoryIds[]=2&tag=winter&typeIds[]=1&description=lviv
 * (only one is valid)
 *
 * @property {*} req - Express request
 * @property {*} req.query - Express query parameters
 * @property {Array<number>=} req.query.categoryIds
 * @property {string} req.query.description
 * @property {string} req.query.tag Limited to a single tag
 * @property {Array<number>=} req.query.typeIds
 * @property {number} req.query.limit Limit number of products to be returned
 */
function get(
  req: session$Request,
  res: express$Response,
  next: express$NextFunction
) {
  const { limit = 50, categoryIds, description, tag, typeIds } = req.query;

  let query = {
    status: 'forsale',
  };

  if (config.env !== 'test') {
    query = { ...query, photoURIs: { $exists: true, $not: { $size: 0 } } };
  }

  if (categoryIds) query = { ...query, categoryIds: { $in: categoryIds } };
  if (description) {
    const regex = new RegExp(escapeRegex(description), 'i');
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

export default {
  get,
};
