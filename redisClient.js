const redis = require('redis');

module.exports = redis.createClient(process.env.HUNT_REDIS_URL, {
  enable_offline_queue: false,
});
