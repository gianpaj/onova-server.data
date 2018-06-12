// @flow

import express from 'express';
import passport from 'passport';
import httpStatus from 'http-status';
import multer from 'multer';
import gcsSharp from 'multer-sharp';
const debug = require('debug')('express-mongoose-es6-rest-api:index');
// import path from 'path';

// import config from '../config/config';

const requireAuth = passport.authenticate('jwt', { session: false });
const router = express.Router();

const MAX_WIDTH = 1440;
const MAX_HEIGHT = 1440;

const storage = gcsSharp({
  bucket: 'temp-uploads.onova.co',
  projectId: 'onova-183307',
  keyFilename: 'Onova-3a339323d16a.json',
  destination: '',
  acl: 'publicRead',
  filename: (req, file, cb) => {
    const uploadDate = Date.now();
    cb(null, uploadDate.toString());
  },
  sizes: [
    {
      suffix: 'thumb.jpeg',
      width: 700,
      height: 700,
    },
    {
      suffix: '.jpeg',
      width: MAX_WIDTH,
      height: MAX_HEIGHT,
    },
  ],
  crop: 'center',
  toFormat: 'jpeg',
  // withoutEnlargement: true,
});
const upload = multer({ storage });

// const metaReader = sharp()
//   .metadata()
//   .then(info => {
//     console.log(info);
//   });

// $FlowFixMe
router
  .route('/upload')
  .post(upload.single('photo'), requireAuth, (req, res, next) => {
    debug('Saved image as', req.file.path);
    res.status(httpStatus.CREATED).json({ data: req.file });
  });

export default router;
