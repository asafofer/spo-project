import { axiom } from "../src/axiom";

/**
 * Verify actual bidder response rate for specific conditions.
 * Used to validate model predictions against real data.
 *
 * Usage:
 *   bun run queries/verify-bidder-response-rate.ts --bidder vidazoo --domain moovit.com --country DE
 *   bun run queries/verify-bidder-response-rate.ts --bidder rubicon --domain moovit.com
 */

async function runQuery() {
  const args = process.argv.slice(2);

  // Parse args
  const getArg = (name: string): string | undefined => {
    const idx = args.indexOf(`--${name}`);
    return idx !== -1 ? args[idx + 1] : undefined;
  };

  const bidder = getArg("bidder");
  const domain = getArg("domain");
  const country = getArg("country");
  const days = parseInt(getArg("days") || "30");

  if (!bidder) {
    console.log(
      "Usage: bun run queries/verify-bidder-response-rate.ts --bidder <bidder> [--domain <domain>] [--country <country>] [--days <days>]"
    );
    console.log("\nExamples:");
    console.log("  --bidder vidazoo --domain moovit.com --country DE");
    console.log("  --bidder rubicon --domain moovit.com");
    console.log("  --bidder pubmatic");
    process.exit(1);
  }

  const datasetName = process.env.AXIOM_DATASET || "prebid-events";

  // Build filter conditions
  const filters = [`bidderCode == "${bidder}"`];
  if (domain) filters.push(`domain == "${domain}"`);
  if (country) filters.push(`yotoCountry == "${country}"`);

  const filterClause = filters.join(" and ");

  const query = `['${datasetName}']
    | where ${filterClause}
    | extend 
        isRequest = eventType == "bidRequested",
        isResponse = eventType == "bidResponse"
    | summarize 
        requests = countif(isRequest),
        responses = countif(isResponse)
    | extend 
        response_rate = round(todouble(responses) / todouble(requests) * 100, 2)`;

  console.log("=".repeat(60));
  console.log("VERIFY BIDDER RESPONSE RATE");
  console.log("=".repeat(60));
  console.log(`\nFilters:`);
  console.log(`  Bidder: ${bidder}`);
  if (domain) console.log(`  Domain: ${domain}`);
  if (country) console.log(`  Country: ${country}`);
  console.log(`  Time range: last ${days} days`);
  console.log(`\nQuery:\n${query}`);
  console.log("-".repeat(60));

  const result = await axiom.query(query, {
    startTime: new Date(Date.now() - days * 24 * 60 * 60 * 1000),
    endTime: new Date(),
  });

  // Handle aggregated result format - check both formats
  const matches = (result as any).matches || [];
  const totals = (result as any).buckets?.totals || [];

  // Try matches first (for row-level queries), then totals (for summarize)
  let requests = 0,
    responses = 0;
  let hasData = false;

  if (totals.length > 0) {
    // Summarize query returns data in buckets.totals[0].aggregations
    const aggs = totals[0]?.aggregations || [];
    requests = aggs[0]?.value || 0;
    responses = aggs[1]?.value || 0;
    hasData = true;
  } else if (matches.length > 0) {
    const data = matches[0].data || matches[0];
    requests = data.requests || 0;
    responses = data.responses || 0;
    hasData = true;
  }

  if (hasData && requests > 0) {
    const responseRate = (responses / requests) * 100;

    console.log("\n📊 ACTUAL RESULTS:");
    console.log("-".repeat(40));
    console.log(`  Bid Requests:    ${requests.toLocaleString()}`);
    console.log(`  Bid Responses:   ${responses.toLocaleString()}`);
    console.log("-".repeat(40));
    console.log(`  Response Rate:   ${responseRate.toFixed(2)}%`);
    console.log("=".repeat(60));

    // Compare with model prediction hint
    console.log(`\n💡 Compare this with model prediction for:`);
    console.log(`   python3 test_predictions.py`);
    console.log(`   or check bid_prediction_model_v2.py output`);
  } else {
    console.log("\n❌ No data found for these filters (or zero requests).");
    console.log("   Try broadening filters or checking spelling.");
  }
}

runQuery().catch(console.error);
