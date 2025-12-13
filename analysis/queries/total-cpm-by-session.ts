import { axiom } from "../src/axiom";

async function runQuery() {
  const datasetName = process.env.AXIOM_DATASET || "prebid-events";

  // Query to calculate total CPM per session ID
  // Only include events that have a CPM value
  const query = `['${datasetName}']
    | where isnotempty(sessionId) and isnotempty(cpm)
    | summarize totalCpm = sum(cpm) by sessionId
    | order by totalCpm desc`;

  console.log(`Running query: ${query}`);
  console.log("---");

  const result = await axiom.query(query);

  // Summarize queries return results in buckets.totals
  const results = result.buckets?.totals || [];

  console.log(`Found ${results.length || 0} sessions:\n`);

  if (results.length > 0) {
    results.forEach((row: any) => {
      const sessionId = row.group?.sessionId || "Unknown";
      const totalCpm = row.aggregations?.[0]?.value || 0;
      const revenue = totalCpm / 1000;
      console.log(JSON.stringify({ sessionId, totalCpm, revenue }, null, 2));
    });
  } else {
    console.log("No results found.");
  }
}

runQuery().catch(console.error);

