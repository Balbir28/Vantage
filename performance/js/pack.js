// ============================================================
//  PACK — compact on-disk form of the model for the bundled sample.
//  Row objects become arrays with a column header; repeated strings become
//  dictionary indexes. unpack() restores the exact model shape parse.js makes.
// ============================================================
const DAILY = ["c", "d", "w", "impr", "clicks", "cost", "conv", "calls", "elig", "lost"];
const KW = ["c", "adgroup", "kw", "match", "w", "qs", "impr", "clicks", "cost", "conv", "elig", "lost"];
const LEAD = ["id", "status", "reason", "dept", "centre", "priority", "created", "respMin", "week", "doctor", "agent"];
const r1 = (x) => Math.round(x * 10) / 10, r2 = (x) => Math.round(x * 100) / 100;

function dict() { const m = new Map(), list = []; return { i: (s) => { s = s ?? ""; let k = m.get(s); if (k == null) { k = list.length; m.set(s, k); list.push(s); } return k; }, list }; }

export function pack(model, { slim = true } = {}) {
  const out = { v: 1, meta: model.meta, centres: model.centres, summary: model.summary, weeks: model.weeks, dailyCalls: model.dailyCalls, centreList: model.centreList, ads: null, leads: null };
  if (model.ads) {
    const ag = dict(), kw = dict(), mt = dict();
    const rows = slim ? model.ads.keywords.filter((k) => k.cost > 0 || k.conv > 0 || k.clicks > 0) : model.ads.keywords;
    out.ads = { campaigns: model.ads.campaigns, unmapped: model.ads.unmapped, rowsRead: model.ads.rowsRead, slim,
      dailyCols: DAILY, daily: model.ads.daily.map((o) => [o.c, +o.d.slice(8, 10), +o.w.slice(1), o.impr, o.clicks, r2(o.cost), r2(o.conv), o.calls, r1(o.elig), r1(o.lost)]),
      kwCols: KW, adgroups: ag.list, kws: kw.list, matches: mt.list,
      keywords: rows.map((o) => [o.c, ag.i(o.adgroup), kw.i(o.kw), mt.i(o.match), +o.w.slice(1), o.qs ?? -1, o.impr, o.clicks, r2(o.cost), r2(o.conv), r1(o.elig), r1(o.lost)]) };
  }
  if (model.leads?.length) {
    const st = dict(), rs = dict(), dp = dict(), ce = dict(), pr = dict(), agn = dict();
    out.leadCols = LEAD; out.leadDict = { status: st.list, reason: rs.list, dept: dp.list, centre: ce.list, priority: pr.list, agent: agn.list };
    out.leads = model.leads.map((l) => [l.id, st.i(l.status), rs.i(l.reason), dp.i(l.dept), ce.i(l.centre), pr.i(l.priority), l.created, l.respMin ?? -1, +(l.week || "W0").slice(1), l.doctor ? 1 : 0, l.agent == null ? -1 : agn.i(l.agent)]);
  }
  return out;
}

export function unpack(p) {
  if (!p || p.v !== 1) return p; // already a plain model
  const y = p.meta.year, mo = String(p.meta.month).padStart(2, "0");
  const model = { meta: p.meta, centres: p.centres, summary: p.summary, weeks: p.weeks, dailyCalls: p.dailyCalls, centreList: p.centreList, ads: null, leads: [] };
  if (p.ads) {
    const a = p.ads;
    model.ads = { campaigns: a.campaigns, unmapped: a.unmapped, rowsRead: a.rowsRead,
      daily: a.daily.map((r) => ({ c: r[0], d: `${y}-${mo}-${String(r[1]).padStart(2, "0")}`, w: "W" + r[2], impr: r[3], clicks: r[4], cost: r[5], conv: r[6], calls: r[7], elig: r[8], lost: r[9] })),
      keywords: a.keywords.map((r) => ({ c: r[0], adgroup: a.adgroups[r[1]], kw: a.kws[r[2]], match: a.matches[r[3]], w: "W" + r[4], qs: r[5] < 0 ? null : r[5], impr: r[6], clicks: r[7], cost: r[8], conv: r[9], elig: r[10], lost: r[11] })) };
  }
  if (p.leads) {
    const d = p.leadDict;
    model.leads = p.leads.map((r) => { const o = { id: r[0], status: d.status[r[1]], reason: d.reason[r[2]], dept: d.dept[r[3]], centre: d.centre[r[4]], priority: d.priority[r[5]], created: r[6], respMin: r[7] < 0 ? null : r[7], week: "W" + r[8], doctor: !!r[9] }; if (r[10] >= 0) o.agent = d.agent[r[10]]; return o; });
  }
  return model;
}

/** Split a packed snapshot into a core file plus large parts (so each file stays small). */
export function split(packed) {
  const core = { ...packed, parts: [] };
  const parts = {};
  if (packed.ads) { core.ads = { ...packed.ads, daily: [], keywords: [] }; parts["snapshot-daily.json"] = { ads: { daily: packed.ads.daily } }; parts["snapshot-keywords.json"] = { ads: { keywords: packed.ads.keywords } }; core.parts.push("snapshot-daily.json", "snapshot-keywords.json"); }
  if (packed.leads) { core.leads = []; parts["snapshot-leads.json"] = { leads: packed.leads }; core.parts.push("snapshot-leads.json"); }
  return { core, parts };
}
export function merge(core, partObjs) {
  const out = { ...core };
  for (const part of partObjs) { if (part.ads) out.ads = { ...out.ads, ...part.ads }; if (part.leads) out.leads = part.leads; }
  delete out.parts; return out;
}
/** Fetch data/snapshot.json (+ parts) and return a plain model. */
export async function loadSnapshot(base = "data/") {
  const core = await fetch(base + "snapshot.json").then((r) => { if (!r.ok) throw new Error("snapshot.json " + r.status); return r.json(); });
  if (!core.parts?.length) return unpack(core);
  const parts = await Promise.all(core.parts.map((f) => fetch(base + f).then((r) => { if (!r.ok) throw new Error(f + " " + r.status); return r.json(); })));
  return unpack(merge(core, parts));
}
