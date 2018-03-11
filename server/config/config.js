import Joi from 'joi';

const isTestEnv = process.env.NODE_ENV === 'test';

// require and configure dotenv, will load vars in .env in PROCESS.ENV
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
  MJ_APIKEY_PUBLIC: Joi.string()
    .required()
    .description('Mailjet API public key'),
  MJ_APIKEY_PRIVATE: Joi.string()
    .required()
    .description('Mailjet API private key'),
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
  },
  mailjet: {
    apikeyPublic: envVars.MJ_APIKEY_PUBLIC,
    apikeyPrivate: envVars.MJ_APIKEY_PRIVATE,
  },
  JOBNAMES: {
    PUSHCOMMENTS: 'send-push-comments',
  },
};

export default config;
