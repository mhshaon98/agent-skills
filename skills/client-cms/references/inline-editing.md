# client-cms: optional on-site inline editing tier

Read before building inline editing (Phase 4), only where the stack already has draft/preview mode and server-side auth.

**Optional higher tier — on-site inline ("live") editing.** When the stack already
supports a draft/preview mode plus server-side auth (a headless CMS with draft mode, an
SSR app with sessions), a strong admin experience is letting staff edit approved copy
IN PLACE on the real page, not only in a separate dashboard. Proven pattern:

- **Entry point = a persistent staff bar, not a `?edit` URL trick.** Show logged-in
  staff a fixed bar on every page (identity, dashboard link, log out, edit-mode
  toggle). Detect the staff session CLIENT-side (a tiny probe endpoint) so the page
  layout never reads cookies/headers and public pages stay static/cacheable; the bar
  renders nothing for anonymous visitors. Add a "View site" link inside the dashboard
  too, so staff can reach the live site after logging in.
- **Double gate, server-enforced.** Edit mode is ON only when BOTH a draft/preview flag
  is set AND the request still carries a freshly re-verified staff session — never
  loosen to one. The client bundle is never the authorization boundary; the public
  build must be marker-free (code-split the editor out of it) and leak no PII.
- **Writes reuse the SAME content endpoints** as the dashboard (no parallel write path)
  so server-side auth, validation, sanitization, any auto-translate, and cache
  revalidation all come from Phase 2's single content module.
- **Inline-edit UX — each point learned from a real bug:** intercept only the click
  that ENTERS edit mode — never `preventDefault` a click inside an already-active
  field, or the user can't place the caret or drag-select; seed the caret from the
  pointer (`caretRangeFromPoint`/`caretPositionFromPoint`), not the end of the text;
  give the active field a distinct color and an explicit `caret-color` so the cursor is
  visible; provide Undo (toolbar button AND ⌘Z/Ctrl+Z sharing one path). Mark all
  editor chrome with an exclusion attribute so the overlay's own document-level click
  handler ignores its clicks.
- **Verify the editor's visual CSS by screenshot, not `getComputedStyle`** — an editor
  that re-wraps text spans via a MutationObserver makes computed-style reads on those
  spans return stale defaults even when the rule is applying.
