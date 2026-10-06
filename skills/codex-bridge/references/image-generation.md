# codex-bridge: image generation via the CLI

Read before generating images through Codex. Full doctrine and failure modes: https://github.com/mhshaon98/agent-skills/blob/main/playbooks/codex-image-pipeline.md

## 0.6 Image generation via the CLI

The CLI's `image_generation` feature (ChatGPT-token auth, no API key, needs a paid
ChatGPT plan) generates images headlessly and saves them into the workspace:

```bash
codex exec --skip-git-repo-check -s workspace-write \
  -c model="<image-capable model>" -c model_reasoning_effort="medium" \
  "<brief: exact paths+filenames, exact pixel size, 'verify each with sips', content rules>"
```

- Pass model and effort as `-c` flags per invocation; never edit the user's
  `~/.codex/config.toml` yourself.
- Multi-image briefs loop on their own (roughly 60-90s per image). A workspace image
  named as a reference holds identity and framing across a series (e.g. staged
  before/after pairs).
- Generated images come out **letterless** — do brand typography and compositing in
  your own committed generators. Verify dimensions on disk yourself.
