import { axiom } from "../src/axiom";

async function runQuery() {
  const datasetName = process.env.AXIOM_DATASET || "prebid-events";

  // Query to count events by country using geo_info_from_ip_address
  const query = `['${datasetName}']
    | where isnotempty(ip)
    | extend geo_info = geo_info_from_ip_address(ip)
    | extend country = tostring(geo_info.country)
    | summarize count = count() by country`;

  console.log(`Running query: ${query}`);
  console.log("---");

  const result = await axiom.query(query);

  // Summarize queries return results in buckets.totals
  const results = result.buckets?.totals || [];

  console.log(`Found ${results.length || 0} countries:\n`);

  if (results.length > 0) {
    results.forEach((row: any) => {
      const country = row.group?.country || "Unknown";
      const count = row.aggregations?.[0]?.value || 0;
      console.log(JSON.stringify({ country, count }, null, 2));
    });
  } else {
    console.log("No results found.");
  }
}

runQuery().catch(console.error);
