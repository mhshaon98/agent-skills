import type { Metadata } from 'next';
import Nav from '@/components/Nav';
import CookieBanner from '@/components/CookieBanner';
import '@/styles/globals.css';

// Side-effect import: PostHog initializes as soon as this module loads.
import '@/lib/analytics';

export const metadata: Metadata = {
  title: 'Notably - summarize your notes',
  description: 'Paste a long note, get a short summary and action items.'
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Nav />
        <main>{children}</main>
        <footer>
          <a href="/privacy-policy">Privacy</a>
          <a href="/terms">Terms</a>
          <span>&copy; 2025 Notably</span>
        </footer>
        <CookieBanner />
      </body>
    </html>
  );
}
