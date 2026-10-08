import { evaluateJobDescription, type GuardrailClient } from '../../src/agent/guardrails.js';
import type { GuardrailCase } from './fixtures.js';
import { createMockGuardrailClient } from './mocks.js';

type CaseDetails = { id: string; category: string; expectedAccepted: boolean };
export type GuardrailOutput = CaseDetails & (
  | { status: 'decision'; probability: number; accepted: boolean; model?: string; error: null }
  | { status: 'error'; probability: null; accepted: null; error: string }
);

export async function executeGuardrailCase(
  fixture: GuardrailCase,
  mock: boolean,
  client?: GuardrailClient,
): Promise<GuardrailOutput> {
  const details = { id: fixture.id, category: fixture.category, expectedAccepted: fixture.expectedAccepted };
  try {
    const result = await evaluateJobDescription(fixture.text,
      client ?? (mock ? createMockGuardrailClient(fixture.mockProbability) : undefined));
    return { ...details, status: 'decision', ...result, error: null };
  } catch (error) {
    return { ...details, status: 'error', probability: null, accepted: null,
      error: error instanceof Error ? error.message : String(error) };
  }
}
