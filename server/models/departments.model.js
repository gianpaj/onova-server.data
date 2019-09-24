// @flow

const mongoose = require('mongoose');

const DepartmentsSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    index: true,
  },
  uk: {
    type: String,
    required: true,
  },
  maxWeight: Number,
  cityID: {
    type: String,
    required: true,
  },
});

module.exports = mongoose.model('departments', DepartmentsSchema);
