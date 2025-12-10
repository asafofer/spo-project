import { getSessionId, generateUUID } from "./utils.js";
import { logger } from "./logger.js";

const ENDPOINT_URL = "http://localhost:3001/events";
const MAX_RETRIES = 3;

// Initialize Prebid queue if not present
window.pbjs = window.pbjs || {};
pbjs.que = pbjs.que || [];

// Buffer for events before flushing
let requestQueue = [];

const pageviewId = generateUUID();
const sessionId = getSessionId();

// Common metadata attached to every event
function getCommonData() {
  return {
    sessionId,
    pageviewId,
    timestamp: Date.now(),
    domain: window.location.hostname,
  };
}

// Normalize bid fields across different event types
function getBidData(bid, eventType) {
  return {
    eventType: eventType,
    bidderCode: bid.bidder || bid.bidderCode,
    adUnitCode: bid.adUnitCode,
    auctionId: bid.auctionId,
    requestId: bid.requestId,
    bidId: bid.bidId,
    bidderRequestId: bid.bidderRequestId,
    adUnitRequestSizes: bid.sizes ? bid.sizes.map(sizeArray => sizeArray.join('x')) : undefined,
    adUnitResponseSize: bid.size ? [bid.size] : undefined
  };
}

// Add events to buffer with metadata
function queueEvents(events) {
  if (!events || events.length === 0) return;

  const enrichedEvents = events.map(event => ({
    ...event,
    ...getCommonData(),
    timestamp: event.timestamp || Date.now() 
  }));

  requestQueue.push(...enrichedEvents);
}

// Prepare payload and clear queue
function flushQueue() {
  if (requestQueue.length === 0) return;

  const payload = [...requestQueue];
  requestQueue = []; // Clear immediately to prevent duplicates

  sendPayload(payload, 0);
}

// Mark all the events of an auction as completed
function markEventsAsCompleted(auctionId) {
  if (requestQueue.length === 0) return;
  
  requestQueue.forEach((event) => {
    if (event.auctionId === auctionId) {
      event.auctionStatus = 1;
    }
  });
}

// Send with retry logic
function sendPayload(payload, retryCount) {
  fetch(ENDPOINT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    keepalive: true // Ensure request survives page unload
  }).catch(err => {
    if (retryCount < MAX_RETRIES) {
      const nextRetry = retryCount + 1;
      logger.warn(`[Collector] Retry ${nextRetry}/${MAX_RETRIES}`);
      setTimeout(() => sendPayload(payload, nextRetry), 500);
    } else {
      logger.error("[Collector] Send failed:", err);
    }
  });
}

// --- Event Handlers ---

function handleBidRequested(data) {
  const events = (data.bids || []).map((bid) => ({
    ...getBidData(bid, "bidRequested"),
    auctionId: bid.auctionId || data.auctionId, // Fallback to parent auctionId
    mediaTypes: Object.keys(bid.mediaTypes || {}),
    start: data.auctionStart,
    pbjsTimeout: data.timeout
  }));
  queueEvents(events);
}

function handleBidTimeout(bids) {
  const events = (bids || []).map((bid) => ({
    ...getBidData(bid, "bidTimeout"),
    pbjsTimeout: bid.timeout
  }));
  queueEvents(events);
}

function handleBidResponse(eventType, bid) {
  const event = {
    ...getBidData(bid, eventType),
    rejectionReason: bid.rejectionReason,
    auctionStatus: eventType === "bidWon" ? 1 : 0,
    requestTimestamp: bid.requestTimestamp,
    responseTimestamp: bid.responseTimestamp,
    timeToRespond: bid.timeToRespond,
    cpm: bid.cpm,
    currency: bid.currency
  };
  queueEvents([event]);
}

// --- Subscription ---

pbjs.que.push(() => {
  const trackingEvents = ['bidRequested', 'bidTimeout', 'bidResponse', 'bidRejected', 'bidWon'];
  
  // Listen to all tracking events
  trackingEvents.forEach(eventType => {
    pbjs.onEvent(eventType, (data) => {
      switch (eventType) {
        case 'bidRequested':
          handleBidRequested(data);
          break;
        case 'bidTimeout':
          handleBidTimeout(data);
          break;
        default:
          handleBidResponse(eventType, data);
          break;
      }
    });
  });

  // Flush buffer when auction ends
  pbjs.onEvent('auctionEnd', (auctionProperties) => {
    // NOTE: bidWon event are emitted after this point, so they aren't marked as complete
    markEventsAsCompleted(auctionProperties.auctionId);
    flushQueue()
  });
  
  logger.log("[Collector] Initialized");
});

// Flush buffer on session end (tab close/hidden)
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    flushQueue();
  }
});