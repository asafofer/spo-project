// DuckDB database module for saving Prebid events
import { DuckDBInstance } from "@duckdb/node-api";

const DB_PATH = "./db/data.db";

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
        ad_unit_request_sizes TEXT,
        ad_unit_response_size TEXT,
        media_types TEXT,
        start BIGINT,
        pbjs_timeout INTEGER,
        session_id TEXT,
        pageview_id TEXT,
        timestamp BIGINT,
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
export async function saveFormattedEvent(event: any): Promise<void> {
  if (!conn) {
    throw new Error("Database connection not initialized");
  }

  const adUnitRequestSizesStr = event.adUnitRequestSizes
    ? JSON.stringify(event.adUnitRequestSizes)
    : null;

  const adUnitResponseSizeStr = event.adUnitResponseSize
    ? JSON.stringify(event.adUnitResponseSize)
    : null;

  const mediaTypesStr = event.mediaTypes
    ? JSON.stringify(event.mediaTypes)
    : null;

  // Convert timestamps to numbers (handle string, bigint, number)
  const startValue = event.start != null ? Number(event.start) : null;
  const timestampValue =
    event.timestamp != null ? Number(event.timestamp) : null;
  const requestTimestampValue =
    event.requestTimestamp != null ? Number(event.requestTimestamp) : null;
  const responseTimestampValue =
    event.responseTimestamp != null ? Number(event.responseTimestamp) : null;

  await conn.run(
    `INSERT INTO bid_events (
      event_type, bidder_code, ad_unit_code, auction_id, bid_id,
      bidder_request_id, request_id, ad_unit_request_sizes, ad_unit_response_size, media_types, start,
      pbjs_timeout, session_id, pageview_id, timestamp, request_timestamp, response_timestamp,
      time_to_respond, cpm, currency, domain, auction_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CAST(? AS BIGINT), ?, ?, ?, CAST(? AS BIGINT), CAST(? AS BIGINT), CAST(? AS BIGINT), ?, ?, ?, ?, ?)`,
    [
      event.eventType || null,
      event.bidderCode || null,
      event.adUnitCode || null,
      event.auctionId || null,
      event.bidId || null,
      event.bidderRequestId || null,
      event.requestId || null,
      adUnitRequestSizesStr,
      adUnitResponseSizeStr,
      mediaTypesStr,
      startValue != null ? String(startValue) : null,
      event.pbjsTimeout || null,
      event.sessionId || null,
      event.pageviewId || null,
      timestampValue != null ? String(timestampValue) : null,
      requestTimestampValue != null ? String(requestTimestampValue) : null,
      responseTimestampValue != null ? String(responseTimestampValue) : null,
      event.timeToRespond || null,
      event.cpm || null,
      event.currency || null,
      event.domain || null,
      event.auctionStatus || null,
    ]
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
    `SELECT * FROM bid_events ORDER BY timestamp DESC LIMIT ${limit}`
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
    "SELECT COUNT(*) as total FROM bid_events"
  );
  const rows = result.getRowObjectsJS();
  return rows[0]?.total || 0;
}
