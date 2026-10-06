# Codex image pipeline — AI images headlessly, on any project

*Applies to every project that needs generated images (marketing plates, stories,
mockup photography). Requires an OpenAI account plan that includes Codex image
generation (free plans do not).*

## The route (in order of preference)

1. **Codex CLI, headless (the primary route).** The `codex` CLI's image-generation
   feature (ChatGPT-token auth, no API key) generates images and saves them straight
   into the workspace:

   ```bash
   codex exec --skip-git-repo-check -s workspace-write \
     -c model="<cheapest image-capable model>" -c model_reasoning_effort="medium" \
     "<image brief>"
   ```

   The brief must state: exact output paths + filenames, exact pixel size,
   "verify each with sips/PIL before moving on", and the content rules (below).
   Codex loops through a multi-image brief on its own; roughly a minute or so per
   image. It can also EDIT from a reference: name a workspace image file as the
   visual reference and it holds identity/framing across a series.

2. **ChatGPT app chat fallback** (when the CLI route breaks): a plain ChatGPT chat on
   the automatic model has the image tool (Codex-side sessions and some chat models
   do NOT). Drive via computer-use; save each image with right-click → Save Image As.
   Slow and manual; use only when route 1 fails.

## Model + usage rules

- Use the **most token-efficient model that still gives top quality**; step up a tier
  only when output quality falls short. Keep reasoning effort **at or below medium**
  for image work — usage is a real budget.
- Pass `-c` flags per invocation; never edit the user's global Codex config to
  change models.

## Content rules that travel with the pipeline

- **Images are LETTERLESS.** Image models never render brand type, logos, or
  UI; committed generators (e.g. Pillow scripts with the project's fonts and
  contrast floors) do all lettering and compositing. This fails for real:
  a generated batch can silently ship the wrong typeface.
- Series images hold IDENTICAL framing; state the framing in the brief.
- Put the project's bans in the brief itself (e.g. no gradients, no text, no
  watermarks); instructions are obeyed literally, so a stale brief ships stale rules.
- Verify on disk (dimensions via sips/PIL) before compositing; never trust
  "done" text.

## Real product in a generated scene

When a real, purchasable product must appear in a generated room and stay
accurate:
1. Attach the REAL product photo with `-i` and brief "keep the product
   identical: outline, grain, texture, count/shape of every part; only the
   scene and light change". Text-to-image of the product is never acceptable.
2. For lighting that belongs to the room, do NOT relight a finished composite
   with an edit pass. Cut the product out (e.g. a subject-mask tool such as
   macOS Vision), divide out its large-scale shading, place it on flat grey,
   attach THAT, and render the scene fresh with a lighting-first brief:
   establish sources, then light the product only with them, then matching cast
   and contact shadows. Keep the brief and the cutout script in the project so
   the next render reuses them.
3. Check every render side by side with its reference before showing anyone.
4. Type goes on afterwards in code; "text behind the product" = headline on the
   wall layer, product re-composited over it via the same subject matte.

Always run headless `codex exec` with stdin closed (`< /dev/null`); otherwise it
can sit waiting on stdin.

## Failure modes already mapped

- Given a plain "generate images" brief, Codex may WRITE CODE (SVG rendered
  via a raster library) instead of using its image tool, shipping sparse clip
  art. Every brief must say: "use your image generation tool; do NOT write SVG,
  code, or any drawing script." With that line, quality is excellent.
- Free plans: Codex sessions get no image tool; the CLI fallback dies on a missing
  `OPENAI_API_KEY`; the chat image quota exhausts quickly. Symptom text resembles
  "image-generation tool is unavailable in this session". Fix: a paid plan.
- Codex agent sessions inside the ChatGPT desktop app cannot generate in some
  states; the CLI is the reliable surface.
- Codex may write progress notes into a findings file at the workspace root;
  harmless, review or delete.

## Division of labour

The Claude Code session conducts: writes briefs, verifies outputs, composites,
queues, publishes. Codex executes the generation.
