import assert from 'node:assert/strict';
import { once } from 'node:events';
import { after, before, test } from 'node:test';
import { createApi } from './api.js';
import type { JobAnalysis } from './agent/schema.js';

const analysis: JobAnalysis = {
  jobTitle: 'Engineer', company: 'Acme', seniority: 'mid',
  contract: { type: 'full-time', details: null },
  location: { city: null, country: null, workMode: 'remote', details: null },
  salary: { min: 50000, max: 70000, currency: 'EUR', period: 'year', isEstimated: true, reasoning: 'Estimate' },
  requirements: { yearsOfExperience: 2, education: null, mustHaveSkills: ['TypeScript'], niceToHaveSkills: [], softSkills: [], languages: [] },
  responsibilities: [], benefits: [], summary: 'An engineering role.',
};
let calls = 0;
const server = createApi('test-token', async () => { calls++; return analysis; });
let base: string;
before(async () => {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No listener');
  base = `http://127.0.0.1:${address.port}`;
});
after(() => server.close());

test('authorized analysis returns validated JSON without file writes', async () => {
  const response = await fetch(`${base}/analyze`, { method: 'POST', headers: { authorization: 'Bearer test-token', 'content-type': 'application/json' }, body: JSON.stringify({ description: 'A'.repeat(100) }) });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), analysis);
  assert.equal(calls, 1);
});
test('rejects missing authorization and invalid descriptions', async () => {
  const unauthorized = await fetch(`${base}/analyze`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ description: 'A'.repeat(100) }) });
  assert.equal(unauthorized.status, 401);
  const invalid = await fetch(`${base}/analyze`, { method: 'POST', headers: { authorization: 'Bearer test-token', 'content-type': 'application/json' }, body: JSON.stringify({ description: 'short' }) });
  assert.equal(invalid.status, 400);
  assert.equal(calls, 1);
});
