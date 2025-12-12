import { beforeEach, describe, expect, mock, test } from "bun:test";
import { Window } from "happy-dom";
import { handleBidRequested, handleBidResponse } from "../src/collector.js";
import mockEvents from "./fixtures/mockEvents.json";

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
    globalThis.window = win;
    globalThis.document = win.document;
  });

  test("handleBidRequested -> correctly parses real bid request", () => {
    // 1. Find a suitable event from the fixture
    const eventData = mockEvents.find((e) => e.eventType === "bidRequested");

    if (!eventData) throw new Error("No bidRequested event found in fixture");

    // 2. Run Handler
    handleBidRequested(eventData.args);

    // 3. Assertions
    expect(addEventsSpy).toHaveBeenCalled();
    const payload = addEventsSpy.mock.calls[0][0]; // First arg of first call

    // Check specific fields from your real data
    expect(payload[0].eventType).toBe("bidRequested");
    expect(payload[0].auctionId).toBe(eventData.args.auctionId);
  });

  test("handleBidResponse -> correctly parses real bid response", () => {
    // 1. Find a suitable event
    const eventData = mockEvents.find((e) => e.eventType === "bidResponse");

    if (!eventData) throw new Error("No bidResponse event found in fixture");

    // 2. Run Handler
    handleBidResponse("bidResponse", eventData.args);

    // 3. Assertions
    expect(addEventsSpy).toHaveBeenCalled();
    const payload = addEventsSpy.mock.calls[0][0];

    expect(payload[0].eventType).toBe("bidResponse");
    expect(payload[0].cpm).toBe(eventData.args.cpm);
    // Real data check: ensure cost is a number
    expect(typeof payload[0].cpm).toBe("number");
  });

  test("Smoke Test: Replay entire timeline without crashing", () => {
    let processedCount = 0;

    mockEvents.forEach((event) => {
      try {
        if (event.eventType === "bidRequested") {
          handleBidRequested(event.args);
          processedCount++;
        } else if (event.eventType === "bidResponse") {
          handleBidResponse(event.eventType, event.args);
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
