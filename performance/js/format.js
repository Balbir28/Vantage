// ============================================================
//  FORMAT — number/date formatting shared by pages, charts and chat.
// ============================================================
const nf0 = new Intl.NumberFormat("en-AE", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("en-AE", { maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const isNil = (v) => v == null || !Number.isFinite(v);
export const fmtNum = (v, d = 0) => (isNil(v) ? "—" : d === 0 ? nf0.format(v) : d === 1 ? nf1.format(v) : nf2.format(v));
export const fmtAED = (v, d) => (isNil(v) ? "—" : "AED " + fmtNum(v, d ?? (Math.abs(v) < 100 ? 2 : 0)));
export const fmtAEDc = (v) => (isNil(v) ? "—" : Math.abs(v) >= 1000 ? "AED " + fmtCompact(v) : "AED " + fmtNum(v, Math.abs(v) < 100 ? 2 : 0));
export const fmtPct = (v, d = 1) => (isNil(v) ? "—" : (v * 100).toFixed(d) + "%");
export const fmtDelta = (v, d = 0) => (isNil(v) ? "—" : (v >= 0 ? "+" : "−") + Math.abs(v * 100).toFixed(d) + "%");
export const fmtCompact = (v) => { if (isNil(v)) return "—"; const a = Math.abs(v); if (a >= 1e6) return (v / 1e6).toFixed(2).replace(/\.?0+$/, "") + "M"; if (a >= 1e4) return (v / 1e3).toFixed(1).replace(/\.0$/, "") + "k"; if (a >= 1000) return nf0.format(v); return a < 10 && a !== Math.round(a) ? v.toFixed(1) : nf0.format(v); };
export const fmtMin = (v) => (isNil(v) ? "—" : v < 60 ? Math.round(v) + " min" : v < 1440 ? (v / 60).toFixed(1).replace(/\.0$/, "") + " h" : (v / 1440).toFixed(1) + " d");
export const fmtDate = (iso, opts = { day: "numeric", month: "short" }) => (iso ? new Date(iso.slice(0, 10) + "T00:00:00").toLocaleDateString("en-GB", opts) : "—");
export const fmtDateLong = (iso) => fmtDate(iso, { day: "numeric", month: "long", year: "numeric" });
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const relTime = (iso) => { if (!iso) return ""; const s = (Date.now() - Date.parse(iso)) / 1000; if (s < 60) return "just now"; if (s < 3600) return Math.round(s / 60) + " min ago"; if (s < 86400) return Math.round(s / 3600) + " h ago"; return Math.round(s / 86400) + " d ago"; };
