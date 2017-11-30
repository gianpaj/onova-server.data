// @flow

import mongoose from 'mongoose';

var TagSchema = new mongoose.Schema(
  {
    _id: String,
  },
  {
    // assigns 'createdAt' and 'updatedAt' fields to the schema
    timestamps: true,
  }
);

// export class TagDoc /*:: extends Mongoose$Document */ {
//   _id: string;
// }

// TagSchema.loadClass(TagDoc);

// Never return '__v' field in the JSON representation
// Note that this doesn't effect `toObject`
TagSchema.set('toJSON', {
  getters: true,
  transform: (doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

/**
 * @typedef Tag
 */
export default mongoose.model('Tag', TagSchema);
