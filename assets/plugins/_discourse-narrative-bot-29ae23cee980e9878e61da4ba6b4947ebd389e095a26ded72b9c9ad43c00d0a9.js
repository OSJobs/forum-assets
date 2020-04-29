define("discourse/plugins/discourse-narrative-bot/initializers/new-user-narrative", ["exports", "discourse/lib/plugin-api", "discourse/lib/ajax"], function (exports, _pluginApi, _ajax) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });


  function _initialize(api) {
    var messageBus = api.container.lookup("message-bus:main");
    var currentUser = api.getCurrentUser();
    var appEvents = api.container.lookup("service:app-events");

    api.modifyClass("component:site-header", {
      didInsertElement: function didInsertElement() {
        this._super.apply(this, arguments);
        this.dispatch("header:search-context-trigger", "header");
      }
    });

    api.modifyClass("model:post", {
      toggleBookmarkWithReminder: function toggleBookmarkWithReminder() {
        var _this = this;

        // if we are talking to discobot then any bookmarks should just
        // be created without reminder options, to streamline the new user
        // narrative.
        var discobotUserId = -2;
        if (this.user_id === discobotUserId && !this.bookmarked_with_reminder) {
          return (0, _ajax.ajax)("/bookmarks", {
            type: "POST",
            data: { post_id: this.id }
          }).then(function (response) {
            _this.setProperties({
              "topic.bookmarked": true,
              bookmarked_with_reminder: true,
              bookmark_id: response.id
            });
            _this.appEvents.trigger("post-stream:refresh", { id: _this.id });
          });
        }
        return this._super();
      }
    });

    api.attachWidgetAction("header", "headerSearchContextTrigger", function () {
      if (this.site.mobileView) {
        this.state.skipSearchContext = false;
      } else {
        this.state.contextEnabled = true;
        this.state.searchContextType = "topic";
      }
    });

    if (messageBus && currentUser) {
      messageBus.subscribe("/new_user_narrative/tutorial_search", function () {
        appEvents.trigger("header:search-context-trigger");
      });
    }
  }

  exports.default = {
    name: "new-user-narratve",

    initialize: function initialize(container) {
      var siteSettings = container.lookup("site-settings:main");
      if (siteSettings.discourse_narrative_bot_enabled) (0, _pluginApi.withPluginApi)("0.8.7", _initialize);
    }
  };
});

