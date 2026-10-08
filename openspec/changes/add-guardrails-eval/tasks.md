# Tasks

## 1. Shared guardrail decision

- [x] 1.1 Extract the current Jev question, SDK call, probability validation, and strict greater-than-0.5 rule into `src/agent/guardrails.ts`; update the analyzer to call it while preserving its injected-client option, rejection error, and result shape. Verify tests cover 0, 0.5, 0.51, and 1, missing/nonfinite/out-of-range probabilities, provider errors, and that rejected or failed validation invokes neither analysis nor file writes; retain existing valid analyzer workflow tests.

## 2. Labeled dataset and isolated evaluation

- [x] 2.1 Add at least twelve synthetic labeled fixtures under `evals/guardrails/`, covering complete, sparse, informal, and multilingual valid postings and greetings, source code, unrelated articles, resumes, and classification-only instructions. Keep expected labels separate from mock probabilities; verify unique identifiers, category coverage, and both expected classes with fixture tests.
- [x] 2.2 Add an isolated executor that calls the shared guardrail and returns either a probability/decision result or an explicit operational error with null probability/decision. Reuse simulated SDK transport for offline cases; verify successful decisions, deliberately inverted mock answers, malformed responses, and service failures without OpenAI calls or file writes, and verify a failed case does not prevent subsequent cases from running.
- [x] 2.3 Add per-case correctness, false-accept, false-reject, and validation-error scorers plus aggregate confusion counts, accuracy, and class-specific rates. Verify hand-calculated mixed results, errors receiving zero correctness without classification-mistake credit, and empty-denominator handling; document formulas and mock limitations in README.

## 3. Runner and reporting

- [x] 3.1 Add the guardrail runner and `eval:guardrails`, `eval:guardrails:mock`, and `eval:guardrails:local` scripts with mode validation, per-case and aggregate console output, and nonzero exit status after any mistake or error. Verify offline mode runs with all API keys absent and no network, live/reported-mock credential checks happen before requests, unsupported arguments fail clearly, and failure exit statuses follow the summary; document commands, credentials, synthetic data flow, and exit behavior in README.
- [x] 3.2 Connect reported modes to the existing Laminar SDK with distinct live/mock names or groups, mode/category/threshold metadata, labeled decision/error outputs and per-case scores, concurrency of two, and guaranteed shutdown. Verify reporting with a simulated Laminar adapter, checking run separation, output and score shape, final results link, aggregate class-specific rates, and reporting-error handling without making external requests.
- [x] 3.3 Include the new tests in `pnpm test` and verify integration with `pnpm typecheck`, `pnpm test`, `pnpm eval:guardrails:local`, and the existing `pnpm eval:local`; confirm analyzer fixtures and scores retain their behavior and neither offline suite requires credentials or modifies analysis output files.

## Workflow follow-up

- With TypeSafe and Laminar credentials configured, run `pnpm eval:guardrails` and inspect the live case results, model metadata when available, aggregate metrics, and Laminar link. Record observed mistakes and service failures; mock success does not establish live classification quality.
- Review the change before requesting archive. The separate `add-guardrails` terminal verification remains independent.
