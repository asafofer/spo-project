import { beforeEach, describe, expect, mock, test } from "bun:test";
import { Window } from "happy-dom";
import { handleBidRequested, handleBidResponse } from "../src/collector.js";
import type { Bid } from "../src/types/prebidEvent.js";

// Mock dependencies
const addEventsSpy = mock();

mock.module("../src/eventSender.js", () => ({
  addEvents: addEventsSpy,
  flush: mock(),
  markAuctionCompleted: mock(),
}));

describe("Error Handling & Edge Cases", () => {
  beforeEach(() => {
    addEventsSpy.mockClear();

    // Setup Happy-DOM environment
    const win = new Window();
    (globalThis as any).window = win;
    (globalThis as any).document = win.document;
  });

  describe("Collector Error Handling", () => {
    test("handles malformed bidRequested event with missing required fields", () => {
      const malformedData = {
        // Missing bids, auctionId, etc.
      } as any;

      expect(() => {
        handleBidRequested(malformedData);
      }).not.toThrow();
    });

    test("handles bidRequested with null bids", () => {
      const data = {
        bids: null,
        auctionId: "auc-123",
      } as any;

      expect(() => {
        handleBidRequested(data);
      }).not.toThrow();
    });

    test("handles bidRequested with bids containing missing fields", () => {
      const data = {
        bids: [
          {
            // Missing most fields
            adUnitCode: "div-gpt-ad-1",
          },
          null,
          undefined,
        ] as any,
      };

      expect(() => {
        handleBidRequested(data);
      }).not.toThrow();
    });

    test("handles malformed bid response", () => {
      const malformedBid = {
        // Missing most fields
      } as Bid;

      expect(() => {
        handleBidResponse("bidResponse", malformedBid);
      }).not.toThrow();
    });

    test("handles bid response with null/undefined values", () => {
      const bid: Bid = {
        adUnitCode: "div-gpt-ad-1",
        width: null as any,
        height: undefined,
        cpm: null as any,
      };

      expect(() => {
        handleBidResponse("bidResponse", bid);
      }).not.toThrow();
    });
  });

  describe("SessionStorage Error Handling", () => {
    test("handles sessionStorage unavailable scenario", async () => {
      // Remove sessionStorage
      const originalSessionStorage = (globalThis as any).sessionStorage;
      delete (globalThis as any).sessionStorage;

      // Import utils - should use cached ID fallback
      await expect(
        import("../src/utils.js")
      ).resolves.toBeDefined();

      // Restore
      (globalThis as any).sessionStorage = originalSessionStorage;
    });

    test("handles sessionStorage throwing errors (private browsing)", async () => {
      const happyWindow = new Window();
      const mockSessionStorage = {
        getItem: () => {
          throw new Error("QuotaExceededError");
        },
        setItem: () => {
          throw new Error("QuotaExceededError");
        },
      };

      (globalThis as any).sessionStorage = mockSessionStorage;

      // Should use cached fallback
      const { getSessionId } = await import("../src/utils.js");
      expect(() => {
        getSessionId();
      }).not.toThrow();
    });
  });

  describe("Missing Globals Error Handling", () => {
    test("handles missing window global", async () => {
      const originalWindow = (globalThis as any).window;
      delete (globalThis as any).window;

      // Should not throw when importing modules
      await expect(
        Promise.all([
          import("../src/collector.js"),
          import("../src/eventSender.js"),
          import("../src/logger.js"),
        ])
      ).resolves.toBeDefined();

      // Restore
      (globalThis as any).window = originalWindow;
    });

    test("handles missing document global", async () => {
      const originalDocument = (globalThis as any).document;
      delete (globalThis as any).document;

      // Should not throw
      await expect(
        import("../src/collector.js")
      ).resolves.toBeDefined();

      // Restore
      (globalThis as any).document = originalDocument;
    });

    test("handles missing navigator global", async () => {
      const originalNavigator = (globalThis as any).navigator;
      delete (globalThis as any).navigator;

      // Should not throw
      await expect(
        import("../src/eventSender.js")
      ).resolves.toBeDefined();

      // Restore
      (globalThis as any).navigator = originalNavigator;
    });
  });

  describe("Network Error Handling", () => {
    test("handles network failures in eventSender gracefully", async () => {
      // Mock fetch to fail
      const originalFetch = globalThis.fetch;
      globalThis.fetch = mock(() =>
        Promise.reject(new Error("Network error"))
      ) as any;

      const { flush, addEvents } = await import("../src/eventSender.js");

      addEvents([
        {
          eventType: "bidRequested",
          adUnitCode: "div-gpt-ad-1",
        },
      ]);

      // Should not throw even if network fails
      await flush();
      expect(true).toBe(true); // If we get here, no error was thrown

      // Restore
      globalThis.fetch = originalFetch;
    });
  });

  describe("Missing pbjs Instance", () => {
    test("handles missing pbjs instance gracefully", async () => {
      const happyWindow = new Window();
      const win = happyWindow.window as any;
      (globalThis as any).window = win;
      (globalThis as any).document = happyWindow.document;

      // Don't set up pbjs
      // win.pbjs is undefined

      // Should not throw when importing collector
      await expect(
        import("../src/collector.js")
      ).resolves.toBeDefined();
    });

    test("handles pbjs without que property", async () => {
      const happyWindow = new Window();
      const win = happyWindow.window as any;
      (globalThis as any).window = win;
      (globalThis as any).document = happyWindow.document;

      win.pbjs = {
        // Missing que property
        onEvent: mock(),
      };

      // Should not throw
      await expect(
        import("../src/collector.js")
      ).resolves.toBeDefined();
    });
  });
});

