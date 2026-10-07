import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';

type Props = {
  onSubmit: (text: string) => void;
};

export const JobInput = ({ onSubmit }: Props) => {
  const [value, setValue] = useState('');

  useInput((input, key) => {
    if (key.return) {
      if (value.trim()) onSubmit(value.trim());
      return;
    }
    if (key.backspace || key.delete) {
      setValue((prev) => prev.slice(0, -1));
      return;
    }
    if (key.ctrl || key.meta || key.escape || key.tab) return;
    if (key.upArrow || key.downArrow || key.leftArrow || key.rightArrow) return;

    // Normalize line endings from pasted text
    setValue((prev) => prev + input.replace(/\r\n?/g, '\n'));
  });

  return (
    <Box flexDirection="column">
      <Text>Paste or type the job description, then press <Text bold color="yellow">Enter</Text>:</Text>
      <Box borderStyle="round" borderColor="gray" paddingX={1} marginTop={1}>
        {value ? (
          <Text>
            {value}
            <Text inverse> </Text>
          </Text>
        ) : (
          <Text color="gray">Waiting for input…</Text>
        )}
      </Box>
      <Text color="gray">{value.length} characters · Ctrl+C to quit</Text>
    </Box>
  );
};

