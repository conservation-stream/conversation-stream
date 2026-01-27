import { build, type MatrixConfig } from "@conservation-stream/internal-actions";
import { z } from "zod";

/**
 * Matrix configuration for multi-arch builds.
 * This will trigger parallel build jobs for each combination.
 */
export const matrix = {
  arch: ["amd64", "arm64"],
} as const satisfies MatrixConfig;

export const BuildOutput = z.object({
  arch: z.string(),
  digest: z.string(),
  timestamp: z.coerce.date(),
});

type BuildOutput = z.infer<typeof BuildOutput>;

await build(async (env) => {
  // env.matrix contains the current matrix values, e.g. { arch: "amd64" }
  console.log(`Building for architecture: ${env.matrix.arch}`);
  // Simulate building for this architecture
  const digest = `sha256:${crypto.randomUUID().replace(/-/g, "")}`;

  return {
    payload: {
      arch: env.matrix.arch,
      digest,
      timestamp: new Date(),
    } satisfies BuildOutput,
  };
});