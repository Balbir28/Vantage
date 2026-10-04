// ============================================================
//  ANALYTICS — turns the normalised model into one "view" for a
//  filter { start, end, account, centre }. Everything is derived from
//  the two raw dumps (Google Ads keyword export + call-centre export);
//  the sheet's summary/week tabs only contribute the typed call columns.
// ============================================================
import { ACCOUNTS, ACCOUNT_META, specialtyOfDept } from "./parse.js";

const sum = (arr, k) => arr.reduce((s, o) => s + (o[k] || 0), 0);
const div = (a, b) => (b ? a / b : null);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const median = (xs) => { const a = xs.filter((x) => x != null && Number.isFinite(x)).sort((p, q) => p - q); if (!a.length) return null; const m = a.length >> 1; return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };
const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5) + 1;
const addDays = (d, n) => new Date(Date.parse(d) + n * 864e5).toISOString().slice(0, 10);
const pad = (n) => String(n).padStart(2, "0");

export function emptyMetrics() {
  return { impr: 0, clicks: 0, spend: 0, conv: 0, phone: 0, elig: 0, lost: 0, callExt: null, ga4: null, budget: null,
    crmLeads: 0, booked: 0, notBooked: 0, notReachable: 0, pending: 0, infoSeekers: 0, days: 0 };
}
function add(m, r) { m.impr += r.impr || 0; m.clicks += r.clicks || 0; m.spend += r.cost || 0; m.conv += r.conv || 0; m.phone += r.calls || 0; m.elig += r.elig || 0; m.lost += r.lost || 0; }
export function finalize(m) {
  m.ctr = div(m.clicks, m.impr); m.cpc = div(m.spend, m.clicks); m.cpl = div(m.spend, m.conv);
  m.convRate = div(m.conv, m.clicks);
  m.is = div(m.impr, m.elig); m.lostIs = div(m.lost, m.elig);
  m.calls = m.callExt != null || m.ga4 != null ? (m.callExt || 0) + (m.ga4 || 0) : (m.phone || null);
  m.costPerCall = m.calls ? m.spend / m.calls : null;
  m.leadsAll = m.conv + (m.calls || 0);
  m.pacing = m.budget ? m.spend / m.budget : null;
  m.bookingPct = div(m.booked, m.crmLeads);
  const reached = m.crmLeads - m.notReachable - m.pending;
  m.reachedPct = reached > 0 ? m.booked / reached : null;
  m.costPerBooking = m.booked ? m.spend / m.booked : null;
  m.costPerCrmLead = m.crmLeads ? m.spend / m.crmLeads : null;
  m.notReachablePct = div(m.notReachable, m.crmLeads);
  return m;
}

// ---------- period helpers ----------
export function monthBounds(model) {
  const y = model.meta.year, mo = model.meta.month;
  const dim = new Date(y, mo, 0).getDate();
  const first = `${y}-${pad(mo)}-01`;
  const last = model.meta.dataUpTo && /^\d{4}-\d{2}-\d{2}$/.test(model.meta.dataUpTo) ? model.meta.dataUpTo : `${y}-${pad(mo)}-${pad(dim)}`;
  return { first, last, dim, monthEnd: `${y}-${pad(mo)}-${pad(dim)}` };
}
export function weekBounds(model, key) {
  const w = model.weeks.find((x) => x.key === key);
  if (w && w.start && w.end) return { start: w.start, end: w.end };
  const { first, monthEnd } = monthBounds(model), n = +key.slice(1);
  const start = addDays(first, (n - 1) * 7), end = n === 5 ? monthEnd : addDays(first, n * 7 - 1);
  return { start, end: end > monthEnd ? monthEnd : end };
}
export function presets(model) {
  const { first, last } = monthBounds(model);
  const out = [{ key: "mtd", label: "Month to date", start: first, end: last }];
  const n = daysBetween(first, last);
  if (n > 7) out.push({ key: "l7", label: "Last 7 days", start: addDays(last, -6), end: last });
  if (n > 14) out.push({ key: "l14", label: "Last 14 days", start: addDays(last, -13), end: last });
  const weeksSeen = new Set(model.ads?.daily.map((d) => d.w) || model.weeks.map((w) => w.key));
  for (const k of ["W1", "W2", "W3", "W4", "W5"]) if (weeksSeen.has(k)) { const b = weekBounds(model, k); if (b.start <= last) out.push({ key: k, label: (model.weeks.find((w) => w.key === k)?.label) || `Week ${k.slice(1)}`, start: b.start, end: b.end > last ? last : b.end }); }
  return out;
}
export function normalizeFilter(model, f = {}) {
  const { first, last } = monthBounds(model);
  let start = f.start && f.start >= first ? f.start : first;
  let end = f.end && f.end <= last ? f.end : last;
  if (end < start) [start, end] = [end, start];
  const account = f.account && ACCOUNTS.includes(f.account) ? f.account : "all";
  let centre = f.centre || null;
  if (centre) { const c = model.centres.find((x) => x.name === centre); if (!c || (account !== "all" && c.account !== account)) centre = null; }
  return { start, end, account, centre, preset: f.preset || null };
}

// ---------- the view ----------
export function computeView(model, rawFilter = {}) {
  const filter = normalizeFilter(model, rawFilter);
  const { start, end, account, centre } = filter;
  const { first, last, dim } = monthBounds(model);
  const days = daysBetween(start, end);
  const inRange = (d) => d >= start && d <= end;
  const campaigns = model.ads?.campaigns || [];
  const cScope = (c) => (account === "all" || c.account === account) && (!centre || c.centre === centre);
  const centreScope = (c) => (account === "all" || c.account === account) && (!centre || c.name === centre);
  const scopeCentres = model.centres.filter(centreScope);
  const scopeCentreNames = new Set(scopeCentres.map((c) => c.name));
  const leads = model.leads.filter((l) => l.created && inRange(l.created.slice(0, 10)));
  const leadCentreOk = (l) => scopeCentreNames.has(l.centre) || (!centre && account === "all");
  const leadsScope = leads.filter(leadCentreOk);

  // --- typed call columns (summary/week tabs) pro-rated to the range ---
  let callsEstimated = false;
  const typedCalls = (centreName) => {
    const whole = start === first && end === last && model.summary;
    if (whole) { const r = model.summary.rows.find((x) => x.centre === centreName); return r ? { callExt: r.callExt, ga4: r.ga4, wa: r.wa } : null; }
    if (!model.weeks.length) return null;
    let ext = 0, g = 0, any = false;
    for (const w of model.weeks) {
      if (!w.start || !w.end) continue;
      const os = w.start > start ? w.start : start, oe = w.end < end ? w.end : end;
      if (oe < os) continue;
      const share = daysBetween(os, oe) / w.days;
      if (share < 0.999) callsEstimated = true;
      const r = w.rows.find((x) => x.centre === centreName); if (!r) continue;
      ext += (r.callExt || 0) * share; g += (r.ga4 || 0) * share; any = true;
    }
    return any ? { callExt: Math.round(ext), ga4: Math.round(g) } : null;
  };
  const crmInto = (m, ls) => {
    m.crmLeads += ls.length;
    for (const l of ls) {
      if (l.status === "booked") m.booked++; else if (l.status === "not reachable") m.notReachable++; else if (l.status === "pending") m.pending++; else m.notBooked++;
      if (/information|treatment details/i.test(l.reason)) m.infoSeekers++;
    }
  };

  // --- campaigns ---
  const byCamp = new Map();
  for (const r of model.ads?.daily || []) {
    if (!inRange(r.d)) continue;
    const c = campaigns[r.c]; if (!cScope(c)) continue;
    let m = byCamp.get(r.c); if (!m) { m = emptyMetrics(); m.daysActive = new Set(); byCamp.set(r.c, m); }
    add(m, r); if (r.cost > 0 || r.impr > 0) m.daysActive.add(r.d);
  }
  const allNetworkCpl = []; // baseline across the whole network in the same range
  { const tmp = new Map(); for (const r of model.ads?.daily || []) { if (!inRange(r.d)) continue; let m = tmp.get(r.c); if (!m) { m = { spend: 0, conv: 0 }; tmp.set(r.c, m); } m.spend += r.cost; m.conv += r.conv; } for (const m of tmp.values()) if (m.conv >= 1 && m.spend >= 100) allNetworkCpl.push(m.spend / m.conv); }
  const baseline = { cplMedian: median(allNetworkCpl) };
  const campRows = [];
  for (const [ci, m] of byCamp) {
    const c = campaigns[ci]; m.daysActive = m.daysActive.size; finalize(m);
    const row = { id: ci, name: c.name, account: c.account, centre: c.centre, region: c.region, specialty: c.specialty, ...m };
    Object.assign(row, classifyCampaign(row, baseline));
    campRows.push(row);
  }
  campRows.sort((a, b) => b.spend - a.spend);
  const totalCampSpend = sum(campRows, "spend"); for (const r of campRows) r.share = div(r.spend, totalCampSpend);

  // --- centres ---
  const centreRows = [];
  for (const c of scopeCentres) {
    const m = emptyMetrics();
    for (const r of campRows) if (r.centre === c.name) add(m, { impr: r.impr, clicks: r.clicks, cost: r.spend, conv: r.conv, calls: r.phone, elig: r.elig, lost: r.lost });
    const tc = typedCalls(c.name); if (tc) { m.callExt = tc.callExt; m.ga4 = tc.ga4; m.wa = tc.wa ?? null; }
    m.budget = c.budget != null ? c.budget * days / dim : null;
    crmInto(m, leadsScope.filter((l) => l.centre === c.name));
    m.campaigns = campRows.filter((r) => r.centre === c.name).length;
    finalize(m);
    centreRows.push({ name: c.name, region: c.region, account: c.account, short: shortCentre(c.name), monthlyBudget: c.budget, ...m });
  }
  // health score relative to the network median CPL
  const netCplMed = median(centreRows.filter((r) => r.conv >= 1 && r.spend >= 200).map((r) => r.cpl));
  for (const r of centreRows) Object.assign(r, healthScore(r, netCplMed));
  centreRows.sort((a, b) => b.spend - a.spend);
  const totalCentreSpend = sum(centreRows, "spend"); for (const r of centreRows) r.share = div(r.spend, totalCentreSpend);

  // --- accounts (all four always, flagged in/out of scope) ---
  const accountRows = ACCOUNTS.map((name) => {
    const inScope = account === "all" || account === name;
    const m = emptyMetrics(); let anyCalls = false, anyBudget = false;
    const cs = centreRows.filter((r) => r.account === name);
    for (const r of cs) { add(m, { impr: r.impr, clicks: r.clicks, cost: r.spend, conv: r.conv, calls: r.phone, elig: r.elig, lost: r.lost }); if (r.callExt != null || r.ga4 != null) { anyCalls = true; m.callExt = (m.callExt || 0) + (r.callExt || 0); m.ga4 = (m.ga4 || 0) + (r.ga4 || 0); } if (r.budget != null) { anyBudget = true; m.budget = (m.budget || 0) + r.budget; } m.crmLeads += r.crmLeads; m.booked += r.booked; m.notBooked += r.notBooked; m.notReachable += r.notReachable; m.pending += r.pending; m.infoSeekers += r.infoSeekers; }
    // campaigns with an account but no centre still count toward the account
    for (const r of campRows) if (r.account === name && !scopeCentreNames.has(r.centre)) add(m, { impr: r.impr, clicks: r.clicks, cost: r.spend, conv: r.conv, calls: r.phone, elig: r.elig, lost: r.lost });
    if (!anyCalls) { m.callExt = null; m.ga4 = null; } if (!anyBudget) m.budget = null;
    finalize(m);
    return { name, short: ACCOUNT_META[name].short, slot: ACCOUNT_META[name].slot, blurb: ACCOUNT_META[name].blurb, inScope, centres: cs.length, ...m };
  });
  const totalAccSpend = sum(accountRows.filter((a) => a.inScope), "spend"); for (const a of accountRows) a.share = a.inScope ? div(a.spend, totalAccSpend) : null;

  // --- totals ---
  const totals = emptyMetrics(); let tCalls = false, tBudget = false;
  for (const a of accountRows) { if (!a.inScope) continue; add(totals, { impr: a.impr, clicks: a.clicks, cost: a.spend, conv: a.conv, calls: a.phone, elig: a.elig, lost: a.lost }); if (a.callExt != null) { tCalls = true; totals.callExt = (totals.callExt || 0) + a.callExt; totals.ga4 = (totals.ga4 || 0) + (a.ga4 || 0); } if (a.budget != null) { tBudget = true; totals.budget = (totals.budget || 0) + a.budget; } totals.crmLeads += a.crmLeads; totals.booked += a.booked; totals.notBooked += a.notBooked; totals.notReachable += a.notReachable; totals.pending += a.pending; totals.infoSeekers += a.infoSeekers; }
  if (!tCalls) { totals.callExt = null; totals.ga4 = null; } if (!tBudget) totals.budget = null;
  totals.days = days; finalize(totals);
  totals.campaigns = campRows.length; totals.centres = centreRows.length;
  totals.expectedPacing = days / dim; // where spend "should" be if linear through the month

  // --- specialties ---
  const specMap = new Map();
  for (const r of campRows) { let s = specMap.get(r.specialty); if (!s) { s = { name: r.specialty, ...emptyMetrics(), campaigns: 0 }; specMap.set(r.specialty, s); } add(s, { impr: r.impr, clicks: r.clicks, cost: r.spend, conv: r.conv, calls: r.phone, elig: r.elig, lost: r.lost }); s.campaigns++; }
  for (const l of leadsScope) { const k = specialtyOfDept(l.dept); let s = specMap.get(k); if (!s) { s = { name: k, ...emptyMetrics(), campaigns: 0 }; specMap.set(k, s); } s.crmLeads++; if (l.status === "booked") s.booked++; else if (l.status === "not reachable") s.notReachable++; else if (l.status === "pending") s.pending++; else s.notBooked++; }
  const specialties = [...specMap.values()].map(finalize).sort((a, b) => b.spend - a.spend);

  // --- keywords (month-level aggregates, scoped) ---
  const keywords = (model.ads?.keywords || []).filter((k) => cScope(campaigns[k.c])).map((k) => { const c = campaigns[k.c]; const o = { ...k, campaign: c.name, centre: c.centre, account: c.account, specialty: c.specialty }; o.cpl = div(o.cost, o.conv); o.ctr = div(o.clicks, o.impr); o.cpc = div(o.cost, o.clicks); o.is = div(o.impr, o.elig); o.lostIs = div(o.lost, o.elig); return o; });
  const kwStats = keywordStats(keywords);

  // --- trends (whole month, scoped by account/centre; the page highlights the range) ---
  const trend = buildTrends(model, { first, last, dim, cScope, scopeCentres, scopeCentreNames, leadCentreOk, account, centre, campaigns });

  // --- CRM detail ---
  const crm = crmDetail(leadsScope, centreRows, specialties, totals);

  const scopeLabel = [centre ? shortCentre(centre) : account === "all" ? "All ad accounts" : account, rangeLabel(start, end, first, last, model)].join(" · ");
  return { filter, period: { start, end, days, first, last, dim, label: rangeLabel(start, end, first, last, model) }, scopeLabel, baseline,
    totals, accounts: accountRows, centres: centreRows, campaigns: campRows, specialties, keywords, kwStats, trend, crm,
    flags: { callsEstimated, hasCalls: tCalls, hasLeads: model.leads.length > 0, hasSummary: !!model.summary, hasDailyCalls: model.dailyCalls.length > 0, hasBudget: tBudget } };
}

export function rangeLabel(start, end, first, last, model) {
  const mon = (d) => new Date(d + "T00:00:00").toLocaleString("en-GB", { month: "short" });
  if (start === first && end === last) return `${model.meta.period} · MTD`;
  if (start === end) return `${+start.slice(8)} ${mon(start)}`;
  return `${+start.slice(8)}–${+end.slice(8)} ${mon(end)}`;
}
export function shortCentre(name) {
  return String(name).replace(/^NMC\s+/, "").replace(/Royal Hospital,\s*/, "RH ").replace(/Specialty Hospital,\s*/, "SH ").replace(/Royal Medical Centre,\s*/, "RMC ").replace(/Medical Centre,\s*/, "MC ").replace(/Medical Centre$/, "MC").replace(/, Dubai$/, "");
}

// ---------- classification ----------
export function classifyCampaign(r, baseline) {
  const med = baseline.cplMedian;
  if (r.spend < 50) return { status: "watch", statusLabel: "Watch", why: "Too little spend to judge yet" };
  if (r.conv < 1 && r.spend >= 300) return { status: "pause", statusLabel: "Pause / rebuild", why: `AED ${Math.round(r.spend)} with no conversions` };
  if (r.conv < 1) return { status: "watch", statusLabel: "Watch", why: "No conversions yet on a small spend" };
  const ratio = med ? r.cpl / med : 1;
  if (ratio <= 0.7 && ((r.lostIs ?? 0) >= 0.3 || (r.is ?? 1) < 0.5)) return { status: "scale", statusLabel: "Scale", why: `CPL ${Math.round((1 - ratio) * 100)}% under network median and ${Math.round((r.lostIs || 0) * 100)}% impression share lost to rank` };
  if (ratio <= 0.7) return { status: "hold", statusLabel: "Efficient", why: "Cheap leads, but reach is already near its ceiling" };
  if (ratio >= 1.8) return { status: "fix", statusLabel: "Fix", why: `CPL ${ratio.toFixed(1)}× the network median` };
  if ((r.ctr ?? 0.1) < 0.05 && r.impr > 500) return { status: "fix", statusLabel: "Fix", why: `CTR ${(r.ctr * 100).toFixed(1)}% — ads are not matching intent` };
  return { status: "hold", statusLabel: "Hold", why: "Within normal range" };
}
export function healthScore(r, netCplMed) {
  const eff = r.conv >= 1 && netCplMed ? clamp(netCplMed / r.cpl, 0, 1.6) / 1.6 : r.spend > 200 ? 0.15 : 0.5;
  const conv = r.crmLeads >= 5 ? clamp(r.bookingPct / 0.6, 0, 1) : 0.5;
  const pace = r.pacing != null ? 1 - clamp(Math.abs(r.pacing - 1) / 0.5, 0, 1) : 0.5;
  const reach = clamp((r.is ?? 0) / 0.8, 0, 1);
  const score = Math.round(100 * (0.35 * eff + 0.30 * conv + 0.15 * pace + 0.20 * reach));
  const band = score >= 70 ? "strong" : score >= 50 ? "steady" : "risk";
  return { health: score, healthBand: band, healthParts: { eff: Math.round(eff * 100), conv: Math.round(conv * 100), pace: Math.round(pace * 100), reach: Math.round(reach * 100) } };
}

// ---------- keyword intelligence ----------
function keywordStats(kws) {
  const spent = kws.filter((k) => k.cost > 0);
  const wasted = spent.filter((k) => k.conv < 0.01).sort((a, b) => b.cost - a.cost);
  const winners = spent.filter((k) => k.conv >= 1).sort((a, b) => a.cpl - b.cpl);
  const byMatch = new Map();
  for (const k of spent) { const key = k.match || "Unknown"; let m = byMatch.get(key); if (!m) { m = { match: key, cost: 0, conv: 0, clicks: 0, impr: 0, n: 0 }; byMatch.set(key, m); } m.cost += k.cost; m.conv += k.conv; m.clicks += k.clicks; m.impr += k.impr; m.n++; }
  const totalCost = sum(spent, "cost");
  const matchTypes = [...byMatch.values()].map((m) => ({ ...m, cpl: div(m.cost, m.conv), share: div(m.cost, totalCost), ctr: div(m.clicks, m.impr) })).sort((a, b) => b.cost - a.cost);
  const bands = [{ band: "QS 1–3", min: 1, max: 3 }, { band: "QS 4–6", min: 4, max: 6 }, { band: "QS 7–10", min: 7, max: 10 }, { band: "No score", min: null, max: null }].map((b) => ({ ...b, cost: 0, impr: 0, conv: 0, clicks: 0, n: 0 }));
  for (const k of spent) { const b = k.qs == null ? bands[3] : bands.find((x) => x.min != null && k.qs >= x.min && k.qs <= x.max) || bands[3]; b.cost += k.cost; b.impr += k.impr; b.conv += k.conv; b.clicks += k.clicks; b.n++; }
  for (const b of bands) { b.share = div(b.cost, totalCost); b.cpl = div(b.cost, b.conv); }
  const wastedTotal = sum(wasted, "cost");
  const lowQsSpend = bands[0].cost;
  return { wasted: wasted.slice(0, 40), wastedTotal, wastedCount: wasted.length, winners: winners.slice(0, 25), matchTypes, qsBands: bands, lowQsSpend, totalCost, keywordsWithSpend: spent.length };
}

// ---------- trends ----------
function buildTrends(model, ctx) {
  const { first, last, dim, cScope, scopeCentres, leadCentreOk, account, centre, campaigns } = ctx;
  const daily = new Map();
  for (let d = first; d <= last; d = addDays(d, 1)) daily.set(d, { date: d, impr: 0, clicks: 0, spend: 0, conv: 0, elig: 0, lost: 0, calls: null, callExt: null, ga4: null, crmLeads: 0, booked: 0 });
  for (const r of model.ads?.daily || []) { const o = daily.get(r.d); if (!o || !cScope(campaigns[r.c])) continue; o.impr += r.impr; o.clicks += r.clicks; o.spend += r.cost; o.conv += r.conv; o.elig += r.elig; o.lost += r.lost; }
  for (const l of model.leads) { if (!l.created) continue; const o = daily.get(l.created.slice(0, 10)); if (!o || !leadCentreOk(l)) continue; o.crmLeads++; if (l.status === "booked") o.booked++; }
  if (!centre && model.dailyCalls.length) for (const dc of model.dailyCalls) { const o = daily.get(dc.date); if (!o) continue; const a = account === "all" ? (dc.acc.ALL || sumAcc(dc.acc)) : dc.acc[account]; if (a) { o.calls = a.total; o.callExt = a.ext; o.ga4 = a.ga4; } }
  const dailyRows = [...daily.values()].map((o) => ({ ...o, cpl: div(o.spend, o.conv), ctr: div(o.clicks, o.impr), cpc: div(o.spend, o.clicks), is: div(o.impr, o.elig), costPerCall: o.calls ? o.spend / o.calls : null }));

  // weekly buckets (W1..W5), scoped
  const weeks = [];
  const keys = [...new Set((model.ads?.daily || []).map((r) => r.w))].sort();
  for (const key of keys) {
    const b = weekBounds(model, key); if (b.start > last) continue;
    const wEnd = b.end > last ? last : b.end;
    const m = emptyMetrics(); m.days = daysBetween(b.start, wEnd);
    for (const r of dailyRows) if (r.date >= b.start && r.date <= wEnd) { m.impr += r.impr; m.clicks += r.clicks; m.spend += r.spend; m.conv += r.conv; m.elig += r.elig; m.lost += r.lost; m.crmLeads += r.crmLeads; m.booked += r.booked; }
    const wt = model.weeks.find((w) => w.key === key);
    if (wt) { let ext = 0, g = 0, any = false; for (const c of scopeCentres) { const r = wt.rows.find((x) => x.centre === c.name); if (r && (r.callExt != null || r.ga4 != null)) { any = true; ext += r.callExt || 0; g += r.ga4 || 0; } } if (any) { m.callExt = ext; m.ga4 = g; } }
    else if (!centre) { let t = 0, any = false; for (const r of dailyRows) if (r.date >= b.start && r.date <= wEnd && r.calls != null) { t += r.calls; any = true; } if (any) { m.callExt = null; m.ga4 = null; m.phone = t; } }
    m.budget = scopeCentres.reduce((s, c) => s + (c.budget || 0), 0) * m.days / dim || null;
    finalize(m);
    const note = model.summary?.trend.find((t) => t.week === key)?.note || null;
    weeks.push({ key, label: wt?.label || `Week ${key.slice(1)}`, start: b.start, end: wEnd, note, ...m });
  }
  for (let i = 1; i < weeks.length; i++) { const p = weeks[i - 1], w = weeks[i]; w.wow = { spend: pct(w.spend / w.days, p.spend / p.days), conv: pct(w.conv / w.days, p.conv / p.days), cpl: pct(w.cpl, p.cpl), calls: pct((w.calls || 0) / w.days, (p.calls || 0) / p.days), booked: pct(w.booked / w.days, p.booked / p.days) }; }
  return { daily: dailyRows, weekly: weeks };
}
const sumAcc = (acc) => { let ext = 0, ga4 = 0, total = 0; for (const [k, v] of Object.entries(acc)) { if (k === "ALL") continue; ext += v.ext; ga4 += v.ga4; total += v.total; } return { ext, ga4, total }; };
export const pct = (a, b) => (b && a != null && b !== 0 ? a / b - 1 : null);

// ---------- CRM ----------
function crmDetail(leads, centreRows, specialties, totals) {
  const n = leads.length;
  const count = (pred) => leads.filter(pred).length;
  const booked = count((l) => l.status === "booked"), notReachable = count((l) => l.status === "not reachable"), pending = count((l) => l.status === "pending");
  const notBooked = n - booked - notReachable - pending;
  const resp = leads.map((l) => l.respMin).filter((x) => x != null);
  const buckets = [["0–5 min", 0, 5], ["6–15 min", 6, 15], ["16–30 min", 16, 30], ["31–60 min", 31, 60], ["1–3 h", 61, 180], ["3 h+", 181, 1e9]].map(([label, a, b]) => { const ls = leads.filter((l) => l.respMin != null && l.respMin >= a && l.respMin <= b); return { label, n: ls.length, booked: ls.filter((l) => l.status === "booked").length, pct: div(ls.filter((l) => l.status === "booked").length, ls.length) }; });
  const untouched = leads.filter((l) => l.respMin == null && l.status === "pending").length;
  const reasonMap = new Map();
  for (const l of leads) { if (l.status === "booked") continue; const r = l.reason || (l.status === "pending" ? "Pending — not yet called" : "No reason logged"); reasonMap.set(r, (reasonMap.get(r) || 0) + 1); }
  const reasons = [...reasonMap.entries()].map(([reason, k]) => ({ reason, n: k, pct: div(k, n - booked) })).sort((a, b) => b.n - a.n);
  const deptMap = new Map();
  for (const l of leads) { let d = deptMap.get(l.dept); if (!d) { d = { dept: l.dept, specialty: specialtyOfDept(l.dept), leads: 0, booked: 0, notReachable: 0, info: 0 }; deptMap.set(l.dept, d); } d.leads++; if (l.status === "booked") d.booked++; if (l.status === "not reachable") d.notReachable++; if (/information|treatment details/i.test(l.reason)) d.info++; }
  const depts = [...deptMap.values()].map((d) => { const s = specialties.find((x) => x.name === d.specialty); return { ...d, pct: div(d.booked, d.leads), spend: s ? s.spend : null, costPerBooking: s && d.booked ? s.spend / d.booked : null, costPerLead: s && d.leads ? s.spend / d.leads : null }; }).sort((a, b) => b.leads - a.leads);
  const hours = Array.from({ length: 24 }, (_, h) => ({ h, n: 0, booked: 0 }));
  const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => ({ d, n: 0, booked: 0 }));
  for (const l of leads) { if (!l.created || l.created.length < 16) continue; const h = +l.created.slice(11, 13); hours[h].n++; if (l.status === "booked") hours[h].booked++; const wd = (new Date(l.created.slice(0, 10) + "T00:00:00").getDay() + 6) % 7; weekdays[wd].n++; if (l.status === "booked") weekdays[wd].booked++; }
  const slots = [["Night 00–08", 0, 7], ["Morning 08–12", 8, 11], ["Afternoon 12–16", 12, 15], ["Evening 16–20", 16, 19], ["Late 20–24", 20, 23]].map(([label, a, b]) => { let k = 0, bk = 0; for (let h = a; h <= b; h++) { k += hours[h].n; bk += hours[h].booked; } return { label, n: k, booked: bk, pct: div(bk, k) }; });
  const priority = ["High", "Medium", "Low"].map((p) => { const ls = leads.filter((l) => l.priority === p); return { p, n: ls.length, booked: ls.filter((l) => l.status === "booked").length }; }).filter((x) => x.n);
  let agents = null;
  if (leads.some((l) => l.agent != null)) {
    const am = new Map();
    for (const l of leads) { const a = l.agent || "(Unassigned)"; let o = am.get(a); if (!o) { o = { agent: a, leads: 0, booked: 0, resp: [] }; am.set(a, o); } o.leads++; if (l.status === "booked") o.booked++; if (l.respMin != null) o.resp.push(l.respMin); }
    agents = [...am.values()].map((o) => ({ agent: o.agent, leads: o.leads, booked: o.booked, pct: div(o.booked, o.leads), medianResp: median(o.resp) })).sort((a, b) => b.leads - a.leads);
  }
  const doctorChosen = count((l) => l.doctor), doctorBooked = count((l) => l.doctor && l.status === "booked");
  const infoSeekers = count((l) => /information|treatment details/i.test(l.reason));
  return { leads: n, booked, notBooked, notReachable, pending, bookingPct: div(booked, n), reachedPct: n - notReachable - pending > 0 ? booked / (n - notReachable - pending) : null,
    costPerBooking: booked ? totals.spend / booked : null, costPerLead: n ? totals.spend / n : null, medianResp: median(resp), respBuckets: buckets, untouched, reasons, depts, hours, weekdays, slots, priority, agents,
    infoSeekers, infoPct: div(infoSeekers, n), doctorChosen, doctorChosenPct: div(doctorChosen, n), doctorBookedPct: div(doctorBooked, doctorChosen),
    notReachablePct: div(notReachable, n), duplicates: count((l) => /duplicate/i.test(l.reason)), insuranceIssues: count((l) => /insurance/i.test(l.reason)), doctorUnavailable: count((l) => /doctor is unavailable|treatment not available/i.test(l.reason)) };
}
