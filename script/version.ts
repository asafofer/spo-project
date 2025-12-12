// Version bumping script using semver
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const PACKAGE_JSON_PATH = join(import.meta.dir, "package.json");

/**
 * Parse version string into major.minor.patch
 */
function parseVersion(version: string): [number, number, number] {
  const parts = version.replace(/^v/, "").split(".").map(Number);
  return [parts[0] || 0, parts[1] || 0, parts[2] || 0];
}

/**
 * Format version array into string
 */
function formatVersion([major, minor, patch]: [
  number,
  number,
  number,
]): string {
  return `${major}.${minor}.${patch}`;
}

/**
 * Bump version according to semver type
 */
function bumpVersion(
  current: string,
  type: "major" | "minor" | "patch",
): string {
  const [major, minor, patch] = parseVersion(current);

  switch (type) {
    case "major":
      return formatVersion([major + 1, 0, 0]);
    case "minor":
      return formatVersion([major, minor + 1, 0]);
    case "patch":
      return formatVersion([major, minor, patch + 1]);
    default:
      throw new Error(`Invalid version type: ${type}`);
  }
}

async function main() {
  const type = (process.argv[2] || "patch") as "major" | "minor" | "patch";

  if (!["major", "minor", "patch"].includes(type)) {
    console.error(`Invalid version type: ${type}`);
    console.error("Usage: bun run version.ts [major|minor|patch]");
    process.exit(1);
  }

  try {
    // Read package.json
    const packageJsonContent = await readFile(PACKAGE_JSON_PATH, "utf-8");
    const packageJson = JSON.parse(packageJsonContent);

    const currentVersion = packageJson.version || "0.0.0";
    const newVersion = bumpVersion(currentVersion, type);

    // Update version in package.json
    packageJson.version = newVersion;
    await writeFile(
      PACKAGE_JSON_PATH,
      JSON.stringify(packageJson, null, 2) + "\n",
      "utf-8",
    );

    console.log(`Version bumped: ${currentVersion} → ${newVersion} (${type})`);
  } catch (error) {
    console.error("Error updating version:", error);
    process.exit(1);
  }
}

main();
