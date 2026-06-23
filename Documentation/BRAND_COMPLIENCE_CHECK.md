# Brand Compliance Checker — How It Works

A feature inside the slotm app that lets a user upload a client PowerPoint (`.pptx`),
automatically checks it against ACME's brand rules, lets the user review and accept/reject each
finding per slide, and produces a corrected deck — with the offending regions highlighted and a
before/after preview.

It is a **hybrid engine**:

- **Deterministic rules** — precise, user-defined rules stored in the database (exact font size,
  color, font family, forbidden text). Checked in code; fast, reproducible, and auto-fixable.
- **AI rules** — everything subtler comes from an **editable brand-guidelines document**. The
  AI (Claude, run via the Claude Code CLI) reads those guidelines and checks each slide against
  them, including measurable things it can see in the slide's structure.

Nothing is hardcoded: deterministic rule *types* are code, but the actual rules are data the user
creates; the AI rules live entirely in the editable guidelines.

---

## 0. Prerequisite — connect Claude Code (in the Docker image)

The AI half is powered by the **Claude Code CLI installed inside the `node` Docker image**
(`npm install -g @anthropic-ai/claude-code` in `docker/node/Dockerfile`). It authenticates
non-interactively with an OAuth token:

```
# root .env  (gitignored — never commit this)
CLAUDE_CODE_OAUTH_TOKEN=sk-ant-oat01-...
CLAUDE_MODEL=sonnet            # haiku = fastest/cheapest, sonnet = balanced (default), opus = deepest
```

- `docker-compose.yml` passes both into the `node` container's environment.
- The app spawns `claude -p "<prompt>" --output-format json --model <model>` with that token in
  the child process env (`src/lib/claudeCli.ts`). All CLI calls run with `cwd` set to a scratch
  dir so Claude doesn't scan the repo.
- The **Brand Check** page shows a live **Claude status chip** (`GET /api/compliance/claude-status`,
  cached 60s so polling doesn't compete with an in-flight scan for the token's rate limit).
- **"Run Brand Check" is disabled until a `.pptx` is staged AND Claude is connected.**

If the token is missing/expired, the chip shows *Claude offline*; deterministic rules still run,
but the AI pass is skipped.

> Generate a token with `claude setup-token` on a machine where you've logged into Claude Code,
> paste it into `.env`, and `docker compose up -d node`.

---

## 1. Define the rules (two sources)

### a) Deterministic rules — `/rules` (subpage: "Deterministic rules")

Simple, exactly-checkable rules the user creates in the UI. Stored in the `deterministic_rules`
table. Each rule has a **type**, a **scope**, a value, a **severity**, and an **auto-fix** toggle.

| Type | Example | Scope | Auto-fix |
|------|---------|-------|----------|
| `font_size` | Titles must be **40pt** | title / body / any | sets the run size |
| `font_color` | Titles must be **#FF0000** | title / body / any | recolors the run |
| `font_family` | Any text must be **Calibri** | title / body / any | sets the typeface |
| `forbidden_text` | Must not contain **"DRAFT"** | any | removes the text |

- **Scope** maps to PowerPoint placeholder types: *title* → `title`/`ctrTitle`, *body* →
  `body`/`subTitle`, *any* → all text (and table cells).
- Rules can be **added, edited, and deleted**. They apply on the next scan.
- Limitation: deterministic checks only see **explicitly set** properties. If a title's size/color
  is inherited from the slide master (no value on the run), the rule can't read it — those cases
  fall to the AI pass.

API: `GET/POST /api/rules`, `POST /api/rules/:id` (update), `POST /api/rules/:id/delete`.

### b) Brand guidelines — `/guidelines`

A single editable Markdown document (the `guidelines` table, seeded from
`ACME-brand-guidelines.md` on first boot). This is the **rubric the AI uses** — add/remove rules
here in plain English and the AI checks against them on the next scan. Edit in a textarea and Save.

API: `GET/POST /api/guidelines`.

---

## 2. Upload a deck

On **Brand Check** (`/compliance`): drag-and-drop or browse a `.pptx`. The client validates the
extension and size before upload; Nginx allows up to 35 MB (`client_max_body_size`), the app caps
at 30 MB. The original file is stored and an **analysis set** is created (per-user, owned).

API: `POST /api/compliance/upload` (multipart, field `deck`).

---

## 3. Scan

Click **Run Brand Check** → `POST /api/compliance/:setId/analyze`. The server (`ComplianceService`):

1. **Parses** the PPTX (`PptxDocument`, via `jszip` + `fast-xml-parser`) into a structured model —
   per slide: shapes with text, **fonts, sizes, bold/italic, hex colors**, table **rows/cells with
   fills**, positions (EMU), and placeholder type.
2. **Deterministic pass** — runs the user's DB rules against the parsed deck
   (`evaluateDeterministicRules`). Each match is a precise flag carrying a reversible **fix op**.
3. **Renders** the clean **original** to PNGs and an **annotated** preview (highlight boxes +
   per-slide caption baked into a throwaway preview deck via LibreOffice → PDF → `pdftoppm`),
   then flips the set to **reviewing** so the user can act immediately.
4. **AI pass** — one Claude call per slide: the slide's structured description **plus the full
   guidelines** are sent, and Claude returns findings (ruleId, message citing actual-vs-expected,
   severity, the offending shape index, confidence). The AI maps each finding to that shape's real
   bounding box for highlighting.
5. The annotated preview is **rebuilt** with all flags' highlights and re-rendered.

The client **polls** `GET /api/compliance/:setId` and shows live progress
("Checking your deterministic rules… → Rendering… → AI review: N of M slides…"). Deterministic
flags + slide images appear in ~30s; AI findings stream in behind a progress banner.

---

## 4. Review — accept / reject / undo

The review panel is a single column: **flags on top, full-width slide preview below, thumbnails
under it**.

- Each **flag card** shows a severity dot + label, the rule id, a plain-English message
  (actual vs expected), a **category badge** (Deterministic vs AI), and — for AI flags — a
  confidence chip. Auto-fixable flags say *"↺ auto-fixes on apply"*; advisory ones say
  *"✎ manual fix — not auto-applied"*.
- **Accept / Reject** each flag (optimistic UI, persisted via
  `POST /api/compliance/flags/:id/accept|reject`). **Undo** reverts the last decision.
- **Accept all** accepts every pending flag across all slides in one click.
- **Noise control:** severity filters (defaults to Critical + High), AI suggestions collapsed into
  a separate group, "hide resolved", per-slide flag-count badges on thumbnails.
- A summary header shows total / accepted / rejected / open counts and a compliance score.

---

## 5. Preview versions — Original · Annotated · Corrected

Above the full-width slide image, a toggle switches the rendered version:

- **Original** — the deck exactly as uploaded.
- **Annotated** — translucent highlight boxes over every flagged region + a caption listing the
  slide's findings (this is also what makes the issues visible at a glance).
- **Corrected** — appears after Apply; the deck with accepted fixes applied.

Thumbnails below let you jump between slides; the active version is remembered as you navigate.

---

## 6. Apply — build the corrected deck

Click **Apply accepted fixes** → `POST /api/compliance/:setId/apply`. For every **accepted** flag:

- **Deterministic** flag → its stored **fix op** is replayed on a fresh copy of the original
  (set size, recolor, set font, remove text). Precise and reversible.
- **AI flag on a text shape** → Claude rewrites that shape's paragraphs to resolve the issue
  (same paragraph count, meaning preserved), and the rewrite is written into the deck.
- AI/positional issues that can't be safely auto-edited stay **advisory** (reported as "needs
  manual editing").

A **live progress indicator** runs next to the button ("Applying AI fix N of M… → Building
corrected deck… → Rendering corrected slides…"). The corrected deck is rendered to PNGs and the
preview switches to **Corrected**. The toast reports how many fixes were applied vs. left for
manual editing.

> Accepted, auto-fixable changes are always written to the corrected file — that is the "final
> version" of the deck.

---

## 7. Re-scan with AI

After editing your **deterministic rules** or the **guidelines**, open the set and click
**Re-scan with AI** (`POST /api/compliance/:setId/rescan-ai`). It re-evaluates the deck against
the *current* deterministic rules **and** guidelines, replaces the flags, and re-renders the
highlights — with the same live progress.

---

## 8. History and downloads

- **My uploads** (`/compliance/history`) lists every analysis set you've created (title, date,
  slide count, status). **Open** reloads a set's review (`/compliance?set=<id>`); **Delete**
  removes the set, its flags, and all its files (two-click confirm).
- Each set keeps **three files** — original, annotated preview, corrected — all downloadable from
  the output bar (served from `/assets/uploads/compliance/`).

---

## Data model (Prisma)

| Table | Purpose |
|-------|---------|
| `guidelines` | The editable AI rubric (Markdown), seeded from `ACME-brand-guidelines.md` |
| `deterministic_rules` | User-defined precise rules (type, scope, value, severity, auto-fix) |
| `analysis_sets` | One upload/analysis, owned by a user; status + phase |
| `analysis_files` | The original / preview / corrected files for a set |
| `slide_renders` | Per-slide PNGs, by kind (original / annotated / corrected) |
| `flags` | Findings: rule id, category, severity, status, message, location (shape + bbox), fix op |

## Key code

| Area | File |
|------|------|
| PPTX parse / edit / re-zip | `src/compliance/PptxDocument.ts`, `xml.ts`, `model.ts` |
| Deterministic engine | `src/compliance/deterministic.ts` |
| Preview build + LibreOffice render | `src/compliance/renderPreview.ts` |
| Claude CLI wrapper | `src/lib/claudeCli.ts` |
| AI scan + text fixes | `src/services/ComplianceAiService.ts` |
| Orchestration (scan/apply/rescan) | `src/services/ComplianceService.ts` |
| Deterministic rule CRUD | `src/services/DeterministicRuleService.ts` |
| HTTP layer | `src/controllers/ComplianceController.ts`, `src/routes/{compliance,rule,guideline}.routes.ts` |
| UI | `src/views/{compliance,guidelines,rules,history}.hbs`, `src/client/{compliance,guidelines,rules,history}.ts` |

## Endpoints

```
# Pages
GET  /compliance              upload + per-slide review
GET  /compliance?set=<id>     open an existing analysis
GET  /compliance/history      my uploads
GET  /guidelines              edit the AI rubric (markdown)
GET  /rules                   manage deterministic rules

# Compliance API
POST /api/compliance/upload            (multipart "deck")
POST /api/compliance/:setId/analyze
POST /api/compliance/:setId/rescan-ai
POST /api/compliance/:setId/apply
POST /api/compliance/:setId/delete
GET  /api/compliance/:setId            review payload (flags, slides, files, progress)
GET  /api/compliance/sets              list my sets
GET  /api/compliance/claude-status
POST /api/compliance/flags/:id/accept
POST /api/compliance/flags/:id/reject

# Rules & guidelines
GET/POST /api/guidelines
GET  /api/rules    POST /api/rules    POST /api/rules/:id    POST /api/rules/:id/delete
```

## Known limitations

- **Inherited properties:** deterministic rules only see explicitly-set font/size/color; values
  inherited from the slide master aren't visible (the AI pass covers those by reasoning).
- **Cross-slide rules** (e.g. "footer on every slide", "term used consistently across the deck")
  are weaker, since the AI evaluates one slide at a time.
- **AI latency/cost:** each slide is one Claude CLI call (~10–20s), so a large deck's AI pass takes
  a few minutes; the deterministic pass and slide previews are instant. Use `CLAUDE_MODEL=haiku`
  for faster/cheaper runs.
- **AI rewrites** change wording/structure only — they won't reposition shapes or restyle layout.
