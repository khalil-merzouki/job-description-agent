# Job description agent

Install with `pnpm install`, copy `.env.example` to `.env`, configure OpenAI and `OUTPUT_DIR`, then run `pnpm start`.
Requires Node.js 22.12 or later.

## Evaluating with Laminar

Set `LMNR_PROJECT_API_KEY` in `.env` to a project key from [Laminar](https://laminar.sh).
The evaluation runner uses the [Laminar TypeScript SDK](https://github.com/lmnr-ai/lmnr-ts) and registers its AI SDK telemetry integration to trace model steps and tool calls. It prints a link to the evaluation results when finished.

| Command | Model | Results |
| --- | --- | --- |
| `pnpm eval` | Real OpenAI model; requires `OPENAI_API_KEY` | Uploaded to Laminar |
| `pnpm eval:mock` | Deterministic mocked model; no OpenAI key needed | Uploaded to Laminar |
| `pnpm eval:local` | Deterministic mocked model; no keys or network needed | Console score table |
| `pnpm test` | Mock workflow and scorer regression tests | Local test results |
| `pnpm typecheck` | Type checks application and evaluation code | Local diagnostics |

Every evaluation uses a fresh in-memory `writeFile` tool, so it captures writes without modifying `output/` or requiring `OUTPUT_DIR`. Live evaluation makes paid OpenAI calls and sends the synthetic descriptions, responses, file contents and scores to Laminar.

`evals/fixtures.ts` contains four synthetic cases: an explicit annual salary, a French description with an estimated salary, missing facts, and an hourly contract. Add cases with the description, expected analysis, and mock file name. The expected analysis is a reference answer; live agents only receive the description.

Scores range from 0 to 1:

- `schema_valid`: response matches the Zod schema.
- `facts_accuracy`: case-insensitive factual matches and exact normalized skill sets, including absent facts. Descriptive prose is not compared.
- `salary_correct`: stated amounts, currency and period are preserved; estimates have an explained positive annual range. This checks estimate handling, not market accuracy.
- `file_workflow`: exactly one write, correct kebab-case company/title filename, valid pretty-printed JSON matching the final response and returned path.

Mock scores validate the evaluation wiring and tool loop; run `pnpm eval` to measure model extraction quality. Mock and live runs use separate Laminar groups. Tests include intentionally wrong facts, salaries and file writes so broken scorers cannot pass solely by replaying reference answers.
