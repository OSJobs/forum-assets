define("discourse/controllers/application", ["exports", "discourse-common/utils/decorators", "@ember/service", "@ember/controller", "discourse/lib/utilities"], function (exports, _decorators, _service, _controller, _utilities) {
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

  exports.default = _controller.default.extend((_obj = {
    showTop: true,
    showFooter: false,
    router: (0, _service.inject)(),

    canSignUp: function canSignUp() {
      return !Discourse.SiteSettings.invite_only && Discourse.SiteSettings.allow_new_registrations && !Discourse.SiteSettings.enable_sso;
    },
    loginRequired: function loginRequired() {
      return Discourse.SiteSettings.login_required && !this.currentUser;
    },
    showFooterNav: function showFooterNav() {
      return (0, _utilities.isAppWebview)() || (0, _utilities.isiOSPWA)();
    }
  }, (_applyDecoratedDescriptor(_obj, "canSignUp", [_decorators.default], Object.getOwnPropertyDescriptor(_obj, "canSignUp"), _obj), _applyDecoratedDescriptor(_obj, "loginRequired", [_decorators.default], Object.getOwnPropertyDescriptor(_obj, "loginRequired"), _obj), _applyDecoratedDescriptor(_obj, "showFooterNav", [_decorators.default], Object.getOwnPropertyDescriptor(_obj, "showFooterNav"), _obj)), _obj));
});
