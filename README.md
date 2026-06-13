# Vantage — Competitor Growth Intelligence

An iOS-27-inspired, liquid-glass dashboard for competitor intelligence across **Meta &
Google ads, SEO, and answer-engine (AEO) visibility** — built to answer *"what should I do
next?"*, not just show data.

This is a **zero-build static app**: pure HTML + CSS + vanilla JS modules. No Node, no
toolchain, no dependencies. It deploys to GitHub Pages for free and runs anywhere that can
serve static files.

## Type a brand → it fetches

The entry screen takes a **brand name** and runs real, free, keyless fetchers right from the
browser — no backend, no API key:

| Signal | Source | Status |
|---|---|---|
| Knowledge-graph **entity strength** (feeds the AEO score) | Wikipedia + Wikidata | **Live** |
| **Core Web Vitals** / site health (brand + competitors) | Google PageSpeed Insights | **Live*** |
| Brand identity (logo, description) | Clearbit + Wikipedia | **Live** |
| Meta / Google **ad & keyword intelligence** | needs ad-platform keys + a backend | **Framework** |

Every data point is badged **Live** or **Framework** in the UI — nothing fake is presented as
real. *PageSpeed's keyless quota is rate-limited, so site health falls back to representative
values when the quota is exhausted.

> **Why ads aren't live:** Meta Ad Library, Google keyword/CPC, and AEO probes need secret API
> keys and paid accounts. Keys can't live in browser code, and those APIs block browser calls
> (CORS) — so they require a backend, which a free static site doesn't have. Those modules show
> the exact analytical framework; wiring real data = a serverless function on a free tier
> (Vercel/Cloudflare) that holds the keys. See `competitor-intel-blueprint.md` for that V2 path.

---

## Dashboards

| Page | What it shows |
|---|---|
| **Executive Overview** | Growth Potential score, KPI strip, RICE-ranked opportunities, top mistakes |
| **Ad Strategy** | The **Angle × Awareness Matrix** (Own / Attack / Hold / Avoid) + auto-generated Creative Testing Roadmap |
| **Creative Intelligence** | Longevity-weighted "winners" board, hook-category frequency, fatigue signals |
| **Keyword Plan** | Steal / Defend / Expand buckets with **one-click Google Ads CSV export** |
| **AEO Visibility** | AI Discoverability score, per-engine Share-of-Model-Voice, citation analysis |
| **Growth Strategist** | Executive summary + sequenced 30 / 90 / 365-day roadmap |

---

## Run locally

No install needed — just serve the folder over HTTP (ES modules don't work via `file://`):

```bash
cd vantage
python3 -m http.server 8000
# open http://localhost:8000
```

---

## Deploy free on GitHub Pages

**Option A — web UI (no git needed):**
1. Create a new repo on github.com (e.g. `vantage`), public.
2. Upload every file in this folder (keep the structure: `index.html`, `js/`, `styles/`, `.nojekyll`).
3. Repo → **Settings → Pages** → Source: **Deploy from a branch** → `main` / `/ (root)` → Save.
4. Live in ~1 min at `https://<your-username>.github.io/vantage/`.

**Option B — git CLI:**
```bash
cd vantage
git init && git add -A && git commit -m "Vantage dashboard"
git branch -M main
git remote add origin https://github.com/<you>/vantage.git
git push -u origin main
# then enable Pages in Settings as in Option A
```

The `.nojekyll` file is already included so GitHub serves the `js/` folder as-is.

---

## Wiring real data later

GitHub Pages is static-only — it can't run scrapers or hold API keys. The free, real path:

1. Run the pipeline **offline** (locally or on a schedule) — Apify (Meta Ad Library), DataForSEO
   (keywords/backlinks), LLM probes (AEO), your own crawler (CRO/PDP).
2. Write the results as JSON files into this repo (e.g. `data/audit-latest.json`).
3. Change `js/data.js` to `fetch()` that JSON instead of exporting literals.
4. Commit → Pages redeploys. 100% free, fully dynamic-looking, no backend.

Live *on-demand* audits (enter a URL, get a fresh report) need a backend on a free tier
(Vercel/Supabase) — that's the V2 step in the blueprint.

---

## Structure

```
vantage/
├── index.html          # app shell (sidebar, topbar, mount points)
├── styles/app.css      # the iOS-27 liquid-glass design system
├── js/
│   ├── fetchers.js     # LIVE free fetchers — Wikipedia/Wikidata, PageSpeed, logos
│   ├── onboarding.js   # brand entry screen + audit runner (progress UI)
│   ├── state.js        # the live audit store (persists to localStorage)
│   ├── data.js         # representative data — the framework fallback
│   ├── ui.js           # icons, SVG score rings/gauges, bar helper
│   ├── pages.js        # the six dashboard renderers (read live state first)
│   └── app.js          # flow control, nav, theme, tooltips, tabs, CSV export
└── .nojekyll           # tells GitHub Pages to serve js/ verbatim
```
