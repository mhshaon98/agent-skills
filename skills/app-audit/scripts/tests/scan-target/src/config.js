// SELFTEST FIXTURE — the credential below is fake and inert.
// It exists only so scan_secrets.py has something to find.
const stripeSecretKey = "sk_test_000fakefakefake";

const config = {
  stripeKey: stripeSecretKey,
  publicSiteUrl: "https://example.invalid",
};

export default config;
