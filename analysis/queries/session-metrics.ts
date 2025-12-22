import { axiom } from "../src/axiom";

async function runQuery() {
  const datasetName = process.env.AXIOM_DATASET || "prebid-events";

  /**
   * Query to calculate session-level metrics:
   * - sessionId: The session identifier
   * - sessionDepth: Number of distinct pageviews in the session
   * - revenue: Total revenue from winning bids (wonCpm / 1000)
   * - avgTimeToRespond: Average response time across all bids in the session
   */
  const query = `['${datasetName}']
    | where isnotempty(sessionId)
    | extend isWon = eventType == "bidWon"
    | summarize 
        sessionDepth = dcount(pageviewId),
        wonCpm = sumif(cpm, isWon),
        avgTimeToRespond = avg(timeToRespond)
      by sessionId
    | extend revenue = wonCpm / 1000
    | order by revenue desc`;

  console.log(`Running query: ${query}`);
  console.log("---");

  const result = await axiom.query(query);

  // Summarize queries return results in buckets.totals
  const results = result.buckets?.totals || [];

  console.log(`Found ${results.length || 0} sessions:\n`);

  if (results.length > 0) {
    const tableData = results.map((row: any) => {
      const sessionId = row.group?.sessionId || "Unknown";
      const aggregations = row.aggregations || [];

      // Extract aggregation values by index
      const sessionDepth = aggregations[0]?.value || 0;
      const wonCpm = aggregations[1]?.value || 0;
      const avgTimeToRespond = aggregations[2]?.value || null;

      // Calculate revenue
      const revenue = wonCpm / 1000;

      return {
        SessionId: sessionId,
        "Session Depth": sessionDepth,
        Revenue: `$${revenue.toFixed(4)}`,
        "Avg Time to Respond (ms)": avgTimeToRespond
          ? Math.round(avgTimeToRespond)
          : "N/A",
      };
    });

    console.table(tableData);
    console.log();
  } else {
    console.log("No results found.");
  }
}

runQuery().catch(console.error);
