define("discourse/plugins/discourse-internet-explorer/initializers/discourse-internet-explorer", ["exports", "discourse/lib/plugin-api"], function (exports, _pluginApi) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });


  function initializeInternetExplorerDeprecation(api) {
    var siteSettings = api.container.lookup("site-settings:main");
    if (siteSettings.discourse_internet_explorer_deprecation_warning) {
      var _api$container$lookup = api.container.lookup("capabilities:main"),
          isIE11 = _api$container$lookup.isIE11;

      if (isIE11) {
        api.addGlobalNotice(I18n.t("discourse_internet_explorer.deprecation_warning"), "deprecate-internet-explorer", { dismissable: true, dismissDuration: moment.duration(1, "week") });
      }
    }
  }

  exports.default = {
    name: "discourse-internet-explorer",

    initialize: function initialize() {
      (0, _pluginApi.withPluginApi)("0.8.37", initializeInternetExplorerDeprecation);
    }
  };
});

