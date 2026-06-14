// ============================================================
//  LIVE FETCHERS — real data, free, keyless, browser-callable.
//  Everything here works from a static GitHub Pages site (CORS-open,
//  no API key). Each returns { ok, ... } and fails soft.
// ============================================================

const TIMEOUT = 8000;

function withTimeout(promise, ms = TIMEOUT) {
  return Promise.race([
    promise,
    new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms)),
  ]);
}

export function domainFromBrand(brand) {
  return brand.trim().toLowerCase().replace(/[^a-z0-9]/g, "") + ".com";
}
export function cleanDomain(url) {
  return (url || "").replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "").trim();
}
export function logoUrl(domain) { return `https://logo.clearbit.com/${cleanDomain(domain)}`; }
export function faviconUrl(domain) { return `https://www.google.com/s2/favicons?domain=${cleanDomain(domain)}&sz=128`; }

// ---------- ENTITY / KNOWLEDGE GRAPH (Wikipedia + Wikidata) ----------
// The strongest free signal for AEO: presence + breadth in the graph that
// answer engines are trained on and cite.
export async function fetchEntity(brand) {
  const out = { ok: false, wiki: false, wikidataId: null, sitelinks: 0, description: "", extract: "", strength: 0, url: null };
  try {
    const r = await withTimeout(fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(brand)}`, { headers: { "Api-User-Agent": "Vantage/1.0" } }));
    if (r.ok) {
      const j = await r.json();
      if (j.type !== "disambiguation" && j.extract) {
        out.wiki = true;
        out.description = j.description || "";
        out.extract = j.extract || "";
        out.url = j.content_urls?.desktop?.page || null;
      }
    }
  } catch (e) {}
  try {
    const r = await withTimeout(fetch(`https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(brand)}&language=en&format=json&origin=*`));
    if (r.ok) {
      const j = await r.json();
      const hit = j.search?.[0];
      if (hit) {
        out.wikidataId = hit.id;
        if (!out.description) out.description = hit.description || "";
        const r2 = await withTimeout(fetch(`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${hit.id}&props=sitelinks&format=json&origin=*`));
        if (r2.ok) {
          const j2 = await r2.json();
          out.sitelinks = Object.keys(j2.entities?.[hit.id]?.sitelinks || {}).length;
        }
      }
    }
  } catch (e) {}

  // entity strength (0–100): graph presence is the dominant lever
  let s = 0;
  if (out.wiki) s += 38;
  if (out.wikidataId) s += 14;
  s += Math.min(out.sitelinks, 28); // language breadth
  if (out.description) s += 8;
  s += Math.min(Math.round((out.extract.length || 0) / 120), 12);
  out.strength = Math.min(100, s);
  out.ok = out.wiki || !!out.wikidataId;
  return out;
}

// ---------- CORE WEB VITALS / SITE HEALTH (PageSpeed Insights, keyless) ----------
export async function fetchCWV(domain) {
  const url = `https://${cleanDomain(domain)}`;
  const out = { ok: false, perf: null, lcp: null, cls: null, inp: null, url };
  try {
    const api = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&category=performance&strategy=mobile`;
    const r = await withTimeout(fetch(api), 9000);
    if (r.ok) {
      const j = await r.json();
      const lr = j.lighthouseResult;
      if (lr) {
        out.perf = Math.round((lr.categories?.performance?.score ?? 0) * 100);
        const a = lr.audits || {};
        out.lcp = a["largest-contentful-paint"]?.numericValue ? +(a["largest-contentful-paint"].numericValue / 1000).toFixed(1) : null;
        out.cls = a["cumulative-layout-shift"]?.numericValue != null ? +a["cumulative-layout-shift"].numericValue.toFixed(3) : null;
        out.inp = a["interaction-to-next-paint"]?.numericValue ?? a["total-blocking-time"]?.numericValue ?? null;
        if (out.inp) out.inp = Math.round(out.inp);
        out.ok = true;
      }
    }
  } catch (e) {}
  return out;
}

// Fetch a cross-origin URL as text through a chain of free CORS proxies.
async function fetchViaProxy(url, ms = 8000) {
  const proxies = [
    (u) => `https://corsproxy.io/?url=${encodeURIComponent(u)}`,
    (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  ];
  for (const p of proxies) {
    try {
      const r = await withTimeout(fetch(p(url)), ms);
      if (r.ok) {
        const t = await r.text();
        if (t && t.length > 2) return t;
      }
    } catch (e) {}
  }
  return null;
}

// ---------- GOOGLE DEMAND / QUESTIONS (autocomplete, via proxy) ----------
// Real "what people search" — the demand + questions signal, free, no key.
export async function fetchGoogleSuggest(q) {
  const target = `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(q)}`;
  try {
    const t = await fetchViaProxy(target, 7000);
    if (t) {
      const arr = JSON.parse(t); // ["q", ["s1","s2",...]]
      const s = (arr[1] || []).slice(0, 10);
      if (s.length) return { ok: true, suggestions: s };
    }
  } catch (e) {}
  return { ok: false, suggestions: [] };
}

// ---------- REDDIT CUSTOMER VOICE (search.json, via proxy) ----------
// Real "what people complain about, in their own words", free, no key.
export async function fetchReddit(q) {
  const target = `https://www.reddit.com/search.json?q=${encodeURIComponent(q)}&limit=10&sort=relevance`;
  try {
    const t = await fetchViaProxy(target, 7000);
    if (t) {
      const j = JSON.parse(t);
      const posts = (j.data?.children || [])
        .map((c) => ({ t: c.data.title, sub: "r/" + c.data.subreddit, up: c.data.ups }))
        .filter((p) => p.t).slice(0, 6);
      if (posts.length) return { ok: true, posts };
    }
  } catch (e) {}
  return { ok: false, posts: [] };
}

// ---------- LIVE SITE SCRAPE (homepage, via proxy) ----------
// Real per-brand intelligence: positioning, pricing, trust signals, value props.
// This is the brand's OWN site — the one competitor surface a static app CAN read.
export async function fetchSite(domain) {
  const url = `https://${cleanDomain(domain)}`;
  const out = { ok: false, title: "", description: "", h1: "", props: [], prices: [], trust: [], url };
  try {
    const html = await fetchViaProxy(url, 9000);
    if (html) {
      const doc = new DOMParser().parseFromString(html, "text/html");
      out.title = doc.querySelector("title")?.textContent?.trim() || "";
      out.description = (doc.querySelector('meta[name="description"]')?.getAttribute("content")
        || doc.querySelector('meta[property="og:description"]')?.getAttribute("content") || "").trim();
      out.h1 = doc.querySelector("h1")?.textContent?.replace(/\s+/g, " ").trim() || "";
      out.props = [...doc.querySelectorAll("h2, h3")].map((h) => h.textContent.replace(/\s+/g, " ").trim())
        .filter((t) => t && t.length > 6 && t.length < 80).slice(0, 6);
      const text = (doc.body?.textContent || html);
      out.prices = [...new Set((text.match(/₹\s?\d[\d,]{1,6}/g) || []).map((s) => s.replace(/\s/g, "")))].slice(0, 8);
      const signals = {
        "Dermatologist-backed": /derma(tolog)/i, "Clinically tested": /clinical/i,
        "Reviews / ratings": /review|rating|★|stars?\b/i, "Money-back guarantee": /money.?back|guarantee|refund/i,
        "Free / fast shipping": /free ship|free deliver|fast deliver/i, "No side-effects claim": /no side.?effect|side.?effect.?free/i,
        "Made in India": /made in india/i, "Subscription": /subscri(be|ption)/i,
        "Doctor / expert": /\bdoctor|gynaecolog|nutritionist|expert/i, "COD available": /cash on delivery|\bcod\b/i,
      };
      out.trust = Object.entries(signals).filter(([, re]) => re.test(text)).map(([k]) => k);
      out.ok = !!(out.title || out.description);
    }
  } catch (e) {}
  return out;
}
