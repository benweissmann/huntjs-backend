const redis = require('redis');
const rateLimiter = require('redis-rate-limiter');

const redisClient = redis.createClient(process.env.HUNT_REDIS_URL, {
  enable_offline_queue: false,
});

function getTeamIdFromReq(req) {
  // TODO: look at session token in req, get team ID from auth DB
  return 'test-team';
}

function errorIsDuplicateKeyError(err) {
  return err.code === 'ER_DUP_ENTRY';
}

module.exports.teamAPI = function teamAPI(req, mysqlPool) {
  let teamId;

  // lazily fetch team ID when needed
  function getTeamId() {
    if (!teamId) {
      teamId = getTeamIdFromReq(req);
    }

    return teamId;
  }

  // load team data
  function get(opts) {
    const defaultValue = opts ? opts.defaultValue : undefined;

    return new Promise((resolve, reject) => {
      mysqlPool.query('SELECT data FROM team_data WHERE team = ?', [getTeamId()], (selectErr, results) => {
        if (selectErr) {
          reject(selectErr);
          return;
        }

        if (results.length > 0) {
          resolve(JSON.parse(results[0].data));
          return;
        }

        if (!defaultValue) {
          resolve();
          return;
        }

        // Try to save default values back to the DB
        mysqlPool.query('INSERT INTO team_data SET ?', [
          { team: getTeamId(), data: JSON.stringify(defaultValue) },
        ], (insertErr) => {
          if (insertErr) {
            if (errorIsDuplicateKeyError(insertErr)) {
              // someone else beat us to it! re-query for the applied default
              // values
              get(defaultValue).then(resolve, reject);
              return;
            }

            // it was some other error
            reject(insertErr);
            return;
          }

          // we inserted successfully
          resolve(defaultValue);
        });
      });
    });
  }

  function set(newValue) {
    return new Promise((resolve, reject) => {
      mysqlPool.query('UPDATE team_data SET ?', { data: JSON.stringify(newValue) }, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  return { get, set };
};

module.exports.makeRateLimiter = function makeRateLimiter(rateLimitPerMinute) {
  const limit = rateLimiter.create({
    redis: redisClient,
    key: getTeamIdFromReq,
    rate: `${rateLimitPerMinute}/minute`,
  });

  return function applyLimit(req) {
    return new Promise((resolve, reject) => {
      console.log("LIMITING")
      limit(req, (err, rate) => {
        console.log("LIMIT RES", rate)
        if (err) {
          reject(err);
          return;
        }

        if (rate.over) {
          const overLimitError = new Error('Rate limiter over limit');
          overLimitError.userMessage = `Rate limit exceeded. Limit is ${rateLimitPerMinute} per minute.`;
          overLimitError.statusCode = 429;
          reject(err);
          return;
        }

        console.log("LIMIT PASS")
        resolve();
      });
    });
  };
};

module.exports.initDB = function initDB(mysqlPool) {
  mysqlPool.query(`
    CREATE TABLE IF NOT EXISTS \`team_data\` (
      \`team\` varchar(128) COLLATE utf8mb4_bin NOT NULL,
      \`data\` text COLLATE utf8mb4_bin,
      PRIMARY KEY (\`team\`)
    ) ENGINE=InnoDB
  `, (err) => {
      if (err) {
        console.error(err, 'Error initializing database');
      }
    });
};
