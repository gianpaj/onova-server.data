import Joi from 'joi';

const isTestEnv = process.env.NODE_ENV === 'test';
const isDevEnv = process.env.NODE_ENV === 'development';

// require and configure dotenv, will load vars in .env file in process.env
if (isTestEnv) {
  console.warn('running on `test` environment');
  require('dotenv').config({ path: '.env.test' });
} else if (isDevEnv) {
  console.warn('running on `development` environment');
  require('dotenv').config({ path: '.env.development' });
} else {
  require('dotenv').config();
}

const nonRequiredForTest = {
  is: Joi.string().valid(['development', 'production']),
  then: Joi.required(),
};

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
  MONGO_HOST: Joi.string().required(),
  MONGO_DB: Joi.string().required(),
  MONGO_JOB_DB: Joi.string()
    .required()
    .description('MongoDB database for the agenda for push notifications'),
  MJ_APIKEY_PUBLIC: Joi.string().required(),
  MJ_APIKEY_PRIVATE: Joi.string().required(),
  CLOUD_BUCKET: Joi.string()
    .required()
    .description('Google Cloud Storage bucket'),
  CHATKIT_INSTANCE: Joi.string()
    .description('Chatkit instanceLocator')
    .when('NODE_ENV', nonRequiredForTest),
  CHATKIT_KEY: Joi.string().when('NODE_ENV', nonRequiredForTest),
  SLACK_WEBHOOK_URL: Joi.string()
    .description('Slack Webhook URL (for reporting)')
    .when('NODE_ENV', nonRequiredForTest),
  // FACEBOOK_APP_ID: Joi.string().description("Facebook APP ID for Posting item on sellers' walls [not using]"),
  // FACEBOOK_APP_SECRET: Joi.string().description('Facebook APP Secret [not using]'),
  VK_APP_ID: Joi.string()
    .description("VK APP ID for Auth to post item on sellers' walls")
    .when('NODE_ENV', nonRequiredForTest),
  VK_SECRET_KEY: Joi.string().when('NODE_ENV', nonRequiredForTest),
  SEGMENT: Joi.string()
    .description('Segment.com Analytics write key')
    .when('NODE_ENV', nonRequiredForTest),
  SENTRY_DSN: Joi.string().when('NODE_ENV', nonRequiredForTest),
  UAPAY_CLIENTID_P2P: Joi.string()
    .description('UAPAY param for JWT clientId for P2P - to a request card token')
    .when('NODE_ENV', nonRequiredForTest),
  UAPAY_SECRET_P2P: Joi.string()
    .description('UAPAY JWT secret for P2P')
    .when('NODE_ENV', nonRequiredForTest),
  UAPAY_CLIENTID_ESCROW: Joi.string()
    .description('UAPAY API Client ID for EscrowBow')
    .when('NODE_ENV', nonRequiredForTest),
  UAPAY_KEY_ESCROW: Joi.string()
    .description('UAPAY API Key for Escrowbox')
    .when('NODE_ENV', nonRequiredForTest),
  UAPAY_BASE_URL: Joi.string()
    .description('UAPAY API URL')
    .when('NODE_ENV', nonRequiredForTest),
})
  .unknown()
  .required();

const { error, value: envVars } = Joi.validate(process.env, envVarsSchema);
if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

export default {
  ...envVars,
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

  chatkit: {
    instanceLocator: envVars.CHATKIT_INSTANCE,
    key: envVars.CHATKIT_KEY,
  },
  JOBNAMES: {
    DROP_SUBSCRIPTION: 'drop-subscription',
    SCHEDULE: 'listing-schedule',
    PUSH_COMMENT: 'send-push-comment',
    PUSH_DROP_LISTED: 'send-push-drop-listed',
    PUSH_FOLLOW: 'send-push-follow',
    PUSH_MSG: 'send-push-msg', // person to person
    PUSH_ORDER: 'send-push-order',
    SYSTEM_MSG: 'send-system-message',
    RECURRING: {
      CHECKOUT: 'checkout',
      CANCEL_PAID_ORDERS: 'cancel-paid-orders',
      PUSH_ORDER_CONFIRM_REMINDER: 'send-push-order-confirmation-reminder',
      SHIPPING_STATUS_STARTER: 'shipping-status-starter',
    },
    SHIPPING_STATUS_CHECKER: 'shipping-status-checker',
    IG_SCRAPPING: 'instagram-scrapper',
  },
  // hard coded settings
  settings: {
    // Product stays in the `carted` array for 15 mins
    // TODO: 0 to disable
    // When time is reached, the pending order is cancelled, Product is quantity is removed from `carted` array and quantity increases
    holdProductFor: 60 * 15, // mins

    // Wait the seller to confirm the order for 48 hours.
    // When time is reached, the paid order is cancelled, Product is quantity is removed from `carted` array and quantity increases
    cancelPaidOrdersAfter: 60 * 60 * 48, // hours

    remindToConfirmOrderEvery: '6 hours',

    checkShippingStatusEvery: '15 minutes',

    MAX_DAYS_TRACKING_NUMBER_VALID_FOR: 7, // calendar days (included)

    minPrice: 150,
  },
  DEFAULT_FOLLOW: true,
};
