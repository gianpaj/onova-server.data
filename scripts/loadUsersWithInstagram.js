import fs from 'fs';
import path from 'path';
import parse from 'csv-parse';
import mongoose from 'mongoose';

import User from '../server/models/user.model';

// const debug = require('debug')('server-data:index');
const debug = console.log;

// const { getUsers } = require('./googleSheetUtil');

async function main() {
  try {
    const rows = await loadCSV();
    const userCreatePromises = rows.map(user => {
      console.log(user);
      // create User
      return createUser(user);
    });
    await Promise.all(userCreatePromises);
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
      debug(`duplicate${generated}user:\n`, existingUser);
      return;
    }
    // upload profilePic
    await User.create({
      accountStatus: 'verified',
      emailAddress: `onovaapp+${instagramUsername}@gmail.com`,
      generatedAt: new Date(),
      password: 'password',
      username: instagramUsername,
      displayName,
      bio,
      scraping: {
        instagram: instagramUsername,
      },
    });
  } catch (error) {
    console.error(error);
  }
}
