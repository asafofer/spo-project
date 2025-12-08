---
name: Minimal Prebid Data Collector
overview: Create a minimal embeddable script that incrementally collects Prebid.js bid data, starting with namespace detection, event logging, and test bid simulation.
---

# Minimal Prebid Data Collector Plan

## Goal

Create a minimal embeddable script that collects Prebid.js bid data incrementally, step-by-step, to validate the startup hypothesis about eliminating bid waste.

## Architecture

### 1. Test HTML Page (`script/index.html`)

- Simple HTML page that:
  - Embeds Prebid.js (already added by user)
  - Embeds the collector script
  - Sets up test bid simulation with Ozone provider (using test parameters from spec)
  - Has basic ad units for testing

### 2. Embeddable Script (`script/collector.js`)

- Format: Vanilla JS IIFE (self-executing, no build step)
- Incremental development:
  - **Step 1**: Find `_pbjsGlobals` namespace array and log it
  - **Step 2**: Subscribe to Prebid events and log them to console
  - **Step 3**: (Future) Collect and structure the data
  - **Step 4**: (Future) Save to DuckDB

## Implementation Steps (Incremental)

1. **Step 1**: Create `index.html` with Prebid.js, collector script, and Ozone test bid setup
2. **Step 2**: Implement namespace detection in collector.js - find `_pbjsGlobals` array and log it
3. **Step 3**: Subscribe to Prebid events (auctionEnd, bidResponse, etc.) and log them to console
4. **Step 4**: Trigger test bid simulation to generate dummy events for testing
5. **Step 5**: (Future) Structure the collected event data
6. **Step 6**: (Future) Create local server and DuckDB integration

## Files to Create

- `script/index.html` - Test HTML page with Prebid.js, collector script, and Ozone test bid configuration
- `script/collector.js` - Embeddable script (IIFE) - built incrementally

## Todos

- [x] **Step 1**: Create `index.html` with Prebid.js, collector script, and Ozone test bid setup
- [x] **Step 2**: Implement namespace detection in collector.js - find `_pbjsGlobals` array and log it
- [x] **Step 3**: Subscribe to Prebid events (auctionEnd, bidResponse, etc.) and log them to console
- [x] **Step 4**: Trigger test bid simulation to generate dummy events for testing
- [x] **Step 5**: Create local server (Bun + TypeScript) to receive events
- [x] **Step 6**: Send events from collector to server endpoint
- [ ] **Step 7**: Create DuckDB schema and save events to database

## Data to Save (DuckDB Schema)

Based on spec requirements and event structure, we'll save minimal essential data:

### Table: `bid_events`

**Per auction/bidder combination:**

- `auction_id` (TEXT) - Request ID from auction
- `page_view_id` (TEXT) - Page view ID
- `session_id` (TEXT) - Session ID (generate client-side or extract)
- `bidder_code` (TEXT) - Bidder name (e.g., "ozone")
- `ad_unit_code` (TEXT) - Ad unit identifier
- `timestamp` (TIMESTAMP) - When the auction happened

**Metrics:**

- `bidder_called` (INTEGER) - Count of bid requests (from bidRequested events)
- `bidder_responded` (INTEGER) - Count of responses (from bidResponse events)
- `bidder_won` (INTEGER) - Count of wins (from bidWon events)
- `bidder_timed_out` (INTEGER) - Count of timeouts (from bidTimeout events)
- `latency_ms` (FLOAT) - Response latency in milliseconds (from metrics: `adapters.client.ozone.net`)
- `cpm` (FLOAT) - Cost per mille (from bidResponse.cpm, if available)

**Note:** We'll aggregate data from `auctionEnd` event primarily, as it contains most of what we need:

- `bidderRequests` → bidder_called count
- `bidsReceived` → bidder_responded count
- `winningBids` → bidder_won count
- `noBids` → can infer timeouts/no responses
- `metrics.adapters.client.{bidder}.net` → latency_ms

## Notes

- Extremely minimal - incremental development
- Each step must be tested and verified before moving to next
- Start with one provider (Ozone) for test bids
- Focus on logging/verification first, data persistence later
- DuckDB schema defined above - will implement after events are working
