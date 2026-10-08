# Design

## Context

See `proposal.md` and `specs/agent/tools/web-search/spec.md`. The analyzer currently exposes its file-writing tool after the Jev check, and its prompt is in `src/agent/system/prompt.ts`. This change adds an independent module under the existing tools directory, with no analyzer imports or registration changes. Existing analysis and guardrail evaluation executors retain their behavior.

## Goals / Non-Goals

**Goals:** Deliver a typed, directly testable search tool with attributable bounded results, safe errors, and controlled resource use.

**Non-Goals:** Agent integration, changes to prompts or generation limits, salary research policy, output citations, modifications to analysis fixtures/executors, application startup requirements, scraping, or visiting result URLs.

## Decisions

### 1. Standalone factory and lazy configuration

Export `createWebSearchTool` from `src/agent/tools/webSearch.ts` using the installed AI SDK `tool` API and Zod. Accept optional explicit credentials and injectable fetch, with `TAVILY_API_KEY` as the default credential source. Import and construction do not validate credentials or contact Tavily. Invocation validates a trimmed 1–300-character query and returns a fixed missing-credential error before any request if no usable key is available. No singleton instance or registration in the analyzer.

Document the key in `.env.example` as optional for the application and needed only for explicit tool invocation. README documents the standalone contract, limits, returned data, and query disclosure. Leave `index.tsx` and all evaluation credential checks unchanged.

### 2. Tavily through native fetch

Use `POST https://api.tavily.com/search` with bearer authentication and a JSON body. Set `search_depth: basic`, `topic: general`, `max_results: 5`, `auto_parameters: false`; disable answers, raw content, and images. The [official Search API reference](https://docs.tavily.com/documentation/api-reference/endpoint/search) documents the endpoint, authentication, and options.

Native fetch avoids a dependency for a single endpoint and supports direct cancellation and injected transport tests. The previously proposed Tavily SDK would still require custom budgeting and normalization. No automatic retries or result-page requests.

### 3. Per-instance budgets and bounded responses

Each factory invocation creates an independent attempted-request counter. Increment synchronously before awaiting transport so parallel tool invocations cannot exceed two requests. Provider failures count against the budget; invalid queries and missing credentials do not. A third request returns `budget_exhausted` without transport work. The budget belongs to the instance, not to an analysis; a future integration must deliberately create fresh instances for its chosen lifecycle.

Use an abort controller and ten-second deadline covering transport and body consumption. Clear timers in `finally`. Limit response bodies to 128 KiB before parsing; cancel oversized bodies and return a safe invalid-response error.

Normalize and deduplicate HTTP(S) URLs. Discard entries missing a usable title, URL, or textual content. Return at most five entries with title capped at 200 characters, URL limited to 2,048 characters, and snippet capped at 1,000 characters. Preserve a usable provider `published_date` or return null. Never fabricate dates or visit URLs. Missing/malformed results-array shapes are errors; valid arrays with no usable entries are empty.

Return a discriminated union with status `ok`, `empty`, `error`, or `budget_exhausted`, the normalized query, and result entries where applicable. Errors include an allowlisted code and fixed safe message, with no evidence. Cover missing-credential, timeout, authentication, quota/rate-limit, network, and invalid-response cases. Never echo authorization headers, provider error bodies, or raw exception messages.

### 4. Isolated verification

Add dedicated tool tests under `src/agent/tools/` and include them in the existing test command. Invoke the tool with injected transport and explicit test credentials; assert its query schema, request options, normalized results, safe errors, cancellation, response cap, and per-instance budgets. Use controlled timers for the deadline tests and concurrent invocation tests for budget enforcement. Test import/construction and missing-key invocation with transport spies proving zero requests.

Existing analysis models and mock executors receive no search tool, and their fixtures are not rewritten. Run analysis and guardrail offline evaluation with external calls blocked and without a Tavily key. Verify source inspection and existing workflow checks establish that the analyzer does not import/register the new tool, the prompt and generation limit remain unchanged, and no search credential becomes mandatory. Mock results establish tool behavior, not live search relevance.

## Risks / Trade-offs

- Returned snippets may be stale, misleading, or contain instructions → expose source metadata and return them as external data; evidence interpretation and prompt policy belong to a later integration change.
- Explicit standalone calls can incur costs or delay → two-request per-instance budget, ten-second abort deadlines, basic search, no retries, and bounded bodies/results.
- A caller may reuse an exhausted instance → document the instance lifecycle and explicit budget-exhausted result.
- Environment-dependent tests can accidentally call the provider → inject transport and credentials and block external requests in offline verification.

## Migration Plan

Add the module, dedicated tests, and optional credential documentation. Verify type checks, tests, and existing offline evaluations. No existing runtime path or saved-data format changes. Rollback removes the standalone module, its tests, and documentation. Future agent integration requires a separate request and decisions about search purpose, citation policy, and workflow budgets.
