import { axiom } from "../src/axiom";
import { writeFile } from "fs/promises";
import { join } from "path";
import { mkdir } from "fs/promises";

async function runQuery() {
  const datasetName = process.env.AXIOM_DATASET || "prebid-events";

  const query = `['${datasetName}']
    | where domain == "go.paddling.com" and eventType == "bidRequested"
    | summarize bid_requests_per_session = count() by sessionId, bidderCode
    | summarize avg_bid_requests_per_session = avg(bid_requests_per_session) by bidderCode
    | order by avg_bid_requests_per_session desc`;

  console.log("Query: Average Bid Requests per Session per Bidder (go.paddling.com)");
  console.log("---");
  console.log(query);
  console.log("---");

  const result = await axiom.query(query, {
    startTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
    endTime: new Date(),
  });

  // Aggregated queries return results in buckets.totals
  let results = (result as any).buckets?.totals || [];
  console.log(`Fetched ${results.length} bidder records`);

  // Transform Axiom result format to simple array of objects
  const bidderData = results.map((row: any) => {
    const group = row.group || {};
    const aggregations = row.aggregations || [];

    // Find the average aggregation
    const getAggValue = (opName: string) => {
      const agg = aggregations.find((a: any) => a.op === opName);
      return agg?.value ?? null;
    };

    return {
      bidderCode: group.bidderCode || null,
      avg_bid_requests_per_session: getAggValue("avg_bid_requests_per_session") || 0,
    };
  });

  // Print results
  console.log("\nResults:");
  console.log("=" .repeat(60));
  bidderData.forEach((bidder: any, idx: number) => {
    console.log(
      `${idx + 1}. ${bidder.bidderCode}: ${bidder.avg_bid_requests_per_session.toFixed(2)} bid requests/session`
    );
  });
  console.log("=" .repeat(60));

  // Save to output file
  const outputDir = join(process.cwd(), "output", "bid-requests-per-session");
  await mkdir(outputDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outputPath = join(
    outputDir,
    `bid-requests-per-session-${timestamp}.json`
  );

  const outputData = {
    metadata: {
      query,
      fetchedAt: new Date().toISOString(),
      domain: "go.paddling.com",
      totalBidders: bidderData.length,
    },
    data: bidderData,
  };

  await writeFile(outputPath, JSON.stringify(outputData, null, 2));
  console.log(`\nResults saved to: ${outputPath}`);

  return bidderData;
}

runQuery().catch((error) => {
  console.error("Error running query:", error);
  process.exit(1);
});

