// ============================================================
//  SHEETS — the Google Sheets + file connector.
//  Three ways to read a sheet, all from the browser, no backend:
//    1. Public link  — "Anyone with the link → Viewer". Uses the gviz CSV
//       endpoint (CORS-enabled). No keys. Tabs are fetched by name or gid.
//    2. API key      — Sheets API v4. Lists every tab automatically; still
//       needs the sheet to be link-shareable.
//    3. Google sign-in — OAuth (needs a Client ID). Works on private sheets.
//  Plus: drag-and-drop of the raw CSV/XLSX exports (Google Ads + CC dump).
// ============================================================
import { parseCSV } from "./csv.js";

export const DEFAULT_TABS = ["Sep MTD Summary", "W1 01-07 Sep", "W2 08-14 Sep", "W3 15-21 Sep", "W4 22-28 Sep", "W5 29-30 Sep", "Daily Calls Trend", "Google Ads Data", "Lead Data", "Budget", "Centre List"];

export function parseSheetUrl(url) {
  const s = String(url || "").trim();
  const id = s.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)?.[1] || (/^[a-zA-Z0-9-_]{25,}$/.test(s) ? s : null);
  const gid = s.match(/[#&?]gid=(\d+)/)?.[1] || null;
  return { id, gid };
}
export const sheetViewUrl = (id, gid) => `https://docs.google.com/spreadsheets/d/${id}/edit${gid ? "#gid=" + gid : ""}`;

const gvizUrl = (id, { name, gid }) => `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&headers=0${gid != null ? `&gid=${gid}` : `&sheet=${encodeURIComponent(name)}`}`;

async function fetchGvizCsv(id, ref) {
  const res = await fetch(gvizUrl(id, ref), { credentials: "omit", redirect: "follow" });
  const text = await res.text();
  if (!res.ok) {
    if (res.status === 400 || res.status === 404) throw new Error("tab-not-found");
    throw new Error(`HTTP ${res.status}`);
  }
  if (/^\s*<(!doctype|html)/i.test(text)) throw new Error("not-public");
  if (/google\.visualization\.Query\.setResponse/.test(text) && /"status":"error"/.test(text)) throw new Error("tab-not-found");
  let rows = parseCSV(text);
  // gviz with headers=0 emits a first line of empty labels — drop it
  if (rows.length && rows[0].every((c) => c === "")) rows = rows.slice(1);
  return rows;
}

const API = "https://sheets.googleapis.com/v4/spreadsheets";
async function apiGet(url, auth) {
  const headers = auth.token ? { Authorization: "Bearer " + auth.token } : {};
  const sep = url.includes("?") ? "&" : "?";
  const res = await fetch(auth.token ? url : `${url}${sep}key=${encodeURIComponent(auth.apiKey)}`, { headers });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) { const msg = j.error?.message || `HTTP ${res.status}`; const e = new Error(msg); e.status = res.status; throw e; }
  return j;
}
export async function listTabs(id, auth) {
  const j = await apiGet(`${API}/${id}?fields=properties.title,sheets.properties(title,sheetId,gridProperties(rowCount,columnCount))`, auth);
  return { title: j.properties?.title || "", tabs: (j.sheets || []).map((s) => ({ name: s.properties.title, gid: String(s.properties.sheetId), rows: s.properties.gridProperties?.rowCount })) };
}
async function fetchTabApi(id, name, auth) {
  const j = await apiGet(`${API}/${id}/values/${encodeURIComponent("'" + name.replace(/'/g, "''") + "'")}?valueRenderOption=FORMATTED_VALUE&majorDimension=ROWS`, auth);
  return (j.values || []).map((r) => r.map((c) => (c == null ? "" : String(c))));
}

/**
 * Fetch a sheet's tabs. opts: { id, gid, tabs:[names], apiKey, token, onProgress(msg, done, total) }
 * Returns { tabs:[{name, rows}], errors:[{name, error}], mode, title }
 */
export async function fetchSheet(opts) {
  const { id, gid, onProgress = () => {} } = opts;
  if (!id) throw new Error("No sheet ID");
  const auth = opts.token ? { token: opts.token } : opts.apiKey ? { apiKey: opts.apiKey } : null;
  const out = { tabs: [], errors: [], mode: auth ? (auth.token ? "oauth" : "apikey") : "public", title: "" };
  let refs;
  if (auth) {
    onProgress("Listing tabs…", 0, 1);
    const l = await listTabs(id, auth); out.title = l.title;
    refs = l.tabs.filter((t) => !/^(read ?me|notes?)$/i.test(t.name)).map((t) => ({ name: t.name }));
  } else {
    refs = (opts.tabs || DEFAULT_TABS).map((name) => ({ name }));
    if (gid && !refs.some((r) => r.gid === gid)) refs.unshift({ name: `gid:${gid}`, gid });
  }
  let done = 0; const total = refs.length;
  const seen = new Set();
  await Promise.all(refs.map(async (ref) => {
    try {
      onProgress(`Reading ${ref.name}…`, done, total);
      const rows = auth ? await fetchTabApi(id, ref.name, auth) : await fetchGvizCsv(id, ref);
      const sig = rows.slice(0, 4).map((r) => r.slice(0, 6).join("|")).join("\n") + rows.length;
      if (!seen.has(sig)) { seen.add(sig); out.tabs.push({ name: ref.name, rows, gid: ref.gid || null }); }
    } catch (e) { out.errors.push({ name: ref.name, error: e.message || String(e) }); }
    finally { done++; onProgress(`Read ${done} of ${total} tabs`, done, total); }
  }));
  return out;
}

export function explainError(err) {
  const m = String(err || "");
  if (/not-public/.test(m)) return "The sheet is not link-shareable. In Google Sheets: Share → General access → “Anyone with the link” → Viewer. Or sign in with Google below for a private sheet.";
  if (/tab-not-found/.test(m)) return "No tab with that name — edit the tab list, or add an API key so tabs are discovered automatically.";
  if (/Failed to fetch|NetworkError|TypeError/.test(m)) return "The browser could not reach Google Sheets (blocked by CORS or a network policy). Check the sheet is link-shareable, or upload the exports instead.";
  if (/403/.test(m)) return "Google refused the request (403). The API key may be restricted, or the sheet is private — use Google sign-in.";
  if (/API key not valid/i.test(m)) return "That API key is not valid for the Sheets API. Enable “Google Sheets API” on the key’s project.";
  return m;
}

// ---------- Google sign-in (OAuth token, private sheets) ----------
let gsiLoaded = null;
function loadGsi() {
  if (gsiLoaded) return gsiLoaded;
  gsiLoaded = new Promise((res, rej) => {
    if (window.google?.accounts?.oauth2) return res();
    const s = document.createElement("script"); s.src = "https://accounts.google.com/gsi/client"; s.async = true; s.onload = () => res(); s.onerror = () => rej(new Error("Could not load Google sign-in")); document.head.appendChild(s);
  });
  return gsiLoaded;
}
export async function googleSignIn(clientId) {
  await loadGsi();
  return new Promise((res, rej) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId, scope: "https://www.googleapis.com/auth/spreadsheets.readonly",
      callback: (r) => (r && r.access_token ? res({ token: r.access_token, expiresAt: Date.now() + (r.expires_in || 3600) * 1000 }) : rej(new Error(r?.error || "Sign-in cancelled"))),
      error_callback: (e) => rej(new Error(e?.message || e?.type || "Sign-in failed")),
    });
    client.requestAccessToken({ prompt: "" });
  });
}

// ---------- local files (CSV / XLSX exports) ----------
let xlsxLoaded = null;
function loadXlsx() {
  if (window.XLSX) return Promise.resolve();
  if (xlsxLoaded) return xlsxLoaded;
  xlsxLoaded = new Promise((res, rej) => { const s = document.createElement("script"); s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"; s.onload = () => res(); s.onerror = () => rej(new Error("Could not load the XLSX reader")); document.head.appendChild(s); });
  return xlsxLoaded;
}
export async function readFiles(files, onProgress = () => {}) {
  const tabs = [], errors = [];
  for (const f of files) {
    onProgress(`Reading ${f.name}…`);
    try {
      if (/\.(csv|tsv|txt)$/i.test(f.name)) {
        let text = await f.text();
        if (/\.tsv$/i.test(f.name) || (text.split("\n")[2] || "").split("\t").length > 5) text = text.split("\n").map((l) => l.split("\t").map((c) => (/[",]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(",")).join("\n");
        tabs.push({ name: f.name.replace(/\.[^.]+$/, ""), rows: parseCSV(text) });
      } else if (/\.(xlsx|xlsm|xls)$/i.test(f.name)) {
        await loadXlsx();
        const wb = window.XLSX.read(await f.arrayBuffer(), { type: "array", cellDates: false });
        for (const name of wb.SheetNames) {
          const rows = window.XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: false, defval: "", blankrows: false });
          if (rows.length > 2) tabs.push({ name, rows: rows.map((r) => r.map((c) => (c == null ? "" : String(c)))) });
        }
      } else errors.push({ name: f.name, error: "Unsupported file type — use .csv or .xlsx" });
    } catch (e) { errors.push({ name: f.name, error: e.message || String(e) }); }
  }
  return { tabs, errors, mode: "files" };
}
