// @flow

const mongoose = require('mongoose');
const throat = require('throat');
const Sendbird = require('sendbird-platform-api');
const pick = require('lodash/pick');
const { sleep } = require('../server/__tests__/utils');

const User = require('../server/models/user.model').default;

const config = require('../server/config/config').default;

const sb = Sendbird(config.sendbird.apikey, config.sendbird.apiurl);

async function main() {
  console.log('loading users');

  const usersToCreate = await User.find({
    accountStatus: 'verified',
  }); //.limit(5);
  console.log('usersToCreate:', usersToCreate.length);

  let i = 0;
  const promises = usersToCreate
    // .filter((c, i) => i < 4)
    .map(
      throat(5, async user => {
        i++;
        try {
          console.log(`${i}/${usersToCreate.length}`, user.username);
          await createChatUser(user);
        } catch (error) {
          // debugger;
          if (error.error.code == 400202) {
            console.error('user already created: %j (%j)', user.id, user.username);
            return Promise.resolve();
          } else {
            console.error(error);
          }
          console.error('error with user: %j (%j)', user.id, user.username);
          throw error;
          // return Promise.resolve();
        }
        await sleep(1000);
      })
    );
  await Promise.all(promises);
  console.log('done loading');

  process.exit(0);
}

const mongoURI = 'mongodb://localhost:9999/onova-data';

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

async function createChatUser(user: UserDoc) {
  const metadata = pick(user, 'types', 'emailAddress', 'createdAt');
  return sb.users.create({
    user_id: user._id,
    nickname: user.username,
    profile_url: user.profilePic || '',
    metadata: { ...metadata, types: metadata.types.toString() },
  });
}
