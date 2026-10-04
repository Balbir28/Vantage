// ============================================================
//  INSIGHTS — the performance-marketer brain. Every rule reads the
//  computed view and emits a ranked, evidence-backed action. Severity:
//  critical (money burning) › warn (fixable drag) › good (scale it) › info.
// ============================================================
import { fmtAED, fmtPct, fmtNum, fmtMin, fmtDelta } from "./format.js";
import { median } from "./analytics.js";

const SEV_RANK = { critical: 0, warn: 1, good: 2, info: 3 };
const push = (list, o) => { if (o) list.push({ impact: null, ...o }); };

export function generateInsights(view) {
  const out = [];
  const { totals: t, centres, campaigns, accounts, kwStats, trend, crm, period } = view;
  const netCpl = view.baseline.cplMedian;
  const centreCplMed = median(centres.filter((c) => c.conv >= 1 && c.spend >= 200).map((c) => c.cpl));
  const netBooking = t.bookingPct;

  // ---- 1. budget pacing ----
  if (t.budget) {
    const expected = t.budget; // budget is already pro-rated to the range
    const gap = t.spend - expected, g = gap / expected;
    if (g <= -0.15) push(out, { sev: "warn", scope: "account", title: `Under-delivering: ${fmtAED(-gap)} of the ${period.label.includes("MTD") ? "monthly" : "period"} budget is unspent`, detail: `Spend is ${fmtPct(t.pacing, 0)} of the pro-rated budget (${fmtAED(t.spend)} of ${fmtAED(expected)}). Unspent money is unbought demand.`, action: "Lift daily budgets on 'Scale' campaigns first; check 'Limited by budget' status and bid caps.", impact: -gap });
    else if (g >= 0.1) push(out, { sev: "critical", scope: "account", title: `Overspending: ${fmtAED(gap)} (${fmtDelta(g, 0)}) above the pro-rated budget`, detail: `${fmtAED(t.spend)} spent against ${fmtAED(expected)} for this period.`, action: "Cap daily budgets on the over-pacing centres below and re-forecast month-end.", impact: gap });
    const over = centres.filter((c) => c.budget && c.spend / c.budget >= 1.15 && c.spend > 500).sort((a, b) => b.spend - b.budget - (a.spend - a.budget));
    for (const c of over.slice(0, 3)) push(out, { sev: "warn", scope: "centre", entity: c.name, title: `${c.short} is ${fmtPct(c.pacing - 1, 0)} over budget`, detail: `${fmtAED(c.spend)} spent vs ${fmtAED(c.budget)} pro-rated. CPL ${fmtAED(c.cpl)}${centreCplMed ? ` vs network ${fmtAED(centreCplMed)}` : ""}.`, action: c.cpl && centreCplMed && c.cpl < centreCplMed ? "Efficient centre — consider moving budget here formally rather than capping." : "Reduce daily budgets or tighten bids until CPL recovers.", impact: c.spend - c.budget });
    const under = centres.filter((c) => c.budget >= 1000 && c.spend / c.budget <= 0.6).sort((a, b) => (b.budget - b.spend) - (a.budget - a.spend));
    for (const c of under.slice(0, 3)) push(out, { sev: "warn", scope: "centre", entity: c.name, title: `${c.short} spent only ${fmtPct(c.pacing, 0)} of its budget`, detail: `${fmtAED(c.budget - c.spend)} left unspent. ${c.lostIs != null ? `${fmtPct(c.lostIs, 0)} of impression share is lost to rank, so demand exists.` : ""}`, action: c.campaigns ? "Raise bids/budgets on its best campaigns, or expand keyword coverage." : "No active campaigns found for this centre — check the Centre List mapping.", impact: c.budget - c.spend });
  }

  // ---- 2. campaigns burning money ----
  const pause = campaigns.filter((c) => c.status === "pause");
  if (pause.length) { const amt = pause.reduce((s, c) => s + c.spend, 0); push(out, { sev: "critical", scope: "campaign", title: `${fmtAED(amt)} spent on ${pause.length} campaign${pause.length > 1 ? "s" : ""} with zero conversions`, detail: pause.slice(0, 4).map((c) => `${c.name} (${fmtAED(c.spend)}, ${fmtNum(c.clicks)} clicks)`).join(" · "), action: "Pause or rebuild: check conversion tracking first (0 conversions on hundreds of clicks is often a broken tag), then landing page and keyword intent.", impact: amt, entities: pause.map((c) => c.name) }); }
  const fix = campaigns.filter((c) => c.status === "fix" && c.spend >= 500).sort((a, b) => (b.spend - b.conv * (netCpl || 0)) - (a.spend - a.conv * (netCpl || 0)));
  if (fix.length && netCpl) { const excess = fix.reduce((s, c) => s + Math.max(0, c.spend - c.conv * netCpl), 0); push(out, { sev: "critical", scope: "campaign", title: `${fix.length} campaigns run at 1.8×+ the network CPL — ${fmtAED(excess)} of excess cost`, detail: fix.slice(0, 4).map((c) => `${c.name}: ${fmtAED(c.cpl)} CPL on ${fmtAED(c.spend)}`).join(" · "), action: "Audit search terms, add negatives, tighten match types, and compare landing pages against the efficient twins of these campaigns.", impact: excess, entities: fix.map((c) => c.name) }); }

  // ---- 3. scale winners ----
  const scale = campaigns.filter((c) => c.status === "scale").sort((a, b) => b.lost - a.lost);
  if (scale.length) { const extra = scale.reduce((s, c) => s + (c.lost || 0) * (c.ctr || 0) * (c.convRate || 0), 0); push(out, { sev: "good", scope: "campaign", title: `${scale.length} campaigns are cheap and capped — ~${fmtNum(extra)} more leads available at today's CPL`, detail: scale.slice(0, 4).map((c) => `${c.name}: ${fmtAED(c.cpl)} CPL, ${fmtPct(c.lostIs, 0)} IS lost to rank`).join(" · "), action: "Raise bids / target-CPA and daily budgets on these first — this is the cheapest growth in the account.", impact: extra * (netCpl || 0), entities: scale.map((c) => c.name) }); }

  // ---- 4. centre CPL outliers & CPC ----
  if (centreCplMed) for (const c of centres.filter((c) => c.conv >= 1 && c.spend >= 1000 && c.cpl >= 2 * centreCplMed).slice(0, 4)) push(out, { sev: "critical", scope: "centre", entity: c.name, title: `${c.short}: CPL ${fmtAED(c.cpl)} is ${(c.cpl / centreCplMed).toFixed(1)}× the network`, detail: `${fmtAED(c.spend)} for ${fmtNum(c.conv)} form conversions${c.calls ? ` and ${fmtNum(c.calls)} calls` : ""}. CPC ${fmtAED(c.cpc)} vs network ${fmtAED(t.cpc)}.`, action: c.cpc > 2.5 * t.cpc ? "The auction is expensive here — narrow to high-intent terms, review location/radius targeting and ad schedule; judge on cost per booking, not CPL alone." : "Conversion is the issue, not clicks — review landing page, form friction and keyword intent.", impact: c.spend - c.conv * centreCplMed });
  // ---- 5. headroom ----
  for (const c of centres.filter((c) => c.conv >= 3 && centreCplMed && c.cpl <= 0.8 * centreCplMed && (c.lostIs || 0) >= 0.4).slice(0, 3)) push(out, { sev: "good", scope: "centre", entity: c.name, title: `${c.short} has headroom: CPL ${fmtAED(c.cpl)} with ${fmtPct(c.lostIs, 0)} share lost to rank`, detail: `Impression share ${fmtPct(c.is, 0)}. Booking rate ${fmtPct(c.bookingPct, 0)}.`, action: "Shift budget here from the over-CPL centres; bids up 15–20% and watch CPL weekly.", impact: c.lost * (c.ctr || 0) * (c.convRate || 0) * (centreCplMed || 0) });

  // ---- 6. call-centre conversion ----
  if (crm.leads >= 20) {
    const weak = centres.filter((c) => c.crmLeads >= 10 && netBooking && c.bookingPct <= netBooking - 0.1).sort((a, b) => a.bookingPct - b.bookingPct);
    for (const c of weak.slice(0, 3)) push(out, { sev: "warn", scope: "crm", entity: c.name, title: `${c.short} books only ${fmtPct(c.bookingPct, 0)} of leads (network ${fmtPct(netBooking, 0)})`, detail: `${c.booked} of ${c.crmLeads} booked · ${c.notReachable} not reachable · cost per booking ${fmtAED(c.costPerBooking)}.`, action: c.notReachablePct >= 0.33 ? "A third of leads are never reached — add a second call attempt within the hour and a WhatsApp follow-up." : "Media is delivering; the call centre is leaking. Review scripts and doctor availability for this centre.", impact: (netBooking - c.bookingPct) * c.crmLeads * (c.costPerBooking || 0) });
    if (crm.notReachablePct >= 0.25) push(out, { sev: "warn", scope: "crm", title: `${fmtPct(crm.notReachablePct, 0)} of leads were never reached`, detail: `${crm.notReachable + crm.reasons.filter((r) => /no answer|phone is off|invalid/i.test(r.reason)).reduce((s, r) => s + r.n, 0)} leads ended as not reachable / no answer / phone off. Speed-to-lead median: ${fmtMin(crm.medianResp)}.`, action: "Call within 5 minutes (booking rate is highest there), retry at a different time of day, and add WhatsApp/SMS fallback.", impact: crm.notReachable * (crm.costPerLead || 0) });
    if (crm.medianResp != null && crm.medianResp > 60) push(out, { sev: "warn", scope: "crm", title: `Median first call takes ${fmtMin(crm.medianResp)}`, detail: "Leads called within 5 minutes convert far better than those called after an hour.", action: "Set a 5-minute first-call SLA with queue alerts; prioritise paid leads.", impact: null });
    const fast = crm.respBuckets[0], slow = crm.respBuckets.slice(3).reduce((a, b) => ({ n: a.n + b.n, booked: a.booked + b.booked }), { n: 0, booked: 0 });
    if (fast.n >= 10 && slow.n >= 10 && fast.pct != null) push(out, { sev: "info", scope: "crm", title: `Speed to lead: ${fmtPct(fast.pct, 0)} booking when called in 5 min vs ${fmtPct(slow.booked / slow.n, 0)} after 30 min`, detail: `${fast.n} leads called within 5 minutes; ${slow.n} called after 30 minutes.`, action: "Every minute of delay costs bookings — staff the queue to the daily call peaks shown in Leads & CRM.", impact: null });
    if (crm.infoPct >= 0.15) push(out, { sev: "info", scope: "crm", title: `${fmtPct(crm.infoPct, 0)} of leads were only asking for information`, detail: `${crm.infoSeekers} leads logged as information-only. These are real intent signals arriving too early in the journey.`, action: "Put price ranges, insurance accepted and doctor availability on the landing page; script a soft-book offer for info callers.", impact: crm.infoSeekers * (crm.costPerLead || 0) });
    if (crm.untouched >= 5) push(out, { sev: "warn", scope: "crm", title: `${crm.untouched} paid leads are still pending and uncalled`, detail: "Pending leads with no response time logged.", action: "Clear the queue today — paid leads decay within 24 hours.", impact: crm.untouched * (crm.costPerLead || 0) });
    if (crm.doctorUnavailable >= 5) push(out, { sev: "info", scope: "crm", title: `${crm.doctorUnavailable} leads lost because the doctor/treatment was unavailable`, detail: "Demand was created for appointments that could not be given.", action: "Sync campaign schedules with doctor rosters; pause specialty campaigns during leave.", impact: crm.doctorUnavailable * (crm.costPerLead || 0) });
    const weakDept = crm.depts.filter((d) => d.leads >= 15 && netBooking && d.pct <= netBooking - 0.15);
    for (const d of weakDept.slice(0, 2)) push(out, { sev: "warn", scope: "crm", title: `${d.dept}: ${fmtPct(d.pct, 0)} booking rate on ${d.leads} leads`, detail: `${d.notReachable} not reachable · ${d.info} info-only${d.costPerBooking ? ` · cost per booking ${fmtAED(d.costPerBooking)}` : ""}.`, action: "Check doctor availability and slot supply for this department before adding media spend.", impact: null });
    const best = crm.slots.filter((s) => s.n >= 20).sort((a, b) => b.pct - a.pct)[0], worst = crm.slots.filter((s) => s.n >= 20).sort((a, b) => a.pct - b.pct)[0];
    if (best && worst && best !== worst && best.pct - worst.pct >= 0.12) push(out, { sev: "info", scope: "crm", title: `Leads created in the ${best.label.split(" ")[0].toLowerCase()} book at ${fmtPct(best.pct, 0)} vs ${fmtPct(worst.pct, 0)} ${worst.label.split(" ")[0].toLowerCase()}`, detail: `${best.n} vs ${worst.n} leads. Low slots usually mean nobody is answering, not weaker intent.`, action: "Match call-centre staffing to these windows, or shift ad schedule bid adjustments toward the strong slot.", impact: null });
  }

  // ---- 7. keywords ----
  if (kwStats.totalCost > 0) {
    const share = kwStats.wastedTotal / kwStats.totalCost;
    if (kwStats.wastedTotal >= 500) push(out, { sev: share >= 0.35 ? "critical" : "warn", scope: "keyword", title: `${fmtAED(kwStats.wastedTotal)} (${fmtPct(share, 0)} of spend) went to ${kwStats.wastedCount} keywords with no conversions`, detail: kwStats.wasted.slice(0, 4).map((k) => `“${k.kw}” ${fmtAED(k.cost)}`).join(" · "), action: "Pause the top wasters, pull their search terms into negatives, and move budget to proven keywords.", impact: kwStats.wastedTotal });
    const broad = kwStats.matchTypes.find((m) => /broad/i.test(m.match)), phrase = kwStats.matchTypes.find((m) => /phrase/i.test(m.match));
    if (broad && phrase && broad.cost >= 500 && broad.cpl && phrase.cpl && broad.cpl >= 1.8 * phrase.cpl) push(out, { sev: "warn", scope: "keyword", title: `Broad match CPL ${fmtAED(broad.cpl)} vs phrase ${fmtAED(phrase.cpl)}`, detail: `${fmtAED(broad.cost)} on broad match (${fmtPct(broad.share, 0)} of spend).`, action: "Restrict broad match to campaigns with Smart Bidding and enough conversions; add negatives from the search-terms report.", impact: broad.cost - broad.conv * phrase.cpl });
    const low = kwStats.qsBands[0];
    if (low.share >= 0.12 && low.cost >= 500) push(out, { sev: "warn", scope: "keyword", title: `${fmtPct(low.share, 0)} of spend sits on Quality Score 1–3 keywords`, detail: `${fmtAED(low.cost)} on ${low.n} low-QS keywords. Low QS means higher CPC for the same position.`, action: "Rewrite ad copy to mirror the keyword, tighten ad groups (SKAGs for top terms) and fix landing-page relevance.", impact: low.cost * 0.3 });
  }

  // ---- 8. trend ----
  const wk = trend.weekly.filter((w) => w.days >= 5);
  if (wk.length >= 2) {
    const a = wk[wk.length - 2], b = wk[wk.length - 1];
    if (b.wow?.cpl != null && b.wow.cpl >= 0.2 && b.conv >= 10) push(out, { sev: "warn", scope: "trend", title: `CPL rose ${fmtDelta(b.wow.cpl, 0)} in ${b.label}`, detail: `${fmtAED(a.cpl)} → ${fmtAED(b.cpl)}${b.note ? ` · note: ${b.note}` : ""}`, action: "Compare the campaign mix week over week — a CPL jump with flat spend is usually a few campaigns, not the market.", impact: (b.cpl - a.cpl) * b.conv });
    if (b.wow?.cpl != null && b.wow.cpl <= -0.2 && b.conv >= 10) push(out, { sev: "good", scope: "trend", title: `CPL improved ${fmtDelta(b.wow.cpl, 0)} in ${b.label}`, detail: `${fmtAED(a.cpl)} → ${fmtAED(b.cpl)}${b.note ? ` · note: ${b.note}` : ""}`, action: "Lock in what changed; scale the campaigns that drove it.", impact: null });
    if (b.wow?.calls != null && Math.abs(b.wow.calls) >= 0.25 && b.calls) push(out, { sev: b.wow.calls > 0 ? "good" : "warn", scope: "trend", title: `Calls per day ${b.wow.calls > 0 ? "up" : "down"} ${fmtDelta(b.wow.calls, 0)} week over week`, detail: `${fmtNum(b.calls / b.days, 0)} calls/day in ${b.label} vs ${fmtNum(a.calls / a.days, 0)} the week before.`, action: b.wow.calls > 0 ? "Keep call extensions and call-only ads funded; check the call centre can absorb the volume." : "Check call extension status, ad schedule and whether budget shifted away from call-heavy campaigns.", impact: null });
    for (const w of trend.weekly) if (w.note) push(out, { sev: "info", scope: "trend", title: `${w.label}: ${w.note}`, detail: "Annotation from the reporting sheet.", action: "Read the following week's CPL and impression share against this change.", impact: null });
  }

  // ---- 9. account view ----
  const accIn = accounts.filter((a) => a.inScope && a.spend > 0);
  if (accIn.length > 1) {
    const sorted = accIn.filter((a) => a.conv >= 5).sort((a, b) => a.cpl - b.cpl);
    if (sorted.length >= 2) { const lo = sorted[0], hi = sorted[sorted.length - 1]; if (hi.cpl >= 2 * lo.cpl) push(out, { sev: "info", scope: "account", title: `${hi.name} CPL ${fmtAED(hi.cpl)} vs ${lo.name} ${fmtAED(lo.cpl)}`, detail: `Cost per booking: ${fmtAED(hi.costPerBooking)} vs ${fmtAED(lo.costPerBooking)}. Spend share ${fmtPct(hi.share, 0)} vs ${fmtPct(lo.share, 0)}.`, action: "Budgets should follow cost per booking across accounts, not historic allocations.", impact: null }); }
  }
  // ---- 10. impression share ----
  if (t.is != null && t.is < 0.35 && t.lostIs >= 0.4) push(out, { sev: "info", scope: "account", title: `Only ${fmtPct(t.is, 0)} impression share — ${fmtPct(t.lostIs, 0)} lost to rank`, detail: "Rank losses come from bids and Quality Score, not budget.", action: "Prioritise QS fixes and bid increases on the 'Scale' set; budget-driven losses are secondary here.", impact: null });

  out.sort((a, b) => SEV_RANK[a.sev] - SEV_RANK[b.sev] || (b.impact || 0) - (a.impact || 0));
  return out.map((o, i) => ({ id: "i" + i, ...o }));
}

export function executiveSummary(view, insights) {
  const { totals: t, period, crm, accounts, centres } = view;
  const s = [];
  s.push(`${view.scopeLabel}: ${fmtAED(t.spend)} spent${t.budget ? ` (${fmtPct(t.pacing, 0)} of the pro-rated budget)` : ""} for ${fmtNum(t.conv)} form conversions${t.calls ? ` and ${fmtNum(t.calls)} click-to-calls` : ""}, a CPL of ${fmtAED(t.cpl)}${t.costPerCall ? ` and ${fmtAED(t.costPerCall)} per call` : ""}.`);
  if (crm.leads) s.push(`The call centre logged ${fmtNum(crm.leads)} leads and booked ${fmtNum(crm.booked)} (${fmtPct(crm.bookingPct, 0)}; ${fmtPct(crm.reachedPct, 0)} of those reached), putting cost per booking at ${fmtAED(crm.costPerBooking)}.`);
  const inScope = accounts.filter((a) => a.inScope && a.conv >= 3);
  if (inScope.length > 1) { const best = inScope.slice().sort((a, b) => a.cpl - b.cpl)[0], worst = inScope.slice().sort((a, b) => b.cpl - a.cpl)[0]; s.push(`${best.name} is the most efficient account (CPL ${fmtAED(best.cpl)}); ${worst.name} is the most expensive (${fmtAED(worst.cpl)}).`); }
  const risk = centres.filter((c) => c.healthBand === "risk" && c.spend >= 1000).sort((a, b) => b.spend - a.spend);
  if (risk.length) s.push(`${risk.length} centre${risk.length > 1 ? "s" : ""} need attention: ${risk.slice(0, 3).map((c) => c.short).join(", ")}.`);
  const top = insights.filter((i) => i.sev === "critical" || i.sev === "good").slice(0, 2);
  if (top.length) s.push(`Biggest levers: ${top.map((i) => i.title.replace(/\.$/, "")).join("; ")}.`);
  return s.join(" ");
}
