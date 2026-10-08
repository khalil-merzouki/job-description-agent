import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tool } from 'ai';
import { z } from 'zod';

/** Folder where the agent is allowed to write files, configured via OUTPUT_DIR in .env. */
export function getOutputDir(): string {
  const dir = process.env.OUTPUT_DIR;
  if (!dir) throw new Error('Missing OUTPUT_DIR. Add it to your .env file (see .env.example).');
  return path.resolve(dir);
}

export const writeFileTool = tool({
  description:
    'Write a text file to the output folder. Use it to save results. ' +
    'Only provide a file name (e.g. "acme-frontend-engineer.json"), not a path.',
  inputSchema: z.object({
    fileName: z
      .string()
      .describe('File name including extension, lowercase kebab-case, e.g. "acme-senior-react-developer.json".'),
    content: z.string().describe('The full content of the file.'),
  }),
  execute: async ({ fileName, content }) => {
    const outputDir = getOutputDir();
    // Keep only the base name so the model can't escape the output folder (e.g. "../../etc/passwd").
    const filePath = path.join(outputDir, path.basename(fileName));

    await mkdir(outputDir, { recursive: true });
    await writeFile(filePath, content, 'utf8');

    return { success: true, filePath };
  },
});

