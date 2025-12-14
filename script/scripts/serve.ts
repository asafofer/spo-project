import { join } from "node:path";

const PORT = 3000;

// Parse command-line arguments
const args = process.argv.slice(2);
const isProd = args.includes("prod");
const sampleRateArg = args.find((arg) => arg.startsWith("--sample-rate="));

const scriptDir = import.meta.dir;
const rootDir = join(scriptDir, "..");

if (isProd) {
  // Production mode: load script from PROD_DOMAIN
  // Bun automatically loads .env files
  
  const prodDomain = process.env.PROD_DOMAIN;
  if (!prodDomain) {
    console.error("❌ PROD_DOMAIN is required in .env file");
    process.exit(1);
  }

  // Ensure the domain has a protocol (default to https://)
  const prodUrl = prodDomain.startsWith("http://") || prodDomain.startsWith("https://")
    ? prodDomain
    : `https://${prodDomain}`;

  console.log(`Serving static files at http://localhost:${PORT}`);
  console.log(`Loading collector script from: ${prodUrl}/collector.prod.js`);

  // Read index.html and replace the script src
  const indexHtmlPath = join(rootDir, "index.html");
  const indexHtmlContent = await Bun.file(indexHtmlPath).text();

  // Replace the local script path with the production domain
  const modifiedHtml = indexHtmlContent.replace(
    /<script src="\/dist\/collector\.prod\.js"><\/script>/,
    `<script src="${prodUrl}/collector.prod.js"></script>`
  );

  Bun.serve({
    port: PORT,
    fetch(req) {
      const url = new URL(req.url);
      let path = url.pathname;

      // Serve modified index.html for root
      if (path === "/" || path === "/index.html") {
        return new Response(modifiedHtml, {
          headers: { "Content-Type": "text/html" },
        });
      }

      // Resolve other files relative to the script directory
      const file = Bun.file(join(rootDir, path));

      return new Response(file);
    },
    error() {
      return new Response(null, { status: 404 });
    },
  });
} else {
  // Development mode: build and serve local files
  // Build the collector with the sample rate argument (if provided)
  const buildScriptPath = join(scriptDir, "build.ts");
  const buildArgs = sampleRateArg
    ? ["run", buildScriptPath, sampleRateArg]
    : ["run", buildScriptPath];

  console.log("Building collector...");
  const buildProcess = Bun.spawn(["bun", ...buildArgs], {
    stdio: ["inherit", "inherit", "inherit"],
  });

  const exitCode = await buildProcess.exited;

  if (exitCode !== 0) {
    console.error(`Build failed with code ${exitCode}`);
    process.exit(exitCode);
  }

  console.log(`Serving static files at http://localhost:${PORT}`);

  Bun.serve({
    port: PORT,
    fetch(req) {
      const url = new URL(req.url);

      // Default to index.html if root is requested
      let path = url.pathname;
      if (path === "/") path = "/index.html";

      // Resolve file relative to the script directory (one level up from scripts/)
      const file = Bun.file(join(rootDir, path));

      return new Response(file);
    },
    error() {
      return new Response(null, { status: 404 });
    },
  });
}
