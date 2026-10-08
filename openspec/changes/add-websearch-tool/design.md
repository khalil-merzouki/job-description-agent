# Design

## Context

See `proposal.md` for the motivation. The agent currently relies on the Vercel AI SDK with OpenAI. We need to introduce a tool that allows the LLM to search the web during its reasoning steps to gather context on companies and market salaries.

## Goals / Non-Goals

**Goals:**
- Provide a simple, asynchronous web search tool that the LLM can call.
- Give the LLM access to real-time search results (snippets, titles, URLs).

**Non-Goals:**
- Full webpage scraping (for now, we'll rely on search result snippets to save tokens and time).
- Complex multi-agent research pipelines.

## Decisions

**1. Search Provider: Tavily (or similar AI-focused search API)**
- **Rationale**: Searching the web reliably without getting blocked by captchas is difficult with plain `fetch`. An API like Tavily is designed specifically for AI agents, returning clean markdown or JSON snippets. It integrates well with tool calling.
- **Alternatives Considered**: 
  - *DuckDuckGo scraping packages*: Free, but brittle and prone to rate limiting.
  - *Google Custom Search / Bing Search*: Works well, but often returns generic metadata rather than content-rich snippets optimized for LLMs.

**2. Integration Method: Vercel AI SDK `tool()`**
- **Rationale**: We are already using `generateText` with the Vercel AI SDK. We can easily add a `webSearch` tool to the `tools` object and increase the `stopWhen` step count so the model can reason, search, and then write the file and respond.
- **Alternatives Considered**: Writing a custom loop, but `generateText` already handles multi-step tool calls natively.

## Risks / Trade-offs

- **Risk**: API Rate limits or costs for the search provider.
  - **Mitigation**: Require an environment variable (e.g., `TAVILY_API_KEY`) and handle errors gracefully if the key is missing or quota is exceeded.
- **Risk**: The LLM might get distracted by irrelevant search results.
  - **Mitigation**: Be highly specific in the tool description and system prompt about *when* and *how* to use the search tool.

