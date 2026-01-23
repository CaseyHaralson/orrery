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

2. **Configure the devcontainer** (`.devcontainer/devcontainer.json`):
   - Set your agent priority if you use multiple or edit to your prefered agent via environment variable (`ORRERY_AGENT_PRIORITY`)
   - Add firewall to start if needed:
      ```json
      "postStartCommand": "sudo /usr/local/bin/init-firewall.sh",
      "waitFor": "postStartCommand"
      ```

3. **Open your project in the devcontainer**

4. **Sign into your agent(s)**:
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

## Plan Refinement

The `refine-plan` skill analyzes existing plans and implements improvements directly. Unlike `simulate-plan` (which is read-only), `refine-plan` writes changes to the plan file.

### When to Use

- Plan validation failed and you need to fix issues
- Context seems thin for autonomous execution
- Acceptance criteria are vague or untestable
- Missing dependency declarations (especially install step dependencies)
- Want to verify a plan is ready before execution

### Workflow

1. **Run the refine-plan skill**:
   ```bash
   # Using an agent with the refine-plan skill
   /refine-plan .agent-work/plans/your-plan.yaml
   ```

2. **Review the analysis**: The skill reports what improvements it found (or confirms the plan is ready if none needed)

3. **Changes are applied automatically**: Unlike simulate, refine writes directly to the plan file

4. **Validation runs automatically**: The PostToolUse hook validates the plan after writing

### What It Checks

| Category | Examples |
| :--- | :--- |
| **Structural issues** | Missing required fields, malformed step IDs |
| **Dependency issues** | Missing install step deps, circular dependencies |
| **Context quality** | Thin context, missing context_files |
| **Criteria quality** | Vague or untestable acceptance criteria |
| **Risk coverage** | Complex steps without risk_notes |
| **Schema compliance** | Invalid field types, missing required fields |

### Example

```bash
/refine-plan .agent-work/plans/analytics-dashboard.yaml

# Output:
# Found 3 improvements:
# - Dependency issues: Steps 1.1, 2.1 don't depend on install step (0.1)
# - Context quality: Step 1.2 has thin context
# - Criteria quality: Step 2.3 has vague criteria ("error handling works")
#
# Implementing changes...
# Plan validated successfully.
```

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

| Command | Description |
| :--- | :--- |
| `orrery` | Command reference. |
| `orrery ingest-plan` | Validates an externally generated plan and imports it into your project's plans directory. |
| `orrery init` | Initialize Orrery: install skills to detected agents. |
| `orrery install-devcontainer` | Installs/Updates a devcontainer in your project. |
| `orrery install-skills` | Installs/Updates agent skills to your global agent configuration directories. |
| `orrery orchestrate` | Executes the active plan. Use `--resume` to continue a partially completed plan on the current branch. Alias: `exec`. |
| `orrery resume` | Unblock steps and resume orchestration. Auto-detects plan, unblocks steps, commits, and resumes. |
| `orrery status` | Shows the progress of current plans. Auto-detects plan when on a work branch. |

## Environment Variables

| Variable | Description | Default |
| :--- | :--- | :--- |
| `ORRERY_AGENT_PRIORITY` | Comma-separated list of agents for failover priority | `codex,gemini,claude` |
| `ORRERY_WORK_DIR` | Override the work directory path | `.agent-work` |
