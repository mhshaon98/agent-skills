'use client';

import { useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

export default function SignUpPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${window.location.origin}/notes`
      }
    });
    setSent(true);
  }

  if (sent) {
    return <p>Almost there - open the link we just emailed you.</p>;
  }

  return (
    <form className="auth" onSubmit={onSubmit}>
      <h1>Create your account</h1>
      <p>20 free summaries a month. No card needed.</p>
      <label htmlFor="email">Email</label>
      <input
        id="email"
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <button type="submit">Create account</button>
      <p className="fine-print">
        By creating an account you agree to our <a href="/terms">Terms</a> and{' '}
        <a href="/privacy-policy">Privacy Policy</a>.
      </p>
    </form>
  );
}
