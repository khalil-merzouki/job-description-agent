# Design

## Context

See `proposal.md` for motivation and `specs/evaluation/guardrails/spec.md` for the evaluation contract. `src/agent/jobAnalyzer.ts` currently embeds the Jev question, finite-probability check, and strict greater-than-0.5 threshold before calling `generateText`. It accepts an injected guardrail client. `evals/mocks.ts` already constructs a real TypeSafe client with a simulated transport, but defaults to acceptance. Existing fixtures and scorers assume a successful `JobAnalysisResult`; rejected text throws before that result exists. `evals/run.ts` offers live, reported mock, and offline mock modes using Laminar.

The saved goal is interpreted as a reusable evaluation suite for the existing guardrail, following these established reporting modes. This change depends on the guardrail implementation already present in the working tree; it does not complete the separate change's live terminal verification.

## Goals / Non-Goals

**Goals:** Share the production decision path, isolate classification from generation, and make errors and both types of classification mistake visible. Preserve deterministic offline evaluation and existing analyzer regression coverage.

**Non-Goals:** Change the guardrail prompt or threshold, tune Jev, assess extraction quality in the new suite, add a performance benchmark, or gate releases on a new statistical quality target. Mock accuracy verifies evaluation plumbing; only live results measure Jev on the chosen dataset.

## Decisions

### 1. Extract the existing decision into a shared guardrail function

Add `src/agent/guardrails.ts` exporting a function that accepts the input and an optional injected `Pick<TypeSafeClient, 'systemOne'>`, and returns `{ probability, accepted }`. Move the existing question and strict threshold unchanged. Validate that the returned probability is finite and in [0, 1]; malformed responses throw. `analyzeJobDescription` calls the helper and retains its existing `InvalidJobDescriptionError` rejection and pre-analysis ordering. Preserve the public analyzer options and result shape.

This lets the evaluation record probability without duplicating the classifier. Calling the full analyzer would spend OpenAI tokens on accepted cases; copying the question into a runner would risk drifting from application behavior.

### 2. Keep a dedicated dataset and result type

Use `evals/guardrails/` for fixtures, executor, scorers, runner, and tests. Cases contain `id`, `text`, `category`, `expectedAccepted`, and a deterministic mock probability. Use at least twelve synthetic cases covering each category in the spec, with a mix of accept and reject labels. Include the existing sparse developer posting and a French posting as valid anchors. Resumes describe a candidate seeking work, not an available vacancy; injection cases contain only classification instructions, not an otherwise valid job description. Labels follow the current guardrail contract.

Results form a discriminated union: successful decisions contain probability and acceptance; operational errors contain an error message and null probability/decision. The executor catches per-case failures so one service error does not abort the dataset. It does not import or invoke the main analyzer or file tool. No `JobAnalysis` object is fabricated for rejected inputs.

Extending the existing extraction fixture shape was considered, but would require unrelated scorers to handle absent analyses and would conflate classification and extraction quality.

### 3. Score independently of mock answers

Keep expected labels separate from mock probabilities. The normal mock dataset uses values matching its labels to verify a successful run. Tests supply deliberately inverted probabilities, 0.5/0.51 boundaries, malformed responses, and provider failures so the scorer cannot pass solely because it copies expectations.

Per-case Laminar scorers return `decision_correct` (1 only for a successful matching decision), `false_accept` (1 only for an invalid case accepted), `false_reject` (1 only for a valid case rejected), and `validation_error` (1 only for an operational error). Summary aggregation computes all confusion counts and error counts from results. Overall accuracy includes errors in the denominator. Class-specific rates divide mistake counts by the corresponding expected class count, including errored cases in that class; errors remain a separate category. A zero class denominator prints `N/A`, not 0 or NaN. Do not label Laminar's mean per-case false-accept indicator as the class-specific false-accept rate.

### 4. Follow existing execution modes in a separate runner

Add `pnpm eval:guardrails` for live Jev plus Laminar, `pnpm eval:guardrails:mock` for mocked Jev plus Laminar, and `pnpm eval:guardrails:local` for offline mocks. Use the same `--mock` and `--local` conventions; reject local live combinations and unsupported arguments. Live mode checks `TYPESAFE_API_KEY` and `LMNR_PROJECT_API_KEY` before external requests; reported mock checks only Laminar's key; offline requires none. Never initialize Laminar in offline mode.

Reuse the installed Laminar SDK's existing `evaluate`/`initialize`/`shutdown` integration, separate names/groups for `job-description-guardrails-live` and `job-description-guardrails-mock`, and bounded concurrency of two. Keep each case's result in a run-local collector for console summary instead of deriving class-specific rates from averaged Laminar scores. Record category, expected decision, mode, and threshold; retain the returned model identifier when available. No new AI SDK telemetry registration is needed for direct TypeSafe SDK calls. Print per-case output, aggregate metrics, and the returned Laminar URL. Reporting failures produce a nonzero exit and a clear error. Shut Laminar down in a `finally` block.

After reporting, any misclassification or operational error sets a nonzero exit status. This is a transparent dataset result, not a claim that every production input must be perfectly classified.

## Risks / Trade-offs

- Small synthetic datasets cannot prove general quality → document coverage and limitations; report mistakes by case and category so the dataset can expand.
- Guardrail extraction could change production behavior → retain the exact question and threshold and test analyzer ordering, errors, and valid-case continuation.
- Service failure can resemble a correct rejection → use explicit error results and a separate error count, with zero correctness credit.
- Mock runs can appear to establish model quality → label mode everywhere and document that deterministic answers only verify the workflow.
- Live evaluation sends data externally and may incur costs → use synthetic fixtures, document TypeSafe/Laminar data flow and required keys, and keep offline execution as the default verification path during implementation.
- The parent guardrail change remains unarchived → reuse its current implementation without altering its planning artifacts or completing its terminal task on the basis of this suite.

## Migration Plan

Extract the helper with compatibility regression checks, add the suite and scripts, and verify both offline suites. Run a live guardrail evaluation once TypeSafe and Laminar credentials are configured, recording observed failures rather than silently changing labels or policy. No persisted data migration is required. Rollback removes the added suite/scripts and restores inline validation in the analyzer while keeping the original guardrail behavior.
