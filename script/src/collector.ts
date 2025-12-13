import { addEvents, flush, markAuctionCompleted } from "./eventSender.js";
import { logger } from "./logger.js";
import type {
  AnalyticsEventData,
  BaseAnalyticsEvent,
} from "./types/analyticsEvent.js";
import type {
  Bid,
  PastEvent,
  PrebidEvent,
  PrebidEventType,
} from "./types/prebidEvent.js";
import { extractEventTimestamp } from "./utils.js";

type PbjsInstance = {
  getEvents?: () => PastEvent[];
  onEvent: (
    eventType: PrebidEventType,
    handler: (data: PrebidEvent) => void
  ) => void;
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

export function handleBidRequested(
  data: {
    bids?: Bid[];
    auctionId?: string;
    auctionStart?: number;
    start?: number; // From bidderRequest.start = timestamp()
    timeout?: number;
  },
  elapsedTime?: number
): void {
  // Extract timestamp from bidderRequest (parent) - all bids share the same start time
  const eventTimestamp = extractEventTimestamp("bidRequested", data, elapsedTime);
  const events: AnalyticsEventData[] = (data.bids || [])
    .filter((bid) => bid != null) // Filter out null/undefined bids
    .map((bid) => ({
      ...getBidData(bid, "bidRequested"),
      auctionId: bid.auctionId || data.auctionId, // Fallback to parent auctionId
      requestMediaTypes: Object.keys(bid.mediaTypes || {}),
      auctionStart: data.auctionStart,
      pbjsTimeout: data.timeout,
      auctionStatus: 0,
      _time: eventTimestamp, // All bids from same bidderRequest share the same timestamp
    }));
  queueEvents(events);
}

function handleBidTimeout(
  bids: Bid[] | undefined,
  elapsedTime?: number
): void {
  const events: AnalyticsEventData[] = (bids || []).map((bid) => {
    const eventTimestamp = extractEventTimestamp("bidTimeout", bid, elapsedTime);
    return {
      ...getBidData(bid, "bidTimeout"),
      pbjsTimeout: bid.timeout,
      auctionStatus: 0,
      _time: eventTimestamp,
    };
  });
  queueEvents(events);
}

export function handleBidResponse(
  eventType: "bidResponse" | "bidRejected" | "bidWon",
  bid: Bid,
  elapsedTime?: number
): void {
  const eventTimestamp = extractEventTimestamp(eventType, bid, elapsedTime);
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
    _time: eventTimestamp,
  };
  queueEvents([event]);
}

function handleAuctionEnd(
  auctionProperties: { auctionId: string; timestamp?: number; auctionEnd?: number },
  elapsedTime?: number
): void {
  // NOTE: bidWon events are emitted after this point, so they aren't marked as complete
  // Note: auctionEnd doesn't create an event, it just marks auctions as complete and flushes
  // But we should still track when it happened for debugging purposes
  markAuctionCompleted(auctionProperties.auctionId);
  flush();
}

// --- Subscription helpers ---

// Map event types to their handlers (keeps dispatch DRY)
// Handlers accept optional elapsedTime for past events
const eventHandlers: Record<
  string,
  (data: PrebidEvent, elapsedTime?: number) => void
> = {
  bidRequested: (data, elapsedTime) => {
    const event = data as Extract<PrebidEvent, { eventType?: "bidRequested" }>;
    handleBidRequested(event, elapsedTime);
  },
  bidTimeout: (data, elapsedTime) => {
    // Prebid sends Bid[] directly for bidTimeout
    handleBidTimeout(data as Bid[], elapsedTime);
  },
  bidResponse: (data, elapsedTime) => {
    // Prebid sends Bid directly for bidResponse
    handleBidResponse("bidResponse", data as Bid, elapsedTime);
  },
  bidRejected: (data, elapsedTime) => {
    // Prebid sends Bid directly for bidRejected
    handleBidResponse("bidRejected", data as Bid, elapsedTime);
  },
  bidWon: (data, elapsedTime) => {
    // Prebid sends Bid directly for bidWon
    handleBidResponse("bidWon", data as Bid, elapsedTime);
  },
  auctionEnd: (data, elapsedTime) => {
    const event = data as Extract<PrebidEvent, { eventType?: "auctionEnd" }>;
    handleAuctionEnd(event, elapsedTime);
  },
};

// Derive tracking events from handler keys
const trackingEvents = Object.keys(eventHandlers) as PrebidEventType[];

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

    pastEvents.forEach((pastEvent: PastEvent) => {
      const eventType = pastEvent.eventType;

      // Only process events in our tracking list
      if (
        !eventType ||
        !trackingEvents.includes(eventType as PrebidEventType)
      ) {
        return;
      }

      // Extract the actual payload from args (past events are wrapped)
      const eventPayload = pastEvent.args;
      // Extract elapsedTime to calculate actual event timestamp
      const elapsedTime =
        typeof pastEvent.elapsedTime === "number"
          ? pastEvent.elapsedTime
          : undefined;

      // Dispatch via handler map, passing elapsedTime for timestamp calculation
      const handler = eventHandlers[eventType as PrebidEventType];
      if (handler) {
        handler(eventPayload, elapsedTime);
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
