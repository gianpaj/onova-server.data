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
  // GET /api/search/
  search: {
    query: {
      limit: Joi.number()
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
      description: Joi.string()
        .min(3)
        .max(50),
      tag: Joi.string()
        .regex(validation.hashtag)
        .min(1)
        .max(30),
      typeIds: Joi.array()
        .unique()
        .max(5)
        .items(
          Joi.number()
            .min(0)
            .max(5)
        )
        .single(),
      lastId: Joi.string()
        .hex()
        .length(24),
    },
  },
};
