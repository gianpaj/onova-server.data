// @flow

import gcsSharp from 'multer-sharp';
import httpStatus from 'http-status';
import multer from 'multer';
const debug = require('debug')('express-mongoose-es6-rest-api:index');

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
  crop: 16, // sharp.strategy.entropy
  toFormat: 'jpeg',
  // withoutEnlargement: true,
});
const uploadProductImage = multer({ storage });

const storageForChatImages = gcsSharp({
  bucket: 'chat-images.onova.co',
  projectId: 'onova-183307',
  keyFilename: 'Onova-3a339323d16a.json',
  destination: '',
  acl: 'publicRead',
  filename: (req, file, cb) => {
    // TODO: name files with the name of the chat room
    const uploadDate = Date.now();
    cb(null, uploadDate.toString());
  },
  sizes: [
    {
      suffix: 'thumb.jpeg',
      width: MAX_WIDTH / 2,
      height: MAX_WIDTH / 2,
    },
    {
      suffix: '.jpeg',
      width: MAX_WIDTH,
      height: MAX_HEIGHT,
    },
  ],
  // crop: 16, // sharp.strategy.entropy
  toFormat: 'jpeg',
  withoutEnlargement: true,
});
const uploadChatImage = multer({ storage: storageForChatImages });

/**
 * Upload URL image to VK
 *
 * POST /api/photos/upload-to-vk
 *
 * @property {*} req - Express request
 * @property {*} req.body - Express body parameters
 * @property {string} req.body.upload_url
 * @property {Array<string>|string} req.body.photos
 */
function uploadToVK(
  req: session$Request,
  res: express$Response,
  next: express$NextFunction
) {
  // TODO: check if we have access to VK.com

  debug('image uploaded to uk');

  const data = {};
  res.status(httpStatus.CREATED).json({ data });
}

export default {
  uploadProductImage,
  uploadChatImage,
  uploadToVK,
};
