import { deploy } from "@conservation-stream/internal-actions";
import { BuildOutput, matrix } from "./build.action.ts";

/**
 * Deploy runs once per matrix entry.
 * env.matrix is typed based on the matrix config (e.g., { arch: "amd64" | "arm64" })
 * env.build contains the build output for this matrix entry.
 */
await deploy(async (env) => {
  // env.matrix.arch is typed as "amd64" | "arm64"
  console.log(`Deploying ${env.matrix.arch} build: `);
  console.log(`  digest: ${env.build.digest}`);
  console.log(`  timestamp: ${env.build.timestamp.toISOString()}`);

  // In a real implementation:
  // - Push to registry with arch-specific tag
  // - Update deployment for this arch
  // - Store digest somewhere for finalize to pick up
}, { schema: BuildOutput, matrix });