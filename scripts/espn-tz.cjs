// TASK-00 spike — investiga se ESPN dá data local / offset por evento noturno.
const fs = require("fs");
const espn = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const of = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));

// pega um jogo noturno conhecido divergente: South Korea vs Czech (KOR/CZE), 06-11 local
const ev = (espn.events || []).find((e) => {
  const c = (e.competitions || [])[0] || {};
  const ab = (c.competitors || []).map((x) => x.team && x.team.abbreviation).sort().join("-");
  return ab === "CZE-KOR";
});
console.log("=== ESPN evening event raw (KOR/CZE) ===");
const comp = (ev.competitions || [])[0] || {};
console.log("event.date:", ev.date);
console.log("comp.date:", comp.date, "comp.startDate:", comp.startDate);
console.log("status.type:", JSON.stringify((comp.status || {}).type));
console.log("venue:", JSON.stringify(comp.venue));
// procurar qualquer campo de timezone/offset
function findKeys(obj, want, path = "", out = [], depth = 0) {
  if (!obj || typeof obj !== "object" || depth > 5) return out;
  for (const k of Object.keys(obj)) {
    if (k.toLowerCase().includes(want)) out.push(`${path}.${k}=${JSON.stringify(obj[k]).slice(0,80)}`);
    findKeys(obj[k], want, `${path}.${k}`, out, depth + 1);
  }
  return out;
}
console.log("tz/offset keys:", JSON.stringify(findKeys(ev, "zone").concat(findKeys(ev,"offset"),findKeys(ev,"local"))));

// openfootball: mesma partida, mostrar date+time+ground
const ofm = (of.matches || []).find(
  (mt) => !mt.num && ((mt.team1 === "South Korea" && mt.team2 === "Czech Republic") || (mt.team2 === "South Korea" && mt.team1 === "Czech Republic")),
);
console.log("\n=== openfootball same match ===");
console.log("date:", ofm.date, "time:", ofm.time, "ground:", ofm.ground, "team1:", ofm.team1, "team2:", ofm.team2);

// derivar data local a partir do UTC + offset do time string openfootball, ver se casa
console.log("\n=== test: ESPN UTC -> apply venue offset ===");
const utc = new Date(ev.date);
console.log("UTC iso:", utc.toISOString());
for (const off of [-4, -5, -6, -7]) {
  const local = new Date(utc.getTime() + off * 3600 * 1000);
  console.log(`offset ${off}: local date =`, local.toISOString().slice(0, 10));
}
