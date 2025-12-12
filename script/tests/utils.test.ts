import { beforeEach, describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { getSessionId } from "../src/utils.js";

describe("Utils Module", () => {
  let happyWindow: Window;

  beforeEach(() => {
    // Fresh environment for every test
    happyWindow = new Window();
    (globalThis as any).sessionStorage = happyWindow.sessionStorage;
    (globalThis as any).crypto = { randomUUID: () => "mock-uuid-1234" };
  });

  test("getSessionId generates new ID if missing", () => {
    const id = getSessionId();

    expect(id).toBe("mock-uuid-1234");

    // Verify persistence
    expect(sessionStorage.getItem("__sid__")).toBe("mock-uuid-1234");
  });

  test("getSessionId returns existing ID if present", () => {
    sessionStorage.setItem("__sid__", "existing-id-999");

    const id = getSessionId();

    expect(id).toBe("existing-id-999");
  });
});
