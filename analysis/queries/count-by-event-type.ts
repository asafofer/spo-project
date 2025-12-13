import { axiom } from "../src/axiom";

async function runQuery() {
  const datasetName = process.env.AXIOM_DATASET || "prebid-events";

  // Query to count events by eventType
  const query = `['${datasetName}']
    | where isnotempty(eventType)
    | extend eventType = tostring(eventType)
    | summarize count = count() by eventType
    | order by count desc`;

  console.log(`Running query: ${query}`);
  console.log("---");

  const result = await axiom.query(query);

  // Summarize queries return results in buckets.totals
  const results = result.buckets?.totals || [];

  console.log(`Found ${results.length || 0} event types:\n`);

  if (results.length > 0) {
    results.forEach((row: any) => {
      const eventType = row.group?.eventType || "Unknown";
      const count = row.aggregations?.[0]?.value || 0;
      console.log(JSON.stringify({ eventType, count }, null, 2));
    });
  } else {
    console.log("No results found.");
  }
}

runQuery().catch(console.error);

