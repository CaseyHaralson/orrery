---
name: discovery
description: >
  Transform big ideas into executable plans by decomposing through
  outcomes, capabilities, and features. Phase 0 of the workflow protocol.
metadata:
  version: "1.0"
  phase: 0
---

# Discovery Skill

## When to Use

Use this skill when the request is **larger than a single feature**. Discovery transforms ambiguous ideas into concrete, executable plans.

**Triggers:**
- "Build a [system/platform/module]"
- Request spans multiple features or domains
- Unclear what "done" looks like
- Requires architectural decisions before implementation

**Skip to Intake if:**
- Request is a single, scoped feature
- Outcomes and scope are already clear
- You can articulate the task in 1-3 sentences

---

## The Decomposition Ladder

Discovery works top-down through four levels:

```
IDEA        "We need better analytics"
   ↓
OUTCOMES    "Users can see trends; Admins can export reports"
   ↓
CAPABILITIES "Trend visualization; Data aggregation; Export service"
   ↓
FEATURES    "Line chart component; Daily rollup job; CSV export endpoint"
   ↓
(hand off to Plan phase for implementation steps)
```

Each level must be concrete enough that the next level can be derived.

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

### Step 6: Validate with User

Before producing the plan:
- Present the feature breakdown
- Confirm priorities and ordering
- Resolve any remaining ambiguities
- Get explicit sign-off that this captures the intent

### Step 7: Output the Plan

Generate a plan file where each feature becomes one or more steps.
Each step must be **self-contained** - an agent should be able to execute
it without asking questions.

Use the schema defined in `agent/schemas/discovery-plan-schema.yaml`.

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
  - id: "feature-1"
    description: "Implement trend visualization component"
    status: "pending"
    deps: ["feature-2"]
    context: |
      Users currently see only current-day stats. This adds a line chart
      showing 7/30/90 day trends. Use the existing Chart.js setup in
      src/components/charts/.
    requirements:
      - "Line chart with day/week/month toggles"
      - "Fetches from GET /api/stats/trends"
      - "Responsive, works on mobile"
      - "Loading skeleton while fetching"
    criteria:
      - "Chart renders with mock data"
      - "Toggle switches time range"
      - "Mobile viewport displays correctly"
      - "Unit tests pass"
    files:
      - "src/components/TrendChart.tsx"
      - "src/components/TrendChart.test.tsx"
    context_files:
      - "src/components/charts/BaseChart.tsx"
      - "src/styles/charts.css"
    risk_notes: "Chart.js bundle size - verify no significant increase"

  - id: "feature-2"
    description: "Create trends API endpoint"
    status: "pending"
    deps: []
    context: |
      Stats are currently computed on-demand in statsService.ts. This adds
      a new endpoint that returns time-series data. Consider caching since
      historical data doesn't change.
    requirements:
      - "GET /api/stats/trends?range=7d|30d|90d"
      - "Returns { dates: [...], values: [...] }"
      - "Cache responses for 1 hour"
    criteria:
      - "Endpoint returns valid JSON for all range values"
      - "Response time < 200ms (cached)"
      - "Integration test covers happy path"
    files:
      - "src/api/routes/stats.ts"
      - "src/api/services/trendsService.ts"
      - "tests/api/stats.test.ts"
    context_files:
      - "src/api/services/statsService.ts"
      - "src/api/middleware/cache.ts"
```

---

## Key Differences from Intake

| Aspect | Intake | Discovery |
|--------|--------|-----------|
| Input | Single feature request | Big idea or vision |
| Output | Task summary + requirements | Full executable plan |
| Conversation | Clarify one task | Define outcomes, decompose |
| Codebase search | Find relevant context | Deep search per feature |
| User interaction | Few clarifying questions | Structured validation |

---

## When Discovery Hands Off

Discovery is complete when:
- [ ] All outcomes are defined and user-validated
- [ ] Each outcome maps to concrete capabilities
- [ ] Each capability has implementable features
- [ ] Each feature has sufficient context for autonomous execution
- [ ] The plan file passes schema validation
- [ ] User has approved the plan

The plan then goes to a **Coordinator** who dispatches steps to agents.

---

## Common Pitfalls

- **Skipping outcome definition:** Jumping to features without knowing "why" leads to building the wrong thing
- **Thin context:** A description like "Add caching" isn't enough. Include what, where, why, constraints.
- **Implicit dependencies:** If feature B needs feature A's output, say so explicitly
- **No user validation:** Don't assume you understood the idea correctly. Confirm the decomposition.
- **Premature detail:** Don't write implementation code during Discovery. Just define what to build.
