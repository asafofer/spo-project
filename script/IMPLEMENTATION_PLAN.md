# Implementation Plan: Research Collector → Production

## Overview

This document outlines the differences between `collector.research.js` (test/improvements) and `collector.prod.js` (current production), and provides a step-by-step plan to implement the improvements.

## Key Differences

### 1. **Event Granularity**

**Current (Prod):**
- Handles `bidRequested` at the **bidderRequest level** (one event per bidder for all ad units)
- Uses `event.bids[0]` to get first bid only

**Research:**
- Handles **individual bids** (one event per bid per ad unit)
- Maps over `bidderRequest.bids` to create separate events for each bid

**Impact:** Research version captures more granular data, allowing tracking of each ad unit separately.

### 2. **Event Types**

**Current (Prod):**
- Fully implemented: `bidRequested`, `bidderDone`
- Placeholders: `bidRejected`, `bidderError`, `bidTimeout`

**Research:**
- Implements: `bidRequested`, `bidTimeout`, `bidResponse`, `bidRejected`, `bidWon`
- Uses different events than prod (`bidResponse` vs `bidderDone`)

**Impact:** Research version tracks more event types with actual implementations.

### 3. **Session & Pageview Management**

**Current (Prod):**
- `sessionId: null` (TODO comment)
- `pageViewId: event.pageViewId || null` (relies on Prebid)

**Research:**
- `getSessionId()` with `sessionStorage` and UUID generation
- `pageviewID` generated on script load
- `addRequiredParams()` enriches all events with session/pageview IDs

**Impact:** Research version has proper client-side session tracking.

### 4. **Event Batching**

**Current (Prod):**
- Sends one event per request: `JSON.stringify([formattedData])`
- Each event triggers separate HTTP request

**Research:**
- Batches multiple events: `data.map(addRequiredParams)`
- Single HTTP request for multiple events

**Impact:** Research version is more efficient, reduces HTTP overhead.

### 5. **Data Extraction**

**Current (Prod):**
- Extracts basic fields from `bidRequested` and `bidderDone`
- Missing: `cpm`, `currency`, `status`, detailed timestamps

**Research:**
- Extracts detailed bid data: `cpm`, `currency`, `status`, `timeToRespond`
- Includes `requestTimestamp`, `responseTimestamp`
- Tracks `bidId`, `bidderRequestId`, `auctionId` for correlation

**Impact:** Research version captures more metrics needed for analysis.

### 6. **Handler Pattern**

**Current (Prod):**
- Separate handler functions per event type
- Direct subscription: `pbjs.onEvent("bidRequested", handleBidRequested)`

**Research:**
- Generic `createHandlerFor(event)` pattern
- Routes to specific handlers based on event type
- More maintainable and extensible

**Impact:** Research version is more maintainable and easier to extend.

### 7. **Event Structure**

**Research extracts:**
- `bidId` - Individual bid request UUID
- `bidderRequestId` - Bidder request UUID (1:N relationship with bids)
- `auctionId` - Auction UUID
- `mediaTypes` - Array of media types
- `sizes` - Array of ad sizes
- `cpm`, `currency`, `status` - Bid response details

**Current (Prod) extracts:**
- `requestId` (from `auctionId`)
- `bidderCode`
- `adUnitCode`
- Basic metadata

**Impact:** Research version has better correlation IDs for tracking bid lifecycle.

## Implementation Plan

### Phase 1: Session & Pageview Management

**Goal:** Add proper client-side session and pageview tracking.

1. **Add UUID generation function**
   ```javascript
   function generateUUID() {
     // Simple UUID v4 generator (or use crypto.randomUUID if available)
   }
   ```

2. **Implement `getSessionId()`**
   - Use `sessionStorage` with try/catch (for private browsing)
   - Generate UUID if not exists
   - Store in `sessionStorage` with key `__sid__`

3. **Generate `pageviewID`**
   - Generate UUID on script load
   - Store in closure variable

4. **Create `addRequiredParams(data)`**
   - Accepts array of event objects
   - Adds: `sessionId`, `pageviewID`, `domain`, `timestamp`
   - Returns enriched array

### Phase 2: Event Batching

**Goal:** Batch multiple events before sending to reduce HTTP overhead.

1. **Create event queue**
   - Array to hold events before sending
   - Batch size limit (e.g., 10 events) or time-based (e.g., 100ms)

2. **Modify `send()` function**
   - Accept array of events
   - Call `addRequiredParams()` to enrich
   - Send as single batch: `JSON.stringify(completeData)`

3. **Update all handlers**
   - Pass arrays to `send()` instead of single objects
   - For `bidRequested`: map over bids and send array

### Phase 3: Granular Bid Handling

**Goal:** Handle individual bids instead of just bidder requests.

1. **Update `handleBidRequested`**
   - Map over `bidderRequest.bids` (not just `bids[0]`)
   - Create separate event for each bid
   - Include: `bidId`, `bidderRequestId`, `auctionId`, `mediaTypes`, `sizes`
   - Fix typo: `bidReuqest` → `bidRequest`

2. **Update data structure**
   - Each event represents one bid (one ad unit)
   - Maintain correlation via `auctionId`, `bidderRequestId`

### Phase 4: Additional Event Handlers

**Goal:** Implement missing event handlers with proper data extraction.

1. **Implement `handleBidTimeout`**
   - Accepts array of timed-out bids
   - Extract: `bidder`, `adUnitCode`, `auctionId`, `bidId`, `sizes`, `timeout`
   - Map over array and send batch

2. **Implement `handleBidResponse`**
   - Extract: `bidder`, `adUnitCode`, `auctionId`, `bidId`, `size`
   - Extract: `requestTimestamp`, `responseTimestamp`, `timeToRespond`
   - Extract: `cpm`, `currency`, `status`
   - Note: `bidderRequestId` may not be available in `bidResponse`

3. **Implement `handleBidRejected`**
   - Extract: `bidder`, `adUnitCode`, `auctionId`, `bidId`
   - Extract: rejection reason (if available)

4. **Implement `handleBidWon`**
   - Extract: `bidder`, `adUnitCode`, `auctionId`, `bidId`
   - Extract: `cpm`, `currency`, `size`

### Phase 5: Refactor Handler Pattern

**Goal:** Use generic handler pattern for better maintainability.

1. **Create `createHandlerFor(event)`**
   - Returns handler function based on event type
   - Routes to specific handlers: `handleBidRequested`, `handleBidTimeout`, `handleBidResponse`, etc.

2. **Update event subscription**
   - Use `events.forEach(event => pbjs.onEvent(event, createHandlerFor(event)))`
   - Cleaner and more maintainable

### Phase 6: Integration & Testing

**Goal:** Ensure all improvements work together.

1. **Test session persistence**
   - Verify `sessionId` persists across page reloads
   - Verify `pageviewID` changes on each page load

2. **Test event batching**
   - Verify multiple events are sent in single request
   - Verify batching doesn't delay critical events too much

3. **Test granular handling**
   - Verify each bid creates separate event
   - Verify correlation IDs match across events

4. **Test all event types**
   - Trigger each event type and verify data extraction
   - Verify backend receives correct data structure

## Code Structure Changes

### Before (Current Prod):
```javascript
function handleBidRequested(event, namespace) {
  var formattedData = formatBidRequestedData(event);
  sendEventToEndpoint(formattedData); // Single event
}
```

### After (Target):
```javascript
function handleBidRequested(bidderRequest) {
  var bids = bidderRequest.bids.map(function(bid) {
    return {
      eventType: 'bidRequest',
      bidder: bid.bidder,
      adUnitCode: bid.adUnitCode,
      auctionId: bid.auctionId,
      bidId: bid.bidId,
      // ... more fields
    };
  });
  send(bids); // Batched events
}

function send(data) {
  var completeData = data.map(addRequiredParams);
  fetch("http://localhost:3001/events", {
    method: "POST",
    body: JSON.stringify(completeData)
  });
}
```

## Backend Compatibility

**Current backend expects:**
- Array of events: `[{eventType, ...}, ...]`
- Already compatible with batching!

**No backend changes needed** - the research version sends arrays, which the backend already handles.

## Migration Strategy

1. **Keep prod version as backup** (`collector.prod.js.backup`)
2. **Implement incrementally** - one phase at a time
3. **Test each phase** before moving to next
4. **Maintain backward compatibility** - ensure existing events still work
5. **Gradual rollout** - test in research environment first

## Notes

- Research version has typo: `bidReuqest` → should be `bidRequest`
- Research version uses `bidRepsonse` → should be `bidResponse`
- Need to handle cases where `bidderRequestId` is not available in `bidResponse`
- Consider adding retry logic for failed batch sends
- Consider adding event queue persistence (localStorage) for offline scenarios


