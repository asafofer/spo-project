// Script to view data from DuckDB
import { DuckDBInstance } from "@duckdb/node-api";
import Table from "cli-table3";

const DB_PATH = "./db/data.db";

async function viewData() {
  try {
    const db = await DuckDBInstance.create(DB_PATH);
    const conn = await db.connect();

    console.log("=== BID EVENTS DATA ===\n");

    // Get total count
    const countResult = await conn.runAndReadAll(
      "SELECT COUNT(*) as total FROM bid_events"
    );
    const count = countResult.getRowObjectsJS();
    console.log(`Total records: ${count[0]?.total || 0}\n`);

    // Get all data
    const result = await conn.runAndReadAll(
      "SELECT * FROM bid_events ORDER BY timestamp DESC LIMIT 100"
    );
    const rows = result.getRowObjectsJS();

    // Debug: Check first row timestamp
    if (rows.length > 0) {
      console.log(
        "Debug - First row timestamp value:",
        rows[0].timestamp,
        "Type:",
        typeof rows[0].timestamp
      );
    }

    if (rows.length === 0) {
      console.log("No data found in database.");
      conn.closeSync();
      db.closeSync();
      return;
    }

    // Display recent records in a table
    console.log("Recent records (last 100):\n");
    const recordsTable = new Table({
      head: [
        "Event Type",
        "Request ID",
        "Session ID",
        "Page View ID",
        "Bidder",
        "Ad Unit",
        "Format",
        "Request Sizes",
        "User Agent",
        "Domain",
        "pbjs Timeout",
        "Bidder Req ID",
        "Latency (ms)",
        "Response Time (ms)",
        "Timestamp",
      ],
      colWidths: [12, 18, 18, 18, 10, 12, 8, 15, 20, 15, 12, 18, 12, 14, 20],
    });

    rows.forEach((row: any) => {
      var timestamp = "N/A";
      if (row.timestamp != null) {
        // timestamp is BIGINT (milliseconds)
        // DuckDB returns BIGINT as BigInt type, convert to number
        let ts: number;
        if (typeof row.timestamp === "bigint") {
          ts = Number(row.timestamp);
        } else if (typeof row.timestamp === "string") {
          ts = parseInt(row.timestamp, 10);
        } else {
          ts = Number(row.timestamp);
        }

        // Only format if it's a valid positive timestamp
        if (!isNaN(ts) && ts > 0 && ts < Number.MAX_SAFE_INTEGER) {
          timestamp = new Date(ts).toLocaleString();
        }
      }

      // Parse ad_unit_request_sizes if it's a JSON string
      var requestSizes = "N/A";
      if (row.ad_unit_request_sizes) {
        try {
          const sizes = JSON.parse(row.ad_unit_request_sizes);
          requestSizes = Array.isArray(sizes)
            ? sizes
                .map((s: any) => (Array.isArray(s) ? `[${s.join(",")}]` : s))
                .join(", ")
            : String(sizes);
          if (requestSizes.length > 13) {
            requestSizes = requestSizes.substring(0, 13) + "...";
          }
        } catch (e) {
          requestSizes = row.ad_unit_request_sizes?.substring(0, 13) || "N/A";
        }
      }

      // Truncate user agent
      var userAgent = row.user_agent || "N/A";
      if (userAgent.length > 18) {
        userAgent = userAgent.substring(0, 18) + "...";
      }

      recordsTable.push([
        row.event_type || "N/A",
        row.request_id?.substring(0, 16) + "..." || "N/A",
        row.session_id?.substring(0, 16) + "..." || "N/A",
        row.page_view_id?.substring(0, 16) + "..." || "N/A",
        row.bidder_code || "N/A",
        row.ad_unit_code || "N/A",
        row.ad_unit_format || "N/A",
        requestSizes,
        userAgent,
        row.domain || "N/A",
        row.pbjs_timeout || "N/A",
        row.bidder_request_id?.substring(0, 16) + "..." || "N/A",
        row.latency_ms?.toFixed(2) || "N/A",
        row.bidder_response_time?.toFixed(2) || "N/A",
        timestamp,
      ]);
    });

    console.log(recordsTable.toString());

    // Summary by bidder and event type
    console.log("\n=== SUMMARY BY BIDDER ===\n");
    const summaryResult = await conn.runAndReadAll(`
      SELECT 
        bidder_code,
        event_type,
        COUNT(*) as event_count,
        AVG(latency_ms) as avg_latency_ms,
        AVG(bidder_response_time) as avg_response_time
      FROM bid_events
      GROUP BY bidder_code, event_type
      ORDER BY bidder_code, event_type
    `);
    const summaryRows = summaryResult.getRowObjectsJS();

    const summaryTable = new Table({
      head: [
        "Bidder",
        "Event Type",
        "Count",
        "Avg Latency (ms)",
        "Avg Response Time (ms)",
      ],
      colWidths: [12, 14, 8, 16, 18],
    });

    summaryRows.forEach((row: any) => {
      summaryTable.push([
        row.bidder_code || "N/A",
        row.event_type || "N/A",
        row.event_count || 0,
        row.avg_latency_ms?.toFixed(2) || "N/A",
        row.avg_response_time?.toFixed(2) || "N/A",
      ]);
    });

    console.log(summaryTable.toString());

    conn.closeSync();
    db.closeSync();
  } catch (error: any) {
    if (error?.message?.includes("lock")) {
      console.error(
        "Error: Database is locked. Please stop the server first, then run this script."
      );
    } else {
      console.error("Error viewing data:", error);
    }
    process.exit(1);
  }
}

viewData();
