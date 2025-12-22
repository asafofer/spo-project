# Prebid Events Dataset Schema

This document describes the schema of the `prebid-events` dataset in Axiom. Use this reference when writing queries to understand available fields and their types.

## Field Types

- **Timestamp/Time** (⏰): Time-based fields
- **String** (S): Text fields
- **Number** (N): Numeric fields
- **Array** ([]): Array fields
- **Unknown/Nullable** (?): Fields that may be null or have variable types

## Fields

### Timestamp Fields

| Field      | Type | Description                       |
| ---------- | ---- | --------------------------------- |
| `_sysTime` | ⏰   | System timestamp (Axiom internal) |
| `_time`    | ⏰   | Event timestamp                   |

### String Fields

| Field               | Type | Description                                                                                    |
| ------------------- | ---- | ---------------------------------------------------------------------------------------------- |
| `adUnitCode`        | S    | Ad unit identifier                                                                             |
| `auctionId`         | S    | Auction identifier                                                                             |
| `bidderCode`        | S    | Bidder name (e.g., 'ozone', 'pubmatic')                                                        |
| `bidderRequestId`   | S    | Bidder request identifier                                                                      |
| `bidId`             | S    | Bid identifier                                                                                 |
| `browser`           | S    | Browser name (from user agent parsing)                                                         |
| `currency`          | S    | Currency code (e.g., 'USD')                                                                    |
| `domain`            | S    | Site domain                                                                                    |
| `eventType`         | S    | Event type: `bidRequested`, `bidResponse`, `bidRejected`, `bidWon`, `bidTimeout`, `auctionEnd` |
| `ip`                | S    | IP address (when available)                                                                    |
| `os`                | S    | Operating system (from user agent parsing)                                                     |
| `pageviewId`        | S    | Page view identifier (unique per page load)                                                    |
| `rejectionReason`   | S    | Reason for bid rejection (if applicable)                                                       |
| `requestId`         | S    | Request identifier                                                                             |
| `responseMediaType` | S    | Media type of the response (e.g., 'banner', 'video')                                           |
| `sessionId`         | S    | Session identifier (persists across page reloads)                                              |
| `ua`                | S    | Full user agent string                                                                         |
| `version`           | S    | Collector script version                                                                       |
| `yotoCountry`       | S    | Country code from yotoApp (when available)                                                     |

### Number Fields

| Field               | Type | Description                                                            |
| ------------------- | ---- | ---------------------------------------------------------------------- |
| `auctionStart`      | N    | Auction start timestamp (milliseconds)                                 |
| `auctionStatus`     | N    | Auction status (1 = won, 0 = not won)                                  |
| `cpm`               | N    | Cost per mille (price per 1000 impressions)                            |
| `eventTimestamp`    | N    | Event timestamp (milliseconds)                                         |
| `pbjsTimeout`       | N    | Prebid.js timeout setting (milliseconds)                               |
| `requestTimestamp`  | N    | Request timestamp (milliseconds)                                       |
| `responseTimestamp` | N    | Response timestamp (milliseconds)                                      |
| `timeToRespond`     | N    | Time to respond in milliseconds (responseTimestamp - requestTimestamp) |

### Array Fields

| Field               | Type | Description                                               |
| ------------------- | ---- | --------------------------------------------------------- |
| `requestMediaTypes` | []   | Array of requested media types                            |
| `requestSizes`      | []   | Array of requested ad sizes (e.g., ['300x250', '728x90']) |

### Unknown/Nullable Fields

| Field          | Type | Description                           |
| -------------- | ---- | ------------------------------------- |
| `responseSize` | ?    | Response size (may be string or null) |

## Notes

- Revenue is calculated as `wonCpm / 1000` (CPM to dollars)
- Session depth is typically measured as distinct pageview count per session
- `timeToRespond` is only available for bid response events (bidResponse, bidRejected, bidWon)
- `cpm` is only available for bid response events
- `auctionStatus` is 1 for winning bids, 0 otherwise
