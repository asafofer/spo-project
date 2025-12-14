import { wrapBundleWithFailsafe } from "./wrapBundle.ts";

interface PostBuildOptions {
  outputPath: string;
  bundleContent: string;
  scriptDir: string;
  axiomToken: string;
  errorsUrl: string;
}

/**
 * Process the built bundle: wrap with fail-safe error handler
 * All build-time constants are now handled via Bun's --define in build.ts
 */
export async function processPostBuild(options: PostBuildOptions): Promise<void> {
  const { outputPath, bundleContent, scriptDir, axiomToken, errorsUrl } = options;

  // Wrap bundle with fail-safe error handler
  const wrappedContent = await wrapBundleWithFailsafe(
    bundleContent,
    scriptDir,
    axiomToken,
    errorsUrl
  );

  await Bun.write(outputPath, wrappedContent);

  console.log("Build successful!");
  console.log("Output: script/dist/collector.prod.js");
}
