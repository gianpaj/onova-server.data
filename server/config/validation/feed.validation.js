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
      limit: Joi.number()
        .min(1)
        .max(50),
      skip: Joi.number()
        .min(1)
        .max(50),
      categoryIds: Joi.array()
        .unique()
        .max(5)
        .items(
          Joi.number()
            .min(0)
            .max(5)
        )
        .single(),
      typeIds: Joi.array()
        .unique()
        .max(5)
        .items(
          Joi.number()
            .min(0)
            .max(5)
        )
        .single(),
      tag: Joi.string()
        .regex(validation.hashtag)
        .min(1)
        .max(30),
      lastId: Joi.string()
        .hex()
        .length(24),
    },
  },
};
