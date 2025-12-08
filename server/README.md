# Prebid Data Collector Server

Backend server for collecting and storing Prebid.js auction events. Receives formatted event data from the collector script and stores it in a local DuckDB database.

## Setup

Install dependencies:

```bash
bun install
```

## Running the Server

Start the server:

```bash
bun run start
# or
bun run dev
```

The server will:

- Initialize the DuckDB database and create the schema
- Start listening on `http://localhost:3001/events` for POST requests
- Save incoming events to `./db/data.db`

## API Endpoints

### POST `/events`

Receives formatted Prebid event data from the collector script.

**Request Body:**

```json
[
  {
    "eventType": "bidRequested",
    "requestId": "...",
    "pageViewId": "...",
    "bidderCode": "ozone",
    "adUnitCode": "ad-container",
    ...
  }
]
```

**Response:**

```json
{
  "success": true,
  "received": 1
}
```

## Database

The server uses DuckDB to store event data in `./db/data.db`.

### Schema

The `bid_events` table stores:

- `event_type` - Type of event (bidRequested, bidderDone, etc.)
- `request_id` - Auction ID
- `page_view_id` - Page view identifier
- `session_id` - Session identifier (null, should come from Prebid/partner)
- `bidder_code` - Bidder name (e.g., 'ozone')
- `ad_unit_code` - Ad unit identifier
- `ad_unit_request_sizes` - Requested ad sizes (JSON string)
- `ad_unit_format` - Ad format (banner, video, etc.)
- `user_agent` - Browser user agent
- `domain` - Site domain
- `pbjs_timeout` - Prebid timeout setting
- `timestamp` - Event timestamp (BIGINT, milliseconds)
- `bidder_request_id` - Bidder request identifier
- `latency_ms` - Network latency in milliseconds
- `bidder_response_time` - Total bidder response time in milliseconds

## Scripts

### View Data

View all collected events:

```bash
bun run view-data
```

**Note:** The server must be stopped before running this script (DuckDB uses file-level locking).

### Delete Data

Delete all records from the database (with confirmation):

```bash
bun run delete-data
```

**Note:** The server must be stopped before running this script.

### Drop Table

Drop the entire `bid_events` table (with confirmation):

```bash
bun run drop-table
```

**Note:** The server must be stopped before running this script. The table will be automatically recreated when the server restarts.
