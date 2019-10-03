import fs from 'fs';
import path from 'path';
import parse from 'csv-parse';
import mongoose from 'mongoose';
import download from 'image-downloader';

import User from '../server/models/user.model';
import photos from '../server/helpers/photos';

// const debug = require('debug')('server-data:index');
const debug = console.log;

// const { getUsers } = require('./googleSheetUtil');

async function main() {
  try {
    const rows = await loadCSV();

    await User.deleteMany({ username: 'horondi' });

    const userCreatePromises = rows.map(user => {
      // debug(user);
      return createUser(user);
    });
    const promises = await Promise.all(userCreatePromises);
    const newUsers = promises.filter(user => !(user instanceof Error));
    console.log('Users created %j', newUsers.length);
  } catch (error) {
    console.error(error);
  }
  process.exit(0);
}

const mongoURI = 'mongodb://localhost:27017/onova-data';

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
  let input = fs.readFileSync(csvfile).toString('ascii');

  // remove the 3rd line from the file
  let lines = input.split('\n');
  lines.splice(0, 2);
  input = lines.join('\n');

  return new Promise((resolve, reject) => {
    parse(input, { comment: '#' }, function(err, lines) {
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
  const [instagramUsername, displayName, bio, profilePic] = user;

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

    const user = await User.create({
      accountStatus: 'verified',
      emailAddress: `onovaapp+${instagramUsername}@gmail.com`,
      generatedAt: new Date(),
      password: 'password',
      username,
      displayName,
      bio,
      scraping: {
        instagram: instagramUsername,
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
            debug('profilePic updated for user:', user._id);
            if (config.env === 'production') {
              return ckInst.updateUser({
                id: user._id,
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
