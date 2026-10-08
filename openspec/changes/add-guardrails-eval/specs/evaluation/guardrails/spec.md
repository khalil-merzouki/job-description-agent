# Spec Delta

## Purpose

Measure how reliably the job-description guardrail accepts valid postings and rejects unrelated text, while distinguishing classification mistakes from service failures.

## ADDED Requirements

### Requirement: Evaluate a labeled dataset
The evaluation suite SHALL use synthetic cases with unique identifiers, input text, a category, and an expected accept or reject decision. It SHALL include complete, sparse, informal, and multilingual job postings alongside greetings, source code, unrelated articles, resumes, and classification instructions that are not job postings.

#### Scenario: Both classes are represented
- **WHEN** the guardrail evaluation dataset is loaded
- **THEN** each case has an explicit expected decision and unique identifier
- **THEN** both valid and invalid categories are represented, including sparse and multilingual valid jobs

### Requirement: Evaluate the application guardrail in isolation
The suite SHALL evaluate the application's guardrail question and decision policy without invoking job analysis or writing analysis files. A finite probability in [0, 1] SHALL produce acceptance only when greater than 0.5. Successful results SHALL record the probability, actual decision, expected decision, and case identifier.

#### Scenario: Decision matches the application boundary
- **WHEN** the evaluated probability is 0.5
- **THEN** the recorded decision is reject
- **WHEN** the evaluated probability is 0.51
- **THEN** the recorded decision is accept

#### Scenario: Live guardrail evaluation needs no analyzer
- **WHEN** a live evaluation runs with its required guardrail and reporting credentials
- **THEN** it does not require an OpenAI key or output directory
- **THEN** it invokes no OpenAI analysis and writes no analysis JSON files

### Requirement: Report classification quality
The suite SHALL report per-case correctness and aggregate counts for correct accepts, correct rejects, false accepts, false rejects, and errors. Accuracy SHALL be correct decisions divided by all cases. False-accept and false-reject rates SHALL use expected-reject and expected-accept case counts respectively; empty denominators SHALL display as unavailable.

#### Scenario: A wrong acceptance is visible
- **WHEN** an expected-reject case is accepted
- **THEN** its correctness score is zero and the false-accept count increases
- **THEN** aggregate accuracy decreases and the false-accept rate reflects the expected-reject denominator

#### Scenario: A wrong rejection is visible
- **WHEN** an expected-accept case is rejected
- **THEN** its correctness score is zero and the false-reject count increases
- **THEN** the false-reject rate reflects the expected-accept denominator

### Requirement: Distinguish operational failures
The suite SHALL record validation service failures and malformed responses as errors with no actual decision or probability, score them as incorrect, and continue evaluating the remaining cases. Errors SHALL NOT count as correct rejections or classification mistakes. A completed run with any mistake or error SHALL return a nonzero exit status after reporting results.

#### Scenario: Provider fails for an invalid case
- **WHEN** the validation service fails for an expected-reject case
- **THEN** the case is recorded as an error with correctness zero
- **THEN** neither the correct-reject count nor the false-accept count increases
- **THEN** remaining cases run and the final exit status is nonzero

#### Scenario: Malformed probability
- **WHEN** validation returns a missing, nonfinite, or out-of-range probability
- **THEN** the case is reported as an operational error rather than an accept or reject decision

### Requirement: Separate live and mock evaluation modes
The suite SHALL offer live evaluation with guardrail and Laminar credentials, deterministic mock evaluation reported to Laminar, and offline mock evaluation requiring no credentials or network. Live and mock reported runs SHALL use distinct names or groups and explicit mode metadata. Reports and documentation SHALL identify mock results as workflow verification rather than evidence of model quality.

#### Scenario: Offline run
- **WHEN** offline mock evaluation is selected without any API keys
- **THEN** the suite produces per-case and aggregate local results without network requests
- **THEN** results identify the mode as mock

#### Scenario: Missing live credentials
- **WHEN** live evaluation is requested without a required credential
- **THEN** the runner exits with a clear missing-credential message before any external request

#### Scenario: Reported evaluation
- **WHEN** a live or reported mock run completes successfully
- **THEN** its labeled cases, probabilities or errors, correctness scores, and mode are available in Laminar
- **THEN** the runner prints aggregate results and a results link

### Requirement: Preserve existing analysis evaluation workflows
Existing job-analysis evaluation commands SHALL retain their extraction and file-workflow scoring behavior. Offline analysis evaluation SHALL remain independent of credentials and network access.

#### Scenario: Existing offline analysis evaluation
- **WHEN** the existing local mock analysis command runs after guardrail evaluation is added
- **THEN** it still evaluates the original job-analysis fixtures and scores without credentials or network access
