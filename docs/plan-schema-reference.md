<!-- this comes from agent/skills/discovery, so keep this up-to-date with that documentation -->
## Plan Schema Reference

```yaml
$schema: http://json-schema.org/draft-07/schema#
type: object
title: Plan Schema
description: >
  Extended plan schema for planning output. Includes additional fields for
  rich context, enabling agents to execute steps autonomously without further
  user input.

properties:
  metadata:
    type: object
    description: Plan metadata including creation info and high-level context
    properties:
      created_at:
        type: string
        format: date-time
      created_by:
        type: string
      version:
        type: string
      source_idea:
        type: string
        description: The original idea or request that triggered discovery
      outcomes:
        type: array
        description: User-visible results this plan delivers
        items:
          type: string
    required:
      - created_at
      - created_by
      - outcomes

  steps:
    type: array
    description: Array of plan steps defining the work to be done
    items:
      $ref: '#/definitions/Step'

required:
  - metadata
  - steps

definitions:
  Step:
    type: object
    description: Individual step in the plan, representing a feature or work unit
    required:
      - id
      - description
      - context
      - requirements
      - criteria
    properties:
      id:
        type: string
        description: Unique identifier for the step

      description:
        type: string
        description: Concise summary of what this step accomplishes

      status:
        type: string
        enum:
          - pending
          - in_progress
          - complete
          - blocked
        default: pending
        description: Current status of the step

      deps:
        type: array
        description: List of step IDs this step depends on
        items:
          type: string
        default: []

      parallel:
        type: boolean
        description: Whether this step can run in parallel with others
        default: false

      context:
        type: string
        description: >
          Background information needed to execute this step. Should include
          why this step exists, how it fits into the larger picture, and any
          relevant technical context an agent needs to understand before starting.

      requirements:
        type: array
        description: Specific requirements for this step
        items:
          type: string
        minItems: 1

      criteria:
        type: array
        description: Acceptance criteria - specific, testable conditions for completion
        items:
          type: string
        minItems: 1

      files:
        type: array
        description: Files this step will create or modify
        items:
          type: string
        default: []

      context_files:
        type: array
        description: >
          Files the agent should read for context before starting. These are
          not modified, but provide patterns, interfaces, or background needed
          to complete the step.
        items:
          type: string
        default: []

      commands:
        type: array
        description: Specific commands to execute (build, test, etc.)
        items:
          type: string
        default: []

      risk_notes:
        type: string
        description: Warnings, edge cases, or things to watch out for
```

## Example Plan

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