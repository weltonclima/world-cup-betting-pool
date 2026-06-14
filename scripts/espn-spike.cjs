// TASK-00 spike — throwaway. Inspeciona JSON ESPN salvo em /tmp/full.json.
const fs = require("fs");
const j = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const events = j.events || [];
console.log("events:", events.length);

const e = events[0] || {};
console.log("\n=== first event top keys ===", Object.keys(e));
console.log("id:", e.id, "uid:", e.uid, "date:", e.date);
console.log("season:", JSON.stringify(e.season));
console.log("week:", JSON.stringify(e.week));

const comp = (e.competitions || [])[0] || {};
console.log("\n=== competition keys ===", Object.keys(comp));
console.log("type:", JSON.stringify(comp.type));
console.log("venue:", JSON.stringify(comp.venue));
console.log("notes:", JSON.stringify(comp.notes));
console.log("status:", JSON.stringify(comp.status));

const c0 = (comp.competitors || [])[0] || {};
console.log("\n=== competitor[0] keys ===", Object.keys(c0));
console.log("homeAway:", c0.homeAway, "score:", JSON.stringify(c0.score), "winner:", c0.winner);
console.log("team:", JSON.stringify(c0.team));

// Distribuição de type.abbreviation e contagem de groups
const byType = {};
const dates = events.map((ev) => (ev.date || "").slice(0, 10)).sort();
for (const ev of events) {
  const cp = (ev.competitions || [])[0] || {};
  const k = cp.type ? `${cp.type.id}:${cp.type.abbreviation}` : "?";
  byType[k] = (byType[k] || 0) + 1;
}
console.log("\n=== type distribution ===", JSON.stringify(byType, null, 0));
console.log("date range:", dates[0], "→", dates[dates.length - 1]);
