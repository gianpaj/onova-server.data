// @flow

import gcsSharp from 'multer-sharp';
import sharp from 'sharp';
import httpStatus from 'http-status';
import Storage from '@google-cloud/storage';
import multer from 'multer';
import fetch from 'node-fetch';
import FormData from 'form-data';

import APIError from '../helpers/APIError';
import config from '../config/config';
import photos from '../helpers/photos';

const debug = require('debug')('server-data:index');
const download = require('image-downloader');

const MIN_WIDTH = 1000;
const MIN_HEIGHT = 1000;
const MIN_WIDTH_AP = (MIN_WIDTH / 3) * 4;
const MIN_HEIGHT_AP = (MIN_WIDTH / 3) * 4;
const THUMB_WIDTH = 280;
const THUMB_HEIGHT = 280;
const TEMP_PATH = '/tmp';
const JPEG_COMPRESSION = { progressive: true, chromaSubsampling: '4:2:0' };

const storage = Storage({
  // Service account key: 'storage-data-server'
  // id '3a339323d16ab4189e140a740f2381496686e235'
  keyFilename: 'Onova-3a339323d16a.json',
});

export const bucket = 'temp-uploads.onova.co';
const tempBucket = storage.bucket(bucket);

const tempBucketURLStaging = `https://staging.onova-183307.appspot.com/${bucket}`;
const tempBucketURLProd = `https://storage.googleapis.com/${bucket}`;

export const tempBucketURL = config.env == 'dev' ? tempBucketURLStaging : tempBucketURLProd;

/**
 * Upload image to temporary bucket in GSC
 *
 * @param {*} req Express Request OR filename (if used internally)
 * @param {*} res Express Response OR callback (if used internally)
 * @param {Function} next Express Next m OR error callback (if used internally)
 * @param {Boolean} internal Whether to use the internal code path (used after scraping Instagram posts)
 */
async function tempUploadProductImage(
  req: express$Request | String,
  res: express$Response,
  next: express$NextFunction,
  internal = false
) {
  let { file } = req;
  const uploadDate = Date.now();

  if (internal) {
    file = { buffer: req };
  }
  const pipeline = sharp(file.buffer);
  const metadata = await pipeline.metadata();

  if (!internal && (metadata.width < MIN_WIDTH || metadata.height < MIN_HEIGHT)) {
    const APIerr = new APIError(
      `Image too small. Min width and height ${MIN_WIDTH} px. The uploaded image is ${metadata.width}x${
        metadata.height
      }`,
      httpStatus.BAD_REQUEST
    );
    return next(APIerr);
  }

  let height, width;

  // if square image, do not change aspect ratio
  if (metadata.width === metadata.height) {
    height = MIN_HEIGHT;
    width = MIN_HEIGHT;
  } else if (metadata.width < metadata.height) {
    // if portrait pic, resize to width of 1000 and height of up to aspect ratio of 3:4
    height = Math.min(metadata.height, MIN_HEIGHT_AP);
    width = MIN_WIDTH;
  } else {
    // if landscape pic, resize to height of 1000 and width of up to aspect ratio of 4:3
    height = MIN_HEIGHT;
    width = Math.min(metadata.width, MIN_WIDTH_AP);
  }

  // save locally for test
  if (config.env === 'test') {
    const tempFilePath = `${TEMP_PATH}/${uploadDate}.jpg`;

    pipeline
      .resize({
        width: THUMB_WIDTH,
        height: THUMB_HEIGHT,
        fit: sharp.fit.cover,
        position: sharp.strategy.entropy,
      })
      .jpeg(JPEG_COMPRESSION)
      .on('error', err => {
        console.log('Error generating thumbnail', err);
      })
      .toFile(tempFilePath.replace('.jpg', '-thumb.jpg'))
      .then(() => {
        debug('temp thumbnail generated', tempFilePath.replace('.jpg', '-thumb.jpg'));
      })
      .catch(err => {
        console.error(err);
        if (internal) res(err);
        else res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: err });
      });

    pipeline
      .resize(THUMB_WIDTH, THUMB_HEIGHT, {
        width: THUMB_WIDTH * 2,
        height: THUMB_HEIGHT * 2,
        fit: sharp.fit.cover,
        position: sharp.strategy.entropy,
      })
      .jpeg(JPEG_COMPRESSION)
      .on('error', err => {
        console.log('Error generating thumbnail', err);
      })
      .toFile(tempFilePath.replace('.jpg', '-thumb@2x.jpg'))
      .then(() => {
        debug('temp thumbnail generated', tempFilePath.replace('.jpg', '-thumb@2x.jpg'));
      })
      .catch(err => {
        console.error(err);
        res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: err });
      });

    pipeline
      .resize({
        width,
        height,
        fit: sharp.fit.cover,
        position: sharp.strategy.entropy,
      })
      .jpeg(JPEG_COMPRESSION)
      .on('error', err => {
        console.log('Error cropping', err);
      })
      .toFile(tempFilePath)
      .then(() => {
        const cloudStoragePublicUrl = `${tempBucketURL}/${uploadDate}.jpg`;
        debug('temp product image uploaded to:', cloudStoragePublicUrl);
        if (internal) res(cloudStoragePublicUrl);
        else res.status(httpStatus.CREATED).json({ data: cloudStoragePublicUrl });
      })
      .catch(err => {
        console.error(err);
        res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: err });
      });
    return;
  }
  // generate 2 square thumbnails
  const gcsname = `${uploadDate}.jpg`;
  if (internal) {
    file.metadata = `image/${metadata.format}`;
  }
  photos.uploadThumbnailToGCS(THUMB_WIDTH, THUMB_HEIGHT, file, gcsname.replace('.jpg', '-thumb.jpg'), tempBucket);
  photos.uploadThumbnailToGCS(
    THUMB_WIDTH * 2,
    THUMB_HEIGHT * 2,
    file,
    gcsname.replace('.jpg', '-thumb@2x.jpg'),
    tempBucket
  );

  // upload temp image
  const gcsFile = tempBucket.file(gcsname);
  const stream = gcsFile.createWriteStream({
    metadata: {
      contentType: !internal ? file.mimetype : `image/${metadata.format}`,
    },
  });
  stream.on('error', err => {
    console.log('Error uploading image');
    console.error(err);
    const APIerr = new APIError('Error uploading image', httpStatus.INTERNAL_SERVER_ERROR);
    next(APIerr);
  });

  try {
    sharp(file.buffer)
      .resize({
        width,
        height,
        fit: sharp.fit.cover,
        position: sharp.strategy.entropy,
      })
      .jpeg(JPEG_COMPRESSION)
      .pipe(stream);
  } catch (error) {
    console.log('Error resize, compression or cropping image');
    console.error(error);
    const APIerr = new APIError('Error uploading image', httpStatus.INTERNAL_SERVER_ERROR);
    next(APIerr);
    return;
  }

  const cloudStoragePublicUrl = `${tempBucketURL}/${gcsname}`;
  stream.on('finish', () => {
    gcsFile
      .makePublic()
      .then(() => {
        debug('temp product image uploaded to:', cloudStoragePublicUrl);
        if (internal) res(cloudStoragePublicUrl);
        else res.status(httpStatus.CREATED).json({ data: cloudStoragePublicUrl });
      })
      .catch(err => {
        console.log('Error makePublic product image');
        console.error(err);
      });
  });
}

const storageForChatImages = gcsSharp({
  bucket: 'chat-images.onova.co',
  projectId: 'onova-183307',
  keyFilename: 'Onova-3a339323d16a.json',
  destination: '',
  acl: 'publicRead',
  filename: (req, file, cb) => {
    // TODO: name files with the room id
    cb(null, Date.now().toString());
  },
  sizes: [
    {
      suffix: 'thumb.jpeg',
      width: MIN_WIDTH / 2,
      height: MIN_WIDTH / 2,
    },
    {
      suffix: '.jpeg',
      width: MIN_WIDTH,
      height: MIN_HEIGHT,
    },
  ],
  // crop: 16, // sharp.strategy.entropy
  toFormat: { type: 'jpeg', options: JPEG_COMPRESSION },
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
async function uploadToVK(req: express$Request, res: express$Response, next: express$NextFunction) {
  // TODO: check if we have access to VK.com

  // $FlowFixMe
  const { upload_url, photos } = req.body;

  // download the photos
  const dest = '/tmp';

  try {
    const downloads = photos.map(url => download.image({ url, dest }));

    const files = await Promise.all(downloads);

    debug('File(s) saved to', files.map(f => f.filename));

    const uploads = files.map(file => {
      return new Promise((resolve, reject) => {
        const formData = new FormData();
        const filename = file.filename.split('/')[file.filename.split('/').length - 1];
        formData.append('photo', file.image, { filename });
        fetch(upload_url, {
          method: 'POST',
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
    if (config.env === 'test' && err.message.includes(403)) {
      console.error("Couldn't test uploading images to VK - enable VPN access");
    } else {
      console.error(err);
    }
    next(err);
  }
}

/**
 * Download URL images and upload them to Google Cloud Storage
 *
 * @property {Array<string>|string} photos
 */
export async function uploadURLToGCS(photos) {
  // download the photos
  const dest = '/tmp';

  try {
    const downloads = photos.map(url => download.image({ url, dest }));

    const files = await Promise.all(downloads);

    debug('File(s) saved to', files.map(f => f.filename));

    const uploads = files.map(file => {
      return new Promise((resolve, reject) => {
        tempUploadProductImage(
          file.filename,
          function callback(URL) {
            resolve(URL);
          },
          function next(err) {
            console.log(err);
            reject(err);
          },
          true
        );
      });
    });

    const data = await Promise.all(uploads);

    debug('photo(s) uploaded to GCS');
    return data;
  } catch (err) {
    if (config.env === 'test') {
      console.error("Couldn't test uploading images to GCS");
    } else {
      console.error(err);
    }
    throw err;
  }
}

export default {
  tempUploadProductImage,
  uploadChatImage,
  uploadToVK,
};
