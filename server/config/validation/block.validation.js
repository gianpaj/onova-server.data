import Joi from 'joi';
import validate from 'express-validation';

// assign options
validate.options({
  allowUnknownBody: false,
  allowUnknownHeaders: false,
  allowUnknownQuery: false,
  allowUnknownParams: false,
  allowUnknownCookies: false,
});

export default {
  // POST /api/block/
  createBlock: {
    body: {
      targetUser: Joi.string()
        .hex()
        .length(24),
    },
  },
};
