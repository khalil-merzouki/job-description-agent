# Proposal

## Why

The Jev guardrail has regression tests for its control flow, but the current evaluation dataset contains only valid job descriptions and its mock guardrail always accepts input. We need a labeled evaluation suite to measure whether the real guardrail accepts valid jobs and rejects unrelated text, and to expose false accepts and false rejects.

## What Changes

- Add a dedicated guardrail evaluation dataset with valid postings, short and multilingual postings, and invalid greetings, source code, unrelated articles, resumes, and classification instructions.
- Evaluate the same Jev question and probability threshold used by the application, recording probability, expected decision, actual decision, and operational failures.
- Report per-case correctness and aggregate accuracy, false accepts, false rejects, and error counts, with separate live and mock results in the existing Laminar workflow.
- Provide a credential-free offline mock mode and a live mode requiring TypeSafe and Laminar keys, without running OpenAI analysis or saving analysis files.
- Keep the existing job extraction evaluations and application acceptance policy unchanged.

## Capabilities

### New Capabilities

- `evaluation/guardrails`: Labeled, isolated evaluation of job-description guardrail decisions with reproducible mock coverage and live quality reporting.

### Modified Capabilities

None. No main specs exist yet; `agent/guardrails` belongs to the separate in-flight `add-guardrails` change and its acceptance contract remains unchanged.

## Impact

- Extract the existing guardrail decision into a reusable function under `src/agent/` so the analyzer and evaluations share the prompt, SDK call, and strict greater-than-0.5 decision rule.
- Add guardrail fixtures, executor, scorers, runner, and regression coverage under `evals/`, following the existing TypeSafe SDK mocks and Laminar integration.
- Add dedicated package scripts and README usage, credentials, score definitions, and mock limitations.
- Reuse installed dependencies. Live runs send synthetic labeled input to TypeSafe and evaluation data to Laminar; offline runs require no network, keys, OpenAI, or output directory.
