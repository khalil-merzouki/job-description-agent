import { TypeSafeClient } from '@typesafe-ai/sdk';

/** Exercise the TypeSafe SDK without external requests. */
export function createMockGuardrailClient(probability = 1) {
  return new TypeSafeClient({
    apiKey: 'mock-typesafe-key',
    fetch: async () => Response.json({
      model: 'jev-mock',
      answers: { isJobDescription: { type: 'noul', noul: probability } },
      usage: { input_tokens: 0, output_tokens: 0 },
    }),
  });
}
