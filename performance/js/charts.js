// ============================================================
//  CHARTS — dependency-free SVG/HTML chart kit.
//  Thin marks, hairline grid, one axis per chart, legend for ≥2 series,
//  crosshair tooltips on lines, per-mark tooltips on bars/dots. Colours are
//  CSS variables so light/dark are handled by the stylesheet.
// ============================================================
import { esc, fmtNum } from "./format.js";

const REG = new Map(); let seq = 0;
const nid = () => "cv" + (++seq);
export const SERIES = ["var(--s1)", "var(--s2)", "var(--s3)", "var(--s4)", "var(--s5)", "var(--s6)", "var(--s7)", "var(--s8)"];
const scaleNice = (max) => { if (!(max > 0)) return 1; const p = Math.pow(10, Math.floor(Math.log10(max))); const f = max / p; const n = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10; return n * p; };
const ticksFor = (max, n = 4) => { const t = []; for (let i = 0; i <= n; i++) t.push((max * i) / n); return t; };
const fmtTick = (v) => (Math.abs(v) >= 1000 ? (v / 1000).toFixed(v % 1000 ? 1 : 0) + "k" : v % 1 ? v.toFixed(1) : String(v));

/** Line / area chart. series: [{name, color, values:[number|null], dash?}] */
export function lineChart(args) {
  const { labels, series, height = 220, fmt = fmtNum, area = false, highlight = null, xTick = (l, i) => l, yMax = null, markers = true, annotations = [], width = 720, fit = false } = args;
  const id = nid(); const W = width, H = height, padL = 44, padR = 14, padT = 14, padB = 30;
  const n = labels.length; const iw = W - padL - padR, ih = H - padT - padB;
  const max = yMax ?? scaleNice(Math.max(1e-9, ...series.flatMap((s) => s.values.filter((v) => v != null))));
  const x = (i) => padL + (n > 1 ? (i * iw) / (n - 1) : iw / 2), y = (v) => padT + ih - (v / max) * ih;
  let g = "";
  for (const t of ticksFor(max)) g += `<line x1="${padL}" x2="${W - padR}" y1="${y(t).toFixed(1)}" y2="${y(t).toFixed(1)}" class="cv-grid"/><text x="${padL - 8}" y="${(y(t) + 4).toFixed(1)}" class="cv-tick" text-anchor="end">${fmtTick(t)}</text>`;
  if (highlight && n > 1) { const [a, b] = highlight; g += `<rect x="${(x(a) - iw / (n - 1) / 2).toFixed(1)}" y="${padT}" width="${(x(b) - x(a) + iw / (n - 1)).toFixed(1)}" height="${ih}" class="cv-hl"/>`; }
  const step = Math.max(1, Math.ceil(n / 10));
  for (let i = 0; i < n; i++) if (i % step === 0 || i === n - 1) g += `<text x="${x(i).toFixed(1)}" y="${H - 8}" class="cv-tick" text-anchor="middle">${esc(xTick(labels[i], i))}</text>`;
  for (const a of annotations) { if (a.index == null) continue; g += `<line x1="${x(a.index).toFixed(1)}" x2="${x(a.index).toFixed(1)}" y1="${padT}" y2="${padT + ih}" class="cv-annot"/><text x="${(x(a.index) + 4).toFixed(1)}" y="${padT + 10}" class="cv-annot-t">${esc(a.label)}</text>`; }
  series.forEach((s, si) => {
    const color = s.color || SERIES[si]; let d = "", first = true; const pts = [];
    s.values.forEach((v, i) => { if (v == null) { first = true; return; } const px = x(i).toFixed(1), py = y(v).toFixed(1); d += (first ? "M" : "L") + px + " " + py; first = false; pts.push([px, py]); });
    if (area && pts.length > 1) g += `<path d="${d} L${pts[pts.length - 1][0]} ${padT + ih} L${pts[0][0]} ${padT + ih} Z" fill="${color}" opacity="0.10"/>`;
    g += `<path d="${d}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"${s.dash ? ' stroke-dasharray="4 4"' : ""}/>`;
    if (markers && n <= 40) for (const [px, py] of pts) g += `<circle cx="${px}" cy="${py}" r="3" fill="${color}" class="cv-dot"/>`;
  });
  g += `<line class="cv-cross" x1="0" x2="0" y1="${padT}" y2="${padT + ih}" style="display:none"/>`;
  REG.set(id, { type: "line", labels, series, fmt, padL, padR, W, n, args: fit ? args : null });
  const legend = series.length > 1 ? `<div class="cv-legend">${series.map((s, i) => `<span><i style="background:${s.color || SERIES[i]}"></i>${esc(s.name)}</span>`).join("")}</div>` : "";
  return `<div class="cv cv-line${fit ? " cv-fit" : ""}" data-cv="${id}" tabindex="0" role="img" aria-label="${esc(series.map((s) => s.name).join(", "))} over ${n} points"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${g}</svg>${legend}</div>`;
}

/** Vertical bar chart, grouped or stacked. */
export function barChart({ labels, series, height = 220, fmt = fmtNum, stacked = false, xTick = (l) => l, highlight = null, yMax = null }) {
  const id = nid(); const W = 720, H = height, padL = 44, padR = 10, padT = 14, padB = 30;
  const n = labels.length, iw = W - padL - padR, ih = H - padT - padB;
  const tops = labels.map((_, i) => (stacked ? series.reduce((s, sr) => s + (sr.values[i] || 0), 0) : Math.max(...series.map((sr) => sr.values[i] || 0))));
  const max = yMax ?? scaleNice(Math.max(1e-9, ...tops));
  const y = (v) => padT + ih - (v / max) * ih;
  let g = "";
  for (const t of ticksFor(max)) g += `<line x1="${padL}" x2="${W - padR}" y1="${y(t).toFixed(1)}" y2="${y(t).toFixed(1)}" class="cv-grid"/><text x="${padL - 8}" y="${(y(t) + 4).toFixed(1)}" class="cv-tick" text-anchor="end">${fmtTick(t)}</text>`;
  const slot = iw / n, inner = slot * 0.72, gap = 2;
  const step = Math.max(1, Math.ceil(n / 12));
  for (let i = 0; i < n; i++) {
    const x0 = padL + i * slot + (slot - inner) / 2;
    if (highlight && i >= highlight[0] && i <= highlight[1]) g += `<rect x="${(padL + i * slot).toFixed(1)}" y="${padT}" width="${slot.toFixed(1)}" height="${ih}" class="cv-hl"/>`;
    if (i % step === 0 || i === n - 1) g += `<text x="${(padL + i * slot + slot / 2).toFixed(1)}" y="${H - 8}" class="cv-tick" text-anchor="middle">${esc(xTick(labels[i], i))}</text>`;
    if (stacked) { let acc = 0; series.forEach((s, si) => { const v = s.values[i] || 0; if (!v) return; const y1 = y(acc + v), y0 = y(acc); g += `<rect x="${x0.toFixed(1)}" y="${y1.toFixed(1)}" width="${inner.toFixed(1)}" height="${Math.max(0, y0 - y1 - gap).toFixed(1)}" rx="2" fill="${s.color || SERIES[si]}" class="cv-bar" data-i="${i}"/>`; acc += v; }); }
    else { const bw = (inner - gap * (series.length - 1)) / series.length; series.forEach((s, si) => { const v = s.values[i] || 0; const bx = x0 + si * (bw + gap); g += `<rect x="${bx.toFixed(1)}" y="${y(v).toFixed(1)}" width="${bw.toFixed(1)}" height="${(y(0) - y(v)).toFixed(1)}" rx="2" fill="${s.color || SERIES[si]}" class="cv-bar" data-i="${i}"/>`; }); }
  }
  REG.set(id, { type: "bar", labels, series, fmt, padL, padR, W, n });
  const legend = series.length > 1 ? `<div class="cv-legend">${series.map((s, i) => `<span><i style="background:${s.color || SERIES[i]}"></i>${esc(s.name)}</span>`).join("")}</div>` : "";
  return `<div class="cv cv-bar-chart" data-cv="${id}" tabindex="0" role="img" aria-label="${esc(series.map((s) => s.name).join(", "))} by ${n} categories"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${g}</svg>${legend}</div>`;
}

/** Horizontal bars as HTML rows: rows [{label, value, sub, color, href, extra}] */
export function hbars({ rows, fmt = fmtNum, max = null, color = SERIES[0], labelWidth = 150, onClickAttr = null }) {
  const m = max ?? Math.max(1e-9, ...rows.map((r) => Math.abs(r.value || 0)));
  return `<div class="hb">${rows.map((r) => `<div class="hb-row${onClickAttr ? " clickable" : ""}" ${onClickAttr ? `${onClickAttr}="${esc(r.key ?? r.label)}" role="button" tabindex="0"` : ""} style="--lw:${labelWidth}px"><div class="hb-l" title="${esc(r.label)}">${esc(r.label)}${r.sub ? `<small>${esc(r.sub)}</small>` : ""}</div><div class="hb-t"><i style="width:${Math.max(0, Math.min(100, ((r.value || 0) / m) * 100)).toFixed(1)}%;background:${r.color || color}"></i></div><div class="hb-v">${r.display ?? fmt(r.value)}</div>${r.extra ? `<div class="hb-x">${r.extra}</div>` : ""}</div>`).join("")}</div>`;
}

/** Scatter: points [{x, y, r, label, sub, color, key}] */
export function scatter({ points, height = 260, fmtX = fmtNum, fmtY = fmtNum, xLabel = "", yLabel = "", logX = false, refY = null, refX = null }) {
  const id = nid(); const W = 720, H = height, padL = 48, padR = 16, padT = 16, padB = 34;
  const iw = W - padL - padR, ih = H - padT - padB;
  const xs = points.map((p) => p.x), ys = points.map((p) => p.y);
  const tx = (v) => (logX ? Math.log10(Math.max(1, v)) : v);
  const xmin = logX ? Math.min(...xs.map(tx)) : 0, xmax = Math.max(1e-9, ...xs.map(tx)), ymax = scaleNice(Math.max(1e-9, ...ys));
  const X = (v) => padL + ((tx(v) - xmin) / (xmax - xmin || 1)) * iw, Y = (v) => padT + ih - (v / ymax) * ih;
  const rmax = Math.max(1e-9, ...points.map((p) => p.r || 1));
  let g = "";
  for (const t of ticksFor(ymax)) g += `<line x1="${padL}" x2="${W - padR}" y1="${Y(t).toFixed(1)}" y2="${Y(t).toFixed(1)}" class="cv-grid"/><text x="${padL - 8}" y="${(Y(t) + 4).toFixed(1)}" class="cv-tick" text-anchor="end">${fmtTick(t)}</text>`;
  const xt = logX ? [1, 10, 100, 1000, 10000, 100000].filter((v) => tx(v) >= xmin && tx(v) <= xmax) : ticksFor(xmax);
  for (const t of xt) g += `<text x="${X(t).toFixed(1)}" y="${H - 10}" class="cv-tick" text-anchor="middle">${fmtTick(t)}</text>`;
  if (refY != null) g += `<line x1="${padL}" x2="${W - padR}" y1="${Y(refY).toFixed(1)}" y2="${Y(refY).toFixed(1)}" class="cv-ref"/><text x="${W - padR}" y="${(Y(refY) - 4).toFixed(1)}" class="cv-annot-t" text-anchor="end">median ${fmtY(refY)}</text>`;
  if (refX != null) g += `<line y1="${padT}" y2="${padT + ih}" x1="${X(refX).toFixed(1)}" x2="${X(refX).toFixed(1)}" class="cv-ref"/>`;
  g += `<text x="${W - padR}" y="${H - 22}" class="cv-axis" text-anchor="end">${esc(xLabel)}</text><text x="${padL + 4}" y="${padT - 4}" class="cv-axis">${esc(yLabel)}</text>`;
  points.forEach((p, i) => { const r = 5 + 13 * Math.sqrt((p.r || 1) / rmax); g += `<circle cx="${X(p.x).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="${r.toFixed(1)}" fill="${p.color || SERIES[0]}" fill-opacity="0.8" stroke="var(--surface)" stroke-width="2" class="cv-pt" data-i="${i}"/>`; });
  REG.set(id, { type: "scatter", points, fmtX, fmtY, xLabel, yLabel });
  return `<div class="cv cv-scatter" data-cv="${id}" tabindex="0" role="img" aria-label="${esc(yLabel)} against ${esc(xLabel)}"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${g}</svg></div>`;
}

/** Ranked bullet rows: one aligned row per entity — spend bar, CPL bullet vs median, booking rate. */
export function bulletRows({ rows, median, fmtSpend = fmtNum, fmtCpl = fmtNum, onClickAttr = null, cplCap = null }) {
  const maxSpend = Math.max(1e-9, ...rows.map((r) => r.spend || 0));
  const cap = cplCap || Math.max(1e-9, ...rows.map((r) => Math.min(r.cpl || 0, (median || 1e9) * 4)));
  const medPct = median ? Math.min(100, (median / cap) * 100) : null;
  return `<div class="bl"><div class="bl-h"><span>Centre</span><span>Spend</span><span>CPL <small>vs median${median ? " " + fmtCpl(median) : ""}</small></span><span>Booking</span></div>${rows.map((r) => { const cplPct = r.cpl == null ? 0 : Math.min(100, (r.cpl / cap) * 100); const tone = r.cpl == null || !median ? "" : r.cpl <= 0.8 * median ? "good" : r.cpl >= 1.6 * median ? "bad" : "mid"; return `<div class="bl-r${onClickAttr ? " clickable" : ""}" ${onClickAttr ? `${onClickAttr}="${esc(r.key ?? r.label)}" role="button" tabindex="0"` : ""}><div class="bl-l"><i style="background:${r.color}"></i><div><b>${esc(r.label)}</b>${r.sub ? `<small>${esc(r.sub)}</small>` : ""}</div></div><div class="bl-s"><div class="bl-t"><i style="width:${((r.spend || 0) / maxSpend * 100).toFixed(1)}%;background:${r.color}"></i></div><b>${fmtSpend(r.spend)}</b></div><div class="bl-c"><div class="bl-t ${tone}"><i style="width:${cplPct.toFixed(1)}%"></i>${medPct != null ? `<s style="left:${medPct.toFixed(1)}%"></s>` : ""}</div><b class="${tone}">${r.cpl == null ? "—" : fmtCpl(r.cpl)}${r.cpl != null && r.cpl > cap ? " ▸" : ""}</b></div><div class="bl-b"><b>${r.bookingPct == null ? "—" : Math.round(r.bookingPct * 100) + "%"}</b><small>${r.booked ?? 0}/${r.leads ?? 0}</small></div></div>`; }).join("")}</div>`;
}

/** Heatmap grid: rows [{label, values:[]}], cols [labels] */
export function heatmap({ rows, cols, fmt = fmtNum, hue = "var(--seq-rgb)" }) {
  const max = Math.max(1e-9, ...rows.flatMap((r) => r.values.filter((v) => v != null)));
  return `<div class="hm" style="--cols:${cols.length}"><div class="hm-corner"></div>${cols.map((c) => `<div class="hm-ch">${esc(c)}</div>`).join("")}${rows.map((r) => `<div class="hm-rh" title="${esc(r.label)}">${esc(r.label)}</div>${r.values.map((v, i) => { const a = v == null ? 0 : 0.08 + 0.82 * (v / max); return `<div class="hm-c" style="background:rgba(${hue},${a.toFixed(2)})" title="${esc(r.label)} · ${esc(cols[i])}: ${fmt(v)}"><span${a > 0.55 ? ' class="on"' : ""}>${v == null ? "" : fmt(v)}</span></div>`; }).join("")}`).join("")}</div>`;
}

export function sparkline(values, { color = SERIES[0], width = 120, height = 34, area = true, stretch = false } = {}) {
  const v = values.map((x) => x ?? 0), n = v.length; if (n < 2) return "";
  const max = Math.max(1e-9, ...v), min = 0;
  const x = (i) => (i / (n - 1)) * (width - 2) + 1, y = (val) => height - 2 - ((val - min) / (max - min || 1)) * (height - 6);
  const d = v.map((val, i) => (i ? "L" : "M") + x(i).toFixed(1) + " " + y(val).toFixed(1)).join("");
  if (stretch) return `<svg class="spark stretch" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true">${area ? `<path d="${d} L${x(n - 1).toFixed(1)} ${height} L1 ${height} Z" fill="${color}" opacity="0.12"/>` : ""}<path d="${d}" fill="none" stroke="${color}" stroke-width="1.6" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>`;
  return `<svg class="spark" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" aria-hidden="true">${area ? `<path d="${d} L${x(n - 1).toFixed(1)} ${height} L1 ${height} Z" fill="${color}" opacity="0.12"/>` : ""}<path d="${d}" fill="none" stroke="${color}" stroke-width="1.8" stroke-linejoin="round"/><circle cx="${x(n - 1).toFixed(1)}" cy="${y(v[n - 1]).toFixed(1)}" r="2.5" fill="${color}"/></svg>`;
}

export function ring(score, { size = 84, stroke = 7, color = null, label = "" } = {}) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, s = Math.max(0, Math.min(100, score ?? 0));
  const col = color || (s >= 70 ? "var(--good)" : s >= 50 ? "var(--warn)" : "var(--critical)");
  return `<div class="ring" style="width:${size}px;height:${size}px"><svg viewBox="0 0 ${size} ${size}" aria-hidden="true"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--track)" stroke-width="${stroke}"/><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${col}" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${(c * (1 - s / 100)).toFixed(1)}" transform="rotate(-90 ${size / 2} ${size / 2})"/></svg><div class="ring-n"><b>${score == null ? "—" : Math.round(s)}</b>${label ? `<small>${esc(label)}</small>` : ""}</div></div>`;
}

/** 100% stacked bar: segments [{label, value, color}] */
export function stackBar({ segments, fmt = fmtNum }) {
  const tot = segments.reduce((s, x) => s + (x.value || 0), 0) || 1;
  return `<div class="sb"><div class="sb-bar">${segments.filter((s) => s.value > 0).map((s) => `<i style="width:${((s.value / tot) * 100).toFixed(2)}%;background:${s.color}" title="${esc(s.label)}: ${fmt(s.value)} (${((s.value / tot) * 100).toFixed(0)}%)"></i>`).join("")}</div><div class="sb-legend">${segments.map((s) => `<span><i style="background:${s.color}"></i>${esc(s.label)} <b>${fmt(s.value)}</b> <small>${((s.value / tot) * 100).toFixed(0)}%</small></span>`).join("")}</div></div>`;
}

// ---------- interactions (delegated, bound once) ----------
let tip;
function showTip(html, x, y) {
  if (!tip) { tip = document.createElement("div"); tip.className = "cv-tip"; document.body.appendChild(tip); }
  tip.innerHTML = html; tip.style.display = "block";
  const r = tip.getBoundingClientRect(); const px = Math.min(window.innerWidth - r.width - 12, x + 14), py = y - r.height - 14 < 8 ? y + 18 : y - r.height - 14;
  tip.style.left = px + "px"; tip.style.top = py + "px";
}
const hideTip = () => { if (tip) tip.style.display = "none"; };

export function initCharts() {
  if (window.__cvBound) return; window.__cvBound = true;
  document.addEventListener("mousemove", (e) => {
    const host = e.target.closest?.(".cv"); if (!host) { hideTip(); return; }
    const reg = REG.get(host.dataset.cv); if (!reg) return;
    const svg = host.querySelector("svg"), rect = svg.getBoundingClientRect();
    if (reg.type === "line" || reg.type === "bar") {
      const fx = ((e.clientX - rect.left) / rect.width) * reg.W;
      const iw = reg.W - reg.padL - reg.padR;
      let i = reg.type === "line" ? Math.round(((fx - reg.padL) / iw) * (reg.n - 1)) : Math.floor(((fx - reg.padL) / iw) * reg.n);
      i = Math.max(0, Math.min(reg.n - 1, i));
      const cross = svg.querySelector(".cv-cross");
      if (cross) { const x = reg.padL + (reg.n > 1 ? (i * iw) / (reg.n - 1) : iw / 2); cross.setAttribute("x1", x); cross.setAttribute("x2", x); cross.style.display = ""; }
      svg.querySelectorAll(".cv-bar").forEach((b) => b.classList.toggle("on", +b.dataset.i === i));
      const rows = reg.series.map((s, si) => `<div class="row"><span><i style="background:${s.color || SERIES[si]}"></i>${esc(s.name)}</span><b>${s.values[i] == null ? "—" : reg.fmt(s.values[i], i)}</b></div>`).join("");
      showTip(`<div class="t">${esc(reg.labels[i])}</div>${rows}`, e.clientX, e.clientY);
    } else if (reg.type === "scatter") {
      const pt = e.target.closest(".cv-pt"); if (!pt) { hideTip(); return; }
      const p = reg.points[+pt.dataset.i];
      showTip(`<div class="t">${esc(p.label)}</div>${p.sub ? `<div class="s">${esc(p.sub)}</div>` : ""}<div class="row"><span>${esc(reg.xLabel)}</span><b>${reg.fmtX(p.x)}</b></div><div class="row"><span>${esc(reg.yLabel)}</span><b>${reg.fmtY(p.y)}</b></div>${p.rLabel ? `<div class="row"><span>${esc(p.rLabel)}</span><b>${fmtNum(p.r)}</b></div>` : ""}`, e.clientX, e.clientY);
    }
  });
  document.addEventListener("mouseleave", hideTip, true);
  document.addEventListener("scroll", hideTip, true);
  document.addEventListener("mouseout", (e) => { if (e.target.closest?.(".cv") && !e.relatedTarget?.closest?.(".cv")) { hideTip(); document.querySelectorAll(".cv-cross").forEach((c) => (c.style.display = "none")); document.querySelectorAll(".cv-bar.on").forEach((b) => b.classList.remove("on")); } });
}
export function forgetCharts() { REG.clear(); }

/** Re-draw `fit` line charts at their real pixel width, so the height stays fixed
 *  and the axis text stays at its CSS size instead of scaling with the card. */
export function fitCharts(root = document) {
  root.querySelectorAll(".cv-fit").forEach((host) => {
    const reg = REG.get(host.dataset.cv); if (!reg?.args) return;
    const w = Math.round(host.clientWidth); if (!w || Math.abs(w - reg.W) < 4) return;
    REG.delete(host.dataset.cv);
    host.outerHTML = lineChart({ ...reg.args, width: w });
  });
}
let fitRaf = 0;
if (typeof window !== "undefined") window.addEventListener("resize", () => { cancelAnimationFrame(fitRaf); fitRaf = requestAnimationFrame(() => fitCharts()); });
if (typeof ResizeObserver !== "undefined") {
  const ro = new ResizeObserver(() => { cancelAnimationFrame(fitRaf); fitRaf = requestAnimationFrame(() => fitCharts()); });
  const watch = () => { const m = document.getElementById("main"); if (m) ro.observe(m); };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", watch); else watch();
}
