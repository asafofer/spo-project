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
