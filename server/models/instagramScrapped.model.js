// @flow

import mongoose from 'mongoose';

const { Schema } = mongoose;

// Default users which will be followed when an user is created
/** @namespace */
const instagramScrappedSchema = new Schema({
  instagramId: {
    type: String,
    required: true,
    unique: true,
    // immutable: true, // TODO: upgrade to mongoose 5.6+
  },
  instagramOwnerId: {
    type: String,
    required: true,
    // immutable: true, // TODO: upgrade to mongoose 5.6+
  },
  label: {
    type: String,
    enum: ['sale', 'notforsale'],
  },
  shortcode: String,
  username: String,
  timestamp: Number,
});

export class instagramScrappedDoc /*:: extends Mongoose$Document */ {
  instagramId: String;
  instagramOwnerId: String;
  product: MongoId;
  shortcode: String;
  username: String;
  timestamp: Date;
}

instagramScrappedSchema.loadClass(instagramScrappedDoc);

// Never return these fields in the JSON representation
// This doesn't effect `toObject` method
instagramScrappedSchema.set('toJSON', {
  getters: true,
  transform: (doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

instagramScrappedSchema.index({ instagramOwnerId: 1 });

export default mongoose.model('InstagramScrapped', instagramScrappedSchema, 'instagramscrapped');
