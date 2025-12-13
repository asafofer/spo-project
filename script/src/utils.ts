import type { Bid, PrebidEvent, PrebidEventType } from "./types/prebidEvent.js";

const sessionKey = "__sid__"; // Session storage key (don't collide with other scripts)
let cachedSessionId: string | undefined; // Cached session ID for when sessionStorage is unavailable

/**
 * Generate a UUID v4
 */
export function generateUUID(): string {
  return crypto.randomUUID();
}

/**
 * Check if we're in a browser environment
 */
function isBrowser(): boolean {
  return typeof sessionStorage !== "undefined";
}

/**
 * Check if we're in a browser environment (for window access)
 */
function isBrowserWindow(): boolean {
  return typeof window !== "undefined";
}

/**
 * Check if sessionStorage is available and usable
 */
export function isSessionStorageAvailable(): boolean {
  if (!isBrowserWindow()) {
    return false;
  }
  try {
    const win = window as any;
    const storage = win.sessionStorage;
    const x = "__storage_test__";
    storage.setItem(x, x);
    const retrieved = storage.getItem(x);
    storage.removeItem(x);
    return retrieved === x;
  } catch (e) {
    // e.name === 'QuotaExceededError' // Storage full
    // e.name === 'SecurityError'      // Cookies disabled / Sandboxed
    return false;
  }
}

/**
 * Get or create session ID from sessionStorage
 * Session persists across page reloads but not across browser sessions
 */
export function getSessionId(): string {
  if (!isBrowser()) {
    // Return cached ID or generate a new one for this process
    if (!cachedSessionId) {
      cachedSessionId = generateUUID();
    }
    return cachedSessionId;
  }

  try {
    let sessionId = sessionStorage.getItem(sessionKey);
    if (!sessionId) {
      sessionId = generateUUID();
      sessionStorage.setItem(sessionKey, sessionId);
    }
    return sessionId;
  } catch (_error) {
    // sessionStorage throws in private browsing mode or when disabled
    // Cache the session ID in memory so all events in this page load share the same ID
    if (!cachedSessionId) {
      cachedSessionId = generateUUID();
    }
    return cachedSessionId;
  }
}

/**
 * Extract the actual event timestamp from Prebid event data
 * Returns the timestamp when the event actually happened on the client side
 */
export function extractEventTimestamp(
  eventType: PrebidEventType,
  eventData: PrebidEvent | Bid,
  elapsedTime?: number
): number {
  const now = Date.now();

  // For past events, calculate actual time from elapsedTime
  // elapsedTime is from performance.now() (time since page load), not absolute timestamp
  if (elapsedTime !== undefined && elapsedTime > 0) {
    if (isBrowserWindow()) {
      const win = window as any;
      const perf = win.performance;

      // Use performance.timeOrigin if available (absolute timestamp when page loaded)
      if (perf && perf.timeOrigin && typeof perf.timeOrigin === "number") {
        return perf.timeOrigin + elapsedTime;
      }

      // Fallback: calculate page load time from current time and performance.now()
      if (perf && perf.now && typeof perf.now === "function") {
        const currentPerfTime = perf.now();
        const pageLoadTime = now - currentPerfTime;
        return pageLoadTime + elapsedTime;
      }
    }

    // If performance API is not available, use current time as fallback
    // (This shouldn't happen in a browser, but handles Node/test environments)
    return now;
  }

  // For live events, extract timestamp from event data based on type
  switch (eventType) {
    case "bidRequested": {
      // start is on bidderRequest (parent), not on individual bids
      // For bidRequested, eventData is the parent bidderRequest object
      const bidderRequest = eventData as Extract<PrebidEvent, { start?: number }>;
      if (bidderRequest.start && typeof bidderRequest.start === "number") {
        return bidderRequest.start;
      }
      // Fallback to current time for live events
      return now;
    }

    case "bidResponse":
    case "bidRejected":
    case "bidWon": {
      // Always use responseTimestamp (when bid was received)
      const bid = eventData as Bid;
      if (bid.responseTimestamp && typeof bid.responseTimestamp === "number") {
        return bid.responseTimestamp;
      }
      // Fallback to current time (shouldn't happen in practice)
      return now;
    }

    case "bidTimeout": {
      // bidTimeout doesn't have requestTimestamp, use current time
      return now;
    }

    default:
      return now;
  }
}
