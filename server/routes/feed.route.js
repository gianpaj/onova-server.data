// @flow

import stream from 'getstream-node';

const StreamMongoose = stream.mongoose;
const StreamBackend = new StreamMongoose.Backend();

const enrichActivities = function(body) {
  return StreamBackend.enrichActivities(body.results);
};

const enrichAggregatedActivities = function(body) {
  return StreamBackend.enrichAggregatedActivities(body.results);
};

router.get('/flat', ensureAuthenticated, function(req, res, next) {
  const flatFeed = FeedManager.getNewsFeeds(req.user.id)['timeline'];

  flatFeed
    .get({})
    .then(enrichActivities)
    .then(function(enrichedActivities) {
      res.render('feed', {
        location: 'feed',
        user: req.user,
        activities: enrichedActivities,
        path: req.url,
      });
    })
    .catch(next);
});

router.get('/aggregated_feed', ensureAuthenticated, function(req, res, next) {
  const aggregatedFeed = FeedManager.getNewsFeeds(req.user.id)[
    'timeline_aggregated'
  ];

  aggregatedFeed
    .get({})
    .then(enrichAggregatedActivities)
    .then(function(enrichedActivities) {
      res.render('aggregated_feed', {
        location: 'aggregated_feed',
        user: req.user,
        activities: enrichedActivities,
        path: req.url,
      });
    })
    .catch(next);
});

router.get('/notification_feed/', ensureAuthenticated, function(
  req,
  res,
  next
) {
  const notificationFeed = FeedManager.getNotificationFeed(req.user.id);

  notificationFeed
    .get({ mark_read: true, mark_seen: true })
    .then(body => {
      const activities = body.results;
      if (activities.length == 0) {
        return res.send('');
      }
      req.user.unseen = 0;
      return StreamBackend.enrichActivities(activities[0].activities);
    })
    .then(enrichedActivities => {
      res.render('notification_follow', {
        lastFollower: enrichedActivities[0],
        count: enrichedActivities.length,
        layout: false,
      });
    })
    .catch(next);
});
