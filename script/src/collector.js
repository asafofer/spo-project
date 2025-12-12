import { addEvents, flush, markAuctionCompleted } from "./eventSender.js";
import { logger } from "./logger.js";

// Initialize Prebid queue if not present
window.pbjs = window.pbjs || {};
pbjs.que = pbjs.que || [];

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
    requestSizes: bid.sizes
      ? bid.sizes.map((sizeArray) => sizeArray.join("x"))
      : undefined,
  };
}

// Add events to buffer (enrichment happens on flush)
function queueEvents(events) {
  if (!events || events.length === 0) return;
  addEvents(events);
}

// --- Event Handlers ---

function handleBidRequested(data) {
  const events = (data.bids || []).map((bid) => ({
    ...getBidData(bid, "bidRequested"),
    auctionId: bid.auctionId || data.auctionId, // Fallback to parent auctionId
    requestMediaTypes: Object.keys(bid.mediaTypes || {}),
    auctionStart: data.auctionStart,
    pbjsTimeout: data.timeout,
  }));
  queueEvents(events);
}

function handleBidTimeout(bids) {
  const events = (bids || []).map((bid) => ({
    ...getBidData(bid, "bidTimeout"),
    pbjsTimeout: bid.timeout,
  }));
  queueEvents(events);
}

function handleBidResponse(eventType, bid) {
  const event = {
    ...getBidData(bid, eventType),
    responseSize: bid.size ? [bid.size] : [bid.width, bid.height].join("x"),
    rejectionReason: bid.rejectionReason,
    auctionStatus: eventType === "bidWon" ? 1 : 0,
    responseMediaType: bid.mediaType,
    requestTimestamp: bid.requestTimestamp,
    responseTimestamp: bid.responseTimestamp,
    timeToRespond: bid.timeToRespond,
    cpm: bid.cpm,
    currency: bid.currency,
  };
  queueEvents([event]);
}

function handleAuctionEnd(auctionProperties) {
  // NOTE: bidWon events are emitted after this point, so they aren't marked as complete
  markAuctionCompleted(auctionProperties.auctionId);
  flush();
}

// --- Subscription helpers ---

// Map event types to their handlers (keeps dispatch DRY)
const eventHandlers = {
  bidRequested: (data) => handleBidRequested(data),
  bidTimeout: (data) => handleBidTimeout(data),
  bidResponse: (data) => handleBidResponse("bidResponse", data),
  bidRejected: (data) => handleBidResponse("bidRejected", data),
  bidWon: (data) => handleBidResponse("bidWon", data),
  auctionEnd: (data) => handleAuctionEnd(data),
};

// Derive tracking events from handler keys
const trackingEvents = Object.keys(eventHandlers);

// Handle past events that occurred before collector was loaded
function handlePastEvents(pbjsInstance) {
  if (typeof pbjsInstance.getEvents !== "function") {
    return; // getEvents not available
  }

  try {
    const pastEvents = pbjsInstance.getEvents();
    if (!Array.isArray(pastEvents) || pastEvents.length === 0) {
      return;
    }

    logger.log(`[Collector] Processing ${pastEvents.length} past event(s)`);

    pastEvents.forEach((event) => {
      const eventType = event.eventType;

      // Only process events in our tracking list
      if (!trackingEvents.includes(eventType)) {
        return;
      }

      // Dispatch via handler map
      const handler = eventHandlers[eventType];
      if (handler) {
        handler(event);
      } else {
        logger.warn(`[Collector] Unknown past event type: ${eventType}`);
      }
    });
  } catch (error) {
    logger.warn("[Collector] Error processing past events:", error);
  }
}

// Register live listeners for tracking events
function registerLiveListeners(pbjsInstance) {
  trackingEvents.forEach((eventType) => {
    pbjsInstance.onEvent(eventType, (data) => {
      const handler = eventHandlers[eventType];
      if (handler) {
        handler(data);
      } else {
        logger.warn(`[Collector] Unknown live event type: ${eventType}`);
      }
    });
  });
}

// --- Subscription ---

pbjs.que.push(() => {
  // Process past events first
  handlePastEvents(pbjs);

  // Listen to all tracking events going forward
  registerLiveListeners(pbjs);

  logger.log("[Collector] Initialized");
});

// Flush buffer on session end (tab close/hidden)
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    flush();
  }
});
