/*!
/================================\
|        NOTICE TO HUNTERS       |
\================================/

This is a client-side version of the server-side code that was used during
the hunt. During the hunt, this code was not available to hunts (because
it was run on the server) and it was rate-limited to avoid brute-forcing.

To preserve the spirit of the puzzle, please do not solve the puzzle by
examining this code or avoiding the rate-limiting.


*/

/* eslint-env browser */
/* globals HUNT_APP_NAME */

// filled in by webpack
const APP_NAME = HUNT_APP_NAME;

// initialize localStorage
const LOCAL_STORAGE_KEY = `huntjs:sessiondata:${APP_NAME}`;
if (!localStorage[LOCAL_STORAGE_KEY]) {
  localStorage[LOCAL_STORAGE_KEY] = {};
}

const session = {
  get(opts) {
    const defaultValue = opts ? opts.defaultValue : undefined;

    if (!localStorage[LOCAL_STORAGE_KEY]) {
      localStorage[LOCAL_STORAGE_KEY] = defaultValue;
    }

    const jsonValue = localStorage[LOCAL_STORAGE_KEY];

    if (jsonValue === undefined) {
      return undefined;
    }

    return JSON.parse(localStorage[LOCAL_STORAGE_KEY]);
  },
  set(value) {
    localStorage[LOCAL_STORAGE_KEY] = value;
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

module.exports = {
  get(route, handler) {
    getRoutes[route] = handler;
  },

  post(route, handler) {
    postRoutes[route] = handler;
  },

  serve() {
    if (!window.__huntjs__) {
      window.__huntjs__ = {};
    }

    window.__huntjs__[APP_NAME] = {
      get(route, data) {
        if (getRoutes[route]) {
          return returnPromise(() => getRoutes[route]({ data, session, team }));
        }

        return Promise.reject(new Error('No such GET route'));
      },

      post(route, data) {
        if (postRoutes[route]) {
          return returnPromise(() => postRoutes[route]({ data, session, team }));
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
