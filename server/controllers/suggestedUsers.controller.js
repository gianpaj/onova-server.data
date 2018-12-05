// @flow

const debug = require('debug')('server-data:suggestedUsers');

import {
  DiscardedUser,
  Follow,
  User,
  UserDoc,
  SuggestedUsers,
} from '../models';

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
async function list(
  req: session$Request,
  res: express$Response,
  next: NextFunction
) {
  // TODO: pagination
  // const { limit = 50, lastId } = req.query;

  try {
    const found = await SuggestedUsers.findOne({ user: req.user._id }).populate(
      {
        path: 'suggestions._id',
        select: 'username profilePic',
      }
    );
    // if suggested users are "fresh" (already stored in DB; generated in the last 24 hours)
    if (found) {
      // find if I am now following those suggested users
      const ids = found.suggestions.map(s => s._id._id);
      let myFollowings = await Follow.find({
        follower: req.user._id.toString(),
        following: { $in: ids },
      });
      myFollowings = myFollowings.map(f => f.following.toString());

      const suggestions = found.suggestions.map(s => {
        s = s.toJSON();
        s = {
          ...s,
          _id: {
            ...s._id,
            amIAFollower: false,
          },
        };
        if (myFollowings.indexOf(s._id._id.toString()) > -1) {
          s._id.amIAFollower = true;
        }
        return s;
      });

      return res.json({ data: suggestions, new: false });
    }

    // else compute them and save them in the collection
    // TODO: filter also those who have been discarded
    const freshSuggestions = await getSuggestions(req.user._id);

    if (!freshSuggestions.length) {
      await SuggestedUsers.create({
        user: req.user._id,
        suggestions: [],
      });
      return res.json({ data: [], new: true });
    }

    const discarded = (await DiscardedUser.find({ source: req.user._id })).map(
      d => d.target.toString()
    );

    const filteredSuggestions = freshSuggestions.filter(
      fresh => -1 === discarded.indexOf(fresh._id.toString())
    );

    const discard = freshSuggestions.map(sugg =>
      DiscardedUser.create({ source: req.user._id, target: sugg._id })
    );
    await Promise.all(discard)
      .then(d => debug('discarded', d.length))
      .catch(() => debug('its ok'));

    await SuggestedUsers.create({
      user: req.user._id,
      suggestions: filteredSuggestions,
    });

    const populated = await SuggestedUsers.findOne({
      user: req.user._id,
    }).populate({
      path: 'suggestions._id',
      select: 'username profilePic',
    });

    res.json({ data: populated.suggestions, new: true });
  } catch (error) {
    console.error(error);
    next(error);
  }
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
  if (!res.length) return [];

  const newFriends = res[0].newFriends.slice(0, LIMIT_SUGGESTIONS);

  const final = [];

  const myEntourage = (await Follow.find(
    { follower: userId },
    { following: 1, _id: 0 }
  )).map(f => f.following.toString());

  for (const suggestion of newFriends) {
    const suggestedFollowerEntourage = (await Follow.find(
      { follower: suggestion },
      { following: 1, _id: 0 }
    )).map(f => f.following.toString());

    const intersection = myEntourage.filter(
      value => -1 !== suggestedFollowerEntourage.indexOf(value)
    );
    final.push({ _id: suggestion, numOfConns: intersection.length });
  }

  final.sort((a, b) => b.numOfConns - a.numOfConns);

  return final;
}

export default {
  list,
  // discard,
};
