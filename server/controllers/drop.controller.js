// @flow

import httpStatus from 'http-status';

import { agenda } from '../config/express';
import config from '../config/config';

import APIError from '../helpers/APIError';
import { Follow, FollowDoc, UserDoc } from '../models';

declare class session$Request extends express$Request {
  user: UserDoc;
}

/**
 * Get list of scheduled drops of the people who i am following
 *
 * GET /api/feed/drops
 *
 * @property {*} req - Express request
 * @property {*} req.query - Express query parameters
//  * @property {MongoId} req.query.lastId
//  * @property {number} req.query.limit Limit number of drops to be returned.
 */
async function myFeed(
  req: session$Request,
  res: express$Response,
  next: express$NextFunction
) {
  // const { limit = 50 } = req.query;

  try {
    const following: Array<FollowDoc> = await Follow.find({
      follower: req.user._id,
      status: { $ne: -1 }, // those who i am blocking
    }).limit(1000);
    if (!following.length) return res.json({ data: [] });

    // console.log(following);
    let followingIDs = following.map(f => f.following);

    // filter the us
    let blockedByIDs = [];
    const blockedBy = await Follow.find({
      following: req.user._id,
      status: -1,
    });
    if (blockedBy) {
      blockedByIDs = blockedBy.map(f => f.following);
      followingIDs = followingIDs.filter(id => -1 === blockedByIDs.indexOf(id));
    }

    // for pagination - results are excluding the lastId
    // if (lastId) {
    //   DBquery = { ...DBquery, _id: { $lt: lastId } };

    //   const lastIdProd = await Product.findById(lastId);
    //   if (!lastIdProd) {
    //     throw new APIError('Product not found.', httpStatus.NOT_FOUND);
    //   }
    // }

    const now = new Date();

    agenda.jobs(
      {
        name: config.JOBNAMES.SCHEDULE,
        'data.product.seller': { $in: followingIDs },
        $or: [
          // scheduled
          {
            nextRunAt: { $gte: now },
          },
          // queued
          {
            nextRunAt: { $lte: now },
            $expr: {
              $gte: ['$nextRunAt', '$lastFinishedAt'],
            },
          },
        ],
      },
      (err, jobs: Array<any>) => {
        if (err) {
          const e = new APIError(
            'Error getting scheduled listing',
            httpStatus.SERVICE_UNAVAILABLE
          );
          return next(e);
        }

        if (!jobs.length) return res.json({ data: [] });

        const scheduled = jobs.map(job => ({
          lastFinishedAt: job.attrs.lastFinishedAt
            ? job.attrs.lastFinishedAt
            : null,
          nextRunAt: job.attrs.nextRunAt,
          ...job.attrs.data.product,
        }));

        // group jobs by dropId
        // inspired by https://stackoverflow.com/a/47385953/728287
        const result = scheduled.reduce(
          (accumulator, currentValue) => ({
            ...accumulator,
            [currentValue.dropId]: (
              accumulator[currentValue.dropId] || []
            ).concat(currentValue),
          }),
          {}
        );

        return res.json({ data: result });
      }
    );
  } catch (error) {
    next(error);
  }
}

export default {
  myFeed,
  // myFriendsFeed
  // subscribe,
  // unsubscribe,
};
