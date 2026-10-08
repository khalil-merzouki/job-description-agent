# Spec Delta

## Purpose

Provide an independently invocable web search tool with bounded attributable results and explicit failure outcomes, without enabling web search in the job-description agent.

## ADDED Requirements

### Requirement: Explicit standalone invocation
The system SHALL provide a web search tool accepting a nonempty trimmed query of at most 300 characters. Importing or constructing the tool SHALL cause no provider request. Only explicit invocation SHALL perform search. Invalid queries SHALL be rejected before contacting the provider.

#### Scenario: Valid query
- **WHEN** a caller explicitly invokes the tool with a valid query
- **THEN** the tool requests search results for that query

#### Scenario: Invalid query
- **WHEN** a caller supplies a blank or oversized query
- **THEN** validation rejects it without a provider request

#### Scenario: Import and construction
- **WHEN** the tool module is imported or a tool instance is created
- **THEN** no provider request occurs

### Requirement: Return bounded attributable results
Successful search SHALL return at most five distinct results containing a title, HTTP or HTTPS URL, and a snippet of at most 1,000 characters, with publication date when supplied by the provider. Invalid entries SHALL be discarded. A valid response with no usable entries SHALL return an empty outcome without fabricated evidence.

#### Scenario: Mixed provider results
- **WHEN** the provider returns duplicate URLs, malformed entries, and oversized snippets
- **THEN** only valid distinct results are returned, up to five
- **THEN** snippets are bounded and absent dates remain unknown

#### Scenario: Empty results
- **WHEN** the provider returns a valid results array with no usable entries
- **THEN** the tool returns an empty outcome rather than a provider error

### Requirement: Bound work per tool instance
Each tool instance SHALL issue at most two provider requests, counting failed attempts, and each request SHALL be aborted after ten seconds. Further invocations SHALL return budget exhaustion without contacting the provider. Concurrent invocations SHALL obey the same limit; separate instances SHALL have independent budgets.

#### Scenario: Concurrent calls exceed budget
- **WHEN** three valid invocations are issued concurrently on one instance
- **THEN** no more than two provider requests occur
- **THEN** the remaining invocation returns budget exhaustion

#### Scenario: Independent instances
- **WHEN** a new tool instance is created after another has exhausted its budget
- **THEN** the new instance has its own two-request budget

#### Scenario: Timeout
- **WHEN** a request or its response-body consumption exceeds ten seconds
- **THEN** it is aborted and the tool returns a timeout error

### Requirement: Return safe explicit errors
Missing credentials, authentication failures, quota or rate limits, timeouts, network failures, and malformed or oversized responses SHALL produce recognizable error outcomes with no evidence. Tool output SHALL not expose credentials, authorization headers, raw provider error bodies, or raw exception messages. Missing credentials SHALL cause no provider request.

#### Scenario: Missing credential
- **WHEN** a caller invokes the tool without its required search credential
- **THEN** it returns a missing-credential error without contacting the provider

#### Scenario: Provider failure
- **WHEN** the provider rejects the request or returns a malformed response
- **THEN** the tool returns an error distinct from successful empty results
- **THEN** it returns a safe code and message without leaking provider error details

### Requirement: Leave the agent disconnected
The tool SHALL remain unregistered in the job-description agent. Existing analysis and guardrail workflows SHALL issue no search requests and SHALL not require a search credential. Their prompts, analysis format, generation limits, and saved-output behavior SHALL remain unchanged by this change.

#### Scenario: Analyze without Tavily
- **WHEN** an existing analysis or guardrail workflow runs without a search credential
- **THEN** search configuration introduces no new startup requirement
- **THEN** no search request is issued and existing workflow behavior is retained
