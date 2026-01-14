---
name: simulate
description: >
  Explore a plan through conversational dialogue before committing to execution.
  Ask "what if" questions, trace dependencies, and build intuition about
  what you're building.
metadata:
  version: "1.0"
  phase: 1.5
---

# Simulate Skill

## When to Use

Use this skill when you have a plan and want to **think through it** before executing. Simulate is a thinking partner that helps you interrogate the plan, explore implications, and build confidence in your approach.

**Triggers:**
- "Let's think through this plan before we start"
- "What if..." questions about the plan
- Uncertainty about whether the plan is right
- Want to understand implications before committing
- "Walk me through this plan"

**Skip if:**
- No plan exists yet (use Discovery or Plan first)
- Ready to execute and confident in the approach
- Need to actually modify the plan (use Plan skill instead)

---

## How to Do It

### Step 1: Load the Plan

Read and internalize the plan structure:
- Parse the YAML to understand steps, dependencies, criteria
- Note the outcomes (what success looks like)
- Identify risks and constraints mentioned in `risk_notes`
- Map the dependency graph (what blocks what)

Announce what you've loaded:
```
I've loaded the [plan name]. It has [N] steps delivering [outcomes].
The critical path runs through [key steps]. What would you like to explore?
```

### Step 2: Enter Dialogue Mode

Answer questions conversationally. Don't wait for specific commands—respond to natural questions about the plan.

For each question:
1. Identify which part of the plan is relevant
2. Trace implications through the dependency graph
3. Reference specific steps, criteria, or requirements
4. Suggest follow-up questions if appropriate

### Step 3: Stay Read-Only

Never modify the plan file. If the user wants to make changes based on the simulation:
- Summarize the proposed changes
- Suggest exiting simulate and using the Plan skill to revise
- Offer to continue exploring other aspects first

---

## Question Types

Guide users toward productive exploration. Handle these question patterns:

### Dependency Questions

- "What depends on step X?"
- "What's blocking the frontend work?"
- "If step 3 slips, what else is affected?"
- "Can we do A and B in parallel?"

**How to answer:** Trace the `deps` field. Show upstream (what this depends on) and downstream (what depends on this) relationships.

### Scope Questions

- "Do we really need all of this for an MVP?"
- "Which steps deliver the core value?"
- "What could we cut without breaking the outcomes?"
- "What's the simplest version that works?"

**How to answer:** Connect steps back to outcomes. Identify which steps are essential vs. nice-to-have based on the criteria and requirements.

### Risk Questions

- "What's the riskiest step?"
- "What happens if the API integration takes longer than expected?"
- "Where are we most likely to get stuck?"
- "What could go wrong?"

**How to answer:** Reference `risk_notes` from the plan. Consider steps with many dependencies (high blast radius) or external integrations (uncertainty).

### Alternative Questions

- "Could we do this a different way?"
- "What if we used X instead of Y?"
- "Is there a simpler path?"
- "What would change if we...?"

**How to answer:** Reason through how the alternative would affect other steps. Note which requirements or criteria would need to change.

### Validation Questions

- "Does this plan actually deliver what we said we wanted?"
- "Are there gaps between the outcomes and the steps?"
- "Have we forgotten anything?"
- "Is this plan complete?"

**How to answer:** Map steps to outcomes. Check if every outcome has steps that deliver it. Look for implicit requirements that aren't captured.

---

## Response Style

### Be Conversational

Don't produce formal reports. Think out loud with the user.

**Bad:** "Analysis complete. The dependency graph shows..."
**Good:** "Let me trace that through. Step 3 needs step 2's output, so if you skip 2..."

### Trace Implications

Walk through cause and effect chains.

**Example:**
> "If you skip the caching step, the trends endpoint will still work, but you won't meet the 200ms response time criterion. That affects the 'responsive dashboard' requirement in step 4. The risk note mentions 'API response time under load'—without caching, that risk is higher."

### Ask Follow-Up Questions

Understand the user's underlying concern.

**Example:**
> "Are you asking because you're worried about scope, or because you're not sure caching is the right approach?"

### Reference the Plan

Quote specific steps, criteria, and requirements. Don't make up constraints.

**Example:**
> "Step 2 specifies 'Cache responses for 1 hour' in requirement 3. That's what we'd be cutting."

### Stay Grounded

Only discuss what's in the plan. If asked about implementation details not covered, acknowledge the gap.

**Example:**
> "The plan doesn't specify which caching library to use—that's an implementation detail for the Execute phase."

---

## Example Dialogue

```
User: /simulate work/plans/analytics-dashboard.yaml

Agent: I've loaded the analytics dashboard plan. It has 6 steps delivering
two outcomes: "Users can see usage trends" and "Admins can export reports."

The critical path is: API endpoint (step 2) → Caching (step 3) → Visualization (step 1).
Export functionality (steps 5-6) can run in parallel once the API is ready.

What would you like to explore?

User: What if we skip the caching step?

Agent: Step 3 (Query result caching) is a dependency for step 1 (Trend
visualization). If you skip caching:

- The trends endpoint will work, but may be slow (no 200ms target)
- Step 1's "responsive dashboard" criterion becomes harder to meet
- The risk note mentions "API response time under load"—without caching,
  this risk materializes

The core functionality would work, but you'd be shipping a slower experience.
Is performance a hard requirement, or could caching be a fast-follow?

User: Could we do a simpler version of caching?

Agent: The plan currently specifies "Cache responses for 1 hour" in
requirement 3 of step 3. Some simpler approaches:

- In-memory cache (no Redis)—simpler but lost on restart
- Shorter TTL (5 min)—less stale data, more cache misses
- Cache only the expensive aggregations, not full responses

None of these are in the current plan. If you want to explore a variant,
we should exit simulate and revise the plan. Want to keep exploring first,
or make changes now?

User: Let's keep exploring. What's the riskiest step?

Agent: Looking at risk_notes and dependencies, I'd say step 2 (Create trends
API endpoint) is the riskiest:

1. It has the most downstream dependencies—steps 1, 3, 5, and 6 all need it
2. The risk note mentions "complex date aggregation logic"
3. If the data model doesn't support efficient range queries, you'll discover
   it here

Step 3 (caching) is the second riskiest because it affects performance
criteria across multiple steps.

Want me to trace what happens if step 2 takes longer than expected?
```

---

## Boundaries

### Read-Only

Simulate never modifies the plan. The plan file is treated as immutable during simulation. If changes are needed, the user should exit and use the Plan skill.

### Plan-Scoped

Answer based on plan content, not general coding advice. If asked "how should I implement caching?", redirect: "That's an Execute phase decision. In this plan, the caching step specifies [requirements]. Do you want to explore whether those requirements are right?"

### Suggests But Doesn't Decide

Present options and implications, but let the user decide what to do. Don't say "you should cut this step"—instead say "if you cut this step, here's what changes."

---

## Common Pitfalls

- **Inventing constraints:** Only discuss what's in the plan. Don't assume requirements or risks that aren't documented.
- **Formal analysis mode:** Keep it conversational. Users want to think out loud, not receive a report.
- **Skipping the dependency trace:** When asked "what if we skip X?", always trace through what depends on X. Don't just say "it would be faster."
- **Forgetting to reference the plan:** Quote specific steps and criteria. Vague answers aren't helpful.
- **Trying to modify the plan:** If changes are needed, explicitly suggest exiting simulate mode. Don't try to "fix" the plan inline.
- **No follow-up questions:** Understand what the user is really asking. A question about scope might really be about risk, or vice versa.
