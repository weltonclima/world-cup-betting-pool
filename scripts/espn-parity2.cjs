// TASK-00 spike — paridade GRUPO com data LOCAL derivada de venue offset (verão 2026).
const fs = require("fs");

const reg = fs.readFileSync("C:/www/world-cup-betting-pool/src/server/copaData/teamRegistry.ts", "utf8");
const codeToName = {};
const re = /"([^"]+)":\s*\{\s*id:\s*"([A-Z]{3})",\s*code:\s*"([A-Z]{3})"/g;
let m;
while ((m = re.exec(reg))) codeToName[m[3]] = m[1];

// offset por cidade-sede (junho/julho 2026, com DST EUA/Canadá; México fixo -6)
const CITY_OFFSET = {
  "Mexico City": -6, "Guadalajara": -6, "Guadalupe": -6,
  "Toronto": -4, "East Rutherford": -4, "Foxborough": -4,
  "Philadelphia": -4, "Atlanta": -4, "Miami Gardens": -4,
  "Inglewood": -7, "Santa Clara": -7, "Vancouver": -7, "Seattle": -7,
  "Houston": -5, "Arlington": -5, "Kansas City": -5,
};
const cityKey = (full) => (full || "").split(",")[0].trim();

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");

const of = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const ofGroupIds = new Set();
for (const mt of of.matches || []) {
  if (mt.num !== undefined || !mt.group) continue;
  ofGroupIds.add(`${mt.date}-${slug(mt.team1)}-${slug(mt.team2)}`);
}

const espn = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
const espnIds = new Set();
let unknownCity = new Set();
for (const ev of espn.events || []) {
  if ((ev.season || {}).slug !== "group-stage") continue;
  const comp = (ev.competitions || [])[0] || {};
  const home = (comp.competitors || []).find((c) => c.homeAway === "home");
  const away = (comp.competitors || []).find((c) => c.homeAway === "away");
  const hName = codeToName[home.team.abbreviation];
  const aName = codeToName[away.team.abbreviation];
  const city = cityKey(((comp.venue || {}).address || {}).city);
  const off = CITY_OFFSET[city];
  if (off === undefined) unknownCity.add(city);
  const localMs = new Date(ev.date).getTime() + (off || 0) * 3600 * 1000;
  const date = new Date(localMs).toISOString().slice(0, 10);
  espnIds.add(`${date}-${slug(hName)}-${slug(aName)}`);
}

console.log("unknown cities:", JSON.stringify([...unknownCity]));
const onlyOf = [...ofGroupIds].filter((id) => !espnIds.has(id));
const onlyEspn = [...espnIds].filter((id) => !ofGroupIds.has(id));
console.log("=== PARITY (local date) ===");
console.log(`MATCHED: ${ofGroupIds.size - onlyOf.length}/${ofGroupIds.size}`);
console.log("ids only in openfootball:", onlyOf.length, onlyOf.slice(0, 6));
console.log("ids only in espn:", onlyEspn.length, onlyEspn.slice(0, 6));
