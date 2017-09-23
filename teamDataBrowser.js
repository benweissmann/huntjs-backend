/* eslint-env browser */

module.exports = function teamData(appName) {
  const LOCAL_STORAGE_KEY = `huntjs:teamdata:${appName}`;

  const api = {
    get(opts) {
      const defaultValue = opts ? opts.defaultValue : undefined;

      if (!localStorage[LOCAL_STORAGE_KEY]) {
        api.set(defaultValue);
      }

      const jsonValue = localStorage[LOCAL_STORAGE_KEY];

      if (jsonValue === undefined) {
        return Promise.resolve(undefined);
      }

      return Promise.resolve(JSON.parse(localStorage[LOCAL_STORAGE_KEY]));
    },

    set(newValue) {
      if (newValue === undefined) {
        delete localStorage[LOCAL_STORAGE_KEY];
      } else {
        localStorage[LOCAL_STORAGE_KEY] = JSON.stringify(newValue);
      }

      return Promise.resolve();
    },
  };

  return api;
};
