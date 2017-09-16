const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const mysql = require('mysql');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);

const mysqlPool = mysql.createPool({
  host: process.env.HUNT_MYSQL_HOST,
  port: Number(process.env.HUNT_MYSQL_PORT),
  user: process.env.HUNT_MYSQL_USER,
  password: process.env.HUNT_MYSQL_PASSWORD,
  database: process.env.HUNT_MYSQL_DB,
});
const sessionStore = new MySQLStore({}, mysqlPool);


const teamData = require('./teamDataNode');

teamData.initDB(mysqlPool);

const app = express();
app.use(bodyParser.json({ extended: false }));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(session({
  key: 'huntjs_session',
  secret: process.env.HUNT_SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: sessionStore,
}));
app.use(cors());

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

function callHandler(handler, data, req, res) {
  returnPromise(() => handler({
    data,
    session: sessionAPI(req),
    team: teamData.teamAPI(req, mysqlPool),
  })).then(resp => res.json(resp))
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error(err);

      const statusCode = err.statusCode || 500;
      const message = err.userMessage || 'Server Error';

      res.status(statusCode).json({ error: message });
    });
}

module.exports = {
  get(route, handler) {
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

      callHandler(handler, data, req, res);
    });
  },

  post(route, handler) {
    app.post(route, (req, res) => {
      callHandler(handler, req.body, req, res);
    });
  },

  serve() {
    const port = Number(process.env.HUNT_PORT);
    app.listen(port, () => {
      // eslint-disable-next-line no-console
      console.log(`App listening on port ${port}`);
    });
  },

  Error(statusCode, userMessage) {
    const err = new Error(userMessage);
    err.statusCode = statusCode;
    err.userMessage = userMessage;

    return err;
  },
};
