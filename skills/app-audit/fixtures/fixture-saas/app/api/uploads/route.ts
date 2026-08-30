import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const MAX_BYTES = 25 * 1024 * 1024;

export async function POST(request: Request) {
  const user = await requireUser();
  const form = await request.formData();
  const file = form.get('file');
  const noteId = String(form.get('noteId') ?? '');

  if (!(file instanceof File) || !noteId) {
    return NextResponse.json({ error: 'Missing file or note' }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'File too large' }, { status: 413 });
  }

  const supabase = createSupabaseServerClient();
  const storagePath = `${user.id}/${noteId}/${crypto.randomUUID()}-${file.name}`;

  // Always the private bucket. brand-assets is marketing only.
  const { error: uploadError } = await supabase.storage
    .from('note-attachments')
    .upload(storagePath, file, { contentType: file.type, upsert: false });

  if (uploadError) {
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }

  await supabase.from('note_attachments').insert({
    note_id: noteId,
    user_id: user.id,
    storage_path: storagePath,
    original_filename: file.name,
    byte_size: file.size,
    content_type: file.type
  });

  return NextResponse.json({ path: storagePath }, { status: 201 });
}
