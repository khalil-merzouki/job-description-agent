import { isDeepStrictEqual } from 'node:util';
import { jobAnalysisSchema } from '../src/agent/schema.js';
import type { EvalOutput } from './executor.js';
import type { JobAnalysis } from '../src/agent/schema.js';

const normalize = (value: unknown): unknown => typeof value === 'string' ? value.trim().toLowerCase() : value;
const equal = (a: unknown, b: unknown) => isDeepStrictEqual(normalize(a), normalize(b));
const setEqual = (a: string[], b: string[]) => isDeepStrictEqual(
  [...new Set(a.map(normalize))].sort(), [...new Set(b.map(normalize))].sort(),
);

export const evaluators = {
  schema_valid: (output: EvalOutput) => Number(jobAnalysisSchema.safeParse(output.analysis).success),
  facts_accuracy: (output: EvalOutput, target?: JobAnalysis) => {
    if (!target || !jobAnalysisSchema.safeParse(output.analysis).success) return 0;
    const a = output.analysis;
    // Prose is allowed to vary; missing optional facts and skill classifications must match.
    const checks = [
      equal(a.jobTitle, target.jobTitle), equal(a.company, target.company),
      a.seniority === target.seniority, a.contract.type === target.contract.type,
      equal(a.location.city, target.location.city), equal(a.location.country, target.location.country),
      a.location.workMode === target.location.workMode,
      a.requirements.yearsOfExperience === target.requirements.yearsOfExperience,
      equal(a.requirements.education, target.requirements.education),
      setEqual(a.requirements.mustHaveSkills, target.requirements.mustHaveSkills),
      setEqual(a.requirements.niceToHaveSkills, target.requirements.niceToHaveSkills),
      setEqual(a.requirements.softSkills, target.requirements.softSkills),
      setEqual(a.requirements.languages, target.requirements.languages),
      target.contract.details !== null || a.contract.details === null,
      target.location.details !== null || a.location.details === null,
      target.responsibilities.length !== 0 || a.responsibilities.length === 0,
      target.benefits.length !== 0 || a.benefits.length === 0,
    ];
    return checks.filter(Boolean).length / checks.length;
  },
  salary_correct: (output: EvalOutput, target?: JobAnalysis) => {
    if (!target || !jobAnalysisSchema.safeParse(output.analysis).success) return 0;
    const salary = output.analysis.salary;
    if (salary.isEstimated !== target.salary.isEstimated || salary.currency !== target.salary.currency || !salary.reasoning.trim()) return 0;
    if (!target.salary.isEstimated) {
      return Number(salary.min === target.salary.min && salary.max === target.salary.max && salary.period === target.salary.period);
    }
    // There is no single correct market estimate. Check an explained annual positive range.
    return Number(salary.period === 'year' && salary.min !== null && salary.max !== null &&
      salary.min > 0 && salary.max >= salary.min);
  },
  file_workflow: (output: EvalOutput) => {
    if (output.writes.length !== 1 || !jobAnalysisSchema.safeParse(output.analysis).success) return 0;
    const write = output.writes[0]!;
    if (output.filePath !== write.filePath || !/^[a-z0-9]+(?:-[a-z0-9]+)*\.json$/.test(write.fileName)) return 0;
    const slug = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const expectedName = `${slug(output.analysis.company ?? 'unknown-company')}-${slug(output.analysis.jobTitle)}.json`;
    if (write.fileName !== expectedName) return 0;
    try {
      const saved = JSON.parse(write.content);
      return Number(jobAnalysisSchema.safeParse(saved).success && isDeepStrictEqual(saved, output.analysis) &&
        write.content.trim() === JSON.stringify(saved, null, 2));
    } catch {
      return 0;
    }
  },
};
