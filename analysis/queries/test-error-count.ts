import { axiom } from "../src/axiom";

async function runQuery() {
  const query = `['collector-errors']
| summarize count() by bin(_time, 5m)`;

  console.log(`Running query: ${query}`);
  console.log("---");

  const result = await axiom.query(query, {
    startTime: new Date(Date.now() - 2 * 60 * 60 * 1000), // Last 2 hours
    endTime: new Date(),
  });

  const results = result.buckets?.totals || result.rows || [];

  console.log(`Found ${results.length} time buckets:\n`);

  if (results.length > 0) {
    results.forEach((row: any, index: number) => {
      const time = row.group?._time || row._time || "Unknown";
      const count = row.aggregations?.[0]?.value || row.count || 0;
      console.log(`${index + 1}. Time: ${time}, Count: ${count}`);
    });
  } else {
    console.log("No results found.");
  }
}

runQuery().catch(console.error);


