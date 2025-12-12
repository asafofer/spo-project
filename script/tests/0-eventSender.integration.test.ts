import { beforeEach, describe, expect, mock, test } from "bun:test";
import { Window } from "happy-dom";
import type { AnalyticsEventData } from "../src/types/analyticsEvent.js";

// CRITICAL: Restore the real eventSender module at the top level BEFORE any tests run
// Other test files mock this module, and those mocks persist. We need to explicitly
// restore it to use the real implementation for integration tests.
const realEventSenderModule = await import("../src/eventSender.js");
mock.module("../src/eventSender.js", () => realEventSenderModule);

describe("EventSender Integration Tests", () => {
  let happyWindow: Window;
  let fetchSpy: ReturnType<typeof mock>;
  let originalFetch: typeof globalThis.fetch;
  let eventSender: typeof import("../src/eventSender.js");

  beforeEach(async () => {
    // CRITICAL: Dynamically import the real module in beforeEach to bypass module mocks
    // Other test files mock this module at the top level, and those mocks persist.
    // By using dynamic imports here, we ensure we get the real implementation.
    eventSender = await import("../src/eventSender.js");

    // Restore the module mock to use the real implementation
    // This must happen in beforeEach to override mocks from other test files
    mock.module("../src/eventSender.js", () => realEventSenderModule);

    // Reset eventSender state
    eventSender.resetEventSender();

    // Fresh environment for every test
    happyWindow = new Window();
    (globalThis as any).window = happyWindow.window;
    (globalThis as any).document = happyWindow.document;
    (globalThis as any).navigator = happyWindow.navigator;
    (globalThis as any).crypto = { randomUUID: () => "mock-uuid-1234" };

    // Store original fetch
    originalFetch = globalThis.fetch;

    // Create mock function for fetch - must be set up before any operations
    fetchSpy = mock((url: string | Request | URL, options?: any) => {
      const urlString =
        typeof url === "string"
          ? url
          : url instanceof URL
          ? url.toString()
          : (url as Request)?.url || String(url);
      if (urlString.includes("cloudflare.com")) {
        // IP endpoint
        return Promise.resolve({
          ok: true,
          status: 200,
          text: () =>
            Promise.resolve("fl=123\nh=example.com\nip=192.168.1.1\n"),
        } as Response);
      }
      // Events endpoint
      return Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve(""),
      } as Response);
    });

    // Replace global fetch with our mock - this must happen before flush() is called
    (globalThis as any).fetch = fetchSpy;

    // Clear any previous mock calls
    fetchSpy.mockClear();
  });

  test("flush enriches events with common data", async () => {
    const events: AnalyticsEventData[] = [
      {
        eventType: "bidRequested",
        adUnitCode: "div-gpt-ad-1",
        auctionId: "auc-123",
        _time: 1700000000000,
      },
    ];

    eventSender.addEvents(events);

    // Set up window location
    const win = happyWindow.window as any;
    win.location = { hostname: "example.com" };

    await eventSender.flush();

    // Wait for async fetch to complete (sendPayload calls fetch asynchronously)
    // sendPayload is fire-and-forget, so we need to wait for the fetch promise to start
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Verify fetch was called (should be called for both IP and events)
    expect(fetchSpy).toHaveBeenCalled();

    // Verify fetch was called for sending events
    const calls = fetchSpy.mock.calls;
    expect(calls.length).toBeGreaterThan(0);

    // Find the call to the events endpoint
    // Note: fetch is called with (url, options), so call[0] is the URL
    const eventCall = calls.find((call: any[]) => {
      const url = call[0];
      const urlString =
        typeof url === "string"
          ? url
          : url instanceof URL
          ? url.toString()
          : (url as Request)?.url || String(url);
      return urlString.includes("axiom.co");
    });
    expect(eventCall).toBeDefined();

    if (eventCall && eventCall[1]?.body) {
      const body = JSON.parse(eventCall[1].body);
      expect(Array.isArray(body)).toBe(true);
      if (body.length > 0) {
        const event = body[0];
        expect(event).toHaveProperty("sessionId");
        expect(event).toHaveProperty("pageviewId");
        expect(event).toHaveProperty("domain");
        expect(event).toHaveProperty("os");
        expect(event).toHaveProperty("browser");
        expect(event).toHaveProperty("ua");
        expect(event).toHaveProperty("_time");
      }
    }
  });

  test("flush clears queue after sending", async () => {
    const events: AnalyticsEventData[] = [
      {
        eventType: "bidRequested",
        adUnitCode: "div-gpt-ad-1",
        auctionId: "auc-123",
      },
    ];

    eventSender.addEvents(events);

    const win = happyWindow.window as any;
    win.location = { hostname: "example.com" };

    await eventSender.flush();

    // Wait for async fetch to complete (sendPayload calls fetch asynchronously)
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Count event endpoint calls after first flush
    const eventCallsAfterFirst = fetchSpy.mock.calls.filter((call: any[]) => {
      const url = call[0];
      const urlString =
        typeof url === "string"
          ? url
          : url instanceof URL
          ? url.toString()
          : (url as Request)?.url || String(url);
      return urlString.includes("axiom.co");
    });
    const firstFlushCallCount = eventCallsAfterFirst.length;

    // Second flush should not send anything (queue is empty)
    // This verifies that flush() cleared the queue (proves sendPayload was called)
    await eventSender.flush();
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Should not make additional event endpoint calls
    const eventCallsAfterSecond = fetchSpy.mock.calls.filter((call: any[]) => {
      const url = call[0];
      const urlString =
        typeof url === "string"
          ? url
          : url instanceof URL
          ? url.toString()
          : (url as Request)?.url || String(url);
      return urlString.includes("axiom.co");
    });
    expect(eventCallsAfterSecond.length).toBe(firstFlushCallCount);
  });

  test("flush handles IP fetch failure gracefully", async () => {
    // Override fetch mock for this test to fail on IP endpoint
    const originalMock = fetchSpy;
    fetchSpy = mock((url: string | Request | URL) => {
      const urlString =
        typeof url === "string"
          ? url
          : url instanceof URL
          ? url.toString()
          : (url as Request)?.url || String(url);
      if (urlString.includes("cloudflare.com")) {
        return Promise.reject(new Error("Network error"));
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve("fl=123\nh=example.com\nip=192.168.1.1\n"),
      } as Response);
    });
    (globalThis as any).fetch = fetchSpy;

    const events: AnalyticsEventData[] = [
      {
        eventType: "bidRequested",
        adUnitCode: "div-gpt-ad-1",
        auctionId: "auc-123",
      },
    ];

    eventSender.addEvents(events);

    const win = happyWindow.window as any;
    win.location = { hostname: "example.com" };

    // Should not throw even if IP fetch fails
    await eventSender.flush();
    expect(true).toBe(true); // If we get here, no error was thrown
  });

  test("flush uses yotoCountry when available instead of fetching IP", async () => {
    const win = happyWindow.window as any;
    win.location = { hostname: "example.com" };
    win.yotoApp = { country: "US" };

    const events: AnalyticsEventData[] = [
      {
        eventType: "bidRequested",
        adUnitCode: "div-gpt-ad-1",
        auctionId: "auc-123",
      },
    ];

    eventSender.addEvents(events);

    await eventSender.flush();

    // Wait for async fetch to complete (sendPayload calls fetch asynchronously)
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Should not call IP endpoint when yotoCountry is available
    const ipCalls = fetchSpy.mock.calls.filter((call: any[]) => {
      const url = call[0];
      const urlString =
        typeof url === "string"
          ? url
          : url instanceof URL
          ? url.toString()
          : (url as Request)?.url || String(url);
      return urlString.includes("cloudflare.com");
    });
    expect(ipCalls.length).toBe(0);

    // But should still send events
    const eventCalls = fetchSpy.mock.calls.filter((call: any[]) => {
      const url = call[0];
      const urlString =
        typeof url === "string"
          ? url
          : url instanceof URL
          ? url.toString()
          : (url as Request)?.url || String(url);
      return urlString.includes("axiom.co");
    });
    expect(eventCalls.length).toBeGreaterThan(0);
  });

  test("markAuctionCompleted marks events before flush", async () => {
    const events: AnalyticsEventData[] = [
      {
        eventType: "bidRequested",
        auctionId: "auc-123",
        auctionStatus: 0,
      },
      {
        eventType: "bidResponse",
        auctionId: "auc-123",
        auctionStatus: 0,
      },
      {
        eventType: "bidRequested",
        auctionId: "auc-456",
        auctionStatus: 0,
      },
    ];

    eventSender.addEvents(events);
    eventSender.markAuctionCompleted("auc-123");

    const win = happyWindow.window as any;
    win.location = { hostname: "example.com" };

    await eventSender.flush();

    // Wait for async fetch to complete (sendPayload calls fetch asynchronously)
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Verify events were sent
    const eventCalls = fetchSpy.mock.calls.filter((call: any[]) => {
      const url = call[0];
      const urlString =
        typeof url === "string"
          ? url
          : url instanceof URL
          ? url.toString()
          : (url as Request)?.url || String(url);
      return urlString.includes("axiom.co");
    });
    expect(eventCalls.length).toBeGreaterThan(0);

    if (eventCalls.length > 0 && eventCalls[0]) {
      const callOptions = eventCalls[0][1];
      if (callOptions) {
        const body = JSON.parse(callOptions.body || "[]");
        const auc123Events = body.filter((e: any) => e.auctionId === "auc-123");
        auc123Events.forEach((event: any) => {
          expect(event.auctionStatus).toBe(1);
        });
      }
    }
  });

  test("flush handles guard behavior when window is undefined", async () => {
    const events: AnalyticsEventData[] = [
      {
        eventType: "bidRequested",
        adUnitCode: "div-gpt-ad-1",
        auctionId: "auc-123",
      },
    ];

    eventSender.addEvents(events);

    // Remove window
    const originalWindow = (globalThis as any).window;
    delete (globalThis as any).window;

    // Should not throw
    await eventSender.flush();
    expect(true).toBe(true); // If we get here, no error was thrown

    // Restore window
    (globalThis as any).window = originalWindow;
  });

  test("flush does nothing when queue is empty", async () => {
    const callCountBefore = fetchSpy.mock.calls.length;

    await eventSender.flush();

    // Should not make any fetch calls
    expect(fetchSpy.mock.calls.length).toBe(callCountBefore);
  });
});
