define("discourse/plugins/discourse-presence/discourse/components/topic-presence-display", ["exports", "@ember/component", "@ember/object/computed", "discourse-common/utils/decorators"], function (exports, _component, _computed, _decorators) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });

  function _applyDecoratedDescriptor(target, property, decorators, descriptor, context) {
    var desc = {};
    Object['ke' + 'ys'](descriptor).forEach(function (key) {
      desc[key] = descriptor[key];
    });
    desc.enumerable = !!desc.enumerable;
    desc.configurable = !!desc.configurable;

    if ('value' in desc || desc.initializer) {
      desc.writable = true;
    }

    desc = decorators.slice().reverse().reduce(function (desc, decorator) {
      return decorator(target, property, desc) || desc;
    }, desc);

    if (context && desc.initializer !== void 0) {
      desc.value = desc.initializer ? desc.initializer.call(context) : void 0;
      desc.initializer = undefined;
    }

    if (desc.initializer === void 0) {
      Object['define' + 'Property'](target, property, desc);
      desc = null;
    }

    return desc;
  }

  var _dec, _dec2, _desc, _value, _obj;

  exports.default = _component.default.extend((_dec = (0, _decorators.on)("didInsertElement"), _dec2 = (0, _decorators.on)("willDestroyElement"), (_obj = {
    topic: null,

    presenceManager: (0, _computed.readOnly)("topic.presenceManager"),
    users: (0, _computed.readOnly)("presenceManager.users"),
    shouldDisplay: (0, _computed.gt)("users.length", 0),

    subscribe: function subscribe() {
      this.get("presenceManager").subscribe();
    },
    _destroyed: function _destroyed() {
      this.get("presenceManager").unsubscribe();
    }
  }, (_applyDecoratedDescriptor(_obj, "subscribe", [_dec], Object.getOwnPropertyDescriptor(_obj, "subscribe"), _obj), _applyDecoratedDescriptor(_obj, "_destroyed", [_dec2], Object.getOwnPropertyDescriptor(_obj, "_destroyed"), _obj)), _obj)));
});
define("discourse/plugins/discourse-presence/discourse/components/composer-presence-display", ["exports", "@ember/component", "@ember/runloop", "@ember/object/computed", "discourse-common/utils/decorators", "../lib/presence-manager"], function (exports, _component, _runloop, _computed, _decorators, _presenceManager) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });

  function _applyDecoratedDescriptor(target, property, decorators, descriptor, context) {
    var desc = {};
    Object['ke' + 'ys'](descriptor).forEach(function (key) {
      desc[key] = descriptor[key];
    });
    desc.enumerable = !!desc.enumerable;
    desc.configurable = !!desc.configurable;

    if ('value' in desc || desc.initializer) {
      desc.writable = true;
    }

    desc = decorators.slice().reverse().reduce(function (desc, decorator) {
      return decorator(target, property, desc) || desc;
    }, desc);

    if (context && desc.initializer !== void 0) {
      desc.value = desc.initializer ? desc.initializer.call(context) : void 0;
      desc.initializer = undefined;
    }

    if (desc.initializer === void 0) {
      Object['define' + 'Property'](target, property, desc);
      desc = null;
    }

    return desc;
  }

  var _dec, _dec2, _dec3, _dec4, _dec5, _dec6, _desc, _value, _obj;

  exports.default = _component.default.extend((_dec = (0, _decorators.on)("didInsertElement"), _dec2 = (0, _decorators.default)("post.id", "editingUsers.@each.last_seen", "users.@each.last_seen"), _dec3 = (0, _decorators.observes)("reply", "title"), _dec4 = (0, _decorators.observes)("whisper"), _dec5 = (0, _decorators.observes)("post.id"), _dec6 = (0, _decorators.on)("willDestroyElement"), (_obj = {
    // Passed in variables
    action: null,
    post: null,
    topic: null,
    reply: null,
    title: null,
    isWhispering: null,

    presenceManager: (0, _computed.readOnly)("topic.presenceManager"),
    users: (0, _computed.readOnly)("presenceManager.users"),
    editingUsers: (0, _computed.readOnly)("presenceManager.editingUsers"),
    isReply: (0, _computed.equal)("action", "reply"),

    subscribe: function subscribe() {
      this.presenceManager && this.presenceManager.subscribe();
    },
    presenceUsers: function presenceUsers(postId, editingUsers, users) {
      if (postId) {
        return editingUsers.filterBy("post_id", postId);
      } else {
        return users;
      }
    },


    shouldDisplay: (0, _computed.gt)("presenceUsers.length", 0),

    typing: function typing() {
      if (this.presenceManager) {
        var postId = this.get("post.id");

        this._throttle = this.presenceManager.throttlePublish(postId ? _presenceManager.EDITING : _presenceManager.REPLYING, this.whisper, postId);
      }
    },
    cancelThrottle: function cancelThrottle() {
      this._cancelThrottle();
    },
    stopEditing: function stopEditing() {
      if (this.presenceManager && !this.get("post.id")) {
        this.presenceManager.publish(_presenceManager.CLOSED, this.whisper);
      }
    },
    composerClosing: function composerClosing() {
      if (this.presenceManager) {
        this._cancelThrottle();
        this.presenceManager.publish(_presenceManager.CLOSED, this.whisper);
      }
    },
    _cancelThrottle: function _cancelThrottle() {
      (0, _runloop.cancel)(this._throttle);
    }
  }, (_applyDecoratedDescriptor(_obj, "subscribe", [_dec], Object.getOwnPropertyDescriptor(_obj, "subscribe"), _obj), _applyDecoratedDescriptor(_obj, "presenceUsers", [_dec2], Object.getOwnPropertyDescriptor(_obj, "presenceUsers"), _obj), _applyDecoratedDescriptor(_obj, "typing", [_dec3], Object.getOwnPropertyDescriptor(_obj, "typing"), _obj), _applyDecoratedDescriptor(_obj, "cancelThrottle", [_dec4], Object.getOwnPropertyDescriptor(_obj, "cancelThrottle"), _obj), _applyDecoratedDescriptor(_obj, "stopEditing", [_dec5], Object.getOwnPropertyDescriptor(_obj, "stopEditing"), _obj), _applyDecoratedDescriptor(_obj, "composerClosing", [_dec6], Object.getOwnPropertyDescriptor(_obj, "composerClosing"), _obj)), _obj)));
});
define("discourse/plugins/discourse-presence/discourse/templates/connectors/composer-fields/presence", ["exports"], function (exports) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = {
    shouldRender: function shouldRender(_, ctx) {
      return ctx.siteSettings.presence_enabled;
    }
  };
});
Ember.TEMPLATES["javascripts/connectors/composer-fields/presence"] = Ember.HTMLBars.template({"id":null,"block":"{\"symbols\":[],\"statements\":[[1,[28,\"composer-presence-display\",null,[[\"action\",\"post\",\"topic\",\"reply\",\"title\",\"whisper\"],[[24,[\"model\",\"action\"]],[24,[\"model\",\"post\"]],[24,[\"model\",\"topic\"]],[24,[\"model\",\"reply\"]],[24,[\"model\",\"title\"]],[24,[\"model\",\"whisper\"]]]]],false],[0,\"\\n\"]],\"hasEval\":false}","meta":{"moduleName":"javascripts/discourse/templates/connectors/composer-fields/presence"}});
define("discourse/plugins/discourse-presence/discourse/templates/connectors/topic-above-footer-buttons/presence", ["exports"], function (exports) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = {
    shouldRender: function shouldRender(_, ctx) {
      return ctx.siteSettings.presence_enabled;
    }
  };
});
Ember.TEMPLATES["javascripts/connectors/topic-above-footer-buttons/presence"] = Ember.HTMLBars.template({"id":null,"block":"{\"symbols\":[],\"statements\":[[1,[28,\"topic-presence-display\",null,[[\"topic\"],[[24,[\"model\"]]]]],false],[0,\"\\n\"]],\"hasEval\":false}","meta":{"moduleName":"javascripts/discourse/templates/connectors/topic-above-footer-buttons/presence"}});
Ember.TEMPLATES["javascripts/components/composer-presence-display"] = Ember.HTMLBars.template({"id":null,"block":"{\"symbols\":[\"user\"],\"statements\":[[4,\"if\",[[24,[\"shouldDisplay\"]]],null,{\"statements\":[[0,\"  \"],[7,\"div\",true],[10,\"class\",\"presence-users\"],[8],[0,\"\\n    \"],[7,\"div\",true],[10,\"class\",\"presence-avatars\"],[8],[0,\"\\n\"],[4,\"each\",[[24,[\"presenceUsers\"]]],null,{\"statements\":[[0,\"        \"],[1,[28,\"avatar\",[[23,1,[]]],[[\"avatarTemplatePath\",\"usernamePath\",\"imageSize\"],[\"avatar_template\",\"username\",\"small\"]]],false],[0,\"\\n\"]],\"parameters\":[1]},null],[0,\"    \"],[9],[0,\"\\n    \"],[7,\"span\",true],[10,\"class\",\"presence-text\"],[8],[0,\"\\n      \"],[7,\"span\",true],[10,\"class\",\"description\"],[8],[0,\"\\n\"],[4,\"if\",[[24,[\"isReply\"]]],null,{\"statements\":[[1,[28,\"i18n\",[\"presence.replying\"],null],false]],\"parameters\":[]},{\"statements\":[[1,[28,\"i18n\",[\"presence.editing\"],null],false]],\"parameters\":[]}],[9],[9],[7,\"span\",true],[10,\"class\",\"wave\"],[8],[7,\"span\",true],[10,\"class\",\"dot\"],[8],[0,\".\"],[9],[7,\"span\",true],[10,\"class\",\"dot\"],[8],[0,\".\"],[9],[7,\"span\",true],[10,\"class\",\"dot\"],[8],[0,\".\"],[9],[0,\"\\n    \"],[9],[0,\"\\n  \"],[9],[0,\"\\n\"]],\"parameters\":[]},null]],\"hasEval\":false}","meta":{"moduleName":"javascripts/discourse/templates/components/composer-presence-display"}});
Ember.TEMPLATES["javascripts/components/topic-presence-display"] = Ember.HTMLBars.template({"id":null,"block":"{\"symbols\":[\"user\"],\"statements\":[[4,\"if\",[[24,[\"shouldDisplay\"]]],null,{\"statements\":[[0,\"  \"],[7,\"div\",true],[10,\"class\",\"presence-users\"],[8],[0,\"\\n    \"],[7,\"div\",true],[10,\"class\",\"presence-avatars\"],[8],[0,\"\\n\"],[4,\"each\",[[24,[\"users\"]]],null,{\"statements\":[[0,\"        \"],[1,[28,\"avatar\",[[23,1,[]]],[[\"avatarTemplatePath\",\"usernamePath\",\"imageSize\"],[\"avatar_template\",\"username\",\"small\"]]],false],[0,\"\\n\"]],\"parameters\":[1]},null],[0,\"    \"],[9],[0,\"\\n    \"],[7,\"span\",true],[10,\"class\",\"presence-text\"],[8],[0,\"\\n      \"],[7,\"span\",true],[10,\"class\",\"description\"],[8],[1,[28,\"i18n\",[\"presence.replying_to_topic\"],[[\"count\"],[[24,[\"users\",\"length\"]]]]],false],[9],[7,\"span\",true],[10,\"class\",\"wave\"],[8],[7,\"span\",true],[10,\"class\",\"dot\"],[8],[0,\".\"],[9],[7,\"span\",true],[10,\"class\",\"dot\"],[8],[0,\".\"],[9],[7,\"span\",true],[10,\"class\",\"dot\"],[8],[0,\".\"],[9],[9],[0,\"\\n    \"],[9],[0,\"\\n  \"],[9],[0,\"\\n\"]],\"parameters\":[]},null]],\"hasEval\":false}","meta":{"moduleName":"javascripts/discourse/templates/components/topic-presence-display"}});
define("discourse/plugins/discourse-presence/discourse/lib/presence-manager", ["exports", "@ember/object", "@ember/runloop", "discourse/lib/ajax", "discourse-common/utils/decorators"], function (exports, _object, _runloop, _ajax, _decorators) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.CLOSED = exports.EDITING = exports.REPLYING = undefined;

  function _applyDecoratedDescriptor(target, property, decorators, descriptor, context) {
    var desc = {};
    Object['ke' + 'ys'](descriptor).forEach(function (key) {
      desc[key] = descriptor[key];
    });
    desc.enumerable = !!desc.enumerable;
    desc.configurable = !!desc.configurable;

    if ('value' in desc || desc.initializer) {
      desc.writable = true;
    }

    desc = decorators.slice().reverse().reduce(function (desc, decorator) {
      return decorator(target, property, desc) || desc;
    }, desc);

    if (context && desc.initializer !== void 0) {
      desc.value = desc.initializer ? desc.initializer.call(context) : void 0;
      desc.initializer = undefined;
    }

    if (desc.initializer === void 0) {
      Object['define' + 'Property'](target, property, desc);
      desc = null;
    }

    return desc;
  }

  var _dec, _desc, _value, _obj;

  // The durations chosen here determines the accuracy of the presence feature and
  // is tied closely with the server side implementation. Decreasing the duration
  // to increase the accuracy will come at the expense of having to more network
  // calls to publish the client's state.
  //
  // Logic walk through of our heuristic implementation:
  // - When client A is typing, a message is published every KEEP_ALIVE_DURATION_SECONDS.
  // - Client B receives the message and stores each user in an array and marks
  //   the user with a client-side timestamp of when the user was seen.
  // - If client A continues to type, client B will continue to receive messages to
  //   update the client-side timestamp of when client A was last seen.
  // - If client A disconnects or becomes inactive, the state of client A will be
  //   cleaned up on client B by a scheduler that runs every TIMER_INTERVAL_MILLISECONDS
  var KEEP_ALIVE_DURATION_SECONDS = 10;
  var BUFFER_DURATION_SECONDS = KEEP_ALIVE_DURATION_SECONDS + 2;

  var MESSAGE_BUS_LAST_ID = 0;
  var TIMER_INTERVAL_MILLISECONDS = 2000;

  var REPLYING = exports.REPLYING = "replying";
  var EDITING = exports.EDITING = "editing";
  var CLOSED = exports.CLOSED = "closed";

  var PresenceManager = _object.default.extend((_dec = (0, _decorators.default)("topic.id"), (_obj = {
    users: null,
    editingUsers: null,
    subscribed: null,
    topic: null,
    currentUser: null,
    messageBus: null,
    siteSettings: null,

    init: function init() {
      this._super.apply(this, arguments);

      this.setProperties({
        users: [],
        editingUsers: [],
        subscribed: false
      });
    },
    subscribe: function subscribe() {
      var _this = this;

      if (this.subscribed) return;

      this.messageBus.subscribe(this.channel, function (message) {
        var user = message.user,
            state = message.state;

        if (_this.get("currentUser.id") === user.id) return;

        switch (state) {
          case REPLYING:
            _this._appendUser(_this.users, user);
            break;
          case EDITING:
            _this._appendUser(_this.editingUsers, user, {
              post_id: parseInt(message.post_id, 10)
            });
            break;
          case CLOSED:
            _this._removeUser(user);
            break;
        }
      }, MESSAGE_BUS_LAST_ID);

      this.set("subscribed", true);
    },
    unsubscribe: function unsubscribe() {
      this.messageBus.unsubscribe(this.channel);
      this._stopTimer();
      this.set("subscribed", false);
    },
    channel: function channel(topicId) {
      return "/presence/" + topicId;
    },
    throttlePublish: function throttlePublish(state, whisper, postId) {
      return (0, _runloop.throttle)(this, this.publish, state, whisper, postId, KEEP_ALIVE_DURATION_SECONDS * 1000);
    },
    publish: function publish(state, whisper, postId) {
      var data = {
        state: state,
        topic_id: this.get("topic.id")
      };

      if (whisper) {
        data.is_whisper = 1;
      }

      if (postId) {
        data.post_id = postId;
      }

      return (0, _ajax.ajax)("/presence/publish", {
        type: "POST",
        data: data
      });
    },
    _removeUser: function _removeUser(user) {
      [this.users, this.editingUsers].forEach(function (users) {
        var existingUser = users.findBy("id", user.id);
        if (existingUser) users.removeObject(existingUser);
      });
    },
    _cleanUpUsers: function _cleanUpUsers() {
      [this.users, this.editingUsers].forEach(function (users) {
        var staleUsers = [];

        users.forEach(function (user) {
          if (user.last_seen <= Date.now() - BUFFER_DURATION_SECONDS * 1000) {
            staleUsers.push(user);
          }
        });

        users.removeObjects(staleUsers);
      });

      return this.users.length === 0 && this.editingUsers.length === 0;
    },
    _appendUser: function _appendUser(users, user, attrs) {
      var _this2 = this;

      var existingUser = void 0;
      var usersLength = 0;

      users.forEach(function (u) {
        if (u.id === user.id) {
          existingUser = u;
        }

        if (attrs && attrs.post_id) {
          if (u.post_id === attrs.post_id) usersLength++;
        } else {
          usersLength++;
        }
      });

      var props = attrs || {};
      props.last_seen = Date.now();

      if (existingUser) {
        existingUser.setProperties(props);
      } else {
        var limit = this.get("siteSettings.presence_max_users_shown");

        if (usersLength < limit) {
          users.pushObject(_object.default.create(Object.assign(user, props)));
        }
      }

      this._startTimer(function () {
        _this2._cleanUpUsers();
      });
    },
    _scheduleTimer: function _scheduleTimer(callback) {
      var _this3 = this;

      return (0, _runloop.later)(this, function () {
        var stop = callback();

        if (!stop) {
          _this3.set("_timer", _this3._scheduleTimer(callback));
        }
      }, TIMER_INTERVAL_MILLISECONDS);
    },
    _stopTimer: function _stopTimer() {
      (0, _runloop.cancel)(this._timer);
    },
    _startTimer: function _startTimer(callback) {
      if (!this._timer) {
        this.set("_timer", this._scheduleTimer(callback));
      }
    }
  }, (_applyDecoratedDescriptor(_obj, "channel", [_dec], Object.getOwnPropertyDescriptor(_obj, "channel"), _obj)), _obj)));

  exports.default = PresenceManager;
});
define("discourse/plugins/discourse-presence/initializers/discourse-presence", ["exports", "discourse/lib/plugin-api", "../discourse/lib/presence-manager"], function (exports, _pluginApi, _presenceManager) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });


  function initializeDiscoursePresence(api) {
    var currentUser = api.getCurrentUser();
    var siteSettings = api.container.lookup("site-settings:main");

    if (currentUser && !currentUser.hide_profile_and_presence) {
      api.modifyClass("model:topic", {
        presenceManager: null
      });

      api.modifyClass("route:topic-from-params", {
        setupController: function setupController() {
          this._super.apply(this, arguments);

          this.modelFor("topic").set("presenceManager", _presenceManager.default.create({
            topic: this.modelFor("topic"),
            currentUser: currentUser,
            messageBus: api.container.lookup("message-bus:main"),
            siteSettings: siteSettings
          }));
        }
      });
    }
  }

  exports.default = {
    name: "discourse-presence",
    after: "message-bus",

    initialize: function initialize(container) {
      var siteSettings = container.lookup("site-settings:main");

      if (siteSettings.presence_enabled) {
        (0, _pluginApi.withPluginApi)("0.8.40", initializeDiscoursePresence);
      }
    }
  };
});

