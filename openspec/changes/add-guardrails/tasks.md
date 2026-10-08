# Tasks

## 1. Setup & Environment

- [x] 1.1 Add `@typesafe-ai/sdk` dependency to `package.json` and verify installation succeeds.
- [x] 1.2 Update `.env.example` and `index.tsx` to document and require the `TYPESAFE_API_KEY` environment variable, verifying the agent fails fast at startup if missing.

## 2. Core Implementation

- [x] 2.1 Update `src/agent/jobAnalyzer.ts` to instantiate `TypeSafeClient` and use the `noul()` primitive on the user's input before running `generateText`. Verify it throws a recognizable error if the text is not a job description.
- [ ] 2.2 Verify the guardrail behavior by running the application, providing arbitrary non-job text (e.g., "Hello world"), and confirming it immediately rejects the input with an error rather than spinning up the main LLM analysis.

## Workflow follow-up

- Archive the change after the tasks are implemented and the guardrail behavior is manually verified in the terminal UI.
