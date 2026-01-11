---
name: intake
description: >
  Clarify user requirements and gather codebase context before planning.
  This is Phase 1 of the workflow protocol.
metadata:
  version: "1.0"
  phase: 1
---

# Intake Skill

## When to Use

Use this skill at the **start of any new task** before creating a plan. The intake phase ensures you understand what's being asked before committing to an approach.

**Triggers:**
- User submits a new feature request
- User reports a bug to fix
- User asks for a refactor or improvement
- Any request that will require code changes

**Skip intake if:**
- The request is trivially clear (e.g., "fix the typo on line 42")
- You're resuming work from an existing plan

---

## How to Do It

### Step 1: Restate the Request

Summarize what the user is asking for in your own words. This confirms understanding and catches misinterpretations early.

### Step 2: Identify Gaps

Ask yourself:
- What information is missing?
- Are there ambiguous terms or requirements?
- What assumptions would I have to make?

### Step 3: Gather Codebase Context

Search the repository for relevant information:
- **Related files:** Find existing code that touches this area
- **Patterns:** How are similar features implemented?
- **Dependencies:** What does this code depend on or affect?
- **Tests:** Are there existing tests that cover this area?

### Step 4: Ask Clarifying Questions

If gaps remain, ask the user directly. Good clarifying questions are:
- Specific, not vague
- Actionable (the answer unblocks you)
- Prioritized (ask the most important ones first)

### Step 5: Confirm Understanding

Before moving to Plan phase, confirm:
- You can articulate the goal clearly
- You know the scope (what's in, what's out)
- You have enough context to break it into steps

---

## Output Format

At the end of intake, you should have:

1. **Task Summary:** 1-3 sentences describing what needs to be done
2. **Requirements:** Bulleted list of specific requirements
3. **Context:** Relevant files, patterns, or constraints discovered
4. **Assumptions:** Any assumptions made (for user to confirm)

---

## Example

**User Request:** "Add dark mode to the app"

**Intake Process:**

1. **Restate:** User wants to add a dark mode theme option to the application.

2. **Gaps identified:**
   - Where should the toggle be? (settings? header?)
   - Should it persist across sessions?
   - What components need dark variants?

3. **Codebase search:**
   - Found existing theme system in `src/styles/theme.ts`
   - Components use CSS variables from `src/styles/variables.css`
   - User preferences stored in `src/utils/storage.ts`

4. **Clarifying questions asked:**
   - "Should the dark mode toggle be in the settings page or always visible in the header?"
   - "Should it remember the user's preference across sessions?"

5. **User answers:** Settings page, yes persist it.

6. **Final summary:**
   - **Task:** Add dark mode theme with toggle in settings
   - **Requirements:**
     - Create dark color palette
     - Add toggle component in settings
     - Persist preference to localStorage
     - Apply theme on app load
   - **Context:** Uses existing theme system, CSS variables pattern
   - **Assumptions:** Dark mode applies globally (no per-page theming)

**Ready for Plan phase.**

---

## Common Pitfalls

- **Rushing to code:** Don't skip intake because you think you understand. A few minutes of clarification saves hours of rework.
- **Assuming too much:** When in doubt, ask. Users prefer questions over wrong implementations.
- **Shallow context search:** Look beyond the obvious files. Check tests, configs, and related features.
- **Too many questions:** Batch your questions. Don't ping the user repeatedly.
