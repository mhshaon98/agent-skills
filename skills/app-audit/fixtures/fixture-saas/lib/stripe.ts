import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
  typescript: true,
  maxNetworkRetries: 2
});

export const PRO_PRICE_ID = process.env.STRIPE_PRICE_PRO_MONTHLY!;

export const PLANS = {
  free: { name: 'Free', monthlyCredits: 20 },
  pro: { name: 'Pro', monthlyCredits: 1000 }
} as const;
