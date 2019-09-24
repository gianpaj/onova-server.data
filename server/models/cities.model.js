// @flow

const mongoose = require('mongoose');

const CitiesSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      // index for loadDepartments.js script
      index: true,
      unique: true,
    },
    departmentsCount: Number,
    uk: String,
  },
  { collection: 'cities' }
);

module.exports = mongoose.model('cities', CitiesSchema);
