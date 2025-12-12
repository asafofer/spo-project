// DuckDB database module for saving Prebid events
import { DuckDBInstance } from "@duckdb/node-api";

const DB_PATH = "./db/data.db";

interface BidEvent {
  eventType: string;
  bidderCode: string;
  adUnitCode: string;
  auctionId: string;
  bidId?: string;
  bidderRequestId?: string;
  requestId?: string;
  requestSizes?: string[];
  responseSize?: string;
  requestMediaTypes?: string[];
  responseMediaType?: string;
  auctionStart?: number;
  pbjsTimeout?: number;
  sessionId: string;
  pageviewId: string;
  eventTimestamp: number;
  requestTimestamp?: number;
  responseTimestamp?: number;
  timeToRespond?: number;
  cpm?: number;
  currency?: string;
  domain: string;
  auctionStatus?: number;
}

let db: DuckDBInstance | null = null;
let conn: any = null;

// Initialize database and create schema
export async function initDatabase(): Promise<void> {
  try {
    db = await DuckDBInstance.create(DB_PATH);
    conn = await db.connect();

    await conn.run(`
      CREATE TABLE IF NOT EXISTS bid_events (
        event_type TEXT,
        bidder_code TEXT,
        ad_unit_code TEXT,
        auction_id TEXT,
        bid_id TEXT,
        bidder_request_id TEXT,
        request_id TEXT,
        request_sizes TEXT,
        response_size TEXT,
        request_media_types TEXT,
        response_media_type TEXT,
        auction_start BIGINT,
        pbjs_timeout INTEGER,
        session_id TEXT,
        pageview_id TEXT,
        event_timestamp BIGINT,
        request_timestamp BIGINT,
        response_timestamp BIGINT,
        time_to_respond INTEGER,
        cpm FLOAT,
        currency TEXT,
        domain TEXT,
        auction_status INTEGER
      )
    `);

    console.log("[DB] Database initialized and schema created");
  } catch (error) {
    console.error("[DB] Error initializing database:", error);
    throw error;
  }
}

// Save formatted event data from collector - pure insertion, no calculations
export async function saveFormattedEvent(event: BidEvent): Promise<void> {
  if (!conn) {
    throw new Error("Database connection not initialized");
  }

  const requestSizesArr =
    event.requestSizes && Array.isArray(event.requestSizes)
      ? event.requestSizes
          .map((size) => {
            if (size == null) return null;
            if (Array.isArray(size)) return size.join("x");
            return String(size);
          })
          .filter((v): v is string => typeof v === "string" && v.length > 0)
      : null;

  const normalizedRequestSizes =
    requestSizesArr && requestSizesArr.length > 0 ? requestSizesArr : null;
  const requestSizesJson = normalizedRequestSizes
    ? JSON.stringify(normalizedRequestSizes)
    : null;

  const responseSizeStr = event.responseSize
    ? JSON.stringify(event.responseSize)
    : null;

  const requestMediaTypesArr =
    event.requestMediaTypes && Array.isArray(event.requestMediaTypes)
      ? event.requestMediaTypes
          .map((v) => (v == null ? null : String(v)))
          .filter((v): v is string => typeof v === "string" && v.length > 0)
      : null;

  const normalizedRequestMediaTypes =
    requestMediaTypesArr && requestMediaTypesArr.length > 0
      ? requestMediaTypesArr
      : null;
  const requestMediaTypesJson = normalizedRequestMediaTypes
    ? JSON.stringify(normalizedRequestMediaTypes)
    : null;

  // Response media type is a single string (e.g., "banner", "video")
  const responseMediaTypeStr =
    event.responseMediaType != null ? String(event.responseMediaType) : null;

  // Convert timestamps to numbers (handle string, bigint, number)
  // Use BigInt for timestamp-like fields to avoid precision/overflow issues
  const auctionStart =
    event.auctionStart != null ? BigInt(event.auctionStart) : null;
  const eventTimestamp =
    event.eventTimestamp != null ? BigInt(event.eventTimestamp) : null;
  const requestTimestampValue =
    event.requestTimestamp != null ? BigInt(event.requestTimestamp) : null;
  const responseTimestampValue =
    event.responseTimestamp != null ? BigInt(event.responseTimestamp) : null;

  await conn.run(
    `INSERT INTO bid_events (
      event_type,
      bidder_code,
      ad_unit_code,
      auction_id,
      bid_id,
      bidder_request_id,
      request_id,
      request_sizes,
      response_size,
      request_media_types,
      response_media_type,
      auction_start,
      pbjs_timeout,
      session_id,
      pageview_id,
      event_timestamp,
      request_timestamp,
      response_timestamp,
      time_to_respond,
      cpm,
      currency,
      domain,
      auction_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      event.eventType || null,
      event.bidderCode || null,
      event.adUnitCode || null,
      event.auctionId || null,
      event.bidId || null,
      event.bidderRequestId || null,
      event.requestId || null,
      requestSizesJson,
      responseSizeStr,
      requestMediaTypesJson,
      responseMediaTypeStr,
      auctionStart,
      event.pbjsTimeout || null,
      event.sessionId || null,
      event.pageviewId || null,
      eventTimestamp,
      requestTimestampValue,
      responseTimestampValue,
      event.timeToRespond || null,
      event.cpm || null,
      event.currency || null,
      event.domain || null,
      event.auctionStatus || null,
    ],
  );
}

// Save events - process formatted events from collector
export async function saveEvents(events: any[]): Promise<void> {
  if (!conn) {
    throw new Error("Database connection not initialized");
  }

  // Save each formatted event directly
  for (const event of events) {
    try {
      await saveFormattedEvent(event);
    } catch (error) {
      console.error(`[DB] Error saving event ${event.eventType}:`, error);
    }
  }

  console.log(`[DB] Saved ${events.length} event(s) to database`);
}

// Query data from database
export async function getData(limit: number = 100): Promise<any[]> {
  if (!conn) {
    throw new Error("Database connection not initialized");
  }

  const result = await conn.runAndReadAll(
    `SELECT * FROM bid_events ORDER BY event_timestamp DESC LIMIT ${limit}`,
  );
  return result.getRowObjectsJS();
}

// Get summary by bidder
export async function getSummary(): Promise<any[]> {
  if (!conn) {
    throw new Error("Database connection not initialized");
  }

  const result = await conn.runAndReadAll(`
    SELECT 
      bidder_code,
      event_type,
      COUNT(*) as event_count
    FROM bid_events
    GROUP BY bidder_code, event_type
    ORDER BY bidder_code, event_type
  `);
  return result.getRowObjectsJS();
}

// Get total count
export async function getCount(): Promise<number> {
  if (!conn) {
    throw new Error("Database connection not initialized");
  }

  const result = await conn.runAndReadAll(
    "SELECT COUNT(*) as total FROM bid_events",
  );
  const rows = result.getRowObjectsJS();
  return rows[0]?.total || 0;
}
