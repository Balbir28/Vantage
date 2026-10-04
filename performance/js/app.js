// ============================================================
//  APP — state, routing, filters, data loading, chat, drawers.
// ============================================================
import { buildModel, ACCOUNTS, ACCOUNT_META } from "./parse.js";
import { computeView, presets, normalizeFilter, shortCentre } from "./analytics.js";
import { generateInsights, executiveSummary, executiveRows } from "./insights.js";
import { initCharts, forgetCharts } from "./charts.js";
import * as P from "./pages.js";
import { fetchSheet, parseSheetUrl, readFiles, explainError, googleSignIn, DEFAULT_TABS } from "./sheets.js";
import { kvGet, kvSet } from "./idb.js";
import { loadSnapshot } from "./pack.js";
import { ask, suggestions, mdToHtml, AI, testProvider } from "./analyst.js";
import { esc, fmtDate, relTime } from "./format.js";

const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const SETTINGS_LS = "vp-settings", CHAT_LS = "vp-chat";
const S = {
  model: null, view: null, insights: [], summary: "", filter: {}, page: "overview", ui: {}, source: { mode: "snapshot" }, chat: [], busy: false,
  settings: { sheetUrl: "", sheetId: "", gid: "", tabs: DEFAULT_TABS.join("\n"), mode: "public", apiKey: "", clientId: "", theme: "light", chatOpen: true, autoSync: true, refreshMin: 15 },
};
const saveSettings = () => { try { localStorage.setItem(SETTINGS_LS, JSON.stringify(S.settings)); } catch (e) {} };
const loadSettings = () => { try { Object.assign(S.settings, JSON.parse(localStorage.getItem(SETTINGS_LS) || "{}")); } catch (e) {} };
let toastT; const toast = (msg, ms = 2600) => { const t = $("#toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), ms); };

// ---------- model & view ----------
function setModel(model, source) {
  S.model = model; S.source = { ...S.source, ...source };
  const f = normalizeFilter(model, { ...S.filter, preset: S.filter.preset || "mtd" });
  if (!S.filter.start || S.filter.preset === "mtd") { const p = presets(model)[0]; f.start = p.start; f.end = p.end; f.preset = "mtd"; }
  S.filter = f; S.ui = {};
  recompute();
}
function recompute() {
  S.view = computeView(S.model, S.filter);
  S.insights = generateInsights(S.view);
  S.summary = executiveSummary(S.view, S.insights);
  S.execRows = executiveRows(S.view, S.insights);
}
let netCache = { key: null, view: null, insights: null };
function networkView() { const key = S.filter.start + "|" + S.filter.end + "|" + (S.source.lastSync || ""); if (netCache.key !== key) { const view = S.filter.account === "all" && !S.filter.centre ? S.view : computeView(S.model, { start: S.filter.start, end: S.filter.end, account: "all", centre: null }); netCache = { key, view, insights: view === S.view ? S.insights : generateInsights(view) }; } return netCache; }
const ctx = () => ({ model: S.model, view: S.view, insights: S.insights, summary: S.summary, execRows: S.execRows, ui: S.ui, settings: S.settings, source: S.source, weeklyFor: (extra) => computeView(S.model, { ...S.filter, ...extra }).trend.weekly, get networkView() { return networkView().view; }, get networkInsights() { return networkView().insights; } });

// ---------- render ----------
function renderShell() {
  $("#nav").innerHTML = P.PAGES.map((p) => `<button data-nav="${p.key}" class="${S.page === p.key ? "on" : ""}">${P.icon(p.icon)}${p.label}${p.key === "actions" ? `<span class="k">${S.insights.filter((i) => i.sev !== "info").length}</span>` : ""}</button>`).join("");
  const src = $("#source"); const live = S.source.mode === "sheet"; src.className = "source" + (live ? " live" : "");
  src.innerHTML = `<span class="dot"></span><b>${live ? "Google Sheets" : S.source.mode === "files" ? "Uploaded files" : "Sample data"}</b><span class="faint">${esc(S.model.meta.period)} · to ${fmtDate(S.model.meta.dataUpTo)}${S.source.lastSync ? " · synced " + relTime(S.source.lastSync) : ""}${live && S.settings.autoSync !== false ? ` · auto every ${S.settings.refreshMin || 15} min` : ""}</span><button class="btn ghost sm" data-open-data>${live ? "Settings" : "Connect"}</button>${S.settings.sheetId ? `<button class="btn ghost sm" data-sync>Sync</button>` : ""}`;
  $$(".theme button").forEach((b) => b.classList.toggle("on", b.dataset.theme === S.settings.theme));
  $("#btn-chat").classList.toggle("on", S.settings.chatOpen);
}
function renderFilters() {
  const pr = presets(S.model), f = S.filter;
  const active = pr.find((p) => p.start === f.start && p.end === f.end);
  $("#f-preset").innerHTML = pr.map((p) => `<option value="${p.key}" ${active?.key === p.key ? "selected" : ""}>${esc(p.label)}</option>`).join("") + `<option value="custom" ${active ? "" : "selected"}>Custom range</option>`;
  const fr = $("#f-from"), to = $("#f-to"); fr.value = f.start; to.value = f.end; fr.min = to.min = S.view.period.first; fr.max = to.max = S.view.period.last;
  $("#f-account").innerHTML = `<option value="all">All ad accounts</option>` + ACCOUNTS.map((a) => `<option value="${esc(a)}" ${f.account === a ? "selected" : ""}>${esc(a)}</option>`).join("");
  const cs = S.model.centres.filter((c) => f.account === "all" || c.account === f.account);
  $("#f-centre").innerHTML = `<option value="">All hospitals${f.account !== "all" ? " in " + ACCOUNT_META[f.account].short : ""}</option>` + cs.map((c) => `<option value="${esc(c.name)}" ${f.centre === c.name ? "selected" : ""}>${esc(shortCentre(c.name))}</option>`).join("");
}
function renderPage() {
  const v = S.view, page = P.PAGES.find((p) => p.key === S.page) || P.PAGES[0];
  const titles = { overview: ["Account <em>overview</em>", "Spend, demand and bookings across the network"], hospitals: ["Hospital <em>intelligence</em>", "Every centre scored on efficiency, bookings, pacing and reach"], campaigns: ["Campaign <em>intelligence</em>", "What to scale, fix and pause — by campaign name"], keywords: ["Keyword <em>intelligence</em>", "Where the clicks go and which ones never convert"], crm: ["Leads & <em>CRM</em>", "From click to booked appointment"], actions: ["Action <em>plan</em>", "Everything the data says to do, ranked by money at stake"], data: ["Data & <em>sources</em>", "What is loaded, what was recognised, how to update"] };
  $("#title").innerHTML = titles[page.key][0]; $("#subtitle").textContent = `${v.scopeLabel} · ${titles[page.key][1]}`;
  forgetCharts();
  const c = ctx();
  $("#page").innerHTML = P[page.key](v, c);
  animateNumbers($("#page"));
  $("#main").scrollTop = 0;
  document.title = `Vantage Pulse — ${page.label}`;
}
function render(all = true) { if (all) { renderShell(); renderFilters(); } renderPage(); renderChips(); }

// ---------- routing & filters ----------
function go(page) { S.page = P.PAGES.some((p) => p.key === page) ? page : "overview"; location.hash = S.page; renderShell(); renderPage(); }
function setFilter(patch) {
  const next = normalizeFilter(S.model, { ...S.filter, ...patch });
  if (patch.account && patch.account !== S.filter.account && !patch.centre) next.centre = null;
  if (patch.preset && patch.preset !== "custom") { const p = presets(S.model).find((x) => x.key === patch.preset); if (p) { next.start = p.start; next.end = p.end; } }
  S.filter = next; recompute(); render(true);
}

// ---------- drawer ----------
function openDrawer(kind, key) {
  const dr = $("#drawer"); dr.dataset.kind = kind; dr.dataset.key = key;
  // if the entity sits outside the current account/hospital filter, show it in the network scope for the same dates
  const inScope = kind === "centre" ? S.view.centres.some((x) => x.name === key) : kind === "campaign" ? S.view.campaigns.some((x) => x.id === +key) : S.view.specialties.some((x) => x.name === key);
  const nv = inScope ? null : networkView();
  const view = nv ? nv.view : S.view;
  const c = { ...ctx(), view, insights: nv ? nv.insights : S.insights, weeklyFor: (extra) => computeView(S.model, { start: S.filter.start, end: S.filter.end, account: "all", centre: null, ...extra }).trend.weekly };
  let d;
  if (kind === "centre") d = P.drawerCentre(key, view, c); else if (kind === "campaign") d = P.drawerCampaign(key, view, c); else d = P.drawerSpecialty(key, view, c);
  $("#drawer-title").textContent = d.title; $("#drawer-sub").innerHTML = (d.sub || "") + (nv ? ` <span class="badge watch" title="This entity is outside the current account/hospital filter">network scope</span>` : ""); $("#drawer-body").innerHTML = d.body;
  $("#drawer").classList.add("open"); $("#drawer-bg").classList.add("open"); $("#drawer").setAttribute("aria-hidden", "false"); $("#drawer-close").focus();
}
function closeDrawer() { $("#drawer").classList.remove("open"); $("#drawer-bg").classList.remove("open"); $("#drawer").setAttribute("aria-hidden", "true"); }

// ---------- chat ----------
function renderChat() {
  const box = $("#chat-msgs");
  box.innerHTML = S.chat.map((m) => m.role === "user" ? `<div class="msg u">${esc(m.content)}</div>` : `<div class="msg a">${mdToHtml(m.content)}${m.meta ? `<span class="meta">${esc(m.meta)}</span>` : ""}</div>`).join("") + (S.busy ? `<div class="msg a typing"><span></span><span></span><span></span></div>` : "");
  box.scrollTop = box.scrollHeight;
  const p = AI.provider; $("#chat-mode").innerHTML = AI.ready ? `<i></i> ${p === "gemini" ? "Gemini" : "Claude"} + live data pack · <a data-open-data>change</a>` : `Computed answers from live data · <a data-open-data>add an AI key</a> for open-ended questions`;
  $("#chat-status").textContent = AI.ready ? "Grounded on the live numbers" : "Local analyst · no key needed";
}
function renderChips() { $("#chat-chips").innerHTML = suggestions(ctx()).map((s) => `<button data-ask="${esc(s)}">${esc(s)}</button>`).join(""); }
async function askChat(q) {
  q = (q || "").trim(); if (!q || S.busy) return;
  S.settings.chatOpen = true; saveSettings(); $("#shell").classList.remove("chat-closed"); $("#btn-chat").classList.add("on");
  S.chat.push({ role: "user", content: q }); S.busy = true; renderChat();
  const hist = S.chat.slice(0, -1).map((m) => ({ role: m.role, content: m.content }));
  const r = await ask(q, hist, ctx());
  S.busy = false;
  S.chat.push({ role: "assistant", content: r.text, meta: (r.source === "local" ? "computed from live data" : r.source === "error" ? "error" : `${r.source} · grounded on the data pack`) + (r.note ? " · " + r.note : "") });
  S.chat = S.chat.slice(-40); try { localStorage.setItem(CHAT_LS, JSON.stringify(S.chat)); } catch (e) {}
  renderChat();
  if (r.open?.centre) openDrawer("centre", r.open.centre); else if (r.open?.campaign != null) openDrawer("campaign", r.open.campaign);
  else if (r.filter) setFilter(r.filter); else if (r.nav && r.nav !== S.page) go(r.nav);
}

// ---------- data modal ----------
function openData() {
  const s = S.settings, m = $("#data-modal");
  $("#d-url").value = s.sheetUrl || ""; $("#d-tabs").value = s.tabs || DEFAULT_TABS.join("\n"); $("#d-apikey").value = s.apiKey || ""; $("#d-clientid").value = s.clientId || ""; $("#d-autosync").checked = s.autoSync !== false; $("#d-refresh").value = s.refreshMin || 15;
  $$("#d-modes button").forEach((b) => b.classList.toggle("on", b.dataset.mode === (s.mode || "public")));
  $$("[data-mode-only]").forEach((el) => (el.style.display = el.dataset.modeOnly.split(",").includes(s.mode || "public") ? "" : "none"));
  $("#d-steps").innerHTML = ""; $("#d-msg").innerHTML = "";
  $("#ai-provider").value = AI.provider; $("#ai-key-gemini").value = AI.key("gemini"); $("#ai-key-claude").value = AI.key("claude"); $("#ai-model-gemini").value = AI.model("gemini"); $("#ai-model-claude").value = AI.model("claude"); aiRows();
  m.classList.add("open"); m.setAttribute("aria-hidden", "false"); $("#d-url").focus();
}
function closeData() { const m = $("#data-modal"); m.classList.remove("open"); m.setAttribute("aria-hidden", "true"); }
function aiRows() { const p = $("#ai-provider").value; $$("[data-ai-only]").forEach((el) => (el.style.display = el.dataset.aiOnly === p ? "" : "none")); }
function steps(list) { $("#d-steps").innerHTML = list.map((s) => `<div class="step ${s.state || ""}"><span class="ic">${s.state === "ok" ? "✓" : s.state === "err" ? "!" : "…"}</span><span>${esc(s.label)}</span></div>`).join(""); }
function adopt(result, sourceMeta) {
  const model = buildModel(result.tabs);
  if (!model.ads && !model.summary) throw new Error("None of the loaded tabs look like a Google Ads keyword export or the month summary. Check the tab names / files.");
  if (!model.meta.year) throw new Error("Could not work out the reporting month from the data.");
  model.meta.source = sourceMeta.mode;
  S.filter = { preset: "mtd" }; setModel(model, { ...sourceMeta, lastSync: new Date().toISOString() });
  kvSet("model", model); kvSet("source", S.source);
  return model;
}
async function syncSheet({ silent = false } = {}) {
  const s = S.settings; const { id, gid } = parseSheetUrl(s.sheetUrl);
  if (!id) { if (!silent) $("#d-msg").innerHTML = `<div class="banner err">Paste a Google Sheets link first.</div>`; return; }
  s.sheetId = id; s.gid = gid || s.gid || ""; saveSettings();
  const prog = []; const onProgress = (label) => { if (silent) return; prog.splice(0, prog.length, { label, state: "run" }); steps(prog); };
  try {
    if (!silent) { $("#d-msg").innerHTML = ""; steps([{ label: "Connecting…", state: "run" }]); }
    let token = null;
    if (s.mode === "oauth") { if (!s.clientId) throw new Error("Add an OAuth Client ID for Google sign-in."); const t = S.token && S.token.expiresAt > Date.now() + 60000 ? S.token : await googleSignIn(s.clientId); S.token = t; token = t.token; }
    const res = await fetchSheet({ id, gid: s.gid, tabs: s.tabs.split("\n").map((x) => x.trim()).filter(Boolean), apiKey: s.mode === "apikey" ? s.apiKey : "", token, onProgress });
    if (!res.tabs.length) throw new Error(res.errors[0] ? explainError(res.errors[0].error) : "No tabs could be read.");
    const model = adopt(res, { mode: "sheet", sheetId: id, gid: s.gid, title: res.title, connection: res.mode });
    if (!silent) { steps([...res.tabs.map((t) => ({ label: `${t.name} → ${Object.entries(model.meta.tabs).find(([, n]) => n === t.name)?.[0] || (model.weeks.find((w) => w.tab === t.name) ? "week tab" : "ignored")}`, state: "ok" })), ...res.errors.map((e) => ({ label: `${e.name}: ${explainError(e.error)}`, state: "err" }))]); $("#d-msg").innerHTML = `<div class="banner ok">Loaded ${esc(model.meta.period)} · ${model.ads?.campaigns.length || 0} campaigns · ${model.leads.length} leads. <button class="btn sm" data-close-data>Open dashboard</button></div>`; }
    render(true); toast(`Synced from Google Sheets · ${model.meta.period}`);
  } catch (e) {
    const msg = explainError(e.message || e); if (!silent) { steps([{ label: msg, state: "err" }]); $("#d-msg").innerHTML = `<div class="banner err">${esc(msg)}</div>`; } else toast("Background sync failed — using cached data", 4000);
  }
}
async function loadFiles(files) {
  if (!files?.length) return;
  steps([{ label: `Reading ${files.length} file(s)…`, state: "run" }]); $("#d-msg").innerHTML = "";
  try {
    const res = await readFiles(files, (l) => steps([{ label: l, state: "run" }]));
    if (!res.tabs.length) throw new Error(res.errors[0]?.error || "No readable tables found.");
    // keep previously loaded tabs of other kinds so partial uploads (just the Ads dump) still work with existing budget/centre list
    const model = adopt(res, { mode: "files", sheetId: "", files: files.map((f) => f.name) });
    steps([...res.tabs.map((t) => ({ label: `${t.name} → ${Object.entries(model.meta.tabs).find(([, n]) => n === t.name)?.[0] || (model.weeks.find((w) => w.tab === t.name) ? "week tab" : "ignored")}`, state: "ok" })), ...res.errors.map((e) => ({ label: `${e.name}: ${e.error}`, state: "err" }))]);
    $("#d-msg").innerHTML = `<div class="banner ok">Loaded ${esc(model.meta.period)} from files · ${model.ads?.campaigns.length || 0} campaigns · ${model.leads.length} leads. <button class="btn sm" data-close-data>Open dashboard</button></div>`;
    render(true); toast("Loaded from files");
  } catch (e) { steps([{ label: e.message, state: "err" }]); }
}

// ---------- events ----------
function bind() {
  document.addEventListener("click", async (e) => {
    const t = e.target.closest("[data-nav],[data-open-centre],[data-open-campaign],[data-open-campaign-name],[data-open-specialty],[data-filter-account],[data-filter-centre],[data-sort],[data-ui-set],[data-ask],[data-copy],[data-copy-plan],[data-open-data],[data-close-data],[data-sync],[data-theme],[data-mode],[data-chat-toggle],[data-chat-clear]");
    if (!t) return;
    const d = t.dataset;
    if (d.nav) return go(d.nav);
    if (d.openCentre) return openDrawer("centre", d.openCentre);
    if (d.openCampaign != null) return openDrawer("campaign", d.openCampaign);
    if (d.openCampaignName) { const c = S.view.campaigns.find((x) => x.name === d.openCampaignName); if (c) return openDrawer("campaign", c.id); toast("Campaign is outside the current filter"); return; }
    if (d.openSpecialty) return openDrawer("specialty", d.openSpecialty);
    if (d.filterAccount) { closeDrawer(); setFilter({ account: S.filter.account === d.filterAccount && !S.filter.centre ? "all" : d.filterAccount, centre: null }); return; }
    if (d.filterCentre) { closeDrawer(); const c = S.model.centres.find((x) => x.name === d.filterCentre); setFilter({ account: c?.account || S.filter.account, centre: d.filterCentre }); return; }
    if (d.sort) { const id = t.closest("table").dataset.table; P.setSort(id, d.sort); if (t.closest("#drawer")) { const kind = $("#drawer").dataset.kind, key = $("#drawer").dataset.key; if (kind) openDrawer(kind, key); } else renderPage(); return; }
    if (d.uiSet) { const [k, v] = d.uiSet.split("="); S.ui[k] = v; renderPage(); return; }
    if (d.ask != null) { askChat(d.ask); return; }
    if (d.copy != null) { try { await navigator.clipboard.writeText(d.copy); toast("Copied"); } catch (err) { toast("Copy failed"); } return; }
    if (d.copyPlan != null) { const plan = S.insights.filter((i) => i.sev !== "info").slice(0, 10).map((i, n) => `${n + 1}. ${i.title}\n   → ${i.action}`).join("\n"); try { await navigator.clipboard.writeText(`Vantage Pulse — action plan · ${S.view.scopeLabel}\n\n${plan}`); toast("Plan copied"); } catch (err) { toast("Copy failed"); } return; }
    if (d.openData != null) return openData();
    if (d.closeData != null) return closeData();
    if (d.sync != null) { toast("Syncing…"); await syncSheet({ silent: true }); return; }
    if (d.theme) { S.settings.theme = d.theme; document.documentElement.dataset.theme = d.theme; saveSettings(); renderShell(); return; }
    if (d.mode) { S.settings.mode = d.mode; saveSettings(); $$("#d-modes button").forEach((b) => b.classList.toggle("on", b === t)); $$("[data-mode-only]").forEach((el) => (el.style.display = el.dataset.modeOnly.split(",").includes(d.mode) ? "" : "none")); return; }
    if (d.chatToggle != null) { S.settings.chatOpen = !S.settings.chatOpen; saveSettings(); $("#shell").classList.toggle("chat-closed", !S.settings.chatOpen); $("#btn-chat").classList.toggle("on", S.settings.chatOpen); return; }
    if (d.chatClear != null) { S.chat = []; try { localStorage.removeItem(CHAT_LS); } catch (err) {} renderChat(); return; }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { closeDrawer(); closeData(); }
    if ((e.key === "Enter" || e.key === " ") && e.target.matches("[data-open-centre],[data-open-campaign],[data-filter-account],.hb-row.clickable,tr.clickable") && !e.target.matches("button,a,input,select,textarea")) { e.preventDefault(); e.target.click(); }
  });
  // search inputs re-render without losing focus
  let deb; document.addEventListener("input", (e) => { const t = e.target; if (!t.dataset.ui) return; S.ui[t.dataset.ui] = t.value; clearTimeout(deb); deb = setTimeout(() => { const key = t.dataset.ui, pos = t.selectionStart; renderPage(); const n = $(`[data-ui="${key}"]`); if (n && n.tagName === "INPUT") { n.focus(); try { n.setSelectionRange(pos, pos); } catch (err) {} } }, t.tagName === "SELECT" ? 0 : 160); });
  document.addEventListener("change", (e) => { const t = e.target; if (t.dataset.ui && t.tagName === "SELECT") { S.ui[t.dataset.ui] = t.value; renderPage(); } });
  // filters
  $("#f-preset").addEventListener("change", (e) => { if (e.target.value === "custom") { $("#f-from").focus(); return; } setFilter({ preset: e.target.value }); });
  $("#f-from").addEventListener("change", (e) => setFilter({ start: e.target.value, end: S.filter.end, preset: "custom" }));
  $("#f-to").addEventListener("change", (e) => setFilter({ start: S.filter.start, end: e.target.value, preset: "custom" }));
  $("#f-account").addEventListener("change", (e) => setFilter({ account: e.target.value, centre: null }));
  $("#f-centre").addEventListener("change", (e) => setFilter({ centre: e.target.value || null }));
  // drawer
  $("#drawer-close").addEventListener("click", closeDrawer); $("#drawer-bg").addEventListener("click", closeDrawer);
  // chat
  const ta = $("#chat-input");
  $("#chat-send").addEventListener("click", () => { askChat(ta.value); ta.value = ""; });
  ta.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); askChat(ta.value); ta.value = ""; } });
  // data modal
  $("#data-modal").addEventListener("click", (e) => { if (e.target === e.currentTarget) closeData(); });
  $("#d-connect").addEventListener("click", async () => { S.settings.sheetUrl = $("#d-url").value.trim(); S.settings.tabs = $("#d-tabs").value; S.settings.apiKey = $("#d-apikey").value.trim(); S.settings.clientId = $("#d-clientid").value.trim(); S.settings.autoSync = $("#d-autosync").checked; S.settings.refreshMin = Math.max(2, +$("#d-refresh").value || 15); saveSettings(); scheduleRefresh(); await syncSheet(); });
  $("#d-sample").addEventListener("click", async () => { const m = await loadSnapshot(); S.filter = { preset: "mtd" }; setModel(m, { mode: "snapshot", sheetId: "", lastSync: null }); kvSet("model", null); kvSet("source", null); render(true); closeData(); toast("Using the bundled sample"); });
  const drop = $("#d-drop"), fileIn = $("#d-file");
  drop.addEventListener("click", () => fileIn.click()); drop.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileIn.click(); } });
  fileIn.addEventListener("change", () => loadFiles([...fileIn.files]));
  ["dragenter", "dragover"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("over"); }));
  ["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("over"); }));
  drop.addEventListener("drop", (e) => loadFiles([...e.dataTransfer.files]));
  document.addEventListener("dragover", (e) => { if (!$("#data-modal").classList.contains("open")) { e.preventDefault(); } });
  document.addEventListener("drop", (e) => { if (!$("#data-modal").classList.contains("open") && e.dataTransfer?.files?.length) { e.preventDefault(); openData(); loadFiles([...e.dataTransfer.files]); } });
  // AI settings
  $("#ai-provider").addEventListener("change", aiRows);
  $("#ai-save").addEventListener("click", () => { AI.set({ provider: $("#ai-provider").value, keys: { gemini: $("#ai-key-gemini").value.trim(), claude: $("#ai-key-claude").value.trim() }, models: { gemini: $("#ai-model-gemini").value.trim() || "gemini-2.0-flash", claude: $("#ai-model-claude").value.trim() || "claude-sonnet-5-5" } }); renderChat(); $("#ai-status").textContent = "Saved"; toast("AI settings saved"); });
  $("#ai-test").addEventListener("click", async () => { const p = $("#ai-provider").value; if (p === "none") { $("#ai-status").textContent = "Pick a provider first"; return; } $("#ai-status").textContent = "Testing…"; try { await testProvider(p, $(`#ai-key-${p}`).value.trim(), $(`#ai-model-${p}`).value.trim()); $("#ai-status").textContent = "✓ Key works"; } catch (e) { $("#ai-status").textContent = "✕ " + e.message; } });
  window.addEventListener("hashchange", () => { const h = location.hash.replace("#", ""); if (h && h !== S.page) { S.page = h; renderShell(); renderPage(); } });
}

// ---------- auto refresh (the daily-paste workflow) ----------
let refreshT;
function scheduleRefresh() {
  clearInterval(refreshT);
  const min = Math.max(2, +S.settings.refreshMin || 15);
  refreshT = setInterval(() => { if (S.settings.autoSync !== false && S.settings.sheetId && S.source.mode === "sheet" && document.visibilityState === "visible") syncSheet({ silent: true }); }, min * 60000);
}
// count-up on the big numbers (CSS-free, respects reduced motion)
function animateNumbers(root) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  root.querySelectorAll(".deck-tile .n, .kpi .v").forEach((el) => {
    const txt = el.firstChild && el.firstChild.nodeType === 3 ? el.firstChild : null; if (!txt) return;
    const m = txt.nodeValue.match(/^(.*?)(\d[\d,]*)(\.\d+)?(.*)$/); if (!m) return;
    const target = parseFloat((m[2] + (m[3] || "")).replace(/,/g, "")), dec = m[3] ? m[3].length - 1 : 0, start = performance.now(), dur = 650;
    const fmt = (v) => m[1] + v.toLocaleString("en-AE", { minimumFractionDigits: dec, maximumFractionDigits: dec }) + m[4];
    const step = (now) => { const p = Math.min(1, (now - start) / dur), e = 1 - Math.pow(1 - p, 3); txt.nodeValue = fmt(target * e); if (p < 1) requestAnimationFrame(step); else txt.nodeValue = m[0]; };
    requestAnimationFrame(step);
  });
}

// ---------- boot ----------
async function boot() {
  loadSettings();
  if (!S.settings.themeV2) { S.settings.theme = "light"; S.settings.themeV2 = true; saveSettings(); }
  if (!("chatOpen" in JSON.parse(localStorage.getItem(SETTINGS_LS) || "{}")) && window.innerWidth < 1100) S.settings.chatOpen = false;
  document.documentElement.dataset.theme = S.settings.theme || "light";
  $("#shell").classList.toggle("chat-closed", S.settings.chatOpen === false);
  try { S.chat = JSON.parse(localStorage.getItem(CHAT_LS) || "[]"); } catch (e) { S.chat = []; }
  S.page = location.hash.replace("#", "") || "overview";
  initCharts(); bind();
  let model = await kvGet("model"), source = (await kvGet("source")) || null;
  if (!model) { model = await loadSnapshot(); source = { mode: "snapshot" }; }
  setModel(model, source || { mode: "snapshot" });
  render(true); renderChat();
  if (!S.chat.length) { S.chat.push({ role: "assistant", content: `Hi — I'm your performance analyst. I'm reading **${S.model.meta.period}** across ${S.model.centres.length} centres and ${S.model.ads?.campaigns.length || 0} campaigns.\n\nAsk me anything, or tap a suggestion below.` }); renderChat(); }
  if (S.settings.autoSync !== false && S.settings.sheetId && S.source.mode === "sheet") syncSheet({ silent: true });
  scheduleRefresh();
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && S.settings.autoSync !== false && S.settings.sheetId && S.source.mode === "sheet" && Date.now() - Date.parse(S.source.lastSync || 0) > 5 * 60000) syncSheet({ silent: true }); });
  window.__vp = { S, go, setFilter, openDrawer, askChat };
}
boot().catch((e) => { console.error(e); $("#page").innerHTML = `<div class="empty"><h3>Could not start</h3>${esc(e.message)}</div>`; });
