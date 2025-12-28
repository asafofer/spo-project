import { axiom } from "../src/axiom";
import { writeFile } from "fs/promises";
import { join } from "path";
import { mkdir } from "fs/promises";

async function runQuery() {
  const datasetName = process.env.AXIOM_DATASET || "prebid-events";

  /**
   * Query to calculate comprehensive bidder performance metrics grouped by domain.
   *
   * Metrics calculated per bidder per domain:
   * - requests: Number of bid requests
   * - responses: Number of bid responses
   * - wins: Number of bids won
   * - timeouts: Number of bid timeouts
   * - rejections: Number of bid rejections
   * - responseRate: responses / requests * 100
   * - winRate: wins / responses * 100
   * - timeoutRate: timeouts / requests * 100
   * - avgCpm: Average CPM when winning
   * - avgLatency: Average response time
   * - totalRevenue: Total revenue from winning bids (wonCpm / 1000)
   */
  const query = `['${datasetName}']
    | where isnotempty(bidderCode) and isnotempty(domain)
    | extend 
        isRequest = eventType == "bidRequested",
        isResponse = eventType == "bidResponse",
        isWon = eventType == "bidWon",
        isTimeout = eventType == "bidTimeout",
        isRejected = eventType == "bidRejected"
    | summarize 
        requests = countif(isRequest),
        // Count unique requestIds for responses - multiple bids from same request = 1 response
        responses = dcountif(requestId, isResponse),
        wins = countif(isWon),
        timeouts = countif(isTimeout),
        rejections = countif(isRejected),
        wonCpm = sumif(cpm, isWon),
        totalLatency = sumif(timeToRespond, isResponse),
        latencyCount = countif(isResponse and isnotempty(timeToRespond)),
        p50Latency = percentile(timeToRespond, 50),
        p99Latency = percentile(timeToRespond, 99)
      by domain, bidderCode
    | extend 
        responseRate = iff(requests > 0, (responses * 100.0 / requests), 0.0),
        winRate = iff(responses > 0, (wins * 100.0 / responses), 0.0),
        timeoutRate = iff(requests > 0, (timeouts * 100.0 / requests), 0.0),
        avgCpm = iff(wins > 0, (wonCpm / wins), 0.0),
        avgLatency = iff(latencyCount > 0, (totalLatency / latencyCount), 0.0),
        totalRevenue = wonCpm / 1000
    | order by domain, totalRevenue desc`;

  // Capture formatted output
  let formattedOutput = "";

  const log = (...args: any[]) => {
    const message = args.map(String).join(" ");
    console.log(...args);
    formattedOutput += message + "\n";
  };

  log(`Running query: ${query}`);
  log("---");

  const result = await axiom.query(query, {
    startTime: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), // Last 15 days
    endTime: new Date(),
  });

  // Summarize queries return results in buckets.totals
  const results = result.buckets?.totals || [];

  log(`\nFound ${results.length || 0} bidder-domain combinations\n`);

  if (results.length > 0) {
    // Process and group by domain
    const domainData: Record<string, any[]> = {};

    results.forEach((row: any) => {
      const domain = row.group?.domain || "Unknown";
      const bidderCode = row.group?.bidderCode || "Unknown";
      const aggregations = row.aggregations || [];

      // Extract aggregation values by index
      const requests = aggregations[0]?.value || 0; // Total bidRequested events
      const responses = aggregations[1]?.value || 0;
      const wins = aggregations[2]?.value || 0;
      const timeouts = aggregations[3]?.value || 0;
      const rejections = aggregations[4]?.value || 0;
      const wonCpm = aggregations[5]?.value || 0;
      const totalLatency = aggregations[6]?.value || 0;
      const latencyCount = aggregations[7]?.value || 0;
      const p50Latency = aggregations[8]?.value || null;
      const p99Latency = aggregations[9]?.value || null;

      // Calculate derived metrics
      const responseRate = requests > 0 ? (responses * 100.0) / requests : 0;
      const winRate = responses > 0 ? (wins * 100.0) / responses : 0;
      const timeoutRate = requests > 0 ? (timeouts * 100.0) / requests : 0;
      const avgCpm = wins > 0 ? wonCpm / wins : 0;
      const avgLatency = latencyCount > 0 ? totalLatency / latencyCount : 0;
      const totalRevenue = wonCpm / 1000;

      if (!domainData[domain]) {
        domainData[domain] = [];
      }

      domainData[domain].push({
        bidder: bidderCode,
        requests,
        responses,
        wins,
        responseRate,
        winRate,
        timeoutRate,
        avgCpm,
        avgLatency,
        p50Latency,
        p99Latency,
        totalRevenue,
      });
    });

    // Sort domains by total revenue (descending)
    const sortedDomains = Object.keys(domainData).sort((a, b) => {
      const revenueA = domainData[a].reduce(
        (sum, bidder) => sum + bidder.totalRevenue,
        0
      );
      const revenueB = domainData[b].reduce(
        (sum, bidder) => sum + bidder.totalRevenue,
        0
      );
      return revenueB - revenueA; // Descending order
    });

    for (const domain of sortedDomains) {
      const bidders = domainData[domain];

      // Sort bidders by revenue (descending)
      bidders.sort((a, b) => b.totalRevenue - a.totalRevenue);

      // Calculate domain totals
      const domainTotalRevenue = bidders.reduce(
        (sum, b) => sum + b.totalRevenue,
        0
      );
      const domainTotalRequests = bidders.reduce(
        (sum, b) => sum + b.requests,
        0
      );
      const domainTotalWins = bidders.reduce((sum, b) => sum + b.wins, 0);

      log(`\n${"=".repeat(100)}`);
      log(`DOMAIN: ${domain}`);
      log(`${"=".repeat(100)}`);
      log(
        `Total Revenue: $${domainTotalRevenue.toFixed(
          2
        )} | Total Requests: ${domainTotalRequests.toLocaleString()} | Total Wins: ${domainTotalWins.toLocaleString()}`
      );
      log(`${"-".repeat(100)}`);

      // Print bidders table
      const tableData = bidders.map((bidder) => ({
        Bidder: bidder.bidder,
        Requests: bidder.requests.toLocaleString(),
        Responses: bidder.responses.toLocaleString(),
        Revenue: `$${bidder.totalRevenue.toFixed(4)}`,
        "Revenue %":
          domainTotalRevenue > 0
            ? `${((bidder.totalRevenue / domainTotalRevenue) * 100).toFixed(
                1
              )}%`
            : "0.0%",
        Wins: bidder.wins.toLocaleString(),
        "Win Rate": `${bidder.winRate.toFixed(1)}%`,
        "Response Rate": `${bidder.responseRate.toFixed(1)}%`,
        "Timeout Rate": `${bidder.timeoutRate.toFixed(1)}%`,
        "Avg CPM": `$${bidder.avgCpm.toFixed(4)}`,
        "Latency Mean":
          bidder.avgLatency > 0 ? `${Math.round(bidder.avgLatency)}ms` : "N/A",
        "Latency Median": bidder.p50Latency
          ? `${Math.round(bidder.p50Latency)}ms`
          : "N/A",
        "Latency P99": bidder.p99Latency
          ? `${Math.round(bidder.p99Latency)}ms`
          : "N/A",
      }));

      // Format table as text
      const tableText = formatTable(tableData);
      log(tableText);

      // Highlight bidders with response rate > 100%
      const highResponseRateBidders = bidders.filter(
        (b) => b.responseRate > 100
      );
      if (highResponseRateBidders.length > 0) {
        log(
          `\n🔍  BIDDERS WITH RESPONSE RATE > 100% (${highResponseRateBidders.length}):`
        );
        highResponseRateBidders.forEach((bidder) => {
          log(
            `   • ${bidder.bidder}: ${bidder.responseRate.toFixed(
              1
            )}% (${bidder.requests.toLocaleString()} requests → ${bidder.responses.toLocaleString()} responses)`
          );
        });
      }

      // Highlight bidders with zero revenue - split into two groups
      const zeroRevenueBidders = bidders.filter((b) => b.totalRevenue === 0);
      if (zeroRevenueBidders.length > 0) {
        const nonResponders = zeroRevenueBidders.filter(
          (b) => b.responseRate === 0
        );
        const respondersButNoWins = zeroRevenueBidders.filter(
          (b) => b.responseRate > 0 && b.winRate === 0
        );

        if (nonResponders.length > 0) {
          log(`\n🚫  BIDDERS THAT NEVER RESPOND (${nonResponders.length}):`);
          nonResponders.forEach((bidder) => {
            const issues = [];
            if (bidder.timeoutRate > 30)
              issues.push(`high timeout (${bidder.timeoutRate.toFixed(1)}%)`);
            const issueText =
              issues.length > 0 ? ` - ${issues.join(", ")}` : "";
            log(`   • ${bidder.bidder}${issueText}`);
          });
        }

        if (respondersButNoWins.length > 0) {
          log(
            `\n❌  BIDDERS THAT RESPOND BUT NEVER WIN (${respondersButNoWins.length}):`
          );
          respondersButNoWins.forEach((bidder) => {
            const issues = [];
            if (bidder.timeoutRate > 30)
              issues.push(`high timeout (${bidder.timeoutRate.toFixed(1)}%)`);
            const issueText =
              issues.length > 0 ? ` - ${issues.join(", ")}` : "";
            log(
              `   • ${bidder.bidder} (${bidder.responseRate.toFixed(
                1
              )}% response rate)${issueText}`
            );
          });
        }
      }
    }

    log(`\n${"=".repeat(100)}\n`);

    // Save formatted text to output directory
    const outputDir = join(process.cwd(), "output", "bidder-performance");
    await mkdir(outputDir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const txtFile = join(outputDir, `bidder-performance-${timestamp}.txt`);

    // Save formatted text
    await writeFile(txtFile, formattedOutput, "utf-8");
    log(`\n✅ Analysis saved to: ${txtFile}\n`);
  } else {
    log("No results found.");
  }
}

// Helper function to format table as text
function formatTable(data: any[]): string {
  if (data.length === 0) return "";

  const headers = Object.keys(data[0]);
  const colWidths = headers.map((h) => {
    const maxContentWidth = Math.max(
      h.length,
      ...data.map((row) => String(row[h] || "").length)
    );
    return Math.min(maxContentWidth + 2, 20); // Cap at 20 chars
  });

  let output = "\n";

  // Header row
  const headerRow = headers.map((h, i) => h.padEnd(colWidths[i])).join(" | ");
  output += headerRow + "\n";
  output += headers.map((_, i) => "-".repeat(colWidths[i])).join("-+-") + "\n";

  // Data rows
  data.forEach((row) => {
    const dataRow = headers
      .map((h, i) => String(row[h] || "").padEnd(colWidths[i]))
      .join(" | ");
    output += dataRow + "\n";
  });

  return output;
}

runQuery().catch(console.error);
