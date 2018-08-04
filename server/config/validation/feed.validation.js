import Joi from 'joi';
import validate from 'express-validation';

import validation from '../../helpers/validation';

// assign options
validate.options({
  allowUnknownBody: false,
  allowUnknownHeaders: false,
  allowUnknownQuery: false,
  allowUnknownParams: false,
  allowUnknownCookies: false,
});

export default {
  // GET /api/feed/flat
  getFlatFeed: {
    query: {
      categoryIds: validation.categoriesOrTypes,
      lastId: validation.objectId,
      limit: Joi.number()
        .min(1)
        .max(50),
      tag: validation.tag,
      typeIds: validation.categoriesOrTypes,
    },
  },
};
