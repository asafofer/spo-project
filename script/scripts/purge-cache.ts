import { join } from "node:path";
import { existsSync } from "node:fs";
import { confirm } from "@inquirer/prompts";

const rootDir = join(import.meta.dir, "..");
const envFile = join(rootDir, ".env");

/**
 * Load environment variables from .env file
 */
async function loadEnv(): Promise<void> {
  if (!existsSync(envFile)) {
    console.error(`❌ .env file not found: ${envFile}`);
    process.exit(1);
  }

  const envContent = Bun.file(envFile);
  const text = await envContent.text();

  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const [key, ...valueParts] = trimmed.split("=");
      if (key && valueParts.length > 0) {
        const value = valueParts.join("=").trim();
        const cleanValue = value.replace(/^["']|["']$/g, "");
        process.env[key.trim()] = cleanValue;
      }
    }
  }
}

/**
 * Purge Cloudflare cache for specified URLs
 */
async function purgeCache(urls: string[]): Promise<any> {
  const zoneId = process.env.CLOUDFLARE_ZONE_ID;
  const apiToken = process.env.CLOUDFLARE_PURGE_API_TOKEN;

  if (!zoneId || !apiToken) {
    throw new Error(
      "Missing Cloudflare credentials. Please set CLOUDFLARE_ZONE_ID and CLOUDFLARE_PURGE_API_TOKEN in .env"
    );
  }

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        files: urls,
      }),
    }
  );

  if (!response.ok) {
    const errorData = (await response.json()) as {
      success?: boolean;
      errors?: Array<{ code?: number; message?: string }>;
    };

    const statusText = response.statusText;
    const statusCode = response.status;

    let errorMessage = `HTTP ${statusCode} ${statusText}`;

    if (errorData.errors && errorData.errors.length > 0) {
      const errorMessages = errorData.errors
        .map(
          (err) => `[${err.code || "N/A"}] ${err.message || "Unknown error"}`
        )
        .join("\n   ");
      errorMessage += `\n   ${errorMessages}`;
    }

    throw new Error(errorMessage);
  }

  const result = await response.json();
  return result;
}

async function runPurgeCache() {
  console.log("🗑️  Cloudflare Cache Purge Script\n");

  // Load environment variables
  await loadEnv();

  // Use hardcoded public URL (same as upload script)
  const urlToPurge = "https://trkimp.com/collector.prod.js";

  console.log("\n📋 Files to purge:");
  console.log(`   ${urlToPurge}\n`);

  // Confirm before purging
  const confirmed = await confirm({
    message: "Proceed with cache purge?",
    default: false,
  });

  if (!confirmed) {
    console.log("\n❌ Cache purge cancelled.");
    process.exit(0);
  }

  // Validate required values
  if (
    !process.env.CLOUDFLARE_ZONE_ID ||
    !process.env.CLOUDFLARE_PURGE_API_TOKEN
  ) {
    console.error(
      "\n❌ CLOUDFLARE_ZONE_ID and CLOUDFLARE_PURGE_API_TOKEN must be set in .env"
    );
    process.exit(1);
  }

  // Purge cache
  try {
    console.log("\n🗑️  Purging cache...");
    const result = await purgeCache([urlToPurge]);
    console.log("\n✅ Cache purge completed successfully!");
    if (result.success) {
      console.log(`   Purged: ${urlToPurge}`);
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`\n❌ Cache purge failed: ${errorMessage}`);
    process.exit(1);
  }
}

// Handle Ctrl+C gracefully
process.on("SIGINT", () => {
  console.log("\n\n⚠️  Cache purge cancelled by user (Ctrl+C)");
  process.exit(0);
});

runPurgeCache().catch((error: unknown) => {
  const errorMessage = error instanceof Error ? error.message : String(error);
  console.error("❌ Error:", errorMessage);
  process.exit(1);
});
