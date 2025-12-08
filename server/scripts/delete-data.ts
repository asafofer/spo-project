// Script to delete all data from DuckDB
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

async function deleteData() {
  try {
    const db = await DuckDBInstance.create(DB_PATH);
    const conn = await db.connect();

    console.log("=== DELETING ALL DATA FROM DATABASE ===\n");

    // Get count before deletion
    const countResult = await conn.runAndReadAll(
      "SELECT COUNT(*) as total FROM bid_events"
    );
    const count = countResult.getRowObjectsJS();
    const totalRecords = count[0]?.total || 0;

    if (totalRecords === 0) {
      console.log("Database is already empty.");
      conn.closeSync();
      db.closeSync();
      return;
    }

    console.log(`Found ${totalRecords} record(s) to delete.`);
    console.log("");

    // Ask for confirmation
    const confirmed = await askConfirmation(
      "Are you sure you want to delete ALL data? (yes/no): "
    );

    if (!confirmed) {
      console.log("\nDeletion cancelled.");
      conn.closeSync();
      db.closeSync();
      return;
    }

    console.log("\nDeleting all records...");

    // Delete all records
    await conn.run("DELETE FROM bid_events");

    // Verify deletion
    const verifyResult = await conn.runAndReadAll(
      "SELECT COUNT(*) as total FROM bid_events"
    );
    const verifyCount = verifyResult.getRowObjectsJS();
    const remainingRecords = verifyCount[0]?.total || 0;

    if (remainingRecords === 0) {
      console.log(`\n✓ Successfully deleted ${totalRecords} record(s).`);
    } else {
      console.log(
        `\n⚠ Warning: ${remainingRecords} record(s) still remain in database.`
      );
    }

    conn.closeSync();
    db.closeSync();
  } catch (error: any) {
    if (error?.message?.includes("lock")) {
      console.error(
        "Error: Database is locked. Please stop the server first, then run this script."
      );
    } else {
      console.error("Error deleting data:", error);
    }
    process.exit(1);
  }
}

deleteData();
