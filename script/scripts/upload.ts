import { join } from "node:path";
import { existsSync } from "node:fs";
import { confirm, input } from "@inquirer/prompts";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const rootDir = join(import.meta.dir, "..");
const envFile = join(rootDir, ".env");
const distDir = join(rootDir, "dist");
const defaultBuildFile = join(distDir, "collector.prod.js");
const PUBLIC_FILE_URL = "https://trkimp.com/collector.prod.js";

/**
 * Truncate sensitive values for display
 */
function truncateValue(key: string, value: string): string {
  if (key.includes("KEY") || key.includes("SECRET") || key.includes("ID")) {
    if (value.length <= 8) return "***";
    return `${value.substring(0, 4)}...${value.substring(value.length - 4)}`;
  }
  return value;
}

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
 * Create S3 client for R2
 */
function createR2Client(): S3Client {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "Missing R2 credentials. Please set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY in .env"
    );
  }

  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

/**
 * Upload file to Cloudflare R2 using S3 SDK
 */
async function uploadToR2(
  filePath: string,
  bucketName: string,
  objectKey: string
): Promise<void> {
  console.log(`\n📤 Uploading to R2...`);
  console.log(`   Bucket: ${bucketName}`);
  console.log(`   Object Key: ${objectKey}`);
  console.log(`   File: ${filePath}\n`);

  const s3Client = createR2Client();
  const file = Bun.file(filePath);
  const fileContent = await file.arrayBuffer();

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: objectKey,
    Body: new Uint8Array(fileContent),
    ContentType: "text/javascript",
    CacheControl: "public, max-age=3600, stale-while-revalidate=7200",
  });

  // Add Cloudflare-CDN-Cache-Control header via middleware
  command.middlewareStack.add(
    (next) => (args) => {
      const r = args.request as RequestInit;
      r.headers = r.headers || {};
      (r.headers as Record<string, string>)["Cloudflare-CDN-Cache-Control"] =
        "max-age=31536000";
      return next(args);
    },
    { step: "build", name: "cloudflareCDNCacheControl" }
  );

  try {
    const response = await s3Client.send(command);
    console.log(`\n✅ Upload completed successfully!`);
    if (response.ETag) {
      console.log(`   ETag: ${response.ETag}`);
    }

    // Create clickable link using OSC 8 escape sequence
    // Format: \x1b]8;;URL\x1b\\TEXT\x1b]8;;\x1b\\
    const clickableUrl = `\x1b]8;;${PUBLIC_FILE_URL}\x1b\\${PUBLIC_FILE_URL}\x1b]8;;\x1b\\`;
    console.log(`   Public URL: ${clickableUrl}`);
  } catch (error: any) {
    console.error(`❌ Upload failed`);
    throw new Error(`R2 upload failed: ${error.message || error}`);
  }
}

async function runUpload() {
  console.log("🚀 Cloudflare R2 Upload Script\n");

  // Load environment variables
  await loadEnv();

  // Display all R2 configuration values
  const config = {
    R2_BUCKET_NAME: process.env.R2_BUCKET_NAME,
    R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID,
    R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
    R2_OBJECT_NAME: process.env.R2_OBJECT_NAME,
    R2_PUBLIC_URL: process.env.R2_PUBLIC_URL,
  };

  console.log("📋 Configuration Values:\n");
  for (const [key, value] of Object.entries(config)) {
    const displayValue = value ? truncateValue(key, value) : "(not set)";
    console.log(`   ${key}: ${displayValue}`);
  }

  // Use default build file path
  const buildFilePath = defaultBuildFile;

  // Check if file exists
  const buildFileExists = existsSync(buildFilePath);
  if (!buildFileExists) {
    console.log(`\n⚠️  Build file not found: ${buildFilePath}`);
  } else {
    const file = Bun.file(buildFilePath);
    const fileSize = (await file.arrayBuffer()).byteLength;
    const fileSizeMB = (fileSize / (1024 * 1024)).toFixed(2);
    console.log(`\n📦 Build file:`);
    console.log(`   Path: ${buildFilePath}`);
    console.log(`   Size: ${fileSizeMB} MB`);
  }

  // Get object name from env
  const objectName = process.env.R2_OBJECT_NAME;

  // Use object name from env, or prompt if not set
  let finalObjectKey: string;
  if (objectName) {
    finalObjectKey = objectName;
  } else {
    // Prompt for object key if not set in env
    finalObjectKey = await input({
      message: "Enter object key (filename in bucket root):",
      default: "collector.prod.js",
    });
  }

  // Show summary
  console.log("\n📋 Upload Summary:");
  console.log(`   Bucket: ${process.env.R2_BUCKET_NAME}`);
  console.log(`   Object Key: ${finalObjectKey}`);
  if (buildFileExists) {
    const file = Bun.file(buildFilePath);
    const fileSize = (await file.arrayBuffer()).byteLength;
    const fileSizeMB = (fileSize / (1024 * 1024)).toFixed(2);
    console.log(`   File Size: ${fileSizeMB} MB`);
  }
  console.log("\n");

  // Confirm before proceeding
  const confirmed = await confirm({
    message: "Proceed with upload?",
    default: false,
  });

  if (!confirmed) {
    console.log("\n❌ Upload cancelled.");
    process.exit(0);
  }

  // Validate required values before upload
  if (!process.env.R2_BUCKET_NAME) {
    console.error("\n❌ R2_BUCKET_NAME is not set in .env");
    process.exit(1);
  }

  if (!buildFileExists) {
    console.error(`\n❌ Build file not found: ${buildFilePath}`);
    process.exit(1);
  }

  // Upload to R2
  await uploadToR2(buildFilePath, process.env.R2_BUCKET_NAME, finalObjectKey);

  // Display final URL prominently
  // Create clickable link using OSC 8 escape sequence
  const clickableUrl = `\x1b]8;;${PUBLIC_FILE_URL}\x1b\\${PUBLIC_FILE_URL}\x1b]8;;\x1b\\`;
  console.log(`\n🔗 File URL: ${clickableUrl}\n`);
}

// Handle Ctrl+C gracefully
process.on("SIGINT", () => {
  console.log("\n\n⚠️  Upload cancelled by user (Ctrl+C)");
  process.exit(0);
});

runUpload().catch((error) => {
  console.error("❌ Error:", error);
  process.exit(1);
});
