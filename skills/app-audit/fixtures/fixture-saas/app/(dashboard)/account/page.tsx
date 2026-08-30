import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import DeleteAccountButton from '@/components/DeleteAccountButton';

export const dynamic = 'force-dynamic';

export default async function AccountPage() {
  const user = await getSessionUser();
  if (!user) redirect('/signin');

  const supabase = createSupabaseServerClient();
  const { data: profile } = await supabase
    .from('users')
    .select('plan, credits')
    .eq('id', user.id)
    .single();

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('status, current_period_end, cancel_at_period_end')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <section className="account">
      <h1>Account</h1>
      <p>Signed in as {user.email}</p>
      <p>
        Plan: <strong>{profile?.plan ?? 'free'}</strong> - {profile?.credits ?? 0}{' '}
        summaries left this month
      </p>

      {subscription ? (
        <p>
          Subscription status: {subscription.status}
          {subscription.cancel_at_period_end
            ? ' (ends at the end of this period)'
            : ' (renews automatically)'}
        </p>
      ) : (
        <p>
          No paid subscription. <a href="/pricing">See Pro</a>.
        </p>
      )}

      <h2>Danger zone</h2>
      <DeleteAccountButton />
    </section>
  );
}
