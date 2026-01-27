import { build } from "@conservation-stream/internal-actions";
import { z } from "zod";


export const schema = z.object({
  arch: z.string(),
  digest: z.string(),
  timestamp: z.coerce.date(),
});

type schema = z.infer<typeof schema>;

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
    } satisfies schema,
  };
});