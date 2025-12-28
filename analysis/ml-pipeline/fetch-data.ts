import { axiom } from "../src/axiom";
import { writeFile } from "fs/promises";
import { join } from "path";

interface FetchOptions {
  limit?: number;
  datasetName?: string;
  startTime?: Date;
  endTime?: Date;
  outputFile?: string;
}

async function fetchDataFromAxiom(options: FetchOptions = {}) {
  const {
    limit = 1000,
    datasetName = process.env.AXIOM_DATASET || "prebid-events",
    startTime,
    endTime = new Date(),
    outputFile,
  } = options;

  console.log(`Fetching ${limit} rows from Axiom dataset: ${datasetName}`);
  console.log("---");

  // Build the query - fetch raw events ordered by time
  const query = `['${datasetName}'] 
    | order by _time desc 
    | limit ${limit}`;

  console.log(`Query: ${query}`);
  console.log("---");

  // Execute the query
  const queryOptions: any = {};
  if (startTime) {
    queryOptions.startTime = startTime;
  }
  if (endTime) {
    queryOptions.endTime = endTime;
  }

  const result = await axiom.query(query, queryOptions);

  // Handle different result types - queries without aggregation return matches
  const matches = (result as any).matches || [];
  console.log(`Fetched ${matches.length} events`);

  // Prepare output data
  const outputData = {
    metadata: {
      fetchedAt: new Date().toISOString(),
      datasetName,
      limit,
      actualCount: matches.length,
      startTime: startTime?.toISOString() || null,
      endTime: endTime?.toISOString(),
    },
    data: matches,
  };

  // Determine output file path - use fixed filename to overwrite instead of creating new files
  const defaultFileName = "axiom-data.json";
  const outputPath = outputFile
    ? join(process.cwd(), outputFile)
    : join(process.cwd(), "data", defaultFileName);

  // Save to JSON file
  await writeFile(outputPath, JSON.stringify(outputData, null, 2), "utf-8");

  console.log(`\nData saved to: ${outputPath}`);
  console.log(`Total records: ${matches.length}`);
  console.log(
    `File size: ${(JSON.stringify(outputData).length / 1024).toFixed(2)} KB`
  );

  return {
    outputPath,
    recordCount: matches.length,
  };
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);

  // Parse command line arguments
  let limit = 1000;
  let datasetName = process.env.AXIOM_DATASET || "prebid-events";
  let outputFile: string | undefined;
  let startTime: Date | undefined;
  let endTime: Date | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case "--limit":
      case "-l":
        limit = parseInt(args[++i], 10);
        if (isNaN(limit) || limit < 1) {
          console.error("Error: --limit must be a positive number");
          process.exit(1);
        }
        break;
      case "--dataset":
      case "-d":
        datasetName = args[++i];
        break;
      case "--output":
      case "-o":
        outputFile = args[++i];
        break;
      case "--start-time":
        startTime = new Date(args[++i]);
        if (isNaN(startTime.getTime())) {
          console.error("Error: --start-time must be a valid ISO date string");
          process.exit(1);
        }
        break;
      case "--end-time":
        endTime = new Date(args[++i]);
        if (isNaN(endTime.getTime())) {
          console.error("Error: --end-time must be a valid ISO date string");
          process.exit(1);
        }
        break;
      case "--help":
      case "-h":
        console.log(`
Usage: bun run ml-pipeline/fetch-data.ts [options]

Options:
  --limit, -l <number>        Number of rows to fetch (default: 1000)
  --dataset, -d <name>         Dataset name (default: prebid-events)
  --output, -o <path>          Output file path (default: data/axiom-data.json, overwrites existing)
  --start-time <ISO date>      Start time for query (optional)
  --end-time <ISO date>        End time for query (default: now)
  --help, -h                   Show this help message

Examples:
  bun run ml-pipeline/fetch-data.ts --limit 5000
  bun run ml-pipeline/fetch-data.ts --limit 10000 --output data/my-data.json
  bun run ml-pipeline/fetch-data.ts --limit 5000 --start-time 2024-01-01T00:00:00Z

Note: By default, the script overwrites data/axiom-data.json to prevent file accumulation.
        `);
        process.exit(0);
        break;
      default:
        console.error(`Unknown option: ${arg}`);
        console.error("Use --help for usage information");
        process.exit(1);
    }
  }

  try {
    await fetchDataFromAxiom({
      limit,
      datasetName,
      startTime,
      endTime,
      outputFile,
    });
  } catch (error) {
    console.error("Error fetching data:", error);
    process.exit(1);
  }
}

main().catch(console.error);
