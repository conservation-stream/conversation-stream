import { deploy } from "@conservation-stream/internal-actions";
import { readFile } from "fs/promises";
import { z } from "zod";
import { $ } from "zx";
import { TemporaryHandle } from "./build.action.ts";

interface Payload {
  version_id: string;
  preview_url: string;
};

type Artifacts = "build";

const run = async (cwd: string) => {
  using file = new TemporaryHandle();
  $.env = {
    ...$.env,
    WRANGLER_OUTPUT_FILE_PATH: file.path,
  }
  await $({ cwd })`pnpm --filter @conservation-stream/site exec wrangler versions upload`;
  const contents = await readFile(file.path, "utf8");
  return contents.split("\n").filter(Boolean).map(line => JSON.parse(line)) as WranglerEvent[];
}

const RequiredSecrets = z.string().transform((value) => JSON.parse(value)).pipe(z.object({
  CLOUDFLARE_API_TOKEN: z.string(),
  CLOUDFLARE_ACCOUNT_ID: z.string(),
}))

await deploy<Payload, Artifacts>(async (env) => {
  const secrets = RequiredSecrets.parse(env.SECRETS);
  const [build] = env.build;
  if (!build) throw new Error("No build found");

  console.log(`Deploying for matrix: ${JSON.stringify(env.matrix)}`);
  console.log(`Deploying site version ${build.version_id} to ${build.preview_url}`);
  console.log(`Preview URL: ${build.preview_url}`);

  console.log(`Build artifact path: ${env.artifacts.build}`);

  $.env = {
    ...$.env,
    CLOUDFLARE_API_TOKEN: secrets.CLOUDFLARE_API_TOKEN,
    CLOUDFLARE_ACCOUNT_ID: secrets.CLOUDFLARE_ACCOUNT_ID,
  }

  const result = await run(env.GITHUB_WORKSPACE);

  const upload = result.find(event => event.type === "version-upload");
  if (!upload) throw new Error("No version upload event found");

  console.log(upload);
});



type CoreWranglerEvent = {
  type: string;
  timestamp: string;
  version: number;
}

interface WranglerSessionEvent extends CoreWranglerEvent {
  type: "wrangler-session";
  wrangler_version: string;
  command_line_args: string[];
  log_file_path: string;
}

interface WranglerVersionUploadEvent extends CoreWranglerEvent {
  type: "version-upload";
  worker_name: string;
  worker_tag: string;
  version_id: string;
  preview_url: string;
}

type WranglerEvent = WranglerSessionEvent | WranglerVersionUploadEvent;
