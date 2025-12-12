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
      "SELECT * FROM bid_events ORDER BY event_timestamp DESC LIMIT 100"
    );
    const rows = result.getRowObjectsJS();

    if (rows.length === 0) {
      console.log("No data found in database.");
      conn.closeSync();
      db.closeSync();
      return;
    }

    // Get column names from the first row
    const columnNames = Object.keys(rows[0]);

    // Format column names for display (convert snake_case to Title Case)
    const formatColumnName = (name: string): string => {
      return name
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
    };

    const headers = columnNames.map(formatColumnName);
    const colWidths = columnNames.map(() => 15); // Default width, can be adjusted

    // Display recent records in a table
    console.log("Recent records (last 100):\n");
    const recordsTable = new Table({
      head: headers,
      colWidths: colWidths,
    });

    // Format value based on column name and type
    const formatValue = (value: any, columnName: string): string => {
      if (value == null) return "N/A";

      // Handle timestamps (BIGINT)
      if (
        columnName.includes("timestamp") ||
        columnName === "start" ||
        columnName === "request_timestamp" ||
        columnName === "response_timestamp"
      ) {
        let ts: number;
        if (typeof value === "bigint") {
          ts = Number(value);
        } else if (typeof value === "string") {
          ts = parseInt(value, 10);
        } else {
          ts = Number(value);
        }
        if (!isNaN(ts) && ts > 0 && ts < Number.MAX_SAFE_INTEGER) {
          return new Date(ts).toLocaleString();
        }
        return "N/A";
      }

      // Handle array-ish columns (stored as JSON strings)
      if (
        columnName.includes("sizes") ||
        columnName.includes("media_types") ||
        columnName.includes("response_size")
      ) {
        const formatArray = (arr: any[]): string =>
          arr
            .map((s: any) => (Array.isArray(s) ? `${s.join("x")}` : String(s)))
            .join(", ");

        // Already an array (e.g., TEXT[] or deserialized)
        if (Array.isArray(value)) {
          return formatArray(value);
        }

        // JSON string
        if (typeof value === "string") {
          try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed)) {
              const formatted = formatArray(parsed);
              return formatted.length > 40
                ? formatted.substring(0, 40) + "..."
                : formatted;
            }
            return parsed != null ? String(parsed) : "N/A";
          } catch (e) {
            return value.length > 40 ? value.substring(0, 40) + "..." : value;
          }
        }

        return String(value);
      }

      // Handle CPM (float)
      if (columnName === "cpm") {
        return Number(value).toFixed(4);
      }

      // Handle time_to_respond (integer)
      if (columnName === "time_to_respond") {
        return `${value}ms`;
      }

      // Handle long text fields (truncate IDs)
      if (
        columnName.includes("id") &&
        typeof value === "string" &&
        value.length > 16
      ) {
        return value.substring(0, 16) + "...";
      }

      // Default: convert to string
      return String(value);
    };

    rows.forEach((row: any) => {
      const values = columnNames.map((colName: string) =>
        formatValue(row[colName], colName)
      );
      recordsTable.push(values);
    });

    console.log(recordsTable.toString());

    // Summary by bidder and event type
    console.log("\n=== SUMMARY BY BIDDER ===\n");
    const summaryResult = await conn.runAndReadAll(`
      SELECT 
        bidder_code,
        event_type,
        COUNT(*) as event_count,
        COUNT(DISTINCT auction_id) as unique_auctions,
        COUNT(DISTINCT session_id) as unique_sessions,
        AVG(cpm) as avg_cpm,
        AVG(time_to_respond) as avg_time_to_respond
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
        "Unique Auctions",
        "Unique Sessions",
        "Avg CPM",
        "Avg Time (ms)",
      ],
      colWidths: [12, 14, 8, 16, 16, 10, 12],
    });

    summaryRows.forEach((row: any) => {
      summaryTable.push([
        row.bidder_code || "N/A",
        row.event_type || "N/A",
        row.event_count || 0,
        row.unique_auctions || 0,
        row.unique_sessions || 0,
        row.avg_cpm != null ? Number(row.avg_cpm).toFixed(4) : "N/A",
        row.avg_time_to_respond != null
          ? Number(row.avg_time_to_respond).toFixed(0)
          : "N/A",
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
