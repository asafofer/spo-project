import { beforeEach, describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { generateUUID, getSessionId } from "../src/utils.js";

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
});
