/* eslint-env browser */

module.exports = function teamData(appName) {
  const LOCAL_STORAGE_KEY = `huntjs:teamdata:${appName}`;
  return {
    get(opts) {
      const defaultValue = opts ? opts.defaultValue : undefined;

      if (!localStorage[LOCAL_STORAGE_KEY]) {
        localStorage[LOCAL_STORAGE_KEY] = defaultValue;
      }

      return Promise.resolve(localStorage[LOCAL_STORAGE_KEY]);
    },

    set(newValue) {
      localStorage[LOCAL_STORAGE_KEY] = newValue;

      return Promise.resolve();
    },
  };
};
