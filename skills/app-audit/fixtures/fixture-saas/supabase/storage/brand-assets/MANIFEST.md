# brand-assets bucket contents

This bucket is **public on purpose**: it holds the marketing logo files that the
website, the press kit, and partner sites load directly. Nothing user-generated
is written here — there is no upload path in the app that targets this bucket
(see `app/api/uploads/route.ts`, which always writes to `note-attachments`).

Full listing as of 2025-06-02:

| object | type | bytes |
|---|---|---|
| `logo/notably-mark.svg` | image/svg+xml | 3,114 |
| `logo/notably-mark-dark.svg` | image/svg+xml | 3,140 |
| `logo/notably-wordmark.svg` | image/svg+xml | 6,802 |
| `logo/notably-wordmark-dark.svg` | image/svg+xml | 6,844 |
| `logo/notably-icon-512.png` | image/png | 18,220 |
| `press/notably-press-kit.zip` | application/zip | 204,551 |

The press kit zip contains the same four SVGs plus a one-page product blurb.
