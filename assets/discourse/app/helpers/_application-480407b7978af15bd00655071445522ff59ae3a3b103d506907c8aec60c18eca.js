define("discourse/helpers/application", ["discourse-common/lib/helpers", "discourse/lib/formatter", "@ember/template"], function (_helpers, _formatter, _template) {
  "use strict";

  (0, _helpers.registerUnbound)("raw-date", function (dt) {
    return (0, _template.htmlSafe)((0, _formatter.longDate)(new Date(dt)));
  });

  (0, _helpers.registerUnbound)("age-with-tooltip", function (dt) {
    return (0, _template.htmlSafe)((0, _formatter.autoUpdatingRelativeAge)(new Date(dt), { title: true }));
  });

  (0, _helpers.registerUnbound)("number", function (orig, params) {
    orig = Math.round(parseFloat(orig));
    if (isNaN(orig)) {
      orig = 0;
    }

    var title = I18n.toNumber(orig, { precision: 0 });
    if (params.numberKey) {
      title = I18n.t(params.numberKey, {
        number: title,
        count: parseInt(orig, 10)
      });
    }

    var classNames = "number";
    if (params["class"]) {
      classNames += " " + params["class"];
    }

    var result = "<span class='" + classNames + "'";
    var addTitle = params.noTitle ? false : true;

    // Round off the thousands to one decimal place
    var n = (0, _formatter.number)(orig);
    if (n.toString() !== title.toString() && addTitle) {
      result += " title='" + Handlebars.Utils.escapeExpression(title) + "'";
    }
    if (params.ariaLabel) {
      var ariaLabel = Handlebars.Utils.escapeExpression(params.ariaLabel);
      result += " aria-label='" + ariaLabel + "'";
    }

    result += ">" + n + "</span>";

    return (0, _template.htmlSafe)(result);
  });
});
