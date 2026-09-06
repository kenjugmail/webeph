#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

const source = existsSync("content/scenarios/robust-risk-v1.json")
  ? "content/scenarios/robust-risk-v1.json"
  : "assets/robust-risk-v1.json";
const scenario = JSON.parse(readFileSync(source, "utf8"));
const fail = (message) => { throw new Error(`${source}: ${message}`); };

const unsigned = { ...scenario, content_hash: "" };
const hash = createHash("sha256").update(JSON.stringify(unsigned)).digest("hex");
if (hash !== scenario.content_hash) fail(`content hash ${scenario.content_hash} != ${hash}`);

const environments = Object.fromEntries(scenario.environments.map((environment) => [environment.id, environment]));
const candidates = Object.fromEntries(scenario.candidates.map((candidate) => [candidate.id, candidate]));
for (const id of ["prose", "dialogue", "code"]) if (!environments[id]) fail(`missing environment ${id}`);
for (const id of ["frequency_first", "robust_capacity"]) if (!candidates[id]) fail(`missing candidate ${id}`);

function risks(rareShare) {
  const weights = {
    prose: (1 - rareShare) * scenario.remainder_split.prose,
    dialogue: (1 - rareShare) * scenario.remainder_split.dialogue,
    code: rareShare,
  };
  const aggregate = {};
  for (const candidate of scenario.candidates) {
    const values = Object.keys(weights).map((id) => candidate.losses[id]);
    aggregate[candidate.id] = {
      mean: Object.entries(weights).reduce((sum, [id, weight]) => sum + weight * candidate.losses[id], 0),
      worst: Math.max(...values),
    };
  }
  return aggregate;
}
const selected = (values, objective) => scenario.candidates
  .map(({ id }) => id)
  .sort((a, b) => values[a][objective] - values[b][objective])[0];

const defaults = risks(scenario.prevalence.default);
if (selected(defaults, "mean") !== scenario.expected_checkpoints.default_mean_selected) fail("default mean checkpoint failed");
if (selected(risks(scenario.expected_checkpoints.above_crossover_share), "mean") !== scenario.expected_checkpoints.above_crossover_mean_selected) fail("above-crossover mean checkpoint failed");

for (let share = scenario.prevalence.minimum; share <= scenario.prevalence.maximum + 1e-9; share += scenario.prevalence.step) {
  if (selected(risks(share), "worst") !== scenario.expected_checkpoints.worst_selected) fail(`worst checkpoint failed at ${share.toFixed(2)}`);
}
const frequency = candidates.frequency_first.losses;
const robust = candidates.robust_capacity.losses;
const fragileRemainder = scenario.remainder_split.prose * frequency.prose + scenario.remainder_split.dialogue * frequency.dialogue;
const robustRemainder = scenario.remainder_split.prose * robust.prose + scenario.remainder_split.dialogue * robust.dialogue;
const crossover = (robustRemainder - fragileRemainder)
  / ((frequency.code - fragileRemainder) - (robust.code - robustRemainder));
if (Math.abs(crossover - scenario.expected_checkpoints.break_even_share) > 1e-12) fail(`crossover ${crossover} differs from checkpoint`);

if (existsSync("news-drfsp.html")) {
  const article = readFileSync("news-drfsp.html", "utf8");
  const script = readFileSync("assets/news.js", "utf8");
  const expectArticle = (fragment, label) => {
    if (!article.includes(fragment)) fail(`News article does not pin ${label}`);
  };
  expectArticle(`data-scenario-id="${scenario.id}"`, "scenario id");
  expectArticle(`data-scenario-sha256="${scenario.content_hash}"`, "scenario hash");
  expectArticle(`data-prose-split="${scenario.remainder_split.prose.toFixed(2)}"`, "prose split");
  expectArticle(`data-dialogue-split="${scenario.remainder_split.dialogue.toFixed(2)}"`, "dialogue split");
  for (const candidate of scenario.candidates) {
    expectArticle(`data-risk-candidate="${candidate.id}"`, `${candidate.id} candidate`);
    for (const environment of ["prose", "dialogue", "code"]) {
      expectArticle(`data-loss-${environment}="${candidate.losses[environment].toFixed(2)}"`, `${candidate.id} ${environment} loss`);
    }
  }
  expectArticle(`min="${scenario.prevalence.minimum * 100}" max="${scenario.prevalence.maximum * 100}" step="${scenario.prevalence.step * 100}" value="${scenario.prevalence.default * 100}"`, "prevalence control bounds");
  expectArticle("https://atlas.ephemerent.com/labs/robust-selection#prediction", "Atlas prediction handoff");
  expectArticle("https://atlas.ephemerent.com/open/scenarios/robust-risk-v1.json", "Atlas open scenario handoff");
  if (!script.includes("sessionStorage")) fail("News prediction is not session-local");
  if (/fetch\s*\(|XMLHttpRequest|sendBeacon|\/api\/(progress|evidence|tutor|agent-runs)/.test(script)) fail("News interaction introduces a network or evidence write path");
}

console.log(`robust-risk scenario: ${scenario.id} · sha256 ${hash} · crossover ${crossover.toFixed(6)}`);
