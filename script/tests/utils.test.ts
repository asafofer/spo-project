import { beforeEach, describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import type { Bid, PrebidEvent } from "../src/types/prebidEvent.js";
import { extractEventTimestamp, generateUUID, getSessionId } from "../src/utils.js";

describe("Utils Module", () => {
  let happyWindow: Window;

  beforeEach(() => {
    // Fresh environment for every test
    happyWindow = new Window();
    (globalThis as any).sessionStorage = happyWindow.sessionStorage;
    (globalThis as any).crypto = { randomUUID: () => "mock-uuid-1234" };
  });

  describe("generateUUID", () => {
    test("generates a valid UUID string", () => {
      const uuid = generateUUID();
      expect(typeof uuid).toBe("string");
      expect(uuid.length).toBeGreaterThan(0);
    });

    test("generates unique UUIDs", () => {
      const uuid1 = generateUUID();
      // Mock a different UUID for second call
      (globalThis as any).crypto = { randomUUID: () => "mock-uuid-5678" };
      const uuid2 = generateUUID();
      expect(uuid1).not.toBe(uuid2);
    });
  });

  describe("getSessionId", () => {
    test("generates new ID if missing", () => {
      const id = getSessionId();

      expect(id).toBe("mock-uuid-1234");

      // Verify persistence
      expect(sessionStorage.getItem("__sid__")).toBe("mock-uuid-1234");
    });

    test("returns existing ID if present", () => {
      sessionStorage.setItem("__sid__", "existing-id-999");

      const id = getSessionId();

      expect(id).toBe("existing-id-999");
    });

    test("persists session ID across multiple calls", () => {
      const id1 = getSessionId();
      const id2 = getSessionId();
      const id3 = getSessionId();

      expect(id1).toBe(id2);
      expect(id2).toBe(id3);
      expect(id1).toBe("mock-uuid-1234");
    });

    test("handles sessionStorage unavailable (private browsing mode)", () => {
      // Simulate sessionStorage throwing an error
      const originalGetItem = sessionStorage.getItem;
      const originalSetItem = sessionStorage.setItem;

      let callCount = 0;
      sessionStorage.getItem = () => {
        callCount++;
        throw new Error("QuotaExceededError");
      };
      sessionStorage.setItem = () => {
        throw new Error("QuotaExceededError");
      };

      // First call should generate and cache an ID
      const id1 = getSessionId();
      expect(typeof id1).toBe("string");
      expect(id1.length).toBeGreaterThan(0);

      // Second call should return the same cached ID
      const id2 = getSessionId();
      expect(id1).toBe(id2);

      // Restore original methods
      sessionStorage.getItem = originalGetItem;
      sessionStorage.setItem = originalSetItem;
    });

    test("handles guard behavior when sessionStorage is undefined", () => {
      // Remove sessionStorage to test guard
      delete (globalThis as any).sessionStorage;

      // Should not throw, should return cached ID
      const id1 = getSessionId();
      expect(typeof id1).toBe("string");

      // Second call should return same cached ID
      const id2 = getSessionId();
      expect(id1).toBe(id2);

      // Restore sessionStorage
      (globalThis as any).sessionStorage = happyWindow.sessionStorage;
    });
  });

  describe("extractEventTimestamp", () => {
    beforeEach(() => {
      // Setup performance API before creating Window (happy-dom needs it)
      const mockTimeOrigin = Date.now() - 5000; // Page loaded 5 seconds ago
      (globalThis as any).performance = {
        timeOrigin: mockTimeOrigin,
        now: () => 5000, // 5 seconds since page load
      };

      // Setup Happy-DOM environment with performance API
      const win = new Window();
      (globalThis as any).window = win;
      (globalThis as any).document = win.document;
    });

    describe("bidRequested timestamp extraction", () => {
      test("uses start field from bidderRequest", () => {
        const startTimestamp = 1765530180355;
        const bidderRequest: PrebidEvent = {
          bids: [],
          start: startTimestamp,
          auctionId: "auc-123",
        };

        const result = extractEventTimestamp("bidRequested", bidderRequest);

        expect(result).toBe(startTimestamp);
      });

      test("falls back to current time when start is missing", () => {
        const beforeTime = Date.now();
        const bidderRequest: PrebidEvent = {
          bids: [],
          auctionId: "auc-123",
        };

        const result = extractEventTimestamp("bidRequested", bidderRequest);

        const afterTime = Date.now();
        expect(result).toBeGreaterThanOrEqual(beforeTime);
        expect(result).toBeLessThanOrEqual(afterTime);
      });
    });

    describe("bidResponse/bidRejected/bidWon timestamp extraction", () => {
      test("uses responseTimestamp for bidResponse", () => {
        const responseTimestamp = 1765530180548;
        const bid: Bid = {
          bidder: "testBidder",
          adUnitCode: "div-gpt-ad-1",
          responseTimestamp: responseTimestamp,
          requestTimestamp: responseTimestamp - 100,
        };

        const result = extractEventTimestamp("bidResponse", bid);

        expect(result).toBe(responseTimestamp);
      });

      test("uses responseTimestamp for bidRejected", () => {
        const responseTimestamp = 1765530180548;
        const bid: Bid = {
          bidder: "testBidder",
          adUnitCode: "div-gpt-ad-1",
          responseTimestamp: responseTimestamp,
          rejectionReason: "No bid",
        };

        const result = extractEventTimestamp("bidRejected", bid);

        expect(result).toBe(responseTimestamp);
      });

      test("uses responseTimestamp for bidWon", () => {
        const responseTimestamp = 1765530180548;
        const bid: Bid = {
          bidder: "testBidder",
          adUnitCode: "div-gpt-ad-1",
          responseTimestamp: responseTimestamp,
          cpm: 2.5,
        };

        const result = extractEventTimestamp("bidWon", bid);

        expect(result).toBe(responseTimestamp);
      });

      test("falls back to current time when responseTimestamp is missing", () => {
        const beforeTime = Date.now();
        const bid: Bid = {
          bidder: "testBidder",
          adUnitCode: "div-gpt-ad-1",
          cpm: 1.25,
        };

        const result = extractEventTimestamp("bidResponse", bid);

        const afterTime = Date.now();
        expect(result).toBeGreaterThanOrEqual(beforeTime);
        expect(result).toBeLessThanOrEqual(afterTime);
      });
    });

    describe("bidTimeout timestamp extraction", () => {
      test("uses current time for bidTimeout", () => {
        const beforeTime = Date.now();
        const bid: Bid = {
          bidder: "testBidder",
          adUnitCode: "div-gpt-ad-1",
          timeout: 3000,
        };

        const result = extractEventTimestamp("bidTimeout", bid);

        const afterTime = Date.now();
        expect(result).toBeGreaterThanOrEqual(beforeTime);
        expect(result).toBeLessThanOrEqual(afterTime);
      });
    });

    describe("past events with elapsedTime", () => {
      test("uses performance.timeOrigin + elapsedTime when timeOrigin is available", () => {
        const elapsedTime = 2000; // 2 seconds since page load
        const fixedNow = 1765612331528; // Fixed timestamp
        const mockTimeOrigin = fixedNow - 5000;
        
        // Mock Date.now FIRST before setting up performance
        const originalDateNow = Date.now;
        Date.now = () => fixedNow;

        // Set up performance mock on both globalThis and window (function checks window.performance)
        (globalThis as any).performance = {
          timeOrigin: mockTimeOrigin,
          now: () => 5000,
        };
        const win = (globalThis as any).window;
        if (win) {
          win.performance = {
            timeOrigin: mockTimeOrigin,
            now: () => 5000,
          };
        }

        const bidderRequest: PrebidEvent = {
          bids: [],
          start: 1765530180355, // This should be ignored when elapsedTime is provided
          auctionId: "auc-123",
        };

        const result = extractEventTimestamp("bidRequested", bidderRequest, elapsedTime);

        // Should be timeOrigin + elapsedTime
        const expectedTime = mockTimeOrigin + elapsedTime;
        expect(result).toBe(expectedTime);
        
        // Restore Date.now
        Date.now = originalDateNow;
      });

      test("calculates page load time when timeOrigin is missing", () => {
        const elapsedTime = 2000; // 2 seconds since page load
        const currentPerfTime = 5000; // 5 seconds since page load
        const fixedNow = 1765612331528; // Fixed timestamp
        const expectedPageLoadTime = fixedNow - currentPerfTime;
        
        // Mock Date.now FIRST before setting up performance
        const originalDateNow = Date.now;
        Date.now = () => fixedNow;

        // Mock performance without timeOrigin (but with now() function)
        // Set on both globalThis and window (function checks window.performance)
        (globalThis as any).performance = {
          now: () => currentPerfTime,
        };
        const win = (globalThis as any).window;
        if (win) {
          win.performance = {
            now: () => currentPerfTime,
          };
        }

        const bidderRequest: PrebidEvent = {
          bids: [],
          auctionId: "auc-123",
        };

        const result = extractEventTimestamp("bidRequested", bidderRequest, elapsedTime);

        // Should be calculated page load time + elapsedTime
        // pageLoadTime = now - currentPerfTime = fixedNow - currentPerfTime
        // result = pageLoadTime + elapsedTime = (fixedNow - currentPerfTime) + elapsedTime
        const expectedTime = expectedPageLoadTime + elapsedTime;
        expect(result).toBe(expectedTime);
        
        // Restore Date.now
        Date.now = originalDateNow;
      });

      test("uses elapsedTime for bidResponse past events", () => {
        const elapsedTime = 3000; // 3 seconds since page load
        const fixedNow = 1765612331528; // Fixed timestamp
        const mockTimeOrigin = fixedNow - 10000;
        
        // Mock Date.now FIRST before setting up performance
        const originalDateNow = Date.now;
        Date.now = () => fixedNow;

        // Update performance mock - must set on window.performance (not just globalThis)
        const win = (globalThis as any).window;
        if (win) {
          win.performance = {
            timeOrigin: mockTimeOrigin,
            now: () => 10000,
          };
        }
        (globalThis as any).performance = {
          timeOrigin: mockTimeOrigin,
          now: () => 10000,
        };

        const bid: Bid = {
          bidder: "testBidder",
          adUnitCode: "div-gpt-ad-1",
          responseTimestamp: 1765530180548, // This should be ignored when elapsedTime is provided
          cpm: 1.25,
        };

        const result = extractEventTimestamp("bidResponse", bid, elapsedTime);

        // Should use elapsedTime calculation, not responseTimestamp
        // Since timeOrigin is available, it should use: timeOrigin + elapsedTime
        const expectedTime = mockTimeOrigin + elapsedTime;
        expect(result).toBe(expectedTime);

        // Restore Date.now
        Date.now = originalDateNow;
        
        // Restore performance mock
        const mockTimeOriginRestore = fixedNow - 5000;
        if (win) {
          win.performance = {
            timeOrigin: mockTimeOriginRestore,
            now: () => 5000,
          };
        }
        (globalThis as any).performance = {
          timeOrigin: mockTimeOriginRestore,
          now: () => 5000,
        };
      });

      test("falls back to current time when performance API is unavailable", () => {
        const elapsedTime = 2000;
        const fixedNow = 1765612331528; // Fixed timestamp
        const originalPerformance = (globalThis as any).performance;
        
        // Mock Date.now FIRST before deleting performance
        const originalDateNow = Date.now;
        Date.now = () => fixedNow;

        // Remove performance API (both globalThis and window)
        delete (globalThis as any).performance;
        const win = (globalThis as any).window;
        if (win) {
          delete win.performance;
        }

        const bidderRequest: PrebidEvent = {
          bids: [],
          auctionId: "auc-123",
        };

        const result = extractEventTimestamp("bidRequested", bidderRequest, elapsedTime);

        // Should fall back to current time (fixedNow) when performance API is unavailable
        expect(result).toBe(fixedNow);
        
        // Restore Date.now
        Date.now = originalDateNow;
        
        // Restore performance
        (globalThis as any).performance = originalPerformance;
        if (win && originalPerformance) {
          win.performance = originalPerformance;
        }
      });
    });

    describe("edge cases", () => {
      test("handles zero elapsedTime", () => {
        // Ensure performance is set up
        if (!(globalThis as any).performance) {
          const mockTimeOrigin = Date.now() - 5000;
          (globalThis as any).performance = {
            timeOrigin: mockTimeOrigin,
            now: () => 5000,
          };
        }

        const bidderRequest: PrebidEvent = {
          bids: [],
          start: 1765530180355,
          auctionId: "auc-123",
        };

        // Zero elapsedTime should be treated as live event
        const result = extractEventTimestamp("bidRequested", bidderRequest, 0);

        expect(result).toBe(1765530180355); // Should use start field
      });

      test("handles negative elapsedTime", () => {
        // Ensure performance is set up
        if (!(globalThis as any).performance) {
          const mockTimeOrigin = Date.now() - 5000;
          (globalThis as any).performance = {
            timeOrigin: mockTimeOrigin,
            now: () => 5000,
          };
        }

        const bidderRequest: PrebidEvent = {
          bids: [],
          start: 1765530180355,
          auctionId: "auc-123",
        };

        // Negative elapsedTime should be treated as live event
        const result = extractEventTimestamp("bidRequested", bidderRequest, -100);

        expect(result).toBe(1765530180355); // Should use start field
      });

      test("handles undefined elapsedTime", () => {
        // Ensure performance is set up
        if (!(globalThis as any).performance) {
          const mockTimeOrigin = Date.now() - 5000;
          (globalThis as any).performance = {
            timeOrigin: mockTimeOrigin,
            now: () => 5000,
          };
        }

        const bidderRequest: PrebidEvent = {
          bids: [],
          start: 1765530180355,
          auctionId: "auc-123",
        };

        const result = extractEventTimestamp("bidRequested", bidderRequest, undefined);

        expect(result).toBe(1765530180355); // Should use start field
      });
    });
  });
});
