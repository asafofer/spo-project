import { axiom } from "../src/axiom";

async function runQuery() {
  const datasetName = process.env.AXIOM_DATASET || "prebid-events";

  /**
   * Query to analyze the correlation between latency and revenue per session.
   *
   * This query groups events by sessionId and calculates:
   * - avgLatency: Average time to respond across all bids in the session
   * - revenue: Total revenue from winning bids (wonCpm / 1000)
   * - sessionDepth: Number of distinct pageviews in the session
   * - totalBids: Total number of bids in the session
   * - bidsWithLatency: Count of bids that have latency data
   *
   * Results are ordered by revenue (descending) to see if higher revenue
   * sessions have lower latency.
   */
  const query = `['${datasetName}']
    | where isnotempty(sessionId) and isnotempty(timeToRespond)
    | extend isWon = eventType == "bidWon"
    | summarize 
        avgLatency = avg(timeToRespond),
        wonCpm = sumif(cpm, isWon),
        sessionDepth = dcount(pageviewId),
        totalBids = count()
      by sessionId
    | extend revenue = wonCpm / 1000
    | order by revenue desc`;

  console.log(`Running query: ${query}`);
  console.log("---");

  const result = await axiom.query(query);

  // Summarize queries return results in buckets.totals
  const results = result.buckets?.totals || [];

  console.log(`Found ${results.length || 0} sessions with latency data:\n`);

  if (results.length > 0) {
    const tableData = results.map((row: any) => {
      const sessionId = row.group?.sessionId || "Unknown";
      const aggregations = row.aggregations || [];

      // Extract aggregation values by index
      const avgLatency = aggregations[0]?.value || null;
      const wonCpm = aggregations[1]?.value || 0;
      const sessionDepth = aggregations[2]?.value || 0;
      const totalBids = aggregations[3]?.value || 0;

      // Calculate revenue
      const revenue = wonCpm / 1000;

      return {
        SessionId: sessionId.substring(0, 8) + "...",
        "Avg Latency (ms)": avgLatency ? Math.round(avgLatency) : "N/A",
        Revenue: `$${revenue.toFixed(4)}`,
        "Session Depth": sessionDepth,
        "Bids w/ Latency": totalBids,
      };
    });

    console.table(tableData);
    console.log();

    // Calculate correlation insights
    const sessions = results
      .map((row: any) => {
        const aggregations = row.aggregations || [];
        return {
          latency: aggregations[0]?.value || null,
          revenue: (aggregations[1]?.value || 0) / 1000,
        };
      })
      .filter((s) => s.latency !== null);

    if (sessions.length > 0) {
      // Sort by latency to see the pattern
      const sortedByLatency = [...sessions].sort(
        (a, b) => a.latency! - b.latency!
      );
      const sortedByRevenue = [...sessions].sort(
        (a, b) => b.revenue - a.revenue
      );

      console.log("Correlation Analysis:");
      console.log("---");
      console.log(`Total sessions analyzed: ${sessions.length}`);
      console.log(`\nTop 3 by Revenue:`);
      sortedByRevenue.slice(0, 3).forEach((s, i) => {
        console.log(
          `  ${i + 1}. Revenue: $${s.revenue.toFixed(4)}, Latency: ${Math.round(
            s.latency!
          )}ms`
        );
      });
      console.log(`\nTop 3 by Latency (lowest):`);
      sortedByLatency.slice(0, 3).forEach((s, i) => {
        console.log(
          `  ${i + 1}. Latency: ${Math.round(
            s.latency!
          )}ms, Revenue: $${s.revenue.toFixed(4)}`
        );
      });
      console.log(`\nTop 3 by Latency (highest):`);
      sortedByLatency
        .slice(-3)
        .reverse()
        .forEach((s, i) => {
          console.log(
            `  ${i + 1}. Latency: ${Math.round(
              s.latency!
            )}ms, Revenue: $${s.revenue.toFixed(4)}`
          );
        });

      // Calculate simple correlation coefficient
      const avgLatency =
        sessions.reduce((sum, s) => sum + s.latency!, 0) / sessions.length;
      const avgRevenue =
        sessions.reduce((sum, s) => sum + s.revenue, 0) / sessions.length;

      let numerator = 0;
      let sumSqLatency = 0;
      let sumSqRevenue = 0;

      sessions.forEach((s) => {
        const latDiff = s.latency! - avgLatency;
        const revDiff = s.revenue - avgRevenue;
        numerator += latDiff * revDiff;
        sumSqLatency += latDiff * latDiff;
        sumSqRevenue += revDiff * revDiff;
      });

      const correlation = numerator / Math.sqrt(sumSqLatency * sumSqRevenue);

      console.log(`\nCorrelation Coefficient: ${correlation.toFixed(3)}`);

      // Interpretation focused on: Lower latency = Higher revenue?
      if (correlation < -0.3) {
        console.log(
          "  ✅ STRONG NEGATIVE CORRELATION: Lower latency = Higher revenue (hypothesis confirmed)"
        );
      } else if (correlation > 0.3) {
        console.log(
          "  ❌ STRONG POSITIVE CORRELATION: Lower latency = Lower revenue (hypothesis rejected)"
        );
      } else if (correlation < -0.1) {
        console.log(
          "  ⚠️  WEAK NEGATIVE CORRELATION: Slight tendency for lower latency = higher revenue"
        );
      } else if (correlation > 0.1) {
        console.log(
          "  ⚠️  WEAK POSITIVE CORRELATION: Slight tendency for lower latency = lower revenue"
        );
      } else {
        console.log(
          "  ➖ NO SIGNIFICANT CORRELATION: No clear relationship between latency and revenue"
        );
      }

      // Additional analysis: Focus on sessions with revenue
      const sessionsWithRevenue = sessions.filter((s) => s.revenue > 0);
      if (sessionsWithRevenue.length >= 2) {
        console.log(
          `\n--- Analysis of ${sessionsWithRevenue.length} sessions WITH revenue ---`
        );

        const sortedByLatencyRev = [...sessionsWithRevenue].sort(
          (a, b) => a.latency! - b.latency!
        );

        // Split into halves (lowest vs highest latency)
        const halfSize = Math.ceil(sessionsWithRevenue.length / 2);
        const lowerHalf = sortedByLatencyRev.slice(0, halfSize);
        const upperHalf = sortedByLatencyRev.slice(-halfSize);

        const avgRevenueLower =
          lowerHalf.reduce((sum, s) => sum + s.revenue, 0) / lowerHalf.length;
        const avgRevenueUpper =
          upperHalf.reduce((sum, s) => sum + s.revenue, 0) / upperHalf.length;
        const avgLatencyLower =
          lowerHalf.reduce((sum, s) => sum + s.latency!, 0) / lowerHalf.length;
        const avgLatencyUpper =
          upperHalf.reduce((sum, s) => sum + s.latency!, 0) / upperHalf.length;

        console.log(`\nLower Latency Half (${lowerHalf.length} sessions):`);
        console.log(`  Avg Latency: ${Math.round(avgLatencyLower)}ms`);
        console.log(`  Avg Revenue: $${avgRevenueLower.toFixed(4)}`);

        console.log(`\nHigher Latency Half (${upperHalf.length} sessions):`);
        console.log(`  Avg Latency: ${Math.round(avgLatencyUpper)}ms`);
        console.log(`  Avg Revenue: $${avgRevenueUpper.toFixed(4)}`);

        const revenueDiff =
          ((avgRevenueLower - avgRevenueUpper) / avgRevenueUpper) * 100;
        if (revenueDiff > 0) {
          console.log(
            `\n✅ Lower latency sessions generate ${revenueDiff.toFixed(
              1
            )}% MORE revenue`
          );
        } else if (revenueDiff < 0) {
          console.log(
            `\n❌ Lower latency sessions generate ${Math.abs(
              revenueDiff
            ).toFixed(1)}% LESS revenue`
          );
        } else {
          console.log(
            `\n➖ No revenue difference between lower and higher latency sessions`
          );
        }
      } else if (sessionsWithRevenue.length === 1) {
        console.log(
          `\n⚠️  Only 1 session with revenue - insufficient data for comparison`
        );
      }
    }
  } else {
    console.log("No results found with latency data.");
  }
}

runQuery().catch(console.error);
