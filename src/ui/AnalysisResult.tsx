import React from 'react';
import { Box, Text } from 'ink';
import type { JobAnalysis } from '../agent/schema.js';

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <Text>
    <Text bold color="blue">{label}: </Text>
    {children}
  </Text>
);

const List = ({ title, items }: { title: string; items: string[] }) =>
  items.length === 0 ? null : (
    <Box flexDirection="column" marginTop={1}>
      <Text bold color="blue">{title}</Text>
      {items.map((item) => (
        <Text key={item}>  • {item}</Text>
      ))}
    </Box>
  );

const formatSalary = ({ min, max, currency, period }: JobAnalysis['salary']) => {
  const fmt = (n: number) => n.toLocaleString('en-US');
  if (min !== null && max !== null && min !== max) return `${fmt(min)} – ${fmt(max)} ${currency} / ${period}`;
  const value = min ?? max;
  return value !== null ? `${fmt(value)} ${currency} / ${period}` : 'Unknown';
};

const join = (...parts: (string | null)[]) => parts.filter(Boolean).join(', ') || 'Unknown';

export const AnalysisResult = ({ analysis }: { analysis: JobAnalysis }) => {
  const { contract, location, salary, requirements } = analysis;

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="green" paddingX={1}>
      <Text bold color="green">{analysis.jobTitle}</Text>
      <Text color="gray">{analysis.summary}</Text>

      <Box flexDirection="column" marginTop={1}>
        <Field label="Company">{analysis.company ?? 'Unknown'}</Field>
        <Field label="Seniority">{analysis.seniority}</Field>
        <Field label="Contract">
          {contract.type}
          {contract.details ? ` (${contract.details})` : ''}
        </Field>
        <Field label="Location">
          {join(location.city, location.country)} · {location.workMode}
          {location.details ? ` (${location.details})` : ''}
        </Field>
        <Field label="Salary">
          {formatSalary(salary)}{' '}
          {salary.isEstimated ? <Text color="yellow">(estimated)</Text> : <Text color="green">(stated)</Text>}
        </Field>
        <Text color="gray">  {salary.reasoning}</Text>
        {requirements.yearsOfExperience !== null && (
          <Field label="Experience">{requirements.yearsOfExperience}+ years</Field>
        )}
        {requirements.education && <Field label="Education">{requirements.education}</Field>}
      </Box>

      <List title="Must-have skills" items={requirements.mustHaveSkills} />
      <List title="Nice-to-have skills" items={requirements.niceToHaveSkills} />
      <List title="Soft skills" items={requirements.softSkills} />
      <List title="Languages" items={requirements.languages} />
      <List title="Responsibilities" items={analysis.responsibilities} />
      <List title="Benefits" items={analysis.benefits} />
    </Box>
  );
};

