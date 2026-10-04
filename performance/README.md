# Vantage Pulse — Paid Performance Intelligence

A Google Sheets–powered dashboard for NMC Healthcare's Google Ads search accounts and call
centre. It reads the **two raw dumps** (the Google Ads keyword export and the call-centre lead
export) exactly as they download, and derives everything else itself:

- **Account level** — NMC AUH, NMC DXB, NMC North Emirates, Sunny Clinics
- **Hospital level** — every centre scored on efficiency, bookings, pacing and reach
- **Campaign level** — scale / fix / pause by campaign name, with ad groups and keywords
- **Keywords** — wasted spend, match types, Quality Score bands, proven winners
- **Leads & CRM** — booking funnel, speed-to-lead, departments, time of day, reasons
- **Actions** — every finding ranked by money at stake, plus a copyable weekly plan
- **AI analyst** — a chat panel that answers from the live numbers (no key needed) and,
  with a Gemini or Claude key, reasons over the full data pack

Zero-build static app (HTML + CSS + ES modules), glass UI on the client's ten-swatch palette
(sapphire · viridian · mint · sand · gamboge · rufous), Sora + Manrope + IBM Plex Mono type.
Deploys with the rest of Vantage on GitHub Pages at `/performance/`.

## The daily workflow (paste → it fetches itself)

This is the operating model the app is built around:

1. **Share the sheet once** — Share → General access → *Anyone with the link* → Viewer.
   (Private sheet? Use *Google sign-in* in Connect; it needs an OAuth Client ID.)
2. **Connect once** — open the dashboard → **Connect** → paste the sheet link → **Connect & sync**.
   Leave *Re-sync automatically* on. The link is remembered on that device.
3. **Paste data every day** — download the Google Ads keyword report and the call-centre export
   the usual way and paste them at `A1` of **Google Ads Data** and **Lead Data**, replacing what
   is there. No reshaping, no renaming.
4. **Open the dashboard** — it re-reads the sheet on open, again every 15 minutes while it stays
   open (configurable), and whenever you return to the tab after 5+ minutes away. Every account,
   hospital, campaign, keyword and CRM view recomputes and the actions re-rank. **Sync** in the
   header refreshes on demand.

The synced month is cached in the browser (IndexedDB), so the dashboard opens instantly and then
refreshes in the background. The header chip shows the source, the data date and when it last
synced.

## Connect your sheet

Open the dashboard → **Connect** (sidebar) → paste the Google Sheets link. Three ways to read it,
all from the browser, no server:

| Mode | Needs | Use when |
|---|---|---|
| **Public link** | Share → *Anyone with the link* → Viewer | Simplest. Tabs are read by name (editable list). |
| **API key** | A Google API key with the Sheets API enabled | Finds every tab automatically. |
| **Google sign-in** | An OAuth Client ID (Web) | The sheet is private. |

Or just **drop the files**: the Google Ads CSV, the CC export CSV, or the whole `.xlsx`.

Tabs are recognised by their **headers, not their names**, so renamed, reordered or extra tabs
are fine. What it looks for:

| Recognised tab | Signature | Gives |
|---|---|---|
| Google Ads keyword export | `Day · Campaign · Ad group · Search keyword · Impr. · Cost · Conversions…` | Everything at campaign/keyword/day level |
| Call-centre lead export | `ID · Status · Reason · Branch · Department · Created At…` | Bookings, reasons, speed-to-lead |
| Month summary / week tabs | `Centre · Impressions · … · Booked` | The typed call columns (call-extension and landing-page call taps) |
| Daily Calls Trend | `Date · Call Click Ext. · GA4 Call Now · Total Calls` | Daily calls per account |
| Budget | `Centre · Budget (AED)` | Pacing |
| Centre List | `Campaign name contains… · Centre · Region` | Campaign → centre mapping (a built-in default is used if absent) |

Only the two exports are required. Without budgets the pacing tiles show “—”; without the typed
call columns the call tiles show “—”. Everything else still works.

### Next month

Download the two dumps the same way, paste them into the sheet (or drop them here), press
**Sync**. No reshaping.

## Filters

A single filter row scopes every page and the analyst: **date range** (month to date, last 7/14
days, each week, or a custom from/to), **ad account**, and **hospital** (narrowed to the chosen
account). Click any account card to focus on it; open any hospital or campaign for a drill-down.

## How the numbers are defined

- **CPL** = spend ÷ Google Ads form conversions (as in the sheet).
- **Calls** = call-extension taps + landing-page call taps (typed on the week tabs; pro-rated
  for custom date ranges and marked *est.*).
- **Impression share** is never averaged: eligible impressions = impressions ÷ IS per row,
  then totals divide impressions by eligible impressions. “< 10%” counts at 5%.
- **Cost per booking** = spend ÷ leads the call centre marked *booked*.
- **Health (0–100)** = CPL vs network median (35%) + booking rate (30%) + pacing (15%) +
  impression share (20%).
- **Campaign status**: *Scale* = CPL ≤ 0.7× network median and reach capped by rank;
  *Fix* = CPL ≥ 1.8× median (or CTR < 5%); *Pause* = ≥ AED 300 with no conversions;
  *Watch* = too small to judge; *Hold* = within range.

## AI analyst

The chat answers from the computed numbers instantly — rankings, comparisons, pacing, keyword
waste, call-centre speed, any hospital/campaign/specialty by name. Add a **Gemini** or
**Claude** key under *Data → AI analyst* and open-ended questions are answered by the model from
a compact data pack of the live figures plus the computed facts. Keys stay in the browser and go
straight to the provider.

## Privacy

The bundled sample (`data/snapshot.json`) carries no patient names, phone numbers, emails or
agent names. When you load your own export in the browser, nothing leaves the device except the
optional AI request.

## Structure

```
performance/
├── index.html            # shell: sidebar, filter row, pages, chat panel, drawers, data modal
├── styles/perf.css       # design system (dark + light), validated chart palette
├── js/
│   ├── pack.js           # compact on-disk form of the sample + loader
│   ├── csv.js            # RFC-4180 CSV parser
│   ├── parse.js          # tab detection by header signature → normalised model
│   ├── analytics.js      # filter → view: accounts, centres, campaigns, keywords, trends, CRM
│   ├── insights.js       # the performance-marketer rules → ranked actions + executive summary
│   ├── charts.js         # dependency-free SVG charts (line, bar, scatter, heatmap, sparkline…)
│   ├── pages.js          # the seven pages + drill-down drawers
│   ├── analyst.js        # local intent engine + Gemini/Claude providers + data pack
│   ├── sheets.js         # Google Sheets connector (public / API key / OAuth) + file upload
│   ├── idb.js            # IndexedDB cache so a synced month survives reloads
│   └── app.js            # state, routing, filters, chat, modal, events
├── data/snapshot*.json   # bundled sample month (anonymised, packed in parts)
└── tools/build-snapshot.mjs  # regenerate the sample from a folder of per-tab CSVs
```

Regenerate the sample: `node tools/build-snapshot.mjs <folder-of-csvs>` (one CSV per tab).
