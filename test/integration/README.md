# Integration Tests

End-to-end tests that run real AI agents against a controlled target repo.

## Prerequisites

- At least one agent CLI installed and configured: `claude`, `codex`, or `gemini`
- Agent config directory present (`~/.claude`, `~/.codex`, or `~/.gemini`)
- Valid API credentials for the agent

## Running

```bash
# Run all scenarios (prompts for confirmation)
bash test/integration/run.sh

# Skip confirmation
bash test/integration/run.sh --yes

# Run a single scenario
bash test/integration/run.sh --scenario 01
```

Or via npm:

```bash
npm run test:integration
```

## Scenarios

| #   | Name               | What it tests                                   |
| --- | ------------------ | ----------------------------------------------- |
| 01  | Single step        | Baseline: one step, one file change             |
| 02  | Serial chain       | Step B depends on step A                        |
| 03  | Parallel steps     | Two steps run concurrently via worktrees        |
| 04  | Blocked step       | Agent reports blocked on impossible requirement |
| 05  | Resume after block | Unblock + resume continues remaining steps      |
| 06  | Failover           | Nonexistent agent triggers failover to real one |
| 07  | Review + edit loop | Review agent evaluates changes after execution  |

## Cost and Duration

- Full suite: ~15-30 minutes, $1-5 in API charges
- Single scenario: ~2-5 minutes, <$1
- The `ORRERY_AGENT_TIMEOUT` env var limits per-invocation cost (default: 2 min)

## Debugging

Set `KEEP_SANDBOX=1` to preserve temp directories after tests:

```bash
KEEP_SANDBOX=1 bash test/integration/run.sh --scenario 01
```

The sandbox path is printed to stdout when preserved.

## Target Repo

Tests use a tiny Node.js project in `fixtures/target-repo/` with intentionally
missing functions. Plan steps ask agents to add the missing pieces, making
tasks unambiguous and fast to complete.

## Assertion Strategy

Agents are non-deterministic. Assertions check structural outcomes only:

- Step statuses (complete/blocked)
- File existence and function name patterns (regex, not exact content)
- Git commit counts (lower bounds)
- Report file existence
