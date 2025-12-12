import { beforeEach, describe, expect, mock, test } from "bun:test";
import { Window } from "happy-dom";
import { handleBidRequested, handleBidResponse } from "../src/collector.js";
import mockData from "./fixtures/mockEvents.json";

// 1. Mock dependencies to capture output
const addEventsSpy = mock();

mock.module("../src/eventSender.js", () => ({
  addEvents: addEventsSpy,
  flush: mock(),
  markAuctionCompleted: mock(),
}));

describe("Collector Integration (Event Replay)", () => {
  beforeEach(() => {
    // Reset the spy before every test
    addEventsSpy.mockClear();

    // Environment Setup (Guard check)
    // Even though we test logic, setting up window ensures no stray access causes crashes
    const win = new Window();
    globalThis.window = win;
  });

  test("handleBidRequested -> transforms and queues event", () => {
    // 1. REPLAY: Feed the raw mock event into the handler
    handleBidRequested(mockData.bidRequested);

    // 2. ASSERT: Did we queue an event?
    expect(addEventsSpy).toHaveBeenCalled();

    // 3. INSPECT: Get the exact data object passed to addEvents
    const payload = addEventsSpy.mock.calls[0][0];
    const event = payload[0];

    // Check normalization logic
    expect(event.eventType).toBe("bidRequested");
    expect(event.auctionId).toBe("auc-1234-5678");
    expect(event.adUnitCode).toBe("div-gpt-ad-1");

    // Check if sizes were flattened correctly from [[300,250]] to "300x250"
    expect(event.requestSizes).toContain("300x250");
  });

  test("handleBidResponse -> transforms and queues event", () => {
    // 1. REPLAY
    handleBidResponse("bidResponse", mockData.bidResponse);

    // 2. ASSERT
    expect(addEventsSpy).toHaveBeenCalled();

    // 3. INSPECT
    const payload = addEventsSpy.mock.calls[0][0];
    const event = payload[0];

    expect(event.eventType).toBe("bidResponse");
    expect(event.cpm).toBe(1.25);
    expect(event.timeToRespond).toBe(120);

    // Check normalization of size
    expect(event.responseSize).toBe("300x250");
  });
});
