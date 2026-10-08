import {
  generateText,
  isStepCount,
  Output,
  registerTelemetry,
  type LanguageModel,
} from "ai";
import { openai } from "@ai-sdk/openai";
import { evaluateJobDescription, type GuardrailClient } from "./guardrails.js";
import { jobAnalysisSchema, type JobAnalysis } from "./schema.js";
import { writeFileTool } from "./tools/writeFile.js";
import { SYSTEM_PROMPT } from "./system/prompt.js";
import { LaminarAiSdkTelemetry } from "@lmnr-ai/lmnr";
import "dotenv/config";

const MODEL = process.env.OPENAI_MODEL ?? "gpt-6-luna";

export type JobAnalysisResult = {
  analysis: JobAnalysis;
  /** Path of the JSON file written by the agent, or null if the tool was not called. */
  filePath: string | null;
};

export class InvalidJobDescriptionError extends Error {
  constructor() {
    super(
      "This text does not appear to be a job description. Please provide a job posting describing a role, responsibilities, or qualifications.",
    );
    this.name = "InvalidJobDescriptionError";
  }
}

registerTelemetry(new LaminarAiSdkTelemetry());

export async function analyzeJobDescription(
  jobDescription: string,
  options: {
    model?: LanguageModel;
    writeFileTool?: typeof writeFileTool;
    guardrailClient?: GuardrailClient;
  } = {},
): Promise<JobAnalysisResult> {
  const { accepted } = await evaluateJobDescription(
    jobDescription,
    options.guardrailClient,
  );
  if (!accepted) throw new InvalidJobDescriptionError();

  const { output, steps } = await generateText({
    model: options.model ?? openai(MODEL),
    system: SYSTEM_PROMPT,
    prompt: `Analyze the following job description:\n\n"""\n${jobDescription}\n"""`,
    tools: { writeFile: options.writeFileTool ?? writeFileTool },
    // Step 1: call writeFile, step 2: produce the final structured answer (extra steps as safety margin).
    stopWhen: isStepCount(4),
    output: Output.object({ schema: jobAnalysisSchema }),
  });

  const writeResult = steps
    .flatMap((step) => step.toolResults)
    .find((result) => result.toolName === "writeFile");
  const savedFile = writeResult?.output;

  return {
    analysis: output,
    filePath:
      savedFile &&
      typeof savedFile === "object" &&
      "filePath" in savedFile &&
      typeof savedFile.filePath === "string"
        ? savedFile.filePath
        : null,
  };
}
