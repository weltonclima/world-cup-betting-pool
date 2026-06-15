// TASK-00 spike parte 2 — stage/group/round digging.
const fs = require("fs");
const j = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const events = j.events || [];
console.log("file:", process.argv[2], "events:", events.length);

// season.slug / type distribution
const bySeason = {};
for (const ev of events) {
  const s = ev.season || {};
  const k = `${s.type}:${s.slug}`;
  bySeason[k] = (bySeason[k] || 0) + 1;
}
console.log("season(type:slug) dist:", JSON.stringify(bySeason));

// procurar qualquer chave contendo "group" ou "round" no primeiro evento, recursivo raso
function findKeys(obj, want, path = "", out = [], depth = 0) {
  if (!obj || typeof obj !== "object" || depth > 4) return out;
  for (const k of Object.keys(obj)) {
    if (k.toLowerCase().includes(want)) out.push(`${path}.${k} = ${JSON.stringify(obj[k]).slice(0, 120)}`);
    findKeys(obj[k], want, `${path}.${k}`, out, depth + 1);
  }
  return out;
}
const e0 = events[0] || {};
console.log("\n'group' keys in event[0]:", JSON.stringify(findKeys(e0, "group"), null, 1));
console.log("\n'round' keys in event[0]:", JSON.stringify(findKeys(e0, "round"), null, 1));
console.log("\n'week' keys in event[0]:", JSON.stringify(findKeys(e0, "week"), null, 1));
console.log("\n'note' keys in event[0]:", JSON.stringify(findKeys(e0, "note"), null, 1));

// shortName / name de uma amostra (pode conter "Group A")
console.log("\nsample name/shortName:");
for (const ev of events.slice(0, 3)) console.log(" ", ev.shortName, "|", ev.name);

// competitor.team.rank/group? olhar groups dentro de competitor
const c0 = ((e0.competitions || [])[0] || {}).competitors || [];
console.log("\ncompetitor extra keys sample:", JSON.stringify(findKeys(c0[0] || {}, "group")));
