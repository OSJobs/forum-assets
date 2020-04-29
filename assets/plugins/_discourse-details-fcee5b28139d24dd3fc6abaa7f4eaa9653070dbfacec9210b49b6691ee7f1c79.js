(function(document, $) {

  // cf. http://mths.be/details
  var hasNativeSupport = (function(doc) {
    var fake, el = doc.createElement("details");
    // fail-fast
    if (!("open" in el)) { return false; }
    // figure out a root node
    var root = doc.body || (function() {
      var de = doc.documentElement;
      fake = true;
      return de.insertBefore(doc.createElement("body"), de.firstElementChild || de.firstChild);
    })();
    // setup test element
    el.innerHTML = "<summary>a</summary>b";
    el.style.display = "block";
    // add test element to the root node
    root.appendChild(el);
    // can we open it?
    var diff = el.offsetHeight;
    el.open = true;
    diff = diff !== el.offsetHeight;
    // cleanup
    root.removeChild(el);
    if (fake) { root.parentNode.removeChild(root); }
    // return the result
    return diff;
  })(document);

  function toggleOpen($details) {
    $details.toggleClass("open");
  }

  $.fn.details = function() {
    if (hasNativeSupport) { return this; }

    return this.each(function() {
      var $details = $(this),
          $firstSummary = $("summary", $details).first();

      $firstSummary.prop("tabIndex", 0);

      $firstSummary.on("keydown", function(event) {
        if (event.keyCode === 32 /* SPACE */ || event.keyCode === 13 /* ENTER */) {
          toggleOpen($details);
          return false;
        }
      });

      $firstSummary.on("click", function() {
        $firstSummary.focus();
        toggleOpen($details);
      });

    });
  };

})(document, jQuery);
define("discourse/plugins/discourse-details/lib/discourse-markdown/details", ["exports"], function (exports) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.setup = setup;
  var rule = {
    tag: "details",
    before: function before(state, tagInfo) {
      var attrs = tagInfo.attrs;
      state.push("bbcode_open", "details", 1);
      state.push("bbcode_open", "summary", 1);

      var token = state.push("text", "", 0);
      token.content = attrs["_default"] || "";

      state.push("bbcode_close", "summary", -1);
    },

    after: function after(state) {
      state.push("bbcode_close", "details", -1);
    }
  };

  function setup(helper) {
    helper.whiteList(["summary", "summary[title]", "details", "details[open]", "details.elided"]);

    helper.registerPlugin(function (md) {
      md.block.bbcode.ruler.push("details", rule);
    });
  }
});
define("discourse/plugins/discourse-details/initializers/apply-details", ["exports", "discourse/lib/plugin-api"], function (exports, _pluginApi) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });


  function initializeDetails(api) {
    api.decorateCooked(function ($elem) {
      return $("details", $elem).details();
    }, {
      id: "discourse-details"
    });

    api.addToolbarPopupMenuOptionsCallback(function () {
      return {
        action: "insertDetails",
        icon: "caret-right",
        label: "details.title"
      };
    });

    api.modifyClass("controller:composer", {
      actions: {
        insertDetails: function insertDetails() {
          this.toolbarEvent.applySurround("\n" + ("[details=\"" + I18n.t("composer.details_title") + "\"]") + "\n", "\n[/details]\n", "details_text", { multiline: false });
        }
      }
    });
  }

  exports.default = {
    name: "apply-details",

    initialize: function initialize() {
      (0, _pluginApi.withPluginApi)("0.8.7", initializeDetails);
    }
  };
});

