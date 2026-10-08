import { analyzeJobDescription, type JobAnalysisResult } from '../src/agent/jobAnalyzer.js';
import type { EvalCase } from './fixtures.js';
import { createMockFileTool, createMockModel, createMockGuardrailClient, type FileWrite } from './mocks.js';

export type EvalOutput = JobAnalysisResult & { writes: FileWrite[] };

export async function executeCase(fixture: EvalCase, mock: boolean): Promise<EvalOutput> {
  const fileTool = createMockFileTool();
  const result = await analyzeJobDescription(fixture.jobDescription, {
    writeFileTool: fileTool.tool,
    ...(mock ? { model: createMockModel(fixture), guardrailClient: createMockGuardrailClient() } : {}),
  });
  return { ...result, writes: fileTool.writes };
}
