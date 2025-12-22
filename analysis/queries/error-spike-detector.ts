import { axiom } from "../src/axiom";

async function runQuery() {
  const datasetName = process.env.AXIOM_DATASET || "collector-errors";

  /**
   * APL Query to detect if there's a 50% or more increase in errors
   * in the last hour compared to the previous hour.
   *
   * This query:
   * 1. Counts errors by hour
   * 2. Gets the last 2 hours
   * 3. Compares the last hour to the previous hour
   * 4. Calculates percentage increase
   * 5. Flags if increase >= 50%
   *
   * For use as an Axiom monitor, use only the APL query string below.
   */
  const query = `['${datasetName}']
    | summarize errorCount = count() by bin(_time, 1h)
    | order by _time desc
    | limit 2
    | summarize 
        lastHour = max(errorCount),
        totalErrors = sum(errorCount)
    | extend 
        previousHour = totalErrors - lastHour,
        increase = lastHour - previousHour,
        percentIncrease = iff(previousHour > 0, ((lastHour - previousHour) * 100.0 / previousHour), iff(lastHour > 0, 100.0, 0.0)),
        isSpike = percentIncrease >= 50.0
    | project 
        lastHour,
        previousHour,
        increase,
        percentIncrease = round(percentIncrease, 2),
        isSpike`;

  console.log(`Running query: ${query}`);
  console.log("---");
  console.log("\nAPL Query for Monitor (copy this):");
  console.log("---");
  console.log(query.replace(`['${datasetName}']`, `['collector-errors']`));
  console.log("---\n");

  const result = await axiom.query(query, {
    startTime: new Date(Date.now() - 2 * 60 * 60 * 1000), // Last 2 hours
    endTime: new Date(),
  });

  // The query returns results in different format depending on query type
  const results = result.buckets?.totals || result.rows || [];

  if (results.length > 0) {
    const data = results[0];
    const lastHour = data.lastHour || data["lastHour"] || 0;
    const previousHour = data.previousHour || data["previousHour"] || 0;
    const increase = data.increase || data["increase"] || 0;
    const percentIncrease =
      data.percentIncrease || data["percentIncrease"] || 0;
    const isSpike = data.isSpike || data["isSpike"] || false;

    console.log("Error Spike Detection Results:");
    console.log("---");
    console.log(`Last Hour Errors: ${lastHour}`);
    console.log(`Previous Hour Errors: ${previousHour}`);
    console.log(`Increase: ${increase}`);
    console.log(`Percentage Increase: ${percentIncrease}%`);
    console.log(`\n🚨 SPIKE DETECTED: ${isSpike ? "YES" : "NO"}`);

    if (isSpike) {
      console.log(
        `\n⚠️  WARNING: Error count increased by ${percentIncrease}% (>= 50% threshold)`
      );
    } else {
      console.log(
        `\n✅ No spike detected. Error increase is ${percentIncrease}% (below 50% threshold)`
      );
    }
  } else {
    console.log("No results found. This might indicate:");
    console.log("- No errors in the last 2 hours");
    console.log("- Insufficient data");
  }
}

runQuery().catch(console.error);
