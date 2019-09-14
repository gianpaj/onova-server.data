import config from '../config/config';

const Analytics = require('analytics-node');
let a;
if (config.env === 'production') {
  a = new Analytics(config.SEGMENT);
}

export default a;
