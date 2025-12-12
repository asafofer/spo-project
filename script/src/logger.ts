// Check for debug flag in URL or Session Storage
let DEBUG = false;

function initLogger(): void {
  if (typeof window === "undefined") return;
  const win = window as any;
  DEBUG =
    (win.location?.search.indexOf("debug=true") ?? -1) > -1 ||
    win.sessionStorage?.getItem("debug") === "true";
}

initLogger();

export const logger = {
  log: (...args: unknown[]) => DEBUG && console.log(...args),
  warn: (...args: unknown[]) => DEBUG && console.warn(...args),
  error: (...args: unknown[]) => DEBUG && console.error(...args),
};
