// Script to drop the bid_events table from DuckDB
import { DuckDBInstance } from "@duckdb/node-api";
import { createInterface } from "readline";

const DB_PATH = "./db/data.db";

/**
 * Prompt user for confirmation
 * @param {string} question - The question to ask
 * @returns {Promise<boolean>} True if user confirmed, false otherwise
 */
function askConfirmation(question: string): Promise<boolean> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      const normalized = answer.trim().toLowerCase();
      resolve(normalized === "y" || normalized === "yes");
    });
  });
}

async function dropTable() {
  try {
    const db = await DuckDBInstance.create(DB_PATH);
    const conn = await db.connect();

    console.log("=== DROPPING bid_events TABLE ===\n");

    // Check if table exists
    try {
      const checkResult = await conn.runAndReadAll(
        "SELECT COUNT(*) as count FROM bid_events",
      );
      const count = checkResult.getRowObjectsJS()[0]?.count || 0;
      console.log(`Table contains ${count} record(s).`);
    } catch (e) {
      console.log("Table does not exist or is empty.");
      conn.closeSync();
      db.closeSync();
      return;
    }

    console.log("");

    // Ask for confirmation
    const confirmed = await askConfirmation(
      "Are you sure you want to drop the bid_events table? (yes/no): ",
    );

    if (!confirmed) {
      console.log("\nDrop cancelled.");
      conn.closeSync();
      db.closeSync();
      return;
    }

    console.log("\nDropping table...");

    // Drop the table
    await conn.run("DROP TABLE IF EXISTS bid_events");

    console.log("\n✓ Successfully dropped bid_events table.");

    conn.closeSync();
    db.closeSync();
  } catch (error: any) {
    if (error?.message?.includes("lock")) {
      console.error(
        "Error: Database is locked. Please stop the server first, then run this script.",
      );
    } else {
      console.error("Error dropping table:", error);
    }
    process.exit(1);
  }
}

dropTable();
