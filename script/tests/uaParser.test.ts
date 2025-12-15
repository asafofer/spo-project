import { describe, expect, test } from "bun:test";
import { parseUserAgent } from "../src/utils/uaParser.js";
import { browsers } from "./data/browsers.js";
import { os } from "./data/os.js";

type TestCase = {
  desc: string;
  ua: string;
  expect: { name: string; version?: string; major?: string };
};

// Maps the "Expected" names from your dataset to the "Actual" names returned by the parser.
const BROWSER_MAPPINGS: Record<string, string> = {
  "Samsung Internet": "samsung browser",
  "Mobile Chrome": "chrome",
  "Mobile Firefox": "firefox",
  "Chrome Headless": "chrome",
  Facebook: "facebook",
  Instagram: "instagram",
  "Chrome WebView": "chrome webview",
  "Mobile Safari": "mobile safari",
  Edge: "edge",
  Opera: "opera",
  Firefox: "firefox",
  Safari: "safari",
  "Android Browser": "android browser",
  "Google Search": "gsa",
  GSA: "gsa",
};

const OS_MAPPINGS: Record<string, string> = {
  macOS: "mac os",
  "Mac OS": "mac os",
  iOS: "ios",
  Windows: "windows",
  Android: "android",
  "Chrome OS": "chromium os",
  "Chromium OS": "chromium os",
  Ubuntu: "ubuntu",
  Linux: "linux",
};

// Only run tests for these supported items (High-frequency list)
const SUPPORTED_BROWSERS = new Set([
  "facebook",
  "instagram",
  "gsa",
  "samsung browser",
  "miui browser",
  "whale",
  "silk",
  "ucbrowser",
  "yandex",
  "avast secure browser",
  "avg secure browser",
  "opera",
  "edge",
  "firefox",
  "chrome webview",
  "chrome",
  "mobile safari",
  "safari",
  "android browser",
  "webkit",
]);

const SUPPORTED_OS = new Set([
  "android",
  "ios",
  "windows",
  "mac os",
  "chromium os",
  "ubuntu",
  "linux",
]);

function normalizeExpected(
  expectedRaw: string,
  type: "Browsers" | "Operating Systems"
): string {
  const map = type === "Browsers" ? BROWSER_MAPPINGS : OS_MAPPINGS;
  let expectedNormalized = map[expectedRaw] || expectedRaw;
  return expectedNormalized.toLowerCase();
}

describe("User Agent Parser", () => {
  describe("Browser Detection", () => {
    browsers.forEach((testCase: TestCase) => {
      const expectedNormalized = normalizeExpected(
        testCase.expect.name,
        "Browsers"
      );

      if (!SUPPORTED_BROWSERS.has(expectedNormalized)) {
        test.skip(`${testCase.desc} - unsupported browser type`, () => {});
        return;
      }

      test(`${testCase.desc} - detects ${expectedNormalized}`, () => {
        const result = parseUserAgent(testCase.ua);
        expect(result.browser).toBe(expectedNormalized);
      });
    });
  });

  describe("Operating System Detection", () => {
    os.forEach((testCase: TestCase) => {
      const expectedNormalized = normalizeExpected(
        testCase.expect.name,
        "Operating Systems"
      );

      if (!SUPPORTED_OS.has(expectedNormalized)) {
        test.skip(`${testCase.desc} - unsupported OS type`, () => {});
        return;
      }

      test(`${testCase.desc} - detects ${expectedNormalized}`, () => {
        const result = parseUserAgent(testCase.ua);
        expect(result.operatingSystem).toBe(expectedNormalized);
      });
    });
  });

  describe("Edge Cases", () => {
    test("handles null user agent", () => {
      const result = parseUserAgent(null);
      expect(result.browser).toBeNull();
      expect(result.operatingSystem).toBeNull();
    });

    test("handles undefined user agent", () => {
      const result = parseUserAgent(undefined);
      expect(result.browser).toBeNull();
      expect(result.operatingSystem).toBeNull();
    });

    test("handles empty string user agent", () => {
      const result = parseUserAgent("");
      expect(result.browser).toBeNull();
      expect(result.operatingSystem).toBeNull();
    });

    test("handles unknown user agent", () => {
      const result = parseUserAgent(
        "SomeRandomUserAgent/1.0 ThatDoesNotMatchAnything"
      );
      // Should return null for both if no patterns match
      expect(result.browser).toBeNull();
      expect(result.operatingSystem).toBeNull();
    });

    test("handles malformed user agent string", () => {
      const result = parseUserAgent("!@#$%^&*()");
      // Should not throw, may return null or partial matches
      expect(result).toHaveProperty("browser");
      expect(result).toHaveProperty("operatingSystem");
    });
  });
});

