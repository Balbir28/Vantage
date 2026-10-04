// ============================================================
//  PARSE — turns raw sheet tabs (arrays of string cells) into one
//  normalised data model. Every tab is recognised by its *header
//  signature*, not its name, so renamed or re-ordered tabs still load.
//
//  Model shape (everything downstream reads this, never raw tabs):
//  {
//    meta:      { title, period, year, month, dataUpTo, tabs:{kind:name} }
//    centres:   [ { name, region, account, budget } ]
//    summary:   { rows:[CentreRow], totals, totalsExcl, trend:[TrendRow] }
//    weeks:     [ { key:'W1', label, start, end, days, rows:[CentreRow] } ]
//    dailyCalls:[ { date, acc:{ account:{ext,ga4,total} } } ]
//    ads:       { campaigns:[{name,account,centre,region,specialty}],
//                 daily:[{c,d,w,impr,clicks,cost,conv,calls,elig,lost}],
//                 keywords:[{c,adgroup,kw,match,d,w,qs,impr,clicks,cost,conv,elig,lost}] }  (one row per keyword per day)
//    c2c:       [ { date, centre, account, ext, ga4, total } ]  (Click to Calls tab — typed daily per hospital)
//    leads:     [ { id,status,reason,dept,centre,priority,created,respMin,week,agent,doctor } ]
//  }
// ============================================================

export const ACCOUNTS = ["NMC AUH", "NMC DXB", "NMC North Emirates", "Sunny Clinics"];
export const ACCOUNT_META = {
  "NMC AUH":           { short: "AUH",   region: "Abu Dhabi",     slot: 1, blurb: "Abu Dhabi hospitals" },
  "NMC DXB":           { short: "DXB",   region: "Dubai",         slot: 2, blurb: "Dubai centres incl. Palm & Marina" },
  "NMC North Emirates":{ short: "NE",    region: "Sharjah",       slot: 3, blurb: "NMC Royal Hospital, Sharjah" },
  "Sunny Clinics":     { short: "Sunny", region: "Sunny Clinics", slot: 4, blurb: "13 medical centres" },
};
const ACCOUNT_BY_REGION = { "abu dhabi": "NMC AUH", "dubai": "NMC DXB", "sharjah": "NMC North Emirates", "sunny clinics": "Sunny Clinics" };

export function accountForRegion(region) {
  return ACCOUNT_BY_REGION[String(region || "").trim().toLowerCase()] || null;
}
export function canonicalAccount(label) {
  const s = String(label || "").toUpperCase();
  if (/AUH|ABU DHABI/.test(s)) return "NMC AUH";
  if (/DXB|DUBAI/.test(s)) return "NMC DXB";
  if (/NORTH|SHARJAH|\bNE\b/.test(s)) return "NMC North Emirates";
  if (/SUNNY/.test(s)) return "Sunny Clinics";
  if (/^ALL/.test(s)) return "ALL";
  return null;
}

const shortName = (name) => String(name).replace(/^NMC\s+/, "").replace(/Royal Hospital,\s*/, "RH ").replace(/Specialty Hospital,\s*/, "SH ").replace(/Royal Medical Centre,\s*/, "RMC ").replace(/Medical Centre,\s*/, "MC ").replace(/Medical Centre$/, "MC").replace(/, Dubai$/, "");

// ---------- primitives ----------
const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
const MONTH_NAMES = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export const norm = (h) => String(h ?? "").toLowerCase().replace(/[^a-z0-9%]+/g, " ").trim();
const pad = (n) => String(n).padStart(2, "0");
const iso = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;

/** Parse a number the way a sheet prints it. pct=true returns a 0–1 fraction. */
export function num(v, pct = false) {
  if (v == null) return null;
  if (typeof v === "number") return pct && v > 1.0001 ? v / 100 : v;
  let s = String(v).trim();
  if (s === "" || s === "--" || s === "—" || s === "-" || s === "–" || /^n\/?a$/i.test(s)) return null;
  if (/^<\s*10\s*%$/.test(s)) return 0.05;            // Google prints "< 10%" — count at the 5% midpoint (see sheet Read Me)
  if (/^>\s*90\s*%$/.test(s)) return 0.95;
  const isPct = s.endsWith("%");
  s = s.replace(/[%,\sA-Za-z$€£]/g, "");
  if (s === "" || s === "." ) return null;
  const x = parseFloat(s.replace(/^\+/, ""));
  if (!Number.isFinite(x)) return null;
  if (isPct) return x / 100;
  if (pct && Math.abs(x) > 1.0001) return x / 100;
  return x;
}

/** Parse the many ways a date shows up in these sheets → 'YYYY-MM-DD'. */
export function parseDate(v, yearHint) {
  if (v == null || v === "") return null;
  if (v instanceof Date) return iso(v.getFullYear(), v.getMonth() + 1, v.getDate());
  const s = String(v).trim();
  let m;
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) return iso(+m[1], +m[2], +m[3]);
  if ((m = s.match(/^(\d{1,2})[ \-\/]([A-Za-z]{3,9})\.?[ \-\/,]+(\d{2,4})/))) {
    const mo = MONTHS[m[2].slice(0, 3).toLowerCase()]; if (!mo) return null;
    let y = +m[3]; if (y < 100) y += 2000; return iso(y, mo, +m[1]);
  }
  if ((m = s.match(/^(?:[A-Za-z]{3,9},?\s+)?(\d{1,2})\s+([A-Za-z]{3,9})\.?(?:\s+(\d{4}))?$/))) {
    const mo = MONTHS[m[2].slice(0, 3).toLowerCase()]; if (!mo) return null;
    return iso(m[3] ? +m[3] : (yearHint || new Date().getFullYear()), mo, +m[1]);
  }
  if ((m = s.match(/^([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})/))) {
    const mo = MONTHS[m[1].slice(0, 3).toLowerCase()]; if (!mo) return null;
    return iso(+m[3], mo, +m[2]);
  }
  if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/))) { // M/D/YYYY (gviz, en-US)
    let y = +m[3]; if (y < 100) y += 2000; return iso(y, +m[1], +m[2]);
  }
  return null;
}

/** "37m" | "1h 5m" | "0m" | "—" → minutes. */
export function parseMinutes(v) {
  if (v == null) return null;
  if (typeof v === "number") return v;
  const s = String(v).trim().toLowerCase();
  if (!s || s === "—" || s === "-" || s === "--") return null;
  let total = 0, hit = false, m;
  if ((m = s.match(/(\d+)\s*d/))) { total += +m[1] * 1440; hit = true; }
  if ((m = s.match(/(\d+)\s*h/))) { total += +m[1] * 60; hit = true; }
  if ((m = s.match(/(\d+)\s*m(?!o)/))) { total += +m[1]; hit = true; }
  if (!hit) { const x = parseFloat(s); return Number.isFinite(x) ? x : null; }
  return total;
}

function weekOf(dateIso) { // sheet convention: W1 = 1–7, W2 = 8–14 … W5 = 29–31
  const d = +dateIso.slice(8, 10);
  return "W" + Math.min(5, Math.ceil(d / 7));
}

// ---------- specialty from campaign name ----------
const SPECIALTY_RULES = [
  [/paediadental|paedia[_ ]?dental|paediatric dent|pediatric dent/i, "Paediatric Dentistry"],
  [/neonat/i, "Neonatology"],
  [/padiac|paedia|pediatric|paediatric/i, "Paediatrics"],
  [/ob[_ ]?gyn|obgyn|gyna/i, "Obstetrics & Gynaecology"],
  [/gen[_ ]?surg.*fem/i, "General Surgery (Female)"],
  [/gen[_ ]?surg|general[_ ]surg|laparoscopic/i, "General Surgery"],
  [/derma/i, "Dermatology"],
  [/oral|maxillo/i, "Oral & Maxillofacial"],
  [/dental|dentist/i, "Dentistry"],
  [/ortho/i, "Orthopaedics"],
  [/cardio/i, "Cardiology"],
  [/internal[_ ]?med/i, "Internal Medicine"],
  [/general[_ ]?medicine/i, "General Medicine"],
  [/family[_ ]?med/i, "Family Medicine"],
  [/\bent\b/i, "ENT"],
  [/gastro/i, "Gastroenterology"],
  [/pulmo/i, "Pulmonology"],
  [/endo/i, "Endocrinology"],
  [/ophthal/i, "Ophthalmology"],
  [/radiol/i, "Radiology"],
  [/physio/i, "Physiotherapy"],
  [/nutrition|diet/i, "Nutrition"],
  [/ent,? head|ear nose/i, "ENT"],
  [/lactation/i, "Lactation"],
  [/foetal|fetal/i, "Foetal Medicine"],
  [/competitor/i, "Competitor"],
  [/microbiome/i, "Microbiome"],
  [/iv[_ ]?drip/i, "IV Drip"],
  [/urolog/i, "Urology"],
  [/neuro/i, "Neurology"],
  [/brand/i, "Brand"],
  [/generic/i, "Generic"],
];
/** Map a call-centre department label onto the same specialty vocabulary as campaigns. */
export function specialtyOfDept(dept) {
  const d = String(dept || "");
  for (const [re, name] of SPECIALTY_RULES) if (re.test(d)) return name;
  return d || "Unspecified";
}
export function specialtyOf(campaign) {
  const core = String(campaign || "").replace(/^alo_nmc_search_/i, "");
  for (const [re, name] of SPECIALTY_RULES) if (re.test(core)) return name;
  // fallback: the first token before the centre code
  const t = core.split(/[_\s]+/)[0];
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : "Other";
}

// ---------- tab detection ----------
export function detectKind(rows) {
  const scan = rows.slice(0, 10).map((r) => r.map((c) => { const n = norm(c); return n.length > 60 ? n.slice(-60) : n; }));
  for (let i = 0; i < scan.length; i++) {
    const r = scan[i], joined = " | " + r.join(" | ") + " | ";
    if (r.includes("campaign") && r.some((c) => /^impr/.test(c)) && r.includes("search keyword")) return { kind: "ads", header: i };
    if (r[0] === "id" && r.includes("status") && r.includes("reason")) return { kind: "leads", header: i };
    if (/(^| )centre$/.test(r[0] || "") && r.includes("impressions") && r.includes("booked")) return { kind: "centreTable", header: i };
    if (r.includes("date") && r.some((c) => /^(hospital|centre|center|branch)( name)?$/.test(c)) && r.some((c) => /click to call|call ext|call click|call now|^total( calls)?$|^calls$/.test(c))) return { kind: "clickToCalls", header: i };
    if (r[0] === "date" && joined.includes("| total calls |")) return { kind: "dailyCalls", header: i };
    if (/(^| )centre$/.test(r[0] || "") && r.some((c) => c.startsWith("budget")) && r.length <= 6) return { kind: "budget", header: i };
    if (/campaign name contains/.test(r[0] || "")) return { kind: "centreList", header: i };
    if ((r[0] || "").startsWith("all ad accounts") && r.includes("days")) return { kind: "weeklyCalls", header: i };
  }
  return { kind: "unknown", header: -1 };
}

const COLS = {
  centre: { impr: /^impressions$/, clicks: /^clicks$/, ctr: /^ctr$/, spend: /^spends?( aed)?$/, cpc: /^cpc/,
    form: /^conversions( form)?$/, callExt: /^call click ext/, ga4: /^ga4 call now/, cpl: /^cpl/, budget: /^budget/,
    is: /^(search )?impr share$/, lostIs: /^lost is( rank)?$/, booked: /^booked$/, notBooked: /^not booked$/,
    notReachable: /^not reachable$/, pending: /^pending$/, crmLeads: /^(grand total|total leads( crm)?)$/, bookingPct: /^booking %$/,
    wa: /^wa floater/, c2c: /^total click to calls/, costPerC2c: /^avg cost per click to call/ },
  trend: { impr: /^impressions$/, clicks: /^clicks$/, ctr: /^ctr$/, spend: /^spends?( aed)?$/, cpc: /^cpc/, form: /^conversions( form)?$/,
    callExt: /^call click ext/, ga4: /^ga4 call now/, cpl: /^cpl/, is: /^(search )?impr share$/, crmLeads: /^total leads( crm)?$/,
    booked: /^booked$/, bookingPct: /^booking %$/, calls: /^total calls/, costPerCall: /^cost call/ },
  ads: { day: /^day$/, campaign: /^campaign$/, account: /^account name$/, adgroup: /^ad group$/, kw: /^search keyword$/,
    match: /^search keyword match type$/, qs: /^quality score$/, impr: /^impr/, clicks: /^clicks$/, cost: /^cost$/,
    conv: /^conversions$/, calls: /^phone calls$/, is: /^search impr share$/, lostRank: /^search lost is rank/,
    centre: /^centre/, region: /^region/, week: /^week/, elig: /^eligible impr/, lostW: /^lost is weighted/ },
  leads: { id: /^id$/, status: /^status$/, reason: /^reason$/, dept: /^department$/, branch: /^branch$/, priority: /^lead priority$/,
    created: /^created at$/, resp: /^response time$/, agent: /^handled by$/, doctor: /^doctor$/, centre: /^centre/, week: /^week/ },
};
const PCT = new Set(["ctr", "is", "lostIs", "bookingPct", "lostRank"]);

function mapCols(headerRow, spec) {
  const H = headerRow.map(norm), out = {};
  for (const [key, re] of Object.entries(spec)) {
    const i = H.findIndex((h) => re.test(h));
    if (i >= 0) out[key] = i;
  }
  return out;
}
const cell = (row, i) => (i == null || i >= row.length ? "" : row[i]);

// ---------- parsers ----------
export function parseCentreTable(rows, header) {
  const title = String(rows[0]?.[0] || ""), subtitle = String(rows[1]?.[0] || "");
  const col = mapCols(rows[header], COLS.centre);
  const out = { title, subtitle, rows: [], regionTotals: {}, totals: null, totalsExcl: null, trend: [] };
  let region = null, i = header + 1;
  const readRow = (r) => {
    const o = { centre: String(r[0]).trim(), region };
    for (const k of Object.keys(col)) o[k] = num(cell(r, col[k]), PCT.has(k));
    return o;
  };
  for (; i < rows.length; i++) {
    const r = rows[i], a = String(r[0] ?? "").trim();
    const rest = r.slice(1).some((c) => String(c ?? "").trim() !== "");
    if (!a && !rest) continue;
    if (/^week[\s-]*over[\s-]*week|^trend|^calls by ad account/i.test(a)) break;
    if (!rest && a === a.toUpperCase() && /[A-Z]/.test(a)) { region = a.replace(/\s+/g, " ").trim(); region = region.charAt(0) + region.slice(1).toLowerCase(); region = region.replace(/\b\w/g, (c) => c.toUpperCase()); continue; }
    if (/^grand total/i.test(a)) { const o = readRow(r); o.region = null; if (/excl/i.test(a)) out.totalsExcl = o; else if (!out.totals) out.totals = o; continue; }
    if (/ total$/i.test(a)) { out.regionTotals[region] = readRow(r); continue; }
    if (!rest) continue;
    out.rows.push(readRow(r));
  }
  // optional WoW trend section (first one only = all accounts)
  for (; i < rows.length; i++) {
    const r = rows[i], a = norm(r[0]);
    if (a === "period") {
      const tcol = mapCols(r, COLS.trend);
      for (let j = i + 1; j < rows.length; j++) {
        const rr = rows[j], p = String(rr[0] ?? "").trim();
        if (!p) break;
        if (!/^week|mtd|month/i.test(p)) break;
        const o = { period: p };
        for (const k of Object.keys(tcol)) o[k] = num(cell(rr, tcol[k]), PCT.has(k));
        const wk = p.match(/week\s*(\d)/i); o.week = wk ? "W" + wk[1] : (/mtd|month/i.test(p) ? "MTD" : null);
        const noteIdx = rr.findIndex((c, ci) => ci > 0 && typeof c === "string" && c.length > 12 && !/^[\d.,%+\-–—\s]+$/.test(c) && !Object.values(tcol).includes(ci));
        if (noteIdx > 0) o.note = String(rr[noteIdx]).trim();
        out.trend.push(o);
      }
      break;
    }
  }
  return out;
}

export function parseDailyCalls(rows, header) {
  const title = String(rows[0]?.[0] || "");
  const yearHint = +(title.match(/(20\d{2})/)?.[1] || new Date().getFullYear());
  const groupRow = rows[header - 1] || [];
  const groups = [];
  groupRow.forEach((c, i) => { const acc = canonicalAccount(c); if (acc) groups.push({ acc, start: i }); });
  const sub = rows[header].map(norm);
  const out = [];
  for (let i = header + 1; i < rows.length; i++) {
    const r = rows[i], d = parseDate(r[0], yearHint);
    if (!d) { if (/total|difference|check/i.test(String(r[0]))) break; continue; }
    const acc = {};
    for (const g of groups) {
      const find = (re) => { for (let k = g.start; k < g.start + 4 && k < sub.length; k++) if (re.test(sub[k])) return k; return -1; };
      const ext = num(cell(r, find(/call click/))) || 0, ga4 = num(cell(r, find(/ga4/))) || 0;
      const tot = num(cell(r, find(/total/))); acc[g.acc] = { ext, ga4, total: tot ?? ext + ga4 };
    }
    out.push({ date: d, acc });
  }
  return out;
}

/** Click to Calls tab — one row per day per hospital, typed daily:
 *  Date | Ad Account | Hospital | Call Ext. | Page Call Now | Total Click-to-Calls
 *  Blank number cells = not entered yet (skipped); 0 = zero calls. Total is optional (ext + page when blank). */
export function parseClickToCalls(rows, header, ctx = {}) {
  const H = rows[header].map(norm);
  const find = (re) => H.findIndex((h) => re.test(h));
  const col = { date: find(/^date$/), account: find(/account/), centre: find(/^(hospital|centre|center|branch)( name)?$/),
    ext: find(/call ext|call click|extension/), ga4: find(/ga4|call now|page call|landing/), total: find(/^total|click to calls?$|^calls$/) };
  const resolve = ccResolver(ctx.centreList, ctx.knownCentres);
  const out = [], unmatched = new Set();
  for (let i = header + 1; i < rows.length; i++) {
    const r = rows[i], date = parseDate(cell(r, col.date), ctx.year), name = String(cell(r, col.centre) ?? "").trim();
    if (!date || !name) continue;
    const ext = col.ext >= 0 ? num(cell(r, col.ext)) : null, ga4 = col.ga4 >= 0 ? num(cell(r, col.ga4)) : null, tot = col.total >= 0 ? num(cell(r, col.total)) : null;
    if (ext == null && ga4 == null && tot == null) continue; // not entered yet
    const centre = resolve(name) || (ctx.shortNames && ctx.shortNames.get(norm(name))) || name;
    if (ctx.knownCentres && !ctx.knownCentres.includes(centre)) unmatched.add(name);
    const total = tot ?? (ext || 0) + (ga4 || 0);
    out.push({ date, centre, account: canonicalAccount(cell(r, col.account)) || null, ext: ext ?? (ga4 == null ? total : 0), ga4: ga4 ?? 0, total });
  }
  out.unmatched = [...unmatched];
  return out;
}

export function parseBudget(rows, header) {
  const out = [];
  for (let i = header + 1; i < rows.length; i++) {
    const r = rows[i], name = String(r[0] ?? "").trim(), b = num(r[1]);
    if (!name || b == null) continue;
    if (/^total/i.test(name)) continue;
    out.push({ centre: name, budget: b, note: String(r[2] ?? "").trim() });
  }
  return out;
}

export function parseCentreList(rows, header) {
  const out = [];
  for (let i = header + 1; i < rows.length; i++) {
    const r = rows[i], token = String(r[0] ?? "").trim(), centre = String(r[1] ?? "").trim();
    if (!token || !centre || token.length > 60 || /\s{2,}|^(this|new|and|one|a )/i.test(token)) continue;
    out.push({ token, centre, region: String(r[2] ?? "").trim(), ccName: String(r[3] ?? "").trim() || centre });
  }
  return out;
}

function centreResolver(centreList) {
  const list = (centreList || []).slice().sort((a, b) => b.token.length - a.token.length);
  return (campaign) => { for (const e of list) if (campaign.includes(e.token)) return e; return null; };
}
const loose = (s) => norm(s).replace(/\b(nmc|speciality|specialty|hospital|medical|centre|center|royal|the)\b/g, "").replace(/\s+/g, " ").trim();
function ccResolver(centreList, knownCentres) {
  const byCc = new Map(), byName = new Map(), byLoose = new Map();
  for (const e of centreList || []) { byCc.set(norm(e.ccName), e.centre); byName.set(norm(e.centre), e.centre); byLoose.set(loose(e.centre), e.centre); byLoose.set(loose(e.ccName), e.centre); }
  for (const c of knownCentres || []) { byName.set(norm(c), c); byLoose.set(loose(c), c); }
  return (branch) => { const k = norm(branch); return byCc.get(k) || byName.get(k) || byLoose.get(loose(branch)) || null; };
}

export function parseAds(rows, header, ctx = {}) {
  const col = mapCols(rows[header], COLS.ads);
  const resolve = centreResolver(ctx.centreList);
  const regionOf = (centreName) => (ctx.centreRegion && ctx.centreRegion[centreName]) || null;
  const campIdx = new Map(), campaigns = [];
  const daily = new Map(), kws = new Map();
  let rowsRead = 0, unmapped = new Set();
  for (let i = header + 1; i < rows.length; i++) {
    const r = rows[i];
    const name = String(cell(r, col.campaign) ?? "").trim();
    if (!name) continue;
    const d = parseDate(cell(r, col.day), ctx.year);
    if (!d) continue;
    rowsRead++;
    let ci = campIdx.get(name);
    if (ci == null) {
      let centre = String(cell(r, col.centre) ?? "").trim(), region = String(cell(r, col.region) ?? "").trim();
      if (!centre || /⚠/.test(centre)) { const e = resolve(name); centre = e?.centre || ""; region = e?.region || region; }
      if (!region) region = regionOf(centre) || "";
      let account = String(cell(r, col.account) ?? "").trim() || accountForRegion(region) || "";
      if (!centre) unmapped.add(name);
      ci = campaigns.length; campIdx.set(name, ci);
      campaigns.push({ name, account, centre, region, specialty: specialtyOf(name) });
    }
    const impr = num(cell(r, col.impr)) || 0, clicks = num(cell(r, col.clicks)) || 0, cost = num(cell(r, col.cost)) || 0;
    const conv = num(cell(r, col.conv)) || 0, calls = num(cell(r, col.calls)) || 0;
    let elig = num(cell(r, col.elig)), lostW = num(cell(r, col.lostW));
    if (elig == null) { const is = num(cell(r, col.is), true); elig = is ? impr / is : (impr > 0 ? null : 0); }
    if (lostW == null) { const lr = num(cell(r, col.lostRank), true); lostW = elig != null && lr != null ? elig * lr : null; }
    elig = elig || 0; lostW = lostW || 0;
    const w = String(cell(r, col.week) ?? "").trim() || weekOf(d);
    const dk = ci + "|" + d;
    let dd = daily.get(dk);
    if (!dd) { dd = { c: ci, d, w, impr: 0, clicks: 0, cost: 0, conv: 0, calls: 0, elig: 0, lost: 0 }; daily.set(dk, dd); }
    dd.impr += impr; dd.clicks += clicks; dd.cost += cost; dd.conv += conv; dd.calls += calls; dd.elig += elig; dd.lost += lostW;
    const adgroup = String(cell(r, col.adgroup) ?? "").trim(), kw = String(cell(r, col.kw) ?? "").trim();
    const match = String(cell(r, col.match) ?? "").replace(/ match$/i, "").trim();
    const kk = ci + "|" + adgroup + "|" + kw + "|" + match + "|" + d;
    let kd = kws.get(kk);
    if (!kd) { kd = { c: ci, adgroup, kw, match, d, w, qs: null, impr: 0, clicks: 0, cost: 0, conv: 0, elig: 0, lost: 0 }; kws.set(kk, kd); }
    kd.impr += impr; kd.clicks += clicks; kd.cost += cost; kd.conv += conv; kd.elig += elig; kd.lost += lostW;
    const qs = num(cell(r, col.qs)); if (qs != null) kd.qs = kd.qs == null ? qs : Math.max(kd.qs, qs); // latest/best observed
  }
  const round = (o, keys) => { for (const k of keys) o[k] = Math.round(o[k] * 100) / 100; return o; };
  return {
    campaigns,
    daily: [...daily.values()].map((o) => round(o, ["cost", "conv", "elig", "lost"])).sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : a.c - b.c)),
    keywords: [...kws.values()].map((o) => round(o, ["cost", "conv", "elig", "lost"])),
    rowsRead, unmapped: [...unmapped],
  };
}

export function parseLeads(rows, header, ctx = {}) {
  const col = mapCols(rows[header], COLS.leads);
  const resolveCc = ccResolver(ctx.centreList, ctx.knownCentres);
  const out = [];
  for (let i = header + 1; i < rows.length; i++) {
    const r = rows[i], id = String(cell(r, col.id) ?? "").trim();
    const status = String(cell(r, col.status) ?? "").trim().toLowerCase();
    if (!id || !status) continue;
    const createdRaw = String(cell(r, col.created) ?? "").trim();
    const d = parseDate(createdRaw, ctx.year);
    const tm = createdRaw.match(/(\d{1,2}):(\d{2})/);
    const created = d ? d + (tm ? "T" + pad(+tm[1]) + ":" + tm[2] : "") : null;
    const branch = String(cell(r, col.branch) ?? "").trim();
    let centre = String(cell(r, col.centre) ?? "").trim();
    if (!centre || /⚠/.test(centre)) centre = resolveCc(branch) || branch;
    let week = String(cell(r, col.week) ?? "").trim(); if (!week && d) week = weekOf(d);
    const rec = {
      id: id.replace(/\.0$/, ""), status, reason: String(cell(r, col.reason) ?? "").trim(),
      dept: String(cell(r, col.dept) ?? "").trim() || "Unspecified", centre, priority: String(cell(r, col.priority) ?? "").trim(),
      created, respMin: parseMinutes(cell(r, col.resp)), week,
      doctor: !!String(cell(r, col.doctor) ?? "").trim(),
    };
    if (!ctx.anonymize) rec.agent = String(cell(r, col.agent) ?? "").trim() || "(Unassigned)";
    out.push(rec);
  }
  return out;
}

// Built-in campaign-token → centre mapping (used when a sheet/file has no Centre List tab).
export const DEFAULT_CENTRE_LIST = [
  ["RH_AD_MBZC", "NMC Royal Hospital, Mohammed Bin Zayed City", "Abu Dhabi"], ["RK_AD", "NMC Royal Hospital, Khalifa City", "Abu Dhabi"], ["ROH_AD", "NMC Royal Hospital, Abu Dhabi", "Abu Dhabi"], ["AlAin_EN", "NMC Specialty Hospital, Al Ain", "Abu Dhabi"],
  ["Center_Al_Nahda_Dubai", "NMC Specialty Hospital, Al Nahda, Dubai", "Dubai"], ["PLM_EN", "NMC Royal Medical Centre, The Palm", "Dubai"], ["MAR_EN", "NMC Marina Medical Centre", "Dubai"], ["RH_SH_NE", "NMC Royal Hospital, Sharjah", "Sharjah"],
  ["Ajman_Sun", "NMC Medical Centre, Ajman", "Sunny Clinics"], ["Al_Majaz_Sun", "NMC Medical Centre, Al Majaz", "Sunny Clinics"], ["Al_Nahda_Sun", "NMC Medical Centre, Al Nahda", "Sunny Clinics"], ["Al-Nahda_Sun", "NMC Medical Centre, Al Nahda", "Sunny Clinics"], ["Al_Quoz_Sun", "NMC Medical Centre, Al Quoz", "Sunny Clinics"], ["Buhariah_Sun", "NMC Medical Centre, Buhairah Corniche", "Sunny Clinics"], ["Deira_Sun", "NMC Medical Centre, Deira", "Sunny Clinics"], ["Maysaloon_Sun", "NMC Medical Centre, Maysaloon", "Sunny Clinics"], ["Rolla_Sun", "NMC Medical Centre, Rolla", "Sunny Clinics"], ["Safari_Mall_Sun", "NMC Medical Centre, Safari Mall", "Sunny Clinics"], ["Shahba_Sun", "NMC Medical Centre, Shahba", "Sunny Clinics"], ["Sharqan_Sun", "NMC Medical Centre, Sharqan", "Sunny Clinics"], ["RAK_Sun", "NMC Royal Medical Centre, RAK", "Sunny Clinics"], ["Samnan_Sun", "NMC Royal Medical Centre, Samnan", "Sunny Clinics"],
  ["NMC Royal Hospital Sharjah", "NMC Royal Hospital, Sharjah", "Sharjah"], ["NMC Marina Medical Center", "NMC Marina Medical Centre", "Dubai"], ["NMC Speciality Hospital, Al Ain", "NMC Specialty Hospital, Al Ain", "Abu Dhabi"],
].map(([token, centre, region]) => ({ token, centre, region, ccName: token.includes(" ") ? token : centre }));

// ---------- assemble ----------
/** tabs: [{ name, rows }] — order irrelevant. */
export function buildModel(tabs, opts = {}) {
  const detected = tabs.map((t) => ({ ...t, ...detectKind(t.rows) }));
  const meta = { title: "", period: "", year: null, month: null, dataUpTo: "", tabs: {}, unknownTabs: [] };
  const byKind = (k) => detected.filter((t) => t.kind === k);

  // Budget + centre list first (context for everything else)
  const budget = byKind("budget").flatMap((t) => (meta.tabs.budget = t.name, parseBudget(t.rows, t.header)));
  let centreList = byKind("centreList").flatMap((t) => (meta.tabs.centreList = t.name, parseCentreList(t.rows, t.header)));
  if (!centreList.length) { centreList = DEFAULT_CENTRE_LIST.slice(); meta.defaultCentreList = true; }

  // centre tables: summary (MTD) vs weeks
  let summary = null; const weeks = [];
  for (const t of byKind("centreTable")) {
    const parsed = parseCentreTable(t.rows, t.header);
    const wk = (parsed.title + " " + t.name).match(/week\s*(\d)|\bW(\d)\b/i);
    if (wk && !/mtd|month to date/i.test(parsed.title)) {
      const key = "W" + (wk[1] || wk[2]);
      const range = parsed.subtitle.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})\s*[–\-]\s*(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
      let start = null, end = null, days = null;
      if (range) { start = parseDate(`${range[1]} ${range[2]} ${range[3]}`); end = parseDate(`${range[4]} ${range[5]} ${range[6]}`); days = Math.round((Date.parse(end) - Date.parse(start)) / 864e5) + 1; }
      const label = start && end ? `Week ${key.slice(1)} · ${+start.slice(8)}–${+end.slice(8)} ${MONTH_NAMES[+end.slice(5, 7)].slice(0, 3)}` : `Week ${key.slice(1)}`;
      weeks.push({ key, label, start, end, days, rows: parsed.rows, totals: parsed.totals, tab: t.name });
    } else if (!summary || /mtd|month/i.test(parsed.title)) { summary = parsed; meta.tabs.summary = t.name; }
  }
  weeks.sort((a, b) => a.key.localeCompare(b.key));
  if (summary) {
    meta.title = summary.title.split("|")[0].trim();
    const pm = (summary.title + " " + summary.subtitle).match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+(20\d{2})/i);
    if (pm) { meta.period = `${pm[1]} ${pm[2]}`; meta.year = +pm[2]; meta.month = MONTH_NAMES.findIndex((m) => m.toLowerCase() === pm[1].toLowerCase()); }
    const up = summary.subtitle.match(/data up to\s+(.+)$/i); if (up) meta.dataUpTo = parseDate(up[1].trim(), meta.year) || up[1].trim();
  }
  if (!meta.year) { const anyW = weeks.find((w) => w.start); if (anyW) { meta.year = +anyW.start.slice(0, 4); meta.month = +anyW.start.slice(5, 7); meta.period = `${MONTH_NAMES[meta.month]} ${meta.year}`; } }

  // centres (ordered as the summary lists them; fallback to budget/centre list)
  const centreRegion = {}, centres = [], seen = new Set();
  const push = (name, region) => { if (!name || seen.has(name)) return; seen.add(name); centreRegion[name] = region || centreRegion[name] || ""; centres.push({ name, region: centreRegion[name], account: accountForRegion(centreRegion[name]) || "", budget: null }); };
  for (const r of summary?.rows || []) push(r.centre, r.region);
  for (const w of weeks) for (const r of w.rows) push(r.centre, r.region);
  for (const e of centreList) push(e.centre, e.region);
  for (const b of budget) push(b.centre, null);
  const budgetMap = new Map(budget.map((b) => [b.centre, b.budget]));
  for (const c of centres) { c.budget = budgetMap.get(c.name) ?? (summary?.rows.find((r) => r.centre === c.name)?.budget ?? null); if (!c.account) c.account = accountForRegion(c.region) || ""; }

  const ctx = { centreList, centreRegion, year: meta.year, knownCentres: centres.map((c) => c.name), anonymize: !!opts.anonymize };
  let ads = null; for (const t of byKind("ads")) { ads = parseAds(t.rows, t.header, ctx); meta.tabs.ads = t.name; }
  if (ads) { // fill regions/accounts on campaigns from centre registry
    for (const c of ads.campaigns) { if (!c.region && c.centre) c.region = centreRegion[c.centre] || ""; if (!c.account) c.account = accountForRegion(c.region) || ""; }
    if (!meta.year && ads.daily.length) { meta.year = +ads.daily[0].d.slice(0, 4); meta.month = +ads.daily[0].d.slice(5, 7); meta.period = `${MONTH_NAMES[meta.month]} ${meta.year}`; ctx.year = meta.year; }
  }
  let leads = []; for (const t of byKind("leads")) { leads = parseLeads(t.rows, t.header, ctx); meta.tabs.leads = t.name; }
  let dailyCalls = []; for (const t of byKind("dailyCalls")) { dailyCalls = parseDailyCalls(t.rows, t.header); meta.tabs.dailyCalls = t.name; }
  ctx.shortNames = new Map(centres.map((c) => [norm(shortName(c.name)), c.name]));
  let c2c = [], c2cUnmatched = []; for (const t of byKind("clickToCalls")) { const p = parseClickToCalls(t.rows, t.header, ctx); c2c = c2c.concat(p); c2cUnmatched = c2cUnmatched.concat(p.unmatched); meta.tabs.clickToCalls = t.name; }
  for (const r of c2c) { const c = centres.find((x) => x.name === r.centre); r.account = c?.account || r.account || ""; }
  meta.c2cUnmatched = [...new Set(c2cUnmatched)];
  meta.unknownTabs = byKind("unknown").map((t) => t.name);
  if (!meta.dataUpTo) { const last = ads?.daily.length ? ads.daily[ads.daily.length - 1].d : (dailyCalls.length ? dailyCalls[dailyCalls.length - 1].date : ""); meta.dataUpTo = last; }

  // a dump that runs across several months: label the whole span, not the first month
  if (ads?.daily.length) {
    const f = ads.daily[0].d, l = ads.daily[ads.daily.length - 1].d;
    if (f.slice(0, 7) !== l.slice(0, 7)) { const lab = (d) => `${+d.slice(8)} ${MONTH_NAMES[+d.slice(5, 7)].slice(0, 3)}`; meta.period = `${lab(f)} – ${lab(l)} ${l.slice(0, 4)}`; meta.dataUpTo = l; meta.multiMonth = true; }
  }
  return { meta, centres, summary, weeks, dailyCalls, ads, leads, centreList, c2c };
}
