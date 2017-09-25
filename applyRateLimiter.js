module.exports = function applyRateLimiter(rateLimiter, req, desc) {
  return new Promise((resolve, reject) => {
    rateLimiter(req, (err, rate) => {
      if (err) {
        reject(err);
        return;
      }

      if (rate.over) {
        const overLimitError = new Error('Rate limiter over limit');
        overLimitError.userMessage = `Rate limit exceeded. Limit is ${desc}`;
        overLimitError.statusCode = 429;
        reject(overLimitError);
        return;
      }

      resolve();
    });
  });
};
