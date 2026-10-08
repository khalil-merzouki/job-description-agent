# Proposal

## Why

Users might accidentally or intentionally paste arbitrary text (e.g., source code, irrelevant articles, or conversational text) into the agent instead of a job description. Running the primary, token-heavy LLM analysis on invalid text wastes time and API credits, and can lead to hallucinated outputs. We need a fast, reliable guardrail to reject invalid inputs early.

## What Changes

- Integrate TypeSafe AI's "Jev" model via the `@typesafe-ai/sdk` to evaluate the input before deep analysis.
- Add a pre-analysis step that uses the `noul` (yes/no probability) primitive to determine if the input text represents a valid job description.
- Reject the input and return a clear error message to the user if the text is determined not to be a job description.

## Capabilities

### New Capabilities
- `agent/guardrails`: Fast, probabilistic pre-flight checks on user input to ensure it meets requirements before passing it to the main agent loop.

### Modified Capabilities
- None.

## Impact

- **Code:** Modifies `src/agent/jobAnalyzer.ts` (or adds a wrapper/guardrail layer) to intercept the input.
- **Dependencies:** Adds `@typesafe-ai/sdk`.
- **Systems:** Requires a `TYPESAFE_API_KEY` for the Jev model, slightly increasing configuration overhead but significantly saving on primary LLM costs by failing fast.

