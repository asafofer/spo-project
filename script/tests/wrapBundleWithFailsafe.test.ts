import { beforeEach, describe, expect, mock, test } from "bun:test";
import { Window } from "happy-dom";
import { join } from "node:path";
import { wrapBundleWithFailsafe } from "../scripts/wrapBundle.ts";

describe("Failsafe Wrapper", () => {
  const scriptDir = join(import.meta.dir, "..", "scripts");
  const testBundleContent = 'console.log("test bundle");';
  const testAxiomUrl = "https://api.axiom.co/v1/ingest/test-errors";
  const testAxiomToken = "test-token-123";

  describe("Bundle Wrapping", () => {
    test("wraps bundle content with try/catch", async () => {
      const wrapped = await wrapBundleWithFailsafe(
        testBundleContent,
        scriptDir,
        testAxiomToken,
        testAxiomUrl
      );

      // Verify wrapper structure: starts with try, ends with catch
      const trimmed = wrapped.trim();
      expect(trimmed).toMatch(/^try\s*\{/);
      expect(trimmed).toMatch(/\}\s*catch\s*\(error\)\s*\{/);
      
      // Verify bundle content is inside the try block
      expect(wrapped).toContain(testBundleContent);
      
      // Verify structure: bundle should appear after "try {" and before "} catch"
      const tryIndex = wrapped.indexOf("try {");
      const bundleIndex = wrapped.indexOf(testBundleContent);
      const catchIndex = wrapped.indexOf("} catch (error)");
      
      expect(tryIndex).toBeLessThan(bundleIndex);
      expect(bundleIndex).toBeLessThan(catchIndex);
    });

    test("replaces __BUNDLE_CONTENT__ placeholder in template", async () => {
      const wrapped = await wrapBundleWithFailsafe(
        testBundleContent,
        scriptDir,
        testAxiomToken,
        testAxiomUrl
      );

      expect(wrapped).not.toContain("__BUNDLE_CONTENT__");
      expect(wrapped).toContain(testBundleContent);
    });

    test("replaces __AXIOM_URL__ placeholder in template", async () => {
      const wrapped = await wrapBundleWithFailsafe(
        testBundleContent,
        scriptDir,
        testAxiomToken,
        testAxiomUrl
      );

      expect(wrapped).not.toContain("__AXIOM_URL__");
      expect(wrapped).toContain(testAxiomUrl);
    });

    test("replaces __AXIOM_TOKEN__ placeholder in template", async () => {
      const wrapped = await wrapBundleWithFailsafe(
        testBundleContent,
        scriptDir,
        testAxiomToken,
        testAxiomUrl
      );

      expect(wrapped).not.toContain("__AXIOM_TOKEN__");
      expect(wrapped).toContain(testAxiomToken);
    });

    test("removes comments from template", async () => {
      const wrapped = await wrapBundleWithFailsafe(
        testBundleContent,
        scriptDir,
        testAxiomToken,
        testAxiomUrl
      );

      // Should not contain comment start markers at line start (after trimming)
      // Note: // in URLs is fine, we only check for actual comment lines
      const lines = wrapped.split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        expect(trimmed.startsWith("//")).toBe(false);
        expect(trimmed.startsWith("/*")).toBe(false);
      }
    });

    test("throws error if token is missing", async () => {
      await expect(
        wrapBundleWithFailsafe(
          testBundleContent,
          scriptDir,
          "" as any,
          testAxiomUrl
        )
      ).rejects.toThrow("AXIOM_TOKEN is required");
    });

    test("throws error if bundle content is empty", async () => {
      await expect(
        wrapBundleWithFailsafe("", scriptDir, testAxiomToken, testAxiomUrl)
      ).rejects.toThrow("Bundle content is empty");
    });

  });

  describe("Error Reporting", () => {
    beforeEach(() => {
      const win = new Window();
      win.window.location.href = "https://example.com/test";
      (globalThis as any).window = win.window;
      (globalThis as any).document = win.document;
      (globalThis as any).navigator = {
        userAgent: "test-user-agent",
      };
    });

    test("sends error to Axiom using fetch when error occurs", async () => {
      const fetchMock = mock(() =>
        Promise.resolve(new Response(null, { status: 200 }))
      );
      globalThis.fetch = fetchMock as any;

      const wrapped = await wrapBundleWithFailsafe(
        'throw new Error("Test error");',
        scriptDir,
        testAxiomToken,
        testAxiomUrl
      );

      // Verify the wrapper structure is correct
      expect(wrapped).toContain("try {");
      expect(wrapped).toContain("catch (error)");

      // Execute the wrapped code using eval to ensure proper scoping
      // The wrapper's try/catch should catch the error internally
      eval(wrapped);
      
      // Wait for async error reporting (fetch is async)
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(fetchMock).toHaveBeenCalled();
      const callArgs = fetchMock.mock.calls[0];
      expect(callArgs[0]).toBe(testAxiomUrl);
      expect(callArgs[1]).toMatchObject({
        method: "POST",
        keepalive: true,
        headers: {
          Authorization: `Bearer ${testAxiomToken}`,
          "Content-Type": "application/json",
        },
      });

      // Verify error data was sent
      const body = JSON.parse(callArgs[1].body);
      expect(body).toMatchObject({
        message: expect.stringContaining("Test error"),
        type: "runtime_error",
        userAgent: "test-user-agent",
      });
      expect(body._time).toBeDefined();
      expect(body.url).toBeDefined();
    });

    test("sends error to Axiom using XMLHttpRequest when fetch is unavailable", async () => {
      // Remove fetch
      const originalFetch = globalThis.fetch;
      delete (globalThis as any).fetch;

      const xhrOpenMock = mock();
      const xhrSetHeaderMock = mock();
      const xhrSendMock = mock();
      const xhrOnErrorMock = mock();
      const xhrOnAbortMock = mock();

      class MockXMLHttpRequest {
        open = xhrOpenMock;
        setRequestHeader = xhrSetHeaderMock;
        send = xhrSendMock;
        onerror = xhrOnErrorMock;
        onabort = xhrOnAbortMock;
      }

      (globalThis as any).XMLHttpRequest = MockXMLHttpRequest;

      const wrapped = await wrapBundleWithFailsafe(
        'throw new Error("Test error XHR");',
        scriptDir,
        testAxiomToken,
        testAxiomUrl
      );

      // Execute the wrapped code using eval to ensure proper scoping
      eval(wrapped);
      
      // Wait for error reporting (XHR is synchronous but we still wait a bit)
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(xhrOpenMock).toHaveBeenCalledWith("POST", testAxiomUrl);
      expect(xhrSetHeaderMock).toHaveBeenCalledWith(
        "Authorization",
        `Bearer ${testAxiomToken}`
      );
      expect(xhrSetHeaderMock).toHaveBeenCalledWith(
        "Content-Type",
        "application/json"
      );
      expect(xhrSendMock).toHaveBeenCalled();

      // Verify error data was sent
      const sentData = JSON.parse(xhrSendMock.mock.calls[0][0]);
      expect(sentData.message).toContain("Test error XHR");

      // Restore
      globalThis.fetch = originalFetch;
      delete (globalThis as any).XMLHttpRequest;
    });

    test("handles error when both fetch and XMLHttpRequest are unavailable", async () => {
      const originalFetch = globalThis.fetch;
      delete (globalThis as any).fetch;
      delete (globalThis as any).XMLHttpRequest;

      const wrapped = await wrapBundleWithFailsafe(
        'throw new Error("Test error no network");',
        scriptDir,
        testAxiomToken,
        testAxiomUrl
      );

      // Should not throw even if no network APIs are available
      expect(() => eval(wrapped)).not.toThrow();

      // Restore
      globalThis.fetch = originalFetch;
    });

    test("includes error stack trace in error report", async () => {
      const fetchMock = mock(() =>
        Promise.resolve(new Response(null, { status: 200 }))
      );
      globalThis.fetch = fetchMock as any;

      const wrapped = await wrapBundleWithFailsafe(
        'throw new Error("Stack test");',
        scriptDir,
        testAxiomToken,
        testAxiomUrl
      );

      eval(wrapped);
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(fetchMock).toHaveBeenCalled();
      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.stack).toBeDefined();
      expect(body.stack).toContain("Error");
    });

    test("handles non-Error objects thrown", async () => {
      const fetchMock = mock(() =>
        Promise.resolve(new Response(null, { status: 200 }))
      );
      globalThis.fetch = fetchMock as any;

      const wrapped = await wrapBundleWithFailsafe(
        'throw "String error";',
        scriptDir,
        testAxiomToken,
        testAxiomUrl
      );

      eval(wrapped);
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(fetchMock).toHaveBeenCalled();
      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.message).toBe("String error");
    });

    test("silently handles fetch errors", async () => {
      const fetchMock = mock(() => Promise.reject(new Error("Network error")));
      globalThis.fetch = fetchMock as any;

      const wrapped = await wrapBundleWithFailsafe(
        'throw new Error("Test");',
        scriptDir,
        testAxiomToken,
        testAxiomUrl
      );

      // Should not throw even if fetch fails
      eval(wrapped);

      await new Promise((resolve) => setTimeout(resolve, 200));
      expect(fetchMock).toHaveBeenCalled();
    });

    test("escapes special characters in URL and token", async () => {
      const urlWithQuotes = 'https://api.axiom.co/v1/ingest/test"errors';
      const tokenWithBackslash = "token\\with\\backslashes";

      const wrapped = await wrapBundleWithFailsafe(
        testBundleContent,
        scriptDir,
        tokenWithBackslash,
        urlWithQuotes
      );

      // Should not break JavaScript syntax
      expect(() => new Function(wrapped)).not.toThrow();
      expect(wrapped).toContain(urlWithQuotes.replace(/"/g, '\\"'));
    });
  });

  describe("Edge Cases", () => {
    test("handles very large bundle content", async () => {
      const largeBundle = "console.log('test');".repeat(10000);
      const wrapped = await wrapBundleWithFailsafe(
        largeBundle,
        scriptDir,
        testAxiomToken,
        testAxiomUrl
      );

      expect(wrapped).toContain(largeBundle);
      expect(wrapped).toContain("try {");
    });

    test("handles bundle with newlines and special characters", async () => {
      const bundleWithSpecialChars = 'console.log("test\\nwith\\tchars");\nconst x = "quotes\'here";';
      const wrapped = await wrapBundleWithFailsafe(
        bundleWithSpecialChars,
        scriptDir,
        testAxiomToken,
        testAxiomUrl
      );

      expect(wrapped).toContain(bundleWithSpecialChars);
    });
  });
});
