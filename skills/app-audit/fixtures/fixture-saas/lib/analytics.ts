'use client';

import posthog from 'posthog-js';

// Imported from app/layout.tsx so analytics is available everywhere.
if (typeof window !== 'undefined') {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com',
    person_profiles: 'always',
    capture_pageview: true,
    capture_pageleave: true,
    autocapture: true,
    persistence: 'localStorage+cookie',
    session_recording: {
      maskAllInputs: false
    }
  });
}

export function identifyUser(userId: string, email: string) {
  posthog.identify(userId, { email });
}

export function track(event: string, props?: Record<string, unknown>) {
  posthog.capture(event, props);
}

export function trackNoteSummarized(noteId: string, wordCount: number) {
  posthog.capture('note_summarized', { note_id: noteId, word_count: wordCount });
}
