var sessionKey = "__sid__"; // Session storage key (don't collide with other scripts)
var cachedSessionId; // Cached session ID for when sessionStorage is unavailable

/**
 * Generate a UUID v4
 * @returns {string} UUID string
 */
export function generateUUID() {
  return crypto.randomUUID();
}

/**
 * Check if we're in a browser environment
 * @returns {boolean}
 */
function isBrowser() {
  return typeof sessionStorage !== "undefined";
}

/**
 * Get or create session ID from sessionStorage
 * Session persists across page reloads but not across browser sessions
 * @returns {string} Session ID
 */
export function getSessionId() {
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
