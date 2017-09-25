
const redis = require('redis');

module.exports = function pubsub(dbName) {
  // We make new redis connection instead of using the main one because
  // we want to enable offline queueing, and we want separate pub/sub connections
  const pubConn = redis.createClient(process.env.HUNT_REDIS_URL);
  const subConn = redis.createClient(process.env.HUNT_REDIS_URL);

  const subscribers = {};
  const prefix = `${dbName}:`;

  function encodeChannelName(channel) {
    return prefix + channel;
  }

  function decodeChannelName(channel) {
    if (channel.startsWith(prefix)) {
      return channel.substr(prefix.length);
    }

    return undefined;
  }

  // set up message handler
  subConn.on('message', (rawChannel, message) => {
    const channel = decodeChannelName(rawChannel);
    if (channel == null) {
      console.warn(`Received message on invalid channel ${rawChannel}: ${message}`);
      return;
    }

    const channelSubscribers = subscribers[channel];
    if (!channelSubscribers) {
      console.warn(`Received message on channel ${channel}, but we weren't subscribed: ${message}`);
      return;
    }

    channelSubscribers.forEach(sub => sub(message));
  });

  function publish(channel, message) {
    pubConn.publish(encodeChannelName(channel), message);
  }

  function unsubscribe(channel, subscriber) {
    subscribers[channel].delete(subscriber);

    if (subscribers[channel].size === 0) {
      delete subscribers[channel];
      subConn.unsubscribe(encodeChannelName(channel));
    }
  }

  function subscribe(channel, subscriber) {
    if (subscribers[channel]) {
      // we're already subscribed to this channel
      subscribers[channel].add(subscriber);
    } else {
      // we're not subscribed this this channel
      subConn.subscribe(encodeChannelName(channel));

      subscribers[channel] = new Set();
      subscribers[channel].add(subscriber);
    }

    return () => unsubscribe(channel, subscriber);
  }

  return { publish, subscribe, unsubscribe };
};
