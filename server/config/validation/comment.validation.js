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
  // POST /api/products/:uuid/comments
  createComment: {
    body: {
      text: Joi.string()
        .max(300)
        .required(),
    },
    params: {
      uuid: Joi.string()
        .regex(validation.shortid)
        .required(),
    },
  },

  // DELETE /api/products/:uuid/comments
  deleteComment: {
    params: {
      uuid: Joi.string()
        .regex(validation.shortid)
        .required(),
      commentId: Joi.string()
        .hex()
        .length(24)
        .required(),
    },
  },
};
