exports.config = {
  /**
   * GetStream.io API key
   */
  apiKey: '***REMOVED***',

  /**
   * GetStream.io API Secret
   */
  apiSecret: '***REMOVED***',

  /**
   * GetStream.io API App ID
   */
  apiAppId: '35015',

  /**
   * GetStream.io API Location
   */
  apiLocation: 'dublin',

  /**
   * GetStream.io User Feed slug
   */
  userFeed: 'user',

  /**
   * GetStream.io Notification Feed slug
   */
  notificationFeed: 'notification',

  newsFeeds: {
    /**
     * GetStream.io Flat Feed slug
     */
    flat: 'timeline',

    /**
     * GetStream.io Aggregated Feed slug
     */
    aggregated: 'timeline_aggregated',
  },
};
