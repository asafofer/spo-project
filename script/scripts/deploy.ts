import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { spawn } from "bun";
import { input, select } from "@inquirer/prompts";
import { bumpVersion } from "./version.ts";

const scriptDir = import.meta.dir;
const rootDir = join(scriptDir, "..");
const packageJsonPath = join(rootDir, "package.json");

/**
 * Run a command and wait for it to complete
 */
async function runCommand(
  command: string[],
  description: string,
  interactive: boolean = false
): Promise<boolean> {
  console.log(`\n${description}...`);
  console.log(`Running: ${command.join(" ")}\n`);

  const proc = spawn(command, {
    cwd: rootDir,
    stdout: "inherit",
    stderr: "inherit",
    stdin: interactive ? "inherit" : "ignore",
  });

  const exitCode = await proc.exited;
  return exitCode === 0;
}

/**
 * Get current version from package.json
 */
async function getCurrentVersion(): Promise<string> {
  try {
    const packageJsonContent = await readFile(packageJsonPath, "utf-8");
    const packageJson = JSON.parse(packageJsonContent);
    return packageJson.version || "0.0.0";
  } catch (error) {
    console.error("Error reading package.json:", error);
    return "0.0.0";
  }
}

async function deploy() {
  console.log("🚀 Deployment Script\n");

  // Get and display current version
  const currentVersion = await getCurrentVersion();
  console.log(`📦 Current version: ${currentVersion}\n`);

  // Prompt for version bump
  const versionBump = await select({
    message: "Select version bump type:",
    choices: [
      {
        name: `Patch (${currentVersion} → ${bumpVersion(
          currentVersion,
          "patch"
        )})`,
        value: "patch",
      },
      {
        name: `Minor (${currentVersion} → ${bumpVersion(
          currentVersion,
          "minor"
        )})`,
        value: "minor",
      },
      {
        name: `Major (${currentVersion} → ${bumpVersion(
          currentVersion,
          "major"
        )})`,
        value: "major",
      },
    ],
  });

  // Bump version
  const bumpSuccess = await runCommand(
    ["bun", "run", "scripts/version.ts", versionBump],
    `📦 Bumping version (${versionBump})`
  );

  if (!bumpSuccess) {
    console.error("\n❌ Version bump failed. Deployment aborted.");
    process.exit(1);
  }

  // Get the new version
  const newVersion = await getCurrentVersion();
  console.log(`\n✅ Version updated to: ${newVersion}\n`);

  // Prompt for sample rate
  const sampleRateInput = await input({
    message: "Enter sample rate (0-100):",
    default: "100",
    validate: (value) => {
      const num = parseInt(value, 10);
      if (isNaN(num) || num < 0 || num > 100) {
        return "Sample rate must be a number between 0 and 100";
      }
      return true;
    },
  });

  const sampleRate = parseInt(sampleRateInput, 10);

  console.log(`📋 Deployment Configuration:`);
  console.log(`   Sample Rate: ${sampleRate}%\n`);

  // Step 1: Build
  const buildSuccess = await runCommand(
    ["bun", "run", "scripts/build.ts", `--sample-rate=${sampleRate}`],
    "🔨 Building"
  );

  if (!buildSuccess) {
    console.error("\n❌ Build failed. Deployment aborted.");
    process.exit(1);
  }

  // Step 2: Run tests
  const testSuccess = await runCommand(["bun", "test"], "🧪 Running tests");

  if (!testSuccess) {
    console.error("\n❌ Tests failed. Deployment aborted.");
    process.exit(1);
  }

  console.log("\nDeployment preparation completed successfully:\n");
  console.log("Build: ✅");
  console.log("Tests: ✅");

  // Step 3: Upload to R2
  console.log("\n📤 Proceeding to upload...\n");
  const uploadSuccess = await runCommand(
    ["bun", "run", "upload"],
    "🚀 Uploading to R2",
    true // Interactive - needs stdin for prompts
  );

  if (!uploadSuccess) {
    console.error("\n❌ Upload failed. Deployment incomplete.");
    process.exit(1);
  }

  // Step 4: Purge cache
  console.log("\n🗑️  Proceeding to purge cache...\n");
  const purgeSuccess = await runCommand(
    ["bun", "run", "purge-cache"],
    "🗑️  Purging Cloudflare cache",
    true // Interactive - needs stdin for prompts
  );

  if (!purgeSuccess) {
    console.error("\n❌ Cache purge failed. Deployment incomplete.");
    process.exit(1);
  }

  console.log("\n✅ Deployment completed successfully:\n");
  console.log("Build: ✅");
  console.log("Tests: ✅");
  console.log("Upload: ✅");
  console.log("Cache Purge: ✅\n");
}

deploy().catch((error) => {
  console.error("❌ Deployment error:", error);
  process.exit(1);
});
