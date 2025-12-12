import { addEvents, flush, markAuctionCompleted } from "./eventSender.js";
import { logger } from "./logger.js";
import type {
  AnalyticsEventData,
  BaseAnalyticsEvent,
} from "./types/analyticsEvent.js";
import type { Bid } from "./types/bid.js";
import type { PrebidEventType } from "./types/prebidEvent.js";

type PbjsInstance = {
  getEvents?: () => unknown[];
  onEvent: (eventType: string, handler: (data: unknown) => void) => void;
};

/**
 * Check if we're in a browser environment
 */
function isBrowser(): boolean {
  return typeof window !== "undefined";
}

// Normalize bid fields across different event types
export function getBidData(
  bid: Bid,
  eventType: PrebidEventType
): BaseAnalyticsEvent {
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
function queueEvents(events: AnalyticsEventData[]): void {
  if (!events || events.length === 0) return;
  addEvents(events);
}

// --- Event Handlers ---

export function handleBidRequested(data: {
  bids?: Bid[];
  auctionId?: string;
  auctionStart?: number;
  timeout?: number;
}): void {
  const events: AnalyticsEventData[] = (data.bids || [])
    .filter((bid) => bid != null) // Filter out null/undefined bids
    .map((bid) => ({
      ...getBidData(bid, "bidRequested"),
      auctionId: bid.auctionId || data.auctionId, // Fallback to parent auctionId
      requestMediaTypes: Object.keys(bid.mediaTypes || {}),
      auctionStart: data.auctionStart,
      pbjsTimeout: data.timeout,
      auctionStatus: 0,
      _time: Date.now(),
    }));
  queueEvents(events);
}

function handleBidTimeout(bids: Bid[] | undefined): void {
  const events: AnalyticsEventData[] = (bids || []).map((bid) => ({
    ...getBidData(bid, "bidTimeout"),
    pbjsTimeout: bid.timeout,
    auctionStatus: 0,
  }));
  queueEvents(events);
}

export function handleBidResponse(
  eventType: "bidResponse" | "bidRejected" | "bidWon",
  bid: Bid
): void {
  const event: AnalyticsEventData = {
    ...getBidData(bid, eventType),
    responseSize: bid.size
      ? bid.size
      : [bid.width, bid.height].filter(Boolean).join("x"),
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

function handleAuctionEnd(auctionProperties: { auctionId: string }): void {
  // NOTE: bidWon events are emitted after this point, so they aren't marked as complete
  markAuctionCompleted(auctionProperties.auctionId);
  flush();
}

// --- Subscription helpers ---

// Map event types to their handlers (keeps dispatch DRY)
const eventHandlers: Record<string, (data: unknown) => void> = {
  bidRequested: (data) =>
    handleBidRequested(data as Parameters<typeof handleBidRequested>[0]),
  bidTimeout: (data) => handleBidTimeout(data as Bid[]),
  bidResponse: (data) => handleBidResponse("bidResponse", data as Bid),
  bidRejected: (data) => handleBidResponse("bidRejected", data as Bid),
  bidWon: (data) => handleBidResponse("bidWon", data as Bid),
  auctionEnd: (data) =>
    handleAuctionEnd(data as Parameters<typeof handleAuctionEnd>[0]),
};

// Derive tracking events from handler keys
const trackingEvents = Object.keys(eventHandlers);

// Handle past events that occurred before collector was loaded
function handlePastEvents(pbjsInstance: PbjsInstance): void {
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
      const evt = event as { eventType?: string };
      const eventType = evt.eventType;

      // Only process events in our tracking list
      if (!eventType || !trackingEvents.includes(eventType)) {
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
function registerLiveListeners(pbjsInstance: PbjsInstance): void {
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

/**
 * Initialize collector in browser environment
 */
function initCollector(): void {
  if (!isBrowser()) return;

  const win = window as any;
  // Initialize Prebid queue if not present
  win.pbjs = win.pbjs || {};
  win.pbjs.que = win.pbjs.que || [];
  const pbjs = win.pbjs;

  // Subscribe to Prebid events
  pbjs.que.push(() => {
    // Process past events first
    handlePastEvents(win.pbjs as PbjsInstance);

    // Listen to all tracking events going forward
    registerLiveListeners(win.pbjs as PbjsInstance);

    logger.log("[Collector] Initialized");
  });

  // Flush buffer on session end (tab close/hidden)
  if (typeof (globalThis as any).document !== "undefined") {
    const doc = (globalThis as any).document;
    doc.addEventListener("visibilitychange", () => {
      if (doc.visibilityState === "hidden") {
        flush();
      }
    });
  }
}

initCollector();
