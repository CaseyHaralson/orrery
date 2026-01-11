# Cross-Agent Skills and Planning System for Consistent Multi-Tool Coding Agents

## 1. Executive Summary & Recommended Architecture

We propose a unified, repository-based system that ensures multiple coding AI agents (Gemini CLI, Claude Code, OpenAI Codex, Cursor, and Google Antigravity) follow a consistent workflow and can seamlessly collaborate on software tasks. The core idea is to define canonical “agent skills” and a shared workflow protocol in one repository, then synchronize these across tool-specific configurations. Each agent will load the same skills and adhere to the same 5-phase workflow (Intake → Plan → Execute → Verify → Report), enabling coherent behavior regardless of the underlying AI tool.

Recommended Architecture: At the heart of the system is a “Skills” library in the repository that uses the open Agent Skills format. Each skill (e.g. intake, plan, execute, etc.) is a folder containing a standardized SKILL.md with instructions (and optionally scripts or reference files) describing how to perform that phase of work. On project startup, each agent scans the repository’s skills and loads a summary of available skills into its system context (using a concise metadata listing). When an agent needs to perform a phase (like planning or code execution), it “activates” the corresponding skill by pulling in the full instructions from SKILL.md on demand

. This ensures all agents follow the same playbook for each task phase. A shared Plan format (machine- and human-readable) is used for agent-to-agent handoff: one agent can produce a structured plan of action items that another agent (or instance) can parse and execute. A designated Coordinator agent can oversee this process, delegating plan steps to Worker agents and tracking progress.

This architecture is tool-agnostic and maintainable. All core skills, workflow definitions, and policies live in the repository (under version control), and lightweight adapters or configuration files in each tool’s environment (e.g. .claude/, .gemini/, etc.) ensure the tools ingest those skills and follow the protocol. By centralizing skills and workflow logic, teams can update behavior in one place and have all agents immediately use the new approach. It also enables agent-to-agent handoff – for example, an agent using Claude might generate a plan that a Gemini agent can continue executing – since both understand the same plan schema and skill definitions.

In summary, the system creates a unified “multi-agent operating manual” in the repository. This fosters consistent behavior across AI coding tools, allows complex tasks to be split among specialized agents, and provides maintainability via Git versioning and CI testing. Below, we detail the design of the skills architecture, repository layout, workflow protocol, plan schema, tool-specific considerations, synchronization approach, evaluation framework, and governance model, with examples illustrating each part.

## 2. Repository Layout

We organize the repository to separate canonical knowledge (skills, policies, schemas) from tool-specific adapters. Below is a proposed top-level layout with key folders:

```graphql
project-root/
├── agent/
│   ├── skills/
│   │   ├── intake/
│   │   │   └── SKILL.md
│   │   ├── plan/
│   │   │   └── SKILL.md
│   │   ├── execute/
│   │   │   └── SKILL.md
│   │   ├── verify/
│   │   │   └── SKILL.md
│   │   ├── report/
│   │   │   └── SKILL.md
│   │   ├── review/
│   │   │   └── SKILL.md
│   │   └── security/
│   │       └── SKILL.md
│   ├── policies/
│   │   └── WORKFLOW.md      # defines the 5-step protocol, roles, etc.
│   └── schemas/
│       ├── plan-schema.json
│       └── report-schema.json
├── .gemini/
│   ├── settings.json        # Gemini CLI project settings (if needed)
│   ├── GEMINI.md            # Project-wide context instructions (if any)
│   └── skills/              # Materialized skill files for Gemini (auto-synced)
│       └── * (mirrors agent/skills structure) *
├── .claude/
│   ├── settings.json        # Claude Code project settings (permissions, etc.)
│   ├── CLAUDE.md            # Project instructions for Claude (if needed)
│   └── skills/              # Skills for Claude Code (mirrors agent/skills)
│       └── * (same skill subfolders) *
├── .cursor/
│   ├── rules/               # Cursor static rules (if used, e.g., RULE.md)
│   ├── skills/              # Skills for Cursor (mirrors agent/skills)
│   │   └── * (skill subfolders copied or symlinked here) *
│   └── hooks.json           # (Optional) Cursor hooks configuration
├── .codex/
│   └── skills/              # Skills for OpenAI Codex or CLI (mirrors agent/skills)
└── .antigravity/
    └── skills/              # Skills for Google Antigravity (mirrors agent/skills)
```

### Canonical Directories:

  - agent/skills/ – The source of truth for all agent skills. Each skill has its own subdirectory named after the skill (e.g. intake, plan). Inside is a SKILL.md that contains the skill’s instructions and optional YAML frontmatter (more on format below). Additional optional subdirs can provide scripts or reference docs for that skill (e.g. scripts/, references/). For example, a security skill might have a scripts/audit.py to run security scans, referenced in its SKILL.md.

  - agent/policies/WORKFLOW.md – A human-readable canonical definition of the overall workflow protocol and policies that all agents must follow. This document details each phase (intake, plan, execute, verify, report), the expected behavior in that phase, and any general guidelines (e.g. coding style, safety rules). It serves as a single reference for the “rules of engagement” that the agents are following. Agents may not directly read this file, but it’s useful for developers to maintain consistency and could be partially integrated into skill instructions (for instance, the plan/SKILL.md might summarize relevant parts of the protocol).

  - agent/schemas/ – JSON or YAML schemas defining structured formats used by the agents to communicate. Specifically:

    - plan-schema.json (or .yaml): defines the schema for the plan format used in agent-to-agent handoff (task list, dependencies, etc).

    - report-schema.json: defines the schema for an execution report produced after the Execute/Verify phases. Using explicit schemas helps validate that plans and reports are well-formed and allows different agents or tools to parse them consistently.

  - (Optional) agent/benchmarks/ – A suite of standardized tasks and expected outputs for consistency testing (discussed more in section 8). This could include sample prompts and the ideal plan or solution that all agents should achieve, used for regression testing.

### Tool-Specific Directories:

Each AI tool may require its own config directory (commonly a hidden folder like .toolname/) to integrate with the repository. These hold any settings or files that the tool uses at runtime:

  - .gemini/ – For Google Gemini CLI:

    - We include settings.json to configure project-specific settings (e.g. permission policies, enabling experimental features). For instance, setting "experimental.skills": true in this file would turn on the Agent Skills feature in Gemini CLI.

    - GEMINI.md: While not strictly required, Gemini CLI supports hierarchical “context files” named GEMINI.md that are automatically loaded as part of the system prompt. We could use this to provide high-level project instructions or style guidelines that apply to all tasks (though major instructions are better structured into skills). The presence of a GEMINI.md in the repo root or .gemini/ is discovered by Gemini CLI and concatenated into the prompt context.

    - .gemini/skills/: a mirror of the canonical agent/skills. On project setup or update, a sync tool will populate this with each skill’s files (either copying or symlinking from agent/skills). This allows Gemini CLI to discover available skills. (In the future, Gemini CLI may support directly pointing to a skills directory; until then, this folder ensures skills are in the expected location).

  - .claude/ – For Anthropic Claude Code:

    - settings.json for Claude’s project configurations (e.g., allowed/denied tools, environment variables). We might configure this to always allow certain safe operations (like read access to the skills files) and to integrate with our plan files.

    - CLAUDE.md: Claude Code automatically loads a file by this name at startup as persistent instructions. We can use CLAUDE.md to reference our workflow (e.g., “Always follow the 5-step workflow defined by the team. Use the skills available in .claude/skills as needed.”). It is recommended to keep this file concise and focused since it contributes to every prompt’s context.

    - .claude/skills/: again a mirror of the canonical skills, for Claude’s use. If Claude Code supports the Agent Skills open format (Anthropic introduced the standard), it likely looks in .claude/skills/ for skill folders. The sync process will ensure our agent/skills/* appear here. Claude Code’s “subagent” system (custom assistants defined in .claude/agents/) might also be leveraged, but since we want consistency across tools, using the shared skill format is preferable.

  - .cursor/ – For Cursor (AI Editor):

    - Cursor supports two concepts: Rules (static instructions always included) and Skills (dynamic, agent-invoked capabilities). We will store any always-on guidance (if needed) as rules in .cursor/rules/ (each with a RULE.md), analogous to CLAUDE.md/GEMINI.md but segmented by topic if needed. For example, a commands rule might list common commands, a style rule the code style guidelines, etc.

    - .cursor/skills/: Cursor’s implementation of Agent Skills will use a skills directory. We mirror our canonical skills here so that Cursor’s agent can load them dynamically. According to Cursor’s documentation, skills in Cursor are defined by SKILL.md files and can include “Custom commands, Hooks, and Domain instructions”. By having identical SKILL.md files here, the Cursor agent can discover and invoke them when relevant, just like Claude or Gemini.

    - Additionally, Cursor uses a hooks.json for custom automation (not directly our focus, but we might include one to automate plan execution loops if needed as an advanced feature).

  - .codex/ – For OpenAI Codex (or GPT-based code agents):

    - OpenAI’s Codex (or GPT-4/ChatGPT in coding mode) doesn’t natively have a filesystem agent interface like Claude or Gemini. However, we can still adapt. This directory can hold skills for any tool or wrapper that uses OpenAI models. For example, if using a CLI or editor plugin that integrates GPT-4, we could have it read from .codex/skills/ or manually inject those skill instructions via prompts. If using a community tool (like SkillPort or similar) that brings skills to Codex, it could be configured to use this folder. In absence of native support, .codex/skills serves as a staging area for skills that a middleware script can feed into the OpenAI agent’s context.

  - .antigravity/ – For Google Antigravity IDE:

    - Antigravity is an “agent-first” IDE that likely supports shared workflows and skills. We anticipate it will allow loading custom skills (especially since it supports multi-agent orchestration). This folder mirrors the skills for Antigravity’s agent manager to load. If Antigravity uses a similar mechanism to rules/skills (the StackOverflow link hint suggests it can customize rules/workflows in a manner akin to CLAUDE.md), we would store those here. For instance, if Antigravity recognizes a file like AGENT.md or similar for project instructions, we’d include it. For now, .antigravity/skills/ ensures any on-disk skill discovery is satisfied.

### Plan & Task Artifacts:

  - We may also designate a location for plans and reports to be stored for handoff. For example, a plans/ directory in the repo where an agent saves current_plan.yaml (which another agent can read and execute), and a reports/ directory for final reports or intermediate results (screenshots, test outputs etc.). These could alternatively live in a temp folder or be exchanged via memory, but having them in the repo can aid traceability and debugging (and allow humans to inspect). The repository layout should clarify where such artifacts go, perhaps in a git-ignored agent/artifacts/ folder or similar.

By structuring the repository in this way, we ensure a clear separation of concerns:

  - The agent/ folder is the single source of truth for how agents should behave (skills and policies).

  - The dot-folders (.gemini, .claude, etc.) adapt that truth to each specific tool environment, without forking the logic. If a skill is updated in agent/skills/..., a synchronization step updates it for all tool directories, so consistency is maintained.

This layout is platform-agnostic and does not assume any particular CI/CD, though we include hooks for CI and testing. It’s also designed to work offline: all necessary instructions reside in the repo so agents don’t need external internet access (except when the task at hand intentionally uses a tool to fetch something).

Next, we dive deeper into how the skills are defined and used within this architecture.

## 3. Skills System Design

Agent Skills Architecture: We adopt the open Agent Skills format (initially developed by Anthropic and now industry-supported)

to define portable skills. In our system, a “skill” represents a self-contained capability or procedural knowledge set that an agent can use to perform a specific part of the workflow or a specialized task. All skills are stored canonically under agent/skills/<skill-name>/SKILL.md in the repository.

SKILL.md Format: Each SKILL.md consists of an optional YAML frontmatter followed by Markdown instructions. The frontmatter provides structured metadata about the skill, and the Markdown body provides the detailed guidance for the agent. For example, here is a simplified snippet for the plan skill:

```markdown
--- 
name: plan 
description: > 
  Decompose a project request into a step-by-step implementation plan, 
  including task breakdown, dependencies, and responsible agents. 
license: CC-BY-4.0 
compatibility: Works with any coding agent (Claude, Gemini, etc.) 
metadata:
  version: "1.0"
--- 

# Plan Skill

## When to Use
Use this skill at the beginning of a task, after clarifying requirements, to draft a detailed plan of action.

## How to Do It
1. **Analyze the request:** Restate the user’s goal and any constraints.
2. **Propose steps:** Break the goal into clear, ordered steps. For each step, consider:
   - What sub-problem it addresses.
   - Any prerequisite steps (dependencies).
   - Which agent/tool is best suited (if multi-agent), or "self" if the same agent will do it.
3. **Format the plan:** Output a structured list (YAML or JSON) with each step’s details (ID, description, owner, dependencies, status, etc.).
4. **Review:** Ensure the steps cover all requirements and are feasible given the environment and skills available.

## Example
_Input:_ "Add a feature to upload CSV files and display summary stats."  
_Output (plan excerpt):_
```yaml
steps:
- id: 1 
  description: "Create file upload UI in frontend" 
  owner: "UI-Agent" 
  deps: [] 
  criteria: "User can select a CSV and hit upload."
- id: 2 
  description: "Backend endpoint to receive CSV and compute stats" 
  owner: "API-Agent" 
  deps: [1] 
  criteria: "CSV data parsed; returns record count, mean, median."
...
```

This illustrative `SKILL.md` shows typical sections we encourage skill authors to include:
- **“When to Use”** – conditions or triggers for the skill (helps the agent decide *if* the skill is relevant):contentReference[oaicite:34]{index=34}:contentReference[oaicite:35]{index=35}.
- **“How to Do It”** – step-by-step guidance or best practices for performing the skill’s task.
- **Examples/Edge Cases** – concrete examples of inputs/outputs, or pitfalls to watch for.

Skills are essentially modular prompt templates or instructions. By packaging them in a Markdown file, we make them easy to maintain and version (and they’re somewhat human-readable for review). The agents will load these files as needed, rather than hardcoding lengthy instructions in a system prompt.

**Folder Structure and Extras:** Within each skill folder, we can include:
- **`scripts/`** directory for any helper scripts the skill might invoke (for example, the `verify` skill might have `scripts/run_tests.sh` that the agent can call to execute the test suite):contentReference[oaicite:36]{index=36}. Scripts can be in languages like Python, Bash, etc., depending on what the agent’s execution environment supports. We ensure scripts are self-contained and documented, since they might be executed autonomously:contentReference[oaicite:37]{index=37}.
- **`references/`** directory for additional documentation or data files:contentReference[oaicite:38]{index=38}. For instance, a `security` skill might have `references/OWASP_TOP10.md` if needed, or a `review` skill might include a `references/code_style.md` with detailed style conventions. Agents will only load these on demand (e.g., if the skill’s main instructions refer to them), which keeps the memory footprint lower:contentReference[oaicite:39]{index=39}.
- **`assets/`** for any static files (images, templates, etc.) if relevant:contentReference[oaicite:40]{index=40}. In a coding context this may be less used, but could include things like a configuration template file.

These additional files support a principle of **progressive disclosure**: the agent first only sees the minimal info (skill name & description), then the full `SKILL.md` when using the skill, and only loads deep reference or scripts when absolutely needed:contentReference[oaicite:41]{index=41}:contentReference[oaicite:42]{index=42}. This way we balance giving the agent powerful tools with minimizing unnecessary context load.

**Skill Discovery and Loading:** How do agents actually *use* these skills? The process is:

- **Discovery:** When an agent session starts (or when explicitly refreshed), the agent scans the configured skills directories (e.g. `.claude/skills/`, `.gemini/skills/`) for skill folders containing `SKILL.md`:contentReference[oaicite:43]{index=43}:contentReference[oaicite:44]{index=44}. It parses each `SKILL.md`’s YAML frontmatter to get the `name` and `description`:contentReference[oaicite:45]{index=45}:contentReference[oaicite:46]{index=46}. This metadata is then injected into the agent’s context (usually the system or developer prompt) in a compact form so the model knows what skills are available. For example, Claude and others use an XML-like listing of skills in the prompt, as shown below:

```xml
<available_skills>
  <skill>
    <name>plan</name>
    <description>Breaks down a project into a step-by-step implementation plan.</description>
    <location>/repo/.claude/skills/plan/SKILL.md</location>
  </skill>
  <skill>
    <name>execute</name>
    <description>Writes code to implement a given task or plan step, and makes commits.</description>
    <location>/repo/.claude/skills/execute/SKILL.md</location>
  </skill>
  <!-- other skills... -->
</available_skills>
```

This example follows the recommendation for Claude models to list skills in an XML section. The location field may be included for filesystem-based agents to know where to cat the file when needed. Tool-based agents (that don’t have direct file system access) might omit the path and instead have a built-in mechanism to fetch the skill by name.

  - Activation: When the agent is processing a user request or a current task, it will decide which skill (if any) is relevant. This is part of the agent’s chain-of-thought – e.g., if the user’s prompt is to generate a plan, the agent recognizes the plan skill should be used. Once it decides to use a skill, it will load the full content of SKILL.md (often by issuing an internal command like reading the file) and incorporate those instructions into its reasoning process. Think of it as a function call: the agent’s prompt now gets supplemented with, say, “(Agent calls on plan skill)…” followed by the content of plan/SKILL.md. The agent then follows those instructions to produce its next output.

  - Skill Execution (Scripts): If a skill’s instructions involve running a script (say the execute skill might instruct: “Once code is written, run scripts/run_tests.sh to verify”), the agent can use its toolset to execute it. For instance, Claude Code or Gemini can run shell commands in a sandbox. We allow such script usage but with safety checks (discussed under security and permission models). The skill frontmatter’s allowed-tools field can whitelist certain operations for this skill– for example, allowed-tools: Bash(npm:*) Bash(python:*) might tell the agent it’s pre-approved to run npm or python commands when using this skill.

  - Versioning Strategy: Each skill’s metadata can include a version number (as shown with "version": "1.0" above). This helps track updates. We plan to version skills semantically (major.minor.patch) and document changes in a changelog. Since skills are code-like content, updates would go through code review (discussed in Governance). If a skill update is not backward compatible with older agents, the compatibility field in frontmatter can note requirements (e.g., “Requires Claude Code 1.5 or later”). The tool adapters can use this info to only load compatible skills or warn if there’s a mismatch.

  - Compatibility Differences: While the skill content is meant to be universal, we recognize not all agent LLMs behave identically. Some might need slight tuning. For example, one model might respond better to very explicit instructions (“IMPORTANT: Do X”), whereas another might have a smaller context window requiring brevity. We will handle this by:

    - Keeping the canonical SKILL.md as neutral and tool-agnostic as possible.

    - If needed, use the compatibility frontmatter to note special handling, or include conditional sections in the Markdown (for instance, “(Note for GPT-3.5 based agents: do Y instead of Z)”). Agents can be instructed to ignore sections not for them.

    - In worst-case scenarios, we maintain slight variants in the tool-specific copy – but we aim to avoid divergence. The goal is one canonical skill definition that works across the board. The open standard encourages this by allowing one skill to be used by many agents.

Example Skill – execute: To further illustrate, the execute skill might be defined as follows (summary):

  - Name: execute

  - Description: Writes or modifies code according to a plan step, and performs the necessary actions to integrate it (running tests, formatting, committing code).

  - Instructions: “When activated, this skill guides the agent to: understand the task from the plan, open or create the relevant files in the codebase, write the code (explaining reasoning minimally in comments), run tests (npm test or similar) to verify, and if all passes, commit the changes with a meaningful message. If tests fail, identify the issues and attempt fixes (looping back to coding). Use caution with destructive operations (flag to user if something major is about to be changed).”

  - Scripts/References: perhaps a scripts/format.sh to auto-format code, or references to project coding conventions.

With such a skill in place, whenever an agent is ready to implement a step, it will load the execute skill and follow that process. Meanwhile, a verify skill might contain instructions on how to verify changes: run test suites, static analyzers, and confirm acceptance criteria, etc., and a report skill might outline how to summarize results for the user or produce a final diff/PR.

Agent-to-Agent Handoff via Skills: Another powerful use of skills is enabling one agent to delegate to another. For instance, a plan skill could include a step where the agent decides: “This plan step might be better done by a specialized agent. Use the coordinator to spawn a new agent.” In practice, delegation might be handled more by the plan schema and coordinator (next sections), but skills can mention it. We could have a skill like review which an executing agent can call after coding to get a second opinion (i.e., trigger the “Code Review Agent”). In our architecture, that would mean the agent writes a message or file that signals another agent (with the review skill knowledge) to start, effectively a controlled agent-to-agent handoff (the details of which are in the Plan format and workflow protocol).

In summary, the Skills system provides a modular library of behaviors. It ensures consistency (everyone uses the same instructions for the same task), reusability (skills can be applied by multiple agents or in different contexts), and extensibility (adding a new skill – e.g., a refactor skill – is as simple as adding a folder with a SKILL.md, which all compliant agents will automatically discover and be able to use). By leveraging the established Agent Skills spec, we align with a format that tools already understand, and our design benefits from community support and tooling (like validators, examples of good skills, etc.).

Next, we’ll address how agents coordinate work via a shared plan format and how one agent’s output (a plan or partial result) can be handed off to another agent for execution, which is crucial for multi-agent collaboration.

## 4. Plan & Action Item Format (Agent-to-Agent Handoff)

To coordinate multiple agents and allow one to pick up where another left off, we define a Plan & Action Item format that is both machine-readable and human-readable. This format acts as an interchange document describing what needs to be done, by whom, and with what dependencies. We choose YAML (or JSON) for the structured format, because it’s easily parsed by programs and reasonably easy for humans (and AI models) to read and edit. YAML also allows adding comments or descriptions, which can be useful for humans supervising the plan.

### Plan Schema

A Plan consists of a list of action items (steps), each with attributes capturing the requirements from the prompt:

  - id: A unique identifier for the action (e.g., a number or string). Useful for referencing dependencies.

  - description: Natural language summary of the task to perform.

  - owner: The agent or role responsible for this step. This could be a specific tool/agent name (like "Claude" or "Gemini") or a role like "UI-Agent" or "DB-Agent" if we categorize by expertise. It can also be "Coordinator" for a step that involves orchestration.

  - status: The current status of the step – e.g., "pending", "in_progress", "complete", "blocked". This allows tracking partial completion.

  - deps: Dependencies – a list of ids that this step depends on. A step shouldn’t start until its dependencies are complete. This encodes ordering and parallelization.

  - parallel: (Optional boolean) If true, indicates this step can be done in parallel with others (assuming deps are satisfied). Otherwise, default sequential.

  - criteria: Acceptance criteria – what are the conditions of success for this step. This ensures whoever executes it knows when they’re “done.” (E.g., “unit tests for module X are all passing” or “UI passes manual smoke test”).

  - commands: (Optional) Specific commands or actions to execute as part of this step. For example, a step might include "commands: ['Run: npm test', 'Read: logs/output.log']" if it entails running tests. These can guide an executing agent or even be used by a runner to automate some checks.

  - files: (Optional) File targets – list of filenames that this step will create or modify. Useful for verifying changes or avoiding conflicts. For instance, step “Implement upload API” might list ['backend/api/upload.py', 'backend/api/__tests__/upload_test.py'].

  - risk_notes: (Optional) Any warnings or things to watch out for (“This step might affect authentication flow, be careful with user permissions”).

We formalize this in a JSON Schema (in agent/schemas/plan-schema.json). Here’s a simplified version of the schema definition:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "AgentPlan",
  "type": "object",
  "properties": {
    "steps": {
      "type": "array",
      "items": { "$ref": "#/definitions/Step" }
    }
  },
  "definitions": {
    "Step": {
      "type": "object",
      "required": ["id", "description", "owner"],
      "properties": {
        "id": { "type": "string" },
        "description": { "type": "string" },
        "owner": { "type": "string" },
        "status": { "type": "string", "enum": ["pending","in_progress","complete","blocked"] },
        "deps": {
          "type": "array",
          "items": { "type": "string" }
        },
        "parallel": { "type": "boolean" },
        "criteria": { "type": "string" },
        "commands": {
          "type": "array",
          "items": { "type": "string" }
        },
        "files": {
          "type": "array",
          "items": { "type": "string" }
        },
        "risk_notes": { "type": "string" }
      }
    }
  }
}
```

This schema ensures a consistent structure. The agents (or a coordinator program) can validate any plan JSON/YAML against it.

### Example Plan File

Suppose the user asks for a new feature that spans front-end and back-end changes. An agent (say using the plan skill) produces a plan and saves it as current_plan.yaml. Here’s an example:

```yaml
# Plan generated on 2026-01-10 by PlannerAgent (Claude)
steps:
- id: "1"
  description: "Design the database schema for storing uploaded CSV data"
  owner: "DB-Agent"
  deps: []
  status: "pending"
  criteria: "Schema updated with a new table for CSV metadata"
  risk_notes: "Ensure not to break existing schema; consider migration"
- id: "2"
  description: "Implement backend endpoint to upload CSV and compute summary stats"
  owner: "Backend-Agent"
  deps: ["1"]
  status: "pending"
  criteria: "POST /upload returns summary (count, mean, median) for uploaded CSV"
  commands:
    - "Run: pytest tests/test_upload.py"   # to validate later
  files:
    - "backend/routes/upload.py"
    - "backend/services/csv_stats.py"
- id: "3"
  description: "Implement front-end UI for CSV upload (file picker and results display)"
  owner: "Frontend-Agent"
  deps: ["2"]           # front-end after backend is ready (or could be parallel with backend if stubbed)
  status: "pending"
  criteria: "User can select a file and see summary stats after upload"
  files:
    - "frontend/components/UploadWidget.vue"
- id: "4"
  description: "End-to-end integration test of the new upload feature"
  owner: "QA-Agent"
  deps: ["2", "3"]
  status: "pending"
  criteria: "Uploading a sample CSV through the UI yields the correct stats in response"
  commands:
    - "Run: playwright test e2e/upload.spec.ts"
  risk_notes: "Test on large CSV to ensure performance is acceptable"
```

This plan is both readable and parseable. A human can see what’s to be done, and an automated system or agent can load this structure. The plan indicates, for example, step 1 (DB schema) has no prerequisites and can start immediately, steps 2 and 3 depend on prior steps, etc. It also clearly assigns different “agents” (by role) to each step – which in a multi-agent setup could correspond to spinning up specialized agents or simply guiding a single agent with an indication of persona.

### Agent-to-Agent Handoff and Collaboration

With this plan, we enable several collaboration patterns:

  - Sequential handoff: One agent (Planner) created the plan. Now, another agent (Coordinator or the specific agent in owner) will execute each step. For example, when step 1 is ready, we could launch a DB-Agent (which might just be the same AI model prompted to focus on database tasks with relevant skill context) to carry out step 1. After step 1 completes and the plan is updated (mark status complete), the coordinator moves to step 2, launching Backend-Agent, and so on.

  - Parallel work: If two steps have no dependency relation (or are both ready after deps are done), the coordinator can assign them to different agents to execute in parallel. For instance, if frontend (3) didn’t depend on backend (2), we could do them concurrently. The plan’s parallel flags (or implicitly lack of deps) signal this possibility.

  - Ownership & expertise: The owner field lets us route tasks to the best agent. For example, if owner: "Frontend-Agent" and we have a Claude-based agent fine-tuned for front-end, the coordinator can direct that task there. In a simpler scenario, owner might just be an annotation and the same agent does all steps but behaves slightly differently knowing the context (e.g., uses different tools for front vs backend).

  - Status tracking: As steps progress, agents or the coordinator update the status field. This could be done by editing the YAML file or keeping an internal state. For reliability, the coordinator agent could maintain an authoritative version of the plan file.

The plan file is machine-readable – e.g., a Python script or the coordinator agent can parse the YAML to ensure all dependencies are met before launching a step, and to locate which files or commands are expected. It’s also human-readable, so developers supervising the process can understand what the AI intends to do (and potentially intervene by editing the plan or adding comments if something looks off).

### Execution Report Format

In addition to plans, we define an Execution Report format, which is generated after (or during) the Execute and Verify phases. The purpose of the report is to summarize what actions were taken and the results, in a structured way. This helps both in verifying outcomes and in communicating between agents or to the user.

A report might include:

  - Which steps have been completed, and any evidence (like test results, or diff of code).

  - If a step failed or was blocked, include error messages or reasons.

  - Summary of any artifacts produced (screenshots, logs).

For example, after step 2 (implement backend) an agent might produce a partial report report_step2.json:

```json
{
  "step_id": "2",
  "outcome": "success",
  "details": "Backend endpoint /upload implemented and returns correct summary stats.",
  "artifacts": [
    {"file": "backend/routes/upload.py", "status": "created"},
    {"file": "backend/services/csv_stats.py", "status": "created"},
    {"test": "tests/test_upload.py", "result": "PASSED in 0.42s"}
  ],
  "timestamp": "2026-01-10T17:30:00Z"
}
```
We could have a report per step or a combined report for the whole task. In CI or evaluation, these reports can be checked against expectations (e.g., did all tests pass? was the code diff within acceptable size? etc.).

The plan and report together enable a closed-loop collaboration: The plan tells agents what to do, and the report (plus environment feedback like test results) tells whether it was done correctly, which in turn could update the plan (if something needs redoing or additional steps added – e.g., a bug fix step could be appended if an error is found, akin to an iterative loop).

### Multi-Agent Pattern: Coordinator + Workers

To orchestrate this, we envision a Coordinator Agent that serves as the overseer. The Coordinator’s responsibilities:

  1. Read/maintain the plan structure.

  2. Decide which step(s) to execute next (based on dependencies and statuses).

  3. Dispatch each step to an appropriate Worker agent (which could simply be invoking the right skill set in the same LLM, or spinning off a separate session possibly with a different model).

  4. Monitor progress and update the plan status.

  5. Handle any feedback or new information (for example, if a Worker reports that a step failed, the Coordinator might insert a new remedial step or mark the plan as needing review).

Worker Agents are essentially instances that execute individual steps. They use the Skills library to actually carry out the task:

  - If the step is coding, the worker uses the execute skill (and likely verify as part of it).

  - If the step is verification or testing (like step 4), the worker might primarily use a verify skill.

  - If a step is a review, a worker with the review skill could perform it.

This pattern is very much like a manager delegating to employees. It aligns with research patterns of using a Planner (or Orchestrator) and Executors in LLM systems. In fact, instructing an LLM to output a structured plan and then following it is a known approach for complex tasks. Our system formalizes that with a persistent plan file and multiple agents.

Example Collaboration: Let’s walk through a short scenario:

  - The Intake phase agent (could be the same as coordinator or a dedicated one) takes the user prompt and possibly asks clarifying questions (guided by intake skill). Suppose the user says “Add CSV upload feature.” The intake agent confirms requirements and yields a refined task description.

  - The Plan phase agent (Planner) uses the plan skill to create current_plan.yaml (like the example above). This plan is saved and maybe also summarized to the user (“I have outlined 4 steps: DB schema, Backend API, Frontend UI, Integration Test.”).

  - The Coordinator reads the plan. Step 1 has no deps, so it selects an agent (maybe it knows a template prompt for a DB-specialized agent, or it uses the same model but primes it with the execute skill and context focusing on DB).

  - The Worker for step 1 executes: using execute skill to write migration or schema changes. It marks step 1 done, possibly attaches a short report (e.g., “added table X, updated ERD diagram”).

  - Coordinator updates current_plan.yaml step 1 to status "complete". Now sees step 2 is unblocked. It dispatches a Worker for step 2 (backend).

  - Step 2 worker writes code, runs tests. Suppose tests pass; it marks success. If tests failed, step 2 worker might update status to "blocked" and even append a sub-step in the plan for fixing the test (depending on autonomy – or it could try to fix within the same step).

  - Coordinator sees step 2 done, triggers step 3 (frontend agent). Meanwhile, conceivably, it could have triggered step 3 earlier in parallel if feasible.

  - Eventually all steps complete, then maybe the coordinator triggers a final Report phase agent to compile a comprehensive report for the user or for records, using the report skill (which might gather all step reports and produce a markdown summary or commit log).

Throughout, each agent is using the same protocol and skills: they produce plans, write code, verify, etc., in the prescribed formats. This means any agent could hand over to another at a clean break. For example, even if one tool (say Codex) started the plan and for some reason had to stop, another (say Claude Code) could read current_plan.yaml and continue execution, because it understands the same schema and has the same skills available to interpret “Implement backend endpoint” in the same way.

Human-Readable Aspect: The plan is kept human-readable intentionally. If a developer wants to modify it (“Actually, add a step 5 to update documentation”), they can edit the YAML and commit it or feed it back to the coordinator agent. The agents will treat it as the new source of truth. Also, if something goes wrong, a human can inspect the plan and partial outputs to debug the agent’s reasoning. This transparency is a big advantage over a pure end-to-end black-box approach.

We will provide templates and examples of plan and report files in the repository (perhaps in agent/examples/). During development, we can test the plan generation and consumption logic with these examples to ensure robustness.

To summarize, the Plan/Action format is the lingua franca for our multi-agent system, enabling planned coordination, parallel execution, and clear tracking of work. It is a crucial component for achieving consistent outcomes no matter which agent is actually doing the work, and for supporting agent hand-offs gracefully.

## 5. Agent Workflow Protocol (Tool-Agnostic)

All agents, regardless of platform, will follow a unified 5-phase workflow for any significant coding task. This workflow is designed to impose structure and checkpoints, ensuring thoroughness and consistency. The phases are:

  1. Intake – Understand and clarify the task.

  2. Plan – Devise an execution plan or solution outline.

  3. Execute – Carry out the plan (write code or perform changes).

  4. Verify – Test and validate the work.

  5. Report – Summarize results and next steps.

Each phase produces defined outputs or artifacts and has clear expectations:

### Phase 1: Intake

Goal: Ensure the agent fully understands the request before proceeding. If requirements are ambiguous, ask clarifying questions; gather any relevant context from the codebase or documentation.

Agent Actions:

  - Summarize the user’s request in the agent’s own words.

  - If missing details (e.g., “What format should the CSV stats be in?”), ask the user for clarification (or refer to existing project docs if available).

  - Check project context: The agent might search the repository for related files (for instance, find if there's an existing CSV parser, or a similar feature to mimic) – tools like Cursor’s search or Claude’s knowledge integration could be used.

  - Confirm the final understood requirements by perhaps writing them to a intake.md or just storing in memory.

Output:

  - A refined task description or problem statement (could be stored in a file or displayed to user for confirmation).

  - Optionally, an “Intake log” noting Q&A with the user or any assumptions made.

Example: For the CSV upload feature, the intake phase might output: “Confirmed: We need to allow users to upload a CSV file via the UI, then the system should calculate basic stats (count, mean, median) and display them. We assume CSV size is moderate (<5MB) and use existing libs for CSV parsing.” This could be saved or just used as internal confirmation.

### Phase 2: Plan

Goal: Break the task into manageable steps (as discussed in section 4). Ensure the plan covers all aspects of the task and sequences them logically.

Agent Actions:

  - Using the plan skill, create a structured plan (likely the YAML as described).

  - Determine if multiple agents are needed (by assigning owners in the plan). Even if not actually launching separate agents, thinking in terms of roles (DB, front-end, etc.) ensures all areas are addressed.

  - Identify any potential parallel work or critical path.

  - Output the plan in a shareable format (file or directly in chat). Possibly also present a summary to the user for approval if interactive.

Required Output:

  - plan.yaml (or .json) file with steps. This is the primary artifact of the Plan phase.

  - If the agent is interactive (like in a CLI where the developer is watching), it might also show the plan in a neat list format for the user to approve or refine. The plan should be saved to allow resumption (if process is interrupted, any agent can reload the plan and know what’s done/to-do).

Example: The agent produces the 4-step plan from earlier and perhaps prints:

  - “1 DB-Agent: Update DB schema for CSV”

  - “2️ Backend-Agent: Add /upload endpoint”

  - … etc., in a user-friendly way, while the raw YAML is stored.

### Phase 3: Execute

Goal: Implement the steps of the plan – i.e., write the code, configure systems, or perform the changes required.

Agent Actions:

  - Iterate through plan steps (or pick up assigned steps if multiple agents). For each:

    - Mark it as in-progress.

    - Open the relevant files or create new ones.

    - Write code or make changes according to the description, using best practices and the coding style guidelines (possibly referencing rules or context like CLAUDE.md or Cursor rules always loaded).

    - Use tools as needed: e.g., run a local development server or use an editor’s refactor commands if available. Many of our agents can issue shell commands to compile, run tests, etc. These should be done in this phase for immediate feedback (with permission checks).

    - If a subtask is complex, the agent could even generate a sub-plan internally, but ideally the plan was granular enough.

  - If an error or obstacle occurs (e.g., test fails, or code design needs revision), the agent might loop: fix code, re-run tests, etc., until success criteria is met or it determines it can’t resolve without new inputs. This is where having the verify step separate is useful: the agent might do basic verification within Execute, but anything not resolved will be caught in Verify explicitly.

  - Update status of each step upon completion (and potentially produce a mini-report for that step, as discussed).

Artifacts:

  - Source code files modified or created. These are the primary output.

  - Possibly commit(s) if using version control. Some agents like Claude Code and Gemini can auto-commit changes with messages(if allowed). We may configure them to commit at logical points (maybe after each major step or after all).

  - Execution logs or results for each step (e.g., output from a command).

Resuming Interrupted Execution: Because all changes are made to the repository (or a working copy), if an agent stops mid-way (say after completing step 2 of 4 due to a crash or user pause), another agent can resume by reading the updated plan (steps 1-2 marked complete, step 3 pending) and continuing. Additionally, partial code already written is in the repo, so the new agent can see it. This is an advantage of our file-based artifact approach – state is not just in the agent’s hidden memory but in the visible project state.

Error Handling & Rollback:

  - If something goes wrong during Execute (like the agent mis-edited a critical config and tests fail spectacularly), how do we handle it? We plan for agents to be cautious:

    - Use version control branches or checkpoints: e.g., before a major change, the agent might operate in a new git branch or commit frequently so changes can be reverted if needed.

    - The verify phase (or tests run) will catch issues; the agent can then either rollback (git revert) and try a different approach, or mark the plan step as blocked and escalate to human or a different strategy.

  - We will define in the WORKFLOW.md policy that agents should not permanently delete code without confirmation and should prefer additive changes. For rollback strategy, an automated approach is possible: if verify fails and the agent is stuck, it could reset to last commit and mark the step as needing human attention.

### Phase 4: Verify

Goal: Validate that the executed changes meet the acceptance criteria and that nothing is broken. This ensures quality and correctness before reporting completion.




