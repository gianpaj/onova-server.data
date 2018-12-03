// @flow

import mongoose from 'mongoose';

const { Schema } = mongoose;

const SuggestionSchema = new Schema({
  createdAt: {
    type: Date,
    default: Date.now,
    required: true,
  },
  suggestions: {
    type: [
      {
        suggestion: Schema.Types.ObjectId,
        numOfConnections: number,
      },
    ],
    required: true,
  },
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
});

export class SuggestionDoc /*:: extends Mongoose$Document */ {
  _id: MongoId;
  createdAt: Date;
  suggestions: Array<any>;
  user: MongoId;
}

SuggestionSchema.loadClass(SuggestionDoc);

// Never return '__v' field in the JSON representation
// Note that this doesn't effect `toObject`
SuggestionSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.price = ret.price.toString();
    delete ret.__v;
    return ret;
  },
});

SuggestionSchema.index({ user: 1 });
export default mongoose.model('Suggestion', SuggestionSchema);
