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
      product: validation.uuid,
      text: Joi.string()
        .min(7)
        .max(300)
        .required(),
      // userId
      user: validation.objectId,
      // comment: validation.objectId.required(),
    },
  },
};
