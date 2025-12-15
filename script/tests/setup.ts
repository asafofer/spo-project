// tests/setup.ts

// We must assign to 'globalThis' to make these available 
// to other files (like src/sampling.ts) at runtime.
globalThis.BUILD_EVENTS_ENDPOINT_URL = "http://localhost/test-events";
globalThis.BUILD_IP_ENDPOINT_URL     = "http://localhost/test-trace";
globalThis.BUILD_VERSION             = "0.0.0-test";
globalThis.BUILD_AXIOM_TOKEN         = "mock-token";
globalThis.BUILD_SAMPLE_RATE         = 100;

// Type assertion to satisfy TypeScript inside this file (optional but clean)
declare global {
  var BUILD_EVENTS_ENDPOINT_URL: string;
  var BUILD_IP_ENDPOINT_URL: string;
  var BUILD_VERSION: string;
  var BUILD_AXIOM_TOKEN: string;
  var BUILD_SAMPLE_RATE: number;
}