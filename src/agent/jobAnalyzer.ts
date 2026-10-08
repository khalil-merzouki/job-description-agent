import { generateText, isStepCount, Output, type LanguageModel } from "ai";
import { openai } from "@ai-sdk/openai";
import { jobAnalysisSchema, type JobAnalysis } from "./schema.js";
import { writeFileTool } from "./tools/writeFile.js";

const MODEL = process.env.OPENAI_MODEL ?? "gpt-6-luna";

const SYSTEM_PROMPT = `You are an expert recruiter and job market analyst.
You receive a raw job description and extract the most important information from it.

Rules:
- Only report facts that are present in the job description, except for the salary.
- If the salary is not stated, ESTIMATE a realistic yearly gross range based on the job title,
  seniority, required skills, location and work mode. Set "isEstimated" to true and explain the basis.
- If the salary is stated, copy it as-is (convert to numbers), set "isEstimated" to false.
- Use "unknown" for enum values that cannot be determined, and null for missing optional facts.
- Keep skills short and normalized (e.g. "TypeScript", "React", "AWS").
- Answer in English, regardless of the language of the job description.

Workflow:
1. Analyze the job description.
2. Call the "writeFile" tool exactly once to save the analysis as pretty-printed JSON (2-space indent).
   The JSON must follow the same structure as your final answer.
   Name the file "<company>-<job-title>.json" in lowercase kebab-case (use "unknown-company" if there is no company).
3. Return the analysis as your final answer.`;

export type JobAnalysisResult = {
  analysis: JobAnalysis;
  /** Path of the JSON file written by the agent, or null if the tool was not called. */
  filePath: string | null;
};

export async function analyzeJobDescription(
  jobDescription: string,
  options: {
    model?: LanguageModel;
    writeFileTool?: typeof writeFileTool;
  } = {},
): Promise<JobAnalysisResult> {
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
      savedFile && typeof savedFile === "object" && "filePath" in savedFile &&
      typeof savedFile.filePath === "string" ? savedFile.filePath : null,
  };
}
