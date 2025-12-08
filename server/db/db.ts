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

    // Create table with new schema
    // Schema matches formatted data from collector.prod.js
    await conn.run(`
      CREATE TABLE IF NOT EXISTS bid_events (
        event_type TEXT,
        request_id TEXT,
        page_view_id TEXT,
        session_id TEXT,
        bidder_code TEXT,
        ad_unit_code TEXT,
        ad_unit_request_sizes TEXT,
        ad_unit_format TEXT,
        user_agent TEXT,
        domain TEXT,
        pbjs_timeout INTEGER,
        timestamp BIGINT,
        bidder_request_id TEXT,
        latency_ms FLOAT,
        bidder_response_time FLOAT
      )
    `);

    console.log("[DB] Database initialized and schema created");
  } catch (error) {
    console.error("[DB] Error initializing database:", error);
    throw error;
  }
}

// Save formatted event data from collector
export async function saveFormattedEvent(event: any): Promise<void> {
  if (!conn) {
    throw new Error("Database connection not initialized");
  }

  // Convert adUnitRequestSizes array to JSON string for storage
  var adUnitRequestSizesStr = null;
  if (event.adUnitRequestSizes) {
    try {
      adUnitRequestSizesStr = JSON.stringify(event.adUnitRequestSizes);
    } catch (e) {
      // If stringify fails, store as null
    }
  }

  // Convert timestamp to number if it's a string
  var timestampValue = event.timestamp;
  if (typeof timestampValue === "string") {
    timestampValue = new Date(timestampValue).getTime();
  }
  // Ensure it's a valid number
  if (typeof timestampValue === "bigint") {
    timestampValue = Number(timestampValue);
  }
  if (!timestampValue || isNaN(timestampValue)) {
    timestampValue = Date.now();
  }
  // Ensure it's a positive integer (milliseconds since epoch)
  timestampValue = Math.floor(Number(timestampValue));

  await conn.run(
    `INSERT INTO bid_events (
      event_type, request_id, page_view_id, session_id, bidder_code,
      ad_unit_code, ad_unit_request_sizes, ad_unit_format, user_agent,
      domain, pbjs_timeout, timestamp, bidder_request_id,
      latency_ms, bidder_response_time
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CAST(? AS BIGINT), ?, ?, ?)`,
    [
      event.eventType || null,
      event.requestId || null,
      event.pageViewId || null,
      event.sessionId || null,
      event.bidderCode || null,
      event.adUnitCode || null,
      adUnitRequestSizesStr,
      event.adUnitFormat || null,
      event.userAgent || null,
      event.domain || null,
      event.pbjsTimeout || null,
      String(timestampValue), // Convert to string for CAST to BIGINT
      event.bidderRequestId || null,
      event.latencyMs || null,
      event.bidderResponseTime || null,
    ]
  );
}

// Extract and save data from auctionEnd event (legacy - kept for backward compatibility)
export async function saveAuctionEndEvent(event: any): Promise<void> {
  if (!conn) {
    throw new Error("Database connection not initialized");
  }

  const args = event.args || {};

  const auctionId = args.auctionId || null;
  // Use sessionId and pageViewId from enriched event (added by collector)
  // Fallback to extracting from event args if not present
  const sessionId =
    event.sessionId || args.bidderRequests?.[0]?.pageViewId || null;
  const pageViewId =
    event.pageViewId || args.bidderRequests?.[0]?.pageViewId || null;
  // Convert timestamp to ISO string format that DuckDB can parse
  const timestamp = new Date(args.timestamp || Date.now()).toISOString();

  // Process each bidder request
  const bidderRequests = args.bidderRequests || [];
  const bidsReceived = args.bidsReceived || [];
  const winningBids = args.winningBids || [];
  const noBids = args.noBids || [];

  // Group data by bidder
  const bidderData = new Map<string, any>();

  // Count requests per bidder
  bidderRequests.forEach((req: any) => {
    const bidderCode = req.bidderCode;
    if (!bidderData.has(bidderCode)) {
      bidderData.set(bidderCode, {
        bidderCode,
        adUnitCode: req.bids?.[0]?.adUnitCode || null,
        called: 0,
        responded: 0,
        won: 0,
        timedOut: 0,
        latency: null,
        cpm: null,
      });
    }
    bidderData.get(bidderCode)!.called += req.bids?.length || 0;

    // Extract latency from metrics
    const metrics = req.metrics || {};
    const latencyKey = `adapters.client.${bidderCode}.net`;
    if (metrics[latencyKey] && Array.isArray(metrics[latencyKey])) {
      bidderData.get(bidderCode)!.latency = metrics[latencyKey][0];
    }
  });

  // Count responses per bidder
  bidsReceived.forEach((bid: any) => {
    const bidderCode = bid.bidder || bid.bidderCode;
    if (bidderData.has(bidderCode)) {
      bidderData.get(bidderCode)!.responded += 1;
      if (bid.cpm) {
        bidderData.get(bidderCode)!.cpm = bid.cpm;
      }
    }
  });

  // Count wins per bidder
  winningBids.forEach((bid: any) => {
    const bidderCode = bid.bidder || bid.bidderCode;
    if (bidderData.has(bidderCode)) {
      bidderData.get(bidderCode)!.won += 1;
    }
  });

  // Count timeouts (noBids)
  noBids.forEach((bid: any) => {
    const bidderCode = bid.bidder;
    if (bidderData.has(bidderCode)) {
      bidderData.get(bidderCode)!.timedOut += 1;
    }
  });

  // Insert each bidder's data
  for (const data of bidderData.values()) {
    await conn.run(
      `INSERT INTO bid_events (
        auction_id, page_view_id, session_id, bidder_code, ad_unit_code,
        timestamp, bidder_called, bidder_responded, bidder_won,
        bidder_timed_out, latency_ms, cpm
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        auctionId,
        pageViewId,
        sessionId,
        data.bidderCode,
        data.adUnitCode,
        timestamp,
        data.called,
        data.responded,
        data.won,
        data.timedOut,
        data.latency,
        data.cpm,
      ]
    );
  }

  console.log(
    `[DB] Saved ${bidderData.size} bidder record(s) for auction ${auctionId}`
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
      COUNT(*) as auction_count,
      SUM(bidder_called) as total_called,
      SUM(bidder_responded) as total_responded,
      SUM(bidder_won) as total_won,
      SUM(bidder_timed_out) as total_timed_out,
      AVG(latency_ms) as avg_latency_ms,
      AVG(cpm) as avg_cpm
    FROM bid_events
    GROUP BY bidder_code
    ORDER BY total_called DESC
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
