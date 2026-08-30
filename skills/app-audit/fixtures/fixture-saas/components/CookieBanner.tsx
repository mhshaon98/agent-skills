'use client';

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'nbly_cookie_choice';

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(!window.localStorage.getItem(STORAGE_KEY));
  }, []);

  function acceptAll() {
    window.localStorage.setItem(STORAGE_KEY, 'accepted');
    setVisible(false);
  }

  function rejectAll() {
    window.localStorage.setItem(STORAGE_KEY, 'rejected');
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="cookie-banner" role="dialog" aria-label="Cookie choices">
      <p>
        We use cookies to keep you signed in and to understand how Notably is
        used. See our <a href="/privacy-policy">privacy policy</a>.
      </p>
      <div className="cookie-banner-actions">
        <button type="button" onClick={rejectAll}>
          Reject all
        </button>
        <button type="button" className="primary" onClick={acceptAll}>
          Accept all
        </button>
      </div>
    </div>
  );
}
