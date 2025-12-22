import type { PrebidEventType } from "./prebidEvent.js";

// Base fields from getBidData (matches Prebid's bid structure)
export type BaseAnalyticsEvent = {
  eventType: PrebidEventType;
  bidderCode?: string;
  adUnitCode?: string;
  auctionId?: string;
  requestId?: string;
  bidId?: string;
  bidderRequestId?: string;
  requestSizes?: string[];
};

// Event-specific fields matching Prebid's event structure
export type AnalyticsEventData = BaseAnalyticsEvent & {
  // Common to all events
  auctionStatus?: number;
  _time?: number;

  // bidRequested specific (from Prebid bidRequested event)
  requestMediaTypes?: string[];
  auctionStart?: number;
  pbjsTimeout?: number;

  // bidTimeout specific (from Prebid bidTimeout event)
  // (only pbjsTimeout, inherited from BaseAnalyticsEvent)

  // bidResponse/bidRejected/bidWon specific (from Prebid bid object)
  responseSize?: string;
  rejectionReason?: string;
  responseMediaType?: string;
  requestTimestamp?: number;
  responseTimestamp?: number;
  timeToRespond?: number;
  cpm?: number;
  currency?: string;
};

// Final enriched event with common metadata
export type AnalyticsEvent = AnalyticsEventData & {
  _time: number;
  sessionId: string;
  pageviewId: string;
  domain: string;
  os: string | null;
  browser: string | null;
  ua: string;
  ip: string | null;
  yotoCountry: string | null;
  version: string;
  customerId: string | null;
};
