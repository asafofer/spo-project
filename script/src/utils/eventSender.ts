// Event sender module - handles IP fetching, enrichment, buffering, and sending

import type {
  AnalyticsEvent,
  AnalyticsEventData,
} from "../types/analyticsEvent.js";
import { logger } from "./logger.js";
import { parseUserAgent } from "./uaParser.js";
import { generateUUID, getSessionId } from "./utils.js";

// Will be replaced at build time via Bun's --define
// Test fallbacks are provided via tests/setup.ts preload
declare const BUILD_EVENTS_ENDPOINT_URL: string;
declare const BUILD_IP_ENDPOINT_URL: string;
declare const BUILD_VERSION: string;
declare const BUILD_AXIOM_TOKEN: string;

const EVENTS_ENDPOINT_URL = BUILD_EVENTS_ENDPOINT_URL;
const IP_ENDPOINT_URL = BUILD_IP_ENDPOINT_URL;
const VERSION = BUILD_VERSION;
const MAX_RETRIES = 3;

// Initialize common data (static per page load)
const pageviewId = generateUUID();
const sessionId = getSessionId();
let userAgent = "";
let uaInfo: ReturnType<typeof parseUserAgent>;

function initEventSender(): void {
  if (typeof navigator !== "undefined") {
    userAgent = (navigator as any).userAgent;
  }
  uaInfo = parseUserAgent(userAgent);
}

initEventSender();

// IP cache - fetched once per page load
let cachedIP: string | null = null;
let ipFetchPromise: Promise<string | null> | null = null;

/**
 * Fetch IP from Cloudflare trace endpoint
 */
async function fetchIP(): Promise<string | null> {
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
      const ip: string | null = ipMatch?.[1] ?? null;
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
 * Check if we're in a browser environment
 */
function isBrowser(): boolean {
  return typeof window !== "undefined";
}

/**
 * Get common metadata for events (includes IP if available, or yotoCountry if yotoApp.country exists)
 */
async function getCommonData(): Promise<{
  sessionId: string;
  pageviewId: string;
  eventTimestamp: number;
  domain: string;
  os: string | null;
  browser: string | null;
  ua: string;
  ip: string | null;
  yotoCountry: string | null;
  version: string;
}> {
  const win = isBrowser() ? (window as any) : null;
  const yotoCountry = win?.yotoApp?.country;
  const eventTimestamp = Date.now();
  let ip: string | null = null;
  if (!yotoCountry) {
    // Only fetch IP if yotoApp.country is not available
    ip = await fetchIP();
  }

  return {
    sessionId,
    pageviewId,
    eventTimestamp: eventTimestamp,
    domain: win?.location?.hostname || "",
    os: uaInfo.operatingSystem,
    browser: uaInfo.browser,
    ua: userAgent,
    ip: ip,
    yotoCountry: yotoCountry || null,
    version: VERSION,
  };
}

// Event buffer
let eventQueue: AnalyticsEventData[] = [];

/**
 * Add events to the buffer
 */
export function addEvents(events: AnalyticsEventData[]): void {
  if (!events || events.length === 0) return;
  eventQueue.push(...events);
}

/**
 * Mark all events of an auction as completed
 */
export function markAuctionCompleted(auctionId: string): void {
  if (eventQueue.length === 0) return;

  eventQueue.forEach((event) => {
    if (event.auctionId === auctionId) {
      event.auctionStatus = 1;
    }
  });
}

/**
 * Send payload with retry logic
 */
function sendPayload(payload: AnalyticsEvent[], retryCount = 0): void {
  fetch(EVENTS_ENDPOINT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${BUILD_AXIOM_TOKEN}`,
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
 */
export async function flush(): Promise<void> {
  if (eventQueue.length === 0) return;

  // Check if we need to fetch IP (only if yotoApp.country doesn't exist)
  const win = isBrowser() ? (window as any) : null;
  const yotoCountry = win?.yotoApp?.country;
  if (!yotoCountry) {
    // Wait for IP to be fetched (or timeout) only if yotoApp.country is not available
    await fetchIP();
  }

  // Enrich all events with common data (including IP or yotoCountry)
  const commonData = await getCommonData();
  const enrichedEvents: AnalyticsEvent[] = eventQueue.map((event) => ({
    ...event,
    ...commonData,
    // Use event's _time if set, otherwise use commonData timestamp
    _time: event._time || commonData.eventTimestamp,
  }));

  // Clear queue immediately to prevent duplicates
  const payload = [...enrichedEvents];
  eventQueue = [];
  // Send the enriched payload
  sendPayload(payload, 0);
  logger.log(`[EventSender] Flushed ${payload.length} event(s)`);
}

/**
 * Reset internal state - for testing only
 */
export function resetEventSender(): void {
  eventQueue = [];
  cachedIP = null;
  ipFetchPromise = null;
  initEventSender();
}
