import { deploy } from "@conservation-stream/internal-actions";

interface Payload {
  arch: string;
  digest: string;
  timestamp: Date;
};

type Artifacts = never; // No artifacts for this build

await deploy<Payload, Artifacts>(async (env) => {
  for (const build of env.build) {
    console.log(`Deploying ${build.arch} build:`);
    console.log(`  digest: ${build.digest}`);
    console.log(`  timestamp: ${build.timestamp.toISOString()}`);
  }
});