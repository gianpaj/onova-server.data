// @flow

import gcsSharp from 'multer-sharp';
import sharp from 'sharp';
import httpStatus from 'http-status';
import multer from 'multer';
import fetch from 'node-fetch';
import FormData from 'form-data';

import APIError from '../helpers/APIError';
import config from '../config/config';

const debug = require('debug')('express-mongoose-es6-rest-api:index');
const download = require('image-downloader');

const MAX_WIDTH = 1440;
const MAX_HEIGHT = 1440;
const MAX_WIDTH_AP = MAX_WIDTH / 3 * 4;
const MAX_HEIGHT_AP = MAX_WIDTH / 3 * 4;
const THUMB_MAX_WIDTH = 350;
const THUMB_MAX_HEIGHT = 350;
const TEMP_PATH = '/tmp/test_images';

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

async function tempUploadProductImage(
  req: express$Request,
  res: express$Response,
  next: express$NextFunction
) {
  const { file } = req;
  const uploadDate = Date.now();

  const pipeline = sharp(file.buffer);
  const metadata = await pipeline.metadata();

  if (metadata.width < MAX_WIDTH || metadata.height < MAX_HEIGHT) {
    const APIerr = new APIError(
      `Image too small. Min width and height 1440 px`,
      httpStatus.BAD_REQUEST
    );
    return next(APIerr);
  }
  // generate a square thumbnail

  // save locally for test
  if (config.env === 'test') {
    pipeline
      .resize(THUMB_MAX_WIDTH, THUMB_MAX_HEIGHT)
      .crop(sharp.strategy.entropy)
      .on('error', err => {
        console.log('Error generating thumbnail', err);
      })
      .toFile(`${TEMP_PATH}/${uploadDate}-thumb.jpg`)
      .then(() => {
        debug('temp thumbnail generated');
      })
      .catch(err => {
        console.error(err);
        res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: err });
      });

    let height, width;

    // if square image, do not change aspect ratio
    if (metadata.width === metadata.height) {
      height = MAX_HEIGHT;
      width = MAX_HEIGHT;
    } else if (metadata.width < metadata.height) {
      // if portrait pic, resize to width of 1440 and height of up to aspect ratio of 3:4
      height = Math.min(metadata.height, MAX_HEIGHT_AP);
      width = MAX_WIDTH;
    } else {
      // if landscape pic, resize to height of 1440 and width of up to aspect ratio of 4:3
      height = MAX_HEIGHT;
      width = Math.min(metadata.width, MAX_WIDTH_AP);
    }

    pipeline
      .resize(width, height)
      .crop(sharp.strategy.entropy)
      .on('error', err => {
        console.log('Error cropping', err);
      })
      .toFile(`${TEMP_PATH}/${uploadDate}.jpg`)
      .then(info => {
        debug('temp product image uploaded to:', info);
        res.status(httpStatus.CREATED).json({ data: info });
      })
      .catch(err => {
        console.error(err);
        res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: err });
      });
  } else {
  }

  // FIXME: req.file.path = undefined
}

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
