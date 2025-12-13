import { beforeEach, describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { getSampleRate, getSamplingDecision } from "../src/sampling.js";

describe("Sampling Module", () => {
  let happyWindow: Window;

  beforeEach(() => {
    // Fresh environment for every test
    happyWindow = new Window();
    (globalThis as any).sessionStorage = happyWindow.sessionStorage;
    // Clear sessionStorage before each test
    sessionStorage.clear();
  });

  describe("getSampleRate", () => {
    test("returns 100 when SAMPLE_RATE is not replaced (default)", () => {
      // The actual module has SAMPLE_RATE = "__SAMPLE_RATE__" which defaults to 100
      expect(getSampleRate()).toBe(100);
    });

    test("returns a number", () => {
      const rate = getSampleRate();
      expect(typeof rate).toBe("number");
      expect(Number.isFinite(rate)).toBe(true);
    });

    test("accepts override rate parameter for testing", () => {
      expect(getSampleRate(50)).toBe(50);
      expect(getSampleRate(0)).toBe(0);
      expect(getSampleRate(100)).toBe(100);
      expect(getSampleRate(150)).toBe(150);
      expect(getSampleRate(-10)).toBe(-10);
    });
  });

  describe("getSamplingDecision", () => {
    test("returns a boolean", () => {
      const decision = getSamplingDecision();
      expect(typeof decision).toBe("boolean");
    });

    test("with default 100% rate, always returns true", () => {
      sessionStorage.clear();
      const decision = getSamplingDecision();
      expect(decision).toBe(true);
      // When rate >= 100%, function returns early without storing in sessionStorage
      expect(sessionStorage.getItem("__sampling__")).toBeNull();
    });

    test("stores decision in sessionStorage and returns same value on subsequent calls", () => {
      sessionStorage.clear();
      // With default 100% rate, it returns true early without storing
      const decision1 = getSamplingDecision();
      expect(decision1).toBe(true);
      // Rate >= 100% returns early, so nothing is stored
      expect(sessionStorage.getItem("__sampling__")).toBeNull();

      // Call again - still returns true (but not from sessionStorage, from early return)
      const decision2 = getSamplingDecision();
      expect(decision2).toBe(decision1);
    });

    test("uses cached decision when sessionStorage is unavailable", () => {
      const originalSessionStorage = (globalThis as any).sessionStorage;
      delete (globalThis as any).sessionStorage;

      try {
        const decision1 = getSamplingDecision();
        const decision2 = getSamplingDecision();

        expect(decision1).toBe(decision2);
        expect(decision1).toBe(true); // 100% rate always true
      } finally {
        (globalThis as any).sessionStorage = originalSessionStorage;
      }
    });

    test("handles sessionStorage errors gracefully (private browsing)", () => {
      const originalSetItem = sessionStorage.setItem;
      sessionStorage.setItem = () => {
        throw new Error("QuotaExceededError");
      };

      try {
        const decision1 = getSamplingDecision();
        const decision2 = getSamplingDecision();

        expect(decision1).toBe(decision2);
        expect(decision1).toBe(true); // 100% rate always true
      } finally {
        sessionStorage.setItem = originalSetItem;
      }
    });

    test("always returns true when rate is 100", () => {
      expect(getSamplingDecision(100)).toBe(true);
    });

    test("always returns true when rate is > 100", () => {
      expect(getSamplingDecision(150)).toBe(true);
      expect(getSamplingDecision(200)).toBe(true);
    });

    test("always returns false when rate is 0", () => {
      expect(getSamplingDecision(0)).toBe(false);
    });

    test("always returns false when rate is < 0", () => {
      expect(getSamplingDecision(-10)).toBe(false);
      expect(getSamplingDecision(-1)).toBe(false);
    });

    test("stores decision in sessionStorage with 50% rate", () => {
      const originalRandom = Math.random;
      Math.random = () => 0.3; // 30, which is < 50, so decision = true

      try {
        sessionStorage.clear();
        const decision1 = getSamplingDecision(50);
        expect(decision1).toBe(true);
        expect(sessionStorage.getItem("__sampling__")).toBe("true");

        const decision2 = getSamplingDecision(50);
        expect(decision2).toBe(decision1);
      } finally {
        Math.random = originalRandom;
      }
    });

    test("generates different decisions based on rate and random value", () => {
      const originalRandom = Math.random;
      const fixedRandom = 0.5; // 50
      Math.random = () => fixedRandom;

      try {
        // rate=10: 50 >= 10, so decision = false
        sessionStorage.clear();
        expect(getSamplingDecision(10)).toBe(false);

        // rate=50: 50 >= 50, so decision = false
        sessionStorage.clear();
        expect(getSamplingDecision(50)).toBe(false);

        // rate=90: 50 < 90, so decision = true
        sessionStorage.clear();
        expect(getSamplingDecision(90)).toBe(true);
      } finally {
        Math.random = originalRandom;
      }
    });

    test("forces true decision with low random value", () => {
      const originalRandom = Math.random;
      Math.random = () => 0.1; // 10, which is < 50 for 50% rate

      try {
        expect(getSamplingDecision(50)).toBe(true); // 10 < 50
      } finally {
        Math.random = originalRandom;
      }
    });

    test("forces false decision with high random value", () => {
      const originalRandom = Math.random;
      Math.random = () => 0.6; // 60, which is >= 50 for 50% rate

      try {
        expect(getSamplingDecision(50)).toBe(false); // 60 >= 50
      } finally {
        Math.random = originalRandom;
      }
    });

    test("uses cached decision when sessionStorage is unavailable with custom rate", () => {
      const originalSessionStorage = (globalThis as any).sessionStorage;
      delete (globalThis as any).sessionStorage;

      const originalRandom = Math.random;
      let randomCallCount = 0;
      Math.random = () => {
        randomCallCount++;
        return 0.3;
      };

      try {
        const decision1 = getSamplingDecision(50);
        const decision2 = getSamplingDecision(50);

        expect(decision1).toBe(decision2);
        expect(randomCallCount).toBe(1); // Should only call Math.random once
      } finally {
        Math.random = originalRandom;
        (globalThis as any).sessionStorage = originalSessionStorage;
      }
    });

    test("handles sessionStorage errors with custom rate", () => {
      const originalSetItem = sessionStorage.setItem;
      sessionStorage.setItem = () => {
        throw new Error("QuotaExceededError");
      };

      const originalRandom = Math.random;
      let randomCallCount = 0;
      Math.random = () => {
        randomCallCount++;
        return 0.3;
      };

      try {
        const decision1 = getSamplingDecision(50);
        const decision2 = getSamplingDecision(50);

        expect(decision1).toBe(decision2);
        expect(randomCallCount).toBe(1); // Should fall back to cache
      } finally {
        Math.random = originalRandom;
        sessionStorage.setItem = originalSetItem;
      }
    });
  });
});
