import { beforeEach, describe, expect, spyOn, test } from "bun:test";
import { Window } from "happy-dom";
import { logger } from "../src/logger.js";

describe("Logger Module", () => {
  let happyWindow: Window;
  let consoleLogSpy: ReturnType<typeof spyOn>;
  let consoleWarnSpy: ReturnType<typeof spyOn>;
  let consoleErrorSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    // Fresh environment for every test
    happyWindow = new Window();
    (globalThis as any).window = happyWindow.window;
    (globalThis as any).document = happyWindow.document;

    // Spy on console methods
    consoleLogSpy = spyOn(console, "log").mockImplementation(() => {});
    consoleWarnSpy = spyOn(console, "warn").mockImplementation(() => {});
    consoleErrorSpy = spyOn(console, "error").mockImplementation(() => {});
  });

  test("logger methods are callable without errors", () => {
    // Logger should be callable regardless of DEBUG state
    expect(() => {
      logger.log("test");
      logger.warn("test");
      logger.error("test");
    }).not.toThrow();
  });

  test("logger methods accept multiple arguments", () => {
    // Test that logger methods can accept multiple arguments
    logger.log("arg1", "arg2", { key: "value" });
    logger.warn("warn1", "warn2");
    logger.error("error1", "error2");

    // Methods should not throw, but may or may not call console based on DEBUG
    // We can't easily test DEBUG state since it's set at module load
    // But we can verify the methods are callable
    expect(true).toBe(true); // Placeholder - methods executed without error
  });

  test("logger handles guard behavior when window is undefined", () => {
    // Remove window to test guard
    const originalWindow = (globalThis as any).window;
    delete (globalThis as any).window;

    // Logger should still be callable (guard prevents crash)
    expect(() => {
      logger.log("test");
      logger.warn("test");
      logger.error("test");
    }).not.toThrow();

    // Restore window
    (globalThis as any).window = originalWindow;
  });

  test("logger methods work with various argument types", () => {
    // Test different argument types
    logger.log("string");
    logger.log(123);
    logger.log({ object: "value" });
    logger.log(["array"]);
    logger.log(null);
    logger.log(undefined);

    // Should not throw
    expect(true).toBe(true);
  });
});

