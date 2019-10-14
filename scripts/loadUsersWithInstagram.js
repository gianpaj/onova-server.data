import fs from 'fs';
import path from 'path';
import parse from 'csv-parse';
import mongoose from 'mongoose';
import download from 'image-downloader';
import Chatkit from '@pusher/chatkit-server';

import User from '../server/models/user.model';
import photos from '../server/helpers/photos';
import { getCategoryId } from '../server/__tests__/utils';
import config from '../server/config/config';

let ckInst;
if (config.env == 'production') {
  ckInst = new Chatkit({
    instanceLocator: config.chatkit.instanceLocator,
    key: config.chatkit.key,
  });
} else {
  console.warn('not running in production. Chatkit account creation disabled');
}

// const debug = require('debug')('server-data:index');
const debug = console.log;

const alex = {
  mobileNumber: '0677929197',
  platform: 'android',
  pushToken:
    'dQb3oC3zp3g:APA91bHgQhOzKVnigf8V7r90oCWpxK28kpzXA3TCH5ibpdj_eCcUQy5XWzCofRKvDo3624EFAmXJvzUJroK3C2FNwmr9VXgHpnTYapY9Zq2-CBRChRIMVmfhQI8ihe7rjIX5wJ_EfxPa',
  shippingAddress: {
    firstName: 'Олександр',
    lastName: 'Костінський ',
    city: 'db5c88f5-391c-11dd-90d9-001a92567626',
    departmentNovaposhta: '39931b85-e1c2-11e3-8c4a-0050568002cf',
  },
  paymentInfo: {
    short: {
      first_four: '5167',
      last_four: '8789',
      card_token: '***REMOVED***',
    },
    full: {
      first_four: '5167',
      last_four: '8789',
      card_token: '***REMOVED***', // ends with 8789
    },
  },
};

async function main() {
  try {
    const rows = await loadCSV();

    // await User.deleteMany({ username: 'netaki_ua' });
    console.log(rows);

    //FIXME: do a single mongodb query to find all the existing users to skip

    const promises = await Promise.all(rows.map(user => createUser(user)));
    const newUsers = promises.filter(user => !(user instanceof Error));
    console.log('Users created %j', newUsers.length);
  } catch (error) {
    console.error(error);
  }
  process.exit(0);
}

const mongoURI = `mongodb://${config.mongo.host}:${config.mongo.port}/${config.mongo.db}`;

const options = {
  keepAlive: 1,
  useNewUrlParser: true,
};

mongoose.connect(mongoURI, options).then(
  () => {
    console.log(`connected to ${mongoURI}`);
    main();
  },
  err => {
    throw new Error(`unable to connect to: ${mongoURI} - ${err}`);
  }
);

function loadCSV() {
  const csvfile = path.join(__dirname, '../ig-users.csv');
  let input = fs.readFileSync(csvfile, { encoding: 'utf8' });

  // remove the 3rd line from the file
  let lines = input.split('\n');
  lines.splice(0, 2);
  input = lines.join('\n');

  return new Promise((resolve, reject) => {
    parse(input, { comment: '#', rtrim: true, trim: true, escape: "'" }, function(err, lines) {
      if (err) {
        console.error('An error occurred while parsing the CSV document:\r\n', err);
        return reject(err);
      }

      lines.map(function(line) {
        // remove the first column – it's empty
        line.shift(1, 1);
      });
      resolve(lines);
    });
  });
}

/**
 *
 * @param {Array} user - row from CSV file
 */
async function createUser(user) {
  const [instagramUsername, displayName, bio, profilePic, category] = user;

  try {
    const existingUser = await User.findOne({
      $or: [
        {
          scraping: { instagram: instagramUsername },
        },
        {
          emailAddress: `onovaapp+${instagramUsername}@gmail.com`,
        },
      ],
    });

    if (existingUser) {
      let generated = ' ';
      if (existingUser.generatedAt) {
        generated = ' (generated) ';
      }
      // debug(`duplicate${generated}user:\n`, existingUser);
      debug(`not adding duplicate${generated}username: %j`, existingUser.username);
      throw new Error('duplicate');
    }
    const username = await findUniqueUsername(instagramUsername);

    const Promises = [];

    const now = new Date();
    const user = await User.create({
      ...alex,
      accountStatus: 'verified',
      emailAddress: `onovaapp+${instagramUsername}@gmail.com`,
      createdAt: now,
      updatedAt: now,
      generatedAt: now,
      password: 'password',
      username,
      displayName,
      bio,
      scraping: {
        instagram: instagramUsername,
        preferredCategoryId: getCategoryId(category),
      },
    });
    if (profilePic) {
      // or download image and the upload to PUT /api/users/:userId

      // download the photos
      const dest = '/tmp';
      const file = await download.image({ url: profilePic, dest });

      file.mimetype = 'image/jpeg';
      file.buffer = file.image;

      debug('profilePic saved to %j', file.filename);

      Promises.push(
        photos
          .uploadProfilePic(user, file)
          .then(cloudStoragePublicUrl => {
            user.profilePic = cloudStoragePublicUrl;
            debug('profilePic uploaded for user:', user._id);
            if (config.env === 'production') {
              return ckInst.createUser({
                id: user._id,
                name: user.username,
                avatarURL: cloudStoragePublicUrl,
              });
            }
          })
          .catch(err => {
            console.error('Error saving user profilePic', err);
            throw err;
          })
      );
    }
    await Promise.all(Promises);
    await user.save();
    console.log(`Username: ${user.username} created.`);
  } catch (error) {
    if (error.message !== 'duplicate') console.error(error);
    return error;
  }
}

function findUniqueUsername(username, suffix) {
  const possibleUsername = username + (suffix || '');

  return new Promise((resolve, reject) => {
    User.findOne(
      {
        username: { $regex: new RegExp(`^${possibleUsername}$`, 'i') },
      },
      function(err, user) {
        if (err) return reject(err);
        if (!user) return resolve(possibleUsername);
        return findUniqueUsername(username, (suffix || 0) + 1);
      }
    );
  });
}
