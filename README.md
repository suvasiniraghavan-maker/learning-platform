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
content/kb.json            ← the only content file you need to edit
src/lib/schema.js          ← validation contract (shared by build + CLI)
src/lib/kb.ts              ← typed access to the knowledge base
src/pages/index.astro      ← section list
src/pages/sections/[section].astro
src/pages/quiz/[section].astro
src/components/Quiz.tsx    ← spaced-repetition quiz (localStorage)
src/pages/search.astro     ← Pagefind UI
scripts/validate.mjs       ← readable validation errors
scripts/build-notebooks.mjs
dist-notebooks/            ← generated notebook bundles (gitignored)
```

## Editing the knowledge base

`content/kb.json` shape:

```jsonc
{
  "version": 1,
  "title": "My Course",
  "description": "Optional",
  "sections": [
    {
      "id": "lowercase-kebab-case",
      "title": "Section title",
      "description": "Optional",
      "items": [
        {
          "id": "unique-item-id",
          "question": "…",
          "answer": "…",
          "reasoning": "…",
          "tags": ["optional"],
          "difficulty": 3,
          "references": [{ "title": "…", "url": "https://…" }]
        }
      ]
    }
  ]
}
```

Rules enforced by `npm run validate`:

- `version` must be `1`.
- Section and item `id`s must be lowercase kebab-case and globally unique.
- Every item needs a non-empty `question`, `answer`, and `reasoning`.
- `difficulty` is an integer from 1 to 5 (default 3).
- `references[].url` must be a valid URL.
- Optional `choices` + `correctIndex` support will be added for multiple choice.

Replace the sample content with your own JSON. The UI, quiz, search, and
notebook bundles all follow automatically.

## How the quiz schedules cards

- Due cards come first, then unseen cards, both shuffled.
- Rating a card updates a local SM-2-style schedule:
  - **Again** → 1 day, ease decreases.
  - **Good** → 1 day, then 3 days, then grows by the ease factor.
  - **Easy** → 2 days, then grows faster.
- Progress is stored in `localStorage` under `lp.progress.v1`.
- Keys: `Space` reveals, `1` / `2` / `3` rate.

## Deploy to Cloudflare Pages (free)

1. Push this folder to a GitHub repository.
2. In the Cloudflare dashboard: **Workers & Pages → Create → Pages →
   Connect to Git**, and pick the repo.
3. Settings:
   - Framework preset: **Astro**
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Environment variable: `NODE_VERSION = 22`
4. Deploy. Every push to `main` redeploys automatically.

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
answer and reasoning, the tags, and curated further reading.

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

- [ ] Multiple-choice question support (`choices` / `correctIndex`).
- [ ] Per-section progress summary on the home page.
- [ ] Notebook sync script with OAuth + content-hash idempotency.
- [ ] Optional accounts (Supabase free tier) for cross-device progress.
