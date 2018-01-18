/*!
/================================\
|        NOTICE TO HUNTERS       |
\================================/

This is a client-side version of the server-side code that was used during
the hunt. During the hunt, this code was not available to hunters (because
it was run on the server) and it was rate-limited to avoid brute-forcing.

To preserve the spirit of the puzzle, please do not solve the puzzle by
examining this code or avoiding the rate-limiting.


*/

/* eslint-env browser */
/* globals HUNT_APP_NAME */

// filled in by webpack
const APP_NAME = HUNT_APP_NAME;

const LOCAL_STORAGE_KEY = `huntjs:sessiondata:${APP_NAME}`;

const session = {
  get(opts) {
    const defaultValue = opts ? opts.defaultValue : undefined;

    if (!localStorage[LOCAL_STORAGE_KEY]) {
      session.set(defaultValue);
    }

    const jsonValue = localStorage[LOCAL_STORAGE_KEY];

    if (jsonValue === undefined) {
      return undefined;
    }

    return JSON.parse(localStorage[LOCAL_STORAGE_KEY]);
  },
  set(value) {
    localStorage[LOCAL_STORAGE_KEY] = JSON.stringify(value);
  },
};

const team = require('./teamDataBrowser')(APP_NAME);

function returnPromise(fn) {
  let result;
  try {
    result = fn();
  } catch (e) {
    result = Promise.reject(e);
  }

  if (result instanceof Promise) {
    return result;
  }
  return Promise.resolve(result);
}

const getRoutes = {};
const postRoutes = {};

const getRoutesRateLimiters = {};
const postRoutesRateLimiters = {};

function makeRateLimiter(limit, periodMillis) {
  let count = 0;
  let lastReset = Date.now();

  return function applyRateLimiter() {
    if (lastReset < (Date.now() - periodMillis)) {
      count = 0;
      lastReset = Date.now();
    }

    if (count >= limit) {
      throw new Error(`Rate limit exceeded. Limit is ${limit} per minute.`);
    }

    count += 1;
  };
}

function makeRateLimiterOrNoop(options) {
  if (options && options.rateLimitPerMinute) {
    return makeRateLimiter(options.rateLimitPerMinute, 60 * 1000);
  }

  return () => {};
}

module.exports = {
  get(route, handler, options) {
    getRoutes[route] = handler;
    getRoutesRateLimiters[route] = makeRateLimiterOrNoop(options);
  },

  post(route, handler, options) {
    postRoutes[route] = handler;
    postRoutesRateLimiters[route] = makeRateLimiterOrNoop(options);
  },

  serve() {
    if (!window.__huntjs__) {
      window.__huntjs__ = {};
    }

    window.__huntjs__[APP_NAME] = {
      get(route, data) {
        if (getRoutes[route]) {
          return returnPromise(() => {
            getRoutesRateLimiters[route]();
            return getRoutes[route]({ data, session, team });
          });
        }

        return Promise.reject(new Error('No such GET route'));
      },

      post(route, data) {
        if (postRoutes[route]) {
          return returnPromise(() => {
            postRoutesRateLimiters[route]();
            return postRoutes[route]({ data, session, team });
          });
        }

        return Promise.reject(new Error('No such GET route'));
      },
    };
  },

  Error(statusCode, userMessage) {
    const err = new Error(userMessage);
    err.statusCode = statusCode;
    err.userMessage = userMessage;

    return err;
  },
};
