/**
 * Generate a UUID v4
 * @returns {string} UUID string
 */
export function generateUUID() {
    return crypto.randomUUID();
}

/**
 * Get or create session ID from sessionStorage
 * Session persists across page reloads but not across browser sessions
 * @returns {string} Session ID
 */
export function getSessionId() {
    try {
        var sessionId = sessionStorage.getItem(sessionKey);
        if (!sessionId) {
            sessionId = generateUUID();
            sessionStorage.setItem(sessionKey, sessionId);
        }
        return sessionId;
    } catch (error) {
        // sessionStorage throws in private browsing mode or when disabled
        // Cache the session ID in memory so all events in this page load share the same ID
        if (!cachedSessionId) {
            cachedSessionId = generateUUID();
        }
        return cachedSessionId;
    }
}