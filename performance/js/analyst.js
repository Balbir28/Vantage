// ============================================================
//  ANALYST — the chat brain. Two layers:
//   1. A local intent engine that answers from the computed view with real
//      numbers (works offline, no key, instant).
//   2. An optional LLM (Gemini or Claude, bring-your-own-key, browser-direct)
//      that receives a compact "context pack" of the live numbers plus the
//      local engine's computed facts, and writes the narrative answer.
// ============================================================
import { fmtAED, fmtAEDc, fmtNum, fmtPct, fmtDelta, fmtMin, esc } from "./format.js";
import { ACCOUNTS, ACCOUNT_META } from "./parse.js";
import { shortCentre } from "./analytics.js";

const LS = "vp-ai";
export const AI = {
  load() { try { return JSON.parse(localStorage.getItem(LS) || "{}"); } catch (e) { return {}; } },
  save(o) { try { localStorage.setItem(LS, JSON.stringify(o)); } catch (e) {} },
  get provider() { return this.load().provider || "none"; },
  key(p) { const o = this.load(); if (p === "gemini") return o.keys?.gemini || (localStorage.getItem("vantage-gemini-key") || ""); return o.keys?.[p] || ""; },
  model(p) { const o = this.load(); return o.models?.[p] || (p === "gemini" ? "gemini-2.0-flash" : "claude-sonnet-5-5"); },
  set({ provider, keys, models }) { const o = this.load(); if (provider != null) o.provider = provider; o.keys = { ...(o.keys || {}), ...(keys || {}) }; o.models = { ...(o.models || {}), ...(models || {}) }; this.save(o); },
  get ready() { const p = this.provider; return p !== "none" && !!this.key(p); },
};

// ---------- markdown (tiny, safe) ----------
export function mdToHtml(md) {
  const lines = esc(md).replace(/\r/g, "").split("\n");
  let html = "", list = null, table = null;
  const inline = (s) => s.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<i>$2</i>").replace(/`([^`]+)`/g, "<code>$1</code>");
  const closeList = () => { if (list) { html += `</${list}>`; list = null; } };
  const closeTable = () => { if (table) { html += "</tbody></table>"; table = null; } };
  for (const raw of lines) {
    const l = raw.trimEnd();
    if (/^\s*\|.*\|\s*$/.test(l)) { const cells = l.trim().slice(1, -1).split("|").map((c) => c.trim()); if (cells.every((c) => /^:?-{2,}:?$/.test(c))) continue; closeList(); if (!table) { table = true; html += `<table><thead><tr>${cells.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead><tbody>`; } else html += `<tr>${cells.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`; continue; }
    closeTable();
    let m;
    if ((m = l.match(/^(#{1,4})\s+(.+)/))) { closeList(); html += `<h4>${inline(m[2])}</h4>`; continue; }
    if ((m = l.match(/^\s*[-*•]\s+(.+)/))) { if (list !== "ul") { closeList(); list = "ul"; html += "<ul>"; } html += `<li>${inline(m[1])}</li>`; continue; }
    if ((m = l.match(/^\s*\d+[.)]\s+(.+)/))) { if (list !== "ol") { closeList(); list = "ol"; html += "<ol>"; } html += `<li>${inline(m[1])}</li>`; continue; }
    closeList();
    if (!l.trim()) continue;
    html += `<p>${inline(l)}</p>`;
  }
  closeList(); closeTable();
  return html;
}

// ---------- context pack ----------
export function contextPack(ctx) {
  const { view: v, insights, summary, model } = ctx;
  const t = v.totals, L = [];
  L.push(`# Data: ${model.meta.title || "Paid performance"} — ${model.meta.period}, data to ${model.meta.dataUpTo}. Currency AED. Scope: ${v.scopeLabel}.`);
  L.push(`Definitions: CPL = spend ÷ Google Ads form conversions. Calls = call-extension taps + landing-page call taps (typed on the sheet). CRM leads/booked = call-centre export. Cost per booking = spend ÷ booked. IS = impression share; "lost (rank)" = share lost to ad rank (bids/quality), not budget. Health 0–100 blends CPL vs network, booking rate, pacing and IS.`);
  L.push(`\n## Totals\nSpend ${fmtAED(t.spend)}${t.budget ? ` of ${fmtAED(t.budget)} pro-rated budget (${fmtPct(t.pacing, 0)})` : ""} · impr ${fmtNum(t.impr)} · clicks ${fmtNum(t.clicks)} · CTR ${fmtPct(t.ctr)} · CPC ${fmtAED(t.cpc)} · form conv ${fmtNum(t.conv)} · CPL ${fmtAED(t.cpl)} · calls ${t.calls == null ? "n/a" : fmtNum(t.calls)} · cost/call ${fmtAED(t.costPerCall)} · IS ${fmtPct(t.is, 0)} lost-rank ${fmtPct(t.lostIs, 0)} · CRM leads ${t.crmLeads} booked ${t.booked} (${fmtPct(t.bookingPct, 0)}; ${fmtPct(t.reachedPct, 0)} when reached) · cost/booking ${fmtAED(t.costPerBooking)}.`);
  L.push(`\n## Executive summary\n${summary}`);
  L.push(`\n## Ad accounts\n| Account | Spend | Budget% | Conv | CPL | Calls | Cost/call | CRM leads | Booked | Booking% | Cost/booking | IS |\n|---|---|---|---|---|---|---|---|---|---|---|---|`);
  for (const a of v.accounts.filter((a) => a.inScope)) L.push(`| ${a.name} | ${fmtNum(a.spend)} | ${fmtPct(a.pacing, 0)} | ${fmtNum(a.conv)} | ${fmtNum(a.cpl)} | ${a.calls ?? "n/a"} | ${fmtNum(a.costPerCall)} | ${a.crmLeads} | ${a.booked} | ${fmtPct(a.bookingPct, 0)} | ${fmtNum(a.costPerBooking)} | ${fmtPct(a.is, 0)} |`);
  L.push(`\n## Centres (hospitals)\n| Centre | Account | Spend | Budget% | Conv | CPL | CPC | Calls | CRM leads | Booked | Booking% | Unreached% | Cost/booking | IS | Lost rank | Health |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|`);
  for (const c of v.centres) L.push(`| ${c.name} | ${ACCOUNT_META[c.account]?.short || c.account} | ${fmtNum(c.spend)} | ${fmtPct(c.pacing, 0)} | ${fmtNum(c.conv)} | ${fmtNum(c.cpl)} | ${fmtNum(c.cpc, 1)} | ${c.calls ?? "n/a"} | ${c.crmLeads} | ${c.booked} | ${fmtPct(c.bookingPct, 0)} | ${fmtPct(c.notReachablePct, 0)} | ${fmtNum(c.costPerBooking)} | ${fmtPct(c.is, 0)} | ${fmtPct(c.lostIs, 0)} | ${c.health} |`);
  L.push(`\n## Campaigns (network median CPL ${fmtAED(v.baseline.cplMedian)}; status: scale=cheap & capped by rank, fix=CPL ≥1.8× median, pause=spend with 0 conv, hold=normal, watch=too small)\n| Campaign | Centre | Specialty | Status | Spend | Clicks | CTR | Conv | CPL | IS | Lost rank |\n|---|---|---|---|---|---|---|---|---|---|---|`);
  const camps = v.campaigns.slice(0, 30).concat(v.campaigns.slice(30).filter((c) => c.status !== "hold" && c.status !== "watch"));
  for (const c of camps.slice(0, 60)) L.push(`| ${c.name} | ${shortCentre(c.centre)} | ${c.specialty} | ${c.status} | ${fmtNum(c.spend)} | ${c.clicks} | ${fmtPct(c.ctr)} | ${fmtNum(c.conv, 1)} | ${fmtNum(c.cpl)} | ${fmtPct(c.is, 0)} | ${fmtPct(c.lostIs, 0)} |`);
  L.push(`\n## Specialties\n| Specialty | Spend | Conv | CPL | CRM leads | Booked | Booking% | Cost/booking |\n|---|---|---|---|---|---|---|---|`);
  for (const s of v.specialties.slice(0, 20)) L.push(`| ${s.name} | ${fmtNum(s.spend)} | ${fmtNum(s.conv)} | ${fmtNum(s.cpl)} | ${s.crmLeads} | ${s.booked} | ${fmtPct(s.bookingPct, 0)} | ${fmtNum(s.costPerBooking)} |`);
  const k = v.kwStats;
  L.push(`\n## Keywords (month level)\nSpend with no conversions: ${fmtAED(k.wastedTotal)} across ${k.wastedCount} keywords (${fmtPct(k.wastedTotal / (k.totalCost || 1), 0)} of spend). Match types: ${k.matchTypes.map((m) => `${m.match} ${fmtAED(m.cost)} CPL ${fmtAED(m.cpl)}`).join("; ")}. QS bands: ${k.qsBands.map((b) => `${b.band} ${fmtAED(b.cost)} (${fmtPct(b.share, 0)})`).join("; ")}.\nTop wasters: ${k.wasted.slice(0, 12).map((x) => `"${x.kw}" [${x.match}, ${shortCentre(x.centre)}] ${fmtAED(x.cost)}/${x.clicks} clicks`).join("; ")}.\nWinners: ${k.winners.slice(0, 10).map((x) => `"${x.kw}" [${shortCentre(x.centre)}] ${fmtNum(x.conv, 1)} conv @ ${fmtAED(x.cpl)}`).join("; ")}.`);
  const c = v.crm;
  if (c.leads) L.push(`\n## Call centre (CRM)\nLeads ${c.leads}, booked ${c.booked} (${fmtPct(c.bookingPct, 0)}), not booked ${c.notBooked}, not reachable ${c.notReachable} (${fmtPct(c.notReachablePct, 0)}), pending ${c.pending} (uncalled ${c.untouched}). Median first call ${fmtMin(c.medianResp)}. Info-only ${c.infoSeekers} (${fmtPct(c.infoPct, 0)}). Duplicates ${c.duplicates}, insurance issues ${c.insuranceIssues}, doctor unavailable ${c.doctorUnavailable}.\nSpeed-to-lead buckets: ${c.respBuckets.map((b) => `${b.label}: ${b.n} leads, ${fmtPct(b.pct, 0)} booked`).join("; ")}.\nReasons not booked: ${c.reasons.slice(0, 8).map((r) => `${r.reason} ${r.n}`).join("; ")}.\nTime slots: ${c.slots.map((s) => `${s.label} ${s.n} leads ${fmtPct(s.pct, 0)} booked`).join("; ")}. Weekdays: ${c.weekdays.map((d) => `${d.d} ${d.n}/${d.booked}`).join(", ")}.\nDepartments: ${c.depts.slice(0, 12).map((d) => `${d.dept} ${d.leads} leads ${fmtPct(d.pct, 0)} booked${d.costPerBooking ? ` cost/booking ${fmtAED(d.costPerBooking)}` : ""}`).join("; ")}.${c.agents ? `\nAgents: ${c.agents.slice(0, 12).map((a) => `${a.agent} ${a.leads} leads ${fmtPct(a.pct, 0)} booked, median ${fmtMin(a.medianResp)}`).join("; ")}.` : ""}`);
  L.push(`\n## Weekly trend\n| Week | Days | Spend | Conv | CPL | Calls | Cost/call | CRM leads | Booked | Booking% | IS | Note |\n|---|---|---|---|---|---|---|---|---|---|---|---|`);
  for (const w of v.trend.weekly) L.push(`| ${w.label} | ${w.days} | ${fmtNum(w.spend)} | ${fmtNum(w.conv)} | ${fmtNum(w.cpl)} | ${w.calls ?? "n/a"} | ${fmtNum(w.costPerCall)} | ${w.crmLeads} | ${w.booked} | ${fmtPct(w.bookingPct, 0)} | ${fmtPct(w.is, 0)} | ${w.note || ""} |`);
  L.push(`\n## Ranked findings (already computed)\n${insights.slice(0, 18).map((i, n) => `${n + 1}. [${i.sev}/${i.scope}] ${i.title}. ${i.detail || ""} → ${i.action}${i.impact ? ` (≈${fmtAED(i.impact)} at stake)` : ""}`).join("\n")}`);
  return L.join("\n");
}

// ---------- local intent engine ----------
const METRICS = [
  ["cpl", /\bcpl\b|cost per (form )?lead|cost per conv/], ["cpc", /\bcpc\b|cost per click/], ["ctr", /\bctr\b|click[- ]through/], ["spend", /spend|spent|cost(?! per)|budget/],
  ["calls", /\bcalls?\b|click[- ]to[- ]call/], ["costPerCall", /cost per call/], ["conv", /conversion|form lead|\bconv\b|leads from ads/], ["bookingPct", /booking rate|booking %|book(ed|ing)|conversion rate of leads/],
  ["costPerBooking", /cost per booking|cpb/], ["crmLeads", /crm|call[- ]centre|call center|leads logged/], ["is", /impression share|\bis\b/], ["lostIs", /lost (is|impression)|lost to rank/], ["health", /health|score/], ["pacing", /pacing|pace|of budget|under ?spend|over ?spend/],
];
const METRIC_LABEL = { cpl: "CPL", cpc: "CPC", ctr: "CTR", spend: "Spend", calls: "Calls", costPerCall: "Cost per call", conv: "Form conversions", bookingPct: "Booking rate", costPerBooking: "Cost per booking", crmLeads: "CRM leads", is: "Impression share", lostIs: "Lost IS (rank)", health: "Health", pacing: "Pacing" };
const fmtMetric = (k, v) => (["cpl", "cpc", "spend", "costPerCall", "costPerBooking"].includes(k) ? fmtAED(v) : ["ctr", "bookingPct", "is", "lostIs", "pacing"].includes(k) ? fmtPct(v, k === "ctr" ? 1 : 0) : fmtNum(v));
const LOWER_IS_BETTER = new Set(["cpl", "cpc", "costPerCall", "costPerBooking", "lostIs"]);

function findEntities(q, v) {
  const out = { accounts: [], centres: [], campaigns: [], specialties: [] };
  const ql = q.toLowerCase();
  for (const a of ACCOUNTS) { const m = ACCOUNT_META[a]; if (ql.includes(a.toLowerCase()) || ql.includes(m.short.toLowerCase()) || (m.region && ql.includes(m.region.toLowerCase()) && !/hospital|centre|center|clinic/.test(ql))) out.accounts.push(a); }
  for (const c of v.centres) { const toks = c.name.toLowerCase().replace(/^nmc\s+/, "").replace(/(royal|specialty|speciality) (hospital|medical centre)|medical centre|hospital|centre|center/g, "").replace(/[,]/g, " ").split(/\s+/).filter((t) => t.length > 2 && !["the", "bin", "city", "dubai"].includes(t)); const key = toks.join(" ").trim(); if (key && ql.includes(key)) out.centres.push(c.name); else if (toks.length && toks.every((t) => ql.includes(t)) && toks.join("").length > 4) out.centres.push(c.name); }
  if (ql.includes("palm")) out.centres.push("NMC Royal Medical Centre, The Palm");
  if (ql.includes("marina")) out.centres.push("NMC Marina Medical Centre");
  out.centres = [...new Set(out.centres.filter((n) => v.centres.some((c) => c.name === n)))];
  for (const c of v.campaigns) { const short = c.name.replace(/^alo_nmc_search_/i, "").toLowerCase(); if (ql.includes(c.name.toLowerCase()) || (short.length > 6 && ql.includes(short))) out.campaigns.push(c); }
  for (const s of v.specialties) { const n = s.name.toLowerCase(); if (ql.includes(n) || (n.includes("gyn") && /gyn|obstet/.test(ql)) || (n === "paediatrics" && /paedia|pedia|child/.test(ql)) || (n === "dentistry" && /dental|dentist/.test(ql)) || (n === "ent" && /\bent\b/.test(ql)) || (n === "general surgery" && /gen(eral)? ?surg|laparo/.test(ql))) out.specialties.push(s.name); }
  return out;
}
const metricOf = (q) => { for (const [k, re] of METRICS) if (re.test(q)) return k; return null; };
const rows = (items, k) => `| # | Name | ${METRIC_LABEL[k]} | Spend | Conv | CPL |\n|---|---|---|---|---|---|\n` + items.map((r, i) => `| ${i + 1} | ${r.name.replace(/^Alo_NMC_Search_/, "")} | ${fmtMetric(k, r[k])} | ${fmtAEDc(r.spend)} | ${fmtNum(r.conv)} | ${fmtAED(r.cpl)} |`).join("\n");

export function localAnswer(q, ctx) {
  const { view: v, insights, summary } = ctx; const t = v.totals; const ql = q.toLowerCase().trim();
  const nv = ctx.networkView || v; // whole network, same dates — so a named hospital/account answers even when another filter is active
  const ent = findEntities(q, nv); const metric = metricOf(ql);
  const wantWorst = /worst|expensive|wast|burn|highest cpl|poor|weak|bad|lowest booking|underperform|bleed/.test(ql);
  const wantBest = /best|top|cheapest|lowest cpl|most efficient|strong|winner|highest booking|outperform/.test(ql);
  const n = +(ql.match(/top (\d+)|(\d+) (best|worst|top)/)?.[1] || ql.match(/(\d+) (best|worst|top)/)?.[1] || 5);

  if (/^(hi|hello|hey|help|what can you do)/.test(ql)) return { text: `I read the live numbers for **${v.scopeLabel}**. Ask me things like:\n- *How are we doing?* / *executive summary*\n- *Which hospitals have the worst CPL?* · *top 5 campaigns by conversions*\n- *Are we pacing to budget?* · *what should I fix this week?*\n- *Why is Sharjah booking so few leads?* · *compare AUH and DXB*\n- *Which keywords are wasting money?* · *how fast does the call centre respond?*\n\nChange the date range, account or hospital at the top and I follow the filter.` };
  if (/summary|overview|how are we doing|state of|status|recap|tl;?dr/.test(ql) && !ent.centres.length && !ent.campaigns.length) return { text: `**${v.scopeLabel}**\n\n${summary}\n\n**Top findings**\n${insights.slice(0, 5).map((i) => `- **${i.title}** — ${i.action}`).join("\n")}` };
  if (/what should|recommend|priorit|action|plan|fix first|this week|next step|to ?do|focus/.test(ql) && !ent.centres.length && !ent.campaigns.length) { const list = insights.filter((i) => i.sev !== "info").slice(0, 8); return { text: `**Priorities for ${v.scopeLabel}**, ordered by money at stake:\n\n${list.map((i, k) => `${k + 1}. **${i.title}**\n   ${i.action}${i.impact ? ` *(≈${fmtAEDc(i.impact)})*` : ""}`).join("\n")}`, nav: "actions" }; }
  if (/realloc|move budget|shift budget|redeploy|where should (the )?(money|budget)|rebalanc/.test(ql)) {
    const plan = ctx.reallocationPlan ? ctx.reallocationPlan(v) : null;
    if (!plan || !plan.moves.length) return { text: "No reallocation is possible in this scope — there are no cheap-and-capped campaigns to fund, or no clear donors." };
    return { text: `**Budget reallocation — ${v.scopeLabel}**\n\nFree **${fmtAED(plan.totalFreed)}** from ${plan.donors.length} donor campaigns (pause the zero-conversion ones, trim the over-CPL ones by 40%), redeploy **${fmtAED(plan.totalMoved)}** into the cheap-and-capped set. Expected net **${plan.netConv >= 0 ? "+" : ""}${fmtNum(plan.netConv)} conversions**, blended CPL ${fmtAED(plan.currentCpl)} → **${fmtAED(plan.projectedCpl)}**.\n\n**Take from**\n${plan.donors.slice(0, 6).map((d) => `- ${d.name.replace(/^Alo_NMC_Search_/, "")} (${d.statusLabel}, ${fmtAED(d.spend)}, CPL ${fmtAED(d.cpl)}) → free ${fmtAED(d.free)}`).join("\n")}\n\n**Give to**\n${plan.moves.slice(0, 6).map((m) => `- ${m.to.replace(/^Alo_NMC_Search_/, "")} — add ${fmtAED(m.amount)} (CPL ${fmtAED(m.cpl)}, ${fmtPct(m.lostIs, 0)} IS lost to rank) → ≈ +${fmtNum(m.expectedConv, 1)} conv`).join("\n")}\n\n**How to execute:** two budget steps a week apart, tCPA at 1.1× current CPL on receivers, watch CPL and impression share daily; roll back any receiver whose CPL rises >20%.`, nav: "actions" };
  }
  if (/pacing|pace|budget|under ?spend|over ?spend|on track/.test(ql) && !ent.centres.length) {
    const cs = v.centres.filter((c) => c.budget).sort((a, b) => (b.spend - b.budget) - (a.spend - a.budget));
    return { text: `**Budget pacing — ${v.scopeLabel}**\n\nSpend **${fmtAED(t.spend)}** vs pro-rated budget **${fmtAED(t.budget)}** → **${fmtPct(t.pacing, 0)}**${t.pacing < 0.85 ? " (under-delivering)" : t.pacing > 1.1 ? " (over budget)" : " (on track)"}.\n\n**Most over**\n${cs.slice(0, 4).map((c) => `- ${c.short}: ${fmtPct(c.pacing, 0)} (${fmtAEDc(c.spend)} of ${fmtAEDc(c.budget)})`).join("\n")}\n\n**Most under**\n${cs.slice(-4).reverse().map((c) => `- ${c.short}: ${fmtPct(c.pacing, 0)} (${fmtAEDc(c.budget - c.spend)} unspent)`).join("\n")}\n\n${v.accounts.filter((a) => a.inScope).map((a) => `${a.short} ${fmtPct(a.pacing, 0)}`).join(" · ")}` };
  }
  if (/keyword|negative|search term|match type|quality score|\bqs\b/.test(ql)) {
    const k = v.kwStats; const broad = k.matchTypes.find((m) => /broad/i.test(m.match));
    return { text: `**Keywords — ${v.scopeLabel}** (month level)\n\n- **${fmtAED(k.wastedTotal)}** (${fmtPct(k.wastedTotal / (k.totalCost || 1), 0)} of spend) went to **${k.wastedCount} keywords with no conversions**.\n- Match types: ${k.matchTypes.map((m) => `${m.match} ${fmtAEDc(m.cost)} → CPL ${fmtAED(m.cpl)}`).join(" · ")}${broad && broad.cpl > 1.5 * (k.matchTypes.find((m) => /phrase/i.test(m.match))?.cpl || 0) ? " — broad match is the expensive one." : ""}\n- Quality Score: ${k.qsBands.map((b) => `${b.band} ${fmtPct(b.share, 0)}`).join(" · ")}.\n\n**Pause / negative candidates**\n${k.wasted.slice(0, 8).map((x) => `- "${x.kw}" (${x.match}, ${shortCentre(x.centre)}) — ${fmtAED(x.cost)}, ${x.clicks} clicks, 0 conv`).join("\n")}\n\n**Protect & expand**\n${k.winners.slice(0, 5).map((x) => `- "${x.kw}" (${shortCentre(x.centre)}) — ${fmtNum(x.conv, 1)} conv at ${fmtAED(x.cpl)}`).join("\n")}`, nav: "keywords" };
  }
  if (/call ?cent|crm|not reachable|unreach|response|speed|first call|answer|time of day|hour|slot|department|agent|reason|why.*not book|info/.test(ql) && !ent.centres.length) {
    const c = v.crm; if (!c.leads) return { text: "No call-centre leads in this scope." };
    return { text: `**Call centre — ${v.scopeLabel}**\n\n- **${c.leads} leads**, **${c.booked} booked** (${fmtPct(c.bookingPct, 0)}; ${fmtPct(c.reachedPct, 0)} when reached). Cost per booking **${fmtAED(c.costPerBooking)}**.\n- Not reachable **${fmtPct(c.notReachablePct, 0)}** · info-only **${fmtPct(c.infoPct, 0)}** · pending uncalled **${c.untouched}**.\n- Median first call **${fmtMin(c.medianResp)}**. Speed matters: ${c.respBuckets.filter((b) => b.n >= 5).map((b) => `${b.label} → ${fmtPct(b.pct, 0)}`).join(" · ")}.\n- Best time slot: ${c.slots.slice().sort((a, b) => (b.pct || 0) - (a.pct || 0))[0]?.label} (${fmtPct(c.slots.slice().sort((a, b) => (b.pct || 0) - (a.pct || 0))[0]?.pct, 0)}).\n\n**Why leads don't book**\n${c.reasons.slice(0, 6).map((r) => `- ${r.reason}: ${r.n} (${fmtPct(r.pct, 0)})`).join("\n")}\n\n**Departments** (leads · booking %)\n${c.depts.slice(0, 8).map((d) => `- ${d.dept}: ${d.leads} · ${fmtPct(d.pct, 0)}${d.costPerBooking ? ` · ${fmtAED(d.costPerBooking)}/booking` : ""}`).join("\n")}`, nav: "crm" };
  }
  if (/trend|week over week|wow|weekly|daily|over time|momentum/.test(ql)) {
    const w = v.trend.weekly; return { text: `**Weekly trend — ${v.scopeLabel}**\n\n| Week | Spend | Conv | CPL | Calls | CRM leads | Booked | Booking % |\n|---|---|---|---|---|---|---|---|\n${w.map((x) => `| ${x.label} | ${fmtAEDc(x.spend)} | ${fmtNum(x.conv)} | ${fmtAED(x.cpl)} | ${x.calls ?? "—"} | ${x.crmLeads} | ${x.booked} | ${fmtPct(x.bookingPct, 0)} |`).join("\n")}\n\n${w.filter((x) => x.wow).map((x) => `- ${x.label}: spend/day ${fmtDelta(x.wow.spend, 0)}, CPL ${fmtDelta(x.wow.cpl, 0)}, calls/day ${fmtDelta(x.wow.calls, 0)}${x.note ? ` — *${x.note}*` : ""}`).join("\n")}` };
  }
  // compare two entities
  if (/compare|\bvs\b|versus|against/.test(ql) && (ent.accounts.length + ent.centres.length >= 2)) {
    const items = [...ent.accounts.map((a) => nv.accounts.find((x) => x.name === a)), ...ent.centres.map((c) => nv.centres.find((x) => x.name === c))].filter(Boolean).slice(0, 3);
    const keys = ["spend", "conv", "cpl", "cpc", "ctr", "calls", "costPerCall", "crmLeads", "booked", "bookingPct", "costPerBooking", "is", "lostIs"];
    return { text: `**${items.map((i) => i.short || i.name).join(" vs ")}** — ${v.period.label}\n\n| Metric | ${items.map((i) => i.short || shortCentre(i.name)).join(" | ")} |\n|---|${items.map(() => "---").join("|")}|\n${keys.map((k) => `| ${METRIC_LABEL[k] || k} | ${items.map((i) => fmtMetric(k, i[k])).join(" | ")} |`).join("\n")}` };
  }
  // entity profiles
  if (ent.campaigns.length) { const c = ent.campaigns[0]; const rel = insights.filter((i) => (i.entities || []).includes(c.name)); return { text: `**${c.name}** — ${c.specialty} · ${shortCentre(c.centre)} · ${c.account}\n\nStatus **${c.statusLabel}**: ${c.why}.\n\n- Spend ${fmtAED(c.spend)} (${fmtPct(c.share, 1)} of scope) over ${c.daysActive} active days\n- ${fmtNum(c.clicks)} clicks · CTR ${fmtPct(c.ctr, 1)} · CPC ${fmtAED(c.cpc)}\n- ${fmtNum(c.conv, 1)} conversions · CPL **${fmtAED(c.cpl)}** (network median ${fmtAED(v.baseline.cplMedian)}) · conv rate ${fmtPct(c.convRate, 1)}\n- Impression share ${fmtPct(c.is, 0)} · lost to rank ${fmtPct(c.lostIs, 0)}\n${rel.length ? `\n**Related findings**\n${rel.map((i) => `- ${i.title} → ${i.action}`).join("\n")}` : ""}\n\nOpen the campaign in the Campaigns page for ad groups, keywords and suggested negatives.`, open: { campaign: c.id } }; }
  if (ent.centres.length === 1) { const c = nv.centres.find((x) => x.name === ent.centres[0]); const camps = nv.campaigns.filter((x) => x.centre === c.name); const rel = (ctx.networkInsights || insights).filter((i) => i.entity === c.name || (i.entities || []).some((nm) => camps.some((x) => x.name === nm)));
    return { text: `**${c.name}** — ${c.account} · health **${c.health}/100** (${c.healthBand}) · ${nv.period.label}\n\n- Spend **${fmtAED(c.spend)}**${c.budget ? ` = ${fmtPct(c.pacing, 0)} of ${fmtAED(c.budget)} budget` : ""}\n- ${fmtNum(c.conv)} form conversions · CPL **${fmtAED(c.cpl)}** (network ${fmtAED(nv.baseline.cplMedian)}) · CPC ${fmtAED(c.cpc)} · CTR ${fmtPct(c.ctr, 1)}\n- Calls ${c.calls ?? "n/a"} · cost per call ${fmtAED(c.costPerCall)}\n- CRM: ${c.crmLeads} leads → **${c.booked} booked** (${fmtPct(c.bookingPct, 0)}; network ${fmtPct(nv.totals.bookingPct, 0)}) · unreached ${fmtPct(c.notReachablePct, 0)} · cost per booking **${fmtAED(c.costPerBooking)}**\n- Impression share ${fmtPct(c.is, 0)} · lost to rank ${fmtPct(c.lostIs, 0)}\n\n**Campaigns** (${camps.length}): ${["scale", "fix", "pause"].map((s) => { const l = camps.filter((x) => x.status === s); return l.length ? `${s} ${l.length} (${l.slice(0, 3).map((x) => x.name.replace(/^Alo_NMC_Search_/, "")).join(", ")})` : null; }).filter(Boolean).join(" · ") || "all within range"}\n${rel.length ? `\n**Findings**\n${rel.slice(0, 5).map((i) => `- ${i.title} → ${i.action}`).join("\n")}` : ""}`, open: { centre: c.name } }; }
  if (ent.specialties.length === 1 && !wantBest && !wantWorst) { const s = v.specialties.find((x) => x.name === ent.specialties[0]) || nv.specialties.find((x) => x.name === ent.specialties[0]); const camps = (v.specialties.some((x) => x.name === s.name) ? v : nv).campaigns.filter((c) => c.specialty === s.name).sort((a, b) => b.spend - a.spend); return { text: `**${s.name}** — ${v.scopeLabel}\n\n- Spend ${fmtAED(s.spend)} across ${s.campaigns} campaigns · ${fmtNum(s.conv)} conversions · CPL **${fmtAED(s.cpl)}**\n- CRM: ${s.crmLeads} leads → ${s.booked} booked (${fmtPct(s.bookingPct, 0)}) · cost per booking ${fmtAED(s.costPerBooking)}\n\n| Campaign | Centre | Status | Spend | Conv | CPL |\n|---|---|---|---|---|---|\n${camps.slice(0, 10).map((c) => `| ${c.name.replace(/^Alo_NMC_Search_/, "")} | ${shortCentre(c.centre)} | ${c.status} | ${fmtAEDc(c.spend)} | ${fmtNum(c.conv, 1)} | ${fmtAED(c.cpl)} |`).join("\n")}` }; }
  if (ent.accounts.length === 1 && !wantBest && !wantWorst && !/compare/.test(ql)) { const a = nv.accounts.find((x) => x.name === ent.accounts[0]); const cs = nv.centres.filter((c) => c.account === a.name); return { text: `**${a.name}** — ${v.period.label}\n\n- Spend **${fmtAED(a.spend)}**${a.budget ? ` (${fmtPct(a.pacing, 0)} of budget)` : ""} · ${fmtPct(a.spend / (nv.totals.spend || 1), 0)} of network spend\n- ${fmtNum(a.conv)} conversions · CPL **${fmtAED(a.cpl)}** · CPC ${fmtAED(a.cpc)}\n- Calls ${a.calls ?? "n/a"} · cost/call ${fmtAED(a.costPerCall)}\n- CRM ${a.crmLeads} leads → ${a.booked} booked (${fmtPct(a.bookingPct, 0)}) · cost/booking **${fmtAED(a.costPerBooking)}**\n- IS ${fmtPct(a.is, 0)} · lost to rank ${fmtPct(a.lostIs, 0)}\n\n**Centres**\n${cs.map((c) => `- ${c.short}: ${fmtAEDc(c.spend)} · CPL ${fmtAED(c.cpl)} · booking ${fmtPct(c.bookingPct, 0)} · health ${c.health}`).join("\n")}`, filter: { account: a.name } }; }
  // rankings
  if (wantBest || wantWorst || metric) {
    const k = metric || "cpl";
    const type = /campaign/.test(ql) ? "campaigns" : /keyword/.test(ql) ? "keywords" : /account/.test(ql) ? "accounts" : /special|department/.test(ql) ? "specialties" : "centres";
    const src = ent.accounts.length || ent.centres.length ? nv : v;
    let pool = type === "accounts" ? src.accounts.filter((a) => a.inScope) : type === "campaigns" ? src.campaigns : type === "specialties" ? src.specialties : src.centres;
    if (ent.accounts.length && type !== "accounts") pool = pool.filter((x) => x.account === ent.accounts[0] || !x.account);
    if (ent.specialties.length && type === "campaigns") pool = pool.filter((x) => x.specialty === ent.specialties[0]);
    pool = pool.filter((x) => x[k] != null && (k !== "cpl" || x.conv >= 1) && (k !== "bookingPct" || x.crmLeads >= 5));
    const worse = wantWorst ? !LOWER_IS_BETTER.has(k) : LOWER_IS_BETTER.has(k); // worse → ascending if higher is better
    const sorted = pool.slice().sort((a, b) => (wantWorst ? (LOWER_IS_BETTER.has(k) ? b[k] - a[k] : a[k] - b[k]) : (LOWER_IS_BETTER.has(k) ? a[k] - b[k] : b[k] - a[k])));
    const items = sorted.slice(0, n).map((x) => ({ ...x, name: x.name || x.short }));
    if (!items.length) return { text: "Nothing matches that in the current scope." };
    return { text: `**${wantWorst ? "Worst" : "Best"} ${type} by ${METRIC_LABEL[k]}** — ${ent.accounts.length ? ent.accounts[0] + " · " + nv.period.label : src.scopeLabel}${k === "cpl" ? " (min 1 conversion)" : ""}\n\n${rows(items, k)}\n\n${wantWorst && k === "cpl" ? `Network median CPL is ${fmtAED(v.baseline.cplMedian)}. Fix order: check conversion tracking → search terms & negatives → landing page → bids.` : ""}`, nav: type === "campaigns" ? "campaigns" : type === "centres" ? "hospitals" : null };
  }
  if (/why/.test(ql)) { const hit = insights.find((i) => ql.split(/\s+/).filter((w) => w.length > 4).some((w) => i.title.toLowerCase().includes(w))); if (hit) return { text: `**${hit.title}**\n\n${hit.detail || ""}\n\n**Do:** ${hit.action}` }; }
  return null;
}

// ---------- LLM providers ----------
const SYSTEM = `You are Vantage Pulse's analyst: a Google Ads strategist with 20 years in paid search, who has run healthcare lead-gen accounts end to end — account structure, match-type and negative strategy, Quality Score engineering, Smart Bidding (tCPA/tROAS, portfolio strategies, seasonality adjustments), impression-share and auction-insights diagnostics, call-tracking and offline-conversion imports, landing-page CRO, and the lead-to-booking funnel in the call centre. You advise NMC Healthcare's search accounts (NMC AUH, NMC DXB, NMC North Emirates, Sunny Clinics).
Think like that strategist: diagnose before prescribing (is it measurement, demand, auction, page, or call handling?), size every recommendation in AED, sequence it (this week / this month), and state the risk and the metric to watch. Prefer structural fixes over bid tweaks when the data says structure is the problem.
Rules: answer ONLY from the data pack below; quote real numbers; never invent figures. Be direct and specific: name campaigns, centres and keywords. Prefer short paragraphs and bullet lists; use a markdown table when comparing 3+ items. When asked what to do, give concrete Google Ads / call-centre actions with the expected effect and the money at stake. If the data cannot answer, say so and name the data that would. Currency AED. Keep answers under ~300 words unless asked for a full report.`;

async function askGemini(key, model, system, messages) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })), generationConfig: { temperature: 0.3, maxOutputTokens: 1400 } }) });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error?.message || `Gemini HTTP ${res.status}`);
  const text = (j.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("").trim();
  if (!text) throw new Error("Gemini returned an empty answer");
  return text;
}
async function askClaude(key, model, system, messages) {
  const res = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" }, body: JSON.stringify({ model, max_tokens: 1400, temperature: 0.3, system, messages: messages.map((m) => ({ role: m.role, content: m.content })) }) });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error?.message || `Claude HTTP ${res.status}`);
  const text = (j.content || []).filter((b) => b.type === "text").map((b) => b.text).join("").trim();
  if (!text) throw new Error("Claude returned an empty answer");
  return text;
}
export async function testProvider(provider, key, model) {
  const msgs = [{ role: "user", content: "Reply with the single word OK." }];
  return provider === "gemini" ? askGemini(key, model, "You are a test.", msgs) : askClaude(key, model, "You are a test.", msgs);
}

/** ask(question, history[{role, content}], ctx) → { text, source, nav?, open?, filter? } */
export async function ask(question, history, ctx) {
  const local = localAnswer(question, ctx);
  if (!AI.ready) {
    if (local) return { ...local, source: "local" };
    return { text: `I could not map that to the numbers I hold. Try naming a **hospital, account, campaign, specialty or metric** (CPL, CPC, calls, bookings, impression share, budget), or ask for *summary*, *priorities*, *keywords*, *call centre* or *trend*.\n\nFor open-ended questions, add a Gemini or Claude API key under **Data → AI analyst** and I will reason over the full data pack.`, source: "local" };
  }
  const p = AI.provider, key = AI.key(p), model = AI.model(p);
  const system = `${SYSTEM}\n\n=== DATA PACK (live, ${new Date().toISOString().slice(0, 16)}) ===\n${contextPack(ctx)}${local ? `\n\n=== COMPUTED FACTS FOR THIS QUESTION (authoritative) ===\n${local.text}` : ""}`;
  const msgs = [...history.slice(-8).map((m) => ({ role: m.role, content: m.content })), { role: "user", content: question }];
  try {
    const text = p === "gemini" ? await askGemini(key, model, system, msgs) : await askClaude(key, model, system, msgs);
    return { text, source: p, nav: local?.nav, open: local?.open };
  } catch (e) {
    if (local) return { ...local, source: "local", note: `AI (${p}) failed: ${e.message}. Showing the computed answer instead.` };
    return { text: `The AI request failed: ${e.message}`, source: "error" };
  }
}

export function suggestions(ctx) {
  const v = ctx.view, c = v.filter.centre, a = v.filter.account;
  const base = c ? [`Deep-dive ${shortCentre(c)}`, `Why is ${shortCentre(c)}'s CPL where it is?`, "Which campaigns here should I pause?", "How does the call centre handle this centre's leads?"]
    : a !== "all" ? [`Summary for ${a}`, `Worst CPL hospitals in ${a}`, `Top 5 campaigns in ${a} by conversions`, "Are we pacing to budget?"]
    : ["How are we doing this month?", "Where should I move budget?", "Which hospitals have the worst CPL?", "What should I fix this week?", "Which keywords are wasting money?", "How fast does the call centre respond?"];
  return base;
}
