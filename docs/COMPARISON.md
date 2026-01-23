# Orrery vs Direct AI CLI Tools

An analysis of when Orrery adds value compared to using Claude Code, Gemini CLI, or Codex CLI directly.

## What Orrery Is

Orrery is a **structured workflow orchestration layer** that sits on top of AI coding agents (Claude, Gemini, Codex). It transforms vague goals into executable YAML plans, then autonomously executes them step-by-step with built-in verification.

## Key Differences from Direct Agent Use

| Aspect               | Direct AI CLI              | Orrery                                           |
| -------------------- | -------------------------- | ------------------------------------------------ |
| **Planning**         | Implicit in conversation   | Explicit YAML contracts with acceptance criteria |
| **Execution**        | Interactive back-and-forth | "Fire and forget" autonomous execution           |
| **Dependencies**     | You track in your head     | Topologically sorted, explicit in plan           |
| **Quality gates**    | You verify manually        | Built-in Execute → Verify → Report cycle         |
| **Git workflow**     | You manage branches/PRs    | Auto-creates branches, PRs per plan              |
| **Resumability**     | Limited (chat history)     | Plans are persistent, resumable state machines   |
| **Multi-step tasks** | Prone to drift/forgetting  | Deterministic execution path                     |

## When Orrery Adds Value

**Good fit:**

- Large features requiring 10+ coordinated changes across files
- You want to plan upfront, review the plan, then let it run unattended
- Multiple developers need to share/review AI-generated plans
- You value deterministic, reproducible execution
- Complex dependency chains between implementation steps

**Less useful:**

- Quick one-off fixes or small changes
- Exploratory/interactive development where you're discovering as you go
- Tasks where you want to stay in the loop for every decision
- Simple refactors that don't need formal planning

## Honest Assessment

**Pros:**

1. Forces structured thinking before code (the 5-level decomposition ladder is genuinely useful)
2. Plans are version-controllable, reviewable artifacts
3. Auto-verification prevents silently broken implementations
4. Branch/PR automation reduces manual git overhead
5. Resumable state means you can step away mid-execution

**Cons:**

1. **Overhead for small tasks** - Writing a full plan for a bug fix is overkill
2. **Extra abstraction layer** - More moving parts that can break
3. **Learning curve** - You need to understand the plan schema, skill system, and orchestration flow
4. **Delayed feedback** - You don't see intermediate results until verification completes
5. **Agent capabilities are the bottleneck** - If Claude/Gemini/Codex can't solve a step, Orrery can't either

## Recommendation

Orrery is most valuable when you're doing **substantial, well-defined work** that benefits from upfront planning. Think of it as the difference between:

- **Direct CLI**: Pair programming with AI - interactive, exploratory, immediate
- **Orrery**: Project management for AI - planned, autonomous, traceable

If you frequently tackle multi-step features and find yourself losing track of what the AI was supposed to do, or manually managing branches/PRs after AI work, Orrery addresses real pain points.

If your work is mostly quick fixes, explorations, or you prefer staying interactive with the AI throughout, the overhead probably isn't worth it - just use the CLI tools directly.

**Bottom line**: It's a specialized tool for structured autonomous execution, not a replacement for interactive AI assistance. The two serve different workflows.
