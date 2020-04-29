define("discourse/plugins/discourse-voting/discourse/routes/user-activity-votes", ["exports", "discourse/routes/user-topic-list", "discourse/models/user-action"], function (exports, _userTopicList, _userAction) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = _userTopicList.default.extend({
    userActionType: _userAction.default.TYPES.topics,

    model: function model() {
      return this.store.findFiltered("topicList", {
        filter: "topics/voted-by/" + this.modelFor("user").get("username_lower")
      });
    }
  });
});
define("discourse/plugins/discourse-voting/discourse/feature-voting-route-map", ["exports"], function (exports) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = {
    resource: "user",
    path: "users/:username",
    map: function map() {
      this.route("userActivity", { path: "activity", resetNamespace: true }, function () {
        this.route("votes");
      });
    }
  };
});
define("discourse/plugins/discourse-voting/discourse/initializers/discourse-voting", ["exports", "discourse/lib/plugin-api", "discourse/models/nav-item"], function (exports, _pluginApi, _navItem) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = {
    name: "discourse-voting",

    initialize: function initialize() {
      (0, _pluginApi.withPluginApi)("0.8.32", function (api) {
        var siteSettings = api.container.lookup("site-settings:main");
        if (siteSettings.voting_enabled) {
          api.addNavigationBarItem({
            name: "votes",
            before: "top",
            customFilter: function customFilter(category) {
              return category && category.can_vote;
            },
            customHref: function customHref(category, args) {
              var currentFilterType = (args.filterType || "").split("/").pop();
              var path = _navItem.default.pathFor(currentFilterType, args);

              return path + "?order=votes";
            },
            forceActive: function forceActive(category, args, router) {
              var queryParams = router.currentRoute.queryParams;
              return queryParams && Object.keys(queryParams).length === 1 && queryParams["order"] === "votes";
            }
          });
        }
      });
    }
  };
});
define("discourse/plugins/discourse-voting/discourse/pre-initializers/extend-category-for-voting", ["exports", "ember-addons/ember-computed-decorators", "discourse/models/category", "discourse/lib/plugin-api"], function (exports, _emberComputedDecorators, _category, _pluginApi) {
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

  function _initialize(api) {
    api.addPostClassesCallback(function (post) {
      if (post.post_number === 1 && post.can_vote) {
        return ["voting-post"];
      }
    });
    api.includePostAttributes("can_vote");
    api.addTagsHtmlCallback(function (topic) {
      if (!topic.can_vote) {
        return;
      }

      var buffer = [];

      var title = "";
      if (topic.user_voted) {
        title = " title='" + I18n.t("voting.voted") + "'";
      }

      var userVotedClass = topic.user_voted ? " voted" : "";
      buffer.push("<span class='list-vote-count discourse-tag" + userVotedClass + "'" + title + ">");

      buffer.push(I18n.t("voting.votes", { count: topic.vote_count }));
      buffer.push("</span>");

      if (buffer.length > 0) {
        return buffer.join("");
      }
    }, { priority: -100 });
  }

  exports.default = {
    name: "extend-category-for-voting",

    before: "inject-discourse-objects",

    initialize: function initialize() {
      var _dec, _desc, _value, _obj, _init;

      (0, _pluginApi.withPluginApi)("0.8.4", function (api) {
        return _initialize(api);
      });
      (0, _pluginApi.withPluginApi)("0.8.30", function (api) {
        return api.addCategorySortCriteria("votes");
      });

      _category.default.reopen((_dec = (0, _emberComputedDecorators.default)("custom_fields.enable_topic_voting"), (_obj = {
        enable_topic_voting: {
          get: function get(enableField) {
            return enableField;
          },
          set: function set(value) {
            this.set("custom_fields.enable_topic_voting", value);
            return value;
          }
        }
      }, (_applyDecoratedDescriptor(_obj, "enable_topic_voting", [_dec], (_init = Object.getOwnPropertyDescriptor(_obj, "enable_topic_voting"), _init = _init ? _init.value : undefined, {
        enumerable: true,
        configurable: true,
        writable: true,
        initializer: function initializer() {
          return _init;
        }
      }), _obj)), _obj)));
    }
  };
});
define("discourse/plugins/discourse-voting/discourse/widgets/vote-box", ["exports", "discourse/widgets/widget", "discourse/lib/ajax", "discourse/widgets/raw-html", "discourse/lib/ajax-error"], function (exports, _widget, _ajax, _rawHtml, _ajaxError) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = (0, _widget.createWidget)("vote-box", {
    tagName: "div.voting-wrapper",
    buildKey: function buildKey() {
      return "vote-box";
    },

    buildClasses: function buildClasses() {
      if (this.siteSettings.voting_show_who_voted) {
        return "show-pointer";
      }
    },
    defaultState: function defaultState() {
      return { allowClick: true, initialVote: false };
    },
    html: function html(attrs, state) {
      var voteCount = this.attach("vote-count", attrs);
      var voteButton = this.attach("vote-button", attrs);
      var voteOptions = this.attach("vote-options", attrs);
      var contents = [voteCount, voteButton, voteOptions];

      if (state.votesAlert > 0) {
        var html = "<div class='voting-popup-menu vote-options popup-menu'>" + I18n.t("voting.votes_left", {
          count: state.votesAlert,
          path: this.currentUser.get("path") + "/activity/votes"
        }) + "</div>";
        contents.push(new _rawHtml.default({ html: html }));
      }

      return contents;
    },
    hideVotesAlert: function hideVotesAlert() {
      if (this.state.votesAlert) {
        this.state.votesAlert = null;
        this.scheduleRerender();
      }
    },
    click: function click() {
      this.hideVotesAlert();
    },
    clickOutside: function clickOutside() {
      this.hideVotesAlert();
    },
    addVote: function addVote() {
      var _this = this;

      var topic = this.attrs;
      var state = this.state;
      return (0, _ajax.ajax)("/voting/vote", {
        type: "POST",
        data: {
          topic_id: topic.id
        }
      }).then(function (result) {
        topic.set("vote_count", result.vote_count);
        topic.set("user_voted", true);
        _this.currentUser.set("votes_exceeded", !result.can_vote);
        if (result.alert) {
          state.votesAlert = result.votes_left;
        }
        topic.set("who_voted", result.who_voted);
        state.allowClick = true;
        _this.scheduleRerender();
      }).catch(_ajaxError.popupAjaxError);
    },
    removeVote: function removeVote() {
      var _this2 = this;

      var topic = this.attrs;
      var state = this.state;
      return (0, _ajax.ajax)("/voting/unvote", {
        type: "POST",
        data: {
          topic_id: topic.id
        }
      }).then(function (result) {
        topic.set("vote_count", result.vote_count);
        topic.set("user_voted", false);
        _this2.currentUser.set("votes_exceeded", !result.can_vote);
        topic.set("who_voted", result.who_voted);
        state.allowClick = true;
        _this2.scheduleRerender();
      }).catch(_ajaxError.popupAjaxError);
    }
  });
});
define("discourse/plugins/discourse-voting/discourse/widgets/vote-count", ["exports", "discourse/widgets/widget", "virtual-dom", "discourse/lib/ajax"], function (exports, _widget, _virtualDom, _ajax) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = (0, _widget.createWidget)("vote-count", {
    tagName: "div.vote-count-wrapper",
    buildKey: function buildKey() {
      return "vote-count";
    },

    buildClasses: function buildClasses() {
      if (this.attrs.vote_count === 0) {
        return "no-votes";
      }
    },
    defaultState: function defaultState() {
      return { whoVotedUsers: null };
    },
    html: function html(attrs) {
      var voteCount = (0, _virtualDom.h)("div.vote-count", attrs.vote_count.toString());
      var whoVoted = null;
      if (this.siteSettings.voting_show_who_voted && this.state.whoVotedUsers && this.state.whoVotedUsers.length > 0) {
        whoVoted = this.attach("small-user-list", {
          users: this.state.whoVotedUsers,
          addSelf: attrs.liked,
          listClassName: "regular-votes"
        });
      }

      var buffer = [voteCount];
      if (whoVoted) {
        buffer.push((0, _virtualDom.h)("div.who-voted.popup-menu.voting-popup-menu", [whoVoted]));
      }
      return buffer;
    },
    click: function click() {
      if (this.siteSettings.voting_show_who_voted && this.attrs.vote_count > 0) {
        if (this.state.whoVotedUsers === null) {
          return this.getWhoVoted();
        } else {
          $(".who-voted").toggle();
        }
      }
    },
    clickOutside: function clickOutside() {
      $(".who-voted").hide();
    },
    getWhoVoted: function getWhoVoted() {
      var _this = this;

      return (0, _ajax.ajax)("/voting/who", {
        type: "GET",
        data: {
          topic_id: this.attrs.id
        }
      }).then(function (users) {
        _this.state.whoVotedUsers = users.map(whoVotedAvatars);
      });
    }
  });


  function whoVotedAvatars(user) {
    return {
      template: user.avatar_template,
      username: user.username,
      post_url: user.post_url,
      url: Discourse.getURL("/users/") + user.username.toLowerCase()
    };
  }
});
define("discourse/plugins/discourse-voting/discourse/widgets/vote-button", ["exports", "discourse/widgets/widget"], function (exports, _widget) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = (0, _widget.createWidget)("vote-button", {
    tagName: "button.btn.btn-primary.vote-button",

    buildClasses: function buildClasses(attrs) {
      var buttonClass = "";
      if (attrs.closed) {
        buttonClass = "voting-closed";
      } else {
        if (!attrs.user_voted) {
          buttonClass = "nonvote";
        } else {
          if (this.currentUser && this.currentUser.votes_exceeded) {
            buttonClass = "vote-limited nonvote";
          } else {
            buttonClass = "vote";
          }
        }
      }
      if (this.siteSettings.voting_show_who_voted) {
        buttonClass += " show-pointer";
      }
      return buttonClass;
    },
    html: function html(attrs) {
      var buttonTitle = I18n.t("voting.vote_title");
      if (!this.currentUser) {
        if (attrs.vote_count) {
          buttonTitle = I18n.t("voting.anonymous_button", {
            count: attrs.vote_count
          });
        } else {
          buttonTitle = I18n.t("voting.anonymous_button", { count: 1 });
        }
      } else {
        if (attrs.closed) {
          buttonTitle = I18n.t("voting.voting_closed_title");
        } else {
          if (attrs.user_voted) {
            buttonTitle = I18n.t("voting.voted_title");
          } else {
            if (this.currentUser && this.currentUser.votes_exceeded) {
              buttonTitle = I18n.t("voting.voting_limit");
            } else {
              buttonTitle = I18n.t("voting.vote_title");
            }
          }
        }
      }
      return buttonTitle;
    },
    click: function click() {
      if (!this.currentUser) {
        this.sendWidgetAction("showLogin");
        $.cookie("destination_url", window.location.href);
        return;
      }
      if (!this.attrs.closed && this.parentWidget.state.allowClick && !this.attrs.user_voted) {
        this.parentWidget.state.allowClick = false;
        this.parentWidget.state.initialVote = true;
        this.sendWidgetAction("addVote");
      }
      if (this.attrs.user_voted || this.currentUser.votes_exceeded) {
        $(".vote-options").toggle();
      }
    },
    clickOutside: function clickOutside() {
      $(".vote-options").hide();
      this.parentWidget.state.initialVote = false;
    }
  });
});
define("discourse/plugins/discourse-voting/discourse/widgets/vote-options", ["exports", "discourse/widgets/widget", "virtual-dom"], function (exports, _widget, _virtualDom) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = (0, _widget.createWidget)("vote-options", {
    tagName: "div.vote-options",

    buildClasses: function buildClasses() {
      return "voting-popup-menu popup-menu hidden";
    },
    html: function html(attrs) {
      var contents = [];

      if (attrs.user_voted) {
        contents.push(this.attach("remove-vote", attrs));
      } else if (this.currentUser && this.currentUser.votes_exceeded && !attrs.user_voted) {
        contents.push([(0, _virtualDom.h)("div", I18n.t("voting.reached_limit")), (0, _virtualDom.h)("p", (0, _virtualDom.h)("a", { href: this.currentUser.get("path") + "/activity/votes" }, I18n.t("voting.list_votes")))]);
      }
      return contents;
    }
  });
});
define("discourse/plugins/discourse-voting/discourse/widgets/remove-vote", ["exports", "discourse/widgets/widget", "discourse-common/lib/icon-library"], function (exports, _widget, _iconLibrary) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = (0, _widget.createWidget)("remove-vote", {
    tagName: "div.remove-vote",

    buildClasses: function buildClasses() {
      return "vote-option";
    },
    html: function html() {
      return [(0, _iconLibrary.iconNode)("times"), I18n.t("voting.remove_vote")];
    },
    click: function click() {
      this.sendWidgetAction("removeVote");
    }
  });
});
Ember.TEMPLATES["javascripts/connectors/user-activity-bottom/user-voted-topics"] = Ember.HTMLBars.template({"id":null,"block":"{\"symbols\":[],\"statements\":[[4,\"if\",[[24,[\"siteSettings\",\"voting_show_votes_on_profile\"]]],null,{\"statements\":[[7,\"li\",true],[8],[0,\"\\n\"],[4,\"link-to\",null,[[\"route\"],[\"userActivity.votes\"]],{\"statements\":[[0,\"    \"],[1,[28,\"d-icon\",[\"heart\"],null],false],[0,\" \"],[1,[28,\"i18n\",[\"voting.vote_title_plural\"],null],false],[0,\"\\n\"]],\"parameters\":[]},null],[9],[0,\"\\n\"]],\"parameters\":[]},null]],\"hasEval\":false}","meta":{"moduleName":"javascripts/discourse/templates/connectors/user-activity-bottom/user-voted-topics"}});
Ember.TEMPLATES["javascripts/connectors/category-custom-settings/feature-voting-settings"] = Ember.HTMLBars.template({"id":null,"block":"{\"symbols\":[],\"statements\":[[7,\"h3\",true],[8],[1,[28,\"i18n\",[\"voting.title\"],null],false],[9],[0,\"\\n\"],[7,\"section\",true],[10,\"class\",\"field\"],[8],[0,\"\\n  \"],[7,\"div\",true],[10,\"class\",\"enable-topic-voting\"],[8],[0,\"\\n    \"],[7,\"label\",true],[10,\"class\",\"checkbox-label\"],[8],[0,\"\\n      \"],[1,[28,\"input\",null,[[\"type\",\"checked\"],[\"checkbox\",[24,[\"category\",\"enable_topic_voting\"]]]]],false],[0,\"\\n      \"],[1,[28,\"i18n\",[\"voting.allow_topic_voting\"],null],false],[0,\"\\n    \"],[9],[0,\"\\n  \"],[9],[0,\"\\n\"],[9],[0,\"\\n\"]],\"hasEval\":false}","meta":{"moduleName":"javascripts/discourse/templates/connectors/category-custom-settings/feature-voting-settings"}});
Ember.TEMPLATES["javascripts/connectors/topic-above-post-stream/topic-title-voting"] = Ember.HTMLBars.template({"id":null,"block":"{\"symbols\":[],\"statements\":[[4,\"if\",[[24,[\"model\",\"can_vote\"]]],null,{\"statements\":[[4,\"if\",[[24,[\"model\",\"postStream\",\"loaded\"]]],null,{\"statements\":[[4,\"if\",[[24,[\"model\",\"postStream\",\"firstPostPresent\"]]],null,{\"statements\":[[0,\"      \"],[7,\"div\",true],[10,\"class\",\"voting title-voting\"],[8],[0,\"\\n        \"],[1,[28,\"mount-widget\",null,[[\"widget\",\"args\",\"showLogin\"],[\"vote-box\",[24,[\"model\"]],[28,\"route-action\",[\"showLogin\"],null]]]],false],[0,\"\\n      \"],[9],[0,\"\\n\"]],\"parameters\":[]},null]],\"parameters\":[]},null]],\"parameters\":[]},null]],\"hasEval\":false}","meta":{"moduleName":"javascripts/discourse/templates/connectors/topic-above-post-stream/topic-title-voting"}});

