import { describe, expect, test } from "bun:test";
import { getBidData } from "../src/collector.js";
import type { Bid } from "../src/types/bid.js";

describe("Collector Unit Tests - getBidData", () => {
  test("normalizes bid fields correctly", () => {
    const bid: Bid = {
      bidder: "ozone",
      adUnitCode: "div-gpt-ad-1",
      auctionId: "auc-123",
      requestId: "req-456",
      bidId: "bid-789",
      bidderRequestId: "br-101",
      sizes: [[300, 250], [300, 600]],
    };

    const result = getBidData(bid, "bidRequested");

    expect(result.eventType).toBe("bidRequested");
    expect(result.bidderCode).toBe("ozone");
    expect(result.adUnitCode).toBe("div-gpt-ad-1");
    expect(result.auctionId).toBe("auc-123");
    expect(result.requestId).toBe("req-456");
    expect(result.bidId).toBe("bid-789");
    expect(result.bidderRequestId).toBe("br-101");
    expect(result.requestSizes).toEqual(["300x250", "300x600"]);
  });

  test("handles bidderCode field when bidder is missing", () => {
    const bid: Bid = {
      bidderCode: "rubicon",
      adUnitCode: "div-gpt-ad-2",
      auctionId: "auc-456",
    };

    const result = getBidData(bid, "bidResponse");

    expect(result.bidderCode).toBe("rubicon");
    expect(result.eventType).toBe("bidResponse");
  });

  test("prefers bidder over bidderCode when both are present", () => {
    const bid: Bid = {
      bidder: "ozone",
      bidderCode: "rubicon",
      adUnitCode: "div-gpt-ad-3",
    };

    const result = getBidData(bid, "bidRequested");

    expect(result.bidderCode).toBe("ozone");
  });

  test("handles missing optional fields", () => {
    const bid: Bid = {
      adUnitCode: "div-gpt-ad-4",
    };

    const result = getBidData(bid, "bidRequested");

    expect(result.eventType).toBe("bidRequested");
    expect(result.adUnitCode).toBe("div-gpt-ad-4");
    expect(result.bidderCode).toBeUndefined();
    expect(result.auctionId).toBeUndefined();
    expect(result.requestId).toBeUndefined();
    expect(result.bidId).toBeUndefined();
    expect(result.bidderRequestId).toBeUndefined();
    expect(result.requestSizes).toBeUndefined();
  });

  test("converts sizes array to string format", () => {
    const bid: Bid = {
      adUnitCode: "div-gpt-ad-5",
      sizes: [[728, 90], [970, 250], [300, 250]],
    };

    const result = getBidData(bid, "bidRequested");

    expect(result.requestSizes).toEqual(["728x90", "970x250", "300x250"]);
  });

  test("handles empty sizes array", () => {
    const bid: Bid = {
      adUnitCode: "div-gpt-ad-6",
      sizes: [],
    };

    const result = getBidData(bid, "bidRequested");

    expect(result.requestSizes).toEqual([]);
  });

  test("handles undefined sizes", () => {
    const bid: Bid = {
      adUnitCode: "div-gpt-ad-7",
    };

    const result = getBidData(bid, "bidRequested");

    expect(result.requestSizes).toBeUndefined();
  });

  test("works with all event types", () => {
    const bid: Bid = {
      bidder: "ozone",
      adUnitCode: "div-gpt-ad-8",
    };

    const types = [
      "bidRequested",
      "bidTimeout",
      "bidResponse",
      "bidRejected",
      "bidWon",
      "auctionEnd",
    ] as const;

    types.forEach((eventType) => {
      const result = getBidData(bid, eventType);
      expect(result.eventType).toBe(eventType);
    });
  });
});

