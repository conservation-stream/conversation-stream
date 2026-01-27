import { deploy } from "@conservation-stream/internal-actions";
import { BuildOutput } from "./build.action.ts";

await deploy(async (env) => {
  console.log(`Deploying site version ${env.build.version_id} to ${env.build.preview_url}`);
  console.log(`Preview URL: ${env.build.preview_url}`);
  return {
    environment_url: env.build.preview_url,
  }
}, { schema: BuildOutput });