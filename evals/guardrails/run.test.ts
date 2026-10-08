import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runGuardrailEvaluation, type Reporter, type EvaluationRequest } from './run.js';
import { guardrailFixtures } from './fixtures.js';
import { executeGuardrailCase } from './executor.js';

function capture() {
  const logs: string[] = [];
  const tables: unknown[] = [];
  return { logs, tables, console: { log: (value: string) => { logs.push(value); },
    table: (value: unknown) => { tables.push(value); } } };
}

test('offline suite needs no keys, reporter, network, or output directory', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('Unexpected network request'); });
  const output = capture();
  assert.equal(await runGuardrailEvaluation(['--mock', '--local'], { env: {}, console: output.console,
    loadReporter: async () => { throw new Error('Reporter must not load'); } }), 0);
  assert.equal(output.tables.length, 2);
  assert.equal((output.tables[0] as unknown[]).length, 12);
  assert.match(output.logs[0]!, /mock.*does not measure Jev quality/);
});

test('invalid options and missing credentials fail before external work', async () => {
  const dependencies = { env: {}, loadReporter: async (): Promise<Reporter> => { throw new Error('Unexpected reporter'); } };
  await assert.rejects(runGuardrailEvaluation(['--other'], dependencies), /Supported options/);
  await assert.rejects(runGuardrailEvaluation(['--local'], dependencies), /Use --mock/);
  await assert.rejects(runGuardrailEvaluation([], dependencies), /Missing TYPESAFE_API_KEY/);
  await assert.rejects(runGuardrailEvaluation([], { ...dependencies, env: { TYPESAFE_API_KEY: 'test' } }), /Missing LMNR_PROJECT_API_KEY/);
  await assert.rejects(runGuardrailEvaluation(['--mock'], dependencies), /Missing LMNR_PROJECT_API_KEY/);
});

test('mistakes and operational errors return nonzero after printing all cases and summary', async () => {
  const output = capture();
  const cases = [guardrailFixtures[0]!, { ...guardrailFixtures[6]!, mockProbability: 1 }, guardrailFixtures[7]!];
  const code = await runGuardrailEvaluation(['--mock', '--local'], { env: {}, cases, console: output.console,
    execute: async (fixture, mock) => fixture.id === cases[2]!.id
      ? { id: fixture.id, category: fixture.category, expectedAccepted: fixture.expectedAccepted,
        status: 'error', accepted: null, probability: null, error: 'Service failed' }
      : executeGuardrailCase(fixture, mock) });
  assert.equal(code, 1);
  assert.equal((output.tables[0] as unknown[]).length, 3);
  const summary = (output.tables[1] as { falseAccepts: number; errors: number; falseAcceptRate: number }[])[0]!;
  assert.equal(summary.falseAccepts, 1);
  assert.equal(summary.errors, 1);
  assert.equal(summary.falseAcceptRate, 1 / 2);
});

for (const mock of [true, false]) {
  test(`reported ${mock ? 'mock' : 'live'} mode separates runs and retains case scores and metadata`, async () => {
    const output = capture();
    const cases = [guardrailFixtures[0]!, { ...guardrailFixtures[6]!, mockProbability: 1 }, guardrailFixtures[7]!];
    let shutdown = 0;
    const reporter: Reporter = {
      initialize: (options) => { assert.deepEqual(options, { projectApiKey: 'laminar-test', instrumentModules: {} }); },
      evaluate: async (options: EvaluationRequest) => {
        assert.equal(options.name, `job-description-guardrails-${mock ? 'mock' : 'live'}`);
        assert.equal(options.groupName, options.name);
        assert.equal(options.metadata?.mode, mock ? 'mock' : 'live');
        assert.equal(options.metadata?.threshold, 0.5);
        assert.equal(options.config?.concurrencyLimit, 2);
        assert.ok(Array.isArray(options.data));
        for (const datum of options.data) {
          assert.equal(datum.target, datum.data.expectedAccepted);
          assert.equal(datum.metadata?.category, datum.data.category);
          assert.equal(datum.metadata?.mode, mock ? 'mock' : 'live');
          assert.equal(datum.metadata?.threshold, 0.5);
          const result = await options.executor(datum.data);
          assert.equal(result.id, datum.data.id);
          assert.equal(result.expectedAccepted, datum.target);
          if (result.status === 'decision') {
            assert.equal(result.model, 'jev-mock');
            assert.equal(result.probability, datum.data.mockProbability);
          } else {
            assert.equal(result.probability, null);
            assert.equal(result.accepted, null);
          }
          // Validate the exact functions passed to the reporting adapter.
          const scores: Record<string, unknown> = {};
          for (const [name, evaluator] of Object.entries(options.evaluators)) {
            assert.equal(typeof evaluator, 'function');
            if (typeof evaluator === 'function') scores[name] = await evaluator(result, datum.target, datum.data);
          }
          assert.equal(scores.decision_correct, datum.data.id === cases[0]!.id ? 1 : 0);
          assert.equal(scores.false_accept, datum.data.id === cases[1]!.id ? 1 : 0);
          assert.equal(scores.validation_error, datum.data.id === cases[2]!.id ? 1 : 0);
        }
        return { url: 'https://laminar.example/evaluation/test' };
      }, shutdown: async () => { shutdown++; },
    };
    const code = await runGuardrailEvaluation(mock ? ['--mock'] : [], {
      env: { LMNR_PROJECT_API_KEY: 'laminar-test', ...(mock ? {} : { TYPESAFE_API_KEY: 'typesafe-test' }) },
      cases, console: output.console, loadReporter: async () => reporter,
      execute: async (fixture, isMock) => {
        assert.equal(isMock, mock);
        return fixture.id === cases[2]!.id
          ? { id: fixture.id, category: fixture.category, expectedAccepted: fixture.expectedAccepted,
            status: 'error', probability: null, accepted: null, error: 'Unavailable' }
          : executeGuardrailCase(fixture, true);
      },
    });
    assert.equal(code, 1);
    assert.equal(shutdown, 1);
    assert.ok(output.logs.some((log) => log.includes('Laminar results: https://laminar.example/evaluation/test')));
    assert.equal((output.tables[1] as { falseAcceptRate: number }[])[0]!.falseAcceptRate, 1 / 2);
  });
}

for (const failure of ['initialize', 'evaluate', 'returned-error', 'missing-result', 'missing-cases']) {
  test(`reporting failure ${failure} is surfaced and shuts down`, async () => {
    let shutdown = 0;
    const reporter: Reporter = {
      initialize: () => { if (failure === 'initialize') throw new Error('Initialization failed'); },
      evaluate: async () => {
        if (failure === 'evaluate') throw new Error('Upload failed');
        if (failure === 'returned-error') return { url: '', errorMessage: 'Reporting unavailable' };
        if (failure === 'missing-result') return undefined;
        return { url: 'https://laminar.example/test' };
      }, shutdown: async () => { shutdown++; },
    };
    await assert.rejects(runGuardrailEvaluation(['--mock'], {
      env: { LMNR_PROJECT_API_KEY: 'test' }, console: capture().console,
      loadReporter: async () => reporter,
    }), /failed|unavailable|results|every case/i);
    assert.equal(shutdown, 1);
  });
}
