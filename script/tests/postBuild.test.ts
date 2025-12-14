import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { processPostBuild } from "../scripts/postBuild.ts";

describe("PostBuild Processing", () => {
  const scriptDir = join(import.meta.dir, "..", "scripts");
  const rootDir = join(scriptDir, "..");
  const testOutputPath = join(rootDir, "dist", "test-collector.prod.js");

  describe("Fail-Safe Wrapper", () => {
    test("wraps bundle with fail-safe error handler", async () => {
      const bundleContent = 'console.log("test bundle");';
      const testToken = "test-token-123";
      const testErrorsUrl = "https://api.axiom.co/v1/ingest/test-errors";

      await processPostBuild({
        outputPath: testOutputPath,
        bundleContent,
        scriptDir,
        axiomToken: testToken,
        errorsUrl: testErrorsUrl,
      });

      const output = await Bun.file(testOutputPath).text();
      // Should be wrapped in try/catch
      expect(output).toMatch(/try\s*\{/);
      expect(output).toMatch(/\}\s*catch\s*\(error\)\s*\{/);
      // Should contain the original bundle content
      expect(output).toContain(bundleContent);
      // Should contain the errors URL
      expect(output).toContain(testErrorsUrl);
    });

    test("constructs errors URL correctly for wrapper", async () => {
      const bundleContent = "test bundle";
      const testToken = "test-token-123";
      const testErrorsUrl = "https://api.axiom.co/v1/ingest/collector-errors";

      await processPostBuild({
        outputPath: testOutputPath,
        bundleContent,
        scriptDir,
        axiomToken: testToken,
        errorsUrl: testErrorsUrl,
      });

      const output = await Bun.file(testOutputPath).text();
      // The errors URL should be in the wrapper's error reporting code
      expect(output).toContain(testErrorsUrl);
    });
  });
});
