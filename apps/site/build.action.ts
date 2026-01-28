import { build } from "@conservation-stream/internal-actions";
import { tmpdir } from "node:os";
import path from "node:path";
import { $, fs } from "zx";

interface Payload {
  version_id?: string;
  preview_url?: string;
};

type Artifacts = "build";



export class TemporaryHandle {
  public readonly path: string;
  constructor() {
    const id = crypto.randomUUID();
    this.path = path.join(tmpdir(), `actions/${id}`);
  }
  [Symbol.dispose]() {
    fs.rm(this.path, { recursive: true });
  }
}



await build<Payload, Artifacts>(async () => {
  const tmp = new TemporaryHandle();

  await $`pnpm build`;
  await $`pnpm --filter @conservation-stream/site deploy ${tmp.path} --legacy`;

  return {
    payload: {
      // version_id and preview_url will be set when wrangler upload is implemented
    },
    artifacts: {
      build: tmp.path,
    },
  };


})

