// Build performance/data/snapshot*.json from a folder of per-tab CSV exports.
//   node tools/build-snapshot.mjs <folder-of-csvs> [--keep-names] [--full]
// --full keeps zero-activity keyword rows (the default drops them to stay small).
// Each CSV is one tab (filename = tab name). Patient/agent names are dropped
// unless --keep-names is passed — the snapshot ships in a public repo.
import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join, basename, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseCSV } from "../js/csv.js";
import { buildModel } from "../js/parse.js";
import { pack, split } from "../js/pack.js";

const dir = process.argv[2];
if (!dir) { console.error("usage: node tools/build-snapshot.mjs <folder-of-csvs>"); process.exit(1); }
const keep = process.argv.includes("--keep-names");
const tabs = readdirSync(dir).filter((f) => f.toLowerCase().endsWith(".csv")).map((f) => ({ name: basename(f, ".csv"), rows: parseCSV(readFileSync(join(dir, f), "utf8")) }));
const model = buildModel(tabs, { anonymize: !keep });
model.meta.source = "snapshot";
model.meta.builtAt = new Date().toISOString();
const dir_ = join(dirname(fileURLToPath(import.meta.url)), "..", "data");
const { core, parts } = split(pack(model, { slim: !process.argv.includes("--full") }));
writeFileSync(join(dir_, "snapshot.json"), JSON.stringify(core));
for (const [f, obj] of Object.entries(parts)) writeFileSync(join(dir_, f), JSON.stringify(obj));
for (const f of ["snapshot.json", ...Object.keys(parts)]) console.log(`wrote data/${f} (${(statSync(join(dir_, f)).size / 1024).toFixed(0)} KB)`);
console.log("tabs:", model.meta.tabs, "unknown:", model.meta.unknownTabs);
console.log("centres:", model.centres.length, "weeks:", model.weeks.map((w) => w.key).join(","), "campaigns:", model.ads?.campaigns.length, "daily:", model.ads?.daily.length, "kw:", model.ads?.keywords.length, "leads:", model.leads.length, "dailyCalls:", model.dailyCalls.length);
console.log("unmapped campaigns:", model.ads?.unmapped);
