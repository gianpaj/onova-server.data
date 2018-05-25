// @flow

import multer from 'multer';
import path from 'path';
import httpStatus from 'http-status';
import Storage from '@google-cloud/storage';
import sharp from 'sharp';
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
  if (config.env == 'test') return;

  const uploadDate = Date.now();

  // generate thumbnails
  files.forEach((image, i) => {
    const metadata = {
      contentType: image.mimetype,
    };
    const thumbFilePath = `products/${product.uuid}-${i +
      1}-${uploadDate}-thumb.jpg`;
    const file = bucket.file(thumbFilePath);
    const thumbnailUploadStream = file.createWriteStream(metadata);

    thumbnailUploadStream.on('error', err => {
      console.log('Error uploading thumbnail', err);
    });

    const pipeline = sharp(image.buffer);
    pipeline
      .resize(THUMB_MAX_WIDTH, THUMB_MAX_HEIGHT)
      .max() // preserve aspect ratio and not wider than width and height
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
  });

  // upload full size images
  files.forEach((image, i) => {
    const gcsname = `products/${product.uuid}-${i + 1}-${uploadDate}.jpg`;
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
        const cloudStoragePublicUrl = `http://${
          config.CLOUD_BUCKET
        }/${gcsname}`;
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
 * Upload to GCS
 */
function uploadProfilePic(user: UserDoc, image: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const gcsname = `users/${user._id}-${Date.now()}.jpg`;
    const file = bucket.file(gcsname);
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
          const cloudStoragePublicUrl = `http://${
            config.CLOUD_BUCKET
          }/${gcsname}`;
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

export default { uploadMulter, uploadProductImages, uploadProfilePic };
