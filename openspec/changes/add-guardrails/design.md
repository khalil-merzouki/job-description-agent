# Design

## Context

See `proposal.md` for motivation. The current agent loop immediately sends user input to the Vercel AI SDK to generate a detailed JSON output. We are introducing a pre-flight validation step using TypeSafe AI's Jev model to ensure the input is valid.

## Goals / Non-Goals

**Goals:**
- Validate user input quickly and probabilistically before invoking the main LLM.
- Return a clear error state to the UI if the input is rejected.

**Non-Goals:**
- Advanced parsing or extraction within the guardrail itself (it should only return a yes/no probability).

## Decisions

**1. Dependency: `@typesafe-ai/sdk`**
- **Rationale**: The official SDK provides the `noul()` primitive, which is specifically designed to answer yes/no questions probabilistically and extremely quickly using the Jev "System One" decision model.
- **Alternatives Considered**: Using a standard OpenAI call with `gpt-4o-mini` to classify the text. While possible, Jev is purpose-built for this kind of routing/guardrail check and typically offers lower latency and strict type safety out of the box without needing structured output schemas.

**2. Integration Point: `jobAnalyzer.ts`**
- **Rationale**: We will export a new function (or update `analyzeJobDescription`) to first instantiate the `TypeSafeClient` and ask: `noul("Is this text a job description?")`. If the probability is high enough (e.g., > 0.5), we proceed to `generateText`. If not, we throw an error that the UI can catch and display.
- **Alternatives Considered**: Validating directly in the UI component (`App.tsx`). This mixes business logic with UI rendering. Keeping it in `jobAnalyzer.ts` (or a dedicated `guardrails.ts` module) maintains separation of concerns.

## Risks / Trade-offs

- **Risk**: False positives or false negatives (e.g., rejecting a poorly formatted but valid job description).
  - **Mitigation**: We will need to monitor the threshold (e.g., strictly relying on Jev's boolean result or tuning the prompt to be slightly permissive).
- **Risk**: Missing `TYPESAFE_API_KEY`.
  - **Mitigation**: Add startup checks in `index.tsx` similarly to how `OPENAI_API_KEY` is checked.

