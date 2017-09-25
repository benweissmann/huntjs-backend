const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const mysql = require('mysql');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);

// Construct the MySQL client
const mysqlPool = mysql.createPool({
  host: process.env.HUNT_MYSQL_HOST,
  port: Number(process.env.HUNT_MYSQL_PORT),
  user: process.env.HUNT_MYSQL_USER,
  password: process.env.HUNT_MYSQL_PASSWORD,
  database: process.env.HUNT_MYSQL_DB,
});

// Construct the session data store
const sessionStore = new MySQLStore({}, mysqlPool);

// Set up team data store
const teamData = require('./teamDataNode');

teamData.initDB(mysqlPool);

// Set up the app
const app = express();

// Parse JSON and URL-encoded bodies
app.use(bodyParser.json({ extended: false }));
app.use(bodyParser.urlencoded({ extended: false }));

// Add session data middleware
app.use(session({
  key: 'huntjs_session',
  secret: process.env.HUNT_SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: sessionStore,
}));

// Add CORS middleware
const corsAllowAll = (process.env.HUNT_CORS_ORIGIN === '*');
const corsAllowedOrigins = process.env.HUNT_CORS_ORIGIN.split(',');
app.use(cors({
  credentials: true,
  origin(origin, callback) {
    if (corsAllowAll) {
      callback(null, true);
    } else {
      callback(null, corsAllowedOrigins.includes(origin));
    }
  },
}));

// API for endpoints to interact with session data
function sessionAPI(req) {
  return {
    get(opts) {
      const defaultValue = opts ? opts.defaultValue : undefined;

      if ((defaultValue !== undefined) && !req.session.data) {
        req.session.data = defaultValue;
      }

      return req.session.data;
    },
    set(value) {
      req.session.data = value;
    },
  };
}

// Wraps a maybe-asynchronous function to always return a promise
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

// Calls a GET/POST handler defined by the app
async function callHandler(handler, data, req, res, rateLimit) {
  let response;

  try {
    if (rateLimit) {
      await rateLimit(req);
    }

    response = await returnPromise(() => handler({
      data,
      session: sessionAPI(req),
      team: teamData.teamAPI(req, mysqlPool),
    }));
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);

    const statusCode = err.statusCode || 500;
    const message = err.userMessage || 'Server Error';

    res.status(statusCode).json({ error: message });
    return;
  }

  res.json(response);
}

// Define a healthz endpoint for GCP and Kubernetes health-checking
app.get('/healthz', (req, res) => res.status(200).json({ healthy: true }));

// Redirect HTTP -> HTTPS
if (process.env.HUNT_REDIRECT_HTTP) {
  app.use((req, res, next) => {
    if (req.secure || (req.originalUrl === '/healthz')) {
      next();
    } else {
      res.redirect(`https://${req.hostname}${req.originalUrl}`);
    }
  });
}

// Define API for adding endpoints
module.exports = {
  get(route, handler, options) {
    const rateLimit = (options && options.rateLimitPerMinute)
      ? teamData.makeRateLimiter(options.rateLimitPerMinute)
      : null;

    app.get(route, (req, res) => {
      let data;
      if (req.query.data) {
        try {
          data = JSON.parse(req.query.data);
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error(e, 'Error parsing JSON');
          res.status(422).json({ error: 'Invalid JSON' });
          return;
        }
      }

      callHandler(handler, data, req, res, rateLimit);
    });
  },

  post(route, handler, options) {
    const rateLimit = (options && options.rateLimitPerMinute)
      ? teamData.makeRateLimiter(options.rateLimitPerMinute)
      : null;

    app.post(route, (req, res) => {
      callHandler(handler, req.body, req, res, rateLimit);
    });
  },

  serve() {
    const port = Number(process.env.HUNT_PORT);
    app.listen(port, () => {
      // eslint-disable-next-line no-console
      console.log(`App listening on port ${port}`);
    });
  },

  // Helper that constructs an error with statusCode and userMessage properties
  Error(statusCode, userMessage) {
    const err = new Error(userMessage);
    err.statusCode = statusCode;
    err.userMessage = userMessage;

    return err;
  },
};
