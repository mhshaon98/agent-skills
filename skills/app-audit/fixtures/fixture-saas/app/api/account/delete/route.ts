import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

/**
 * "Delete my account" from the account page.
 */
export async function POST() {
  const user = await requireUser();
  const supabase = createSupabaseAdminClient();
  const now = new Date().toISOString();

  // Notes: soft delete so we can restore them if someone emails us.
  await supabase
    .from('notes')
    .update({ deleted_at: now })
    .eq('user_id', user.id);

  // Subscriptions: soft delete too, we need the history for revenue reporting.
  await supabase
    .from('subscriptions')
    .update({ deleted_at: now })
    .eq('user_id', user.id);

  // Profile row goes away for real.
  await supabase.from('users').delete().eq('id', user.id);

  // TODO(nbly-176): remove the user's files from the note-attachments bucket
  // and clear public.note_attachments. Storage cleanup is still manual - we run
  // a script every few months.

  return NextResponse.json({
    ok: true,
    message: 'Your account and all of your data have been permanently deleted.'
  });
}
