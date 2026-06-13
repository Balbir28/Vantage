// ============================================================
//  PAGE RENDERERS — each returns an HTML string for the main panel.
// ============================================================
import * as D from "./data.js";
import { ring, miniGauge, bar } from "./ui.js";
import { STATE } from "./state.js";

const tags = (arr) => arr.map((t) => `<span class="badge grey">${t}</span>`).join("");
const srcBadge = (live) => live
  ? '<span class="src live"><span class="ld"></span>Live</span>'
  : '<span class="src demo"><span class="ld"></span>Framework</span>';
const brandName = () => (STATE.ran ? STATE.brand : D.audit.subject.name);
const competitorNames = () => (STATE.ran && STATE.competitors.length ? STATE.competitors.map((c) => c.name) : D.audit.competitors);
const repBanner = '<div class="banner">⚑ <span><b>Representative analysis.</b> Meta &amp; Google ad data needs a connected ad-platform key + backend (paid). The framework below shows exactly how live data renders.</span></div>';

// Real Core Web Vitals (PageSpeed) — brand + competitors, with graceful fallback.
function siteHealth() {
  const rows = [];
  if (STATE.ran) {
    if (STATE.cwv) rows.push({ nm: brandName(), you: true, ...STATE.cwv });
    (STATE.competitors || []).forEach((c) => { if (c.cwv) rows.push({ nm: c.name, ...c.cwv }); });
  }
  const live = rows.length > 0;
  if (!live) {
    rows.push({ nm: brandName(), you: true, perf: 64, lcp: 3.1, cls: 0.08, inp: 240 });
    rows.push({ nm: competitorNames()[0], perf: 81, lcp: 2.0, cls: 0.02, inp: 160 });
  }
  const col = (p) => (p >= 90 ? "var(--green)" : p >= 50 ? "var(--amber)" : "var(--coral)");
  const body = rows.map((r) => `
    <div class="barrow" style="grid-template-columns:160px 1fr 50px;margin-bottom:4px">
      <div class="nm">${r.you ? `<b style="color:var(--text)">${r.nm}</b>` : r.nm}</div>
      <div class="bar"><i style="width:${r.perf}%;background:${col(r.perf)}"></i></div>
      <div class="v">${r.perf}</div>
    </div>
    <div class="faint" style="font-size:11.5px;margin:0 0 13px 0">LCP ${r.lcp ?? "—"}s · CLS ${r.cls ?? "—"} · INP ${r.inp ?? "—"}ms</div>`).join("");
  return `<div class="card">
    <div class="head"><h3>Site health · Core Web Vitals</h3><span class="sub">· Google PageSpeed, mobile</span>
      <div class="spacer"></div>${srcBadge(live)}</div>
    ${body}
    <p class="faint" style="font-size:12px;margin-top:2px">${live
      ? "Fetched live from PageSpeed Insights — free, no API key, straight from your static site."
      : "Representative — live values appear when PageSpeed quota is available for the entered domain."}</p>
  </div>`;
}

// ---------- 1. EXECUTIVE OVERVIEW ----------
export function overview() {
  const kpis = D.kpis.map((k) => `
    <div class="card kpi hover">
      <div class="lbl">${k.lbl}</div>
      <div class="v">${k.v}</div>
      <div class="delta ${k.dir}">${k.dir === "up" ? "▲" : "▼"} ${k.delta}</div>
    </div>`).join("");

  const liveAI = STATE.entity ? STATE.entity.strength : null;
  const subs = D.growth.subs.map((s) => {
    const live = s.nm === "AI Visibility" && liveAI != null;
    const val = live ? liveAI : s.val;
    return `<div class="subscore">
      <div class="nm">${s.nm} <span class="faint">· ${s.weight}%</span> ${live ? srcBadge(true) : ""}</div>
      <div class="track"><i style="width:${val}%"></i></div>
      <div class="val">${val}</div>
    </div>`;
  }).join("");

  const opps = D.opportunities.map((o, i) => `
    <div class="opp">
      <div class="rank">${i + 1}</div>
      <div class="body">
        <div class="t">${o.t}</div>
        <div class="d">${o.d}</div>
        <div class="meta">
          <span class="badge teal">Impact ${o.impact}</span>
          <span class="badge green">Effort ${o.effort}</span>
          <span class="badge amber">Conf ${o.conf}</span>
          ${tags(o.tags)}
        </div>
      </div>
      <div class="score"><b>${o.score}</b><small>RICE</small></div>
    </div>`).join("");

  const mistakes = D.mistakes.map((m) => `
    <div class="opp" style="background:transparent;border-color:rgba(255,107,107,0.2)">
      <div class="rank" style="background:linear-gradient(135deg,var(--coral),#c44569)">!</div>
      <div class="body"><div class="t">${m.t}</div><div class="d">${m.d}</div>
        <div class="meta"><span class="badge green">Fix · ${m.fix}</span></div></div>
    </div>`).join("");

  return `<div class="page">
    <div class="grid c-2a">
      <div class="card">
        <div class="head"><span class="eyebrow">Growth Potential</span></div>
        <div class="ring-wrap">${ring(D.growth.total, { label: "/ 100" })}
          <div class="subscores">${subs}</div></div>
      </div>
      <div class="card">
        <div class="head"><h3>Competitive position</h3><div class="spacer"></div>
          <span class="chip"><span class="dot"></span>${competitorNames().length} competitors tracked</span></div>
        ${STATE.extract ? `<div class="prose" style="font-size:13px;margin-bottom:12px"><b>${brandName()}</b> — ${STATE.extract.slice(0, 220)}${STATE.extract.length > 220 ? "…" : ""} ${srcBadge(true)}</div>` : ""}
        <div class="prose" style="font-size:13.5px">Benchmarked against <b>${competitorNames().join(", ")}</b>.
        Lead on <b>creative transformation angle</b> and acquisition, but trail on
        <b>answer-engine visibility</b> and <b>retention</b>. The wins below need redistribution, not more budget.</div>
        <div style="margin-top:16px">
          ${bar(brandName() + " — Acquisition", 71, 100, "linear-gradient(90deg,var(--teal),var(--indigo))")}
          ${bar(competitorNames()[0] + " — Acquisition", 83, 100, "var(--text-faint)")}
          ${bar(brandName() + " — AI Visibility", STATE.entity ? STATE.entity.strength : 38, 100, "linear-gradient(90deg,var(--coral),var(--amber))")}
          ${bar(competitorNames()[0] + " — AI Visibility", 82, 100, "var(--text-faint)")}
        </div>
      </div>
    </div>

    ${siteHealth()}

    <div class="grid kpis">${kpis}</div>

    <div class="grid c-2b">
      <div class="card">
        <div class="head"><h3>Top revenue opportunities</h3><span class="sub">· ranked by RICE</span></div>
        <div style="display:flex;flex-direction:column;gap:10px">${opps}</div>
      </div>
      <div class="card">
        <div class="head"><h3>Top marketing mistakes</h3></div>
        <div style="display:flex;flex-direction:column;gap:10px">${mistakes}</div>
      </div>
    </div>
  </div>`;
}

// ---------- 2. AD STRATEGY (Angle × Awareness Matrix) ----------
export function adStrategy() {
  const head = D.angles.map((a) => `<th>${a}</th>`).join("");
  const rows = D.awarenessStages.map((st) => {
    const cells = D.matrix[st.key].map((cell, ci) => {
      const labels = { own: "OWN", attack: "ATTACK", contest: "HOLD", avoid: "" };
      return `<td><div class="cell ${cell.verdict}" data-stage="${st.nm}" data-angle="${D.angles[ci]}"
        data-owner="${cell.owner}" data-sat="${cell.sat}" data-pos="${cell.pos}" data-verdict="${cell.verdict}"
        data-note="${cell.note || ''}">
        <span class="lab">${labels[cell.verdict]}</span></div></td>`;
    }).join("");
    return `<tr><th class="rowh">${st.nm}<small>${st.sub}</small></th>${cells}</tr>`;
  }).join("");

  const tests = D.creativeTests.map((t, i) => `
    <div class="opp">
      <div class="rank">${i + 1}</div>
      <div class="body">
        <div class="meta" style="margin-top:0;margin-bottom:6px"><span class="badge coral">${t.angle}</span><span class="badge grey">${t.fmt}</span></div>
        <div class="t" style="font-weight:600;font-size:14.5px">${t.hook}</div>
        <div class="d" style="margin-top:5px">${t.why}</div>
      </div>
      <div class="score"><b>${t.rice}</b><small>RICE</small></div>
    </div>`).join("");

  return `<div class="page">
    ${repBanner}
    <div class="card">
      <div class="head"><h3>Angle × Awareness Matrix</h3><span class="sub">· winner-weighted saturation across ${D.audit.creativesAnalyzed} competitor creatives</span></div>
      <div class="scroll-x"><table class="matrix"><thead><tr><th class="rowh"></th>${head}</tr></thead><tbody>${rows}</tbody></table></div>
      <div class="legend">
        <span><i style="background:linear-gradient(135deg,#34d399,#34d39955)"></i> Own — you lead, keep investing</span>
        <span><i style="background:linear-gradient(135deg,#ff6b6b,#ff6b6b55)"></i> Attack — white space, go here</span>
        <span><i style="background:linear-gradient(135deg,#ffb23e,#ffb23e55)"></i> Hold — contest / defend</span>
        <span><i style="background:var(--glass-2)"></i> Avoid — saturated, costly</span>
      </div>
      <p class="faint" style="font-size:12px;margin-top:12px">Hover any cell for owner, saturation and the recommended move. Cells resting on thin data render muted — confidence-aware by design.</p>
    </div>

    <div class="card">
      <div class="head"><h3>Creative Testing Roadmap</h3><span class="sub">· auto-generated from every ATTACK cell</span>
        <div class="spacer"></div><button class="btn ghost" onclick="alert('Exports a designer-ready brief (PDF) in the full build.')">Export brief</button></div>
      <div style="display:flex;flex-direction:column;gap:10px">${tests}</div>
    </div>
  </div>`;
}

// Live ad-library deep links — the real running ads, one click away (free, no backend).
function adLibraries() {
  const meta = (q) => `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&q=${encodeURIComponent(q)}&search_type=keyword_unordered&media_type=all`;
  const gads = (domain) => `https://adstransparency.google.com/?region=anywhere&domain=${encodeURIComponent(domain)}`;
  const rows = [];
  if (STATE.ran) {
    rows.push({ name: STATE.brand, q: STATE.brand, domain: STATE.domain, logo: STATE.logo, you: true });
    (STATE.competitors || []).forEach((c) => rows.push({ name: c.name, q: c.name, domain: c.domain, logo: c.logo }));
  }
  if (!rows.length) rows.push({ name: brandName(), q: brandName(), domain: STATE.domain || "", you: true });

  const items = rows.map((r) => `
    <div class="liblink">
      ${r.logo ? `<img src="${r.logo}" onerror="this.style.display='none'"/>` : ""}
      <div class="libname">${r.you ? "★ " : ""}${r.name}</div>
      <div class="libbtns">
        <a class="btn meta" href="${meta(r.q)}" target="_blank" rel="noopener">Meta Ad Library ↗</a>
        <a class="btn gads" href="${gads(r.domain)}" target="_blank" rel="noopener">Google Transparency ↗</a>
      </div>
    </div>`).join("");

  const noComp = STATE.ran && !(STATE.competitors || []).length
    ? `<p class="faint" style="font-size:12px;margin:2px 0 0">Run a new audit with competitor domains to get their library links here too.</p>` : "";

  return `<div class="card">
    <div class="head"><h3>Live ad libraries</h3><span class="sub">· every ad currently running, one click away</span>
      <div class="spacer"></div><span class="src live"><span class="ld"></span>Live</span></div>
    ${items}${noComp}
    <p class="faint" style="font-size:12px;margin-top:12px">Direct links into the official libraries — the deepest free path, since Meta has no commercial-ads API and both libraries block in-page extraction. Pulling each ad's creative, copy and run-dates <i>into</i> these dashboards for automated angle analysis needs a backend scraper; the board below shows exactly how that renders.</p>
  </div>`;
}

// ---------- 3. CREATIVE INTELLIGENCE ----------
export function creative() {
  const cards = D.winners.map((w) => `
    <div class="creative">
      <div class="thumb" style="background:${w.grad}">
        <span class="pill">${w.you ? "★ YOUR AD" : w.brand}</span>
        <div class="hook">${w.hook}</div>
      </div>
      <div class="info">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span class="badge ${w.score >= 85 ? "green" : w.score >= 70 ? "teal" : "amber"}">Winner ${w.score}</span>
          <span class="ws">${w.fmt} · ${w.placements} placements</span>
        </div>
        <div class="meta"><span>${w.you ? "Your ad" : "Competitor"}</span><span><b style="color:var(--text)">${w.days}d</b> running</span></div>
      </div>
    </div>`).join("");

  const hooks = D.hookFreq.map((h) => bar(h.nm, h.v, 90, h.col, "")).join("");

  return `<div class="page">
    ${adLibraries()}
    ${repBanner}
    <div class="card">
      <div class="head"><h3>Proven winners board</h3><span class="sub">· ranked by longevity-weighted Winner Score — the honest "what's working" signal</span></div>
      <div class="grid creatives">${cards}</div>
      <p class="faint" style="font-size:12px;margin-top:14px"><span class="flag">⚑ inferred</span> &nbsp;Meta exposes no spend or ROAS outside the EU. "Winner" = ad longevity × placement breadth × still-active — a proxy, shown with confidence, never presented as measured performance.</p>
    </div>
    <div class="grid c-2d">
      <div class="card">
        <div class="head"><h3>Hook category frequency</h3><span class="sub">· across competitor set</span></div>
        ${hooks}
        <p class="faint" style="font-size:12px;margin-top:10px">Educational & comparison hooks are <b>under-used</b> — your blind-spot openings.</p>
      </div>
      <div class="card">
        <div class="head"><h3>Creative velocity & fatigue</h3></div>
        <div class="ring-wrap" style="margin-bottom:14px">${ring(82, { size: 104, label: "your share", stroke: 9 })}
          <div class="prose" style="font-size:13px"><b>68% of your spend</b> sits in one feature-led angle — early fatigue indicators (rising frequency, falling longevity on new launches). Aurelia ships <b>2.4× more</b> creative variants per week.</div></div>
        <span class="badge coral">⚑ Fatigue risk: High</span> <span class="badge amber">Diversify within 2 weeks</span>
      </div>
    </div>
  </div>`;
}

// ---------- 4. KEYWORD ACTION PLAN ----------
export function keywords(bucket = "steal") {
  const meta = {
    steal: ["Steal", "Competitor-validated demand you're absent from", "coral"],
    defend: ["Defend", "Your brand & category terms being conquested", "amber"],
    expand: ["Expand", "Uncontested, high-intent white space", "green"],
  };
  const rows = D.keywords[bucket].map((k) => `
    <tr>
      <td class="kw">${k.kw}</td>
      <td class="num-cell">${k.vol.toLocaleString()}</td>
      <td class="num-cell">$${k.cpc.toFixed(2)}</td>
      <td><span class="badge grey">${k.intent}</span></td>
      <td>${k.comp}</td>
      <td><b>${k.score}</b></td>
      <td><span class="badge ${meta[bucket][2]}">${k.action}</span></td>
    </tr>`).join("");

  const tabBtn = (b) => `<button class="${b === bucket ? "on" : ""}" data-kw="${b}">${meta[b][0]} <span class="faint">${D.keywords[b].length}</span></button>`;

  return `<div class="page">
    ${repBanner}
    <div class="card">
      <div class="head">
        <h3>Google Keyword Action Plan</h3><span class="sub">· DataForSEO-enriched</span>
        <div class="spacer"></div>
        <button class="btn" data-export-csv="${bucket}">⬇ Export Google Ads CSV</button>
      </div>
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:16px">
        <div class="tabs">${tabBtn("steal")}${tabBtn("defend")}${tabBtn("expand")}</div>
        <span class="muted" style="font-size:13px">${meta[bucket][1]}</span>
      </div>
      <table class="tbl">
        <thead><tr><th>Keyword</th><th>Volume</th><th>CPC</th><th>Intent</th><th>Competitors bidding</th><th>Opp.</th><th>Action</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p class="faint" style="font-size:12px;margin-top:14px">CPC & volume are licensed data (full confidence). <b>Steal</b> follows demand competitors proved; <b>Expand</b> is uncontested upside. Export maps straight to a Google Ads Editor import.</p>
    </div>
  </div>`;
}

// ---------- 5. AEO VISIBILITY ----------
export function aeo() {
  const gauges = D.aeo.engines.map((e) => `
    <div class="card gauge hover">${miniGauge(e.you)}
      <div class="label">${e.nm}</div>
      <div class="vs">you ${e.you}% · competitors ${e.comp}%</div></div>`).join("");

  const cites = D.aeo.citations.map((c) => `
    <tr><td class="kw">${c.src}</td><td>${c.who}</td>
      <td><span class="badge ${c.tone}">you ×${c.you}</span></td></tr>`).join("");

  const recs = D.aeo.recs.map((r) => `<div class="opp"><div class="rank" style="background:linear-gradient(135deg,var(--indigo),var(--violet))">✦</div><div class="body"><div class="d" style="font-size:13.5px;color:var(--text)">${r}</div></div></div>`).join("");

  const e = STATE.entity;
  const disc = e ? e.strength : D.aeo.discoverability;
  const entityFacts = e ? `
    <div style="margin-top:16px;display:flex;flex-direction:column;gap:8px">
      <div class="subscore" style="grid-template-columns:1fr auto"><div class="nm">Wikipedia entity</div><div class="val">${e.wiki ? "✓ present" : "✕ absent"}</div></div>
      <div class="subscore" style="grid-template-columns:1fr auto"><div class="nm">Knowledge graph (Wikidata)</div><div class="val">${e.wikidataId || "—"}</div></div>
      <div class="subscore" style="grid-template-columns:1fr auto"><div class="nm">Language editions</div><div class="val">${e.sitelinks}</div></div>
    </div>` : "";

  return `<div class="page">
    <div class="grid c-2e">
      <div class="card">
        <div class="head"><span class="eyebrow">AI Discoverability</span><div class="spacer"></div>${srcBadge(!!e)}</div>
        <div class="ring-wrap">${ring(disc, { label: "/ 100" })}
          <div class="prose" style="font-size:13px"><b>Entity strength</b> — how present ${brandName()} is in the knowledge graph answer engines are trained on and cite. ${e ? (e.wiki ? "You have a graph foothold; deepen citations to convert it into answer share." : "No strong entity found — the single biggest AEO blocker. Establish the entity first.") : "Competitors are cited ~4× more on core queries."}</div></div>
        ${entityFacts}
      </div>
      <div class="card">
        <div class="head"><h3>Share-of-voice by engine</h3><span class="sub">· you vs competitor set</span></div>
        <div class="grid gauge-grid" style="gap:12px">${gauges}</div>
      </div>
    </div>
    <div class="grid c-2c">
      <div class="card">
        <div class="head"><h3>Citation source analysis</h3><span class="sub">· where AI pulls its answers</span></div>
        <table class="tbl"><thead><tr><th>Source</th><th>Who gets cited</th><th>You</th></tr></thead><tbody>${cites}</tbody></table>
      </div>
      <div class="card">
        <div class="head"><h3>Visibility recommendations</h3></div>
        <div style="display:flex;flex-direction:column;gap:9px">${recs}</div>
      </div>
    </div>
  </div>`;
}

// ---------- 6. GROWTH STRATEGIST ----------
export function strategist() {
  const phase = (title, items, badge) => `
    <div class="ph"><h4>${title} <span class="badge teal">${badge}</span></h4>
      <ul>${items.map((i) => `<li>${i}</li>`).join("")}</ul></div>`;

  return `<div class="page">
    <div class="card">
      <div class="head"><span class="eyebrow">Executive Summary</span><div class="spacer"></div>
        <button class="btn ghost" onclick="alert('Generates the full branded PDF audit in the production build.')">Export PDF audit</button></div>
      <p class="prose">${D.strategist.summary}</p>
    </div>
    <div class="card">
      <div class="head"><h3>Strategic roadmap</h3><span class="sub">· sequenced, not simultaneous</span></div>
      <div class="tl">
        ${phase("Next 30 days", D.strategist.d30, "Quick wins")}
        ${phase("Next 90 days", D.strategist.d90, "Compounding")}
        ${phase("Next 12 months", D.strategist.d365, "Strategic")}
      </div>
    </div>
  </div>`;
}

export const PAGES = {
  overview: { fn: overview, title: "Executive Overview", sub: "Strategic growth audit" },
  adstrategy: { fn: adStrategy, title: "Ad Strategy", sub: "Angle × Awareness intelligence" },
  creative: { fn: creative, title: "Creative Intelligence", sub: "Meta ad library teardown" },
  keywords: { fn: keywords, title: "Keyword Action Plan", sub: "Google paid-search strategy" },
  aeo: { fn: aeo, title: "AEO Visibility", sub: "Answer-engine optimisation" },
  strategist: { fn: strategist, title: "Growth Strategist", sub: "Synthesised action plan" },
};
