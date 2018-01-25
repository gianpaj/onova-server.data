// @flow

import multer from 'multer';
import path from 'path';
import httpStatus from 'http-status';
import Storage from '@google-cloud/storage';
const debug = require('debug')('express-mongoose-es6-rest-api:index');

import { UserDoc } from '../models/user.model';
import Product from '../models/product.model';
import APIError from './APIError';
import config from '../config/config';

// const CLOUD_BUCKET = 'assets.onova.co';
const CLOUD_BUCKET = 'staging.onova-183307.appspot.com';
// const CLOUD_BUCKET = require('../givebox.shared/config').CLOUD_BUCKET;

const storage = Storage({
  // Service account key: 'storage-data-server'
  // id '3a339323d16ab4189e140a740f2381496686e235'
  keyFilename: 'Onova-3a339323d16a.json',
});
const bucket = storage.bucket(CLOUD_BUCKET);

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
      `Error: File upload only supports the following filetypes: ${filetypes}`,
      httpStatus.BAD_REQUEST
    );
    return cb(APIerr);
  },
});

/**
 * Upload product images to GCS
 */
function uploadProductImages(product: ProductDoc, files: Array<any>) {
  files.forEach((image, i) => {
    const gcsname = `products/${product.uuid}-${i + 1}.jpg`;
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
      file.makePublic().then(() => {
        const cloudStoragePublicUrl = `https://storage.googleapis.com/${
          CLOUD_BUCKET
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
          const cloudStoragePublicUrl = `https://storage.googleapis.com/${
            CLOUD_BUCKET
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
