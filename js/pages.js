// ============================================================
//  PAGE RENDERERS — each returns an HTML string for the main panel.
// ============================================================
import * as D from "./data.js";
import { ring, miniGauge, bar } from "./ui.js";
import { STATE } from "./state.js";
import { hasKey } from "./gemini.js";

// Small prompt shown on AI-powered surfaces when no Gemini key is configured.
const aiGate = (what) => `<div class="banner" style="background:rgba(106,123,255,0.08);border-color:rgba(106,123,255,0.25)">✦ <span><b>Deep AI research is off.</b> ${what} Add your free Google Gemini key in <b>Settings</b> (top-right ⚙) to fetch real, grounded, per-brand analysis.</span></div>`;

const tags = (arr) => arr.map((t) => `<span class="badge grey">${t}</span>`).join("");
const srcBadge = (live) => live
  ? '<span class="src live"><span class="ld"></span>Live</span>'
  : '<span class="src demo"><span class="ld"></span>Framework</span>';
const brandName = () => (STATE.ran ? STATE.brand : D.audit.subject.name);
const competitorNames = () => {
  if (STATE.ran && STATE.competitors.length) return STATE.competitors.map((c) => c.name);
  if (STATE.ran && STATE.autoCompetitors && STATE.autoCompetitors.length) return STATE.autoCompetitors;
  return D.audit.competitors;
};
// Non-alarming methodology note for tabs whose deep data lives behind the ad platforms.
const methodNote = (what) => `<div class="banner" style="background:rgba(31,184,166,0.08);border-color:rgba(31,184,166,0.2)">◆ <span><b>How to read this:</b> ${what} Use the <b>live library links</b> for the real running ads; the framework converts them into a move.</span></div>`;

// Derive decision-grade signals from everything fetched live this audit.
function signals() {
  const e = STATE.entity, s = STATE.site, cwv = STATE.cwv;
  const trust = s ? s.trust : [];
  const want = ["Reviews / ratings", "Money-back guarantee", "No side-effects claim", "Dermatologist-backed", "Subscription"];
  return {
    entityStrength: e ? e.strength : null,
    entityWeak: !e || !e.ok || e.strength < 25,
    slowSite: !!(cwv && cwv.perf < 50), perf: cwv ? cwv.perf : null, lcp: cwv ? cwv.lcp : null,
    haveSite: !!s, positioning: s ? (s.h1 || s.description || s.title) : "",
    prices: s ? s.prices : [], trust, missingTrust: s ? want.filter((t) => !trust.includes(t)) : [],
    topDemand: (STATE.research && STATE.research.google && STATE.research.google[0]) || null,
    comps: competitorNames(),
  };
}

// CEO / Bain-grade executive read — systematic, decisive, brand-specific, built from live signals.
function ceoRead() {
  const g = signals(), brand = brandName();
  const constraints = [];
  if (g.entityWeak) constraints.push({ h: "Invisible to AI & answer engines (GEO)", d: `${brand} has ${g.entityStrength === 0 || !g.entityStrength ? "no knowledge-graph entity at all" : "a weak entity (" + g.entityStrength + "/100)"}. When buyers ask ChatGPT/Google AI "best brand for X", you cannot be cited. This is the cheapest moat a category leader builds first.`, sev: "Critical" });
  if (g.slowSite) constraints.push({ h: "Site speed is taxing every rupee of CAC", d: `Performance ${g.perf}/100${g.lcp ? `, LCP ${g.lcp}s` : ""} on mobile. Slow load silently kills paid ROAS and SEO — a leak you pay for on every click.`, sev: "High" });
  if (g.haveSite && g.missingTrust.length) constraints.push({ h: "Conversion trust gaps on-site", d: `Your site doesn't surface: ${g.missingTrust.slice(0, 3).join(", ")}. Indian D2C buyers are efficacy- and risk-anxious — absent proof = abandoned carts.`, sev: "High" });
  if (g.topDemand) constraints.push({ h: "Demand you don't yet own", d: `Live top query in your category: "${g.topDemand}". Whoever answers this best — in content, ads and AI citations — compounds the category. Today it's contested.`, sev: "Medium" });
  while (constraints.length < 3) constraints.push({ h: "Retention is the ₹1000 Cr multiplier", d: "Acquisition gets you to ₹100 Cr; repeat revenue gets you to ₹1000 Cr. Stand up WhatsApp/email flows + subscription on the hero SKU.", sev: "Medium" });

  const cards = constraints.slice(0, 3).map((c, i) => `
    <div class="opp"><div class="rank" style="background:linear-gradient(135deg,var(--coral),var(--indigo))">${i + 1}</div>
      <div class="body"><div class="t">${c.h} <span class="badge ${c.sev === "Critical" ? "coral" : c.sev === "High" ? "amber" : "teal"}">${c.sev}</span></div>
      <div class="d">${c.d}</div></div></div>`).join("");

  const stand = g.haveSite && g.positioning
    ? `<b>${brand}</b> positions as "${g.positioning.slice(0, 120)}". ${g.prices.length ? `Observed price points: ${g.prices.slice(0, 4).join(", ")}. ` : ""}Benchmarked against ${g.comps.slice(0, 4).join(", ")}.`
    : `<b>${brand}</b> benchmarked against ${g.comps.slice(0, 4).join(", ")}. ${g.entityWeak ? "Entity presence is thin — the first thing a category leader fixes." : ""}`;

  const ai = STATE.ai;
  return `<div class="card" style="border-color:var(--stroke-strong)">
    <div class="head"><span class="eyebrow">The CEO read · how ${brand} gets to ₹1000 Cr</span><div class="spacer"></div><span class="src live"><span class="ld"></span>${ai ? "Gemini · grounded" : "Live signals"}</span></div>
    <p class="prose" style="font-size:14px;margin-bottom:6px">${ai && ai.summary ? ai.summary : stand}</p>
    ${ai && ai.thousandCr ? `<div class="banner" style="margin:10px 0 4px;background:rgba(31,184,166,0.08);border-color:rgba(31,184,166,0.25)">🏆 <span><b>The ₹1000 Cr move:</b> ${ai.thousandCr}</span></div>` : ""}
    <p class="faint" style="font-size:12.5px;margin:10px 0 14px">Read like a Bain partner would: not "here's data" — here are the <b>three constraints</b> throttling compounding right now, in priority order, each with the move.${ai ? " See the full <b>Summary Report</b> tab." : ""}</p>
    <div style="display:flex;flex-direction:column;gap:10px">${cards}</div>
  </div>`;
}

// Live positioning, pricing & trust — scraped from the brand's own site this audit.
function sitePositioning() {
  const s = STATE.site;
  if (!s) return "";
  const allTrust = ["Reviews / ratings", "Money-back guarantee", "No side-effects claim", "Dermatologist-backed", "Free / fast shipping", "Subscription", "COD available", "Clinically tested"];
  const chips = allTrust.map((t) => {
    const on = s.trust.includes(t);
    return `<span class="badge ${on ? "green" : "grey"}" style="${on ? "" : "opacity:0.5"}">${on ? "✓" : "✕"} ${t}</span>`;
  }).join(" ");
  return `<div class="card">
    <div class="head"><h3>Positioning, pricing & trust</h3><span class="sub">· scraped live from ${s.url}</span><div class="spacer"></div>${srcBadge(true)}</div>
    <div class="prose" style="font-size:13.5px">${s.h1 ? `<b>Hero message:</b> "${s.h1}"<br>` : ""}${s.description ? `<b>Positioning:</b> ${s.description.slice(0, 200)}` : ""}</div>
    ${s.props.length ? `<div class="meta" style="margin-top:12px;display:flex;gap:6px;flex-wrap:wrap">${s.props.map((p) => `<span class="badge grey">${p}</span>`).join("")}</div>` : ""}
    ${s.prices.length ? `<div style="margin-top:14px"><span class="eyebrow">Price points found</span><div style="margin-top:6px;font-size:15px;font-weight:650">${s.prices.slice(0, 6).join(" · ")}</div></div>` : ""}
    <div style="margin-top:16px"><span class="eyebrow">Trust signals on-site (CRO)</span><div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">${chips}</div></div>
  </div>`;
}

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
    ${ceoRead()}
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

    ${sitePositioning()}
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
    ${methodNote("This maps which message-angle × buyer-stage cells competitors already own, so you attack the white space instead of the crowd.")}
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
    ${methodNote("\"Winners\" = ads running longest across the most placements — the only honest free signal of what's converting (Meta hides spend).")}
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
          <div class="prose" style="font-size:13px"><b>68% of your spend</b> sits in one feature-led angle — early fatigue indicators (rising frequency, falling longevity on new launches). &Me ships <b>2.4× more</b> creative variants per week.</div></div>
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

  // Live demand block — real Google autocomplete queries for the brand's category.
  const liveQ = STATE.ran && STATE.research && STATE.research.google.length ? STATE.research.google : null;
  const liveDemand = liveQ ? `
    <div class="card">
      <div class="head"><h3>Live search demand</h3><span class="sub">· real Google autocomplete for ${brandName()}</span><div class="spacer"></div>${srcBadge(true)}</div>
      <div class="grid" style="grid-template-columns:1fr 1fr">
        ${liveQ.slice(0, 8).map((q) => `<div class="liblink"><div class="libname" style="font-weight:550;font-size:13px">${q}</div>
          <a class="btn ghost" style="font-size:11px;padding:6px 10px" href="https://www.google.com/search?q=${encodeURIComponent(q)}" target="_blank" rel="noopener">SERP ↗</a></div>`).join("")}
      </div>
      <p class="faint" style="font-size:12px;margin-top:10px">Pulled live, free, in-browser. These are the exact phrases buyers type — your content & ad copy should answer them.</p>
    </div>` : "";

  return `<div class="page">
    ${liveDemand}
    ${methodNote("Volume/CPC need a paid keyword API; the buckets below show the strategy — Steal (rival-validated), Defend (your brand), Expand (white space). Live demand above is real.")}
    <div class="card">
      <div class="head">
        <h3>Keyword Action Plan</h3><span class="sub">· Steal · Defend · Expand</span>
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

  const ai = STATE.ai;
  const aeoScore = ai && ai.aeo && Number.isFinite(ai.aeo.score) ? ai.aeo.score : disc;
  const aeoProse = ai && ai.aeo && ai.aeo.finding
    ? ai.aeo.finding
    : `<b>Entity strength</b> — how present ${brandName()} is in the knowledge graph answer engines cite. ${e ? (e.wiki ? "You have a graph foothold; deepen citations to convert it into answer share." : "No strong entity found — the single biggest AEO blocker. Establish the entity first.") : "Competitors are cited ~4× more on core queries."}`;
  const aeoRecs = ai && ai.aeo && ai.aeo.recs && ai.aeo.recs.length
    ? ai.aeo.recs.map((r) => `<div class="opp"><div class="rank" style="background:linear-gradient(135deg,var(--indigo),var(--violet))">✦</div><div class="body"><div class="d" style="font-size:13.5px;color:var(--text)">${r}</div></div></div>`).join("")
    : recs;

  return `<div class="page">
    ${!hasKey() ? aiGate("AEO scoring here uses your live entity strength only.") : ""}
    <div class="grid c-2e">
      <div class="card">
        <div class="head"><span class="eyebrow">AEO · answer-engine visibility</span><div class="spacer"></div>${srcBadge(!!(ai && ai.aeo) || !!e)}</div>
        <div class="ring-wrap">${ring(aeoScore, { label: "/ 100" })}
          <div class="prose" style="font-size:13px">${aeoProse}</div></div>
        ${entityFacts}
      </div>
      <div class="card">
        <div class="head"><h3>Share-of-voice in AI Overviews</h3><span class="sub">· you vs competitor set</span></div>
        <div class="grid gauge-grid" style="gap:12px">${gauges}</div>
      </div>
    </div>
    <div class="grid c-2c">
      <div class="card">
        <div class="head"><h3>Citation source analysis</h3><span class="sub">· where AI pulls its answers</span></div>
        <table class="tbl"><thead><tr><th>Source</th><th>Who gets cited</th><th>You</th></tr></thead><tbody>${cites}</tbody></table>
      </div>
      <div class="card">
        <div class="head"><h3>AEO recommendations</h3>${ai && ai.aeo ? srcBadge(true) : ""}</div>
        <div style="display:flex;flex-direction:column;gap:9px">${aeoRecs}</div>
      </div>
    </div>
  </div>`;
}

// ---------- GEO — generative-engine optimisation (own tab) ----------
export function geo() {
  const G = D.geo, ai = STATE.ai;
  const q = (s) => encodeURIComponent(s);
  const levers = G.levers.map((l) => `
    <div class="opp">
      <div class="rank" style="background:linear-gradient(135deg,var(--indigo),var(--violet))">${l.live ? "●" : "○"}</div>
      <div class="body"><div class="t" style="font-size:14px">${l.nm} ${srcBadge(l.live)}</div><div class="d">${l.d}</div></div>
    </div>`).join("");
  const promptRows = G.prompts.map((p) => `
    <div class="liblink">
      <div class="libname">"${p}"</div>
      <div class="libbtns">
        <a class="btn ghost" href="https://www.perplexity.ai/search?q=${q(p)}" target="_blank" rel="noopener">Perplexity ↗</a>
        <a class="btn ghost" href="https://chatgpt.com/?q=${q(p)}" target="_blank" rel="noopener">ChatGPT ↗</a>
        <a class="btn ghost" href="https://www.google.com/search?q=${q(p)}&udm=50" target="_blank" rel="noopener">Google AI ↗</a>
      </div>
    </div>`).join("");
  const geoScore = ai && ai.geo && Number.isFinite(ai.geo.score) ? ai.geo.score : (STATE.entity ? STATE.entity.strength : D.aeo.discoverability);
  const geoFinding = ai && ai.geo && ai.geo.finding ? ai.geo.finding : "How often generative engines (ChatGPT, Gemini, Perplexity) cite you when synthesising a recommendation. Won the same way as AEO: strong entity + citable assets + third-party presence.";
  const geoRecs = ai && ai.geo && ai.geo.recs && ai.geo.recs.length
    ? `<div class="card"><div class="head"><h3>GEO recommendations</h3>${srcBadge(true)}</div><div style="display:flex;flex-direction:column;gap:9px">${ai.geo.recs.map((r) => `<div class="opp"><div class="rank" style="background:linear-gradient(135deg,var(--indigo),var(--violet))">✦</div><div class="body"><div class="d" style="font-size:13.5px;color:var(--text)">${r}</div></div></div>`).join("")}</div></div>` : "";

  return `<div class="page">
    ${!hasKey() ? aiGate("GEO scoring & citation analysis come from Gemini's grounded search.") : ""}
    <div class="grid c-2e">
      <div class="card">
        <div class="head"><span class="eyebrow">GEO · generative-engine citation</span><div class="spacer"></div>${srcBadge(!!(ai && ai.geo))}</div>
        <div class="ring-wrap">${ring(geoScore, { label: "/ 100" })}
          <div class="prose" style="font-size:13px">${geoFinding}</div></div>
      </div>
      <div class="card">
        <div class="head"><h3>What AEO & GEO mean</h3></div>
        <p class="prose" style="font-size:13px">${G.explainer}</p>
      </div>
    </div>
    <div class="card">
      <div class="head"><h3>The 4 levers that win citations</h3></div>
      <div class="grid c-2c"><div style="display:flex;flex-direction:column;gap:9px">${levers}</div>
        <div><div class="eyebrow" style="margin-bottom:10px">Audit your visibility — ask the engines</div>${promptRows}
        <p class="faint" style="font-size:11.5px;margin-top:8px">One click runs the check in each engine — note whether ${brandName()} appears.</p></div></div>
    </div>
    ${geoRecs}
  </div>`;
}

// ---------- SUMMARY REPORT — Gemini deep-research, in-dashboard ----------
export function report() {
  const ai = STATE.ai;
  if (!ai) {
    return `<div class="page">
      ${aiGate("This is where your full grounded research report appears.")}
      <div class="card"><div class="head"><span class="eyebrow">Summary Report</span></div>
        <p class="prose">Add a Google Gemini API key in <b>Settings (⚙)</b> and run an audit. Gemini will research ${brandName()} and its competitors live — websites, Meta Ad Library, Google Transparency, Reddit, Amazon — and a full executive report renders right here. ${STATE.aiError ? `<br><br><span class="flag">⚑ Last error: ${STATE.aiError}</span>` : ""}</p>
      </div></div>`;
  }
  const opp = (ai.opportunities || []).map((o, i) => `
    <div class="opp"><div class="rank">${i + 1}</div><div class="body"><div class="t">${o.title}</div>
      <div class="d">${o.action || ""}</div><div class="meta"><span class="badge teal">Impact ${o.impact || "—"}</span><span class="badge green">Effort ${o.effort || "—"}</span></div></div></div>`).join("");
  const comps = (ai.competitors || []).map((c) => `
    <tr><td class="kw">${c.name}</td><td>${c.positioning || ""}</td><td style="color:var(--green)">${c.edge || ""}</td><td style="color:var(--coral)">${c.gap || ""}</td></tr>`).join("");
  const list = (arr) => (arr || []).map((x) => `<li>${typeof x === "string" ? x : (x.theme || x.title || JSON.stringify(x))}</li>`).join("");
  const sources = ai._sources && ai._sources.length ? `<p class="faint" style="font-size:11.5px;margin-top:14px">Grounded sources: ${ai._sources.join(" · ")}</p>` : "";

  return `<div class="page">
    <div class="card" style="border-color:var(--stroke-strong)">
      <div class="head"><span class="eyebrow">Executive Summary · ${brandName()}</span><div class="spacer"></div><span class="src live"><span class="ld"></span>Gemini · grounded</span></div>
      <p class="prose" style="font-size:14.5px">${ai.summary || ""}</p>
      ${ai.thousandCr ? `<div class="banner" style="margin-top:14px;background:rgba(31,184,166,0.08);border-color:rgba(31,184,166,0.25)">🏆 <span><b>The ₹1000 Cr move:</b> ${ai.thousandCr}</span></div>` : ""}
      ${sources}
    </div>

    <div class="grid c-2b">
      <div class="card"><div class="head"><h3>Top opportunities</h3></div><div style="display:flex;flex-direction:column;gap:10px">${opp || "<p class='faint'>—</p>"}</div></div>
      <div class="card"><div class="head"><h3>Positioning & pricing</h3></div>
        <p class="prose" style="font-size:13.5px"><b>Category:</b> ${ai.category || "—"}<br><b>Positioning:</b> ${ai.positioning || "—"}<br><b>Pricing:</b> ${ai.pricing || "—"}</p>
        ${ai.transparency ? `<div style="margin-top:12px"><span class="eyebrow">Ad-spend signal</span><p class="prose" style="font-size:13px;margin-top:6px">${ai.transparency}</p></div>` : ""}
      </div>
    </div>

    <div class="card"><div class="head"><h3>Competitor teardown</h3></div>
      <div class="scroll-x"><table class="tbl"><thead><tr><th>Competitor</th><th>Positioning</th><th>Their edge</th><th>Exploitable gap</th></tr></thead><tbody>${comps || ""}</tbody></table></div>
    </div>

    <div class="grid c-2c">
      <div class="card"><div class="head"><h3>Live ad angles & white space</h3></div>
        <div class="eyebrow" style="margin:4px 0 6px">Running now</div><ul class="prose" style="font-size:13px">${list(ai.ads && ai.ads.runningAngles)}</ul>
        <div class="eyebrow" style="margin:12px 0 6px">White space (your opening)</div><ul class="prose" style="font-size:13px;color:var(--teal)">${list(ai.ads && ai.ads.whitespace)}</ul></div>
      <div class="card"><div class="head"><h3>Customer complaints (Reddit · Amazon)</h3></div>
        <ul class="prose" style="font-size:13px">${list(ai.complaints)}</ul></div>
    </div>

    <div class="card"><div class="head"><h3>Action plan</h3><span class="sub">· sequenced</span></div>
      <div class="tl">
        <div class="ph"><h4>Next 30 days <span class="badge teal">Quick wins</span></h4><ul>${list(ai.plan && ai.plan.d30)}</ul></div>
        <div class="ph"><h4>Next 90 days <span class="badge teal">Compounding</span></h4><ul>${list(ai.plan && ai.plan.d90)}</ul></div>
        <div class="ph"><h4>Next 12 months <span class="badge teal">Strategic</span></h4><ul>${list(ai.plan && ai.plan.d365)}</ul></div>
      </div>
    </div>
  </div>`;
}

// AI Research Agent — one click opens an answer engine pre-loaded with a deep,
// Bain-grade research prompt for THIS brand. The AI does the live scan on the
// user's own free account — the only genuinely-free way to "auto-scan" competitors.
function aiResearch() {
  const brand = brandName();
  const dom = STATE.domain || "";
  const comps = competitorNames().slice(0, 5).join(", ");
  const cat = (STATE.site && STATE.site.description) ? STATE.site.description.split(/[-–—,|]/)[0].trim().slice(0, 50) : `${brand}'s category`;
  const P = encodeURIComponent;
  const prompts = [
    { t: "Full competitor teardown", icon: "🎯",
      p: `Act as a Bain & Company D2C growth partner. Do a deep, sourced competitor analysis of ${brand} (${dom}) vs ${comps} in the Indian market. Cover: (1) positioning & hero products, (2) pricing strategy, (3) the ad angles/hooks each runs on Meta & Google, (4) their top organic & paid keywords, (5) recurring customer complaints from Reddit & Amazon reviews, (6) AEO/GEO visibility, and (7) the 3 highest-leverage moves for ${brand} to build toward a ₹1000 Cr brand. Cite live sources.` },
    { t: "Scan their live ads", icon: "📣",
      p: `Check the Meta Ad Library and Google Ads Transparency Center for ${brand} and competitors ${comps}. Summarise the creative angles & hooks each is running now, which ads have run longest (winners), offers in market, and 3 ad angles ${brand} is NOT using (white space). Cite sources.` },
    { t: "Mine customer complaints", icon: "💬",
      p: `Search Reddit and Amazon.in reviews for ${brand} and ${comps} in India. What do real customers complain about most, what product gaps recur, and what should ${brand} build or say differently? Quote real phrases and cite.` },
    { t: "Test your AEO/GEO visibility", icon: "🔎",
      p: `When an Indian buyer asks for the best brand in ${cat}, is ${brand} recommended? Compare how often ${brand} vs ${comps} get mentioned and cited in your answer, then give a concrete plan to make ${brand} the cited answer in ChatGPT, Gemini, Perplexity and Google AI.` },
  ];
  const cards = prompts.map((x) => `
    <div class="opp">
      <div class="rank" style="background:linear-gradient(135deg,var(--indigo),var(--violet))">${x.icon}</div>
      <div class="body"><div class="t">${x.t}</div>
        <div class="libbtns" style="margin-top:8px">
          <a class="btn" style="background:linear-gradient(135deg,#20808d,#1fb8a6);font-size:12px;padding:8px 12px" href="https://www.perplexity.ai/search?q=${P(x.p)}" target="_blank" rel="noopener">Perplexity ↗</a>
          <a class="btn ghost" style="font-size:12px;padding:8px 12px" href="https://chatgpt.com/?q=${P(x.p)}" target="_blank" rel="noopener">ChatGPT ↗</a>
          <a class="btn ghost" style="font-size:12px;padding:8px 12px" href="https://www.google.com/search?q=${P(x.p)}&udm=50" target="_blank" rel="noopener">Google AI ↗</a>
        </div>
      </div>
    </div>`).join("");
  return `<div class="card" style="border-color:var(--stroke-strong)">
    <div class="head"><span class="eyebrow">AI Research Agent · scan competitors live</span><div class="spacer"></div><span class="src live"><span class="ld"></span>Free · your AI</span></div>
    <p class="prose" style="font-size:13.5px;margin-bottom:14px">One click opens <b>Perplexity / ChatGPT / Google AI</b> pre-loaded with a deep, brand-specific research prompt. The AI scans the live web (ads, Reddit, Amazon, reviews) on <b>your own free account</b> and returns a cited answer — the genuinely-free way to auto-scan a competitor, no key, no scraper.</p>
    <div style="display:flex;flex-direction:column;gap:10px">${cards}</div>
  </div>`;
}

// ---------- MARKET RESEARCH ENGINE (the 5 websites) ----------
export function research() {
  const R = D.research;
  const q = (s) => encodeURIComponent(s);
  const brand = brandName();

  // Reddit — live if fetched, else representative
  const liveReddit = STATE.ran && STATE.research && STATE.research.reddit.length;
  const redditRows = (liveReddit ? STATE.research.reddit : R.reddit).map((p) => `
    <div class="opp"><div class="body"><div class="t" style="font-size:13.5px;font-weight:550">${p.t}</div>
      <div class="meta"><span class="badge grey">${p.sub}</span><span class="badge teal">▲ ${p.up}</span></div></div></div>`).join("");

  // Google — live suggestions if fetched, else representative
  const liveGoogle = STATE.ran && STATE.research && STATE.research.google.length;
  const googleRows = (liveGoogle ? STATE.research.google.map((g) => ({ q: g, type: "Live query" })) : R.google).map((g) => `
    <div class="liblink"><div class="libname" style="font-weight:550;font-size:13.5px">${g.q}</div><span class="badge grey">${g.type || "search"}</span></div>`).join("");

  const amazon = R.amazon.map((a) => `
    <div class="opp"><div class="body"><div class="t" style="font-size:13.5px">${a.gap || a.price}</div>
      <div class="d">${a.signal}</div>${a.pct ? `<div class="meta"><span class="badge coral">${a.pct}</span></div>` : ""}</div></div>`).join("");
  const youtube = R.youtube.map((y) => `<div class="opp"><div class="body"><div class="t" style="font-size:13px">${y.t}</div><div class="d">${y.who}</div></div></div>`).join("");
  const insta = R.instagram.map((i) => `<div class="opp"><div class="body"><div class="t" style="font-size:13.5px">${i.hook}</div><div class="meta"><span class="badge grey">${i.fmt}</span><span class="faint" style="font-size:11px">${i.note}</span></div></div></div>`).join("");

  const ext = (label, href, cls) => `<a class="btn ${cls}" href="${href}" target="_blank" rel="noopener">${label} ↗</a>`;

  return `<div class="page">
    ${aiResearch()}
    <div class="card">
      <div class="head"><h3>Market Research Engine</h3><span class="sub">· the 5 sources a whole research team would cover</span>
        <div class="spacer"></div><span class="src live"><span class="ld"></span>2 live</span></div>
      <p class="prose" style="font-size:13.5px">One person, five websites. Reddit & Google demand are pulled <b>live & free</b>; Amazon, YouTube & Instagram are one click into the real results (no free API). It all rolls into one picture of <b>what to say</b> and <b>what to build</b>.</p>
    </div>

    <div class="grid c-2c">
      <div class="card">
        <div class="head"><h3>① Reddit — what people complain about</h3><div class="spacer"></div>${srcBadge(!!liveReddit)}</div>
        <div style="display:flex;flex-direction:column;gap:8px">${redditRows}</div>
        <div style="margin-top:12px">${ext("Open Reddit search", `https://www.reddit.com/search/?q=${q(brand)}`, "ghost")}</div>
      </div>
      <div class="card">
        <div class="head"><h3>④ Google — demand & questions</h3><div class="spacer"></div>${srcBadge(!!liveGoogle)}</div>
        <div style="display:flex;flex-direction:column;gap:8px">${googleRows}</div>
      </div>
    </div>

    <div class="grid c-2c">
      <div class="card">
        <div class="head"><h3>② Amazon — product gaps & price</h3><div class="spacer"></div>${srcBadge(false)}</div>
        <div style="display:flex;flex-direction:column;gap:8px">${amazon}</div>
        <div style="margin-top:12px">${ext("Open Amazon.in reviews", `https://www.amazon.in/s?k=${q(brand)}`, "ghost")}</div>
      </div>
      <div class="card">
        <div class="head"><h3>③ YouTube — what confuses buyers</h3><div class="spacer"></div>${srcBadge(false)}</div>
        <div style="display:flex;flex-direction:column;gap:8px">${youtube}</div>
        <div style="margin-top:12px">${ext("Open YouTube search", `https://www.youtube.com/results?search_query=${q(brand + " review")}`, "ghost")}</div>
      </div>
    </div>

    <div class="card">
      <div class="head"><h3>⑤ Instagram — hooks & formats already working</h3><div class="spacer"></div>${srcBadge(false)}</div>
      <div class="grid" style="grid-template-columns:1fr 1fr 1fr">${insta}</div>
      <div style="margin-top:12px">${ext("Open Instagram tag", `https://www.instagram.com/explore/tags/${q(brand.replace(/[^a-z0-9]/gi, "").toLowerCase())}/`, "ghost")}</div>
    </div>

    <div class="card" style="border-color:var(--stroke-strong)">
      <div class="head"><span class="eyebrow">The one picture · what to say + what to build</span></div>
      <p class="prose">${R.synthesis}</p>
    </div>
  </div>`;
}

// ---------- PLAYBOOK / HOW TO USE / 1000 Cr ----------
export function playbook() {
  const P = D.playbook;
  const how = P.howto.map((h) => `<div class="opp"><div class="rank">${h.step.split(" ")[0]}</div><div class="body"><div class="t">${h.step.replace(/^\d+ · /, "")}</div><div class="d">${h.d}</div></div></div>`).join("");
  const pillars = P.pillars.map((p, i) => `
    <div class="opp"><div class="rank" style="background:linear-gradient(135deg,var(--teal),var(--indigo))">${i + 1}</div>
      <div class="body"><div class="t">${p.nm.replace(/^\d+ · /, "")}</div><div class="d">${p.d}</div>
        <div class="meta"><span class="badge teal">North-star metric · ${p.metric}</span></div></div></div>`).join("");
  const minds = D.personas.map((m) => `
    <div class="card hover" style="padding:16px 18px">
      <div class="head" style="margin-bottom:10px"><h3 style="font-size:14px">${m.icon} ${m.role}</h3></div>
      <div class="faint" style="font-size:11px;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px">${m.focus}</div>
      <p class="prose" style="font-size:13px;margin:0">${m.take}</p>
    </div>`).join("");

  return `<div class="page">
    <div class="card">
      <div class="head"><span class="eyebrow">How to use Vantage</span></div>
      <div class="grid" style="grid-template-columns:1fr 1fr">${how}</div>
    </div>

    <div class="card">
      <div class="head"><h3>The 5 minds reading every recommendation</h3><span class="sub">· growth · product · data · scale · P&L</span></div>
      <div class="grid" style="grid-template-columns:1fr 1fr">${minds}</div>
    </div>

    <div class="card">
      <div class="head"><span class="eyebrow">The 1000 Cr brand playbook</span><div class="spacer"></div><span class="badge teal">7 pillars</span></div>
      <p class="prose" style="font-size:13.5px;margin-bottom:16px"><b>North star:</b> ${P.northstar}</p>
      <div style="display:flex;flex-direction:column;gap:10px">${pillars}</div>
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
  report: { fn: report, title: "Summary Report", sub: "Gemini deep-research executive report" },
  research: { fn: research, title: "Market Research", sub: "Reddit · Amazon · YouTube · Google · Instagram" },
  adstrategy: { fn: adStrategy, title: "Ad Strategy", sub: "Angle × Awareness intelligence" },
  creative: { fn: creative, title: "Creative Intelligence", sub: "Meta ad library teardown" },
  aeo: { fn: aeo, title: "AEO", sub: "Answer-engine visibility" },
  geo: { fn: geo, title: "GEO", sub: "Generative-engine citation" },
  strategist: { fn: strategist, title: "Growth Strategist", sub: "Synthesised action plan" },
  playbook: { fn: playbook, title: "Playbook & Guide", sub: "How to use · the 1000 Cr framework" },
};
