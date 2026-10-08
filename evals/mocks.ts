import { MockLanguageModelV4 } from 'ai/test';
import path from 'node:path';
import { writeFileTool } from '../src/agent/tools/writeFile.js';
import type { EvalCase } from './fixtures.js';

export type FileWrite = { fileName: string; content: string; filePath: string };

/** A fresh tool per run prevents cross-case interference during concurrent evaluations. */
export function createMockFileTool() {
  const writes: FileWrite[] = [];
  const mockTool: typeof writeFileTool = {
    ...writeFileTool,
    execute: async ({ fileName, content }) => {
      const filePath = path.posix.join('/mock-output', path.posix.basename(fileName));
      writes.push({ fileName, content, filePath });
      return { success: true, filePath };
    },
  };
  return { tool: mockTool, writes };
}

/** Exercise the real AI SDK tool loop with deterministic provider responses. */
export function createMockModel(fixture: EvalCase) {
  const usage = {
    inputTokens: { total: 0, noCache: 0, cacheRead: undefined, cacheWrite: undefined },
    outputTokens: { total: 0, text: 0, reasoning: undefined },
  };
  return new MockLanguageModelV4({
    doGenerate: [
      {
        content: [{
          type: 'tool-call', toolCallId: 'write-1', toolName: 'writeFile',
          input: JSON.stringify({ fileName: fixture.fileName, content: JSON.stringify(fixture.expected, null, 2) }),
        }],
        finishReason: { unified: 'tool-calls', raw: undefined }, usage, warnings: [],
      },
      {
        content: [{ type: 'text', text: JSON.stringify(fixture.expected) }],
        finishReason: { unified: 'stop', raw: undefined }, usage, warnings: [],
      },
    ],
  });
}
