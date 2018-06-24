// @flow

import express from 'express';
import passport from 'passport';
import httpStatus from 'http-status';
import photosCtrl from '../controllers/photos.controller';
const debug = require('debug')('express-mongoose-es6-rest-api:index');

const requireAuth = passport.authenticate('jwt', { session: false });
const router = express.Router();

// const metaReader = sharp()
//   .metadata()
//   .then(info => {
//     console.log(info);
//   });

// $FlowFixMe
router
  .route('/upload')
  .post(
    photosCtrl.uploadProductImage.single('photo'),
    requireAuth,
    (req, res, next) => {
      debug('product image uploaded to:', req.file.path);
      res.status(httpStatus.CREATED).json({ data: req.file });
    }
  );

// $FlowFixMe
router
  .route('/upload-chat-images')
  .post(
    photosCtrl.uploadChatImage.single('photo'),
    requireAuth,
    (req, res, next) => {
      debug('chat image uploaded to:', req.file.path);
      res.status(httpStatus.CREATED).json({ data: req.file });
    }
  );

export default router;
