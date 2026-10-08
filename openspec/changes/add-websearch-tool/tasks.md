# Tasks

## 1. Setup & Environment

- [ ] 1.1 Add `@tavily/core` dependency to `package.json` and verify installation succeeds.
- [ ] 1.2 Update `.env.example` and `index.tsx` to document and require the `TAVILY_API_KEY` environment variable, verifying the agent fails fast at startup if missing.

## 2. Core Implementation

- [ ] 2.1 Implement the `webSearch` tool using the Vercel AI SDK `tool` function in `src/agent/tools/webSearch.ts`, integrating the Tavily client. Verify it exports a valid AI tool.
- [ ] 2.2 Update `src/agent/jobAnalyzer.ts` to include the `webSearch` tool in the `tools` object passed to `generateText`. Verify the TypeScript types compile successfully.
- [ ] 2.3 Update the `SYSTEM_PROMPT` in `src/agent/jobAnalyzer.ts` to instruct the agent to use the web search tool for missing company details and salary estimation. Verify by observing the agent's updated reasoning process on an incomplete job description.

## Workflow follow-up

- Archive the change after the tasks are implemented and the agent is manually tested to verify it searches the web successfully.

