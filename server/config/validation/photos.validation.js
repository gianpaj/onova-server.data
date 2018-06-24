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
  // POST /api/photos/upload-to-vk
  uploadToVK: {
    body: {
      upload_url: Joi.string()
        .uri()
        .required(),
      photos: Joi.array()
        .unique()
        .max(6)
        .items(Joi.string().uri())
        .single()
        .required(),
    },
  },
};
