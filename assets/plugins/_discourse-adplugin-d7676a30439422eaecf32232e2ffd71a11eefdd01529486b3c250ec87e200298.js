define("discourse/plugins/discourse-adplugin/initializers/initialize-ad-plugin", ["exports", "discourse/lib/plugin-api"], function (exports, _pluginApi) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = {
    name: "initialize-ad-plugin",
    initialize: function initialize(container) {
      (0, _pluginApi.withPluginApi)("0.1", function (api) {
        api.decorateWidget("post:after", function (dec) {
          if (dec.canConnectComponent) {
            if (!dec.attrs.cloaked) {
              return dec.connect({
                component: "post-bottom-ad",
                context: "model"
              });
            }
          } else {
            // Old way for backwards compatibility
            return dec.connect({
              templateName: "connectors/post-bottom/discourse-adplugin",
              context: "model"
            });
          }
        });
      });

      var messageBus = container.lookup("message-bus:main");
      if (!messageBus) {
        return;
      }

      messageBus.subscribe("/site/house-creatives", function (houseAdsSettings) {
        Discourse.Site.currentProp("house_creatives", houseAdsSettings);
      });
    }
  };
});
define("discourse/plugins/discourse-adplugin/discourse/routes/admin-plugins-house-ads", ["exports", "discourse/lib/ajax"], function (exports, _ajax) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = Discourse.Route.extend({
    settings: null,

    model: function model() {
      var _this = this;

      return (0, _ajax.ajax)("/admin/plugins/pluginad/house_creatives.json").then(function (data) {
        _this.set("settings", Ember.Object.create(data.settings));
        return data.house_ads.map(function (ad) {
          return Ember.Object.create(ad);
        });
      });
    },
    setupController: function setupController(controller, model) {
      controller.setProperties({
        model: model,
        houseAdsSettings: this.get("settings"),
        loadingAds: false
      });
    }
  });
});
define("discourse/plugins/discourse-adplugin/discourse/routes/admin-plugins-house-ads-show", ["exports"], function (exports) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = Discourse.Route.extend({
    model: function model(params) {
      if (params.ad_id === "new") {
        return Ember.Object.create({
          name: I18n.t("admin.adplugin.house_ads.new_name"),
          html: ""
        });
      } else {
        return this.modelFor("adminPlugins.houseAds").findBy("id", parseInt(params.ad_id, 10));
      }
    }
  });
});
define("discourse/plugins/discourse-adplugin/discourse/routes/admin-plugins-house-ads-index", ["exports"], function (exports) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = Discourse.Route.extend({
    actions: {
      moreSettings: function moreSettings() {
        this.transitionTo("adminSiteSettingsCategory", "ad_plugin");
      }
    }
  });
});
define("discourse/plugins/discourse-adplugin/discourse/controllers/admin-plugins-house-ads", ["exports"], function (exports) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = Ember.Controller.extend({
    loadingAds: true
  });
});
define("discourse/plugins/discourse-adplugin/discourse/controllers/admin-plugins-house-ads-show", ["exports", "discourse/lib/ajax", "discourse/lib/ajax-error", "discourse/lib/computed", "discourse/mixins/buffered-content"], function (exports, _ajax, _ajaxError, _computed, _bufferedContent) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = Ember.Controller.extend((0, _bufferedContent.bufferedProperty)("model"), {
    adminPluginsHouseAds: Ember.inject.controller("adminPlugins.houseAds"),

    saving: false,
    savingStatus: "",

    nameDirty: (0, _computed.propertyNotEqual)("buffered.name", "model.name"),
    htmlDirty: (0, _computed.propertyNotEqual)("buffered.html", "model.html"),
    dirty: Ember.computed.or("nameDirty", "htmlDirty"),
    disableSave: Ember.computed.not("dirty"),

    actions: {
      save: function save() {
        var _this = this;

        if (!this.get("saving")) {
          this.setProperties({
            saving: true,
            savingStatus: I18n.t("saving")
          });

          var data = {},
              buffered = this.get("buffered"),
              newRecord = !buffered.get("id");

          if (!newRecord) {
            data.id = buffered.get("id");
          }
          data.name = buffered.get("name");
          data.html = buffered.get("html");

          (0, _ajax.ajax)(newRecord ? "/admin/plugins/pluginad/house_creatives" : "/admin/plugins/pluginad/house_creatives/" + buffered.get("id"), {
            type: newRecord ? "POST" : "PUT",
            data: data
          }).then(function (ajaxData) {
            _this.commitBuffer();
            _this.set("savingStatus", I18n.t("saved"));
            if (newRecord) {
              var model = _this.get("model");
              model.set("id", ajaxData.house_ad.id);
              var houseAds = _this.get("adminPluginsHouseAds.model");
              if (!houseAds.includes(model)) {
                houseAds.pushObject(model);
              }
              _this.transitionToRoute("adminPlugins.houseAds.show", model.get("id"));
            }
          }).catch(_ajaxError.popupAjaxError).finally(function () {
            _this.setProperties({
              saving: false,
              savingStatus: ""
            });
          });
        }
      },
      cancel: function cancel() {
        this.rollbackBuffer();
      },
      destroy: function destroy() {
        var _this2 = this;

        var houseAds = this.get("adminPluginsHouseAds.model");
        var model = this.get("model");

        if (!model.get("id")) {
          this.transitionToRoute("adminPlugins.houseAds.index");
          return;
        }

        (0, _ajax.ajax)("/admin/plugins/pluginad/house_creatives/" + model.get("id"), {
          type: "DELETE"
        }).then(function () {
          houseAds.removeObject(model);
          _this2.transitionToRoute("adminPlugins.houseAds.index");
        }).catch(function () {
          return bootbox.alert(I18n.t("generic_error"));
        });
      }
    }
  });
});
define("discourse/plugins/discourse-adplugin/discourse/controllers/admin-plugins-house-ads-index", ["exports"], function (exports) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = Ember.Controller.extend({
    adminPluginsHouseAds: Ember.inject.controller("adminPlugins.houseAds"),
    houseAds: Ember.computed.alias("adminPluginsHouseAds.model"),
    adSettings: Ember.computed.alias("adminPluginsHouseAds.houseAdsSettings")
  });
});
define("discourse/plugins/discourse-adplugin/discourse/adplugin-route-map", ["exports"], function (exports) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = {
    resource: "admin.adminPlugins",
    path: "/plugins",
    map: function map() {
      this.route("houseAds", { path: "/pluginad/house_creatives" }, function () {
        this.route("index", { path: "/" });
        this.route("show", { path: "/:ad_id" });
      });
    }
  };
});
define("discourse/plugins/discourse-adplugin/discourse/components/amazon-product-links", ["exports", "discourse/plugins/discourse-adplugin/discourse/components/ad-component", "discourse-common/utils/decorators"], function (exports, _adComponent, _decorators) {
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

  var _dec, _dec2, _dec3, _dec4, _dec5, _dec6, _dec7, _desc, _value, _obj;

  var data = {
    "topic-list-top": {},
    "topic-above-post-stream": {},
    "topic-above-suggested": {},
    "post-bottom": {}
  };

  if (!Discourse.Mobile.mobileView && Discourse.SiteSettings.amazon_topic_list_top_src_code) {
    data["topic-list-top"]["user_input"] = Discourse.SiteSettings.amazon_topic_list_top_src_code;
    data["topic-list-top"]["amazon_width"] = parseInt(Discourse.SiteSettings.amazon_topic_list_top_ad_width_code, 10);
    data["topic-list-top"]["amazon_height"] = parseInt(Discourse.SiteSettings.amazon_topic_list_top_ad_height_code, 10);
  }

  if (Discourse.Mobile.mobileView && Discourse.SiteSettings.amazon_mobile_topic_list_top_src_code) {
    data["topic-list-top"]["user_input_mobile"] = Discourse.SiteSettings.amazon_mobile_topic_list_top_src_code;
    data["topic-list-top"]["mobile_amazon_width"] = parseInt(Discourse.SiteSettings.amazon_mobile_topic_list_top_ad_width_code, 10);
    data["topic-list-top"]["mobile_amazon_height"] = parseInt(Discourse.SiteSettings.amazon_mobile_topic_list_top_ad_height_code, 10);
  }

  if (!Discourse.Mobile.mobileView && Discourse.SiteSettings.amazon_topic_above_post_stream_src_code) {
    data["topic-above-post-stream"]["user_input"] = Discourse.SiteSettings.amazon_topic_above_post_stream_src_code;
    data["topic-above-post-stream"]["amazon_width"] = parseInt(Discourse.SiteSettings.amazon_topic_above_post_stream_ad_width_code, 10);
    data["topic-above-post-stream"]["amazon_height"] = parseInt(Discourse.SiteSettings.amazon_topic_above_post_stream_ad_height_code, 10);
  }

  if (Discourse.Mobile.mobileView && Discourse.SiteSettings.amazon_mobile_topic_above_post_stream_src_code) {
    data["topic-above-post-stream"]["user_input_mobile"] = Discourse.SiteSettings.amazon_mobile_topic_above_post_stream_src_code;
    data["topic-above-post-stream"]["mobile_amazon_width"] = parseInt(Discourse.SiteSettings.amazon_mobile_topic_above_post_stream_ad_width_code, 10);
    data["topic-above-post-stream"]["mobile_amazon_height"] = parseInt(Discourse.SiteSettings.amazon_mobile_topic_above_post_stream_ad_height_code, 10);
  }

  if (!Discourse.Mobile.mobileView && Discourse.SiteSettings.amazon_topic_above_suggested_src_code) {
    data["topic-above-suggested"]["user_input"] = Discourse.SiteSettings.amazon_topic_above_suggested_src_code;
    data["topic-above-suggested"]["amazon_width"] = parseInt(Discourse.SiteSettings.amazon_topic_above_suggested_ad_width_code, 10);
    data["topic-above-suggested"]["amazon_height"] = parseInt(Discourse.SiteSettings.amazon_topic_above_suggested_ad_height_code, 10);
  }

  if (Discourse.Mobile.mobileView && Discourse.SiteSettings.amazon_mobile_topic_above_suggested_src_code) {
    data["topic-above-suggested"]["user_input_mobile"] = Discourse.SiteSettings.amazon_mobile_topic_above_suggested_src_code;
    data["topic-above-suggested"]["mobile_amazon_width"] = parseInt(Discourse.SiteSettings.amazon_mobile_topic_above_suggested_ad_width_code, 10);
    data["topic-above-suggested"]["mobile_amazon_height"] = parseInt(Discourse.SiteSettings.amazon_mobile_topic_above_suggested_ad_height_code, 10);
  }

  if (!Discourse.Mobile.mobileView && Discourse.SiteSettings.amazon_post_bottom_src_code) {
    data["post-bottom"]["user_input"] = Discourse.SiteSettings.amazon_post_bottom_src_code;
    data["post-bottom"]["amazon_width"] = parseInt(Discourse.SiteSettings.amazon_post_bottom_ad_width_code, 10);
    data["post-bottom"]["amazon_height"] = parseInt(Discourse.SiteSettings.amazon_post_bottom_ad_height_code, 10);
  }

  if (Discourse.Mobile.mobileView && Discourse.SiteSettings.amazon_mobile_post_bottom_src_code) {
    data["post-bottom"]["user_input_mobile"] = Discourse.SiteSettings.amazon_mobile_post_bottom_src_code;
    data["post-bottom"]["mobile_amazon_width"] = parseInt(Discourse.SiteSettings.amazon_mobile_post_bottom_ad_width_code, 10);
    data["post-bottom"]["mobile_amazon_height"] = parseInt(Discourse.SiteSettings.amazon_mobile_post_bottom_ad_height_code, 10);
  }

  exports.default = _adComponent.default.extend((_dec = (0, _decorators.default)("amazon_width", "amazon_height"), _dec2 = (0, _decorators.default)("mobile_amazon_width", "mobile_amazon_height"), _dec3 = (0, _decorators.default)("mobile_amazon_width"), _dec4 = (0, _decorators.default)("user_input"), _dec5 = (0, _decorators.default)("user_input_mobile"), _dec6 = (0, _decorators.default)("currentUser.trust_level"), _dec7 = (0, _decorators.default)("postNumber"), (_obj = {
    classNames: ["amazon-product-links"],

    showAd: Ember.computed.and("showToTrustLevel", "showToGroups", "showAfterPost", "showOnCurrentPage"),

    init: function init() {
      var placement = this.get("placement");
      this.set("user_input", data[placement]["user_input"]);
      this.set("amazon_width", data[placement]["amazon_width"]);
      this.set("amazon_height", data[placement]["amazon_height"]);
      this.set("user_input_mobile", data[placement]["user_input_mobile"]);
      this.set("mobile_amazon_height", data[placement]["mobile_amazon_height"]);
      this.set("mobile_amazon_width", data[placement]["mobile_amazon_width"]);
      this._super();
    },
    adWrapperStyle: function adWrapperStyle(w, h) {
      return ("width: " + w + "px; height: " + h + "px;").htmlSafe();
    },
    adWrapperStyleMobile: function adWrapperStyleMobile(w, h) {
      return ("width: " + w + "px; height: " + h + "px;").htmlSafe();
    },
    adTitleStyleMobile: function adTitleStyleMobile(w) {
      return ("width: " + w + "px;").htmlSafe();
    },
    userInput: function userInput(_userInput) {
      return ("" + _userInput).htmlSafe();
    },
    userInputMobile: function userInputMobile(userInput) {
      return ("" + userInput).htmlSafe();
    },
    showToTrustLevel: function showToTrustLevel(trustLevel) {
      return !(trustLevel && trustLevel > Discourse.SiteSettings.amazon_through_trust_level);
    },
    showAfterPost: function showAfterPost(postNumber) {
      if (!postNumber) {
        return true;
      }

      return this.isNthPost(parseInt(this.siteSettings.amazon_nth_post_code, 10));
    }
  }, (_applyDecoratedDescriptor(_obj, "adWrapperStyle", [_dec], Object.getOwnPropertyDescriptor(_obj, "adWrapperStyle"), _obj), _applyDecoratedDescriptor(_obj, "adWrapperStyleMobile", [_dec2], Object.getOwnPropertyDescriptor(_obj, "adWrapperStyleMobile"), _obj), _applyDecoratedDescriptor(_obj, "adTitleStyleMobile", [_dec3], Object.getOwnPropertyDescriptor(_obj, "adTitleStyleMobile"), _obj), _applyDecoratedDescriptor(_obj, "userInput", [_dec4], Object.getOwnPropertyDescriptor(_obj, "userInput"), _obj), _applyDecoratedDescriptor(_obj, "userInputMobile", [_dec5], Object.getOwnPropertyDescriptor(_obj, "userInputMobile"), _obj), _applyDecoratedDescriptor(_obj, "showToTrustLevel", [_dec6], Object.getOwnPropertyDescriptor(_obj, "showToTrustLevel"), _obj), _applyDecoratedDescriptor(_obj, "showAfterPost", [_dec7], Object.getOwnPropertyDescriptor(_obj, "showAfterPost"), _obj)), _obj)));
});
define("discourse/plugins/discourse-adplugin/discourse/components/codefund-ad", ["exports", "discourse/plugins/discourse-adplugin/discourse/components/ad-component", "discourse-common/utils/decorators", "rsvp"], function (exports, _adComponent, _decorators, _rsvp) {
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

  var _dec, _dec2, _dec3, _dec4, _desc, _value, _obj;

  var _loaded = false,
      _promise = null;

  var propertyId = Discourse.SiteSettings.codefund_property_id;

  function loadCodeFund() {
    if (_loaded) {
      return Ember.RSVP.resolve();
    }

    if (_promise) {
      return _promise;
    }

    var url = "https://codefund.io/properties/" + propertyId + "/funder.json";

    _promise = new _rsvp.Promise(function (resolve, reject) {
      var xhr = new XMLHttpRequest();

      xhr.open("GET", url);
      xhr.onreadystatechange = handler;
      xhr.responseType = "json";
      xhr.setRequestHeader("Accept", "application/json");
      xhr.send();

      function handler() {
        if (this.readyState === this.DONE) {
          _loaded = true;

          if (this.status === 200) {
            resolve(this.response);
          } else {
            reject(new Error("getJSON: `" + url + "` failed with status: [" + this.status + "]"));
          }
        }
      }
    });

    return _promise;
  }

  exports.default = _adComponent.default.extend((_dec = (0, _decorators.observes)("listLoading"), _dec2 = (0, _decorators.default)("currentUser.trust_level"), _dec3 = (0, _decorators.default)("showToTrustLevel", "showToGroups", "showAfterPost", "showOnCurrentPage"), _dec4 = (0, _decorators.default)("postNumber"), (_obj = {
    classNameBindings: [":codefund-ad"],
    propertyId: propertyId,
    adRequested: false,
    adDetails: {},

    displayPostBottom: Ember.computed.equal("placement", "post-bottom"),
    displayTopicAbovePostStream: Ember.computed.equal("placement", "topic-above-post-stream"),
    displayTopicAboveSuggested: Ember.computed.equal("placement", "topic-above-suggested"),
    displayTopicListTop: Ember.computed.equal("placement", "topic-list-top"),

    _triggerAds: function _triggerAds() {
      var _this = this;

      if (!propertyId) return;

      this.set("adRequested", true);
      loadCodeFund().then(function (data) {
        _loaded = false;
        _promise = null;
        _this.set("adDetails", data);
        _this.set("adRequested", false);
      }).catch(function (error) {
        // eslint-disable-next-line no-console
        console.log(error);
      });
    },
    didInsertElement: function didInsertElement() {
      this._super();

      if (!this.get("showAd")) {
        return;
      }

      if (this.get("listLoading")) {
        return;
      }

      Ember.run.scheduleOnce("afterRender", this, this._triggerAds);
    },
    waitForLoad: function waitForLoad() {
      if (this.get("adRequested")) {
        return;
      } // already requested that this ad unit be populated
      if (!this.get("listLoading")) {
        Ember.run.scheduleOnce("afterRender", this, this._triggerAds);
      }
    },
    showToTrustLevel: function showToTrustLevel(trustLevel) {
      return !(trustLevel && trustLevel > this.siteSettings.codefund_through_trust_level);
    },
    showAd: function showAd(showToTrustLevel, showToGroups, showAfterPost, showOnCurrentPage) {
      return this.siteSettings.codefund_property_id && showToTrustLevel && showToGroups && showAfterPost && showOnCurrentPage;
    },
    showAfterPost: function showAfterPost(postNumber) {
      if (!postNumber) {
        return true;
      }

      return this.isNthPost(parseInt(this.siteSettings.codefund_nth_post, 10));
    }
  }, (_applyDecoratedDescriptor(_obj, "waitForLoad", [_dec], Object.getOwnPropertyDescriptor(_obj, "waitForLoad"), _obj), _applyDecoratedDescriptor(_obj, "showToTrustLevel", [_dec2], Object.getOwnPropertyDescriptor(_obj, "showToTrustLevel"), _obj), _applyDecoratedDescriptor(_obj, "showAd", [_dec3], Object.getOwnPropertyDescriptor(_obj, "showAd"), _obj), _applyDecoratedDescriptor(_obj, "showAfterPost", [_dec4], Object.getOwnPropertyDescriptor(_obj, "showAfterPost"), _obj)), _obj)));
});
define("discourse/plugins/discourse-adplugin/discourse/components/google-adsense", ["exports", "discourse/plugins/discourse-adplugin/discourse/components/ad-component", "discourse-common/utils/decorators", "discourse/lib/load-script"], function (exports, _adComponent, _decorators, _loadScript) {
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

  var _dec, _dec2, _dec3, _dec4, _dec5, _dec6, _dec7, _dec8, _dec9, _desc, _value, _obj;

  var _loaded = false,
      _promise = null,
      renderCounts = {},
      publisher_id = Discourse.SiteSettings.adsense_publisher_code;

  function parseAdWidth(value) {
    if (value === "responsive") {
      return "auto";
    }
    var w = parseInt(value.substring(0, 3).trim(), 10);
    if (isNaN(w)) {
      return "auto";
    } else {
      return w + "px";
    }
  }

  function parseAdHeight(value) {
    if (value === "responsive") {
      return "auto";
    }
    var h = parseInt(value.substring(4, 7).trim(), 10);
    if (isNaN(h)) {
      return "auto";
    } else {
      return h + "px";
    }
  }

  function loadAdsense() {
    if (_loaded) {
      return Ember.RSVP.resolve();
    }

    if (_promise) {
      return _promise;
    }

    var adsenseSrc = ("https:" === document.location.protocol ? "https:" : "http:") + "//pagead2.googlesyndication.com/pagead/js/adsbygoogle.js";
    _promise = (0, _loadScript.default)(adsenseSrc, { scriptTag: true }).then(function () {
      _loaded = true;
    });

    return _promise;
  }

  var DESKTOP_SETTINGS = {
    "topic-list-top": {
      code: "adsense_topic_list_top_code",
      sizes: "adsense_topic_list_top_ad_sizes"
    },
    "topic-above-post-stream": {
      code: "adsense_topic_above_post_stream_code",
      sizes: "adsense_topic_above_post_stream_ad_sizes"
    },
    "topic-above-suggested": {
      code: "adsense_topic_above_suggested_code",
      sizes: "adsense_topic_above_suggested_ad_sizes"
    },
    "post-bottom": {
      code: "adsense_post_bottom_code",
      sizes: "adsense_post_bottom_ad_sizes"
    }
  };

  var MOBILE_SETTINGS = {
    "topic-list-top": {
      code: "adsense_mobile_topic_list_top_code",
      sizes: "adsense_mobile_topic_list_top_ad_size"
    },
    "topic-above-post-stream": {
      code: "adsense_mobile_topic_above_post_stream_code",
      sizes: "adsense_mobile_topic_above_post_stream_ad_size"
    },
    "topic-above-suggested": {
      code: "adsense_mobile_topic_above_suggested_code",
      sizes: "adsense_mobile_topic_above_suggested_ad_size"
    },
    "post-bottom": {
      code: "adsense_mobile_post_bottom_code",
      sizes: "adsense_mobile_post_bottom_ad_size"
    }
  };

  exports.default = _adComponent.default.extend((_dec = (0, _decorators.observes)("listLoading"), _dec2 = (0, _decorators.default)("ad_width"), _dec3 = (0, _decorators.default)("placement", "showAd"), _dec4 = (0, _decorators.default)("isResponsive"), _dec5 = (0, _decorators.default)("ad_width", "ad_height", "isResponsive"), _dec6 = (0, _decorators.default)("adWrapperStyle", "isResponsive"), _dec7 = (0, _decorators.default)("currentUser.trust_level"), _dec8 = (0, _decorators.default)("showToTrustLevel", "showToGroups", "showAfterPost", "showOnCurrentPage"), _dec9 = (0, _decorators.default)("postNumber"), (_obj = {
    classNameBindings: [":google-adsense", "classForSlot", "isResponsive:adsense-responsive"],
    loadedGoogletag: false,

    publisher_id: publisher_id,
    ad_width: null,
    ad_height: null,

    adRequested: false,

    init: function init() {
      var config = void 0,
          size = void 0;
      var placement = this.get("placement");

      if (this.site.mobileView) {
        config = MOBILE_SETTINGS[placement];
      } else {
        config = DESKTOP_SETTINGS[placement];
      }

      if (!renderCounts[placement]) {
        renderCounts[placement] = 0;
      }

      var sizes = (this.siteSettings[config.sizes] || "").split("|");

      if (sizes.length === 1) {
        size = sizes[0];
      } else {
        size = sizes[renderCounts[placement] % sizes.length];
        renderCounts[placement] += 1;
      }

      this.set("ad_width", parseAdWidth(size));
      this.set("ad_height", parseAdHeight(size));
      this.set("ad_code", this.siteSettings[config.code]);
      this._super();
    },
    _triggerAds: function _triggerAds() {
      if (Ember.testing) {
        return; // Don't load external JS during tests
      }

      this.set("adRequested", true);
      loadAdsense().then(function () {
        var adsbygoogle = window.adsbygoogle || [];

        try {
          adsbygoogle.push({}); // ask AdSense to fill one ad unit
        } catch (ex) {}
      });
    },
    didInsertElement: function didInsertElement() {
      this._super();

      if (!this.get("showAd")) {
        return;
      }

      if (this.get("listLoading")) {
        return;
      }

      Ember.run.scheduleOnce("afterRender", this, this._triggerAds);
    },
    waitForLoad: function waitForLoad() {
      if (this.get("adRequested")) {
        return;
      } // already requested that this ad unit be populated
      if (!this.get("listLoading")) {
        Ember.run.scheduleOnce("afterRender", this, this._triggerAds);
      }
    },
    isResponsive: function isResponsive(adWidth) {
      return adWidth === "auto";
    },
    classForSlot: function classForSlot(placement, showAd) {
      return showAd ? ("adsense-" + placement).htmlSafe() : "";
    },
    autoAdFormat: function autoAdFormat(isResponsive) {
      return isResponsive ? "auto".htmlSafe() : false;
    },
    adWrapperStyle: function adWrapperStyle(w, h, isResponsive) {
      return (isResponsive ? "" : "width: " + w + "; height: " + h + ";").htmlSafe();
    },
    adInsStyle: function adInsStyle(adWrapperStyle, isResponsive) {
      return ("display: " + (isResponsive ? "block" : "inline-block") + "; " + adWrapperStyle).htmlSafe();
    },
    showToTrustLevel: function showToTrustLevel(trustLevel) {
      return !(trustLevel && trustLevel > this.siteSettings.adsense_through_trust_level);
    },
    showAd: function showAd(showToTrustLevel, showToGroups, showAfterPost, showOnCurrentPage) {
      return this.siteSettings.adsense_publisher_code && showToTrustLevel && showToGroups && showAfterPost && showOnCurrentPage;
    },
    showAfterPost: function showAfterPost(postNumber) {
      if (!postNumber) {
        return true;
      }

      return this.isNthPost(parseInt(this.siteSettings.adsense_nth_post_code, 10));
    }
  }, (_applyDecoratedDescriptor(_obj, "waitForLoad", [_dec], Object.getOwnPropertyDescriptor(_obj, "waitForLoad"), _obj), _applyDecoratedDescriptor(_obj, "isResponsive", [_dec2], Object.getOwnPropertyDescriptor(_obj, "isResponsive"), _obj), _applyDecoratedDescriptor(_obj, "classForSlot", [_dec3], Object.getOwnPropertyDescriptor(_obj, "classForSlot"), _obj), _applyDecoratedDescriptor(_obj, "autoAdFormat", [_dec4], Object.getOwnPropertyDescriptor(_obj, "autoAdFormat"), _obj), _applyDecoratedDescriptor(_obj, "adWrapperStyle", [_dec5], Object.getOwnPropertyDescriptor(_obj, "adWrapperStyle"), _obj), _applyDecoratedDescriptor(_obj, "adInsStyle", [_dec6], Object.getOwnPropertyDescriptor(_obj, "adInsStyle"), _obj), _applyDecoratedDescriptor(_obj, "showToTrustLevel", [_dec7], Object.getOwnPropertyDescriptor(_obj, "showToTrustLevel"), _obj), _applyDecoratedDescriptor(_obj, "showAd", [_dec8], Object.getOwnPropertyDescriptor(_obj, "showAd"), _obj), _applyDecoratedDescriptor(_obj, "showAfterPost", [_dec9], Object.getOwnPropertyDescriptor(_obj, "showAfterPost"), _obj)), _obj)));
});
define("discourse/plugins/discourse-adplugin/discourse/components/house-ad", ["exports", "discourse/plugins/discourse-adplugin/discourse/components/ad-component", "discourse-common/utils/decorators"], function (exports, _adComponent, _decorators) {
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

  var _dec, _dec2, _dec3, _dec4, _desc, _value, _obj;

  var adIndex = {
    topic_list_top: null,
    topic_above_post_stream: null,
    topic_above_suggested: null,
    post_bottom: null
  };

  exports.default = _adComponent.default.extend((_dec = (0, _decorators.default)("placement", "showAd"), _dec2 = (0, _decorators.default)("showToGroups", "showAfterPost", "showOnCurrentPage"), _dec3 = (0, _decorators.default)("postNumber"), _dec4 = (0, _decorators.observes)("refreshOnChange"), (_obj = {
    classNames: ["house-creative"],
    classNameBindings: ["adUnitClass"],
    adHtml: "",

    adUnitClass: function adUnitClass(placement, showAd) {
      return showAd ? "house-" + placement : "";
    },
    showAd: function showAd(showToGroups, showAfterPost, showOnCurrentPage) {
      return showToGroups && showAfterPost && showOnCurrentPage;
    },
    showAfterPost: function showAfterPost(postNumber) {
      if (!postNumber) {
        return true;
      }

      return this.isNthPost(parseInt(this.site.get("house_creatives.settings.after_nth_post"), 10));
    },
    chooseAdHtml: function chooseAdHtml() {
      var houseAds = this.site.get("house_creatives"),
          placement = this.get("placement").replace(/-/g, "_"),
          adNames = this.adsNamesForSlot(placement);

      if (adNames.length > 0) {
        if (!adIndex[placement]) {
          adIndex[placement] = 0;
        }
        var ad = houseAds.creatives[adNames[adIndex[placement]]] || "";
        adIndex[placement] = (adIndex[placement] + 1) % adNames.length;
        return ad;
      } else {
        return "";
      }
    },
    adsNamesForSlot: function adsNamesForSlot(placement) {
      var houseAds = this.site.get("house_creatives");

      if (!houseAds || !houseAds.settings) {
        return [];
      }

      var adsForSlot = houseAds.settings[placement];

      if (Object.keys(houseAds.creatives).length > 0 && !Ember.isBlank(adsForSlot)) {
        return adsForSlot.split("|");
      } else {
        return [];
      }
    },
    refreshAd: function refreshAd() {
      if (this.get("listLoading")) {
        return;
      }

      this.set("adHtml", this.chooseAdHtml());
    },
    didInsertElement: function didInsertElement() {
      var _this = this;

      this._super.apply(this, arguments);

      if (!this.get("showAd")) {
        return;
      }

      if (this.get("listLoading")) {
        return;
      }

      if (adIndex.topic_list_top === null) {
        // start at a random spot in the ad inventory
        Object.keys(adIndex).forEach(function (placement) {
          var adNames = _this.adsNamesForSlot(placement);
          adIndex[placement] = Math.floor(Math.random() * adNames.length);
        });
      }

      this.refreshAd();
    }
  }, (_applyDecoratedDescriptor(_obj, "adUnitClass", [_dec], Object.getOwnPropertyDescriptor(_obj, "adUnitClass"), _obj), _applyDecoratedDescriptor(_obj, "showAd", [_dec2], Object.getOwnPropertyDescriptor(_obj, "showAd"), _obj), _applyDecoratedDescriptor(_obj, "showAfterPost", [_dec3], Object.getOwnPropertyDescriptor(_obj, "showAfterPost"), _obj), _applyDecoratedDescriptor(_obj, "refreshAd", [_dec4], Object.getOwnPropertyDescriptor(_obj, "refreshAd"), _obj)), _obj)));
});
define("discourse/plugins/discourse-adplugin/discourse/components/carbonads-ad", ["exports", "discourse/plugins/discourse-adplugin/discourse/components/ad-component", "discourse-common/utils/decorators"], function (exports, _adComponent, _decorators) {
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

  var serve_id = Discourse.SiteSettings.carbonads_serve_id,
      placement = Discourse.SiteSettings.carbonads_placement;

  exports.default = _adComponent.default.extend((_dec = (0, _decorators.default)("serve_id"), _dec2 = (0, _decorators.default)("currentUser.trust_level"), _dec3 = (0, _decorators.default)("showToTrustLevel", "showToGroups", "showOnCurrentPage"), (_obj = {
    init: function init() {
      this.set("serve_id", serve_id);
      this._super();
    },
    url: function url(serveId) {
      return ("//cdn.carbonads.com/carbon.js?serve=" + serveId + "&placement=" + placement).htmlSafe();
    },
    showToTrustLevel: function showToTrustLevel(trustLevel) {
      return !(trustLevel && trustLevel > Discourse.SiteSettings.carbonads_through_trust_level);
    },
    showAd: function showAd(showToTrustLevel, showToGroups, showOnCurrentPage) {
      return placement && serve_id && showToTrustLevel && showToGroups && showOnCurrentPage;
    }
  }, (_applyDecoratedDescriptor(_obj, "url", [_dec], Object.getOwnPropertyDescriptor(_obj, "url"), _obj), _applyDecoratedDescriptor(_obj, "showToTrustLevel", [_dec2], Object.getOwnPropertyDescriptor(_obj, "showToTrustLevel"), _obj), _applyDecoratedDescriptor(_obj, "showAd", [_dec3], Object.getOwnPropertyDescriptor(_obj, "showAd"), _obj)), _obj)));
});
define("discourse/plugins/discourse-adplugin/discourse/components/house-ads-list-setting", ["exports", "discourse/plugins/discourse-adplugin/discourse/components/house-ads-setting"], function (exports, _houseAdsSetting) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = _houseAdsSetting.default.extend({
    classNames: "house-ads-setting house-ads-list-setting",
    adNames: Ember.computed.mapBy("allAds", "name")
  });
});
define("discourse/plugins/discourse-adplugin/discourse/components/ad-slot", ["exports", "discourse/plugins/discourse-adplugin/discourse/components/ad-component", "discourse-common/utils/decorators"], function (exports, _adComponent, _decorators) {
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

  var adConfig = Ember.Object.create({
    "google-adsense": {
      settingPrefix: "adsense", // settings follow naming convention
      enabledSetting: "adsense_publisher_code",
      nthPost: "adsense_nth_post_code"
    },
    "google-dfp-ad": {
      settingPrefix: "dfp", // settings follow naming convention
      enabledSetting: "dfp_publisher_id",
      nthPost: "dfp_nth_post_code"
    },
    "amazon-product-links": {
      settingPrefix: "amazon",
      enabledSetting: false,
      nthPost: "amazon_nth_post_code",
      desktop: {
        "topic-list-top": "amazon_topic_list_top_src_code",
        "post-bottom": "amazon_post_bottom_src_code",
        "topic-above-post-stream": "amazon_topic_above_post_stream_src_code",
        "topic-above-suggested": "amazon_topic_above_suggested_src_code"
      },
      mobile: {
        "topic-list-top": "amazon_mobile_topic_list_top_src_code",
        "post-bottom": "amazon_mobile_post_bottom_src_code",
        "topic-above-post-stream": "amazon_mobile_topic_above_post_stream_src_code",
        "topic-above-suggested": "amazon_mobile_topic_above_suggested_src_code"
      }
    },
    "codefund-ad": {
      settingPrefix: "codefund",
      enabledSetting: "codefund_property_id",
      nthPost: "codefund_nth_post",
      desktop: {
        "topic-list-top": "codefund_top_of_topic_list_enabled",
        "post-bottom": "codefund_below_post_enabled",
        "topic-above-post-stream": "codefund_above_post_stream_enabled",
        "topic-above-suggested": "codefund_above_suggested_enabled"
      }
    },
    "carbonads-ad": {
      settingPrefix: "carbonads",
      enabledSetting: "carbonads_serve_id",
      desktop: {
        "topic-list-top": "carbonads_topic_list_top_enabled",
        "post-bottom": false,
        "topic-above-post-stream": "carbonads_above_post_stream_enabled",
        "topic-above-suggested": false
      }
    },
    "adbutler-ad": {
      settingPrefix: "adbutler",
      enabledSetting: "adbutler_publisher_id",
      desktop: {
        "topic-list-top": "adbutler_topic_list_top_zone_id",
        "post-bottom": "adbutler_post_bottom_zone_id",
        "topic-above-post-stream": "adbutler_topic_above_post_stream_zone_id",
        "topic-above-suggested": "adbutler_topic_above_suggested_zone_id"
      },
      mobile: {
        "topic-list-top": "adbutler_mobile_topic_list_top_zone_id",
        "post-bottom": "adbutler_mobile_post_bottom_zone_id",
        "topic-above-post-stream": "adbutler_mobile_topic_above_post_stream_zone_id",
        "topic-above-suggested": "adbutler_mobile_topic_above_suggested_zone_id"
      }
    }
  });

  var displayCounts = {
    houseAds: 0,
    allAds: 0
  };

  exports.default = _adComponent.default.extend((_dec = (0, _decorators.default)("placement", "postNumber"), _dec2 = (0, _decorators.observes)("refreshOnChange"), _dec3 = (0, _decorators.default)("placement", "availableAdTypes", "needsUpdate"), (_obj = {
    needsUpdate: false,

    availableAdTypes: function availableAdTypes(placement, postNumber) {
      var _this = this;

      var types = [];
      var houseAds = this.site.get("house_creatives"),
          placeUnderscored = placement.replace(/-/g, "_");

      if (houseAds && houseAds.settings) {
        var adsForSlot = houseAds.settings[placeUnderscored];

        if (Object.keys(houseAds.creatives).length > 0 && !Ember.isBlank(adsForSlot) && (!postNumber || this.isNthPost(parseInt(houseAds.settings.after_nth_post, 10)))) {
          types.push("house-ad");
        }
      }

      Object.keys(adConfig).forEach(function (adNetwork) {
        var config = adConfig[adNetwork];
        var settingNames = null,
            name = void 0;

        if ((config.enabledSetting && !Ember.isBlank(_this.siteSettings[config.enabledSetting]) || config.enabledSetting === false) && (!postNumber || !config.nthPost || _this.isNthPost(parseInt(_this.siteSettings[config.nthPost], 10)))) {
          if (_this.site.mobileView) {
            settingNames = config.mobile || config.desktop;
          } else {
            settingNames = config.desktop;
          }

          if (settingNames) {
            name = settingNames[placement];
          }

          if (name === undefined) {
            // follows naming convention: prefix_(mobile_)_{placement}_code
            name = config.settingPrefix + "_" + (_this.site.mobileView ? "mobile_" : "") + placeUnderscored + "_code";
          }

          if (name !== false && _this.siteSettings[name] !== false && !Ember.isBlank(_this.siteSettings[name])) {
            types.push(adNetwork);
          }
        }
      });

      return types;
    },
    changed: function changed() {
      if (this.get("listLoading")) {
        return;
      }

      // force adComponents to be recomputed
      this.notifyPropertyChange("needsUpdate");
    },
    adComponents: function adComponents(placement, availableAdTypes) {
      if (!availableAdTypes.includes("house-ad") || availableAdTypes.length === 1) {
        // Current behaviour is to allow multiple ads from different networks
        // to show in the same place. We could change this to choose one somehow.
        return availableAdTypes;
      }

      var houseAds = this.site.get("house_creatives");
      var houseAdsSkipped = false;

      if (houseAds.settings.house_ads_frequency === 100) {
        // house always wins
        return ["house-ad"];
      } else if (houseAds.settings.house_ads_frequency > 0) {
        // show house ads the given percent of the time
        if (displayCounts.allAds === 0 || 100 * displayCounts.houseAds / displayCounts.allAds < houseAds.settings.house_ads_frequency) {
          displayCounts.houseAds += 1;
          displayCounts.allAds += 1;
          return ["house-ad"];
        } else {
          houseAdsSkipped = true;
        }
      }

      var networkNames = availableAdTypes.filter(function (x) {
        return x !== "house-ad";
      });

      if (houseAdsSkipped) {
        displayCounts.allAds += networkNames.length;
      }

      return networkNames;
    }
  }, (_applyDecoratedDescriptor(_obj, "availableAdTypes", [_dec], Object.getOwnPropertyDescriptor(_obj, "availableAdTypes"), _obj), _applyDecoratedDescriptor(_obj, "changed", [_dec2], Object.getOwnPropertyDescriptor(_obj, "changed"), _obj), _applyDecoratedDescriptor(_obj, "adComponents", [_dec3], Object.getOwnPropertyDescriptor(_obj, "adComponents"), _obj)), _obj)));
});
define("discourse/plugins/discourse-adplugin/discourse/components/house-ads-chooser", ["exports", "select-kit/components/multi-select", "@ember/object"], function (exports, _multiSelect, _object) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  var _Ember = Ember,
      makeArray = _Ember.makeArray;
  exports.default = _multiSelect.default.extend({
    classNames: ["house-ads-chooser"],
    filterable: true,
    filterPlaceholder: "admin.adplugin.house_ads.filter_placeholder",
    tokenSeparator: "|",
    allowCreate: false,
    allowAny: false,
    settingValue: "",
    valueAttribute: null,
    nameProperty: null,

    value: (0, _object.computed)("settingValue", function () {
      return this.settingValue.toString().split(this.tokenSeparator).filter(Boolean);
    }),

    // TODO: kept for legacy, remove when Discourse is 2.5
    mutateValues: function mutateValues(values) {
      this.set("settingValue", values.join(this.tokenSeparator));
    },
    computeValues: function computeValues() {
      return this.settingValue.split(this.tokenSeparator).filter(Boolean);
    },


    content: (0, _object.computed)("choices", function () {
      return makeArray(this.choices);
    }),

    actions: {
      onChange: function onChange(value) {
        var settingValue = makeArray(value).join(this.tokenSeparator);
        this.attrs.onChange && this.attrs.onChange(settingValue);
      }
    }
  });
});
define("discourse/plugins/discourse-adplugin/discourse/components/ad-component", ["exports", "discourse-common/utils/decorators"], function (exports, _decorators) {
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

  var _dec, _dec2, _dec3, _dec4, _desc, _value, _obj;

  exports.default = Ember.Component.extend((_dec = (0, _decorators.default)("router.currentRoute.attributes.__type", "router.currentRoute.attributes.id"), _dec2 = (0, _decorators.default)("router.currentRoute.parent.attributes.archetype"), _dec3 = (0, _decorators.default)("currentUser.groups"), _dec4 = (0, _decorators.default)("currentCategoryId", "topicTagsDisableAds", "topicListTag", "isPersonalMessage", "isRestrictedCategory"), (_obj = {
    router: Ember.inject.service(),

    currentCategoryId: Ember.computed.or("router.currentRoute.attributes.category.id", "router.currentRoute.parent.attributes.category_id"),

    currentCategorySlug: Ember.computed.or("router.currentRoute.attributes.category.slug", "router.currentRoute.parent.attributes.category.slug"),

    // Server needs to compute this in case hidden tags are being used.
    topicTagsDisableAds: Ember.computed.alias("router.currentRoute.parent.attributes.tags_disable_ads"),

    isRestrictedCategory: Ember.computed.or("router.currentRoute.attributes.category.read_restricted", "router.currentRoute.parent.attributes.category.read_restricted"),

    topicListTag: function topicListTag(type, tag) {
      if (type === "tag" && tag) {
        return tag;
      }
    },
    isPersonalMessage: function isPersonalMessage(topicType) {
      return topicType === "private_message";
    },
    showToGroups: function showToGroups(groups) {
      var currentUser = Discourse.User.current();

      if (!currentUser || !groups || !this.siteSettings.no_ads_for_groups || this.siteSettings.no_ads_for_groups.length === 0) {
        return true;
      }

      var noAdsGroups = this.siteSettings.no_ads_for_groups.split("|");

      // TODO: Remove when 2.4 becomes the new stable. This is for backwards compatibility.
      var groupListUseIDs = this.site.group_list_use_ids;

      var currentGroups = groups;
      if (groupListUseIDs) {
        currentGroups = currentGroups.map(function (g) {
          return g.id.toString();
        });
      } else {
        currentGroups = currentGroups.map(function (g) {
          return g.name.toLowerCase();
        });
        noAdsGroups = noAdsGroups.map(function (g) {
          return g.toLowerCase();
        });
      }

      return !currentGroups.any(function (g) {
        return noAdsGroups.includes(g);
      });
    },
    showOnCurrentPage: function showOnCurrentPage(categoryId, topicTagsDisableAds, topicListTag, isPersonalMessage, isRestrictedCategory) {
      return !topicTagsDisableAds && (!categoryId || !this.siteSettings.no_ads_for_categories || !this.siteSettings.no_ads_for_categories.split("|").includes(categoryId.toString())) && (!topicListTag || !this.siteSettings.no_ads_for_tags || !this.siteSettings.no_ads_for_tags.split("|").includes(topicListTag)) && (!isPersonalMessage || !this.siteSettings.no_ads_for_personal_messages) && (!isRestrictedCategory || !this.siteSettings.no_ads_for_restricted_categories);
    },
    isNthPost: function isNthPost(n) {
      if (n && n > 0) {
        return this.get("postNumber") % n === 0;
      } else {
        return false;
      }
    }
  }, (_applyDecoratedDescriptor(_obj, "topicListTag", [_dec], Object.getOwnPropertyDescriptor(_obj, "topicListTag"), _obj), _applyDecoratedDescriptor(_obj, "isPersonalMessage", [_dec2], Object.getOwnPropertyDescriptor(_obj, "isPersonalMessage"), _obj), _applyDecoratedDescriptor(_obj, "showToGroups", [_dec3], Object.getOwnPropertyDescriptor(_obj, "showToGroups"), _obj), _applyDecoratedDescriptor(_obj, "showOnCurrentPage", [_dec4], Object.getOwnPropertyDescriptor(_obj, "showOnCurrentPage"), _obj)), _obj)));
});
define("discourse/plugins/discourse-adplugin/discourse/components/adbutler-ad", ["exports", "discourse/plugins/discourse-adplugin/discourse/components/ad-component", "discourse-common/utils/decorators", "discourse/lib/load-script"], function (exports, _adComponent, _decorators, _loadScript) {
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

  var _dec, _dec2, _dec3, _dec4, _desc, _value, _obj;

  var publisherId = Discourse.SiteSettings.adbutler_publisher_id;
  var adserverHostname = Discourse.SiteSettings.adbutler_adserver_hostname;

  var _loaded = false,
      _promise = null,
      _c = 0;

  function loadAdbutler() {
    if (_loaded) {
      return Ember.RSVP.resolve();
    }

    if (_promise) {
      return _promise;
    }

    _promise = (0, _loadScript.default)("https://" + adserverHostname + "/app.js", {
      scriptTag: true
    }).then(function () {
      _loaded = true;
    });

    return _promise;
  }

  exports.default = _adComponent.default.extend((_dec = (0, _decorators.observes)("listLoading"), _dec2 = (0, _decorators.default)("currentUser.trust_level"), _dec3 = (0, _decorators.default)("showToTrustLevel", "showToGroups", "showAfterPost", "showOnCurrentPage"), _dec4 = (0, _decorators.default)("postNumber"), (_obj = {
    divs: null,

    init: function init() {
      var dimensions = [728, 90];
      var configKey = "adbutler_";
      var className = "adbutler-";
      var dimClassName = "adbutler-ad";

      this.set("divs", []);

      if (this.site.mobileView) {
        dimensions = [320, 50];
        configKey += "mobile_";
        className += "mobile-";
        dimClassName = "adbutler-mobile-ad";
      }

      configKey += this.get("placement").replace(/-/g, "_") + "_zone_id";
      this.set("configKey", configKey);

      className += this.get("placement");
      this.set("className", className + " " + dimClassName);

      var zoneId = this.siteSettings[configKey];
      this.set("zoneId", zoneId);

      var divId = "placement-" + zoneId + "-" + _c;
      this.set("divId", divId);
      _c++;
      this.divs.push({
        divId: divId,
        publisherId: publisherId,
        zoneId: zoneId,
        dimensions: dimensions
      });

      this.set("publisherId", publisherId);
      this._super();
    },
    _triggerAds: function _triggerAds() {
      if (Ember.testing) {
        return; // Don't load external JS during tests
      }

      loadAdbutler().then(function () {
        if (this.divs.length > 0) {
          var abkw = window.abkw || "";
          window.AdButler.ads.push({
            handler: function handler(opt) {
              window.AdButler.register(opt.place.publisherId, opt.place.zoneId, opt.place.dimensions, opt.place.divId, opt);
            },
            opt: {
              place: this.divs.pop(),
              keywords: abkw,
              domain: adserverHostname,
              click: "CLICK_MACRO_PLACEHOLDER"
            }
          });
        }
      }.bind(this));
    },
    didInsertElement: function didInsertElement() {
      this._super();
      Ember.run.scheduleOnce("afterRender", this, this._triggerAds);
    },
    waitForLoad: function waitForLoad() {
      if (this.get("adRequested")) {
        return;
      } // already requested that this ad unit be populated
      if (!this.get("listLoading")) {
        Ember.run.scheduleOnce("afterRender", this, this._triggerAds);
      }
    },
    showToTrustLevel: function showToTrustLevel(trustLevel) {
      return !(trustLevel && trustLevel > Discourse.SiteSettings.adbutler_through_trust_level);
    },
    showAd: function showAd(showToTrustLevel, showToGroups, showAfterPost, showOnCurrentPage) {
      return publisherId && showToTrustLevel && showToGroups && showAfterPost && showOnCurrentPage;
    },
    showAfterPost: function showAfterPost(postNumber) {
      if (!postNumber) {
        return true;
      }
      return this.isNthPost(parseInt(this.siteSettings.adbutler_nth_post, 10));
    }
  }, (_applyDecoratedDescriptor(_obj, "waitForLoad", [_dec], Object.getOwnPropertyDescriptor(_obj, "waitForLoad"), _obj), _applyDecoratedDescriptor(_obj, "showToTrustLevel", [_dec2], Object.getOwnPropertyDescriptor(_obj, "showToTrustLevel"), _obj), _applyDecoratedDescriptor(_obj, "showAd", [_dec3], Object.getOwnPropertyDescriptor(_obj, "showAd"), _obj), _applyDecoratedDescriptor(_obj, "showAfterPost", [_dec4], Object.getOwnPropertyDescriptor(_obj, "showAfterPost"), _obj)), _obj)));
});
define("discourse/plugins/discourse-adplugin/discourse/components/house-ads-setting", ["exports", "discourse/lib/ajax", "discourse/lib/ajax-error", "discourse/lib/computed"], function (exports, _ajax, _ajaxError, _computed) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = Ember.Component.extend({
    classNames: "house-ads-setting",
    adValue: "",
    saving: false,
    savingStatus: "",
    title: (0, _computed.i18n)("name", "admin.adplugin.house_ads.%@.title"),
    help: (0, _computed.i18n)("name", "admin.adplugin.house_ads.%@.description"),
    changed: (0, _computed.propertyNotEqual)("adValue", "value"),

    init: function init() {
      this._super.apply(this, arguments);
      this.set("adValue", this.get("value"));
    },


    actions: {
      save: function save() {
        var _this = this;

        if (!this.get("saving")) {
          this.setProperties({
            saving: true,
            savingStatus: I18n.t("saving")
          });

          (0, _ajax.ajax)("/admin/plugins/pluginad/house_settings/" + this.get("name") + ".json", {
            type: "PUT",
            data: { value: this.get("adValue") }
          }).then(function () {
            var adSettings = _this.get("adSettings");
            adSettings.set(_this.get("name"), _this.get("adValue"));
            _this.setProperties({
              value: _this.get("adValue"),
              savingStatus: I18n.t("saved")
            });
          }).catch(_ajaxError.popupAjaxError).finally(function () {
            _this.setProperties({
              saving: false,
              savingStatus: ""
            });
          });
        }
      },
      cancel: function cancel() {
        this.set("adValue", this.get("value"));
      }
    }
  });
});
define("discourse/plugins/discourse-adplugin/discourse/components/google-dfp-ad", ["exports", "discourse/plugins/discourse-adplugin/discourse/components/ad-component", "discourse-common/utils/decorators", "discourse/lib/load-script"], function (exports, _adComponent, _decorators, _loadScript) {
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

  var _dec, _dec2, _dec3, _dec4, _dec5, _dec6, _dec7, _dec8, _dec9, _dec10, _dec11, _desc, _value, _obj;

  var _loaded = false,
      _promise = null,
      ads = {},
      nextSlotNum = 1,
      renderCounts = {};

  function getNextSlotNum() {
    return nextSlotNum++;
  }

  function splitWidthInt(value) {
    var str = value.substring(0, 3);
    return str.trim();
  }

  function splitHeightInt(value) {
    var str = value.substring(4, 7);
    return str.trim();
  }

  // This creates an array for the values of the custom targeting key
  function valueParse(value) {
    var final = value.replace(/ /g, "");
    final = final.replace(/['"]+/g, "");
    final = final.split(",");
    return final;
  }

  // This creates an array for the key of the custom targeting key
  function keyParse(word) {
    var key = word;
    key = key.replace(/['"]+/g, "");
    key = key.split("\n");
    return key;
  }

  // This should call adslot.setTargeting(key for that location, value for that location)
  function custom_targeting(key_array, value_array, adSlot) {
    for (var i = 0; i < key_array.length; i++) {
      if (key_array[i]) {
        adSlot.setTargeting(key_array[i], valueParse(value_array[i]));
      }
    }
  }

  var DESKTOP_SETTINGS = {
    "topic-list-top": {
      code: "dfp_topic_list_top_code",
      sizes: "dfp_topic_list_top_ad_sizes",
      targeting_keys: "dfp_target_topic_list_top_key_code",
      targeting_values: "dfp_target_topic_list_top_value_code"
    },
    "topic-above-post-stream": {
      code: "dfp_topic_above_post_stream_code",
      sizes: "dfp_topic_above_post_stream_ad_sizes",
      targeting_keys: "dfp_target_topic_above_post_stream_key_code",
      targeting_values: "dfp_target_topic_above_post_stream_value_code"
    },
    "topic-above-suggested": {
      code: "dfp_topic_above_suggested_code",
      sizes: "dfp_topic_above_suggested_ad_sizes",
      targeting_keys: "dfp_target_topic_above_suggested_key_code",
      targeting_values: "dfp_target_topic_above_suggested_value_code"
    },
    "post-bottom": {
      code: "dfp_post_bottom_code",
      sizes: "dfp_post_bottom_ad_sizes",
      targeting_keys: "dfp_target_post_bottom_key_code",
      targeting_values: "dfp_target_post_bottom_value_code"
    }
  };

  var MOBILE_SETTINGS = {
    "topic-list-top": {
      code: "dfp_mobile_topic_list_top_code",
      sizes: "dfp_mobile_topic_list_top_ad_sizes",
      targeting_keys: "dfp_target_topic_list_top_key_code",
      targeting_values: "dfp_target_topic_list_top_value_code"
    },
    "topic-above-post-stream": {
      code: "dfp_mobile_topic_above_post_stream_code",
      sizes: "dfp_mobile_topic_above_post_stream_ad_sizes",
      targeting_keys: "dfp_target_topic_above_post_stream_key_code",
      targeting_values: "dfp_target_topic_above_post_stream_value_code"
    },
    "topic-above-suggested": {
      code: "dfp_mobile_topic_above_suggested_code",
      sizes: "dfp_mobile_topic_above_suggested_ad_sizes",
      targeting_keys: "dfp_target_topic_above_suggested_key_code",
      targeting_values: "dfp_target_topic_above_suggested_value_code"
    },
    "post-bottom": {
      code: "dfp_mobile_post_bottom_code",
      sizes: "dfp_mobile_post_bottom_ad_sizes",
      targeting_keys: "dfp_target_post_bottom_key_code",
      targeting_values: "dfp_target_post_bottom_value_code"
    }
  };

  function getWidthAndHeight(placement, settings, isMobile) {
    var config = void 0,
        size = void 0;

    if (isMobile) {
      config = MOBILE_SETTINGS[placement];
    } else {
      config = DESKTOP_SETTINGS[placement];
    }

    if (!renderCounts[placement]) {
      renderCounts[placement] = 0;
    }

    var sizes = (settings[config.sizes] || "").split("|");

    if (sizes.length === 1) {
      size = sizes[0];
    } else {
      size = sizes[renderCounts[placement] % sizes.length];
      renderCounts[placement] += 1;
    }

    if (size === "fluid") {
      return { width: "fluid", height: "fluid" };
    }

    var sizeObj = {
      width: parseInt(splitWidthInt(size), 10),
      height: parseInt(splitHeightInt(size), 10)
    };

    if (!isNaN(sizeObj.width) && !isNaN(sizeObj.height)) {
      return sizeObj;
    }
  }

  function defineSlot(divId, placement, settings, isMobile, width, height, categoryTarget) {
    if (!settings.dfp_publisher_id) {
      return;
    }

    if (ads[divId]) {
      return ads[divId];
    }

    var ad = void 0,
        config = void 0,
        publisherId = void 0;

    if (isMobile) {
      publisherId = settings.dfp_publisher_id_mobile || settings.dfp_publisher_id;
      config = MOBILE_SETTINGS[placement];
    } else {
      publisherId = settings.dfp_publisher_id;
      config = DESKTOP_SETTINGS[placement];
    }

    ad = window.googletag.defineSlot("/" + publisherId + "/" + settings[config.code], [width, height], divId);

    custom_targeting(keyParse(settings[config.targeting_keys]), keyParse(settings[config.targeting_values]), ad);

    if (categoryTarget) {
      ad.setTargeting("discourse-category", categoryTarget);
    }

    ad.addService(window.googletag.pubads());

    ads[divId] = { ad: ad, width: width, height: height };
    return ads[divId];
  }

  function destroySlot(divId) {
    if (ads[divId] && window.googletag) {
      window.googletag.destroySlots([ads[divId].ad]);
      delete ads[divId];
    }
  }

  function loadGoogle() {
    /**
     * Refer to this article for help:
     * https://support.google.com/admanager/answer/4578089?hl=en
     */

    if (_loaded) {
      return Ember.RSVP.resolve();
    }

    if (_promise) {
      return _promise;
    }

    // The boilerplate code
    var dfpSrc = ("https:" === document.location.protocol ? "https:" : "http:") + "//securepubads.g.doubleclick.net/tag/js/gpt.js";
    _promise = (0, _loadScript.default)(dfpSrc, { scriptTag: true }).then(function () {
      _loaded = true;
      if (window.googletag === undefined) {
        // eslint-disable-next-line no-console
        console.log("googletag is undefined!");
      }

      window.googletag.cmd.push(function () {
        // Infinite scroll requires SRA:
        window.googletag.pubads().enableSingleRequest();

        // we always use refresh() to fetch the ads:
        window.googletag.pubads().disableInitialLoad();

        window.googletag.enableServices();
      });
    });

    window.googletag = window.googletag || { cmd: [] };

    return _promise;
  }

  exports.default = _adComponent.default.extend((_dec = (0, _decorators.default)("siteSettings.dfp_publisher_id", "siteSettings.dfp_publisher_id_mobile", "site.mobileView"), _dec2 = (0, _decorators.default)("placement", "postNumber"), _dec3 = (0, _decorators.default)("placement", "showAd"), _dec4 = (0, _decorators.default)("width", "height"), _dec5 = (0, _decorators.default)("width"), _dec6 = (0, _decorators.default)("publisherId", "showToTrustLevel", "showToGroups", "showAfterPost", "showOnCurrentPage", "size"), _dec7 = (0, _decorators.default)("currentUser.trust_level"), _dec8 = (0, _decorators.default)("postNumber"), _dec9 = (0, _decorators.on)("didUpdate"), _dec10 = (0, _decorators.on)("didInsertElement"), _dec11 = (0, _decorators.on)("willDestroyElement"), (_obj = {
    classNameBindings: ["adUnitClass"],
    classNames: ["google-dfp-ad"],
    loadedGoogletag: false,
    refreshOnChange: null,
    lastAdRefresh: null,
    width: Ember.computed.alias("size.width"),
    height: Ember.computed.alias("size.height"),

    size: function size() {
      return getWidthAndHeight(this.get("placement"), this.siteSettings, this.site.mobileView);
    },
    publisherId: function publisherId(globalId, mobileId, isMobile) {
      if (isMobile) {
        return mobileId || globalId;
      } else {
        return globalId;
      }
    },
    divId: function divId(placement, postNumber) {
      var slotNum = getNextSlotNum();
      if (postNumber) {
        return "div-gpt-ad-" + slotNum + "-" + placement + "-" + postNumber;
      } else {
        return "div-gpt-ad-" + slotNum + "-" + placement;
      }
    },
    adUnitClass: function adUnitClass(placement, showAd) {
      return showAd ? "dfp-ad-" + placement : "";
    },
    adWrapperStyle: function adWrapperStyle(w, h) {
      if (w !== "fluid") {
        return ("width: " + w + "px; height: " + h + "px;").htmlSafe();
      }
    },
    adTitleStyleMobile: function adTitleStyleMobile(w) {
      if (w !== "fluid") {
        return ("width: " + w + "px;").htmlSafe();
      }
    },
    showAd: function showAd(publisherId, showToTrustLevel, showToGroups, showAfterPost, showOnCurrentPage, size) {
      return publisherId && showToTrustLevel && showToGroups && showAfterPost && showOnCurrentPage && size;
    },
    showToTrustLevel: function showToTrustLevel(trustLevel) {
      return !(trustLevel && trustLevel > this.siteSettings.dfp_through_trust_level);
    },
    showAfterPost: function showAfterPost(postNumber) {
      if (!postNumber) {
        return true;
      }

      return this.isNthPost(parseInt(this.siteSettings.dfp_nth_post_code, 10));
    },


    // 3 second delay between calls to refresh ads in a component.
    // Ember often calls updated() more than once, and *sometimes*
    // updated() is called after _initGoogleDFP().
    shouldRefreshAd: function shouldRefreshAd() {
      var lastAdRefresh = this.get("lastAdRefresh");
      if (!lastAdRefresh) {
        return true;
      }
      return new Date() - lastAdRefresh > 3000;
    },
    updated: function updated() {
      if (this.get("listLoading") || !this.shouldRefreshAd()) {
        return;
      }

      var slot = ads[this.get("divId")];
      if (!(slot && slot.ad)) {
        return;
      }

      var ad = slot.ad,
          categorySlug = this.get("currentCategorySlug");

      if (this.get("loadedGoogletag")) {
        this.set("lastAdRefresh", new Date());
        window.googletag.cmd.push(function () {
          ad.setTargeting("discourse-category", categorySlug || "0");
          window.googletag.pubads().refresh([ad]);
        });
      }
    },
    _initGoogleDFP: function _initGoogleDFP() {
      var _this = this;

      if (Ember.testing) {
        return; // Don't load external JS during tests
      }

      if (!this.get("showAd")) {
        return;
      }

      loadGoogle(this.siteSettings).then(function () {
        _this.set("loadedGoogletag", true);
        _this.set("lastAdRefresh", new Date());

        window.googletag.cmd.push(function () {
          var slot = defineSlot(_this.get("divId"), _this.get("placement"), _this.siteSettings, _this.site.mobileView, _this.get("width"), _this.get("height"), _this.get("currentCategorySlug") || "0");
          if (slot && slot.ad) {
            // Display has to be called before refresh
            // and after the slot div is in the page.
            window.googletag.display(_this.get("divId"));
            window.googletag.pubads().refresh([slot.ad]);
          }
        });
      });
    },
    willRender: function willRender() {
      this._super.apply(this, arguments);

      if (!this.get("showAd")) {
        return;
      }
    },
    cleanup: function cleanup() {
      destroySlot(this.get("divId"));
    }
  }, (_applyDecoratedDescriptor(_obj, "size", [_decorators.default], Object.getOwnPropertyDescriptor(_obj, "size"), _obj), _applyDecoratedDescriptor(_obj, "publisherId", [_dec], Object.getOwnPropertyDescriptor(_obj, "publisherId"), _obj), _applyDecoratedDescriptor(_obj, "divId", [_dec2], Object.getOwnPropertyDescriptor(_obj, "divId"), _obj), _applyDecoratedDescriptor(_obj, "adUnitClass", [_dec3], Object.getOwnPropertyDescriptor(_obj, "adUnitClass"), _obj), _applyDecoratedDescriptor(_obj, "adWrapperStyle", [_dec4], Object.getOwnPropertyDescriptor(_obj, "adWrapperStyle"), _obj), _applyDecoratedDescriptor(_obj, "adTitleStyleMobile", [_dec5], Object.getOwnPropertyDescriptor(_obj, "adTitleStyleMobile"), _obj), _applyDecoratedDescriptor(_obj, "showAd", [_dec6], Object.getOwnPropertyDescriptor(_obj, "showAd"), _obj), _applyDecoratedDescriptor(_obj, "showToTrustLevel", [_dec7], Object.getOwnPropertyDescriptor(_obj, "showToTrustLevel"), _obj), _applyDecoratedDescriptor(_obj, "showAfterPost", [_dec8], Object.getOwnPropertyDescriptor(_obj, "showAfterPost"), _obj), _applyDecoratedDescriptor(_obj, "updated", [_dec9], Object.getOwnPropertyDescriptor(_obj, "updated"), _obj), _applyDecoratedDescriptor(_obj, "_initGoogleDFP", [_dec10], Object.getOwnPropertyDescriptor(_obj, "_initGoogleDFP"), _obj), _applyDecoratedDescriptor(_obj, "cleanup", [_dec11], Object.getOwnPropertyDescriptor(_obj, "cleanup"), _obj)), _obj)));
});
Ember.TEMPLATES["javascripts/admin/plugins-house-ads"] = Ember.HTMLBars.template({"id":null,"block":"{\"symbols\":[\"ad\"],\"statements\":[[7,\"div\",true],[10,\"class\",\"adplugin-mgmt\"],[8],[0,\"\\n  \"],[7,\"h1\",true],[8],[1,[28,\"i18n\",[\"admin.adplugin.house_ads.title\"],null],false],[9],[0,\"\\n\"],[4,\"if\",[[24,[\"model\",\"length\"]]],null,{\"statements\":[[0,\"    \"],[7,\"div\",true],[10,\"class\",\"content-list\"],[8],[0,\"\\n      \"],[7,\"div\",true],[10,\"class\",\"house-ads-actions\"],[8],[0,\"\\n\"],[4,\"link-to\",null,[[\"class\",\"route\",\"model\"],[\"btn btn-primary\",\"adminPlugins.houseAds.show\",\"new\"]],{\"statements\":[[0,\"          \"],[1,[28,\"d-icon\",[\"plus\"],null],false],[0,\"\\n          \"],[7,\"span\",true],[8],[1,[28,\"i18n\",[\"admin.adplugin.house_ads.new\"],null],false],[9],[0,\"\\n\"]],\"parameters\":[]},null],[4,\"link-to\",null,[[\"class\",\"route\"],[\"btn btn-default\",\"adminPlugins.houseAds.index\"]],{\"statements\":[[0,\"          \"],[1,[28,\"d-icon\",[\"cog\"],null],false],[0,\"\\n          \"],[7,\"span\",true],[8],[1,[28,\"i18n\",[\"admin.adplugin.house_ads.settings\"],null],false],[9],[0,\"\\n\"]],\"parameters\":[]},null],[0,\"      \"],[9],[0,\"\\n      \"],[7,\"ul\",true],[10,\"class\",\"house-ads-list\"],[8],[0,\"\\n\"],[4,\"each\",[[24,[\"model\"]]],null,{\"statements\":[[0,\"          \"],[7,\"li\",true],[10,\"class\",\"house-ads-list-item\"],[8],[0,\"\\n\"],[4,\"link-to\",null,[[\"route\",\"model\"],[\"adminPlugins.houseAds.show\",[23,1,[\"id\"]]]],{\"statements\":[[0,\"              \"],[1,[23,1,[\"name\"]],false],[0,\"\\n\"]],\"parameters\":[]},null],[0,\"          \"],[9],[0,\"\\n\"]],\"parameters\":[1]},null],[0,\"      \"],[9],[0,\"\\n    \"],[9],[0,\"\\n\"]],\"parameters\":[]},null],[0,\"  \"],[1,[22,\"outlet\"],false],[0,\"\\n\"],[9],[0,\"\\n\"]],\"hasEval\":false}","meta":{"moduleName":"javascripts/discourse/templates/admin/plugins-house-ads"}});
Ember.TEMPLATES["javascripts/admin/plugins-house-ads-index"] = Ember.HTMLBars.template({"id":null,"block":"{\"symbols\":[],\"statements\":[[4,\"d-section\",null,[[\"class\"],[\"house-ads-settings content-body\"]],{\"statements\":[[0,\"  \"],[7,\"div\",true],[8],[1,[28,\"i18n\",[\"admin.adplugin.house_ads.description\"],null],false],[9],[0,\"\\n\\n\"],[4,\"unless\",[[24,[\"houseAds\",\"length\"]]],null,{\"statements\":[[0,\"    \"],[7,\"p\",true],[8],[0,\"\\n\"],[4,\"link-to\",null,[[\"route\",\"model\"],[\"adminPlugins.houseAds.show\",\"new\"]],{\"statements\":[[0,\"        \"],[1,[28,\"i18n\",[\"admin.adplugin.house_ads.get_started\"],null],false],[0,\"\\n\"]],\"parameters\":[]},null],[0,\"    \"],[9],[0,\"\\n\"]],\"parameters\":[]},{\"statements\":[[0,\"    \"],[7,\"form\",true],[10,\"class\",\"form-horizontal\"],[8],[0,\"\\n      \"],[1,[28,\"house-ads-list-setting\",null,[[\"name\",\"value\",\"allAds\",\"adSettings\"],[\"topic_list_top\",[24,[\"adSettings\",\"topic_list_top\"]],[24,[\"houseAds\"]],[24,[\"adSettings\"]]]]],false],[0,\"\\n      \"],[1,[28,\"house-ads-list-setting\",null,[[\"name\",\"value\",\"allAds\",\"adSettings\"],[\"topic_above_post_stream\",[24,[\"adSettings\",\"topic_above_post_stream\"]],[24,[\"houseAds\"]],[24,[\"adSettings\"]]]]],false],[0,\"\\n      \"],[1,[28,\"house-ads-list-setting\",null,[[\"name\",\"value\",\"allAds\",\"adSettings\"],[\"topic_above_suggested\",[24,[\"adSettings\",\"topic_above_suggested\"]],[24,[\"houseAds\"]],[24,[\"adSettings\"]]]]],false],[0,\"\\n      \"],[1,[28,\"house-ads-list-setting\",null,[[\"name\",\"value\",\"allAds\",\"adSettings\"],[\"post_bottom\",[24,[\"adSettings\",\"post_bottom\"]],[24,[\"houseAds\"]],[24,[\"adSettings\"]]]]],false],[0,\"\\n\\n      \"],[1,[28,\"d-button\",null,[[\"label\",\"icon\",\"class\",\"action\"],[\"admin.adplugin.house_ads.more_settings\",\"cog\",\"btn-default\",[28,\"route-action\",[\"moreSettings\"],null]]]],false],[0,\"\\n    \"],[9],[0,\"\\n\"]],\"parameters\":[]}]],\"parameters\":[]},null]],\"hasEval\":false}","meta":{"moduleName":"javascripts/discourse/templates/admin/plugins-house-ads-index"}});
Ember.TEMPLATES["javascripts/admin/plugins-house-ads-show"] = Ember.HTMLBars.template({"id":null,"block":"{\"symbols\":[],\"statements\":[[4,\"d-section\",null,[[\"class\"],[\"edit-house-ad content-body\"]],{\"statements\":[[0,\"  \"],[7,\"h1\",true],[8],[1,[28,\"text-field\",null,[[\"class\",\"value\"],[\"house-ad-name\",[24,[\"buffered\",\"name\"]]]]],false],[9],[0,\"\\n  \"],[7,\"div\",true],[10,\"class\",\"controls\"],[8],[0,\"\\n    \"],[1,[28,\"ace-editor\",null,[[\"content\",\"mode\"],[[24,[\"buffered\",\"html\"]],\"html\"]]],false],[0,\"\\n  \"],[9],[0,\"\\n  \"],[7,\"div\",true],[10,\"class\",\"controls\"],[8],[0,\"\\n    \"],[1,[28,\"d-button\",null,[[\"action\",\"disabled\",\"class\",\"label\"],[[28,\"action\",[[23,0,[]],\"save\"],null],[24,[\"disableSave\"]],\"btn-primary\",\"admin.adplugin.house_ads.save\"]]],false],[0,\"\\n\\n\"],[4,\"if\",[[24,[\"saving\"]]],null,{\"statements\":[[0,\"      \"],[1,[22,\"savingStatus\"],false],[0,\"\\n\"]],\"parameters\":[]},{\"statements\":[[4,\"if\",[[24,[\"dirty\"]]],null,{\"statements\":[[0,\"        \"],[7,\"a\",false],[12,\"href\",\"\"],[3,\"action\",[[23,0,[]],\"cancel\"]],[8],[1,[28,\"i18n\",[\"cancel\"],null],false],[9],[0,\"\\n\"]],\"parameters\":[]},null]],\"parameters\":[]}],[0,\"\\n    \"],[1,[28,\"d-button\",null,[[\"action\",\"class\",\"label\"],[[28,\"action\",[[23,0,[]],\"destroy\"],null],\"btn-danger delete-button\",\"admin.adplugin.house_ads.delete\"]]],false],[0,\"\\n  \"],[9],[0,\"\\n\"]],\"parameters\":[]},null]],\"hasEval\":false}","meta":{"moduleName":"javascripts/discourse/templates/admin/plugins-house-ads-show"}});
Ember.TEMPLATES["javascripts/connectors/topic-above-suggested/discourse-adplugin"] = Ember.HTMLBars.template({"id":null,"block":"{\"symbols\":[],\"statements\":[[1,[28,\"ad-slot\",null,[[\"placement\",\"refreshOnChange\",\"category\"],[\"topic-above-suggested\",[24,[\"model\",\"id\"]],[24,[\"model\",\"category\",\"slug\"]]]]],false],[0,\"\\n\"]],\"hasEval\":false}","meta":{"moduleName":"javascripts/discourse/templates/connectors/topic-above-suggested/discourse-adplugin"}});
Ember.TEMPLATES["javascripts/connectors/discovery-list-container-top/discourse-adplugin"] = Ember.HTMLBars.template({"id":null,"block":"{\"symbols\":[],\"statements\":[[1,[28,\"ad-slot\",null,[[\"placement\",\"refreshOnChange\",\"category\",\"listLoading\"],[\"topic-list-top\",[24,[\"listLoading\"]],[24,[\"category\",\"slug\"]],[24,[\"listLoading\"]]]]],false],[0,\"\\n\"]],\"hasEval\":false}","meta":{"moduleName":"javascripts/discourse/templates/connectors/discovery-list-container-top/discourse-adplugin"}});
Ember.TEMPLATES["javascripts/connectors/topic-above-post-stream/discourse-adplugin"] = Ember.HTMLBars.template({"id":null,"block":"{\"symbols\":[],\"statements\":[[1,[28,\"ad-slot\",null,[[\"placement\",\"refreshOnChange\",\"category\"],[\"topic-above-post-stream\",[24,[\"model\",\"id\"]],[24,[\"model\",\"category\",\"slug\"]]]]],false],[0,\"\\n\"]],\"hasEval\":false}","meta":{"moduleName":"javascripts/discourse/templates/connectors/topic-above-post-stream/discourse-adplugin"}});
Ember.TEMPLATES["javascripts/connectors/post-bottom/discourse-adplugin"] = Ember.HTMLBars.template({"id":null,"block":"{\"symbols\":[],\"statements\":[[1,[28,\"post-bottom-ad\",null,[[\"model\"],[[23,0,[]]]]],false],[0,\"\\n\"]],\"hasEval\":false}","meta":{"moduleName":"javascripts/discourse/templates/connectors/post-bottom/discourse-adplugin"}});
Ember.TEMPLATES["javascripts/components/google-dfp-ad"] = Ember.HTMLBars.template({"id":null,"block":"{\"symbols\":[],\"statements\":[[4,\"if\",[[24,[\"showAd\"]]],null,{\"statements\":[[4,\"if\",[[24,[\"site\",\"mobileView\"]]],null,{\"statements\":[[0,\"    \"],[7,\"div\",true],[10,\"class\",\"google-dfp-ad-label\"],[11,\"style\",[22,\"adTitleStyleMobile\"]],[8],[7,\"h2\",true],[8],[1,[28,\"i18n\",[\"adplugin.advertisement_label\"],null],false],[9],[9],[0,\"\\n    \"],[7,\"div\",true],[11,\"id\",[22,\"divId\"]],[11,\"style\",[22,\"adWrapperStyle\"]],[10,\"class\",\"dfp-ad-unit\"],[10,\"align\",\"center\"],[8],[9],[0,\"\\n\"]],\"parameters\":[]},{\"statements\":[[0,\"    \"],[7,\"div\",true],[10,\"class\",\"google-dfp-ad-label\"],[8],[7,\"h2\",true],[8],[1,[28,\"i18n\",[\"adplugin.advertisement_label\"],null],false],[9],[9],[0,\"\\n    \"],[7,\"div\",true],[11,\"id\",[22,\"divId\"]],[11,\"style\",[22,\"adWrapperStyle\"]],[10,\"class\",\"dfp-ad-unit\"],[10,\"align\",\"center\"],[8],[9],[0,\"\\n\"]],\"parameters\":[]}]],\"parameters\":[]},null]],\"hasEval\":false}","meta":{"moduleName":"javascripts/discourse/templates/components/google-dfp-ad"}});
Ember.TEMPLATES["javascripts/components/ad-slot"] = Ember.HTMLBars.template({"id":null,"block":"{\"symbols\":[\"adComponent\"],\"statements\":[[4,\"each\",[[24,[\"adComponents\"]]],null,{\"statements\":[[0,\"  \"],[1,[28,\"component\",[[23,1,[]]],[[\"placement\",\"refreshOnChange\",\"category\",\"listLoading\",\"postNumber\"],[[24,[\"placement\"]],[24,[\"refreshOnChange\"]],[24,[\"category\"]],[24,[\"listLoading\"]],[24,[\"postNumber\"]]]]],false],[0,\"\\n\"]],\"parameters\":[1]},null]],\"hasEval\":false}","meta":{"moduleName":"javascripts/discourse/templates/components/ad-slot"}});
Ember.TEMPLATES["javascripts/components/post-bottom-ad"] = Ember.HTMLBars.template({"id":null,"block":"{\"symbols\":[],\"statements\":[[1,[28,\"ad-slot\",null,[[\"placement\",\"category\",\"postNumber\"],[\"post-bottom\",[24,[\"model\",\"topic\",\"category\",\"slug\"]],[24,[\"model\",\"post_number\"]]]]],false],[0,\"\\n\"]],\"hasEval\":false}","meta":{"moduleName":"javascripts/discourse/templates/components/post-bottom-ad"}});
Ember.TEMPLATES["javascripts/components/carbonads-ad"] = Ember.HTMLBars.template({"id":null,"block":"{\"symbols\":[],\"statements\":[[4,\"if\",[[24,[\"showAd\"]]],null,{\"statements\":[[0,\"  \"],[7,\"script\",true],[11,\"src\",[22,\"url\"]],[10,\"id\",\"_carbonads_js\"],[10,\"async\",\"\"],[10,\"type\",\"text/javascript\"],[8],[0,\"\\n  \"],[9],[0,\"\\n\"]],\"parameters\":[]},null]],\"hasEval\":false}","meta":{"moduleName":"javascripts/discourse/templates/components/carbonads-ad"}});
Ember.TEMPLATES["javascripts/components/adbutler-ad"] = Ember.HTMLBars.template({"id":null,"block":"{\"symbols\":[],\"statements\":[[4,\"if\",[[24,[\"showAd\"]]],null,{\"statements\":[[7,\"div\",true],[11,\"id\",[22,\"divId\"]],[11,\"class\",[22,\"className\"]],[8],[9],[0,\"\\n\"]],\"parameters\":[]},null]],\"hasEval\":false}","meta":{"moduleName":"javascripts/discourse/templates/components/adbutler-ad"}});
Ember.TEMPLATES["javascripts/components/codefund-ad"] = Ember.HTMLBars.template({"id":null,"block":"{\"symbols\":[],\"statements\":[[4,\"if\",[[24,[\"showAd\"]]],null,{\"statements\":[[4,\"if\",[[24,[\"site\",\"mobileView\"]]],null,{\"statements\":[[4,\"if\",[[24,[\"displayPostBottom\"]]],null,{\"statements\":[[0,\"      \"],[15,\"components/codefund/post-bottom\",[]],[0,\"\\n\"]],\"parameters\":[]},null],[4,\"if\",[[24,[\"displayTopicAbovePostStream\"]]],null,{\"statements\":[[0,\"      \"],[15,\"components/codefund/topic-above-post-stream\",[]],[0,\"\\n\"]],\"parameters\":[]},null],[4,\"if\",[[24,[\"displayTopicAboveSuggested\"]]],null,{\"statements\":[[0,\"      \"],[15,\"components/codefund/topic-above-suggested\",[]],[0,\"\\n\"]],\"parameters\":[]},null],[4,\"if\",[[24,[\"displayTopicListTop\"]]],null,{\"statements\":[[0,\"      \"],[15,\"components/codefund/topic-list-top\",[]],[0,\"\\n\"]],\"parameters\":[]},null]],\"parameters\":[]},{\"statements\":[[4,\"if\",[[24,[\"displayPostBottom\"]]],null,{\"statements\":[[0,\"      \"],[15,\"components/codefund/post-bottom\",[]],[0,\"\\n\"]],\"parameters\":[]},null],[4,\"if\",[[24,[\"displayTopicAbovePostStream\"]]],null,{\"statements\":[[0,\"      \"],[15,\"components/codefund/topic-above-post-stream\",[]],[0,\"\\n\"]],\"parameters\":[]},null],[4,\"if\",[[24,[\"displayTopicAboveSuggested\"]]],null,{\"statements\":[[0,\"      \"],[15,\"components/codefund/topic-above-suggested\",[]],[0,\"\\n\"]],\"parameters\":[]},null],[4,\"if\",[[24,[\"displayTopicListTop\"]]],null,{\"statements\":[[0,\"      \"],[15,\"components/codefund/topic-list-top\",[]],[0,\"\\n\"]],\"parameters\":[]},null]],\"parameters\":[]}]],\"parameters\":[]},null]],\"hasEval\":true}","meta":{"moduleName":"javascripts/discourse/templates/components/codefund-ad"}});
Ember.TEMPLATES["javascripts/components/house-ads-setting"] = Ember.HTMLBars.template({"id":null,"block":"{\"symbols\":[],\"statements\":[[7,\"label\",true],[11,\"for\",[29,[[22,\"name\"]]]],[8],[1,[22,\"title\"],false],[9],[0,\"\\n\"],[1,[28,\"text-field\",null,[[\"value\",\"classNames\"],[[24,[\"adValue\"]],\"house-ads-text-input\"]]],false],[0,\"\\n\"],[7,\"div\",true],[10,\"class\",\"setting-controls\"],[8],[0,\"\\n\"],[4,\"if\",[[24,[\"changed\"]]],null,{\"statements\":[[0,\"    \"],[1,[28,\"d-button\",null,[[\"class\",\"action\",\"icon\"],[\"ok\",[28,\"action\",[[23,0,[]],\"save\"],null],\"check\"]]],false],[0,\"\\n    \"],[1,[28,\"d-button\",null,[[\"class\",\"action\",\"icon\"],[\"cancel\",[28,\"action\",[[23,0,[]],\"cancel\"],null],\"times\"]]],false],[0,\"\\n\"]],\"parameters\":[]},null],[9],[0,\"\\n\"],[7,\"p\",true],[10,\"class\",\"help\"],[8],[1,[22,\"help\"],false],[9],[0,\"\\n\"]],\"hasEval\":false}","meta":{"moduleName":"javascripts/discourse/templates/components/house-ads-setting"}});
Ember.TEMPLATES["javascripts/components/house-ads-list-setting"] = Ember.HTMLBars.template({"id":null,"block":"{\"symbols\":[],\"statements\":[[7,\"label\",true],[11,\"for\",[29,[[22,\"name\"]]]],[8],[1,[22,\"title\"],false],[9],[0,\"\\n\"],[1,[28,\"house-ads-chooser\",null,[[\"settingValue\",\"choices\",\"onChange\"],[[24,[\"adValue\"]],[24,[\"adNames\"]],[28,\"action\",[[23,0,[]],[28,\"mut\",[[24,[\"adValue\"]]],null]],null]]]],false],[0,\"\\n\"],[7,\"div\",true],[10,\"class\",\"setting-controls\"],[8],[0,\"\\n\"],[4,\"if\",[[24,[\"changed\"]]],null,{\"statements\":[[0,\"    \"],[1,[28,\"d-button\",null,[[\"class\",\"action\",\"icon\"],[\"ok\",[28,\"action\",[[23,0,[]],\"save\"],null],\"check\"]]],false],[0,\"\\n    \"],[1,[28,\"d-button\",null,[[\"class\",\"action\",\"icon\"],[\"cancel\",[28,\"action\",[[23,0,[]],\"cancel\"],null],\"times\"]]],false],[0,\"\\n\"]],\"parameters\":[]},null],[9],[0,\"\\n\"],[7,\"p\",true],[10,\"class\",\"help\"],[8],[1,[22,\"help\"],false],[9],[0,\"\\n\"]],\"hasEval\":false}","meta":{"moduleName":"javascripts/discourse/templates/components/house-ads-list-setting"}});
Ember.TEMPLATES["javascripts/components/amazon-product-links"] = Ember.HTMLBars.template({"id":null,"block":"{\"symbols\":[],\"statements\":[[4,\"if\",[[24,[\"showAd\"]]],null,{\"statements\":[[4,\"if\",[[24,[\"site\",\"mobileView\"]]],null,{\"statements\":[[0,\"    \"],[7,\"div\",true],[10,\"class\",\"amazon-product-links-label\"],[11,\"style\",[22,\"adTitleStyleMobile\"]],[8],[7,\"h2\",true],[8],[1,[28,\"i18n\",[\"adplugin.advertisement_label\"],null],false],[9],[9],[0,\"\\n\\t\\t\"],[7,\"iframe\",true],[11,\"style\",[22,\"adWrapperStyleMobile\"]],[10,\"marginwidth\",\"0\"],[10,\"marginheight\",\"0\"],[10,\"scrolling\",\"no\"],[10,\"frameborder\",\"0\"],[11,\"src\",[22,\"userInputMobile\"]],[8],[0,\"\\n\\t\\t\"],[9],[0,\"\\n\"]],\"parameters\":[]},{\"statements\":[[0,\"    \"],[7,\"div\",true],[10,\"class\",\"amazon-product-links-label\"],[8],[7,\"h2\",true],[8],[1,[28,\"i18n\",[\"adplugin.advertisement_label\"],null],false],[9],[9],[0,\"\\n\\t\\t\"],[7,\"div\",true],[10,\"class\",\"container\"],[10,\"align\",\"center\"],[8],[0,\"\\n\\t\\t\\t\"],[7,\"iframe\",true],[11,\"style\",[22,\"adWrapperStyle\"]],[10,\"marginwidth\",\"0\"],[10,\"marginheight\",\"0\"],[10,\"scrolling\",\"no\"],[10,\"frameborder\",\"0\"],[11,\"src\",[22,\"userInput\"]],[8],[0,\"\\n\\t\\t\\t\"],[9],[0,\"\\n\\t\\t\"],[9],[0,\"\\n\"]],\"parameters\":[]}]],\"parameters\":[]},null]],\"hasEval\":false}","meta":{"moduleName":"javascripts/discourse/templates/components/amazon-product-links"}});
Ember.TEMPLATES["javascripts/components/google-adsense"] = Ember.HTMLBars.template({"id":null,"block":"{\"symbols\":[],\"statements\":[[4,\"if\",[[24,[\"showAd\"]]],null,{\"statements\":[[0,\"  \"],[7,\"div\",true],[10,\"class\",\"google-adsense-label\"],[8],[7,\"h2\",true],[8],[1,[28,\"i18n\",[\"adplugin.advertisement_label\"],null],false],[9],[9],[0,\"\\n  \"],[7,\"div\",true],[10,\"class\",\"google-adsense-content\"],[11,\"style\",[22,\"adWrapperStyle\"]],[8],[0,\"\\n    \"],[7,\"ins\",true],[10,\"class\",\"adsbygoogle\"],[11,\"style\",[22,\"adInsStyle\"]],[11,\"data-ad-client\",[29,[\"ca-pub-\",[22,\"publisher_id\"]]]],[11,\"data-ad-slot\",[22,\"ad_code\"]],[11,\"data-ad-format\",[22,\"autoAdFormat\"]],[8],[0,\"\\n    \"],[9],[0,\"\\n  \"],[9],[0,\"\\n\"]],\"parameters\":[]},null]],\"hasEval\":false}","meta":{"moduleName":"javascripts/discourse/templates/components/google-adsense"}});
Ember.TEMPLATES["javascripts/components/codefund/post-bottom"] = Ember.HTMLBars.template({"id":null,"block":"{\"symbols\":[],\"statements\":[[7,\"span\",true],[10,\"class\",\"codefund-wrapper codefund-post-bottom\"],[8],[0,\"\\n  \"],[7,\"a\",true],[11,\"href\",[29,[[24,[\"adDetails\",\"campaignUrl\"]]]]],[10,\"class\",\"codefund-text\"],[10,\"target\",\"_blank\"],[10,\"rel\",\"noopener\"],[8],[0,\"\\n\"],[4,\"if\",[[24,[\"siteSettings\",\"codefund_display_advertiser_labels\"]]],null,{\"statements\":[[0,\"      \"],[7,\"span\",true],[10,\"class\",\"codefund-label\"],[8],[1,[24,[\"siteSettings\",\"codefund_advertiser_short_label\"]],false],[9],[0,\"\\n\"]],\"parameters\":[]},null],[0,\"    \"],[7,\"strong\",true],[8],[1,[24,[\"adDetails\",\"headline\"]],false],[9],[0,\" \"],[1,[24,[\"adDetails\",\"body\"]],false],[0,\"\\n  \"],[9],[0,\"\\n  \"],[7,\"img\",true],[11,\"src\",[29,[[24,[\"adDetails\",\"impressionUrl\"]]]]],[10,\"class\",\"codefund-pixel\"],[8],[9],[0,\"\\n\"],[9],[0,\"\\n\"]],\"hasEval\":false}","meta":{"moduleName":"javascripts/discourse/templates/components/codefund/post-bottom"}});
Ember.TEMPLATES["javascripts/components/codefund/topic-above-post-stream"] = Ember.HTMLBars.template({"id":null,"block":"{\"symbols\":[],\"statements\":[[7,\"span\",true],[10,\"class\",\"codefund-wrapper codefund-topic-above-post-stream\"],[8],[0,\"\\n  \"],[7,\"a\",true],[11,\"href\",[29,[[24,[\"adDetails\",\"campaignUrl\"]]]]],[10,\"class\",\"codefund-text\"],[10,\"target\",\"_blank\"],[10,\"rel\",\"noopener\"],[8],[0,\"\\n\"],[4,\"if\",[[24,[\"siteSettings\",\"codefund_display_advertiser_labels\"]]],null,{\"statements\":[[0,\"      \"],[7,\"span\",true],[10,\"class\",\"codefund-label\"],[8],[1,[24,[\"siteSettings\",\"codefund_advertiser_label\"]],false],[9],[0,\"\\n\"]],\"parameters\":[]},null],[0,\"    \"],[7,\"strong\",true],[8],[1,[24,[\"adDetails\",\"headline\"]],false],[9],[0,\" \"],[1,[24,[\"adDetails\",\"body\"]],false],[0,\"\\n  \"],[9],[0,\"\\n  \"],[7,\"a\",true],[11,\"href\",[24,[\"adDetails\",\"codefundUrl\"]]],[10,\"class\",\"codefund-powered-by\"],[10,\"target\",\"_blank\"],[10,\"rel\",\"noopener\"],[8],[0,\"\\n    ads via codefund.io\\n  \"],[9],[0,\"\\n  \"],[7,\"img\",true],[11,\"src\",[29,[[24,[\"adDetails\",\"impressionUrl\"]]]]],[10,\"class\",\"codefund-pixel\"],[8],[9],[0,\"\\n\"],[9],[0,\"\\n\"]],\"hasEval\":false}","meta":{"moduleName":"javascripts/discourse/templates/components/codefund/topic-above-post-stream"}});
Ember.TEMPLATES["javascripts/components/codefund/topic-list-top"] = Ember.HTMLBars.template({"id":null,"block":"{\"symbols\":[],\"statements\":[[7,\"span\",true],[10,\"class\",\"codefund-wrapper codefund-topic-list-top\"],[8],[0,\"\\n  \"],[7,\"a\",true],[11,\"href\",[29,[[24,[\"adDetails\",\"campaignUrl\"]]]]],[10,\"class\",\"codefund-text\"],[10,\"target\",\"_blank\"],[10,\"rel\",\"noopener\"],[8],[0,\"\\n\"],[4,\"if\",[[24,[\"siteSettings\",\"codefund_display_advertiser_labels\"]]],null,{\"statements\":[[0,\"      \"],[7,\"span\",true],[10,\"class\",\"codefund-label\"],[8],[1,[24,[\"siteSettings\",\"codefund_advertiser_label\"]],false],[9],[0,\"\\n\"]],\"parameters\":[]},null],[0,\"    \"],[7,\"strong\",true],[8],[1,[24,[\"adDetails\",\"headline\"]],false],[9],[0,\" \"],[1,[24,[\"adDetails\",\"body\"]],false],[0,\"\\n  \"],[9],[0,\"\\n  \"],[7,\"a\",true],[11,\"href\",[24,[\"adDetails\",\"codefundUrl\"]]],[10,\"class\",\"codefund-powered-by\"],[10,\"target\",\"_blank\"],[10,\"rel\",\"noopener\"],[8],[0,\"\\n    ads via codefund.io\\n  \"],[9],[0,\"\\n  \"],[7,\"img\",true],[11,\"src\",[29,[[24,[\"adDetails\",\"impressionUrl\"]]]]],[10,\"class\",\"codefund-pixel\"],[8],[9],[0,\"\\n\"],[9],[0,\"\\n\"]],\"hasEval\":false}","meta":{"moduleName":"javascripts/discourse/templates/components/codefund/topic-list-top"}});
Ember.TEMPLATES["javascripts/components/codefund/topic-above-suggested"] = Ember.HTMLBars.template({"id":null,"block":"{\"symbols\":[],\"statements\":[[7,\"span\",true],[10,\"class\",\"codefund-wrapper codefund-topic-above-suggested\"],[8],[0,\"\\n  \"],[7,\"a\",true],[11,\"href\",[29,[[24,[\"adDetails\",\"campaignUrl\"]]]]],[10,\"class\",\"codefund-text\"],[10,\"target\",\"_blank\"],[10,\"rel\",\"noopener\"],[8],[0,\"\\n\"],[4,\"if\",[[24,[\"siteSettings\",\"codefund_display_advertiser_labels\"]]],null,{\"statements\":[[0,\"      \"],[7,\"span\",true],[10,\"class\",\"codefund-label\"],[8],[1,[24,[\"siteSettings\",\"codefund_advertiser_label\"]],false],[9],[0,\"\\n\"]],\"parameters\":[]},null],[0,\"    \"],[7,\"strong\",true],[8],[1,[24,[\"adDetails\",\"headline\"]],false],[9],[0,\" \"],[1,[24,[\"adDetails\",\"body\"]],false],[0,\"\\n  \"],[9],[0,\"\\n  \"],[7,\"a\",true],[11,\"href\",[24,[\"adDetails\",\"codefundUrl\"]]],[10,\"class\",\"codefund-powered-by\"],[10,\"target\",\"_blank\"],[10,\"rel\",\"noopener\"],[8],[0,\"\\n    ads via codefund.io\\n  \"],[9],[0,\"\\n  \"],[7,\"img\",true],[11,\"src\",[29,[[24,[\"adDetails\",\"impressionUrl\"]]]]],[10,\"class\",\"codefund-pixel\"],[8],[9],[0,\"\\n\"],[9],[0,\"\\n\"]],\"hasEval\":false}","meta":{"moduleName":"javascripts/discourse/templates/components/codefund/topic-above-suggested"}});
Ember.TEMPLATES["javascripts/components/house-ad"] = Ember.HTMLBars.template({"id":null,"block":"{\"symbols\":[],\"statements\":[[4,\"if\",[[24,[\"showAd\"]]],null,{\"statements\":[[0,\"  \"],[1,[22,\"adHtml\"],true],[0,\"\\n\"]],\"parameters\":[]},null]],\"hasEval\":false}","meta":{"moduleName":"javascripts/discourse/templates/components/house-ad"}});

