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
