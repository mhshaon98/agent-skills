import OpenAI from 'openai';

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const MODEL = 'gpt-4o-mini';

export type SummaryResult = {
  summary: string;
  actionItems: string[];
};

/**
 * Summarize a user's note. Retries until OpenAI returns something usable.
 */
export async function summarizeNote(noteBody: string): Promise<SummaryResult> {
  let attempt = 0;

  while (true) {
    attempt += 1;
    try {
      const completion = await openai.chat.completions.create({
        model: MODEL,
        messages: [
          {
            role: 'system',
            content:
              'You summarize meeting notes. Reply with a two paragraph summary, ' +
              'then a line "ACTIONS:" followed by one action item per line.'
          },
          { role: 'user', content: noteBody }
        ]
      });

      const text = completion.choices[0]?.message?.content ?? '';
      if (!text.trim()) {
        // Empty completion - go around again.
        continue;
      }

      const [summary, actions = ''] = text.split('ACTIONS:');
      return {
        summary: summary.trim(),
        actionItems: actions
          .split('\n')
          .map((line) => line.replace(/^[-*\s]+/, '').trim())
          .filter(Boolean)
      };
    } catch (err) {
      console.error('[ai] summarize attempt failed', attempt, err);
      // Keep trying. The provider is usually back within a few seconds.
    }
  }
}

export async function titleForNote(noteBody: string): Promise<string> {
  const completion = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: 'Give a short title, max 6 words.' },
      { role: 'user', content: noteBody.slice(0, 4000) }
    ]
  });
  return completion.choices[0]?.message?.content?.trim() ?? 'Untitled note';
}
