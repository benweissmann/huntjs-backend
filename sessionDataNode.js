const rateLimiter = require('redis-rate-limiter');

const kvStore = require('./mysqlKVStore')({
  tableName: 'session_data',
  keyColumn: 'session_id',
  valueColumn: 'data',
});

const applyRateLimiter = require('./applyRateLimiter');
const redisClient = require('./redisClient');

function getSessionIdFromReq(req) {
  return req.session.id;
}

module.exports.sessionAPI = function sessionAPI(req, mysqlPool) {
  // load team data
  function get(opts) {
    return kvStore.get(mysqlPool, getSessionIdFromReq(req), opts);
  }

  function set(newValue) {
    return kvStore.set(mysqlPool, getSessionIdFromReq(req), newValue);
  }

  return { get, set };
};

module.exports.makeRateLimiter = function makeRateLimiter(limit, windowSeconds) {
  const limiter = rateLimiter.create({
    redis: redisClient,
    key: getSessionIdFromReq,
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
