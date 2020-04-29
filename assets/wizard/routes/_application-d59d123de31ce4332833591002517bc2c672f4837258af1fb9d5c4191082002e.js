define("wizard/routes/application", ["exports", "@ember/routing/route", "wizard/models/wizard"], function (exports, _route, _wizard) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = _route.default.extend({
    model: function model() {
      return (0, _wizard.findWizard)();
    },


    actions: {
      refresh: function refresh() {
        this.refresh();
      }
    }
  });
});
