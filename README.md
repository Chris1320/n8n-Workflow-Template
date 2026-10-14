# n8n Workflow Template

A code-first development environment for building, editing, and maintaining [n8n](https://n8n.io/) workflows using your
preferred external editor (**Neovim**, **VS Code**, etc.) with full LSP autocomplete, TypeScript/JSDoc checking,
and zero manual copy-pasting.

---

## Why this template?

Editing JavaScript, Python, and HTML templates inside n8n's web canvas lacks essential developer conveniences:
autocomplete, linters, jump-to-definition, and strict type checking.

This environment bridges that gap by letting you author code directly in local files with full LSP support and synchronize
them with workflow JSONs on demand.

It supports two modes:

1. **Connected / API-Driven Mode**: Direct push/pull integration with your live n8n instance using an API key.
2. **Local / File-First Mode (Zero-Config)**: 100% offline. No API keys or network connection needed. Ideal for
   corporate environments or strict policies.

---

## Quick Start

### 1. Install Dependencies

```bash
# Install JavaScript / TypeScript dependencies and sync scripts
bun install

# (Optional) Initialize Python virtual environment if using Python code nodes
uv sync
```

---

## Development Workflows

### Mode 1: Connected / API-Driven (Recommended)

Directly synchronizes code between your local editor and a running n8n instance.

#### Acquiring an n8n API Key & Scopes

1. **Open API Settings**: In your n8n dashboard, click `Settings > n8n API`.
2. **Create Key**: Click **Create an API key** (or **Create API key**).
3. **Label & Expiration**: Enter a recognizable label (e.g., `n8n-code-sync`) and select an expiration timeframe.
4. **Permissions & Scopes**:
   - **Community / Self-Hosted / Standard Plans**: API keys automatically inherit the full permissions of the user account. No scope selection is required.
   - **Enterprise / RBAC Plans**: Grant the following minimum scopes to adhere to least privilege:
     - `workflow:read` (**Workflow: Read**) — Required to list remote workflows and pull definitions (`bun run pull`).
     - `workflow:update` (**Workflow: Update**) — Required to bundle and push modified node code back to canvas (`bun run push`).
     - _(Optional)_ `workflow:create` and `workflow:activate` if you plan to programmatically create or publish workflows.
5. **Save & Copy**: Save and copy the generated key immediately (it is only shown once).

#### Environment Configuration

Create a `.env` file in the project root:

```bash
cp .env.example .env
```

Configure your instance connection:

```env
N8N_URL=https://n8n.example.com
N8N_API_KEY=n8n_api_your_key_here
```

> **Note**: Both `N8N_URL` (without trailing slash) and `N8N_API_KEY` must be defined in `.env`. Ambient system environment variables are ignored to avoid accidental modifications across environments.

#### API-Driven Step-by-Step Lifecycle

1. **Create workflow**: Create your workflow structure on the n8n canvas.
2. **Pull**: Fetch the workflow and dissect it into your repository:

   ```bash
   bun run pull                     # Refreshes all tracked workflows from n8n
   bun run pull <workflow-id>       # Pulls and auto-dissects a new workflow
   bun run pull --list              # Lists available workflows on remote instance
   ```

3. **Edit**: Modify code and template files in `src/<Workflow-Name>/` using Neovim, VS Code, etc.
4. **Type-check**: Validate your JavaScript/TypeScript and Python code:

   ```bash
   bun run type-check
   ```

5. **Push**: Bundle and update live workflow(s) on your n8n instance:

   ```bash
   bun run push                     # Pushes all workflows found in workflows/
   bun run push "My Workflow"       # Pushes a specific workflow
   ```

6. **Test**: Execute and verify the workflow on your n8n canvas.
7. **Iterate**:
   - **When writing code**: Simply edit > `bun run push` (or `bun run push "My Workflow"`) > test.
   - **When modifying canvas nodes**: Run `bun run pull <workflow-id>` to re-dissect the updated workflow.

---

### Mode 2: Local / File-First (No API Key Required)

Operates purely on local files without connecting to an n8n instance.

#### File-First Step-by-Step Lifecycle

1. **Paste JSON**: Export your workflow from the n8n canvas and place it into `workflows/<Workflow-Name>.json`.
2. **Dissect**: Extract all code and HTML nodes into local files:

   ```bash
   bun run extract                  # Dissects all workflows
   bun run extract "My Workflow"    # Dissects a specific workflow
   ```

3. **Edit**: Modify code and template files in `src/<Workflow-Name>/`.
4. **Type-check**: Validate your code:

   ```bash
   bun run type-check
   ```

5. **Bundle**: Inject your edited code back into the workflow JSON:

   ```bash
   bun run bundle                   # Bundles all workflows
   bun run bundle "My Workflow"     # Bundles a specific workflow
   ```

6. **Import & Test**: Import the updated `workflows/<Workflow-Name>.json` back into the n8n canvas and test.
7. **Iterate**:
   - **When writing code**: Edit > `bun run bundle` > re-import JSON to n8n canvas.
   - **When modifying canvas nodes**: Export new JSON > paste into `workflows/` > `bun run extract`.

---

## Language & LSP Features

### JavaScript Code Nodes

- Ambient type definitions in [`src/types/n8n.d.ts`](src/types/n8n.d.ts) declare `$input`, `$json`, `$prevNode`,
  `$workflow`, and Luxon's `DateTime` globally.
- You do **not** need `// @ts-ignore` for n8n runtime variables—you get native autocomplete:

  ```javascript
  const name = $input.first().json.Name;
  ```

- Custom interfaces can be defined in `src/types/*.ts` and imported via standard JSDoc:

  ```javascript
  /** @type {import("../types/SampleCodeTypes").Person} */
  const person = { name, age: 30 };
  ```

### Python Code Nodes

- Python type stubs in [`src/types/n8n.pyi`](src/types/n8n.pyi) declare `_input`, `_json`, `_node`, etc.
- Pyright, Pylance, and Ruff will recognize `_input.first().json` and `_input.all()` without undefined variable errors.
- Python tooling is configured via `pyproject.toml` using `uv`.

### HTML & Email Nodes

- HTML bodies and email templates reside directly in `src/<Workflow-Name>/`.
- Format and lint them using Prettier or your editor's HTML LSP without escaping quotes or breaking JSON structures.

---

## Directory Structure

```text
├── workflows/                     # Workflow JSON definitions
│   └── <Workflow-Name>.json
├── src/                           # Dissected node files & types
│   ├── types/
│   │   ├── n8n.d.ts               # Ambient n8n JS runtime globals
│   │   ├── n8n.pyi                # Python type stubs
│   │   └── SampleCodeTypes.ts     # User custom types
│   └── <Workflow-Name>/
│       └── <short-id>.<Node-Name>.js
├── scripts/
│   ├── sync.ts                    # Single consolidated sync engine
│   └── types.d.ts                 # Ambient script runtime definitions
├── pyproject.toml                 # uv & Python tooling configuration
├── .editorconfig                  # Code style configuration
├── .env.example
├── tsconfig.json
└── package.json
```

---

## Commands Summary

| Command                         | Description                                                                  |
| ------------------------------- | ---------------------------------------------------------------------------- |
| `bun run extract [wf] [--keep]` | Dissects `workflows/*.json` into `src/<Workflow-Name>/`                      |
| `bun run bundle [wf]`           | Injects code from `src/<Workflow-Name>/` back into `workflows/*.json`        |
| `bun run type-check`            | Runs both JavaScript/TypeScript and Python type-checkers                     |
| `bun run type-check:js`         | Runs `tsc` to validate all JavaScript/TypeScript files                       |
| `bun run type-check:py`         | Runs `basedpyright src` to validate Python code nodes                        |
| `bun run pull [id]`             | _(Optional)_ Pulls latest tracked workflows from n8n (or specific workflow)  |
| `bun run push [wf]`             | _(Optional)_ Bundles, verifies, and updates live workflow(s) on n8n instance |
