define("preload-store", ["exports", "rsvp"], function (exports, _rsvp) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = {
    data: {},

    store: function store(key, value) {
      this.data[key] = value;
    },


    /**
      To retrieve a key, you provide the key you want, plus a finder to load
      it if the key cannot be found. Once the key is used once, it is removed
      from the store.
      So, for example, you can't load a preloaded topic more than once.
    **/
    getAndRemove: function getAndRemove(key, finder) {
      if (this.data[key]) {
        var promise = _rsvp.Promise.resolve(this.data[key]);
        delete this.data[key];
        return promise;
      }

      if (finder) {
        return new _rsvp.Promise(function (resolve, reject) {
          var result = finder();

          // If the finder returns a promise, we support that too
          if (result && result.then) {
            result.then(function (toResolve) {
              return resolve(toResolve);
            }).catch(function (toReject) {
              return reject(toReject);
            });
          } else {
            resolve(result);
          }
        });
      }

      return _rsvp.Promise.resolve(null);
    },
    get: function get(key) {
      return this.data[key];
    },
    remove: function remove(key) {
      if (this.data[key]) delete this.data[key];
    },
    reset: function reset() {
      this.data = {};
    }
  };
});
