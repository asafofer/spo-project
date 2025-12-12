import { axiom } from "../src/axiom";

async function runQuery() {
  const datasetName = process.env.AXIOM_DATASET || "prebid-events";

  // Query to fetch the last 5 events with country info from IP address
  // Using geo_info_from_ip_address to convert IP to country
  const query = `['${datasetName}'] 
    | extend geo = geo_info_from_ip_address(ip)
    | order by _time desc 
    | limit 5`;

  console.log(`Running query: ${query}`);
  console.log("---");

  const result = await axiom.query(query);

  console.log(`Found ${result.matches?.length || 0} events:\n`);

  if (result.matches && result.matches.length > 0) {
    result.matches.forEach((event: any, index) => {
      console.log(JSON.stringify(event, null, 2));
      if (index < (result.matches?.length ?? 0) - 1) {
        console.log("\n---\n");
      }
    });
  } else {
    console.log("No events found.");
  }
}

runQuery().catch(console.error);
