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
bun install
```

---

## Development Workflows

### Mode 1: Connected / API-Driven (Recommended)

Requires a one-time configuration of `N8N_URL` and `N8N_API_KEY` in `.env`.

```bash
cp .env.example .env
# Edit .env with your instance URL and API key
```

#### Step-by-Step Lifecycle

1. **Create workflow**: Create your workflow structure on the n8n canvas.
2. **Configure `.env`** *(one-time)*: Add `N8N_URL` and `N8N_API_KEY`.
3. **Pull**: Fetch the workflow and dissect it into your repository:

   ```bash
   bun run pull                     # Lists available workflows
   bun run pull <workflow-id>       # Pulls and auto-dissects into src/<Workflow-Name>/
   ```

4. **Edit**: Modify code and template files in `src/<Workflow-Name>/` using Neovim, VS Code, etc.
5. **Type-check**: Validate your JavaScript/TypeScript:

   ```bash
   bun run type-check
   ```

6. **Push**: Bundle and update the live workflow directly on your n8n instance:

   ```bash
   bun run push "My Workflow"
   ```

7. **Test**: Execute and verify the workflow on your n8n canvas.
8. **Iterate**:
   * **When writing code**: Simply edit $\rightarrow$ `bun run push "My Workflow"` $\rightarrow$ test.
   * **When modifying canvas nodes**: Run `bun run pull <workflow-id>` to re-dissect the updated workflow.

---

### Mode 2: Local / File-First (No API Key Required)

Operates purely on local files without connecting to an n8n instance.

#### Step-by-Step Lifecycle

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
   * **When writing code**: Edit $\rightarrow$ `bun run bundle` $\rightarrow$ re-import JSON to n8n canvas.
   * **When modifying canvas nodes**: Export new JSON $\rightarrow$ paste into `workflows/` $\rightarrow$ `bun run extract`.

---

## Language & LSP Features

### JavaScript Code Nodes

* Ambient type definitions in [`src/types/n8n.d.ts`](src/types/n8n.d.ts) declare `$input`, `$json`, `$prevNode`,
  `$workflow`, and Luxon's `DateTime` globally.
* You do **not** need `// @ts-ignore` for n8n runtime variables—you get native autocomplete:

  ```javascript
  const name = $input.first().json.Name;
  ```

* Custom interfaces can be defined in `src/types/*.ts` and imported via standard JSDoc:

  ```javascript
  /** @type {import("../types/SampleCodeTypes").Person} */
  const person = { name, age: 30 };
  ```

### Python Code Nodes

* Python type stubs in [`src/types/n8n.pyi`](src/types/n8n.pyi) declare `_input`, `_json`, `_node`, etc.
* Pyright, Pylance, and Ruff will recognize `_input.first().json` and `_input.all()` without undefined variable errors.
* Python tooling is configured via `pyproject.toml` using `uv`.

### HTML & Email Nodes

* HTML bodies and email templates reside directly in `src/<Workflow-Name>/`.
* Format and lint them using Prettier or your editor's HTML LSP without escaping quotes or breaking JSON structures.

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

| Command | Description |
| --- | --- |
| `bun run extract [wf] [--keep]` | Dissects `workflows/*.json` into `src/<Workflow-Name>/` |
| `bun run bundle [wf]` | Injects code from `src/<Workflow-Name>/` back into `workflows/*.json` |
| `bun run type-check` | Runs both JavaScript/TypeScript and Python type-checkers |
| `bun run type-check:js` | Runs `tsc` to validate all JavaScript/TypeScript files |
| `bun run type-check:py` | Runs `basedpyright src` to validate Python code nodes |
| `bun run pull [id]` | *(Optional)* Pulls workflow from live n8n instance and dissects it |
| `bun run push <wf>` | *(Optional)* Bundles, verifies, and updates live workflow on n8n instance |
