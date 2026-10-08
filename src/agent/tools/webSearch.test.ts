import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createWebSearchTool, webSearchInputSchema } from './webSearch.js';

async function invoke(tool: ReturnType<typeof createWebSearchTool>, query = 'sample query') {
  const result = await tool.execute!({ query }, { toolCallId: 'test', messages: [], context: {} });
  if (Symbol.asyncIterator in result) throw new Error('Expected a single tool result');
  return result;
}

test('schema trims queries, accepts bounds, and rejects invalid inputs without transport', async () => {
  let calls = 0;
  const tool = createWebSearchTool({ apiKey: 'test', fetch: async () => { calls++; return Response.json({ results: [] }); } });
  assert.equal(calls, 0);
  assert.deepEqual(webSearchInputSchema.parse({ query: '  sample query  ' }), { query: 'sample query' });
  assert.ok(webSearchInputSchema.safeParse({ query: 'x'.repeat(300) }).success);
  for (const query of ['', '   ', 'x'.repeat(301)]) await assert.rejects(invoke(tool, query));
  assert.equal(calls, 0);
  assert.deepEqual(await invoke(tool, '  sample query  '), { status: 'empty', query: 'sample query', results: [] });
  assert.equal(calls, 1);
});

test('construction needs no credential; explicit blank key causes no request', async () => {
  let calls = 0;
  const tool = createWebSearchTool({ apiKey: ' ', fetch: async () => { calls++; throw new Error('Unexpected request'); } });
  assert.equal(calls, 0);
  const result = await invoke(tool);
  assert.equal(result.status, 'error');
  if (result.status === 'error') assert.equal(result.code, 'missing_credential');
  assert.equal(calls, 0);
});

test('environment credential is read lazily at invocation', async (t) => {
  const previous = process.env.TAVILY_API_KEY;
  t.after(() => { if (previous === undefined) delete process.env.TAVILY_API_KEY; else process.env.TAVILY_API_KEY = previous; });
  process.env.TAVILY_API_KEY = 'before';
  const tool = createWebSearchTool({ fetch: async (_url, init) => {
    assert.equal((init?.headers as Record<string, string>).Authorization, 'Bearer after');
    return Response.json({ results: [] });
  } });
  process.env.TAVILY_API_KEY = 'after';
  assert.equal((await invoke(tool)).status, 'empty');
});

test('transport uses fixed options and normalizes, bounds and deduplicates results', async () => {
  let calls = 0;
  const tool = createWebSearchTool({ apiKey: 'test-secret', fetch: async (url, init) => {
    calls++;
    assert.equal(url, 'https://api.tavily.com/search');
    assert.equal(init?.method, 'POST');
    assert.deepEqual(init?.headers, { Authorization: 'Bearer test-secret', 'Content-Type': 'application/json' });
    assert.deepEqual(JSON.parse(String(init?.body)), { query: 'sample query', search_depth: 'basic', topic: 'general',
      max_results: 5, auto_parameters: false, include_answer: false, include_raw_content: false, include_images: false });
    return Response.json({ results: [
      { title: 'T'.repeat(250), url: 'HTTPS://EXAMPLE.COM/a#section', content: 'C'.repeat(1500), published_date: '2026-10-01' },
      { title: 'Duplicate', url: 'https://example.com/a#other', content: 'duplicate' },
      { title: 'Bad', url: 'javascript:alert(1)', content: 'bad' },
      { title: 'Bad', url: 'not a url', content: 'bad' },
      { title: 'Bad', url: 'https://example.com/' + 'x'.repeat(2050), content: 'bad' },
      { title: 'Bad', url: 'https://user:password@example.com/', content: 'bad' },
      { title: 'Missing content', url: 'https://example.com/missing' },
      { title: ' ', url: 'https://example.com/blank', content: 'valid' },
      ...Array.from({ length: 6 }, (_, i) => ({ title: `Title ${i}`, url: `https://example.com/${i}`,
        content: `Snippet ${i}`, published_date: i === 0 ? 'not-a-date' : null })),
    ] });
  } });
  const result = await invoke(tool);
  assert.equal(result.status, 'ok');
  assert.equal(calls, 1);
  assert.equal(result.results.length, 5);
  assert.deepEqual(result.results[0], { title: 'T'.repeat(200), url: 'https://example.com/a',
    snippet: 'C'.repeat(1000), publishedDate: '2026-10-01' });
  assert.equal(result.results[1]!.publishedDate, null);
  assert.equal(result.results[2]!.publishedDate, null);
});

for (const results of [[], [null, { title: 'Incomplete' }]]) {
  test('valid result array without usable entries yields empty', async () => {
    const tool = createWebSearchTool({ apiKey: 'test', fetch: async () => Response.json({ results }) });
    assert.equal((await invoke(tool)).status, 'empty');
  });
}

for (const [status, code] of [[401, 'authentication'], [403, 'authentication'], [429, 'rate_limit'],
  [432, 'rate_limit'], [433, 'rate_limit'], [500, 'provider']] as const) {
  test(`HTTP ${status} gives a safe ${code} error without retries`, async () => {
    let calls = 0;
    const tool = createWebSearchTool({ apiKey: 'test-secret', fetch: async () => {
      calls++;
      return new Response('provider-secret-details and test-secret', { status });
    } });
    const result = await invoke(tool);
    assert.equal(result.status, 'error');
    if (result.status === 'error') assert.equal(result.code, code);
    assert.deepEqual(result.results, []);
    assert.doesNotMatch(JSON.stringify(result), /test-secret|provider-secret-details/);
    assert.equal(calls, 1);
  });
}

test('network exceptions are not echoed', async () => {
  const tool = createWebSearchTool({ apiKey: 'test', fetch: async () => { throw new Error('secret exception details'); } });
  const result = await invoke(tool);
  assert.equal(result.status, 'error');
  if (result.status === 'error') assert.equal(result.code, 'network');
  assert.doesNotMatch(JSON.stringify(result), /secret exception/);
});

for (const response of ['not-json', '{}', '{"results":null}', '{"results":{}}']) {
  test(`malformed response ${response} returns invalid_response`, async () => {
    const tool = createWebSearchTool({ apiKey: 'test', fetch: async () => new Response(response) });
    const result = await invoke(tool);
    assert.equal(result.status, 'error');
    if (result.status === 'error') assert.equal(result.code, 'invalid_response');
  });
}

test('parallel invocations share two attempts and new instances have independent budgets', async () => {
  let calls = 0;
  const fetch: typeof globalThis.fetch = async () => { calls++; return Response.json({ results: [] }); };
  const tool = createWebSearchTool({ apiKey: 'test', fetch });
  const results = await Promise.all([invoke(tool), invoke(tool), invoke(tool)]);
  assert.deepEqual(results.map((result) => result.status), ['empty', 'empty', 'budget_exhausted']);
  assert.equal(calls, 2);
  assert.equal((await invoke(tool)).status, 'budget_exhausted');
  assert.equal(calls, 2);
  assert.equal((await invoke(createWebSearchTool({ apiKey: 'test', fetch }))).status, 'empty');
  assert.equal(calls, 3);
});

test('failed requests consume the budget, while invalid queries and missing keys do not', async (t) => {
  const previous = process.env.TAVILY_API_KEY;
  t.after(() => { if (previous === undefined) delete process.env.TAVILY_API_KEY; else process.env.TAVILY_API_KEY = previous; });
  delete process.env.TAVILY_API_KEY;
  let calls = 0;
  const tool = createWebSearchTool({ fetch: async () => { calls++; throw new Error('connection failed'); } });
  for (let i = 0; i < 3; i++) assert.equal((await invoke(tool)).status, 'error');
  await assert.rejects(invoke(tool, ' '));
  process.env.TAVILY_API_KEY = 'test';
  assert.equal((await invoke(tool)).status, 'error');
  assert.equal((await invoke(tool)).status, 'error');
  assert.equal((await invoke(tool)).status, 'budget_exhausted');
  assert.equal(calls, 2);
});

test('request deadline aborts at ten seconds without waiting in real time', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let signal: AbortSignal | undefined;
  const tool = createWebSearchTool({ apiKey: 'test', fetch: async (_url, init) => {
    signal = init!.signal!;
    return new Promise<Response>((_resolve, reject) => signal!.addEventListener('abort', () => reject(signal!.reason), { once: true }));
  } });
  const pending = invoke(tool);
  t.mock.timers.tick(9999);
  assert.equal(signal!.aborted, false);
  t.mock.timers.tick(1);
  const result = await pending;
  assert.equal(signal!.aborted, true);
  assert.equal(result.status, 'error');
  if (result.status === 'error') assert.equal(result.code, 'timeout');
});

test('deadline includes body consumption and cancels a stalled stream', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let started!: () => void;
  const reading = new Promise<void>((resolve) => { started = resolve; });
  let cancelled = false;
  const tool = createWebSearchTool({ apiKey: 'test', fetch: async () => new Response(new ReadableStream({
    pull() { started(); }, cancel() { cancelled = true; },
  }, { highWaterMark: 0 })) });
  const pending = invoke(tool);
  await reading;
  t.mock.timers.tick(10_000);
  const result = await pending;
  assert.equal(cancelled, true);
  assert.equal(result.status, 'error');
  if (result.status === 'error') assert.equal(result.code, 'timeout');
});

for (const failure of [false, true]) {
  test(`deadline timer is cleared after ${failure ? 'provider error' : 'success'}`, async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    let signal: AbortSignal | undefined;
    const tool = createWebSearchTool({ apiKey: 'test', fetch: async (_url, init) => {
      signal = init!.signal!;
      return failure ? new Response('secret', { status: 500 }) : Response.json({ results: [] });
    } });
    await invoke(tool);
    t.mock.timers.tick(10_000);
    assert.equal(signal!.aborted, false);
  });
}

test('body byte limit accepts the boundary and cancels oversized streamed responses', async () => {
  const validBody = JSON.stringify({ results: [] }).padEnd(128 * 1024, ' ');
  assert.equal((await invoke(createWebSearchTool({ apiKey: 'test', fetch: async () => new Response(validBody) }))).status, 'empty');
  let cancelled = false;
  let chunks = 0;
  const tool = createWebSearchTool({ apiKey: 'test', fetch: async () => new Response(new ReadableStream({
    pull(controller) { controller.enqueue(new Uint8Array(++chunks <= 2 ? 64 * 1024 : 1)); },
    cancel() { cancelled = true; },
  }, { highWaterMark: 0 })) });
  const result = await invoke(tool);
  assert.equal(result.status, 'error');
  if (result.status === 'error') assert.equal(result.code, 'invalid_response');
  assert.equal(cancelled, true);
  assert.equal(chunks, 3);
  const multibyte = await invoke(createWebSearchTool({ apiKey: 'test', fetch: async () => new Response('€'.repeat(50_000)) }));
  assert.equal(multibyte.status, 'error');
});
