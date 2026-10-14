# AGENTS.md

Instructions and context for AI coding agents working on n8n workflows in this
repository.

## Project Overview

Code-first development workspace for [n8n](https://n8n.io/) workflows. Code
nodes (`.js`, `.py`) and HTML/email templates (`.html`) inside n8n workflow
definitions (`workflows/*.json`) are dissected into discrete files in
`src/<Workflow-Name>/` for editing with full LSP, autocomplete, and type
checking, then bundled back into the workflow JSON.

## Essential Commands

Runtime and package manager is **Bun** (`bun`). Python tooling is managed via
**uv** (`uv`).

```bash
# Type-check code
bun run type-check                # Runs both JS/TS and Python checks
bun run type-check:js             # Runs tsc (checkJs: true)
bun run type-check:py             # Runs basedpyright src

# Dissect workflow JSON into local source files
bun run extract                   # Dissects all workflows in workflows/
bun run extract "Workflow Name"   # Dissects specific workflow
bun run extract [wf] --keep       # Keep existing files in src/ (no clear)

# Bundle local source files back into workflow JSON
bun run bundle                    # Bundles all workflows
bun run bundle "Workflow Name"    # Bundles specific workflow

# Remote API Sync (requires .env with N8N_URL and N8N_API_KEY)
bun run pull                      # List available remote workflows
bun run pull <workflow-id>        # Fetch workflow and dissect into src/
bun run push                      # Bundle, verify, and push all workflows
bun run push "Workflow Name"      # Bundle, verify, and push specific workflow

# Python linting and type-checking (optional/if python nodes are present)
uv run ruff check src             # Ruff lint (target: py310, line-length: 120)
uv run basedpyright src           # Basedpyright type-checking (Python 3.10)
```

## Directory Structure & Boundaries

- `workflows/`: n8n workflow JSON files (`workflows/<Workflow-Name>.json`).
  Source of truth for workflow canvas configuration, connections, and metadata.
- `src/<Workflow-Name>/`: Dissected code nodes and templates.
  - File naming pattern: `<short-id>.<sanitized-node-name>.<ext>`
    (e.g., `ae9ae0b3.Sample-Code-Node.js`).
- `src/types/`:
  - `n8n.d.ts`: Ambient JS runtime globals declared by n8n (`$input`, `$json`,
    `$node`, `$prevNode`, `$workflow`, `$execution`, `DateTime`).
  - `n8n.pyi`: Python type stubs for n8n globals (`_input`, `_json`,
    `_prevNode`, `_node`).
  - `*.ts`: Custom user data structures (e.g. `SampleCodeTypes.ts`).
- `scripts/`:
  - `sync.ts`: Core sync engine handling `extract`, `bundle`, `pull`, and
    `push`.
  - `types.d.ts`: Ambient typing for node/bun runtime in scripts.

## Critical Conventions & Quirks

### 1. Mandatory `@id` Header on Line 1

Every extracted source file in `src/<Workflow-Name>/` **must** retain its node
ID header comment on line 1:

- JavaScript: `// @id: <node-uuid>`
- Python: `# @id: <node-uuid>`
- HTML: `<!-- @id: <node-uuid> -->`

`scripts/sync.ts` matches files to nodes in the JSON using this UUID. If line 1
is removed or modified, `bun run bundle` will skip the file.

### 2. JavaScript Code Nodes vs TypeScript

- n8n executes raw **JavaScript**, not TypeScript.
- **Never** use TypeScript-specific syntax (e.g. `interface`, `: string`,
  `as Type`) inside `src/<Workflow-Name>/*.js`.
- For type safety, define interfaces in `src/types/*.ts` and annotate code with
  **JSDoc**:

  ```javascript
  /** @type {import("../types/SampleCodeTypes").Person} */
  const person = { name, age };
  ```

- Top-level `return` is native to n8n code node execution scope; suppress
  editor warnings with `// @ts-ignore`:

  ```javascript
  // @ts-ignore Top-level return in n8n execution scope
  return { result: main(username, userage) };
  ```

### 3. Sync Flow & Overwrite Safety

- Do not make manual code edits directly inside `workflows/*.json` if the
  workflow has been extracted to `src/`; running `bun run bundle` will overwrite
  JSON node code with `src/` content.
- When creating a new node or editing canvas topology in n8n: export/pull the
  updated JSON to `workflows/` first, then run `bun run extract`
  (or `bun run pull <id>`).
- Always run `bun run type-check` before bundling or pushing changes.

### 4. n8n MCP Server Integration

- Check if an `n8n` MCP server is available in the agent's tool environment.
- If present, ask the user for permission before utilizing the `n8n` MCP tools
  (e.g., inspecting workflows, validating node configurations, querying node
  types, or testing executions).
- When permitted by the user, prefer using available n8n MCP tools to inspect,
  validate, or interact with n8n directly.
