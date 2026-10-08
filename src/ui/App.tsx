import React, { useState } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import Spinner from 'ink-spinner';
import { analyzeJobDescription, type JobAnalysisResult } from '../agent/jobAnalyzer.js';
import { JobInput } from './JobInput.js';
import { AnalysisResult } from './AnalysisResult.js';

type State =
  | { step: 'input' }
  | { step: 'analyzing' }
  | { step: 'result'; result: JobAnalysisResult }
  | { step: 'error'; message: string };

export const App = () => {
  const { exit } = useApp();
  const [state, setState] = useState<State>({ step: 'input' });

  const handleSubmit = async (jobDescription: string) => {
    setState({ step: 'analyzing' });
    try {
      const result = await analyzeJobDescription(jobDescription);
      setState({ step: 'result', result });
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
          <Spinner type="dots" /> Analyzing the job description and saving the result…
        </Text>
      )}

      {state.step === 'result' && (
        <Box flexDirection="column">
          <AnalysisResult analysis={state.result.analysis} />
          {state.result.filePath ? (
            <Text color="green">💾 Saved to {state.result.filePath}</Text>
          ) : (
            <Text color="yellow">⚠ The agent did not save the result to a file.</Text>
          )}
        </Box>
      )}

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

