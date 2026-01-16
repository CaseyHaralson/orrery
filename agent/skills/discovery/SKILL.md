---
name: discovery
description: >
  Transform big ideas into executable plans by decomposing through
  outcomes, capabilities, and features. Phase 0 of the workflow protocol.
metadata:
  version: "1.0"
  phase: 0
hooks:
  PostToolUse:
    - matcher: "Write"
      hooks:
        - type: command
          command: "node ./scripts/validate-plan.js"
---

# Discovery Skill

## When to Use

Use this skill for **all planning requests**, regardless of size. Discovery transforms ideas into concrete, executable plans.

**Triggers:**
- "Build a [system/platform/module]"
- Request spans multiple features or domains
- Unclear what "done" looks like
- Requires architectural decisions before implementation

**Also use Discovery when:**
- Request is a single, scoped feature
- Outcomes and scope are already clear
- You can articulate the task in 1-3 sentences

---

## The Decomposition Ladder

Discovery works top-down through five levels:

```
IDEA        "We need better analytics"
   ↓
OUTCOMES    "Users can see trends; Admins can export reports"
   ↓
CAPABILITIES "Trend visualization; Data aggregation; Export service"
   ↓
FEATURES    "Line chart component; Daily rollup job; CSV export endpoint"
   ↓
STEPS       "1.1 Create chart component; 1.2 Add API route; 1.3 Wire up data"
```

Each level must be concrete enough that the next level can be derived.
The final output is an **orchestrator-ready plan** with implementation steps.

---

## How to Do It

### Step 1: Capture the Idea

Get the raw vision from the user. Don't judge scope yet.
- What problem are we solving?
- Who is this for?
- What sparked this idea?

### Step 2: Define Outcomes (the "why")

Outcomes are **user-visible results**, not technical deliverables.

Ask:
- "What will users be able to do that they can't today?"
- "How will we know this succeeded?"
- "What does 'done' look like from the user's perspective?"

**Output:** 2-5 concrete outcome statements.

Example:
- "Implement caching" (technical, not outcome)
- "Dashboard loads in under 2 seconds" (user-visible result)

### Step 3: Map Capabilities (the "what")

Capabilities are **system abilities** that enable outcomes.

For each outcome, ask:
- "What must the system be able to do to deliver this?"
- "What new behaviors or services are needed?"

**Output:** Capabilities grouped by outcome.

Example:
- Outcome: "Dashboard loads in under 2 seconds"
  - Capability: Query result caching
  - Capability: Incremental data loading
  - Capability: Pre-computed aggregations

### Step 4: Decompose into Features (the "how")

Features are **implementable units of work** that deliver capabilities.

For each capability, ask:
- "What specific features implement this?"
- "Can this be shipped independently?"
- "What's the minimum viable version?"

**Output:** Feature list with clear boundaries.

### Step 5: Gather Context per Feature

This is critical for "fire and forget" plans. For each feature:

1. **Search the codebase** - find related files, patterns, dependencies
2. **Identify constraints** - what must this integrate with?
3. **Define acceptance criteria** - specific, testable conditions
4. **Note risks** - what could go wrong?
5. **List input files** - what must an agent read to understand context?

### Step 6: Decompose Features into Implementation Steps

Each feature becomes 2-5 concrete implementation steps. This is what makes the plan orchestrator-ready.

For each feature, ask:
- "What are the individual pieces of work?"
- "What order must they happen in?"
- "Can any run in parallel?"

**Step characteristics:**
- **Scoped** - completable in a single focused session
- **Specific files** - lists exactly which files to create/modify
- **Testable** - has clear acceptance criteria
- **Self-contained** - an agent can execute without asking questions

**Naming convention:**
- Use `{feature-number}.{step-number}` format: `1.1`, `1.2`, `2.1`, etc.
- Group related steps by feature for readability

**Example decomposition:**
```
Feature: "Line chart component"
  → Step 1.1: Create TrendChart.tsx with basic Chart.js setup
  → Step 1.2: Add time range toggle (7d/30d/90d)
  → Step 1.3: Connect to trends API endpoint
  → Step 1.4: Add loading state and error handling
```

### Step 7: Validate with User

Before producing the plan:
- Present the step breakdown (not just features)
- Confirm priorities and ordering
- Resolve any remaining ambiguities
- Get explicit sign-off that this captures the intent

### Step 8: Output the Plan

Generate an orchestrator-ready plan file with implementation steps.
Each step must be **self-contained** - an agent should be able to execute
it without asking questions.

Use the schema defined in `./schemas/plan-schema.yaml`.

### Validate the Plan

Plans are automatically validated via the PostToolUse hook when written.
For manual validation, run:

```bash
node ./scripts/validate-plan.js .agent-work/plans/<plan>.yaml
```

This catches common YAML issues like unquoted colons.

### YAML Formatting Rules

- Always quote strings containing special characters (colons, brackets, etc.)
- BAD: `criteria: Output shows: timestamp value`
- GOOD: `criteria: "Output shows: timestamp value"`
- Common gotchas: colons followed by space, special character prefixes, multi-line strings
- Rule: When in doubt, use double quotes around the entire value

---

## Output Format

```yaml
# plan.yaml
metadata:
  created_at: "2026-01-11T10:00:00Z"
  created_by: "Discovery-Agent"
  version: "1.0"
  source_idea: "We need better analytics"
  outcomes:
    - "Users can see usage trends over time"
    - "Admins can export reports for stakeholders"

steps:
  # ============================================================================
  # Feature 1: Trends API Endpoint
  # ============================================================================

  - id: "1.1"
    description: "Create trends service with data aggregation logic"
    status: "pending"
    deps: []
    parallel: false
    context: |
      Stats are currently computed on-demand in statsService.ts. This step
      creates a new service that aggregates historical data into time-series
      format for the trends endpoint.
    requirements:
      - "Create src/api/services/trendsService.ts"
      - "Function: getTrends(range: '7d' | '30d' | '90d')"
      - "Returns { dates: string[], values: number[] }"
      - "Query existing stats table, group by date"
    criteria:
      - "Service exports getTrends function"
      - "Returns correctly shaped data for all range values"
      - "Unit test with mocked data passes"
    files:
      - "src/api/services/trendsService.ts"
      - "src/api/services/trendsService.test.ts"
    context_files:
      - "src/api/services/statsService.ts"

  - id: "1.2"
    description: "Add trends API route with caching"
    status: "pending"
    deps: ["1.1"]
    parallel: false
    context: |
      Wire up the trends service to an HTTP endpoint. Use existing cache
      middleware pattern from other routes.
    requirements:
      - "GET /api/stats/trends?range=7d|30d|90d"
      - "Cache responses for 1 hour"
      - "Validate range parameter"
    criteria:
      - "Endpoint returns 200 with valid JSON"
      - "Invalid range returns 400"
      - "Response time < 200ms (cached)"
    files:
      - "src/api/routes/stats.ts"
    context_files:
      - "src/api/middleware/cache.ts"

  # ============================================================================
  # Feature 2: Trend Visualization Component
  # ============================================================================

  - id: "2.1"
    description: "Create base TrendChart component with Chart.js"
    status: "pending"
    deps: ["1.2"]
    parallel: false
    context: |
      Users currently see only current-day stats. This adds a line chart
      using the existing Chart.js setup in src/components/charts/.
    requirements:
      - "Create TrendChart.tsx extending BaseChart"
      - "Line chart with responsive sizing"
      - "Accept data prop: { dates: string[], values: number[] }"
    criteria:
      - "Component renders with mock data"
      - "Chart displays correctly at mobile and desktop widths"
    files:
      - "src/components/TrendChart.tsx"
    context_files:
      - "src/components/charts/BaseChart.tsx"
      - "src/styles/charts.css"
    risk_notes: "Chart.js bundle size - verify no significant increase"

  - id: "2.2"
    description: "Add time range toggle to TrendChart"
    status: "pending"
    deps: ["2.1"]
    parallel: false
    context: |
      Add toggle buttons for 7d/30d/90d. Selecting a range should trigger
      a data refetch.
    requirements:
      - "Toggle buttons: 7 days, 30 days, 90 days"
      - "Active state styling for selected range"
      - "onChange callback when range changes"
    criteria:
      - "Toggle switches time range"
      - "Visual indication of selected range"
    files:
      - "src/components/TrendChart.tsx"

  - id: "2.3"
    description: "Connect TrendChart to API and add loading states"
    status: "pending"
    deps: ["2.2"]
    parallel: false
    context: |
      Wire up the component to fetch from the trends API. Handle loading
      and error states gracefully.
    requirements:
      - "Fetch from GET /api/stats/trends on mount and range change"
      - "Loading skeleton while fetching"
      - "Error state if API fails"
    criteria:
      - "Data loads from API on initial render"
      - "Range change triggers new API call"
      - "Loading skeleton appears during fetch"
      - "Error message displays on API failure"
    files:
      - "src/components/TrendChart.tsx"
      - "src/components/TrendChart.test.tsx"
```

---

## When Discovery is Complete

Discovery is complete when:
- [ ] All outcomes are defined and user-validated
- [ ] Each outcome maps to concrete capabilities
- [ ] Each capability has implementable features
- [ ] Each feature is decomposed into implementation steps
- [ ] Each step has sufficient context for autonomous execution
- [ ] The plan file passes schema validation
- [ ] User has approved the plan

The plan is now **orchestrator-ready** and can be placed in `.agent-work/plans/` for execution.

---

## Common Pitfalls

- **Skipping outcome definition:** Jumping to features without knowing "why" leads to building the wrong thing
- **Thin context:** A description like "Add caching" isn't enough. Include what, where, why, constraints.
- **Implicit dependencies:** If feature B needs feature A's output, say so explicitly
- **No user validation:** Don't assume you understood the idea correctly. Confirm the decomposition.
- **Premature detail:** Don't write implementation code during Discovery. Just define what to build.
