# Device demo video: an app shown running on real hardware, in motion

*Applies to any short looping post that shows an app on a device: a new-device
announcement, a feature walkthrough, a store preview. Built with **Remotion**
(the recommended video framework). Sibling of
`character-narrated-video.md` (that one is the narrator; this one is the device
and the UI).*

The rule under all of it: **the device is a prop, the UI is the subject, and
the UI moves the way the real app would.** Every frame is a pure function of
the frame number, so the loop, the click and the timing can be asserted before
anything is rendered.

## 1. Research first, from the platform owner's own materials

- Pull the platform's design guidance for the device (human interface guidelines,
  the developer "designing for" article, the product page and newsroom). Extract the
  layout rules into the code's header comment, then obey them in the mock UI. For a
  foldable, that typically means: where the control strip lives, where time and
  status sit relative to the camera, one extra level of hierarchy on the big display
  (list beside detail), pane controls kept with their pane, state carried across the
  fold, small layout changes only.
- Use the platform owner's official device bezels for the frame. Derive masks from
  their alpha; never guess corner radii. Check each PNG's opaque extent: there is
  clear margin around the frame, and files at "the same scale" can differ by a few
  percent.
- Licensing and marketing rules are the owner's call, not yours. Some platform
  guidelines forbid animating product images; say so plainly, give options, and do
  what the user chooses.
- Truth in the claim: if the layout is not in a shipped build, the copy says
  "coming to", never "ready for" or "optimized for".

## 2. The UI is recreated, in points, from the real app

- Rebuild the screens as components in the device's point space, then scale by
  px-per-point into the bezel's screen rect under the mask. Copy tokens, fonts,
  card shapes and hierarchy from current light/dark captures of the real app,
  and icons from the platform's own symbol set (e.g. render system symbols to PNG
  with a small native script, tint with CSS masks, preload them).
- Content is copied verbatim from the product's data by id. Nothing is authored
  for the post.
- Every shared element has a rect per layout (compact, wide) and interpolates
  between them on a calm spring (under 4% overshoot). Text reflows with the
  width, as it would on device.
- A card is always exactly as tall as what it holds: rows that drop in grow the
  card; nothing sits empty. Nothing important is clipped; let long lines wrap.
- The app's own character, if it has one, lives in the UI where the app docks
  it, driven by the same rig and one shared expressive performance across both
  screens so its face is continuous through the transition.

## 3. The hardware move (the fold, the flip, the unfold)

- Build it as separate faces, each with its OWN `perspective()` about one shared
  eye point, the pivot baked into the transform
  (`translateX(p) rotateY(a) translateX(-p)`, origin `0 0 0`), depth by paint
  order. A shared `preserve-3d` context in headless Chrome can open a gap at the
  hinge at steep angles and ignore px transform-origins.
- When the device is at rest, draw it as ONE untransformed piece. Two halves
  meeting at a hinge leave an anti-aliased hairline. While moving, let the lower
  face reach a few px under the moving edge.
- Copy the platform owner's lighting, not your own: e.g. a dark falloff AND a strong
  blur on the turning panel, deepest at the side turning away, gone when the panel
  faces the camera. Implement as a gradient overlay plus a backdrop blur inside the
  screen's mask, both masked by a whole-device silhouette (the bezel alpha alone is
  clear over the screen).
- A screen is never shown dead: keep the outgoing display lit until it is nearly
  edge-on, and light the incoming one as soon as it peeks out.
- Closing accelerates into the latch so the click lands on the fastest frame;
  a small whole-device kick on the click and on landing flat.
- Do not animate a layout change the viewer would never see (e.g. the inner display
  reflowing back before folding; that happens unseen once shut).

## 4. Camera and staging

- One camera track (keyframes of focus + scale, eased) over a world in the
  bezel's own pixel space. Push in to make the UI readable on a phone, pull out
  for the hardware move. Crop the device freely; never crop the text being read.
- The series' frame rules still hold: flat ground, props centred, captions are
  short kickers in one band that drop in and out, one at a time.
- End on the brand card (icon, wordmark, a subtitle line for the claim, the store
  badge, the maker lockup). Skip decorative extras the user or client has vetoed.
- The loop hand-back is ONE scroll: the end card leaves as a group moving down
  while the device drops in from above at the same speed, locked together. Do
  not let the card's pieces exit separately while the device moves; they fight.

## 5. Sound

- Generate the hardware foley per project (an AI sound-effects generator works): an
  unfold glide, a fold glide with no click in it, and a separate crisp magnetic
  click. Prompt for close-up foley, never "cinematic whoosh". Cache raw takes,
  choose by measurement (onset, energy in the first 25 ms for the click), trim
  glides at 2% of peak so their rise survives.
- The click is the loudest thing in the mix, layered with a soft low thud.
  UI taps, pops and ticks come from your project's SFX library, one per visible event.
- Your project's music bed under it, faded at both ends so the seam is silent.
- Master to the series' approved level (e.g. about -16 LUFS, peak under -1 dBTP)
  with a gain plus a transparent limiter; then measure the click onset against its
  frame.

## 6. Checks to write (pure, before rendering)

Loop seam state at N equals state at 0; the device closed at both ends and
flat mid-way; the click on the closing frame and the fastest one; springs under
4% overshoot; the device locked to the hand-back scroll; waypoints in order;
the icon morph lands; the end card at rest 45+ frames; captions never overlap
and are gone before the end card; blinks, none across the seam; all drivers
finite.

## 7. Review, then deliver both formats

- Stills at every beat and a strip through each move; zoom the hinge. Watch for
  hairlines, dead screens, clipped copy, overlapping chrome.
- Stories (9:16) is its own composition: the same 4:5 stage centred in
  1080 x 1920, with travel distances raised so falls and scrolls leave the taller
  frame (padding the 4:5 file would cut them off mid-screen). Everything stays in
  the Stories safe band (roughly top 250 px, bottom 340 px).
- Deliverables: feed mp4, story mp4, and a caption `.txt` next to them, published
  only after the user or client approves.

## Taste decisions log

Keep a dated list of the user's or client's taste calls for the series (fold style,
lighting, claim wording, end-card behaviour, SFX character,
ground colour, store badge style) so later rounds don't re-open them.
