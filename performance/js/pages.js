// ============================================================
//  PAGES — every screen is a pure function of (view, ctx) → HTML.
//  Interactions are declared as data-* attributes and handled by app.js.
// ============================================================
import { fmtAED, fmtAEDc, fmtNum, fmtPct, fmtDelta, fmtMin, fmtDate, fmtCompact, esc, relTime, isNil } from "./format.js";
import { lineChart, barChart, hbars, scatter, heatmap, sparkline, ring, stackBar, SERIES } from "./charts.js";
import { ACCOUNT_META, ACCOUNTS } from "./parse.js";
import { shortCentre, median } from "./analytics.js";

export const PAGES = [
  { key: "overview", label: "Overview", icon: "M3 12h4l3-8 4 16 3-8h4" },
  { key: "hospitals", label: "Hospitals", icon: "M3 21V7l9-4 9 4v14M9 21v-6h6v6M12 9v4M10 11h4" },
  { key: "campaigns", label: "Campaigns", icon: "M4 4h16v6H4zM4 14h10v6H4zM17 14l3 3-3 3" },
  { key: "keywords", label: "Keywords", icon: "M4 7h16M4 12h10M4 17h7M19 15l2 2-4 4" },
  { key: "crm", label: "Leads & CRM", icon: "M5 4h4l2 5-3 2a11 11 0 0 0 6 6l2-3 5 2v4a2 2 0 0 1-2 2A17 17 0 0 1 3 6a2 2 0 0 1 2-2" },
  { key: "actions", label: "Actions", icon: "M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" },
  { key: "data", label: "Data", icon: "M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" },
];
export const icon = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
export const accColor = (name) => `var(--s${ACCOUNT_META[name]?.slot || 5})`;
const accShort = (name) => ACCOUNT_META[name]?.short || name || "—";
const statusBadge = (r) => `<span class="badge ${r.status}">${esc(r.statusLabel)}</span>`;
const cplClass = (v, med) => (isNil(v) || !med ? "lo" : v <= 0.8 * med ? "okay" : v >= 1.6 * med ? "bad" : "meh");
const bpClass = (v, net) => (isNil(v) || !net ? "lo" : v >= net + 0.08 ? "okay" : v <= net - 0.1 ? "bad" : "");
const askBtn = (q, label = "Ask the analyst") => `<button class="btn ghost sm" data-ask="${esc(q)}">${icon("M21 12a8 8 0 0 1-11.6 7.1L4 21l1.9-5.4A8 8 0 1 1 21 12z")}${esc(label)}</button>`;
const delta = (v, invert = false) => (isNil(v) ? "" : `<b class="${(invert ? -v : v) >= 0 ? "up" : "down"}">${fmtDelta(v, 0)}</b> <span>vs prev. week</span>`);
const nothing = (msg) => `<div class="empty"><h3>Nothing to show</h3>${esc(msg)}</div>`;

// ---------- sortable table ----------
const SORT = new Map();
export function sortState(id, defKey, defDir = "desc") { if (!SORT.has(id)) SORT.set(id, { key: defKey, dir: defDir }); return SORT.get(id); }
export function setSort(id, key) { const s = SORT.get(id) || { key, dir: "desc" }; if (s.key === key) s.dir = s.dir === "desc" ? "asc" : "desc"; else { s.key = key; s.dir = "desc"; } SORT.set(id, s); }
function table(id, cols, rows, { defKey, rowAttr = () => "", total = null, limit = null } = {}) {
  const s = sortState(id, defKey || cols[1]?.key);
  const col = cols.find((c) => c.key === s.key) || cols[0];
  const sorted = rows.slice().sort((a, b) => { const va = col.sort ? col.sort(a) : a[col.key], vb = col.sort ? col.sort(b) : b[col.key]; if (va == null && vb == null) return 0; if (va == null) return 1; if (vb == null) return -1; const r = typeof va === "string" ? va.localeCompare(vb) : va - vb; return s.dir === "asc" ? r : -r; });
  const shown = limit ? sorted.slice(0, limit) : sorted;
  return `<div class="tw"><table class="tbl" data-table="${id}"><thead><tr>${cols.map((c) => `<th data-sort="${c.key}" class="${s.key === c.key ? "sorted " + s.dir : ""}" title="${esc(c.title || "")}">${esc(c.label)}</th>`).join("")}</tr></thead><tbody>${shown.map((r) => `<tr ${rowAttr(r)}>${cols.map((c) => `<td class="${c.cls ? c.cls(r) : ""}">${c.render(r)}</td>`).join("")}</tr>`).join("")}${total ? `<tr class="total">${cols.map((c) => `<td>${c.total ? c.total(total) : ""}</td>`).join("")}</tr>` : ""}</tbody></table>${limit && sorted.length > limit ? `<div class="faint small" style="padding:8px 10px">Showing ${limit} of ${sorted.length} — use search to narrow.</div>` : ""}</div>`;
}
const C = {
  name: (label, fn, sub) => ({ key: "name", label, render: (r) => `<b>${esc(fn(r))}</b>${sub ? `<small>${esc(sub(r))}</small>` : ""}`, cls: () => "name", sort: (r) => fn(r) }),
  num: (key, label, fmt = fmtNum, opts = {}) => ({ key, label, render: (r) => fmt(r[key]), total: opts.total === false ? null : (t) => fmt(t[key]), cls: opts.cls, title: opts.title }),
};

// ---------- KPI strip ----------
function kpi({ label, value, unit = "", sub = "", spark = null, color = SERIES[0], pace = null }) {
  return `<div class="kpi${spark ? "" : " nospark"}"><div class="l">${esc(label)}</div><div class="v">${value}${unit ? `<small>${unit}</small>` : ""}</div><div class="d">${sub}</div>${pace ? `<div class="pace" title="Spend vs pro-rated budget"><i style="width:${Math.min(100, pace.pct * 100).toFixed(1)}%"></i><s style="left:${Math.min(100, pace.expected * 100).toFixed(1)}%"></s></div>` : ""}${spark ? `<span class="spark">${spark}</span>` : ""}</div>`;
}
function kpiStrip(view) {
  const t = view.totals, d = view.trend.daily, w = view.trend.weekly, last = w[w.length - 1], inR = (x) => x.date >= view.period.start && x.date <= view.period.end;
  const sp = (k) => sparkline(d.filter(inR).map((x) => x[k] ?? 0), { color: "var(--accent)", width: 96, height: 30 });
  const est = view.flags.callsEstimated ? '<span class="est" title="Pro-rated from weekly typed call columns">est.</span>' : "";
  return `<div class="kpis">
    ${kpi({ label: "Spend", value: fmtAEDc(t.spend), sub: t.budget ? `<b>${fmtPct(t.pacing, 0)}</b> of ${fmtAEDc(t.budget)} budget` : "No budget loaded", spark: sp("spend"), pace: t.budget ? { pct: t.pacing, expected: 1 } : null })}
    ${kpi({ label: "Form conversions", value: fmtNum(t.conv), sub: `CPL <b>${fmtAED(t.cpl)}</b> ${last?.wow ? delta(last.wow.cpl, true) : ""}`, spark: sp("conv") })}
    ${kpi({ label: "Click-to-calls" + est, value: t.calls == null ? "—" : fmtNum(t.calls), sub: t.calls ? `<b>${fmtAED(t.costPerCall)}</b> per call · ext ${fmtNum(t.callExt)} / page ${fmtNum(t.ga4)}` : "Add the call columns on the week tabs", spark: d.some((x) => x.calls != null) ? sp("calls") : null })}
    ${kpi({ label: "CRM leads → booked", value: `${fmtNum(t.booked)}<small>/ ${fmtNum(t.crmLeads)}</small>`, sub: `Booking rate <b>${fmtPct(t.bookingPct, 0)}</b> · reached ${fmtPct(t.reachedPct, 0)}`, spark: sp("crmLeads") })}
    ${kpi({ label: "Cost per booking", value: fmtAEDc(t.costPerBooking), sub: `Cost per CRM lead <b>${fmtAED(t.costPerCrmLead)}</b>`, spark: null })}
    ${kpi({ label: "Impression share", value: fmtPct(t.is, 0), sub: `<b>${fmtPct(t.lostIs, 0)}</b> lost to rank · CTR ${fmtPct(t.ctr, 1)} · CPC ${fmtAED(t.cpc)}`, spark: sp("is") })}
  </div>`;
}

// ---------- OVERVIEW ----------
export function overview(view, ctx) {
  const { accounts, trend, specialties, centres, crm } = view, ins = ctx.insights;
  const wk = trend.weekly, wl = wk.map((w) => w.label.replace(/Week (\d) · /, "W$1 · "));
  const dl = trend.daily.map((d) => fmtDate(d.date));
  const hl = [trend.daily.findIndex((d) => d.date >= view.period.start), trend.daily.findIndex((d) => d.date === view.period.end)];
  const hlw = [wk.findIndex((w) => w.end >= view.period.start), wk.findIndex((w) => w.start <= view.period.end && w.end >= view.period.end) === -1 ? wk.length - 1 : wk.findIndex((w) => w.start <= view.period.end && w.end >= view.period.end)];
  const inAcc = accounts.filter((a) => a.inScope);
  const accCards = accounts.map((a) => { const sp = trend.daily; return `<div class="a ${a.inScope ? "" : "dim"}" style="--c:${accColor(a.name)}" data-filter-account="${esc(a.name)}" role="button" tabindex="0" title="Focus on ${esc(a.name)}"><h4><span class="sw" style="background:${accColor(a.name)}"></span>${esc(a.name)}</h4><div class="b">${esc(a.blurb)} · ${a.centres} centre${a.centres === 1 ? "" : "s"}</div><div class="big">${fmtAEDc(a.spend)}</div><div class="small faint">${a.share != null ? fmtPct(a.share, 0) + " of spend" : "out of scope"}${a.budget ? ` · ${fmtPct(a.pacing, 0)} of budget` : ""}</div><div class="row"><div>CPL<b>${fmtAED(a.cpl)}</b></div><div>Calls<b>${a.calls == null ? "—" : fmtNum(a.calls)}</b></div><div>Cost/call<b>${fmtAED(a.costPerCall)}</b></div><div>CRM leads<b>${fmtNum(a.crmLeads)}</b></div><div>Booked<b>${fmtNum(a.booked)} <small class="faint">${fmtPct(a.bookingPct, 0)}</small></b></div><div>Cost/booking<b>${fmtAEDc(a.costPerBooking)}</b></div></div></div>`; }).join("");
  const specRows = specialties.filter((s) => s.spend > 0 || s.crmLeads > 0);
  const cplMed = median(centres.filter((c) => c.conv >= 1).map((c) => c.cpl));
  return `<div class="page">
    <div class="card"><div class="head"><div><div class="eyebrow">Executive read · ${esc(view.scopeLabel)}</div></div><div class="grow"></div>${askBtn("Give me the executive summary and the three things to do this week", "Discuss with the analyst")}</div><p class="lede">${esc(ctx.summary)}</p></div>
    ${kpiStrip(view)}
    <div><div class="head" style="display:flex;align-items:center;gap:10px;margin-bottom:10px"><h2 class="sec">Ad <em>accounts</em></h2><span class="faint small">Click an account to focus every page on it</span></div><div class="acc">${accCards}</div></div>
    <div class="grid g2">
      <div class="card"><div class="head"><div><h3>Weekly spend vs budget</h3><div class="sub">Pro-rated budget per week · ${wk.some((w) => w.note) ? "⚑ sheet annotations shown" : "AED"}</div></div></div>
        ${wk.length ? barChart({ labels: wl, series: [{ name: "Spend", color: "var(--accent)", values: wk.map((w) => w.spend) }, { name: "Budget (pro-rata)", color: "var(--track)", values: wk.map((w) => w.budget || 0) }], fmt: (v) => fmtAED(v), highlight: hlw, height: 210 }) : nothing("No weekly data")}
        ${wk.filter((w) => w.note).map((w) => `<div class="small muted" style="margin-top:8px">⚑ <b>${esc(w.label)}</b>: ${esc(w.note)}</div>`).join("")}</div>
      <div class="card"><div class="head"><div><h3>Efficiency by week</h3><div class="sub">Cost per form lead vs cost per CRM booking (AED)</div></div></div>
        ${wk.length ? lineChart({ labels: wl, series: [{ name: "CPL (form)", color: "var(--accent)", values: wk.map((w) => w.cpl) }, { name: "Cost per booking", color: "var(--s2)", values: wk.map((w) => w.costPerBooking) }, { name: "Cost per call", color: "var(--s3)", values: wk.map((w) => w.costPerCall), dash: true }], fmt: (v) => fmtAED(v), highlight: hlw, height: 210 }) : nothing("No weekly data")}</div>
    </div>
    <div class="grid g2">
      <div class="card"><div class="head"><div><h3>Daily click-to-calls by account</h3><div class="sub">Call extension taps + landing-page call taps</div></div></div>
        ${trend.daily.some((d) => d.calls != null) && view.filter.account === "all" && !view.filter.centre && ctx.model.dailyCalls.length ? barChart({ labels: dl, series: ACCOUNTS.map((a) => ({ name: accShort(a), color: accColor(a), values: ctx.model.dailyCalls.map((dc) => dc.acc[a]?.total ?? 0) })), stacked: true, fmt: (v) => fmtNum(v), highlight: hl, height: 220, xTick: (l, i) => (i % 3 === 0 ? l : "") }) : trend.daily.some((d) => d.calls != null) ? barChart({ labels: dl, series: [{ name: "Calls", color: "var(--s3)", values: trend.daily.map((d) => d.calls ?? 0) }], fmt: fmtNum, highlight: hl, height: 220, xTick: (l, i) => (i % 3 === 0 ? l : "") }) : nothing("Daily calls need the Daily Calls Trend tab (account level).")}</div>
      <div class="card"><div class="head"><div><h3>Daily demand</h3><div class="sub">Form conversions (ads) vs leads logged by the call centre</div></div></div>
        ${lineChart({ labels: dl, series: [{ name: "Form conversions", color: "var(--accent)", values: trend.daily.map((d) => d.conv) }, { name: "CRM leads", color: "var(--s2)", values: trend.daily.map((d) => d.crmLeads) }, { name: "Booked", color: "var(--s3)", values: trend.daily.map((d) => d.booked) }], fmt: fmtNum, area: false, highlight: hl, height: 220, xTick: (l, i) => (i % 3 === 0 ? l : ""), markers: false })}</div>
    </div>
    <div class="grid g-32">
      <div class="card"><div class="head"><div><h3>What to do next</h3><div class="sub">Ranked by money at stake · ${ins.length} findings</div></div><div class="grow"></div><button class="btn ghost sm" data-nav="actions">All actions →</button></div>${insightList(ins.slice(0, 6))}</div>
      <div class="card"><div class="head"><div><h3>Centres by spend</h3><div class="sub">Bar = spend · right = CPL (green under median, red over)</div></div><div class="grow"></div><button class="btn ghost sm" data-nav="hospitals">Hospitals →</button></div>
        ${hbars({ rows: centres.slice(0, 12).map((c) => ({ key: c.name, label: c.short, sub: accShort(c.account), value: c.spend, color: accColor(c.account), display: fmtCompact(c.spend), extra: `<span class="${cplClass(c.cpl, cplMed)}">${fmtAED(c.cpl)}</span>` })), onClickAttr: "data-open-centre", labelWidth: 120 })}</div>
    </div>
    <div class="card"><div class="head"><div><h3>Specialties</h3><div class="sub">Campaign spend matched to call-centre departments</div></div></div>
      ${table("spec", [C.name("Specialty", (r) => r.name, (r) => `${r.campaigns} campaign${r.campaigns === 1 ? "" : "s"}`), C.num("spend", "Spend", fmtAEDc), C.num("conv", "Conv", (v) => fmtNum(v)), { key: "cpl", label: "CPL", render: (r) => fmtAED(r.cpl), cls: (r) => cplClass(r.cpl, view.baseline.cplMedian) }, C.num("crmLeads", "CRM leads"), C.num("booked", "Booked"), { key: "bookingPct", label: "Booking %", render: (r) => fmtPct(r.bookingPct, 0), cls: (r) => bpClass(r.bookingPct, view.totals.bookingPct) }, C.num("costPerBooking", "Cost / booking", fmtAEDc), C.num("is", "Impr. share", (v) => fmtPct(v, 0)), C.num("lostIs", "Lost (rank)", (v) => fmtPct(v, 0))], specRows, { defKey: "spend", rowAttr: (r) => `class="clickable" data-open-specialty="${esc(r.name)}"` })}</div>
  </div>`;
}

export function insightList(list, { compact = false } = {}) {
  if (!list.length) return `<div class="empty">No findings for this scope — widen the date range or account.</div>`;
  return `<div class="ins">${list.map((i) => `<div class="in ${i.sev}"><i></i><div><div class="scope"><span class="badge ${i.sev}">${i.sev === "warn" ? "Watch" : i.sev === "good" ? "Opportunity" : i.sev}</span><span class="badge grey">${esc(i.scope)}</span></div><div class="t">${esc(i.title)}</div>${compact ? "" : `<div class="d">${esc(i.detail || "")}</div>`}<div class="a"><b>Do:</b>${esc(i.action)}</div>${i.entity ? `<div style="margin-top:8px"><button class="btn ghost sm" data-open-centre="${esc(i.entity)}">Open ${esc(shortCentre(i.entity))}</button> ${askBtn(`Why is ${shortCentre(i.entity)} flagged: ${i.title}? What exactly should I change?`, "Ask")}</div>` : i.entities ? `<div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">${i.entities.slice(0, 4).map((n) => `<button class="btn ghost sm" data-open-campaign-name="${esc(n)}">${esc(n.replace(/^Alo_NMC_Search_/, ""))}</button>`).join("")}</div>` : ""}</div><div class="imp">${i.impact ? `<b>${fmtAEDc(i.impact)}</b><small>at stake</small>` : ""}</div></div>`).join("")}</div>`;
}

// ---------- HOSPITALS ----------
export function hospitals(view, ctx) {
  const { centres } = view; const q = (ctx.ui.hospSearch || "").toLowerCase();
  const rows = centres.filter((c) => !q || c.name.toLowerCase().includes(q) || c.account.toLowerCase().includes(q));
  const cplMed = median(centres.filter((c) => c.conv >= 1 && c.spend >= 200).map((c) => c.cpl));
  const pts = centres.filter((c) => c.spend > 50 && c.cpl != null).map((c) => ({ x: c.spend, y: Math.min(c.cpl, (cplMed || 500) * 6), r: Math.max(1, c.crmLeads), label: c.name, sub: `${c.account} · booking ${fmtPct(c.bookingPct, 0)}`, color: accColor(c.account), key: c.name, rLabel: "CRM leads" }));
  const mode = ctx.ui.hospView || "table";
  const cards = rows.map((c) => `<div class="cc" data-open-centre="${esc(c.name)}" role="button" tabindex="0"><div><h4><span class="sw" style="background:${accColor(c.account)}"></span>${esc(c.short)}</h4><div class="m">${esc(c.account)} · ${esc(c.region)} · ${c.campaigns} campaigns</div></div>${ring(c.health, { size: 54, stroke: 5 })}<div class="kv"><div>Spend<b>${fmtAEDc(c.spend)} <small class="faint">${c.pacing != null ? fmtPct(c.pacing, 0) + " of budget" : ""}</small></b></div><div>CPL<b class="${cplClass(c.cpl, cplMed)}">${fmtAED(c.cpl)}</b></div><div>Calls<b>${c.calls == null ? "—" : fmtNum(c.calls)}</b></div><div>Booked<b>${fmtNum(c.booked)}<small class="faint">/${fmtNum(c.crmLeads)} · ${fmtPct(c.bookingPct, 0)}</small></b></div><div>Cost / booking<b>${fmtAEDc(c.costPerBooking)}</b></div><div>Impr. share<b>${fmtPct(c.is, 0)} <small class="faint">lost ${fmtPct(c.lostIs, 0)}</small></b></div></div></div>`).join("");
  const cols = [C.name("Centre", (r) => r.short, (r) => `${r.account} · ${r.region}`), { key: "health", label: "Health", render: (r) => `<span class="badge ${r.healthBand === "strong" ? "good" : r.healthBand === "steady" ? "grey" : "critical"}">${r.health}</span>`, title: "0–100: CPL vs network (35%), booking rate (30%), pacing (15%), impression share (20%)" }, C.num("spend", "Spend", fmtAEDc), { key: "pacing", label: "Of budget", render: (r) => (r.pacing == null ? "—" : `<span class="bar"><i style="width:${Math.min(100, r.pacing * 100)}%;background:${r.pacing > 1.1 ? "var(--critical)" : r.pacing < 0.7 ? "var(--warn)" : "var(--good)"}"></i></span>${fmtPct(r.pacing, 0)}`) }, C.num("conv", "Conv", (v) => fmtNum(v)), { key: "cpl", label: "CPL", render: (r) => fmtAED(r.cpl), cls: (r) => cplClass(r.cpl, cplMed) }, C.num("cpc", "CPC", fmtAED), C.num("calls", "Calls", (v) => (v == null ? "—" : fmtNum(v))), C.num("costPerCall", "Cost/call", fmtAED), C.num("crmLeads", "CRM leads"), C.num("booked", "Booked"), { key: "bookingPct", label: "Booking %", render: (r) => fmtPct(r.bookingPct, 0), cls: (r) => bpClass(r.bookingPct, view.totals.bookingPct) }, C.num("costPerBooking", "Cost/booking", fmtAEDc), C.num("is", "IS", (v) => fmtPct(v, 0)), C.num("lostIs", "Lost (rank)", (v) => fmtPct(v, 0))];
  return `<div class="page">
    <div class="card"><div class="head"><div><h3>Spend vs CPL</h3><div class="sub">Bubble size = CRM leads · colour = ad account · dotted line = network median CPL · click a bubble to drill in</div></div></div>
      ${pts.length ? scatter({ points: pts, fmtX: (v) => fmtAED(v), fmtY: (v) => fmtAED(v), xLabel: "Spend (AED, log)", yLabel: "CPL (AED)", logX: true, refY: cplMed, height: 250 }) : nothing("No centre spend in range")}
      <div class="cv-legend">${ACCOUNTS.map((a) => `<span><i style="background:${accColor(a)}"></i>${esc(a)}</span>`).join("")}</div></div>
    <div class="toolbar"><h2 class="sec">${rows.length} <em>centres</em></h2><div class="grow" style="flex:1"></div><div class="search">${icon("M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14zM20 20l-3.5-3.5")}<input data-ui="hospSearch" value="${esc(ctx.ui.hospSearch || "")}" placeholder="Search centres…" aria-label="Search centres"/></div><div class="seg" role="tablist"><button data-ui-set="hospView=table" class="${mode === "table" ? "on" : ""}">Table</button><button data-ui-set="hospView=cards" class="${mode === "cards" ? "on" : ""}">Cards</button></div></div>
    ${mode === "cards" ? `<div class="cgrid">${cards}</div>` : `<div class="card flat" style="padding:6px 8px">${table("centres", cols, rows, { defKey: "spend", rowAttr: (r) => `class="clickable" data-open-centre="${esc(r.name)}"`, total: view.totals })}</div>`}
  </div>`;
}

// ---------- CAMPAIGNS ----------
export function campaigns(view, ctx) {
  const all = view.campaigns; const q = (ctx.ui.campSearch || "").toLowerCase(); const st = ctx.ui.campStatus || "all"; const sp = ctx.ui.campSpec || "all";
  const rows = all.filter((c) => (st === "all" || c.status === st) && (sp === "all" || c.specialty === sp) && (!q || c.name.toLowerCase().includes(q) || c.centre.toLowerCase().includes(q)));
  const counts = {}; for (const c of all) { counts[c.status] = counts[c.status] || { n: 0, spend: 0 }; counts[c.status].n++; counts[c.status].spend += c.spend; }
  const specs = [...new Set(all.map((c) => c.specialty))].sort();
  const med = view.baseline.cplMedian;
  const board = (status, title, blurb) => { const list = all.filter((c) => c.status === status).sort((a, b) => (status === "scale" ? b.lost - a.lost : b.spend - a.spend)).slice(0, 5); return `<div class="card"><div class="head"><div><h3><span class="badge ${status}">${title}</span></h3><div class="sub">${blurb}</div></div><div class="grow"></div><span class="pill"><b>${counts[status]?.n || 0}</b> · ${fmtAEDc(counts[status]?.spend || 0)}</span></div>${list.length ? `<div class="ins">${list.map((c) => `<div class="in ${status === "scale" ? "good" : status === "pause" ? "critical" : "warn"}" style="padding:10px 12px 10px 0;cursor:pointer" data-open-campaign="${c.id}"><i></i><div><div class="t" style="font-size:13px">${esc(c.name.replace(/^Alo_NMC_Search_/, ""))}</div><div class="d">${esc(c.specialty)} · ${esc(shortCentre(c.centre))} · ${fmtAEDc(c.spend)} · ${fmtNum(c.conv)} conv · CPL ${fmtAED(c.cpl)}</div><div class="d faint">${esc(c.why)}</div></div></div>`).join("")}</div>` : `<div class="faint small">None in this scope.</div>`}</div>`; };
  const cols = [C.name("Campaign", (r) => r.name.replace(/^Alo_NMC_Search_/, ""), (r) => `${r.specialty} · ${shortCentre(r.centre)} · ${accShort(r.account)}`), { key: "status", label: "Status", render: statusBadge, sort: (r) => ({ scale: 0, fix: 1, pause: 2, hold: 3, watch: 4 }[r.status]) }, C.num("spend", "Spend", fmtAEDc), { key: "share", label: "Share", render: (r) => fmtPct(r.share, 1) }, C.num("clicks", "Clicks"), C.num("ctr", "CTR", (v) => fmtPct(v, 1)), C.num("cpc", "CPC", fmtAED), C.num("conv", "Conv", (v) => fmtNum(v, 1)), { key: "cpl", label: "CPL", render: (r) => fmtAED(r.cpl), cls: (r) => cplClass(r.cpl, med) }, C.num("convRate", "Conv rate", (v) => fmtPct(v, 1)), C.num("is", "IS", (v) => fmtPct(v, 0)), C.num("lostIs", "Lost (rank)", (v) => fmtPct(v, 0)), C.num("daysActive", "Days")];
  return `<div class="page">
    <div class="grid g3">${board("scale", "Scale", "Cheap leads, reach capped by rank — raise bids & budgets")}${board("fix", "Fix", "Running well over the network CPL")}${board("pause", "Pause / rebuild", "Spending with zero conversions")}</div>
    <div class="toolbar"><h2 class="sec">${rows.length} <em>campaigns</em> <span class="faint small" style="font-family:var(--font)">median CPL ${fmtAED(med)}</span></h2><div style="flex:1"></div>
      <div class="seg">${[["all", "All"], ["scale", "Scale"], ["hold", "Hold"], ["fix", "Fix"], ["pause", "Pause"], ["watch", "Watch"]].map(([k, l]) => `<button data-ui-set="campStatus=${k}" class="${st === k ? "on" : ""}">${l}${k !== "all" && counts[k] ? ` <span class="faint">${counts[k].n}</span>` : ""}</button>`).join("")}</div>
      <div class="fsel"><label>Specialty</label><select data-ui="campSpec"><option value="all">All</option>${specs.map((s) => `<option ${sp === s ? "selected" : ""} value="${esc(s)}">${esc(s)}</option>`).join("")}</select></div>
      <div class="search">${icon("M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14zM20 20l-3.5-3.5")}<input data-ui="campSearch" value="${esc(ctx.ui.campSearch || "")}" placeholder="Search campaigns…" aria-label="Search campaigns"/></div></div>
    <div class="card flat" style="padding:6px 8px">${table("campaigns", cols, rows, { defKey: "spend", rowAttr: (r) => `class="clickable" data-open-campaign="${r.id}"` })}</div>
  </div>`;
}

// ---------- KEYWORDS ----------
export function keywords(view, ctx) {
  const { kwStats, keywords: kws } = view; const q = (ctx.ui.kwSearch || "").toLowerCase();
  const med = view.baseline.cplMedian;
  const rows = kws.filter((k) => k.cost > 0 && (!q || k.kw.toLowerCase().includes(q) || k.campaign.toLowerCase().includes(q) || k.adgroup.toLowerCase().includes(q)));
  const cols = [C.name("Keyword", (r) => r.kw, (r) => `${r.match} · ${r.adgroup} · ${r.campaign.replace(/^Alo_NMC_Search_/, "")}`), { key: "qs", label: "QS", render: (r) => (r.qs == null ? "—" : `<span class="${r.qs <= 3 ? "bad" : r.qs >= 7 ? "okay" : "meh"}">${r.qs}</span>`) }, C.num("impr", "Impr"), C.num("clicks", "Clicks"), C.num("ctr", "CTR", (v) => fmtPct(v, 1)), C.num("cost", "Cost", fmtAEDc), C.num("cpc", "CPC", fmtAED), C.num("conv", "Conv", (v) => fmtNum(v, 1)), { key: "cpl", label: "CPL", render: (r) => fmtAED(r.cpl), cls: (r) => cplClass(r.cpl, med) }, C.num("is", "IS", (v) => fmtPct(v, 0)), C.num("lostIs", "Lost (rank)", (v) => fmtPct(v, 0))];
  return `<div class="page">
    <div class="kpis" style="grid-template-columns:repeat(4,1fr)">
      ${kpi({ label: "Keywords with spend", value: fmtNum(kwStats.keywordsWithSpend), sub: `${fmtNum(kws.length)} keyword rows in scope (month level)` })}
      ${kpi({ label: "Spend with no conversions", value: fmtAEDc(kwStats.wastedTotal), sub: `<b>${fmtPct(kwStats.wastedTotal / (kwStats.totalCost || 1), 0)}</b> of spend across ${fmtNum(kwStats.wastedCount)} keywords` })}
      ${kpi({ label: "Low Quality Score spend", value: fmtAEDc(kwStats.qsBands[0].cost), sub: `<b>${fmtPct(kwStats.qsBands[0].share, 0)}</b> on QS 1–3 · ${fmtNum(kwStats.qsBands[0].n)} keywords` })}
      ${kpi({ label: "Best match type", value: esc((kwStats.matchTypes.filter((m) => m.conv >= 3).sort((a, b) => a.cpl - b.cpl)[0] || {}).match || "—"), sub: kwStats.matchTypes.map((m) => `${m.match} ${fmtAED(m.cpl)}`).join(" · ") })}
    </div>
    <div class="grid g2">
      <div class="card"><div class="head"><div><h3>Match types</h3><div class="sub">Where the money goes, and what it buys</div></div></div>${table("match", [C.name("Match type", (r) => r.match, (r) => `${r.n} keywords`), C.num("cost", "Cost", fmtAEDc), { key: "share", label: "Share", render: (r) => fmtPct(r.share, 0) }, C.num("clicks", "Clicks"), C.num("ctr", "CTR", (v) => fmtPct(v, 1)), C.num("conv", "Conv", (v) => fmtNum(v, 1)), { key: "cpl", label: "CPL", render: (r) => fmtAED(r.cpl), cls: (r) => cplClass(r.cpl, med) }], kwStats.matchTypes, { defKey: "cost" })}</div>
      <div class="card"><div class="head"><div><h3>Quality Score bands</h3><div class="sub">Low QS = you pay more per click for the same slot</div></div></div>${table("qs", [C.name("Band", (r) => r.band, (r) => `${r.n} keywords`), C.num("cost", "Cost", fmtAEDc), { key: "share", label: "Share", render: (r) => fmtPct(r.share, 0) }, C.num("impr", "Impr"), C.num("conv", "Conv", (v) => fmtNum(v, 1)), { key: "cpl", label: "CPL", render: (r) => fmtAED(r.cpl), cls: (r) => cplClass(r.cpl, med) }], kwStats.qsBands, { defKey: "cost" })}</div>
    </div>
    <div class="grid g2">
      <div class="card"><div class="head"><div><h3>Top wasters</h3><div class="sub">Spend with no conversions — pause or add as negatives</div></div><div class="grow"></div>${askBtn("Which keywords should I pause first and why?", "Ask")}</div>${hbars({ rows: kwStats.wasted.slice(0, 15).map((k) => ({ label: k.kw, sub: `${k.match} · ${shortCentre(k.centre)}`, value: k.cost, display: fmtAEDc(k.cost), color: "var(--critical)", extra: `${fmtNum(k.clicks)} clicks` })), labelWidth: 170 })}</div>
      <div class="card"><div class="head"><div><h3>Proven winners</h3><div class="sub">Lowest CPL with real volume — protect and expand these</div></div></div>${hbars({ rows: kwStats.winners.slice(0, 15).map((k) => ({ label: k.kw, sub: `${k.match} · ${shortCentre(k.centre)}`, value: k.conv, display: `${fmtNum(k.conv, 1)} conv`, color: "var(--good)", extra: `CPL ${fmtAED(k.cpl)}` })), labelWidth: 170 })}</div>
    </div>
    <div class="toolbar"><h2 class="sec">All <em>keywords</em></h2><div style="flex:1"></div><div class="search">${icon("M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14zM20 20l-3.5-3.5")}<input data-ui="kwSearch" value="${esc(ctx.ui.kwSearch || "")}" placeholder="Search keywords, ad groups, campaigns…" aria-label="Search keywords"/></div></div>
    <div class="card flat" style="padding:6px 8px">${table("kws", cols, rows, { defKey: "cost", limit: 150 })}</div>
  </div>`;
}

// ---------- LEADS & CRM ----------
export function crm(view, ctx) {
  const c = view.crm; if (!c.leads) return `<div class="page">${nothing("No call-centre leads in this scope. Load the Lead Data export to see CRM outcomes.")}</div>`;
  const net = c.bookingPct;
  const centreRows = view.centres.filter((x) => x.crmLeads > 0);
  return `<div class="page">
    <div class="kpis">
      ${kpi({ label: "Leads logged", value: fmtNum(c.leads), sub: `${fmtNum(c.leads / view.period.days, 1)} per day` })}
      ${kpi({ label: "Booked", value: fmtNum(c.booked), sub: `Booking rate <b>${fmtPct(c.bookingPct, 0)}</b> · when reached <b>${fmtPct(c.reachedPct, 0)}</b>` })}
      ${kpi({ label: "Cost per booking", value: fmtAEDc(c.costPerBooking), sub: `Cost per lead <b>${fmtAED(c.costPerLead)}</b>` })}
      ${kpi({ label: "Median first call", value: fmtMin(c.medianResp), sub: `${fmtNum(c.untouched)} pending & uncalled` })}
      ${kpi({ label: "Not reachable", value: fmtPct(c.notReachablePct, 0), sub: `${fmtNum(c.notReachable)} leads never reached` })}
      ${kpi({ label: "Info-only callers", value: fmtPct(c.infoPct, 0), sub: `${fmtNum(c.infoSeekers)} asked for information only` })}
    </div>
    <div class="grid g-32">
      <div class="card"><div class="head"><div><h3>Lead outcomes</h3><div class="sub">Every lead the call centre logged in this scope</div></div></div>${stackBar({ segments: [{ label: "Booked", value: c.booked, color: "var(--good)" }, { label: "Not booked", value: c.notBooked, color: "var(--serious)" }, { label: "Not reachable", value: c.notReachable, color: "var(--critical)" }, { label: "Pending", value: c.pending, color: "var(--text-3)" }] })}
        <div style="margin-top:18px"><div class="tag" style="margin-bottom:8px">Why leads did not book</div>${hbars({ rows: c.reasons.slice(0, 10).map((r) => ({ label: r.reason, value: r.n, extra: fmtPct(r.pct, 0), color: /reachable|answer|off|invalid/i.test(r.reason) ? "var(--critical)" : /information|details/i.test(r.reason) ? "var(--warn)" : "var(--serious)" })), labelWidth: 190 })}</div></div>
      <div class="card"><div class="head"><div><h3>Speed to lead</h3><div class="sub">Booking rate by time to first call</div></div><div class="grow"></div>${askBtn("How much does call speed affect booking rate here?", "Ask")}</div>${barChart({ labels: c.respBuckets.map((b) => b.label), series: [{ name: "Booking rate", color: "var(--accent)", values: c.respBuckets.map((b) => (b.pct || 0) * 100) }], fmt: (v, i) => `${v.toFixed(0)}% of ${c.respBuckets[i].n} leads`, height: 200, yMax: 100 })}
        <div class="small muted" style="margin-top:8px">${c.respBuckets.map((b) => `<span class="pill" style="margin:2px"><b>${b.label}</b> ${b.n}</span>`).join(" ")}</div></div>
    </div>
    <div class="grid g2">
      <div class="card"><div class="head"><div><h3>Leads by hour of day</h3><div class="sub">When demand arrives — staff the queue to the peaks</div></div></div>${barChart({ labels: c.hours.map((h) => `${String(h.h).padStart(2, "0")}:00`), series: [{ name: "Leads", color: "var(--s1)", values: c.hours.map((h) => h.n) }, { name: "Booked", color: "var(--s3)", values: c.hours.map((h) => h.booked) }], fmt: fmtNum, height: 200, xTick: (l, i) => (i % 3 === 0 ? l : "") })}
        <div style="margin-top:10px">${hbars({ rows: c.slots.map((s) => ({ label: s.label, value: s.pct || 0, display: fmtPct(s.pct, 0), extra: `${s.booked}/${s.n} booked`, color: (s.pct || 0) >= (net || 0) ? "var(--good)" : "var(--serious)" })), max: 1, labelWidth: 130 })}</div></div>
      <div class="card"><div class="head"><div><h3>Weekday pattern</h3><div class="sub">Leads and bookings by day of week</div></div></div>${barChart({ labels: c.weekdays.map((d) => d.d), series: [{ name: "Leads", color: "var(--s1)", values: c.weekdays.map((d) => d.n) }, { name: "Booked", color: "var(--s3)", values: c.weekdays.map((d) => d.booked) }], fmt: fmtNum, height: 200 })}
        <div style="margin-top:12px" class="small muted">Priority mix: ${c.priority.map((p) => `<span class="pill"><b>${esc(p.p)}</b> ${p.n} · ${fmtPct(p.booked / p.n, 0)} booked</span>`).join(" ")}${c.doctorChosen ? ` · Leads naming a doctor: <b>${fmtPct(c.doctorChosenPct, 0)}</b> (book at ${fmtPct(c.doctorBookedPct, 0)})` : ""}</div></div>
    </div>
    <div class="grid g2">
      <div class="card"><div class="head"><div><h3>Departments</h3><div class="sub">Booking rate vs network ${fmtPct(net, 0)} · spend matched by specialty</div></div></div>${table("depts", [C.name("Department", (r) => r.dept), C.num("leads", "Leads"), C.num("booked", "Booked"), { key: "pct", label: "Booking %", render: (r) => fmtPct(r.pct, 0), cls: (r) => bpClass(r.pct, net) }, C.num("notReachable", "Unreached"), C.num("info", "Info-only"), C.num("spend", "Spend", fmtAEDc), C.num("costPerBooking", "Cost/booking", fmtAEDc)], c.depts, { defKey: "leads" })}</div>
      <div class="card"><div class="head"><div><h3>Centres</h3><div class="sub">Where the call centre converts, and where it leaks</div></div></div>${table("crmCentres", [C.name("Centre", (r) => r.short, (r) => r.account), C.num("crmLeads", "Leads"), C.num("booked", "Booked"), { key: "bookingPct", label: "Booking %", render: (r) => fmtPct(r.bookingPct, 0), cls: (r) => bpClass(r.bookingPct, net) }, { key: "notReachablePct", label: "Unreached", render: (r) => fmtPct(r.notReachablePct, 0), cls: (r) => (r.notReachablePct >= 0.33 ? "bad" : "") }, C.num("costPerBooking", "Cost/booking", fmtAEDc)], centreRows, { defKey: "crmLeads", rowAttr: (r) => `class="clickable" data-open-centre="${esc(r.name)}"` })}</div>
    </div>
    ${c.agents ? `<div class="card"><div class="head"><div><h3>Call-centre agents</h3><div class="sub">Only visible when the lead export carries the “Handled By” column</div></div></div>${table("agents", [C.name("Agent", (r) => r.agent), C.num("leads", "Leads"), C.num("booked", "Booked"), { key: "pct", label: "Booking %", render: (r) => fmtPct(r.pct, 0), cls: (r) => bpClass(r.pct, net) }, C.num("medianResp", "Median first call", fmtMin)], c.agents.filter((a) => a.leads >= 3), { defKey: "leads" })}</div>` : `<div class="banner">Agent-level performance appears here when the loaded lead export includes the <b>Handled By</b> column (the bundled sample strips names).</div>`}
  </div>`;
}

// ---------- ACTIONS ----------
export function actions(view, ctx) {
  const ins = ctx.insights; const sev = ctx.ui.actSev || "all"; const list = ins.filter((i) => sev === "all" || i.sev === sev);
  const counts = {}; for (const i of ins) counts[i.sev] = (counts[i.sev] || 0) + 1;
  const plan = ins.filter((i) => i.sev !== "info").slice(0, 10);
  return `<div class="page">
    <div class="card"><div class="head"><div><div class="eyebrow">This week's plan · ${esc(view.scopeLabel)}</div><h3 style="margin-top:4px">${plan.length} actions, ordered by money at stake</h3></div><div class="grow"></div><button class="btn ghost sm" data-copy-plan>Copy plan</button>${askBtn("Turn the action plan into a short email to the client with expected impact", "Draft client email")}</div>
      <ol style="margin-left:18px;line-height:1.7;font-size:13.5px">${plan.map((i) => `<li><b>${esc(i.title)}</b> — ${esc(i.action)}${i.impact ? ` <span class="faint">(${fmtAEDc(i.impact)} at stake)</span>` : ""}</li>`).join("")}</ol></div>
    <div class="toolbar"><h2 class="sec">All <em>findings</em></h2><div style="flex:1"></div><div class="seg">${[["all", "All"], ["critical", "Critical"], ["warn", "Watch"], ["good", "Opportunities"], ["info", "Context"]].map(([k, l]) => `<button data-ui-set="actSev=${k}" class="${sev === k ? "on" : ""}">${l}${k !== "all" && counts[k] ? ` <span class="faint">${counts[k]}</span>` : ""}</button>`).join("")}</div></div>
    ${insightList(list)}
  </div>`;
}

// ---------- DATA ----------
export function data(view, ctx) {
  const m = ctx.model, src = ctx.source;
  const tabs = Object.entries(m.meta.tabs || {});
  const recon = [];
  if (m.summary?.totals) { const t = m.summary.totals, a = view.period.start === view.period.first && view.period.end === view.period.last ? view.totals : null; if (a) { recon.push(["Spend", t.spend, a.spend]); recon.push(["Impressions", t.impr, a.impr]); recon.push(["Clicks", t.clicks, a.clicks]); recon.push(["Form conversions", t.form, a.conv]); recon.push(["Click-to-calls", t.c2c ?? (t.callExt + t.ga4), a.calls]); recon.push(["CRM leads", t.crmLeads, a.crmLeads]); recon.push(["Booked", t.booked, a.booked]); } }
  const unmapped = m.ads?.unmapped || [];
  const leadsNoCentre = m.leads.filter((l) => !m.centres.some((c) => c.name === l.centre)).length;
  return `<div class="page">
    <div class="grid g-12">
      <div class="card"><div class="head"><div><h3>Data source</h3><div class="sub">${src.mode === "snapshot" ? "Bundled sample" : src.mode === "files" ? "Uploaded files" : "Google Sheets"}</div></div></div>
        <dl class="kvlist"><dt>Report</dt><dd>${esc(m.meta.title || "—")}</dd><dt>Period</dt><dd>${esc(m.meta.period)} · data to ${fmtDate(m.meta.dataUpTo, { day: "numeric", month: "long" })}</dd><dt>Loaded</dt><dd>${src.lastSync ? relTime(src.lastSync) : "bundled"}</dd>${src.sheetId ? `<dt>Sheet</dt><dd><a href="https://docs.google.com/spreadsheets/d/${esc(src.sheetId)}/edit" target="_blank" rel="noopener">Open in Google Sheets ↗</a></dd>` : ""}</dl>
        <div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap"><button class="btn" data-open-data>${icon("M4 12a8 8 0 0 1 14-5l2 2M20 4v5h-5M20 12a8 8 0 0 1-14 5l-2-2M4 20v-5h5")} ${src.sheetId ? "Sync now" : "Connect a sheet / upload"}</button></div></div>
      <div class="card"><div class="head"><div><h3>What was recognised</h3><div class="sub">Tabs are identified by their headers, not their names</div></div></div>
        <div class="steps">${tabs.map(([k, n]) => `<div class="step ok"><span class="ic">✓</span><b>${esc(n)}</b><span class="faint">→ ${esc({ ads: "Google Ads keyword export", leads: "Call-centre lead export", summary: "Month summary (typed call columns)", dailyCalls: "Daily calls by account", budget: "Budgets", centreList: "Campaign → centre mapping" }[k] || k)}</span></div>`).join("")}${(m.weeks || []).map((w) => `<div class="step ok"><span class="ic">✓</span><b>${esc(w.tab || w.key)}</b><span class="faint">→ ${esc(w.label)}</span></div>`).join("")}${(m.meta.unknownTabs || []).map((n) => `<div class="step"><span class="ic">·</span>${esc(n)}<span class="faint">ignored (no known layout)</span></div>`).join("")}</div>
        <dl class="kvlist" style="margin-top:14px"><dt>Campaigns</dt><dd>${fmtNum(m.ads?.campaigns.length || 0)}</dd><dt>Keyword rows</dt><dd>${fmtNum(m.ads?.keywords.length || 0)} (from ${fmtNum(m.ads?.rowsRead || 0)} export rows)</dd><dt>Leads</dt><dd>${fmtNum(m.leads.length)}</dd><dt>Centres</dt><dd>${m.centres.length}</dd></dl></div>
    </div>
    ${unmapped.length || leadsNoCentre ? `<div class="banner">⚠ <div>${unmapped.length ? `<b>${unmapped.length} campaigns</b> could not be matched to a centre: ${esc(unmapped.slice(0, 6).join(", "))}${unmapped.length > 6 ? "…" : ""}. Add their centre token on the <b>Centre List</b> tab. ` : ""}${leadsNoCentre ? `<b>${leadsNoCentre} leads</b> have a branch name that is not in the centre list.` : ""}</div></div>` : ""}
    ${recon.length ? `<div class="card"><div class="head"><div><h3>Reconciliation against the sheet's own MTD summary</h3><div class="sub">The app recomputes everything from the raw exports — small gaps mean the sheet's formulas and the dump disagree</div></div></div>${table("recon", [C.name("Metric", (r) => r.metric), C.num("sheet", "Sheet MTD", (v) => fmtNum(v, v % 1 ? 1 : 0)), C.num("app", "Recomputed", (v) => fmtNum(v, v % 1 ? 1 : 0)), { key: "gap", label: "Gap", render: (r) => (r.gap == null ? "—" : `<span class="${Math.abs(r.gap) > 0.03 ? "bad" : "okay"}">${fmtDelta(r.gap, 1)}</span>`) }], recon.map(([metric, sheet, app]) => ({ metric, sheet, app, gap: sheet ? app / sheet - 1 : null })), { defKey: "metric" })}</div>` : ""}
    <div class="card"><div class="head"><div><h3>How to update next month</h3><div class="sub">No reshaping — the app reads the dumps exactly as they download</div></div></div>
      <ol class="prose" style="margin-left:18px"><li><b>Google Ads:</b> download the keyword-level report (Day · Campaign · Account · Ad group · Keyword · match type · QS · Impr · Clicks · Cost · Conversions · Impression share · Lost IS (rank) · Phone calls). Paste into the <b>Google Ads Data</b> tab or drop the CSV here.</li><li><b>Call centre:</b> export leads (ID · Status · Reason · Branch · Department · Priority · Response Time · Created At). Paste into <b>Lead Data</b> or drop the CSV.</li><li><b>Optional:</b> budgets per centre, a campaign-token → centre list, and the typed call columns on the week tabs. Without them the app still works; it just shows “—” for calls and pacing.</li><li>Press <b>Sync</b>. Centres, accounts, campaigns, keywords and CRM outcomes are all derived automatically.</li></ol></div>
  </div>`;
}

// ---------- DRAWERS ----------
export function drawerCentre(name, view, ctx) {
  const c = view.centres.find((x) => x.name === name); if (!c) return { title: name, body: nothing("Not in the current scope — clear the account/date filters.") };
  const camps = view.campaigns.filter((x) => x.centre === name);
  const leads = ctx.model.leads.filter((l) => l.centre === name && l.created >= view.period.start && l.created.slice(0, 10) <= view.period.end);
  const wk = ctx.weeklyFor({ centre: name }), wl = wk.map((w) => w.label.replace(/Week (\d) · /, "W$1 · "));
  const med = view.baseline.cplMedian;
  const deptMap = new Map(); for (const l of leads) { const d = deptMap.get(l.dept) || { dept: l.dept, leads: 0, booked: 0 }; d.leads++; if (l.status === "booked") d.booked++; deptMap.set(l.dept, d); }
  const depts = [...deptMap.values()].sort((a, b) => b.leads - a.leads);
  const kws = view.keywords.filter((k) => k.centre === name && k.cost > 0);
  const wasted = kws.filter((k) => k.conv < 0.01).sort((a, b) => b.cost - a.cost).slice(0, 8);
  const body = `
    <div class="kpis" style="grid-template-columns:repeat(3,1fr)">
      ${kpi({ label: "Spend", value: fmtAEDc(c.spend), sub: c.budget ? `<b>${fmtPct(c.pacing, 0)}</b> of ${fmtAEDc(c.budget)} budget` : "No budget", pace: c.budget ? { pct: c.pacing, expected: 1 } : null })}
      ${kpi({ label: "Form conversions", value: fmtNum(c.conv), sub: `CPL <b class="${cplClass(c.cpl, med)}">${fmtAED(c.cpl)}</b> · network ${fmtAED(med)}` })}
      ${kpi({ label: "Click-to-calls", value: c.calls == null ? "—" : fmtNum(c.calls), sub: c.calls ? `<b>${fmtAED(c.costPerCall)}</b> per call` : "No typed call columns" })}
      ${kpi({ label: "CRM leads → booked", value: `${fmtNum(c.booked)}<small>/ ${fmtNum(c.crmLeads)}</small>`, sub: `<b>${fmtPct(c.bookingPct, 0)}</b> booking · ${fmtPct(c.notReachablePct, 0)} unreached` })}
      ${kpi({ label: "Cost per booking", value: fmtAEDc(c.costPerBooking), sub: `CPC ${fmtAED(c.cpc)} · CTR ${fmtPct(c.ctr, 1)}` })}
      ${kpi({ label: "Impression share", value: fmtPct(c.is, 0), sub: `<b>${fmtPct(c.lostIs, 0)}</b> lost to rank` })}
    </div>
    <div class="card flat"><div class="head"><div><h3>Health ${c.health} · ${esc(c.healthBand)}</h3><div class="sub">Efficiency ${c.healthParts.eff} · Booking ${c.healthParts.conv} · Pacing ${c.healthParts.pace} · Reach ${c.healthParts.reach}</div></div><div class="grow"></div>${ring(c.health, { size: 64, stroke: 6 })}</div>
      ${insightList(ctx.insights.filter((i) => i.entity === name || (i.entities || []).some((n) => camps.some((x) => x.name === n))).map((i) => (i.entities ? { ...i, entities: i.entities.filter((n) => camps.some((x) => x.name === n)) } : i)).slice(0, 4), { compact: true })}</div>
    <div class="card flat"><div class="head"><div><h3>Week by week</h3><div class="sub">Spend and form conversions</div></div></div>${wk.length ? barChart({ labels: wl, series: [{ name: "Spend (AED)", color: "var(--accent)", values: wk.map((w) => w.spend) }], fmt: (v) => fmtAED(v), height: 150 }) + lineChart({ labels: wl, series: [{ name: "Form conv", color: "var(--s3)", values: wk.map((w) => w.conv) }, { name: "CRM leads", color: "var(--s2)", values: wk.map((w) => w.crmLeads) }, { name: "Booked", color: "var(--s1)", values: wk.map((w) => w.booked) }], fmt: fmtNum, height: 150 }) : nothing("No weekly data")}</div>
    <div class="card flat"><div class="head"><div><h3>${camps.length} campaigns</h3></div></div>${table("drawer-camps", [C.name("Campaign", (r) => r.name.replace(/^Alo_NMC_Search_/, ""), (r) => r.specialty), { key: "status", label: "Status", render: statusBadge }, C.num("spend", "Spend", fmtAEDc), C.num("conv", "Conv", (v) => fmtNum(v, 1)), { key: "cpl", label: "CPL", render: (r) => fmtAED(r.cpl), cls: (r) => cplClass(r.cpl, med) }, C.num("ctr", "CTR", (v) => fmtPct(v, 1)), C.num("lostIs", "Lost IS", (v) => fmtPct(v, 0))], camps, { defKey: "spend", rowAttr: (r) => `class="clickable" data-open-campaign="${r.id}"` })}</div>
    <div class="grid g2">
      <div class="card flat"><div class="head"><div><h3>Call-centre outcomes</h3></div></div>${leads.length ? stackBar({ segments: [{ label: "Booked", value: c.booked, color: "var(--good)" }, { label: "Not booked", value: c.notBooked, color: "var(--serious)" }, { label: "Not reachable", value: c.notReachable, color: "var(--critical)" }, { label: "Pending", value: c.pending, color: "var(--text-3)" }] }) + `<div style="margin-top:12px">${hbars({ rows: depts.slice(0, 8).map((d) => ({ label: d.dept, value: d.leads, display: `${d.booked}/${d.leads}`, extra: fmtPct(d.booked / d.leads, 0), color: "var(--s1)" })), labelWidth: 140 })}</div>` : `<div class="faint small">No leads logged for this centre in range.</div>`}</div>
      <div class="card flat"><div class="head"><div><h3>Keywords burning budget</h3><div class="sub">No conversions · month to date</div></div></div>${wasted.length ? hbars({ rows: wasted.map((k) => ({ label: k.kw, sub: k.match, value: k.cost, display: fmtAEDc(k.cost), color: "var(--critical)" })), labelWidth: 140 }) : `<div class="faint small">Nothing wasted — nice.</div>`}</div>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">${askBtn(`Deep-dive ${c.short}: what is working, what is broken, and what should change this week?`, "Ask the analyst about this centre")}<button class="btn ghost sm" data-filter-centre="${esc(name)}">Focus all pages on this centre</button></div>`;
  return { title: c.name, sub: `${c.account} · ${c.region} · ${esc(view.period.label)}`, body };
}

export function drawerCampaign(id, view, ctx) {
  const c = view.campaigns.find((x) => x.id === +id); if (!c) return { title: "Campaign", body: nothing("Not in the current scope — clear the account/date filters.") };
  const kws = view.keywords.filter((k) => k.c === c.id && (k.cost > 0 || k.impr > 0));
  const ag = new Map(); for (const k of kws) { const a = ag.get(k.adgroup) || { adgroup: k.adgroup, cost: 0, conv: 0, clicks: 0, impr: 0, elig: 0, lost: 0, n: 0 }; a.cost += k.cost; a.conv += k.conv; a.clicks += k.clicks; a.impr += k.impr; a.elig += k.elig; a.lost += k.lost; a.n++; ag.set(k.adgroup, a); }
  const adgroups = [...ag.values()].map((a) => ({ ...a, cpl: a.conv ? a.cost / a.conv : null, ctr: a.impr ? a.clicks / a.impr : null, lostIs: a.elig ? a.lost / a.elig : null })).sort((a, b) => b.cost - a.cost);
  const daily = ctx.model.ads.daily.filter((d) => d.c === c.id && d.d >= view.period.start && d.d <= view.period.end);
  const med = view.baseline.cplMedian;
  const wasted = kws.filter((k) => k.cost >= 20 && k.conv < 0.01).sort((a, b) => b.cost - a.cost);
  const body = `
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">${statusBadge(c)}<span class="pill">${esc(c.specialty)}</span><span class="pill"><span class="sw" style="background:${accColor(c.account)}"></span>${esc(c.account)}</span><button class="pill" data-open-centre="${esc(c.centre)}" style="cursor:pointer">${esc(shortCentre(c.centre))} →</button></div>
    <div class="banner ${c.status === "scale" ? "ok" : c.status === "pause" ? "err" : ""}"><b>${esc(c.statusLabel)}:</b> ${esc(c.why)}</div>
    <div class="kpis" style="grid-template-columns:repeat(3,1fr)">
      ${kpi({ label: "Spend", value: fmtAEDc(c.spend), sub: `<b>${fmtPct(c.share, 1)}</b> of scope spend · ${c.daysActive} active days` })}
      ${kpi({ label: "Conversions", value: fmtNum(c.conv, 1), sub: `CPL <b class="${cplClass(c.cpl, med)}">${fmtAED(c.cpl)}</b> · conv rate ${fmtPct(c.convRate, 1)}` })}
      ${kpi({ label: "Clicks", value: fmtNum(c.clicks), sub: `CTR <b>${fmtPct(c.ctr, 1)}</b> · CPC ${fmtAED(c.cpc)}` })}
      ${kpi({ label: "Impression share", value: fmtPct(c.is, 0), sub: `<b>${fmtPct(c.lostIs, 0)}</b> lost to rank` })}
      ${kpi({ label: "Keywords", value: fmtNum(kws.length), sub: `${adgroups.length} ad groups · ${wasted.length} with spend and no conv` })}
      ${kpi({ label: "Impressions", value: fmtCompact(c.impr), sub: `eligible ≈ ${fmtCompact(c.elig)}` })}
    </div>
    <div class="card flat"><div class="head"><div><h3>Daily</h3><div class="sub">Spend and conversions in range</div></div></div>${daily.length ? barChart({ labels: daily.map((d) => fmtDate(d.d)), series: [{ name: "Spend (AED)", color: "var(--accent)", values: daily.map((d) => d.cost) }], fmt: (v) => fmtAED(v), height: 140, xTick: (l, i) => (i % 3 === 0 ? l : "") }) + lineChart({ labels: daily.map((d) => fmtDate(d.d)), series: [{ name: "Conversions", color: "var(--s3)", values: daily.map((d) => d.conv) }, { name: "Clicks", color: "var(--s1)", values: daily.map((d) => d.clicks), dash: true }], fmt: fmtNum, height: 140, xTick: (l, i) => (i % 3 === 0 ? l : "") }) : nothing("No daily rows")}</div>
    <div class="card flat"><div class="head"><div><h3>Ad groups</h3></div></div>${table("drawer-ag", [C.name("Ad group", (r) => r.adgroup, (r) => `${r.n} keywords`), C.num("cost", "Cost", fmtAEDc), C.num("clicks", "Clicks"), C.num("ctr", "CTR", (v) => fmtPct(v, 1)), C.num("conv", "Conv", (v) => fmtNum(v, 1)), { key: "cpl", label: "CPL", render: (r) => fmtAED(r.cpl), cls: (r) => cplClass(r.cpl, med) }, C.num("lostIs", "Lost IS", (v) => fmtPct(v, 0))], adgroups, { defKey: "cost" })}</div>
    <div class="card flat"><div class="head"><div><h3>Keywords</h3><div class="sub">Month-level · sorted by cost</div></div></div>${table("drawer-kw", [C.name("Keyword", (r) => r.kw, (r) => `${r.match} · ${r.adgroup}`), { key: "qs", label: "QS", render: (r) => (r.qs == null ? "—" : `<span class="${r.qs <= 3 ? "bad" : r.qs >= 7 ? "okay" : "meh"}">${r.qs}</span>`) }, C.num("impr", "Impr"), C.num("clicks", "Clicks"), C.num("ctr", "CTR", (v) => fmtPct(v, 1)), C.num("cost", "Cost", fmtAEDc), C.num("conv", "Conv", (v) => fmtNum(v, 1)), { key: "cpl", label: "CPL", render: (r) => fmtAED(r.cpl), cls: (r) => cplClass(r.cpl, med) }, C.num("lostIs", "Lost IS", (v) => fmtPct(v, 0))], kws, { defKey: "cost", limit: 60 })}</div>
    ${wasted.length ? `<div class="card flat"><div class="head"><div><h3>Suggested negatives / pauses</h3><div class="sub">Keywords with spend and no conversions — ${fmtAEDc(wasted.reduce((s, k) => s + k.cost, 0))}</div></div><div class="grow"></div><button class="btn ghost sm" data-copy="${esc(wasted.map((k) => k.kw).join("\n"))}">Copy list</button></div><div style="display:flex;flex-wrap:wrap;gap:6px">${wasted.slice(0, 30).map((k) => `<span class="pill">${esc(k.kw)} <b>${fmtAEDc(k.cost)}</b></span>`).join("")}</div></div>` : ""}
    <div>${askBtn(`Analyse campaign ${c.name}: why is it "${c.statusLabel}", and give me a concrete optimisation checklist`, "Ask the analyst about this campaign")}</div>`;
  return { title: c.name.replace(/^Alo_NMC_Search_/, ""), sub: `${c.name} · ${esc(view.period.label)}`, body };
}

export function drawerSpecialty(name, view, ctx) {
  const s = view.specialties.find((x) => x.name === name); if (!s) return { title: name, body: nothing("No data") };
  const camps = view.campaigns.filter((c) => c.specialty === name); const med = view.baseline.cplMedian;
  const depts = view.crm.depts.filter((d) => d.specialty === name);
  const body = `<div class="kpis" style="grid-template-columns:repeat(3,1fr)">${kpi({ label: "Spend", value: fmtAEDc(s.spend), sub: `${s.campaigns} campaigns` })}${kpi({ label: "Conversions", value: fmtNum(s.conv), sub: `CPL <b class="${cplClass(s.cpl, med)}">${fmtAED(s.cpl)}</b>` })}${kpi({ label: "CRM leads → booked", value: `${fmtNum(s.booked)}<small>/ ${fmtNum(s.crmLeads)}</small>`, sub: `<b>${fmtPct(s.bookingPct, 0)}</b> · cost/booking ${fmtAEDc(s.costPerBooking)}` })}</div>
    <div class="card flat"><div class="head"><div><h3>Campaigns</h3></div></div>${table("drawer-spec", [C.name("Campaign", (r) => r.name.replace(/^Alo_NMC_Search_/, ""), (r) => `${shortCentre(r.centre)} · ${accShort(r.account)}`), { key: "status", label: "Status", render: statusBadge }, C.num("spend", "Spend", fmtAEDc), C.num("conv", "Conv", (v) => fmtNum(v, 1)), { key: "cpl", label: "CPL", render: (r) => fmtAED(r.cpl), cls: (r) => cplClass(r.cpl, med) }, C.num("lostIs", "Lost IS", (v) => fmtPct(v, 0))], camps, { defKey: "spend", rowAttr: (r) => `class="clickable" data-open-campaign="${r.id}"` })}</div>
    ${depts.length ? `<div class="card flat"><div class="head"><div><h3>Call-centre departments</h3></div></div>${hbars({ rows: depts.map((d) => ({ label: d.dept, value: d.leads, display: `${d.booked}/${d.leads}`, extra: fmtPct(d.pct, 0), color: "var(--s1)" })), labelWidth: 200 })}</div>` : ""}
    <div>${askBtn(`How is ${name} performing across centres and what should we change?`, "Ask the analyst")}</div>`;
  return { title: name, sub: `Specialty · ${esc(view.period.label)}`, body };
}
