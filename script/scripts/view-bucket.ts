import { existsSync } from "node:fs";
import { join } from "node:path";
import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";

const rootDir = join(import.meta.dir, "..");
const envFile = join(rootDir, ".env");

// Load env
if (!existsSync(envFile)) {
  console.error("❌ .env file not found");
  process.exit(1);
}

const envContent = await Bun.file(envFile).text();
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith("#")) {
    const [key, ...valueParts] = trimmed.split("=");
    if (key && valueParts.length > 0) {
      process.env[key.trim()] = valueParts
        .join("=")
        .trim()
        .replace(/^["']|["']$/g, "");
    }
  }
}

// Create client
const client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

// List objects
try {
  const result = await client.send(
    new ListObjectsV2Command({ Bucket: process.env.R2_BUCKET_NAME })
  );
  console.log(`✅ Authenticated\n`);
  console.log(`Objects in ${process.env.R2_BUCKET_NAME}:\n`);
  const objects = (result.Contents || []).sort((a, b) => {
    const dateA = a.LastModified?.getTime() || 0;
    const dateB = b.LastModified?.getTime() || 0;
    return dateB - dateA; // Descending order (newest first)
  });
  if (objects.length === 0) {
    console.log("(empty)");
  } else {
    const tableData = objects.map((obj) => ({
      Key: obj.Key,
      Size: `${(obj.Size! / 1024).toFixed(2)} KB`,
      "Last Modified": obj.LastModified
        ? new Date(obj.LastModified).toLocaleString()
        : "unknown",
    }));
    console.table(tableData);
  }
} catch (error: any) {
  console.error(`❌ Error: ${error.message}`);
  process.exit(1);
}
