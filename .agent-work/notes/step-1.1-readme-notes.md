# README notes for CLI commands and skills docs

## install-skills
- Description: Install orrery skills for supported agents.
- Options:
  - --agent <agent>: Target agent (claude|codex|gemini|all); defaults to auto-detect.
  - --force: Overwrite existing skills.
  - --dry-run: Show what would be copied without writing files.
- Behavior notes:
  - Auto-detects installed agents when --agent not provided.
  - Warns and exits if no skills found or no valid agent targets.

## orchestrate (alias: exec)
- Description: Run plan orchestration for the current project.
- Options:
  - --plan <file>: Process only a specific plan file.
  - --dry-run: Show what would be executed without running agents.
  - --verbose: Show detailed agent output.
  - --resume: Resume orchestration on the current work branch.

## status
- Description: Show orchestration status for plans in this project.
- Options:
  - --plan <file>: Show detailed status for a specific plan.
- Output behavior:
  - Without --plan, prints summary counts and a list of plans with status labels.
  - With --plan, prints step-by-step status for the selected plan file.

## Docs to link
- docs/agent-skills-definition.md (Agent Skills overview, how skills work).
