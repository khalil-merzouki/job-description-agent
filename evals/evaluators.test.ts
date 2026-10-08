import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fixtures } from './fixtures.js';
import { executeCase, type EvalOutput } from './executor.js';
import { evaluators } from './evaluators.js';
import { analyzeJobDescription, InvalidJobDescriptionError } from '../src/agent/jobAnalyzer.js';
import { createMockFileTool, createMockModel, createMockGuardrailClient } from './mocks.js';
import { TypeSafeClient } from '@typesafe-ai/sdk';

for (const fixture of fixtures) {
  test(`mock agent workflow: ${fixture.id}`, async () => {
    const output = await executeCase(fixture, true);
    assert.deepEqual(output.analysis, fixture.expected);
    for (const [name, score] of Object.entries(evaluators)) assert.equal(score(output, fixture.expected), 1, name);
  });
}

test('provider receives the job and continues with the tool result', async () => {
  const fixture = fixtures[0]!;
  const model = createMockModel(fixture);
  const fileTool = createMockFileTool();
  await analyzeJobDescription(fixture.jobDescription, { model, writeFileTool: fileTool.tool, guardrailClient: createMockGuardrailClient(0.51) });
  assert.equal(model.doGenerateCalls.length, 2);
  assert.match(JSON.stringify(model.doGenerateCalls[0]!.prompt), /Acme is hiring/);
  assert.match(JSON.stringify(model.doGenerateCalls[1]!.prompt), /\/mock-output\/acme-senior-frontend-engineer.json/);
});

for (const probability of [0, 0.1, 0.5]) {
  test(`guardrail rejects non-job text at probability ${probability} without analysis or writes`, async () => {
    const model = createMockModel(fixtures[0]!);
    const fileTool = createMockFileTool();
    await assert.rejects(analyzeJobDescription('Hello world', {
      model, writeFileTool: fileTool.tool,
      guardrailClient: createMockGuardrailClient(probability),
    }), InvalidJobDescriptionError);
    assert.equal(model.doGenerateCalls.length, 0);
    assert.equal(fileTool.writes.length, 0);
  });
}

test('guardrail sends the input to Jev and blocks analysis when validation is unavailable', async () => {
  const model = createMockModel(fixtures[0]!);
  const fileTool = createMockFileTool();
  const client = new TypeSafeClient({
    apiKey: 'mock-typesafe-key', retry: { maxRetries: 0 },
    fetch: async (_url, init) => {
      const request = JSON.parse(String(init?.body));
      assert.deepEqual(request.state, { document: 'Hello world' });
      assert.equal(request.questions.isJobDescription.type, 'noul');
      assert.match(request.questions.isJobDescription.instructions, /job posting/);
      return Response.json({ error: 'Unavailable' }, { status: 503 });
    },
  });
  await assert.rejects(analyzeJobDescription('Hello world', {
    model, writeFileTool: fileTool.tool, guardrailClient: client,
  }));
  assert.equal(model.doGenerateCalls.length, 0);
  assert.equal(fileTool.writes.length, 0);
});

test('scorers reject hallucinated facts and incorrect salary handling', async () => {
  const fixture = fixtures[2]!;
  const output = await executeCase(fixture, true);
  const hallucinated = structuredClone(output);
  hallucinated.analysis.company = 'Invented Corp';
  hallucinated.analysis.requirements.yearsOfExperience = 10;
  assert.ok(evaluators.facts_accuracy(hallucinated, fixture.expected) < 1);
  const invalidSalary = structuredClone(output);
  invalidSalary.analysis.salary.isEstimated = false;
  assert.equal(evaluators.salary_correct(invalidSalary, fixture.expected), 0);
  invalidSalary.analysis.salary.isEstimated = true;
  invalidSalary.analysis.salary.max = 1;
  assert.equal(evaluators.salary_correct(invalidSalary, fixture.expected), 0);
  invalidSalary.analysis.salary.max = 60000;
  invalidSalary.analysis.salary.min = 40000;
  assert.equal(evaluators.salary_correct(invalidSalary, fixture.expected), 1);
  invalidSalary.analysis.salary.reasoning = '';
  assert.equal(evaluators.salary_correct(invalidSalary, fixture.expected), 0);
});

test('stated hourly salary must keep its amounts and period', async () => {
  const fixture = fixtures[3]!;
  const output = await executeCase(fixture, true);
  output.analysis.salary.period = 'year';
  assert.equal(evaluators.salary_correct(output, fixture.expected), 0);
  output.analysis.salary.period = 'hour';
  output.analysis.salary.max = 120;
  assert.equal(evaluators.salary_correct(output, fixture.expected), 0);
});

test('file scorer rejects missing, duplicate, malformed, inconsistent and unsafe writes', async () => {
  const good = await executeCase(fixtures[0]!, true);
  const variants: EvalOutput[] = [
    { ...good, writes: [] },
    { ...good, writes: [...good.writes, ...good.writes] },
    { ...good, filePath: null },
    { ...good, writes: [{ ...good.writes[0]!, content: '{broken' }] },
    { ...good, writes: [{ ...good.writes[0]!, content: JSON.stringify({ ...good.analysis, company: 'Other' }, null, 2) }] },
    { ...good, writes: [{ ...good.writes[0]!, content: JSON.stringify(good.analysis) }] },
    { ...good, writes: [{ ...good.writes[0]!, fileName: '../../escape.json' }] },
    { ...good, writes: [{ ...good.writes[0]!, fileName: 'wrong-name.json' }] },
  ];
  for (const output of variants) assert.equal(evaluators.file_workflow(output), 0);
});

test('mock file tools isolate concurrent evaluations', async () => {
  const outputs = await Promise.all(fixtures.map((fixture) => executeCase(fixture, true)));
  outputs.forEach((output, index) => {
    assert.equal(output.writes.length, 1);
    assert.equal(output.writes[0]!.fileName, fixtures[index]!.fileName);
  });
});

test('invalid structured output scores zero', async () => {
  const output = await executeCase(fixtures[0]!, true);
  const invalid = { ...output, analysis: {} } as EvalOutput;
  for (const score of Object.values(evaluators)) assert.equal(score(invalid, fixtures[0]!.expected), 0);
});
