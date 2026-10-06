# Character-narrated video: a mascot narrates and drives the UI

*Applies to any project where a character speaks over, and reacts to, a short
video built in a frame-function renderer. The recommended framework is
**Remotion**.
This playbook covers the whole thing: the audio pipeline and the picture.*

The rule under all of it: **the picture is a pure function of the frame, and
the frame clock is the measured recording.** Nothing is hand-keyed to a
stopwatch, and nothing expressive is a switch.

## 1. Pipeline: the take drives the picture, never the reverse

1. **Script as JSON with stable ids.** One file, the only hand-written timing
   (`open`, `tail`, one `break` between beats). Each line has an `id`; a
   foreign-language line carries native-script / romanized / English fields so the
   caption can print the authored words, not the transcript's.
2. **One continuous voice take.** Record the whole script in a single TTS
   generation with the pauses as spoken `<break>` tags inside the take, never
   line-by-line then stitched; a per-line read swings warm-to-excited between
   neighbours. One take also means one voice for a mixed-language script; pick
   the TTS model that covers every language and pin stability high so identity
   does not drift.
3. **Word timestamps measured from the recording.** Transcribe with word-level
   timestamps, walk the script's words through the transcript in order, and
   **assert the take says what the script says** (token counts match or the
   build fails). A beat's window runs to the START of the next beat, so the
   pause the narrator actually left is the pause the picture holds.
4. **Check for glued tokens.** A transcript token much longer than the
   take's normal word (> ~0.6 s) usually starts inside the silence before it.
   Snap ONLY those forward to where the take's loudness returns after the
   silence; never snap ordinary words, and never cue from an interpolated one.
5. **Refine the foreign line.** A mixed-language single transcription pass tends to
   swallow the foreign words and mistime the next English word. Re-transcribe just
   that line's audio window and splice its timings; the times still come from
   measuring, never from typing numbers into the timeline JSON.
6. **Every beat is cued by a word, never a hand-picked frame.** `cue(lineId,
   word)` / `atWord("tap","open")`: the button presses on "tap", the
   panel opens on "open". Re-record at a different pace and every picture
   follows. Hand-editing the timeline JSON is forbidden.
7. **Captions from the same timeline.** One caption, always the same place,
   authored words with measured timings. No paraphrase headline competing with
   it.

## 2. The character rig as a pure function of frame

Port the app's own rig if one exists; do not re-invent motion for video.

- **Waypoint script.** A list saying where the character is, what lane (ground) it
  stands on, what its face does, and what happens on arrival (`moment`). Physics
  (jelly stretch from speed, landing squash, blink, breath, wobble) is derived
  from the script, not keyed.
- **Moments, not cuts.** `land`, `bump`, `nod`, `flinch` (startle squash,
  recovers in ~1/3 s), `grab` (brace squash, opposite sign). Every one is a
  spring TARGET, so even a landing ramps in over ~3 frames instead of appearing
  full-depth on the impact frame.
- **Springs for every expressive value, using the source app's constants.**
  Typical ranges: eyes stiff and well-damped, gaze softer, lean lightly damped,
  squash very stiff, a "ball" morph near-critically damped. A gaze is the value of a
  spring whose target the state machine moves, never a cosine between two
  waypoints; that is what stops abrupt moves that break the illusion. While a
  finger or target is being followed, position IS the target; spring only the
  secondary read.
- **Family-change routing for shape morphs.** Blending two outlines index-for-
  index rotates the shape when they start at different points. Build the
  target FROM the source (open eye with y scaled), and route a lid as a
  bar-to-arc family change, not a point blend. An end-of-film logo morph should
  port the app's own glyph geometry verbatim.
- **Hops and rolls.** Hops carry a crouch, an airborne stretch, and a settle;
  rolls ball up into a true circle (stiff ball spring so the character reaches a
  full ball mid-roll, critically damped so it never shrinks below rest radius).
- **World-fixed lighting.** Highlight/rim/specular counter-rotate by spin plus
  lean about the body centre, so light reads as fixed to the world, not painted
  on the body (a rolling character with body-space shading looks like a
  sticker). Rim biased toward the light; a sprung light-lag trails a few units;
  ground shadow shrinks and lightens with lift height plus a contact-shade pass
  on touchdown.
- **Deterministic blinks** from a schedule, not random per render.
- **Memoised fixed-step integration.** A render has no clock, so integrate the
  springs with a fixed step from frame 0 to the drawn frame (semi-implicit
  Euler, ~2 substeps), memoised per script object. Same frame, same numbers, any
  worker, any order. NOTHING wraps the frame; a modulo would make the loop-seam
  check vacuously true.

## 3. Layout and staging

- **Props centred** on the canvas x-axis, **one prop on stage at a time**;
  bring a prop on only for the beats it serves and take it off after.
- **Containers never empty**; the character never covers the text.
- **Parked elements' shadows must not leak through their clip.** A clipped slot
  cuts a box-shadow into a flat grey band; grow each slot past its content by
  the shadow's reach. Assert per-slot shadow clearance in the check.
- **Caption band** fixed in one place.
- **One shared end card** for every narrated post: wordmark, store badge/pill (a
  plain grey sentence reads as a caption, not a call to action), muted maker
  lockup. Everything arrives through slots; **nothing fades**. A dissolve on a
  silent feed reads as a loading state.
- **Flat background by default**; a gradient or photo variant is a separate
  composition, not the default.

## 4. Sound

- **SFX on every cue, with a visible reaction within ~3 frames.** A chime gets
  a hop, a record beep gets a startle, a card landing gets a squash. A whoosh
  fired where nothing moves is a mistake; every cue marks something the eye can
  see happen.
- **Generated hits via ffmpeg** (pop, tick, whoosh, thud, rumble) in one folder;
  product-real sounds (the app's actual chime, ported sample-for-sample) beside
  them. Reuse the app's real audio where it exists.
- **Music ducked under VO**: step the bed down under every measured line and
  return it in the pauses; the last beat, with no voice to protect, plays open.
- **`volumedetect` gate**: max volume under 0 dB on the rendered file, so no cue
  or bed clips.

## 5. Per-composition checks, and the review ritual

A pure motion module the components render from is also read by the checker, so
it cannot drift from what is on screen. Assert, per composition:

- **Waypoint order** strictly increasing (out-of-order waypoints freeze motion
  then teleport); derive dependent waypoints from the cue they must bracket
  (`CARD_OUT - 10`), never from an unrelated cue plus an offset.
- **Per-frame displacement caps** (walk / flight / fast) so no adjacent-frame
  teleport survives.
- **Inside-frame** except deliberate overhead; **blinks all finish** before the cut
  and there are enough of them (roughly 8+ in 30 s or the character reads as a still).
- **End state geometric**: if a morph lands on a logo, assert every morph point
  lands on its part of the glyph (rotated by any icon tilt), not a slot flag; the
  morph completes to 1.
- **End card at rest** 45+ frames (1.5 s at 30 fps), reachable and readable.
- **No footer during the morph**: the lockup and the logo morph never share a
  frame.
- **Looping posts only**: state at `LOOP_FRAMES` equals state at 0, AND
  measure the encoded seam against an adjacent-pair baseline; the pure check is
  necessary, not sufficient.
- Layout caps derive only from available ROOM, never from a measured size that
  feeds back into itself.

**Review ritual (an agent must LOOK, not eyeball a contact sheet):** render
stills at the cue frames; a contact sheet at ~0.5 fps for coverage; dedicated
STRIPS for the face route, a hop, a roll, and the lighting (highlight sits at
the same screen position every frame while the face turns); a teleport probe
printing position and per-frame displacement (a contact sheet hides a large jump
every time); then **transcribe the rendered output back** and compare word
timings to the timeline (worst drift under ~0.15 s). Reproduce route-dependent
"missing view" bugs on both routes; a button that exists but paints nothing is a
geometry bug, not z-order.

## 6. Taste-decision log (do not re-litigate taste)

Keep a dated block in the project's kit doc so decided taste is not re-opened:

> **YYYY-MM-DD, <decision>.** <what was chosen> / <what it replaces> /
> <one-line reason in the decision-maker's words>.

Typical entries: flat background vs photo; pace and length (e.g. 30 s with holds
vs a 12 s cut); SFX on every cue; the shared end card is the one ending; store
badge style.

## 7. Start a new post in 10 steps

1. Copy the script JSON; write lines with ids, foreign fields, `open`/`tail`.
2. Record: one take, right voice/model, high stability.
3. Build the timeline from the take (with a refine pass for any foreign line).
   The build fails if the take drifts from the script; fix the take.
4. Author the waypoint script: cues via `atWord`, dependent waypoints derived
   from the cue they bracket. One prop on stage at a time.
5. Place SFX cues so each has a reaction within 3 frames; duck music under the
   lines.
6. Reuse the shared end card and the shared springs; never fork them.
7. Run the checks green (order, displacement, in-frame, blinks, end geometry,
   shadow clearance, seam for loops).
8. Render; run the `volumedetect` gate.
9. Review ritual: strips, teleport probe, transcribe-back drift.
10. Log any new taste decision; publish media only after the user or client approves
    the direction.

## Suggested kit layout

- A rig README (geometry, script format, springs, hops, rolls, lighting, logo
  morph, taste rules), a post playbook (script → take → timeline → motion → SFX →
  checks → review → publish), and a runnable template post with a stub timeline
  and one of every check.
- Pipeline scripts: `record`, `build-timeline`, `check-posts`.
