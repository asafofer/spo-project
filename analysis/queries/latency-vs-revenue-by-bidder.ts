import { axiom } from "../src/axiom";

async function runQuery() {
  const datasetName = process.env.AXIOM_DATASET || "prebid-events";

  /**
   * Query to analyze the relationship between bidder latency and revenue contribution.
   *
   * This query groups events by bidderCode and calculates:
   *
   * Latency Metrics:
   * - avgLatency: Average response time (mean of timeToRespond)
   * - p50Latency: Median response time (50th percentile - typical performance)
   * - p95Latency: 95th percentile response time (worst-case for 95% of requests)
   *
   * Volume Metrics:
   * - totalBids: Total number of bids from this bidder
   * - wonBids: Number of bids that won auctions
   * - bidsWithLatency: Count of bids that have latency data
   * - bidsWithCpm: Count of bids that have CPM data
   *
   * Revenue Metrics:
   * - totalCpm: Sum of all CPM values (including non-winning bids)
   * - wonCpm: Sum of CPM values only for winning bids
   * - revenue: Won CPM converted to revenue (wonCpm / 1000)
   * - avgCpm: Average CPM of winning bids
   *
   * Derived Metrics:
   * - winRate: Percentage of bids that won (wonBids / totalBids * 100)
   *
   * Results are ordered by revenue (descending) to show top contributors first.
   * This helps identify:
   * - Which bidders generate the most revenue
   * - Whether faster bidders contribute more revenue
   * - The latency/revenue trade-off per bidder
   */
  const query = `['${datasetName}']
    | where isnotempty(bidderCode)
    | extend hasLatency = isnotempty(timeToRespond)
    | extend hasCpm = isnotempty(cpm)
    | extend isWon = eventType == "bidWon"
    | summarize 
        avgLatency = avg(timeToRespond),
        p50Latency = percentile(timeToRespond, 50),
        p95Latency = percentile(timeToRespond, 95),
        totalBids = count(),
        wonBids = countif(isWon),
        totalCpm = sum(cpm),
        wonCpm = sumif(cpm, isWon),
        bidsWithLatency = countif(hasLatency),
        bidsWithCpm = countif(hasCpm)
      by bidderCode
    | extend 
        winRate = wonBids * 100.0 / totalBids,
        revenue = wonCpm / 1000,
        avgCpm = wonCpm / wonBids
    | order by revenue desc`;

  console.log(`Running query: ${query}`);
  console.log("---");

  const result = await axiom.query(query);

  // Summarize queries return results in buckets.totals
  const results = result.buckets?.totals || [];

  console.log(`\nFound ${results.length || 0} bidders\n`);

  if (results.length > 0) {
    const tableData = results.map((row: any) => {
      const bidderCode = row.group?.bidderCode || "Unknown";
      const aggregations = row.aggregations || [];

      // Extract aggregation values by index
      const avgLatency = aggregations[0]?.value || null;
      const p50Latency = aggregations[1]?.value || null;
      const p95Latency = aggregations[2]?.value || null;
      const totalBids = aggregations[3]?.value || 0;
      const wonBids = aggregations[4]?.value || 0;
      const totalCpm = aggregations[5]?.value || 0;
      const wonCpm = aggregations[6]?.value || 0;

      // Calculate derived metrics
      const winRate = totalBids > 0 ? (wonBids * 100.0) / totalBids : 0;
      const revenue = wonCpm / 1000;
      const avgCpm = wonBids > 0 ? wonCpm / wonBids : 0;

      return {
        Bidder: bidderCode,
        "Avg Latency (ms)": avgLatency ? Math.round(avgLatency) : "N/A",
        "P50 Latency (ms)": p50Latency ? Math.round(p50Latency) : "N/A",
        "P95 Latency (ms)": p95Latency ? Math.round(p95Latency) : "N/A",
        Revenue: `$${revenue.toFixed(4)}`,
        "Win Rate (%)": `${winRate.toFixed(2)}%`,
        "Total Bids": totalBids,
        "Won Bids": wonBids,
        "Avg CPM": avgCpm > 0 ? avgCpm.toFixed(2) : "0.00",
      };
    });

    console.table(tableData);
    console.log();
  } else {
    console.log("No results found.");
  }
}

runQuery().catch(console.error);
