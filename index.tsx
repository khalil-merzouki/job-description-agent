import React from 'react';
import { render } from 'ink';
import { App } from './src/ui/App.js';

if (!process.env.OPENAI_API_KEY) {
  console.error('Missing OPENAI_API_KEY. Add it to a .env file (see .env.example) or export it in your shell.');
  process.exit(1);
}

render(<App />);
