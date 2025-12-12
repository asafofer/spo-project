import { parseUserAgent } from "../src/uaParser.js";
import { browsers } from "../tests/data/browsers.js";
import { os } from "../tests/data/os.js";

console.log("🚀 Starting Micro Parser Tests...");

// ==========================================
// 1. Configuration & Mappings
// ==========================================
// Maps the "Expected" names from your dataset to the "Actual" names returned by the parser.
const BROWSER_MAPPINGS = {
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
  "Google Search": "gsa", // 'GSA' in your file might be 'Google Search' or 'GSA'
  GSA: "gsa",
};

const OS_MAPPINGS = {
  macOS: "mac os",
  "Mac OS": "mac os",
  iOS: "ios",
  Windows: "windows",
  Android: "android",
  "Chrome OS": "chromium os", // The parser uses 'chromium os' for CrOS
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

// ==========================================
// 2. Test Runner Logic
// ==========================================
const stats = { total: 0, passed: 0, failed: 0, skipped: 0 };

function runTests(dataset, type) {
  console.log(`\n--- Testing ${type} ---`);

  dataset.forEach((testCase) => {
    // 1. Get Expected Value
    const expectedRaw = testCase.expect.name;
    let expectedNormalized = expectedRaw;

    // Apply Mappings
    const map = type === "Browsers" ? BROWSER_MAPPINGS : OS_MAPPINGS;
    if (map[expectedRaw]) {
      expectedNormalized = map[expectedRaw];
    }
    expectedNormalized = expectedNormalized.toLowerCase();

    // 2. Check if Supported
    const supportedSet =
      type === "Browsers" ? SUPPORTED_BROWSERS : SUPPORTED_OS;
    if (!supportedSet.has(expectedNormalized)) {
      stats.skipped++;
      return;
    }

    stats.total++;

    // 3. Run Parser
    const result = parseUserAgent(testCase.ua);
    const actual =
      type === "Browsers" ? result.browser : result.operatingSystem;

    // 4. Verify
    if (actual === expectedNormalized) {
      stats.passed++;
    } else {
      stats.failed++;
      console.error(`❌ [${type.toUpperCase()} FAIL]`);
      console.error(`   UA:       ${testCase.ua}`);
      console.error(`   Expected: ${expectedNormalized} (Raw: ${expectedRaw})`);
      console.error(`   Got:      ${actual}`);
      console.error(`----------------------------------------`);
    }
  });
}

// ==========================================
// 3. Execution
// ==========================================
try {
  runTests(browsers, "Browsers");
  runTests(os, "Operating Systems");

  console.log("\n" + "=".repeat(40));
  console.log(`Test Summary`);
  console.log(`Total Run:   ${stats.total}`);
  console.log(`Passed:      ${stats.passed} ✅`);
  console.log(`Failed:      ${stats.failed} ❌`);
  console.log(`Skipped:     ${stats.skipped} (Unsupported types)`);
  console.log("=".repeat(40));
} catch (error) {
  console.error("\n💥 CRITICAL ERROR:", error.message);
}
