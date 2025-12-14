import { afterAll, describe, expect, test } from "bun:test";
import { unlink } from "node:fs/promises";
import { join } from "node:path";
import { processPostBuild } from "../scripts/postBuild.ts";

describe("PostBuild Processing", () => {
  const scriptDir = join(import.meta.dir, "..", "scripts");
  const rootDir = join(scriptDir, "..");
  const testOutputPath = join(rootDir, "dist", "test-postbuild-output.js");

  afterAll(async () => {
    try {
      await unlink(testOutputPath);
    } catch {
      // Ignore if file doesn't exist
    }
  });

  test("processes bundle: wraps content and writes to output file", async () => {
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

    // Verify the file was written to disk
    const outputFile = Bun.file(testOutputPath);
    expect(await outputFile.exists()).toBe(true);

    const outputContent = await outputFile.text();

    // Verify content integration
    // Note: Detailed wrapper structure (try/catch, etc.) is tested in wrapBundleWithFailsafe.test.ts
    // Here we just ensure the transformation happened and parameters were passed
    expect(outputContent).toContain(bundleContent);
    expect(outputContent).toContain(testErrorsUrl);
    
    // Simple check that it grew in size (indicating wrapping occurred)
    expect(outputContent.length).toBeGreaterThan(bundleContent.length);
  });
});
