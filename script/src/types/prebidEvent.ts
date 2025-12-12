export type Bid = Record<string, unknown> & {
  bidder?: string;
  bidderCode?: string;
  adUnitCode?: string;
  auctionId?: string;
  requestId?: string;
  bidId?: string;
  bidderRequestId?: string;
  sizes?: number[][];
  mediaTypes?: Record<string, unknown>;
  timeout?: number;
  size?: string;
  width?: number;
  height?: number;
  rejectionReason?: string;
  mediaType?: string;
  requestTimestamp?: number;
  responseTimestamp?: number;
  timeToRespond?: number;
  cpm?: number;
  currency?: string;
};

export type PrebidEventType =
  | "bidRequested"
  | "bidTimeout"
  | "bidResponse"
  | "bidRejected"
  | "bidWon"
  | "auctionEnd";

// PrebidEvent: What live events from onEvent() send (payload directly, no wrapper)
export type PrebidEvent =
  | {
      // bidRequested event payload
      bidderCode?: string;
      auctionId?: string;
      pageViewId?: string;
      bidderRequestId?: string;
      bids?: Bid[];
      auctionStart?: number;
      timeout?: number;
      refererInfo?: {
        reachedTop?: boolean;
        isAmp?: boolean;
        numIframes?: number;
        stack?: string[];
        topmostLocation?: string;
        location?: string;
        canonicalUrl?: string | null;
        page?: string;
        domain?: string;
        ref?: string | null;
        legacy?: Record<string, unknown>;
      };
      metrics?: Record<string, unknown>;
      ortb2?: Record<string, unknown>;
      start?: number;
      [key: string]: unknown;
    }
  | Bid[] // bidTimeout: Prebid sends Bid[] directly
  | Bid // bidResponse/bidRejected/bidWon: Prebid sends Bid directly
  | {
      // auctionEnd event payload
      auctionId: string;
      timestamp?: number;
      auctionEnd?: number;
      auctionStatus?: string;
      adUnits?: Array<{
        code?: string;
        mediaTypes?: Record<string, unknown>;
        bids?: Array<Record<string, unknown>>;
        sizes?: Array<[number, number]>;
        adUnitId?: string;
        transactionId?: string;
        [key: string]: unknown;
      }>;
      adUnitCodes?: string[];
      bidderRequests?: Array<Record<string, unknown>>;
      [key: string]: unknown;
    };

// PastEvent: What getEvents() returns (wrapped with eventType and args)
export type PastEvent = {
  eventType: PrebidEventType | string;
  args: PrebidEvent;
  elapsedTime?: number;
  [key: string]: unknown;
};
