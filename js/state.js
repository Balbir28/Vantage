// ============================================================
//  STATE — the live audit store. Persists to localStorage so a
//  fetched audit survives reloads. Pages read STATE first, then
//  fall back to representative data in data.js.
// ============================================================

export const STATE = {
  ran: false,
  brand: "",
  domain: "",
  logo: "",
  description: "",
  extract: "",
  entity: null,          // { wiki, wikidataId, sitelinks, strength, url }
  cwv: null,             // { perf, lcp, cls, inp }
  competitors: [],       // [{ name, domain, entity, cwv }]
  autoCompetitors: [],   // [names] auto-suggested from the India brand map
  research: null,        // { reddit:[], google:[] } live market-research signals
};

const KEY = "vantage-audit";

export function saveState() {
  try { localStorage.setItem(KEY, JSON.stringify(STATE)); } catch (e) {}
}
export function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return false;
    Object.assign(STATE, JSON.parse(raw));
    return STATE.ran;
  } catch (e) { return false; }
}
export function resetState() {
  try { localStorage.removeItem(KEY); } catch (e) {}
  Object.assign(STATE, { ran: false, brand: "", domain: "", logo: "", description: "", extract: "", entity: null, cwv: null, competitors: [], autoCompetitors: [], research: null });
}
