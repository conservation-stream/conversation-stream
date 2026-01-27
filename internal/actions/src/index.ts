import fs from "node:fs/promises";
import { env } from "node:process";
import { z } from "zod";

export const CoreGithubActionEnvironment = z.object({
  // General / CI
  GITHUB_ACTIONS: z.string(),

  // Current step/action
  GITHUB_ACTION: z.string(),
  GITHUB_ACTION_PATH: z.string().optional(), // composite actions only
  GITHUB_ACTION_REPOSITORY: z.string(),

  // Actor
  GITHUB_ACTOR: z.string(),
  GITHUB_ACTOR_ID: z.string().optional(),
  GITHUB_TRIGGERING_ACTOR: z.string().optional(),

  // API endpoints
  GITHUB_API_URL: z.string(),
  GITHUB_GRAPHQL_URL: z.string(),
  GITHUB_SERVER_URL: z.string(),

  // Event
  GITHUB_EVENT_NAME: z.string(),
  GITHUB_EVENT_PATH: z.string(),
  GITHUB_BASE_REF: z.string().optional(), // PR only
  GITHUB_HEAD_REF: z.string().optional(), // PR only

  // Job / run
  GITHUB_JOB: z.string(),
  GITHUB_RUN_ID: z.string(),
  GITHUB_RUN_NUMBER: z.string(),
  GITHUB_RUN_ATTEMPT: z.string(),
  GITHUB_RETENTION_DAYS: z.string(),
  GITHUB_WORKFLOW: z.string(),
  GITHUB_WORKFLOW_REF: z.string().optional(),
  GITHUB_WORKFLOW_SHA: z.string().optional(),

  // Repo / ref / commit
  GITHUB_REPOSITORY: z.string(),
  GITHUB_REPOSITORY_ID: z.string().optional(),
  GITHUB_REPOSITORY_OWNER: z.string(),
  GITHUB_REPOSITORY_OWNER_ID: z.string().optional(),
  GITHUB_REF: z.string(),
  GITHUB_REF_NAME: z.string(),
  GITHUB_REF_TYPE: z.string(),
  GITHUB_REF_PROTECTED: z.string().optional(),
  GITHUB_SHA: z.string(),

  // Filesystem + workflow command files
  GITHUB_WORKSPACE: z.string(),
  GITHUB_ENV: z.string(),
  GITHUB_OUTPUT: z.string(),
  GITHUB_PATH: z.string(),
  GITHUB_STEP_SUMMARY: z.string(),

  // Runner
  RUNNER_NAME: z.string().optional(),
  RUNNER_OS: z.string(),
  RUNNER_ARCH: z.string(),
  RUNNER_ENVIRONMENT: z.string().optional(),
  RUNNER_DEBUG: z.string().optional(), // only set when debugging is enabled
  RUNNER_TEMP: z.string(),
  RUNNER_TOOL_CACHE: z.string(),

  SECRETS: z.string().optional(),
  ACTIONS_RUNTIME_TOKEN: z.string().optional(),
  ACTIONS_CACHE_URL: z.string().optional(),
});

export type CoreGithubActionEnvironment = z.infer<typeof CoreGithubActionEnvironment>;

/**
 * Matrix configuration type for packages that need multi-arch/multi-target builds.
 * Keys are matrix dimension names, values are arrays of possible values.
 * 
 * @example
 * export const matrix = {
 *   arch: ["amd64", "arm64"],
 *   os: ["linux", "darwin"],
 * } as const satisfies MatrixConfig;
 */
export type MatrixConfig = Record<string, readonly string[]>;

/**
 * Parse MATRIX_VALUES_JSON env var.
 * Returns a record of matrix key names to their values, e.g. { arch: "amd64" }
 */
const parseMatrixEnv = (): Record<string, string> => {
  const json = env.MATRIX_VALUES_JSON;
  if (!json || json === "{}") return {};
  try {
    return JSON.parse(json) as Record<string, string>;
  } catch {
    return {};
  }
};

export const writeOutput = async (path: string, outputs: Record<string, string | number | boolean | object>) => {
  const output = Object.entries(outputs).map(([key, value]) => {
    if (typeof value === "object") {
      return `${key}=${JSON.stringify(value)}`;
    }
    return `${key}=${value}`;
  }).join("\n");
  await fs.writeFile(path, output, "utf8");
};

type ActionResult = Record<string, string | number | boolean | object>;

type BuildEnv = CoreGithubActionEnvironment & {
  event: { before: string };
  matrix: Record<string, string>;
};

export const build = async (fn: (env: BuildEnv) => Promise<void | ActionResult> | void | ActionResult) => {
  if (env.MATRIX_ONLY) return; // Allow importing for matrix extraction without running
  const parsed = CoreGithubActionEnvironment.parse(env);
  const event = await fs.readFile(parsed.GITHUB_EVENT_PATH, "utf8");
  const matrix = parseMatrixEnv();

  const result = await fn({
    ...parsed,
    event: JSON.parse(event),
    matrix,
  });
  if (!result) return;
  await writeOutput(parsed.GITHUB_OUTPUT, result);
};

/**
 * Convert matrix config to a typed record of current values.
 * { arch: ["amd64", "arm64"] } -> { arch: "amd64" | "arm64" }
 */
type MatrixValues<T extends MatrixConfig> = {
  [K in keyof T]: T[K][number];
};

type DeployEnv<TBuild, TMatrix extends MatrixConfig | undefined> = CoreGithubActionEnvironment & {
  event: { before: string };
  matrix: TMatrix extends MatrixConfig ? MatrixValues<TMatrix> : Record<string, string>;
  build: TBuild;
};

type DeployOptions<TSchema extends z.ZodSchema, TMatrix extends MatrixConfig | undefined> = {
  schema: TSchema;
  matrix?: TMatrix;
};

/**
 * Deploy function - receives single build output.
 * For matrix builds, this runs once per matrix entry with env.matrix containing the current values.
 * 
 * @example
 * await deploy(async (env) => {
 *   console.log(env.build.digest);
 *   console.log(env.matrix.arch); // typed if matrix option provided
 * }, { schema: BuildOutput, matrix });
 */
export const deploy = async <
  TSchema extends z.ZodSchema,
  TMatrix extends MatrixConfig | undefined = undefined
>(
  fn: (env: DeployEnv<z.infer<TSchema>, TMatrix>) => Promise<void | ActionResult> | void | ActionResult,
  options: DeployOptions<TSchema, TMatrix>
): Promise<void> => {
  if (env.MATRIX_ONLY) return; // Allow importing for matrix extraction without running

  const parsed = CoreGithubActionEnvironment.parse(env);
  const event = await fs.readFile(parsed.GITHUB_EVENT_PATH, "utf8");
  const matrix = parseMatrixEnv();
  const output = z.object({ BUILD_OUTPUTS_JSON: z.string() }).parse(env);
  const buildOutput = options.schema.parse(JSON.parse(output.BUILD_OUTPUTS_JSON));

  const result = await fn({
    ...parsed,
    event: JSON.parse(event),
    matrix: matrix as DeployEnv<z.infer<TSchema>, TMatrix>["matrix"],
    build: buildOutput,
  });
  if (!result) return;
  await writeOutput(parsed.GITHUB_OUTPUT, result);
};