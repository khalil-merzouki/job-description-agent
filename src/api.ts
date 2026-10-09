import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { analyzeJobDescription, InvalidJobDescriptionError } from './agent/jobAnalyzer.js';
import { jobAnalysisSchema, type JobAnalysis } from './agent/schema.js';

const MAX_BODY = 100_000;

type Analyze = (description: string) => Promise<JobAnalysis>;

function reply(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  response.end(JSON.stringify(body));
}

function authorized(header: string | undefined, token: string): boolean {
  const expected = Buffer.from(`Bearer ${token}`);
  const actual = Buffer.from(header ?? '');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

async function readDescription(request: IncomingMessage): Promise<string> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY) throw new Error('invalid_request');
    chunks.push(chunk);
  }
  const body: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('invalid_request');
  const description = (body as Record<string, unknown>).description;
  if (typeof description !== 'string' || description.trim().length < 100 || description.length > 50_000) throw new Error('invalid_request');
  return description;
}

export function createApi(token: string, analyze: Analyze = async (description) =>
  (await analyzeJobDescription(description, { saveFile: false })).analysis) {
  if (!token) throw new Error('JOB_AGENT_TOKEN must be configured.');
  return createServer(async (request, response) => {
    if (request.url === '/health' && request.method === 'GET') return reply(response, 200, { status: 'ok' });
    if (request.url !== '/analyze' || request.method !== 'POST') return reply(response, 404, { message: 'Not found.' });
    if (!authorized(request.headers.authorization, token)) return reply(response, 401, { message: 'Unauthorized.' });
    if (!request.headers['content-type']?.startsWith('application/json')) return reply(response, 400, { message: 'Invalid request.' });
    try {
      const description = await readDescription(request);
      const analysis = jobAnalysisSchema.parse(await analyze(description));
      return reply(response, 200, analysis);
    } catch (error) {
      if (error instanceof InvalidJobDescriptionError) return reply(response, 422, { message: error.message });
      if (error instanceof Error && (error.message === 'invalid_request' || error instanceof SyntaxError)) return reply(response, 400, { message: 'Invalid request.' });
      return reply(response, 503, { message: 'Job analysis is unavailable.' });
    }
  });
}

if (process.argv[1]?.endsWith('/api.ts')) {
  const token = process.env.JOB_AGENT_TOKEN;
  if (!token || !process.env.OPENAI_API_KEY || !process.env.TYPESAFE_API_KEY) {
    console.error('JOB_AGENT_TOKEN, OPENAI_API_KEY, and TYPESAFE_API_KEY are required.');
    process.exit(1);
  }
  const host = process.env.JOB_AGENT_HOST ?? '127.0.0.1';
  const port = Number(process.env.JOB_AGENT_PORT ?? 3002);
  createApi(token).listen(port, host, () => console.log(`Job description agent listening on ${host}:${port}`));
}
