import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { PRO_PRICE_ID, stripe } from '@/lib/stripe';

export async function POST() {
  const user = await requireUser();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: PRO_PRICE_ID, quantity: 1 }],
    client_reference_id: user.id,
    customer_email: user.email,
    success_url: `${siteUrl}/account?checkout=success`,
    cancel_url: `${siteUrl}/pricing?checkout=cancelled`,
    metadata: { user_id: user.id, price_id: PRO_PRICE_ID }
  });

  return NextResponse.json({ url: session.url });
}
