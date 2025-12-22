/// <reference lib="dom" />

// Fail-safe wrapper for collector bundle
// Catches runtime errors and sends them to Axiom for monitoring

// These constants will be replaced by Bun.build's define
declare const BUILD_AXIOM_URL: string;
declare const BUILD_AXIOM_TOKEN: string;

// This placeholder will be replaced by the actual bundle content during the build script
declare const __BUNDLE_CONTENT__: void;

// Capture customer ID from document.currentScript during script execution
// document.currentScript is only available synchronously during script execution
let cachedCustomerId: string | null = null;
if (typeof document !== "undefined" && (document as any).currentScript) {
  const currentScript = (document as any).currentScript as HTMLScriptElement;
  cachedCustomerId = currentScript?.dataset?.cid || null;
}

interface AxiomErrorData {
  _time: string;
  message: string;
  stack?: string;
  url: string;
  userAgent: string;
  customerId: string | null;
  type: "runtime_error";
}

// Helper to get customer ID from script tag
// Uses document.currentScript captured during initialization
function getCustomerId(): string | null {
  return cachedCustomerId;
}

// Helper to report errors
function reportRuntimeError(error: unknown) {
  try {
    const url = BUILD_AXIOM_URL;
    const token = BUILD_AXIOM_TOKEN;

    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    const data: AxiomErrorData = {
      _time: new Date().toISOString(),
      message: errorMessage,
      stack: errorStack,
      url: window.location.href,
      userAgent: navigator.userAgent,
      customerId: getCustomerId(),
      type: "runtime_error",
    };

    if (typeof fetch !== "undefined") {
      fetch(url, {
        method: "POST",
        keepalive: true,
        headers: {
          Authorization: "Bearer " + token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
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
  __BUNDLE_CONTENT__;
} catch (error) {
  reportRuntimeError(error);
}
