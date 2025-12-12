import { beforeEach, describe, expect, mock, test } from "bun:test";
import { Window } from "happy-dom";
import { handleBidRequested, handleBidResponse } from "../src/collector.js";
import type { Bid } from "../src/types/bid.js";
import mockEvents from "./data/mockEvents.json";

type MockEvent = {
  eventType: string;
  args:
    | Bid
    | {
        bids?: Bid[];
        auctionId?: string;
        auctionStart?: number;
        timeout?: number;
      };
};

// Mock dependencies
const addEventsSpy = mock();

mock.module("../src/eventSender.js", () => ({
  addEvents: addEventsSpy,
  flush: mock(),
  markAuctionCompleted: mock(),
  resetEventSender: mock(),
}));

describe("Collector Integration (Real Data Replay)", () => {
  beforeEach(() => {
    addEventsSpy.mockClear();

    // Setup Happy-DOM environment
    const win = new Window();
    (globalThis as any).window = win;
    (globalThis as any).document = win.document;
  });

  test("handleBidRequested -> correctly parses real bid request", () => {
    // 1. Find a suitable event from the fixture
    const eventData = (mockEvents as MockEvent[]).find(
      (e) => e.eventType === "bidRequested"
    );

    if (!eventData) throw new Error("No bidRequested event found in fixture");

    // 2. Run Handler
    handleBidRequested(
      eventData.args as Parameters<typeof handleBidRequested>[0]
    );

    // 3. Assertions
    expect(addEventsSpy).toHaveBeenCalled();
    const call = addEventsSpy.mock.calls[0];
    if (!call) throw new Error("No call found");
    const payload = call[0] as unknown[];
    const firstEvent = payload[0];

    if (!firstEvent) throw new Error("No event in payload");

    // Check specific fields from your real data
    expect(firstEvent).toHaveProperty("eventType", "bidRequested");
    expect((firstEvent as any).auctionId).toBe(
      (eventData.args as any).auctionId
    );
  });

  test("handleBidResponse -> correctly parses real bid response", () => {
    // 1. Find a suitable event
    const eventData = (mockEvents as MockEvent[]).find(
      (e) => e.eventType === "bidResponse"
    );

    if (!eventData) throw new Error("No bidResponse event found in fixture");

    // 2. Run Handler
    handleBidResponse("bidResponse", eventData.args as Bid);

    // 3. Assertions
    expect(addEventsSpy).toHaveBeenCalled();
    const call = addEventsSpy.mock.calls[0];
    if (!call) throw new Error("No call found");
    const payload = call[0] as unknown[];
    const firstEvent = payload[0];

    if (!firstEvent) throw new Error("No event in payload");

    expect((firstEvent as any).eventType).toBe("bidResponse");
    expect((firstEvent as any).cpm).toBe((eventData.args as Bid).cpm);
    // Real data check: ensure cost is a number
    expect(typeof (firstEvent as any).cpm).toBe("number");
  });

  test("handleBidResponse -> bidRejected event type", () => {
    const eventData = (mockEvents as MockEvent[]).find(
      (e) => e.eventType === "bidResponse"
    );

    if (!eventData) throw new Error("No bidResponse event found in fixture");

    handleBidResponse("bidRejected", eventData.args as Bid);

    expect(addEventsSpy).toHaveBeenCalled();
    const call = addEventsSpy.mock.calls[0];
    if (!call) throw new Error("No call found");
    const payload = call[0] as unknown[];
    const firstEvent = payload[0];

    if (!firstEvent) throw new Error("No event in payload");

    expect((firstEvent as any).eventType).toBe("bidRejected");
    expect((firstEvent as any).auctionStatus).toBe(0); // Not won
  });

  test("handleBidResponse -> bidWon event type", () => {
    const eventData = (mockEvents as MockEvent[]).find(
      (e) => e.eventType === "bidResponse"
    );

    if (!eventData) throw new Error("No bidResponse event found in fixture");

    handleBidResponse("bidWon", eventData.args as Bid);

    expect(addEventsSpy).toHaveBeenCalled();
    const call = addEventsSpy.mock.calls[0];
    if (!call) throw new Error("No call found");
    const payload = call[0] as unknown[];
    const firstEvent = payload[0];

    if (!firstEvent) throw new Error("No event in payload");

    expect((firstEvent as any).eventType).toBe("bidWon");
    expect((firstEvent as any).auctionStatus).toBe(1); // Won
  });

  test("handleBidRequested -> handles missing bids array", () => {
    const data = {
      auctionId: "auc-123",
      auctionStart: 1700000000000,
      timeout: 3000,
    };

    handleBidRequested(data);

    // Should not throw, but may not call addEvents if bids is empty
    expect(true).toBe(true); // Test passes if no error thrown
  });

  test("handleBidRequested -> handles empty bids array", () => {
    const data = {
      bids: [],
      auctionId: "auc-123",
    };

    handleBidRequested(data);

    // Should not throw
    expect(true).toBe(true);
  });

  test("handleBidRequested -> handles multiple bids", () => {
    const data = {
      bids: [
        {
          bidder: "ozone",
          adUnitCode: "div-gpt-ad-1",
          auctionId: "auc-123",
        },
        {
          bidder: "rubicon",
          adUnitCode: "div-gpt-ad-2",
          auctionId: "auc-123",
        },
      ] as Bid[],
      auctionId: "auc-123",
    };

    handleBidRequested(data);

    expect(addEventsSpy).toHaveBeenCalled();
    const call = addEventsSpy.mock.calls[0];
    if (!call) throw new Error("No call found");
    const payload = call[0] as unknown[];

    expect(payload.length).toBe(2);
    expect((payload[0] as any).bidderCode).toBe("ozone");
    expect((payload[1] as any).bidderCode).toBe("rubicon");
  });

  test("handleBidRequested -> uses fallback auctionId from parent", () => {
    const data = {
      bids: [
        {
          bidder: "ozone",
          adUnitCode: "div-gpt-ad-1",
          // Missing auctionId in bid
        },
      ] as Bid[],
      auctionId: "parent-auction-123",
    };

    handleBidRequested(data);

    expect(addEventsSpy).toHaveBeenCalled();
    const call = addEventsSpy.mock.calls[0];
    if (!call) throw new Error("No call found");
    const payload = call[0] as unknown[];
    const firstEvent = payload[0];

    if (!firstEvent) throw new Error("No event in payload");

    expect((firstEvent as any).auctionId).toBe("parent-auction-123");
  });

  test("handleBidResponse -> handles missing optional fields", () => {
    const bid: Bid = {
      adUnitCode: "div-gpt-ad-1",
      auctionId: "auc-123",
    };

    handleBidResponse("bidResponse", bid);

    expect(addEventsSpy).toHaveBeenCalled();
    const call = addEventsSpy.mock.calls[0];
    if (!call) throw new Error("No call found");
    const payload = call[0] as unknown[];
    const firstEvent = payload[0];

    if (!firstEvent) throw new Error("No event in payload");

    expect((firstEvent as any).eventType).toBe("bidResponse");
    expect((firstEvent as any).adUnitCode).toBe("div-gpt-ad-1");
  });

  test("handleBidResponse -> normalizes responseSize from width/height", () => {
    const bid: Bid = {
      adUnitCode: "div-gpt-ad-1",
      width: 300,
      height: 250,
    };

    handleBidResponse("bidResponse", bid);

    expect(addEventsSpy).toHaveBeenCalled();
    const call = addEventsSpy.mock.calls[0];
    if (!call) throw new Error("No call found");
    const payload = call[0] as unknown[];
    const firstEvent = payload[0];

    if (!firstEvent) throw new Error("No event in payload");

    expect((firstEvent as any).responseSize).toBe("300x250");
  });

  test("handleBidResponse -> uses size field when available", () => {
    const bid: Bid = {
      adUnitCode: "div-gpt-ad-1",
      size: "728x90",
      width: 300,
      height: 250,
    };

    handleBidResponse("bidResponse", bid);

    expect(addEventsSpy).toHaveBeenCalled();
    const call = addEventsSpy.mock.calls[0];
    if (!call) throw new Error("No call found");
    const payload = call[0] as unknown[];
    const firstEvent = payload[0];

    if (!firstEvent) throw new Error("No event in payload");

    expect((firstEvent as any).responseSize).toBe("728x90");
  });

  test("Smoke Test: Replay entire timeline without crashing", () => {
    let processedCount = 0;

    (mockEvents as MockEvent[]).forEach((event) => {
      try {
        if (event.eventType === "bidRequested") {
          handleBidRequested(
            event.args as Parameters<typeof handleBidRequested>[0]
          );
          processedCount++;
        } else if (event.eventType === "bidResponse") {
          handleBidResponse(
            event.eventType as "bidResponse",
            event.args as Bid
          );
          processedCount++;
        }
      } catch (error) {
        console.error(`Crashed on event type: ${event.eventType}`, error);
        throw error;
      }
    });

    // Ensure we actually processed something
    expect(processedCount).toBeGreaterThan(0);
  });
});
