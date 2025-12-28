import { axiom } from "../src/axiom";
import { writeFileSync } from "fs";
import { join } from "path";

/**
 * Fetch bidder training data from Axiom for bid prediction model.
 *
 * Aggregates bidRequested and bidResponse events to calculate response rates
 * per bidder/domain/country/browser/os/adUnit combination.
 *
 * Usage:
 *   bun run ml:fetch-bidder [--limit N] [--days N]
 */

interface TrainingRecord {
  bidderCode: string;
  domain: string;
  country: string;
  browser: string;
  os: string;
  adUnitCode: string;
  mediaType: string;
  adSize: string;
  request_count: number;
  response_count: number;
  win_count: number;
  response_rate: number;
  win_rate: number; // wins / requests
  win_given_bid_rate: number; // wins / responses (if they bid, do they win?)
}

async function fetchBidderTrainingData() {
  const args = process.argv.slice(2);
  const limitIdx = args.indexOf("--limit");
  const daysIdx = args.indexOf("--days");

  const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1]) : 100000;
  const days = daysIdx !== -1 ? parseInt(args[daysIdx + 1]) : 30;

  const datasetName = process.env.AXIOM_DATASET || "prebid-events";

  console.log(`Fetching bidder training data from Axiom`);
  console.log(`  Dataset: ${datasetName}`);
  console.log(`  Time range: last ${days} days`);
  console.log(`  Limit: ${limit} records`);
  console.log("---");

  // APL query to aggregate bid requests, responses, and wins
  // Note: requestMediaTypes/requestSizes only exist on bidRequested, use make_set to capture then extract first
  const query = `['${datasetName}']
    | where isnotempty(bidderCode)
    | extend 
        isRequest = eventType == "bidRequested",
        isResponse = eventType == "bidResponse",
        isWin = eventType == "bidWon"
    | summarize 
        request_count = countif(isRequest),
        response_count = countif(isResponse),
        win_count = countif(isWin),
        mediaTypes = make_set(tostring(requestMediaTypes[0]), 1),
        adSizes = make_set(tostring(requestSizes[0]), 1)
      by bidderCode, domain, yotoCountry, browser, os, adUnitCode
    | where request_count > 0
    | extend 
        response_rate = todouble(response_count) / todouble(request_count),
        win_rate = todouble(win_count) / todouble(request_count),
        win_given_bid_rate = iff(response_count > 0, todouble(win_count) / todouble(response_count), 0.0),
        mediaType = tostring(mediaTypes[0]),
        adSize = tostring(adSizes[0])
    | project bidderCode, domain, yotoCountry, browser, os, adUnitCode, mediaType, adSize, request_count, response_count, win_count, response_rate, win_rate, win_given_bid_rate
    | limit ${limit}`;

  console.log(`Query:\n${query}`);
  console.log("---");

  const result = await axiom.query(query);

  // Results come in matches[].data for aggregated queries
  let records: TrainingRecord[] = [];
  const matches = (result as any).matches || [];

  if (matches.length > 0) {
    console.log(`\nFetched ${matches.length} aggregated records`);

    records = matches.map((match: any) => {
      const row = match.data || match;
      return {
        bidderCode: row.bidderCode || "",
        domain: row.domain || "",
        country: row.yotoCountry || "",
        browser: row.browser || "",
        os: row.os || "",
        adUnitCode: row.adUnitCode || "",
        mediaType: row.mediaType || "",
        adSize: row.adSize || "",
        request_count: row.request_count || 0,
        response_count: row.response_count || 0,
        win_count: row.win_count || 0,
        response_rate: row.response_rate || 0,
        win_rate: row.win_rate || 0,
        win_given_bid_rate: row.win_given_bid_rate || 0,
      };
    });
  } else {
    console.log("\nNo data returned from query");
    return;
  }

  if (records.length === 0) {
    console.log("No records to process");
    return;
  }

  // Calculate summary stats
  const totalRequests = records.reduce((sum, r) => sum + r.request_count, 0);
  const totalResponses = records.reduce((sum, r) => sum + r.response_count, 0);
  const totalWins = records.reduce((sum, r) => sum + r.win_count, 0);
  const avgResponseRate =
    totalRequests > 0 ? totalResponses / totalRequests : 0;
  const avgWinRate = totalRequests > 0 ? totalWins / totalRequests : 0;
  const avgWinGivenBid = totalResponses > 0 ? totalWins / totalResponses : 0;

  console.log(`\nSummary:`);
  console.log(`  Total bid requests: ${totalRequests.toLocaleString()}`);
  console.log(`  Total bid responses: ${totalResponses.toLocaleString()}`);
  console.log(`  Total wins: ${totalWins.toLocaleString()}`);
  console.log(`  Response rate: ${(avgResponseRate * 100).toFixed(2)}%`);
  console.log(`  Win rate (wins/requests): ${(avgWinRate * 100).toFixed(2)}%`);
  console.log(
    `  Win|Bid rate (wins/responses): ${(avgWinGivenBid * 100).toFixed(2)}%`
  );
  console.log(
    `  Unique bidders: ${new Set(records.map((r) => r.bidderCode)).size}`
  );
  console.log(
    `  Unique domains: ${new Set(records.map((r) => r.domain)).size}`
  );
  console.log(
    `  Unique countries: ${new Set(records.map((r) => r.country)).size}`
  );
  console.log("---");

  // Print top 10 by volume
  const sorted = [...records].sort((a, b) => b.request_count - a.request_count);
  console.log(`Top 10 by request volume:`);
  sorted.slice(0, 10).forEach((r, idx) => {
    console.log(
      `  ${idx + 1}. ${r.bidderCode} | ${r.domain} | ${r.country} | ${(
        r.response_rate * 100
      ).toFixed(1)}% response rate (${r.request_count} requests)`
    );
  });
  console.log("---");

  // Save to JSON with metadata
  const output = {
    metadata: {
      fetchedAt: new Date().toISOString(),
      datasetName,
      totalRecords: records.length,
      totalBidRequests: totalRequests,
      totalBidResponses: totalResponses,
      totalWins: totalWins,
      avgResponseRate,
      avgWinRate,
      avgWinGivenBid,
      uniqueBidders: new Set(records.map((r) => r.bidderCode)).size,
      uniqueDomains: new Set(records.map((r) => r.domain)).size,
      uniqueCountries: new Set(records.map((r) => r.country)).size,
    },
    data: records,
  };

  const outputPath = join(__dirname, "../data/bidder-training-data.json");
  writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`Saved ${records.length} records to: ${outputPath}`);
}

fetchBidderTrainingData().catch(console.error);
