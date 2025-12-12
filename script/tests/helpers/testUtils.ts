import { Window } from "happy-dom";
import type { Bid } from "../../src/types/bid.js";

/**
 * Create a mock happy-dom window and set up global browser environment
 */
export function createMockWindow(): Window {
  const happyWindow = new Window();
  (globalThis as any).window = happyWindow.window;
  (globalThis as any).document = happyWindow.document;
  (globalThis as any).navigator = happyWindow.navigator;
  (globalThis as any).sessionStorage = happyWindow.sessionStorage;
  return happyWindow;
}

/**
 * Create a mock pbjs instance for Prebid testing
 */
export function createMockPbjs(options?: {
  que?: Array<() => void>;
  onEvent?: (eventType: string, handler: (data: unknown) => void) => void;
  getEvents?: () => unknown[];
}) {
  const win = (globalThis as any).window;
  if (!win) {
    throw new Error("Window must be set up before creating mock pbjs");
  }

  const mockOnEvent =
    options?.onEvent ||
    ((eventType: string, handler: (data: unknown) => void) => {
      // Mock implementation
    });

  const mockGetEvents = options?.getEvents || (() => []);

  win.pbjs = {
    que: options?.que || [],
    onEvent: mockOnEvent,
    getEvents: mockGetEvents,
  };

  // Make pbjs available as global (matching browser behavior)
  (globalThis as any).pbjs = win.pbjs;

  return win.pbjs;
}

/**
 * Create a mock bid object for testing
 */
export function createMockBid(overrides?: Partial<Bid>): Bid {
  return {
    bidder: "ozone",
    adUnitCode: "div-gpt-ad-1",
    auctionId: "auc-123",
    requestId: "req-456",
    bidId: "bid-789",
    bidderRequestId: "br-101",
    sizes: [[300, 250], [300, 600]],
    mediaTypes: {
      banner: { sizes: [[300, 250]] },
    },
    cpm: 1.25,
    currency: "USD",
    width: 300,
    height: 250,
    ...overrides,
  };
}

/**
 * Create a mock bidRequested event data
 */
export function createMockBidRequestedEvent(overrides?: {
  bids?: Bid[];
  auctionId?: string;
  auctionStart?: number;
  timeout?: number;
}) {
  return {
    bids: [createMockBid()],
    auctionId: "auc-123",
    auctionStart: Date.now(),
    timeout: 3000,
    ...overrides,
  };
}

/**
 * Create a mock bidResponse event data
 */
export function createMockBidResponseEvent(overrides?: Partial<Bid>) {
  return createMockBid({
    cpm: 1.25,
    currency: "USD",
    timeToRespond: 120,
    requestTimestamp: Date.now() - 120,
    responseTimestamp: Date.now(),
    ...overrides,
  });
}

/**
 * Wait for async operations to complete
 * Useful for testing async functions
 */
export function waitForAsync(ms = 0): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Setup complete test environment with window, pbjs, and crypto
 */
export function setupTestEnvironment(options?: {
  userAgent?: string;
  pbjs?: {
    que?: Array<() => void>;
    onEvent?: (eventType: string, handler: (data: unknown) => void) => void;
    getEvents?: () => unknown[];
  };
}) {
  const happyWindow = createMockWindow();

  // Set up crypto
  (globalThis as any).crypto = {
    randomUUID: () => `mock-uuid-${Date.now()}-${Math.random()}`,
  };

  // Set up user agent if provided
  if (options?.userAgent) {
    (happyWindow.navigator as any).userAgent = options.userAgent;
  }

  // Set up pbjs if provided
  if (options?.pbjs) {
    createMockPbjs(options.pbjs);
  }

  return happyWindow;
}

/**
 * Clean up test environment
 */
export function cleanupTestEnvironment(): void {
  delete (globalThis as any).window;
  delete (globalThis as any).document;
  delete (globalThis as any).navigator;
  delete (globalThis as any).sessionStorage;
  delete (globalThis as any).pbjs;
  delete (globalThis as any).crypto;
}

