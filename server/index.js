import mongoose from 'mongoose';
import util from 'util';
// import stream from 'getstream-node';

// config should be imported before importing any other file
import config from './config/config';
import app from './config/express';

const debug = require('debug')('express-mongoose-es6-rest-api:index');

let mongoURI = `mongodb://${config.mongo.host}:${config.mongo.port}/${
  config.mongo.db
}`;

let options = {
  keepAlive: 1,
  // socketTimeoutMS: 1000
};

mongoose.connect(mongoURI, options).then(
  () => {
    console.log(`connected to ${mongoURI}`);
  },
  err => {
    throw new Error(`unable to connect to: ${mongoURI} - ${err}`);
  }
);

// print mongoose logs in dev env
if (config.mongooseDebug) {
  mongoose.set('debug', (collectionName, method, query, doc) => {
    debug(`${collectionName}.${method}`, util.inspect(query, false, 20), doc);
  });
}

// if (config.env == 'production') {
//   // send the mongoose instance with registered models to StreamMongoose
//   stream.mongoose.setupMongoose(mongoose);
// }

// module.parent check is required to support jest watch
// https://github.com/mochajs/mocha/issues/1912
if (!module.parent) {
  // listen on port config.port
  app.listen(config.port, '0.0.0.0', () => {
    console.info(`server started on port ${config.port} (${config.env})`);
  });
}

export default app;
