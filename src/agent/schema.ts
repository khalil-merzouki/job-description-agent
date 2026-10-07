import { z } from 'zod';

export const contractTypes = [
  'full-time',
  'part-time',
  'contract',
  'freelance',
  'internship',
  'temporary',
  'apprenticeship',
  'unknown',
] as const;

export const jobAnalysisSchema = z.object({
  jobTitle: z.string().describe('The title of the position.'),
  company: z
    .string()
    .nullable()
    .describe('Name of the hiring company, or null if not mentioned.'),
  seniority: z
    .enum(['intern', 'junior', 'mid', 'senior', 'lead', 'principal', 'unknown'])
    .describe('Seniority level inferred from the title, responsibilities and required experience.'),
  contract: z.object({
    type: z.enum(contractTypes).describe('Type of contract.'),
    details: z
      .string()
      .nullable()
      .describe('Extra contract details, e.g. "6 months, renewable", "CDI", or null.'),
  }),
  location: z.object({
    city: z.string().nullable(),
    country: z.string().nullable(),
    workMode: z.enum(['on-site', 'hybrid', 'remote', 'unknown']),
    details: z
      .string()
      .nullable()
      .describe('Extra location info, e.g. "2 days/week in office", "Remote within EU", or null.'),
  }),
  salary: z.object({
    min: z.number().nullable().describe('Lower bound of the yearly gross salary.'),
    max: z.number().nullable().describe('Upper bound of the yearly gross salary.'),
    currency: z.string().describe('ISO 4217 currency code, e.g. "EUR", "USD".'),
    period: z.enum(['year', 'month', 'day', 'hour']),
    isEstimated: z
      .boolean()
      .describe('false if the salary is explicitly stated in the job description, true if you estimated it.'),
    reasoning: z
      .string()
      .describe('If estimated, a short explanation of the basis for the estimate (role, seniority, location, market). If stated, quote where it comes from.'),
  }),
  requirements: z.object({
    yearsOfExperience: z
      .number()
      .nullable()
      .describe('Minimum years of experience required, or null if not mentioned.'),
    education: z.string().nullable().describe('Required degree/education, or null.'),
    mustHaveSkills: z.array(z.string()).describe('Required hard skills, tools and technologies.'),
    niceToHaveSkills: z.array(z.string()).describe('Optional / bonus skills.'),
    softSkills: z.array(z.string()),
    languages: z.array(z.string()).describe('Spoken languages required, e.g. "English (fluent)".'),
  }),
  responsibilities: z.array(z.string()).describe('Main responsibilities, max 6, concise.'),
  benefits: z.array(z.string()),
  summary: z.string().describe('A 2-3 sentence summary of the position.'),
});

export type JobAnalysis = z.infer<typeof jobAnalysisSchema>;

