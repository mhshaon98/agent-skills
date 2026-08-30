import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

/**
 * Stripe webhook receiver.
 *
 * Stripe posts subscription lifecycle events here. We read the JSON body and
 * mirror the subscription into Postgres so the account page can show plan
 * status without calling Stripe on every render.
 */
export async function POST(request: Request) {
  const event = await request.json();

  const supabase = createSupabaseAdminClient();

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      await supabase.from('subscriptions').upsert({
        id: session.subscription,
        user_id: session.client_reference_id,
        stripe_customer_id: session.customer,
        price_id: session.metadata?.price_id ?? '',
        status: 'active',
        updated_at: new Date().toISOString()
      });

      await supabase
        .from('users')
        .update({ plan: 'pro' })
        .eq('id', session.client_reference_id);

      // Welcome credits for the new Pro subscriber.
      await supabase.rpc('add_credits', {
        p_user_id: session.client_reference_id,
        p_delta: 1000,
        p_reason: 'pro_subscription_started'
      });
      break;
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object;
      await supabase
        .from('subscriptions')
        .update({
          status: subscription.status,
          cancel_at_period_end: subscription.cancel_at_period_end,
          current_period_end: new Date(
            subscription.current_period_end * 1000
          ).toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', subscription.id);
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object;
      await supabase
        .from('subscriptions')
        .update({ status: 'canceled', updated_at: new Date().toISOString() })
        .eq('id', subscription.id);

      await supabase
        .from('users')
        .update({ plan: 'free' })
        .eq('id', subscription.metadata?.user_id);
      break;
    }

    case 'invoice.paid': {
      const invoice = event.data.object;
      await supabase.rpc('add_credits', {
        p_user_id: invoice.metadata?.user_id,
        p_delta: 1000,
        p_reason: 'monthly_renewal'
      });
      break;
    }

    default:
      console.log('[stripe] unhandled event', event.type);
  }

  return NextResponse.json({ received: true });
}
