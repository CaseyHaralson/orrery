# Cross-Agent Skills and Planning System for Consistent Multi-Tool Coding Agents

## 1. Executive Summary & Recommended Architecture

We propose a unified, repository-based system that ensures multiple coding AI agents (Gemini CLI, Claude Code, OpenAI Codex, Cursor, and Google Antigravity) follow a consistent workflow and can seamlessly collaborate on software tasks. The core idea is to define canonical “agent skills” and a shared workflow protocol in one repository, then synchronize these across tool-specific configurations. Each agent will load the same skills and adhere to the same 5-phase workflow (Intake → Plan → Execute → Verify → Report), enabling coherent behavior regardless of the underlying AI tool.

Recommended Architecture: At the heart of the system is a “Skills” library in the repository that uses the open Agent Skills format. Each skill (e.g. intake, plan, execute, etc.) is a folder containing a standardized SKILL.md with instructions (and optionally scripts or reference files) describing how to perform that phase of work. On project startup, each agent scans the repository’s skills and loads a summary of available skills into its system context (using a concise metadata listing). When an agent needs to perform a phase (like planning or code execution), it “activates” the corresponding skill by pulling in the full instructions from SKILL.md on demand. This ensures all agents follow the same playbook for each task phase. A shared Plan format (machine- and human-readable) is used for agent-to-agent handoff: one agent can produce a structured plan of action items that another agent (or instance) can parse and execute. A designated Coordinator agent can oversee this process, delegating plan steps to Worker agents and tracking progress.

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

Agent Actions:

  - Run test suites and linters. Agents have tools to execute tests (Claude can run commands, Gemini CLI has sandbox exec, Cursor can run code). For instance, run npm test or domain-specific tests.

  - Perform static analysis or verification scripts (security checks, performance checks if applicable). This could leverage a verify skill that includes steps like running scripts/audit.sh or checking for any TODOs in code.

  - For UI features, if supported, use a browser automation to test (Antigravity’s browser agent could do this, or headless browser via MCP in Claude/Gemini).

  - Collect results: which tests passed/failed, any errors encountered.

  - If everything passes, mark steps as complete. If something fails, decide whether to fix it (which might loop back to Execute for that step or create a new fix step). In an autonomous loop, an agent might iteratively go back to Execution until Verify passes (this is akin to an agentic loop that continues until done – we saw an example of using a hook to re-loop until tests pass in Cursor).

Artifacts:

  - Test results output (could be captured in a file, e.g., artifacts/test_results.txt).

  - Screenshots or other artifacts for visual verification (Antigravity mentioned agents produce Artifacts like screenshots for UI changes).

  - An updated plan or report note if new tasks were added due to verification (e.g., “Step 4 failed, added Step 5 to fix bug”).

Example: After executing the backend and frontend, the verify agent runs all tests and finds a failing case for empty CSV files. It might then either fix it (if within capability) or at least log it. Suppose it fixes by adjusting code and retesting – this would be an Execute action within the Verify phase essentially. We expect our agents to handle minor fixes automatically. For bigger issues, they might signal for human input.

### Phase 5: Report

Goal: Present the outcome of the task clearly, either to the user or for record-keeping. Summarize what was done, confirm satisfaction of the request, and highlight any follow-ups.

Agent Actions:

  - Gather all relevant info: final status of each plan step, where the changes are (branch name or commit IDs), any remaining issues or suggestions.

  - Format a report. This could be a markdown summary to the user: “✅ Feature implemented: CSV upload now available. All tests passing. Committed to feature/csv-upload branch. Here’s a summary of changes: ...”.

  - Include pointers to artifacts: e.g., link to the pull request or attach the final diff (some agents can generate diff summaries automatically).

  - Ensure the report is concise and clear. Possibly separate sections: “What was done,” “Results,” “Next Steps (if any).”

  - If multiple agents were involved, the coordinator can compile their individual reports into one.

Required Output:

  - A REPORT.md (or comment in the chat) that contains the above summary.

  - In a non-interactive context, the report might be the final console output. In a collaborative setting, it could be stored in agent/artifacts/final_report.md.

The Report phase effectively closes the loop with the user, building trust by showing evidence of verification (Antigravity’s philosophy is to verify via Artifacts, not just logs– our report serves that role). It should be standardized enough that if different agents complete the same task, their reports are comparable (for consistency scoring).

Workflow Enforcement: We will enforce that agents do not skip these phases. For example:

  - Agents should not jump straight to writing code (Execute) without a plan. If they do, our evaluation framework (section 8) will flag it (protocol compliance score).

  - If an agent tries to produce a plan without clarifying obvious ambiguities, that’s an Intake failure.

  - Skipping Verify is not allowed; even if an agent is confident, it must at least run basic checks or explicitly state why verification is minimal (e.g., if it's a trivial change with no tests, then the verify step would note that).

All tools are instructed to abide by this via system prompts or memory files:

  - In Claude’s CLAUDE.md we might include: “All tasks must follow the 5-step workflow: intake, plan, execute, verify, report. Do not omit steps.”.

  - Similarly, Gemini’s GEMINI.md could have a short reminder of the phases.

  - Cursor’s rules can include a rule about workflow (ensuring even if user doesn’t explicitly prompt each, the agent self-adheres).

If an agent session is interrupted mid-workflow (e.g., user stops the agent after plan is done), another agent can resume at the next phase by consulting artifacts (like the plan file) rather than starting from scratch. This handoff is possible because the workflow outputs (like the plan) are tangible.

Error handling across phases:

  - If at Verify something is wrong, the agent can either go back to Execute or include a remediation in the Report (depending on autonomy level).

  - If at Report the agent realizes some acceptance criterion wasn’t met (“We did everything but forgot to update the user manual”), it could either add a step and loop again, or mention it. Ideally, such misses are caught in Plan or Verify, but the Report is last defense to note it.

By mandating this workflow, we align all agents with a common operational process, much like a software development methodology that all team members follow. This dramatically improves consistency: no matter if it’s Claude or Gemini doing the work, the user will observe the same pattern – first some clarifying questions, then a plan outline, then stepwise implementation, tests running, and a final summary. It also provides multiple places to catch and correct errors, improving reliability.

We will include a concise description of this protocol in the repository (likely in the agent/policies/WORKFLOW.md) and in any “system prompt” given to agents. For instance, the system prompt could say: “You are to function as a coding assistant following our 5-step workflow. Begin with Intake (clarify requirements), then Plan (outline tasks in YAML), then Execute (write code), Verify (test it), and Report (summarize). Adhere to this sequence strictly.” Ensuring the agent remembers this is crucial, hence the repetition in config files and skill instructions.

Now that we have the workflow defined, we will compare how each tool (Gemini, Claude, etc.) supports these instructions, highlighting differences and how the repository setup bridges those gaps.

## 6. Tool Capability Comparison

Different coding AI tools have varying features and limitations. We need each to uphold our skills and workflow. Below is a comparison of the five tools in key areas:

... table and limitations/special considerations skipped...

As seen, each tool has its nuances, but our design leverages their strengths (like Claude/Gemini/Cursor’s native skill support and context integration) and compensates for weaknesses (wrapping OpenAI Codex with our own orchestrator to simulate the same capabilities). The repository acts as the common denominator: skills and plans are defined once, and each tool’s interface layer translates that into the respective agent’s prompt or configuration.

We will maintain a Tool Adapters Guide in the repo (perhaps in agent/adapters.md) detailing any setup needed for each tool (e.g., “In Claude Code, ensure you have the latest version and add .claude/skills to your team settings.”, “For OpenAI API usage, run python tools/run_plan.py to use the plan executor.”). This helps developers know how to get each agent running with the system.

With this comparison in mind, we proceed to how we keep the skills in sync across those directories, so that updates propagate correctly.

## 7. Skills Synchronization Strategy

To maintain a single source of truth for skills while making them available to each tool’s expected location, we implement a synchronization mechanism. The goals of the sync system are:

  - Minimize duplication (we don’t want to manually edit the same instruction in 5 places).

  - Prevent divergence (tool-specific copies should always match canonical unless a deliberate compatibility fork is needed).

  - Keep things simple for developers (ideally editing the canonical agent/skills/ and running a command or CI job updates everything).

Possible approaches:

  1. Symbolic Links: On systems that support symlinks, we can symlink .claude/skills -> ../agent/skills, and similarly for .gemini/skills, etc. This way there is literally one set of files. This is the simplest if it works across dev environments.

      - Tradeoff: Symlinks in Git on Windows can be problematic (need specific git settings or get converted to text). On Windows without proper permissions, symlinks might not work at all unless developer enables them. Also, some tools might not follow symlinks due to sandboxing.

  2. Manual Copy on Change: Use a small script or Makefile target to copy agent/skills/* into each of the .tool/skills dirs. This could be run whenever skills change (perhaps as a git pre-commit hook or just manually). We could also have CI enforce that no discrepancy exists.

      - Tradeoff: Developer might forget to run the sync script. But we can mitigate with a pre-commit hook or CI check.

  3. Git submodule or subtree: Possibly treat agent/skills as its own submodule and include it in each tool dir. This seems overkill and complicates development flow.

  4. Tool Config pointing to canonical skills: If any tool allowed configuring the skills directory path (e.g., a setting like skills.directory = agent/skills), that’d be ideal. Currently, not aware of such option in these CLIs, except Gemini’s context.fileName setting which is more for context files, not skill dirs.

  5. Use an external library like SkillPort which loads the skills from one location for all. But that’s more at runtime than in file system.

Our plan: Use copying with CI enforcement for broad compatibility. Symlinks where possible for convenience.

### Development Workflow for Skills:

  - Developers edit agent/skills/<skill>/SKILL.md. They can test changes using one of the agents (e.g., run a Claude session and manually load the skill, or in a dry-run mode of our coordinator script).

  - After editing, run tools/sync_skills.py (for example) which will:

    - Remove existing .tool/skills/<skill> dirs (or just overwrite specific files).

    - Copy the entire agent/skills/<skill> folder into each .tool/skills/ location.

    - Maybe adjust minor things if needed per tool (for instance, if we needed to strip out a part of a skill for a certain tool due to limitations, the sync script could apply a filter based on frontmatter compatibility flags).

  - The script could also validate the skills via the skills-ref library’s validator to catch format issues.

  - Then developers commit changes including the updated copies (so in Git, everything is consistent).

We will add a check in CI that runs on pull requests: It re-runs the sync script and then checks git status to see if any changes would occur (meaning someone forgot to sync). If yes, the CI fails telling them to sync. This ensures no one merges an update to agent/skills without also updating the tool dirs.

Alternatively, we could .gitignore the tool-specific skill copies (so that only agent/skills is versioned). Then have a post-checkout hook or initial setup script to populate them. But that complicates usage for others pulling the repo. It’s usually better to keep them in version control for transparency (others can see exactly what instructions each tool is getting and debug if needed).

### Transformations for Tool Differences:

In general, we want identical content. But if we had to tailor, how?

  - The Agent Skills spec provides compatibility field that could be used by tools to decide if they should load a skill. E.g., a skill might say compatibility: "Designed for Claude Code". If we wrote such, perhaps other agents would ignore it. But ideally our skills are universal and we use compatibility only to add notes.

  - If a tool needed a smaller context, we might shorten examples when syncing to that tool. For example, say OpenAI GPT-3.5 can’t handle a 300-line skill well; we could in sync script strip long examples from the GPT version (maybe maintain an alternate SKILL_gpt.md template). We prefer not to fork though.

  - Another case: a skill uses a Bash script. Cursor might run Node (bun) for hooks, not Bash. But Cursor does support Bash commands too. If not, we could provide a JS equivalent script in assets for Cursor, or instruct it accordingly.

At this time, we don’t foresee major tool-specific rewrites of skills. The standard’s whole point is one skill format works across agents. So likely minimal differences.

### OS Compatibility:
Our team might use different OS (Windows, Mac, Linux). The repository structure and sync should accommodate all:

  - If using symlinks on Windows, they must be created in a way that works (developer might need admin or Developer Mode). We will document how to enable symlinks on Windows or suggest using the copy method there.

  - The skills content themselves are OS-neutral (except any scripts: we might include both .sh and .ps1 if needed for any script in scripts/ directory, or just use Python which is cross-platform).

  - CI (which often runs Linux) will test the sync and possibly run some agent tasks in a headless way to ensure nothing OS-specific is broken.

### Automation in CI:
We can integrate a job that runs a minimal scenario for each agent to ensure the sync and integration:

  - For Claude/Gemini/Cursor: perhaps run a “plan only” command to see if skills are loaded (though those are interactive CLIs mostly – might be tricky to automate unless they have hidden API modes).

  - More feasible: run our orchestrator (likely using OpenAI or local mode) on a sample task and verify the output matches expectations as a regression test (see next section about evaluation).

  - Also, use the skills-ref validate command in CI to ensure all skills conform to spec.

### Optional Transformation Layer:
If needed, our sync could apply filters. For example:

  - Remove any comments in SKILL.md that a certain agent might erroneously interpret (not likely, but just in case).

  - Convert any non-UTF8 characters if a tool has an issue (all are modern so should be fine).

  - Possibly compile an “available_skills.xml” snippet for tools that need to explicitly add it. Actually, we might generate that on the fly in prompts rather than store a static one. But we could place an available_skills.xml file in .claude/ for example, and instruct users to do /append-system-prompt available_skills.xml if needed. This might be too manual; better to let code handle it.

Given the complexity of supporting many tools, we might also create a universal launcher script in Python that can interface with each:

  - e.g. run_with_agent.py --agent=claude --prompt "XYZ" which ensures the skills are loaded and the workflow followed. For Claude/Gemini, it might simply spawn the CLI process with appropriate flags (like claude --append-system-prompt .claude/available_skills.xml – if such flag exists). For OpenAI, it would call the API. This script isn’t strictly sync, but part of making usage easier.

In summary, our strategy:

  - Use copying for broad reliability (with optional symlinks for advanced users).

  - Automate with scripts and CI to avoid human error.

  - Provide documentation and perhaps a one-step command to “sync and validate skills”.

For example, make sync-skills could run the sync and make check-skills could run validations. If any differences or issues are found, developers fix them before committing.

Finally, we ensure bidirectional awareness: If a tool-specific change happens (say, an emergency quick fix is made in .claude/skills/plan/SKILL.md during a troubleshooting session), developers must propagate it back to canonical. To avoid forgetting, we might discourage editing the copies directly. Possibly even add a note at top of each copied file: “(autogenerated from agent/skills/plan/SKILL.md – do not edit here)”. This can be inserted by the sync script as an HTML comment or so if the agent doesn’t read it. But since agents do read SKILL.md fully on activation, we wouldn’t want that note visible to them. Maybe a one-line HTML comment is fine; LLM would likely ignore it or at least it wouldn’t harm. Alternatively, trust process and code review to catch such mishaps.

By keeping skills synchronized, we uphold the core promise: each agent is drawing from the same playbook. Now, we turn to how we will test and evaluate that consistency to ensure our system works as intended.

## 8. Consistency Evaluation Framework

To verify that our multi-tool agents truly behave consistently and meet our quality standards, we establish a Consistency Evaluation Framework. This is essentially a set of benchmark tasks and metrics to score the agents’ performance in a uniform way.

### Benchmark Task Suite

We will create a suite of tasks (in agent/benchmarks/ directory) that represent common coding scenarios:

  - E.g., “Implement a Fibonacci function with tests”, “Refactor a function to improve performance”, “Find and fix a bug given a failing test”, “Add a new feature (like our CSV upload example)”.

  - Each task will have:

    - A brief description (problem statement).

    - Possibly some initial repository state (we might include a minimal codebase or files to run the task on).

    - Expected outcomes (e.g., what should the final code do, which tests should pass).

    - If possible, a reference solution or steps (for evaluation, though not necessarily given to the agent).

We aim for a variety: small algorithmic tasks, larger feature additions, front-end vs back-end focus, etc., to see how each agent handles them.

### Scoring Rubric

We will evaluate each agent’s output on several dimensions:

  1. Correctness: Did the final solution actually solve the problem? (E.g., all provided tests pass, or manual inspection shows requirements met). This is binary/pass-fail for each task, but we can aggregate (like 8/10 tasks passed).

  2. Style & Code Quality: Are the code changes in line with style guidelines and best practices? We can run linters or do code review. If we have a style guide (maybe enforced by verify skill), ideally style issues are minimal. We could have a score or just a pass/fail if there are significant style deviations.

  3. Safety & Policy Compliance: Did the agent follow our protocol (no unauthorized operations, respected the workflow)? For example:

      - Did it always produce a plan before coding?

      - Did it run verification steps?

      - Did it avoid accessing disallowed files? (We can seed a dummy secret file and see if agent tries to read it – it should not, given deny config).

      - Did it handle errors appropriately rather than doing something reckless?

      We can examine logs or artifacts for these. Each infraction (like skipping verify) is a penalty.

  4. Adherence to Workflow (Protocol Compliance): More specifically, check the presence of each phase’s outputs. For instance, in the agent’s conversation or logs, do we see evidence of an Intake summary, a Plan file, test results, and a final Report? If an agent goes straight from user request to code, that’s non-compliance. We might assign a score like 0-5 on “follows process” where 5 means perfectly followed steps with clear demarcation.

  5. Diff Quality & Minimality: Did the agent introduce only the necessary changes (not unrelated edits)? This can be measured by diff size or by checking that only whitelisted files were changed. E.g., if solving a small bug, the agent shouldn’t rewrite unrelated modules. A smaller, focused diff is preferred (except when task demands large additions). We can set thresholds or manually review diffs.

  6. Communication & Reporting: How well did the agent explain what it did in the Report phase. Is the final report clear, accurate, and free of hallucination? This is a bit subjective, but we want consistent formatting (maybe each report starts with “Task Completed” or similar) and completeness (should mention any limitations or if more work needed). We can parse the Report for expected sections.

  7. Time/Efficiency (optional): If one agent takes significantly more iterations or time, that’s also of note. But since they’re not truly concurrent in our testing, we might not emphasize speed. Still, if an agent requires a lot of back-and-forth vs another does it in one go, that indicates inconsistency.

Each task run for each agent produces some logs and artifacts (like the final code, plan, report, etc.). We’ll create a small harness (maybe in Python or even a shell script) that can simulate or actually run the agents on these tasks in a headless way:

  - For Claude Code and Gemini CLI, maybe use their CLI non-interactive modes (if none exists, we might have them run with predetermined inputs).

  - For Cursor, might not have an automation interface, so we skip automated evaluation or rely on manual runs for Cursor. Or if SkillPort or ADK can simulate it, we use those.

  - For OpenAI, our orchestrator can run the tasks easily by calling the API.

We might focus automated evaluation on the ones with programmatic access (OpenAI, maybe Anthropic if using API version of Claude, and possibly Google via ADK – the ADK has an Agent class we can script).

The result will be recorded and scored.

We’ll sum up scores for each agent on all tasks and see if any agent is lagging. Our aim is consistency, so we expect similar performance. If one agent fails tests that others pass, that tool might need adjustment (maybe its prompt injection didn’t work or it needs a narrower context to avoid confusion). The framework helps pinpoint such issues.

Additionally, we incorporate regression detection:

  - When changes are made (to skills or workflow), run the benchmark tasks on at least one agent (maybe OpenAI one via CI, as it’s easiest through API) to ensure nothing major broke.

  - If possible, periodically run through all agents (maybe not every commit, but maybe nightly if resources allow).

  - For each task, we can store baseline outputs or at least baseline pass/fail. If suddenly an agent fails a task it used to pass, that’s a regression. CI can flag it.

  - We also track if any new inconsistency arises: e.g., if previously all agents had identical reports but now one produces a weird report, that’s a consistency regression (though measuring “identical” is tricky; maybe we define expected structure not exact wording).

CI Automation: We can integrate a subset of quick tasks in CI. Perhaps a small coding challenge that each agent should solve the same way:

  - E.g., “Sort an array” with a unit test. All agents should produce a sorted function passing the test, and do so with similar style (like all create a function sortArray and test).

  - We run each agent (with timeouts) and confirm all tests pass and outputs are okay. If one times out or fails, CI fails.

This might require using cloud APIs (Claude, OpenAI) within CI which could be slow/costly, so we might mock or dry-run partial logic. Another approach: we trust our test harness to be run manually for heavy tasks and only do lightweight linting in CI (like validate skills, check sync).

### Scoring Example:
We might output a table after evaluation like:

Task	Claude	Gemini	Codex	Cursor	Antigrav	Notes
Fibonacci	✅	✅	✅	✅	✅	All passed tests.
Bug Fix XYZ	✅	⚠️ (style)	✅	✅	✅	Gemini solution works but lint flagged style issues.
Feature ABC	✅ (plan ok)	✅ (plan ok)	❌ (failed test)	✅	✅	Codex agent didn’t fully debug the issue.
...						

And perhaps an overall consistency score, e.g. “All tools solved 8/10 tasks correctly; Codex lagged on 2 tasks. All followed protocol well except minor deviations in style from Gemini CLI on one task.”

We will use such results to refine the system (maybe tweak prompts or skills for the tool that had trouble).

Long-term, as we update skills, the evaluation ensures we aren’t optimizing one agent at the expense of others. If a change makes Claude do better but confuses Cursor, we’ll detect that.

### Regression Strategy

  - Version Pinning: We note the version of each tool we test with (Claude Code vX, Gemini CLI vY, etc.). If a tool is updated (like a new model version), we run the benchmarks to see if any new problems arise or if things improve.

  - If inconsistency grows (one agent diverges in output style or quality), we investigate and adjust skill or workflow to bring it back in line.

For governance (next section), we might set thresholds: e.g., no merge of a skill change unless all benchmark tasks still pass for at least 3/5 agents, etc.

Finally, it’s worth connecting this to existing benchmarks:

  - Google’s blog mentioned a “SWE-bench Verified” metric for agentic coding. If that or similar benchmarks are accessible, we can incorporate them. For example, run a standard set of coding problems and measure success percentage. We can compare our multi-agent system’s results with known baselines (making sure each agent hits roughly that percentage).

  - If possible, open-source test suites like HumanEval (for code correctness) could be used. But those are more for pure coding, not multi-step tasks.

Our framework is custom-tuned to our workflow, which is fine for internal consistency testing.

## 9. Governance Model

As this system will be used and maintained by a software team, we need a governance process for making changes to skills, workflows, and overall architecture. This ensures quality and security over time.

Key aspects of governance:

### Skill Lifecycle: Proposal, Review, Versioning

  - Proposing a New Skill: A team member can propose a new skill by creating a folder under agent/skills with a draft SKILL.md. This should be done via a pull request (PR). The PR description should include the rationale for the skill, intended use cases, and perhaps an example scenario demonstrating it.

  - Review Process: At least one other team member (and ideally someone who has context on multiple agents) must review. They will check:

    - Clarity of instructions (would an agent know when/how to use this?).

    - No conflict with existing skills (if overlapping, maybe they should be merged or clearly distinguished).

    - Security implications (does the skill tell the agent to do something potentially destructive?). For any skill that executes commands or modifies data, the reviewer must ensure it’s appropriately scoped (e.g., uses sandbox or has confirmation steps if risky).

    - Compatibility: Check frontmatter compatibility – if the skill only makes sense for certain environments (like a skill for deploying to AWS might not be used in offline mode), ensure that’s noted.

    - Licensing: If skill references external code or data, ensure we have license compliance via the license field.

  - Testing New Skill: The contributor should add or adapt a benchmark task to utilize the skill, proving it works (or at least run an ad-hoc test demonstrating an agent using it correctly).

  - Versioning: As noted, each skill can have a version in metadata. When a skill is significantly changed (breaking change in instructions or behavior), bump the version. We could adopt semantic versioning across the board. For example, all initial skills start at 1.0. Minor improvements (typo fixes, clarifications) can be 1.0.1 etc., major rewrites 2.0. The version is mainly informational, but we might leverage it if an older agent only supports older skill format (then compatibility can mention version).

  - Deprecation: If we find a skill is no longer needed or should be replaced by another, mark it as deprecated in the description. Possibly move it to an agent/skills_deprecated/ folder rather than delete immediately, to avoid breaking older workflows. We could then remove after a few release cycles.

### Workflow/Protocol Changes:

  - If we ever need to change the core workflow (e.g., add a phase, or change sequence), that’s a significant decision. It would involve updating WORKFLOW.md, all skill instructions that assume 5 phases, and possibly all agents’ prompts.

  - Such changes should be proposed in an ADR (Architectural Decision Record) or at least a GitHub Issue/Discussion to get team consensus.

  - Agents might have to support backward compatibility. For instance, if we add a “Review” phase as mandatory where it wasn’t before, older versions of an agent’s CLI might not support that concept. We either coordinate to update tools or ensure our instructions account for it (maybe the agent just treats review as part of verify if it doesn’t know separate).

  - Rollout: Possibly do a trial where we enable the new protocol on one agent first, see results, then others.

  - Maintain a changelog for protocol changes for the team.

### Compatibility Policy:

  - We aim to keep the skill set working on all supported agent tools. If a new tool comes into play, we either confirm it supports the standard or implement an adapter.

  - If an agent product reaches end-of-life or becomes too outdated (e.g., OpenAI Codex might be superseded by GPT-4 fully), we might drop official support for it and update compatibility notes.

  - Ensure we don't rely on proprietary features of one agent in our canonical instructions that others can’t do. If we absolutely need something special (like only Antigravity can do a certain UI action), handle it with conditional instructions or note it in compatibility.

### Security Review:

  - Given agents can execute code, we treat our instructions as code as well. A malicious or poorly written skill could cause an agent to do harm (like a skill that says “delete all user data to start fresh” without caution). Thus, any skill that involves data deletion, external network access, or modifying infra must be scrutinized heavily.

  - Possibly involve a security engineer in reviewing those PRs.

  - We can also add automated scans: for instance, grep skill files for dangerous patterns (like rm -rf or database drop commands) and flag them unless explicitly allowed.

  - The sandbox and permission settings should be reviewed whenever changed. We maintain a baseline of what’s allowed: e.g., maybe by policy, agents are never allowed to push to production or access the internet in automated mode. Those things should require human approval outside the agent’s scope. We’d encode that in permissions (no tool for curl http:// for instance).

  - Audit logs: We should capture logs of agent actions especially in CI runs, so if something odd happens, we can trace it. Possibly integrate with the tools’ own logging (Claude and Gemini can produce transcripts in verbose mode, etc.).

### Continuous Improvement:

  - We encourage team members to share findings (maybe in a wiki or notes in the repo) of agent behavior quirks, so we can refine skills. E.g., “Claude tends to ignore step 3 of plan unless explicitly reminded; added a note in plan skill to reiterate steps.”

  - There could be periodic meetings or async reviews of how the multi-agent system is performing in real tasks, to plan improvements.

### Coordination with Tool Vendors:

  - Since we’re building on external tools, we should maintain awareness of their updates. E.g., if Anthropic releases Claude 5 with new capabilities or changes in prompt format, adapt our system accordingly. Possibly join their forums or check release notes regularly (like the Claude Code changelog).

  - Similarly, if Google’s ADK or Antigravity add features (maybe a native skill marketplace or something), we might leverage that instead of our own mechanism.

  - Being part of the open standard community (AgentSkills.io is open), our team could contribute back: e.g., if we create a great skill or find a bug in the spec, contribute on GitHub.

### Documentation & Knowledge Sharing:

  - Keep documentation up-to-date: README explaining how to set up each agent tool with our repo, guidelines for writing skills (maybe point to AgentSkills spec or our own conventions like always include “When to use/How to use” sections).

  - Possibly maintain a “FAQ” or troubleshooting guide (e.g., “If Gemini CLI is not loading skills, ensure experimental.skills is true and you have version >= 0.21”).

### Governance Example:

Imagine a developer wants to change the execute skill to use a different code formatting tool. Process:

  1. They make a PR, version bump execute skill to 1.1, and note in description: “Switch to Black formatter for Python code in execute skill. This affects how code style is enforced.”

  2. Reviewer sees that Black requires adding pip install black somewhere. They question: will agents handle installing it? Perhaps propose to instead use an existing tool agent knows. After discussion, they decide to keep using existing formatting for now, and table Black integration.

  3. The PR might be revised or rejected in favor of a different approach (governance prevents a hasty merge that might have broken things).

  4. If approved, after merge, they run benchmark tasks to ensure the new formatting instruction doesn’t confuse any agent (like maybe Codex doesn’t know Black). If it did, they might add compatibility: "exclude openai" or adjust accordingly.

### Release Management:

Though not a product per se, we might tag certain repository states as “releases” (v1.0, v1.1 etc.) especially if distributing to others or if rolling out to teams internally. Then governance ensures each release is stable (passing all tests) and includes release notes.

In essence, governance is about maintaining the integrity of this multi-agent system as it evolves, making sure it remains consistent, safe, and effective across all the moving parts (various AI agents and team contributions).

## 10. Week 1 Implementation Checklist

To kickstart this project, we outline a checklist for the first week of implementation:

  - Repository Setup:

    1. Initialize the repository with the base structure:

        - Create agent/skills/ directory and subfolders for core skills (intake, plan, execute, verify, report, review, security).

        - Add placeholder SKILL.md files for each core skill with a basic outline (YAML frontmatter with name/description and a skeleton of sections).

        - Create agent/policies/WORKFLOW.md describing the 5-phase workflow in a few paragraphs (later to refine).

        - Create agent/schemas/plan-schema.json (draft as per section 4) and perhaps a stub for report-schema.json.

        - Set up .gemini, .claude, .cursor, .codex, .antigravity directories. Inside each, put a skills/ (can be empty for now or symlink to agent/skills if easy on your OS). Also add example config files:

          - .gemini/settings.json with "experimental.skills": true and any needed basic config.

          - .claude/settings.json with a basic allowed tools list (maybe allow Edit, Read, Write to project).

          - .cursor/rules/WORKFLOW.RULE.md (to persist the workflow reminder).

          - Others possibly empty or containing a README about how to configure if we don’t know yet.

    2. Version control: commit this initial structure. Also possibly set up a GitHub repository if not already, and configure branch protection if needed (to enforce reviews).

  - Tool Configuration & Testing:

    3. Install/set up latest versions of:

        - Claude Code CLI (or ensure access to Claude API).

        - Gemini CLI (register if needed, install via npm as docs suggest).

        - Cursor IDE (or CLI if exists; if only GUI, plan how to test maybe manually).

        - Confirm we have access to Google Antigravity (public preview download). If yes, install it and create a sample project to integrate with.

        - Ensure OpenAI API keys or access is available for Codex/GPT.

    4. For each tool, do a quick manual test in the project:

        - For Claude: Run claude in the repo directory. Ensure it picks up CLAUDE.md if present. We might not have content yet, but just verify it loads (the startup log often indicates loaded memory files).

        - For Gemini: Run gemini in the project. Check if it acknowledges skills (maybe run /skills list if such command exists, or see if it loaded our context).

        - For Cursor: Open the repo in Cursor editor, see if it recognizes the rules (type something to trigger it maybe). This might require more time, possibly skip deep test week1.

        - For OpenAI: Write a small Python script to simulate an agent using the plan skill. For example, prompt GPT-4: “You have skills X, you will plan etc.” to gauge response.

    5. Address any immediate issues (like if tools need a different file placement or naming to detect the skills).

  - Implement Sync Script:

    6. Write tools/sync_skills.py (or a Makefile) to copy agent/skills to each .*/skills. At first, it can be straightforward copy for all files. Run it and git-add the copied files. Commit “Sync initial skills to tool directories.”

    7. Test the symlink approach on one platform (maybe on a Unix-like system: ln -s agent/skills .gemini/skills). Decide if we include that or stick to copy. Document the choice.

  - Basic Skill Content Drafting:

    8. Flesh out at least the plan skill content with a first draft (since it’s central). For example, add the sections “When to use: at start of task”, “How to do: list steps...”, maybe a basic example. Use the info from this design.

    9. Similarly, draft execute and verify with a simple approach (like “Write code for the task. Then run tests.” etc.). These will be improved later but we want something to test end-to-end.

    10. intake skill: write a basic instruction like “Always restate the request and clarify anything unclear before proceeding.”

    11. report skill: instruct to summarize changes and outcomes.

    12. Keep these drafts short initially (we can refine with more detail after initial tests).

  - Simple End-to-End Test:

    13. Choose a trivial task (e.g., “Create a Python function add(a,b) with a test”). Try running through the workflow with one agent:

        - As user, input the request. Check that agent (say Claude via CLI) goes to Intake (maybe it asks a clarifying question or confirms).

        - If that works, have it proceed to Plan (maybe use --auto or just see if it creates a plan, if not, maybe we have to prompt “make a plan”).

        - This might require manually telling it phase by phase at first. This will reveal if our instructions are being heeded.

    14. If the agent doesn’t follow the workflow, tweak the approach: we might need to explicitly prompt it in this test (“Now do the Plan phase.”). That’s okay; note down how we can automate that with a coordinator later.

    15. Review outputs and adjust skill content as obvious (like if it made a poor plan, maybe our plan instructions need clarity).

  - Plan Schema Finalize:

    16. Finalize plan-schema.json based on what we want after seeing an example. Add a validation step in the sync or a separate script to validate a YAML plan file against it (maybe using a Python JSON schema library).

    17. Possibly create a agent/examples/sample_plan.yaml as a reference for developers, taken from our test.

  - CI Setup:

    18. Set up a minimal continuous integration workflow (GitHub Actions or similar) that:

        - Installs any dependencies (like Python for our scripts, maybe the skills-ref validator via pip if needed).

        - Runs tools/sync_skills.py and then checks for changes (to ensure sync was up-to-date).
        
        - Runs skills-ref validate agent/skills/* to validate skill frontmatters.

        - (Later, we can add actual agent runs or test tasks, but in week1 just ensure repository integrity).

    19. Also, perhaps run a markdown linter or YAML linter on our files to keep format tidy.

  - Governance Bootstrap:

    20. Create GitHub Issue templates for “New Skill Proposal” and “Skill/Workflow Change” to guide contributors to provide needed info.

    21. Document contribution guidelines in CONTRIBUTING.md: explain to propose changes via PR, require review, mention running sync and tests locally before PR.

    22. Set up codeowners or at least assign roles: e.g., certain senior devs as reviewers for skill changes, maybe security team as reviewer for high-risk skill changes.

  - Knowledge Share:

    23. Present this architecture to the team (maybe a meeting or an internal doc). Walk through how to add a skill, how an agent uses them, and where to find results.

    24. Ensure each team member has the needed access (API keys, installed tools) and environment to run the multi-agent system, so they can start experimenting in week 2.

By end of week 1, we should have:

  - The skeleton of the system in place, under version control.

  - At least one simple example of the whole workflow executed on one agent, proving viability.

  - Basic CI to guard structure.

  - Team alignment on how to proceed.

This primes us to then iterate: Week 2 could deepen each skill’s content and start complex testing; Week 3 could implement the coordinator automation for agent handoff; and so on.

Overall, following this checklist will create the foundation of the cross-agent skills and planning system, allowing us to progressively refine and expand it with confidence.