# Proposal

## Why

A reusable web search tool provides a tested retrieval capability for future work. Adding it independently lets us verify provider handling and resource limits before choosing how the job-description agent should use it.

## What Changes

- Add an exported Tavily-backed AI SDK tool factory with validated queries and injectable transport.
- Return bounded titles, source URLs, snippets, and available publication dates with distinct successful, empty, error, and budget-exhausted outcomes.
- Limit each tool instance to two provider requests and abort each request after ten seconds.
- Document `TAVILY_API_KEY` as required only when invoking the standalone tool, and add deterministic tool-level tests.
- Keep the tool unregistered in the agent. Agent prompts, generation steps, analysis outputs, application startup requirements, and existing evaluation workflows remain unchanged.

## Capabilities

### New Capabilities

- `agent/tools/web-search`: Independently invocable, bounded web retrieval with attributable results and explicit failure outcomes.

### Modified Capabilities

None. There are no main specs yet.

## Impact

- Add `src/agent/tools/webSearch.ts`, dedicated tool tests, optional configuration documentation in `.env.example`, and README documentation.
- Extend the test command to discover the new tests if necessary.
- Use Node's native fetch against Tavily's Search API; no new provider SDK dependency is needed. Explicit tool invocation sends the caller's query to Tavily and may incur provider costs.

## Scope

This change adds the tool only. Registering it in `jobAnalyzer.ts`, modifying `src/agent/system/prompt.ts`, changing salary estimation or citation policy, adding search calls to analysis mocks, requiring Tavily at application startup, and altering existing evaluation executors are deferred to a separately requested integration change. Page fetching and scraping are also outside this scope.
