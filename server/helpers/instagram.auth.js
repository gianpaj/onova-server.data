var fwk = require('fwk');
// var http = require('http');
var https = require('https');
var query = require('querystring');
var url = require('url');
var crypto = require('crypto');

/**
 * Instagram API driver for NodeJS
 * Proceeds the call to the API and give
 * back the response
 *
 * @param spec { agent, host, port }
 */
var instagram = function(spec, my) {
  var _super = {};
  my = my || {};
  spec = spec || {};

  my.limit = null;
  my.remaining = null;
  my.agent = spec.agent;
  my.host = spec.host || 'https://api.instagram.com';
  my.port = spec.port || 443;
  my.enforce_signed_requests = spec.enforce_signed_requests || false;

  // public
  var use; /* use(spec);                                       */

  var user; /* user(user_id, cb);                               */
  var user_self_feed; /* user_self_feed(options, cb);                     */
  var user_media_recent; /* user_media_recent(user_id, options, cb);         */
  var user_self_media_recent; /* user_self_media_recent(options, cb);             */
  var user_self_liked; /* user_self_liked(options, cb);                    */
  var user_search; /* user_search(query, options, cb);                 */

  var user_follows; /* user_follows(user_id, cb);                       */
  var user_followers; /* user_followers(user_id, cb);                     */
  var user_self_requested_by; /* user_self_requested_by(cb);                      */
  var user_relationship; /* user_relationship(user_id, cb);                  */
  var set_user_relationship; /* set_user_relationship(user_id, action, cb);      */

  var media; /* media(media_id, cb);                             */
  var media_shortcode; /* media_shortcode(media_shortcode, cb);            */
  var media_search; /* media_search(lat, lng, options, cb);             */
  var media_popular; /* media_popular(cb);                               */

  var comments; /* comments(media_id, cb);                          */
  var add_comment; /* add_comment(media_id, text, cb);                 */
  var del_comment; /* del_comment(media_id, comment_id, cb);           */

  var likes; /* likes(media_id, cb);                             */
  var add_like; /* add_like(media_id, cb);                          */
  var del_like; /* del_like(media_id, cb);                          */

  var tag; /* tag(tag, cb);                                    */
  var tag_media_recent; /* tag_media_recent(tag, options, cb);              */
  var tag_search; /* tag_search(query, cb);                           */

  var location; /* location(location_id, cb);                       */
  var location_media_recent; /* location_media_recent(location_id, options, cb); */
  var location_search; /* location_search(spec, options, cb);              */

  var geography_media_recent; /* geography_media_recent(id, options, cb);         */

  var subscriptions; /* subscriptions(cb);                               */
  var del_subscription; /* del_subscription(options, cb);                   */
  var add_tag_subscription; /* add_tag_subscription(tag, cb_url, cb);           */
  var add_geography_subscription; /* add_geography_subscription(lat, lng, radius, cb_url, cb); */
  var add_user_subscription; /* add_user_subscription(cb_url, cb);               */
  var add_location_subscription; /* add_location_subscription(id, cb_url, cb);       */

  var get_authorization_url; /* get_authorization_url(redirect_uri, permissions);*/
  var authorize_user; /* authorize_user(code, redirect_uri, cb);          */

  var oembed; /* oembed(url, cb);                             */

  // private
  var call; /* call(method, path, params, cb, retry);           */
  var handle_error; /* handle_error(body, cb, retry);                   */
  var sign_request; /* sign_request(endpoint, params, client_secret);   */
  var sort_object; /* sort_object(params);                             */

  var that = {};

  /*******************************/
  /*       Private helpers       */
  /*******************************/

  /**
   * Make a call on instagram API with the given params, path & method
   * @param method string the request method
   * @param path string the path
   * @param params object the params
   * @param cb function (err, result, remaining, limit);
   * @param retry function a retry function
   */
  call = function(method, path, params, cb, retry) {
    if (my.auth) {
      // we don't need auth parameters if we're hitting the oembed endpoint
      if (path.search('oembed') < 0) {
        for (var opt in my.auth) {
          if (my.auth.hasOwnProperty(opt)) {
            params[opt] = my.auth[opt];
          }
        }
      }

      // Signature parameter
      if (params.sign_request || my.enforce_signed_requests) {
        try {
          var client_secret;

          if (params.sign_request) {
            client_secret = params.sign_request.client_secret;
            delete params.sign_request;
          } else {
            client_secret = my.auth.client_secret;
          }

          params['sig'] = sign_request(path, params, client_secret);
        } catch (err) {
          return handle_error(err, cb, retry);
        }
      }

      var options = {
        host: url.parse(my.host).hostname,
        port: my.port,
        method: method,
        path: '/v1' + path + (method === 'GET' || method === 'DELETE' ? '?' + query.stringify(params) : ''),
        agent: my.agent,
        headers: {},
      };

      // oauth and oembed calls don't use /v1
      if (path.search('oauth') >= 0 || path.search('oembed') >= 0) {
        options.path = options.path.substring(3); // chop off '/v1'
      }

      var data = null;

      if (method !== 'GET' && method !== 'DELETE') {
        data = query.stringify(params);
        options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
        options.headers['Content-Length'] = data.length;
      }

      var req = https.request(options, function(res) {
        var body = '';
        res.setEncoding('utf8');

        res.on('data', function(chunk) {
          body += chunk;
        });

        res.on('end', function() {
          var result;
          var limit = parseInt(res.headers['x-ratelimit-limit'], 10) || 0;
          var remaining = parseInt(res.headers['x-ratelimit-remaining'], 10) || 0;
          my.limit = limit;
          my.remaining = remaining;

          try {
            result = JSON.parse(body);
          } catch (err) {
            return handle_error(err, cb, retry, res.statusCode, body);
          }

          return cb(null, result, remaining, limit);
        });
      });

      req.on('error', function(err) {
        return handle_error(err, cb, retry);
      });

      if (data !== null) {
        req.write(data);
      }

      req.end();
    } else {
      return handle_error(new Error('Must be authentified'), cb, retry);
    }
  };

  /**
   * Handle API errors
   * @param body object the response from instagram API
   * @param cb function (err);
   * @param retry function can be called to retry
   * @param status number the status code [opt]
   * @param bdy  string  the body received from instagram [opt]
   * Error objects can have
   *   - status_code status code [opt]
   *   - body body received      [opt]
   *   - error_type error type from instagram
   *   - error_message error message from instagram
   *   - code if error comes from instagram
   *   - retry a function that can be called to retry
   *           with same params
   */
  handle_error = function(body, cb, retry, status, bdy) {
    if (body && ((body.meta && body.meta.error_type) || body.error_type)) {
      // if body is an instagram error
      if (!body.meta) {
        body.meta = {
          code: body.code,
          error_type: body.error_type,
          error_message: body.error_message,
        };
      }
      var error = new Error(body.meta.error_type + ': ' + body.meta.error_message);
      error.code = body.meta.code;
      error.error_type = body.meta.error_type;
      error.error_message = body.meta.error_message;
      error.retry = retry;
      return cb(error);
    } else if (body && body.message && body.stack) {
      // if body is an error
      body.retry = retry;
      if (status) body.status_code = status;
      if (bdy) body.body = bdy;
      return cb(body);
    } else {
      var error = new Error('Unknown error');
      error.retry = retry;
      return cb(error);
    }
  };

  /**
   * Sign the request using new instagram sign rules.
   * We are merging endpoint, params and client_secret and hashing all together
   * @param endpoint string api endpoint to call
   * @param params object api call params to be hashed
   * @param client_secret string the client secret to sign the request
   * @throws Error if arguments are not correct
   */
  sign_request = function(endpoint, params, client_secret) {
    if (typeof client_secret !== 'string') {
      throw new Error('Wrong param "client_secret"');
    }

    var sig = endpoint;

    params = sort_object(params);
    for (var key in params) {
      if (params.hasOwnProperty(key)) {
        sig += '|' + key + '=' + params[key];
      }
    }

    var hmac = crypto.createHmac('sha256', client_secret);
    hmac.update(sig);
    return hmac.digest('hex');
  };

  /**
   * Sort onject function.
   * We need to sort params that being added to api call.
   * @param object
   * @returns {Object}
   */
  sort_object = function(object) {
    var keys = Object.keys(object),
      i,
      len = keys.length;

    keys.sort();
    var newobj = new Object();
    for (i = 0; i < len; i++) {
      k = keys[i];
      newobj[k] = object[keys[i]];
    }
    return newobj;
  };

  /*****************************/
  /*      Public functions     */
  /*****************************/

  /**
   * Use the specified options to sign requests: can be an access_key
   * or a app_id/client_secret keys pair
   * @param options object { access_key } ||
   *                       { app_id, client_secret }
   * @throws Error if options is wrong
   */
  use = function(options) {
    if (typeof options === 'object') {
      if (typeof options.enforce_signed_requests != 'undefined') {
        my.enforce_signed_requests = options.enforce_signed_requests;
      }
      if (options.access_token) {
        my.limit = null;
        my.remaining = null;
        my.auth = {
          access_token: options.access_token,
        };
        if (options.client_secret) {
          my.auth.client_secret = options.client_secret;
        }
      } else if (options.app_id && options.client_secret) {
        my.limit = null;
        my.remaining = null;
        my.auth = {
          app_id: options.app_id,
          client_secret: options.client_secret,
        };
      } else {
        throw new Error('Wrong param "options"');
      }
    } else {
      throw new Error('Wrong param "options"');
    }
  };
  /**
   * Retrieve authentication URL for user.
   * @param redirect_uri string the url to redirect to
   * @param options object { scope, [opt] array ['likes', 'comments', 'relationships']
   *                         state  [opt] string}
   * @return url string the formated url
   * @throw err if app_id/client_secret are not set.
   */
  get_authorization_url = function(redirect_uri, options) {
    var options = options || {};
    var url_obj = url.parse(my.host);
    url_obj.pathname = '/oauth/authorize';

    if (!my.auth.app_id || !my.auth.client_secret) {
      throw new Error('Please supply app_id and client_secret via use()');
    }

    var params = {
      app_id: my.auth.app_id,
      redirect_uri: redirect_uri,
      response_type: 'code',
    };

    if (options.state) {
      params.state = options.state;
    }

    url_obj.query = params;

    var auth_url = url.format(url_obj);

    if (Array.isArray(options.scope)) {
      auth_url += '&scope=' + options.scope.join(',');
    }

    return auth_url;
  };

  fwk.method(that, 'use', use, _super);

  fwk.method(that, 'get_authorization_url', get_authorization_url, _super);

  return that;
};

exports.instagram = instagram;
