define("discourse/routes/application", ["exports", "@ember/runloop", "discourse/routes/discourse", "discourse/lib/ajax", "discourse/lib/computed", "discourse/lib/logout", "discourse/lib/show-modal", "discourse/mixins/open-composer", "discourse/models/category", "discourse/lib/mobile", "discourse/models/login-method", "discourse-common/lib/get-owner", "discourse/lib/url", "discourse/models/composer"], function (exports, _runloop, _discourse, _ajax, _computed, _logout, _showModal, _openComposer, _category, _mobile, _loginMethod, _getOwner, _url, _composer) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });


  function unlessReadOnly(method, message) {
    return function () {
      if (this.site.get("isReadOnly")) {
        bootbox.alert(message);
      } else {
        this[method]();
      }
    };
  }

  var ApplicationRoute = _discourse.default.extend(_openComposer.default, {
    siteTitle: (0, _computed.setting)("title"),
    shortSiteDescription: (0, _computed.setting)("short_site_description"),

    actions: {
      toggleAnonymous: function toggleAnonymous() {
        (0, _ajax.ajax)((0, _url.userPath)("toggle-anon"), { type: "POST" }).then(function () {
          window.location.reload();
        });
      },
      toggleMobileView: function toggleMobileView() {
        _mobile.default.toggleMobileView();
      },


      logout: unlessReadOnly("_handleLogout", I18n.t("read_only_mode.logout_disabled")),

      _collectTitleTokens: function _collectTitleTokens(tokens) {
        tokens.push(this.siteTitle);
        if ((window.location.pathname === Discourse.getURL("/") || window.location.pathname === Discourse.getURL("/login")) && this.shortSiteDescription !== "") {
          tokens.push(this.shortSiteDescription);
        }
        Discourse.set("_docTitle", tokens.join(" - "));
      },
      willTransition: function willTransition() {
        var router = (0, _getOwner.getOwner)(this).lookup("router:main");
        (0, _runloop.once)(router, router.trigger, "willTransition");
        return this._super.apply(this, arguments);
      },
      postWasEnqueued: function postWasEnqueued(details) {
        (0, _showModal.default)("post-enqueued", {
          model: details,
          title: "review.approval.title"
        });
      },
      composePrivateMessage: function composePrivateMessage(user, post) {
        var recipients = user ? user.get("username") : "";
        var reply = post ? window.location.protocol + "//" + window.location.host + post.url : null;
        var title = post ? I18n.t("composer.reference_topic_title", {
          title: post.topic.title
        }) : null;

        // used only once, one less dependency
        return this.controllerFor("composer").open({
          action: _composer.default.PRIVATE_MESSAGE,
          recipients: recipients,
          archetypeId: "private_message",
          draftKey: _composer.default.NEW_PRIVATE_MESSAGE_KEY,
          draftSequence: 0,
          reply: reply,
          title: title
        });
      },
      error: function error(err, transition) {
        var xhr = {};
        if (err.jqXHR) {
          xhr = err.jqXHR;
        }

        var xhrOrErr = err.jqXHR ? xhr : err;

        var exceptionController = this.controllerFor("exception");

        var c = window.console;
        if (c && c.error) {
          c.error(xhrOrErr);
        }

        if (xhrOrErr && xhrOrErr.status === 404) {
          return this.transitionTo("exception-unknown");
        }

        exceptionController.setProperties({
          lastTransition: transition,
          thrown: xhrOrErr
        });

        this.intermediateTransitionTo("exception");
        return true;
      },


      showLogin: unlessReadOnly("handleShowLogin", I18n.t("read_only_mode.login_disabled")),

      showCreateAccount: unlessReadOnly("handleShowCreateAccount", I18n.t("read_only_mode.login_disabled")),

      showForgotPassword: function showForgotPassword() {
        this.controllerFor("forgot-password").setProperties({
          offerHelp: null,
          helpSeen: false
        });
        (0, _showModal.default)("forgotPassword", { title: "forgot_password.title" });
      },
      showNotActivated: function showNotActivated(props) {
        (0, _showModal.default)("not-activated", { title: "log_in" }).setProperties(props);
      },
      showUploadSelector: function showUploadSelector(toolbarEvent) {
        (0, _showModal.default)("uploadSelector").setProperties({
          toolbarEvent: toolbarEvent,
          imageUrl: null
        });
      },
      showKeyboardShortcutsHelp: function showKeyboardShortcutsHelp() {
        (0, _showModal.default)("keyboard-shortcuts-help", {
          title: "keyboard_shortcuts_help.title"
        });
      },
      closeModal: function closeModal(initiatedBy) {
        var route = (0, _getOwner.getOwner)(this).lookup("route:application");
        var modalController = route.controllerFor("modal");
        var controllerName = modalController.get("name");

        if (controllerName) {
          var controller = (0, _getOwner.getOwner)(this).lookup("controller:" + controllerName);
          if (controller && controller.beforeClose) {
            if (false === controller.beforeClose()) {
              return;
            }
          }
        }

        this.render("hide-modal", { into: "modal", outlet: "modalBody" });

        if (controllerName) {
          var _controller = (0, _getOwner.getOwner)(this).lookup("controller:" + controllerName);
          if (_controller && _controller.onClose) {
            _controller.onClose({
              initiatedByCloseButton: initiatedBy === "initiatedByCloseButton",
              initiatedByClickOut: initiatedBy === "initiatedByClickOut"
            });
          }
          modalController.set("name", null);
        }
      },
      hideModal: function hideModal() {
        $(".d-modal.fixed-modal").modal("hide");
      },
      reopenModal: function reopenModal() {
        $(".d-modal.fixed-modal").modal("show");
      },
      editCategory: function editCategory(category) {
        var _this = this;

        _category.default.reloadById(category.get("id")).then(function (atts) {
          var model = _this.store.createRecord("category", atts.category);
          model.setupGroupsAndPermissions();
          _this.site.updateCategory(model);
          (0, _showModal.default)("edit-category", { model: model });
          _this.controllerFor("edit-category").set("selectedTab", "general");
        });
      },
      checkEmail: function checkEmail(user) {
        user.checkEmail();
      },
      changeBulkTemplate: function changeBulkTemplate(w) {
        var controllerName = w.replace("modal/", "");
        var controller = (0, _getOwner.getOwner)(this).lookup("controller:" + controllerName);
        this.render(w, {
          into: "modal/topic-bulk-actions",
          outlet: "bulkOutlet",
          controller: controller ? controllerName : "topic-bulk-actions"
        });
      },
      createNewTopicViaParams: function createNewTopicViaParams(title, body, category_id, tags) {
        this.openComposerWithTopicParams(this.controllerFor("discovery/topics"), title, body, category_id, tags);
      },
      createNewMessageViaParams: function createNewMessageViaParams(recipients, title, body) {
        this.openComposerWithMessageParams(recipients, title, body);
      }
    },

    renderTemplate: function renderTemplate() {
      this.render("application");
      this.render("user-card", { into: "application", outlet: "user-card" });
      this.render("modal", { into: "application", outlet: "modal" });
      this.render("composer", { into: "application", outlet: "composer" });
    },
    handleShowLogin: function handleShowLogin() {
      var _this2 = this;

      if (this.siteSettings.enable_sso) {
        var returnPath = encodeURIComponent(window.location.pathname);
        window.location = Discourse.getURL("/session/sso?return_path=" + returnPath);
      } else {
        this._autoLogin("login", "login-modal", function () {
          return _this2.controllerFor("login").resetForm();
        });
      }
    },
    handleShowCreateAccount: function handleShowCreateAccount() {
      if (this.siteSettings.enable_sso) {
        var returnPath = encodeURIComponent(window.location.pathname);
        window.location = Discourse.getURL("/session/sso?return_path=" + returnPath);
      } else {
        this._autoLogin("createAccount", "create-account");
      }
    },
    _autoLogin: function _autoLogin(modal, modalClass, notAuto) {
      var methods = (0, _loginMethod.findAll)();

      if (!this.siteSettings.enable_local_logins && methods.length === 1) {
        this.controllerFor("login").send("externalLogin", methods[0]);
      } else {
        (0, _showModal.default)(modal);
        this.controllerFor("modal").set("modalClass", modalClass);
        if (notAuto) {
          notAuto();
        }
      }
    },
    _handleLogout: function _handleLogout() {
      var _this3 = this;

      if (this.currentUser) {
        this.currentUser.destroySession().then(function () {
          return (0, _logout.default)(_this3.siteSettings, _this3.keyValueStore);
        });
      }
    }
  });

  exports.default = ApplicationRoute;
});
