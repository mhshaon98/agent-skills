// SELFTEST FIXTURE — import/init signals for scan_processors.py.
import posthog from "posthog-js";
import Stripe from "stripe";
import OpenAI from "openai";

posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
  api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
});

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
export const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
