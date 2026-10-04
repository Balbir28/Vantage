// ============================================================
//  PAGES — every screen is a pure function of (view, ctx) → HTML.
//  Interactions are declared as data-* attributes and handled by app.js.
// ============================================================
import { fmtAED, fmtAEDc, fmtNum, fmtPct, fmtDelta, fmtMin, fmtDate, fmtCompact, esc, relTime, isNil } from "./format.js";
import { lineChart, barChart, hbars, scatter, heatmap, sparkline, ring, stackBar, bulletRows, SERIES } from "./charts.js";
import { reallocationPlan, playbook } from "./insights.js";
import { ACCOUNT_META, ACCOUNTS } from "./parse.js";
import { shortCentre, median } from "./analytics.js";

export const PAGES = [
  { key: "overview", label: "Overview", icon: "M3 12h4l3-8 4 16 3-8h4" },
  { key: "hospitals", label: "Hospitals", icon: "M3 21V7l9-4 9 4v14M9 21v-6h6v6M12 9v4M10 11h4" },
  { key: "campaigns", label: "Campaigns", icon: "M4 4h16v6H4zM4 14h10v6H4zM17 14l3 3-3 3" },
  { key: "keywords", label: "Keywords", icon: "M4 7h16M4 12h10M4 17h7M19 15l2 2-4 4" },
  { key: "ctr", label: "CTR", icon: "M4 4l7 17 2.5-7.5L21 11z" },
  { key: "calls", label: "Click-to-calls", icon: "M15 3h6v6M21 3l-7 7M5 4h4l2 5-3 2a11 11 0 0 0 6 6l2-3 5 2v4a2 2 0 0 1-2 2A17 17 0 0 1 3 6a2 2 0 0 1 2-2" },
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
  const sp = (k) => sparkline(d.filter(inR).map((x) => x[k] ?? 0), { color: "var(--viridian)", width: 200, height: 26, stretch: true });
  const est = view.flags.callsEstimated ? '<span class="est" title="Pro-rated from weekly typed call columns">est.</span>' : "";
  return `<div class="kpis">
    ${kpi({ label: "Spend", value: fmtAEDc(t.spend), sub: t.budget ? `<b>${fmtPct(t.pacing, 0)}</b> of ${fmtAEDc(t.budget)} budget` : "No budget loaded", spark: sp("spend"), pace: t.budget ? { pct: t.pacing, expected: 1 } : null })}
    ${kpi({ label: "Form conversions", value: fmtNum(t.conv), sub: `CPL <b>${fmtAED(t.cpl)}</b> ${last?.wow ? delta(last.wow.cpl, true) : ""}`, spark: sp("conv") })}
    ${kpi({ label: "Click-to-calls" + est, value: t.calls == null ? "—" : fmtNum(t.calls), sub: t.calls ? `<b>${fmtAED(t.costPerCall)}</b> per call · ext ${fmtNum(t.callExt)} / page ${fmtNum(t.ga4)}` : "Fill the Click to Calls tab in the sheet", spark: d.some((x) => x.calls != null) ? sp("calls") : null })}
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
  const inAcc = accounts.filter((a) => a.inScope);
  const inR = (x) => x.date >= view.period.start && x.date <= view.period.end;
  const accTable = `<div class="tw"><table class="tbl acc-t" data-table="accounts"><thead><tr><th>Ad account</th><th>Spend</th><th>Of budget</th><th>Share</th><th>Conv</th><th>CPL</th><th>Calls</th><th>Cost/call</th><th>CRM leads</th><th>Booked</th><th>Booking %</th><th>Cost/booking</th><th>IS</th><th>Lost (rank)</th><th>Daily spend</th></tr></thead><tbody>${accounts.map((a) => { const spark = sparkline(computeDailyFor(ctx, a.name).map((d) => d.spend), { color: accColor(a.name), width: 90, height: 26 }); return `<tr class="clickable ${a.inScope ? "" : "off"}" data-filter-account="${esc(a.name)}" title="Focus every page on ${esc(a.name)}"><td class="name"><span class="sw" style="background:${accColor(a.name)}"></span>${esc(a.name)}<small>${esc(a.blurb)} · ${a.centres} centre${a.centres === 1 ? "" : "s"}</small></td><td class="hi">${fmtAEDc(a.spend)}</td><td>${a.pacing == null ? "—" : `<span class="bar"><i style="width:${Math.min(100, a.pacing * 100)}%;background:${a.pacing > 1.1 ? "var(--rufous)" : a.pacing < 0.7 ? "var(--gamboge)" : "var(--viridian)"}"></i></span>${fmtPct(a.pacing, 0)}`}</td><td>${fmtPct(a.share, 0)}</td><td>${fmtNum(a.conv)}</td><td class="${cplClass(a.cpl, view.baseline.cplMedian)}">${fmtAED(a.cpl)}</td><td>${a.calls == null ? "—" : fmtNum(a.calls)}</td><td>${fmtAED(a.costPerCall)}</td><td>${fmtNum(a.crmLeads)}</td><td>${fmtNum(a.booked)}</td><td class="${bpClass(a.bookingPct, view.totals.bookingPct)}">${fmtPct(a.bookingPct, 0)}</td><td>${fmtAEDc(a.costPerBooking)}</td><td>${fmtPct(a.is, 0)}</td><td>${fmtPct(a.lostIs, 0)}</td><td>${spark}</td></tr>`; }).join("")}<tr class="total"><td>Network · ${esc(view.period.label)}</td><td>${fmtAEDc(view.totals.spend)}</td><td>${fmtPct(view.totals.pacing, 0)}</td><td>100%</td><td>${fmtNum(view.totals.conv)}</td><td>${fmtAED(view.totals.cpl)}</td><td>${view.totals.calls == null ? "—" : fmtNum(view.totals.calls)}</td><td>${fmtAED(view.totals.costPerCall)}</td><td>${fmtNum(view.totals.crmLeads)}</td><td>${fmtNum(view.totals.booked)}</td><td>${fmtPct(view.totals.bookingPct, 0)}</td><td>${fmtAEDc(view.totals.costPerBooking)}</td><td>${fmtPct(view.totals.is, 0)}</td><td>${fmtPct(view.totals.lostIs, 0)}</td><td></td></tr></tbody></table></div>`;
  const specRows = specialties.filter((s) => s.spend > 0 || s.crmLeads > 0);
  const cplMed = median(centres.filter((c) => c.conv >= 1).map((c) => c.cpl));
  return `<div class="page">
    ${leadGapBanner(view)}
    <div class="card"><div class="head"><div><div class="eyebrow">Executive read · ${esc(view.scopeLabel)}</div></div><div class="grow"></div>${askBtn("Give me the executive summary and the three things to do this week", "Discuss with the analyst")}</div>${execDeck(view, ctx)}</div>
    ${kpiStrip(view)}
    <div class="card"><div class="head"><div><h3>Ad accounts</h3><div class="sub">Click a row to focus every page on that account · colours carry into every chart</div></div></div>${accTable}</div>
    <div class="grid g2">
      <div class="card"><div class="head"><div><h3>Daily click-to-calls by account</h3><div class="sub">Call extension taps + landing-page call taps</div></div></div>
        ${trend.daily.some((d) => d.calls != null) && view.filter.account === "all" && !view.filter.centre && trend.hasDailyByAccount ? barChart({ labels: dl, series: trend.dailyByAccount.map((x) => ({ name: accShort(x.account), color: accColor(x.account), values: x.values })), stacked: true, fmt: (v) => fmtNum(v), highlight: hl, height: 220, xTick: (l, i) => (i % 3 === 0 ? l : "") }) : trend.daily.some((d) => d.calls != null) ? barChart({ labels: dl, series: [{ name: "Calls", color: "var(--viridian)", values: trend.daily.map((d) => d.calls ?? 0) }], fmt: fmtNum, highlight: hl, height: 220, xTick: (l, i) => (i % 3 === 0 ? l : "") }) : nothing("Daily calls need the Click to Calls tab (see the Click-to-calls page).")}</div>
      <div class="card"><div class="head"><div><h3>Daily demand</h3><div class="sub">Form conversions (ads) vs leads logged by the call centre</div></div></div>
        ${lineChart({ labels: dl, series: [{ name: "Form conversions", color: "var(--sapphire)", values: trend.daily.map((d) => d.conv) }, { name: "CRM leads", color: "var(--gamboge)", values: trend.daily.map((d) => d.crmLeads) }, { name: "Booked", color: "var(--viridian)", values: trend.daily.map((d) => d.booked) }], fmt: fmtNum, area: false, highlight: hl, height: 220, xTick: (l, i) => (i % 3 === 0 ? l : ""), markers: false })}</div>
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

function execDeck(view, ctx) {
  const t = view.totals, crm = view.crm, rows = ctx.execRows, ins = ctx.insights;
  const net = view.accounts.filter((a) => a.inScope && a.spend > 0);
  // network pulse: mean centre health weighted by spend
  const w = view.centres.reduce((s, c) => s + c.spend, 0) || 1, pulse = Math.round(view.centres.reduce((s, c) => s + c.health * c.spend, 0) / w);
  const verdict = ctx.summary.split(". ").slice(2, 4).join(". ").replace(/\.?$/, ".");
  const gauge = (pct, expected = 1, tone = "") => `<div class="gauge"><i class="${tone}" style="width:${Math.min(100, (pct || 0) * 100).toFixed(1)}%"></i><s style="left:${Math.min(100, expected * 100).toFixed(1)}%"></s></div>`;
  const tiles = `<div class="deck-tiles">
    <div class="deck-tile" style="--c:var(--sapphire)"><div class="k"><span>Media spend</span><i></i></div><div class="n">${fmtAEDc(t.spend)}</div><div class="m">${t.budget ? `<span><b>${fmtPct(t.pacing, 0)}</b> of ${fmtAEDc(t.budget)} budget</span>` : "<span>No budget loaded</span>"}</div>${t.budget ? gauge(t.pacing, 1, t.pacing > 1.1 ? "bad" : t.pacing < 0.85 ? "warn" : "") : ""}</div>
    <div class="deck-tile" style="--c:var(--viridian)"><div class="k"><span>Form conversions</span><i></i></div><div class="n">${fmtNum(t.conv)}</div><div class="m"><span>CPL <b>${fmtAED(t.cpl)}</b></span><span>conv rate <b>${fmtPct(t.convRate, 1)}</b></span></div>${gauge(Math.min(1, (view.baseline.cplMedian || 0) / (t.cpl || 1)), 1)}</div>
    <div class="deck-tile" style="--c:var(--gamboge)"><div class="k"><span>Click-to-calls</span><i></i></div><div class="n">${t.calls == null ? "—" : fmtNum(t.calls)}</div><div class="m">${t.calls ? `<span><b>${fmtAED(t.costPerCall)}</b> per call</span><span>ext <b>${fmtNum(t.callExt)}</b> · page <b>${fmtNum(t.ga4)}</b></span>` : "<span>Fill the Click to Calls tab in the sheet</span>"}</div>${t.calls ? gauge(t.calls / Math.max(1, t.calls + t.conv), 1) : ""}</div>
    <div class="deck-tile clickable" style="--c:var(--mint)" data-nav="crm" role="button" tabindex="0" title="Open Leads & CRM"><div class="k"><span>CRM leads</span><i></i></div><div class="n">${fmtNum(t.crmLeads)}</div><div class="m"><span><b>${fmtNum(t.crmLeads / (view.period.days || 1), 1)}</b> per day</span><span>cost/lead <b>${fmtAED(t.costPerCrmLead)}</b></span>${t.leadsAll ? `<span>vs <b>${fmtNum(t.leadsAll)}</b> ad leads (forms + calls)</span>` : ""}</div>${t.leadsAll ? gauge(t.crmLeads / t.leadsAll, 1) : ""}</div>
    <div class="deck-tile r2" style="--c:var(--rufous)"><div class="k"><span>Bookings</span><i></i></div><div class="n">${fmtNum(t.booked)}<small>/ ${fmtNum(t.crmLeads)} leads</small></div><div class="m"><span>booking <b>${fmtPct(t.bookingPct, 0)}</b></span><span>cost/booking <b>${fmtAEDc(t.costPerBooking)}</b></span></div>${gauge(t.bookingPct, 0.5, t.bookingPct != null && t.bookingPct < 0.35 ? "bad" : "")}</div>
    <div class="deck-tile r2 clickable" style="--c:var(--rust)" data-nav="crm" role="button" tabindex="0" title="Open Leads & CRM"><div class="k"><span>Not reachable</span><i></i></div><div class="n">${fmtNum(t.notReachable)}<small>/ ${fmtNum(t.crmLeads)} leads</small></div><div class="m"><span><b>${fmtPct(t.notReachablePct, 0)}</b> of CRM leads</span><span>never answered the call centre</span></div>${gauge(t.notReachablePct, 1, (t.notReachablePct || 0) >= 0.25 ? "bad" : "warn")}</div>
    <div class="deck-tile r2 clickable" style="--c:var(--alloy)" data-nav="crm" role="button" tabindex="0" title="Open Leads & CRM"><div class="k"><span>Pending</span><i></i></div><div class="n">${fmtNum(t.pending)}<small>/ ${fmtNum(t.crmLeads)} leads</small></div><div class="m"><span><b>${fmtPct(t.crmLeads ? t.pending / t.crmLeads : null, 0)}</b> of CRM leads</span><span>${fmtNum(crm.untouched)} not yet called</span></div>${gauge(t.crmLeads ? t.pending / t.crmLeads : 0, 1, "warn")}</div>
  </div>`;
  const icons = { Media: "M3 12h4l3-8 4 16 3-8h4", "Call centre": "M5 4h4l2 5-3 2a11 11 0 0 0 6 6l2-3 5 2v4a2 2 0 0 1-2 2A17 17 0 0 1 3 6a2 2 0 0 1 2-2", Read: "M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15z" };
  const groups = ["Media", "Call centre", "Read"].filter((g) => rows.some((r) => r.group === g && r.label));
  const ledgers = `<div class="deck-grid">${groups.map((g) => { const rs = rows.filter((r) => r.group === g && r.label); return `<div class="ledger"><div class="lh">${icon(icons[g])}${esc(g)}<span class="grow"></span><span class="cnt">${rs.length} rows</span></div>${rs.map((r) => { const openAttr = /efficient|expensive/i.test(r.label) && ACCOUNTS.includes(r.value) ? `data-filter-account="${esc(r.value)}"` : /centres at risk/i.test(r.label) ? `data-nav="hospitals"` : /campaign calls/i.test(r.label) ? `data-nav="campaigns"` : /keyword/i.test(r.label) ? `data-nav="keywords"` : ""; return `<div class="lrow ${openAttr ? "clickable" : ""}" ${openAttr}><div class="ll">${esc(r.label)}</div><div class="lv"><b class="${r.tone}">${esc(r.value)}</b>${r.note ? `<small>${esc(r.note)}</small>` : ""}</div></div>`; }).join("")}</div>`; }).join("")}</div>`;
  const top = ins.filter((i) => i.sev === "critical" || i.sev === "good").slice(0, 3);
  const levers = top.length ? `<div class="levers">${top.map((i) => { const c = i.sev === "good" ? "var(--viridian)" : "var(--rufous)"; const attr = i.entity ? `data-open-centre="${esc(i.entity)}"` : i.scope === "keyword" ? `data-nav="keywords"` : i.scope === "campaign" ? `data-nav="campaigns"` : i.scope === "crm" ? `data-nav="crm"` : `data-nav="actions"`; return `<div class="lever" style="--c:${c}" ${attr} role="button" tabindex="0"><div class="lk"><b>${i.sev === "good" ? "Opportunity" : "Critical"}</b><span>· ${esc(i.scope)}</span></div><div class="lt">${esc(i.title)}</div><div class="la">${esc(i.action)}</div>${i.impact ? `<div class="li">${fmtAEDc(i.impact)}<small>at stake</small></div>` : ""}</div>`; }).join("")}</div>` : "";
  return `<div class="deck">
    <div class="deck-head">${ring(pulse, { size: 64, stroke: 6, label: "pulse" })}<div><div class="t">${esc(view.scopeLabel)}</div><div class="s">Network pulse · spend-weighted centre health · ${view.centres.length} centres · ${view.campaigns.length} campaigns</div></div><div class="grow" style="flex:1"></div><div class="verdict">${esc(verdict)}</div></div>
    ${tiles}
    ${ledgers}
    ${top.length ? `<div class="eyebrow" style="margin-top:2px">Biggest levers · ranked by money at stake</div>${levers}` : ""}
  </div>`;
}

function computeDailyFor(ctx, account) {
  const daily = ctx.model.ads?.daily || [], camps = ctx.model.ads?.campaigns || [], m = new Map();
  for (const r of daily) { if (camps[r.c].account !== account) continue; m.set(r.d, (m.get(r.d) || 0) + r.cost); }
  return [...m.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([date, spend]) => ({ date, spend }));
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
  const cols = [C.name("Centre", (r) => r.short, (r) => `${r.account} · ${r.region}`), { key: "health", label: "Health", render: (r) => `<span class="badge ${r.healthBand === "strong" ? "good" : r.healthBand === "steady" ? "grey" : "critical"}">${r.health}</span>`, title: "0–100: CPL vs network (35%), booking rate (30%), pacing (15%), impression share (20%)" }, C.num("spend", "Spend", fmtAEDc), { key: "pacing", label: "Of budget", render: (r) => (r.pacing == null ? "—" : `<span class="bar"><i style="width:${Math.min(100, r.pacing * 100)}%;background:${r.pacing > 1.1 ? "var(--rufous)" : r.pacing < 0.7 ? "var(--gamboge)" : "var(--viridian)"}"></i></span>${fmtPct(r.pacing, 0)}`) }, C.num("conv", "Conv", (v) => fmtNum(v)), { key: "cpl", label: "CPL", render: (r) => fmtAED(r.cpl), cls: (r) => cplClass(r.cpl, cplMed) }, C.num("cpc", "CPC", fmtAED), C.num("calls", "Calls", (v) => (v == null ? "—" : fmtNum(v))), C.num("costPerCall", "Cost/call", fmtAED), C.num("crmLeads", "CRM leads"), C.num("booked", "Booked"), { key: "bookingPct", label: "Booking %", render: (r) => fmtPct(r.bookingPct, 0), cls: (r) => bpClass(r.bookingPct, view.totals.bookingPct) }, C.num("costPerBooking", "Cost/booking", fmtAEDc), C.num("is", "IS", (v) => fmtPct(v, 0)), C.num("lostIs", "Lost (rank)", (v) => fmtPct(v, 0))];
  return `<div class="page">
    <div class="card"><div class="head"><div><h3>Centre league table</h3><div class="sub">Ranked by spend · CPL bar against the network median (tick) · green under 0.8×, red over 1.6× · click a row to drill in</div></div><div class="grow"></div><div class="cv-legend">${ACCOUNTS.map((a) => `<span><i style="background:${accColor(a)}"></i>${esc(a)}</span>`).join("")}</div></div>
      ${centres.length ? bulletRows({ rows: centres.filter((c) => c.spend > 0).map((c) => ({ key: c.name, label: c.short, sub: `${c.account} · ${c.campaigns} campaigns`, spend: c.spend, cpl: c.cpl, bookingPct: c.bookingPct, booked: c.booked, leads: c.crmLeads, color: accColor(c.account) })), median: cplMed, fmtSpend: (v) => fmtAEDc(v), fmtCpl: (v) => fmtAED(v), onClickAttr: "data-open-centre", cplCap: cplMed ? cplMed * 4 : null }) : nothing("No centre spend in range")}
      <div class="faint small" style="margin-top:8px">▸ marks a CPL beyond 4× the median (bar capped so the rest stays readable).</div></div>
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
  const fm = ctx.ui.kwMatch || "", fq = ctx.ui.kwQs || "";
  const band = kwStats.qsBands.find((b) => b.band === fq);
  const inBand = (k) => !band || (band.min == null ? k.qs == null : k.qs != null && k.qs >= band.min && k.qs <= band.max);
  const rows = kws.filter((k) => k.cost > 0 && (!fm || (k.match || "Unknown") === fm) && inBand(k) && (!q || k.kw.toLowerCase().includes(q) || k.campaign.toLowerCase().includes(q) || k.adgroup.toLowerCase().includes(q)));
  const sel = (on) => (on ? "clickable sel" : "clickable");
  const chips = [fm && `<span class="fchip">Match type: <b>${esc(fm)}</b><button data-kw-filter="match=" aria-label="Clear match type filter">✕</button></span>`, fq && `<span class="fchip">Quality Score: <b>${esc(fq)}</b><button data-kw-filter="qs=" aria-label="Clear Quality Score filter">✕</button></span>`].filter(Boolean).join("");
  const fSel = `<div class="fsel"><label for="kw-match">Match</label><select id="kw-match" data-ui="kwMatch"><option value="">All</option>${kwStats.matchTypes.map((m) => `<option ${m.match === fm ? "selected" : ""}>${esc(m.match)}</option>`).join("")}</select></div><div class="fsel"><label for="kw-qs">QS</label><select id="kw-qs" data-ui="kwQs"><option value="">All</option>${kwStats.qsBands.map((b) => `<option ${b.band === fq ? "selected" : ""}>${esc(b.band)}</option>`).join("")}</select></div>`;
  const cols = [C.name("Keyword", (r) => r.kw, (r) => `${r.match} · ${r.adgroup} · ${r.campaign.replace(/^Alo_NMC_Search_/, "")}`), { key: "qs", label: "QS", render: (r) => (r.qs == null ? "—" : `<span class="${r.qs <= 3 ? "bad" : r.qs >= 7 ? "okay" : "meh"}">${r.qs}</span>`) }, C.num("impr", "Impr"), C.num("clicks", "Clicks"), C.num("ctr", "CTR", (v) => fmtPct(v, 1)), C.num("cost", "Cost", fmtAEDc), C.num("cpc", "CPC", fmtAED), C.num("conv", "Conv", (v) => fmtNum(v, 1)), { key: "cpl", label: "CPL", render: (r) => fmtAED(r.cpl), cls: (r) => cplClass(r.cpl, med) }, C.num("is", "IS", (v) => fmtPct(v, 0)), C.num("lostIs", "Lost (rank)", (v) => fmtPct(v, 0))];
  return `<div class="page">
    <div class="kpis" style="grid-template-columns:repeat(4,1fr)">
      ${kpi({ label: "Keywords with spend", value: fmtNum(kwStats.keywordsWithSpend), sub: `${fmtNum(kws.length)} keywords · ${esc(view.period.label)}` })}
      ${kpi({ label: "Spend with no conversions", value: fmtAEDc(kwStats.wastedTotal), sub: `<b>${fmtPct(kwStats.wastedTotal / (kwStats.totalCost || 1), 0)}</b> of spend across ${fmtNum(kwStats.wastedCount)} keywords` })}
      ${kpi({ label: "Low Quality Score spend", value: fmtAEDc(kwStats.qsBands[0].cost), sub: `<b>${fmtPct(kwStats.qsBands[0].share, 0)}</b> on QS 1–3 · ${fmtNum(kwStats.qsBands[0].n)} keywords` })}
      ${kpi({ label: "Best match type", value: esc((kwStats.matchTypes.filter((m) => m.conv >= 3).sort((a, b) => a.cpl - b.cpl)[0] || {}).match || "—"), sub: kwStats.matchTypes.map((m) => `${m.match} ${fmtAED(m.cpl)}`).join(" · ") })}
    </div>
    <div class="grid g2">
      <div class="card"><div class="head"><div><h3>Match types</h3><div class="sub">Where the money goes, and what it buys · click a row to see its keywords</div></div></div>${table("match", [C.name("Match type", (r) => r.match, (r) => `${r.n} keywords`), C.num("cost", "Cost", fmtAEDc), { key: "share", label: "Share", render: (r) => fmtPct(r.share, 0) }, C.num("clicks", "Clicks"), C.num("ctr", "CTR", (v) => fmtPct(v, 1)), C.num("conv", "Conv", (v) => fmtNum(v, 1)), { key: "cpl", label: "CPL", render: (r) => fmtAED(r.cpl), cls: (r) => cplClass(r.cpl, med) }], kwStats.matchTypes, { defKey: "cost", rowAttr: (r) => `class="${sel(r.match === fm)}" data-kw-filter="match=${esc(r.match)}" title="Show the ${esc(r.match)} keywords"` })}</div>
      <div class="card"><div class="head"><div><h3>Quality Score bands</h3><div class="sub">Low QS = you pay more per click for the same slot · click a band to see its keywords</div></div></div>${table("qs", [C.name("Band", (r) => r.band, (r) => `${r.n} keywords`), C.num("cost", "Cost", fmtAEDc), { key: "share", label: "Share", render: (r) => fmtPct(r.share, 0) }, C.num("impr", "Impr"), C.num("conv", "Conv", (v) => fmtNum(v, 1)), { key: "cpl", label: "CPL", render: (r) => fmtAED(r.cpl), cls: (r) => cplClass(r.cpl, med) }], kwStats.qsBands, { defKey: "cost", rowAttr: (r) => `class="${sel(r.band === fq)}" data-kw-filter="qs=${esc(r.band)}" title="Show the ${esc(r.band)} keywords"` })}</div>
    </div>
    <div class="grid g2">
      <div class="card"><div class="head"><div><h3>Top wasters</h3><div class="sub">Spend with no conversions — pause or add as negatives</div></div><div class="grow"></div>${askBtn("Which keywords should I pause first and why?", "Ask")}</div>${hbars({ rows: kwStats.wasted.slice(0, 15).map((k) => ({ label: k.kw, sub: `${k.match} · ${shortCentre(k.centre)}`, value: k.cost, display: fmtAEDc(k.cost), color: "var(--rufous)", extra: `${fmtNum(k.clicks)} clicks` })), labelWidth: 170 })}</div>
      <div class="card"><div class="head"><div><h3>Proven winners</h3><div class="sub">Lowest CPL with real volume — protect and expand these</div></div></div>${hbars({ rows: kwStats.winners.slice(0, 15).map((k) => ({ label: k.kw, sub: `${k.match} · ${shortCentre(k.centre)}`, value: k.conv, display: `${fmtNum(k.conv, 1)} conv`, color: "var(--viridian)", extra: `CPL ${fmtAED(k.cpl)}` })), labelWidth: 170 })}</div>
    </div>
    ${kwStats.approx ? `<div class="banner">Keyword rows are weekly in the export, so this page covers the whole weeks that overlap your range (${esc(kwStats.weeks.join(", "))}). </div>` : ""}
    <div class="toolbar" id="kw-all"><h2 class="sec">${fm || fq ? "Filtered" : "All"} <em>keywords</em> <small class="faint" style="font-size:13px;font-weight:500">${fmtNum(rows.length)}</small></h2>${chips}<div style="flex:1"></div>${fSel}<div class="search">${icon("M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14zM20 20l-3.5-3.5")}<input data-ui="kwSearch" value="${esc(ctx.ui.kwSearch || "")}" placeholder="Search keywords, ad groups, campaigns…" aria-label="Search keywords"/></div></div>
    <div class="card flat" style="padding:6px 8px">${table("kws", cols, rows, { defKey: "cost", limit: 150 })}</div>
  </div>`;
}


// Warn when the Lead Data tab is missing whole days — lead and booking totals would be understated.
function leadGapBanner(view) {
  const g = view.leadGaps || []; if (!g.length) return "";
  const missing = g.reduce((s, x) => s + x.days, 0);
  const spans = g.map((x) => `<b>${x.from === x.to ? fmtDate(x.from) : `${fmtDate(x.from)} – ${fmtDate(x.to)}`}</b>`).join(", ");
  return `<div class="banner">⚠ <div>No call-centre leads in the sheet for ${spans} (${missing} day${missing === 1 ? "" : "s"}). The Lead Data tab looks incomplete, so CRM leads, bookings and booking rates for this range are understated. Re-export the call-centre leads for the full range, paste at A1 of <b>Lead Data</b>, then Sync.</div></div>`;
}

// ---------- CTR ----------
export function ctr(view, ctx) {
  const t = view.totals, d = view.trend.daily, inR = (x) => x.date >= view.period.start && x.date <= view.period.end;
  const dr = d.filter(inR), dl = dr.map((x) => fmtDate(x.date));
  const ctrMed = median(view.campaigns.filter((c) => c.impr >= 300).map((c) => c.ctr));
  const cplMed = view.baseline?.cplMedian;
  const ctrCls = (v) => (isNil(v) || !ctrMed ? "" : v >= ctrMed * 1.25 ? "okay" : v <= ctrMed * 0.6 || v < 0.05 ? "bad" : "");
  const ctrCol = { key: "ctr", label: "CTR", render: (r) => fmtPct(r.ctr, 2), cls: (r) => ctrCls(r.ctr) };
  const lowCamps = view.campaigns.filter((c) => c.impr >= 500 && c.ctr != null && c.ctr < 0.05);
  const lostClicks = lowCamps.reduce((s, c) => s + Math.max(0, (Math.min(ctrMed || 0.08, 0.08) - c.ctr) * c.impr), 0);
  // ad groups
  const ag = new Map(); for (const k of view.keywords) { const key = k.campaign + "|" + k.adgroup; let o = ag.get(key); if (!o) { o = { adgroup: k.adgroup, campaign: k.campaign, centre: k.centre, account: k.account, impr: 0, clicks: 0, cost: 0, conv: 0 }; ag.set(key, o); } o.impr += k.impr; o.clicks += k.clicks; o.cost += k.cost; o.conv += k.conv; }
  const adgroups = [...ag.values()].filter((o) => o.impr > 0).map((o) => ({ ...o, ctr: o.clicks / o.impr, cpc: o.clicks ? o.cost / o.clicks : null, cpl: o.conv ? o.cost / o.conv : null }));
  const lowKw = view.keywords.filter((k) => k.impr >= 100 && k.ctr != null).sort((a, b) => a.ctr - b.ctr || b.impr - a.impr);
  const accSeries = view.accounts.filter((a) => a.inScope && a.impr > 0).map((a) => { const days = new Map(); const camps = ctx.model.ads?.campaigns || []; for (const r of ctx.model.ads?.daily || []) { if (r.d < view.period.start || r.d > view.period.end || camps[r.c].account !== a.name) continue; if (view.filter.centre && camps[r.c].centre !== view.filter.centre) continue; let o = days.get(r.d); if (!o) { o = { i: 0, c: 0 }; days.set(r.d, o); } o.i += r.impr; o.c += r.clicks; } return { name: accShort(a.name), color: accColor(a.name), values: dr.map((x) => { const o = days.get(x.date); return o && o.i ? (o.c / o.i) * 100 : null; }) }; });
  return `<div class="page">
    <div class="kpis k5">
      ${kpi({ label: "CTR", value: fmtPct(t.ctr, 2), sub: `<b>${fmtNum(t.clicks)}</b> clicks from ${fmtCompact(t.impr)} impressions` })}
      ${kpi({ label: "Avg CPC", value: fmtAED(t.cpc), sub: `Spend <b>${fmtAEDc(t.spend)}</b>` })}
      ${kpi({ label: "Click → form conversion", value: fmtPct(t.convRate, 1), sub: `${fmtNum(t.conv)} form conversions` })}
      ${kpi({ label: "Median campaign CTR", value: fmtPct(ctrMed, 2), sub: "Campaigns with 300+ impressions" })}
      ${kpi({ label: "Campaigns under 5% CTR", value: fmtNum(lowCamps.length), sub: lowCamps.length ? `≈ <b>${fmtNum(lostClicks)}</b> clicks missed vs an 8% search CTR` : "None with real volume" })}
    </div>
    <div class="card"><div class="head"><div><h3>Daily CTR by ad account</h3><div class="sub">${esc(view.period.label)} · clicks ÷ impressions per day</div></div><div class="grow"></div>${askBtn("Why is CTR low on some campaigns and how do I lift it?", "Ask")}</div>
      ${dr.length > 1 ? lineChart({ labels: dl, series: accSeries.length ? accSeries : [{ name: "CTR", color: "var(--sapphire)", values: dr.map((x) => (x.ctr == null ? null : x.ctr * 100)) }], fmt: (v) => (v == null ? "—" : v.toFixed(2) + "%"), height: 190, fit: true, xTick: (l, i) => (dr.length > 20 ? (i % 3 === 0 ? l : "") : l), markers: dr.length <= 20 }) : nothing("Pick a range longer than one day to see the trend.")}</div>
    <div class="card"><div class="head"><div><h3>Ad accounts</h3><div class="sub">CTR alongside what the clicks convert into · click a row to focus every page on it</div></div></div>${table("ctrAcc", [C.name("Ad account", (r) => r.name, (r) => r.blurb), C.num("impr", "Impr", fmtCompact), C.num("clicks", "Clicks"), ctrCol, C.num("cpc", "CPC", fmtAED), C.num("conv", "Conv", (v) => fmtNum(v, 1)), C.num("convRate", "Conv rate", (v) => fmtPct(v, 1)), { key: "cpl", label: "CPL", render: (r) => fmtAED(r.cpl), cls: (r) => cplClass(r.cpl, cplMed) }], view.accounts.filter((a) => a.inScope && a.impr > 0), { defKey: "ctr", rowAttr: (r) => `class="clickable" data-filter-account="${esc(r.name)}"` })}</div>
    <div class="card"><div class="head"><div><h3>Match types</h3><div class="sub">Click a row to open those keywords</div></div></div>${table("ctrMatch", [C.name("Match type", (r) => r.match, (r) => `${r.n} keywords`), C.num("impr", "Impr", fmtCompact), C.num("clicks", "Clicks"), ctrCol, C.num("cost", "Cost", fmtAEDc), C.num("conv", "Conv", (v) => fmtNum(v, 1)), C.num("convRate", "Conv rate", (v) => fmtPct(v, 1)), { key: "cpl", label: "CPL", render: (r) => fmtAED(r.cpl), cls: (r) => cplClass(r.cpl, cplMed) }], view.kwStats.matchTypes, { defKey: "impr", rowAttr: (r) => `class="clickable" data-kw-filter="match=${esc(r.match)}"` })}</div>
    <div class="card"><div class="head"><div><h3>Hospitals</h3><div class="sub">Green = 25% above the campaign median · red = under 5% or far below median</div></div></div>${table("ctrCentres", [C.name("Hospital", (r) => r.short, (r) => r.account), C.num("impr", "Impr", fmtCompact), C.num("clicks", "Clicks"), ctrCol, C.num("cpc", "CPC", fmtAED), C.num("conv", "Conv"), C.num("convRate", "Conv rate", (v) => fmtPct(v, 1)), C.num("is", "Impr. share", (v) => fmtPct(v, 0))], view.centres.filter((c) => c.impr > 0), { defKey: "impr", rowAttr: (r) => `class="clickable" data-open-centre="${esc(r.name)}"` })}</div>
    <div class="card"><div class="head"><div><h3>Campaigns</h3><div class="sub">Sort by CTR to find ads that do not match the search</div></div></div>${table("ctrCamps", [C.name("Campaign", (r) => r.name.replace(/^Alo_NMC_Search_/, ""), (r) => `${shortCentre(r.centre || "—")} · ${accShort(r.account)}`), C.num("impr", "Impr", fmtCompact), C.num("clicks", "Clicks"), ctrCol, C.num("cpc", "CPC", fmtAED), C.num("conv", "Conv", (v) => fmtNum(v, 1)), C.num("convRate", "Conv rate", (v) => fmtPct(v, 1))], view.campaigns.filter((c) => c.impr > 0), { defKey: "impr", limit: 60, rowAttr: (r) => `class="clickable" data-open-campaign="${r.id}"` })}</div>
    <div class="grid g2">
      <div class="card"><div class="head"><div><h3>Ad groups</h3><div class="sub">100+ impressions</div></div></div>${table("ctrAg", [C.name("Ad group", (r) => r.adgroup, (r) => r.campaign.replace(/^Alo_NMC_Search_/, "")), C.num("impr", "Impr", fmtCompact), C.num("clicks", "Clicks"), ctrCol, C.num("cpc", "CPC", fmtAED)], adgroups.filter((a) => a.impr >= 100), { defKey: "impr", limit: 40 })}</div>
      <div class="card"><div class="head"><div><h3>Lowest-CTR keywords</h3><div class="sub">100+ impressions — rewrite the ad or tighten the match</div></div></div>${table("ctrKw", [C.name("Keyword", (r) => r.kw, (r) => `${r.match} · ${r.adgroup}`), C.num("impr", "Impr", fmtCompact), C.num("clicks", "Clicks"), ctrCol, C.num("cost", "Cost", fmtAEDc)], lowKw.slice(0, 200), { defKey: "impr", limit: 40 })}</div>
    </div>
  </div>`;
}

// ---------- CLICK-TO-CALLS ----------
export function calls(view, ctx) {
  const c = view.c2c, t = view.totals;
  const tpl = `<button class="btn" data-c2c-template>${icon("M12 3v12M7 10l5 5 5-5M5 21h14")} Download the sheet template</button>`;
  const how = `<div class="guide">
      <div class="gstep"><div class="no">01</div><h4>Add a tab once</h4><p>In the Google Sheet add a tab called <b>Click to Calls</b> and import the template (File → Import → <i>Insert new sheet</i>). It lists every hospital under its ad account for every day.</p></div>
      <div class="gstep"><div class="no">02</div><h4>Type the numbers daily</h4><p>For yesterday's rows fill <b>Call Ext.</b> (call-extension taps) and <b>Page Call Now</b> (landing-page call taps). Leave a cell blank if not known yet — blank is “not entered”, 0 is “no calls”.</p></div>
      <div class="gstep"><div class="no">03</div><h4>It syncs itself</h4><p>The dashboard re-reads the sheet on open and every ${ctx.settings.refreshMin || 15} min. Calls flow into every page: cost per call, account totals, hospital drill-downs.</p></div>
    </div>
    <p class="small muted" style="margin-top:12px">Columns: <code>Date · Ad Account · Hospital · Call Ext. · Page Call Now · Total Click-to-Calls</code>. Only Date, Hospital and one number are required; Total is worked out when blank. Tabs are recognised by these headers, so the tab name can be anything.</p>`;
  if (!c?.has) return `<div class="page"><div class="card"><div class="head"><div><h3>Track click-to-calls per hospital, daily</h3><div class="sub">No Click to Calls tab found in the sheet yet${view.flags.hasCalls ? " — the figures below come from the older typed call columns" : ""}</div></div><div class="grow"></div>${tpl}</div>${how}</div>${view.flags.hasCalls ? callsAccountTables(view, null) : ""}</div>`;
  const dates = c.dates, dl = dates.map((d) => fmtDate(d));
  const missing = c.missingLatest;
  return `<div class="page">
    <div class="kpis k5">
      ${kpi({ label: "Click-to-calls", value: fmtNum(t.calls), sub: `${fmtNum(t.calls / view.period.days, 1)} per day · ${esc(view.period.label)}` })}
      ${kpi({ label: "Cost per call", value: fmtAED(t.costPerCall), sub: `Spend <b>${fmtAEDc(t.spend)}</b>` })}
      ${kpi({ label: "Call ext. vs page", value: `${fmtNum(t.callExt)}<small>/ ${fmtNum(t.ga4)}</small>`, sub: `<b>${fmtPct(t.calls ? t.callExt / t.calls : null, 0)}</b> from the call extension` })}
      ${kpi({ label: "Calls + forms", value: fmtNum(t.leadsAll), sub: `Calls are <b>${fmtPct(t.leadsAll ? t.calls / t.leadsAll : null, 0)}</b> of ad leads · blended <b>${fmtAED(t.leadsAll ? t.spend / t.leadsAll : null)}</b>` })}
      ${kpi({ label: "Last day entered", value: fmtDate(c.lastEntry), sub: missing.length ? `<b class="down">${missing.length}</b> hospital${missing.length === 1 ? "" : "s"} not filled for it` : "Every hospital is up to date" })}
    </div>
    ${missing.length ? `<div class="banner">⚑ <div>Not yet entered for <b>${fmtDate(c.lastEntry)}</b>: ${missing.map((m) => `<button class="btn ghost sm" data-open-centre="${esc(m.name)}">${esc(m.short)}</button>`).join(" ")}</div></div>` : ""}
    ${c.unmatched.length ? `<div class="banner">⚠ <div>Hospital names in the tab that did not match a centre: <b>${esc(c.unmatched.join(", "))}</b>. Use the names from the template.</div></div>` : ""}
    <div class="card"><div class="head"><div><h3>Daily click-to-calls by ad account</h3><div class="sub">${esc(view.period.label)} · stacked by account</div></div><div class="grow"></div>${tpl}</div>
      ${barChart({ labels: dl, series: c.accounts.map((a) => ({ name: a.short, color: accColor(a.name), values: dates.map((d, i) => a.hospitals.reduce((s, h) => s + (h.daily[i] || 0), 0)) })), stacked: true, fmt: fmtNum, height: 220, xTick: (l, i) => (dates.length > 20 ? (i % 3 === 0 ? l : "") : l) })}</div>
    ${callsAccountTables(view, c)}
    <details class="card"><summary style="cursor:pointer;font-weight:600">How to update the Click to Calls tab</summary><div style="margin-top:12px">${how}</div></details>
  </div>`;
}
function callsAccountTables(view, c) {
  const accs = c ? c.accounts : view.accounts.filter((a) => a.inScope).map((a) => ({ ...a, hospitals: view.centres.filter((h) => h.account === a.name) }));
  const show = c && c.dates.length <= 31 ? c.dates.slice(-14) : null, offset = c ? c.dates.length - (show ? show.length : 0) : 0;
  return accs.filter((a) => a.hospitals.length).map((a) => `<div class="card"><div class="head"><div><h3><span class="sw" style="background:${accColor(a.name)}"></span>${esc(a.name)}</h3><div class="sub">${a.hospitals.length} hospital${a.hospitals.length === 1 ? "" : "s"} · ${fmtNum(a.calls)} calls · ${fmtAED(a.costPerCall)} per call</div></div><div class="grow"></div><button class="btn ghost sm" data-filter-account="${esc(a.name)}">Focus ${esc(a.short)}</button></div>
    ${table("calls-" + a.short, [C.name("Hospital", (r) => r.short, (r) => r.lastDate ? `last entry ${fmtDate(r.lastDate)}` : c ? "no entries yet" : r.region), C.num("calls", "Calls"), C.num("callExt", "Call ext."), C.num("ga4", "Page call"), C.num("spend", "Spend", fmtAEDc), C.num("costPerCall", "Cost/call", fmtAED), C.num("conv", "Forms"), { key: "callShare", label: "Calls % of leads", render: (r) => fmtPct(r.callShare ?? (r.leadsAll ? (r.calls || 0) / r.leadsAll : null), 0) },
      ...(show ? show.map((d, i) => ({ key: "d" + i, label: fmtDate(d), render: (r) => { const v = r.daily[offset + i]; return v == null ? `<span class="faint">·</span>` : fmtNum(v); }, sort: (r) => r.daily[offset + i] })) : []),
      ...(c ? [{ key: "trend", label: "Daily", render: (r) => sparkline(r.daily.map((v) => v || 0), { color: accColor(r.account), width: 90, height: 24 }), sort: (r) => r.calls }] : [])],
      a.hospitals, { defKey: "calls", rowAttr: (r) => `class="clickable" data-open-centre="${esc(r.name)}"`, total: a })}</div>`).join("");
}

// ---------- LEADS & CRM ----------
export function crm(view, ctx) {
  const c = view.crm; if (!c.leads) return `<div class="page">${leadGapBanner(view)}${nothing("No call-centre leads in this scope. Load the Lead Data export to see CRM outcomes.")}</div>`;
  const net = c.bookingPct;
  const centreRows = view.centres.filter((x) => x.crmLeads > 0);
  return `<div class="page">
    ${leadGapBanner(view)}
    <div class="kpis">
      ${kpi({ label: "Leads logged", value: fmtNum(c.leads), sub: `${fmtNum(c.leads / view.period.days, 1)} per day` })}
      ${kpi({ label: "Booked", value: fmtNum(c.booked), sub: `Booking rate <b>${fmtPct(c.bookingPct, 0)}</b> · when reached <b>${fmtPct(c.reachedPct, 0)}</b>` })}
      ${kpi({ label: "Cost per booking", value: fmtAEDc(c.costPerBooking), sub: `Cost per lead <b>${fmtAED(c.costPerLead)}</b>` })}
      ${kpi({ label: "Median first call", value: fmtMin(c.medianResp), sub: `${fmtNum(c.untouched)} pending & uncalled` })}
      ${kpi({ label: "Not reachable", value: fmtPct(c.notReachablePct, 0), sub: `${fmtNum(c.notReachable)} leads never reached` })}
      ${kpi({ label: "Info-only callers", value: fmtPct(c.infoPct, 0), sub: `${fmtNum(c.infoSeekers)} asked for information only` })}
    </div>
    <div class="grid g-32">
      <div class="card"><div class="head"><div><h3>Lead outcomes</h3><div class="sub">Every lead the call centre logged in this scope</div></div></div>${stackBar({ segments: [{ label: "Booked", value: c.booked, color: "var(--viridian)" }, { label: "Not booked", value: c.notBooked, color: "var(--gamboge)" }, { label: "Not reachable", value: c.notReachable, color: "var(--rufous)" }, { label: "Pending", value: c.pending, color: "var(--text-3)" }] })}
        <div style="margin-top:18px"><div class="tag" style="margin-bottom:8px">Why leads did not book</div>${hbars({ rows: c.reasons.slice(0, 10).map((r) => ({ label: r.reason, value: r.n, extra: fmtPct(r.pct, 0), color: /reachable|answer|off|invalid/i.test(r.reason) ? "var(--rufous)" : /information|details/i.test(r.reason) ? "var(--gamboge)" : "var(--alloy)" })), labelWidth: 190 })}</div></div>
      <div class="card"><div class="head"><div><h3>Speed to lead</h3><div class="sub">Booking rate by time to first call</div></div><div class="grow"></div>${askBtn("How much does call speed affect booking rate here?", "Ask")}</div>${barChart({ labels: c.respBuckets.map((b) => b.label), series: [{ name: "Booking rate", color: "var(--sapphire)", values: c.respBuckets.map((b) => (b.pct || 0) * 100) }], fmt: (v, i) => `${v.toFixed(0)}% of ${c.respBuckets[i].n} leads`, height: 200, yMax: 100 })}
        <div class="small muted" style="margin-top:8px">${c.respBuckets.map((b) => `<span class="pill" style="margin:2px"><b>${b.label}</b> ${b.n}</span>`).join(" ")}</div></div>
    </div>
    <div class="grid g2">
      <div class="card"><div class="head"><div><h3>Leads by hour of day</h3><div class="sub">When demand arrives — staff the queue to the peaks</div></div></div>${barChart({ labels: c.hours.map((h) => `${String(h.h).padStart(2, "0")}:00`), series: [{ name: "Leads", color: "var(--sapphire)", values: c.hours.map((h) => h.n) }, { name: "Booked", color: "var(--viridian)", values: c.hours.map((h) => h.booked) }], fmt: fmtNum, height: 200, xTick: (l, i) => (i % 3 === 0 ? l : "") })}
        <div style="margin-top:10px">${hbars({ rows: c.slots.map((s) => ({ label: s.label, value: s.pct || 0, display: fmtPct(s.pct, 0), extra: `${s.booked}/${s.n} booked`, color: (s.pct || 0) >= (net || 0) ? "var(--viridian)" : "var(--alloy)" })), max: 1, labelWidth: 130 })}</div></div>
      <div class="card"><div class="head"><div><h3>Weekday pattern</h3><div class="sub">Leads and bookings by day of week</div></div></div>${barChart({ labels: c.weekdays.map((d) => d.d), series: [{ name: "Leads", color: "var(--sapphire)", values: c.weekdays.map((d) => d.n) }, { name: "Booked", color: "var(--viridian)", values: c.weekdays.map((d) => d.booked) }], fmt: fmtNum, height: 200 })}
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
    ${(() => { const plan = reallocationPlan(view); if (!plan || !plan.moves.length) return ""; return `<div class="card"><div class="head"><div><h3>Budget reallocation plan</h3><div class="sub">Free money from zero-conversion and over-CPL campaigns, fund the cheap-and-capped ones up to their impression-share ceiling</div></div><div class="grow"></div>${askBtn("Walk me through the budget reallocation plan and its risks", "Discuss")}</div>
      <div class="kpis" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr));margin-bottom:12px">${kpi({ label: "Freed", value: fmtAEDc(plan.totalFreed), sub: `${plan.donors.length} donor campaigns (pause 100%, fix 40%)` })}${kpi({ label: "Redeployed", value: fmtAEDc(plan.totalMoved), sub: `${plan.moves.length} receivers · ${fmtAEDc(plan.unallocated)} held back` })}${kpi({ label: "Net conversions", value: (plan.netConv >= 0 ? "+" : "") + fmtNum(plan.netConv), sub: `+${fmtNum(plan.totalConv)} gained · −${fmtNum(plan.lostConv)} given up` })}${kpi({ label: "Projected CPL", value: fmtAED(plan.projectedCpl), sub: `from ${fmtAED(plan.currentCpl)} on the same spend` })}</div>
      <div class="grid g2"><div><div class="tag" style="margin-bottom:6px">Take from</div>${table("realloc-from", [C.name("Campaign", (r) => r.name.replace(/^Alo_NMC_Search_/, ""), (r) => `${r.specialty} · ${shortCentre(r.centre)}`), { key: "status", label: "Status", render: statusBadge }, C.num("spend", "Spend", fmtAEDc), C.num("conv", "Conv", (v) => fmtNum(v, 1)), C.num("cpl", "CPL", fmtAED), C.num("free", "Free up", fmtAEDc)], plan.donors.slice(0, 10), { defKey: "free" })}</div><div><div class="tag" style="margin-bottom:6px">Give to</div>${table("realloc-to", [C.name("Campaign", (r) => r.to.replace(/^Alo_NMC_Search_/, ""), (r) => `${r.specialty} · ${shortCentre(r.centre)}`), C.num("lostIs", "Lost IS", (v) => fmtPct(v, 0)), C.num("cpl", "CPL now", fmtAED), C.num("amount", "Add", fmtAEDc), C.num("expectedConv", "Expected conv", (v) => "+" + fmtNum(v, 1))], plan.moves.slice(0, 10), { defKey: "amount" })}</div></div>
      <p class="faint small" style="margin-top:10px">Assumes receivers buy their lost rank share at ~1.1× today's CPL. Lift budgets in two steps a week apart and watch CPL; stop if it rises more than 20%.</p></div>`; })()}
    <div class="card"><div class="head"><div><h3>Tactical playbook</h3><div class="sub">The findings sorted the way a senior PPC lead reviews an account: budget, bidding, structure, pages, call centre, measurement</div></div></div>
      <div class="pillars">${playbook(ctx.insights).map((p) => `<div class="pillar"><h4>${icon(p.icon)}${esc(p.label)}</h4><ul>${p.items.length ? p.items.map((i) => `<li><b>${esc(i.title)}</b> — ${esc(i.action)}</li>`).join("") : `<li class="empty-li">Nothing flagged in this scope.</li>`}</ul></div>`).join("")}</div></div>
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
        <div class="steps">${tabs.map(([k, n]) => `<div class="step ok"><span class="ic">✓</span><b>${esc(n)}</b><span class="faint">→ ${esc({ ads: "Google Ads keyword export", leads: "Call-centre lead export", summary: "Month summary (typed call columns)", dailyCalls: "Daily calls by account", clickToCalls: "Click-to-calls per hospital (typed daily)", budget: "Budgets", centreList: "Campaign → centre mapping" }[k] || k)}</span></div>`).join("")}${(m.weeks || []).map((w) => `<div class="step ok"><span class="ic">✓</span><b>${esc(w.tab || w.key)}</b><span class="faint">→ ${esc(w.label)}</span></div>`).join("")}${(m.meta.unknownTabs || []).map((n) => `<div class="step"><span class="ic">·</span>${esc(n)}<span class="faint">ignored (no known layout)</span></div>`).join("")}</div>
        <dl class="kvlist" style="margin-top:14px"><dt>Campaigns</dt><dd>${fmtNum(m.ads?.campaigns.length || 0)}</dd><dt>Keyword rows</dt><dd>${fmtNum(m.ads?.keywords.length || 0)} (from ${fmtNum(m.ads?.rowsRead || 0)} export rows)</dd><dt>Leads</dt><dd>${fmtNum(m.leads.length)}</dd><dt>Centres</dt><dd>${m.centres.length}</dd></dl></div>
    </div>
    ${unmapped.length || leadsNoCentre ? `<div class="banner">⚠ <div>${unmapped.length ? `<b>${unmapped.length} campaigns</b> could not be matched to a centre: ${esc(unmapped.slice(0, 6).join(", "))}${unmapped.length > 6 ? "…" : ""}. Add their centre token on the <b>Centre List</b> tab. ` : ""}${leadsNoCentre ? `<b>${leadsNoCentre} leads</b> have a branch name that is not in the centre list.` : ""}</div></div>` : ""}
    ${recon.length ? `<div class="card"><div class="head"><div><h3>Reconciliation against the sheet's own MTD summary</h3><div class="sub">The app recomputes everything from the raw exports — small gaps mean the sheet's formulas and the dump disagree</div></div></div>${table("recon", [C.name("Metric", (r) => r.metric), C.num("sheet", "Sheet MTD", (v) => fmtNum(v, v % 1 ? 1 : 0)), C.num("app", "Recomputed", (v) => fmtNum(v, v % 1 ? 1 : 0)), { key: "gap", label: "Gap", render: (r) => (r.gap == null ? "—" : `<span class="${Math.abs(r.gap) > 0.03 ? "bad" : "okay"}">${fmtDelta(r.gap, 1)}</span>`) }], recon.map(([metric, sheet, app]) => ({ metric, sheet, app, gap: sheet ? app / sheet - 1 : null })), { defKey: "metric" })}</div>` : ""}
    <div class="card"><div class="head"><div><h3>Daily workflow — paste into the sheet, the dashboard fetches itself</h3><div class="sub">One-time connection, then zero clicks: the app re-reads the sheet when it opens and every ${ctx.settings.refreshMin || 15} minutes while it stays open</div></div><div class="grow"></div>${src.sheetId ? `<span class="sync-state"><i></i> auto-refresh ${ctx.settings.autoSync === false ? "off" : "on"}</span>` : ""}</div>
      <div class="guide">
        <div class="gstep"><div class="no">01</div><h4>Share the sheet once</h4><p>In Google Sheets: Share → General access → <b>Anyone with the link · Viewer</b>. Nothing else changes in the sheet. Private sheet? Use <b>Google sign-in</b> in Connect instead.</p></div>
        <div class="gstep"><div class="no">02</div><h4>Connect once</h4><p>Click <b>Connect</b>, paste the sheet link, press <b>Connect &amp; sync</b>. The link is remembered on this device. Tick <b>Re-sync automatically</b> (default on).</p></div>
        <div class="gstep"><div class="no">03</div><h4>Paste data every day</h4><p>Download the Google Ads keyword report and the call-centre export the usual way. Paste them at <code>A1</code> of <b>Google Ads Data</b> and <b>Lead Data</b>, replacing what is there. No reshaping, no renaming.</p></div>
        <div class="gstep"><div class="no">04</div><h4>That's it</h4><p>Open the dashboard: it fetches the latest rows, recomputes every account, hospital, campaign, keyword and CRM view, and re-ranks the actions. Press <b>Sync</b> to refresh on demand.</p></div>
      </div>
      <p class="small muted" style="margin-top:14px">Tabs are recognised by their <b>headers</b>, so extra tabs, renamed tabs and a new month all work. Optional extras that unlock more: budgets per centre (pacing), a <b>Click to Calls</b> tab typed daily per hospital (<a data-nav="calls">template on the Click-to-calls page</a>), a Centre List for brand-new centres.</p></div>
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
      ${kpi({ label: "Click-to-calls", value: c.calls == null ? "—" : fmtNum(c.calls), sub: c.calls ? `<b>${fmtAED(c.costPerCall)}</b> per call` : "No calls entered for this range" })}
      ${kpi({ label: "CRM leads → booked", value: `${fmtNum(c.booked)}<small>/ ${fmtNum(c.crmLeads)}</small>`, sub: `<b>${fmtPct(c.bookingPct, 0)}</b> booking · ${fmtPct(c.notReachablePct, 0)} unreached` })}
      ${kpi({ label: "Cost per booking", value: fmtAEDc(c.costPerBooking), sub: `CPC ${fmtAED(c.cpc)} · CTR ${fmtPct(c.ctr, 1)}` })}
      ${kpi({ label: "Impression share", value: fmtPct(c.is, 0), sub: `<b>${fmtPct(c.lostIs, 0)}</b> lost to rank` })}
    </div>
    <div class="card flat"><div class="head"><div><h3>Health ${c.health} · ${esc(c.healthBand)}</h3><div class="sub">Efficiency ${c.healthParts.eff} · Booking ${c.healthParts.conv} · Pacing ${c.healthParts.pace} · Reach ${c.healthParts.reach}</div></div><div class="grow"></div>${ring(c.health, { size: 64, stroke: 6 })}</div>
      ${insightList(ctx.insights.filter((i) => i.entity === name || (i.entities || []).some((n) => camps.some((x) => x.name === n))).map((i) => (i.entities ? { ...i, entities: i.entities.filter((n) => camps.some((x) => x.name === n)) } : i)).slice(0, 4), { compact: true })}</div>
    <div class="card flat"><div class="head"><div><h3>${camps.length} campaigns</h3></div></div>${table("drawer-camps", [C.name("Campaign", (r) => r.name.replace(/^Alo_NMC_Search_/, ""), (r) => r.specialty), { key: "status", label: "Status", render: statusBadge }, C.num("spend", "Spend", fmtAEDc), C.num("conv", "Conv", (v) => fmtNum(v, 1)), { key: "cpl", label: "CPL", render: (r) => fmtAED(r.cpl), cls: (r) => cplClass(r.cpl, med) }, C.num("ctr", "CTR", (v) => fmtPct(v, 1)), C.num("lostIs", "Lost IS", (v) => fmtPct(v, 0))], camps, { defKey: "spend", rowAttr: (r) => `class="clickable" data-open-campaign="${r.id}"` })}</div>
    <div class="grid g2">
      <div class="card flat"><div class="head"><div><h3>Call-centre outcomes</h3></div></div>${leads.length ? stackBar({ segments: [{ label: "Booked", value: c.booked, color: "var(--viridian)" }, { label: "Not booked", value: c.notBooked, color: "var(--gamboge)" }, { label: "Not reachable", value: c.notReachable, color: "var(--rufous)" }, { label: "Pending", value: c.pending, color: "var(--text-3)" }] }) + `<div style="margin-top:12px">${hbars({ rows: depts.slice(0, 8).map((d) => ({ label: d.dept, value: d.leads, display: `${d.booked}/${d.leads}`, extra: fmtPct(d.booked / d.leads, 0), color: "var(--s1)" })), labelWidth: 140 })}</div>` : `<div class="faint small">No leads logged for this centre in range.</div>`}</div>
      <div class="card flat"><div class="head"><div><h3>Keywords burning budget</h3><div class="sub">No conversions in range</div></div></div>${wasted.length ? hbars({ rows: wasted.map((k) => ({ label: k.kw, sub: k.match, value: k.cost, display: fmtAEDc(k.cost), color: "var(--rufous)" })), labelWidth: 140 }) : `<div class="faint small">Nothing wasted — nice.</div>`}</div>
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
    <div class="card flat"><div class="head"><div><h3>Daily</h3><div class="sub">Spend and conversions in range</div></div></div>${daily.length ? barChart({ labels: daily.map((d) => fmtDate(d.d)), series: [{ name: "Spend (AED)", color: "var(--sapphire)", values: daily.map((d) => d.cost) }], fmt: (v) => fmtAED(v), height: 140, xTick: (l, i) => (i % 3 === 0 ? l : "") }) + lineChart({ labels: daily.map((d) => fmtDate(d.d)), series: [{ name: "Conversions", color: "var(--viridian)", values: daily.map((d) => d.conv) }, { name: "Clicks", color: "var(--sapphire)", values: daily.map((d) => d.clicks), dash: true }], fmt: fmtNum, height: 140, xTick: (l, i) => (i % 3 === 0 ? l : "") }) : nothing("No daily rows")}</div>
    <div class="card flat"><div class="head"><div><h3>Ad groups</h3></div></div>${table("drawer-ag", [C.name("Ad group", (r) => r.adgroup, (r) => `${r.n} keywords`), C.num("cost", "Cost", fmtAEDc), C.num("clicks", "Clicks"), C.num("ctr", "CTR", (v) => fmtPct(v, 1)), C.num("conv", "Conv", (v) => fmtNum(v, 1)), { key: "cpl", label: "CPL", render: (r) => fmtAED(r.cpl), cls: (r) => cplClass(r.cpl, med) }, C.num("lostIs", "Lost IS", (v) => fmtPct(v, 0))], adgroups, { defKey: "cost" })}</div>
    <div class="card flat"><div class="head"><div><h3>Keywords</h3><div class="sub">Sorted by cost</div></div></div>${table("drawer-kw", [C.name("Keyword", (r) => r.kw, (r) => `${r.match} · ${r.adgroup}`), { key: "qs", label: "QS", render: (r) => (r.qs == null ? "—" : `<span class="${r.qs <= 3 ? "bad" : r.qs >= 7 ? "okay" : "meh"}">${r.qs}</span>`) }, C.num("impr", "Impr"), C.num("clicks", "Clicks"), C.num("ctr", "CTR", (v) => fmtPct(v, 1)), C.num("cost", "Cost", fmtAEDc), C.num("conv", "Conv", (v) => fmtNum(v, 1)), { key: "cpl", label: "CPL", render: (r) => fmtAED(r.cpl), cls: (r) => cplClass(r.cpl, med) }, C.num("lostIs", "Lost IS", (v) => fmtPct(v, 0))], kws, { defKey: "cost", limit: 60 })}</div>
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
    ${depts.length ? `<div class="card flat"><div class="head"><div><h3>Call-centre departments</h3></div></div>${hbars({ rows: depts.map((d) => ({ label: d.dept, value: d.leads, display: `${d.booked}/${d.leads}`, extra: fmtPct(d.pct, 0), color: "var(--sapphire)" })), labelWidth: 200 })}</div>` : ""}
    <div>${askBtn(`How is ${name} performing across centres and what should we change?`, "Ask the analyst")}</div>`;
  return { title: name, sub: `Specialty · ${esc(view.period.label)}`, body };
}
