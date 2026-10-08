# Job description agent

Install with `pnpm install`, copy `.env.example` to `.env`, configure `OPENAI_API_KEY`, `TYPESAFE_API_KEY` and `OUTPUT_DIR`, then run `pnpm start`.
Requires Node.js 22.12 or later.

Before analysis, TypeSafe Jev checks whether the input is a job description. Analysis proceeds only when its yes probability exceeds 0.5; rejected input displays an error without calling OpenAI or writing a result. Validation failures also stop analysis.

## Evaluating with Laminar

Set `LMNR_PROJECT_API_KEY` in `.env` to a project key from [Laminar](https://laminar.sh).
The evaluation runner uses the [Laminar TypeScript SDK](https://github.com/lmnr-ai/lmnr-ts) and registers its AI SDK telemetry integration to trace model steps and tool calls. It prints a link to the evaluation results when finished.

| Command | Model | Results |
| --- | --- | --- |
| `pnpm eval` | Real OpenAI model and Jev guardrail; requires `OPENAI_API_KEY` and `TYPESAFE_API_KEY` | Uploaded to Laminar |
| `pnpm eval:mock` | Deterministic mocked model; no OpenAI key needed | Uploaded to Laminar |
| `pnpm eval:local` | Deterministic mocked model; no keys or network needed | Console score table |
| `pnpm test` | Mock workflow and scorer regression tests | Local test results |
| `pnpm typecheck` | Type checks application and evaluation code | Local diagnostics |

Every evaluation uses a fresh in-memory `writeFile` tool, so it captures writes without modifying `output/` or requiring `OUTPUT_DIR`. Mock runs simulate Jev responses as well as OpenAI responses. Live evaluation sends synthetic descriptions to TypeSafe for validation, makes paid OpenAI calls and sends the descriptions, responses, file contents and scores to Laminar.

`evals/fixtures.ts` contains four synthetic cases: an explicit annual salary, a French description with an estimated salary, missing facts, and an hourly contract. Add cases with the description, expected analysis, and mock file name. The expected analysis is a reference answer; live agents only receive the description.

Scores range from 0 to 1:

- `schema_valid`: response matches the Zod schema.
- `facts_accuracy`: case-insensitive factual matches and exact normalized skill sets, including absent facts. Descriptive prose is not compared.
- `salary_correct`: stated amounts, currency and period are preserved; estimates have an explained positive annual range. This checks estimate handling, not market accuracy.
- `file_workflow`: exactly one write, correct kebab-case company/title filename, valid pretty-printed JSON matching the final response and returned path.

Mock scores validate the evaluation wiring and tool loop; run `pnpm eval` to measure model extraction quality. Mock and live runs use separate Laminar groups. Tests include intentionally wrong facts, salaries and file writes so broken scorers cannot pass solely by replaying reference answers.

## Evaluating the guardrail

The dedicated guardrail dataset in `evals/guardrails/fixtures.ts` includes complete, sparse, informal and multilingual postings, plus greetings, source code, articles, resumes and classification instructions. It evaluates the same Jev question and strict probability > 0.5 policy as the application.

Per-case scores are `decision_correct`, `false_accept`, `false_reject`, and `validation_error`. Aggregate accuracy is correct decisions divided by all cases, including errors. The false-accept rate divides wrong acceptances by expected-reject cases; the false-reject rate divides wrong rejections by expected-accept cases. Errors receive zero correctness credit and count separately from classification mistakes. A rate with no eligible cases displays `N/A`.

Mock probabilities are deterministic and verify the evaluation workflow, not Jev's classification quality. The small synthetic dataset gives a reproducible starting point, not a guarantee for arbitrary real-world text.

| Command | Validation | Reporting and credentials |
| --- | --- | --- |
| `pnpm eval:guardrails` | Live Jev | Laminar; requires `TYPESAFE_API_KEY` and `LMNR_PROJECT_API_KEY` |
| `pnpm eval:guardrails:mock` | Mock Jev | Laminar; requires only `LMNR_PROJECT_API_KEY` |
| `pnpm eval:guardrails:local` | Mock Jev | Local console; no keys or network |

Guardrail evaluations never run OpenAI analysis or write analysis files, and require no `OUTPUT_DIR`. Live mode sends synthetic fixture text to TypeSafe and labeled inputs, probabilities/decisions or errors, and scores to Laminar. Reported mock mode sends only evaluation data to Laminar. Live and mock reports use separate `job-description-guardrails-live` and `job-description-guardrails-mock` groups, with mode and threshold metadata and the returned Jev model identifier when available.

Each run prints case results and aggregate metrics; reported runs also print a Laminar results link. Runs exit with status 1 after reporting if any case is misclassified or has a validation error. Invalid options, missing credentials, or reporting failures also return status 1. Provider errors do not prevent the other cases from being evaluated. Laminar's average per-case `false_accept`/`false_reject` scores use all cases as their denominator; the console's class-specific rates use their respective expected class counts.

## Standalone web search tool

`createWebSearchTool` is exported from `src/agent/tools/webSearch.ts`. It is available for explicit standalone use and is not registered with the job-description agent. Application startup, salary estimation, prompts, and existing evaluation workflows do not require `TAVILY_API_KEY` and do not use search.

```ts
import { createWebSearchTool } from './src/agent/tools/webSearch.js';

const search = createWebSearchTool();
const result = await search.execute!(
  { query: 'Python developer salary Paris' },
  { toolCallId: 'standalone-search', messages: [], context: {} },
);
console.log(result);
```

Set `TAVILY_API_KEY` before invocation, or supply `{ apiKey }` to the factory. Importing or creating the tool makes no requests and needs no key. The default environment key is read at invocation; an explicitly supplied blank key returns `missing_credential`. The factory also accepts `{ fetch }` for simulated transport tests. Direct invocation and AI SDK invocation validate trimmed queries of 1–300 characters.

Each instance has a two-request lifetime budget, including failed provider attempts. Calls beyond that budget return `budget_exhausted`. Create a fresh instance for an independent budget. Requests use Tavily basic search without retries and are aborted after ten seconds, including response-body reading. Bodies are limited to 128 KiB. The tool returns up to five distinct HTTP(S) sources, with titles up to 200 characters, URLs up to 2,048 characters, snippets up to 1,000 characters, and a `publishedDate` string or null. Result URLs are not fetched.

Results contain the trimmed `query`, a `results` array, and one of these statuses:

- `ok`: usable sources with `title`, `url`, `snippet`, and `publishedDate`.
- `empty`: a valid provider result array with no usable sources.
- `error`: no sources, with a safe `code` and fixed `message`. Codes cover `missing_credential`, `timeout`, `authentication`, `rate_limit` (including quota), `network`, `invalid_response` (including oversized bodies), and `provider`.
- `budget_exhausted`: no request or sources because the instance used its two attempts.

Invalid queries throw validation errors before a request. Provider failures return explicit outcomes instead of throwing raw errors. Authorization credentials and raw provider errors are excluded from tool results. Explicit invocation sends the caller's query to Tavily and can incur provider costs; snippets and dates are external evidence, not guarantees of accuracy or instructions to follow. Tests simulate transport and establish tool behavior rather than live search relevance. Agent integration requires a separate change.
