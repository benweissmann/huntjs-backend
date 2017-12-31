const rateLimiter = require('redis-rate-limiter');

const kvStore = require('./mysqlKVStore')({
  tableName: 'team_data',
  keyColumn: 'team',
  valueColumn: 'data',
});

const applyRateLimiter = require('./applyRateLimiter');
const redisClient = require('./redisClient');

function getTeamIdFromReq(req) {
  if (!req.huntTeamId) {
    throw new Error('No req.huntTeamId');
  }

  return req.huntTeamId;
}

module.exports.getTeamIdFromReq = getTeamIdFromReq;

module.exports.teamAPI = function teamAPI(req, mysqlPool, pubsub) {
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
    return kvStore.get(mysqlPool, getTeamId(), opts);
  }

  function set(newValue) {
    return kvStore.set(mysqlPool, getTeamId(), newValue);
  }

  function publish(channel, message) {
    pubsub.publish(`${getTeamId()}:${channel}`, message);
  }

  function id() {
    return getTeamId();
  }

  return { get, set, publish, id };
};

module.exports.makeRateLimiter = function makeRateLimiter(limit, windowSeconds) {
  const limiter = rateLimiter.create({
    redis: redisClient,
    key: getTeamIdFromReq,
    limit,
    window: windowSeconds,
  });

  return function applyLimit(req) {
    return applyRateLimiter(limiter, req, `${limit} per ${windowSeconds} seconds`);
  };
};

module.exports.initDB = function initDB(mysqlPool) {
  kvStore.initDB(mysqlPool);
};
