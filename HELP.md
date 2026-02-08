# Orrery CLI Reference

> Run `orrery manual` to display this document.

Orrery is a workflow planning and orchestration CLI for AI agents. It transforms
high-level development goals into executable, step-by-step plans that agents
follow autonomously on isolated branches.

---

## Commands

### Setup

#### `orrery init`

Initialize Orrery: install skills to detected agents.

```
Options:
  --agent <agent>  Target agent (claude|codex|gemini|all); defaults to auto-detect
  --force          Overwrite existing skills
  --dry-run        Show what would be copied without writing files
```

Example:

```bash
orrery init
orrery init --agent claude --force
```

#### `orrery install-skills`

Install orrery skills for supported agents. Called automatically by `orrery init`.

```
Options:
  --agent <agent>  Target agent (claude|codex|gemini|all); defaults to auto-detect
  --force          Overwrite existing skills
  --dry-run        Show what would be copied without writing files
```

#### `orrery install-devcontainer`

Copy the orrery devcontainer to a target directory for sandboxed execution.

```
Arguments:
  [target]    Target directory (default: current directory)

Options:
  --force     Overwrite existing devcontainer
  --dry-run   Show what would be copied without writing files
```

Example:

```bash
orrery install-devcontainer
orrery install-devcontainer /path/to/project --force
```

### Execution

#### `orrery orchestrate` (alias: `exec`)

Run plan orchestration for the current project. Loads plans from
`.agent-work/plans/`, resolves dependencies, and invokes agents to execute
each step.

```
Options:
  --plan <file>  Process only a specific plan file
  --dry-run      Show what would be executed without running agents
  --verbose      Show detailed agent output
  --resume       Resume orchestration on the current work branch
  --review       Enable code review loop after each step
  --parallel     Enable parallel execution with git worktrees for isolation
```

Example:

```bash
orrery exec
orrery exec --plan my-feature.yaml --review
orrery exec --parallel --verbose
```

#### `orrery resume`

Unblock steps and resume orchestration. Auto-detects the plan for the current
work branch, resets blocked steps to pending, commits, and resumes.

```
Options:
  --step <id>  Unblock a specific step before resuming
  --all        Unblock all blocked steps (default behavior)
  --dry-run    Preview what would be unblocked without making changes
```

Example:

```bash
orrery resume
orrery resume --step step-2
orrery resume --dry-run
```

### Inspection

#### `orrery status`

Show orchestration status for plans in the current project. Auto-detects the
plan when on a work branch.

```
Options:
  --plan <file>  Show detailed status for a specific plan
```

Example:

```bash
orrery status
orrery status --plan my-feature.yaml
```

#### `orrery validate-plan`

Validate a plan YAML file and normalize its formatting. Also runs as a hook
when agents write to plan files.

```
Arguments:
  [file]          Path to the plan file (or reads from stdin for hook mode)

Options:
  --no-resave     Skip re-saving the file after validation
```

Example:

```bash
orrery validate-plan .agent-work/plans/my-plan.yaml
```

#### `orrery ingest-plan`

Validate and import an externally created plan file into the plans directory.

```
Arguments:
  <file>       Path to the plan file to ingest (required)

Options:
  --force      Overwrite existing plan file if it exists
```

Example:

```bash
orrery ingest-plan ~/plans/my-feature.yaml
```

### Information

#### `orrery manual`

Show this full CLI reference manual.

#### `orrery help [command]`

Display help for a specific command or the general command list.

#### `orrery --version` / `orrery -v`

Show the installed version.

---

## Common Workflows

### First-Time Setup

```bash
npm install -g @caseyharalson/orrery
cd your-project
orrery init
```

### Plan Creation and Execution

```bash
# 1. Use your agent with the discovery skill to create a plan
/discovery I want to add user authentication

# 2. (Optional) Refine or simulate the plan
/refine-plan my-plan
/simulate-plan my-plan

# 3. Execute the plan
orrery exec
```

### Handling Blocked Steps

When the orchestrator encounters an issue it cannot resolve, it marks the step
as blocked and pauses on the work branch.

```bash
# Check what's blocked
orrery status

# Fix the underlying issue, then resume
orrery resume

# Or unblock a specific step
orrery resume --step step-2

# Preview before resuming
orrery resume --dry-run
```

### External Plan Import

```bash
# Create a plan following the schema (see Plan File Format below)
# Then validate and import it
orrery ingest-plan path/to/your-plan.yaml

# Optionally simulate it
/simulate-plan your-plan

# Execute
orrery exec
```

### Review Loop

Enable iterative code review after each step:

```bash
orrery exec --review
# Or via environment variable
export ORRERY_REVIEW_ENABLED=true
```

The review agent inspects changes after each step. If issues are found, an edit
agent applies fixes and verification re-runs, repeating until approval or the
max iteration limit is reached (default: 3).

### Parallel Execution

Run independent steps concurrently using git worktrees for isolation:

```bash
orrery exec --parallel
# Or via environment variable
export ORRERY_PARALLEL_ENABLED=true
```

Steps marked `parallel: true` with no blocking dependencies run concurrently.
Each agent gets its own worktree. After completion, commits are cherry-picked
back to the main work branch. Control concurrency with `ORRERY_PARALLEL_MAX`.

---

## Plan File Format

Plans are YAML files stored in `.agent-work/plans/`. For the full schema and
detailed guidance on building plans, see the
[plan reference](docs/externally-building-a-plan-reference.md).

### Metadata Fields

| Field         | Required | Description                                      |
| :------------ | :------- | :----------------------------------------------- |
| `created_at`  | Yes      | ISO 8601 timestamp                               |
| `created_by`  | Yes      | Agent or user that created the plan              |
| `version`     | No       | Plan version                                     |
| `source_idea` | No       | Original idea or request                         |
| `outcomes`    | Yes      | Array of user-visible results this plan delivers |
| `notes`       | No       | General notes for executing agents               |

### Step Fields

| Field           | Required | Description                                               |
| :-------------- | :------- | :-------------------------------------------------------- |
| `id`            | Yes      | Unique step identifier                                    |
| `description`   | Yes      | What this step accomplishes                               |
| `status`        | No       | `pending` (default), `in_progress`, `complete`, `blocked` |
| `deps`          | No       | Array of step IDs this step depends on                    |
| `parallel`      | No       | Whether this step can run in parallel (default: false)    |
| `context`       | Yes      | Background info needed to execute the step                |
| `requirements`  | Yes      | Specific requirements for this step                       |
| `criteria`      | Yes      | Acceptance criteria for completion                        |
| `files`         | No       | Files this step will create or modify                     |
| `context_files` | No       | Files to read for context (not modified)                  |
| `commands`      | No       | Commands to execute (build, test, etc.)                   |
| `risk_notes`    | No       | Warnings or edge cases                                    |

### Step Statuses

| Status        | Meaning                                      |
| :------------ | :------------------------------------------- |
| `pending`     | Not yet started                              |
| `in_progress` | Currently being executed by an agent         |
| `complete`    | Successfully finished                        |
| `blocked`     | Cannot proceed; requires manual intervention |

### Abbreviated Example

```yaml
metadata:
  created_at: "2026-01-15T10:00:00Z"
  created_by: "Discovery-Agent"
  outcomes:
    - "Users can log in with email and password"

steps:
  - id: "1.1"
    description: "Create auth service"
    status: "pending"
    deps: []
    context: "Implement authentication logic using bcrypt and JWT."
    requirements:
      - "Create src/services/auth.js"
    criteria:
      - "Login function returns a valid JWT"
    files:
      - "src/services/auth.js"

  - id: "1.2"
    description: "Add login endpoint"
    status: "pending"
    deps: ["1.1"]
    context: "Wire up the auth service to an Express route."
    requirements:
      - "POST /api/login"
    criteria:
      - "Returns 200 with token on valid credentials"
      - "Returns 401 on invalid credentials"
    files:
      - "src/routes/auth.js"
    context_files:
      - "src/services/auth.js"
```

---

## Skills

Skills are modular instruction sets installed to your agent's configuration
directory.

| Skill           | Description                                                 |
| :-------------- | :---------------------------------------------------------- |
| `discovery`     | Analyze requirements and generate orchestrator-ready plans  |
| `refine-plan`   | Analyze and improve an existing plan before execution       |
| `simulate-plan` | Conversational dialogue to explore plans and identify risks |

---

## Directory Structure

Orrery maintains state in `.agent-work/` (configurable via `ORRERY_WORK_DIR`):

```
.agent-work/
  plans/        Active plan files (new and in-progress)
  reports/      Step-level execution logs and outcomes
  completed/    Successfully executed plans (archived)
```

---

## Environment Variables

| Variable                       | Description                                          | Default               |
| :----------------------------- | :--------------------------------------------------- | :-------------------- |
| `ORRERY_AGENT_PRIORITY`        | Comma-separated list of agents for failover priority | `codex,gemini,claude` |
| `ORRERY_AGENT_TIMEOUT`         | Agent failover timeout in milliseconds               | `900000` (15 min)     |
| `ORRERY_PARALLEL_ENABLED`      | Enable parallel execution with git worktrees         | `false`               |
| `ORRERY_PARALLEL_MAX`          | Maximum concurrent parallel agents                   | `3`                   |
| `ORRERY_REVIEW_ENABLED`        | Enable the review loop                               | `false`               |
| `ORRERY_REVIEW_MAX_ITERATIONS` | Maximum review-edit loop iterations                  | `3`                   |
| `ORRERY_WORK_DIR`              | Override the work directory path                     | `.agent-work`         |

---

## Exit Codes

| Code | Meaning                                   |
| :--- | :---------------------------------------- |
| `0`  | Success                                   |
| `1`  | General error                             |
| `2`  | Validation error (plan validation failed) |
