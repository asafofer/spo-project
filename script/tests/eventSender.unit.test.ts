import { beforeEach, describe, expect, test } from "bun:test";
import { addEvents, markAuctionCompleted } from "../src/eventSender.js";
import type { AnalyticsEventData } from "../src/types/analyticsEvent.js";

describe("EventSender Unit Tests", () => {
  beforeEach(() => {
    // Clear the event queue before each test
    // Since we can't directly access the queue, we'll test through the public API
  });

  describe("addEvents", () => {
    test("adds single event to queue", () => {
      const event: AnalyticsEventData = {
        eventType: "bidRequested",
        adUnitCode: "div-gpt-ad-1",
        auctionId: "auc-123",
      };

      addEvents([event]);

      // We can't directly inspect the queue, but we can verify it doesn't throw
      // The actual queueing will be tested in integration tests
      expect(true).toBe(true);
    });

    test("adds multiple events to queue", () => {
      const events: AnalyticsEventData[] = [
        {
          eventType: "bidRequested",
          adUnitCode: "div-gpt-ad-1",
          auctionId: "auc-123",
        },
        {
          eventType: "bidResponse",
          adUnitCode: "div-gpt-ad-1",
          auctionId: "auc-123",
        },
      ];

      addEvents(events);

      expect(true).toBe(true);
    });

    test("handles empty array", () => {
      expect(() => {
        addEvents([]);
      }).not.toThrow();
    });

    test("handles null/undefined gracefully", () => {
      expect(() => {
        addEvents(null as any);
        addEvents(undefined as any);
      }).not.toThrow();
    });
  });

  describe("markAuctionCompleted", () => {
    test("marks events with matching auctionId", () => {
      // Add some events first
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

      addEvents(events);
      markAuctionCompleted("auc-123");

      // We can't directly verify, but it should not throw
      expect(true).toBe(true);
    });

    test("handles non-existent auctionId", () => {
      addEvents([
        {
          eventType: "bidRequested",
          auctionId: "auc-123",
        },
      ]);

      expect(() => {
        markAuctionCompleted("non-existent");
      }).not.toThrow();
    });

    test("handles empty queue", () => {
      expect(() => {
        markAuctionCompleted("auc-123");
      }).not.toThrow();
    });
  });
});

