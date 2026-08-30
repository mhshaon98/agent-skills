'use client';

import { useState } from 'react';

export default function DeleteAccountButton() {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  async function onDelete() {
    if (!confirm('Delete your account and everything in it? This cannot be undone.')) {
      return;
    }
    setBusy(true);
    const res = await fetch('/api/account/delete', { method: 'POST' });
    const body = await res.json();
    setBusy(false);
    setDone(body.message ?? 'Deleted.');
  }

  if (done) return <p className="deleted-notice">{done}</p>;

  return (
    <button type="button" className="danger" disabled={busy} onClick={onDelete}>
      {busy ? 'Deleting...' : 'Delete my account'}
    </button>
  );
}
