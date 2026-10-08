import { pathToFileURL } from 'node:url';
import type { evaluate } from '@lmnr-ai/lmnr';
import { GUARDRAIL_THRESHOLD } from '../../src/agent/guardrails.js';
import { guardrailFixtures, type GuardrailCase } from './fixtures.js';
import { executeGuardrailCase, type GuardrailOutput } from './executor.js';
import { guardrailEvaluators, summarizeGuardrails } from './evaluators.js';

export type EvaluationRequest = Parameters<typeof evaluate<GuardrailCase, boolean, GuardrailOutput>>[0];
export type Reporter = {
  initialize: (options: { projectApiKey: string; instrumentModules: Record<string, never> }) => void;
  evaluate: (options: EvaluationRequest) => Promise<{ url: string; errorMessage?: string } | undefined>;
  shutdown: () => Promise<void>;
};

async function loadLaminar(): Promise<Reporter> {
  const { Laminar, evaluate } = await import('@lmnr-ai/lmnr');
  return { initialize: (options) => Laminar.initialize(options),
    evaluate: (options) => evaluate(options), shutdown: () => Laminar.shutdown() };
}

export async function runGuardrailEvaluation(args: string[], dependencies: {
  env?: NodeJS.ProcessEnv;
  cases?: GuardrailCase[];
  execute?: typeof executeGuardrailCase;
  loadReporter?: () => Promise<Reporter>;
  console?: Pick<Console, 'log' | 'table'>;
} = {}): Promise<number> {
  if (args.some((arg) => arg !== '--mock' && arg !== '--local')) throw new Error('Supported options: --mock, --local');
  const mock = args.includes('--mock');
  const local = args.includes('--local');
  if (local && !mock) throw new Error('Use --mock with --local for offline evaluation.');
  const env = dependencies.env ?? process.env;
  if (!local && !mock && !env.TYPESAFE_API_KEY?.trim()) throw new Error('Missing TYPESAFE_API_KEY. Live guardrail evaluation requires TypeSafe Jev.');
  if (!local && !env.LMNR_PROJECT_API_KEY?.trim()) throw new Error('Missing LMNR_PROJECT_API_KEY. Configure Laminar or run pnpm eval:guardrails:local.');
  const cases = dependencies.cases ?? guardrailFixtures;
  const execute = dependencies.execute ?? executeGuardrailCase;
  const out = dependencies.console ?? console;
  const mode = mock ? 'mock' : 'live';
  const outputs = new Map<string, GuardrailOutput>();
  const executor = async (fixture: GuardrailCase) => {
    const result = await execute(fixture, mock);
    outputs.set(fixture.id, result);
    return result;
  };
  out.log(`Guardrail evaluation mode: ${mode}${mock ? ' (workflow verification; does not measure Jev quality)' : ''}`);
  let url: string | undefined;
  if (local) {
    for (const fixture of cases) await executor(fixture);
  } else {
    const reporter = await (dependencies.loadReporter ?? loadLaminar)();
    try {
      reporter.initialize({ projectApiKey: env.LMNR_PROJECT_API_KEY!, instrumentModules: {} });
      const result = await reporter.evaluate({
        name: `job-description-guardrails-${mode}`, groupName: `job-description-guardrails-${mode}`,
        data: cases.map((fixture) => ({ data: fixture, target: fixture.expectedAccepted,
          metadata: { case: fixture.id, category: fixture.category, expectedAccepted: fixture.expectedAccepted,
            mode, threshold: GUARDRAIL_THRESHOLD } })),
        executor, evaluators: guardrailEvaluators,
        metadata: { mode, threshold: GUARDRAIL_THRESHOLD, model: mock ? 'jev-mock' : env.TYPESAFE_DEFAULT_MODEL ?? 'jev-latest' },
        config: { projectApiKey: env.LMNR_PROJECT_API_KEY!, concurrencyLimit: 2, instrumentModules: {} },
      });
      if (!result || result.errorMessage || !result.url) throw new Error(`Laminar reporting failed: ${result?.errorMessage ?? 'no evaluation results returned'}`);
      url = result.url;
    } finally {
      await reporter.shutdown();
    }
  }
  if (outputs.size !== cases.length) throw new Error('Evaluation did not return a result for every case.');
  const results = cases.map((fixture) => outputs.get(fixture.id)!);
  out.table(results.map((result) => ({ case: result.id, category: result.category,
    expected: result.expectedAccepted ? 'accept' : 'reject',
    actual: result.accepted === null ? 'error' : result.accepted ? 'accept' : 'reject',
    probability: result.probability, model: result.status === 'decision' ? result.model : null,
    correct: guardrailEvaluators.decision_correct(result), error: result.error })));
  const summary = summarizeGuardrails(results);
  out.table([{ ...summary, accuracy: summary.accuracy ?? 'N/A',
    falseAcceptRate: summary.falseAcceptRate ?? 'N/A', falseRejectRate: summary.falseRejectRate ?? 'N/A' }]);
  if (url) out.log(`Laminar results: ${url}`);
  return summary.falseAccepts + summary.falseRejects + summary.errors > 0 ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runGuardrailEvaluation(process.argv.slice(2)).then((code) => { process.exitCode = code; }).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
