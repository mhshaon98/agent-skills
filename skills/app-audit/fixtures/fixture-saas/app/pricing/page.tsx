export default function PricingPage() {
  return (
    <section className="pricing">
      <h1>Pricing</h1>

      <div className="plan">
        <h2>Free</h2>
        <p className="price">$0</p>
        <ul>
          <li>20 summaries per month</li>
          <li>Notes up to 4,000 words</li>
        </ul>
        <a className="cta" href="/signup">
          Start free
        </a>
      </div>

      <div className="plan plan-pro">
        <h2>Pro</h2>
        <p className="price">$12/mo</p>
        <ul>
          <li>1,000 summaries per month</li>
          <li>Notes up to 40,000 words</li>
          <li>File attachments</li>
        </ul>
        <a className="cta" href="/api/stripe/checkout">
          Go Pro
        </a>
        <p className="fine-print">
          $12 per month, billed monthly. Renews automatically each month until
          you cancel. Cancel any time from your account page.
        </p>
      </div>
    </section>
  );
}
