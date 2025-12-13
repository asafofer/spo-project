// Sample rate (0-100) - will be replaced at build time, default 100%
// At build time, "__SAMPLE_RATE__" is replaced with a number literal
const SAMPLE_RATE = "__SAMPLE_RATE__";

const samplingDecisionKey = "__sampling__"; // Session storage key for sampling decision
let cachedSamplingDecision: boolean | undefined; // Cached decision for when sessionStorage is unavailable

/**
 * Parse the sample rate from the build-time constant
 * Handles both number (after build) and string (before build or if replacement failed)
 * @param overrideRate - Optional rate to use for testing (overrides SAMPLE_RATE constant)
 */
export function getSampleRate(overrideRate?: number): number {
  if (overrideRate !== undefined) {
    return overrideRate;
  }

  if (typeof SAMPLE_RATE === "number") {
    return SAMPLE_RATE;
  }
  if (
    typeof SAMPLE_RATE === "string" &&
    SAMPLE_RATE !== "__SAMPLE_RATE__"
  ) {
    const parsed = parseInt(SAMPLE_RATE, 10);
    return isNaN(parsed) ? 100 : parsed;
  }
  // Default to 100% if not replaced at build time
  return 100;
}

/**
 * Get or generate sampling decision from sessionStorage
 * Similar pattern to getSessionId - stores decision in sessionStorage for consistency
 * @param overrideRate - Optional rate to use for testing (overrides SAMPLE_RATE constant)
 */
export function getSamplingDecision(overrideRate?: number): boolean {
  const rate = getSampleRate(overrideRate);

  // If sample rate is 100%, always sample
  if (rate >= 100) return true;
  // If sample rate is 0%, never sample
  if (rate <= 0) return false;

  // Check if we're in a browser environment
  if (typeof sessionStorage === "undefined") {
    // Return cached decision or generate a new one for this process
    if (cachedSamplingDecision === undefined) {
      // Generate random decision based on sample rate
      cachedSamplingDecision = Math.random() * 100 < rate;
    }
    return cachedSamplingDecision;
  }

  try {
    const stored = sessionStorage.getItem(samplingDecisionKey);
    if (stored !== null) {
      // Return stored decision (true/false as string)
      return stored === "true";
    }

    // Generate new decision based on sample rate
    const decision = Math.random() * 100 < rate;
    sessionStorage.setItem(samplingDecisionKey, decision.toString());
    return decision;
  } catch (_error) {
    // sessionStorage throws in private browsing mode or when disabled
    // Cache the decision in memory so all checks in this page load share the same decision
    if (cachedSamplingDecision === undefined) {
      cachedSamplingDecision = Math.random() * 100 < rate;
    }
    return cachedSamplingDecision;
  }
}

