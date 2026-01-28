import { deploy } from "@conservation-stream/internal-actions";
import fs from "node:fs/promises";

interface Payload {
  version_id?: string;
  preview_url?: string;
};

type Artifacts = "build";

await deploy<Payload, Artifacts>(async (env) => {
  for (const build of env.build) {
    console.log(`Deploying for matrix: ${JSON.stringify(env.matrix)}`);
    if (build.version_id && build.preview_url) {
      console.log(`Deploying site version ${build.version_id} to ${build.preview_url}`);
      console.log(`Preview URL: ${build.preview_url}`);
    } else {
      console.log("No version info found; deploying static artifact only.");
    }
  }

  console.log(`Build artifact path: ${env.artifacts.build}`);

  const html = await fs.readFile(env.artifacts.build, "utf8");
  console.log(`Artifact size: ${html.length} bytes`);
});