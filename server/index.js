import mongoose from 'mongoose';
import util from 'util';

// config should be imported before importing any other file
import config from './config/config';
import app from './config/express';

const debug = require('debug')('express-mongoose-es6-rest-api:index');

// make bluebird default Promise
Promise = require('bluebird');

// plugin bluebird promise in mongoose
mongoose.Promise = Promise;

let mongodbHostname = config.mongo.host;

// nanobox
if (process.env.APP_NAME) {
  mongodbHostname = process.env.DATA_DB_HOST;
}

const promise = mongoose.connect(
  `mongodb://${mongodbHostname}/${config.mongo.db}`,
  {
    useMongoClient: true,
    keepAlive: 1,
    // socketTimeoutMS: 1000
  }
);
promise.on('error', () => {
  throw new Error(
    `unable to connect to: ${mongodbHostname}/${config.mongo.db}`
  );
});

// print mongoose logs in dev env
if (config.mongooseDebug) {
  mongoose.set('debug', (collectionName, method, query, doc) => {
    debug(`${collectionName}.${method}`, util.inspect(query, false, 20), doc);
  });
}

// module.parent check is required to support jest watch
// https://github.com/mochajs/mocha/issues/1912
if (!module.parent) {
  // listen on port config.port
  app.listen(config.port, '0.0.0.0', () => {
    console.info(`server started on port ${config.port} (${config.env})`);
  });
}

export default app;
