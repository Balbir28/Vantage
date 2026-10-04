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
  // ---- 9b. the strategist's layer ----
  const tracking = campaigns.filter((c) => c.clicks >= 80 && c.conv < 0.5);
  if (tracking.length) push(out, { sev: "critical", scope: "measurement", title: `${tracking.length} campaign${tracking.length > 1 ? "s" : ""} with ${fmtNum(tracking.reduce((s, c) => s + c.clicks, 0))} clicks and no conversions — check tracking before touching bids`, detail: tracking.slice(0, 4).map((c) => `${c.name} (${c.clicks} clicks)`).join(" · "), action: "Verify the conversion tag fires on these landing pages (GTM preview + Google Ads diagnostics). Zero conversions at this click volume is more often a measurement gap than a demand gap; Smart Bidding on broken data will spend blind.", impact: tracking.reduce((s, c) => s + c.spend, 0), entities: tracking.map((c) => c.name) });
  const scaleSet = campaigns.filter((c) => c.status === "scale" && c.conv >= 5);
  if (scaleSet.length) push(out, { sev: "info", scope: "bidding", title: `${scaleSet.length} campaigns are ready for Target CPA bidding`, detail: `Each has 5+ conversions in the period and a CPL under the network median (${fmtAED(netCpl)}). Suggested tCPA ≈ 1.1× current CPL to buy the lost rank share without a CPL shock.`, action: `Move them to tCPA (or a portfolio strategy per specialty); set the target 10% above today's CPL, lift budgets 20–30%, and review after 2 weeks of learning.`, impact: null, entities: scaleSet.map((c) => c.name) });
  const callHeavy = t.calls && t.conv ? t.calls / (t.calls + t.conv) : null;
  if (callHeavy != null && callHeavy >= 0.8) push(out, { sev: "info", scope: "structure", title: `${fmtPct(callHeavy, 0)} of all leads arrive as calls — the account is a call business`, detail: `${fmtNum(t.calls)} click-to-calls vs ${fmtNum(t.conv)} form conversions. Form CPL alone undervalues the campaigns that drive calls.`, action: "Import calls as conversions (call extension + GA4 call-click), judge campaigns on blended cost per lead, and test call-only ads with ad-schedule bids on the call centre's staffed hours.", impact: null });
  const spec = view.specialties.filter((x) => x.conv >= 8 && x.spend >= 2000);
  if (spec.length >= 3) { const bySp = spec.slice().sort((a, b) => a.cpl - b.cpl); const lo = bySp[0], hi = bySp[bySp.length - 1]; if (hi.cpl >= 2.5 * lo.cpl) push(out, { sev: "info", scope: "budget", title: `Specialty CPL spread: ${lo.name} ${fmtAED(lo.cpl)} vs ${hi.name} ${fmtAED(hi.cpl)}`, detail: `A ${(hi.cpl / lo.cpl).toFixed(1)}× gap between specialties on comparable spend.`, action: `Set specialty-level CPA targets instead of one account target; fund ${lo.name} to its impression-share ceiling before adding to ${hi.name}, and judge ${hi.name} on cost per booking and appointment value.`, impact: null }); }
  const highIsLowConv = centres.filter((c) => (c.is || 0) >= 0.5 && c.conv >= 1 && centreCplMed && c.cpl >= 1.5 * centreCplMed);
  for (const c of highIsLowConv.slice(0, 2)) push(out, { sev: "warn", scope: "structure", title: `${c.short} already owns ${fmtPct(c.is, 0)} impression share but converts expensively`, detail: `CPL ${fmtAED(c.cpl)}. More budget will not help — the auction is won; the page or the offer is losing.`, action: "Stop bidding up. Fix landing page speed, form length, trust signals (doctor profiles, insurance list) and test a WhatsApp CTA; add negatives from the search-terms report.", impact: null, entity: c.name });

  // ---- 10. impression share ----
  if (t.is != null && t.is < 0.35 && t.lostIs >= 0.4) push(out, { sev: "info", scope: "account", title: `Only ${fmtPct(t.is, 0)} impression share — ${fmtPct(t.lostIs, 0)} lost to rank`, detail: "Rank losses come from bids and Quality Score, not budget.", action: "Prioritise QS fixes and bid increases on the 'Scale' set; budget-driven losses are secondary here.", impact: null });

  out.sort((a, b) => SEV_RANK[a.sev] - SEV_RANK[b.sev] || (b.impact || 0) - (a.impact || 0));
  return out.map((o, i) => ({ id: "i" + i, ...o }));
}

/** Structured executive read: rows of {group, label, value, note, tone}. */
export function executiveRows(view, insights) {
  const { totals: t, crm, accounts, centres, kwStats } = view, R = [];
  const row = (group, label, value, note = "", tone = "") => R.push({ group, label, value, note, tone });
  row("Media", "Spend", fmtAED(t.spend), t.budget ? `${fmtPct(t.pacing, 0)} of ${fmtAED(t.budget)} pro-rated budget` : "no budget loaded", t.budget ? (t.pacing < 0.85 ? "warn" : t.pacing > 1.1 ? "bad" : "good") : "");
  row("Media", "Form conversions", fmtNum(t.conv), `CPL ${fmtAED(t.cpl)}`);
  row("Media", "Click-to-calls", t.calls == null ? "—" : fmtNum(t.calls), t.calls ? `${fmtAED(t.costPerCall)} per call${view.flags.callsEstimated ? " (est.)" : ""}` : "add the call columns");
  row("Media", "Impression share", fmtPct(t.is, 0), `${fmtPct(t.lostIs, 0)} lost to rank · CTR ${fmtPct(t.ctr, 1)} · CPC ${fmtAED(t.cpc)}`);
  if (crm.leads) {
    row("Call centre", "Leads logged", fmtNum(crm.leads), `${fmtNum(crm.leads / view.period.days, 1)} per day`);
    row("Call centre", "Booked", fmtNum(crm.booked), `${fmtPct(crm.bookingPct, 0)} booking · ${fmtPct(crm.reachedPct, 0)} when reached`, crm.bookingPct >= 0.45 ? "good" : crm.bookingPct < 0.35 ? "bad" : "");
    row("Call centre", "Cost per booking", fmtAED(crm.costPerBooking), `cost per lead ${fmtAED(crm.costPerLead)}`);
    row("Call centre", "Not reachable", fmtPct(crm.notReachablePct, 0), `median first call ${fmtMin(crm.medianResp)} · ${crm.untouched} uncalled`, crm.notReachablePct >= 0.25 ? "bad" : "");
  }
  const inScope = accounts.filter((a) => a.inScope && a.conv >= 3);
  if (inScope.length > 1) { const best = inScope.slice().sort((a, b) => a.cpl - b.cpl)[0], worst = inScope.slice().sort((a, b) => b.cpl - a.cpl)[0]; row("Read", "Most efficient", best.name, `CPL ${fmtAED(best.cpl)} · cost per booking ${fmtAED(best.costPerBooking)}`, "good"); row("Read", "Most expensive", worst.name, `CPL ${fmtAED(worst.cpl)} · cost per booking ${fmtAED(worst.costPerBooking)}`, "bad"); }
  const risk = centres.filter((c) => c.healthBand === "risk" && c.spend >= 1000).sort((a, b) => b.spend - a.spend);
  row("Read", "Centres at risk", risk.length ? String(risk.length) : "none", risk.slice(0, 5).map((c) => c.short).join(", "), risk.length ? "warn" : "good");
  const scale = view.campaigns.filter((c) => c.status === "scale").length, fix = view.campaigns.filter((c) => c.status === "fix").length, pause = view.campaigns.filter((c) => c.status === "pause").length;
  row("Read", "Campaign calls", `${scale} scale · ${fix} fix · ${pause} pause`, `of ${view.campaigns.length} campaigns`);
  if (kwStats.totalCost) row("Read", "Keyword waste", fmtAED(kwStats.wastedTotal), `${fmtPct(kwStats.wastedTotal / kwStats.totalCost, 0)} of spend · ${kwStats.wastedCount} keywords${kwStats.approx ? " (whole weeks)" : ""}`, kwStats.wastedTotal / kwStats.totalCost >= 0.35 ? "bad" : "warn");
  return R;
}

/** Budget reallocation plan: free money from pause/fix campaigns, fund scale campaigns to their ceilings. */
export function reallocationPlan(view) {
  const med = view.baseline.cplMedian; if (!med) return null;
  const donors = view.campaigns.filter((c) => c.status === "pause" || (c.status === "fix" && c.spend >= 500)).map((c) => ({ ...c, free: c.status === "pause" ? c.spend : Math.round(c.spend * 0.4) })).sort((a, b) => b.free - a.free);
  // a receiver can absorb at most 1.5× its current spend in one step, and no more than its lost rank share converts
  const receivers = view.campaigns.filter((c) => c.status === "scale" && c.conv >= 3).map((c) => { const ceiling = (c.lost || 0) * (c.ctr || 0) * (c.convRate || 0); const room = Math.min(ceiling * c.cpl * 1.1, c.spend * 1.5); const extraConv = room / (c.cpl * 1.1); return { ...c, extraConv, room }; }).filter((c) => c.room >= 200).sort((a, b) => a.cpl - b.cpl);
  let pool = donors.reduce((s, d) => s + d.free, 0);
  const moves = [];
  for (const r of receivers) { if (pool <= 100) break; const amt = Math.min(pool, r.room); const conv = amt / (r.cpl * 1.1); moves.push({ to: r.name, centre: r.centre, specialty: r.specialty, amount: Math.round(amt), cpl: r.cpl, expectedConv: conv, lostIs: r.lostIs }); pool -= amt; }
  const totalFreed = donors.reduce((s, d) => s + d.free, 0), totalMoved = moves.reduce((s, m) => s + m.amount, 0), totalConv = moves.reduce((s, m) => s + m.expectedConv, 0);
  const lostConv = donors.reduce((s, d) => s + (d.status === "pause" ? 0 : d.conv * 0.4), 0);
  return { donors, moves, totalFreed, totalMoved, totalConv, lostConv, unallocated: Math.max(0, totalFreed - totalMoved), netConv: totalConv - lostConv, currentCpl: view.totals.cpl, projectedCpl: view.totals.spend && (view.totals.conv + totalConv - lostConv) > 0 ? view.totals.spend / (view.totals.conv + totalConv - lostConv) : null };
}

/** The tactical playbook: findings grouped into the pillars a senior PPC lead reviews every week. */
export const PILLARS = [
  { key: "budget", label: "Budget & pacing", scopes: ["account", "budget", "centre"], icon: "M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" },
  { key: "bidding", label: "Bidding & impression share", scopes: ["bidding", "campaign"], icon: "M3 17l6-6 4 4 8-8M14 7h7v7" },
  { key: "structure", label: "Structure, keywords & match types", scopes: ["keyword", "structure"], icon: "M4 7h16M4 12h10M4 17h7" },
  { key: "landing", label: "Landing pages & offer", scopes: ["landing"], icon: "M4 4h16v16H4zM4 9h16M9 9v11" },
  { key: "crm", label: "Call centre & lead handling", scopes: ["crm"], icon: "M5 4h4l2 5-3 2a11 11 0 0 0 6 6l2-3 5 2v4a2 2 0 0 1-2 2A17 17 0 0 1 3 6a2 2 0 0 1 2-2" },
  { key: "measurement", label: "Measurement & trend", scopes: ["measurement", "trend"], icon: "M3 3v18h18M7 14l4-4 4 4 5-6" },
];
export function playbook(insights) {
  const used = new Set();
  // landing-page pillar first: it is derived from wording (info-only leads, page relevance, high IS but weak conversion)
  const landingItems = insights.filter((i) => /landing page|information|page content|relevance|the page or the offer/i.test(i.action + " " + i.title)).slice(0, 5);
  landingItems.forEach((i) => used.add(i.id));
  return PILLARS.map((p) => p.key === "landing" ? { ...p, items: landingItems } : { ...p, items: insights.filter((i) => p.scopes.includes(i.scope) && !used.has(i.id)).slice(0, 5).map((i) => { used.add(i.id); return i; }) });
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
