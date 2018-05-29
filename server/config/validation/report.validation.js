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
  // POST /api/report/
  createReport: {
    body: {
      product: Joi.string().regex(validation.shortid),
      text: Joi.string()
        .min(7)
        .max(300)
        .required(),
      // userId
      user: Joi.string()
        .hex()
        .length(24),
      // comment: Joi.string()
      //   .hex()
      //   .length(24)
      //   .required(),
    },
  },
};
