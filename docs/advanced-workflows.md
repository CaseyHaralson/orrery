# Advanced Workflows

This document covers advanced Orrery workflows for power users.

---

## Devcontainer Setup

For isolated, reproducible development environments, Orrery provides a devcontainer workflow.

### Full Devcontainer Workflow

1. **Install the devcontainer** (or add Orrery to an existing one):
   ```bash
   orrery install-devcontainer
   ```

2. **Configure the devcontainer** (optional):
   - Set agent priority via environment variables
   - Add firewall rules if needed

3. **Open your project in the devcontainer**

4. **Sign into your agents**:
   - The devcontainer uses shared volumes between containers, so you only need to authenticate once

5. **Initialize Orrery**:
   ```bash
   orrery init
   ```

6. **Continue with the standard workflow** (discovery, simulate, execute)

---

## External Plan Creation

Plans can be created outside of an agent using the `ingest-plan` command. This is useful when:
- You have an existing planning workflow
- You want to use a different LLM for planning
- You're migrating plans from another system

### Workflow

1. **Create a plan file** following the schema in [externally-building-a-plan-reference.md](./externally-building-a-plan-reference.md)

2. **Validate and import the plan**:
   ```bash
   orrery ingest-plan path/to/your-plan.yaml
   ```

   This validates the plan against the schema and copies it to `.agent-work/plans/`.

3. **Simulate the plan** (optional but recommended):
   ```bash
   # Using an agent with the simulate-plan skill
   /simulate-plan .agent-work/plans/your-plan.yaml
   ```

4. **Execute the plan**:
   ```bash
   orrery exec
   ```

### Plan Schema Reference

See [externally-building-a-plan-reference.md](./externally-building-a-plan-reference.md) for the complete plan schema and detailed guidance on building orchestrator-ready plans.

---

## Handling Blocked Plans

Sometimes a plan step cannot be completed due to external issues (e.g., an API is unavailable, a dependency is missing). When this happens, the agent marks the step as "blocked" and the orchestrator pauses execution.

### Identifying Blocked Steps

Use the `orrery status` command to see which plans are blocked:

```bash
orrery status                                 # View plans that are blocked
orrery status --plan .agent-work/plans/<plan> # View the status of each step
```

Inspect the plan file directly in `.agent-work/plans/` to see the `blocked_reason` for each blocked step.

### Recovery Workflow

1. **Check the blocked reason**: Use `orrery status` to identify which plans are blocked and then check the blocked reason in the plan file

2. **Fix the underlying issue**: Address the problem (e.g., restore the API, install the missing dependency)

3. **Edit the plan file**: Change the step status from `blocked` to `pending` in the YAML file

4. **Resume orchestration**:
   ```bash
   git checkout <work-branch>  # Switch to the plan's work branch
   orrery exec --resume
   ```

The `--resume` flag finds the plan matching your current branch and continues execution from where it left off.

---

## Command Reference

| Command | Description |
| :--- | :--- |
| `orrery` | Command reference. |
| `orrery ingest-plan` | Validates an externally generated plan and imports it into your project's plans directory. |
| `orrery init` | Initialize Orrery: install skills to detected agents. |
| `orrery install-devcontainer` | Installs/Updates a devcontainer in your project. |
| `orrery install-skills` | Installs/Updates agent skills to your global agent configuration directories. |
| `orrery orchestrate` | Executes the active plan. Use `--resume` to continue a partially completed plan on the current branch. Alias: `exec`. |
| `orrery status` | Shows the progress of current plans. |

## Environment Variables

| Variable | Description | Default |
| :--- | :--- | :--- |
| `ORRERY_AGENT_PRIORITY` | Comma-separated list of agents for failover priority | `codex,gemini,claude` |
| `ORRERY_WORK_DIR` | Override the work directory path | `.agent-work` |
