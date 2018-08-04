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
      uuid: validation.uuid.required(),
    },
  },

  // DELETE /api/products/:uuid/comments
  deleteComment: {
    params: {
      uuid: validation.uuid.required(),
      commentId: validation.objectId.required(),
    },
  },
};
