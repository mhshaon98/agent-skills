import fs from 'node:fs/promises';
import path from 'node:path';
import { openai } from './ai';

/**
 * Build the "what's new" blurb for the marketing page.
 *
 * The only text sent to OpenAI here is our own changelog file from
 * content/changelog.md, which is written by us and published publicly. No user
 * notes, no attachments, no account data pass through this function - it runs
 * at build time from a script, never inside a request handler.
 */
export async function summarizeChangelog(): Promise<string> {
  const changelogPath = path.join(process.cwd(), 'content', 'changelog.md');
  const changelog = await fs.readFile(changelogPath, 'utf8');

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 300,
    messages: [
      {
        role: 'system',
        content:
          'Turn this product changelog into two friendly sentences for a ' +
          'marketing page. Do not invent features.'
      },
      { role: 'user', content: changelog }
    ]
  });

  return completion.choices[0]?.message?.content?.trim() ?? '';
}
