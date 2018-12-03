// @flow

import httpStatus from 'http-status';
const debug = require('debug')('server-data:suggestedUsers');

import APIError from '../helpers/APIError';
import { Follow, User, UserDoc, SuggestedUsers } from '../models';

const LIMIT_SUGGESTIONS = 100;

declare class session$Request extends express$Request {
  user: UserDoc;
}

/**
 * List my suggested users
 *
 * GET /api/suggested-users
 *
 * @property {*} req - express session
 * @property {*} req.params - express session parameters
 */
async function list(req: session$Request, res: express$Response) {
  // const { limit = 50, lastId } = req.query;
  // TODO: pagination

  // find the user's suggested users

  // an array
  const { suggestions } = await SuggestedUsers.find({ user: req.user._id });
  // if suggested users are "fresh" (already stored in DB; generated in the last 24 hours)
  if (suggestions) return res.json({ data: suggestions, new: false });

  // else compute them and save them in the collection
  // TODO: filter also those who have been discarded
  const freshSuggestions = await getSuggestions(req.user._id);

  await SuggestedUsers.create({
    user: req.user._id,
    suggestions: freshSuggestions,
  });

  req.json({ data: suggestions, new: true });
}

/**
 * Suggested users based on network of follow
 * i.e. Return a list of userId as suggestions of who a user shold be following based on who is following who.
 *
 * The list is sorted by the number of common connections
 *
 * @param {MongoId} userId
 */
async function getSuggestions(userId): Promise<any> {
  const res = await User.aggregate([
    { $match: { _id: userId } },
    { $project: { _id: '$_id' } },
    {
      $graphLookup: {
        from: 'follows',
        startWith: '$_id',
        connectFromField: 'following',
        connectToField: 'follower',
        maxDepth: 1,
        as: 'connections',
      },
    },
    {
      $unwind: {
        path: '$connections',
        includeArrayIndex: 'index',
        preserveNullAndEmptyArrays: false,
      },
    },
    {
      $group: {
        _id: '$connections.follower',
        followers: {
          $addToSet: '$connections.following',
        },
      },
    },
    { $unwind: { path: '$followers' } },
    {
      $group: {
        _id: '$followers',
        isFollowedBy: { $addToSet: '$_id' },
      },
    },
    {
      $match: { isFollowedBy: { $not: { $in: [userId] } } },
    },
    {
      $group: {
        _id: null,
        newFriends: { $addToSet: '$_id' },
      },
    },
  ]);

  const newFriends = res[0].newFriends.slice(0, LIMIT_SUGGESTIONS);

  const final = [];

  const myEntourage = (await Follow.find(
    { follower: userId },
    { following: 1, _id: 0 }
  )).map(f => f.following.toString());

  for (let index = 0; index < newFriends.length; index++) {
    const suggestion = newFriends[index];

    const suggestedFollowerEntourage = (await Follow.find(
      { follower: suggestion },
      { following: 1, _id: 0 }
    )).map(f => f.following.toString());

    const intersection = myEntourage.filter(
      value => -1 !== suggestedFollowerEntourage.indexOf(value)
    );
    final.push({ suggestion, numOfConnections: intersection.length });
  }

  final.sort((a, b) => b.numOfConnections - a.numOfConnections);

  return final;
}

export default {
  list,
  // discard,
};
