import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import {
  createSupabaseAdminClient,
  createSupabaseServerClient
} from '@/lib/supabase/server';

type Params = { params: { id: string } };

export async function GET(_request: Request, { params }: Params) {
  await requireUser();

  // Admin client so the note detail page can pull the note and its attachments
  // in one round trip.
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from('notes')
    .select('id, user_id, title, body, summary, created_at, updated_at')
    .eq('id', params.id)
    .is('deleted_at', null)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Note not found' }, { status: 404 });
  }

  const { data: attachments } = await supabase
    .from('note_attachments')
    .select('id, original_filename, byte_size, content_type, storage_path')
    .eq('note_id', params.id);

  return NextResponse.json({ note: data, attachments: attachments ?? [] });
}

export async function PATCH(request: Request, { params }: Params) {
  const user = await requireUser();
  const body = await request.json();
  const supabase = createSupabaseServerClient();

  const { error } = await supabase
    .from('notes')
    .update({
      title: body.title,
      body: body.body,
      updated_at: new Date().toISOString()
    })
    .eq('id', params.id)
    .eq('user_id', user.id);

  if (error) {
    return NextResponse.json({ error: 'Could not update note' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: Params) {
  const user = await requireUser();
  const supabase = createSupabaseServerClient();

  const { error } = await supabase
    .from('notes')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', params.id)
    .eq('user_id', user.id);

  if (error) {
    return NextResponse.json({ error: 'Could not delete note' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
