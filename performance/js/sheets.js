// ============================================================
// SHEETS — the Google Sheets + file connector.
// Every mode now finds the tabs by itself — no tab names to type.
//
// 1. Public link — "Anyone with the link → Viewer". No keys.
//    a) Downloads the whole workbook once as .xlsx (export endpoint,
//       CORS-enabled) and reads EVERY tab.
//    b) Fallback: reads the tab list (names + gids) from the sheet's
//       htmlview page, then each tab as CSV via the export endpoint.
//    c) Last resort: gviz CSV by name (only if tab names were given).
// 2. API key — Sheets API v4. Lists every tab automatically.
// 3. Google sign-in — OAuth (needs a Client ID). Works on private sheets.
// Plus: drag-and-drop of the raw CSV/XLSX exports (Google Ads + CC dump).
//
// Tabs are recognised by their header rows (parse.js → detectKind),
// so names, order, month and extra tabs don't matter.
// ============================================================
import { parseCSV } from "./csv.js";

// Kept for backwards compatibility — tab names are no longer needed.
export const DEFAULT_TABS = [];

const SKIP_TAB = /^(read ?me|notes?|instructions?|changelog|archive)$/i;

export function parseSheetUrl(url) {
  const s = String(url || "").trim();
  const id = s.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)?.[1] || (/^[a-zA-Z0-9-_]{25,}$/.test(s) ? s : null);
  const gid = s.match(/[#&?]gid=(\d+)/)?.[1] || null;
  return { id, gid };
}
export const sheetViewUrl = (id, gid) => `https://docs.google.com/spreadsheets/d/${id}/edit${gid ? "#gid=" + gid : ""}`;

const DOCS = (id) => `https://docs.google.com/spreadsheets/d/${id}`;

/** Normalise any grid: strings only, trailing empties trimmed, fully blank rows dropped (same shape as the .xlsx reader). */
function cleanRows(rows) {
  const out = [];
  for (const r of rows || []) {
    if (!Array.isArray(r)) continue;
    const row = r.map((c) => (c == null ? "" : String(c)));
    while (row.length && row[row.length - 1].trim() === "") row.pop();
    if (row.length) out.push(row);
  }
  return out;
}
const looksHtml = (text) => /^\s*<(!doctype|html)/i.test(text);

// ---------- public link: whole workbook as .xlsx ----------
let xlsxLoaded = null;
function loadXlsx() {
  if (window.XLSX) return Promise.resolve();
  if (xlsxLoaded) return xlsxLoaded;
  xlsxLoaded = new Promise((res, rej) => { const s = document.createElement("script"); s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"; s.onload = () => res(); s.onerror = () => { xlsxLoaded = null; rej(new Error("Could not load the XLSX reader")); }; document.head.appendChild(s); });
  return xlsxLoaded;
}
function workbookToTabs(wb) {
  const tabs = [];
  for (const name of wb.SheetNames) {
    if (SKIP_TAB.test(name.trim())) continue;
    const rows = cleanRows(window.XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: false, defval: "", blankrows: false }));
    if (rows.length > 2) tabs.push({ name, rows, gid: null });
  }
  return tabs;
}
async function fetchWorkbookXlsx(id, onProgress) {
  onProgress("Downloading the workbook…", 0, 2);
  const [res] = await Promise.all([fetch(`${DOCS(id)}/export?format=xlsx`, { credentials: "omit", redirect: "follow" }), loadXlsx()]);
  if (!res.ok) throw new Error(res.status === 401 || res.status === 403 ? "not-public" : `HTTP ${res.status}`);
  const buf = await res.arrayBuffer();
  const head = new Uint8Array(buf.slice(0, 2));
  if (!(head[0] === 0x50 && head[1] === 0x4b)) { // not a zip → Google sent a sign-in page
    if (looksHtml(new TextDecoder().decode(buf.slice(0, 200)))) throw new Error("not-public");
    throw new Error("unexpected-file");
  }
  onProgress("Reading every tab…", 1, 2);
  const wb = window.XLSX.read(buf, { type: "array", cellDates: false });
  return workbookToTabs(wb);
}

// ---------- public link fallback: discover tabs, then CSV per tab ----------
async function listTabsPublic(id) {
  const res = await fetch(`${DOCS(id)}/htmlview`, { credentials: "omit" });
  const html = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const tabs = [], seen = new Set();
  for (const m of html.matchAll(/\{name:\s*"((?:[^"\\]|\\.)*)"[^}]*?gid:\s*"(\d+)"/g)) {
    const name = m[1].replace(/\\u([0-9a-f]{4})/gi, (_, h) => String.fromCharCode(parseInt(h, 16))).replace(/\\(.)/g, "$1");
    if (!seen.has(m[2])) { seen.add(m[2]); tabs.push({ name, gid: m[2] }); }
  }
  if (!tabs.length && /accounts\.google\.com|ServiceLogin/i.test(html)) throw new Error("not-public");
  return tabs;
}
async function fetchCsvExport(id, gid) {
  const res = await fetch(`${DOCS(id)}/export?format=csv&gid=${gid}`, { credentials: "omit", redirect: "follow" });
  const text = await res.text();
  if (!res.ok) throw new Error(res.status === 400 || res.status === 404 ? "tab-not-found" : `HTTP ${res.status}`);
  if (looksHtml(text)) throw new Error("not-public");
  return cleanRows(parseCSV(text));
}

// ---------- last resort: gviz by name ----------
const gvizUrl = (id, { name, gid }) => `${DOCS(id)}/gviz/tq?tqx=out:csv&headers=0${gid != null ? `&gid=${gid}` : `&sheet=${encodeURIComponent(name)}`}`;
async function fetchGvizCsv(id, ref) {
  const res = await fetch(gvizUrl(id, ref), { credentials: "omit", redirect: "follow" });
  const text = await res.text();
  if (!res.ok) {
    if (res.status === 400 || res.status === 404) throw new Error("tab-not-found");
    throw new Error(`HTTP ${res.status}`);
  }
  if (looksHtml(text)) throw new Error("not-public");
  if (/google\.visualization\.Query\.setResponse/.test(text) && /"status":"error"/.test(text)) throw new Error("tab-not-found");
  return cleanRows(parseCSV(text));
}

// ---------- API key / OAuth ----------
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
  return cleanRows(j.values || []);
}

/** Read a list of refs in parallel with a fetcher; de-duplicates identical tabs. */
async function readRefs(refs, fetcher, out, onProgress) {
  let done = 0; const total = refs.length; const seen = new Set();
  await Promise.all(refs.map(async (ref) => {
    try {
      onProgress(`Reading ${ref.name}…`, done, total);
      const rows = await fetcher(ref);
      if (rows.length <= 2) return;
      const sig = rows.slice(0, 4).map((r) => r.slice(0, 6).join("|")).join("\n") + rows.length;
      if (!seen.has(sig)) { seen.add(sig); out.tabs.push({ name: ref.name, rows, gid: ref.gid || null }); }
    } catch (e) { out.errors.push({ name: ref.name, error: e.message || String(e) }); }
    finally { done++; onProgress(`Read ${done} of ${total} tabs`, done, total); }
  }));
}

/**
 * Fetch every tab of a sheet. opts: { id, gid, tabs?:[names], apiKey, token, onProgress(msg, done, total) }
 * Returns { tabs:[{name, rows}], errors:[{name, error}], mode, title }
 */
export async function fetchSheet(opts) {
  const { id, onProgress = () => {} } = opts;
  if (!id) throw new Error("No sheet ID");
  const auth = opts.token ? { token: opts.token } : opts.apiKey ? { apiKey: opts.apiKey } : null;
  const out = { tabs: [], errors: [], mode: auth ? (auth.token ? "oauth" : "apikey") : "public", title: "" };

  if (auth) {
    onProgress("Listing tabs…", 0, 1);
    const l = await listTabs(id, auth); out.title = l.title;
    const refs = l.tabs.filter((t) => !SKIP_TAB.test(t.name.trim()));
    await readRefs(refs, (ref) => fetchTabApi(id, ref.name, auth), out, onProgress);
    return out;
  }

  // 1) whole workbook in one request
  try {
    out.tabs = await fetchWorkbookXlsx(id, onProgress);
    out.mode = "public";
    if (out.tabs.length) return out;
  } catch (e) {
    if (/not-public/.test(e.message)) throw e; // no point trying the other routes
    out.errors.push({ name: "Workbook download", error: e.message || String(e) });
  }

  // 2) discover tab list, then CSV per tab
  let refs = [];
  try { refs = (await listTabsPublic(id)).filter((t) => !SKIP_TAB.test(t.name.trim())); }
  catch (e) { if (/not-public/.test(e.message)) throw e; out.errors.push({ name: "Tab list", error: e.message || String(e) }); }
  if (refs.length) {
    await readRefs(refs, (ref) => fetchCsvExport(id, ref.gid), out, onProgress);
    if (out.tabs.length) { out.errors = out.errors.filter((x) => !/^(Workbook download|Tab list)$/.test(x.name)); return out; }
  }

  // 3) last resort: gviz by the names the user typed (if any) or the gid in the link
  const named = (opts.tabs || []).map((name) => ({ name }));
  if (opts.gid && !named.some((r) => r.gid === opts.gid)) named.unshift({ name: `gid:${opts.gid}`, gid: opts.gid });
  if (named.length) await readRefs(named, (ref) => fetchGvizCsv(id, ref), out, onProgress);
  return out;
}

export function explainError(err) {
  const m = String(err || "");
  if (/not-public/.test(m)) return "The sheet is not link-shareable. In Google Sheets: Share → General access → “Anyone with the link” → Viewer. Or sign in with Google below for a private sheet.";
  if (/unexpected-file/.test(m)) return "Google returned something other than the workbook. Open the link in a browser to check it is a Google Sheet (not an uploaded .xlsx — use File → Save as Google Sheets).";
  if (/tab-not-found/.test(m)) return "A tab could not be read. Check the sheet is shared as “Anyone with the link → Viewer”.";
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
export async function readFiles(files, onProgress = () => {}) {
  const tabs = [], errors = [];
  for (const f of files) {
    onProgress(`Reading ${f.name}…`);
    try {
      if (/\.(csv|tsv|txt)$/i.test(f.name)) {
        let text = await f.text();
        if (/\.tsv$/i.test(f.name) || (text.split("\n")[2] || "").split("\t").length > 5) text = text.split("\n").map((l) => l.split("\t").map((c) => (/[",]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(",")).join("\n");
        tabs.push({ name: f.name.replace(/\.[^.]+$/, ""), rows: cleanRows(parseCSV(text)) });
      } else if (/\.(xlsx|xlsm|xls)$/i.test(f.name)) {
        await loadXlsx();
        const wb = window.XLSX.read(await f.arrayBuffer(), { type: "array", cellDates: false });
        tabs.push(...workbookToTabs(wb));
      } else errors.push({ name: f.name, error: "Unsupported file type — use .csv or .xlsx" });
    } catch (e) { errors.push({ name: f.name, error: e.message || String(e) }); }
  }
  return { tabs, errors, mode: "files" };
}
