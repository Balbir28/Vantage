// ============================================================
//  APP CONTROLLER — onboarding flow, audit runner, nav, theme,
//  tooltips, tabs, CSV export.
// ============================================================
import { PAGES, keywords } from "./pages.js";
import * as D from "./data.js";
import { icons } from "./ui.js";
import { STATE, loadState, resetState } from "./state.js";
import { onboardingHTML, progressHTML, runAudit } from "./onboarding.js";
import { domainFromBrand } from "./fetchers.js";

const NAV = [
  { sec: "Overview", items: [
    ["overview", "Executive Overview", icons.exec],
    ["research", "Market Research", icons.search],
  ]},
  { sec: "Paid Media", items: [
    ["adstrategy", "Ad Strategy", icons.ads],
    ["creative", "Creative Intelligence", icons.grid],
    ["keywords", "Keyword Plan", icons.search],
  ]},
  { sec: "Organic & AI", items: [["aeo", "AEO & GEO", icons.spark]] },
  { sec: "Synthesis", items: [
    ["strategist", "Growth Strategist", icons.brain],
    ["playbook", "Playbook & Guide", icons.brain],
  ]},
];

let current = "overview";
let kwBucket = "steal";

const $ = (id) => document.getElementById(id);

function buildNav() {
  $("nav").innerHTML = NAV.map((g) => `
    <div class="navlabel">${g.sec}</div>
    ${g.items.map(([key, label, ic]) => `
      <div class="navitem ${key === current ? "active" : ""}" data-nav="${key}">${ic}<span>${label}</span></div>`).join("")}
  `).join("");
}

function setBrandPill() {
  const name = STATE.ran ? STATE.brand : D.audit.subject.name;
  const logo = STATE.ran && STATE.logo ? `<img src="${STATE.logo}" onerror="this.style.display='none'"/>` : "";
  $("brandpill").innerHTML = `<span class="brandpill">${logo}${name}</span>`;
}

function renderPage() {
  const p = PAGES[current];
  $("title").textContent = p.title;
  const brand = STATE.ran ? STATE.brand : D.audit.subject.name;
  $("subtitle").textContent = `${brand} · ${p.sub}`;
  $("main-body").innerHTML = current === "keywords" ? keywords(kwBucket) : p.fn();
}

// ---------- onboarding ----------
function showOnboard() {
  $("onboard-root").innerHTML = onboardingHTML();
  $("onboard-root").style.display = "block";
  document.querySelector(".app").style.display = "none";
  const brandIn = $("in-brand"), siteIn = $("in-site");
  brandIn.focus();
  brandIn.addEventListener("input", () => {
    if (!siteIn.dataset.touched) siteIn.value = brandIn.value.trim() ? domainFromBrand(brandIn.value) : "";
  });
  siteIn.addEventListener("input", () => { siteIn.dataset.touched = "1"; });
  brandIn.addEventListener("keydown", (e) => { if (e.key === "Enter") start(); });
  $("run-audit").addEventListener("click", start);
}

async function start() {
  const brand = $("in-brand").value.trim();
  if (!brand) { $("in-brand").focus(); $("in-brand").style.borderColor = "var(--coral)"; return; }
  const site = $("in-site").value.trim();
  const comp = $("in-comp").value.trim();
  $("onboard-root").innerHTML = progressHTML();
  $("p-brand") && ($("p-brand").textContent = brand);
  await runAudit(brand, site, comp);
  showApp();
}

function showApp() {
  $("onboard-root").style.display = "none";
  document.querySelector(".app").style.display = "flex";
  current = "overview";
  buildNav();
  setBrandPill();
  renderPage();
  wireTooltips();
  document.querySelector(".main").scrollTop = 0;
}

// ---------- matrix tooltip ----------
const tip = () => $("tip");
function wireTooltips() {
  document.querySelectorAll(".cell").forEach((cell) => {
    cell.addEventListener("mouseenter", () => {
      const d = cell.dataset;
      if (!d.verdict) return;
      const v = { own: "🟢 OWN — you lead", attack: "🔴 ATTACK — white space", contest: "🟡 HOLD — contest/defend", avoid: "⚪ AVOID — saturated" }[d.verdict];
      tip().innerHTML = `<b>${d.angle} × ${d.stage}</b>
        <div class="row"><span>Verdict</span><span>${v}</span></div>
        <div class="row"><span>Owner</span><span>${d.owner}</span></div>
        <div class="row"><span>Saturation</span><span>${Math.round(d.sat * 100)}%</span></div>
        <div class="row"><span>Your position</span><span>${Math.round(d.pos * 100)}%</span></div>
        ${d.note ? `<div style="margin-top:8px;color:var(--text)">${d.note}</div>` : ""}`;
      tip().classList.add("show");
    });
    cell.addEventListener("mousemove", (e) => {
      const w = 260, pad = 16;
      let x = e.clientX + pad; if (x + w > window.innerWidth) x = e.clientX - w - pad;
      tip().style.left = x + "px"; tip().style.top = e.clientY + pad + "px";
    });
    cell.addEventListener("mouseleave", () => tip().classList.remove("show"));
  });
}

// ---------- CSV export ----------
function exportCSV(bucket) {
  const rows = D.keywords[bucket];
  const lines = [["Campaign", "Ad Group", "Keyword", "Match Type", "Max CPC", "Volume", "Intent", "Action"].join(",")];
  rows.forEach((k) => lines.push([`Vantage - ${bucket}`, k.intent, `"${k.kw}"`, bucket === "defend" ? "Exact" : "Phrase", (k.cpc * 1.1).toFixed(2), k.vol, k.intent, `"${k.action}"`].join(",")));
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }));
  a.download = `vantage-keywords-${bucket}.csv`;
  a.click();
}

// ---------- events ----------
function wireEvents() {
  $("nav").addEventListener("click", (e) => {
    const item = e.target.closest("[data-nav]");
    if (!item) return;
    current = item.dataset.nav;
    buildNav(); renderPage(); wireTooltips();
    document.querySelector(".main").scrollTop = 0;
  });
  $("main-body").addEventListener("click", (e) => {
    const tab = e.target.closest("[data-kw]");
    if (tab) { kwBucket = tab.dataset.kw; renderPage(); return; }
    const csv = e.target.closest("[data-export-csv]");
    if (csv) exportCSV(csv.dataset.exportCsv);
  });
  $("new-audit").addEventListener("click", () => { resetState(); showOnboard(); });

  // seamless top-bar brand search → run a fresh audit inline
  $("brand-search").addEventListener("keydown", async (e) => {
    if (e.key !== "Enter") return;
    const brand = e.target.value.trim();
    if (!brand) return;
    e.target.value = "";
    $("onboard-root").innerHTML = progressHTML();
    $("onboard-root").style.display = "block";
    document.querySelector(".app").style.display = "none";
    if ($("p-brand")) $("p-brand").textContent = brand;
    await runAudit(brand, "", "");
    showApp();
  });
  document.querySelectorAll(".themeToggle button").forEach((b) => {
    b.addEventListener("click", () => {
      document.documentElement.setAttribute("data-theme", b.dataset.theme);
      document.querySelectorAll(".themeToggle button").forEach((x) => x.classList.toggle("on", x === b));
      localStorage.setItem("vantage-theme", b.dataset.theme);
    });
  });
}

const mo = new MutationObserver(() => wireTooltips());

function init() {
  const saved = localStorage.getItem("vantage-theme") || "dark";
  document.documentElement.setAttribute("data-theme", saved);
  document.querySelectorAll(".themeToggle button").forEach((x) => x.classList.toggle("on", x.dataset.theme === saved));
  $("sun").innerHTML = icons.sun + " Light";
  $("moon").innerHTML = icons.moon + " Dark";

  wireEvents();
  mo.observe($("main-body"), { childList: true, subtree: true });

  if (loadState()) { showApp(); } else { showOnboard(); }
}

init();
