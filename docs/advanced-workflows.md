# Advanced Workflows

This document covers advanced Orrery workflows for power users.

---

## Plan Refinement

Use the `refine-plan` skill to analyze and improve a plan before execution. This performs additional thinking to fix oversights, improve context quality, and strengthen acceptance criteria.

### Usage

```bash
# Using the skill shorthand
/refine-plan my-plan

# Or prompt your agent
"Activate the refine-plan skill on my-plan"
```

The skill analyzes the plan structure, reviews dependencies, checks context quality, and implements improvements directly to the plan file.

---

## Plan Simulation

Use the `simulate-plan` skill to explore a plan through conversational dialogue before execution. This helps you identify risks, verify the approach, and build intuition about what you're building.

### Usage

```bash
# Using the skill shorthand
/simulate-plan my-plan

# Or prompt your agent
"Activate the simulate-plan skill and let's think through my-plan"
```

During simulation, you can:

- Ask "what if" questions about the plan
- Trace dependencies between steps
- Explore alternative approaches
- Identify risks before committing to execution

---

## Devcontainer Setup

For isolated, reproducible development environments, Orrery provides a devcontainer workflow.

### Full Devcontainer Workflow

1. **Install the devcontainer** (or add Orrery to an existing one):

   ```bash
   orrery install-devcontainer
   ```

2. **Configure the devcontainer** (`.devcontainer/devcontainer.json`):
   - Set your agent priority if you use multiple or edit to your prefered agent via environment variable: `ORRERY_AGENT_PRIORITY`
   - Add firewall to start if needed:

     ```json
     "postStartCommand": "sudo /usr/local/bin/init-firewall.sh",
     "waitFor": "postStartCommand"
     ```

3. **Open your project in the devcontainer**:

   **VS Code:**
   - Open your project folder in VS Code
   - When prompted "Folder contains a Dev Container configuration file", click **Reopen in Container**
   - Or use the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) and select **Dev Containers: Reopen in Container**

   **VS Code with Remote - SSH:**
   - If working on a remote machine, first connect via Remote - SSH
   - Then use **Dev Containers: Reopen in Container** from the Command Palette

   **CLI (devcontainer CLI):**

   ```bash
   # Install the CLI if needed
   npm install -g @devcontainers/cli

   # Build and start the container
   devcontainer up --workspace-folder .

   # Open a shell in the container
   devcontainer exec --workspace-folder . bash
   ```

   **JetBrains IDEs:**
   - Open the project and navigate to `.devcontainer/devcontainer.json`
   - Click the container icon in the gutter or use **Create Dev Container and Mount Sources**

4. **Sign into your agent(s)**:
   - The devcontainer uses shared volumes between containers, so you only need to authenticate once per agent

5. **Initialize Orrery**:

   ```bash
   orrery init
   ```

6. **Continue with the standard workflow** (discovery, refine-plan, simulate-plan, execute)

---

## External Plan Creation

Plans can be created outside of an agent using the `ingest-plan` command. This is useful when:

- You have an existing planning workflow
- You want to use a different LLM for planning
- You're migrating plans from another system

### Workflow

1. **Create a plan file** following the schema and help in [externally-building-a-plan-reference.md](./externally-building-a-plan-reference.md)

2. **Validate and import the plan**:

   ```bash
   orrery ingest-plan path/to/your-plan.yaml
   ```

   This validates the plan against the schema and copies it to `.agent-work/plans/`.

3. **Simulate the plan** (optional):

   ```bash
   # Using an agent with the simulate-plan skill
   /simulate-plan your-plan
   ```

4. **Execute the plan**:
   ```bash
   orrery exec
   ```

### Plan Schema Reference

See [externally-building-a-plan-reference.md](./externally-building-a-plan-reference.md) for the complete plan schema and detailed guidance on building orchestrator-ready plans.

---

## Review Loop

The review loop adds an iterative code review phase after each step finishes. Orrery runs a review agent that inspects the changes and either approves them or requests fixes. When fixes are needed, Orrery invokes an edit agent with the feedback and re-runs verification, repeating the cycle until approval or the maximum number of iterations is reached.

### Enabling the Review Loop

You can enable the loop per run with a CLI flag or via an environment variable:

```bash
orrery exec --review
```

Or set the environment variable:

```bash
export ORRERY_REVIEW_ENABLED=true
```

### Review/Edit Cycle

When enabled:

1. The review agent inspects the step results and diffs.
2. If approved, the step proceeds as normal.
3. If changes are requested, an edit agent applies the fixes and verification runs again.
4. The loop repeats until approved or the max iteration limit is reached.

By default, the loop runs up to 3 iterations. If the maximum is reached without approval, Orrery logs a warning and proceeds with the step.

---

## Parallel Execution

By default, Orrery executes steps serially. Enable parallel execution to run multiple independent steps simultaneously using git worktrees for isolation.

### Enabling Parallel Execution

Use the `--parallel` flag:

```bash
orrery exec --parallel
```

Or set the environment variable:

```bash
export ORRERY_PARALLEL_ENABLED=true
```

### How It Works

1. Steps marked `parallel: true` with no blocking dependencies run concurrently
2. Each parallel agent gets its own git worktree (isolated workspace)
3. Agents commit normally in their worktrees
4. After all parallel agents complete, commits are cherry-picked back to the main branch

### Configuration

Control the maximum concurrent agents with `ORRERY_PARALLEL_MAX` (default: 3).

### When to Use

- Steps that modify different files
- Independent implementation tasks
- When you want faster plan execution

### Limitations

- Cherry-pick conflicts may occur if parallel steps modify overlapping files
- If conflicts occur, manual resolution may be required
- Best suited for steps with clearly separated file scopes

---

## Handling Blocked Plans

Sometimes a plan step cannot be completed due to external issues (e.g., an API is unavailable, a dependency is missing). When this happens, the agent marks the step as "blocked" and the orchestrator pauses execution, staying on the work branch.

### Viewing Blocked Status

When on the work branch, `orrery status` auto-detects the plan and shows blocked reasons:

```bash
orrery status
```

Output:

```
(detected plan for branch: plan/add-feature)

blocked add-feature.yaml
  complete step-1 - Setup configuration
  blocked step-2 - Create database schema
    Reason: Could not connect to database server
  pending step-3 - Add migration scripts
```

### Recovery Workflow

1. **Fix the underlying issue**: Address the problem (e.g., restore the API, install the missing dependency)

2. **Unblock and resume** with a single command:

   ```bash
   orrery resume
   ```

   This command automatically:
   - Detects the plan for the current branch
   - Resets blocked steps to pending
   - Commits the plan file changes
   - Resumes orchestration

   You can also unblock a specific step:

   ```bash
   orrery resume --step step-2
   ```

   Or preview what would be unblocked:

   ```bash
   orrery resume --dry-run
   ```

---

## Command Reference

| Command                       | Description                                                                                                   |
| :---------------------------- | :------------------------------------------------------------------------------------------------------------ |
| `orrery`                      | Command reference.                                                                                            |
| `orrery ingest-plan`          | Validates an externally generated plan and imports it into your project's plans directory.                    |
| `orrery init`                 | Initialize Orrery: install skills to detected agents.                                                         |
| `orrery install-devcontainer` | Installs/Updates a devcontainer in your project.                                                              |
| `orrery install-skills`       | Installs/Updates agent skills to your global agent configuration directories.                                 |
| `orrery orchestrate`          | Executes the active plan. Use `--review` for review loop, `--parallel` for parallel execution. Alias: `exec`. |
| `orrery resume`               | Unblock steps and resume orchestration. Auto-detects plan, unblocks steps, commits, and resumes.              |
| `orrery status`               | Shows the progress of current plans. Auto-detects plan when on a work branch.                                 |

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
