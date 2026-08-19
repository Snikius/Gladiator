import assert from "node:assert/strict";
import "./reference-data.js";
import "./battle-engine.js";
import "./battle-story.js";

const { BattleEngine, createDefaultBattleInput } = globalThis.GladiatorBattle;
const { buildBattleStoryEntries } = globalThis.GladiatorBattleStory;

const conditionedInput = createDefaultBattleInput();
conditionedInput.fighters[0].buffs = ["bath-effect", "bath-effect", "wine"];
conditionedInput.fighters[0].injuries = ["leg-damage"];
conditionedInput.fighters[0].perks = ["achilles-leap"];
const conditionedResult = new BattleEngine(conditionedInput).simulate();
const initialEntries = buildBattleStoryEntries(conditionedResult, conditionedResult.snapshots[0], 3);
assert.equal(initialEntries.length, 1, "В начале выводятся только бойцы с временными состояниями");
assert.match(initialEntries[0].text, /баффы — Эффект бани ×2, Вино/);
assert.match(initialEntries[0].text, /травмы — Повреждение ноги/);
assert.doesNotMatch(initialEntries[0].text, /Прыжок Ахилла/, "Постоянные перки не входят в игровое резюме");

const traumaInput = createDefaultBattleInput();
traumaInput.fighters.forEach((fighter) => { fighter.perks = []; });
const traumaResult = new BattleEngine(traumaInput).simulate();
const traumaSnapshot = traumaResult.snapshots.find((snapshot) => (
  snapshot.fighters.some((fighter) => fighter.traumas.some((trauma) => trauma.source === "battle"))
));
assert.ok(traumaSnapshot, "Контрольный бой должен содержать боевую травму");
const storyAtTrauma = buildBattleStoryEntries(traumaResult, traumaSnapshot, 10);
const traumaEntries = storyAtTrauma.filter((entry) => entry.kind === "trauma");
assert.equal(traumaEntries.length, 1, "Полученная травма добавляется отдельной строкой один раз");
assert.match(traumaEntries[0].text, /получает травму руки/);
assert.equal(traumaEntries[0].step, traumaSnapshot.step);

const compactStory = buildBattleStoryEntries(traumaResult, traumaSnapshot, 3);
assert.equal(compactStory.length, 3, "Мобильный журнал остаётся компактным");

console.log("OK: battle story includes initial conditions and newly received traumas");
