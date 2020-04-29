define("discourse-common/utils/decorators", ["exports", "discourse-common/utils/handle-descriptor", "discourse-common/utils/is-descriptor", "discourse-common/utils/extract-value", "discourse-common/utils/decorator-alias", "discourse-common/utils/macro-alias", "@ember/runloop"], function (exports, _handleDescriptor, _isDescriptor, _extractValue, _decoratorAlias, _macroAlias, _runloop) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.uniq = exports.union = exports.sum = exports.sort = exports.setDiff = exports.reads = exports.or = exports.oneWay = exports.notEmpty = exports.not = exports.none = exports.min = exports.max = exports.match = exports.mapBy = exports.map = exports.lte = exports.lt = exports.gte = exports.gt = exports.filterBy = exports.filter = exports.equal = exports.empty = exports.collect = exports.bool = exports.and = exports.alias = exports.observes = exports.on = undefined;
  exports.default = discourseComputedDecorator;
  exports.afterRender = afterRender;
  exports.readOnly = readOnly;
  function discourseComputedDecorator() {
    for (var _len = arguments.length, params = Array(_len), _key = 0; _key < _len; _key++) {
      params[_key] = arguments[_key];
    }

    // determine if user called as @discourseComputed('blah', 'blah') or @discourseComputed
    if ((0, _isDescriptor.default)(params[params.length - 1])) {
      return _handleDescriptor.default.apply(undefined, arguments);
    } else {
      return function () /* target, key, desc */{
        return _handleDescriptor.default.apply(undefined, Array.prototype.slice.call(arguments).concat([params]));
      };
    }
  }

  function afterRender(target, name, descriptor) {
    var originalFunction = descriptor.value;
    descriptor.value = function () {
      var _this = this,
          _arguments = arguments;

      (0, _runloop.next)(function () {
        (0, _runloop.schedule)("afterRender", function () {
          if (_this.element && !_this.isDestroying && !_this.isDestroyed) {
            return originalFunction.apply(_this, _arguments);
          }
        });
      });
    };
  }

  function readOnly(target, name, desc) {
    return {
      writable: false,
      enumerable: desc.enumerable,
      configurable: desc.configurable,
      initializer: function initializer() {
        var value = (0, _extractValue.default)(desc);
        return value.readOnly();
      }
    };
  }

  /* eslint-disable */
  var on = exports.on = (0, _decoratorAlias.default)(Ember.on, "Can not `on` without event names");
  var observes = exports.observes = (0, _decoratorAlias.default)(Ember.observer, "Can not `observe` without property names");

  var alias = exports.alias = (0, _macroAlias.default)(Ember.computed.alias);
  var and = exports.and = (0, _macroAlias.default)(Ember.computed.and);
  var bool = exports.bool = (0, _macroAlias.default)(Ember.computed.bool);
  var collect = exports.collect = (0, _macroAlias.default)(Ember.computed.collect);
  var empty = exports.empty = (0, _macroAlias.default)(Ember.computed.empty);
  var equal = exports.equal = (0, _macroAlias.default)(Ember.computed.equal);
  var filter = exports.filter = (0, _macroAlias.default)(Ember.computed.filter);
  var filterBy = exports.filterBy = (0, _macroAlias.default)(Ember.computed.filterBy);
  var gt = exports.gt = (0, _macroAlias.default)(Ember.computed.gt);
  var gte = exports.gte = (0, _macroAlias.default)(Ember.computed.gte);
  var lt = exports.lt = (0, _macroAlias.default)(Ember.computed.lt);
  var lte = exports.lte = (0, _macroAlias.default)(Ember.computed.lte);
  var map = exports.map = (0, _macroAlias.default)(Ember.computed.map);
  var mapBy = exports.mapBy = (0, _macroAlias.default)(Ember.computed.mapBy);
  var match = exports.match = (0, _macroAlias.default)(Ember.computed.match);
  var max = exports.max = (0, _macroAlias.default)(Ember.computed.max);
  var min = exports.min = (0, _macroAlias.default)(Ember.computed.min);
  var none = exports.none = (0, _macroAlias.default)(Ember.computed.none);
  var not = exports.not = (0, _macroAlias.default)(Ember.computed.not);
  var notEmpty = exports.notEmpty = (0, _macroAlias.default)(Ember.computed.notEmpty);
  var oneWay = exports.oneWay = (0, _macroAlias.default)(Ember.computed.oneWay);
  var or = exports.or = (0, _macroAlias.default)(Ember.computed.or);
  var reads = exports.reads = (0, _macroAlias.default)(Ember.computed.reads);
  var setDiff = exports.setDiff = (0, _macroAlias.default)(Ember.computed.setDiff);
  var sort = exports.sort = (0, _macroAlias.default)(Ember.computed.sort);
  var sum = exports.sum = (0, _macroAlias.default)(Ember.computed.sum);
  var union = exports.union = (0, _macroAlias.default)(Ember.computed.union);
  var uniq = exports.uniq = (0, _macroAlias.default)(Ember.computed.uniq);
});
define("discourse-common/config/environment", ["exports"], function (exports) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  var INPUT_DELAY = exports.INPUT_DELAY = 250;

  exports.default = { environment: Ember.testing ? "test" : "development" };
});
define("discourse-common/helpers/bound-i18n", ["exports", "discourse-common/lib/helpers"], function (exports, _helpers) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = (0, _helpers.htmlHelper)(function (key, params) {
    return I18n.t(key, params.hash);
  });
});
define("discourse-common/helpers/component-for-collection", ["discourse-common/lib/helpers"], function (_helpers) {
  "use strict";

  (0, _helpers.registerUnbound)("component-for-collection", function (collectionIdentifier, selectKit) {
    return selectKit.modifyComponentForCollection(collectionIdentifier);
  });
});
define("discourse-common/helpers/component-for-row", ["discourse-common/lib/helpers"], function (_helpers) {
  "use strict";

  (0, _helpers.registerUnbound)("component-for-row", function (collectionForIdentifier, item, selectKit) {
    return selectKit.modifyComponentForRow(collectionForIdentifier, item);
  });
});
define("discourse-common/helpers/d-icon", ["discourse-common/lib/helpers", "discourse-common/lib/icon-library"], function (_helpers, _iconLibrary) {
  "use strict";

  (0, _helpers.registerUnbound)("d-icon", function (id, params) {
    return new Handlebars.SafeString((0, _iconLibrary.renderIcon)("string", id, params));
  });
});
define("discourse-common/helpers/fa-icon", ["exports", "discourse-common/lib/helpers", "discourse-common/lib/icon-library", "discourse-common/lib/deprecated"], function (exports, _helpers, _iconLibrary, _deprecated) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.iconHTML = iconHTML;
  function iconHTML(id, params) {
    return (0, _iconLibrary.renderIcon)("string", id, params);
  }

  (0, _helpers.registerUnbound)("fa-icon", function (icon, params) {
    (0, _deprecated.default)("Use `{{d-icon}}` instead of `{{fa-icon}}");
    return new Handlebars.SafeString(iconHTML(icon, params));
  });
});
define("discourse-common/helpers/get-url", ["discourse-common/lib/helpers", "discourse-common/lib/get-url"], function (_helpers, _getUrl) {
  "use strict";

  (0, _helpers.registerUnbound)("get-url", function (value) {
    return (0, _getUrl.default)(value);
  });
});
define("discourse-common/helpers/html-safe", ["discourse-common/lib/helpers", "@ember/template"], function (_helpers, _template) {
  "use strict";

  (0, _helpers.registerUnbound)("html-safe", function (string) {
    return (0, _template.htmlSafe)(string);
  });
});
define("discourse-common/helpers/i18n", ["discourse-common/lib/helpers"], function (_helpers) {
  "use strict";

  (0, _helpers.registerUnbound)("i18n", function (key, params) {
    return I18n.t(key, params);
  });
  (0, _helpers.registerUnbound)("i18n-yes-no", function (value, params) {
    return I18n.t(value ? "yes_value" : "no_value", params);
  });
});
define("discourse-common/helpers/popular-themes", ["exports"], function (exports) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  var POPULAR_THEMES = exports.POPULAR_THEMES = [{
    name: "Graceful",
    value: "https://github.com/discourse/graceful",
    preview: "https://theme-creator.discourse.org/theme/awesomerobot/graceful",
    description: "A light and graceful theme for Discourse.",
    meta_url: "https://meta.discourse.org/t/a-graceful-theme-for-discourse/93040"
  }, {
    name: "Material Design Theme",
    value: "https://github.com/discourse/material-design-stock-theme",
    preview: "https://newmaterial.trydiscourse.com",
    description: "Inspired by Material Design, this theme comes with several color palettes (incl. a dark one).",
    meta_url: "https://meta.discourse.org/t/material-design-stock-theme/47142"
  }, {
    name: "Minima",
    value: "https://github.com/discourse/minima",
    preview: "https://theme-creator.discourse.org/theme/awesomerobot/minima",
    description: "A minimal theme with reduced UI elements and focus on text.",
    meta_url: "https://meta.discourse.org/t/minima-a-minimal-theme-for-discourse/108178"
  }, {
    name: "Sam's Simple Theme",
    value: "https://github.com/discourse/discourse-simple-theme",
    preview: "https://theme-creator.discourse.org/theme/sam/simple",
    description: "Simplified front page design with classic colors and typography.",
    meta_url: "https://meta.discourse.org/t/sams-personal-minimal-topic-list-design/23552"
  }, {
    name: "Vincent",
    value: "https://github.com/discourse/discourse-vincent-theme",
    preview: "https://theme-creator.discourse.org/theme/awesomerobot/vincent",
    description: "An elegant dark theme with a few color palettes.",
    meta_url: "https://meta.discourse.org/t/discourse-vincent-theme/76662"
  }, {
    name: "Brand Header",
    value: "https://github.com/discourse/discourse-brand-header",
    description: "Add an extra top header with your logo, navigation links and social icons.",
    meta_url: "https://meta.discourse.org/t/brand-header-theme-component/77977",
    component: true
  }, {
    name: "Custom Header Links",
    value: "https://github.com/discourse/discourse-custom-header-links",
    preview: "https://theme-creator.discourse.org/theme/Johani/custom-header-links",
    description: "Easily add custom text-based links to the header.",
    meta_url: "https://meta.discourse.org/t/custom-header-links/90588",
    component: true
  }, {
    name: "Category Banners",
    value: "https://github.com/discourse/discourse-category-banners",
    preview: "https://theme-creator.discourse.org/theme/awesomerobot/discourse-category-banners",
    description: "Show banners on category pages using your existing category details.",
    meta_url: "https://meta.discourse.org/t/discourse-category-banners/86241",
    component: true
  }, {
    name: "Kanban Board",
    value: "https://github.com/discourse/discourse-kanban-theme",
    preview: "https://theme-creator.discourse.org/theme/david/kanban",
    description: "Display and organize topics using a Kanban board interface.",
    meta_url: "https://meta.discourse.org/t/kanban-board-theme-component/118164",
    component: true
  }, {
    name: "Hamburger Theme Selector",
    value: "https://github.com/discourse/discourse-hamburger-theme-selector",
    description: "Displays a theme selector in the hamburger menu provided there is more than one user-selectable theme.",
    meta_url: "https://meta.discourse.org/t/hamburger-theme-selector/61210",
    component: true
  }, {
    name: "Header Submenus",
    value: "https://github.com/discourse/discourse-header-submenus",
    preview: "https://theme-creator.discourse.org/theme/Johani/header-submenus",
    description: "Lets you build a header menu with submenus (dropdowns).",
    meta_url: "https://meta.discourse.org/t/header-submenus/94584",
    component: true
  }, {
    name: "Alternative Logos",
    value: "https://github.com/discourse/discourse-alt-logo",
    description: "Add alternative logos for dark / light themes.",
    meta_url: "https://meta.discourse.org/t/alternative-logo-for-dark-themes/88502",
    component: true
  }, {
    name: "Automatic Table of Contents",
    value: "https://github.com/discourse/DiscoTOC",
    description: "Generates an interactive table of contents on the sidebar of your topic with a simple click in the composer.",
    meta_url: "https://meta.discourse.org/t/discotoc-automatic-table-of-contents/111143",
    component: true
  }, {
    name: "Easy Responsive Footer",
    value: "https://github.com/discourse/Discourse-easy-footer",
    preview: "https://theme-creator.discourse.org/theme/Johani/easy-footer",
    description: "Add a fully responsive footer without writing any HTML.",
    meta_url: "https://meta.discourse.org/t/easy-responsive-footer/95818",
    component: true
  }];
});
define("discourse-common/lib/attribute-hook", ["exports"], function (exports) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  // FROM: https://github.com/Matt-Esch/virtual-dom
  // License: MIT

  function AttributeHook(namespace, value) {
    if (!(this instanceof AttributeHook)) {
      return new AttributeHook(namespace, value);
    }

    this.namespace = namespace;
    this.value = value;
  }

  AttributeHook.prototype.hook = function (node, prop, prev) {
    if (prev && prev.type === "AttributeHook" && prev.value === this.value && prev.namespace === this.namespace) {
      return;
    }

    node.setAttributeNS(this.namespace, prop, this.value);
  };

  AttributeHook.prototype.unhook = function (node, prop, next) {
    if (next && next.type === "AttributeHook" && next.namespace === this.namespace) {
      return;
    }

    var colonPosition = prop.indexOf(":");
    var localName = colonPosition > -1 ? prop.substr(colonPosition + 1) : prop;
    node.removeAttributeNS(this.namespace, localName);
  };

  AttributeHook.prototype.type = "AttributeHook";

  exports.default = AttributeHook;
});
define("discourse-common/lib/deprecated", ["exports"], function (exports) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = deprecated;
  function deprecated(msg) {
    var opts = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

    msg = ["Deprecation notice:", msg];
    if (opts.since) {
      msg.push("(deprecated since Discourse " + opts.since + ")");
    }
    if (opts.dropFrom) {
      msg.push("(removal in Discourse " + opts.dropFrom + ")");
    }
    msg = msg.join(" ");

    if (opts.raiseError) {
      throw msg;
    }
    console.warn(msg); // eslint-disable-line no-console
  }
});
define("discourse-common/lib/get-owner", ["exports", "discourse-common/lib/deprecated", "@ember/application"], function (exports, _deprecated, _application) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.getOwner = getOwner;
  exports.getRegister = getRegister;
  function getOwner(obj) {
    if (_application.getOwner) {
      return (0, _application.getOwner)(obj) || Discourse.__container__;
    }

    return obj.container;
  }

  // `this.container` is deprecated, but we can still build a container-like
  // object for components to use
  function getRegister(obj) {
    var owner = getOwner(obj);
    var register = {
      lookup: function lookup() {
        return owner.lookup.apply(owner, arguments);
      },
      lookupFactory: function lookupFactory() {
        if (owner.factoryFor) {
          return owner.factoryFor.apply(owner, arguments);
        } else if (owner._lookupFactory) {
          return owner._lookupFactory.apply(owner, arguments);
        }
      },

      deprecateContainer: function deprecateContainer(target) {
        Object.defineProperty(target, "container", {
          get: function get() {
            (0, _deprecated.default)("Use `this.register` or `getOwner` instead of `this.container`");
            return register;
          }
        });
      }
    };

    return register;
  }
});
define("discourse-common/lib/get-url", ["exports"], function (exports) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = getURL;
  var baseUri = void 0;

  function getURL(url) {
    if (!url) return url;

    if (!baseUri) {
      baseUri = $('meta[name="discourse-base-uri"]').attr("content") || "";
    }

    // if it's a non relative URL, return it.
    if (url !== "/" && !/^\/[^\/]/.test(url)) return url;

    var found = url.indexOf(baseUri);

    if (found >= 0 && found < 3) return url;
    if (url[0] !== "/") url = "/" + url;

    return baseUri + url;
  }
});
define("discourse-common/lib/helpers", ["exports", "@ember/object", "@ember/component/helper", "discourse-common/lib/raw-handlebars"], function (exports, _object, _helper, _rawHandlebars) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.makeArray = makeArray;
  exports.htmlHelper = htmlHelper;
  exports.registerHelper = registerHelper;
  exports.findHelper = findHelper;
  exports.registerHelpers = registerHelpers;
  exports.registerUnbound = registerUnbound;

  function _toConsumableArray(arr) {
    if (Array.isArray(arr)) {
      for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) {
        arr2[i] = arr[i];
      }

      return arr2;
    } else {
      return Array.from(arr);
    }
  }

  function makeArray(obj) {
    if (obj === null || obj === undefined) {
      return [];
    }
    return Array.isArray(obj) ? obj : [obj];
  }

  function htmlHelper(fn) {
    return _helper.default.helper(function () {
      for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
        args[_key] = arguments[_key];
      }

      args = args.length > 1 ? args[0].concat({ hash: args[args.length - 1] }) : args;
      return new Handlebars.SafeString(fn.apply(this, args) || "");
    });
  }

  var _helpers = {};

  function rawGet(ctx, property, options) {
    if (options.types && options.data.view) {
      var view = options.data.view;
      return view.getStream ? view.getStream(property).value() : view.getAttr(property);
    } else {
      return (0, _object.get)(ctx, property);
    }
  }

  function registerHelper(name, fn) {
    _helpers[name] = _helper.default.helper(fn);
  }

  function findHelper(name) {
    return _helpers[name] || _helpers[name.dasherize()];
  }

  function registerHelpers(registry) {
    Object.keys(_helpers).forEach(function (name) {
      registry.register("helper:" + name, _helpers[name], { singleton: false });
    });
  }

  function resolveParams(ctx, options) {
    var params = {};
    var hash = options.hash;

    if (hash) {
      if (options.hashTypes) {
        Object.keys(hash).forEach(function (k) {
          var type = options.hashTypes[k];
          if (type === "STRING" || type === "StringLiteral" || type === "SubExpression") {
            params[k] = hash[k];
          } else if (type === "ID" || type === "PathExpression") {
            params[k] = rawGet(ctx, hash[k], options);
          }
        });
      } else {
        params = hash;
      }
    }
    return params;
  }

  function registerUnbound(name, fn) {
    var func = function func() {
      for (var _len2 = arguments.length, args = Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
        args[_key2] = arguments[_key2];
      }

      var options = args.pop();
      var properties = args;

      for (var i = 0; i < properties.length; i++) {
        if (options.types && (options.types[i] === "ID" || options.types[i] === "PathExpression")) {
          properties[i] = rawGet(this, properties[i], options);
        }
      }

      return fn.call.apply(fn, [this].concat(properties, [resolveParams(this, options)]));
    };

    _helpers[name] = _helper.default.extend({
      compute: function compute(params, args) {
        return fn.apply(undefined, _toConsumableArray(params).concat([args]));
      }
    });
    _rawHandlebars.default.registerHelper(name, func);
  }
});
define("discourse-common/lib/icon-library", ["exports", "virtual-dom", "discourse-common/lib/attribute-hook", "discourse-common/lib/deprecated", "jquery"], function (exports, _virtualDom, _attributeHook, _deprecated, _jquery) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.replaceIcon = replaceIcon;
  exports.renderIcon = renderIcon;
  exports.iconHTML = iconHTML;
  exports.iconNode = iconNode;
  exports.convertIconClass = convertIconClass;
  exports.registerIconRenderer = registerIconRenderer;


  var SVG_NAMESPACE = "http://www.w3.org/2000/svg";
  var _renderers = [];

  var REPLACEMENTS = {
    "d-tracking": "bell",
    "d-muted": "discourse-bell-slash",
    "d-regular": "far-bell",
    "d-watching": "discourse-bell-exclamation",
    "d-watching-first": "discourse-bell-one",
    "d-drop-expanded": "caret-down",
    "d-drop-collapsed": "caret-right",
    "d-unliked": "far-heart",
    "d-liked": "heart",
    "notification.mentioned": "at",
    "notification.group_mentioned": "at",
    "notification.quoted": "quote-right",
    "notification.replied": "reply",
    "notification.posted": "reply",
    "notification.edited": "pencil-alt",
    "notification.bookmark_reminder": "discourse-bookmark-clock",
    "notification.liked": "heart",
    "notification.liked_2": "heart",
    "notification.liked_many": "heart",
    "notification.liked_consolidated": "heart",
    "notification.private_message": "far-envelope",
    "notification.invited_to_private_message": "far-envelope",
    "notification.invited_to_topic": "hand-point-right",
    "notification.invitee_accepted": "user",
    "notification.moved_post": "sign-out-alt",
    "notification.linked": "link",
    "notification.granted_badge": "certificate",
    "notification.topic_reminder": "far-clock",
    "notification.watching_first_post": "discourse-bell-one",
    "notification.group_message_summary": "users",
    "notification.post_approved": "check",
    "notification.membership_request_accepted": "user-plus",
    "notification.membership_request_consolidated": "users"
  };

  // TODO: use lib/svg_sprite/fa4-renames.json here
  // Note: these should not be edited manually. They define the fa4-fa5 migration
  var fa4Replacements = {
    "500px": "fab-500px",
    "address-book-o": "far-address-book",
    "address-card-o": "far-address-card",
    adn: "fab-adn",
    amazon: "fab-amazon",
    android: "fab-android",
    angellist: "fab-angellist",
    apple: "fab-apple",
    "area-chart": "chart-area",
    "arrow-circle-o-down": "far-arrow-alt-circle-down",
    "arrow-circle-o-left": "far-arrow-alt-circle-left",
    "arrow-circle-o-right": "far-arrow-alt-circle-right",
    "arrow-circle-o-up": "far-arrow-alt-circle-up",
    arrows: "arrows-alt",
    "arrows-alt": "expand-arrows-alt",
    "arrows-h": "arrows-alt-h",
    "arrows-v": "arrows-alt-v",
    "asl-interpreting": "american-sign-language-interpreting",
    automobile: "car",
    bandcamp: "fab-bandcamp",
    bank: "university",
    "bar-chart": "far-chart-bar",
    "bar-chart-o": "far-chart-bar",
    bathtub: "bath",
    battery: "battery-full",
    "battery-0": "battery-empty",
    "battery-1": "battery-quarter",
    "battery-2": "battery-half",
    "battery-3": "battery-three-quarters",
    "battery-4": "battery-full",
    behance: "fab-behance",
    "behance-square": "fab-behance-square",
    "bell-o": "far-bell",
    "bell-slash-o": "far-bell-slash",
    bitbucket: "fab-bitbucket",
    "bitbucket-square": "fab-bitbucket",
    bitcoin: "fab-btc",
    "black-tie": "fab-black-tie",
    bluetooth: "fab-bluetooth",
    "bluetooth-b": "fab-bluetooth-b",
    "bookmark-o": "far-bookmark",
    btc: "fab-btc",
    "building-o": "far-building",
    buysellads: "fab-buysellads",
    cab: "taxi",
    calendar: "calendar-alt",
    "calendar-check-o": "far-calendar-check",
    "calendar-minus-o": "far-calendar-minus",
    "calendar-o": "far-calendar",
    "calendar-plus-o": "far-calendar-plus",
    "calendar-times-o": "far-calendar-times",
    "caret-square-o-down": "far-caret-square-down",
    "caret-square-o-left": "far-caret-square-left",
    "caret-square-o-right": "far-caret-square-right",
    "caret-square-o-up": "far-caret-square-up",
    cc: "far-closed-captioning",
    "cc-amex": "fab-cc-amex",
    "cc-diners-club": "fab-cc-diners-club",
    "cc-discover": "fab-cc-discover",
    "cc-jcb": "fab-cc-jcb",
    "cc-mastercard": "fab-cc-mastercard",
    "cc-paypal": "fab-cc-paypal",
    "cc-stripe": "fab-cc-stripe",
    "cc-visa": "fab-cc-visa",
    chain: "link",
    "chain-broken": "unlink",
    "check-circle-o": "far-check-circle",
    "check-square-o": "far-check-square",
    chrome: "fab-chrome",
    "circle-o": "far-circle",
    "circle-o-notch": "circle-notch",
    "circle-thin": "far-circle",
    clipboard: "far-clipboard",
    "clock-o": "far-clock",
    clone: "far-clone",
    close: "times",
    "cloud-download": "cloud-download-alt",
    "cloud-upload": "cloud-upload-alt",
    cny: "yen-sign",
    "code-fork": "code-branch",
    codepen: "fab-codepen",
    codiepie: "fab-codiepie",
    "comment-o": "far-comment",
    commenting: "far-comment-dots",
    "commenting-o": "far-comment-dots",
    "comments-o": "far-comments",
    compass: "far-compass",
    connectdevelop: "fab-connectdevelop",
    contao: "fab-contao",
    copyright: "far-copyright",
    "creative-commons": "fab-creative-commons",
    "credit-card": "far-credit-card",
    "credit-card-alt": "credit-card",
    css3: "fab-css3",
    cutlery: "utensils",
    dashboard: "tachometer-alt",
    dashcube: "fab-dashcube",
    deafness: "deaf",
    dedent: "outdent",
    delicious: "fab-delicious",
    deviantart: "fab-deviantart",
    diamond: "far-gem",
    digg: "fab-digg",
    discord: "fab-discord",
    dollar: "dollar-sign",
    "dot-circle-o": "far-dot-circle",
    dribbble: "fab-dribbble",
    "drivers-license": "id-card",
    "drivers-license-o": "far-id-card",
    dropbox: "fab-dropbox",
    drupal: "fab-drupal",
    edge: "fab-edge",
    eercast: "fab-sellcast",
    empire: "fab-empire",
    "envelope-o": "far-envelope",
    "envelope-open-o": "far-envelope-open",
    envira: "fab-envira",
    etsy: "fab-etsy",
    eur: "euro-sign",
    euro: "euro-sign",
    exchange: "exchange-alt",
    expeditedssl: "fab-expeditedssl",
    "external-link": "external-link-alt",
    "external-link-square": "external-link-square-alt",
    eye: "far-eye",
    "eye-slash": "far-eye-slash",
    eyedropper: "eye-dropper",
    fa: "fab-font-awesome",
    facebook: "fab-facebook-f",
    "facebook-f": "fab-facebook-f",
    "facebook-official": "fab-facebook",
    "facebook-square": "fab-facebook-square",
    feed: "rss",
    "file-archive-o": "far-file-archive",
    "file-audio-o": "far-file-audio",
    "file-code-o": "far-file-code",
    "file-excel-o": "far-file-excel",
    "file-image-o": "far-file-image",
    "file-movie-o": "far-file-video",
    "file-o": "far-file",
    "file-pdf-o": "far-file-pdf",
    "file-photo-o": "far-file-image",
    "file-picture-o": "far-file-image",
    "file-powerpoint-o": "far-file-powerpoint",
    "file-sound-o": "far-file-audio",
    "file-text": "file-alt",
    "file-text-o": "far-file-alt",
    "file-video-o": "far-file-video",
    "file-word-o": "far-file-word",
    "file-zip-o": "far-file-archive",
    "files-o": "far-copy",
    firefox: "fab-firefox",
    "first-order": "fab-first-order",
    "flag-o": "far-flag",
    flash: "bolt",
    flickr: "fab-flickr",
    "floppy-o": "far-save",
    "folder-o": "far-folder",
    "folder-open-o": "far-folder-open",
    "font-awesome": "fab-font-awesome",
    fonticons: "fab-fonticons",
    "fort-awesome": "fab-fort-awesome",
    forumbee: "fab-forumbee",
    foursquare: "fab-foursquare",
    "free-code-camp": "fab-free-code-camp",
    "frown-o": "far-frown",
    "futbol-o": "far-futbol",
    gbp: "pound-sign",
    ge: "fab-empire",
    gear: "cog",
    gears: "cogs",
    "get-pocket": "fab-get-pocket",
    gg: "fab-gg",
    "gg-circle": "fab-gg-circle",
    git: "fab-git",
    "git-square": "fab-git-square",
    github: "fab-github",
    "github-alt": "fab-github-alt",
    "github-square": "fab-github-square",
    gitlab: "fab-gitlab",
    gittip: "fab-gratipay",
    glass: "glass-martini",
    glide: "fab-glide",
    "glide-g": "fab-glide-g",
    google: "fab-google",
    "google-plus": "fab-google-plus-g",
    "google-plus-circle": "fab-google-plus",
    "google-plus-official": "fab-google-plus",
    "google-plus-square": "fab-google-plus-square",
    "google-wallet": "fab-google-wallet",
    gratipay: "fab-gratipay",
    grav: "fab-grav",
    group: "users",
    "hacker-news": "fab-hacker-news",
    "hand-grab-o": "far-hand-rock",
    "hand-lizard-o": "far-hand-lizard",
    "hand-o-down": "far-hand-point-down",
    "hand-o-left": "far-hand-point-left",
    "hand-o-right": "far-hand-point-right",
    "hand-o-up": "far-hand-point-up",
    "hand-paper-o": "far-hand-paper",
    "hand-peace-o": "far-hand-peace",
    "hand-pointer-o": "far-hand-pointer",
    "hand-rock-o": "far-hand-rock",
    "hand-scissors-o": "far-hand-scissors",
    "hand-spock-o": "far-hand-spock",
    "hand-stop-o": "far-hand-paper",
    "handshake-o": "far-handshake",
    "hard-of-hearing": "deaf",
    "hdd-o": "far-hdd",
    header: "heading",
    "heart-o": "far-heart",
    "hospital-o": "far-hospital",
    hotel: "bed",
    "hourglass-1": "hourglass-start",
    "hourglass-2": "hourglass-half",
    "hourglass-3": "hourglass-end",
    "hourglass-o": "far-hourglass",
    houzz: "fab-houzz",
    html5: "fab-html5",
    "id-card-o": "far-id-card",
    ils: "shekel-sign",
    image: "far-image",
    imdb: "fab-imdb",
    inr: "rupee-sign",
    instagram: "fab-instagram",
    institution: "university",
    "internet-explorer": "fab-internet-explorer",
    intersex: "transgender",
    ioxhost: "fab-ioxhost",
    joomla: "fab-joomla",
    jpy: "yen-sign",
    jsfiddle: "fab-jsfiddle",
    "keyboard-o": "far-keyboard",
    krw: "won-sign",
    lastfm: "fab-lastfm",
    "lastfm-square": "fab-lastfm-square",
    leanpub: "fab-leanpub",
    legal: "gavel",
    "lemon-o": "far-lemon",
    "level-down": "level-down-alt",
    "level-up": "level-up-alt",
    "life-bouy": "far-life-ring",
    "life-buoy": "far-life-ring",
    "life-ring": "far-life-ring",
    "life-saver": "far-life-ring",
    "lightbulb-o": "far-lightbulb",
    "line-chart": "chart-line",
    linkedin: "fab-linkedin-in",
    "linkedin-square": "fab-linkedin",
    linode: "fab-linode",
    linux: "fab-linux",
    "list-alt": "far-list-alt",
    "long-arrow-down": "long-arrow-alt-down",
    "long-arrow-left": "long-arrow-alt-left",
    "long-arrow-right": "long-arrow-alt-right",
    "long-arrow-up": "long-arrow-alt-up",
    "mail-forward": "share",
    "mail-reply": "reply",
    "mail-reply-all": "reply-all",
    "map-marker": "map-marker-alt",
    "map-o": "far-map",
    maxcdn: "fab-maxcdn",
    meanpath: "fab-font-awesome",
    medium: "fab-medium",
    meetup: "fab-meetup",
    "meh-o": "far-meh",
    "minus-square-o": "far-minus-square",
    mixcloud: "fab-mixcloud",
    mobile: "mobile-alt",
    "mobile-phone": "mobile-alt",
    modx: "fab-modx",
    money: "far-money-bill-alt",
    "moon-o": "far-moon",
    "mortar-board": "graduation-cap",
    navicon: "bars",
    "newspaper-o": "far-newspaper",
    "object-group": "far-object-group",
    "object-ungroup": "far-object-ungroup",
    odnoklassniki: "fab-odnoklassniki",
    "odnoklassniki-square": "fab-odnoklassniki-square",
    opencart: "fab-opencart",
    openid: "fab-openid",
    opera: "fab-opera",
    "optin-monster": "fab-optin-monster",
    pagelines: "fab-pagelines",
    "paper-plane-o": "far-paper-plane",
    paste: "far-clipboard",
    patreon: "fab-patreon",
    "pause-circle-o": "far-pause-circle",
    paypal: "fab-paypal",
    pencil: "pencil-alt",
    "pencil-square": "pen-square",
    "pencil-square-o": "far-edit",
    photo: "far-image",
    "picture-o": "far-image",
    "pie-chart": "chart-pie",
    "pied-piper": "fab-pied-piper",
    "pied-piper-alt": "fab-pied-piper-alt",
    "pied-piper-pp": "fab-pied-piper-pp",
    pinterest: "fab-pinterest",
    "pinterest-p": "fab-pinterest-p",
    "pinterest-square": "fab-pinterest-square",
    "play-circle-o": "far-play-circle",
    "plus-square-o": "far-plus-square",
    "product-hunt": "fab-product-hunt",
    qq: "fab-qq",
    "question-circle-o": "far-question-circle",
    quora: "fab-quora",
    ra: "fab-rebel",
    ravelry: "fab-ravelry",
    rebel: "fab-rebel",
    reddit: "fab-reddit",
    "reddit-alien": "fab-reddit-alien",
    "reddit-square": "fab-reddit-square",
    refresh: "sync",
    registered: "far-registered",
    remove: "times",
    renren: "fab-renren",
    reorder: "bars",
    repeat: "redo",
    resistance: "fab-rebel",
    rmb: "yen-sign",
    "rotate-left": "undo",
    "rotate-right": "redo",
    rouble: "ruble-sign",
    rub: "ruble-sign",
    ruble: "ruble-sign",
    rupee: "rupee-sign",
    s15: "bath",
    safari: "fab-safari",
    scissors: "cut",
    scribd: "fab-scribd",
    sellsy: "fab-sellsy",
    send: "paper-plane",
    "send-o": "far-paper-plane",
    "share-square-o": "far-share-square",
    shekel: "shekel-sign",
    sheqel: "shekel-sign",
    shield: "shield-alt",
    shirtsinbulk: "fab-shirtsinbulk",
    "sign-in": "sign-in-alt",
    "sign-out": "sign-out-alt",
    signing: "sign-language",
    simplybuilt: "fab-simplybuilt",
    skyatlas: "fab-skyatlas",
    skype: "fab-skype",
    slack: "fab-slack",
    sliders: "sliders-h",
    slideshare: "fab-slideshare",
    "smile-o": "far-smile",
    snapchat: "fab-snapchat",
    "snapchat-ghost": "fab-snapchat-ghost",
    "snapchat-square": "fab-snapchat-square",
    "snowflake-o": "far-snowflake",
    "soccer-ball-o": "far-futbol",
    "sort-alpha-asc": "sort-alpha-down",
    "sort-alpha-desc": "sort-alpha-up",
    "sort-amount-asc": "sort-amount-down",
    "sort-amount-desc": "sort-amount-up",
    "sort-asc": "sort-up",
    "sort-desc": "sort-down",
    "sort-numeric-asc": "sort-numeric-down",
    "sort-numeric-desc": "sort-numeric-up",
    soundcloud: "fab-soundcloud",
    spoon: "utensil-spoon",
    spotify: "fab-spotify",
    "square-o": "far-square",
    "stack-exchange": "fab-stack-exchange",
    "stack-overflow": "fab-stack-overflow",
    "star-half-empty": "far-star-half",
    "star-half-full": "far-star-half",
    "star-half-o": "far-star-half",
    "star-o": "far-star",
    steam: "fab-steam",
    "steam-square": "fab-steam-square",
    "sticky-note-o": "far-sticky-note",
    "stop-circle-o": "far-stop-circle",
    stumbleupon: "fab-stumbleupon",
    "stumbleupon-circle": "fab-stumbleupon-circle",
    "sun-o": "far-sun",
    superpowers: "fab-superpowers",
    support: "far-life-ring",
    tablet: "tablet-alt",
    tachometer: "tachometer-alt",
    telegram: "fab-telegram",
    television: "tv",
    "tencent-weibo": "fab-tencent-weibo",
    themeisle: "fab-themeisle",
    thermometer: "thermometer-full",
    "thermometer-0": "thermometer-empty",
    "thermometer-1": "thermometer-quarter",
    "thermometer-2": "thermometer-half",
    "thermometer-3": "thermometer-three-quarters",
    "thermometer-4": "thermometer-full",
    "thumb-tack": "thumbtack",
    "thumbs-o-down": "far-thumbs-down",
    "thumbs-o-up": "far-thumbs-up",
    ticket: "ticket-alt",
    "times-circle-o": "far-times-circle",
    "times-rectangle": "window-close",
    "times-rectangle-o": "far-window-close",
    "toggle-down": "far-caret-square-down",
    "toggle-left": "far-caret-square-left",
    "toggle-right": "far-caret-square-right",
    "toggle-up": "far-caret-square-up",
    trash: "trash-alt",
    "trash-o": "far-trash-alt",
    trello: "fab-trello",
    tripadvisor: "fab-tripadvisor",
    try: "lira-sign",
    tumblr: "fab-tumblr",
    "tumblr-square": "fab-tumblr-square",
    "turkish-lira": "lira-sign",
    twitch: "fab-twitch",
    twitter: "fab-twitter",
    "twitter-square": "fab-twitter-square",
    unsorted: "sort",
    usb: "fab-usb",
    usd: "dollar-sign",
    "user-circle-o": "far-user-circle",
    "user-o": "far-user",
    vcard: "address-card",
    "vcard-o": "far-address-card",
    viacoin: "fab-viacoin",
    viadeo: "fab-viadeo",
    "viadeo-square": "fab-viadeo-square",
    "video-camera": "video",
    vimeo: "fab-vimeo-v",
    "vimeo-square": "fab-vimeo-square",
    vine: "fab-vine",
    vk: "fab-vk",
    vkontakte: "fab-vk",
    "volume-control-phone": "phone-volume",
    warning: "exclamation-triangle",
    wechat: "fab-weixin",
    weibo: "fab-weibo",
    weixin: "fab-weixin",
    whatsapp: "fab-whatsapp",
    "wheelchair-alt": "fab-accessible-icon",
    "wikipedia-w": "fab-wikipedia-w",
    "window-close-o": "far-window-close",
    "window-maximize": "far-window-maximize",
    "window-restore": "far-window-restore",
    windows: "fab-windows",
    won: "won-sign",
    wordpress: "fab-wordpress",
    wpbeginner: "fab-wpbeginner",
    wpexplorer: "fab-wpexplorer",
    wpforms: "fab-wpforms",
    xing: "fab-xing",
    "xing-square": "fab-xing-square",
    "y-combinator": "fab-y-combinator",
    "y-combinator-square": "fab-hacker-news",
    yahoo: "fab-yahoo",
    yc: "fab-y-combinator",
    "yc-square": "fab-hacker-news",
    yelp: "fab-yelp",
    yen: "yen-sign",
    yoast: "fab-yoast",
    youtube: "fab-youtube",
    "youtube-play": "fab-youtube",
    "youtube-square": "fab-youtube-square"
  };

  function replaceIcon(source, destination) {
    REPLACEMENTS[source] = destination;
  }

  function renderIcon(renderType, id, params) {
    for (var i = 0; i < _renderers.length; i++) {
      var renderer = _renderers[i];
      var rendererForType = renderer[renderType];

      if (rendererForType) {
        var icon = { id: id, replacementId: REPLACEMENTS[id] };
        var result = rendererForType(icon, params || {});
        if (result) {
          return result;
        }
      }
    }
  }

  function iconHTML(id, params) {
    return renderIcon("string", id, params);
  }

  function iconNode(id, params) {
    return renderIcon("node", id, params);
  }

  function convertIconClass(icon) {
    return icon.replace("far fa-", "far-").replace("fab fa-", "fab-").replace("fas fa-", "").replace("fa-", "").trim();
  }

  // TODO: Improve how helpers are registered for vdom compliation
  if (typeof Discourse !== "undefined") {
    Discourse.__widget_helpers.iconNode = iconNode;
  }

  function registerIconRenderer(renderer) {
    _renderers.unshift(renderer);
  }

  function iconClasses(icon, params) {
    // "notification." is invalid syntax for classes, use replacement instead
    var dClass = icon.replacementId && icon.id.indexOf("notification.") > -1 ? icon.replacementId : icon.id;

    var classNames = "fa d-icon d-icon-" + dClass + " svg-icon";

    if (params && params["class"]) {
      classNames += " " + params["class"];
    }

    return classNames;
  }

  function warnIfMissing(id) {
    if (typeof Discourse !== "undefined" && Discourse.Environment === "development" && !Discourse.disableMissingIconWarning && Discourse.SvgIconList && Discourse.SvgIconList.indexOf(id) === -1) {
      console.warn("The icon \"" + id + "\" is missing from the SVG subset."); // eslint-disable-line no-console
    }
  }

  var reportedIcons = [];

  function warnIfDeprecated(oldId, newId) {
    (0, _deprecated.default)("Please replace all occurrences of \"" + oldId + "\"\" with \"" + newId + "\". FontAwesome 4.7 icon names are now deprecated and will be removed in the next release.");
    if (!Discourse.testing && !reportedIcons.includes(oldId)) {
      var errorData = {
        message: "FA icon deprecation: replace \"" + oldId + "\"\" with \"" + newId + "\".",
        stacktrace: Error().stack
      };

      _jquery.default.ajax(Discourse.BaseUri + "/logs/report_js_error", {
        data: errorData,
        type: "POST",
        cache: false
      });

      reportedIcons.push(oldId);
    }
  }

  function handleIconId(icon) {
    var id = icon.replacementId || icon.id || "";

    if (fa4Replacements.hasOwnProperty(id)) {
      warnIfDeprecated(id, fa4Replacements[id]);
      id = fa4Replacements[id];
    }

    // TODO: clean up "thumbtack unpinned" at source instead of here
    id = id.replace(" unpinned", "");

    warnIfMissing(id);
    return id;
  }

  // default resolver is font awesome
  registerIconRenderer({
    name: "font-awesome",

    string: function string(icon, params) {
      var id = handleIconId(icon);
      var html = "<svg class='" + iconClasses(icon, params) + " svg-string'";

      if (params.label) {
        html += " aria-hidden='true'";
      }
      html += " xmlns=\"" + SVG_NAMESPACE + "\"><use xlink:href=\"#" + id + "\" /></svg>";
      if (params.label) {
        html += "<span class='sr-only'>" + params.label + "</span>";
      }
      if (params.title) {
        html = "<span class=\"svg-icon-title\" title='" + I18n.t(params.title).replace(/'/g, "&#39;") + "'>" + html + "</span>";
      }
      if (params.translatedtitle) {
        html = "<span class=\"svg-icon-title\" title='" + params.translatedtitle.replace(/'/g, "&#39;") + "'>" + html + "</span>";
      }
      return html;
    },
    node: function node(icon, params) {
      var id = handleIconId(icon);
      var classes = iconClasses(icon, params) + " svg-node";

      var svg = (0, _virtualDom.h)("svg", {
        attributes: { class: classes, "aria-hidden": true },
        namespace: SVG_NAMESPACE
      }, [(0, _virtualDom.h)("use", {
        "xlink:href": (0, _attributeHook.default)("http://www.w3.org/1999/xlink", "#" + id),
        namespace: SVG_NAMESPACE
      })]);

      if (params.title) {
        return (0, _virtualDom.h)("span", {
          title: params.title,
          attributes: { class: "svg-icon-title" }
        }, [svg]);
      } else {
        return svg;
      }
    }
  });
});
define("discourse-common/lib/raw-handlebars-helpers", ["exports", "@ember/object"], function (exports, _object) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.registerRawHelpers = registerRawHelpers;
  function registerRawHelpers(hbs, handlebarsClass) {
    if (!hbs.helpers) {
      hbs.helpers = Object.create(handlebarsClass.helpers);
    }

    hbs.helpers["get"] = function (context, options) {
      if (!context || !options.contexts) {
        return;
      }

      if (typeof context !== "string") {
        return context;
      }

      var firstContext = options.contexts[0];
      var val = firstContext[context];

      if (context.toString().indexOf("controller.") === 0) {
        context = context.slice(context.indexOf(".") + 1);
      }

      return val === undefined ? (0, _object.get)(firstContext, context) : val;
    };

    // #each .. in support (as format is transformed to this)
    hbs.registerHelper("each", function (localName, inKeyword, contextName, options) {
      var list = (0, _object.get)(this, contextName);
      var output = [];
      var innerContext = Object.create(this);
      for (var i = 0; i < list.length; i++) {
        innerContext[localName] = list[i];
        output.push(options.fn(innerContext));
      }
      return output.join("");
    });

    function stringCompatHelper(fn) {
      var old = hbs.helpers[fn];
      hbs.helpers[fn] = function (context, options) {
        return old.apply(this, [hbs.helpers.get(context, options), options]);
      };
    }

    // HACK: Ensure that the variable is resolved only once.
    // The "get" function will be called twice because both `if` and `unless`
    // helpers are patched to resolve the variable and `unless` is implemented
    // as not `if`. For example, for {{#unless var}} will generate a stack
    // trace like:
    //
    // - patched-unless("var")  "var" is resolved to its value, val
    // - unless(val)            unless is implemented as !if
    // - !patched-if(val)       val is already resolved, but it is resolved again
    // - !if(???)               at this point, ??? usually stands for undefined
    //
    // The following code ensures that patched-unless will call `if` directly,
    // `patched-unless("var")` will return `!if(val)`.
    var oldIf = hbs.helpers["if"];
    hbs.helpers["unless"] = function (context, options) {
      return oldIf.apply(this, [hbs.helpers.get(context, options), {
        fn: options.inverse,
        inverse: options.fn,
        hash: options.hash
      }]);
    };

    stringCompatHelper("if");
    stringCompatHelper("with");
  }
});
define("discourse-common/lib/raw-handlebars", ["exports"], function (exports) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.template = template;
  exports.precompile = precompile;
  exports.compile = compile;
  // This is a mechanism for quickly rendering templates which is Ember aware
  // templates are highly compatible with Ember so you don't need to worry about calling "get"
  // and discourseComputed properties function, additionally it uses stringParams like Ember does

  var RawHandlebars = Handlebars.create();

  function buildPath(blk, args) {
    var result = {
      type: "PathExpression",
      data: false,
      depth: blk.path.depth,
      loc: blk.path.loc
    };

    // Server side precompile doesn't have jquery.extend
    Object.keys(args).forEach(function (a) {
      result[a] = args[a];
    });

    return result;
  }

  function replaceGet(ast) {
    var visitor = new Handlebars.Visitor();
    visitor.mutating = true;

    visitor.MustacheStatement = function (mustache) {
      if (!(mustache.params.length || mustache.hash)) {
        mustache.params[0] = mustache.path;
        mustache.path = buildPath(mustache, {
          parts: ["get"],
          original: "get",
          strict: true,
          falsy: true
        });
      }
      return Handlebars.Visitor.prototype.MustacheStatement.call(this, mustache);
    };

    // rewrite `each x as |y|` as each y in x`
    // This allows us to use the same syntax in all templates
    visitor.BlockStatement = function (block) {
      if (block.path.original === "each" && block.params.length === 1) {
        var paramName = block.program.blockParams[0];
        block.params = [buildPath(block, { original: paramName }), { type: "CommentStatement", value: "in" }, block.params[0]];
        delete block.program.blockParams;
      }

      return Handlebars.Visitor.prototype.BlockStatement.call(this, block);
    };

    visitor.accept(ast);
  }

  if (Handlebars.Compiler) {
    RawHandlebars.Compiler = function () {};
    RawHandlebars.Compiler.prototype = Object.create(Handlebars.Compiler.prototype);
    RawHandlebars.Compiler.prototype.compiler = RawHandlebars.Compiler;

    RawHandlebars.JavaScriptCompiler = function () {};

    RawHandlebars.JavaScriptCompiler.prototype = Object.create(Handlebars.JavaScriptCompiler.prototype);
    RawHandlebars.JavaScriptCompiler.prototype.compiler = RawHandlebars.JavaScriptCompiler;
    RawHandlebars.JavaScriptCompiler.prototype.namespace = "RawHandlebars";

    RawHandlebars.precompile = function (value, asObject) {
      var ast = Handlebars.parse(value);
      replaceGet(ast);

      var options = {
        knownHelpers: {
          get: true
        },
        data: true,
        stringParams: true
      };

      asObject = asObject === undefined ? true : asObject;

      var environment = new RawHandlebars.Compiler().compile(ast, options);
      return new RawHandlebars.JavaScriptCompiler().compile(environment, options, undefined, asObject);
    };

    RawHandlebars.compile = function (string) {
      var ast = Handlebars.parse(string);
      replaceGet(ast);

      // this forces us to rewrite helpers
      var options = { data: true, stringParams: true };
      var environment = new RawHandlebars.Compiler().compile(ast, options);
      var templateSpec = new RawHandlebars.JavaScriptCompiler().compile(environment, options, undefined, true);

      var t = RawHandlebars.template(templateSpec);
      t.isMethod = false;

      return t;
    };
  }

  function template() {
    return RawHandlebars.template.apply(this, arguments);
  }

  function precompile() {
    return RawHandlebars.precompile.apply(this, arguments);
  }

  function compile() {
    return RawHandlebars.compile.apply(this, arguments);
  }

  exports.default = RawHandlebars;
});
define("discourse-common/mixins/focus-event", ["exports", "@ember/runloop", "discourse-common/lib/get-owner", "@ember/object/mixin"], function (exports, _runloop, _getOwner, _mixin) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = _mixin.default.create({
    ready: function ready() {
      this._super.apply(this, arguments);

      this._onChangeHandler = (0, _runloop.bind)(this, this._onChange);

      // Default to true
      Discourse.set("hasFocus", true);

      document.addEventListener("visibilitychange", this._onChangeHandler);
      document.addEventListener("resume", this._onChangeHandler);
      document.addEventListener("freeze", this._onChangeHandler);
    },
    reset: function reset() {
      this._super.apply(this, arguments);

      document.removeEventListener("visibilitychange", this._onChangeHandler);
      document.removeEventListener("resume", this._onChangeHandler);
      document.removeEventListener("freeze", this._onChangeHandler);

      this._onChangeHandler = null;
    },
    _onChange: function _onChange() {
      var container = (0, _getOwner.getOwner)(this);
      var appEvents = container.lookup("service:app-events");

      if (document.visibilityState === "hidden") {
        if (Discourse.hasFocus) {
          Discourse.set("hasFocus", false);
          appEvents.trigger("discourse:focus-changed", false);
        }
      } else {
        if (!Discourse.hasFocus) {
          Discourse.set("hasFocus", true);
          appEvents.trigger("discourse:focus-changed", true);
        }
      }
    }
  });
});
define("discourse-common/resolver", ["exports", "discourse-common/lib/helpers", "@ember/object", "discourse-common/lib/deprecated", "@ember/string"], function (exports, _helpers, _object, _deprecated, _string) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.setResolverOption = setResolverOption;
  exports.getResolverOption = getResolverOption;
  exports.buildResolver = buildResolver;


  var _options = {};

  function setResolverOption(name, value) {
    _options[name] = value;
  }

  function getResolverOption(name) {
    return _options[name];
  }

  function parseName(fullName) {
    var nameParts = fullName.split(":");
    var type = nameParts[0];
    var fullNameWithoutType = nameParts[1];
    var namespace = (0, _object.get)(this, "namespace");
    var root = namespace;

    return {
      fullName: fullName,
      type: type,
      fullNameWithoutType: fullNameWithoutType,
      name: fullNameWithoutType,
      root: root,
      resolveMethodName: "resolve" + (0, _string.classify)(type)
    };
  }

  function buildResolver(baseName) {
    return Ember.DefaultResolver.extend({
      parseName: parseName,

      resolveRouter: function resolveRouter(parsedName) {
        var routerPath = baseName + "/router";
        if (requirejs.entries[routerPath]) {
          var module = requirejs(routerPath, null, null, true);
          return module.default;
        }
        return this._super(parsedName);
      },
      normalize: function normalize(fullName) {
        if (fullName === "app-events:main") {
          (0, _deprecated.default)("`app-events:main` has been replaced with `service:app-events`", { since: "2.4.0" });
          return "service:app-events";
        }

        var split = fullName.split(":");
        if (split.length > 1) {
          var appBase = baseName + "/" + split[0] + "s/";
          var adminBase = "admin/" + split[0] + "s/";

          // Allow render 'admin/templates/xyz' too
          split[1] = split[1].replace(".templates", "").replace("/templates", "");

          // Try slashes
          var dashed = (0, _string.dasherize)(split[1].replace(/\./g, "/"));
          if (requirejs.entries[appBase + dashed] || requirejs.entries[adminBase + dashed]) {
            return split[0] + ":" + dashed;
          }

          // Try with dashes instead of slashes
          dashed = (0, _string.dasherize)(split[1].replace(/\./g, "-"));
          if (requirejs.entries[appBase + dashed] || requirejs.entries[adminBase + dashed]) {
            return split[0] + ":" + dashed;
          }
        }
        return this._super(fullName);
      },
      customResolve: function customResolve(parsedName) {
        // If we end with the name we want, use it. This allows us to define components within plugins.
        var suffix = parsedName.type + "s/" + parsedName.fullNameWithoutType,
            dashed = (0, _string.dasherize)(suffix),
            moduleName = Object.keys(requirejs.entries).find(function (e) {
          return e.indexOf(suffix, e.length - suffix.length) !== -1 || e.indexOf(dashed, e.length - dashed.length) !== -1;
        });

        var module;
        if (moduleName) {
          module = requirejs(moduleName, null, null, true /* force sync */);
          if (module && module["default"]) {
            module = module["default"];
          }
        }
        return module;
      },
      resolveWidget: function resolveWidget(parsedName) {
        return this.customResolve(parsedName) || this._super(parsedName);
      },
      resolveAdapter: function resolveAdapter(parsedName) {
        return this.customResolve(parsedName) || this._super(parsedName);
      },
      resolveModel: function resolveModel(parsedName) {
        return this.customResolve(parsedName) || this._super(parsedName);
      },
      resolveView: function resolveView(parsedName) {
        return this.customResolve(parsedName) || this._super(parsedName);
      },
      resolveHelper: function resolveHelper(parsedName) {
        return (0, _helpers.findHelper)(parsedName.fullNameWithoutType) || this.customResolve(parsedName) || this._super(parsedName);
      },
      resolveController: function resolveController(parsedName) {
        return this.customResolve(parsedName) || this._super(parsedName);
      },
      resolveComponent: function resolveComponent(parsedName) {
        return this.customResolve(parsedName) || this._super(parsedName);
      },
      resolveService: function resolveService(parsedName) {
        return this.customResolve(parsedName) || this._super(parsedName);
      },
      resolveRoute: function resolveRoute(parsedName) {
        if (parsedName.fullNameWithoutType === "basic") {
          return requirejs("discourse/routes/discourse", null, null, true).default;
        }

        return this.customResolve(parsedName) || this._super(parsedName);
      },
      findLoadingTemplate: function findLoadingTemplate(parsedName) {
        if (parsedName.fullNameWithoutType.match(/loading$/)) {
          return Ember.TEMPLATES.loading;
        }
      },
      findConnectorTemplate: function findConnectorTemplate(parsedName) {
        var full = parsedName.fullNameWithoutType.replace("components/", "");
        if (full.indexOf("connectors") === 0) {
          return Ember.TEMPLATES["javascripts/" + full];
        }
      },
      resolveTemplate: function resolveTemplate(parsedName) {
        return this.findPluginMobileTemplate(parsedName) || this.findPluginTemplate(parsedName) || this.findMobileTemplate(parsedName) || this.findTemplate(parsedName) || this.findLoadingTemplate(parsedName) || this.findConnectorTemplate(parsedName) || Ember.TEMPLATES.not_found;
      },
      findPluginTemplate: function findPluginTemplate(parsedName) {
        var pluginParsedName = this.parseName(parsedName.fullName.replace("template:", "template:javascripts/"));
        return this.findTemplate(pluginParsedName);
      },
      findPluginMobileTemplate: function findPluginMobileTemplate(parsedName) {
        if (_options.mobileView) {
          var pluginParsedName = this.parseName(parsedName.fullName.replace("template:", "template:javascripts/mobile/"));
          return this.findTemplate(pluginParsedName);
        }
      },
      findMobileTemplate: function findMobileTemplate(parsedName) {
        if (_options.mobileView) {
          var mobileParsedName = this.parseName(parsedName.fullName.replace("template:", "template:mobile/"));
          return this.findTemplate(mobileParsedName);
        }
      },
      findTemplate: function findTemplate(parsedName) {
        var withoutType = parsedName.fullNameWithoutType,
            slashedType = withoutType.replace(/\./g, "/"),
            decamelized = withoutType.decamelize(),
            dashed = decamelized.replace(/\./g, "-").replace(/\_/g, "-"),
            templates = Ember.TEMPLATES;

        return this._super(parsedName) || templates[slashedType] || templates[withoutType] || templates[withoutType.replace(/\.raw$/, "")] || templates[dashed] || templates[decamelized.replace(/\./, "/")] || templates[decamelized.replace(/\_/, "/")] || templates[baseName + "/templates/" + withoutType] || this.findAdminTemplate(parsedName) || this.findUnderscoredTemplate(parsedName);
      },
      findUnderscoredTemplate: function findUnderscoredTemplate(parsedName) {
        var decamelized = parsedName.fullNameWithoutType.decamelize();
        var underscored = decamelized.replace(/\-/g, "_");
        return Ember.TEMPLATES[underscored];
      },
      findAdminTemplate: function findAdminTemplate(parsedName) {
        var decamelized = parsedName.fullNameWithoutType.decamelize();
        if (decamelized.indexOf("components") === 0) {
          var comPath = "admin/templates/" + decamelized;
          var compTemplate = Ember.TEMPLATES["javascripts/" + comPath] || Ember.TEMPLATES[comPath];
          if (compTemplate) {
            return compTemplate;
          }
        }

        if (decamelized === "javascripts/admin") {
          return Ember.TEMPLATES["admin/templates/admin"];
        }

        if (decamelized.indexOf("admin") === 0 || decamelized.indexOf("javascripts/admin") === 0) {
          decamelized = decamelized.replace(/^admin\_/, "admin/templates/");
          decamelized = decamelized.replace(/^admin\./, "admin/templates/");
          decamelized = decamelized.replace(/\./g, "_");

          var dashed = decamelized.replace(/_/g, "-");
          return Ember.TEMPLATES[decamelized] || Ember.TEMPLATES[dashed] || Ember.TEMPLATES[dashed.replace("admin-", "admin/")];
        }
      }
    });
  }
});
define("discourse-common/utils/decorator-alias", ["exports", "discourse-common/utils/extract-value"], function (exports, _extractValue) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = decoratorAlias;
  function decoratorAlias(fn, errorMessage) {
    return function () {
      for (var _len = arguments.length, params = Array(_len), _key = 0; _key < _len; _key++) {
        params[_key] = arguments[_key];
      }

      // determine if user called as @discourseComputed('blah', 'blah') or @discourseComputed
      if (params.length === 0) {
        throw new Error(errorMessage);
      } else {
        return function (target, key, desc) {
          return {
            enumerable: desc.enumerable,
            configurable: desc.configurable,
            writable: desc.writable,
            initializer: function initializer() {
              var value = (0, _extractValue.default)(desc);
              return fn.apply(null, params.concat(value));
            }
          };
        };
      }
    };
  }
});
define("discourse-common/utils/extract-value", ["exports"], function (exports) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = extractValue;
  function extractValue(desc) {
    return desc.value || typeof desc.initializer === "function" && desc.initializer();
  }
});
define("discourse-common/utils/handle-descriptor", ["exports", "@ember/object", "./extract-value"], function (exports, _object, _extractValue) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = handleDescriptor;

  var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) {
    return typeof obj;
  } : function (obj) {
    return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
  };

  function handleDescriptor(target, key, desc) {
    var params = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : [];

    return {
      enumerable: desc.enumerable,
      configurable: desc.configurable,
      writeable: desc.writeable,
      initializer: function initializer() {
        var computedDescriptor = void 0;

        if (desc.writable) {
          var val = (0, _extractValue.default)(desc);
          if ((typeof val === "undefined" ? "undefined" : _typeof(val)) === "object") {
            var value = {};
            if (val.get) {
              value.get = callUserSuppliedGet(params, val.get);
            }
            if (val.set) {
              value.set = callUserSuppliedSet(params, val.set);
            }
            computedDescriptor = value;
          } else {
            computedDescriptor = callUserSuppliedGet(params, val);
          }
        } else {
          throw new Error("ember-computed-decorators does not support using getters and setters");
        }

        return _object.computed.apply(null, params.concat(computedDescriptor));
      }
    };
  }

  function niceAttr(attr) {
    var parts = attr.split(".");
    var i = void 0;

    for (i = 0; i < parts.length; i++) {
      if (parts[i] === "@each" || parts[i] === "[]" || parts[i].indexOf("{") !== -1) {
        break;
      }
    }

    return parts.slice(0, i).join(".");
  }

  function callUserSuppliedGet(params, func) {
    params = params.map(niceAttr);
    return function () {
      var _this = this;

      var paramValues = params.map(function (p) {
        return (0, _object.get)(_this, p);
      });

      return func.apply(this, paramValues);
    };
  }

  function callUserSuppliedSet(params, func) {
    params = params.map(niceAttr);
    return function (key, value) {
      var _this2 = this;

      var paramValues = params.map(function (p) {
        return (0, _object.get)(_this2, p);
      });
      paramValues.unshift(value);

      return func.apply(this, paramValues);
    };
  }
});
define("discourse-common/utils/is-descriptor", ["exports"], function (exports) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = isDescriptor;

  var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) {
    return typeof obj;
  } : function (obj) {
    return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
  };

  function isDescriptor(item) {
    return item && (typeof item === "undefined" ? "undefined" : _typeof(item)) === "object" && "writable" in item && "enumerable" in item && "configurable" in item;
  }
});
define("discourse-common/utils/macro-alias", ["exports", "discourse-common/utils/is-descriptor"], function (exports, _isDescriptor) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = macroAlias;

  function _toConsumableArray(arr) {
    if (Array.isArray(arr)) {
      for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) {
        arr2[i] = arr[i];
      }

      return arr2;
    } else {
      return Array.from(arr);
    }
  }

  function handleDescriptor(target, property, desc, fn) {
    var params = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : [];

    return {
      enumerable: desc.enumerable,
      configurable: desc.configurable,
      writable: desc.writable,
      initializer: function initializer() {
        return fn.apply(undefined, _toConsumableArray(params));
      }
    };
  }

  function macroAlias(fn) {
    return function () {
      for (var _len = arguments.length, params = Array(_len), _key = 0; _key < _len; _key++) {
        params[_key] = arguments[_key];
      }

      if ((0, _isDescriptor.default)(params[params.length - 1])) {
        return handleDescriptor.apply(undefined, params.concat([fn]));
      } else {
        return function (target, property, desc) {
          return handleDescriptor(target, property, desc, fn, params);
        };
      }
    };
  }
});
(function() {
  if (typeof I18n !== "undefined") {
    // Default format for storage units
    var oldI18ntoHumanSize = I18n.toHumanSize;
    I18n.toHumanSize = function(number, options) {
      options = options || {};
      options.format = I18n.t("number.human.storage_units.format");
      return oldI18ntoHumanSize.apply(this, [number, options]);
    };

    if ("w" in String.prototype) {
      String.prototype.i18n = function(options) {
        return I18n.t(String(this), options);
      };
    }
  }
})();
define("select-kit/components/admin-group-selector", ["exports", "select-kit/components/multi-select"], function (exports, _multiSelect) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = _multiSelect.default.extend({
    pluginApiIdentifiers: ["admin-group-selector"],
    classNames: ["admin-group-selector"],
    selectKitOptions: {
      allowAny: false
    }
  });
});
define("select-kit/components/categories-admin-dropdown", ["exports", "select-kit/components/dropdown-select-box", "@ember/object", "discourse/lib/computed"], function (exports, _dropdownSelectBox, _object, _computed) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = _dropdownSelectBox.default.extend({
    pluginApiIdentifiers: ["categories-admin-dropdown"],
    classNames: ["categories-admin-dropdown"],
    fixedCateoryPositions: (0, _computed.setting)("fixed_category_positions"),

    selectKitOptions: {
      icon: "bars",
      showFullTitle: false,
      autoFilterable: false,
      filterable: false
    },

    content: (0, _object.computed)(function () {
      var items = [{
        id: "create",
        name: I18n.t("category.create"),
        description: I18n.t("category.create_long"),
        icon: "plus"
      }];

      if (this.fixedCateoryPositions) {
        items.push({
          id: "reorder",
          name: I18n.t("categories.reorder.title"),
          description: I18n.t("categories.reorder.title_long"),
          icon: "random"
        });
      }

      return items;
    })
  });
});
define("select-kit/components/category-chooser", ["exports", "select-kit/components/combo-box", "discourse/models/permission-type", "discourse/models/category", "discourse/helpers/category-link", "@ember/object", "@ember/utils", "discourse/lib/computed"], function (exports, _comboBox, _permissionType, _category, _categoryLink, _object, _utils, _computed) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = _comboBox.default.extend({
    pluginApiIdentifiers: ["category-chooser"],
    classNames: ["category-chooser"],
    allowUncategorizedTopics: (0, _computed.setting)("allow_uncategorized_topics"),
    fixedCategoryPositionsOnCreate: (0, _computed.setting)("fixed_category_positions_on_create"),

    selectKitOptions: {
      filterable: true,
      allowUncategorized: false,
      allowSubCategories: true,
      permissionType: _permissionType.default.FULL,
      excludeCategoryId: null,
      scopedCategoryId: null
    },

    modifyComponentForRow: function modifyComponentForRow() {
      return "category-row";
    },
    modifyNoSelection: function modifyNoSelection() {
      if (!(0, _utils.isNone)(this.selectKit.options.none)) {
        var none = this.selectKit.options.none;
        var isString = typeof none === "string";
        return this.defaultItem(null, I18n.t(isString ? this.selectKit.options.none : "category.none").htmlSafe());
      } else if (this.allowUncategorizedTopics || this.selectKit.options.allowUncategorized) {
        return _category.default.findUncategorized();
      } else {
        return this.defaultItem(null, I18n.t("category.choose").htmlSafe());
      }
    },
    modifySelection: function modifySelection(content) {
      if (this.selectKit.hasSelection) {
        var category = _category.default.findById(this.value);

        (0, _object.set)(content, "label", (0, _categoryLink.categoryBadgeHTML)(category, {
          link: false,
          hideParent: category ? !!category.parent_category_id : true,
          allowUncategorized: true,
          recursive: true
        }).htmlSafe());
      }

      return content;
    },
    search: function search(filter) {
      var _this = this;

      if (filter) {
        return this.content.filter(function (item) {
          var category = _category.default.findById(_this.getValue(item));
          var categoryName = _this.getName(item);

          if (category && category.parentCategory) {
            var parentCategoryName = _this.getName(category.parentCategory);
            return _this._matchCategory(filter, categoryName) || _this._matchCategory(filter, parentCategoryName);
          } else {
            return _this._matchCategory(filter, categoryName);
          }
        });
      } else {
        return this.content;
      }
    },


    content: (0, _object.computed)("selectKit.filter", "selectKit.options.scopedCategoryId", function () {
      if (!this.selectKit.filter && this.selectKit.options.scopedCategoryId) {
        return this.categoriesByScope(this.selectKit.options.scopedCategoryId);
      } else {
        return this.categoriesByScope();
      }
    }),

    categoriesByScope: function categoriesByScope() {
      var _this2 = this;

      var scopedCategoryId = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;

      var categories = this.fixedCategoryPositionsOnCreate ? _category.default.list() : _category.default.listByActivity();

      if (scopedCategoryId) {
        var scopedCat = _category.default.findById(scopedCategoryId);
        scopedCategoryId = scopedCat.parent_category_id || scopedCat.id;
      }

      var excludeCategoryId = this.selectKit.options.excludeCategoryId;

      return categories.filter(function (category) {
        var categoryId = _this2.getValue(category);

        if (scopedCategoryId && categoryId !== scopedCategoryId && category.parent_category_id !== scopedCategoryId) {
          return false;
        }

        if (_this2.selectKit.options.allowSubCategories === false && category.parentCategory) {
          return false;
        }

        if (_this2.selectKit.options.allowUncategorized === false && category.isUncategorizedCategory || excludeCategoryId === categoryId) {
          return false;
        }

        var permissionType = _this2.selectKit.options.permissionType;
        if (permissionType) {
          return permissionType === category.permission;
        }

        return true;
      });
    },
    _matchCategory: function _matchCategory(filter, categoryName) {
      return this._normalize(categoryName).indexOf(filter) > -1;
    }
  });
});
define("select-kit/components/category-drop", ["exports", "@ember/object/computed", "@ember/object", "select-kit/components/combo-box", "discourse/lib/url", "discourse/models/category", "discourse/helpers/category-link"], function (exports, _computed, _object, _comboBox, _url, _category, _categoryLink) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.ALL_CATEGORIES_ID = exports.NO_CATEGORIES_ID = undefined;
  var NO_CATEGORIES_ID = exports.NO_CATEGORIES_ID = "no-categories";
  var ALL_CATEGORIES_ID = exports.ALL_CATEGORIES_ID = "all-categories";

  exports.default = _comboBox.default.extend({
    pluginApiIdentifiers: ["category-drop"],
    classNameBindings: ["categoryStyle"],
    classNames: ["category-drop"],
    value: (0, _computed.readOnly)("category.id"),
    content: (0, _computed.readOnly)("categoriesWithShortcuts.[]"),
    tagName: "li",
    categoryStyle: (0, _computed.readOnly)("siteSettings.category_style"),
    noCategoriesLabel: I18n.t("categories.no_subcategory"),

    selectKitOptions: {
      filterable: true,
      none: "category.all",
      caretDownIcon: "caret-right",
      caretUpIcon: "caret-down",
      fullWidthOnMobile: true,
      noSubcategories: false,
      subCategory: false,
      clearable: false,
      hideParentCategory: "hideParentCategory",
      countSubcategories: false,
      autoInsertNoneItem: false,
      displayCategoryDescription: "displayCategoryDescription",
      headerComponent: "category-drop/category-drop-header"
    },

    modifyComponentForRow: function modifyComponentForRow() {
      return "category-row";
    },


    displayCategoryDescription: (0, _object.computed)(function () {
      return !(this.get("currentUser.staff") || this.get("currentUser.trust_level") > 0);
    }),

    hideParentCategory: (0, _object.computed)(function () {
      return this.options.subCategory || false;
    }),

    categoriesWithShortcuts: (0, _object.computed)("categories.[]", "value", "selectKit.options.{subCategory,noSubcategories}", function () {
      var shortcuts = [];

      if (this.value || this.selectKit.options.noSubcategories && this.selectKit.options.subCategory) {
        shortcuts.push({
          id: ALL_CATEGORIES_ID,
          name: this.allCategoriesLabel
        });
      }

      if (this.selectKit.options.subCategory && (this.value || !this.selectKit.options.noSubcategories)) {
        shortcuts.push({
          id: NO_CATEGORIES_ID,
          name: this.noCategoriesLabel
        });
      }

      var results = this._filterUncategorized(this.categories || []);
      return shortcuts.concat(results);
    }),

    modifyNoSelection: function modifyNoSelection() {
      if (this.selectKit.options.noSubcategories) {
        return this.defaultItem(NO_CATEGORIES_ID, this.noCategoriesLabel);
      } else {
        return this.defaultItem(ALL_CATEGORIES_ID, this.allCategoriesLabel);
      }
    },
    modifySelection: function modifySelection(content) {
      if (this.value) {
        var category = _category.default.findById(this.value);
        content.title = category.title;
        content.label = (0, _categoryLink.categoryBadgeHTML)(category, {
          link: false,
          allowUncategorized: true,
          hideParent: true
        }).htmlSafe();
      }

      return content;
    },


    parentCategoryName: (0, _computed.readOnly)("selectKit.options.parentCategory.name"),

    parentCategoryUrl: (0, _computed.readOnly)("selectKit.options.parentCategory.url"),

    allCategoriesLabel: (0, _object.computed)("parentCategoryName", "selectKit.options.subCategory", function () {
      if (this.selectKit.options.subCategory) {
        return I18n.t("categories.all_subcategories", {
          categoryName: this.parentCategoryName
        });
      }

      return I18n.t("categories.all");
    }),

    allCategoriesUrl: (0, _object.computed)("parentCategoryUrl", "selectKit.options.subCategory", function () {
      return Discourse.getURL(this.selectKit.options.subCategory ? this.parentCategoryUrl || "/" : "/");
    }),

    noCategoriesUrl: (0, _object.computed)("parentCategoryUrl", function () {
      return Discourse.getURL(this.parentCategoryUrl + "/none");
    }),

    search: function search(filter) {
      if (filter) {
        var results = Discourse.Category.search(filter);
        results = this._filterUncategorized(results).sort(function (a, b) {
          if (a.parent_category_id && !b.parent_category_id) {
            return 1;
          } else if (!a.parent_category_id && b.parent_category_id) {
            return -1;
          } else {
            return 0;
          }
        });
        return results;
      } else {
        return this._filterUncategorized(this.content);
      }
    },


    actions: {
      onChange: function onChange(categoryId) {
        var categoryURL = void 0;

        if (categoryId === ALL_CATEGORIES_ID) {
          categoryURL = this.allCategoriesUrl;
        } else if (categoryId === NO_CATEGORIES_ID) {
          categoryURL = this.noCategoriesUrl;
        } else {
          var category = _category.default.findById(parseInt(categoryId, 10));
          categoryURL = category.url;
        }

        _url.default.routeToUrl(categoryURL);

        return false;
      }
    },

    _filterUncategorized: function _filterUncategorized(content) {
      var _this = this;

      if (!this.siteSettings.allow_uncategorized_topics) {
        content = content.filter(function (c) {
          return c.id !== _this.site.uncategorized_category_id;
        });
      }

      return content;
    }
  });
});
define("select-kit/components/category-drop/category-drop-header", ["exports", "@ember/object/computed", "@ember/runloop", "select-kit/components/combo-box/combo-box-header", "discourse-common/utils/decorators"], function (exports, _computed, _runloop, _comboBoxHeader, _decorators) {
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

  var _dec, _dec2, _dec3, _desc, _value, _obj;

  exports.default = _comboBoxHeader.default.extend((_dec = (0, _decorators.default)("selectedContent.color"), _dec2 = (0, _decorators.default)("selectedContent.text_color"), _dec3 = (0, _decorators.default)("selectedContent", "categoryBackgroundColor", "categoryTextColor"), (_obj = {
    layoutName: "select-kit/templates/components/category-drop/category-drop-header",
    classNames: ["category-drop-header"],
    classNameBindings: ["categoryStyleClass"],
    categoryStyleClass: (0, _computed.readOnly)("site.category_style"),

    categoryBackgroundColor: function categoryBackgroundColor(categoryColor) {
      return categoryColor || "#e9e9e9";
    },
    categoryTextColor: function categoryTextColor(_categoryTextColor) {
      return _categoryTextColor || "#333";
    },
    categoryStyle: function categoryStyle(category, categoryBackgroundColor, categoryTextColor) {
      var categoryStyle = this.siteSettings.category_style;

      if (categoryStyle === "bullet") return;

      if (category) {
        if (categoryBackgroundColor || categoryTextColor) {
          var style = "";
          if (categoryBackgroundColor) {
            if (categoryStyle === "box") {
              style += "border-color: #" + categoryBackgroundColor + "; background-color: #" + categoryBackgroundColor + ";";
              if (categoryTextColor) {
                style += "color: #" + categoryTextColor + ";";
              }
            }
          }
          return style.htmlSafe();
        }
      }
    },
    didInsertElement: function didInsertElement() {
      var _this = this;

      this._super.apply(this, arguments);

      (0, _runloop.schedule)("afterRender", function () {
        if (_this.categoryStyle) {
          _this.element.setAttribute("style", _this.categoryStyle);
          _this.element.querySelector(".caret-icon").setAttribute("style", _this.categoryStyle);
        }
      });
    }
  }, (_applyDecoratedDescriptor(_obj, "categoryBackgroundColor", [_dec], Object.getOwnPropertyDescriptor(_obj, "categoryBackgroundColor"), _obj), _applyDecoratedDescriptor(_obj, "categoryTextColor", [_dec2], Object.getOwnPropertyDescriptor(_obj, "categoryTextColor"), _obj), _applyDecoratedDescriptor(_obj, "categoryStyle", [_dec3], Object.getOwnPropertyDescriptor(_obj, "categoryStyle"), _obj)), _obj)));
});
define("select-kit/components/category-notifications-button", ["exports", "@ember/object/computed", "select-kit/components/notifications-button"], function (exports, _computed, _notificationsButton) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = _notificationsButton.default.extend({
    pluginApiIdentifiers: ["category-notifications-button"],
    classNames: ["category-notifications-button"],
    isHidden: (0, _computed.or)("category.deleted"),

    selectKitOptions: {
      i18nPrefix: "i18nPrefix",
      showFullTitle: false
    },

    i18nPrefix: "category.notifications"
  });
});
define("select-kit/components/category-row", ["exports", "@ember/object/computed", "select-kit/components/select-kit/select-kit-row", "discourse/models/category", "discourse/helpers/category-link", "@ember/utils", "@ember/object", "discourse/lib/computed"], function (exports, _computed, _selectKitRow, _category, _categoryLink, _utils, _object, _computed2) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = _selectKitRow.default.extend({
    layoutName: "select-kit/templates/components/category-row",
    classNames: ["category-row"],
    hideParentCategory: (0, _computed.bool)("selectKit.options.hideParentCategory"),
    allowUncategorized: (0, _computed.bool)("selectKit.options.allowUncategorized"),
    categoryLink: (0, _computed.bool)("selectKit.options.categoryLink"),
    countSubcategories: (0, _computed.bool)("selectKit.options.countSubcategories"),
    allowUncategorizedTopics: (0, _computed2.setting)("allow_uncategorized_topics"),

    displayCategoryDescription: (0, _object.computed)("selectKit.options.displayCategoryDescription", function () {
      var option = this.selectKit.options.displayCategoryDescription;
      if ((0, _utils.isNone)(option)) {
        return true;
      }

      return option;
    }),

    title: (0, _object.computed)("descriptionText", "description", "categoryName", function () {
      return this.descriptionText || this.description || this.categoryName;
    }),

    categoryName: (0, _computed.reads)("category.name"),

    categoryDescription: (0, _computed.reads)("category.description"),

    categoryDescriptionText: (0, _computed.reads)("category.description_text"),

    category: (0, _object.computed)("rowValue", "rowName", function () {
      if ((0, _utils.isEmpty)(this.rowValue)) {
        var uncat = _category.default.findUncategorized();
        if (uncat && uncat.name === this.rowName) {
          return uncat;
        }
      } else {
        return _category.default.findById(parseInt(this.rowValue, 10));
      }
    }),

    badgeForCategory: (0, _object.computed)("category", "parentCategory", function () {
      return (0, _categoryLink.categoryBadgeHTML)(this.category, {
        link: this.categoryLink,
        allowUncategorized: this.allowUncategorizedTopics || this.allowUncategorized,
        hideParent: !!this.parentCategory,
        topicCount: this.topicCount
      }).htmlSafe();
    }),

    badgeForParentCategory: (0, _object.computed)("parentCategory", function () {
      return (0, _categoryLink.categoryBadgeHTML)(this.parentCategory, {
        link: this.categoryLink,
        allowUncategorized: this.allowUncategorizedTopics || this.allowUncategorized,
        recursive: true
      }).htmlSafe();
    }),

    parentCategory: (0, _object.computed)("parentCategoryId", function () {
      return _category.default.findById(this.parentCategoryId);
    }),

    hasParentCategory: (0, _computed.bool)("parentCategoryId"),

    parentCategoryId: (0, _computed.reads)("category.parent_category_id"),

    categoryTotalTopicCount: (0, _computed.reads)("category.totalTopicCount"),

    categoryTopicCount: (0, _computed.reads)("category.topic_count"),

    topicCount: (0, _object.computed)("categoryTotalTopicCount", "categoryTopicCount", "countSubcategories", function () {
      return this.countSubcategories ? this.categoryTotalTopicCount : this.categoryTopicCount;
    }),

    shouldDisplayDescription: (0, _object.computed)("displayCategoryDescription", "categoryDescription", function () {
      return this.displayCategoryDescription && this.categoryDescription && this.categoryDescription !== "null";
    }),

    descriptionText: (0, _object.computed)("categoryDescriptionText", function () {
      if (this.categoryDescriptionText) {
        return this._formatDescription(this.categoryDescriptionText);
      }
    }),

    description: (0, _object.computed)("categoryDescription", function () {
      if (this.categoryDescription) {
        return this._formatDescription(this.categoryDescription);
      }
    }),

    _formatDescription: function _formatDescription(description) {
      var limit = 200;
      return "" + description.substr(0, limit) + (description.length > limit ? "&hellip;" : "");
    }
  });
});
define("select-kit/components/category-selector", ["exports", "@ember/object", "@ember/object/computed", "discourse-common/lib/helpers", "select-kit/components/multi-select", "discourse/models/category"], function (exports, _object, _computed, _helpers, _multiSelect, _category) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = _multiSelect.default.extend({
    pluginApiIdentifiers: ["category-selector"],
    classNames: ["category-selector"],
    categories: null,
    blacklist: null,

    selectKitOptions: {
      filterable: true,
      allowAny: false,
      allowUncategorized: "allowUncategorized",
      displayCategoryDescription: false,
      selectedNameComponent: "multi-select/selected-category"
    },

    init: function init() {
      this._super.apply(this, arguments);

      if (!this.categories) this.set("categories", []);
      if (!this.blacklist) this.set("blacklist", []);
    },


    content: (0, _object.computed)("categories.[]", "blacklist.[]", function () {
      var _this = this;

      var blacklist = (0, _helpers.makeArray)(this.blacklist);
      return _category.default.list().filter(function (category) {
        return _this.categories.includes(category) || !blacklist.includes(category);
      });
    }),

    value: (0, _computed.mapBy)("categories", "id"),

    filterComputedContent: function filterComputedContent(computedContent, filter) {
      var _this2 = this;

      var regex = new RegExp(filter, "i");
      return computedContent.filter(function (category) {
        return _this2._normalize((0, _object.get)(category, "name")).match(regex);
      });
    },


    actions: {
      onChange: function onChange(values) {
        this.attrs.onChange(values.map(function (v) {
          return _category.default.findById(v);
        }).filter(Boolean));
        return false;
      }
    }
  });
});
define("select-kit/components/color-palettes", ["exports", "select-kit/components/combo-box"], function (exports, _comboBox) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = _comboBox.default.extend({
    pluginApiIdentifiers: ["color-palettes"],
    classNames: ["color-palettes"],

    modifyComponentForRow: function modifyComponentForRow() {
      return "color-palettes/color-palettes-row";
    }
  });
});
define("select-kit/components/color-palettes/color-palettes-row", ["exports", "discourse/lib/utilities", "select-kit/components/select-kit/select-kit-row", "@ember/object"], function (exports, _utilities, _selectKitRow, _object) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = _selectKitRow.default.extend({
    classNames: ["color-palettes-row"],

    layoutName: "select-kit/templates/components/color-palettes/color-palettes-row",

    palettes: (0, _object.computed)("item.colors.[]", function () {
      return (this.item.colors || []).map(function (color) {
        return "#" + (0, _utilities.escapeExpression)(color.hex);
      }).map(function (hex) {
        return "<span class=\"palette\" style=\"background-color:" + hex + "\"></span>";
      }).join("").htmlSafe();
    })
  });
});
define("select-kit/components/combo-box", ["exports", "select-kit/components/single-select", "@ember/object"], function (exports, _singleSelect, _object) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = _singleSelect.default.extend({
    pluginApiIdentifiers: ["combo-box"],
    classNames: ["combobox", "combo-box"],

    selectKitOptions: {
      caretUpIcon: "caret-up",
      caretDownIcon: "caret-down",
      autoFilterable: "autoFilterable",
      clearable: false,
      headerComponent: "combo-box/combo-box-header"
    },

    autoFilterable: _object.computed.gte("content.length", 10)
  });
});
define("select-kit/components/combo-box/combo-box-header", ["exports", "@ember/object/computed", "select-kit/components/select-kit/single-select-header", "@ember/object"], function (exports, _computed, _singleSelectHeader, _object) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = _singleSelectHeader.default.extend({
    layoutName: "select-kit/templates/components/combo-box/combo-box-header",
    classNames: ["combo-box-header"],
    clearable: (0, _computed.reads)("selectKit.options.clearable"),
    caretUpIcon: (0, _computed.reads)("selectKit.options.caretUpIcon"),
    caretDownIcon: (0, _computed.reads)("selectKit.options.caretDownIcon"),
    shouldDisplayClearableButton: (0, _computed.and)("clearable", "value"),

    caretIcon: (0, _object.computed)("selectKit.isExpanded", "caretUpIcon", "caretDownIcon", function () {
      return this.selectKit.isExpanded ? this.caretUpIcon : this.caretDownIcon;
    })
  });
});
define("select-kit/components/composer-actions", ["exports", "select-kit/components/dropdown-select-box", "discourse/models/composer", "discourse/models/draft", "@ember/object", "@ember/string", "@ember/utils"], function (exports, _dropdownSelectBox, _composer, _draft, _object, _string, _utils) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports._clearSnapshots = _clearSnapshots;


  // Component can get destroyed and lose state
  var _topicSnapshot = null;
  var _postSnapshot = null;

  function _clearSnapshots() {
    _topicSnapshot = null;
    _postSnapshot = null;
  }

  exports.default = _dropdownSelectBox.default.extend({
    seq: 0,
    pluginApiIdentifiers: ["composer-actions"],
    classNames: ["composer-actions"],

    selectKitOptions: {
      icon: "share",
      filterable: false,
      showFullTitle: false
    },

    contentChanged: function contentChanged() {
      this.set("seq", this.seq + 1);
    },
    didReceiveAttrs: function didReceiveAttrs() {
      this._super.apply(this, arguments);

      // if we change topic we want to change both snapshots
      if (this.topic && (!_topicSnapshot || this.topic.id !== _topicSnapshot.id)) {
        _topicSnapshot = this.topic;
        _postSnapshot = this.post;
        this.contentChanged();
      }

      // if we hit reply on a different post we want to change postSnapshot
      if (this.post && (!_postSnapshot || this.post.id !== _postSnapshot.id)) {
        _postSnapshot = this.post;
        this.contentChanged();
      }

      if ((0, _utils.isEmpty)(this.content)) {
        this.set("selectKit.isHidden", true);
      }
    },
    modifySelection: function modifySelection() {
      return {};
    },


    content: (0, _object.computed)("seq", function () {
      var items = [];

      if (this.action !== _composer.CREATE_TOPIC && this.action !== _composer.CREATE_SHARED_DRAFT && _topicSnapshot) {
        items.push({
          name: I18n.t("composer.composer_actions.reply_as_new_topic.label"),
          description: I18n.t("composer.composer_actions.reply_as_new_topic.desc"),
          icon: "plus",
          id: "reply_as_new_topic"
        });
      }

      if (this.action !== _composer.REPLY && _postSnapshot || this.action === _composer.REPLY && _postSnapshot && !(this.replyOptions.userAvatar && this.replyOptions.userLink)) {
        items.push({
          name: I18n.t("composer.composer_actions.reply_to_post.label", {
            postNumber: _postSnapshot.post_number,
            postUsername: _postSnapshot.username
          }),
          description: I18n.t("composer.composer_actions.reply_to_post.desc"),
          icon: "share",
          id: "reply_to_post"
        });
      }

      if (this.siteSettings.enable_personal_messages && this.action !== _composer.PRIVATE_MESSAGE) {
        items.push({
          name: I18n.t("composer.composer_actions.reply_as_private_message.label"),
          description: I18n.t("composer.composer_actions.reply_as_private_message.desc"),
          icon: "envelope",
          id: "reply_as_private_message"
        });
      }

      if (this.action !== _composer.REPLY && _topicSnapshot || this.action === _composer.REPLY && _topicSnapshot && this.replyOptions.userAvatar && this.replyOptions.userLink && this.replyOptions.topicLink) {
        items.push({
          name: I18n.t("composer.composer_actions.reply_to_topic.label"),
          description: I18n.t("composer.composer_actions.reply_to_topic.desc"),
          icon: "share",
          id: "reply_to_topic"
        });
      }

      // if answered post is a whisper, we can only answer with a whisper so no need for toggle
      if (this.canWhisper && (!_postSnapshot || _postSnapshot && _postSnapshot.post_type !== this.site.post_types.whisper)) {
        items.push({
          name: I18n.t("composer.composer_actions.toggle_whisper.label"),
          description: I18n.t("composer.composer_actions.toggle_whisper.desc"),
          icon: "far-eye-slash",
          id: "toggle_whisper"
        });
      }

      var showCreateTopic = false;
      if (this.action === _composer.CREATE_SHARED_DRAFT) {
        showCreateTopic = true;
      }

      if (this.action === _composer.CREATE_TOPIC) {
        if (this.site.shared_drafts_category_id) {
          // Shared Drafts Choice
          items.push({
            name: I18n.t("composer.composer_actions.shared_draft.label"),
            description: I18n.t("composer.composer_actions.shared_draft.desc"),
            icon: "far-clipboard",
            id: "shared_draft"
          });
        }

        // Edge case: If personal messages are disabled, it is possible to have
        // no items which stil renders a button that pops up nothing. In this
        // case, add an option for what you're currently doing.
        if (items.length === 0) {
          showCreateTopic = true;
        }
      }

      if (showCreateTopic) {
        items.push({
          name: I18n.t("composer.composer_actions.create_topic.label"),
          description: I18n.t("composer.composer_actions.reply_as_new_topic.desc"),
          icon: "share",
          id: "create_topic"
        });
      }

      var showToggleTopicBump = this.get("currentUser.staff") || this.get("currentUser.trust_level") === 4;

      if (this.action === _composer.REPLY && showToggleTopicBump) {
        items.push({
          name: I18n.t("composer.composer_actions.toggle_topic_bump.label"),
          description: I18n.t("composer.composer_actions.toggle_topic_bump.desc"),
          icon: "anchor",
          id: "toggle_topic_bump"
        });
      }

      return items;
    }),

    _replyFromExisting: function _replyFromExisting(options, post, topic) {
      this.closeComposer();
      this.openComposer(options, post, topic);
    },
    _openComposer: function _openComposer(options) {
      this.closeComposer();
      this.openComposer(options);
    },
    toggleWhisperSelected: function toggleWhisperSelected(options, model) {
      model.toggleProperty("whisper");
    },
    toggleTopicBumpSelected: function toggleTopicBumpSelected(options, model) {
      model.toggleProperty("noBump");
    },
    replyToTopicSelected: function replyToTopicSelected(options) {
      options.action = _composer.REPLY;
      options.topic = _topicSnapshot;
      options.skipDraftCheck = true;
      this._openComposer(options);
    },
    replyToPostSelected: function replyToPostSelected(options) {
      options.action = _composer.REPLY;
      options.post = _postSnapshot;
      options.skipDraftCheck = true;
      this._openComposer(options);
    },
    replyAsNewTopicSelected: function replyAsNewTopicSelected(options) {
      var _this = this;

      _draft.default.get("new_topic").then(function (response) {
        if (response.draft) {
          bootbox.confirm(I18n.t("composer.composer_actions.reply_as_new_topic.confirm"), function (result) {
            if (result) _this._replyAsNewTopicSelect(options);
          });
        } else {
          _this._replyAsNewTopicSelect(options);
        }
      });
    },
    _replyAsNewTopicSelect: function _replyAsNewTopicSelect(options) {
      options.action = _composer.CREATE_TOPIC;
      options.categoryId = this.get("composerModel.topic.category.id");
      options.disableScopedCategory = true;
      options.skipDraftCheck = true;
      this._replyFromExisting(options, _postSnapshot, _topicSnapshot);
    },
    replyAsPrivateMessageSelected: function replyAsPrivateMessageSelected(options) {
      var usernames = void 0;

      if (_postSnapshot && !_postSnapshot.get("yours")) {
        var postUsername = _postSnapshot.get("username");
        if (postUsername) {
          usernames = postUsername;
        }
      } else if (this.get("composerModel.topic")) {
        var stream = this.get("composerModel.topic.postStream");

        if (stream.get("firstPostPresent")) {
          var post = stream.get("posts.firstObject");
          if (post && !post.get("yours") && post.get("username")) {
            usernames = post.get("username");
          }
        }
      }

      options.action = _composer.PRIVATE_MESSAGE;
      options.usernames = usernames;
      options.archetypeId = "private_message";
      options.skipDraftCheck = true;

      this._replyFromExisting(options, _postSnapshot, _topicSnapshot);
    },
    _switchCreate: function _switchCreate(options, action) {
      options.action = action;
      options.categoryId = this.get("composerModel.categoryId");
      options.topicTitle = this.get("composerModel.title");
      options.tags = this.get("composerModel.tags");
      options.skipDraftCheck = true;
      this._openComposer(options);
    },
    createTopicSelected: function createTopicSelected(options) {
      this._switchCreate(options, _composer.CREATE_TOPIC);
    },
    sharedDraftSelected: function sharedDraftSelected(options) {
      this._switchCreate(options, _composer.CREATE_SHARED_DRAFT);
    },


    actions: {
      onChange: function onChange(value) {
        var action = (0, _string.camelize)(value) + "Selected";
        if (this[action]) {
          this[action](this.composerModel.getProperties("draftKey", "draftSequence", "reply", "disableScopedCategory"), this.composerModel);
          this.contentChanged();
        } else {
          // eslint-disable-next-line no-console
          console.error("No method '" + action + "' found");
        }
      }
    }
  });
});
define("select-kit/components/create-color-row", ["exports", "select-kit/components/select-kit/select-kit-row", "discourse/lib/utilities", "@ember/runloop"], function (exports, _selectKitRow, _utilities, _runloop) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = _selectKitRow.default.extend({
    layoutName: "select-kit/templates/components/create-color-row",
    classNames: ["create-color-row"],

    didReceiveAttrs: function didReceiveAttrs() {
      var _this = this;

      this._super.apply(this, arguments);

      (0, _runloop.schedule)("afterRender", function () {
        var color = (0, _utilities.escapeExpression)(_this.rowValue);
        _this.element.style.borderLeftColor = "#" + color;
      });
    }
  });
});
define("select-kit/components/dropdown-select-box", ["exports", "select-kit/components/single-select"], function (exports, _singleSelect) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = _singleSelect.default.extend({
    pluginApiIdentifiers: ["dropdown-select-box"],
    classNames: ["dropdown-select-box"],

    selectKitOptions: {
      autoFilterable: false,
      filterable: false,
      showFullTitle: true,
      headerComponent: "dropdown-select-box/dropdown-select-box-header"
    },

    modifyComponentForRow: function modifyComponentForRow() {
      return "dropdown-select-box/dropdown-select-box-row";
    }
  });
});
define("select-kit/components/dropdown-select-box/dropdown-select-box-header", ["exports", "select-kit/components/select-kit/single-select-header", "@ember/object", "@ember/object/computed"], function (exports, _singleSelectHeader, _object, _computed) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = _singleSelectHeader.default.extend({
    layoutName: "select-kit/templates/components/dropdown-select-box/dropdown-select-box-header",
    classNames: ["btn-default", "dropdown-select-box-header"],
    tagName: "button",
    classNameBindings: ["btnClassName"],
    showFullTitle: (0, _computed.readOnly)("selectKit.options.showFullTitle"),
    attributeBindings: ["buttonType:type"],
    buttonType: "button",

    btnClassName: (0, _object.computed)("showFullTitle", function () {
      return "btn " + (this.showFullTitle ? "btn-icon-text" : "no-text btn-icon");
    })
  });
});
define("select-kit/components/dropdown-select-box/dropdown-select-box-row", ["exports", "@ember/object/computed", "select-kit/components/select-kit/select-kit-row"], function (exports, _computed, _selectKitRow) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = _selectKitRow.default.extend({
    layoutName: "select-kit/templates/components/dropdown-select-box/dropdown-select-box-row",
    classNames: ["dropdown-select-box-row"],

    description: (0, _computed.readOnly)("item.description")
  });
});
define("select-kit/components/future-date-input-selector", ["exports", "@ember/object", "@ember/object/computed", "@ember/utils", "select-kit/components/combo-box", "discourse/controllers/edit-topic-timer", "select-kit/components/future-date-input-selector/mixin"], function (exports, _object, _computed, _utils, _comboBox, _editTopicTimer, _mixin) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.FORMAT = exports.TIMEFRAMES = undefined;
  exports.timeframeDetails = timeframeDetails;


  var TIMEFRAME_BASE = {
    enabled: function enabled() {
      return true;
    },
    when: function when() {
      return null;
    },
    icon: "briefcase",
    displayWhen: true
  };

  function buildTimeframe(opts) {
    return jQuery.extend({}, TIMEFRAME_BASE, opts);
  }

  var TIMEFRAMES = exports.TIMEFRAMES = [buildTimeframe({
    id: "later_today",
    format: "h a",
    enabled: function enabled(opts) {
      return opts.canScheduleToday;
    },
    when: function when(time) {
      return time.hour(18).minute(0);
    },
    icon: "far-moon"
  }), buildTimeframe({
    id: "tomorrow",
    format: "ddd, h a",
    when: function when(time, timeOfDay) {
      return time.add(1, "day").hour(timeOfDay).minute(0);
    },
    icon: "far-sun"
  }), buildTimeframe({
    id: "later_this_week",
    format: "ddd, h a",
    enabled: function enabled(opts) {
      return !opts.canScheduleToday && opts.day < 4;
    },
    when: function when(time, timeOfDay) {
      return time.add(2, "day").hour(timeOfDay).minute(0);
    }
  }), buildTimeframe({
    id: "this_weekend",
    format: "ddd, h a",
    enabled: function enabled(opts) {
      return opts.day < 5 && opts.includeWeekend;
    },
    when: function when(time, timeOfDay) {
      return time.day(6).hour(timeOfDay).minute(0);
    },
    icon: "bed"
  }), buildTimeframe({
    id: "next_week",
    format: "ddd, h a",
    enabled: function enabled(opts) {
      return opts.day !== 7;
    },
    when: function when(time, timeOfDay) {
      return time.add(1, "week").day(1).hour(timeOfDay).minute(0);
    },
    icon: "briefcase"
  }), buildTimeframe({
    id: "two_weeks",
    format: "MMM D",
    when: function when(time, timeOfDay) {
      return time.add(2, "week").hour(timeOfDay).minute(0);
    },
    icon: "briefcase"
  }), buildTimeframe({
    id: "next_month",
    format: "MMM D",
    enabled: function enabled(opts) {
      return opts.now.date() !== moment().endOf("month").date();
    },
    when: function when(time, timeOfDay) {
      return time.add(1, "month").startOf("month").hour(timeOfDay).minute(0);
    },
    icon: "briefcase"
  }), buildTimeframe({
    id: "two_months",
    format: "MMM D",
    enabled: function enabled(opts) {
      return opts.includeMidFuture;
    },
    when: function when(time, timeOfDay) {
      return time.add(2, "month").startOf("month").hour(timeOfDay).minute(0);
    },
    icon: "briefcase"
  }), buildTimeframe({
    id: "three_months",
    format: "MMM D",
    enabled: function enabled(opts) {
      return opts.includeMidFuture;
    },
    when: function when(time, timeOfDay) {
      return time.add(3, "month").startOf("month").hour(timeOfDay).minute(0);
    },
    icon: "briefcase"
  }), buildTimeframe({
    id: "four_months",
    format: "MMM D",
    enabled: function enabled(opts) {
      return opts.includeMidFuture;
    },
    when: function when(time, timeOfDay) {
      return time.add(4, "month").startOf("month").hour(timeOfDay).minute(0);
    },
    icon: "briefcase"
  }), buildTimeframe({
    id: "six_months",
    format: "MMM D",
    enabled: function enabled(opts) {
      return opts.includeMidFuture;
    },
    when: function when(time, timeOfDay) {
      return time.add(6, "month").startOf("month").hour(timeOfDay).minute(0);
    },
    icon: "briefcase"
  }), buildTimeframe({
    id: "one_year",
    format: "MMM D",
    enabled: function enabled(opts) {
      return opts.includeFarFuture;
    },
    when: function when(time, timeOfDay) {
      return time.add(1, "year").startOf("day").hour(timeOfDay).minute(0);
    },
    icon: "briefcase"
  }), buildTimeframe({
    id: "forever",
    enabled: function enabled(opts) {
      return opts.includeFarFuture;
    },
    when: function when(time, timeOfDay) {
      return time.add(1000, "year").hour(timeOfDay).minute(0);
    },
    icon: "gavel",
    displayWhen: false
  }), buildTimeframe({
    id: "pick_date_and_time",
    enabled: function enabled(opts) {
      return opts.includeDateTime;
    },
    icon: "far-calendar-plus"
  }), buildTimeframe({
    id: "set_based_on_last_post",
    enabled: function enabled(opts) {
      return opts.includeBasedOnLastPost;
    },
    icon: "far-clock"
  })];

  var _timeframeById = null;
  function timeframeDetails(id) {
    if (!_timeframeById) {
      _timeframeById = {};
      TIMEFRAMES.forEach(function (t) {
        return _timeframeById[t.id] = t;
      });
    }
    return _timeframeById[id];
  }

  var FORMAT = exports.FORMAT = "YYYY-MM-DD HH:mmZ";

  exports.default = _comboBox.default.extend(_mixin.default, {
    pluginApiIdentifiers: ["future-date-input-selector"],
    classNames: ["future-date-input-selector"],
    isCustom: (0, _computed.equal)("value", "pick_date_and_time"),
    isBasedOnLastPost: (0, _computed.equal)("value", "set_based_on_last_post"),

    selectKitOptions: {
      autoInsertNoneItem: false,
      headerComponent: "future-date-input-selector/future-date-input-selector-header"
    },

    modifyComponentForRow: function modifyComponentForRow() {
      return "future-date-input-selector/future-date-input-selector-row";
    },


    content: (0, _object.computed)("statusType", function () {
      var _this = this;

      var now = moment();
      var opts = {
        now: now,
        day: now.day(),
        includeWeekend: this.includeWeekend,
        includeMidFuture: this.includeMidFuture || true,
        includeFarFuture: this.includeFarFuture,
        includeDateTime: this.includeDateTime,
        includeBasedOnLastPost: this.statusType === _editTopicTimer.CLOSE_STATUS_TYPE,
        canScheduleToday: 24 - now.hour() > 6
      };

      return TIMEFRAMES.filter(function (tf) {
        return tf.enabled(opts);
      }).map(function (tf) {
        return {
          id: tf.id,
          name: I18n.t("topic.auto_update_input." + tf.id),
          datetime: _this._computeDatetimeForValue(tf.id),
          icons: _this._computeIconsForValue(tf.id)
        };
      });
    }),

    actions: {
      onChange: function onChange(value) {
        if (value !== "pick_date_and_time" || !this.isBasedOnLastPost) {
          var _updateAt = this._updateAt(value),
              time = _updateAt.time;

          if (time && !(0, _utils.isEmpty)(value)) {
            this.attrs.onChangeInput && this.attrs.onChangeInput(time.locale("en").format(FORMAT));
          }
        }

        this.attrs.onChange && this.attrs.onChange(value);
      }
    }
  });
});
define("select-kit/components/future-date-input-selector/future-date-input-selector-header", ["exports", "select-kit/components/combo-box/combo-box-header"], function (exports, _comboBoxHeader) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = _comboBoxHeader.default.extend({
    layoutName: "select-kit/templates/components/future-date-input-selector/future-date-input-selector-header",
    classNames: "future-date-input-selector-header"
  });
});
define("select-kit/components/future-date-input-selector/future-date-input-selector-row", ["exports", "select-kit/components/select-kit/select-kit-row"], function (exports, _selectKitRow) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = _selectKitRow.default.extend({
    layoutName: "select-kit/templates/components/future-date-input-selector/future-date-input-selector-row",
    classNames: ["future-date-input-selector-row"]
  });
});
define("select-kit/components/future-date-input-selector/mixin", ["exports", "discourse/controllers/edit-topic-timer", "select-kit/components/future-date-input-selector", "@ember/object/mixin", "@ember/utils"], function (exports, _editTopicTimer, _futureDateInputSelector, _mixin, _utils) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = _mixin.default.create({
    _computeIconsForValue: function _computeIconsForValue(value) {
      var _updateAt = this._updateAt(value),
          icon = _updateAt.icon;

      if (icon) {
        return icon.split(",");
      }

      return [];
    },
    _computeDatetimeForValue: function _computeDatetimeForValue(value) {
      if ((0, _utils.isNone)(value)) {
        return null;
      }

      var _updateAt2 = this._updateAt(value),
          time = _updateAt2.time;

      if (time) {
        var details = (0, _futureDateInputSelector.timeframeDetails)(value);
        if (!details.displayWhen) {
          time = null;
        }
        if (time && details.format) {
          return time.format(details.format);
        }
      }
      return time;
    },
    _updateAt: function _updateAt(selection) {
      var details = (0, _futureDateInputSelector.timeframeDetails)(selection);

      if (details) {
        return {
          time: details.when(moment(), this.statusType !== _editTopicTimer.CLOSE_STATUS_TYPE ? 8 : 18),
          icon: details.icon
        };
      }

      return { time: moment() };
    }
  });
});
define("select-kit/components/group-dropdown", ["exports", "@ember/object/computed", "select-kit/components/combo-box", "discourse/lib/url", "@ember/object", "discourse/lib/computed"], function (exports, _computed, _comboBox, _url, _object, _computed2) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = _comboBox.default.extend({
    pluginApiIdentifiers: ["group-dropdown"],
    classNames: ["group-dropdown"],
    content: (0, _computed.reads)("groupsWithShortcut"),
    tagName: "li",
    valueProperty: null,
    nameProperty: null,
    hasManyGroups: (0, _computed.gte)("content.length", 10),
    enableGroupDirectory: (0, _computed2.setting)("enable_group_directory"),

    selectKitOptions: {
      caretDownIcon: "caret-right",
      caretUpIcon: "caret-down",
      filterable: "hasManyGroups"
    },

    groupsWithShortcut: (0, _object.computed)("groups.[]", function () {
      var shortcuts = [];

      if (this.enableGroupDirectory || this.get("currentUser.staff")) {
        shortcuts.push(I18n.t("groups.index.all").toLowerCase());
      }

      return shortcuts.concat(this.groups);
    }),

    actions: {
      onChange: function onChange(groupName) {
        if ((this.groups || []).includes(groupName)) {
          _url.default.routeToUrl("/g/" + groupName);
        } else {
          _url.default.routeToUrl("/g");
        }
      }
    }
  });
});
define("select-kit/components/group-members-dropdown", ["exports", "select-kit/components/dropdown-select-box", "@ember/object"], function (exports, _dropdownSelectBox, _object) {
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

  var _desc, _value, _obj;

  exports.default = _dropdownSelectBox.default.extend((_obj = {
    classNames: ["group-members-dropdown"],

    selectKitOptions: {
      icon: "bars",
      showFullTitle: false
    },

    content: (0, _object.computed)(function () {
      var items = [{
        id: "showAddMembersModal",
        name: I18n.t("groups.add_members.title"),
        icon: "user-plus"
      }];

      if (this.currentUser.admin) {
        items.push({
          id: "showBulkAddModal",
          name: I18n.t("admin.groups.bulk_add.title"),
          icon: "users"
        });
      }

      return items;
    }),

    onChange: function onChange(id) {
      this.attrs && this.attrs[id] && this.attrs[id]();
    }
  }, (_applyDecoratedDescriptor(_obj, "onChange", [_object.action], Object.getOwnPropertyDescriptor(_obj, "onChange"), _obj)), _obj));
});
define("select-kit/components/group-notifications-button", ["exports", "select-kit/components/notifications-button"], function (exports, _notificationsButton) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = _notificationsButton.default.extend({
    pluginApiIdentifiers: ["group-notifications-button"],
    classNames: ["group-notifications-button"],

    selectKitOptions: {
      i18nPrefix: "i18nPrefix"
    },

    i18nPrefix: "groups.notifications"
  });
});
define("select-kit/components/icon-picker", ["exports", "select-kit/components/multi-select", "@ember/object", "discourse/lib/ajax", "discourse-common/lib/helpers", "discourse-common/lib/icon-library"], function (exports, _multiSelect, _object, _ajax, _helpers, _iconLibrary) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });

  var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) {
    return typeof obj;
  } : function (obj) {
    return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
  };

  exports.default = _multiSelect.default.extend({
    pluginApiIdentifiers: ["icon-picker"],
    classNames: ["icon-picker"],

    init: function init() {
      this._super.apply(this, arguments);

      this._cachedIconsList = null;

      if (Discourse.Environment === "development") {
        Discourse.disableMissingIconWarning = true;
      }
    },


    content: (0, _object.computed)("value.[]", function () {
      return (0, _helpers.makeArray)(this.value).map(this._processIcon);
    }),

    search: function search() {
      var _this = this;

      var filter = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : "";

      if (filter === "" && this._cachedIconsList && this._cachedIconsList.length) {
        return this._cachedIconsList;
      } else {
        return (0, _ajax.ajax)("/svg-sprite/picker-search", {
          data: { filter: filter }
        }).then(function (icons) {
          icons = icons.map(_this._processIcon);
          if (filter === "") {
            _this._cachedIconsList = icons;
          }
          return icons;
        });
      }
    },
    _processIcon: function _processIcon(icon) {
      var iconName = (typeof icon === "undefined" ? "undefined" : _typeof(icon)) === "object" ? icon.id : icon,
          strippedIconName = (0, _iconLibrary.convertIconClass)(iconName);

      var spriteEl = "#svg-sprites",
          holder = "ajax-icon-holder";

      if ((typeof icon === "undefined" ? "undefined" : _typeof(icon)) === "object") {
        if ($(spriteEl + " ." + holder).length === 0) $(spriteEl).append("<div class=\"" + holder + "\" style='display: none;'></div>");

        if (!$(spriteEl + " symbol#" + strippedIconName).length) {
          $(spriteEl + " ." + holder).append("<svg xmlns='http://www.w3.org/2000/svg'>" + icon.symbol + "</svg>");
        }
      }

      return {
        id: iconName,
        name: iconName,
        icon: strippedIconName
      };
    },
    willDestroyElement: function willDestroyElement() {
      $("#svg-sprites .ajax-icon-holder").remove();
      this._super.apply(this, arguments);

      this._cachedIconsList = null;

      if (Discourse.Environment === "development") {
        delete Discourse.disableMissingIconWarning;
      }
    },


    actions: {
      onChange: function onChange(value, item) {
        if (this.selectKit.options.maximum === 1) {
          value = value.length ? value[0] : null;
          item = item.length ? item[0] : null;
        }

        this.attrs.onChange && this.attrs.onChange(value, item);
      }
    }
  });
});
define("select-kit/components/list-setting", ["exports", "select-kit/components/multi-select", "select-kit/components/select-kit", "@ember/object", "@ember/object/computed", "discourse-common/lib/helpers"], function (exports, _multiSelect, _selectKit, _object, _computed, _helpers) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });

  function _toConsumableArray(arr) {
    if (Array.isArray(arr)) {
      for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) {
        arr2[i] = arr[i];
      }

      return arr2;
    } else {
      return Array.from(arr);
    }
  }

  exports.default = _multiSelect.default.extend({
    pluginApiIdentifiers: ["list-setting"],
    classNames: ["list-setting"],
    choices: null,
    nameProperty: null,
    valueProperty: null,
    content: (0, _computed.readOnly)("choices"),

    selectKitOptions: {
      filterable: true,
      selectedNameComponent: "selectedNameComponent"
    },

    modifyComponentForRow: function modifyComponentForRow(collection) {
      if (collection === _selectKit.MAIN_COLLECTION && this.settingName && this.settingName.indexOf("color") > -1) {
        return "create-color-row";
      }
    },


    selectedNameComponent: (0, _object.computed)("settingName", function () {
      if (this.settingName && this.settingName.indexOf("color") > -1) {
        return "selected-color";
      } else {
        return "selected-name";
      }
    }),

    deselect: function deselect(value) {
      this.onChangeChoices && this.onChangeChoices([].concat(_toConsumableArray(new Set([value].concat(_toConsumableArray((0, _helpers.makeArray)(this.choices)))))));

      this._super.apply(this, arguments);
    }
  });
});
define("select-kit/components/mini-tag-chooser", ["exports", "@ember/object/computed", "select-kit/components/combo-box", "select-kit/mixins/tags", "discourse-common/lib/helpers", "@ember/object", "discourse/lib/computed", "select-kit/components/select-kit"], function (exports, _computed, _comboBox, _tags, _helpers, _object, _computed2, _selectKit) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });

  function _toConsumableArray(arr) {
    if (Array.isArray(arr)) {
      for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) {
        arr2[i] = arr[i];
      }

      return arr2;
    } else {
      return Array.from(arr);
    }
  }

  var SELECTED_TAGS_COLLECTION = "MINI_TAG_CHOOSER_SELECTED_TAGS";
  exports.default = _comboBox.default.extend(_tags.default, {
    headerComponent: "mini-tag-chooser/mini-tag-chooser-header",
    pluginApiIdentifiers: ["mini-tag-chooser"],
    attributeBindings: ["selectKit.options.categoryId:category-id"],
    classNames: ["mini-tag-chooser"],
    classNameBindings: ["noTags"],
    noTags: (0, _computed.empty)("value"),
    maxTagSearchResults: (0, _computed2.setting)("max_tag_search_results"),
    maxTagsPerTopic: (0, _computed2.setting)("max_tags_per_topic"),
    highlightedTag: null,
    singleSelect: false,

    collections: (0, _object.computed)("mainCollection.[]", "errorsCollection.[]", "highlightedTag", function () {
      return this._super.apply(this, arguments);
    }),

    selectKitOptions: {
      fullWidthOnMobile: true,
      filterable: true,
      caretDownIcon: "caretIcon",
      caretUpIcon: "caretIcon",
      termMatchesForbidden: false,
      categoryId: null,
      everyTag: false,
      none: "tagging.choose_for_topic",
      closeOnChange: false,
      maximum: "maximumSelectedTags",
      autoInsertNoneItem: false
    },

    modifyComponentForRow: function modifyComponentForRow(collection, item) {
      if (this.getValue(item) === this.selectKit.filter) {
        return "select-kit/select-kit-row";
      }

      return "tag-row";
    },
    modifyComponentForCollection: function modifyComponentForCollection(collection) {
      if (collection === SELECTED_TAGS_COLLECTION) {
        return "mini-tag-chooser/selected-collection";
      }
    },
    modifyContentForCollection: function modifyContentForCollection(collection) {
      if (collection === SELECTED_TAGS_COLLECTION) {
        return {
          selectedTags: this.value,
          highlightedTag: this.highlightedTag
        };
      }
    },


    allowAnyTag: (0, _computed.or)("allowCreate", "site.can_create_tag"),

    maximumSelectedTags: (0, _object.computed)(function () {
      return parseInt(this.options.limit || this.selectKit.options.maximum || this.maxTagsPerTopic, 10);
    }),

    modifyNoSelection: function modifyNoSelection() {
      if (this.selectKit.options.minimum) {
        var minimum = parseInt(this.selectKit.options.minimum, 10);
        if (minimum > 0) {
          return this.defaultItem(null, I18n.t("select_kit.min_content_not_reached", { count: minimum }));
        }
      }

      return this._super.apply(this, arguments);
    },
    init: function init() {
      this._super.apply(this, arguments);

      this.insertAfterCollection(_selectKit.ERRORS_COLLECTION, SELECTED_TAGS_COLLECTION);
    },


    caretIcon: (0, _object.computed)("value.[]", function () {
      var maximum = this.selectKit.options.maximum;
      return maximum && (0, _helpers.makeArray)(this.value).length >= parseInt(maximum, 10) ? null : "plus";
    }),

    modifySelection: function modifySelection(content) {
      var minimum = this.selectKit.options.minimum;
      if (minimum && (0, _helpers.makeArray)(this.value).length < parseInt(minimum, 10)) {
        var key = this.selectKit.options.minimumLabel || "select_kit.min_content_not_reached";
        var label = I18n.t(key, { count: this.selectKit.options.minimum });
        content.title = content.name = content.label = label;
      } else {
        content.name = content.value = (0, _helpers.makeArray)(this.value).join(",");
        content.title = content.label = (0, _helpers.makeArray)(this.value).join(", ");

        if (content.label.length > 32) {
          content.label = content.label.slice(0, 32) + "...";
        }
      }

      return content;
    },
    search: function search(filter) {
      var data = {
        q: filter || "",
        limit: this.maxTagSearchResults,
        categoryId: this.selectKit.options.categoryId
      };

      if (this.value) {
        data.selected_tags = this.value.slice(0, 100);
      }

      if (!this.selectKit.options.everyTag) data.filterForInput = true;

      return this.searchTags("/tags/filter/search", data, this._transformJson);
    },
    _transformJson: function _transformJson(context, json) {
      var results = json.results;

      context.setProperties({
        termMatchesForbidden: json.forbidden ? true : false,
        termMatchErrorMessage: json.forbidden_message
      });

      if (context.get("siteSettings.tags_sort_alphabetically")) {
        results = results.sort(function (a, b) {
          return a.text.localeCompare(b.text);
        });
      }

      results = results.filter(function (r) {
        return !(0, _helpers.makeArray)(context.tags).includes(r.id);
      }).map(function (result) {
        return { id: result.text, name: result.text, count: result.count };
      });

      return results;
    },
    select: function select(value) {
      this._reset();

      if (!this.validateSelect(value)) {
        return;
      }

      var tags = [].concat(_toConsumableArray(new Set((0, _helpers.makeArray)(this.value).concat(value))));
      this.selectKit.change(tags, tags);
    },
    deselect: function deselect(value) {
      this._reset();

      var tags = [].concat(_toConsumableArray(new Set((0, _helpers.makeArray)(this.value).removeObject(value))));
      this.selectKit.change(tags, tags);
    },
    _reset: function _reset() {
      this.clearErrors();
      this.set("highlightedTag", null);
    },
    _onKeydown: function _onKeydown(event) {
      var value = (0, _helpers.makeArray)(this.value);

      if (event.keyCode === 8) {
        if (!this.selectKit.filter) {
          this._onBackspace(this.value, this.highlightedTag);
        }
      } else if (event.keyCode === 37) {
        if (this.highlightedTag) {
          var index = value.indexOf(this.highlightedTag);
          var highlightedTag = value[index - 1] ? value[index - 1] : value.lastObject;
          this.set("highlightedTag", highlightedTag);
        } else {
          this.set("highlightedTag", value.lastObject);
        }
      } else if (event.keyCode === 39) {
        if (this.highlightedTag) {
          var _index = value.indexOf(this.highlightedTag);
          var _highlightedTag = value[_index + 1] ? value[_index + 1] : value.firstObject;
          this.set("highlightedTag", _highlightedTag);
        } else {
          this.set("highlightedTag", value.firstObject);
        }
      } else {
        this.set("highlightedTag", null);
      }

      return true;
    },
    _onBackspace: function _onBackspace(value, highlightedTag) {
      if (value && value.length) {
        if (!highlightedTag) {
          this.set("highlightedTag", value.lastObject);
        } else {
          this.deselect(highlightedTag);
        }
      }
    }
  });
});
define("select-kit/components/mini-tag-chooser/mini-tag-chooser-header", ["exports", "select-kit/components/combo-box/combo-box-header"], function (exports, _comboBoxHeader) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = _comboBoxHeader.default.extend({
    layoutName: "select-kit/templates/components/mini-tag-chooser/mini-tag-chooser-header",
    classNames: ["mini-tag-chooser-header"]
  });
});
define("select-kit/components/mini-tag-chooser/selected-collection", ["exports", "@ember/component", "@ember/object", "@ember/object/computed"], function (exports, _component, _object, _computed) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = _component.default.extend({
    layoutName: "select-kit/templates/components/mini-tag-chooser/selected-collection",
    classNames: ["mini-tag-chooser-selected-collection", "selected-tags"],
    isVisible: (0, _computed.notEmpty)("selectedTags.[]"),
    selectedTags: (0, _computed.reads)("collection.content.selectedTags.[]"),
    highlightedTag: (0, _computed.reads)("collection.content.highlightedTag"),

    tags: (0, _object.computed)("selectedTags.[]", "highlightedTag", "selectKit.filter", function () {
      var _this = this;

      if (!this.selectedTags) {
        return [];
      }

      var tags = this.selectedTags;
      if (tags.length >= 20 && this.selectKit.filter) {
        tags = tags.filter(function (t) {
          return t.indexOf(_this.selectKit.filter) >= 0;
        });
      } else if (tags.length >= 20) {
        tags = tags.slice(0, 20);
      }

      tags = tags.map(function (selectedTag) {
        var classNames = ["selected-tag"];
        if (selectedTag === _this.highlightedTag) {
          classNames.push("is-highlighted");
        }

        return {
          value: selectedTag,
          classNames: classNames.join(" ")
        };
      });

      return tags;
    }),

    actions: {
      deselectTag: function deselectTag(tag) {
        return this.selectKit.deselect(tag);
      }
    }
  });
});
define("select-kit/components/multi-select", ["exports", "discourse-common/lib/deprecated", "select-kit/components/select-kit", "@ember/object", "@ember/utils", "discourse-common/lib/helpers"], function (exports, _deprecated, _selectKit, _object, _utils, _helpers) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = _selectKit.default.extend({
    pluginApiIdentifiers: ["multi-select"],
    layoutName: "select-kit/templates/components/multi-select",
    classNames: ["multi-select"],
    multiSelect: true,

    selectKitOptions: {
      none: "select_kit.default_header_text",
      clearable: true,
      filterable: true,
      filterIcon: null,
      clearOnClick: true,
      closeOnChange: false,
      autoInsertNoneItem: false,
      headerComponent: "multi-select/multi-select-header",
      filterComponent: "multi-select/multi-select-filter"
    },

    search: function search(filter) {
      var _this = this;

      return this._super(filter).filter(function (content) {
        return !(0, _helpers.makeArray)(_this.selectedContent).includes(content);
      });
    },
    deselect: function deselect(item) {
      var _this2 = this;

      this.clearErrors();

      var newContent = this.selectedContent.filter(function (content) {
        return _this2.getValue(item) !== _this2.getValue(content);
      });

      this.selectKit.change(this.valueProperty ? newContent.mapBy(this.valueProperty) : newContent, newContent);
    },
    select: function select(value, item) {
      if (!(0, _utils.isPresent)(value)) {
        if (!this.validateSelect(this.selectKit.highlighted)) {
          return;
        }

        this.selectKit.change((0, _helpers.makeArray)(this.value).concat((0, _helpers.makeArray)(this.getValue(this.selectKit.highlighted))), (0, _helpers.makeArray)(this.selectedContent).concat((0, _helpers.makeArray)(this.selectKit.highlighted)));
      } else {
        var existingItem = this.findValue(this.mainCollection, this.selectKit.valueProperty ? item : value);
        if (existingItem) {
          if (!this.validateSelect(item)) {
            return;
          }
        }

        var newValues = (0, _helpers.makeArray)(this.value).concat((0, _helpers.makeArray)(value));
        var newContent = (0, _helpers.makeArray)(this.selectedContent).concat((0, _helpers.makeArray)(item));

        this.selectKit.change(newValues, newContent.length ? newContent : (0, _helpers.makeArray)(this.defaultItem(value, value)));
      }
    },


    selectedContent: (0, _object.computed)("value.[]", "content.[]", function () {
      var _this3 = this;

      var value = (0, _helpers.makeArray)(this.value).map(function (v) {
        return _this3.selectKit.options.castInteger && _this3._isNumeric(v) ? Number(v) : v;
      });

      if (value.length) {
        var content = [];

        value.forEach(function (v) {
          if (_this3.selectKit.valueProperty) {
            var c = (0, _helpers.makeArray)(_this3.content).findBy(_this3.selectKit.valueProperty, v);
            if (c) {
              content.push(c);
            }
          } else {
            if ((0, _helpers.makeArray)(_this3.content).includes(v)) {
              content.push(v);
            }
          }
        });

        return this.selectKit.modifySelection(content || []);
      } else {
        return this.selectKit.noneItem;
      }
    }),

    _onKeydown: function _onKeydown(event) {
      if (event.keyCode === 8) {
        event.stopPropagation();

        var input = this.getFilterInput();
        if (input && !input.value.length >= 1) {
          var selected = this.element.querySelectorAll(".select-kit-header .choice.select-kit-selected-name");

          if (selected.length) {
            var lastSelected = selected[selected.length - 1];
            if (lastSelected) {
              if (lastSelected.classList.contains("is-highlighted")) {
                this.deselect(this.selectedContent.lastObject);
              } else {
                lastSelected.classList.add("is-highlighted");
              }
            }
          }
        }
      } else {
        var _selected = this.element.querySelectorAll(".select-kit-header .choice.select-kit-selected-name");
        _selected.forEach(function (s) {
          return s.classList.remove("is-highlighted");
        });
      }

      return true;
    },
    handleDeprecations: function handleDeprecations() {
      this._super.apply(this, arguments);

      this._deprecateValues();
    },
    _deprecateValues: function _deprecateValues() {
      if (this.values && !this.value) {
        (0, _deprecated.default)("The `values` property is deprecated for multi-select. Use `value` instead", {
          since: "v2.4.0"
        });

        this.set("value", this.values);
      }
    }
  });
});
define("select-kit/components/multi-select/multi-select-filter", ["exports", "discourse-common/utils/decorators", "select-kit/components/select-kit/select-kit-filter"], function (exports, _decorators, _selectKitFilter) {
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

  var _dec, _desc, _value, _obj;

  var _Ember = Ember,
      isEmpty = _Ember.isEmpty;
  exports.default = _selectKitFilter.default.extend((_dec = (0, _decorators.default)("placeholder", "selectKit.hasSelection"), (_obj = {
    layoutName: "select-kit/templates/components/select-kit/select-kit-filter",
    classNames: ["multi-select-filter"],

    computedPlaceholder: function computedPlaceholder(placeholder, hasSelection) {
      if (hasSelection) return "";
      return isEmpty(placeholder) ? "" : I18n.t(placeholder);
    }
  }, (_applyDecoratedDescriptor(_obj, "computedPlaceholder", [_dec], Object.getOwnPropertyDescriptor(_obj, "computedPlaceholder"), _obj)), _obj)));
});
define("select-kit/components/multi-select/multi-select-header", ["exports", "select-kit/components/select-kit/select-kit-header", "@ember/object", "discourse-common/lib/helpers"], function (exports, _selectKitHeader, _object, _helpers) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = _selectKitHeader.default.extend({
    classNames: ["multi-select-header"],
    layoutName: "select-kit/templates/components/multi-select/multi-select-header",

    selectedNames: (0, _object.computed)("selectedContent", function () {
      var _this = this;

      return (0, _helpers.makeArray)(this.selectedContent).map(function (c) {
        return _this.getName(c);
      });
    }),

    selectedValue: (0, _object.computed)("selectedContent", function () {
      var _this2 = this;

      return (0, _helpers.makeArray)(this.selectedContent).map(function (c) {
        if (_this2.getName(c) !== _this2.getName(_this2.selectKit.noneItem)) {
          return _this2.getValue(c);
        }

        return null;
      }).filter(Boolean);
    })
  });
});
define("select-kit/components/multi-select/selected-category", ["exports", "select-kit/components/selected-name", "discourse/helpers/category-link", "@ember/object"], function (exports, _selectedName, _categoryLink, _object) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = _selectedName.default.extend({
    classNames: ["selected-category"],
    layoutName: "select-kit/templates/components/multi-select/selected-category",

    badge: (0, _object.computed)("item", function () {
      return (0, _categoryLink.categoryBadgeHTML)(this.item, {
        allowUncategorized: true,
        link: false
      }).htmlSafe();
    })
  });
});
define("select-kit/components/multi-select/selected-color", ["exports", "select-kit/components/selected-name", "discourse-common/utils/decorators"], function (exports, _selectedName, _decorators) {
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

  var _dec, _desc, _value, _obj;

  exports.default = _selectedName.default.extend((_dec = (0, _decorators.default)("name"), (_obj = {
    classNames: ["select-kit-selected-color"],

    footerContent: function footerContent(name) {
      return ("<span class=\"color-preview\" style=\"background:#" + name + "\"></span>").htmlSafe();
    }
  }, (_applyDecoratedDescriptor(_obj, "footerContent", [_dec], Object.getOwnPropertyDescriptor(_obj, "footerContent"), _obj)), _obj)));
});
define("select-kit/components/none-category-row", ["exports", "select-kit/components/category-row", "discourse/helpers/category-link", "discourse-common/utils/decorators"], function (exports, _categoryRow, _categoryLink, _decorators) {
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

  var _dec, _desc, _value, _obj;

  exports.default = _categoryRow.default.extend((_dec = (0, _decorators.default)("category"), (_obj = {
    layoutName: "select-kit/templates/components/category-row",
    classNames: "none category-row",

    badgeForCategory: function badgeForCategory(category) {
      return (0, _categoryLink.categoryBadgeHTML)(category, {
        link: this.categoryLink,
        allowUncategorized: true,
        hideParent: true
      }).htmlSafe();
    }
  }, (_applyDecoratedDescriptor(_obj, "badgeForCategory", [_dec], Object.getOwnPropertyDescriptor(_obj, "badgeForCategory"), _obj)), _obj)));
});
define("select-kit/components/notifications-button", ["exports", "select-kit/components/dropdown-select-box", "discourse/lib/notification-levels", "@ember/object"], function (exports, _dropdownSelectBox, _notificationLevels, _object) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = _dropdownSelectBox.default.extend({
    pluginApiIdentifiers: ["notifications-button"],
    classNames: ["notifications-button"],
    content: _notificationLevels.allLevels,
    nameProperty: "key",

    selectKitOptions: {
      autoFilterable: false,
      filterable: false,
      i18nPrefix: "",
      i18nPostfix: ""
    },

    modifyComponentForRow: function modifyComponentForRow() {
      return "notifications-button/notifications-button-row";
    },
    modifySelection: function modifySelection(content) {
      content = content || {};
      var _selectKit$options = this.selectKit.options,
          i18nPrefix = _selectKit$options.i18nPrefix,
          i18nPostfix = _selectKit$options.i18nPostfix;

      (0, _object.setProperties)(content, {
        label: I18n.t(i18nPrefix + "." + this.buttonForValue.key + i18nPostfix + ".title"),
        icon: this.buttonForValue.icon
      });
      return content;
    },


    buttonForValue: (0, _object.computed)("value", function () {
      return (0, _notificationLevels.buttonDetails)(this.value);
    })
  });
});
define("select-kit/components/notifications-button/notifications-button-row", ["exports", "@ember/object/computed", "@ember/object", "select-kit/components/dropdown-select-box/dropdown-select-box-row", "discourse/lib/utilities"], function (exports, _computed, _object, _dropdownSelectBoxRow, _utilities) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = _dropdownSelectBoxRow.default.extend({
    classNames: ["notifications-button-row"],
    i18nPrefix: (0, _computed.readOnly)("selectKit.options.i18nPrefix"),
    i18nPostfix: (0, _computed.readOnly)("selectKit.options.i18nPostfix"),

    label: (0, _object.computed)("_start", function () {
      return (0, _utilities.escapeExpression)(I18n.t(this._start + ".title"));
    }),

    title: (0, _computed.readOnly)("label"),

    icons: (0, _object.computed)("title", "item.icon", function () {
      return [(0, _utilities.escapeExpression)(this.item.icon)];
    }),

    description: (0, _object.computed)("_start", function () {
      if (this.site && this.site.mobileView) {
        return null;
      }

      return (0, _utilities.escapeExpression)(I18n.t(this._start + ".description"));
    }),

    _start: (0, _object.computed)("i18nPrefix", "i18nPostfix", "rowName", function () {
      return this.i18nPrefix + "." + this.rowName + this.i18nPostfix;
    })
  });
});
define("select-kit/components/period-chooser", ["exports", "@ember/object/computed", "select-kit/components/dropdown-select-box"], function (exports, _computed, _dropdownSelectBox) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = _dropdownSelectBox.default.extend({
    classNames: ["period-chooser"],
    content: (0, _computed.oneWay)("site.periods"),
    value: (0, _computed.readOnly)("period"),
    isVisible: (0, _computed.readOnly)("showPeriods"),
    valueProperty: null,
    nameProperty: null,

    modifyComponentForRow: function modifyComponentForRow() {
      return "period-chooser/period-chooser-row";
    },


    selectKitOptions: {
      filterable: false,
      autoFilterable: false,
      fullDay: "fullDay",
      headerComponent: "period-chooser/period-chooser-header"
    },

    actions: {
      onChange: function onChange(value) {
        if (this.action) {
          this.action(value);
        } else {
          this.attrs.onChange && this.attrs.onChange(value);
        }
      }
    }
  });
});
define("select-kit/components/period-chooser/period-chooser-header", ["exports", "select-kit/components/dropdown-select-box/dropdown-select-box-header", "discourse-common/utils/decorators"], function (exports, _dropdownSelectBoxHeader, _decorators) {
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

  var _dec, _desc, _value, _obj;

  exports.default = _dropdownSelectBoxHeader.default.extend((_dec = (0, _decorators.default)("selectKit.isExpanded"), (_obj = {
    layoutName: "select-kit/templates/components/period-chooser/period-chooser-header",
    classNames: ["period-chooser-header"],

    caretIcon: function caretIcon(isExpanded) {
      return isExpanded ? "caret-up" : "caret-down";
    }
  }, (_applyDecoratedDescriptor(_obj, "caretIcon", [_dec], Object.getOwnPropertyDescriptor(_obj, "caretIcon"), _obj)), _obj)));
});
define("select-kit/components/period-chooser/period-chooser-row", ["exports", "select-kit/components/dropdown-select-box/dropdown-select-box-row", "discourse-common/utils/decorators"], function (exports, _dropdownSelectBoxRow, _decorators) {
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

  var _dec, _desc, _value, _obj;

  exports.default = _dropdownSelectBoxRow.default.extend((_dec = (0, _decorators.default)("rowName"), (_obj = {
    layoutName: "select-kit/templates/components/period-chooser/period-chooser-row",
    classNames: ["period-chooser-row"],

    title: function title(rowName) {
      return I18n.t("filters.top." + (rowName || "this_week")).title;
    }
  }, (_applyDecoratedDescriptor(_obj, "title", [_dec], Object.getOwnPropertyDescriptor(_obj, "title"), _obj)), _obj)));
});
define("select-kit/components/pinned-button", ["exports", "@ember/component", "discourse-common/utils/decorators"], function (exports, _component, _decorators) {
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

  exports.default = _component.default.extend((_dec = (0, _decorators.default)("topic.pinned_globally", "pinned"), _dec2 = (0, _decorators.default)("pinned", "topic.deleted", "topic.unpinned"), (_obj = {
    pluginApiIdentifiers: ["pinned-button"],
    descriptionKey: "help",
    classNames: "pinned-button",
    classNameBindings: ["isHidden"],
    layoutName: "select-kit/templates/components/pinned-button",

    reasonText: function reasonText(pinnedGlobally, pinned) {
      var globally = pinnedGlobally ? "_globally" : "";
      var pinnedKey = pinned ? "pinned" + globally : "unpinned";
      var key = "topic_statuses." + pinnedKey + ".help";
      return I18n.t(key);
    },
    isHidden: function isHidden(pinned, deleted, unpinned) {
      return deleted || !pinned && !unpinned;
    }
  }, (_applyDecoratedDescriptor(_obj, "reasonText", [_dec], Object.getOwnPropertyDescriptor(_obj, "reasonText"), _obj), _applyDecoratedDescriptor(_obj, "isHidden", [_dec2], Object.getOwnPropertyDescriptor(_obj, "isHidden"), _obj)), _obj)));
});
define("select-kit/components/pinned-options", ["exports", "select-kit/components/dropdown-select-box", "discourse-common/lib/icon-library", "@ember/object"], function (exports, _dropdownSelectBox, _iconLibrary, _object) {
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

  var _desc, _value, _obj;

  var UNPINNED = "unpinned";
  var PINNED = "pinned";

  exports.default = _dropdownSelectBox.default.extend((_obj = {
    pluginApiIdentifiers: ["pinned-options"],
    classNames: ["pinned-options"],

    modifySelection: function modifySelection(content) {
      var pinnedGlobally = this.get("topic.pinned_globally");
      var pinned = this.value;
      var globally = pinnedGlobally ? "_globally" : "";
      var state = pinned ? "pinned" + globally : UNPINNED;
      var title = I18n.t("topic_statuses." + state + ".title");

      content.label = ("<span>" + title + "</span>" + (0, _iconLibrary.iconHTML)("caret-down")).htmlSafe();
      content.title = title;
      content.name = state;
      content.icon = "thumbtack" + (state === UNPINNED ? " unpinned" : "");
      return content;
    },


    content: (0, _object.computed)(function () {
      var globally = this.topic.pinned_globally ? "_globally" : "";

      return [{
        id: PINNED,
        name: I18n.t("topic_statuses.pinned" + globally + ".title"),
        description: this.site.mobileView ? null : I18n.t("topic_statuses.pinned" + globally + ".help"),
        icon: "thumbtack"
      }, {
        id: UNPINNED,
        name: I18n.t("topic_statuses.unpinned.title"),
        icon: "thumbtack unpinned",
        description: this.site.mobileView ? null : I18n.t("topic_statuses.unpinned.help")
      }];
    }),

    onChange: function onChange(value) {
      var topic = this.topic;

      if (value === UNPINNED) {
        return topic.clearPin();
      } else {
        return topic.rePin();
      }
    }
  }, (_applyDecoratedDescriptor(_obj, "onChange", [_object.action], Object.getOwnPropertyDescriptor(_obj, "onChange"), _obj)), _obj));
});
define("select-kit/components/search-advanced-category-chooser", ["exports", "select-kit/components/category-chooser"], function (exports, _categoryChooser) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = _categoryChooser.default.extend({
    pluginApiIdentifiers: ["search-advanced-category-chooser"],
    classNames: ["search-advanced-category-chooser"],

    selectKitOptions: {
      allowUncategorized: true,
      clearable: true,
      none: "category.all",
      displayCategoryDescription: false,
      permissionType: null
    }
  });
});
define("select-kit/components/select-kit", ["exports", "@ember/object", "@ember/component", "discourse-common/lib/deprecated", "discourse-common/lib/helpers", "select-kit/mixins/utils", "select-kit/mixins/plugin-api", "@ember/object/mixin", "@ember/utils", "@ember/runloop", "rsvp"], function (exports, _object, _component, _deprecated2, _helpers, _utils, _pluginApi, _mixin, _utils2, _runloop, _rsvp) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.ERRORS_COLLECTION = exports.MAIN_COLLECTION = undefined;

  var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) {
    return typeof obj;
  } : function (obj) {
    return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
  };

  var MAIN_COLLECTION = exports.MAIN_COLLECTION = "MAIN_COLLECTION";
  var ERRORS_COLLECTION = exports.ERRORS_COLLECTION = "ERRORS_COLLECTION";

  var EMPTY_OBJECT = Object.freeze({});
  var SELECT_KIT_OPTIONS = _mixin.default.create({
    mergedProperties: ["selectKitOptions"],
    selectKitOptions: EMPTY_OBJECT
  });

  exports.default = _component.default.extend(SELECT_KIT_OPTIONS, _pluginApi.default, _utils.default, {
    pluginApiIdentifiers: ["select-kit"],
    layoutName: "select-kit/templates/components/select-kit",
    classNames: ["select-kit"],
    classNameBindings: ["selectKit.isLoading:is-loading", "selectKit.isExpanded:is-expanded", "selectKit.isDisabled:is-disabled", "selectKit.isHidden:is-hidden", "selectKit.hasSelection:has-selection"],
    tabindex: 0,
    content: null,
    value: null,
    selectKit: null,
    mainCollection: null,
    errorsCollection: null,
    options: null,
    valueProperty: "id",
    nameProperty: "name",
    singleSelect: false,
    multiSelect: false,

    init: function init() {
      this._super.apply(this, arguments);

      this._searchPromise = null;

      this.set("errorsCollection", []);
      this._collections = [ERRORS_COLLECTION, MAIN_COLLECTION];

      !this.options && this.set("options", _object.default.create({}));

      this.handleDeprecations();

      this.set("selectKit", _object.default.create({
        uniqueID: (0, _object.guidFor)(this),
        valueProperty: this.valueProperty,
        nameProperty: this.nameProperty,
        options: _object.default.create(),

        isLoading: false,
        isHidden: false,
        isExpanded: false,
        isFilterExpanded: false,
        hasSelection: false,
        hasNoContent: true,
        highlighted: null,
        noneItem: null,
        newItem: null,
        filter: null,

        modifyContent: (0, _runloop.bind)(this, this._modifyContentWrapper),
        modifySelection: (0, _runloop.bind)(this, this._modifySelectionWrapper),
        modifyComponentForRow: (0, _runloop.bind)(this, this._modifyComponentForRowWrapper),
        modifyContentForCollection: (0, _runloop.bind)(this, this._modifyContentForCollectionWrapper),
        modifyComponentForCollection: (0, _runloop.bind)(this, this._modifyComponentForCollectionWrapper),

        toggle: (0, _runloop.bind)(this, this._toggle),
        close: (0, _runloop.bind)(this, this._close),
        open: (0, _runloop.bind)(this, this._open),
        highlightNext: (0, _runloop.bind)(this, this._highlightNext),
        highlightPrevious: (0, _runloop.bind)(this, this._highlightPrevious),
        change: (0, _runloop.bind)(this, this._onChangeWrapper),
        select: (0, _runloop.bind)(this, this.select),
        deselect: (0, _runloop.bind)(this, this.deselect),

        onOpen: (0, _runloop.bind)(this, this._onOpenWrapper),
        onClose: (0, _runloop.bind)(this, this._onCloseWrapper),
        onInput: (0, _runloop.bind)(this, this._onInput),
        onClearSelection: (0, _runloop.bind)(this, this._onClearSelection),
        onHover: (0, _runloop.bind)(this, this._onHover),
        onKeydown: (0, _runloop.bind)(this, this._onKeydownWrapper)
      }));
    },
    click: function click(event) {
      if (this.selectKit.options.preventsClickPropagation) {
        event.stopPropagation();
      }
    },
    _modifyComponentForRowWrapper: function _modifyComponentForRowWrapper(collection, item) {
      var component = this.modifyComponentForRow(collection, item);
      return component || "select-kit/select-kit-row";
    },
    modifyComponentForRow: function modifyComponentForRow() {},
    _modifyContentForCollectionWrapper: function _modifyContentForCollectionWrapper(identifier) {
      var collection = this.modifyContentForCollection(identifier);

      if (!collection) {
        switch (identifier) {
          case ERRORS_COLLECTION:
            collection = this.errorsCollection;
            break;
          default:
            collection = this.mainCollection;
            break;
        }
      }

      return collection;
    },
    modifyContentForCollection: function modifyContentForCollection() {},
    _modifyComponentForCollectionWrapper: function _modifyComponentForCollectionWrapper(identifier) {
      var component = this.modifyComponentForCollection(identifier);

      if (!component) {
        switch (identifier) {
          case ERRORS_COLLECTION:
            component = "select-kit/errors-collection";
            break;
          default:
            component = "select-kit/select-kit-collection";
            break;
        }
      }

      return component;
    },
    modifyComponentForCollection: function modifyComponentForCollection() {},
    didUpdateAttrs: function didUpdateAttrs() {
      this._super.apply(this, arguments);

      this.set("selectKit.isDisabled", this.isDisabled || false);

      this.handleDeprecations();
    },
    willDestroyElement: function willDestroyElement() {
      this._super.apply(this, arguments);

      this._searchPromise && (0, _runloop.cancel)(this._searchPromise);

      if (this.popper) {
        this.popper.destroy();
        this.popper = null;
      }
    },
    didReceiveAttrs: function didReceiveAttrs() {
      var _this = this;

      this._super.apply(this, arguments);

      var computedOptions = {};
      Object.keys(this.selectKitOptions).forEach(function (key) {
        var value = _this.selectKitOptions[key];

        if (key === "componentForRow" || key === "contentForCollection" || key === "componentForCollection") {
          if (typeof value === "string") {
            computedOptions[key] = function () {
              return value;
            };
          } else {
            computedOptions[key] = (0, _runloop.bind)(_this, value);
          }

          return;
        }

        if (typeof value === "string" && value.indexOf(".") < 0 && value in _this) {
          var computedValue = (0, _object.get)(_this, value);
          if (typeof computedValue !== "function") {
            computedOptions[key] = (0, _object.get)(_this, value);
            return;
          }
        }
        computedOptions[key] = value;
      });
      this.selectKit.options.setProperties(Object.assign(computedOptions, this.options || {}));

      this.selectKit.setProperties({
        hasSelection: !(0, _utils2.isEmpty)(this.value),
        noneItem: this._modifyNoSelectionWrapper(),
        newItem: null
      });

      if (this.selectKit.isExpanded) {
        this.triggerSearch();
      }

      if (this.computeContent) {
        this._deprecated("The `computeContent()` function is deprecated pass a `content` attribute or define a `content` computed property in your component.");

        this.set("content", this.computeContent());
      }
    },


    selectKitOptions: {
      showFullTitle: true,
      none: null,
      translatedNone: null,
      filterable: false,
      autoFilterable: "autoFilterable",
      filterIcon: "search",
      filterPlaceholder: "filterPlaceholder",
      translatedFilterPlaceholder: null,
      icon: null,
      icons: null,
      maximum: null,
      maximumLabel: null,
      minimum: null,
      minimumLabel: null,
      autoInsertNoneItem: true,
      clearOnClick: false,
      closeOnChange: true,
      limitMatches: null,
      placement: "bottom-start",
      placementStrategy: null,
      filterComponent: "select-kit/select-kit-filter",
      selectedNameComponent: "selected-name",
      castInteger: false,
      preventsClickPropagation: false
    },

    autoFilterable: (0, _object.computed)("content.[]", "selectKit.filter", function () {
      return this.selectKit.filter && this.options.autoFilterable && this.content.length > 15;
    }),

    filterPlaceholder: (0, _object.computed)("options.allowAny", function () {
      return this.options.allowAny ? "select_kit.filter_placeholder_with_any" : "select_kit.filter_placeholder";
    }),

    collections: (0, _object.computed)("selectedContent.[]", "mainCollection.[]", "errorsCollection.[]", function () {
      var _this2 = this;

      return this._collections.map(function (identifier) {
        return {
          identifier: identifier,
          content: _this2.selectKit.modifyContentForCollection(identifier)
        };
      });
    }),

    createContentFromInput: function createContentFromInput(input) {
      return input;
    },
    validateCreate: function validateCreate(filter, content) {
      var _this3 = this;

      this.clearErrors();

      return filter.length > 0 && content && !content.map(function (c) {
        return _this3.getValue(c);
      }).includes(filter) && !(0, _helpers.makeArray)(this.value).includes(filter);
    },
    validateSelect: function validateSelect() {
      this.clearErrors();

      var selection = (0, _helpers.makeArray)(this.value);

      var maximum = this.selectKit.options.maximum;
      if (maximum && selection.length >= maximum) {
        var key = this.selectKit.options.maximumLabel || "select_kit.max_content_reached";
        this.addError(I18n.t(key, { count: maximum }));
        return false;
      }

      return true;
    },
    addError: function addError(error) {
      var _this4 = this;

      this.errorsCollection.pushObject(error);

      this._safeAfterRender(function () {
        return _this4.popper && _this4.popper.update();
      });
    },
    clearErrors: function clearErrors() {
      if (!this.element || this.isDestroyed || this.isDestroying) {
        return;
      }

      this.set("errorsCollection", []);
    },
    prependCollection: function prependCollection(identifier) {
      this._collections.unshift(identifier);
    },
    appendCollection: function appendCollection(identifier) {
      this._collections.push(identifier);
    },
    insertCollectionAtIndex: function insertCollectionAtIndex(identifier, index) {
      this._collections.insertAt(index, identifier);
    },
    insertBeforeCollection: function insertBeforeCollection(identifier, insertedIdentifier) {
      var index = this._collections.indexOf(identifier);
      this.insertCollectionAtIndex(insertedIdentifier, index - 1);
    },
    insertAfterCollection: function insertAfterCollection(identifier, insertedIdentifier) {
      var index = this._collections.indexOf(identifier);
      this.insertCollectionAtIndex(insertedIdentifier, index + 1);
    },
    _onInput: function _onInput(event) {
      this.popper && this.popper.update();

      if (this._searchPromise) {
        (0, _runloop.cancel)(this._searchPromise);
      }

      var input = (0, _pluginApi.applyOnInputPluginApiCallbacks)(this.pluginApiIdentifiers, event, this.selectKit);

      if (input) {
        (0, _runloop.debounce)(this, this._debouncedInput, event.target.value, 200);
      }
    },
    _debouncedInput: function _debouncedInput(filter) {
      this.selectKit.setProperties({ filter: filter, isLoading: true });
      this.triggerSearch(filter);
    },
    _onChangeWrapper: function _onChangeWrapper(value, items) {
      var _this5 = this;

      this.selectKit.set("filter", null);

      return new _rsvp.Promise(function (resolve) {
        if (!_this5.selectKit.valueProperty && _this5.selectKit.noneItem === value) {
          value = null;
          items = [];
        }

        value = (0, _helpers.makeArray)(value);
        items = (0, _helpers.makeArray)(items);

        if (_this5.multiSelect) {
          items = items.filter(function (i) {
            return i !== _this5.newItem && i !== _this5.noneItem && _this5.getValue(i) !== null;
          });

          if (_this5.selectKit.options.maximum === 1) {
            value = value.slice(0, 1);
            items = items.slice(0, 1);
          }
        }

        if (_this5.singleSelect) {
          value = (0, _utils2.isPresent)(value.firstObject) ? value.firstObject : null;
          items = (0, _utils2.isPresent)(items.firstObject) ? items.firstObject : null;
        }

        _this5._boundaryActionHandler("onChange", value, items);
        resolve(items);
      }).finally(function () {
        if (!_this5.isDestroying && !_this5.isDestroyed) {
          if (_this5.selectKit.options.closeOnChange) {
            _this5.selectKit.close();
          }

          _this5._safeAfterRender(function () {
            _this5._focusFilter();
            _this5.popper && _this5.popper.update();
          });
        }
      });
    },
    _modifyContentWrapper: function _modifyContentWrapper(content) {
      content = this.modifyContent(content);

      return (0, _pluginApi.applyContentPluginApiCallbacks)(this.pluginApiIdentifiers, content, this.selectKit);
    },
    modifyContent: function modifyContent(content) {
      return content;
    },
    _modifyNoSelectionWrapper: function _modifyNoSelectionWrapper() {
      var none = this.modifyNoSelection();

      return (0, _pluginApi.applyModifyNoSelectionPluginApiCallbacks)(this.pluginApiIdentifiers, none, this.selectKit);
    },
    modifyNoSelection: function modifyNoSelection() {
      if (this.selectKit.options.translatedNone) {
        return this.defaultItem(null, this.selectKit.options.translatedNone);
      }

      var none = this.selectKit.options.none;
      if ((0, _utils2.isNone)(none) && !this.selectKit.options.allowAny) return null;

      if ((0, _utils2.isNone)(none) && this.selectKit.options.allowAny && !this.selectKit.isExpanded) {
        return null;
      }

      var item = void 0;
      switch (typeof none === "undefined" ? "undefined" : _typeof(none)) {
        case "string":
          item = this.defaultItem(null, I18n.t(none));
          break;
        default:
          item = none;
      }

      return item;
    },
    _modifySelectionWrapper: function _modifySelectionWrapper(item) {
      (0, _pluginApi.applyHeaderContentPluginApiCallbacks)(this.pluginApiIdentifiers, item, this.selectKit);

      return this.modifySelection(item);
    },
    modifySelection: function modifySelection(item) {
      return item;
    },
    _onKeydownWrapper: function _onKeydownWrapper(event) {
      return this._boundaryActionHandler("onKeydown", event);
    },
    _onHover: function _onHover(value, item) {
      (0, _runloop.throttle)(this, this._highlight, item, 25, true);
    },
    _highlight: function _highlight(item) {
      this.selectKit.set("highlighted", item);
    },
    _boundaryActionHandler: function _boundaryActionHandler(actionName) {
      if (!this.element || this.isDestroying || this.isDestroyed) {
        return;
      }

      var boundaryAction = true;

      var privateActionName = "_" + actionName;
      var privateAction = (0, _object.get)(this, privateActionName);

      for (var _len = arguments.length, params = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
        params[_key - 1] = arguments[_key];
      }

      if (privateAction) {
        boundaryAction = privateAction.call.apply(privateAction, [this].concat(params));
      }

      if (this.actions) {
        var componentAction = (0, _object.get)(this.actions, actionName);
        if (boundaryAction && componentAction) {
          boundaryAction = componentAction.call.apply(componentAction, [this].concat(params));
        }
      }

      var action = (0, _object.get)(this, actionName);
      if (boundaryAction && action) {
        boundaryAction = action.call.apply(action, [this].concat(params));
      }

      return boundaryAction;
    },
    deselect: function deselect() {
      this.clearErrors();
      this.selectKit.change(null, null);
    },
    search: function search(filter) {
      var _this6 = this;

      var content = this.content || [];
      if (filter) {
        filter = this._normalize(filter);
        content = content.filter(function (c) {
          var name = _this6._normalize(_this6.getName(c));
          return name && name.indexOf(filter) > -1;
        });
      }
      return content;
    },
    triggerSearch: function triggerSearch(filter) {
      if (this._searchPromise) {
        (0, _runloop.cancel)(this._searchPromise);
      }
      this._searchPromise = this._searchWrapper(filter || this.selectKit.filter);
    },
    _searchWrapper: function _searchWrapper(filter) {
      var _this7 = this;

      this.clearErrors();
      this.setProperties({ mainCollection: [], "selectKit.isLoading": true });
      this._safeAfterRender(function () {
        return _this7.popper && _this7.popper.update();
      });

      var content = [];

      return _rsvp.Promise.resolve(this.search(filter)).then(function (result) {
        content = content.concat((0, _helpers.makeArray)(result));
        content = _this7.selectKit.modifyContent(content).filter(Boolean);

        if (_this7.selectKit.valueProperty) {
          content = content.uniqBy(_this7.selectKit.valueProperty);
        } else {
          content = content.uniq();
        }

        if (_this7.selectKit.options.limitMatches) {
          content = content.slice(0, _this7.selectKit.options.limitMatches);
        }

        var noneItem = _this7.selectKit.noneItem;
        if (_this7.selectKit.options.allowAny && filter && _this7.getName(noneItem) !== filter) {
          filter = _this7.createContentFromInput(filter);
          if (_this7.validateCreate(filter, content)) {
            _this7.selectKit.set("newItem", _this7.defaultItem(filter, filter));
            content.unshift(_this7.selectKit.newItem);
          }
        }

        var hasNoContent = (0, _utils2.isEmpty)(content);

        if (_this7.selectKit.hasSelection && noneItem && _this7.selectKit.options.autoInsertNoneItem) {
          content.unshift(noneItem);
        }

        _this7.set("mainCollection", content);

        _this7.selectKit.setProperties({
          highlighted: _this7.singleSelect && _this7.value ? _this7.itemForValue(_this7.value, _this7.mainCollection) : _this7.mainCollection.firstObject,
          isLoading: false,
          hasNoContent: hasNoContent
        });

        _this7._safeAfterRender(function () {
          _this7.popper && _this7.popper.update();
          _this7._focusFilter();
        });
      });
    },
    _safeAfterRender: function _safeAfterRender(fn) {
      var _this8 = this;

      (0, _runloop.next)(function () {
        (0, _runloop.schedule)("afterRender", function () {
          if (!_this8.element || _this8.isDestroyed || _this8.isDestroying) {
            return;
          }

          fn();
        });
      });
    },
    _scrollToRow: function _scrollToRow(rowItem) {
      var value = this.getValue(rowItem);
      var rowContainer = this.element.querySelector(".select-kit-row[data-value=\"" + value + "\"]");

      if (rowContainer) {
        var collectionContainer = rowContainer.parentNode;

        collectionContainer.scrollTop = rowContainer.offsetTop - collectionContainer.offsetTop;
      }
    },
    _highlightNext: function _highlightNext() {
      var highlightedIndex = this.mainCollection.indexOf(this.selectKit.highlighted);
      var newHighlightedIndex = highlightedIndex;
      var count = this.mainCollection.length;

      if (highlightedIndex < count - 1) {
        newHighlightedIndex = highlightedIndex + 1;
      } else {
        newHighlightedIndex = 0;
      }

      var highlighted = this.mainCollection.objectAt(newHighlightedIndex);
      if (highlighted) {
        this._scrollToRow(highlighted);
        this.set("selectKit.highlighted", highlighted);
      }
    },
    _highlightPrevious: function _highlightPrevious() {
      var highlightedIndex = this.mainCollection.indexOf(this.selectKit.highlighted);
      var newHighlightedIndex = highlightedIndex;
      var count = this.mainCollection.length;

      if (highlightedIndex > 0) {
        newHighlightedIndex = highlightedIndex - 1;
      } else {
        newHighlightedIndex = count - 1;
      }

      var highlighted = this.mainCollection.objectAt(newHighlightedIndex);
      if (highlighted) {
        this._scrollToRow(highlighted);
        this.set("selectKit.highlighted", highlighted);
      }
    },
    select: function select(value, item) {
      if (!(0, _utils2.isPresent)(value)) {
        if (!this.validateSelect(this.selectKit.highlighted)) {
          return;
        }

        this.selectKit.change(this.getValue(this.selectKit.highlighted), this.selectKit.highlighted);
      } else {
        var existingItem = this.findValue(this.mainCollection, item);
        if (existingItem) {
          if (!this.validateSelect(item)) {
            return;
          }
        }

        this.selectKit.change(value, item || this.defaultItem(value, value));
      }
    },
    _onClearSelection: function _onClearSelection() {
      this.selectKit.change(null, null);
    },
    _onOpenWrapper: function _onOpenWrapper(event) {
      var boundaryAction = this._boundaryActionHandler("onOpen");

      boundaryAction = (0, _pluginApi.applyOnOpenPluginApiCallbacks)(this.pluginApiIdentifiers, this.selectKit, event);

      return boundaryAction;
    },
    _onCloseWrapper: function _onCloseWrapper(event) {
      this.set("selectKit.highlighted", null);

      var boundaryAction = this._boundaryActionHandler("onClose");

      boundaryAction = (0, _pluginApi.applyOnClosePluginApiCallbacks)(this.pluginApiIdentifiers, this.selectKit, event);

      return boundaryAction;
    },
    _toggle: function _toggle(event) {
      if (this.selectKit.isExpanded) {
        this._close(event);
      } else {
        this._open(event);
      }
    },
    _close: function _close(event) {
      if (!this.selectKit.isExpanded) {
        return;
      }

      this.clearErrors();

      if (!this.selectKit.onClose(event)) {
        return;
      }

      this.selectKit.setProperties({
        isExpanded: false,
        filter: null
      });
    },
    _open: function _open(event) {
      var _this9 = this;

      if (this.selectKit.isExpanded) {
        return;
      }

      this.clearErrors();

      if (!this.selectKit.onOpen(event)) {
        return;
      }

      if (!this.popper) {
        var anchor = document.querySelector("[data-select-kit-id=" + this.selectKit.uniqueID + "-header]");
        var popper = document.querySelector("[data-select-kit-id=" + this.selectKit.uniqueID + "-body]");

        var inModal = $(this.element).parents("#discourse-modal").length;

        var placementStrategy = this.selectKit.options.placementStrategy;
        if (!placementStrategy) {
          placementStrategy = inModal ? "fixed" : "absolute";
        }

        var verticalOffset = this.multiSelect ? 0 : 2;

        /* global Popper:true */
        this.popper = Popper.createPopper(anchor, popper, {
          eventsEnabled: false,
          strategy: placementStrategy,
          placement: this.selectKit.options.placement,
          modifiers: [{
            name: "offset",
            options: {
              offset: [0, verticalOffset]
            }
          }, {
            name: "positionWrapper",
            phase: "afterWrite",
            enabled: true,
            fn: function fn(data) {
              var wrapper = _this9.element.querySelector(".select-kit-wrapper");
              if (wrapper) {
                var height = _this9.element.offsetHeight + verticalOffset;

                var body = _this9.element.querySelector(".select-kit-body");
                if (body) {
                  height += body.offsetHeight;
                }

                var popperElement = data.state.elements.popper;
                if (popperElement && popperElement.getAttribute("data-popper-placement") === "top-start") {
                  _this9.element.classList.remove("is-under");
                  _this9.element.classList.add("is-above");
                } else {
                  _this9.element.classList.remove("is-above");
                  _this9.element.classList.add("is-under");
                }

                wrapper.style.width = _this9.element.offsetWidth + "px";
                wrapper.style.height = height + "px";
              }
            }
          }]
        });
      }

      this.selectKit.setProperties({
        isExpanded: true,
        isFilterExpanded: this.selectKit.options.filterable || this.selectKit.options.allowAny
      });

      this.triggerSearch();

      this._safeAfterRender(function () {
        _this9._focusFilter();
        _this9._scrollToCurrent();
        _this9.popper && _this9.popper.update();
      });
    },
    _scrollToCurrent: function _scrollToCurrent() {
      if (this.value && this.mainCollection) {
        var highlighted = void 0;
        if (this.valueProperty) {
          highlighted = this.mainCollection.findBy(this.valueProperty, this.value);
        } else {
          var index = this.mainCollection.indexOf(this.value);
          highlighted = this.mainCollection.objectAt(index);
        }

        if (highlighted) {
          this._scrollToRow(highlighted);
          this.set("selectKit.highlighted", highlighted);
        }
      }
    },
    _focusFilter: function _focusFilter() {
      var _this10 = this;

      var forceHeader = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : false;

      this._safeAfterRender(function () {
        var input = _this10.getFilterInput();
        if (!forceHeader && input) {
          input.focus({ preventScroll: true });
        } else {
          var headerContainer = _this10.getHeader();
          headerContainer && headerContainer.focus({ preventScroll: true });
        }
      });
    },
    getFilterInput: function getFilterInput() {
      return document.querySelector("[data-select-kit-id=" + this.selectKit.uniqueID + "-filter] input");
    },
    getHeader: function getHeader() {
      return document.querySelector("[data-select-kit-id=" + this.selectKit.uniqueID + "-header]");
    },
    handleDeprecations: function handleDeprecations() {
      this._deprecateValueAttribute();
      this._deprecateMutations();
      this._deprecateOptions();
    },
    _deprecated: function _deprecated(text) {
      var discourseSetup = document.getElementById("data-discourse-setup");
      if (discourseSetup && discourseSetup.getAttribute("data-environment") === "development") {
        (0, _deprecated2.default)(text, { since: "v2.4.0" });
      }
    },
    _deprecateValueAttribute: function _deprecateValueAttribute() {
      if (this.valueAttribute || this.valueAttribute === null) {
        this._deprecated("The `valueAttribute` is deprecated. Use `valueProperty` instead");

        this.set("valueProperty", this.valueAttribute);
      }
    },
    _deprecateMutations: function _deprecateMutations() {
      var _this11 = this;

      this.actions = this.actions || {};
      this.attrs = this.attrs || {};

      if (!this.attrs.onChange && !this.actions.onChange) {
        this._deprecated("Implicit mutation has been deprecated, please use `onChange` handler");

        this.actions.onChange = this.attrs.onSelect || this.actions.onSelect || function (value) {
          return _this11.set("value", value);
        };
      }
    },
    _deprecateOptions: function _deprecateOptions() {
      var _this12 = this;

      var migrations = {
        headerIcon: "icon",
        onExpand: "onOpen",
        onCollapse: "onClose",
        allowAny: "options.allowAny",
        allowCreate: "options.allowAny",
        filterable: "options.filterable",
        excludeCategoryId: "options.excludeCategoryId",
        scopedCategoryId: "options.scopedCategoryId",
        allowUncategorized: "options.allowUncategorized",
        none: "options.none",
        rootNone: "options.none",
        isDisabled: "options.isDisabled",
        rootNoneLabel: "options.none",
        showFullTitle: "options.showFullTitle",
        title: "options.translatedNone",
        maximum: "options.maximum",
        minimum: "options.minimum",
        i18nPostfix: "options.i18nPostfix",
        i18nPrefix: "options.i18nPrefix",
        castInteger: "options.castInteger"
      };

      Object.keys(migrations).forEach(function (from) {
        var to = migrations[from];
        if (_this12.get(from) && !_this12.get(to)) {
          _this12._deprecated("The `" + from + "` attribute is deprecated. Use `" + to + "` instead");

          _this12.set(to, _this12.get(from));
        }
      });
    }
  });
});
define("select-kit/components/select-kit/errors-collection", ["exports", "@ember/component", "@ember/object/computed"], function (exports, _component, _computed) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = _component.default.extend({
    layoutName: "select-kit/templates/components/select-kit/errors-collection",
    classNames: ["select-kit-errors-collection"],
    tagName: "ul",
    isVisible: (0, _computed.notEmpty)("collection.content")
  });
});
define("select-kit/components/select-kit/select-kit-body", ["exports", "@ember/component", "@ember/object", "@ember/runloop"], function (exports, _component, _object, _runloop) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = _component.default.extend({
    layoutName: "select-kit/templates/components/select-kit/select-kit-body",
    classNames: ["select-kit-body"],
    attributeBindings: ["selectKitId:data-select-kit-id"],
    selectKitId: (0, _object.computed)("selectKit.uniqueID", function () {
      return this.selectKit.uniqueID + "-body";
    }),
    rootEventType: "click",

    init: function init() {
      this._super.apply(this, arguments);

      this.handleRootMouseDownHandler = (0, _runloop.bind)(this, this.handleRootMouseDown);
    },
    didInsertElement: function didInsertElement() {
      this._super.apply(this, arguments);

      document.addEventListener(this.rootEventType, this.handleRootMouseDownHandler, true);
    },
    willDestroyElement: function willDestroyElement() {
      this._super.apply(this, arguments);

      document.removeEventListener(this.rootEventType, this.handleRootMouseDownHandler, true);
    },
    handleRootMouseDown: function handleRootMouseDown(event) {
      if (!this.selectKit.isExpanded) {
        return;
      }

      var headerElement = document.querySelector("[data-select-kit-id=" + this.selectKit.uniqueID + "-header]");

      if (headerElement && headerElement.contains(event.target)) {
        return;
      }

      if (this.element.contains(event.target)) {
        return;
      }

      this.selectKit.close(event);
    }
  });
});
define("select-kit/components/select-kit/select-kit-collection", ["exports", "@ember/component", "@ember/object/computed"], function (exports, _component, _computed) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = _component.default.extend({
    layoutName: "select-kit/templates/components/select-kit/select-kit-collection",
    classNames: ["select-kit-collection"],
    tagName: "ul",
    isVisible: (0, _computed.notEmpty)("collection")
  });
});
define("select-kit/components/select-kit/select-kit-create-row", ["exports", "select-kit/components/select-kit/select-kit-row"], function (exports, _selectKitRow) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = _selectKitRow.default.extend({
    layoutName: "select-kit/templates/components/select-kit/select-kit-row",
    classNames: "create"
  });
});
define("select-kit/components/select-kit/select-kit-filter", ["exports", "@ember/component", "discourse-common/utils/decorators", "@ember/utils", "@ember/object", "@ember/object/computed", "select-kit/mixins/utils"], function (exports, _component, _decorators, _utils, _object, _computed, _utils2) {
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

  var _dec, _desc, _value, _obj;

  exports.default = _component.default.extend(_utils2.default, (_dec = (0, _decorators.default)("selectKit.options.filterPlaceholder", "selectKit.options.translatedFilterPlaceholder"), (_obj = {
    layoutName: "select-kit/templates/components/select-kit/select-kit-filter",
    classNames: ["select-kit-filter"],
    classNameBindings: ["isExpanded:is-expanded"],
    attributeBindings: ["selectKitId:data-select-kit-id"],
    selectKitId: (0, _object.computed)("selectKit.uniqueID", function () {
      return this.selectKit.uniqueID + "-filter";
    }),

    isHidden: (0, _object.computed)("selectKit.options.{filterable,allowAny,autoFilterable}", "content.[]", function () {
      return !this.selectKit.options.filterable && !this.selectKit.options.allowAny && !this.selectKit.options.autoFilterable;
    }),

    isExpanded: (0, _computed.not)("isHidden"),

    placeholder: function placeholder(_placeholder, translatedPlaceholder) {
      if ((0, _utils.isPresent)(translatedPlaceholder)) {
        return translatedPlaceholder;
      }

      if ((0, _utils.isPresent)(_placeholder)) {
        return I18n.t(_placeholder);
      }

      return "";
    },


    actions: {
      onInput: function onInput(event) {
        this.selectKit.onInput(event);
        return true;
      },
      onKeydown: function onKeydown(event) {
        if (!this.selectKit.onKeydown(event)) {
          return false;
        }

        // Do nothing for left/right arrow
        if (event.keyCode === 37 || event.keyCode === 39) {
          return true;
        }

        // Up arrow
        if (event.keyCode === 38) {
          this.selectKit.highlightPrevious();
          return false;
        }

        // Down arrow
        if (event.keyCode === 40) {
          this.selectKit.highlightNext();
          return false;
        }

        // Escape
        if (event.keyCode === 27) {
          this.selectKit.close(event);
          return false;
        }

        // Enter
        if (event.keyCode === 13 && this.selectKit.highlighted) {
          this.selectKit.select(this.getValue(this.selectKit.highlighted), this.selectKit.highlighted);
          return false;
        }

        if (event.keyCode === 13 && !this.selectKit.highlighted) {
          this.element.querySelector("input").focus();
          return false;
        }

        // Tab
        if (event.keyCode === 9) {
          if (this.selectKit.highlighted && this.selectKit.isExpanded) {
            this.selectKit.select(this.getValue(this.selectKit.highlighted), this.selectKit.highlighted);
          }
          this.selectKit.close(event);
          return;
        }
      }
    }
  }, (_applyDecoratedDescriptor(_obj, "placeholder", [_dec], Object.getOwnPropertyDescriptor(_obj, "placeholder"), _obj)), _obj)));
});
define("select-kit/components/select-kit/select-kit-header", ["exports", "@ember/object", "@ember/component", "select-kit/mixins/utils", "@ember/runloop", "discourse-common/lib/helpers"], function (exports, _object, _component, _utils, _runloop, _helpers) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = _component.default.extend(_utils.default, {
    eventType: "click",

    click: function click(event) {
      if (typeof document === "undefined") return;
      if (this.isDestroyed || !this.selectKit || this.selectKit.isDisabled) return;
      if (this.eventType !== "click" || event.button !== 0) return;
      this.selectKit.toggle(event);
      event.preventDefault();
    },


    classNames: ["select-kit-header"],
    classNameBindings: ["isFocused"],
    attributeBindings: ["tabindex", "ariaOwns:aria-owns", "ariaHasPopup:aria-haspopup", "ariaIsExpanded:aria-expanded", "selectKitId:data-select-kit-id", "roleButton:role", "selectedValue:data-value", "selectedNames:data-name", "serializedNames:title"],

    selectedValue: (0, _object.computed)("value", function () {
      return this.value === this.getValue(this.selectKit.noneItem) ? null : (0, _helpers.makeArray)(this.value).join(",");
    }),

    selectedNames: (0, _object.computed)("selectedContent.[]", function () {
      var _this = this;

      return (0, _helpers.makeArray)(this.selectedContent).map(function (s) {
        return _this.getName(s);
      }).join(",");
    }),

    icons: (0, _object.computed)("selectKit.options.{icon,icons}", function () {
      var icon = (0, _helpers.makeArray)(this.selectKit.options.icon);
      var icons = (0, _helpers.makeArray)(this.selectKit.options.icons);
      return icon.concat(icons).filter(Boolean);
    }),

    selectKitId: (0, _object.computed)("selectKit.uniqueID", function () {
      return this.selectKit.uniqueID + "-header";
    }),

    ariaIsExpanded: (0, _object.computed)("selectKit.isExpanded", function () {
      return this.selectKit.isExpanded ? "true" : "false";
    }),

    ariaHasPopup: true,

    ariaOwns: (0, _object.computed)("selectKit.uniqueID", function () {
      return "[data-select-kit-id=" + this.selectKit.uniqueID + "-body]";
    }),

    roleButton: "button",

    tabindex: 0,

    keyUp: function keyUp(event) {
      if (event.keyCode === 32) {
        event.preventDefault();
      }
    },
    keyDown: function keyDown(event) {
      var _this2 = this;

      if (this.selectKit.isDisabled) {
        return;
      }

      if (!this.selectKit.onKeydown(event)) {
        return false;
      }

      var onlyShiftKey = event.shiftKey && event.keyCode === 16;
      if (event.metaKey || onlyShiftKey) {
        return;
      }

      if (event.keyCode === 13) {
        // Enter
        if (this.selectKit.isExpanded) {
          if (this.selectKit.highlighted) {
            this.selectKit.select(this.getValue(this.selectKit.highlighted), this.selectKit.highlighted);
            return false;
          }
        } else {
          this.selectKit.close(event);
        }
      } else if (event.keyCode === 38) {
        // Up arrow
        if (this.selectKit.isExpanded) {
          this.selectKit.highlightPrevious();
        } else {
          this.selectKit.open(event);
        }
        return false;
      } else if (event.keyCode === 40) {
        // Down arrow
        if (this.selectKit.isExpanded) {
          this.selectKit.highlightNext();
        } else {
          this.selectKit.open(event);
        }
        return false;
      } else if (event.keyCode === 37 || event.keyCode === 39) {
        // Do nothing for left/right arrow
        return true;
      } else if (event.keyCode === 32) {
        // Space
        event.preventDefault(); // prevents the space to trigger a scroll page-next
        this.selectKit.toggle(event);
      } else if (event.keyCode === 27) {
        // Escape
        this.selectKit.close(event);
      } else if (event.keyCode === 8) {
        // Backspace
        this._focusFilterInput();
      } else if (event.keyCode === 9) {
        // Tab
        if (this.selectKit.highlighted && this.selectKit.isExpanded) {
          this.selectKit.select(this.getValue(this.selectKit.highlighted), this.selectKit.highlighted);
        }
        this.selectKit.close(event);
      } else if (this.selectKit.options.filterable || this.selectKit.options.autoFilterable || this.selectKit.options.allowAny) {
        if (this.selectKit.isExpanded) {
          this._focusFilterInput();
        } else {
          this.selectKit.open(event);
          (0, _runloop.schedule)("afterRender", function () {
            return _this2._focusFilterInput();
          });
        }
      } else {
        if (this.selectKit.isExpanded) {
          return false;
        } else {
          return true;
        }
      }
    },
    _focusFilterInput: function _focusFilterInput() {
      var filterContainer = document.querySelector("[data-select-kit-id=" + this.selectKit.uniqueID + "-filter]");

      if (filterContainer) {
        filterContainer.style.display = "flex";

        var filterInput = filterContainer.querySelector(".filter-input");
        filterInput && filterInput.focus();
      }
    }
  });
});
define("select-kit/components/select-kit/select-kit-none-row", ["exports", "select-kit/components/select-kit/select-kit-row"], function (exports, _selectKitRow) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = _selectKitRow.default.extend({
    layoutName: "select-kit/templates/components/select-kit/select-kit-row",
    classNames: "none"
  });
});
define("select-kit/components/select-kit/select-kit-row", ["exports", "@ember/component", "@ember/object", "discourse-common/lib/helpers", "@ember/object/internals", "select-kit/mixins/utils"], function (exports, _component, _object, _helpers, _internals, _utils) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = _component.default.extend(_utils.default, {
    layoutName: "select-kit/templates/components/select-kit/select-kit-row",
    classNames: ["select-kit-row"],
    tagName: "li",
    tabIndex: -1,
    attributeBindings: ["tabIndex", "title", "rowValue:data-value", "rowName:data-name", "ariaLabel:aria-label", "guid:data-guid"],
    classNameBindings: ["isHighlighted", "isSelected", "isNone", "isNone:none", "item.classNames"],

    isNone: (0, _object.computed)("rowValue", function () {
      return this.rowValue === this.getValue(this.selectKit.noneItem);
    }),

    guid: (0, _object.computed)("item", function () {
      return (0, _internals.guidFor)(this.item);
    }),

    ariaLabel: (0, _object.computed)("item.ariaLabel", "title", function () {
      return this.getProperty(this.item, "ariaLabel") || this.title;
    }),

    title: (0, _object.computed)("item.title", "rowName", function () {
      return this.getProperty(this.item, "title") || this.rowName;
    }),

    label: (0, _object.computed)("item.label", "title", "rowName", function () {
      var label = this.getProperty(this.item, "label") || this.title || this.rowName;
      if (this.selectKit.options.allowAny && this.rowValue === this.selectKit.filter && this.getName(this.selectKit.noneItem) !== this.rowName && this.getName(this.selectKit.newItem) === this.rowName) {
        return I18n.t("select_kit.create", { content: label });
      }
      return label;
    }),

    didReceiveAttrs: function didReceiveAttrs() {
      this._super.apply(this, arguments);

      this.setProperties({
        rowName: this.getName(this.item),
        rowValue: this.getValue(this.item)
      });
    },


    icons: (0, _object.computed)("item.{icon,icons}", function () {
      var icon = (0, _helpers.makeArray)(this.getProperty(this.item, "icon"));
      var icons = (0, _helpers.makeArray)(this.getProperty(this.item, "icons"));
      return icon.concat(icons).filter(Boolean);
    }),

    highlightedValue: (0, _object.computed)("selectKit.highlighted", function () {
      return this.getValue(this.selectKit.highlighted);
    }),

    isHighlighted: (0, _object.computed)("rowValue", "highlightedValue", function () {
      return this.rowValue === this.highlightedValue;
    }),

    isSelected: (0, _object.computed)("rowValue", "value", function () {
      return this.rowValue === this.value;
    }),

    mouseEnter: function mouseEnter() {
      if (!this.isDestroying || !this.isDestroyed) {
        this.selectKit.onHover(this.rowValue, this.item);
      }
      return false;
    },
    click: function click() {
      this.selectKit.select(this.rowValue, this.item);
      return false;
    }
  });
});
define("select-kit/components/select-kit/single-select-header", ["exports", "select-kit/components/select-kit/select-kit-header", "select-kit/mixins/utils"], function (exports, _selectKitHeader, _utils) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = _selectKitHeader.default.extend(_utils.default, {
    layoutName: "select-kit/templates/components/select-kit/single-select-header",
    classNames: ["single-select-header"]
  });
});
define("select-kit/components/selected-color", ["exports", "select-kit/components/selected-name", "discourse/lib/utilities", "@ember/runloop"], function (exports, _selectedName, _utilities, _runloop) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = _selectedName.default.extend({
    classNames: ["select-kit-selected-color"],

    didReceiveAttrs: function didReceiveAttrs() {
      var _this = this;

      this._super.apply(this, arguments);

      (0, _runloop.schedule)("afterRender", function () {
        var color = (0, _utilities.escapeExpression)(_this.name);
        _this.element.style.borderBottomColor = "#" + color;
      });
    }
  });
});
define("select-kit/components/selected-name", ["exports", "@ember/object", "@ember/component", "discourse-common/lib/helpers", "select-kit/mixins/utils"], function (exports, _object, _component, _helpers, _utils) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = _component.default.extend(_utils.default, {
    layoutName: "select-kit/templates/components/selected-name",
    classNames: ["select-kit-selected-name", "selected-name", "choice"],
    name: null,
    value: null,
    tabindex: 0,
    attributeBindings: ["title", "value:data-value", "name:data-name"],

    click: function click() {
      if (this.selectKit.options.clearOnClick) {
        this.selectKit.deselect(this.item);
        return false;
      }
    },
    didReceiveAttrs: function didReceiveAttrs() {
      this._super.apply(this, arguments);

      // we can't listen on `item.nameProperty` given it's variable
      this.setProperties({
        name: this.getName(this.item),
        value: this.item === this.selectKit.noneItem ? null : this.getValue(this.item)
      });
    },


    ariaLabel: (0, _object.computed)("item", "sanitizedTitle", function () {
      return this._safeProperty("ariaLabel", this.item) || this.sanitizedTitle;
    }),

    // this might need a more advanced solution
    // but atm it's the only case we have to handle
    sanitizedTitle: (0, _object.computed)("title", function () {
      return String(this.title).replace("&hellip;", "");
    }),

    title: (0, _object.computed)("item", function () {
      return this._safeProperty("title", this.item) || this.name || "";
    }),

    label: (0, _object.computed)("title", "name", function () {
      return this._safeProperty("label", this.item) || this.title || this.name;
    }),

    icons: (0, _object.computed)("item.{icon,icons}", function () {
      var icon = (0, _helpers.makeArray)(this._safeProperty("icon", this.item));
      var icons = (0, _helpers.makeArray)(this._safeProperty("icons", this.item));
      return icon.concat(icons).filter(Boolean);
    }),

    _safeProperty: function _safeProperty(name, content) {
      if (!content) {
        return null;
      }

      return (0, _object.get)(content, name);
    }
  });
});
define("select-kit/components/single-select", ["exports", "select-kit/components/select-kit", "@ember/object", "@ember/utils"], function (exports, _selectKit, _object, _utils) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = _selectKit.default.extend({
    pluginApiIdentifiers: ["single-select"],
    layoutName: "select-kit/templates/components/single-select",
    classNames: ["single-select"],
    singleSelect: true,

    selectKitOptions: {
      headerComponent: "select-kit/single-select-header"
    },

    selectedContent: (0, _object.computed)("value", "content.[]", function () {
      if (!(0, _utils.isEmpty)(this.value)) {
        var content = void 0;

        var value = this.selectKit.options.castInteger && this._isNumeric(this.value) ? Number(this.value) : this.value;

        if (this.selectKit.valueProperty) {
          content = (this.content || []).findBy(this.selectKit.valueProperty, value);

          return this.selectKit.modifySelection(content || this.defaultItem(value, value));
        } else {
          return this.selectKit.modifySelection((this.content || []).filter(function (c) {
            return c === value;
          }));
        }
      } else {
        return this.selectKit.noneItem;
      }
    })
  });
});
define("select-kit/components/tag-chooser-row", ["exports", "select-kit/components/select-kit/select-kit-row"], function (exports, _selectKitRow) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = _selectKitRow.default.extend({
    layoutName: "select-kit/templates/components/tag-chooser-row",
    classNames: ["tag-chooser-row"]
  });
});
define("select-kit/components/tag-chooser", ["exports", "@ember/object", "select-kit/components/multi-select", "select-kit/mixins/tags", "discourse-common/lib/helpers"], function (exports, _object, _multiSelect, _tags, _helpers) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = _multiSelect.default.extend(_tags.default, {
    pluginApiIdentifiers: ["tag-chooser"],
    classNames: ["tag-chooser"],

    selectKitOptions: {
      filterable: true,
      filterPlaceholder: "tagging.choose_for_topic",
      limit: null,
      allowAny: "canCreateTag",
      maximum: "maximumTagCount"
    },

    modifyComponentForRow: function modifyComponentForRow() {
      return "tag-chooser-row";
    },


    blacklist: null,
    attributeBindings: ["categoryId"],
    excludeSynonyms: false,
    excludeHasSynonyms: false,

    canCreateTag: (0, _object.computed)("site.can_create_tag", "allowCreate", function () {
      return this.allowCreate && this.site.can_create_tag;
    }),

    maximumTagCount: (0, _object.computed)("siteSettings.max_tags_per_topic", "unlimitedTagCount", function () {
      if (!this.unlimitedTagCount) {
        return parseInt(this.options.limit || this.options.maximum || this.get("siteSettings.max_tags_per_topic"), 10);
      }

      return null;
    }),

    init: function init() {
      this._super.apply(this, arguments);

      this.setProperties({
        blacklist: this.blacklist || [],
        termMatchesForbidden: false,
        termMatchErrorMessage: null
      });
    },


    value: (0, _object.computed)("tags.[]", function () {
      return (0, _helpers.makeArray)(this.tags).uniq();
    }),

    content: (0, _object.computed)("tags.[]", function () {
      var _this = this;

      return (0, _helpers.makeArray)(this.tags).uniq().map(function (t) {
        return _this.defaultItem(t, t);
      });
    }),

    actions: {
      onChange: function onChange(value, items) {
        if (this.attrs.onChange) {
          this.attrs.onChange(value, items);
        } else {
          this.set("tags", value);
        }
      }
    },

    search: function search(query) {
      var selectedTags = (0, _helpers.makeArray)(this.tags).filter(Boolean);

      var data = {
        q: query,
        limit: this.get("siteSettings.max_tag_search_results"),
        categoryId: this.categoryId
      };

      if (selectedTags.length || this.blacklist.length) {
        data.selected_tags = selectedTags.concat(this.blacklist).uniq().slice(0, 100);
      }

      if (!this.everyTag) data.filterForInput = true;
      if (this.excludeSynonyms) data.excludeSynonyms = true;
      if (this.excludeHasSynonyms) data.excludeHasSynonyms = true;

      return this.searchTags("/tags/filter/search", data, this._transformJson);
    },
    _transformJson: function _transformJson(context, json) {
      var results = json.results;

      context.setProperties({
        termMatchesForbidden: json.forbidden ? true : false,
        termMatchErrorMessage: json.forbidden_message
      });

      if (context.blacklist) {
        results = results.filter(function (result) {
          return !context.blacklist.includes(result.id);
        });
      }

      if (context.get("siteSettings.tags_sort_alphabetically")) {
        results = results.sort(function (a, b) {
          return a.id > b.id;
        });
      }

      return results.uniqBy("text").map(function (result) {
        return { id: result.text, name: result.text, count: result.count };
      });
    }
  });
});
define("select-kit/components/tag-drop", ["exports", "discourse/models/category", "@ember/object/computed", "discourse/lib/computed", "select-kit/components/combo-box", "discourse/lib/url", "select-kit/mixins/tags", "@ember/object", "@ember/utils", "discourse-common/lib/helpers"], function (exports, _category, _computed, _computed2, _comboBox, _url, _tags, _object, _utils, _helpers) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.NONE_TAG_ID = exports.ALL_TAGS_ID = exports.NO_TAG_ID = undefined;
  var NO_TAG_ID = exports.NO_TAG_ID = "no-tags";
  var ALL_TAGS_ID = exports.ALL_TAGS_ID = "all-tags";
  var NONE_TAG_ID = exports.NONE_TAG_ID = "none";

  exports.default = _comboBox.default.extend(_tags.default, {
    pluginApiIdentifiers: ["tag-drop"],
    classNameBindings: ["categoryStyle", "tagClass"],
    classNames: ["tag-drop"],
    value: (0, _computed.readOnly)("tagId"),
    tagName: "li",
    currentCategory: (0, _computed.or)("secondCategory", "firstCategory"),
    showFilterByTag: (0, _computed2.setting)("show_filter_by_tag"),
    categoryStyle: (0, _computed2.setting)("category_style"),
    maxTagSearchResults: (0, _computed2.setting)("max_tag_search_results"),
    sortTagsAlphabetically: (0, _computed2.setting)("tags_sort_alphabetically"),
    isVisible: (0, _object.computed)("showFilterByTag", "content.[]", function () {
      if (this.showFilterByTag && !(0, _utils.isEmpty)(this.content)) {
        return true;
      }

      return false;
    }),

    selectKitOptions: {
      allowAny: false,
      caretDownIcon: "caret-right",
      caretUpIcon: "caret-down",
      fullWidthOnMobile: true,
      filterable: true,
      headerComponent: "tag-drop/tag-drop-header",
      autoInsertNoneItem: false
    },

    noTagsSelected: (0, _computed.equal)("tagId", NONE_TAG_ID),

    filterable: (0, _computed.gte)("content.length", 15),

    modifyNoSelection: function modifyNoSelection() {
      if (this.noTagsSelected) {
        return this.defaultItem(NO_TAG_ID, this.noTagsLabel);
      } else {
        return this.defaultItem(ALL_TAGS_ID, this.allTagsLabel);
      }
    },
    modifySelection: function modifySelection(content) {
      if (this.tagId) {
        if (this.noTagsSelected) {
          content = this.defaultItem(NO_TAG_ID, this.noTagsLabel);
        } else {
          content = this.defaultItem(this.tagId, this.tagId);
        }
      }

      return content;
    },


    tagClass: (0, _object.computed)("tagId", function () {
      return this.tagId ? "tag-" + this.tagId : "tag_all";
    }),

    currentCategoryUrl: (0, _computed.readOnly)("currentCategory.url"),

    allTagsUrl: (0, _object.computed)("firstCategory", "secondCategory", function () {
      if (this.currentCategory) {
        return Discourse.getURL(this.currentCategoryUrl + "?allTags=1");
      } else {
        return Discourse.getURL("/");
      }
    }),

    noTagsUrl: (0, _object.computed)("firstCategory", "secondCategory", function () {
      var url = "/tags";
      if (this.currentCategory) {
        url += "/c/" + _category.default.slugFor(this.currentCategory) + "/" + this.currentCategory.id;
      }
      return Discourse.getURL(url + "/" + NONE_TAG_ID);
    }),

    allTagsLabel: (0, _computed2.i18n)("tagging.selector_all_tags"),

    noTagsLabel: (0, _computed2.i18n)("tagging.selector_no_tags"),

    shortcuts: (0, _object.computed)("tagId", function () {
      var shortcuts = [];

      if (this.tagId !== NONE_TAG_ID) {
        shortcuts.push({
          id: NO_TAG_ID,
          name: this.noTagsLabel
        });
      }

      if (this.tagId) {
        shortcuts.push({ id: ALL_TAGS_ID, name: this.allTagsLabel });
      }

      return shortcuts;
    }),

    topTags: (0, _object.computed)("firstCategory", "secondCategory", "site.category_top_tags.[]", "site.top_tags.[]", function () {
      if (this.currentCategory && this.site.category_top_tags) {
        return this.site.category_top_tags;
      }

      return this.site.top_tags;
    }),

    content: (0, _object.computed)("topTags.[]", "shortcuts.[]", function () {
      if (this.sortTagsAlphabetically && this.topTags) {
        return this.shortcuts.concat(this.topTags.sort());
      } else {
        return this.shortcuts.concat((0, _helpers.makeArray)(this.topTags));
      }
    }),

    search: function search(filter) {
      var _this = this;

      if (filter) {
        var data = {
          q: filter,
          limit: this.maxTagSearchResults
        };

        return this.searchTags("/tags/filter/search", data, this._transformJson);
      } else {
        return (this.content || []).map(function (tag) {
          if (tag.id && tag.name) {
            return tag;
          }
          return _this.defaultItem(tag, tag);
        });
      }
    },
    _transformJson: function _transformJson(context, json) {
      return json.results.sort(function (a, b) {
        return a.id > b.id;
      }).map(function (r) {
        var content = context.defaultItem(r.id, r.text);
        content.targetTagId = r.target_tag || r.id;
        content.count = r.count;
        content.pmCount = r.pm_count;
        return content;
      });
    },


    actions: {
      onChange: function onChange(tagId, tag) {
        var url = void 0;

        switch (tagId) {
          case ALL_TAGS_ID:
            url = this.allTagsUrl;
            break;
          case NO_TAG_ID:
            url = this.noTagsUrl;
            break;
          default:
            if (this.currentCategory) {
              url = "/tags/c/" + _category.default.slugFor(this.currentCategory) + "/" + this.currentCategory.id;
            } else {
              url = "/tag";
            }

            if (tag && tag.targetTagId) {
              url += "/" + tag.targetTagId.toLowerCase();
            } else {
              url += "/" + tagId.toLowerCase();
            }
        }

        _url.default.routeTo(Discourse.getURL(url));
      }
    }
  });
});
define("select-kit/components/tag-drop/tag-drop-header", ["exports", "select-kit/components/combo-box/combo-box-header"], function (exports, _comboBoxHeader) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = _comboBoxHeader.default.extend({
    layoutName: "select-kit/templates/components/tag-drop/tag-drop-header",
    classNames: "tag-drop-header"
  });
});
define("select-kit/components/tag-group-chooser", ["exports", "select-kit/components/multi-select", "select-kit/mixins/tags", "discourse-common/lib/helpers", "@ember/object"], function (exports, _multiSelect, _tags, _helpers, _object) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = _multiSelect.default.extend(_tags.default, {
    pluginApiIdentifiers: ["tag-group-chooser"],
    classNames: ["tag-group-chooser", "tag-chooser"],

    selectKitOptions: {
      allowAny: false,
      filterable: true,
      filterPlaceholder: "category.tag_groups_placeholder",
      limit: null
    },

    modifyComponentForRow: function modifyComponentForRow() {
      return "tag-chooser-row";
    },


    value: (0, _object.computed)("tagGroups.[]", function () {
      return (0, _helpers.makeArray)(this.tagGroups).uniq();
    }),

    content: (0, _object.computed)("tagGroups.[]", function () {
      var _this = this;

      return (0, _helpers.makeArray)(this.tagGroups).uniq().map(function (t) {
        return _this.defaultItem(t, t);
      });
    }),

    actions: {
      onChange: function onChange(value) {
        this.set("tagGroups", value);
      }
    },

    search: function search(query) {
      var _this2 = this;

      var data = {
        q: query,
        limit: this.get("siteSettings.max_tag_search_results")
      };

      return this.searchTags("/tag_groups/filter/search", data, this._transformJson).then(function (results) {
        if (results && results.length) {
          return results.filter(function (r) {
            return !(0, _helpers.makeArray)(_this2.tagGroups).includes(_this2.getValue(r));
          });
        }
      });
    },
    _transformJson: function _transformJson(context, json) {
      return json.results.sort(function (a, b) {
        return a.id > b.id;
      }).map(function (result) {
        return { id: result.text, name: result.text, count: result.count };
      });
    }
  });
});
define("select-kit/components/tag-notifications-button", ["exports", "select-kit/components/notifications-button"], function (exports, _notificationsButton) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = _notificationsButton.default.extend({
    pluginApiIdentifiers: ["tag-notifications-button"],
    classNames: ["tag-notifications-button"],

    selectKitOptions: {
      showFullTitle: false,
      i18nPrefix: "i18nPrefix"
    },

    i18nPrefix: "tagging.notifications"
  });
});
define("select-kit/components/tag-row", ["exports", "select-kit/components/select-kit/select-kit-row"], function (exports, _selectKitRow) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = _selectKitRow.default.extend({
    layoutName: "select-kit/templates/components/tag-row",
    classNames: ["tag-row"]
  });
});
define("select-kit/components/timezone-input", ["exports", "select-kit/components/combo-box", "@ember/object"], function (exports, _comboBox, _object) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = _comboBox.default.extend({
    pluginApiIdentifiers: ["timezone-input"],
    classNames: ["timezone-input"],
    nameProperty: null,
    valueProperty: null,

    selectKitOptions: {
      filterable: true,
      allowAny: false
    },

    content: (0, _object.computed)(function () {
      if (moment.locale() !== "en" && typeof moment.tz.localizedNames === "function") {
        return moment.tz.localizedNames().mapBy("value");
      } else {
        return moment.tz.names();
      }
    })
  });
});
define("select-kit/components/toolbar-popup-menu-options", ["exports", "select-kit/components/dropdown-select-box"], function (exports, _dropdownSelectBox) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });


  var HEADING_COLLECTION = "HEADING_COLLECTION";

  exports.default = _dropdownSelectBox.default.extend({
    pluginApiIdentifiers: ["toolbar-popup-menu-options"],
    classNames: ["toolbar-popup-menu-options"],

    init: function init() {
      this._super.apply(this, arguments);

      this.prependCollection(HEADING_COLLECTION);
    },


    selectKitOptions: {
      showFullTitle: false,
      filterable: false,
      autoFilterable: false
    },

    modifyContentForCollection: function modifyContentForCollection(collection) {
      if (collection === HEADING_COLLECTION) {
        return { title: this.selectKit.options.popupTitle };
      }
    },
    modifyComponentForCollection: function modifyComponentForCollection(collection) {
      if (collection === HEADING_COLLECTION) {
        return "toolbar-popup-menu-options/toolbar-popup-menu-options-heading";
      }
    },
    modifyContent: function modifyContent(contents) {
      return contents.map(function (content) {
        if (content.condition) {
          return {
            icon: content.icon,
            name: I18n.t(content.label),
            id: content.action
          };
        }
      }).filter(Boolean);
    }
  });
});
define("select-kit/components/toolbar-popup-menu-options/toolbar-popup-menu-options-heading", ["exports", "@ember/component", "@ember/object/computed"], function (exports, _component, _computed) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = _component.default.extend({
    tagName: "h3",
    layoutName: "select-kit/templates/components/toolbar-popup-menu-options/toolbar-popup-menu-options-heading",
    classNames: ["toolbar-popup-menu-options-heading"],
    heading: (0, _computed.reads)("collection.content.title")
  });
});
define("select-kit/components/topic-footer-mobile-dropdown", ["exports", "select-kit/components/combo-box"], function (exports, _comboBox) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = _comboBox.default.extend({
    pluginApiIdentifiers: ["topic-footer-mobile-dropdown"],
    classNames: ["topic-footer-mobile-dropdown"],

    selectKitOptions: {
      none: "topic.controls",
      filterable: false,
      autoFilterable: false
    },

    actions: {
      onChange: function onChange(value, item) {
        item.action && item.action();
      }
    }
  });
});
define("select-kit/components/topic-notifications-button", ["exports", "@ember/component", "@ember/object"], function (exports, _component, _object) {
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

  var _desc, _value, _obj;

  exports.default = _component.default.extend((_obj = {
    layoutName: "select-kit/templates/components/topic-notifications-button",
    classNames: ["topic-notifications-button"],
    appendReason: true,
    showFullTitle: true,
    placement: "bottom-start",
    notificationLevel: null,
    topic: null,

    changeTopicNotificationLevel: function changeTopicNotificationLevel(levelId) {
      if (levelId !== this.notificationLevel) {
        this.topic.details.updateNotifications(levelId);
      }
    }
  }, (_applyDecoratedDescriptor(_obj, "changeTopicNotificationLevel", [_object.action], Object.getOwnPropertyDescriptor(_obj, "changeTopicNotificationLevel"), _obj)), _obj));
});
define("select-kit/components/topic-notifications-options", ["exports", "select-kit/components/notifications-button", "discourse/lib/notification-levels", "@ember/object"], function (exports, _notificationsButton, _notificationLevels, _object) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = _notificationsButton.default.extend({
    pluginApiIdentifiers: ["topic-notifications-options"],
    classNames: ["topic-notifications-options"],
    content: _notificationLevels.topicLevels,

    selectKitOptions: {
      i18nPrefix: "i18nPrefix",
      i18nPostfix: "i18nPostfix"
    },

    i18nPrefix: "topic.notifications",

    i18nPostfix: (0, _object.computed)("topic.archetype", function () {
      return this.topic.archetype === "private_message" ? "_pm" : "";
    })
  });
});
define("select-kit/components/user-chooser", ["exports", "select-kit/components/multi-select", "@ember/object", "discourse/lib/user-search", "discourse-common/lib/helpers"], function (exports, _multiSelect, _object, _userSearch, _helpers) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = _multiSelect.default.extend({
    pluginApiIdentifiers: ["user-chooser"],
    classNames: ["user-chooser"],
    valueProperty: "username",

    modifyComponentForRow: function modifyComponentForRow() {
      return "user-chooser/user-row";
    },


    selectKitOptions: {
      topicId: undefined,
      categoryId: undefined,
      includeGroups: false,
      allowedUsers: false,
      includeMentionableGroups: false,
      includeMessageableGroups: false,
      allowEmails: false,
      groupMembersOf: undefined
    },

    content: (0, _object.computed)("value.[]", function () {
      var _this = this;

      return (0, _helpers.makeArray)(this.value).map(function (x) {
        return _this.defaultItem(x, x);
      });
    }),

    excludedUsers: (0, _object.computed)("value", "currentUser", "selectKit.options.{excludeCurrentUser,excludedUsernames}", {
      get: function get() {
        var options = this.selectKit.options;
        var usernames = (0, _helpers.makeArray)(this.value);

        if (this.currentUser && options.excludeCurrentUser) {
          usernames = usernames.concat([this.currentUser.username]);
        }

        return usernames.concat(options.excludedUsernames || []);
      }
    }),

    search: function search() {
      var filter = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : "";

      filter = filter || "";
      var options = this.selectKit.options;

      // prevents doing ajax request for nothing
      var skippedSearch = (0, _userSearch.skipSearch)(filter, options.allowEmails);
      var eagerComplete = (0, _userSearch.eagerCompleteSearch)(filter, options.topicId || options.categoryId);
      if (skippedSearch || filter === "" && !eagerComplete) {
        return;
      }

      return (0, _userSearch.default)({
        term: filter,
        topicId: options.topicId,
        categoryId: options.categoryId,
        exclude: this.excludedUsers,
        includeGroups: options.includeGroups,
        allowedUsers: options.allowedUsers,
        includeMentionableGroups: options.includeMentionableGroups,
        includeMessageableGroups: options.includeMessageableGroups,
        groupMembersOf: options.groupMembersOf,
        allowEmails: options.allowEmails
      }).then(function (result) {
        if (typeof result === "string") {
          // do nothing promise probably got cancelled
        } else {
          return result;
        }
      });
    }
  });
});
define("select-kit/components/user-chooser/user-row", ["exports", "select-kit/components/select-kit/select-kit-row"], function (exports, _selectKitRow) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = _selectKitRow.default.extend({
    layoutName: "select-kit/templates/components/user-chooser/user-row",
    classNames: ["user-row"]
  });
});
define("select-kit/components/user-notifications-dropdown", ["exports", "select-kit/components/dropdown-select-box", "discourse/lib/ajax-error", "discourse/lib/show-modal", "@ember/object"], function (exports, _dropdownSelectBox, _ajaxError, _showModal, _object) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = _dropdownSelectBox.default.extend({
    classNames: ["user-notifications", "user-notifications-dropdown"],

    selectKitOptions: {
      headerIcon: "userNotificationicon"
    },

    userNotificationicon: (0, _object.computed)("mainCollection.[]", "value", function () {
      var _this = this;

      return this.mainCollection && this.mainCollection.find(function (row) {
        return row.id === _this.value;
      }).icon;
    }),

    content: (0, _object.computed)(function () {
      var content = [];

      content.push({
        icon: "user",
        id: "changeToNormal",
        description: I18n.t("user.user_notifications.normal_option_title"),
        name: I18n.t("user.user_notifications.normal_option")
      });

      content.push({
        icon: "times-circle",
        id: "changeToMuted",
        description: I18n.t("user.user_notifications.mute_option_title"),
        name: I18n.t("user.user_notifications.mute_option")
      });

      if (this.get("user.can_ignore_user")) {
        content.push({
          icon: "far-eye-slash",
          id: "changeToIgnored",
          description: I18n.t("user.user_notifications.ignore_option_title"),
          name: I18n.t("user.user_notifications.ignore_option")
        });
      }

      return content;
    }),

    changeToNormal: function changeToNormal() {
      this.updateNotificationLevel("normal").catch(_ajaxError.popupAjaxError);
    },
    changeToMuted: function changeToMuted() {
      this.updateNotificationLevel("mute").catch(_ajaxError.popupAjaxError);
    },
    changeToIgnored: function changeToIgnored() {
      (0, _showModal.default)("ignore-duration", {
        model: this.user
      });
    },


    actions: {
      onChange: function onChange(level) {
        this[level]();

        // hack but model.ignored/muted is not
        // getting updated after updateNotificationLevel
        this.set("value", level);
      }
    }
  });
});
define("select-kit/mixins/plugin-api", ["exports", "@ember/object/mixin", "@ember/utils", "discourse-common/lib/helpers"], function (exports, _mixin, _utils, _helpers) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.applyContentPluginApiCallbacks = applyContentPluginApiCallbacks;
  exports.applyHeaderContentPluginApiCallbacks = applyHeaderContentPluginApiCallbacks;
  exports.applyModifyNoSelectionPluginApiCallbacks = applyModifyNoSelectionPluginApiCallbacks;
  exports.applyCollectionHeaderCallbacks = applyCollectionHeaderCallbacks;
  exports.applyOnSelectPluginApiCallbacks = applyOnSelectPluginApiCallbacks;
  exports.applyOnOpenPluginApiCallbacks = applyOnOpenPluginApiCallbacks;
  exports.applyOnClosePluginApiCallbacks = applyOnClosePluginApiCallbacks;
  exports.applyOnInputPluginApiCallbacks = applyOnInputPluginApiCallbacks;
  exports.modifySelectKit = modifySelectKit;
  exports.clearCallbacks = clearCallbacks;


  var _appendContentCallbacks = {};
  function _appendContent(pluginApiIdentifiers, contentFunction) {
    if ((0, _utils.isNone)(_appendContentCallbacks[pluginApiIdentifiers])) {
      _appendContentCallbacks[pluginApiIdentifiers] = [];
    }

    _appendContentCallbacks[pluginApiIdentifiers].push(contentFunction);
  }

  var _prependContentCallbacks = {};
  function _prependContent(pluginApiIdentifiers, contentFunction) {
    if ((0, _utils.isNone)(_prependContentCallbacks[pluginApiIdentifiers])) {
      _prependContentCallbacks[pluginApiIdentifiers] = [];
    }

    _prependContentCallbacks[pluginApiIdentifiers].push(contentFunction);
  }

  var _filterContentCallbacks = {};
  function _filterContent(pluginApiIdentifiers, contentFunction) {
    if ((0, _utils.isNone)(_filterContentCallbacks[pluginApiIdentifiers])) {
      _filterContentCallbacks[pluginApiIdentifiers] = [];
    }

    _filterContentCallbacks[pluginApiIdentifiers].push(contentFunction);
  }

  var _modifyContentCallbacks = {};
  function _modifyContent(pluginApiIdentifiers, contentFunction) {
    if ((0, _utils.isNone)(_modifyContentCallbacks[pluginApiIdentifiers])) {
      _modifyContentCallbacks[pluginApiIdentifiers] = [];
    }

    _modifyContentCallbacks[pluginApiIdentifiers].push(contentFunction);
  }

  var _modifyHeaderComputedContentCallbacks = {};
  function _modifyHeaderComputedContent(pluginApiIdentifiers, contentFunction) {
    if ((0, _utils.isNone)(_modifyHeaderComputedContentCallbacks[pluginApiIdentifiers])) {
      _modifyHeaderComputedContentCallbacks[pluginApiIdentifiers] = [];
    }

    _modifyHeaderComputedContentCallbacks[pluginApiIdentifiers].push(contentFunction);
  }

  var _modifyNoSelectionCallbacks = {};
  function _modifyNoSelection(pluginApiIdentifiers, contentFunction) {
    if ((0, _utils.isNone)(_modifyNoSelectionCallbacks[pluginApiIdentifiers])) {
      _modifyNoSelectionCallbacks[pluginApiIdentifiers] = [];
    }

    _modifyNoSelectionCallbacks[pluginApiIdentifiers].push(contentFunction);
  }

  var _modifyCollectionHeaderCallbacks = {};
  function _modifyCollectionHeader(pluginApiIdentifiers, contentFunction) {
    if ((0, _utils.isNone)(_modifyCollectionHeaderCallbacks[pluginApiIdentifiers])) {
      _modifyCollectionHeaderCallbacks[pluginApiIdentifiers] = [];
    }

    _modifyCollectionHeaderCallbacks[pluginApiIdentifiers].push(contentFunction);
  }

  var _onSelectCallbacks = {};
  function _onSelect(pluginApiIdentifiers, mutationFunction) {
    if ((0, _utils.isNone)(_onSelectCallbacks[pluginApiIdentifiers])) {
      _onSelectCallbacks[pluginApiIdentifiers] = [];
    }

    _onSelectCallbacks[pluginApiIdentifiers].push(mutationFunction);
  }

  var _onOpenCallbacks = {};
  function _onOpen(pluginApiIdentifiers, mutationFunction) {
    if ((0, _utils.isNone)(_onOpenCallbacks[pluginApiIdentifiers])) {
      _onOpenCallbacks[pluginApiIdentifiers] = [];
    }

    _onOpenCallbacks[pluginApiIdentifiers].push(mutationFunction);
  }

  var _onCloseCallbacks = {};
  function _onClose(pluginApiIdentifiers, mutationFunction) {
    if ((0, _utils.isNone)(_onCloseCallbacks[pluginApiIdentifiers])) {
      _onCloseCallbacks[pluginApiIdentifiers] = [];
    }

    _onCloseCallbacks[pluginApiIdentifiers].push(mutationFunction);
  }

  var _onInputCallbacks = {};
  function _onInput(pluginApiIdentifiers, mutationFunction) {
    if ((0, _utils.isNone)(_onInputCallbacks[pluginApiIdentifiers])) {
      _onInputCallbacks[pluginApiIdentifiers] = [];
    }

    _onInputCallbacks[pluginApiIdentifiers].push(mutationFunction);
  }

  function applyContentPluginApiCallbacks(identifiers, content, selectKit) {
    identifiers.forEach(function (key) {
      (_prependContentCallbacks[key] || []).forEach(function (c) {
        content = (0, _helpers.makeArray)(c(selectKit, content)).concat(content);
      });
      (_appendContentCallbacks[key] || []).forEach(function (c) {
        content = content.concat((0, _helpers.makeArray)(c(selectKit, content)));
      });
      var filterCallbacks = _filterContentCallbacks[key] || [];
      if (filterCallbacks.length) {
        content = content.filter(function (c) {
          var kept = true;
          filterCallbacks.forEach(function (cb) {
            kept = cb(selectKit, c);
          });
          return kept;
        });
      }
      (_modifyContentCallbacks[key] || []).forEach(function (c) {
        content = c(selectKit, content);
      });
    });

    return content;
  }

  function applyHeaderContentPluginApiCallbacks(identifiers, content, context) {
    identifiers.forEach(function (key) {
      (_modifyHeaderComputedContentCallbacks[key] || []).forEach(function (c) {
        content = c(context, content);
      });
    });

    return content;
  }
  function applyModifyNoSelectionPluginApiCallbacks(identifiers, content, context) {
    identifiers.forEach(function (key) {
      (_modifyNoSelectionCallbacks[key] || []).forEach(function (c) {
        content = c(context, content);
      });
    });

    return content;
  }

  function applyCollectionHeaderCallbacks(identifiers, content, selectKit) {
    identifiers.forEach(function (key) {
      (_modifyCollectionHeaderCallbacks[key] || []).forEach(function (c) {
        content = c(selectKit, content);
      });
    });

    return content;
  }

  function applyOnSelectPluginApiCallbacks(identifiers, val, selectKit) {
    identifiers.forEach(function (key) {
      (_onSelectCallbacks[key] || []).forEach(function (c) {
        return c(selectKit, val);
      });
    });
  }

  function applyOnOpenPluginApiCallbacks(identifiers, selectKit, event) {
    var keepBubbling = true;
    identifiers.forEach(function (key) {
      (_onOpenCallbacks[key] || []).forEach(function (c) {
        return keepBubbling = c(selectKit, event);
      });
    });
    return keepBubbling;
  }

  function applyOnClosePluginApiCallbacks(identifiers, selectKit, event) {
    var keepBubbling = true;
    identifiers.forEach(function (key) {
      (_onCloseCallbacks[key] || []).forEach(function (c) {
        return keepBubbling = c(selectKit, event);
      });
    });
    return keepBubbling;
  }

  function applyOnInputPluginApiCallbacks(identifiers, event, selectKit) {
    var keepBubbling = true;
    identifiers.forEach(function (key) {
      (_onInputCallbacks[key] || []).forEach(function (c) {
        return keepBubbling = c(selectKit, event);
      });
    });
    return keepBubbling;
  }

  function modifySelectKit(pluginApiIdentifiers) {
    return {
      appendContent: function appendContent(content) {
        _appendContent(pluginApiIdentifiers, function () {
          return content;
        });
        return modifySelectKit(pluginApiIdentifiers);
      },
      prependContent: function prependContent(content) {
        _prependContent(pluginApiIdentifiers, function () {
          return content;
        });
        return modifySelectKit(pluginApiIdentifiers);
      },
      filterContent: function filterContent(filterFunction) {
        _filterContent(pluginApiIdentifiers, filterFunction);
        return modifySelectKit(pluginApiIdentifiers);
      },
      modifyContent: function modifyContent(callback) {
        _modifyContent(pluginApiIdentifiers, callback);
        return modifySelectKit(pluginApiIdentifiers);
      },
      modifyHeaderComputedContent: function modifyHeaderComputedContent(callback) {
        _modifyHeaderComputedContent(pluginApiIdentifiers, callback);
        return modifySelectKit(pluginApiIdentifiers);
      },
      modifySelection: function modifySelection(callback) {
        _modifyHeaderComputedContent(pluginApiIdentifiers, callback);
        return modifySelectKit(pluginApiIdentifiers);
      },
      modifyNoSelection: function modifyNoSelection(callback) {
        _modifyNoSelection(pluginApiIdentifiers, callback);
        return modifySelectKit(pluginApiIdentifiers);
      },
      modifyCollectionHeader: function modifyCollectionHeader(callback) {
        _modifyCollectionHeader(pluginApiIdentifiers, callback);
        return modifySelectKit(pluginApiIdentifiers);
      },
      onSelect: function onSelect(callback) {
        _onSelect(pluginApiIdentifiers, callback);
        return modifySelectKit(pluginApiIdentifiers);
      },
      onClose: function onClose(callback) {
        _onClose(pluginApiIdentifiers, callback);
        return modifySelectKit(pluginApiIdentifiers);
      },
      onOpen: function onOpen(callback) {
        _onOpen(pluginApiIdentifiers, callback);
        return modifySelectKit(pluginApiIdentifiers);
      },
      onInput: function onInput(callback) {
        _onInput(pluginApiIdentifiers, callback);
        return modifySelectKit(pluginApiIdentifiers);
      }
    };
  }

  function clearCallbacks() {
    _appendContentCallbacks = {};
    _prependContentCallbacks = {};
    _filterContentCallbacks = {};
    _modifyNoSelectionCallbacks = {};
    _modifyContentCallbacks = {};
    _modifyHeaderComputedContentCallbacks = {};
    _modifyCollectionHeaderCallbacks = {};
    _onSelectCallbacks = {};
    _onCloseCallbacks = {};
    _onOpenCallbacks = {};
    _onInputCallbacks = {};
  }

  var EMPTY_ARRAY = Object.freeze([]);
  exports.default = _mixin.default.create({
    concatenatedProperties: ["pluginApiIdentifiers"],
    pluginApiIdentifiers: EMPTY_ARRAY
  });
});
define("select-kit/mixins/tags", ["exports", "@ember/object/computed", "discourse/lib/ajax", "discourse/lib/ajax-error", "@ember/object/mixin", "discourse-common/lib/helpers", "@ember/utils"], function (exports, _computed, _ajax, _ajaxError, _mixin, _helpers, _utils) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = _mixin.default.create({
    searchTags: function searchTags(url, data, callback) {
      var _this = this;

      return (0, _ajax.ajax)(Discourse.getURL(url), {
        quietMillis: 200,
        cache: true,
        dataType: "json",
        data: data
      }).then(function (json) {
        return callback(_this, json);
      }).catch(_ajaxError.popupAjaxError);
    },


    selectKitOptions: {
      allowAny: "allowAnyTag"
    },

    allowAnyTag: (0, _computed.reads)("site.can_create_tag"),

    validateCreate: function validateCreate(filter, content) {
      var _this2 = this;

      var maximum = this.selectKit.options.maximum;
      if (maximum && (0, _helpers.makeArray)(this.value).length >= parseInt(maximum, 10)) {
        this.addError(I18n.t("select_kit.max_content_reached", {
          count: this.selectKit.limit
        }));
        return false;
      }

      var filterRegexp = new RegExp(this.site.tags_filter_regexp, "g");
      filter = filter.replace(filterRegexp, "").trim().toLowerCase();

      if (this.termMatchesForbidden) {
        return false;
      }

      if (!filter.length || this.get("siteSettings.max_tag_length") < filter.length) {
        this.addError(I18n.t("select_kit.invalid_selection_length", {
          count: "[1 - " + this.get("siteSettings.max_tag_length") + "]"
        }));
        return false;
      }

      var toLowerCaseOrUndefined = function toLowerCaseOrUndefined(string) {
        return (0, _utils.isEmpty)(string) ? undefined : string.toLowerCase();
      };

      var inCollection = content.map(function (c) {
        return toLowerCaseOrUndefined(_this2.getValue(c));
      }).filter(Boolean).includes(filter);

      var inSelection = (this.value || []).map(function (s) {
        return toLowerCaseOrUndefined(s);
      }).filter(Boolean).includes(filter);

      if (inCollection || inSelection) {
        return false;
      }

      return true;
    },
    createContentFromInput: function createContentFromInput(input) {
      // See lib/discourse_tagging#clean_tag.
      input = input.trim().replace(/\s+/g, "-").replace(/[\/\?#\[\]@!\$&'\(\)\*\+,;=\.%\\`^\s|\{\}"<>]+/g, "").substring(0, this.siteSettings.max_tag_length);

      if (this.siteSettings.force_lowercase_tags) {
        input = input.toLowerCase();
      }

      return input;
    }
  });
});
define("select-kit/mixins/utils", ["exports", "@ember/object/mixin", "@ember/object"], function (exports, _mixin, _object) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = _mixin.default.create({
    defaultItem: function defaultItem(value, name) {
      if (this.selectKit.valueProperty) {
        var item = {};
        item[this.selectKit.valueProperty] = value;
        item[this.selectKit.nameProperty] = name;
        return item;
      } else {
        return name || value;
      }
    },
    itemForValue: function itemForValue(value, content) {
      if (this.selectKit.valueProperty) {
        return content.findBy(this.selectKit.valueProperty, value);
      } else {
        return value;
      }
    },
    getProperty: function getProperty(item, property) {
      var options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : { definedOnly: true };
      var definedOnly = options.definedOnly;


      if (item && typeof property === "string") {
        var attempt = (0, _object.get)(item, property);
        if (attempt) {
          return attempt;
        }
      }

      property = (0, _object.get)(this.selectKit, property);

      if (!item) {
        return null;
      }

      if (!property && definedOnly) {
        return null;
      } else if (!property) {
        return item;
      } else if (typeof property === "string") {
        return (0, _object.get)(item, property);
      } else {
        return property(item);
      }
    },
    getValue: function getValue(item) {
      return this.getProperty(item, "valueProperty", { definedOnly: false });
    },
    getName: function getName(item) {
      return this.getProperty(item, "nameProperty", { definedOnly: false });
    },
    findValue: function findValue(content, item) {
      var _this = this;

      var property = (0, _object.get)(this.selectKit, "valueProperty");

      if (!property) {
        if (content.indexOf(item) > -1) {
          return item;
        }
      } else if (typeof property === "string") {
        return content.findBy(property, this.getValue(item));
      } else {
        var value = this.getValue(item);
        return content.find(function (contentItem) {
          return _this.getValue(contentItem) === value;
        });
      }
    },
    _isNumeric: function _isNumeric(input) {
      return !isNaN(parseFloat(input)) && isFinite(input);
    },
    _normalize: function _normalize(input) {
      if (input) {
        input = input.toLowerCase();

        if (typeof input.normalize === "function") {
          input = input.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        }
      }

      return input;
    }
  });
});
Ember.TEMPLATES["select-kit/templates/components/category-drop/category-drop-header"] = Ember.HTMLBars.template({"id":null,"block":"{\"symbols\":[],\"statements\":[[1,[28,\"component\",[[24,[\"selectKit\",\"options\",\"selectedNameComponent\"]]],[[\"tabindex\",\"item\",\"selectKit\",\"shouldDisplayClearableButton\"],[[24,[\"tabindex\"]],[24,[\"selectedContent\"]],[24,[\"selectKit\"]],[24,[\"shouldDisplayClearableButton\"]]]]],false],[0,\"\\n\\n\"],[1,[28,\"d-icon\",[[24,[\"caretIcon\"]]],[[\"class\"],[\"caret-icon\"]]],false],[0,\"\\n\"]],\"hasEval\":false}","meta":{"moduleName":"select-kit/templates/components/category-drop/category-drop-header"}});
Ember.TEMPLATES["select-kit/templates/components/category-row"] = Ember.HTMLBars.template({"id":null,"block":"{\"symbols\":[],\"statements\":[[4,\"if\",[[24,[\"category\"]]],null,{\"statements\":[[0,\"  \"],[7,\"div\",true],[10,\"class\",\"category-status\"],[8],[0,\"\\n\"],[4,\"if\",[[24,[\"hasParentCategory\"]]],null,{\"statements\":[[4,\"unless\",[[24,[\"hideParentCategory\"]]],null,{\"statements\":[[0,\"        \"],[1,[22,\"badgeForParentCategory\"],false],[0,\"\\n\"]],\"parameters\":[]},null]],\"parameters\":[]},null],[0,\"    \"],[1,[22,\"badgeForCategory\"],false],[0,\"\\n  \"],[9],[0,\"\\n\\n\"],[4,\"if\",[[24,[\"shouldDisplayDescription\"]]],null,{\"statements\":[[0,\"    \"],[7,\"div\",true],[10,\"class\",\"category-desc\"],[8],[1,[28,\"dir-span\",[[24,[\"description\"]]],null],false],[9],[0,\"\\n\"]],\"parameters\":[]},null]],\"parameters\":[]},{\"statements\":[[0,\"  \"],[1,[28,\"html-safe\",[[24,[\"label\"]]],null],false],[0,\"\\n\"]],\"parameters\":[]}]],\"hasEval\":false}","meta":{"moduleName":"select-kit/templates/components/category-row"}});
Ember.TEMPLATES["select-kit/templates/components/color-palettes/color-palettes-row"] = Ember.HTMLBars.template({"id":null,"block":"{\"symbols\":[],\"statements\":[[7,\"span\",true],[10,\"class\",\"name\"],[8],[0,\"\\n  \"],[1,[22,\"label\"],false],[0,\"\\n\"],[9],[0,\"\\n\\n\"],[4,\"if\",[[24,[\"item\",\"colors\"]]],null,{\"statements\":[[0,\"  \"],[7,\"div\",true],[10,\"class\",\"palettes\"],[8],[0,\"\\n    \"],[1,[22,\"palettes\"],false],[0,\"\\n  \"],[9],[0,\"\\n\"]],\"parameters\":[]},null]],\"hasEval\":false}","meta":{"moduleName":"select-kit/templates/components/color-palettes/color-palettes-row"}});
Ember.TEMPLATES["select-kit/templates/components/combo-box/combo-box-header"] = Ember.HTMLBars.template({"id":null,"block":"{\"symbols\":[\"icon\"],\"statements\":[[4,\"each\",[[24,[\"icons\"]]],null,{\"statements\":[[0,\" \"],[1,[28,\"d-icon\",[[23,1,[]]],null],false],[0,\" \"]],\"parameters\":[1]},null],[0,\"\\n\\n\"],[1,[28,\"component\",[[24,[\"selectKit\",\"options\",\"selectedNameComponent\"]]],[[\"tabindex\",\"item\",\"selectKit\"],[[24,[\"tabindex\"]],[24,[\"selectedContent\"]],[24,[\"selectKit\"]]]]],false],[0,\"\\n\\n\"],[4,\"if\",[[24,[\"shouldDisplayClearableButton\"]]],null,{\"statements\":[[0,\"  \"],[1,[28,\"d-button\",null,[[\"class\",\"icon\",\"action\"],[\"btn-clear\",\"times\",[24,[\"selectKit\",\"onClearSelection\"]]]]],false],[0,\"\\n\"]],\"parameters\":[]},null],[0,\"\\n\"],[1,[28,\"d-icon\",[[24,[\"caretIcon\"]]],[[\"class\"],[\"caret-icon\"]]],false],[0,\"\\n\"]],\"hasEval\":false}","meta":{"moduleName":"select-kit/templates/components/combo-box/combo-box-header"}});
Ember.TEMPLATES["select-kit/templates/components/create-color-row"] = Ember.HTMLBars.template({"id":null,"block":"{\"symbols\":[],\"statements\":[[7,\"span\",true],[8],[1,[22,\"label\"],false],[9],[0,\"\\n\"]],\"hasEval\":false}","meta":{"moduleName":"select-kit/templates/components/create-color-row"}});
Ember.TEMPLATES["select-kit/templates/components/dropdown-select-box/dropdown-select-box-header"] = Ember.HTMLBars.template({"id":null,"block":"{\"symbols\":[\"icon\"],\"statements\":[[4,\"each\",[[24,[\"icons\"]]],null,{\"statements\":[[0,\" \"],[1,[28,\"d-icon\",[[23,1,[]]],null],false],[0,\" \"]],\"parameters\":[1]},null],[0,\"\\n\\n\"],[1,[28,\"component\",[[24,[\"selectKit\",\"options\",\"selectedNameComponent\"]]],[[\"tabindex\",\"item\",\"selectKit\",\"shouldDisplayClearableButton\"],[[24,[\"tabindex\"]],[24,[\"selectedContent\"]],[24,[\"selectKit\"]],[24,[\"shouldDisplayClearableButton\"]]]]],false],[0,\"\\n\"]],\"hasEval\":false}","meta":{"moduleName":"select-kit/templates/components/dropdown-select-box/dropdown-select-box-header"}});
Ember.TEMPLATES["select-kit/templates/components/dropdown-select-box/dropdown-select-box-row"] = Ember.HTMLBars.template({"id":null,"block":"{\"symbols\":[\"icon\"],\"statements\":[[4,\"if\",[[24,[\"icons\"]]],null,{\"statements\":[[0,\"  \"],[7,\"div\",true],[10,\"class\",\"icons\"],[8],[0,\"\\n    \"],[7,\"span\",true],[10,\"class\",\"selection-indicator\"],[8],[9],[0,\"\\n\"],[4,\"each\",[[24,[\"icons\"]]],null,{\"statements\":[[0,\"      \"],[1,[28,\"d-icon\",[[23,1,[]]],[[\"translatedtitle\"],[[28,\"dasherize\",[[24,[\"title\"]]],null]]]],false],[0,\"\\n\"]],\"parameters\":[1]},null],[0,\"  \"],[9],[0,\"\\n\"]],\"parameters\":[]},null],[0,\"\\n\"],[7,\"div\",true],[10,\"class\",\"texts\"],[8],[0,\"\\n  \"],[7,\"span\",true],[10,\"class\",\"name\"],[8],[1,[28,\"html-safe\",[[24,[\"label\"]]],null],false],[9],[0,\"\\n  \"],[7,\"span\",true],[10,\"class\",\"desc\"],[8],[1,[28,\"html-safe\",[[24,[\"description\"]]],null],false],[9],[0,\"\\n\"],[9],[0,\"\\n\"]],\"hasEval\":false}","meta":{"moduleName":"select-kit/templates/components/dropdown-select-box/dropdown-select-box-row"}});
Ember.TEMPLATES["select-kit/templates/components/future-date-input-selector/future-date-input-selector-header"] = Ember.HTMLBars.template({"id":null,"block":"{\"symbols\":[\"icon\"],\"statements\":[[4,\"if\",[[24,[\"icons\"]]],null,{\"statements\":[[0,\"  \"],[7,\"div\",true],[10,\"class\",\"future-date-input-selector-icons\"],[8],[0,\"\\n    \"],[4,\"each\",[[24,[\"icons\"]]],null,{\"statements\":[[0,\" \"],[1,[28,\"d-icon\",[[23,1,[]]],null],false],[0,\" \"]],\"parameters\":[1]},null],[0,\"\\n  \"],[9],[0,\"\\n\"]],\"parameters\":[]},null],[0,\"\\n\"],[1,[28,\"component\",[[24,[\"selectKit\",\"options\",\"selectedNameComponent\"]]],[[\"tabindex\",\"item\",\"selectKit\"],[[24,[\"tabindex\"]],[24,[\"selectedContent\"]],[24,[\"selectKit\"]]]]],false],[0,\"\\n\\n\"],[4,\"if\",[[24,[\"selectedContent\",\"datetime\"]]],null,{\"statements\":[[0,\"  \"],[7,\"span\",true],[10,\"class\",\"future-date-input-selector-datetime\"],[8],[0,\"\\n    \"],[1,[24,[\"selectedContent\",\"datetime\"]],false],[0,\"\\n  \"],[9],[0,\"\\n\"]],\"parameters\":[]},null],[0,\"\\n\"],[1,[28,\"d-icon\",[[24,[\"caretIcon\"]]],[[\"class\"],[\"caret-icon\"]]],false],[0,\"\\n\"]],\"hasEval\":false}","meta":{"moduleName":"select-kit/templates/components/future-date-input-selector/future-date-input-selector-header"}});
Ember.TEMPLATES["select-kit/templates/components/future-date-input-selector/future-date-input-selector-row"] = Ember.HTMLBars.template({"id":null,"block":"{\"symbols\":[\"icon\"],\"statements\":[[4,\"if\",[[24,[\"item\",\"icons\"]]],null,{\"statements\":[[0,\"  \"],[7,\"div\",true],[10,\"class\",\"future-date-input-selector-icons\"],[8],[0,\"\\n    \"],[4,\"each\",[[24,[\"item\",\"icons\"]]],null,{\"statements\":[[0,\" \"],[1,[28,\"d-icon\",[[23,1,[]]],null],false],[0,\" \"]],\"parameters\":[1]},null],[0,\"\\n  \"],[9],[0,\"\\n\"]],\"parameters\":[]},null],[0,\"\\n\"],[7,\"span\",true],[10,\"class\",\"name\"],[8],[1,[22,\"label\"],false],[9],[0,\"\\n\\n\"],[4,\"if\",[[24,[\"item\",\"datetime\"]]],null,{\"statements\":[[0,\"  \"],[7,\"span\",true],[10,\"class\",\"future-date-input-selector-datetime\"],[8],[0,\"\\n    \"],[1,[24,[\"item\",\"datetime\"]],false],[0,\"\\n  \"],[9],[0,\"\\n\"]],\"parameters\":[]},null]],\"hasEval\":false}","meta":{"moduleName":"select-kit/templates/components/future-date-input-selector/future-date-input-selector-row"}});
Ember.TEMPLATES["select-kit/templates/components/mini-tag-chooser/mini-tag-chooser-header"] = Ember.HTMLBars.template({"id":null,"block":"{\"symbols\":[],\"statements\":[[1,[28,\"component\",[[24,[\"selectKit\",\"options\",\"selectedNameComponent\"]]],[[\"tabindex\",\"item\",\"selectKit\"],[[24,[\"tabindex\"]],[24,[\"selectedContent\"]],[24,[\"selectKit\"]]]]],false],[0,\"\\n\\n\"],[1,[28,\"d-icon\",[[24,[\"caretIcon\"]]],[[\"class\"],[\"caret-icon\"]]],false],[0,\"\\n\"]],\"hasEval\":false}","meta":{"moduleName":"select-kit/templates/components/mini-tag-chooser/mini-tag-chooser-header"}});
Ember.TEMPLATES["select-kit/templates/components/mini-tag-chooser/selected-collection"] = Ember.HTMLBars.template({"id":null,"block":"{\"symbols\":[\"tag\"],\"statements\":[[4,\"each\",[[24,[\"tags\"]]],null,{\"statements\":[[4,\"d-button\",null,[[\"translatedTitle\",\"icon\",\"action\",\"actionParam\",\"class\"],[[23,1,[\"value\"]],\"times\",[28,\"action\",[[23,0,[]],\"deselectTag\"],null],[23,1,[\"value\"]],[23,1,[\"classNames\"]]]],{\"statements\":[[0,\"    \"],[1,[28,\"discourse-tag\",[[23,1,[\"value\"]]],[[\"noHref\"],[true]]],false],[0,\"\\n\"]],\"parameters\":[]},null]],\"parameters\":[1]},null]],\"hasEval\":false}","meta":{"moduleName":"select-kit/templates/components/mini-tag-chooser/selected-collection"}});
Ember.TEMPLATES["select-kit/templates/components/multi-select"] = Ember.HTMLBars.template({"id":null,"block":"{\"symbols\":[\"collection\"],\"statements\":[[4,\"unless\",[[24,[\"isHidden\"]]],null,{\"statements\":[[0,\"  \"],[1,[28,\"component\",[[24,[\"selectKit\",\"options\",\"headerComponent\"]]],[[\"tabindex\",\"value\",\"selectedContent\",\"selectKit\"],[[24,[\"tabindex\"]],[24,[\"value\"]],[24,[\"selectedContent\"]],[24,[\"selectKit\"]]]]],false],[0,\"\\n\\n\"],[4,\"select-kit/select-kit-body\",null,[[\"selectKit\"],[[24,[\"selectKit\"]]]],{\"statements\":[[4,\"if\",[[24,[\"selectKit\",\"isLoading\"]]],null,{\"statements\":[[0,\"      \"],[7,\"span\",true],[10,\"class\",\"is-loading\"],[8],[0,\"\\n        \"],[1,[28,\"loading-spinner\",null,[[\"size\"],[\"small\"]]],false],[0,\"\\n      \"],[9],[0,\"\\n\"]],\"parameters\":[]},{\"statements\":[[4,\"if\",[[24,[\"selectKit\",\"filter\"]]],null,{\"statements\":[[4,\"if\",[[24,[\"selectKit\",\"hasNoContent\"]]],null,{\"statements\":[[0,\"          \"],[7,\"span\",true],[10,\"class\",\"no-content\"],[8],[0,\"\\n            \"],[1,[28,\"i18n\",[\"select_kit.no_content\"],null],false],[0,\"\\n          \"],[9],[0,\"\\n\"]],\"parameters\":[]},null]],\"parameters\":[]},null],[0,\"\\n\"],[4,\"each\",[[24,[\"collections\"]]],null,{\"statements\":[[0,\"        \"],[1,[28,\"component\",[[28,\"component-for-collection\",[[23,1,[\"identifier\"]],[24,[\"selectKit\"]]],null]],[[\"collection\",\"selectKit\",\"value\"],[[23,1,[]],[24,[\"selectKit\"]],[24,[\"value\"]]]]],false],[0,\"\\n\"]],\"parameters\":[1]},null]],\"parameters\":[]}]],\"parameters\":[]},null],[0,\"\\n  \"],[7,\"div\",true],[10,\"class\",\"select-kit-wrapper\"],[8],[9],[0,\"\\n\"]],\"parameters\":[]},null]],\"hasEval\":false}","meta":{"moduleName":"select-kit/templates/components/multi-select"}});
Ember.TEMPLATES["select-kit/templates/components/multi-select/multi-select-header"] = Ember.HTMLBars.template({"id":null,"block":"{\"symbols\":[\"item\"],\"statements\":[[7,\"div\",true],[10,\"class\",\"choices\"],[8],[0,\"\\n\"],[4,\"each\",[[24,[\"selectedContent\"]]],null,{\"statements\":[[0,\"    \"],[1,[28,\"component\",[[24,[\"selectKit\",\"options\",\"selectedNameComponent\"]]],[[\"tabindex\",\"item\",\"selectKit\"],[[24,[\"tabindex\"]],[23,1,[]],[24,[\"selectKit\"]]]]],false],[0,\"\\n\"]],\"parameters\":[1]},null],[0,\"\\n  \"],[7,\"div\",true],[10,\"class\",\"choice input-wrapper\"],[8],[0,\"\\n    \"],[1,[28,\"component\",[[24,[\"selectKit\",\"options\",\"filterComponent\"]]],[[\"selectKit\"],[[24,[\"selectKit\"]]]]],false],[0,\"\\n  \"],[9],[0,\"\\n\"],[9],[0,\"\\n\"]],\"hasEval\":false}","meta":{"moduleName":"select-kit/templates/components/multi-select/multi-select-header"}});
Ember.TEMPLATES["select-kit/templates/components/multi-select/selected-category"] = Ember.HTMLBars.template({"id":null,"block":"{\"symbols\":[],\"statements\":[[7,\"div\",true],[10,\"class\",\"body\"],[8],[0,\"\\n  \"],[1,[22,\"badge\"],false],[0,\"\\n  \"],[1,[28,\"d-icon\",[\"times\"],null],false],[0,\"\\n\"],[9],[0,\"\\n\"]],\"hasEval\":false}","meta":{"moduleName":"select-kit/templates/components/multi-select/selected-category"}});
Ember.TEMPLATES["select-kit/templates/components/period-chooser/period-chooser-header"] = Ember.HTMLBars.template({"id":null,"block":"{\"symbols\":[],\"statements\":[[7,\"h2\",true],[10,\"class\",\"selected-name\"],[11,\"title\",[22,\"title\"]],[8],[0,\"\\n  \"],[1,[28,\"period-title\",[[24,[\"value\"]]],[[\"showDateRange\",\"fullDay\"],[true,[24,[\"selectKit\",\"options\",\"fullDay\"]]]]],false],[0,\"\\n\"],[9],[0,\"\\n\\n\"],[1,[28,\"d-icon\",[[24,[\"caretIcon\"]]],[[\"class\"],[\"caret-icon\"]]],false],[0,\"\\n\"]],\"hasEval\":false}","meta":{"moduleName":"select-kit/templates/components/period-chooser/period-chooser-header"}});
Ember.TEMPLATES["select-kit/templates/components/period-chooser/period-chooser-row"] = Ember.HTMLBars.template({"id":null,"block":"{\"symbols\":[],\"statements\":[[7,\"span\",true],[10,\"class\",\"selection-indicator\"],[8],[9],[0,\"\\n\\n\"],[7,\"span\",true],[10,\"class\",\"period-title\"],[8],[0,\"\\n  \"],[1,[28,\"period-title\",[[24,[\"rowValue\"]]],[[\"showDateRange\",\"fullDay\"],[true,[24,[\"selectKit\",\"options\",\"fullDay\"]]]]],false],[0,\"\\n\"],[9],[0,\"\\n\"]],\"hasEval\":false}","meta":{"moduleName":"select-kit/templates/components/period-chooser/period-chooser-row"}});
Ember.TEMPLATES["select-kit/templates/components/pinned-button"] = Ember.HTMLBars.template({"id":null,"block":"{\"symbols\":[],\"statements\":[[1,[28,\"pinned-options\",null,[[\"value\",\"topic\"],[[24,[\"pinned\"]],[24,[\"topic\"]]]]],false],[0,\"\\n\\n\"],[7,\"p\",true],[10,\"class\",\"reason\"],[8],[0,\"\\n  \"],[1,[28,\"html-safe\",[[24,[\"reasonText\"]]],null],false],[0,\"\\n\"],[9],[0,\"\\n\"]],\"hasEval\":false}","meta":{"moduleName":"select-kit/templates/components/pinned-button"}});
Ember.TEMPLATES["select-kit/templates/components/select-kit/errors-collection"] = Ember.HTMLBars.template({"id":null,"block":"{\"symbols\":[\"item\"],\"statements\":[[4,\"if\",[[24,[\"collection\"]]],null,{\"statements\":[[4,\"each\",[[24,[\"collection\",\"content\"]]],null,{\"statements\":[[0,\"    \"],[7,\"li\",true],[10,\"class\",\"select-kit-error\"],[8],[1,[23,1,[]],false],[9],[0,\"\\n\"]],\"parameters\":[1]},null]],\"parameters\":[]},null]],\"hasEval\":false}","meta":{"moduleName":"select-kit/templates/components/select-kit/errors-collection"}});
Ember.TEMPLATES["select-kit/templates/components/select-kit/select-kit-body"] = Ember.HTMLBars.template({"id":null,"block":"{\"symbols\":[\"&default\"],\"statements\":[[4,\"if\",[[24,[\"selectKit\",\"isExpanded\"]]],null,{\"statements\":[[0,\"  \"],[14,1],[0,\"\\n\"]],\"parameters\":[]},null]],\"hasEval\":false}","meta":{"moduleName":"select-kit/templates/components/select-kit/select-kit-body"}});
Ember.TEMPLATES["select-kit/templates/components/select-kit/select-kit-collection"] = Ember.HTMLBars.template({"id":null,"block":"{\"symbols\":[\"item\"],\"statements\":[[4,\"each\",[[24,[\"collection\",\"content\"]]],null,{\"statements\":[[0,\"  \"],[1,[28,\"component\",[[28,\"component-for-row\",[[24,[\"collection\",\"identifier\"]],[23,1,[]],[24,[\"selectKit\"]]],null]],[[\"item\",\"value\",\"selectKit\"],[[23,1,[]],[24,[\"value\"]],[24,[\"selectKit\"]]]]],false],[0,\"\\n\"]],\"parameters\":[1]},null]],\"hasEval\":false}","meta":{"moduleName":"select-kit/templates/components/select-kit/select-kit-collection"}});
Ember.TEMPLATES["select-kit/templates/components/select-kit/select-kit-filter"] = Ember.HTMLBars.template({"id":null,"block":"{\"symbols\":[],\"statements\":[[4,\"unless\",[[24,[\"isHidden\"]]],null,{\"statements\":[[0,\"  \"],[1,[28,\"input\",null,[[\"tabindex\",\"class\",\"placeholder\",\"autocomplete\",\"autocorrect\",\"autocapitalize\",\"spellcheck\",\"value\",\"input\",\"keyDown\"],[-1,\"filter-input\",[24,[\"placeholder\"]],\"off\",\"off\",\"off\",false,[28,\"readonly\",[[24,[\"selectKit\",\"filter\"]]],null],[28,\"action\",[[23,0,[]],\"onInput\"],null],[28,\"action\",[[23,0,[]],\"onKeydown\"],null]]]],false],[0,\"\\n\\n\"],[4,\"if\",[[24,[\"selectKit\",\"options\",\"filterIcon\"]]],null,{\"statements\":[[0,\"    \"],[1,[28,\"d-icon\",[[24,[\"selectKit\",\"options\",\"filterIcon\"]]],[[\"class\"],[\"filter-icon\"]]],false],[0,\"\\n\"]],\"parameters\":[]},null]],\"parameters\":[]},null]],\"hasEval\":false}","meta":{"moduleName":"select-kit/templates/components/select-kit/select-kit-filter"}});
Ember.TEMPLATES["select-kit/templates/components/select-kit/select-kit-row"] = Ember.HTMLBars.template({"id":null,"block":"{\"symbols\":[\"icon\"],\"statements\":[[4,\"each\",[[24,[\"icons\"]]],null,{\"statements\":[[0,\"  \"],[1,[28,\"d-icon\",[[23,1,[]]],[[\"translatedtitle\"],[[28,\"dasherize\",[[24,[\"title\"]]],null]]]],false],[0,\"\\n\"]],\"parameters\":[1]},null],[0,\"\\n\"],[7,\"span\",true],[10,\"class\",\"name\"],[8],[0,\"\\n  \"],[1,[22,\"label\"],false],[0,\"\\n\"],[9],[0,\"\\n\"]],\"hasEval\":false}","meta":{"moduleName":"select-kit/templates/components/select-kit/select-kit-row"}});
Ember.TEMPLATES["select-kit/templates/components/select-kit/single-select-header"] = Ember.HTMLBars.template({"id":null,"block":"{\"symbols\":[\"icon\"],\"statements\":[[4,\"each\",[[24,[\"icons\"]]],null,{\"statements\":[[0,\" \"],[1,[28,\"d-icon\",[[23,1,[]]],null],false],[0,\" \"]],\"parameters\":[1]},null],[0,\"\\n\\n\"],[1,[28,\"component\",[[24,[\"selectKit\",\"options\",\"selectedNameComponent\"]]],[[\"tabindex\",\"item\",\"selectKit\"],[[24,[\"tabindex\"]],[24,[\"selectedContent\"]],[24,[\"selectKit\"]]]]],false],[0,\"\\n\"]],\"hasEval\":false}","meta":{"moduleName":"select-kit/templates/components/select-kit/single-select-header"}});
Ember.TEMPLATES["select-kit/templates/components/selected-name"] = Ember.HTMLBars.template({"id":null,"block":"{\"symbols\":[],\"statements\":[[4,\"if\",[[24,[\"selectKit\",\"options\",\"showFullTitle\"]]],null,{\"statements\":[[4,\"if\",[[24,[\"item\",\"icon\"]]],null,{\"statements\":[[0,\"    \"],[1,[28,\"d-icon\",[[24,[\"item\",\"icon\"]]],null],false],[0,\"\\n\"]],\"parameters\":[]},null],[0,\"\\n  \"],[7,\"span\",true],[10,\"class\",\"name\"],[8],[0,\"\\n    \"],[1,[22,\"label\"],false],[0,\"\\n  \"],[9],[0,\"\\n\\n\"],[4,\"if\",[[24,[\"selectKit\",\"options\",\"clearOnClick\"]]],null,{\"statements\":[[0,\"    \"],[1,[28,\"d-icon\",[\"times\"],null],false],[0,\"\\n\"]],\"parameters\":[]},{\"statements\":[[4,\"if\",[[24,[\"shouldDisplayClearableButton\"]]],null,{\"statements\":[[0,\"      \"],[1,[28,\"d-button\",null,[[\"class\",\"icon\",\"action\",\"actionParam\"],[\"btn-clear\",\"times\",[24,[\"selectKit\",\"deselect\"]],[24,[\"item\"]]]]],false],[0,\"\\n\"]],\"parameters\":[]},null]],\"parameters\":[]}]],\"parameters\":[]},{\"statements\":[[4,\"if\",[[24,[\"item\",\"icon\"]]],null,{\"statements\":[[0,\"    \"],[1,[28,\"d-icon\",[[24,[\"item\",\"icon\"]]],null],false],[0,\"\\n\"]],\"parameters\":[]},null]],\"parameters\":[]}]],\"hasEval\":false}","meta":{"moduleName":"select-kit/templates/components/selected-name"}});
Ember.TEMPLATES["select-kit/templates/components/single-select"] = Ember.HTMLBars.template({"id":null,"block":"{\"symbols\":[\"collection\"],\"statements\":[[4,\"unless\",[[24,[\"isHidden\"]]],null,{\"statements\":[[0,\"  \"],[1,[28,\"component\",[[24,[\"selectKit\",\"options\",\"headerComponent\"]]],[[\"tabindex\",\"value\",\"selectedContent\",\"selectKit\"],[[24,[\"tabindex\"]],[24,[\"value\"]],[24,[\"selectedContent\"]],[24,[\"selectKit\"]]]]],false],[0,\"\\n\\n\"],[4,\"select-kit/select-kit-body\",null,[[\"selectKit\"],[[24,[\"selectKit\"]]]],{\"statements\":[[0,\"    \"],[1,[28,\"component\",[[24,[\"selectKit\",\"options\",\"filterComponent\"]]],[[\"selectKit\"],[[24,[\"selectKit\"]]]]],false],[0,\"\\n\\n\"],[4,\"if\",[[24,[\"selectKit\",\"isLoading\"]]],null,{\"statements\":[[0,\"      \"],[7,\"span\",true],[10,\"class\",\"is-loading\"],[8],[0,\"\\n\"],[4,\"if\",[[24,[\"site\"]]],null,{\"statements\":[[0,\"          \"],[1,[28,\"loading-spinner\",null,[[\"size\"],[\"small\"]]],false],[0,\"\\n\"]],\"parameters\":[]},null],[0,\"      \"],[9],[0,\"\\n\"]],\"parameters\":[]},{\"statements\":[[4,\"if\",[[24,[\"selectKit\",\"filter\"]]],null,{\"statements\":[[4,\"if\",[[24,[\"selectKit\",\"hasNoContent\"]]],null,{\"statements\":[[0,\"          \"],[7,\"span\",true],[10,\"class\",\"no-content\"],[8],[0,\"\\n            \"],[1,[28,\"i18n\",[\"select_kit.no_content\"],null],false],[0,\"\\n          \"],[9],[0,\"\\n\"]],\"parameters\":[]},null]],\"parameters\":[]},null],[0,\"\\n\"],[4,\"each\",[[24,[\"collections\"]]],null,{\"statements\":[[0,\"        \"],[1,[28,\"component\",[[28,\"component-for-collection\",[[23,1,[\"identifier\"]],[24,[\"selectKit\"]]],null]],[[\"collection\",\"selectKit\",\"value\"],[[23,1,[]],[24,[\"selectKit\"]],[24,[\"value\"]]]]],false],[0,\"\\n\"]],\"parameters\":[1]},null]],\"parameters\":[]}]],\"parameters\":[]},null],[0,\"\\n  \"],[7,\"div\",true],[10,\"class\",\"select-kit-wrapper\"],[8],[9],[0,\"\\n\"]],\"parameters\":[]},null]],\"hasEval\":false}","meta":{"moduleName":"select-kit/templates/components/single-select"}});
Ember.TEMPLATES["select-kit/templates/components/tag-chooser-row"] = Ember.HTMLBars.template({"id":null,"block":"{\"symbols\":[],\"statements\":[[1,[28,\"discourse-tag\",[[24,[\"rowValue\"]]],[[\"count\",\"noHref\"],[[24,[\"item\",\"count\"]],true]]],false],[0,\"\\n\"]],\"hasEval\":false}","meta":{"moduleName":"select-kit/templates/components/tag-chooser-row"}});
Ember.TEMPLATES["select-kit/templates/components/tag-drop/tag-drop-header"] = Ember.HTMLBars.template({"id":null,"block":"{\"symbols\":[],\"statements\":[[1,[28,\"component\",[[24,[\"selectKit\",\"options\",\"selectedNameComponent\"]]],[[\"tabindex\",\"item\",\"selectKit\",\"shouldDisplayClearableButton\"],[[24,[\"tabindex\"]],[24,[\"selectedContent\"]],[24,[\"selectKit\"]],[24,[\"shouldDisplayClearableButton\"]]]]],false],[0,\"\\n\\n\"],[1,[28,\"d-icon\",[[24,[\"caretIcon\"]]],[[\"class\"],[\"caret-icon\"]]],false],[0,\"\\n\"]],\"hasEval\":false}","meta":{"moduleName":"select-kit/templates/components/tag-drop/tag-drop-header"}});
Ember.TEMPLATES["select-kit/templates/components/tag-row"] = Ember.HTMLBars.template({"id":null,"block":"{\"symbols\":[],\"statements\":[[1,[28,\"discourse-tag\",[[24,[\"rowValue\"]]],[[\"noHref\",\"count\"],[true,[24,[\"item\",\"count\"]]]]],false],[0,\"\\n\"]],\"hasEval\":false}","meta":{"moduleName":"select-kit/templates/components/tag-row"}});
Ember.TEMPLATES["select-kit/templates/components/toolbar-popup-menu-options/toolbar-popup-menu-options-heading"] = Ember.HTMLBars.template({"id":null,"block":"{\"symbols\":[],\"statements\":[[1,[22,\"heading\"],false],[0,\"\\n\"]],\"hasEval\":false}","meta":{"moduleName":"select-kit/templates/components/toolbar-popup-menu-options/toolbar-popup-menu-options-heading"}});
Ember.TEMPLATES["select-kit/templates/components/topic-notifications-button"] = Ember.HTMLBars.template({"id":null,"block":"{\"symbols\":[],\"statements\":[[1,[28,\"topic-notifications-options\",null,[[\"value\",\"topic\",\"onChange\",\"options\"],[[24,[\"notificationLevel\"]],[24,[\"topic\"]],[28,\"action\",[[23,0,[]],\"changeTopicNotificationLevel\"],null],[28,\"hash\",null,[[\"showFullTitle\",\"placement\",\"preventsClickPropagation\"],[[24,[\"showFullTitle\"]],[24,[\"placement\"]],true]]]]]],false],[0,\"\\n\\n\"],[4,\"if\",[[24,[\"appendReason\"]]],null,{\"statements\":[[0,\"  \"],[7,\"p\",true],[10,\"class\",\"reason\"],[8],[0,\"\\n    \"],[1,[28,\"html-safe\",[[24,[\"topic\",\"details\",\"notificationReasonText\"]]],null],false],[0,\"\\n  \"],[9],[0,\"\\n\"]],\"parameters\":[]},null]],\"hasEval\":false}","meta":{"moduleName":"select-kit/templates/components/topic-notifications-button"}});
Ember.TEMPLATES["select-kit/templates/components/user-chooser/user-row"] = Ember.HTMLBars.template({"id":null,"block":"{\"symbols\":[],\"statements\":[[1,[28,\"avatar\",[[24,[\"item\"]]],[[\"imageSize\"],[\"tiny\"]]],false],[0,\"\\n\"],[7,\"span\",true],[10,\"class\",\"username\"],[8],[1,[28,\"format-username\",[[24,[\"item\",\"username\"]]],null],false],[9],[0,\"\\n\"],[7,\"span\",true],[10,\"class\",\"name\"],[8],[1,[24,[\"item\",\"name\"]],false],[9],[0,\"\\n\"]],\"hasEval\":false}","meta":{"moduleName":"select-kit/templates/components/user-chooser/user-row"}});
define("wizard/router", ["exports", "@ember/routing/router", "discourse-common/lib/get-url", "discourse-common/config/environment"], function (exports, _router, _getUrl, _environment) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });


  var Router = _router.default.extend({
    rootURL: (0, _getUrl.default)("/wizard/"),
    location: _environment.default.environment === "test" ? "none" : "history"
  });

  Router.map(function () {
    this.route("step", { path: "/steps/:step_id" });
  });

  exports.default = Router;
});
define("wizard/wizard", ["exports", "@ember/application", "discourse-common/resolver"], function (exports, _application, _resolver) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = _application.default.extend({
    rootElement: "#wizard-main",
    Resolver: (0, _resolver.buildResolver)("wizard"),

    start: function start() {
      var _this = this;

      Object.keys(requirejs._eak_seen).forEach(function (key) {
        if (/\/initializers\//.test(key)) {
          var module = requirejs(key, null, null, true);
          if (!module) {
            throw new Error(key + " must export an initializer.");
          }
          _this.initializer(module.default);
        }
      });
    }
  });
});
Ember.TEMPLATES["wizard/templates/application"] = Ember.HTMLBars.template({"id":null,"block":"{\"symbols\":[],\"statements\":[[4,\"if\",[[24,[\"showCanvas\"]]],null,{\"statements\":[[0,\"  \"],[1,[22,\"wizard-canvas\"],false],[0,\"\\n\"]],\"parameters\":[]},null],[0,\"\\n\"],[7,\"div\",true],[10,\"class\",\"wizard-column\"],[8],[0,\"\\n  \"],[7,\"div\",true],[10,\"class\",\"wizard-column-contents\"],[8],[0,\"\\n    \"],[1,[22,\"outlet\"],false],[0,\"\\n  \"],[9],[0,\"\\n  \"],[7,\"div\",true],[10,\"class\",\"wizard-footer\"],[8],[0,\"\\n    \"],[7,\"div\",true],[10,\"class\",\"discourse-logo\"],[8],[9],[0,\"\\n  \"],[9],[0,\"\\n\"],[9],[0,\"\\n\"]],\"hasEval\":false}","meta":{"moduleName":"wizard/templates/application"}});
Ember.TEMPLATES["wizard/templates/components/invite-list-user"] = Ember.HTMLBars.template({"id":null,"block":"{\"symbols\":[],\"statements\":[[7,\"span\",true],[10,\"class\",\"email\"],[8],[1,[24,[\"user\",\"email\"]],false],[9],[0,\"\\n\"],[7,\"span\",true],[10,\"class\",\"role\"],[8],[1,[22,\"roleName\"],false],[9],[0,\"\\n\\n\"],[7,\"button\",false],[12,\"class\",\"wizard-btn small danger remove-user\"],[12,\"type\",\"button\"],[3,\"action\",[[23,0,[]],[24,[\"removeUser\"]],[24,[\"user\"]]]],[8],[0,\"\\n  \"],[1,[28,\"d-icon\",[\"times\"],null],false],[0,\"\\n\"],[9],[0,\"\\n\"]],\"hasEval\":false}","meta":{"moduleName":"wizard/templates/components/invite-list-user"}});
Ember.TEMPLATES["wizard/templates/components/invite-list"] = Ember.HTMLBars.template({"id":null,"block":"{\"symbols\":[\"user\"],\"statements\":[[0,\"\\n\"],[4,\"if\",[[24,[\"users\"]]],null,{\"statements\":[[0,\"  \"],[7,\"div\",true],[10,\"class\",\"users-list\"],[8],[0,\"\\n\"],[4,\"each\",[[24,[\"users\"]]],null,{\"statements\":[[0,\"      \"],[1,[28,\"invite-list-user\",null,[[\"user\",\"roles\",\"removeUser\"],[[23,1,[]],[24,[\"roles\"]],[28,\"action\",[[23,0,[]],\"removeUser\"],null]]]],false],[0,\"\\n\"]],\"parameters\":[1]},null],[0,\"  \"],[9],[0,\"\\n\"]],\"parameters\":[]},null],[0,\"\\n\"],[7,\"div\",true],[10,\"class\",\"new-user\"],[8],[0,\"\\n  \"],[7,\"div\",true],[11,\"class\",[29,[\"text-field \",[28,\"if\",[[24,[\"invalid\"]],\"invalid\"],null]]]],[8],[0,\"\\n    \"],[1,[28,\"input\",null,[[\"class\",\"value\",\"placeholder\",\"tabindex\"],[\"invite-email wizard-focusable\",[24,[\"inviteEmail\"]],\"user@example.com\",\"9\"]]],false],[0,\"\\n  \"],[9],[0,\"\\n\\n  \"],[1,[28,\"combo-box\",null,[[\"value\",\"content\",\"nameProperty\",\"onChange\"],[[24,[\"inviteRole\"]],[24,[\"roles\"]],\"label\",[28,\"action\",[[23,0,[]],[28,\"mut\",[[24,[\"inviteRole\"]]],null]],null]]]],false],[0,\"\\n\\n  \"],[7,\"button\",false],[12,\"class\",\"wizard-btn small add-user\"],[12,\"type\",\"button\"],[3,\"action\",[[23,0,[]],\"addUser\"]],[8],[0,\"\\n    \"],[1,[28,\"d-icon\",[\"plus\"],null],false],[1,[28,\"i18n\",[\"wizard.invites.add_user\"],null],false],[0,\"\\n  \"],[9],[0,\"\\n\"],[9],[0,\"\\n\"]],\"hasEval\":false}","meta":{"moduleName":"wizard/templates/components/invite-list"}});
Ember.TEMPLATES["wizard/templates/components/popular-themes"] = Ember.HTMLBars.template({"id":null,"block":"{\"symbols\":[\"theme\"],\"statements\":[[4,\"each\",[[24,[\"popular_components\"]]],null,{\"statements\":[[0,\"  \"],[7,\"a\",true],[10,\"class\",\"popular-theme-item\"],[11,\"href\",[23,1,[\"meta_url\"]]],[10,\"rel\",\"noopener noreferrer\"],[10,\"target\",\"_blank\"],[8],[0,\"\\n    \"],[1,[23,1,[\"name\"]],false],[0,\"\\n  \"],[9],[0,\"\\n\"]],\"parameters\":[1]},null]],\"hasEval\":false}","meta":{"moduleName":"wizard/templates/components/popular-themes"}});
Ember.TEMPLATES["wizard/templates/components/radio-button"] = Ember.HTMLBars.template({"id":null,"block":"{\"symbols\":[],\"statements\":[[7,\"div\",true],[10,\"class\",\"radio-area\"],[8],[0,\"\\n  \"],[7,\"input\",true],[11,\"name\",[22,\"label\"]],[10,\"type\",\"radio\"],[8],[9],[0,\"\\n  \"],[7,\"span\",true],[10,\"class\",\"radio-label\"],[8],[0,\"\\n\"],[4,\"if\",[[24,[\"icon\"]]],null,{\"statements\":[[0,\"      \"],[1,[28,\"d-icon\",[[24,[\"icon\"]]],null],false],[0,\"\\n\"]],\"parameters\":[]},null],[0,\"    \"],[1,[22,\"label\"],false],[0,\"\\n  \"],[9],[0,\"\\n\"],[4,\"if\",[[24,[\"extraLabel\"]]],null,{\"statements\":[[0,\"    \"],[7,\"span\",true],[10,\"class\",\"extra-label\"],[8],[0,\"\\n      \"],[1,[28,\"html-safe\",[[24,[\"extraLabel\"]]],null],false],[0,\"\\n    \"],[9],[0,\"\\n\"]],\"parameters\":[]},null],[9],[0,\"\\n\"],[7,\"div\",true],[10,\"class\",\"radio-description\"],[8],[0,\"\\n  \"],[1,[22,\"description\"],false],[0,\"\\n\"],[9],[0,\"\\n\"]],\"hasEval\":false}","meta":{"moduleName":"wizard/templates/components/radio-button"}});
Ember.TEMPLATES["wizard/templates/components/staff-count"] = Ember.HTMLBars.template({"id":null,"block":"{\"symbols\":[],\"statements\":[[4,\"if\",[[24,[\"showStaffCount\"]]],null,{\"statements\":[[0,\"  \"],[7,\"div\",true],[10,\"class\",\"staff-count\"],[8],[0,\"\\n    \"],[1,[28,\"i18n\",[\"wizard.staff_count\"],[[\"count\"],[[24,[\"field\",\"value\"]]]]],false],[0,\"\\n  \"],[9],[0,\"\\n\"]],\"parameters\":[]},null]],\"hasEval\":false}","meta":{"moduleName":"wizard/templates/components/staff-count"}});
Ember.TEMPLATES["wizard/templates/components/theme-preview"] = Ember.HTMLBars.template({"id":null,"block":"{\"symbols\":[],\"statements\":[[7,\"div\",true],[10,\"class\",\"preview-area\"],[8],[0,\"\\n  \"],[7,\"canvas\",true],[11,\"width\",[22,\"elementWidth\"]],[11,\"height\",[22,\"elementHeight\"]],[11,\"style\",[22,\"canvasStyle\"]],[8],[0,\"\\n  \"],[9],[0,\"\\n\"],[9],[0,\"\\n\"]],\"hasEval\":false}","meta":{"moduleName":"wizard/templates/components/theme-preview"}});
Ember.TEMPLATES["wizard/templates/components/theme-previews"] = Ember.HTMLBars.template({"id":null,"block":"{\"symbols\":[\"choice\"],\"statements\":[[7,\"ul\",true],[10,\"class\",\"grid\"],[8],[0,\"\\n\"],[4,\"each\",[[24,[\"field\",\"choices\"]]],null,{\"statements\":[[0,\"    \"],[7,\"li\",true],[8],[0,\"\\n      \"],[1,[28,\"theme-preview\",null,[[\"colorsId\",\"wizard\",\"selectedId\",\"onChange\"],[[23,1,[\"id\"]],[24,[\"wizard\"]],[24,[\"field\",\"value\"]],[28,\"action\",[[23,0,[]],\"changed\"],null]]]],false],[0,\"\\n      \"],[1,[28,\"radio-button\",null,[[\"radioValue\",\"label\",\"value\",\"onChange\"],[[23,1,[\"id\"]],[23,1,[\"id\"]],[24,[\"field\",\"value\"]],[28,\"action\",[[23,0,[]],\"changed\"],null]]]],false],[0,\"\\n    \"],[9],[0,\"\\n\"]],\"parameters\":[1]},null],[9],[0,\"\\n\"]],\"hasEval\":false}","meta":{"moduleName":"wizard/templates/components/theme-previews"}});
Ember.TEMPLATES["wizard/templates/components/wizard-field-checkbox"] = Ember.HTMLBars.template({"id":null,"block":"{\"symbols\":[],\"statements\":[[7,\"label\",true],[8],[0,\"\\n  \"],[1,[28,\"input\",null,[[\"type\",\"class\",\"checked\"],[\"checkbox\",\"wizard-checkbox\",[24,[\"field\",\"value\"]]]]],false],[0,\"\\n  \"],[1,[24,[\"field\",\"placeholder\"]],false],[0,\"\\n\"],[9],[0,\"\\n\"]],\"hasEval\":false}","meta":{"moduleName":"wizard/templates/components/wizard-field-checkbox"}});
Ember.TEMPLATES["wizard/templates/components/wizard-field-checkboxes"] = Ember.HTMLBars.template({"id":null,"block":"{\"symbols\":[\"c\"],\"statements\":[[4,\"each\",[[24,[\"field\",\"choices\"]]],null,{\"statements\":[[0,\"  \"],[7,\"div\",true],[11,\"class\",[29,[\"checkbox-field-choice \",[22,\"fieldClass\"]]]],[8],[0,\"\\n    \"],[7,\"label\",true],[11,\"id\",[23,1,[\"id\"]]],[11,\"value\",[23,1,[\"label\"]]],[8],[0,\"\\n      \"],[1,[28,\"input\",null,[[\"type\",\"class\",\"click\",\"checked\"],[\"checkbox\",\"wizard-checkbox\",[28,\"action\",[[23,0,[]],\"changed\"],[[\"value\"],[\"target\"]]],[23,1,[\"checked\"]]]]],false],[0,\"\\n\"],[4,\"if\",[[23,1,[\"icon\"]]],null,{\"statements\":[[0,\"        \"],[1,[28,\"d-icon\",[[23,1,[\"icon\"]]],null],false],[0,\"\\n\"]],\"parameters\":[]},null],[0,\"      \"],[1,[23,1,[\"label\"]],false],[0,\"\\n    \"],[9],[0,\"\\n  \"],[9],[0,\"\\n\"]],\"parameters\":[1]},null]],\"hasEval\":false}","meta":{"moduleName":"wizard/templates/components/wizard-field-checkboxes"}});
Ember.TEMPLATES["wizard/templates/components/wizard-field-dropdown"] = Ember.HTMLBars.template({"id":null,"block":"{\"symbols\":[],\"statements\":[[1,[28,\"combo-box\",null,[[\"id\",\"class\",\"value\",\"content\",\"nameProperty\",\"tabindex\",\"onChange\"],[[24,[\"field\",\"id\"]],[24,[\"fieldClass\"]],[24,[\"field\",\"value\"]],[24,[\"field\",\"choices\"]],\"label\",\"9\",[28,\"action\",[[23,0,[]],[28,\"mut\",[[24,[\"field\",\"value\"]]],null]],null]]]],false],[0,\"\\n\"]],\"hasEval\":false}","meta":{"moduleName":"wizard/templates/components/wizard-field-dropdown"}});
Ember.TEMPLATES["wizard/templates/components/wizard-field-image"] = Ember.HTMLBars.template({"id":null,"block":"{\"symbols\":[],\"statements\":[[4,\"if\",[[24,[\"field\",\"value\"]]],null,{\"statements\":[[0,\"  \"],[1,[28,\"component\",[[24,[\"previewComponent\"]]],[[\"field\",\"fieldClass\",\"wizard\"],[[24,[\"field\"]],[24,[\"fieldClass\"]],[24,[\"wizard\"]]]]],false],[0,\"\\n\"]],\"parameters\":[]},null],[0,\"\\n\"],[7,\"label\",true],[11,\"class\",[29,[\"wizard-btn wizard-btn-upload \",[28,\"if\",[[24,[\"uploading\"]],\"disabled\"],null]]]],[8],[0,\"\\n\"],[4,\"if\",[[24,[\"uploading\"]]],null,{\"statements\":[[0,\"    \"],[1,[28,\"i18n\",[\"wizard.uploading\"],null],false],[0,\"\\n\"]],\"parameters\":[]},{\"statements\":[[0,\"    \"],[1,[28,\"i18n\",[\"wizard.upload\"],null],false],[0,\"\\n    \"],[1,[28,\"d-icon\",[\"far-image\"],null],false],[0,\"\\n\"]],\"parameters\":[]}],[0,\"\\n  \"],[7,\"input\",true],[10,\"class\",\"wizard-hidden-upload-field\"],[11,\"disabled\",[22,\"uploading\"]],[10,\"accept\",\"image/*\"],[10,\"type\",\"file\"],[8],[9],[0,\"\\n\"],[9],[0,\"\\n\"]],\"hasEval\":false}","meta":{"moduleName":"wizard/templates/components/wizard-field-image"}});
Ember.TEMPLATES["wizard/templates/components/wizard-field-radio"] = Ember.HTMLBars.template({"id":null,"block":"{\"symbols\":[\"c\"],\"statements\":[[4,\"each\",[[24,[\"field\",\"choices\"]]],null,{\"statements\":[[0,\"  \"],[7,\"div\",true],[11,\"class\",[29,[\"radio-field-choice \",[22,\"fieldClass\"]]]],[8],[0,\"\\n    \"],[1,[28,\"radio-button\",null,[[\"value\",\"radioValue\",\"label\",\"extraLabel\",\"icon\",\"description\",\"onChange\"],[[24,[\"field\",\"value\"]],[23,1,[\"id\"]],[23,1,[\"label\"]],[23,1,[\"extra_label\"]],[23,1,[\"icon\"]],[23,1,[\"description\"]],[28,\"action\",[[23,0,[]],\"changed\"],null]]]],false],[0,\"\\n  \"],[9],[0,\"\\n\"]],\"parameters\":[1]},null]],\"hasEval\":false}","meta":{"moduleName":"wizard/templates/components/wizard-field-radio"}});
Ember.TEMPLATES["wizard/templates/components/wizard-field-text"] = Ember.HTMLBars.template({"id":null,"block":"{\"symbols\":[],\"statements\":[[1,[28,\"input\",null,[[\"id\",\"value\",\"class\",\"placeholder\",\"tabindex\"],[[24,[\"field\",\"id\"]],[24,[\"field\",\"value\"]],[24,[\"fieldClass\"]],[24,[\"field\",\"placeholder\"]],\"9\"]]],false],[0,\"\\n\"]],\"hasEval\":false}","meta":{"moduleName":"wizard/templates/components/wizard-field-text"}});
Ember.TEMPLATES["wizard/templates/components/wizard-field-textarea"] = Ember.HTMLBars.template({"id":null,"block":"{\"symbols\":[],\"statements\":[[1,[28,\"textarea\",null,[[\"id\",\"value\",\"class\",\"placeholder\",\"tabindex\"],[[24,[\"field\",\"id\"]],[24,[\"field\",\"value\"]],[24,[\"fieldClass\"]],[24,[\"field\",\"placeholder\"]],\"9\"]]],false],[0,\"\\n\"]],\"hasEval\":false}","meta":{"moduleName":"wizard/templates/components/wizard-field-textarea"}});
Ember.TEMPLATES["wizard/templates/components/wizard-field"] = Ember.HTMLBars.template({"id":null,"block":"{\"symbols\":[],\"statements\":[[7,\"label\",true],[11,\"for\",[24,[\"field\",\"id\"]]],[8],[0,\"\\n  \"],[7,\"span\",true],[10,\"class\",\"label-value\"],[8],[1,[24,[\"field\",\"label\"]],false],[9],[0,\"\\n\\n\"],[4,\"if\",[[24,[\"field\",\"description\"]]],null,{\"statements\":[[0,\"    \"],[7,\"div\",true],[10,\"class\",\"field-description\"],[8],[1,[28,\"html-safe\",[[24,[\"field\",\"description\"]]],null],false],[9],[0,\"\\n\"]],\"parameters\":[]},null],[9],[0,\"\\n\\n\"],[7,\"div\",true],[10,\"class\",\"input-area\"],[8],[0,\"\\n  \"],[1,[28,\"component\",[[24,[\"inputComponentName\"]]],[[\"field\",\"step\",\"fieldClass\",\"wizard\"],[[24,[\"field\"]],[24,[\"step\"]],[24,[\"fieldClass\"]],[24,[\"wizard\"]]]]],false],[0,\"\\n\"],[9],[0,\"\\n\\n\"],[4,\"if\",[[24,[\"field\",\"errorDescription\"]]],null,{\"statements\":[[0,\"  \"],[7,\"div\",true],[10,\"class\",\"field-error-description\"],[8],[1,[28,\"html-safe\",[[24,[\"field\",\"errorDescription\"]]],null],false],[9],[0,\"\\n\"]],\"parameters\":[]},null]],\"hasEval\":false}","meta":{"moduleName":"wizard/templates/components/wizard-field"}});
Ember.TEMPLATES["wizard/templates/components/wizard-image-preview"] = Ember.HTMLBars.template({"id":null,"block":"{\"symbols\":[],\"statements\":[[7,\"img\",true],[11,\"src\",[24,[\"field\",\"value\"]]],[11,\"class\",[22,\"fieldClass\"]],[8],[9],[0,\"\\n\"]],\"hasEval\":false}","meta":{"moduleName":"wizard/templates/components/wizard-image-preview"}});
Ember.TEMPLATES["wizard/templates/components/wizard-step"] = Ember.HTMLBars.template({"id":null,"block":"{\"symbols\":[\"field\"],\"statements\":[[7,\"div\",true],[10,\"class\",\"wizard-step-contents\"],[8],[0,\"\\n\"],[4,\"if\",[[24,[\"step\",\"title\"]]],null,{\"statements\":[[0,\"    \"],[7,\"h1\",true],[10,\"class\",\"wizard-step-title\"],[8],[1,[24,[\"step\",\"title\"]],false],[9],[0,\"\\n\"]],\"parameters\":[]},null],[0,\"\\n  \"],[7,\"div\",true],[11,\"class\",[22,\"bannerAndDescriptionClass\"]],[8],[0,\"\\n\"],[4,\"if\",[[24,[\"bannerImage\"]]],null,{\"statements\":[[0,\"      \"],[7,\"img\",true],[11,\"src\",[22,\"bannerImage\"]],[10,\"class\",\"wizard-step-banner\"],[8],[9],[0,\"\\n\"]],\"parameters\":[]},null],[0,\"\\n\"],[4,\"if\",[[24,[\"step\",\"description\"]]],null,{\"statements\":[[0,\"      \"],[7,\"p\",true],[10,\"class\",\"wizard-step-description\"],[8],[1,[28,\"html-safe\",[[24,[\"step\",\"description\"]]],null],false],[9],[0,\"\\n\"]],\"parameters\":[]},null],[0,\"  \"],[9],[0,\"\\n\\n\"],[4,\"wizard-step-form\",null,[[\"step\"],[[24,[\"step\"]]]],{\"statements\":[[4,\"each\",[[24,[\"step\",\"fields\"]]],null,{\"statements\":[[0,\"      \"],[1,[28,\"wizard-field\",null,[[\"field\",\"step\",\"wizard\"],[[23,1,[]],[24,[\"step\"]],[24,[\"wizard\"]]]]],false],[0,\"\\n\"]],\"parameters\":[1]},null]],\"parameters\":[]},null],[9],[0,\"\\n\\n\"],[7,\"div\",true],[10,\"class\",\"wizard-step-footer\"],[8],[0,\"\\n\\n  \"],[7,\"div\",true],[10,\"class\",\"wizard-progress\"],[8],[0,\"\\n    \"],[7,\"div\",true],[10,\"class\",\"white\"],[8],[9],[0,\"\\n    \"],[7,\"div\",true],[11,\"style\",[22,\"barStyle\"]],[10,\"class\",\"black\"],[8],[9],[0,\"\\n    \"],[7,\"div\",true],[10,\"class\",\"screen\"],[8],[9],[0,\"\\n    \"],[7,\"span\",true],[8],[1,[28,\"bound-i18n\",[\"wizard.step\"],[[\"current\",\"total\"],[[24,[\"step\",\"displayIndex\"]],[24,[\"wizard\",\"totalSteps\"]]]]],false],[9],[0,\"\\n  \"],[9],[0,\"\\n\\n  \"],[7,\"div\",true],[10,\"class\",\"wizard-buttons\"],[8],[0,\"\\n\"],[4,\"if\",[[24,[\"showQuitButton\"]]],null,{\"statements\":[[0,\"      \"],[7,\"a\",false],[12,\"href\",\"\"],[12,\"tabindex\",\"11\"],[12,\"class\",\"action-link quit\"],[3,\"action\",[[23,0,[]],\"quit\"]],[8],[1,[28,\"i18n\",[\"wizard.quit\"],null],false],[9],[0,\"\\n\"]],\"parameters\":[]},null],[0,\"\\n\"],[4,\"if\",[[24,[\"showFinishButton\"]]],null,{\"statements\":[[0,\"      \"],[7,\"button\",false],[12,\"disabled\",[22,\"saving\"]],[12,\"tabindex\",\"10\"],[12,\"class\",\"wizard-btn finish\"],[12,\"type\",\"button\"],[3,\"action\",[[23,0,[]],\"exitEarly\"]],[8],[0,\"\\n        \"],[1,[28,\"i18n\",[\"wizard.finish\"],null],false],[0,\"\\n      \"],[9],[0,\"\\n\"]],\"parameters\":[]},null],[0,\"\\n\"],[4,\"if\",[[24,[\"showBackButton\"]]],null,{\"statements\":[[0,\"      \"],[7,\"a\",false],[12,\"href\",\"\"],[12,\"tabindex\",\"11\"],[12,\"class\",\"action-link back\"],[3,\"action\",[[23,0,[]],\"backStep\"]],[8],[1,[28,\"i18n\",[\"wizard.back\"],null],false],[9],[0,\"\\n\"]],\"parameters\":[]},null],[0,\"\\n\"],[4,\"if\",[[24,[\"showNextButton\"]]],null,{\"statements\":[[0,\"      \"],[7,\"button\",false],[12,\"disabled\",[22,\"saving\"]],[12,\"tabindex\",\"10\"],[12,\"class\",\"wizard-btn next primary\"],[12,\"type\",\"button\"],[3,\"action\",[[23,0,[]],\"nextStep\"]],[8],[0,\"\\n        \"],[1,[28,\"i18n\",[\"wizard.next\"],null],false],[0,\"\\n        \"],[1,[28,\"d-icon\",[\"chevron-right\"],null],false],[0,\"\\n      \"],[9],[0,\"\\n\"]],\"parameters\":[]},null],[0,\"\\n\"],[4,\"if\",[[24,[\"showDoneButton\"]]],null,{\"statements\":[[0,\"      \"],[7,\"button\",false],[12,\"disabled\",[22,\"saving\"]],[12,\"tabindex\",\"10\"],[12,\"class\",\"wizard-btn done\"],[12,\"type\",\"button\"],[3,\"action\",[[23,0,[]],\"quit\"]],[8],[0,\"\\n        \"],[1,[28,\"i18n\",[\"wizard.done\"],null],false],[0,\"\\n      \"],[9],[0,\"\\n\"]],\"parameters\":[]},null],[0,\"  \"],[9],[0,\"\\n\\n\"],[9],[0,\"\\n\"]],\"hasEval\":false}","meta":{"moduleName":"wizard/templates/components/wizard-step"}});
Ember.TEMPLATES["wizard/templates/step"] = Ember.HTMLBars.template({"id":null,"block":"{\"symbols\":[],\"statements\":[[1,[28,\"wizard-step\",null,[[\"step\",\"wizard\",\"goNext\",\"goBack\"],[[24,[\"step\"]],[24,[\"wizard\"]],[28,\"action\",[[23,0,[]],\"goNext\"],null],[28,\"action\",[[23,0,[]],\"goBack\"],null]]]],false],[0,\"\\n\"]],\"hasEval\":false}","meta":{"moduleName":"wizard/templates/step"}});
define("wizard/components/homepage-preview", ["exports", "discourse-common/utils/decorators", "wizard/lib/preview"], function (exports, _decorators, _preview) {
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

  var _dec, _desc, _value, _obj;

  exports.default = (0, _preview.createPreviewComponent)(659, 320, (_dec = (0, _decorators.observes)("step.fieldsById.homepage_style.value"), (_obj = {
    logo: null,
    avatar: null,

    styleChanged: function styleChanged() {
      this.triggerRepaint();
    },
    images: function images() {
      return {
        logo: this.wizard.getLogoUrl(),
        avatar: "/images/wizard/trout.png"
      };
    },
    paint: function paint(ctx, colors, width, height) {
      this.drawFullHeader(colors);

      if (this.get("step.fieldsById.homepage_style.value") === "latest") {
        this.drawPills(colors, height * 0.15);
        this.renderLatest(ctx, colors, width, height);
      } else if (["categories_only", "categories_with_featured_topics"].includes(this.get("step.fieldsById.homepage_style.value"))) {
        this.drawPills(colors, height * 0.15, { categories: true });
        this.renderCategories(ctx, colors, width, height);
      } else if (["categories_boxes", "categories_boxes_with_topics"].includes(this.get("step.fieldsById.homepage_style.value"))) {
        this.drawPills(colors, height * 0.15, { categories: true });
        var topics = this.get("step.fieldsById.homepage_style.value") === "categories_boxes_with_topics";
        this.renderCategoriesBoxes(ctx, colors, width, height, { topics: topics });
      } else {
        this.drawPills(colors, height * 0.15, { categories: true });
        this.renderCategoriesWithTopics(ctx, colors, width, height);
      }
    },
    renderCategoriesBoxes: function renderCategoriesBoxes(ctx, colors, width, height, opts) {
      var _this = this;

      opts = opts || {};

      var borderColor = (0, _preview.darkLightDiff)(colors.primary, colors.secondary, 90, -75);
      var textColor = (0, _preview.darkLightDiff)(colors.primary, colors.secondary, 50, 50);
      var margin = height * 0.03;
      var bodyFontSize = height / 440.0;
      var boxHeight = height * 0.7 - margin * 2;
      var descriptions = this.getDescriptions();
      var boxesSpacing = 15;
      var boxWidth = (width - margin * 2 - boxesSpacing * 2) / 3;

      this.categories().forEach(function (category, index) {
        var boxStartX = margin + index * boxWidth + index * boxesSpacing;
        var boxStartY = height * 0.33;

        _this.drawSquare(ctx, { x: boxStartX, y: boxStartY }, { x: boxStartX + boxWidth, y: boxStartY + boxHeight }, [{ color: borderColor }, { color: borderColor }, { color: borderColor }, { color: category.color, width: 5 }]);

        ctx.font = "Bold " + bodyFontSize * 1.3 + "em 'Arial'";
        ctx.fillStyle = colors.primary;
        ctx.textAlign = "center";
        ctx.fillText(category.name, boxStartX + boxWidth / 2, boxStartY + 25);
        ctx.textAlign = "left";

        if (opts.topics) {
          var startY = boxStartY + 60;
          _this.getTitles().forEach(function (title) {
            ctx.font = bodyFontSize * 1 + "em 'Arial'";
            ctx.fillStyle = colors.tertiary;
            startY += _this.fillTextMultiLine(ctx, title.split("\n").join(" "), boxStartX + 10, startY, 13, boxWidth * 0.95) + 8;
          });
        } else {
          ctx.font = bodyFontSize * 1 + "em 'Arial'";
          ctx.fillStyle = textColor;
          ctx.textAlign = "center";
          _this.fillTextMultiLine(ctx, descriptions[index], boxStartX + boxWidth / 2, boxStartY + 60, 13, boxWidth * 0.8);
          ctx.textAlign = "left";
        }
      });
    },
    renderCategories: function renderCategories(ctx, colors, width, height) {
      var _this2 = this;

      var textColor = (0, _preview.darkLightDiff)(colors.primary, colors.secondary, 50, 50);
      var margin = height * 0.03;
      var bodyFontSize = height / 440.0;
      var titles = this.getTitles();
      var categoryHeight = height / 6;

      var drawLine = function drawLine(x, y) {
        ctx.beginPath();
        ctx.strokeStyle = (0, _preview.darkLightDiff)(colors.primary, colors.secondary, 90, -75);
        ctx.moveTo(margin + x, y);
        ctx.lineTo(width - margin, y);
        ctx.stroke();
      };

      var cols = [0.025, 0.45, 0.53, 0.58, 0.94, 0.96].map(function (c) {
        return c * width;
      });

      var headingY = height * 0.33;
      ctx.font = bodyFontSize * 0.9 + "em 'Arial'";
      ctx.fillStyle = textColor;
      ctx.fillText("Category", cols[0], headingY);
      if (this.get("step.fieldsById.homepage_style.value") === "categories_only") {
        ctx.fillText("Topics", cols[4], headingY);
      } else {
        ctx.fillText("Topics", cols[1], headingY);
        ctx.fillText("Latest", cols[2], headingY);
        categoryHeight = height / 5;
      }

      var y = headingY + bodyFontSize * 12;
      ctx.lineWidth = 2;
      drawLine(0, y);
      drawLine(width / 2, y);

      // Categories
      this.categories().forEach(function (category) {
        var textPos = y + categoryHeight * 0.35;
        ctx.font = "Bold " + bodyFontSize * 1.1 + "em 'Arial'";
        ctx.fillStyle = colors.primary;
        ctx.fillText(category.name, cols[0], textPos);

        ctx.font = bodyFontSize * 0.8 + "em 'Arial'";
        ctx.fillStyle = textColor;
        ctx.fillText(titles[0], cols[0] - margin * 0.25, textPos + categoryHeight * 0.36);

        ctx.beginPath();
        ctx.moveTo(margin, y);
        ctx.strokeStyle = category.color;
        ctx.lineWidth = 3.5;
        ctx.lineTo(margin, y + categoryHeight);
        ctx.stroke();

        if (_this2.get("step.fieldsById.homepage_style.value") === "categories_with_featured_topics") {
          ctx.font = bodyFontSize + "em 'Arial'";
          ctx.fillText(Math.floor(Math.random() * 90) + 10, cols[1] + 15, textPos);
        } else {
          ctx.font = bodyFontSize + "em 'Arial'";
          ctx.fillText(Math.floor(Math.random() * 90) + 10, cols[5], textPos);
        }

        y += categoryHeight;
        ctx.lineWidth = 1;
        drawLine(0, y);
      });

      // Featured Topics
      if (this.get("step.fieldsById.homepage_style.value") === "categories_with_featured_topics") {
        var topicHeight = height / 15;

        y = headingY + bodyFontSize * 22;
        ctx.lineWidth = 1;
        ctx.fillStyle = colors.tertiary;

        titles.forEach(function (title) {
          ctx.font = bodyFontSize + "em 'Arial'";
          var textPos = y + topicHeight * 0.35;
          ctx.fillStyle = colors.tertiary;
          ctx.fillText("" + title, cols[2], textPos);
          y += topicHeight;
        });
      }
    },
    renderCategoriesWithTopics: function renderCategoriesWithTopics(ctx, colors, width, height) {
      var _this3 = this;

      var textColor = (0, _preview.darkLightDiff)(colors.primary, colors.secondary, 50, 50);
      var margin = height * 0.03;
      var bodyFontSize = height / 440.0;

      var drawLine = function drawLine(x, y) {
        ctx.beginPath();
        ctx.strokeStyle = (0, _preview.darkLightDiff)(colors.primary, colors.secondary, 90, -75);
        ctx.moveTo(margin + x, y);
        ctx.lineTo(margin + x + width * 0.9 / 2, y);
        ctx.stroke();
      };

      var cols = [0.025, 0.42, 0.53, 0.58, 0.94].map(function (c) {
        return c * width;
      });

      var headingY = height * 0.33;
      ctx.font = bodyFontSize * 0.9 + "em 'Arial'";
      ctx.fillStyle = textColor;
      ctx.fillText("Category", cols[0], headingY);
      ctx.fillText("Topics", cols[1], headingY);
      if (this.get("step.fieldsById.homepage_style.value") === "categories_and_latest_topics") {
        ctx.fillText("Latest", cols[2], headingY);
      } else {
        ctx.fillText("Top", cols[2], headingY);
      }

      var y = headingY + bodyFontSize * 12;
      ctx.lineWidth = 2;
      drawLine(0, y);
      drawLine(width / 2, y);

      var categoryHeight = height / 6;
      var titles = this.getTitles();

      // Categories
      this.categories().forEach(function (category) {
        var textPos = y + categoryHeight * 0.35;
        ctx.font = "Bold " + bodyFontSize * 1.1 + "em 'Arial'";
        ctx.fillStyle = colors.primary;
        ctx.fillText(category.name, cols[0], textPos);

        ctx.font = bodyFontSize * 0.8 + "em 'Arial'";
        ctx.fillStyle = textColor;
        ctx.fillText(titles[0], cols[0] - margin * 0.25, textPos + categoryHeight * 0.36);

        ctx.beginPath();
        ctx.moveTo(margin, y);
        ctx.strokeStyle = category.color;
        ctx.lineWidth = 3.5;
        ctx.lineTo(margin, y + categoryHeight);
        ctx.stroke();

        ctx.font = bodyFontSize + "em 'Arial'";
        ctx.fillText(Math.floor(Math.random() * 90) + 10, cols[1] + 15, textPos);

        y += categoryHeight;
        ctx.lineWidth = 1;
        drawLine(0, y);
      });

      // Latest/Top Topics
      var topicHeight = height / 8;
      var avatarSize = topicHeight * 0.7;
      y = headingY + bodyFontSize * 12;
      ctx.lineWidth = 1;
      ctx.fillStyle = textColor;

      titles.forEach(function (title) {
        var category = _this3.categories()[0];
        ctx.font = bodyFontSize + "em 'Arial'";
        var textPos = y + topicHeight * 0.45;
        ctx.fillStyle = textColor;
        _this3.scaleImage(_this3.avatar, cols[2], y + margin * 0.6, avatarSize, avatarSize);
        ctx.fillText(title, cols[3], textPos);

        ctx.font = "Bold " + bodyFontSize + "em 'Arial'";
        ctx.fillText(Math.floor(Math.random() * 90) + 10, cols[4], textPos);
        ctx.font = bodyFontSize + "em 'Arial'";
        ctx.fillText("1h", cols[4], textPos + topicHeight * 0.4);

        ctx.beginPath();
        ctx.fillStyle = category.color;
        var badgeSize = topicHeight * 0.1;
        ctx.font = "Bold " + bodyFontSize * 0.5 + "em 'Arial'";
        ctx.rect(cols[3] + margin * 0.5, y + topicHeight * 0.65, badgeSize, badgeSize);
        ctx.fill();

        ctx.fillStyle = colors.primary;
        ctx.fillText(category.name, cols[3] + badgeSize * 3, y + topicHeight * 0.76);
        y += topicHeight;

        drawLine(width / 2, y);
      });
    },
    getTitles: function getTitles() {
      return _preview.LOREM.split(".").slice(0, 8).map(function (t) {
        return t.substring(0, 40);
      });
    },
    getDescriptions: function getDescriptions() {
      return _preview.LOREM.split(".");
    },
    renderLatest: function renderLatest(ctx, colors, width, height) {
      var _this4 = this;

      var rowHeight = height / 6.6;
      var textColor = (0, _preview.darkLightDiff)(colors.primary, colors.secondary, 50, 50);
      var bodyFontSize = height / 440.0;

      ctx.font = bodyFontSize + "em 'Arial'";

      var margin = height * 0.03;

      var drawLine = function drawLine(y) {
        ctx.beginPath();
        ctx.strokeStyle = (0, _preview.darkLightDiff)(colors.primary, colors.secondary, 90, -75);
        ctx.moveTo(margin, y);
        ctx.lineTo(width - margin, y);
        ctx.stroke();
      };

      var cols = [0.02, 0.66, 0.8, 0.87, 0.93].map(function (c) {
        return c * width;
      });

      // Headings
      var headingY = height * 0.33;

      ctx.fillStyle = textColor;
      ctx.font = bodyFontSize * 0.9 + "em 'Arial'";
      ctx.fillText("Topic", cols[0], headingY);
      ctx.fillText("Replies", cols[2], headingY);
      ctx.fillText("Views", cols[3], headingY);
      ctx.fillText("Activity", cols[4], headingY);

      // Topics
      var y = headingY + rowHeight / 2.6;
      ctx.lineWidth = 2;
      drawLine(y);

      ctx.font = bodyFontSize + "em 'Arial'";
      ctx.lineWidth = 1;
      this.getTitles().forEach(function (title) {
        var textPos = y + rowHeight * 0.4;
        ctx.fillStyle = textColor;
        ctx.fillText(title, cols[0], textPos);

        var category = _this4.categories()[0];
        ctx.beginPath();
        ctx.fillStyle = category.color;
        var badgeSize = rowHeight * 0.15;
        ctx.font = "Bold " + bodyFontSize * 0.75 + "em 'Arial'";
        ctx.rect(cols[0] + 4, y + rowHeight * 0.6, badgeSize, badgeSize);
        ctx.fill();

        ctx.fillStyle = colors.primary;
        ctx.fillText(category.name, cols[0] + badgeSize * 2, y + rowHeight * 0.73);
        _this4.scaleImage(_this4.avatar, cols[1], y + rowHeight * 0.25, rowHeight * 0.5, rowHeight * 0.5);

        ctx.fillStyle = textColor;
        ctx.font = bodyFontSize + "em 'Arial'";
        for (var j = 2; j <= 4; j++) {
          ctx.fillText(j === 5 ? "1h" : Math.floor(Math.random() * 90) + 10, cols[j] + margin, y + rowHeight * 0.6);
        }
        drawLine(y + rowHeight * 1);
        y += rowHeight;
      });
    },
    fillTextMultiLine: function fillTextMultiLine(ctx, text, x, y, lineHeight, maxWidth) {
      var words = text.split(" ").filter(function (f) {
        return f;
      });
      var line = "";
      var totalHeight = 0;

      words.forEach(function (word) {
        if (ctx.measureText(line + " " + word + " ").width >= maxWidth) {
          ctx.fillText(line, x, y + totalHeight);
          totalHeight += lineHeight;
          line = word.trim();
        } else {
          line = (line + " " + word).trim();
        }
      });

      ctx.fillText(line, x, y + totalHeight);
      totalHeight += lineHeight;

      return totalHeight;
    },


    // Edges expected in this order: NW to NE -> NE to SE -> SE to SW -> SW to NW
    drawSquare: function drawSquare(ctx, from, to) {
      var edges = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : [];

      var edgeConfiguration = function edgeConfiguration(index) {
        var edge = edges[index] || {};

        return {
          width: edge.width || 1,
          color: edge.color || "#333"
        };
      };

      [{ from: { x: from.x, y: from.y }, to: { x: to.x, y: from.y } }, { from: { x: to.x, y: from.y }, to: { x: to.x, y: to.y } }, { from: { x: to.x, y: to.y }, to: { x: from.x, y: to.y } }, { from: { x: from.x, y: to.y }, to: { x: from.x, y: from.y } }].forEach(function (path, index) {
        var configuration = edgeConfiguration(index);
        ctx.beginPath();
        ctx.moveTo(path.from.x, path.from.y);
        ctx.strokeStyle = configuration.color;
        ctx.lineWidth = configuration.width;
        ctx.lineTo(path.to.x, path.to.y);
        ctx.stroke();
      });
    }
  }, (_applyDecoratedDescriptor(_obj, "styleChanged", [_dec], Object.getOwnPropertyDescriptor(_obj, "styleChanged"), _obj)), _obj)));
});
define("wizard/components/image-preview-favicon", ["exports", "discourse-common/utils/decorators", "wizard/lib/preview"], function (exports, _decorators, _preview) {
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

  var _dec, _desc, _value, _obj;

  exports.default = (0, _preview.createPreviewComponent)(371, 124, (_dec = (0, _decorators.observes)("field.value"), (_obj = {
    tab: null,
    image: null,

    imageChanged: function imageChanged() {
      this.reload();
    },
    images: function images() {
      return { tab: "/images/wizard/tab.png", image: this.get("field.value") };
    },
    paint: function paint(ctx, colors, width, height) {
      this.scaleImage(this.tab, 0, 0, width, height);
      this.scaleImage(this.image, 40, 25, 30, 30);

      ctx.font = "20px 'Arial'";
      ctx.fillStyle = "#000";

      var title = this.wizard.getTitle();
      if (title.length > 20) {
        title = title.substring(0, 20) + "...";
      }

      ctx.fillText(title, 80, 48);
    }
  }, (_applyDecoratedDescriptor(_obj, "imageChanged", [_dec], Object.getOwnPropertyDescriptor(_obj, "imageChanged"), _obj)), _obj)));
});
define("wizard/components/image-preview-large-icon", ["exports", "discourse-common/utils/decorators", "wizard/lib/preview"], function (exports, _decorators, _preview) {
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

  var _dec, _desc, _value, _obj;

  exports.default = (0, _preview.createPreviewComponent)(325, 125, (_dec = (0, _decorators.observes)("field.value"), (_obj = {
    ios: null,
    image: null,

    imageChanged: function imageChanged() {
      this.reload();
    },
    images: function images() {
      return {
        ios: "/images/wizard/apple-mask.png",
        image: this.get("field.value")
      };
    },
    paint: function paint(ctx, colors, width, height) {
      this.scaleImage(this.image, 10, 8, 87, 87);
      this.scaleImage(this.ios, 0, 0, width, height);
    }
  }, (_applyDecoratedDescriptor(_obj, "imageChanged", [_dec], Object.getOwnPropertyDescriptor(_obj, "imageChanged"), _obj)), _obj)));
});
define("wizard/components/image-preview-logo-small", ["exports", "discourse-common/utils/decorators", "wizard/lib/preview"], function (exports, _decorators, _preview) {
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

  var _dec, _desc, _value, _obj;

  exports.default = (0, _preview.createPreviewComponent)(375, 100, (_dec = (0, _decorators.observes)("field.value"), (_obj = {
    image: null,

    imageChanged: function imageChanged() {
      this.reload();
    },
    images: function images() {
      return { image: this.get("field.value") };
    },
    paint: function paint(ctx, colors, width, height) {
      var headerHeight = height / 2;

      (0, _preview.drawHeader)(ctx, colors, width, headerHeight);

      var image = this.image;
      var headerMargin = headerHeight * 0.2;

      var maxWidth = headerHeight - headerMargin * 2.0;
      var imageWidth = image.width;
      var ratio = 1.0;
      if (imageWidth > maxWidth) {
        ratio = maxWidth / imageWidth;
        imageWidth = maxWidth;
      }

      this.scaleImage(image, headerMargin, headerMargin, imageWidth, image.height * ratio);

      var afterLogo = headerMargin * 1.7 + imageWidth;
      var fontSize = Math.round(headerHeight * 0.4);
      ctx.font = "Bold " + fontSize + "px 'Arial'";
      ctx.fillStyle = colors.primary;
      var title = _preview.LOREM.substring(0, 27);
      ctx.fillText(title, headerMargin + imageWidth, headerHeight - fontSize * 1.1);

      var category = this.categories()[0];
      var badgeSize = height / 13.0;
      ctx.beginPath();
      ctx.fillStyle = category.color;
      ctx.rect(afterLogo, headerHeight * 0.7, badgeSize, badgeSize);
      ctx.fill();

      ctx.font = "Bold " + badgeSize * 1.2 + "px 'Arial'";
      ctx.fillStyle = colors.primary;
      ctx.fillText(category.name, afterLogo + badgeSize * 1.5, headerHeight * 0.7 + badgeSize * 0.9);

      var LINE_HEIGHT = 12;
      ctx.font = LINE_HEIGHT + "px 'Arial'";
      var lines = _preview.LOREM.split("\n");
      for (var i = 0; i < 10; i++) {
        var line = height * 0.55 + i * (LINE_HEIGHT * 1.5);
        ctx.fillText(lines[i], afterLogo, line);
      }
    }
  }, (_applyDecoratedDescriptor(_obj, "imageChanged", [_dec], Object.getOwnPropertyDescriptor(_obj, "imageChanged"), _obj)), _obj)));
});
define("wizard/components/image-preview-logo", ["exports", "discourse-common/utils/decorators", "wizard/lib/preview"], function (exports, _decorators, _preview) {
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

  var _dec, _desc, _value, _obj;

  exports.default = (0, _preview.createPreviewComponent)(400, 100, (_dec = (0, _decorators.observes)("field.value"), (_obj = {
    image: null,

    imageChanged: function imageChanged() {
      this.reload();
    },
    images: function images() {
      return { image: this.get("field.value") };
    },
    paint: function paint(ctx, colors, width, height) {
      var headerHeight = height / 2;

      (0, _preview.drawHeader)(ctx, colors, width, headerHeight);

      var image = this.image;
      var headerMargin = headerHeight * 0.2;

      var imageHeight = headerHeight - headerMargin * 2;
      var ratio = imageHeight / image.height;
      this.scaleImage(image, headerMargin, headerMargin, image.width * ratio, imageHeight);

      this.drawPills(colors, height / 2);
    }
  }, (_applyDecoratedDescriptor(_obj, "imageChanged", [_dec], Object.getOwnPropertyDescriptor(_obj, "imageChanged"), _obj)), _obj)));
});
define("wizard/components/invite-list-user", ["exports", "@ember/component", "discourse-common/utils/decorators"], function (exports, _component, _decorators) {
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

  var _dec, _desc, _value, _obj;

  exports.default = _component.default.extend((_dec = (0, _decorators.default)("user.role"), (_obj = {
    classNames: ["invite-list-user"],

    roleName: function roleName(role) {
      return this.roles.findBy("id", role).label;
    }
  }, (_applyDecoratedDescriptor(_obj, "roleName", [_dec], Object.getOwnPropertyDescriptor(_obj, "roleName"), _obj)), _obj)));
});
define("wizard/components/invite-list", ["exports", "@ember/runloop", "@ember/component"], function (exports, _runloop, _component) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = _component.default.extend({
    classNames: ["invite-list"],
    users: null,
    inviteEmail: "",
    inviteRole: "",
    invalid: false,

    init: function init() {
      this._super.apply(this, arguments);
      this.set("users", []);

      this.set("roles", [{ id: "moderator", label: I18n.t("wizard.invites.roles.moderator") }, { id: "regular", label: I18n.t("wizard.invites.roles.regular") }]);

      this.set("inviteRole", this.get("roles.0.id"));

      this.updateField();
    },
    keyPress: function keyPress(e) {
      if (e.keyCode === 13) {
        e.preventDefault();
        e.stopPropagation();
        this.send("addUser");
      }
    },
    updateField: function updateField() {
      var users = this.users;

      this.set("field.value", JSON.stringify(users));

      var staffCount = this.get("step.fieldsById.staff_count.value") || 1;
      var showWarning = staffCount < 3 && users.length === 0;

      this.set("field.warning", showWarning ? "invites.none_added" : null);
    },


    actions: {
      addUser: function addUser() {
        var _this = this;

        var user = {
          email: this.inviteEmail || "",
          role: this.inviteRole
        };

        if (!/(.+)@(.+){2,}\.(.+){2,}/.test(user.email)) {
          return this.set("invalid", true);
        }

        var users = this.users;
        if (users.findBy("email", user.email)) {
          return this.set("invalid", true);
        }

        this.set("invalid", false);

        users.pushObject(user);
        this.updateField();

        this.set("inviteEmail", "");
        (0, _runloop.schedule)("afterRender", function () {
          return _this.element.querySelector(".invite-email").focus();
        });
      },
      removeUser: function removeUser(user) {
        this.users.removeObject(user);
        this.updateField();
      }
    }
  });
});
define("wizard/components/popular-themes", ["exports", "@ember/component", "discourse-common/helpers/popular-themes"], function (exports, _component, _popularThemes) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = _component.default.extend({
    classNames: ["popular-themes"],

    init: function init() {
      this._super.apply(this, arguments);

      this.popular_components = this.selectedThemeComponents();
    },
    selectedThemeComponents: function selectedThemeComponents() {
      return this.shuffle().filter(function (theme) {
        return theme.component;
      }).slice(0, 5);
    },
    shuffle: function shuffle() {
      var array = _popularThemes.POPULAR_THEMES;

      // https://stackoverflow.com/a/12646864
      for (var i = array.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var _ref = [array[j], array[i]];
        array[i] = _ref[0];
        array[j] = _ref[1];
      }

      return array;
    }
  });
});
define("wizard/components/radio-button", ["exports", "@ember/runloop", "@ember/component", "discourse-common/utils/decorators"], function (exports, _runloop, _component, _decorators) {
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

  exports.default = _component.default.extend((_dec = (0, _decorators.observes)("value"), _dec2 = (0, _decorators.on)("init"), (_obj = {
    tagName: "label",

    click: function click(e) {
      e.preventDefault();
      this.onChange(this.radioValue);
    },
    updateVal: function updateVal() {
      var _this = this;

      var checked = this.value === this.radioValue;
      (0, _runloop.next)(function () {
        return _this.element.querySelector("input[type=radio]").checked = checked;
      });
    }
  }, (_applyDecoratedDescriptor(_obj, "updateVal", [_dec, _dec2], Object.getOwnPropertyDescriptor(_obj, "updateVal"), _obj)), _obj)));
});
define("wizard/components/staff-count", ["exports", "@ember/component", "discourse-common/utils/decorators"], function (exports, _component, _decorators) {
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

  var _dec, _desc, _value, _obj, _init;

  exports.default = _component.default.extend((_dec = (0, _decorators.default)("field.value"), (_obj = {
    showStaffCount: function showStaffCount(staffCount) {
      return staffCount > 1;
    }
  }, (_applyDecoratedDescriptor(_obj, "showStaffCount", [_dec], (_init = Object.getOwnPropertyDescriptor(_obj, "showStaffCount"), _init = _init ? _init.value : undefined, {
    enumerable: true,
    configurable: true,
    writable: true,
    initializer: function initializer() {
      return _init;
    }
  }), _obj)), _obj)));
});
define("wizard/components/theme-preview", ["exports", "discourse-common/utils/decorators", "wizard/lib/preview"], function (exports, _decorators, _preview) {
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

  exports.default = (0, _preview.createPreviewComponent)(305, 165, (_dec = (0, _decorators.default)("selectedId", "colorsId"), _dec2 = (0, _decorators.observes)("step.fieldsById.base_scheme_id.value"), (_obj = {
    logo: null,
    avatar: null,

    classNameBindings: ["isSelected"],

    isSelected: function isSelected(selectedId, colorsId) {
      return selectedId === colorsId;
    },
    click: function click() {
      this.onChange(this.colorsId);
    },
    themeChanged: function themeChanged() {
      this.triggerRepaint();
    },
    images: function images() {
      return {
        logo: this.wizard.getLogoUrl(),
        avatar: "/images/wizard/trout.png"
      };
    },
    paint: function paint(ctx, colors, width, height) {
      var headerHeight = height * 0.3;

      this.drawFullHeader(colors);

      var margin = width * 0.04;
      var avatarSize = height * 0.2;
      var lineHeight = height / 9.5;

      // Draw a fake topic
      this.scaleImage(this.avatar, margin, headerHeight + height * 0.085, avatarSize, avatarSize);

      var titleFontSize = headerHeight / 44;

      ctx.beginPath();
      ctx.fillStyle = colors.primary;
      ctx.font = "bold " + titleFontSize + "em 'Arial'";
      ctx.fillText(I18n.t("wizard.previews.topic_title"), margin, height * 0.3);

      var bodyFontSize = height / 220.0;
      ctx.font = bodyFontSize + "em 'Arial'";

      var line = 0;
      var lines = _preview.LOREM.split("\n");
      for (var i = 0; i < 4; i++) {
        line = height * 0.35 + i * lineHeight;
        ctx.fillText(lines[i], margin + avatarSize + margin, line);
      }

      // Share Button
      ctx.beginPath();
      ctx.rect(margin, line + lineHeight, width * 0.14, height * 0.14);
      ctx.fillStyle = (0, _preview.darkLightDiff)(colors.primary, colors.secondary, 90, 65);
      ctx.fill();
      ctx.fillStyle = (0, _preview.chooseDarker)(colors.primary, colors.secondary);
      ctx.font = bodyFontSize + "em 'Arial'";
      ctx.fillText(I18n.t("wizard.previews.share_button"), margin + width / 55, line + lineHeight * 1.85);

      // Reply Button
      ctx.beginPath();
      ctx.rect(margin * 2 + width * 0.14, line + lineHeight, width * 0.14, height * 0.14);
      ctx.fillStyle = colors.tertiary;
      ctx.fill();
      ctx.fillStyle = colors.secondary;
      ctx.font = bodyFontSize + "em 'Arial'";
      ctx.fillText(I18n.t("wizard.previews.reply_button"), margin * 2 + width * 0.14 + width / 55, line + lineHeight * 1.85);

      // Draw Timeline
      var timelineX = width * 0.8;
      ctx.beginPath();
      ctx.strokeStyle = colors.tertiary;
      ctx.lineWidth = 0.5;
      ctx.moveTo(timelineX, height * 0.3);
      ctx.lineTo(timelineX, height * 0.7);
      ctx.stroke();

      // Timeline
      ctx.beginPath();
      ctx.strokeStyle = colors.tertiary;
      ctx.lineWidth = 2;
      ctx.moveTo(timelineX, height * 0.3);
      ctx.lineTo(timelineX, height * 0.4);
      ctx.stroke();

      ctx.font = "Bold " + bodyFontSize + "em Arial";
      ctx.fillStyle = colors.primary;
      ctx.fillText("1 / 20", timelineX + margin, height * 0.3 + margin * 1.5);
    }
  }, (_applyDecoratedDescriptor(_obj, "isSelected", [_dec], Object.getOwnPropertyDescriptor(_obj, "isSelected"), _obj), _applyDecoratedDescriptor(_obj, "themeChanged", [_dec2], Object.getOwnPropertyDescriptor(_obj, "themeChanged"), _obj)), _obj)));
});
define("wizard/components/theme-previews", ["exports", "@ember/component"], function (exports, _component) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = _component.default.extend({
    actions: {
      changed: function changed(value) {
        this.set("field.value", value);
      }
    }
  });
});
define("wizard/components/wizard-canvas", ["exports", "@ember/component"], function (exports, _component) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });

  function _classCallCheck(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
      throw new TypeError("Cannot call a class as a function");
    }
  }

  var _createClass = function () {
    function defineProperties(target, props) {
      for (var i = 0; i < props.length; i++) {
        var descriptor = props[i];
        descriptor.enumerable = descriptor.enumerable || false;
        descriptor.configurable = true;
        if ("value" in descriptor) descriptor.writable = true;
        Object.defineProperty(target, descriptor.key, descriptor);
      }
    }

    return function (Constructor, protoProps, staticProps) {
      if (protoProps) defineProperties(Constructor.prototype, protoProps);
      if (staticProps) defineProperties(Constructor, staticProps);
      return Constructor;
    };
  }();

  var MAX_PARTICLES = 150;

  var SIZE = 144;

  var width = void 0,
      height = void 0;

  var COLORS = ["#BF1E2E", "#F1592A", "#F7941D", "#9EB83B", "#3AB54A", "#12A89D", "#25AAE2", "#0E76BD", "#652D90", "#92278F", "#ED207B", "#8C6238"];

  var Particle = function () {
    function Particle() {
      _classCallCheck(this, Particle);

      this.reset();
      this.y = Math.random() * (height + SIZE) - SIZE;
    }

    _createClass(Particle, [{
      key: "reset",
      value: function reset() {
        this.y = -SIZE;
        this.origX = Math.random() * (width + SIZE);
        this.speed = 1 + Math.random();
        this.ang = Math.random() * 2 * Math.PI;
        this.scale = Math.random() * 0.4 + 0.2;
        this.radius = Math.random() * 25 + 25;
        this.color = COLORS[Math.floor(Math.random() * COLORS.length)];
        this.flipped = Math.random() > 0.5 ? 1 : -1;
      }
    }, {
      key: "move",
      value: function move() {
        this.y += this.speed;

        if (this.y > height + SIZE) {
          this.reset();
        }

        this.ang += this.speed / 30.0;
        if (this.ang > 2 * Math.PI) {
          this.ang = 0;
        }

        this.x = this.origX + this.radius * Math.sin(this.ang);
      }
    }]);

    return Particle;
  }();

  exports.default = _component.default.extend({
    classNames: ["wizard-canvas"],
    tagName: "canvas",
    ctx: null,
    ready: false,
    particles: null,

    didInsertElement: function didInsertElement() {
      var _this = this;

      this._super.apply(this, arguments);

      var canvas = this.element;
      this.ctx = canvas.getContext("2d");
      this.resized();

      this.particles = [];
      for (var i = 0; i < MAX_PARTICLES; i++) {
        this.particles.push(new Particle());
      }

      this.ready = true;
      this.paint();

      $(window).on("resize.wizard", function () {
        return _this.resized();
      });
    },
    willDestroyElement: function willDestroyElement() {
      this._super.apply(this, arguments);
      $(window).off("resize.wizard");
    },
    resized: function resized() {
      width = $(window).width();
      height = $(window).height();

      var canvas = this.element;
      canvas.width = width;
      canvas.height = height;
    },
    paint: function paint() {
      var _this2 = this;

      if (this.isDestroying || this.isDestroyed || !this.ready) {
        return;
      }

      var ctx = this.ctx;

      ctx.clearRect(0, 0, width, height);

      this.particles.forEach(function (particle) {
        particle.move();
        _this2.drawParticle(particle);
      });

      window.requestAnimationFrame(function () {
        return _this2.paint();
      });
    },
    drawParticle: function drawParticle(p) {
      var c = this.ctx;

      c.save();
      c.translate(p.x - SIZE, p.y - SIZE);
      c.scale(p.scale * p.flipped, p.scale);
      c.fillStyle = p.color;
      c.strokeStyle = p.color;
      c.globalAlpha = "1.0";
      c.lineWidth = "1";
      c.lineCap = "butt";
      c.lineJoin = "round";
      c.mitterLimit = "1";
      c.beginPath();
      c.moveTo(97.9, 194.9);
      c.lineTo(103.5, 162.9);
      c.bezierCurveTo(88.7, 152, 84.2, 139.7, 90.2, 126.3);
      c.bezierCurveTo(99.5, 105.6, 124.6, 89.6, 159.7, 100.4);
      c.lineTo(159.7, 100.4);
      c.bezierCurveTo(175.9, 105.4, 186.4, 111.2, 192.6, 118.5);
      c.bezierCurveTo(200, 127.2, 201.6, 138.4, 197.5, 152.7);
      c.bezierCurveTo(194, 165, 187.4, 173.6, 177.9, 178.3);
      c.bezierCurveTo(165.6, 184.4, 148.4, 183.7, 129.4, 176.3);
      c.bezierCurveTo(127.7, 175.6, 126, 174.9, 124.4, 174.2);
      c.lineTo(97.9, 194.9);
      c.closePath();
      c.moveTo(138, 99.3);
      c.bezierCurveTo(115.4, 99.3, 99.3, 111.9, 92.4, 127.3);
      c.bezierCurveTo(86.8, 139.7, 91.2, 151.2, 105.5, 161.5);
      c.lineTo(106.1, 161.9);
      c.lineTo(101.2, 189.4);
      c.lineTo(124, 171.7);
      c.lineTo(124.6, 172);
      c.bezierCurveTo(126.4, 172.8, 128.3, 173.6, 130.2, 174.3);
      c.bezierCurveTo(148.6, 181.4, 165.1, 182.2, 176.8, 176.4);
      c.bezierCurveTo(185.7, 172, 191.9, 163.9, 195.2, 152.2);
      c.bezierCurveTo(202.4, 127.2, 191.9, 112.8, 159, 102.7);
      c.lineTo(159, 102.7);
      c.bezierCurveTo(151.6, 100.3, 144.5, 99.3, 138, 99.3);
      c.closePath();
      c.fill();
      c.stroke();
      c.beginPath();
      c.moveTo(115.7, 136.2);
      c.bezierCurveTo(115.7, 137.9, 115, 139.3, 113.3, 139.3);
      c.bezierCurveTo(111.6, 139.3, 110.2, 137.9, 110.2, 136.2);
      c.bezierCurveTo(110.2, 134.5, 111.6, 133.1, 113.3, 133.1);
      c.bezierCurveTo(115, 133, 115.7, 134.4, 115.7, 136.2);
      c.closePath();
      c.fill();
      c.stroke();
      c.beginPath();
      c.moveTo(145.8, 141.6);
      c.bezierCurveTo(145.8, 143.3, 144.4, 144.1, 142.7, 144.1);
      c.bezierCurveTo(141, 144.1, 139.6, 143.4, 139.6, 141.6);
      c.bezierCurveTo(139.6, 141.6, 141, 138.5, 142.7, 138.5);
      c.bezierCurveTo(144.4, 138.5, 145.8, 139.9, 145.8, 141.6);
      c.closePath();
      c.fill();
      c.stroke();
      c.beginPath();
      c.moveTo(171.6, 146.8);
      c.bezierCurveTo(171.6, 148.5, 171, 149.9, 169.2, 149.9);
      c.bezierCurveTo(167.5, 149.9, 166.1, 148.5, 166.1, 146.8);
      c.bezierCurveTo(166.1, 145.1, 167.5, 143.7, 169.2, 143.7);
      c.bezierCurveTo(171, 143.6, 171.6, 145, 171.6, 146.8);
      c.closePath();
      c.fill();
      c.stroke();
      c.restore();
    }
  });
});
define("wizard/components/wizard-field-checkboxes", ["exports", "@ember/component", "@ember/object"], function (exports, _component, _object) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = _component.default.extend({
    init: function init() {
      this._super.apply(this, arguments);
      this.set("field.value", this.field.value || []);

      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;
      var _iteratorError = undefined;

      try {
        for (var _iterator = this.field.choices[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
          var choice = _step.value;

          if (this.field.value.includes(choice.id)) {
            (0, _object.set)(choice, "checked", true);
          }
        }
      } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion && _iterator.return) {
            _iterator.return();
          }
        } finally {
          if (_didIteratorError) {
            throw _iteratorError;
          }
        }
      }
    },

    actions: {
      changed: function changed(checkbox) {
        var newFieldValue = this.field.value;
        var checkboxValue = checkbox.parentElement.getAttribute("value").toLowerCase();

        if (checkbox.checked) {
          newFieldValue.push(checkboxValue);
        } else {
          var index = newFieldValue.indexOf(checkboxValue);
          if (index > -1) {
            newFieldValue.splice(index, 1);
          }
        }
        this.set("field.value", newFieldValue);
      }
    }
  });
});
define("wizard/components/wizard-field-dropdown", ["exports", "@ember/component"], function (exports, _component) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = _component.default.extend({
    keyPress: function keyPress(e) {
      e.stopPropagation();
    }
  });
});
define("wizard/components/wizard-field-image", ["exports", "@ember/component", "discourse-common/lib/get-url", "discourse-common/utils/decorators", "wizard/lib/ajax", "discourse-common/lib/get-owner", "@ember/string"], function (exports, _component, _getUrl, _decorators, _ajax, _getOwner, _string) {
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

  var _dec, _desc, _value, _obj;

  exports.default = _component.default.extend((_dec = (0, _decorators.default)("field.id"), (_obj = {
    classNames: ["wizard-image-row"],
    uploading: false,

    previewComponent: function previewComponent(id) {
      var componentName = "image-preview-" + (0, _string.dasherize)(id);
      var exists = (0, _getOwner.getOwner)(this).lookup("component:" + componentName);
      return exists ? componentName : "wizard-image-preview";
    },
    didInsertElement: function didInsertElement() {
      var _this = this;

      this._super.apply(this, arguments);

      var $upload = $(this.element);

      var id = this.get("field.id");

      $upload.fileupload({
        url: (0, _getUrl.default)("/uploads.json"),
        formData: {
          synchronous: true,
          type: "wizard_" + id,
          authenticity_token: (0, _ajax.getToken)()
        },
        dataType: "json",
        dropZone: $upload
      });

      $upload.on("fileuploadsubmit", function () {
        return _this.set("uploading", true);
      });

      $upload.on("fileuploaddone", function (e, response) {
        _this.set("field.value", response.result.url);
        _this.set("uploading", false);
      });

      $upload.on("fileuploadfail", function (e, response) {
        var message = I18n.t("wizard.upload_error");
        if (response.jqXHR.responseJSON && response.jqXHR.responseJSON.errors) {
          message = response.jqXHR.responseJSON.errors.join("\n");
        }

        window.swal({
          customClass: "wizard-warning",
          title: "",
          text: message,
          type: "warning",
          confirmButtonColor: "#6699ff"
        });
        _this.set("uploading", false);
      });
    }
  }, (_applyDecoratedDescriptor(_obj, "previewComponent", [_dec], Object.getOwnPropertyDescriptor(_obj, "previewComponent"), _obj)), _obj)));
});
define("wizard/components/wizard-field-radio", ["exports", "@ember/component"], function (exports, _component) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = _component.default.extend({
    actions: {
      changed: function changed(value) {
        this.set("field.value", value);
      }
    }
  });
});
define("wizard/components/wizard-field-textarea", ["exports", "@ember/component"], function (exports, _component) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = _component.default.extend({
    keyPress: function keyPress(e) {
      e.stopPropagation();
    }
  });
});
define("wizard/components/wizard-field", ["exports", "@ember/component", "discourse-common/utils/decorators", "@ember/string"], function (exports, _component, _decorators, _string) {
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

  var _dec, _dec2, _dec3, _desc, _value, _obj, _init, _init2;

  exports.default = _component.default.extend((_dec = (0, _decorators.default)("field.type"), _dec2 = (0, _decorators.default)("field.id"), _dec3 = (0, _decorators.default)("field.type", "field.id"), (_obj = {
    classNameBindings: [":wizard-field", "typeClass", "field.invalid"],

    typeClass: function typeClass(type) {
      return (0, _string.dasherize)(type) + "-field";
    },

    fieldClass: function fieldClass(id) {
      return "field-" + (0, _string.dasherize)(id) + " wizard-focusable";
    },

    inputComponentName: function inputComponentName(type, id) {
      return type === "component" ? (0, _string.dasherize)(id) : "wizard-field-" + type;
    }
  }, (_applyDecoratedDescriptor(_obj, "typeClass", [_dec], (_init = Object.getOwnPropertyDescriptor(_obj, "typeClass"), _init = _init ? _init.value : undefined, {
    enumerable: true,
    configurable: true,
    writable: true,
    initializer: function initializer() {
      return _init;
    }
  }), _obj), _applyDecoratedDescriptor(_obj, "fieldClass", [_dec2], (_init2 = Object.getOwnPropertyDescriptor(_obj, "fieldClass"), _init2 = _init2 ? _init2.value : undefined, {
    enumerable: true,
    configurable: true,
    writable: true,
    initializer: function initializer() {
      return _init2;
    }
  }), _obj), _applyDecoratedDescriptor(_obj, "inputComponentName", [_dec3], Object.getOwnPropertyDescriptor(_obj, "inputComponentName"), _obj)), _obj)));
});
define("wizard/components/wizard-image-preview", ["exports", "@ember/component"], function (exports, _component) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = _component.default.extend({
    classNameBindings: [":wizard-image-preview", "fieldClass"]
  });
});
define("wizard/components/wizard-step-form", ["exports", "@ember/component", "discourse-common/utils/decorators"], function (exports, _component, _decorators) {
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

  var _dec, _desc, _value, _obj, _init;

  exports.default = _component.default.extend((_dec = (0, _decorators.default)("step.id"), (_obj = {
    classNameBindings: [":wizard-step-form", "customStepClass"],

    customStepClass: function customStepClass(stepId) {
      return "wizard-step-" + stepId;
    }
  }, (_applyDecoratedDescriptor(_obj, "customStepClass", [_dec], (_init = Object.getOwnPropertyDescriptor(_obj, "customStepClass"), _init = _init ? _init.value : undefined, {
    enumerable: true,
    configurable: true,
    writable: true,
    initializer: function initializer() {
      return _init;
    }
  }), _obj)), _obj)));
});
define("wizard/components/wizard-step", ["exports", "@ember/runloop", "@ember/component", "discourse-common/lib/get-url", "discourse-common/utils/decorators", "@ember/template"], function (exports, _runloop, _component, _getUrl, _decorators, _template) {
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

  var _dec, _dec2, _dec3, _dec4, _dec5, _dec6, _dec7, _dec8, _dec9, _desc, _value, _obj, _init, _init2, _init3, _init4, _init5;

  jQuery.fn.wiggle = function (times, duration) {
    var _this = this;

    if (times > 0) {
      this.animate({
        marginLeft: times-- % 2 === 0 ? -15 : 15
      }, duration, 0, function () {
        return _this.wiggle(times, duration);
      });
    } else {
      this.animate({ marginLeft: 0 }, duration, 0);
    }
    return this;
  };

  var alreadyWarned = {};

  exports.default = _component.default.extend((_dec = (0, _decorators.default)("step.index"), _dec2 = (0, _decorators.default)("step.displayIndex", "wizard.totalSteps"), _dec3 = (0, _decorators.default)("step.displayIndex", "wizard.totalSteps"), _dec4 = (0, _decorators.default)("step.index", "step.displayIndex", "wizard.totalSteps", "wizard.completed"), _dec5 = (0, _decorators.default)("step.index"), _dec6 = (0, _decorators.default)("step.banner"), _dec7 = (0, _decorators.default)("step.id"), _dec8 = (0, _decorators.observes)("step.id"), _dec9 = (0, _decorators.default)("step.index", "wizard.totalSteps"), (_obj = {
    classNames: ["wizard-step"],
    saving: null,

    didInsertElement: function didInsertElement() {
      this._super.apply(this, arguments);
      this.autoFocus();
    },

    showQuitButton: function showQuitButton(index) {
      return index === 0;
    },

    showNextButton: function showNextButton(current, total) {
      return current < total;
    },

    showDoneButton: function showDoneButton(current, total) {
      return current === total;
    },

    showFinishButton: function showFinishButton(index, displayIndex, total, completed) {
      return index !== 0 && displayIndex !== total && completed;
    },

    showBackButton: function showBackButton(index) {
      return index > 0;
    },

    bannerImage: function bannerImage(src) {
      if (!src) {
        return;
      }
      return (0, _getUrl.default)("/images/wizard/" + src);
    },
    bannerAndDescriptionClass: function bannerAndDescriptionClass(id) {
      return "wizard-banner-and-description wizard-banner-and-description-" + id;
    },
    _stepChanged: function _stepChanged() {
      this.set("saving", false);
      this.autoFocus();
    },
    keyPress: function keyPress(key) {
      if (key.keyCode === 13) {
        if (this.showDoneButton) {
          this.send("quit");
        } else {
          this.send("nextStep");
        }
      }
    },
    barStyle: function barStyle(displayIndex, totalSteps) {
      var ratio = parseFloat(displayIndex) / parseFloat(totalSteps - 1);
      if (ratio < 0) {
        ratio = 0;
      }
      if (ratio > 1) {
        ratio = 1;
      }

      return (0, _template.htmlSafe)("width: " + ratio * 200 + "px");
    },
    autoFocus: function autoFocus() {
      (0, _runloop.schedule)("afterRender", function () {
        var $invalid = $(".wizard-field.invalid:eq(0) .wizard-focusable");

        if ($invalid.length) {
          return $invalid.focus();
        }

        $(".wizard-focusable:eq(0)").focus();
      });
    },
    animateInvalidFields: function animateInvalidFields() {
      (0, _runloop.schedule)("afterRender", function () {
        return $(".invalid input[type=text], .invalid textarea").wiggle(2, 100);
      });
    },
    advance: function advance() {
      var _this2 = this;

      this.set("saving", true);
      this.step.save().then(function (response) {
        return _this2.goNext(response);
      }).catch(function () {
        return _this2.animateInvalidFields();
      }).finally(function () {
        return _this2.set("saving", false);
      });
    },


    actions: {
      quit: function quit() {
        document.location = (0, _getUrl.default)("/");
      },
      exitEarly: function exitEarly() {
        var _this3 = this;

        var step = this.step;
        step.validate();

        if (step.get("valid")) {
          this.set("saving", true);

          step.save().then(function () {
            return _this3.send("quit");
          }).catch(function () {
            return _this3.animateInvalidFields();
          }).finally(function () {
            return _this3.set("saving", false);
          });
        } else {
          this.animateInvalidFields();
          this.autoFocus();
        }
      },
      backStep: function backStep() {
        if (this.saving) {
          return;
        }

        this.goBack();
      },
      nextStep: function nextStep() {
        var _this4 = this;

        if (this.saving) {
          return;
        }

        var step = this.step;
        var result = step.validate();

        if (result.warnings.length) {
          var unwarned = result.warnings.filter(function (w) {
            return !alreadyWarned[w];
          });
          if (unwarned.length) {
            unwarned.forEach(function (w) {
              return alreadyWarned[w] = true;
            });
            return window.swal({
              customClass: "wizard-warning",
              title: "",
              text: unwarned.map(function (w) {
                return I18n.t("wizard." + w);
              }).join("\n"),
              type: "warning",
              showCancelButton: true,
              confirmButtonColor: "#6699ff"
            }, function (confirmed) {
              if (confirmed) {
                _this4.advance();
              }
            });
          }
        }

        if (step.get("valid")) {
          this.advance();
        } else {
          this.animateInvalidFields();
          this.autoFocus();
        }
      }
    }
  }, (_applyDecoratedDescriptor(_obj, "showQuitButton", [_dec], (_init = Object.getOwnPropertyDescriptor(_obj, "showQuitButton"), _init = _init ? _init.value : undefined, {
    enumerable: true,
    configurable: true,
    writable: true,
    initializer: function initializer() {
      return _init;
    }
  }), _obj), _applyDecoratedDescriptor(_obj, "showNextButton", [_dec2], (_init2 = Object.getOwnPropertyDescriptor(_obj, "showNextButton"), _init2 = _init2 ? _init2.value : undefined, {
    enumerable: true,
    configurable: true,
    writable: true,
    initializer: function initializer() {
      return _init2;
    }
  }), _obj), _applyDecoratedDescriptor(_obj, "showDoneButton", [_dec3], (_init3 = Object.getOwnPropertyDescriptor(_obj, "showDoneButton"), _init3 = _init3 ? _init3.value : undefined, {
    enumerable: true,
    configurable: true,
    writable: true,
    initializer: function initializer() {
      return _init3;
    }
  }), _obj), _applyDecoratedDescriptor(_obj, "showFinishButton", [_dec4], (_init4 = Object.getOwnPropertyDescriptor(_obj, "showFinishButton"), _init4 = _init4 ? _init4.value : undefined, {
    enumerable: true,
    configurable: true,
    writable: true,
    initializer: function initializer() {
      return _init4;
    }
  }), _obj), _applyDecoratedDescriptor(_obj, "showBackButton", [_dec5], (_init5 = Object.getOwnPropertyDescriptor(_obj, "showBackButton"), _init5 = _init5 ? _init5.value : undefined, {
    enumerable: true,
    configurable: true,
    writable: true,
    initializer: function initializer() {
      return _init5;
    }
  }), _obj), _applyDecoratedDescriptor(_obj, "bannerImage", [_dec6], Object.getOwnPropertyDescriptor(_obj, "bannerImage"), _obj), _applyDecoratedDescriptor(_obj, "bannerAndDescriptionClass", [_dec7], Object.getOwnPropertyDescriptor(_obj, "bannerAndDescriptionClass"), _obj), _applyDecoratedDescriptor(_obj, "_stepChanged", [_dec8], Object.getOwnPropertyDescriptor(_obj, "_stepChanged"), _obj), _applyDecoratedDescriptor(_obj, "barStyle", [_dec9], Object.getOwnPropertyDescriptor(_obj, "barStyle"), _obj)), _obj)));
});
define("wizard/models/step", ["exports", "@ember/object", "discourse-common/utils/decorators", "wizard/mixins/valid-state", "wizard/lib/ajax"], function (exports, _object, _decorators, _validState, _ajax) {
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

  var _dec, _dec2, _desc, _value, _obj, _init;

  exports.default = _object.default.extend(_validState.default, (_dec = (0, _decorators.default)("index"), _dec2 = (0, _decorators.default)("fields.[]"), (_obj = {
    id: null,

    displayIndex: function displayIndex(index) {
      return index + 1;
    },

    fieldsById: function fieldsById(fields) {
      var lookup = {};
      fields.forEach(function (field) {
        return lookup[field.get("id")] = field;
      });
      return lookup;
    },
    validate: function validate() {
      var allValid = true;
      var result = { warnings: [] };

      this.fields.forEach(function (field) {
        allValid = allValid && field.check();
        var warning = field.get("warning");
        if (warning) {
          result.warnings.push(warning);
        }
      });

      this.setValid(allValid);

      return result;
    },
    fieldError: function fieldError(id, description) {
      var field = this.fields.findBy("id", id);
      if (field) {
        field.setValid(false, description);
      }
    },
    save: function save() {
      var _this = this;

      var fields = {};
      this.fields.forEach(function (f) {
        return fields[f.id] = f.value;
      });

      return (0, _ajax.ajax)({
        url: "/wizard/steps/" + this.id,
        type: "PUT",
        data: { fields: fields }
      }).catch(function (response) {
        response.responseJSON.errors.forEach(function (err) {
          return _this.fieldError(err.field, err.description);
        });
        throw new Error(response);
      });
    }
  }, (_applyDecoratedDescriptor(_obj, "displayIndex", [_dec], (_init = Object.getOwnPropertyDescriptor(_obj, "displayIndex"), _init = _init ? _init.value : undefined, {
    enumerable: true,
    configurable: true,
    writable: true,
    initializer: function initializer() {
      return _init;
    }
  }), _obj), _applyDecoratedDescriptor(_obj, "fieldsById", [_dec2], Object.getOwnPropertyDescriptor(_obj, "fieldsById"), _obj)), _obj)));
});
define("wizard/models/wizard-field", ["exports", "@ember/object", "wizard/mixins/valid-state"], function (exports, _object, _validState) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = _object.default.extend(_validState.default, {
    id: null,
    type: null,
    value: null,
    required: null,
    warning: null,

    check: function check() {
      if (!this.required) {
        this.setValid(true);
        return true;
      }

      var val = this.value;
      var valid = val && val.length > 0;

      this.setValid(valid);
      return valid;
    }
  });
});
define("wizard/models/wizard", ["exports", "wizard/models/step", "wizard/models/wizard-field", "wizard/lib/ajax", "discourse-common/utils/decorators", "@ember/object"], function (exports, _step, _wizardField, _ajax, _decorators, _object) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.findWizard = findWizard;

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

  var _dec, _desc, _value, _obj, _init;

  var Wizard = _object.default.extend((_dec = (0, _decorators.default)("steps.length"), (_obj = {
    totalSteps: function totalSteps(length) {
      return length;
    },

    getTitle: function getTitle() {
      var titleStep = this.steps.findBy("id", "forum-title");
      if (!titleStep) {
        return;
      }
      return titleStep.get("fieldsById.title.value");
    },
    getLogoUrl: function getLogoUrl() {
      var logoStep = this.steps.findBy("id", "logos");
      if (!logoStep) {
        return;
      }
      return logoStep.get("fieldsById.logo_url.value");
    },
    getCurrentColors: function getCurrentColors(schemeId) {
      var colorStep = this.steps.findBy("id", "colors");
      if (!colorStep) {
        return;
      }

      var themeChoice = colorStep.get("fieldsById.theme_previews");
      if (!themeChoice) {
        return;
      }

      var themeId = schemeId ? schemeId : themeChoice.get("value");
      if (!themeId) {
        return;
      }

      var choices = themeChoice.get("choices");
      if (!choices) {
        return;
      }

      var option = choices.findBy("id", themeId);
      if (!option) {
        return;
      }

      return option.data.colors;
    }
  }, (_applyDecoratedDescriptor(_obj, "totalSteps", [_dec], (_init = Object.getOwnPropertyDescriptor(_obj, "totalSteps"), _init = _init ? _init.value : undefined, {
    enumerable: true,
    configurable: true,
    writable: true,
    initializer: function initializer() {
      return _init;
    }
  }), _obj)), _obj)));

  function findWizard() {
    return (0, _ajax.ajax)({ url: "/wizard.json" }).then(function (response) {
      var wizard = response.wizard;
      wizard.steps = wizard.steps.map(function (step) {
        var stepObj = _step.default.create(step);
        stepObj.fields = stepObj.fields.map(function (f) {
          return _wizardField.default.create(f);
        });
        return stepObj;
      });

      return Wizard.create(wizard);
    });
  }
});
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
define("wizard/routes/index", ["exports", "@ember/routing/route"], function (exports, _route) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = _route.default.extend({
    beforeModel: function beforeModel() {
      var appModel = this.modelFor("application");
      this.replaceWith("step", appModel.start);
    }
  });
});
define("wizard/routes/step", ["exports", "@ember/routing/route"], function (exports, _route) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = _route.default.extend({
    model: function model(params) {
      var allSteps = this.modelFor("application").steps;
      var step = allSteps.findBy("id", params.step_id);
      return step ? step : allSteps[0];
    },
    setupController: function setupController(controller, step) {
      this.controllerFor("application").set("currentStepId", step.get("id"));

      controller.setProperties({
        step: step,
        wizard: this.modelFor("application")
      });
    }
  });
});
define("wizard/controllers/application", ["exports", "@ember/controller", "discourse-common/utils/decorators"], function (exports, _controller, _decorators) {
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

  var _dec, _desc, _value, _obj;

  exports.default = _controller.default.extend((_dec = (0, _decorators.default)("currentStepId"), (_obj = {
    currentStepId: null,

    showCanvas: function showCanvas(currentStepId) {
      return currentStepId === "finished";
    }
  }, (_applyDecoratedDescriptor(_obj, "showCanvas", [_dec], Object.getOwnPropertyDescriptor(_obj, "showCanvas"), _obj)), _obj)));
});
define("wizard/controllers/step", ["exports", "@ember/controller"], function (exports, _controller) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = _controller.default.extend({
    wizard: null,
    step: null,

    actions: {
      goNext: function goNext(response) {
        var next = this.get("step.next");
        if (response.refresh_required) {
          this.send("refresh");
        }
        this.transitionToRoute("step", next);
      },
      goBack: function goBack() {
        this.transitionToRoute("step", this.get("step.previous"));
      }
    }
  });
});
define("wizard/lib/ajax", ["exports", "@ember/runloop", "discourse-common/lib/get-url", "rsvp", "jquery"], function (exports, _runloop, _getUrl, _rsvp, _jquery) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.getToken = getToken;
  exports.ajax = ajax;


  var token = void 0;

  function getToken() {
    if (!token) {
      token = $('meta[name="csrf-token"]').attr("content");
    }

    return token;
  }

  function ajax(args) {
    return new _rsvp.Promise(function (resolve, reject) {
      args.headers = { "X-CSRF-Token": getToken() };
      args.success = function (data) {
        return (0, _runloop.run)(null, resolve, data);
      };
      args.error = function (xhr) {
        return (0, _runloop.run)(null, reject, xhr);
      };
      args.url = (0, _getUrl.default)(args.url);
      _jquery.default.ajax(args);
    });
  }
});
define("wizard/lib/preview", ["exports", "@ember/runloop", "@ember/component", "discourse-common/lib/get-url", "rsvp"], function (exports, _runloop, _component, _getUrl, _rsvp) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.LOREM = undefined;
  exports.createPreviewComponent = createPreviewComponent;
  exports.parseColor = parseColor;
  exports.brightness = brightness;
  exports.lighten = lighten;
  exports.chooseBrighter = chooseBrighter;
  exports.chooseDarker = chooseDarker;
  exports.darkLightDiff = darkLightDiff;
  exports.drawHeader = drawHeader;

  /*eslint no-bitwise:0 */
  var LOREM = exports.LOREM = "\nLorem ipsum dolor sit amet,\nconsectetur adipiscing elit.\nNullam eget sem non elit\ntincidunt rhoncus. Fusce\nvelit nisl, porttitor sed\nnisl ac, consectetur interdum\nmetus. Fusce in consequat\naugue, vel facilisis felis.";

  var scaled = {};

  function canvasFor(image, w, h) {
    w = Math.ceil(w);
    h = Math.ceil(h);

    var scale = window.devicePixelRatio;

    var can = document.createElement("canvas");
    can.width = w * scale;
    can.height = h * scale;

    var ctx = can.getContext("2d");
    ctx.scale(scale, scale);
    ctx.drawImage(image, 0, 0, w, h);
    return can;
  }

  function createPreviewComponent(width, height, obj) {
    var scale = window.devicePixelRatio;
    return _component.default.extend({
      layoutName: "components/theme-preview",
      width: width,
      height: height,
      elementWidth: width * scale,
      elementHeight: height * scale,
      canvasStyle: "width:" + width + "px;height:" + height + "px",
      ctx: null,
      loaded: false,

      didInsertElement: function didInsertElement() {
        this._super.apply(this, arguments);
        var c = this.element.querySelector("canvas");
        this.ctx = c.getContext("2d");
        this.ctx.scale(scale, scale);
        this.reload();
      },
      images: function images() {},
      loadImages: function loadImages() {
        var _this = this;

        var images = this.images();
        if (images) {
          return _rsvp.Promise.all(Object.keys(images).map(function (id) {
            return loadImage(images[id]).then(function (img) {
              return _this[id] = img;
            });
          }));
        }
        return _rsvp.Promise.resolve();
      },
      reload: function reload() {
        var _this2 = this;

        this.loadImages().then(function () {
          _this2.loaded = true;
          _this2.triggerRepaint();
        });
      },
      triggerRepaint: function triggerRepaint() {
        (0, _runloop.scheduleOnce)("afterRender", this, "repaint");
      },
      repaint: function repaint() {
        if (!this.loaded) {
          return false;
        }

        var colors = this.wizard.getCurrentColors(this.colorsId);
        if (!colors) {
          return;
        }

        var ctx = this.ctx;


        ctx.fillStyle = colors.secondary;
        ctx.fillRect(0, 0, width, height);

        this.paint(ctx, colors, this.width, this.height);

        // draw border
        ctx.beginPath();
        ctx.strokeStyle = "rgba(0, 0, 0, 0.2)";
        ctx.rect(0, 0, width, height);
        ctx.stroke();
      },
      categories: function categories() {
        return [{ name: "consecteteur", color: "#652D90" }, { name: "ultrices", color: "#3AB54A" }, { name: "placerat", color: "#25AAE2" }];
      },
      scaleImage: function scaleImage(image, x, y, w, h) {
        w = Math.floor(w);
        h = Math.floor(h);

        var ctx = this.ctx;


        var key = image.src + "-" + w + "-" + h;

        if (!scaled[key]) {
          var copy = image;
          var ratio = copy.width / copy.height;
          var newH = copy.height * 0.5;
          while (newH > h) {
            copy = canvasFor(copy, ratio * newH, newH);
            newH = newH * 0.5;
          }

          scaled[key] = copy;
        }

        ctx.drawImage(scaled[key], x, y, w, h);
      },
      drawFullHeader: function drawFullHeader(colors) {
        var ctx = this.ctx;


        var headerHeight = height * 0.15;
        drawHeader(ctx, colors, width, headerHeight);

        var avatarSize = height * 0.1;

        // Logo
        var headerMargin = headerHeight * 0.2;
        var logoHeight = headerHeight - headerMargin * 2;

        ctx.beginPath();
        ctx.fillStyle = colors.header_primary;
        ctx.font = "bold " + logoHeight + "px 'Arial'";
        ctx.fillText("Discourse", headerMargin, headerHeight - headerMargin);

        // Top right menu
        this.scaleImage(this.avatar, width - avatarSize - headerMargin, headerMargin, avatarSize, avatarSize);
        ctx.fillStyle = darkLightDiff(colors.primary, colors.secondary, 45, 55);

        var pathScale = headerHeight / 1200;
        // search icon SVG path
        var searchIcon = new Path2D("M505 442.7L405.3 343c-4.5-4.5-10.6-7-17-7H372c27.6-35.3 44-79.7 44-128C416 93.1 322.9 0 208 0S0 93.1 0 208s93.1 208 208 208c48.3 0 92.7-16.4 128-44v16.3c0 6.4 2.5 12.5 7 17l99.7 99.7c9.4 9.4 24.6 9.4 33.9 0l28.3-28.3c9.4-9.4 9.4-24.6.1-34zM208 336c-70.7 0-128-57.2-128-128 0-70.7 57.2-128 128-128 70.7 0 128 57.2 128 128 0 70.7-57.2 128-128 128z");
        // hamburger icon
        var hamburgerIcon = new Path2D("M16 132h416c8.837 0 16-7.163 16-16V76c0-8.837-7.163-16-16-16H16C7.163 60 0 67.163 0 76v40c0 8.837 7.163 16 16 16zm0 160h416c8.837 0 16-7.163 16-16v-40c0-8.837-7.163-16-16-16H16c-8.837 0-16 7.163-16 16v40c0 8.837 7.163 16 16 16zm0 160h416c8.837 0 16-7.163 16-16v-40c0-8.837-7.163-16-16-16H16c-8.837 0-16 7.163-16 16v40c0 8.837 7.163 16 16 16z");
        ctx.save(); // Save the previous state for translation and scale
        ctx.translate(width - avatarSize * 3 - headerMargin * 0.5, avatarSize / 2);
        // need to scale paths otherwise they're too large
        ctx.scale(pathScale, pathScale);
        ctx.fill(searchIcon);
        ctx.restore();
        ctx.save();
        ctx.translate(width - avatarSize * 2 - headerMargin * 0.5, avatarSize / 2);
        ctx.scale(pathScale, pathScale);
        ctx.fill(hamburgerIcon);
        ctx.restore();
      },
      drawPills: function drawPills(colors, headerHeight, opts) {
        opts = opts || {};

        var ctx = this.ctx;


        var categoriesSize = headerHeight * 2;
        var badgeHeight = categoriesSize * 0.25;
        var headerMargin = headerHeight * 0.2;

        ctx.beginPath();
        ctx.strokeStyle = colors.primary;
        ctx.lineWidth = 0.5;
        ctx.rect(headerMargin, headerHeight + headerMargin, categoriesSize, badgeHeight);
        ctx.stroke();

        var fontSize = Math.round(badgeHeight * 0.5);

        ctx.font = fontSize + "px 'Arial'";
        ctx.fillStyle = colors.primary;
        ctx.fillText("all categories", headerMargin * 1.5, headerHeight + headerMargin * 1.4 + fontSize);

        var pathScale = badgeHeight / 1000;
        // caret icon
        var caretIcon = new Path2D("M0 384.662V127.338c0-17.818 21.543-26.741 34.142-14.142l128.662 128.662c7.81 7.81 7.81 20.474 0 28.284L34.142 398.804C21.543 411.404 0 402.48 0 384.662z");

        ctx.save();
        ctx.translate(categoriesSize - headerMargin / 4, headerHeight + headerMargin + badgeHeight / 4);
        ctx.scale(pathScale, pathScale);
        ctx.fill(caretIcon);
        ctx.restore();

        var text = opts.categories ? "Categories" : "Latest";

        var activeWidth = categoriesSize * (opts.categories ? 0.8 : 0.55);
        ctx.beginPath();
        ctx.fillStyle = colors.quaternary;
        ctx.rect(headerMargin * 2 + categoriesSize, headerHeight + headerMargin, activeWidth, badgeHeight);
        ctx.fill();

        ctx.font = fontSize + "px 'Arial'";
        ctx.fillStyle = colors.secondary;
        var x = headerMargin * 3.0 + categoriesSize;
        ctx.fillText(text, x - headerMargin * 0.1, headerHeight + headerMargin * 1.5 + fontSize);

        ctx.fillStyle = colors.primary;
        x += categoriesSize * (opts.categories ? 0.8 : 0.6);
        ctx.fillText("New", x, headerHeight + headerMargin * 1.5 + fontSize);

        x += categoriesSize * 0.4;
        ctx.fillText("Unread", x, headerHeight + headerMargin * 1.5 + fontSize);

        x += categoriesSize * 0.6;
        ctx.fillText("Top", x, headerHeight + headerMargin * 1.5 + fontSize);
      }
    }, obj);
  }

  function loadImage(src) {
    if (!src) {
      return _rsvp.Promise.resolve();
    }

    var img = new Image();
    img.src = (0, _getUrl.default)(src);
    return new _rsvp.Promise(function (resolve) {
      return img.onload = function () {
        return resolve(img);
      };
    });
  }

  function parseColor(color) {
    var m = color.match(/^#([0-9a-f]{6})$/i);
    if (m) {
      var c = m[1];
      return [parseInt(c.substr(0, 2), 16), parseInt(c.substr(2, 2), 16), parseInt(c.substr(4, 2), 16)];
    }

    return [0, 0, 0];
  }

  function brightness(color) {
    return color[0] * 0.299 + color[1] * 0.587 + color[2] * 0.114;
  }

  function rgbToHsl(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;
    var max = Math.max(r, g, b),
        min = Math.min(r, g, b);
    var h = void 0,
        s = void 0,
        l = (max + min) / 2;

    if (max === min) {
      h = s = 0;
    } else {
      var d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r:
          h = (g - b) / d + (g < b ? 6 : 0);
          break;
        case g:
          h = (b - r) / d + 2;
          break;
        case b:
          h = (r - g) / d + 4;
          break;
      }
      h /= 6;
    }

    return [h, s, l];
  }

  function hue2rgb(p, q, t) {
    if (t < 0) {
      t += 1;
    }
    if (t > 1) {
      t -= 1;
    }
    if (t < 1 / 6) {
      return p + (q - p) * 6 * t;
    }
    if (t < 1 / 2) {
      return q;
    }
    if (t < 2 / 3) {
      return p + (q - p) * (2 / 3 - t) * 6;
    }
    return p;
  }

  function hslToRgb(h, s, l) {
    var r = void 0,
        g = void 0,
        b = void 0;

    if (s === 0) {
      r = g = b = l; // achromatic
    } else {
      var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      var p = 2 * l - q;
      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }

    return [r * 255, g * 255, b * 255];
  }

  function lighten(color, percent) {
    var hsl = rgbToHsl(color[0], color[1], color[2]);
    var scale = percent / 100.0;
    var diff = scale > 0 ? 1.0 - hsl[2] : hsl[2];

    hsl[2] = hsl[2] + diff * scale;
    color = hslToRgb(hsl[0], hsl[1], hsl[2]);

    return "#" + (0 | (1 << 8) + color[0]).toString(16).substr(1) + (0 | (1 << 8) + color[1]).toString(16).substr(1) + (0 | (1 << 8) + color[2]).toString(16).substr(1);
  }

  function chooseBrighter(primary, secondary) {
    var primaryCol = parseColor(primary);
    var secondaryCol = parseColor(secondary);
    return brightness(primaryCol) < brightness(secondaryCol) ? secondary : primary;
  }

  function chooseDarker(primary, secondary) {
    if (chooseBrighter(primary, secondary) === primary) {
      return secondary;
    } else {
      return primary;
    }
  }

  function darkLightDiff(adjusted, comparison, lightness, darkness) {
    var adjustedCol = parseColor(adjusted);
    var comparisonCol = parseColor(comparison);
    return lighten(adjustedCol, brightness(adjustedCol) < brightness(comparisonCol) ? lightness : darkness);
  }

  function drawHeader(ctx, colors, width, headerHeight) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, width, headerHeight);
    ctx.fillStyle = colors.header_background;
    ctx.shadowColor = "rgba(0, 0, 0, 0.25)";
    ctx.shadowBlur = 2;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 2;
    ctx.fill();
    ctx.restore();
  }
});
define("wizard/mixins/valid-state", ["exports", "discourse-common/utils/decorators"], function (exports, _decorators) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.States = undefined;

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

  var _dec, _dec2, _dec3, _desc, _value, _obj, _init, _init2, _init3;

  var States = exports.States = {
    UNCHECKED: 0,
    INVALID: 1,
    VALID: 2
  };

  exports.default = (_dec = (0, _decorators.default)("_validState"), _dec2 = (0, _decorators.default)("_validState"), _dec3 = (0, _decorators.default)("_validState"), (_obj = {
    _validState: null,
    errorDescription: null,

    init: function init() {
      this._super.apply(this, arguments);
      this.set("_validState", States.UNCHECKED);
    },

    valid: function valid(state) {
      return state === States.VALID;
    },

    invalid: function invalid(state) {
      return state === States.INVALID;
    },

    unchecked: function unchecked(state) {
      return state === States.UNCHECKED;
    },

    setValid: function setValid(valid, description) {
      this.set("_validState", valid ? States.VALID : States.INVALID);

      if (!valid && description && description.length) {
        this.set("errorDescription", description);
      } else {
        this.set("errorDescription", null);
      }
    }
  }, (_applyDecoratedDescriptor(_obj, "valid", [_dec], (_init = Object.getOwnPropertyDescriptor(_obj, "valid"), _init = _init ? _init.value : undefined, {
    enumerable: true,
    configurable: true,
    writable: true,
    initializer: function initializer() {
      return _init;
    }
  }), _obj), _applyDecoratedDescriptor(_obj, "invalid", [_dec2], (_init2 = Object.getOwnPropertyDescriptor(_obj, "invalid"), _init2 = _init2 ? _init2.value : undefined, {
    enumerable: true,
    configurable: true,
    writable: true,
    initializer: function initializer() {
      return _init2;
    }
  }), _obj), _applyDecoratedDescriptor(_obj, "unchecked", [_dec3], (_init3 = Object.getOwnPropertyDescriptor(_obj, "unchecked"), _init3 = _init3 ? _init3.value : undefined, {
    enumerable: true,
    configurable: true,
    writable: true,
    initializer: function initializer() {
      return _init3;
    }
  }), _obj)), _obj));
});
define("wizard/initializers/load-helpers", ["exports", "discourse-common/lib/helpers"], function (exports, _helpers) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = {
    name: "load-helpers",

    initialize: function initialize(application) {
      Object.keys(requirejs.entries).forEach(function (entry) {
        if (/\/helpers\//.test(entry)) {
          requirejs(entry, null, null, true);
        }
      });
      (0, _helpers.registerHelpers)(application);
    }
  };
});














