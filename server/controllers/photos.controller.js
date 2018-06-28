// @flow

import gcsSharp from 'multer-sharp';
import httpStatus from 'http-status';
import multer from 'multer';
import fetch from 'node-fetch';
import FormData from 'form-data';

const debug = require('debug')('express-mongoose-es6-rest-api:index');
const download = require('image-downloader');

const MAX_WIDTH = 1440;
const MAX_HEIGHT = 1440;

const tempProductImageStorage = gcsSharp({
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
const tempUploadProductImage = multer({ storage: tempProductImageStorage });

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
async function uploadToVK(
  req: express$Request,
  res: express$Response,
  next: express$NextFunction
) {
  // TODO: check if we have access to VK.com

  // $FlowFixMe
  const { upload_url, photos } = req.body;

  // download the photos
  const dest = '/tmp';

  try {
    const downloads = photos.map(url => download.image({ url, dest }));

    const files = await Promise.all(downloads);

    debug('File(s) saved to', files.map(f => f.filename));

    let uploads = files.map(file => {
      return new Promise((resolve, reject) => {
        let formData = new FormData();
        const filename = file.filename.split('/')[
          file.filename.split('/').length - 1
        ];
        formData.append('photo', file.image, { filename });
        fetch(upload_url, {
          method: 'POST',
          // timeout: ,
          body: formData,
        })
          .then(res => res.json())
          .then(res => resolve(res))
          .catch(e => reject(e));
      });
    });

    const data = await Promise.all(uploads);

    debug('photo(s) uploaded to VK');

    res.status(httpStatus.CREATED).json({ data });
  } catch (err) {
    console.error(err);
    return next(err);
  }
}

export default {
  tempUploadProductImage,
  uploadChatImage,
  uploadToVK,
};
