import fs from "node:fs/promises";
import path from "node:path";

const WORKFLOWS_DIR = path.resolve(process.cwd(), "workflows");
const SRC_DIR = path.resolve(process.cwd(), "src");

/**
 * The configuration interface for environment variables.
 */
interface EnvConfig {
  url: string;
  apiKey: string;
}

/**
 * Sanitizes a string for safe filesystem usage.
 *
 * @param name The original string to sanitize.
 * @returns The sanitized string.
 */
function cleanFileName(name: string): string {
  return name
    .trim()
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, "-");
}

/**
 * Generates the single line @id header comment.
 *
 * @param id The node UUID.
 * @param ext The file extension (e.g., .js, .py, .html).
 * @returns The formatted header comment string.
 */
function getHeader(id: string, ext: string): string {
  if (ext === ".py") return `# @id: ${id}\n\n`;
  if (ext === ".html") return `<!-- @id: ${id} -->\n\n`;
  return `// @id: ${id}\n\n`;
}

/**
 * Extracts the node UUID from line 1 and strips it from the code.
 *
 * @param content The full content of the code file.
 * @returns An object containing the extracted id and the remaining code.
 */
function parseIdAndCode(content: string): { id: string | null; code: string } {
  const lines = content.split("\n");
  const firstLine = lines[0] || "";
  const match = firstLine.match(/@id:\s*([a-zA-Z0-9_-]+)/);

  if (!match) {
    return { id: null, code: content };
  }

  const id = match[1];
  // Remove line 1 and skip any immediately following blank line
  let startIndex = 1;
  if (lines[1]?.trim() === "") {
    startIndex = 2;
  }

  return { id, code: lines.slice(startIndex).join("\n") };
}

/**
 * Loads configuration strictly from .env. No ambient fallbacks.
 *
 * @returns A promise resolving to the EnvConfig object.
 */
async function getEnvConfig(): Promise<EnvConfig> {
  const envPath = path.resolve(process.cwd(), ".env");
  try {
    const raw = await fs.readFile(envPath, "utf-8");
    const envVars: Record<string, string> = {};
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx !== -1) {
        envVars[trimmed.slice(0, eqIdx).trim()] = trimmed
          .slice(eqIdx + 1)
          .trim()
          .replace(/^["']|["']$/g, "");
      }
    }

    const url = envVars["N8N_URL"];
    const apiKey = envVars["N8N_API_KEY"];

    if (!url || !apiKey) {
      console.error(
        "\n[ERROR] Both N8N_URL and N8N_API_KEY must be defined in .env",
      );
      process.exit(1);
    }

    return { url: url.replace(/\/+$/, ""), apiKey };
  } catch {
    console.error(
      "\n[ERROR] Missing .env file. API sync commands require .env.",
    );
    console.error(
      "Define:\n  N8N_URL=https://your-n8n-instance.com\n  N8N_API_KEY=your_api_key\n",
    );
    process.exit(1);
  }
}

/**
 * Call an n8n API endpoint with the configured URL and API key.
 *
 * @param endpoint The API endpoint to call (e.g., /workflows).
 * @param options The fetch options, including method, headers, and body.
 * @returns The parsed JSON response from the API.
 */
async function apiRequest(
  endpoint: string,
  options: RequestInit = {},
): Promise<any> {
  const { url, apiKey } = await getEnvConfig();
  const targetUrl = `${url}/api/v1${endpoint.startsWith("/") ? endpoint : "/" + endpoint}`;

  const headers: Record<string, string> = {
    "X-N8N-API-KEY": apiKey,
    Accept: "application/json",
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };

  const res = await fetch(targetUrl, { ...options, headers });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(
      `n8n API error (${res.status} ${res.statusText}): ${errText}`,
    );
  }
  return res.json();
}

/**
 * Dissects a workflow JSON into individual node files under `src/<Workflow-Name>/`
 *
 * @param jsonPath The path to the workflow JSON file.
 * @param keepExisting Whether to keep existing files in the target directory.
 * @returns The number of nodes successfully dissected.
 */
async function extractWorkflow(
  jsonPath: string,
  keepExisting: boolean,
): Promise<number> {
  const workflowName = path.basename(jsonPath, ".json");
  const targetDir = path.join(SRC_DIR, workflowName);

  const raw = await fs.readFile(jsonPath, "utf-8");
  const workflow = JSON.parse(raw);
  const nodes: any[] = workflow.nodes || [];

  if (!keepExisting) {
    await fs.rm(targetDir, { recursive: true, force: true });
  }
  await fs.mkdir(targetDir, { recursive: true });

  let count = 0;
  for (const node of nodes) {
    const params = node.parameters || {};
    let code = "";
    let ext = "";

    if (node.type === "n8n-nodes-base.code") {
      if (params.language === "python") {
        code = params.pythonCode || "";
        ext = ".py";
      } else {
        code = params.jsCode || "";
        ext = ".js";
      }
    } else if (typeof params.html === "string") {
      code = params.html;
      ext = ".html";
    }

    if (!ext || !node.id || !node.name) continue;

    const shortId = node.id.slice(0, 8);
    const fileName = `${shortId}.${cleanFileName(node.name)}${ext}`;
    const filePath = path.join(targetDir, fileName);

    await fs.writeFile(filePath, getHeader(node.id, ext) + code, "utf-8");
    console.log(`[DISSECTED] ${workflowName} -> ${fileName}`);
    count++;
  }

  return count;
}

/**
 * Extracts workflows from `workflows/` into `src/<Workflow-Name>/` directories.
 *
 * @param targetName Optional specific workflow name to extract.
 * @param keep Whether to keep existing files in the target directories.
 * @returns A promise that resolves when extraction is complete.
 */
async function cmdExtract(targetName?: string, keep?: boolean): Promise<void> {
  await fs.mkdir(WORKFLOWS_DIR, { recursive: true });
  const allFiles = (await fs.readdir(WORKFLOWS_DIR)).filter((f: string) =>
    f.endsWith(".json"),
  );

  const files = targetName
    ? allFiles.filter(
        (f: string) => f === targetName || f === `${targetName}.json`,
      )
    : allFiles;

  if (files.length === 0) {
    console.log(
      targetName
        ? `[ERROR] Workflow '${targetName}.json' not found.`
        : "No workflows found in workflows/.",
    );
    return;
  }

  let total = 0;
  for (const file of files) {
    const fullPath = path.join(WORKFLOWS_DIR, file);
    total += await extractWorkflow(fullPath, Boolean(keep));
  }

  console.log(`\nSuccessfully dissected ${total} node(s).`);
}

/**
 * Bundles code files from `src/<Workflow-Name>/` back into `workflows/<Workflow-Name>.json`
 *
 * @param workflowName The name of the workflow to bundle.
 * @returns The number of nodes updated in the workflow JSON.
 */
async function bundleWorkflow(workflowName: string): Promise<number> {
  const jsonPath = path.join(WORKFLOWS_DIR, `${workflowName}.json`);
  const srcDir = path.join(SRC_DIR, workflowName);

  try {
    await fs.access(jsonPath);
    await fs.access(srcDir);
  } catch {
    console.warn(
      `[WARN] Skipping '${workflowName}': JSON or source directory missing.`,
    );
    return 0;
  }

  const raw = await fs.readFile(jsonPath, "utf-8");
  const workflow = JSON.parse(raw);
  const nodes: any[] = workflow.nodes || [];

  const files = await fs.readdir(srcDir);
  let updated = 0;

  for (const file of files) {
    const filePath = path.join(srcDir, file);
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) continue;

    const ext = path.extname(file);
    if (![".js", ".py", ".html"].includes(ext)) continue;

    const content = await fs.readFile(filePath, "utf-8");
    const { id, code } = parseIdAndCode(content);

    if (!id) {
      console.warn(`[WARN] Missing @id on line 1 of '${file}'. Skipping.`);
      continue;
    }

    const node = nodes.find((n: any) => n.id === id);
    if (!node) {
      console.warn(
        `[WARN] Node '${id}' in '${file}' not found in '${workflowName}.json'. Skipping.`,
      );
      continue;
    }

    if (!node.parameters) node.parameters = {};

    if (ext === ".py") node.parameters.pythonCode = code;
    else if (ext === ".html") node.parameters.html = code;
    else node.parameters.jsCode = code;

    updated++;
    console.log(`[BUNDLED] ${workflowName} <- ${file} (Node: ${node.name})`);
  }

  await fs.writeFile(
    jsonPath,
    JSON.stringify(workflow, null, 2) + "\n",
    "utf-8",
  );
  console.log(`Updated ${updated} node(s) in ${workflowName}.json`);
  return updated;
}

/**
 * Bundles workflows from `src/<Workflow-Name>/` back into `workflows/<Workflow-Name>.json`.
 *
 * @param targetName Optional specific workflow name to bundle.
 * @returns A promise that resolves when bundling is complete.
 */
async function cmdBundle(targetName?: string): Promise<void> {
  if (targetName) {
    const cleanName = targetName.replace(/\.json$/, "");
    await bundleWorkflow(cleanName);
    return;
  }

  await fs.mkdir(SRC_DIR, { recursive: true });
  const entries = await fs.readdir(SRC_DIR, { withFileTypes: true });
  const workflowDirs = entries
    .filter((e) => e.isDirectory() && e.name !== "types")
    .map((e) => e.name);

  if (workflowDirs.length === 0) {
    console.log("No workflow source directories found in src/.");
    return;
  }

  for (const dir of workflowDirs) {
    await bundleWorkflow(dir);
  }
}

/**
 * Pulls a single workflow by ID from the n8n instance and dissects it.
 *
 * @param workflowId The remote workflow ID.
 * @param preferredName Optional local workflow name to use for saving.
 * @returns A promise resolving to true if pulled successfully, false otherwise.
 */
async function pullWorkflowById(
  workflowId: string,
  preferredName?: string,
): Promise<boolean> {
  console.log(`Pulling workflow '${workflowId}' from n8n...`);
  try {
    const data = await apiRequest(`/workflows/${workflowId}`);
    const workflowName = (
      preferredName ||
      data.name ||
      `workflow-${workflowId}`
    ).trim();
    const jsonPath = path.join(WORKFLOWS_DIR, `${workflowName}.json`);

    await fs.mkdir(WORKFLOWS_DIR, { recursive: true });
    await fs.writeFile(jsonPath, JSON.stringify(data, null, 2) + "\n", "utf-8");
    console.log(`[PULLED] Saved to workflows/${workflowName}.json`);

    console.log(`Dissecting '${workflowName}'...`);
    await extractWorkflow(jsonPath, false);
    console.log("");
    return true;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[ERROR] Failed to pull workflow '${workflowId}': ${msg}\n`);
    return false;
  }
}

/**
 * Lists available remote workflows on the live n8n instance.
 *
 * @returns A promise that resolves when listing is complete.
 */
async function listRemoteWorkflows(): Promise<void> {
  console.log("Fetching workflows list from n8n instance...");
  const res = await apiRequest("/workflows");
  const workflows: any[] = res.data || [];
  if (workflows.length === 0) {
    console.log("No workflows found on the remote instance.");
    return;
  }
  console.log("\nAvailable workflows on n8n:");
  workflows.forEach((w) => console.log(` - [${w.id}] ${w.name}`));
  console.log("\nUsage: bun run pull <workflow-id>");
}

/**
 * Pulls workflow(s) from the live n8n instance.
 * If target is omitted, refreshes all workflows already tracked in `workflows/`.
 * If target is "--list" or "-l", lists all remote workflows.
 * If target is a workflow name or ID, pulls that specific workflow.
 *
 * @param target Optional workflow ID, name, or "--list" flag.
 * @returns A promise that resolves when pull operations complete.
 */
async function cmdPull(target?: string): Promise<void> {
  // Validate .env configuration first
  await getEnvConfig();

  if (target === "--list" || target === "-l") {
    await listRemoteWorkflows();
    return;
  }

  if (target) {
    const cleanName = target.replace(/\.json$/, "");
    const localJsonPath = path.join(WORKFLOWS_DIR, `${cleanName}.json`);
    let targetId = target;
    let preferredName: string | undefined = undefined;

    try {
      const raw = await fs.readFile(localJsonPath, "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed.id) {
        targetId = parsed.id;
        preferredName = cleanName;
      }
    } catch {
      // Not an existing local file name; treat target as workflow ID directly
    }

    const success = await pullWorkflowById(targetId, preferredName);
    if (!success) {
      process.exit(1);
    }
    return;
  }

  // No argument: pull latest version of all workflows currently in workflows/
  await fs.mkdir(WORKFLOWS_DIR, { recursive: true });
  const entries = await fs.readdir(WORKFLOWS_DIR, { withFileTypes: true });
  const jsonFiles = entries
    .filter((e) => e.isFile() && e.name.endsWith(".json"))
    .map((e) => e.name);

  if (jsonFiles.length === 0) {
    console.log("No workflows found in workflows/ to refresh.");
    console.log("Discovering available workflows on remote instance...\n");
    await listRemoteWorkflows();
    return;
  }

  const trackedWorkflows: { name: string; id: string }[] = [];
  for (const file of jsonFiles) {
    const filePath = path.join(WORKFLOWS_DIR, file);
    try {
      const raw = await fs.readFile(filePath, "utf-8");
      const parsed = JSON.parse(raw);
      const name = path.basename(file, ".json");
      if (parsed.id) {
        trackedWorkflows.push({ name, id: parsed.id });
      } else {
        console.warn(`[WARN] Skipping '${file}': missing 'id' field in JSON.`);
      }
    } catch {
      console.warn(`[WARN] Skipping '${file}': failed to read or parse JSON.`);
    }
  }

  if (trackedWorkflows.length === 0) {
    console.log("No tracked workflows with remote IDs found in workflows/.");
    console.log("Discovering available workflows on remote instance...\n");
    await listRemoteWorkflows();
    return;
  }

  console.log(
    `Found ${trackedWorkflows.length} tracked workflow(s) in workflows/. Fetching latest versions from n8n...\n`,
  );

  let pulled = 0;
  let failed = 0;

  for (const wf of trackedWorkflows) {
    const success = await pullWorkflowById(wf.id, wf.name);
    if (success) {
      pulled++;
    } else {
      failed++;
    }
  }

  console.log(`Pull completed: ${pulled} updated, ${failed} failed.`);
  if (failed > 0 && pulled === 0) {
    process.exit(1);
  }
}

/**
 * Bundles and pushes a single workflow to the live n8n instance.
 *
 * @param cleanName The sanitized workflow name.
 * @returns A promise resolving to true if pushed, false if skipped or failed.
 */
async function pushWorkflow(cleanName: string): Promise<boolean> {
  const jsonPath = path.join(WORKFLOWS_DIR, `${cleanName}.json`);
  let raw: string;
  try {
    raw = await fs.readFile(jsonPath, "utf-8");
  } catch {
    console.error(
      `[ERROR] Workflow file not found: workflows/${cleanName}.json`,
    );
    return false;
  }

  let workflow: any;
  try {
    workflow = JSON.parse(raw);
  } catch {
    console.error(`[ERROR] Failed to parse workflows/${cleanName}.json`);
    return false;
  }

  if (!workflow.id) {
    console.warn(`[WARN] Skipping '${cleanName}': missing 'id' field in JSON.`);
    return false;
  }

  console.log(`Bundling '${cleanName}'...`);
  await bundleWorkflow(cleanName);

  // Re-read JSON to get the latest bundled content
  raw = await fs.readFile(jsonPath, "utf-8");
  workflow = JSON.parse(raw);

  // Validate nodes
  const nodes: any[] = workflow.nodes || [];
  console.log(`Verifying ${nodes.length} node(s) in '${cleanName}'...`);
  for (const n of nodes) {
    if (n.type === "n8n-nodes-base.code") {
      const isPy = n.parameters?.language === "python";
      const len =
        (isPy ? n.parameters?.pythonCode : n.parameters?.jsCode)?.length || 0;
      console.log(
        ` - [CHECKED] Code: '${n.name}' (${isPy ? "Python" : "JS"}, ${len} chars)`,
      );
    } else if (typeof n.parameters?.html === "string") {
      console.log(
        ` - [CHECKED] HTML: '${n.name}' (${n.parameters.html.length} chars)`,
      );
    }
  }

  console.log(
    `Pushing '${cleanName}' (${workflow.id}) to live n8n instance...`,
  );
  const payload = {
    name: workflow.name,
    nodes: workflow.nodes,
    connections: workflow.connections,
    settings: workflow.settings || {},
  };

  try {
    await apiRequest(`/workflows/${workflow.id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    console.log(`[PUSHED] Successfully updated '${cleanName}' on n8n.\n`);
    return true;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[ERROR] Failed to push '${cleanName}': ${msg}\n`);
    return false;
  }
}

/**
 * Pushes workflow(s) from `workflows/<Workflow-Name>.json` to the live n8n instance.
 * If workflowName is omitted, pushes all workflows found in `workflows/`.
 *
 * @param workflowName Optional specific workflow name to push.
 * @returns A promise that resolves when push operations complete.
 */
async function cmdPush(workflowName?: string): Promise<void> {
  // Validate .env configuration first
  await getEnvConfig();

  if (workflowName) {
    const cleanName = workflowName.replace(/\.json$/, "");
    const success = await pushWorkflow(cleanName);
    if (!success) {
      process.exit(1);
    }
    return;
  }

  await fs.mkdir(WORKFLOWS_DIR, { recursive: true });
  const entries = await fs.readdir(WORKFLOWS_DIR, { withFileTypes: true });
  const workflowNames = entries
    .filter((e) => e.isFile() && e.name.endsWith(".json"))
    .map((e) => e.name.replace(/\.json$/, ""));

  if (workflowNames.length === 0) {
    console.log("No workflows found in workflows/ to push.");
    return;
  }

  console.log(
    `Found ${workflowNames.length} workflow(s) in workflows/. Pushing to n8n...\n`,
  );
  let pushed = 0;
  let failed = 0;

  for (const name of workflowNames) {
    const success = await pushWorkflow(name);
    if (success) {
      pushed++;
    } else {
      failed++;
    }
  }

  console.log(`Push completed: ${pushed} pushed, ${failed} skipped or failed.`);
  if (failed > 0 && pushed === 0) {
    process.exit(1);
  }
}

/**
 * The main entry point for the script.
 *
 * @returns A promise that resolves when the script completes.
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const action = args[0];

  if (action === "extract") {
    const keep = args.includes("--keep");
    const name = args.slice(1).find((a) => !a.startsWith("--"));
    await cmdExtract(name, keep);
  } else if (action === "bundle") {
    await cmdBundle(args[1]);
  } else if (action === "pull") {
    await cmdPull(args[1]);
  } else if (action === "push") {
    await cmdPush(args[1]);
  } else {
    console.log(
      "Usage: bun scripts/sync.ts <extract|bundle|pull|push> [options]",
    );
  }
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(message);
  process.exit(1);
});
