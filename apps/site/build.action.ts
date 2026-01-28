import { build } from "@conservation-stream/internal-actions";
import { tmpdir } from "node:os";
import path from "node:path";
import { z } from "zod";
import { $, fs } from "zx";

interface Payload {
  version_id?: string;
  preview_url?: string;
};

type Artifacts = "build";

const RequiredSecrets = z.string().transform((value) => JSON.parse(value)).pipe(z.object({
  CLOUDFLARE_API_TOKEN: z.string(),
  CLOUDFLARE_ACCOUNT_ID: z.string(),
  github_token: z.string().optional(),
  GITHUB_TOKEN: z.string().optional(),
}))


class TemporaryDirectory {
  public readonly path: string;
  constructor() {
    const id = crypto.randomUUID();
    this.path = path.join(tmpdir(), `actions/${id}`);
  }
  [Symbol.dispose]() {
    fs.rm(this.path, { recursive: true });
  }
}

// const run = async () => {
//   using file = new TemporaryFile();
//   $.env = {
//     ...$.env,
//     WRANGLER_OUTPUT_FILE_PATH: file.path,
//   }
//   await $`pnpm exec wrangler versions upload`;
//   const contents = await readFile(file.path, "utf8");
//   return contents.split("\n").filter(Boolean).map(line => JSON.parse(line)) as WranglerEvent[];
// }


await build<Payload, Artifacts>(async (env) => {
  const secrets = RequiredSecrets.parse(env.SECRETS);
  using tmp = new TemporaryDirectory();

  if (!secrets.github_token && !secrets.GITHUB_TOKEN) {
    throw new Error("No GitHub token found");
  }
  const token = secrets.github_token ?? secrets.GITHUB_TOKEN;
  console.log(token);

  $.env = {
    ...$.env,
    CLOUDFLARE_API_TOKEN: secrets.CLOUDFLARE_API_TOKEN,
    CLOUDFLARE_ACCOUNT_ID: secrets.CLOUDFLARE_ACCOUNT_ID,
  }

  await $`pnpm build`;
  await $`pnpm --filter @conservation-stream/site --prod deploy ${tmp.path} --legacy`;

  const artifactPath = path.relative(
    env.GITHUB_WORKSPACE,
    path.join(import.meta.dirname, "index.html")
  );

  return {
    payload: {
      // version_id and preview_url will be set when wrangler upload is implemented
    },
    artifacts: {
      build: artifactPath,
    },
  };

  // const result = await run();

  // const upload = result.find(event => event.type === "version-upload");
  // if (!upload) {
  //   throw new Error("No version upload event found");
  // }

  // return {
  //   payload: { version_id: upload.version_id, preview_url: upload.preview_url },
  //   artifacts: {
  //     build: `${import.meta.dirname}/index.html`,
  //   },
  // }
})


// type CoreWranglerEvent = {
//   type: string;
//   timestamp: string;
//   version: number;
// }

// interface WranglerSessionEvent extends CoreWranglerEvent {
//   type: "wrangler-session";
//   wrangler_version: string;
//   command_line_args: string[];
//   log_file_path: string;
// }

// interface WranglerVersionUploadEvent extends CoreWranglerEvent {
//   type: "version-upload";
//   worker_name: string;
//   worker_tag: string;
//   version_id: string;
//   preview_url: string;
// }

// type WranglerEvent = WranglerSessionEvent | WranglerVersionUploadEvent;
