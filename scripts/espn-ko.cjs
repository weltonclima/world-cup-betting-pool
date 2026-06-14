// TASK-00 spike — paridade MATA-MATA: ordem cronológica ESPN reproduz num 73-104?
const fs = require("fs");

const SEASON_TO_STAGE = {
  "round-of-32": "dezesseis-avos",
  "round-of-16": "oitavas",
  "quarterfinals": "quartas",
  "semifinals": "semifinal",
  "3rd-place-match": "terceiro",
  "final": "final",
};
const OF_ROUND_TO_STAGE = {
  "Round of 32": "dezesseis-avos",
  "Round of 16": "oitavas",
  "Quarter-final": "quartas",
  "Semi-final": "semifinal",
  "Match for third place": "terceiro",
  "Final": "final",
};

const of = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const ofKo = (of.matches || [])
  .filter((mt) => mt.num !== undefined)
  .sort((a, b) => a.num - b.num)
  .map((mt) => ({ num: mt.num, date: mt.date, time: mt.time, stage: OF_ROUND_TO_STAGE[mt.round], team1: mt.team1, team2: mt.team2 }));
console.log("openfootball KO matches:", ofKo.length, "nums:", ofKo[0].num, "-", ofKo[ofKo.length - 1].num);

const espn = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
const espnKo = (espn.events || [])
  .filter((ev) => SEASON_TO_STAGE[(ev.season || {}).slug])
  .sort((a, b) => new Date(a.date) - new Date(b.date))
  .map((ev) => {
    const c = (ev.competitions || [])[0] || {};
    const h = (c.competitors || []).find((x) => x.homeAway === "home");
    const aw = (c.competitors || []).find((x) => x.homeAway === "away");
    return { date: ev.date, stage: SEASON_TO_STAGE[(ev.season || {}).slug], short: ev.shortName,
             home: h && h.team && h.team.abbreviation, away: aw && aw.team && aw.team.abbreviation };
  });
console.log("espn KO events:", espnKo.length);

// stage sequence por posição
let stageMatch = 0;
const rows = [];
for (let i = 0; i < Math.max(ofKo.length, espnKo.length); i++) {
  const o = ofKo[i], e = espnKo[i];
  const ok = o && e && o.stage === e.stage;
  if (ok) stageMatch++;
  rows.push(`m${o ? o.num : "?"} of=${o ? o.stage : "?"}(${o?o.date:"?"}) | espn=${e ? e.stage : "?"}(${e?e.date.slice(0,10):"?"} ${e?e.short:""}) ${ok ? "" : "  <-- MISMATCH"}`);
}
console.log(`\nstage sequence match: ${stageMatch}/${ofKo.length}`);
console.log(rows.join("\n"));
