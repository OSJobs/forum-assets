define("confirm-new-email/confirm-new-email", ["discourse/lib/webauthn"], function (_webauthn) {
  "use strict";

  var security = document.getElementById("submit-security-key");
  if (security) {
    security.onclick = function (e) {
      e.preventDefault();
      (0, _webauthn.getWebauthnCredential)(document.getElementById("security-key-challenge").value, document.getElementById("security-key-allowed-credential-ids").value.split(","), function (credentialData) {
        document.getElementById("security-key-credential").value = JSON.stringify(credentialData);

        $(e.target).parents("form").submit();
      }, function (errorMessage) {
        document.getElementById("security-key-error").innerText = errorMessage;
      });
    };
  }
});
