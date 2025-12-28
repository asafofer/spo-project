import { axiom } from "../src/axiom";
import { writeFile } from "fs/promises";
import { join } from "path";

interface FetchOptions {
  datasetName?: string;
  startTime?: Date;
  endTime?: Date;
  outputFile?: string;
  limit?: number;
}

async function fetchAggregatedSessions(options: FetchOptions = {}) {
  const {
    datasetName = process.env.AXIOM_DATASET || "prebid-events",
    startTime,
    endTime = new Date(),
    outputFile,
  } = options;

  console.log(
    `Fetching aggregated session metrics from Axiom dataset: ${datasetName}`
  );
  console.log("---");

  /**
   * Aggregated query to get session-level metrics:
   * - timeouts_per_session: Count of bidTimeout events
   * - auctions_per_session: Count of distinct auctionId values
   * - revenue_per_session: Sum of CPM from bidWon events / 1000
   * - session_length_ms: Duration of session (max - min eventTimestamp) in milliseconds
   */
  const limit = options.limit || 10000; // Default limit for aggregated queries

  // Try without order by and limit at the end - Axiom might treat that as non-aggregated
  // Calculate session length using datetime_diff on _time (ISO timestamp strings)
  const query = `['${datasetName}']
    | where isnotempty(sessionId) and isnotempty(_time) and isnotempty(domain)
    | extend 
        isTimeout = eventType == "bidTimeout",
        isWon = eventType == "bidWon",
        hasLatency = isnotempty(timeToRespond) and timeToRespond > 0
    | summarize 
        timeouts_per_session = countif(isTimeout),
        auctions_per_session = dcount(auctionId),
        revenue_per_session = sumif(cpm, isWon) / 1000.0,
        firstEvent = min(_time),
        lastEvent = max(_time),
        totalLatency = sumif(timeToRespond, hasLatency),
        latencyCount = countif(hasLatency),
        median_latency_ms = percentile(timeToRespond, 50),
        p50_latency_ms = percentile(timeToRespond, 50),
        p75_latency_ms = percentile(timeToRespond, 75),
        p90_latency_ms = percentile(timeToRespond, 90),
        p95_latency_ms = percentile(timeToRespond, 95),
        p99_latency_ms = percentile(timeToRespond, 99)
      by sessionId, domain
    | extend 
        session_length_ms = datetime_diff('millisecond', todatetime(lastEvent), todatetime(firstEvent)),
        avg_latency_ms = iff(latencyCount > 0, totalLatency / latencyCount, 0.0)
    | limit ${limit}`;

  console.log(`Query: ${query}`);
  console.log("---");

  // Execute the query - try without time constraints first to see if data exists
  const queryOptions: any = {};
  // Only add time constraints if explicitly provided
  // if (startTime) {
  //   queryOptions.startTime = startTime;
  // }
  // if (endTime) {
  //   queryOptions.endTime = endTime;
  // }

  const result = await axiom.query(query, queryOptions);

  // Debug: log result structure
  console.log("Result structure:", Object.keys(result));
  if ((result as any).buckets) {
    console.log("Buckets structure:", Object.keys((result as any).buckets));
  }

  // Aggregated queries return results in buckets.totals
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
  // This can happen if the query structure isn't recognized as an aggregation
  if (results.length === 0) {
    const matches = (result as any).matches || [];
    console.log(
      `Warning: Query returned ${matches.length} raw matches instead of aggregated results.`
    );
    console.log(`This suggests the aggregation might not have been applied.`);
    console.log(`Result format: ${(result as any).format || "unknown"}`);
  }

  // Transform Axiom result format to simple array of objects
  // Use the "op" field to identify each aggregation correctly
  const sessionData = results.map((row: any) => {
    const group = row.group || {};
    const aggregations = row.aggregations || [];

    // Find each aggregation by its "op" field
    const getAggValue = (opName: string) => {
      const agg = aggregations.find((a: any) => a.op === opName);
      return agg?.value ?? null;
    };

    const firstEvent = getAggValue("firstEvent");
    const lastEvent = getAggValue("lastEvent");

    // Calculate session_length_ms if we have both timestamps
    // The timestamps appear to be in nanoseconds, convert to milliseconds
    let session_length_ms = 0;
    if (
      firstEvent &&
      lastEvent &&
      typeof firstEvent === "number" &&
      typeof lastEvent === "number"
    ) {
      // Convert from nanoseconds to milliseconds
      session_length_ms = (lastEvent - firstEvent) / 1000000;
    }

    // Get avg_latency_ms from aggregations (calculated in extend clause)
    // Fallback to calculating from totalLatency/latencyCount if needed
    let avgLatency = getAggValue("avg_latency_ms");
    if (avgLatency === null || avgLatency === undefined) {
      const totalLatency = getAggValue("totalLatency");
      const latencyCount = getAggValue("latencyCount");
      if (totalLatency && latencyCount && latencyCount > 0) {
        avgLatency = totalLatency / latencyCount;
      } else {
        avgLatency = 0;
      }
    }

    // Get percentile-based latency metrics
    const medianLatency =
      getAggValue("median_latency_ms") || getAggValue("p50_latency_ms") || 0;
    const p50Latency = getAggValue("p50_latency_ms") || medianLatency || 0;
    const p75Latency = getAggValue("p75_latency_ms") || 0;
    const p90Latency = getAggValue("p90_latency_ms") || 0;
    const p95Latency = getAggValue("p95_latency_ms") || 0;
    const p99Latency = getAggValue("p99_latency_ms") || 0;

    return {
      sessionId: group.sessionId || null,
      domain: group.domain || null,
      timeouts_per_session: getAggValue("timeouts_per_session") || 0,
      auctions_per_session: getAggValue("auctions_per_session") || 0,
      revenue_per_session: getAggValue("revenue_per_session") || 0,
      session_length_ms: session_length_ms,
      avg_latency_ms: avgLatency,
      median_latency_ms: medianLatency,
      p50_latency_ms: p50Latency,
      p75_latency_ms: p75Latency,
      p90_latency_ms: p90Latency,
      p95_latency_ms: p95Latency,
      p99_latency_ms: p99Latency,
    };
  });

  // Print first 5 records for debugging
  console.log("\nFirst 5 session records (for debugging):");
  console.log("---");
  sessionData.slice(0, 5).forEach((session: any, idx: number) => {
    console.log(`\nSession ${idx + 1}:`);
    console.log(`  sessionId: ${session.sessionId}`);
    console.log(`  domain: ${session.domain}`);
    console.log(`  timeouts_per_session: ${session.timeouts_per_session}`);
    console.log(`  auctions_per_session: ${session.auctions_per_session}`);
    console.log(`  revenue_per_session: ${session.revenue_per_session}`);
    console.log(`  session_length_ms: ${session.session_length_ms}`);
    console.log(
      `  session_length_sec: ${(session.session_length_ms / 1000).toFixed(2)}`
    );
    console.log(
      `  session_length_min: ${(session.session_length_ms / 1000 / 60).toFixed(
        2
      )}`
    );
  });
  console.log("---\n");

  // Prepare output data
  const outputData = {
    metadata: {
      fetchedAt: new Date().toISOString(),
      datasetName,
      totalSessions: sessionData.length,
      startTime: startTime?.toISOString() || null,
      endTime: endTime?.toISOString(),
    },
    data: sessionData,
  };

  // Determine output file path
  const defaultFileName = "axiom-sessions-aggregated.json";
  const outputPath = outputFile
    ? join(process.cwd(), outputFile)
    : join(process.cwd(), "data", defaultFileName);

  // Save to JSON file
  await writeFile(outputPath, JSON.stringify(outputData, null, 2), "utf-8");

  console.log(`\nData saved to: ${outputPath}`);
  console.log(`Total sessions: ${sessionData.length}`);
  console.log(
    `File size: ${(JSON.stringify(outputData).length / 1024).toFixed(2)} KB`
  );

  return {
    outputPath,
    sessionCount: sessionData.length,
  };
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);

  // Parse command line arguments
  let datasetName = process.env.AXIOM_DATASET || "prebid-events";
  let outputFile: string | undefined;
  let startTime: Date | undefined;
  let endTime: Date | undefined;
  let limit: number | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case "--limit":
      case "-l":
        limit = parseInt(args[++i], 10);
        if (isNaN(limit) || limit < 1) {
          console.error("Error: --limit must be a positive number");
          process.exit(1);
        }
        break;
      case "--dataset":
      case "-d":
        datasetName = args[++i];
        break;
      case "--output":
      case "-o":
        outputFile = args[++i];
        break;
      case "--start-time":
        startTime = new Date(args[++i]);
        if (isNaN(startTime.getTime())) {
          console.error("Error: --start-time must be a valid ISO date string");
          process.exit(1);
        }
        break;
      case "--end-time":
        endTime = new Date(args[++i]);
        if (isNaN(endTime.getTime())) {
          console.error("Error: --end-time must be a valid ISO date string");
          process.exit(1);
        }
        break;
      case "--help":
      case "-h":
        console.log(`
Usage: bun run ml-pipeline/fetch-aggregated-sessions.ts [options]

Fetches pre-aggregated session-level metrics from Axiom (much more efficient than raw events).

Data shape per session:
{
  "sessionId": "uuid",
  "domain": "example.com",
  "timeouts_per_session": 5,
  "auctions_per_session": 10,
  "revenue_per_session": 0.0025,
  "session_length_ms": 3600000
}

Options:
  --limit, -l <number>         Number of sessions to fetch (default: 10000)
  --dataset, -d <name>         Dataset name (default: prebid-events)
  --output, -o <path>          Output file path (default: data/axiom-sessions-aggregated.json)
  --start-time <ISO date>      Start time for query (optional)
  --end-time <ISO date>        End time for query (default: now)
  --help, -h                   Show this help message

Examples:
  bun run ml-pipeline/fetch-aggregated-sessions.ts --limit 1000
  bun run ml-pipeline/fetch-aggregated-sessions.ts --start-time 2024-01-01T00:00:00Z
        `);
        process.exit(0);
        break;
      default:
        console.error(`Unknown option: ${arg}`);
        console.error("Use --help for usage information");
        process.exit(1);
    }
  }

  try {
    await fetchAggregatedSessions({
      datasetName,
      startTime,
      endTime,
      outputFile,
      limit,
    });
  } catch (error) {
    console.error("Error fetching aggregated data:", error);
    process.exit(1);
  }
}

main().catch(console.error);
