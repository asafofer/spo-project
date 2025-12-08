# Prebid Data Collector - How It Works

## Overview

The production collector (`collector.prod.js`) is a minimal, embeddable script designed to locate all Prebid.js instances on a page and subscribe to their auction events for data collection. It formats event data and sends it to a backend endpoint for storage.

## Execution Flow

```
Script Loads → Initialize Prebid Queue → Locate All Prebid Instances → Subscribe to Events on Each → Format & Send Events
```

1. **Script loads** (IIFE executes immediately when script tag loads)
2. **Initialize Prebid Queue** - `window.pbjs.que` is initialized if not present
3. **Add to Queue** - The main subscription logic is pushed to `window.pbjs.que`. This ensures it runs *before* Prebid processes its own commands, guaranteeing early event capture
4. **Locate all Prebid instances** - Finds all `pbjs` instances via `window.pbjs` and `_pbjsGlobals`
5. **Subscribe to each** - Registers event listeners for 10 event types on each instance found
6. **Format & Send** - Formats event data and sends it to the backend endpoint (`http://localhost:3001/events`)

## Key Functions

### `locatePrebidInstance()`

- Checks for `window._pbjsGlobals` array (contains all Prebid namespaces)
- Returns an array of namespaces or `null`

### `getNamespaceName(pbjsInstance)`

- Determines the string name (e.g., 'pbjs') associated with a given Prebid instance
- Prioritizes checking `window.pbjs` and `_pbjsGlobals` for efficiency
- Falls back to searching common Prebid-related properties on the `window` object if not found quickly

### `getAllPbjsInstances()`

- Aggregates all detected Prebid instances
- Includes the default `window.pbjs` instance
- Iterates through `_pbjsGlobals` to find additional namespaced instances
- Returns an array of objects, each containing `{ instance: pbjsObject, namespace: 'name' }`

### `formatBidRequestedData(event)`

- Formats `bidRequested` event data according to the specified backend shape
- Extracts: requestId, pageViewId, bidderCode, adUnitCode, adUnitRequestSizes, adUnitFormat, userAgent, domain, pbjsTimeout, timestamp, bidderRequestId
- Sets `sessionId` to `null` (should come from Prebid or partner's system)

### `formatBidderDoneData(event)`

- Formats `bidderDone` event data according to the specified backend shape
- Extracts: requestId, pageViewId, bidderCode, adUnitCode, adUnitRequestSizes, adUnitFormat, userAgent, domain, timestamp, bidderRequestId, latencyMs, bidderResponseTime
- Sets `sessionId` to `null` (should come from Prebid or partner's system)

### `sendEventToEndpoint(formattedData)`

- Sends formatted event data to the backend endpoint (`http://localhost:3001/events`)
- Uses `fetch()` API with POST method
- Fires and forgets (doesn't block or retry on failure)
- Sends data as JSON array: `[formattedData]`

### `handleBidRequested(event, namespace)`

- Logs the raw `bidRequested` event
- Formats the event data using `formatBidRequestedData()`
- Logs the formatted data
- Sends formatted data to backend via `sendEventToEndpoint()`

### `handleBidderDone(event, namespace)`

- Logs the raw `bidderDone` event
- Formats the event data using `formatBidderDoneData()`
- Logs the formatted data
- Sends formatted data to backend via `sendEventToEndpoint()`

### `handleBidRejected(event, namespace)`, `handleBidderError(event, namespace)`, `handleBidTimeout(event, namespace)`

- Placeholder handlers that log the raw event
- Include TODOs for future implementation based on spec.md

### `subscribeToEvents(pbjs, namespace)`

- Subscribes to 10 specific event types:
  - `auctionInit`, `auctionEnd`, `bidResponse`, `bidTimeout`, `bidWon`
  - `seatNonBid`, `bidRejected`, `bidRequested`, `bidderDone`, `bidderError`
- Uses `pbjs.onEvent(eventType, callback)` for each event
- Each event handler executes synchronously when events fire (no deferral)
- Includes specific handlers for `bidRequested`, `bidderDone`, `bidRejected`, `bidderError`, `bidTimeout`

### `initCollector()`

- Called as a fallback if `pbjs.que` is already processed or for direct initialization
- Locates all Prebid instances and subscribes to their events
- Includes a retry mechanism with a `MAX_RETRIES` limit (50 retries, 5 seconds total) to wait for Prebid to load

### `setupSubscriptionViaQueue()`

- The primary entry point for subscription
- Pushes the main subscription logic into `window.pbjs.que`
- Ensures the collector's event listeners are registered as early as possible in Prebid's lifecycle

## Event Subscription

Events are subscribed using Prebid's `onEvent()` API. The collector uses `pbjs.que.push()` to ensure subscription happens before Prebid processes its own commands:

```javascript
window.pbjs.que.push(function () {
  // Subscribe to events - this runs before Prebid processes anything
  pbjs.onEvent("bidRequested", function (event) {
    handleBidRequested(event, namespace);
  });
});
```

**Important**: By using `pbjs.que`, the collector guarantees it subscribes to events before any auctions start, capturing all events from the very beginning.

## Script Load Order

**Current order in `index.html`:**

```html
<script src="collector.prod.js"></script>
<!-- Loads first -->
<script src="prebid/prebid.js"></script>
<!-- Then Prebid -->
<script src="prebid/config.js"></script>
<!-- Then config -->
```

**Why this order?**

- Collector needs to subscribe **before** auctions start
- If Prebid loads first, early events may be missed
- Current order ensures subscription happens early

## Expected Log Sequence

- `[Collector Event] pbjs auctionInit: {...}` (and other events as they fire)
- `[Collector Event] pbjs bidRequested (raw): {...}`
- `[Collector Event] pbjs bidRequested (formatted): {...}`
- `[Collector Event] pbjs bidderDone (raw): {...}`
- `[Collector Event] pbjs bidderDone (formatted): {...}`
- `[Collector] Max retries (50) reached. Prebid not found.` (only if Prebid fails to load after 5 seconds)
- `[Collector] Error subscribing to pbjs eventType: {...}` (only if a subscription fails)

**Note**: The collector uses the actual namespace name (e.g., 'pbjs') in logs instead of a generic instance index. Event handlers execute synchronously when events fire, with no deferral mechanisms.
