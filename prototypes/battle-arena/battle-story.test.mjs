import assert from "node:assert/strict";
import "./reference-data.js";
import "./battle-engine.js";
import "./battle-story.js";

const { BattleEngine, createDefaultBattleInput } = globalThis.GladiatorBattle;
const {
  bloodStainGrowthLimit,
  bloodStainProgress,
  bloodSplashVisible,
  buildBattleStoryEntries,
  fighterBloodLevels,
} = globalThis.GladiatorBattleStory;

assert.deepEqual(
  fighterBloodLevels({
    fighters: [
      { health: 210, maxHealth: 210 },
      { health: 126, maxHealth: 180 },
    ],
  }),
  [0, 0],
  "При 70% здоровья пятна ещё не появляются",
);
assert.ok(
  fighterBloodLevels({ fighters: [{ health: 125, maxHealth: 180 }] })[0] > 0,
  "Первое пятно начинает проявляться строго ниже 70% здоровья",
);
assert.deepEqual(
  fighterBloodLevels({ fighters: [{ health: -20, maxHealth: 180 }] }),
  [1],
  "У поверженного бойца интенсивность пятен ограничивается единицей",
);
assert.equal(bloodStainProgress(0.2, 0) > 0, true, "Первое пятно уже растёт на ранней стадии");
assert.equal(bloodStainProgress(0.2, 1), 0, "Второе пятно ещё скрыто");
assert.equal(bloodStainProgress(0.5, 1) > 0, true, "При ухудшении появляется второе пятно");
assert.ok(
  bloodStainProgress(0.5, 0) > bloodStainProgress(0.2, 0),
  "Старое пятно продолжает увеличиваться после появления новых",
);
const growthLimits = ["fighter-1", "fighter-2"].flatMap((fighterId) => (
  [0, 1, 2, 3].map((stainIndex) => bloodStainGrowthLimit(fighterId, stainIndex))
));
assert.equal(
  bloodStainGrowthLimit("fighter-1", 0),
  bloodStainGrowthLimit("fighter-1", 0),
  "Случайно выглядящий предел не меняется между кадрами",
);
assert.ok(growthLimits.every((limit) => limit >= 0.58 && limit <= 1));
assert.ok(new Set(growthLimits).size >= 4, "Пятна получают разные пределы роста");
assert.ok(growthLimits.some((limit) => limit < 0.8), "Часть пятен останавливает рост заметно раньше остальных");
assert.equal(bloodSplashVisible(0, 0), false, "Без ранения угловые брызги скрыты");
assert.equal(bloodSplashVisible(0.1, 0), true, "Первая брызга появляется без дальнейшего роста");
assert.equal(bloodSplashVisible(0.1, 1), false, "Следующая брызга ждёт собственного порога");
assert.equal(bloodSplashVisible(0.7, 2), true, "При тяжёлом состоянии видны все три брызги");

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
traumaInput.seed = "trauma-1";
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
assert.ok(compactStory.length > 0 && compactStory.length <= 3, "Мобильный журнал остаётся компактным");

const playerBuffInput = createDefaultBattleInput();
playerBuffInput.fighters[0].base.strength = 20;
playerBuffInput.fighters[1].base.health = 500;
playerBuffInput.playerBuffCommands = [{
  fighterId: "fighter-1",
  buffDefinitionId: "now",
  afterIteration: 0,
  commandSequence: 1,
}];
const playerBuffResult = new BattleEngine(playerBuffInput).simulate();
const playerBuffSnapshot = playerBuffResult.snapshots.find((snapshot) => snapshot.lastAction?.specialAttack === "player-buff-now");
const playerBuffStory = buildBattleStoryEntries(playerBuffResult, playerBuffSnapshot, 10);
const encouragementEntries = playerBuffStory.filter((entry) => entry.kind === "player-buff");
assert.equal(encouragementEntries.length, 1, "Применённый баф попадает в пользовательский журнал ровно один раз");
assert.equal(encouragementEntries[0].text, "Тит слышит команду игрока: «Сейчас!»");
assert.ok(
  playerBuffStory.findIndex((entry) => entry.kind === "player-buff")
    < playerBuffStory.findIndex((entry) => entry.kind === "action"),
  "Подбадривание записывается перед созданным им усиленным ударом",
);

console.log("OK: battle story includes conditions, encouragements and newly received traumas");
