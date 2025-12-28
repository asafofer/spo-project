# ML Pipeline - Data Fetching

This directory contains the data pipeline for fetching data from Axiom and preparing it for machine learning analysis.

## Structure

```
ml-pipeline/
├── fetch-data.ts    # TypeScript script to fetch data from Axiom
├── data/            # Directory for fetched JSON data files
└── README.md        # This file
```

## Part 1: Fetching Data from Axiom

The `fetch-data.ts` script fetches raw event data from Axiom and saves it as JSON files.

### Usage

Basic usage (fetch 1000 rows):
```bash
bun run ml-pipeline/fetch-data.ts
```

Fetch a specific number of rows:
```bash
bun run ml-pipeline/fetch-data.ts --limit 5000
```

Specify a custom output file:
```bash
bun run ml-pipeline/fetch-data.ts --limit 10000 --output data/my-dataset.json
```

Fetch data from a specific time range:
```bash
bun run ml-pipeline/fetch-data.ts --limit 5000 --start-time 2024-01-01T00:00:00Z
```

### Options

- `--limit, -l <number>`: Number of rows to fetch (default: 1000)
- `--dataset, -d <name>`: Dataset name (default: prebid-events, or AXIOM_DATASET env var)
- `--output, -o <path>`: Output file path (default: `ml-pipeline/data/axiom-data-<timestamp>.json`)
- `--start-time <ISO date>`: Start time for query (optional)
- `--end-time <ISO date>`: End time for query (default: now)
- `--help, -h`: Show help message

### Output Format

The script generates JSON files with the following structure:

```json
{
  "metadata": {
    "fetchedAt": "2024-01-15T10:30:00.000Z",
    "datasetName": "prebid-events",
    "limit": 1000,
    "actualCount": 1000,
    "startTime": null,
    "endTime": "2024-01-15T10:30:00.000Z"
  },
  "data": [
    // Array of event objects from Axiom
  ]
}
```

### Environment Variables

- `AXIOM_TOKEN`: Required - Your Axiom API token
- `AXIOM_ORG_ID`: Optional - Your Axiom organization ID
- `AXIOM_DATASET`: Optional - Default dataset name (defaults to "prebid-events")

## Part 2: Python Analysis

### Setup

Install Python dependencies:
```bash
pip install -r requirements.txt
```

### Simple Analysis

Run basic stats:
```bash
python3 simple_analysis.py
```

This will show:
- Total event count
- Event type distribution
- Bidder distribution
- CPM (revenue) statistics
- Latency statistics
