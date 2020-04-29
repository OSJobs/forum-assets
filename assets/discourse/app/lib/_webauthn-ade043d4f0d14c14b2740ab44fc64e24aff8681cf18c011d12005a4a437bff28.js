define("discourse/lib/webauthn", ["exports"], function (exports) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.stringToBuffer = stringToBuffer;
  exports.bufferToBase64 = bufferToBase64;
  exports.isWebauthnSupported = isWebauthnSupported;
  exports.getWebauthnCredential = getWebauthnCredential;

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

  function stringToBuffer(str) {
    var buffer = new ArrayBuffer(str.length);
    var byteView = new Uint8Array(buffer);
    for (var i = 0; i < str.length; i++) {
      byteView[i] = str.charCodeAt(i);
    }
    return buffer;
  }

  function bufferToBase64(buffer) {
    return btoa(String.fromCharCode.apply(String, _toConsumableArray(new Uint8Array(buffer))));
  }

  function isWebauthnSupported() {
    return typeof PublicKeyCredential !== "undefined";
  }

  function getWebauthnCredential(challenge, allowedCredentialIds, successCallback, errorCallback) {
    if (!isWebauthnSupported()) {
      return errorCallback(I18n.t("login.security_key_support_missing_error"));
    }

    var challengeBuffer = stringToBuffer(challenge);
    var allowCredentials = allowedCredentialIds.map(function (credentialId) {
      return {
        id: stringToBuffer(atob(credentialId)),
        type: "public-key"
      };
    });

    navigator.credentials.get({
      publicKey: {
        challenge: challengeBuffer,
        allowCredentials: allowCredentials,
        timeout: 60000,

        // see https://chromium.googlesource.com/chromium/src/+/master/content/browser/webauth/uv_preferred.md for why
        // default value of preferred is not necesarrily what we want, it limits webauthn to only devices that support
        // user verification, which usually requires entering a PIN
        userVerification: "discouraged"
      }
    }).then(function (credential) {
      // 1. if there is a credential, check if the raw ID base64 matches
      // any of the allowed credential ids
      if (!allowedCredentialIds.some(function (credentialId) {
        return bufferToBase64(credential.rawId) === credentialId;
      })) {
        return errorCallback(I18n.t("login.security_key_no_matching_credential_error"));
      }

      var credentialData = {
        signature: bufferToBase64(credential.response.signature),
        clientData: bufferToBase64(credential.response.clientDataJSON),
        authenticatorData: bufferToBase64(credential.response.authenticatorData),
        credentialId: bufferToBase64(credential.rawId)
      };
      successCallback(credentialData);
    }).catch(function (err) {
      if (err.name === "NotAllowedError") {
        return errorCallback(I18n.t("login.security_key_not_allowed_error"));
      }
      errorCallback(err);
    });
  }
});
