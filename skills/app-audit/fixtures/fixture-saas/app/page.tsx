import Testimonials from '@/components/Testimonials';

export default function HomePage() {
  return (
    <>
      <section className="hero">
        <h1>Your notes, three sentences shorter.</h1>
        <p>
          Paste a meeting note. Notably gives you a summary and a list of action
          items in about ten seconds.
        </p>
        <a className="cta" href="/signup">
          Start free
        </a>
        <p className="hero-note">20 free summaries. No card needed.</p>
      </section>

      <section className="how">
        <h2>How it works</h2>
        <ol>
          <li>Write or paste a note.</li>
          <li>Hit Summarize.</li>
          <li>Copy the summary and the action items wherever they need to go.</li>
        </ol>
      </section>

      <Testimonials />

      <section className="closing">
        <h2>Ready when you are</h2>
        <a className="cta" href="/pricing">
          See pricing
        </a>
      </section>
    </>
  );
}
