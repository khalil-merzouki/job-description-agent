import type { JobAnalysis } from '../src/agent/schema.js';

export type EvalCase = {
  id: string;
  jobDescription: string;
  expected: JobAnalysis;
  fileName: string;
};

const emptyRequirements: JobAnalysis['requirements'] = {
  yearsOfExperience: null, education: null, mustHaveSkills: [],
  niceToHaveSkills: [], softSkills: [], languages: [],
};

// Estimated amounts are mock responses only; evaluators do not require these exact amounts.
export const fixtures: EvalCase[] = [
  {
    id: 'explicit-salary',
    jobDescription: 'Acme is hiring a Senior Frontend Engineer in Madrid, Spain. Full-time, hybrid (2 days per week in the office). Salary: EUR 70,000–90,000 gross per year. Requires 5 years of experience, TypeScript and React. AWS is a bonus. Build and maintain our web application. Benefits: private health insurance.',
    fileName: 'acme-senior-frontend-engineer.json',
    expected: {
      jobTitle: 'Senior Frontend Engineer', company: 'Acme', seniority: 'senior',
      contract: { type: 'full-time', details: null },
      location: { city: 'Madrid', country: 'Spain', workMode: 'hybrid', details: '2 days per week in the office' },
      salary: { min: 70000, max: 90000, currency: 'EUR', period: 'year', isEstimated: false, reasoning: 'EUR 70,000–90,000 gross per year.' },
      requirements: { ...emptyRequirements, yearsOfExperience: 5, mustHaveSkills: ['TypeScript', 'React'], niceToHaveSkills: ['AWS'] },
      responsibilities: ['Build and maintain the web application.'], benefits: ['Private health insurance'],
      summary: 'Acme seeks a senior frontend engineer in Madrid. The full-time hybrid role uses TypeScript and React.',
    },
  },
  {
    id: 'french-estimated-salary',
    jobDescription: 'Entreprise: Lumière. Poste: Développeur Backend Junior. CDI à temps plein à Paris, France, sur site. Un an d’expérience requis. Compétences obligatoires: Python et PostgreSQL. Développer des API. Salaire non communiqué.',
    fileName: 'lumiere-junior-backend-developer.json',
    expected: {
      jobTitle: 'Junior Backend Developer', company: 'Lumière', seniority: 'junior',
      contract: { type: 'full-time', details: 'CDI' },
      location: { city: 'Paris', country: 'France', workMode: 'on-site', details: null },
      salary: { min: 35000, max: 45000, currency: 'EUR', period: 'year', isEstimated: true, reasoning: 'Estimated for a junior Python backend developer with one year of experience in Paris.' },
      requirements: { ...emptyRequirements, yearsOfExperience: 1, mustHaveSkills: ['Python', 'PostgreSQL'] },
      responsibilities: ['Develop APIs.'], benefits: [],
      summary: 'Lumière seeks a junior backend developer in Paris. This permanent full-time role requires Python and PostgreSQL.',
    },
  },
  {
    id: 'missing-facts',
    jobDescription: 'Developer in Madrid, Spain. Required skill: Python.',
    fileName: 'unknown-company-developer.json',
    expected: {
      jobTitle: 'Developer', company: null, seniority: 'unknown',
      contract: { type: 'unknown', details: null },
      location: { city: 'Madrid', country: 'Spain', workMode: 'unknown', details: null },
      salary: { min: 30000, max: 50000, currency: 'EUR', period: 'year', isEstimated: true, reasoning: 'Estimated for a Python developer in Madrid; seniority is unspecified.' },
      requirements: { ...emptyRequirements, mustHaveSkills: ['Python'] },
      responsibilities: [], benefits: [],
      summary: 'A developer role in Madrid requires Python. The company, contract and seniority are unspecified.',
    },
  },
  {
    id: 'hourly-contract',
    jobDescription: 'Orbit is hiring a Senior Data Engineer on a 6-month contract, fully remote within the United States. Pay: USD 80–100 per hour. Requires 7 years of experience, Python and SQL. Build data pipelines.',
    fileName: 'orbit-senior-data-engineer.json',
    expected: {
      jobTitle: 'Senior Data Engineer', company: 'Orbit', seniority: 'senior',
      contract: { type: 'contract', details: '6 months' },
      location: { city: null, country: 'United States', workMode: 'remote', details: 'Remote within the United States' },
      salary: { min: 80, max: 100, currency: 'USD', period: 'hour', isEstimated: false, reasoning: 'USD 80–100 per hour.' },
      requirements: { ...emptyRequirements, yearsOfExperience: 7, mustHaveSkills: ['Python', 'SQL'] },
      responsibilities: ['Build data pipelines.'], benefits: [],
      summary: 'Orbit seeks a senior data engineer for a six-month remote contract in the United States. Python and SQL are required.',
    },
  },
];
