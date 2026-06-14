// TASK-00 spike — paridade de matchId de GRUPO: openfootball vs ESPN.
const fs = require("fs");

// 1. reverse map code -> openfootball name, parseando teamRegistry.ts
const reg = fs.readFileSync(
  "C:/www/world-cup-betting-pool/src/server/copaData/teamRegistry.ts",
  "utf8",
);
const codeToName = {};
// blocos: "Name": { id: "XXX", code: "XXX",
const re = /"([^"]+)":\s*\{\s*id:\s*"([A-Z]{3})",\s*code:\s*"([A-Z]{3})"/g;
let m;
while ((m = re.exec(reg))) {
  codeToName[m[3]] = m[1];
}
console.log("registry entries parsed:", Object.keys(codeToName).length);

const slug = (s) =>
  s.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");

// 2. openfootball group IDs
const of = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const ofMatches = of.matches || [];
const ofGroupIds = new Set();
let ofGroupCount = 0;
for (const mt of ofMatches) {
  if (mt.num !== undefined) continue; // mata-mata
  if (!mt.group) continue;
  ofGroupCount++;
  ofGroupIds.add(`${mt.date}-${slug(mt.team1)}-${slug(mt.team2)}`);
}
console.log("openfootball group matches:", ofGroupCount);

// 3. ESPN group IDs (date = UTC slice; home=team1)
const espn = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
const espnIds = new Set();
const unmapped = new Set();
let espnGroupCount = 0;
for (const ev of espn.events || []) {
  if ((ev.season || {}).slug !== "group-stage") continue;
  espnGroupCount++;
  const comp = (ev.competitions || [])[0] || {};
  const home = (comp.competitors || []).find((c) => c.homeAway === "home");
  const away = (comp.competitors || []).find((c) => c.homeAway === "away");
  const hAbbr = home && home.team && home.team.abbreviation;
  const aAbbr = away && away.team && away.team.abbreviation;
  const hName = codeToName[hAbbr];
  const aName = codeToName[aAbbr];
  if (!hName) unmapped.add(hAbbr);
  if (!aName) unmapped.add(aAbbr);
  const date = (ev.date || "").slice(0, 10);
  espnIds.add(`${date}-${slug(hName || hAbbr)}-${slug(aName || aAbbr)}`);
}
console.log("espn group events:", espnGroupCount);
console.log("espn abbreviations not in registry:", JSON.stringify([...unmapped]));

// 4. diff
const onlyOf = [...ofGroupIds].filter((id) => !espnIds.has(id));
const onlyEspn = [...espnIds].filter((id) => !ofGroupIds.has(id));
console.log("\n=== PARITY ===");
console.log("ids only in openfootball:", onlyOf.length);
console.log("ids only in espn:", onlyEspn.length);
if (onlyOf.length) console.log("sample OF-only:", onlyOf.slice(0, 8));
if (onlyEspn.length) console.log("sample ESPN-only:", onlyEspn.slice(0, 8));
const match = ofGroupIds.size - onlyOf.length;
console.log(`MATCHED: ${match}/${ofGroupIds.size}`);
