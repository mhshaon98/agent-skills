import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

const COST_PER_SUMMARY = 1;

/**
 * Spend one credit. Called by the summarize flow before it hits OpenAI.
 *
 * Read the balance, check it, write the new balance, append a ledger row.
 */
export async function POST() {
  const user = await requireUser();
  const supabase = createSupabaseAdminClient();

  const { data: row, error } = await supabase
    .from('users')
    .select('credits')
    .eq('id', user.id)
    .single();

  if (error || !row) {
    return NextResponse.json({ error: 'No account' }, { status: 404 });
  }

  if (row.credits < COST_PER_SUMMARY) {
    return NextResponse.json({ error: 'Out of credits' }, { status: 402 });
  }

  const remaining = row.credits - COST_PER_SUMMARY;

  await supabase
    .from('users')
    .update({ credits: remaining })
    .eq('id', user.id);

  await supabase.from('credit_ledger').insert({
    user_id: user.id,
    delta: -COST_PER_SUMMARY,
    reason: 'summary'
  });

  return NextResponse.json({ remaining });
}
