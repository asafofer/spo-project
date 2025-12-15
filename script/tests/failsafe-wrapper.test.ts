import { beforeEach, describe, expect, mock, test } from "bun:test";
import { Window } from "happy-dom";
// @ts-ignore
import { wrapAndBuild } from "../scripts/build.ts";

describe("Failsafe Wrapper", () => {
  const testAxiomUrl = "https://api.axiom.co/v1/ingest/test-errors";
  const testAxiomToken = "test-token-123";

  beforeEach(() => {
    // Setup global browser environment
    const win = new Window();
    win.window.location.href = "https://example.com/test";
    (globalThis as any).window = win.window;
    (globalThis as any).document = win.document;
    (globalThis as any).navigator = {
      userAgent: "test-user-agent",
    };
  });

  test("catches runtime error and reports to Axiom via fetch", async () => {
    // Mock fetch
    const fetchMock = mock(() => Promise.resolve(new Response(null, { status: 200 })));
    globalThis.fetch = fetchMock as any;

    const errorMsg = "Boom! Runtime Error";
    const bundleContent = `throw new Error("${errorMsg}");`;
    
    // Use the exported function from build.ts
    // We set minify=false for easier debugging if something goes wrong, though test works with minified too
    const buildResult = await wrapAndBuild(
        bundleContent,
        testAxiomUrl,
        testAxiomToken,
        false,
        "test-wrapper.js" // Custom output name to avoid overwriting prod build
    );
    
    const wrappedCode = await buildResult.outputs[0].text();

    // Cleanup generated test file
    await Bun.file("dist/test-wrapper.js").delete();

    // Execute
    eval(wrappedCode);

    // Fetch is async, allow event loop to tick
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(fetchMock).toHaveBeenCalled();
    const [url, options] = fetchMock.mock.calls[0];
    
    expect(url).toBe(testAxiomUrl);
    expect(options.method).toBe("POST");
    expect(options.headers["Authorization"]).toBe(`Bearer ${testAxiomToken}`);
    
    const body = JSON.parse(options.body as string);
    expect(body.message).toBe(errorMsg);
    expect(body.type).toBe("runtime_error");
    expect(body.url).toBe("https://example.com/test");
  });

  test("reports error using XMLHttpRequest if fetch is undefined", async () => {
    // Remove fetch
    const originalFetch = globalThis.fetch;
    delete (globalThis as any).fetch;

    // Mock XHR
    const xhrOpen = mock();
    const xhrSend = mock();
    const xhrSetHeader = mock();
    
    class MockXHR {
      open = xhrOpen;
      send = xhrSend;
      setRequestHeader = xhrSetHeader;
      onerror = () => {};
      onabort = () => {};
    }
    (globalThis as any).XMLHttpRequest = MockXHR;

    const errorMsg = "XHR Error";
    const bundleContent = `throw new Error("${errorMsg}");`;
    
    const buildResult = await wrapAndBuild(
        bundleContent,
        testAxiomUrl,
        testAxiomToken,
        false,
        "test-wrapper-xhr.js"
    );
    const wrappedCode = await buildResult.outputs[0].text();
    await Bun.file("dist/test-wrapper-xhr.js").delete();

    eval(wrappedCode);
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(xhrOpen).toHaveBeenCalledWith("POST", testAxiomUrl);
    expect(xhrSetHeader).toHaveBeenCalledWith("Authorization", `Bearer ${testAxiomToken}`);
    expect(xhrSend).toHaveBeenCalled();
    
    const body = JSON.parse(xhrSend.mock.calls[0][0]);
    expect(body.message).toBe(errorMsg);

    // Cleanup
    globalThis.fetch = originalFetch;
    delete (globalThis as any).XMLHttpRequest;
  });

  test("includes stack trace in error report", async () => {
    const fetchMock = mock(() => Promise.resolve(new Response(null, { status: 200 })));
    globalThis.fetch = fetchMock as any;

    const bundleContent = `
      function faulty() { throw new Error("Stack Test"); }
      faulty();
    `;
    
    const buildResult = await wrapAndBuild(
        bundleContent,
        testAxiomUrl,
        testAxiomToken,
        false,
        "test-wrapper-stack.js"
    );
    const wrappedCode = await buildResult.outputs[0].text();
    await Bun.file("dist/test-wrapper-stack.js").delete();

    eval(wrappedCode);
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(fetchMock).toHaveBeenCalled();
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.message).toBe("Stack Test");
    expect(body.stack).toBeDefined();
    expect(body.stack).toContain("faulty");
  });
});
