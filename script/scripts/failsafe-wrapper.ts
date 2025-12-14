/// <reference lib="dom" />

// Fail-safe wrapper for collector bundle
// Catches runtime errors and sends them to Axiom for monitoring

// These constants will be replaced by Bun.build's define
declare const BUILD_AXIOM_URL: string;
declare const BUILD_AXIOM_TOKEN: string;

// Helper to report errors
function reportRuntimeError(error: any) {
  try {
    const url = BUILD_AXIOM_URL;
    const token = BUILD_AXIOM_TOKEN;
    
    const data = {
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
      }).catch(() => {});
    } else if (typeof XMLHttpRequest !== "undefined") {
      const xhr = new XMLHttpRequest();
      xhr.onerror = () => {};
      xhr.onabort = () => {};
      xhr.open("POST", url);
      xhr.setRequestHeader("Authorization", "Bearer " + token);
      xhr.setRequestHeader("Content-Type", "application/json");
      xhr.send(JSON.stringify(data));
    }
  } catch (e) {
    // Silently fail to prevent polluting customer website
  }
}

// Global error handler for the bundle execution
try {
  // The __BUNDLE_CONTENT__ line is replaced by the actual code.
  // Since the bundle is an IIFE, it executes immediately here.
  // @ts-ignore
  __BUNDLE_CONTENT__;
} catch (error) {
  reportRuntimeError(error);
}
