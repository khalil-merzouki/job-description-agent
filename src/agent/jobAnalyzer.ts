import { generateText, Output } from "ai";
import { openai } from "@ai-sdk/openai";
import { jobAnalysisSchema, type JobAnalysis } from "./schema.js";

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
- Answer in English, regardless of the language of the job description.`;

export async function analyzeJobDescription(
  jobDescription: string,
): Promise<JobAnalysis> {
  const { output } = await generateText({
    model: openai(MODEL),
    system: SYSTEM_PROMPT,
    prompt: `Analyze the following job description:\n\n"""\n${jobDescription}\n"""`,
    output: Output.object({ schema: jobAnalysisSchema }),
  });

  return output;
}
