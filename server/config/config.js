import Joi from 'joi';

const isTestEnv = process.env.NODE_ENV === 'test';

// require and configure dotenv, will load vars in .env file in process.env
if (isTestEnv) {
  console.warn('running on `test` environment');
  require('dotenv').config({ path: '.env.test' });
} else {
  require('dotenv').config();
}

// define validation for all the env vars
const envVarsSchema = Joi.object({
  NODE_ENV: Joi.string()
    .allow(['development', 'production', 'test', 'stage'])
    .default('development'),
  PORT: Joi.number().default(4040),
  MONGOOSE_DEBUG: Joi.boolean().when('NODE_ENV', {
    is: Joi.string().equal('development'),
    then: Joi.boolean().default(true),
    otherwise: Joi.boolean().default(false),
  }),
  JWT_SECRET: Joi.string()
    .required()
    .description('JWT Secret required to sign'),
  SALT_ROUNDS: Joi.string()
    .required()
    .description('The salt to be used in password encryption by bcrypt'),
  MONGO_HOST: Joi.string()
    .required()
    .description('MongoDB host'),
  MONGO_DB: Joi.string()
    .required()
    .description('MongoDB database'),
  MONGO_JOB_DB: Joi.string()
    .required()
    .description('MongoDB database for the agenda for push notifications'),
  MONGO_PORT: Joi.number().default(27017),
  // MONGO_USER: Joi.string(),
  // MONGO_PASS: Joi.string(),
  MJ_APIKEY_PUBLIC: Joi.string()
    .required()
    .description('Mailjet API public key'),
  MJ_APIKEY_PRIVATE: Joi.string()
    .required()
    .description('Mailjet API private key'),
  CLOUD_BUCKET: Joi.string()
    .required()
    .description('Google Cloud Storage bucket'),
  CHATKIT_INSTANCE: Joi.string()
    .required()
    .description('Chatkit instanceLocator'),
  CHATKIT_KEY: Joi.string()
    .required()
    .description('Chatkit key'),
  SLACK_WEBHOOK_URL: Joi.string()
    .required()
    .description('Slack Webhook URL (for reporting)'),
  FACEBOOK_APP_ID: Joi.string()
    .required()
    .description(
      'Facebook APP ID for Login? and Posting item on sellers` walls'
    ),
  FACEBOOK_APP_SECRET: Joi.string()
    .required()
    .description('Facebook APP Secret'),
  VK_APP_ID: Joi.string()
    .required()
    .description('VK APP ID for Auth to post item on sellers` walls'),
  VK_SECRET_KEY: Joi.string()
    .required()
    .description('VK APP Secret'),
})
  .unknown()
  .required();

const { error, value: envVars } = Joi.validate(process.env, envVarsSchema);
if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

const config = {
  env: envVars.NODE_ENV,
  port: envVars.PORT,
  mongooseDebug: envVars.MONGOOSE_DEBUG,
  jwtSecret: envVars.JWT_SECRET,
  saltRounds: envVars.SALT_ROUNDS,
  mongo: {
    host: envVars.MONGO_HOST,
    db: envVars.MONGO_DB,
    jobDb: envVars.MONGO_JOB_DB,
    port: envVars.MONGO_PORT,
    // user: encodeURIComponent(envVars.MONGO_USER),
    // pass: encodeURIComponent(envVars.MONGO_PASS),
  },
  mailjet: {
    apikeyPublic: envVars.MJ_APIKEY_PUBLIC,
    apikeyPrivate: envVars.MJ_APIKEY_PRIVATE,
  },
  CLOUD_BUCKET: envVars.CLOUD_BUCKET,
  FACEBOOK_APP_ID: envVars.FACEBOOK_APP_ID,
  FACEBOOK_APP_SECRET: envVars.FACEBOOK_APP_SECRET,
  VK_APP_ID: envVars.VK_APP_ID,
  VK_SECRET_KEY: envVars.VK_SECRET_KEY,

  chatkit: {
    instanceLocator: envVars.CHATKIT_INSTANCE,
    key: envVars.CHATKIT_KEY,
  },

  SLACK_WEBHOOK_URL: envVars.SLACK_WEBHOOK_URL,

  // hard coded settings
  JOBNAMES: {
    PUSHCOMMENT: 'send-push-comment',
    PUSHFOLLOW: 'send-push-follow',
    PUSHORDER: 'send-push-order',
    SCHEDULE: 'listing-schedule',
  },
  settings: {
    // TODO: Hold products (for 'onhold' orders) for 15 minutes.
    // When limit is reached, the onhold order is canceled. And Product is set back to 'forsale'.
    holdProductFor: 900,
    // TODO: Wait the seller to confirm the order for 1 hour.
    // When limit is reached, the pending order is canceled.
    orderPendingFor: 3600,
    MAX_DAYS_TRACKING_NUMBER_VALID_FOR: 7, // calendar days (included)
  },
  DEFAULT_FOLLOW: true,
  // DEFAULT_USERNAMES_TO_FOLLOW: [
  //   'seller1',
  //   'seller2',
  //   'seller3',
  //   'seller4',
  //   'seller5',
  // ],
};

export default config;
