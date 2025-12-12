// Check for debug flag in URL or Session Storage
let DEBUG = false;

function initLogger() {
  if (typeof window === "undefined") return;
  DEBUG =
    (window.location && window.location.search.indexOf("debug=true") > -1) ||
    (window.sessionStorage &&
      window.sessionStorage.getItem("debug") === "true");
}

initLogger();

export const logger = {
  log: (...args) => DEBUG && console.log(...args),
  warn: (...args) => DEBUG && console.warn(...args),
  error: (...args) => DEBUG && console.error(...args),
};
