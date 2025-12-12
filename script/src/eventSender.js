// Event sender module - handles IP fetching, enrichment, buffering, and sending
import { getSessionId, generateUUID } from "./utils.js";
import { logger } from "./logger.js";
import { parseUserAgent } from "./uaParser.js";

const EVENTS_ENDPOINT_URL = "https://us-east-1.aws.edge.axiom.co/v1/ingest/prebid-events";
const IP_ENDPOINT_URL = "https://cloudflare.com/cdn-cgi/trace";
const MAX_RETRIES = 3;
const VERSION = "__VERSION__"; // Will be replaced at build time from package.json

// Initialize common data (static per page load)
const pageviewId = generateUUID();
const sessionId = getSessionId();
const uaInfo = parseUserAgent(navigator.userAgent);

// IP cache - fetched once per page load
let cachedIP = null;
let ipFetchPromise = null;

/**
 * Fetch IP from Cloudflare trace endpoint
 * @returns {Promise<string|null>} IP address or null if fetch fails
 */
async function fetchIP() {
  if (cachedIP !== null) {
    return cachedIP;
  }

  if (ipFetchPromise) {
    return ipFetchPromise;
  }

  ipFetchPromise = fetch(IP_ENDPOINT_URL, {
    method: "GET",
    cache: "no-cache",
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`IP fetch failed: ${response.status}`);
      }
      return response.text();
    })
    .then((text) => {
      // Parse the trace response to extract IP
      // Format: "fl=...\nh=...\nip=1.2.3.4\n..."
      const ipMatch = text.match(/^ip=([^\n]+)/m);
      const ip = ipMatch ? ipMatch[1] : null;
      cachedIP = ip;
      logger.log(`[EventSender] Fetched IP: ${ip || "unknown"}`);
      return ip;
    })
    .catch((error) => {
      logger.warn("[EventSender] Failed to fetch IP:", error);
      cachedIP = null; // Allow retry on next flush
      return null;
    })
    .finally(() => {
      ipFetchPromise = null;
    });

  return ipFetchPromise;
}

/**
 * Get common metadata for events (includes IP if available, or yotoCountry if yotoApp.country exists)
 * @returns {Promise<Object>} Common data object
 */
async function getCommonData() {
  // Check if yotoApp.country exists - if so, use it instead of fetching IP
  const yotoCountry = window.yotoApp?.country;
  const eventTimestamp = Date.now();
  let ip = null;
  if (!yotoCountry) {
    // Only fetch IP if yotoApp.country is not available
    ip = await fetchIP();
  }

  return {
    sessionId,
    pageviewId,
    eventTimestamp: eventTimestamp,
    domain: window.location.hostname,
    os: uaInfo.operatingSystem,
    browser: uaInfo.browser,
    ua: navigator.userAgent,
    ip: ip,
    yotoCountry: yotoCountry || null,
    version: VERSION,
  };
}

// Event buffer
let eventQueue = [];

/**
 * Add events to the buffer
 * @param {Array<Object>} events - Events to add
 */
export function addEvents(events) {
  if (!events || events.length === 0) return;
  eventQueue.push(...events);
}

/**
 * Mark all events of an auction as completed
 * @param {string} auctionId - The auction ID
 */
export function markAuctionCompleted(auctionId) {
  if (eventQueue.length === 0) return;

  eventQueue.forEach((event) => {
    if (event.auctionId === auctionId) {
      event.auctionStatus = 1;
    }
  });
}

/**
 * Send payload with retry logic
 * @param {Array<Object>} payload - Events to send
 * @param {number} retryCount - Current retry attempt
 */
function sendPayload(payload, retryCount = 0) {
  fetch(EVENTS_ENDPOINT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer xaat-bcfddc63-166c-468e-ad14-1872c4f0c3fb",
    },
    body: JSON.stringify(payload),
    keepalive: true, // Ensure request survives page unload
  }).catch((err) => {
    if (retryCount < MAX_RETRIES) {
      const nextRetry = retryCount + 1;
      logger.warn(`[EventSender] Retry ${nextRetry}/${MAX_RETRIES}`);
      setTimeout(() => sendPayload(payload, nextRetry), 500);
    } else {
      logger.error("[EventSender] Send failed after retries:", err);
    }
  });
}

/**
 * Flush all queued events - waits for IP to be fetched before sending
 * @returns {Promise<void>}
 */
export async function flush() {
  if (eventQueue.length === 0) return;

  // Check if we need to fetch IP (only if yotoApp.country doesn't exist)
  const yotoCountry = window.yotoApp?.country;
  if (!yotoCountry) {
    // Wait for IP to be fetched (or timeout) only if yotoApp.country is not available
    await fetchIP();
  }

  // Enrich all events with common data (including IP or yotoCountry)
  const commonData = await getCommonData();
  const enrichedEvents = eventQueue.map((event) => ({
    ...event,
    ...commonData,
    // Preserve event-specific timestamp if it exists
    eventTimestamp: event.eventTimestamp || commonData.eventTimestamp,
  }));

  // Clear queue immediately to prevent duplicates
  const payload = [...enrichedEvents];
  eventQueue = [];

  // Send the enriched payload
  sendPayload(payload, 0);
  logger.log(`[EventSender] Flushed ${payload.length} event(s)`);
}

