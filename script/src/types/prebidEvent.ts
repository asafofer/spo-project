import type { Bid } from "./bid.js";

export type PrebidEventType =
  | "bidRequested"
  | "bidTimeout"
  | "bidResponse"
  | "bidRejected"
  | "bidWon"
  | "auctionEnd";

export type PrebidEvent =
  | {
      eventType: "bidRequested";
      bids?: Bid[];
      auctionId?: string;
      auctionStart?: number;
      timeout?: number;
    }
  | { eventType: "bidTimeout"; bids?: Bid[] }
  | {
      eventType: "bidResponse" | "bidRejected" | "bidWon";
      bid: Bid;
    }
  | { eventType: "auctionEnd"; auctionId: string };
