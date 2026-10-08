import { registerTelemetry } from 'ai';
import { fixtures } from './fixtures.js';
import { executeCase } from './executor.js';
import { evaluators } from './evaluators.js';

async function main() {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== '--mock' && arg !== '--local')) throw new Error('Supported options: --mock, --local');
  const mock = args.includes('--mock');
  const local = args.includes('--local');
  if (local && !mock) throw new Error('Use --mock with --local for offline evaluation.');

  if (local) {
    const rows = [];
    for (const fixture of fixtures) {
      const output = await executeCase(fixture, true);
      const scores = Object.fromEntries(Object.entries(evaluators).map(([name, score]) => [name, score(output, fixture.expected)]));
      rows.push({ case: fixture.id, ...scores });
      if (Object.values(scores).some((score) => score !== 1)) process.exitCode = 1;
    }
    console.table(rows);
    return;
  }

  const projectApiKey = process.env.LMNR_PROJECT_API_KEY;
  if (!projectApiKey) throw new Error('Missing LMNR_PROJECT_API_KEY. Add your Laminar project key to .env, or run pnpm eval:local.');
  if (!mock && !process.env.OPENAI_API_KEY) throw new Error('Missing OPENAI_API_KEY. Live evaluation requires OpenAI, or use pnpm eval:mock.');

  const { evaluate, Laminar, LaminarAiSdkTelemetry } = await import('@lmnr-ai/lmnr');
  Laminar.initialize({ projectApiKey, instrumentModules: {} });
  registerTelemetry(new LaminarAiSdkTelemetry({ createStepSpan: true }));
  try {
    const result = await evaluate({
      name: `job-description-agent-${mock ? 'mock' : 'live'}`,
      groupName: `job-description-agent-${mock ? 'mock' : 'live'}`,
      data: fixtures.map((fixture) => ({ data: fixture, target: fixture.expected, metadata: { case: fixture.id } })),
      executor: (fixture) => executeCase(fixture, mock),
      evaluators,
      metadata: { mode: mock ? 'mock' : 'live', fileTool: 'in-memory', model: mock ? 'mock' : process.env.OPENAI_MODEL ?? 'gpt-6-luna' },
      config: { projectApiKey, concurrencyLimit: 2, instrumentModules: {} },
    });
    if (result?.errorMessage) throw new Error(result.errorMessage);
    if (result) {
      console.table(result.averageScores);
      console.log(`Laminar results: ${result.url}`);
    }
  } finally {
    await Laminar.shutdown();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
