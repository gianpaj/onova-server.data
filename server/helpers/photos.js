// @flow

import multer from 'multer';
import path from 'path';
import httpStatus from 'http-status';
import Storage from '@google-cloud/storage';
import sharp from 'sharp';
const request = require('request').defaults({ encoding: null });
const debug = require('debug')('express-mongoose-es6-rest-api:index');

import { UserDoc } from '../models/user.model';
import Product, { ProductDoc } from '../models/product.model';
import APIError from './APIError';
import config from '../config/config';

const THUMB_MAX_WIDTH = 350;
const THUMB_MAX_HEIGHT = 350;

const storage = Storage({
  // Service account key: 'storage-data-server'
  // id '3a339323d16ab4189e140a740f2381496686e235'
  keyFilename: 'Onova-3a339323d16a.json',
});
const bucket = storage.bucket(config.CLOUD_BUCKET);

const uploadMulter = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB limit
  },
  fileFilter: (req, file, cb) => {
    const filetypes = /jpg|jpeg|png/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(
      path.extname(file.originalname).toLowerCase()
    );

    if (mimetype && extname) {
      return cb(null, true);
    }

    const APIerr = new APIError(
      // prettier-ignore
      `Error: File upload only supports the following filetypes: ${filetypes.toString()}`,
      httpStatus.BAD_REQUEST
    );
    return cb(APIerr);
  },
});

/**
 * Upload product images to GCS
 */
function uploadProductImages(product: ProductDoc, files: Array<any>) {
  const uploadDate = Date.now();

  // generate a square thumbnail for the 1st image
  const firstImage = files[0];
  const metadata = {
    metadata: {
      contentType: firstImage.mimetype,
    },
  };
  const thumbFilePath = `products/${product.uuid}-1-${uploadDate}-thumb.jpg`;
  const file = bucket.file(thumbFilePath);
  const thumbnailUploadStream = file.createWriteStream(metadata);

  thumbnailUploadStream.on('error', err => {
    console.log('Error uploading thumbnail', err);
  });

  const pipeline = sharp(firstImage.buffer);
  pipeline
    .resize(THUMB_MAX_WIDTH, THUMB_MAX_HEIGHT)
    .crop(sharp.strategy.entropy)
    // .max() // preserve aspect ratio and not wider than width and height
    .pipe(thumbnailUploadStream);

  thumbnailUploadStream.on('finish', () => {
    file
      .makePublic()
      .then(() => {
        debug('thumbnail uploaded');
      })
      .catch(err => {
        console.log('Error makePublic thumbnail', err);
      });
  });

  // upload full size images
  files.forEach((image, i) => {
    const gcsname = `products/${product.uuid}-${i + 1}-${uploadDate}.jpg`;
    const cloudStoragePublicUrl = `http://${config.CLOUD_BUCKET}/${gcsname}`;
    const file = bucket.file(gcsname);
    const stream = file.createWriteStream({
      metadata: {
        contentType: image.mimetype,
      },
    });
    stream.on('error', err => {
      console.log('Error uploading image', err);
    });
    stream.on('finish', () => {
      file
        .makePublic()
        .then(() => {
          debug('Saved image as', cloudStoragePublicUrl);
          const key = `photoURIs.${i}`;
          const updateObj = {};
          updateObj[key] = cloudStoragePublicUrl;
          Product.findOneAndUpdate({ _id: product._id }, { $set: updateObj })
            .then(() => {
              debug('photoURI updated for product:', product.uuid);
            })
            .catch(err => {
              console.log('Error saving product image', err);
            });
        })
        .catch(err => {
          console.log('Error makePublic product image', err);
        });
    });
    stream.end(image.buffer);
  });
}

/**
 * Upload profile image to GCS
 */
function uploadProfilePic(user: UserDoc, image: any): Promise<any> {
  return new Promise((resolve, reject) => {
    if (config.env === 'test')
      return resolve(
        'http://assets.onova.co/users/5b091babdde06965f6580a6b-1527323596437.jpg'
      );

    const gcspath = `users/${user._id.toString()}-${Date.now()}.jpg`;
    const file = bucket.file(gcspath);
    const stream = file.createWriteStream({
      metadata: {
        contentType: image.mimetype,
      },
    });
    stream.on('error', err => {
      debug('Error uploading profilePic', err);
      reject(err);
    });
    stream.on('finish', () => {
      file
        .makePublic()
        .then(() => {
          const path = `${config.CLOUD_BUCKET}/${gcspath}`;
          let cloudStoragePublicUrl = `https://storage.googleapis.com/${path}`;
          if (config.env === 'production') {
            cloudStoragePublicUrl = `http://${path}`;
          }
          resolve(cloudStoragePublicUrl);
        })
        .catch(err => {
          debug('Error saving making the image public', err);
          reject(err);
        });
    });
    stream.end(image.buffer);
  });
}

const srcBucketName = 'temp-uploads.onova.co';
const destBucketName = config.CLOUD_BUCKET;

/**
 * Generate a square thumbnail when an image is re-ordered
 * @param {string} photo URL
 */
function generateThumbnail(photo: string): Promise<string | Error> {
  return new Promise((resolve, reject) => {
    request.get(photo, (err, res, buffer) => {
      if (err) return reject(err);

      const filename = photo
        .split('/')
        [photo.split('/').length - 1].replace('.jpg', '');

      const metadata = {
        metadata: {
          contentType: buffer.mimetype, // image/jpeg
        },
      };
      const thumbFilePath = `products/${filename}-thumb.jpg`;
      const file = bucket.file(thumbFilePath);
      const thumbnailUploadStream = file.createWriteStream(metadata);

      let cloudStoragePublicUrl = photo.split('products/')[0];
      cloudStoragePublicUrl = `${cloudStoragePublicUrl}products/${thumbFilePath}`;

      thumbnailUploadStream.on('error', err => {
        console.error('Error generating thumbnail');
        reject(err);
      });

      const pipeline = sharp(buffer);
      pipeline
        .resize(THUMB_MAX_WIDTH, THUMB_MAX_HEIGHT)
        .crop(sharp.strategy.entropy)
        // .max() // preserve aspect ratio and not wider than width and height
        .pipe(thumbnailUploadStream);

      thumbnailUploadStream.on('finish', () => {
        file
          .makePublic()
          .then(() => {
            debug('thumbnail uploaded');
            resolve(cloudStoragePublicUrl);
          })
          .catch(err => {
            console.log('Error makePublic thumbnail');
            reject(err);
          });
      });
    });
  });
}

async function copyPhoto(
  photo: string,
  uuid: string,
  i: number,
  date: number,
  thumb: boolean = false
): Promise<string | Error> {
  const srcFilename = photo.replace(
    'https://storage.googleapis.com/temp-uploads.onova.co/',
    ''
  );
  const destFilename = `products/${uuid}-${i + 1}-${date}${
    thumb ? '-thumb' : ''
  }.jpg`;

  if (config.env === 'test') {
    return `http://${destBucketName}/${destFilename}`;
  }

  try {
    await storage
      .bucket(srcBucketName)
      .file(srcFilename)
      .copy(storage.bucket(destBucketName).file(destFilename));
    debug(
      `gs://${srcBucketName}/${srcFilename} copied to gs://${destBucketName}/${destFilename}.`
    );
    await storage
      .bucket(destBucketName)
      .file(destFilename)
      .makePublic();

    const path = `${destBucketName}/${destFilename}`;
    let cloudStoragePublicUrl = `https://storage.googleapis.com/${path}`;
    if (config.env === 'production') {
      cloudStoragePublicUrl = `http://${path}`;
    }
    return cloudStoragePublicUrl;
  } catch (err) {
    console.error('ERROR:', err);
    return err;
  }
}

export default {
  copyPhoto,
  generateThumbnail,
  uploadMulter,
  uploadProductImages,
  uploadProfilePic,
};
