import config from '../config/config';

const Analytics = require('analytics-node');
export default new Analytics(config.SEGMENT);
