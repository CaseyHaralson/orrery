# orrery

## Overview

This repository implements a canonical 5-phase workflow protocol for coding AI agents. The protocol ensures consistency across different AI tools, enables seamless agent-to-agent handoff, and provides clear checkpoints for quality control.

All agents, regardless of which AI tool powers them (Claude, Gemini, Codex, etc.), follow this unified workflow:

**Intake → Plan → Execute → Verify → Report**

### The 5 Phases

1. **Intake**: Fully understand the request, gather context, and clarify ambiguities
2. **Plan**: Break the task into manageable steps with clear dependencies and acceptance criteria
3. **Execute**: Implement the plan steps—write code, make changes, commit at logical points
4. **Verify**: Validate that changes meet acceptance criteria and nothing is broken
5. **Report**: Summarize results clearly for the user or for handoff to another agent

### Key Features

- **Standardized Plan Schema**: All work is tracked in `plan.yaml` files following a common schema
- **Agent Handoff**: Any agent can resume work from another by reading the plan file
- **Cross-Tool Compatibility**: Works seamlessly across different AI coding tools
- **Clear Checkpoints**: Each phase has defined completion criteria
- **Version Control Integration**: Changes are committed incrementally with meaningful messages

## Workflow Diagram

```mermaid
graph TD
    A[Intake] --> B[Plan]
    B --> C[Execute]
    C --> D[Verify]
    D --> E[Report]

    D -->|Tests Fail| C
    C -->|Blocked| B

    E -->|New Task| A

    style A fill:#e1f5ff
    style B fill:#fff4e1
    style C fill:#e8f5e9
    style D fill:#fff3e0
    style E fill:#f3e5f5

    subgraph "Phase 1: Intake"
        A
    end

    subgraph "Phase 2: Plan"
        B
    end

    subgraph "Phase 3: Execute"
        C
    end

    subgraph "Phase 4: Verify"
        D
    end

    subgraph "Phase 5: Report"
        E
    end
```

## Documentation

For detailed information about each phase, see:
- [Agent Workflow Protocol](agent/policies/WORKFLOW.md) - Complete workflow specification
- [Plan Schema](agent/schemas/plan-schema.yaml) - YAML schema for plan files
- [Report Schema](agent/schemas/report-schema.yaml) - YAML schema for report files

## Agent Roles

- **Coordinator Agent**: Oversees multi-step work, maintains the plan, dispatches steps to workers
- **Worker Agent**: Executes individual plan steps, loads appropriate skills, reports completion
- **Single-Agent Mode**: One agent acts as both coordinator and worker for simpler tasks
