// @flow

import httpStatus from 'http-status';
// import stream from 'getstream-node';

import APIError from '../helpers/APIError';
import { UserDoc } from '../models/user.model';
import Product from '../models/product.model';
import Follow, { FollowDoc } from '../models/follow.model';
import Block, { BlockDoc } from '../models/block.model';

declare class session$Request extends express$Request {
  user: UserDoc;
}

/**
 * Get list of products based on the sellers you follow
 *
 * GET /api/feed/flat
 *
 * @property {*} req - Express request
 * @property {*} req.query - Express query parameters
 * @property {Array<number>=} req.query.categoryIds
 * @property {Array<string>=} req.query.tag - limited to single tag
 * @property {Array<number>=} req.query.typeIds
 * @property {MongoId} req.query.lastId (not uuid)
 * @property {number} req.query.limit Limit number of products to be returned.
 */
async function flat(
  req: session$Request,
  res: express$Response,
  next: express$NextFunction
) {
  const { limit = 50, lastId, categoryIds, tag, typeIds } = req.query;

  const usersIamBlocking = await Block.find({ sourceUser: req.user._id });

  const ids = usersIamBlocking.map(u => u.targetUser);

  Follow.find({ follower: req.user._id, following: { $nin: ids } })
    .limit(1000) // following
    .then((following: Array<FollowDoc>) => {
      if (!following) return res.json({ data: [] });

      following = following.map(f => f.following);

      let DBquery = { status: 'forsale', seller: { $in: following } };

      if (typeIds) DBquery = { ...DBquery, typeIds: { $in: typeIds } };
      if (categoryIds)
        DBquery = { ...DBquery, categoryIds: { $in: categoryIds } };
      if (tag) DBquery = { ...DBquery, tags: tag };

      // for pagination - results are excluding the lastId
      if (lastId) {
        DBquery = { ...DBquery, _id: { $gte: lastId } };

        return Product.findById(lastId).then(product => {
          if (!product) {
            throw new APIError('Product not found.', httpStatus.NOT_FOUND);
          }
          return Product.find(DBquery)
            .sort({ _id: -1 }) // faster than createdAt: -1 - same ordering
            .populate({
              path: 'seller',
              select: 'username',
            })
            .limit(+limit)
            .then(data => res.json({ data }));
        });
      } else {
        return Product.find(DBquery)
          .sort({ _id: -1 }) // faster than createdAt: -1 - same ordering
          .populate({
            path: 'seller',
            select: 'username',
          })
          .limit(+limit)
          .then(data => res.json({ data }));
      }
    })
    .catch(e => next(e));
}

/**
 * Get list of users a specific user is following
 *
 * GET /api/users/:userId/following
 *
 * @property {*} req - Express request
 * @property {*} req.params - Express params parameters
 * @property {string} req.params.userId
 * @property {*} req.query - Express query parameters
 * @property {number} req.query.skip Number of users to be skipped.
 * @property {number} req.query.limit Limit number of users to be returned.
 */
function listFollowing(
  req: session$Request,
  res: express$Response,
  next: express$NextFunction
) {
  const { limit = 50, skip = 0 } = req.query;

  const DBquery = { follower: req.params.userId };

  // use static method from FollowSchema
  // flow-disable-next-line
  Follow.list({ DBquery, limit, skip })
    .then(follows => res.json({ data: follows }))
    .catch(e => next(e));
}

// const StreamMongoose = stream.mongoose;
// const StreamBackend = new StreamMongoose.Backend();

// const enrichActivities = function(body) {
//   return StreamBackend.enrichActivities(body.results);
// };

// const enrichAggregatedActivities = function(body) {
//   return StreamBackend.enrichAggregatedActivities(body.results);
// };

// router.get('/flat', ensureAuthenticated, function(req, res, next) {
//   const flatFeed = FeedManager.getNewsFeeds(req.user.id)['timeline'];

//   flatFeed
//     .get({})
//     .then(enrichActivities)
//     .then(function(enrichedActivities) {
//       res.render('feed', {
//         location: 'feed',
//         user: req.user,
//         activities: enrichedActivities,
//         path: req.url,
//       });
//     })
//     .catch(next);
// });

// router.get('/aggregated_feed', ensureAuthenticated, function(req, res, next) {
//   const aggregatedFeed = FeedManager.getNewsFeeds(req.user.id)[
//     'timeline_aggregated'
//   ];

//   aggregatedFeed
//     .get({})
//     .then(enrichAggregatedActivities)
//     .then(function(enrichedActivities) {
//       res.render('aggregated_feed', {
//         location: 'aggregated_feed',
//         user: req.user,
//         activities: enrichedActivities,
//         path: req.url,
//       });
//     })
//     .catch(next);
// });

// router.get('/notification_feed/', ensureAuthenticated, function(
//   req,
//   res,
//   next
// ) {
//   const notificationFeed = FeedManager.getNotificationFeed(req.user.id);

//   notificationFeed
//     .get({ mark_read: true, mark_seen: true })
//     .then(body => {
//       const activities = body.results;
//       if (activities.length == 0) {
//         return res.send('');
//       }
//       req.user.unseen = 0;
//       return StreamBackend.enrichActivities(activities[0].activities);
//     })
//     .then(enrichedActivities => {
//       res.render('notification_follow', {
//         lastFollower: enrichedActivities[0],
//         count: enrichedActivities.length,
//         layout: false,
//       });
//     })
//     .catch(next);
// });

export default {
  flat,
  // listFollowing,
};
