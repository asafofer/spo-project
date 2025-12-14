import { existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Load environment variables from .env file
 * @param rootDir - Root directory where .env file is located
 */
export async function loadEnv(rootDir: string): Promise<void> {
  const envFile = join(rootDir, ".env");
  if (!existsSync(envFile)) {
    return;
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
        if (!process.env[key.trim()]) {
          process.env[key.trim()] = cleanValue;
        }
      }
    }
  }
}
