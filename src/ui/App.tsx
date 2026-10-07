import React, { useState } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import Spinner from 'ink-spinner';
import { analyzeJobDescription } from '../agent/jobAnalyzer.js';
import type { JobAnalysis } from '../agent/schema.js';
import { JobInput } from './JobInput.js';
import { AnalysisResult } from './AnalysisResult.js';

type State =
  | { step: 'input' }
  | { step: 'analyzing' }
  | { step: 'result'; analysis: JobAnalysis }
  | { step: 'error'; message: string };

export const App = () => {
  const { exit } = useApp();
  const [state, setState] = useState<State>({ step: 'input' });

  const handleSubmit = async (jobDescription: string) => {
    setState({ step: 'analyzing' });
    try {
      const analysis = await analyzeJobDescription(jobDescription);
      setState({ step: 'result', analysis });
    } catch (error) {
      setState({ step: 'error', message: error instanceof Error ? error.message : String(error) });
    }
  };

  useInput(
    (input) => {
      if (input === 'n') setState({ step: 'input' });
      if (input === 'q') exit();
    },
    { isActive: state.step === 'result' || state.step === 'error' },
  );

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">🔎 Job Description Agent</Text>
      </Box>

      {state.step === 'input' && <JobInput onSubmit={handleSubmit} />}

      {state.step === 'analyzing' && (
        <Text color="yellow">
          <Spinner type="dots" /> Analyzing the job description…
        </Text>
      )}

      {state.step === 'result' && <AnalysisResult analysis={state.analysis} />}

      {state.step === 'error' && (
        <Box borderStyle="round" borderColor="red" paddingX={1}>
          <Text color="red">Error: {state.message}</Text>
        </Box>
      )}

      {(state.step === 'result' || state.step === 'error') && (
        <Box marginTop={1}>
          <Text color="gray">
            Press <Text bold>n</Text> to analyze another job description, <Text bold>q</Text> to quit.
          </Text>
        </Box>
      )}
    </Box>
  );
};

