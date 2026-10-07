# Brand profile for engineering documents

The engine ships with no company identity. Each user supplies theirs once, as a brand
profile, and every document after that carries it.

## The profile

`brand.json`, saved by `eng_report.py brand` together with a copy of the logo:

| Where | Applies to |
|---|---|
| `./.eng-report/brand.json` | This project (checked first) |
| `~/.eng-report/brand.json` | Every project on this machine |
| `--brand-file path.json` | One run only |

| Field | Meaning | Default |
|---|---|---|
| `company` | Printed in the footer copyright line and on the cover | required |
| `tagline` | Follows the company name | none |
| `logo` | File name of the logo, next to `brand.json` (PNG, JPG, GIF, BMP or TIFF) | none: the company name is set in type |
| `accent` | Hex. H1 rule, header rule, cover band. Never text. | `1F4E79` |
| `head` | Hex. H1 and H2 text. | `1A1A1A` |
| `link` | Hex. Hyperlinks. | the accent when saved with `brand`; `1F4E79` if a hand-written profile omits it |

Commit `.eng-report/` with the project if the team shares the branding; leave it out if
the logo is not yours to redistribute.

## First run: what to ask the user

No profile means nothing to pull a name, logo or colours from. Ask for them; never invent
them and never reuse another organisation's.

1. Company name and optional tagline.
2. The logo file. SVG, PDF and AI files must be exported to PNG. Prefer a horizontal
   logo on a transparent ground, 600 px wide or more.
3. The accent colour as hex. A brand guideline or the company website usually states it;
   read it there if the user points to one, then confirm the value with them.
4. Optional heading and link colours.
5. Project or machine scope.

## Fixed palette (not brand colours)

| Token | Hex | Role |
|---|---|---|
| Ink | `#1A1A1A` | Body text; default heading colour |
| Charcoal | `#3E3E3E` | Table header fill, H3/H4, labels |
| Grey | `#6B6B6B` | Footer, captions, secondary labels |
| Rule grey | `#BFBFBF` | Table borders, footer rule |
| Pale grey | `#F1F1F1` | Note / Tip panel fill |

Safety colours are ANSI Z535 and are never recoloured to match a brand: DANGER `#C8102E`
(white text), WARNING `#FF7900` (black), CAUTION `#FFD100` (black), NOTICE `#005EB8`
(white italic, no alert symbol).

If the brand accent is itself a red, orange, yellow or safety blue, keep it to the thin
rules and the cover band. Do not use it for panel fills, table headers or text, so a
reader never mistakes decoration for a hazard notice.

## Type

Documents use **Arial** throughout, because it is on every machine: body 10.5 pt at 1.15,
H1 15 pt, H2 12.5 pt, H3 11 pt, tables 9.5 pt, footer 8 pt, Consolas for code, tags and
parameter names. A brand typeface is not embedded: a document that reflows on the
customer's machine is worse than one in Arial.

## Logo rules

- Header: logo 0.32 in high, left; document title and type right-aligned.
- Cover: logo 0.85 in high, top-left, then the accent band.
- Never stretch, recolour or outline the logo. A light logo made for dark grounds will
  vanish on the white page: ask for the version meant for light backgrounds.
- Campaign graphics are not document logos.
