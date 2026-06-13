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
    const r = await withTimeout(fetch(api), 14000);
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

// ---------- BEST-EFFORT HOMEPAGE META (via free CORS proxy) ----------
export async function fetchHomepageMeta(domain) {
  const url = `https://${cleanDomain(domain)}`;
  const out = { ok: false, title: "", description: "", h1: "" };
  try {
    const r = await withTimeout(fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`), 10000);
    if (r.ok) {
      const { contents } = await r.json();
      const doc = new DOMParser().parseFromString(contents, "text/html");
      out.title = doc.querySelector("title")?.textContent?.trim() || "";
      out.description = doc.querySelector('meta[name="description"]')?.content?.trim()
        || doc.querySelector('meta[property="og:description"]')?.content?.trim() || "";
      out.h1 = doc.querySelector("h1")?.textContent?.trim() || "";
      out.ok = !!(out.title || out.description);
    }
  } catch (e) {}
  return out;
}
