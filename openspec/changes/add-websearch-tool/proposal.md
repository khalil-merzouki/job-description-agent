# Proposal

## Why

The job description agent currently relies entirely on the provided text to extract information and estimate salaries. By adding a web search tool, the agent can actively search for missing information—such as the hiring company's details, industry standard salaries for similar roles, or specific skills context—resulting in more accurate and comprehensive job analysis.

## What Changes

- Introduce a new tool (`webSearchTool`) that allows the agent to execute search queries against the web.
- Provide the web search tool to the `ToolLoopAgent` (or `generateText` tools array) in the `jobAnalyzer`.
- Update the agent's system prompt to instruct it on when and how to use the web search tool (e.g., to look up company information or verify salary estimates).

## Capabilities

### New Capabilities
- `agent/tools/web-search`: Defines the behavior and usage of the web search tool by the job description agent.

### Modified Capabilities
- None.

## Impact

- **Code:** Will introduce a new tool definition file (e.g., `src/agent/tools/webSearch.ts`) and modify the existing `jobAnalyzer.ts` to include this tool.
- **Dependencies:** May require a new search provider SDK or a generic fetch wrapper depending on the chosen implementation.
- **Systems:** Enhances the AI SDK agent with external knowledge retrieval capabilities.

