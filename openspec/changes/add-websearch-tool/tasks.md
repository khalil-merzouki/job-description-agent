# Tasks

## 1. Standalone search tool

- [x] 1.1 Implement `createWebSearchTool` in `src/agent/tools/webSearch.ts` with the existing AI SDK/Zod, injectable fetch/credentials, lazy `TAVILY_API_KEY` lookup, and trimmed 1–300-character query validation. Verify valid/invalid input, zero requests on import/construction, and a safe missing-credential outcome before transport; add these dedicated tool tests to the test command.
- [x] 1.2 Implement native fetch to Tavily with fixed basic-search options and no retries. Normalize up to five distinct HTTP(S) results with bounded titles/URLs/snippets and optional dates, distinguishing success, empty, and safe errors. Verify request shape, duplicate/malformed results, absent dates, authentication/quota/network errors, malformed responses, and credential/error-body redaction using simulated transport.
- [x] 1.3 Enforce two attempted requests per instance with synchronous counters, independent instance budgets, a ten-second abort deadline including body consumption, timer cleanup, and a 128-KiB body cap. Verify concurrent invocations, failed-attempt accounting, exhaustion without additional requests, timeout cancellation using controlled timers, and oversized-response rejection.
- [x] 1.4 Document the standalone factory, invocation-only credential requirement, returned statuses/results, limits, lifecycle, and Tavily query data flow in README and `.env.example`. Verify the documented tool contract matches its tests and the key is explicitly optional for current application/evaluation workflows; add no startup or evaluation credential checks.

## 2. Compatibility verification

- [x] 2.1 Run `pnpm typecheck`, `pnpm test`, `pnpm eval:local`, and `pnpm eval:guardrails:local` with external requests blocked and no Tavily key. Verify the analyzer does not import/register the tool, and prompts, generation limits, JSON schema, evaluation executors/fixtures, and startup requirements remain unchanged. Confirm offline checks pass without search calls or production output writes and run strict OpenSpec validation.

## Workflow follow-up

- Optionally invoke the standalone tool against Tavily with configured credentials to inspect actual results; this does not enable it in the agent.
- Request a separate integration change before registering the tool or changing agent search behavior.
- Review before requesting archive.
