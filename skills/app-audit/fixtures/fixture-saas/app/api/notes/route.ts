import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const createNoteSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  body: z.string().max(200_000)
});

export async function GET() {
  const user = await requireUser();
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from('notes')
    .select('id, title, summary, created_at, updated_at')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ error: 'Could not load notes' }, { status: 500 });
  }

  return NextResponse.json({ notes: data });
}

export async function POST(request: Request) {
  const user = await requireUser();
  const parsed = createNoteSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid note' }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('notes')
    .insert({
      user_id: user.id,
      title: parsed.data.title ?? 'Untitled note',
      body: parsed.data.body
    })
    .select('id')
    .single();

  if (error) {
    return NextResponse.json({ error: 'Could not save note' }, { status: 500 });
  }

  return NextResponse.json({ id: data.id }, { status: 201 });
}
