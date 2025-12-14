import { beforeEach, describe, expect, test } from "bun:test";
import { join } from "node:path";
import { processPostBuild } from "../scripts/postBuild.ts";

describe("PostBuild Processing", () => {
  const scriptDir = join(import.meta.dir, "..", "scripts");
  const rootDir = join(scriptDir, "..");
  const testOutputPath = join(rootDir, "dist", "test-collector.prod.js");

  beforeEach(() => {
    // Set up required environment variables
    process.env.AXIOM_TOKEN = "test-token-123";
    process.env.AXIOM_URL = "https://api.axiom.co/v1/ingest";
    process.env.AXIOM_DATASET_ERRORS = "test-errors";
    process.env.AXIOM_DATASET_EVENTS = "test-events";
    process.env.CLOUDFLARE_TRACE_URL = "https://cloudflare.com/cdn-cgi/trace";
  });

  describe("Placeholder Replacement", () => {
    test("replaces __VERSION__ placeholder", async () => {
      const bundleContent = 'const VERSION = "__VERSION__";';
      const version = "1.0.12";

      await processPostBuild({
        outputPath: testOutputPath,
        bundleContent,
        version,
        sampleRate: 100,
        scriptDir,
      });

      const output = await Bun.file(testOutputPath).text();
      expect(output).not.toContain("__VERSION__");
      expect(output).toContain(`const VERSION = "${version}";`);
    });

    test("replaces __SAMPLE_RATE__ placeholder", async () => {
      const bundleContent = 'const SAMPLE_RATE = "__SAMPLE_RATE__";';
      const sampleRate = 50;

      await processPostBuild({
        outputPath: testOutputPath,
        bundleContent,
        version: "1.0.0",
        sampleRate,
        scriptDir,
      });

      const output = await Bun.file(testOutputPath).text();
      expect(output).not.toContain('"__SAMPLE_RATE__"');
      expect(output).toContain(`const SAMPLE_RATE = ${sampleRate};`);
    });

    test("replaces __AXIOM_EVENTS_URL__ placeholder", async () => {
      const bundleContent = 'const EVENTS_ENDPOINT_URL = "__AXIOM_EVENTS_URL__";';
      const expectedUrl = "https://api.axiom.co/v1/ingest/test-events";

      await processPostBuild({
        outputPath: testOutputPath,
        bundleContent,
        version: "1.0.0",
        sampleRate: 100,
        scriptDir,
      });

      const output = await Bun.file(testOutputPath).text();
      expect(output).not.toContain("__AXIOM_EVENTS_URL__");
      expect(output).toContain(JSON.stringify(expectedUrl));
    });

    test("replaces __CLOUDFLARE_TRACE_URL__ placeholder", async () => {
      const bundleContent = 'const IP_ENDPOINT_URL = "__CLOUDFLARE_TRACE_URL__";';
      const expectedUrl = "https://cloudflare.com/cdn-cgi/trace";

      await processPostBuild({
        outputPath: testOutputPath,
        bundleContent,
        version: "1.0.0",
        sampleRate: 100,
        scriptDir,
      });

      const output = await Bun.file(testOutputPath).text();
      expect(output).not.toContain("__CLOUDFLARE_TRACE_URL__");
      expect(output).toContain(JSON.stringify(expectedUrl));
    });

    test("replaces all placeholders in correct order", async () => {
      const bundleContent = `
        const VERSION = "__VERSION__";
        const SAMPLE_RATE = "__SAMPLE_RATE__";
        const EVENTS_ENDPOINT_URL = "__AXIOM_EVENTS_URL__";
        const IP_ENDPOINT_URL = "__CLOUDFLARE_TRACE_URL__";
      `;

      await processPostBuild({
        outputPath: testOutputPath,
        bundleContent,
        version: "1.0.12",
        sampleRate: 75,
        scriptDir,
      });

      const output = await Bun.file(testOutputPath).text();
      expect(output).not.toContain("__VERSION__");
      expect(output).not.toContain("__SAMPLE_RATE__");
      expect(output).not.toContain("__AXIOM_EVENTS_URL__");
      expect(output).not.toContain("__CLOUDFLARE_TRACE_URL__");
      expect(output).toContain('const VERSION = "1.0.12";');
      expect(output).toContain("const SAMPLE_RATE = 75;");
    });
  });

  describe("Environment Variable Validation", () => {
    test("throws error if AXIOM_TOKEN is missing", async () => {
      delete process.env.AXIOM_TOKEN;

      await expect(
        processPostBuild({
          outputPath: testOutputPath,
          bundleContent: "test",
          version: "1.0.0",
          sampleRate: 100,
          scriptDir,
        })
      ).rejects.toThrow("AXIOM_TOKEN is required");
    });

    test("throws error if AXIOM_URL is missing", async () => {
      process.env.AXIOM_TOKEN = "test-token";
      delete process.env.AXIOM_URL;

      await expect(
        processPostBuild({
          outputPath: testOutputPath,
          bundleContent: "test",
          version: "1.0.0",
          sampleRate: 100,
          scriptDir,
        })
      ).rejects.toThrow("AXIOM_URL is required");
    });

    test("throws error if AXIOM_DATASET_ERRORS is missing", async () => {
      process.env.AXIOM_TOKEN = "test-token";
      process.env.AXIOM_URL = "https://api.axiom.co/v1/ingest";
      delete process.env.AXIOM_DATASET_ERRORS;

      await expect(
        processPostBuild({
          outputPath: testOutputPath,
          bundleContent: "test",
          version: "1.0.0",
          sampleRate: 100,
          scriptDir,
        })
      ).rejects.toThrow("AXIOM_DATASET_ERRORS is required");
    });

    test("throws error if AXIOM_DATASET_EVENTS is missing", async () => {
      process.env.AXIOM_TOKEN = "test-token";
      process.env.AXIOM_URL = "https://api.axiom.co/v1/ingest";
      process.env.AXIOM_DATASET_ERRORS = "test-errors";
      delete process.env.AXIOM_DATASET_EVENTS;

      await expect(
        processPostBuild({
          outputPath: testOutputPath,
          bundleContent: "test",
          version: "1.0.0",
          sampleRate: 100,
          scriptDir,
        })
      ).rejects.toThrow("AXIOM_DATASET_EVENTS is required");
    });

    test("throws error if CLOUDFLARE_TRACE_URL is missing", async () => {
      process.env.AXIOM_TOKEN = "test-token";
      process.env.AXIOM_URL = "https://api.axiom.co/v1/ingest";
      process.env.AXIOM_DATASET_ERRORS = "test-errors";
      process.env.AXIOM_DATASET_EVENTS = "test-events";
      delete process.env.CLOUDFLARE_TRACE_URL;

      await expect(
        processPostBuild({
          outputPath: testOutputPath,
          bundleContent: "test",
          version: "1.0.0",
          sampleRate: 100,
          scriptDir,
        })
      ).rejects.toThrow("CLOUDFLARE_TRACE_URL is required");
    });
  });

  describe("URL Construction", () => {
    test("constructs events URL correctly", async () => {
      process.env.AXIOM_URL = "https://api.axiom.co/v1/ingest";
      process.env.AXIOM_DATASET_EVENTS = "prebid-events";
      const bundleContent = 'const EVENTS_ENDPOINT_URL = "__AXIOM_EVENTS_URL__";';

      await processPostBuild({
        outputPath: testOutputPath,
        bundleContent,
        version: "1.0.0",
        sampleRate: 100,
        scriptDir,
      });

      const output = await Bun.file(testOutputPath).text();
      const expectedUrl = "https://api.axiom.co/v1/ingest/prebid-events";
      expect(output).toContain(JSON.stringify(expectedUrl));
    });

    test("constructs errors URL correctly for wrapper", async () => {
      process.env.AXIOM_URL = "https://api.axiom.co/v1/ingest";
      process.env.AXIOM_DATASET_ERRORS = "collector-errors";
      const bundleContent = "test bundle";

      await processPostBuild({
        outputPath: testOutputPath,
        bundleContent,
        version: "1.0.0",
        sampleRate: 100,
        scriptDir,
      });

      const output = await Bun.file(testOutputPath).text();
      const expectedUrl = "https://api.axiom.co/v1/ingest/collector-errors";
      // The errors URL should be in the wrapper's error reporting code
      expect(output).toContain(expectedUrl);
    });
  });
});
