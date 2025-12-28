import { axiom } from "../src/axiom";
import { writeFile } from "fs/promises";
import { join } from "path";
import { mkdir } from "fs/promises";

/**
 * Fetch aggregated session data with per-auction latency metrics
 *
 * This script aggregates data in two steps:
 * 1. First by sessionId + auctionId to get average latency per auction
 * 2. Then by sessionId to get statistics on per-auction latencies
 *
 * Output fields per session:
 * - auctions_per_session: Count of unique auctions
 * - avg_latency_per_auction: Average of per-auction average latencies
 * - median_latency_per_auction: Median of per-auction average latencies
 * - p75_latency_per_auction, p90_latency_per_auction, etc.
 * - session_length_ms: Duration of session
 * - domain: Domain name
 */
async function fetchAuctionLatencySessions(options: {
  limit?: number;
  outputFile?: string;
}) {
  const datasetName = process.env.AXIOM_DATASET || "prebid-events";
  const limit = options.limit || 10000;

  // Step 1: Aggregate by sessionId + auctionId to get average latency per auction
  // Step 2: Aggregate by sessionId to get statistics on per-auction latencies
  // We'll use a subquery approach or do it in two queries

  // For Axiom, we can use a summarize within summarize pattern
  // First, we need to get per-auction latencies, then aggregate those

  const query = `['${datasetName}']
    | where isnotempty(sessionId) and isnotempty(auctionId) and isnotempty(_time) and isnotempty(domain)
    | extend 
        isTimeout = eventType == "bidTimeout",
        isWon = eventType == "bidWon",
        hasLatency = isnotempty(timeToRespond) and timeToRespond > 0
    | summarize 
        avg_latency_per_auction = avgif(timeToRespond, hasLatency),
        median_latency_per_auction = percentile(timeToRespond, 50),
        p75_latency_per_auction = percentile(timeToRespond, 75),
        p90_latency_per_auction = percentile(timeToRespond, 90),
        p95_latency_per_auction = percentile(timeToRespond, 95),
        p99_latency_per_auction = percentile(timeToRespond, 99),
        firstEvent = min(_time),
        lastEvent = max(_time)
      by sessionId, auctionId, domain
    | summarize 
        auctions_per_session = count(),
        avg_latency_per_auction = avg(avg_latency_per_auction),
        median_latency_per_auction = percentile(median_latency_per_auction, 50),
        p75_latency_per_auction = percentile(p75_latency_per_auction, 75),
        p90_latency_per_auction = percentile(p90_latency_per_auction, 90),
        p95_latency_per_auction = percentile(p95_latency_per_auction, 95),
        p99_latency_per_auction = percentile(p99_latency_per_auction, 99),
        session_firstEvent = min(firstEvent),
        session_lastEvent = max(lastEvent)
      by sessionId, domain
    | extend 
        session_length_ms = datetime_diff('millisecond', todatetime(session_lastEvent), todatetime(session_firstEvent))
    | project-away session_firstEvent, session_lastEvent
    | limit ${limit}`;

  console.log(
    "Fetching aggregated session data with per-auction latency metrics..."
  );
  console.log(`Query limit: ${limit} sessions`);

  const result = await axiom.query(query, {
    startTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
    endTime: new Date(),
  });

  let results = (result as any).buckets?.totals || [];
  console.log(
    `Fetched ${results.length} aggregated session records from buckets.totals`
  );

  // Debug: log first result structure
  if (results.length > 0) {
    console.log("\nFirst result structure (debug):");
    console.log(JSON.stringify(results[0], null, 2).substring(0, 1000));
    console.log("\nFirst result keys:", Object.keys(results[0]));
  }

  // If no results in buckets.totals but we have matches, the query might have been treated as non-aggregated
  if (results.length === 0) {
    const matches = (result as any).matches || [];
    console.log(
      `Warning: Query returned ${matches.length} raw matches instead of aggregated results.`
    );
    console.log(`This suggests the aggregation might not have been applied.`);
    console.log(`Result format: ${(result as any).format || "unknown"}`);
  }

  // Transform Axiom result format to simple array of objects
  const sessionData = results.map((row: any) => {
    const group = row.group || {};
    const aggregations = row.aggregations || [];

    // Find each aggregation by its "op" field
    const getAggValue = (opName: string) => {
      const agg = aggregations.find((a: any) => a.op === opName);
      return agg?.value ?? null;
    };

    // Get session length from extend clause
    let session_length_ms = 0;
    const sessionLengthAgg = getAggValue("session_length_ms");
    if (sessionLengthAgg !== null && sessionLengthAgg !== undefined) {
      session_length_ms = sessionLengthAgg;
    }

    // Get all latency metrics
    const avgLatencyPerAuction = getAggValue("avg_latency_per_auction") || 0;
    const medianLatencyPerAuction =
      getAggValue("median_latency_per_auction") || 0;
    const p75LatencyPerAuction = getAggValue("p75_latency_per_auction") || 0;
    const p90LatencyPerAuction = getAggValue("p90_latency_per_auction") || 0;
    const p95LatencyPerAuction = getAggValue("p95_latency_per_auction") || 0;
    const p99LatencyPerAuction = getAggValue("p99_latency_per_auction") || 0;

    return {
      sessionId: group.sessionId || null,
      domain: group.domain || null,
      auctions_per_session: getAggValue("auctions_per_session") || 0,
      session_length_ms: session_length_ms,
      avg_latency_per_auction: avgLatencyPerAuction,
      median_latency_per_auction: medianLatencyPerAuction,
      p75_latency_per_auction: p75LatencyPerAuction,
      p90_latency_per_auction: p90LatencyPerAuction,
      p95_latency_per_auction: p95LatencyPerAuction,
      p99_latency_per_auction: p99LatencyPerAuction,
    };
  });

  // Print first 5 records for debugging
  console.log("\nFirst 5 session records (for debugging):");
  console.log("---");
  sessionData.slice(0, 5).forEach((session, idx) => {
    console.log(`\nSession ${idx + 1}:`);
    console.log(`  sessionId: ${session.sessionId}`);
    console.log(`  domain: ${session.domain}`);
    console.log(`  auctions_per_session: ${session.auctions_per_session}`);
    console.log(`  session_length_ms: ${session.session_length_ms}`);
    console.log(
      `  session_length_sec: ${(session.session_length_ms / 1000).toFixed(2)}`
    );
    console.log(
      `  session_length_min: ${(session.session_length_ms / 60000).toFixed(2)}`
    );
    console.log(
      `  avg_latency_per_auction: ${
        session.avg_latency_per_auction?.toFixed(2) || 0
      } ms`
    );
    console.log(
      `  median_latency_per_auction: ${
        session.median_latency_per_auction?.toFixed(2) || 0
      } ms`
    );
    console.log(
      `  p95_latency_per_auction: ${
        session.p95_latency_per_auction?.toFixed(2) || 0
      } ms`
    );
  });
  console.log("---\n");

  // Determine output file path
  const defaultFileName = "axiom-auction-latency-sessions.json";
  const outputPath = options.outputFile
    ? join(process.cwd(), options.outputFile)
    : join(process.cwd(), "data", defaultFileName);

  // Ensure directory exists
  const outputDir = join(outputPath, "..");
  await mkdir(outputDir, { recursive: true });

  // Save to file
  const outputData = {
    data: sessionData,
    metadata: {
      totalSessions: sessionData.length,
      fetchedAt: new Date().toISOString(),
      queryLimit: limit,
    },
  };

  await writeFile(outputPath, JSON.stringify(outputData, null, 2));

  const fileSizeKB = (await import("fs")).statSync(outputPath).size / 1024;
  console.log(`Data saved to: ${outputPath}`);
  console.log(`Total sessions: ${sessionData.length}`);
  console.log(`File size: ${fileSizeKB.toFixed(2)} KB`);
}

// Parse command line arguments
const args = process.argv.slice(2);
const options: { limit?: number; outputFile?: string } = {};

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--limit" && args[i + 1]) {
    options.limit = parseInt(args[i + 1], 10);
    i++;
  } else if (args[i] === "--output" && args[i + 1]) {
    options.outputFile = args[i + 1];
    i++;
  }
}

// Run the fetch
fetchAuctionLatencySessions(options).catch((error) => {
  console.error("Error fetching data:", error);
  process.exit(1);
});
