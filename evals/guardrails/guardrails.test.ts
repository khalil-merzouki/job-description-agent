import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TypeSafeClient } from '@typesafe-ai/sdk';
import { evaluateJobDescription } from '../../src/agent/guardrails.js';
import { analyzeJobDescription } from '../../src/agent/jobAnalyzer.js';
import { fixtures } from '../fixtures.js';
import { createMockFileTool, createMockModel, createMockGuardrailClient } from '../mocks.js';
import { guardrailFixtures } from './fixtures.js';
import { executeGuardrailCase } from './executor.js';
import { guardrailEvaluators, summarizeGuardrails } from './evaluators.js';

test('dataset has unique labeled cases covering both classes and all categories', () => {
  assert.ok(guardrailFixtures.length >= 12);
  assert.equal(new Set(guardrailFixtures.map((f) => f.id)).size, guardrailFixtures.length);
  assert.ok(guardrailFixtures.some((f) => f.expectedAccepted));
  assert.ok(guardrailFixtures.some((f) => !f.expectedAccepted));
  for (const category of ['complete', 'sparse', 'informal', 'multilingual', 'greeting', 'source-code', 'article', 'resume', 'classification-instruction']) {
    assert.ok(guardrailFixtures.some((f) => f.category === category), category);
  }
  for (const fixture of guardrailFixtures) {
    assert.ok(fixture.text.trim());
    assert.equal(typeof fixture.expectedAccepted, 'boolean');
    assert.ok(fixture.mockProbability >= 0 && fixture.mockProbability <= 1);
  }
});

for (const probability of [0, 0.5, 0.51, 1]) {
  test(`shared guardrail boundary ${probability}`, async () => {
    const result = await evaluateJobDescription('sample', createMockGuardrailClient(probability));
    assert.equal(result.probability, probability);
    assert.equal(result.accepted, probability > 0.5);
  });
}

for (const probability of [undefined, NaN, Infinity, -0.1, 1.1, '0.9']) {
  test(`malformed probability ${String(probability)} blocks analyzer side effects`, async () => {
    const client = new TypeSafeClient({ apiKey: 'test', fetch: async () => Response.json({
      model: 'jev-test', answers: { isJobDescription: { type: 'noul', noul: probability } },
      usage: { input_tokens: 0, output_tokens: 0 },
    }) });
    const model = createMockModel(fixtures[0]!);
    const fileTool = createMockFileTool();
    await assert.rejects(analyzeJobDescription('Hello world', {
      model, writeFileTool: fileTool.tool, guardrailClient: client,
    }));
    assert.equal(model.doGenerateCalls.length, 0);
    assert.equal(fileTool.writes.length, 0);
  });
}

test('isolated executor uses probabilities rather than copying expected labels', async () => {
  for (const fixture of guardrailFixtures) {
    const output = await executeGuardrailCase(fixture, true);
    assert.equal(output.status, 'decision');
    assert.equal(output.probability, fixture.mockProbability);
    assert.equal(output.accepted, fixture.expectedAccepted);
    const inverted = await executeGuardrailCase({ ...fixture, mockProbability: fixture.expectedAccepted ? 0 : 1 }, true);
    assert.notEqual(inverted.accepted, fixture.expectedAccepted);
  }
});

test('executor records provider errors and still evaluates the next case', async () => {
  const client = new TypeSafeClient({ apiKey: 'test', retry: { maxRetries: 0 },
    fetch: async () => Response.json({ error: 'Unavailable' }, { status: 503 }) });
  const output = await executeGuardrailCase(guardrailFixtures[6]!, false, client);
  assert.equal(output.status, 'error');
  assert.equal(output.accepted, null);
  assert.equal(output.probability, null);
  assert.ok(output.error);
  assert.equal((await executeGuardrailCase(guardrailFixtures[0]!, true)).status, 'decision');
});

test('executor records malformed responses as errors', async () => {
  const client = new TypeSafeClient({ apiKey: 'test', fetch: async () => Response.json({ answers: {} }) });
  const output = await executeGuardrailCase(guardrailFixtures[0]!, false, client);
  assert.equal(output.status, 'error');
  assert.equal(output.accepted, null);
  assert.equal(output.probability, null);
});

test('scorers and summary distinguish both mistakes from operational errors', async () => {
  const valid = guardrailFixtures[0]!;
  const invalid = guardrailFixtures[6]!;
  const results = await Promise.all([
    executeGuardrailCase(valid, true), executeGuardrailCase(invalid, true),
    executeGuardrailCase({ ...valid, mockProbability: 0 }, true),
    executeGuardrailCase({ ...invalid, mockProbability: 1 }, true),
  ]);
  const failed = { id: 'failed', category: 'greeting', expectedAccepted: false,
    status: 'error' as const, probability: null, accepted: null, error: 'Unavailable' };
  results.push(failed);
  assert.deepEqual(summarizeGuardrails(results), {
    total: 5, correctAccepts: 1, correctRejects: 1, falseAccepts: 1, falseRejects: 1,
    errors: 1, accuracy: 2 / 5, falseAcceptRate: 1 / 3, falseRejectRate: 1 / 2,
  });
  assert.equal(guardrailEvaluators.decision_correct(results[0]!), 1);
  assert.equal(guardrailEvaluators.false_reject(results[2]!), 1);
  assert.equal(guardrailEvaluators.false_accept(results[3]!), 1);
  assert.equal(guardrailEvaluators.decision_correct(failed), 0);
  assert.equal(guardrailEvaluators.false_accept(failed), 0);
  assert.equal(guardrailEvaluators.false_reject(failed), 0);
  assert.equal(guardrailEvaluators.validation_error(failed), 1);
  assert.equal(summarizeGuardrails([results[0]!]).falseAcceptRate, null);
  assert.equal(summarizeGuardrails([results[1]!]).falseRejectRate, null);
  assert.equal(summarizeGuardrails([]).accuracy, null);
});
