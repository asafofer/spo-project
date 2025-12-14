// Fail-safe wrapper template for collector bundle
// Catches runtime errors and sends them to Axiom for monitoring
// Placeholders: __AXIOM_URL__, __AXIOM_TOKEN__, __BUNDLE_CONTENT__
//
// Note: This file is JavaScript (not TypeScript) because it's loaded as a string template,
// has placeholders replaced at build time, and then injected directly into the final bundle.
// It needs to be plain JavaScript that will execute in the browser runtime without compilation.

try {
  __BUNDLE_CONTENT__
} catch (error) {
  (function() {
    try {
      var url = "__AXIOM_URL__";
      var token = "__AXIOM_TOKEN__";
      var data = {
        _time: new Date().toISOString(),
        message: error.message ? error.message : String(error),
        stack: error.stack,
        url: window.location.href,
        userAgent: navigator.userAgent,
        type: "runtime_error"
      };
      
      if (typeof fetch !== "undefined") {
        fetch(url, {
          method: "POST",
          keepalive: true,
          headers: {
            "Authorization": "Bearer " + token,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(data)
        }).catch(function() {});
      } else if (typeof XMLHttpRequest !== "undefined") {
        var xhr = new XMLHttpRequest();
        xhr.onerror = function() {};
        xhr.onabort = function() {};
        xhr.open("POST", url);
        xhr.setRequestHeader("Authorization", "Bearer " + token);
        xhr.setRequestHeader("Content-Type", "application/json");
        xhr.send(JSON.stringify(data));
      }
      // TODO: send Image().src= ... (pixel)
    } catch (e) {
      // Silently fail to prevent polluting customer website
    }
  })();
}
