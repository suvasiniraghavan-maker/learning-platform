# Learning Platform

A zero-cost, static learning platform built from a JSON knowledge base. It
renders study pages, a spaced-repetition quiz, full-text search, and produces
per-section Markdown bundles for Gemini Notebook.

## Stack

| Layer | Choice | Cost |
| --- | --- | --- |
| Content | `content/kb.json` + Zod schema | $0 |
| Site | Astro (static) + React quiz island | $0 |
| Search | Pagefind (build-time index) | $0 |
| Hosting | Cloudflare Pages | $0 |
| Notebooks | Gemini Notebook API / Markdown bundles | $0 during preview |

## Quick start

```bash
npm install          # already done once
npm run dev          # http://localhost:4321
```

Other commands:

```bash
npm run validate     # check content/kb.json against the schema
npm run build        # static build + Pagefind index in dist/
npm run preview      # preview the built site
npm run notebooks    # write per-section Markdown bundles to dist-notebooks/
npm run sync-notebooks -- --dry-run   # preview Gemini Notebook sync
npm run check        # validate + build
```

> **Windows note:** if `npm` is not recognized in a new terminal, close and
> reopen it. If PowerShell blocks `npm.ps1`, run
> `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once.

## Project structure

```
content/kb.json            ← generated content (the only content file the site reads)
exports/                   ← extracted Markdown from the original chat export (gitignored)
src/lib/schema.js          ← validation contract (shared by build + CLI)
src/lib/kb.ts              ← typed access to the knowledge base
src/pages/index.astro      ← tracks + modules list
src/pages/sections/[section].astro
src/pages/quiz/[section].astro
src/components/Quiz.tsx    ← auto-graded MCQ + spaced repetition (localStorage)
src/pages/search.astro     ← Pagefind UI
scripts/validate.mjs       ← readable validation errors
scripts/import-chat-export.mjs ← chat export → content/kb.json
scripts/build-notebooks.mjs
scripts/sync-notebooks.mjs
dist-notebooks/            ← generated notebook bundles (gitignored)
```

## Editing the knowledge base

`content/kb.json` currently holds the full curriculum: **19 tracks + modules
A–C, 152 items (145 multiple-choice questions + 7 hands-on labs)**.

Shape:

```jsonc
{
  "version": 1,
  "title": "My Course",
  "description": "Optional",
  "sections": [
    {
      "id": "track-1-tokens-context-windows",
      "title": "Tokens, Context Windows, Temperature",
      "description": "Optional",
      "track": 1,                 // null for modules
      "module": null,             // "A", "B", "C" for modules
      "priority": "BUILD FIRST",
      "focus": "Optional",
      "items": [
        {
          "id": "q1-1",
          "kind": "mcq",          // "mcq" | "lab"
          "question": "…",
          "answer": "B) …",
          "reasoning": "Why the correct option is right.",
          "level": 3,             // 1–5, null for labs
          "levelName": "Trade-off",
          "principle": "One-sentence rule to remember.",
          "pmImplication": "What to put in the PRD.",
          "labInstructions": "",  // only for kind: "lab"
          "tags": ["level-3", "trade-off"],
          "difficulty": 3,
          "choices": [
            {
              "id": "A",
              "text": "…",
              "correct": false,
              "explanation": "Why this option is wrong."
            }
          ],
          "resources": [
            {
              "title": "Anthropic: Prompt Caching",
              "type": "Official",
              "url": "https://…"
            },
            {
              "title": "Gen Academy: Caching",
              "type": "Video Style",
              "search": "gen academy prompt caching"
            }
          ],
          "geminiPrompt": "Optional reflection prompt for Gemini Notebook."
        }
      ]
    }
  ]
}
```

Rules enforced by `npm run validate`:

- `version` must be `1`.
- Section and item `id`s must be lowercase kebab-case and globally unique.
- Every item needs a non-empty `question`.
- `kind: "mcq"` items need at least two `choices` and **exactly one** with
  `correct: true`.
- `kind: "lab"` items need `labInstructions`.
- `level` is an integer from 1 to 5 (or `null` for labs); `difficulty` is 1–5.
- `resources[].url` must be a valid URL. Resources with only a `search` string
  are linked to a Google search at render time.

### Regenerating content from the chat export

The original chat export was extracted to `exports/` and parsed with:

```bash
node scripts/import-chat-export.mjs      # writes content/kb.json
npm run validate
```

The parser reads the canonical assistant documents (`msg-05`, `msg-07`,
`msg-09`), handles both table-based and list-based option formats, extracts
principles, PM implications, resources, Gemini prompts, and the seven labs in
Module C. The `exports/` folder is gitignored; keep the original chat export
JSON somewhere safe if you want to re-run the pipeline.

## How the quiz works

- The quiz filters out `kind: "lab"` items; labs live on the study page.
- Pick an option to grade it immediately. The feedback panel shows why every
  option is right or wrong, the principle, the PM implication, resources, and
  the Gemini Notebook prompt.
- Due cards come first, then unseen cards, both shuffled.
- Rating a card updates a local SM-2-style schedule:
  - **Again** → 1 day, ease decreases.
  - **Good** → 1 day, then 3 days, then grows by the ease factor.
  - **Easy** → 2 days, then grows faster.
- Progress is stored in `localStorage` under `lp.progress.v1`.
- Keys: `A`–`E` select an option, `Space` reveals without answering, `1` / `2`
  / `3` rate after answering.

## Deploy to Cloudflare Workers (free)

The site is a fully static Astro build, so it deploys as Workers Static Assets.
`wrangler.jsonc` points Wrangler at `./dist`, which includes the Pagefind search
index generated by `postbuild`. No Astro adapter is needed.

1. Push this folder to a GitHub repository.
2. In the Cloudflare dashboard: **Workers & Pages → Create → Workers →
   Connect to Git**, and pick the repo.
3. Settings:
   - Worker name: `quizai` (must match `name` in `wrangler.jsonc`)
   - Build command: `npm run build`
   - Deploy command: `npx wrangler deploy`
   - Build output directory: `dist`
   - Environment variable: `NODE_VERSION = 22`
4. Deploy. Every push to `main` redeploys automatically.

To deploy by hand instead:

```bash
npm run build
npx wrangler deploy
```

Because `assets.directory` is `./dist`, the whole build output — HTML,
`_astro/` assets, and `pagefind/` — is uploaded together. Pointing Wrangler at
`dist/client` (what the Cloudflare adapter emits) will break search.

No environment variables or secrets are required for the site itself.

## Gemini Notebook bundles

Generate the source files:

```bash
npm run notebooks
```

You get:

```
dist-notebooks/
  index.md
  <section-id>.md
  manifest.json     ← section → file, content hash, notebook id/url
```

Each `<section-id>.md` contains the section description, every question with its
options (correct options marked), answer, reasoning, principle, PM implication,
tags, further reading, and the per-item Gemini Notebook prompt. Labs include
their full instructions.

### Option A — manual (works today)

1. Open <https://notebook.google.com>.
2. Create a notebook named after the section.
3. Add the matching `.md` file as a source, plus any reference URLs you want.
4. Share the notebook publicly and copy the link into the site if desired.

### Option B — official API (public preview)

The Gemini Notebook API can create notebooks and add Markdown sources
programmatically. During the preview it is **free**, but:

- only personal Google Accounts are supported (Workspace accounts get
  `403 WORKSPACE_ACCOUNT_NOT_SUPPORTED`);
- authentication is **OAuth 2.0** (no API keys);
- the account must have signed in to <https://notebook.google.com> once;
- limits: 100 notebooks and 50 sources per notebook on the free tier; 1 MB of
  inline text per source; 20 source creations per minute per user.

Setup:

1. Create a Google Cloud project and enable `notebook.googleapis.com`.
2. Configure the OAuth consent screen and add the scope
   `https://www.googleapis.com/auth/notebook`.
3. Create a **Desktop app** OAuth client and download `client_secret.json`.
4. Get a local token:

   ```bash
   gcloud auth application-default login \
     --scopes="https://www.googleapis.com/auth/cloud-platform,https://www.googleapis.com/auth/notebook"
   ```

5. Create a notebook and add a source:

   ```bash
   curl -s -X POST "https://notebook.googleapis.com/v1/notebooks" \
     -H "Authorization: Bearer $TOKEN" \
     -H "x-goog-user-project: $PROJECT_ID" \
     -H "Content-Type: application/json" \
     -d '{"display_name":"Section title"}'
   ```

   Then `POST /v1/{notebook}/sources` with
   `{"display_name":"…","text_content":"…markdown…"}`.

### Option C — sync script (already included)

With a token in `GEMINI_NOTEBOOK_TOKEN` (and `GOOGLE_PROJECT_ID` when using an
ADC token):

```bash
npm run notebooks
npm run sync-notebooks -- --dry-run   # inspect first
npm run sync-notebooks                # create / update notebooks
```

The script reads `dist-notebooks/manifest.json`, creates missing notebooks,
uploads the section Markdown as a source, records the notebook ID and a
content hash, and skips notebooks whose content has not changed. It retries
`429`/`5xx` responses and throttles source creation to stay under the
20/minute limit. Flags: `--dry-run`, `--force`.

## Troubleshooting

- **`node`/`npm` not found** — reopen the terminal so the updated PATH is
  picked up.
- **OneDrive is slow / `node_modules` syncing** — pause OneDrive while working,
  or move the project to a local folder such as `C:\dev\learning-platform`.
- **Search returns nothing** — Pagefind runs after `npm run build`; use
  `npm run preview` or the deployed site.
- **Build fails on content** — run `npm run validate` for readable errors.

## Roadmap

- [x] Multiple-choice question support (`choices` with per-option feedback).
- [x] Hands-on lab items (`kind: "lab"`).
- [x] Notebook bundles from the rich content.
- [x] Notebook sync script with OAuth + content-hash idempotency.
- [ ] Per-section progress summary on the home page.
- [ ] Optional accounts (Supabase free tier) for cross-device progress.
