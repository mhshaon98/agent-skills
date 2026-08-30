import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { summarizeNote } from '@/lib/ai';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const user = await requireUser();
  const { noteId } = await request.json();
  const supabase = createSupabaseServerClient();

  const { data: note, error } = await supabase
    .from('notes')
    .select('id, body')
    .eq('id', noteId)
    .eq('user_id', user.id)
    .single();

  if (error || !note) {
    return NextResponse.json({ error: 'Note not found' }, { status: 404 });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  const spend = await fetch(`${siteUrl}/api/credits/consume`, {
    method: 'POST',
    headers: { cookie: request.headers.get('cookie') ?? '' }
  });

  if (!spend.ok) {
    return NextResponse.json({ error: 'Out of credits' }, { status: 402 });
  }

  // Note body is sent to OpenAI here.
  const result = await summarizeNote(note.body);

  await supabase
    .from('notes')
    .update({ summary: result.summary, updated_at: new Date().toISOString() })
    .eq('id', note.id)
    .eq('user_id', user.id);

  return NextResponse.json(result);
}
