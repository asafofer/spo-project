# analysis

Analysis queries for Prebid events data stored in Axiom.

## Setup

To install dependencies:

```bash
bun install
```

## Schema Documentation

See [SCHEMA.md](./SCHEMA.md) for the complete schema of the `prebid-events` dataset, including all available fields, their types, and common query patterns.

## Queries

Available queries in `queries/`:

- `session-metrics.ts` - Session-level metrics (sessionId, session depth, revenue, avg time to respond)
- `total-cpm-by-session.ts` - Total CPM per session
- `latency-vs-revenue-by-bidder.ts` - Bidder performance analysis
- `count-by-event-type.ts` - Event type counts
- `count-by-country.ts` - Country-based counts
- `fetch-latest-events.ts` - Fetch recent events

## Running Queries

Run a query directly:

```bash
bun run queries/session-metrics.ts
```

Set the dataset name via environment variable:

```bash
AXIOM_DATASET=prebid-events bun run queries/session-metrics.ts
```

This project was created using `bun init` in bun v1.1.42. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.
