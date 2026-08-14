import assert from "node:assert/strict";
import "./battle-engine.js";

const {
  ARENA_TYPES,
  BattleEngine,
  EQUIPMENT_TYPE_DEFINITIONS,
  INJURY_DEFINITIONS,
  PERK_DEFINITIONS,
  TEMPORARY_PERK_DEFINITIONS,
  createBattleLogExport,
  createDefaultBattleInput,
} = globalThis.GladiatorBattle;

assert.deepEqual(ARENA_TYPES.map((arena) => arena.id), ["normal", "sand"]);
assert.deepEqual(
  EQUIPMENT_TYPE_DEFINITIONS.map((type) => [type.id, type.beats]),
  [["murmillo", "thraex"], ["thraex", "retiarius"], ["retiarius", "murmillo"]],
  "Типы экипировки должны образовывать замкнутый цикл преимуществ",
);
assert.equal(PERK_DEFINITIONS.length, 10, "В прототипе должно быть десять постоянных перков");
assert.equal(TEMPORARY_PERK_DEFINITIONS.length, 7, "Нужно семь временных эффектов");
assert.equal(INJURY_DEFINITIONS.length, 5, "Нужно пять стартовых травм");

const first = new BattleEngine(createDefaultBattleInput()).simulate();
const second = new BattleEngine(createDefaultBattleInput()).simulate();

assert.deepEqual(first, second, "Одинаковый seed должен давать идентичный полный результат");
const defaultMurmillo = first.snapshots[0].fighters[0];
assert.equal(defaultMurmillo.equipmentType, "murmillo");
assert.deepEqual(
  {
    weaponPower: defaultMurmillo.weaponPower,
    armor: defaultMurmillo.armor,
    weight: defaultMurmillo.equipmentWeight,
  },
  { weaponPower: 16, armor: 20, weight: 17 },
  "Специализация Мурмиллона должна изменить боевую копию экипировки",
);
assert.equal(defaultMurmillo.matchup.advantage, true, "Мурмиллон должен иметь преимущество против Фракийца");
assert.equal(defaultMurmillo.matchup.strengthMultiplier, 1.15);
assert.equal(defaultMurmillo.matchup.initiativeBonus, 10);
assert.ok(
  first.events.some((event) => event.type === "perk.activated"
    && event.data.perkId === "murmillo-specialization"
    && event.data.extensionType === "equipment-perk"),
  "Тип экипировки должен создавать отдельный перк специализации",
);
assert.ok(
  first.events.some((event) => event.type === "perk.activated"
    && event.data.perkId === "murmillo-specialization"
    && event.message.includes("Стена скутума")),
  "Мурмиллон должен один раз превратить попадание в блок",
);

const equipmentMechanicsInput = createDefaultBattleInput();
equipmentMechanicsInput.seed = "equipment-mechanics";
equipmentMechanicsInput.maxSteps = 80;
equipmentMechanicsInput.fighters[0].base.health = 300;
equipmentMechanicsInput.fighters[0].equipmentType = "thraex";
equipmentMechanicsInput.fighters[0].perks = [];
equipmentMechanicsInput.fighters[1].base.health = 300;
equipmentMechanicsInput.fighters[1].equipmentType = "retiarius";
equipmentMechanicsInput.fighters[1].perks = [];
const equipmentMechanics = new BattleEngine(equipmentMechanicsInput).simulate();
assert.ok(
  equipmentMechanics.events.some((event) => event.type === "perk.activated"
    && event.data.perkId === "thraex-specialization"
    && event.message.includes("вес инициативы")),
  "Фракиец должен расходовать рывок инициативы после попадания",
);
assert.ok(
  equipmentMechanics.events.some((event) => event.type === "perk.activated"
    && event.data.perkId === "retiarius-specialization"
    && event.message.includes("ход противника перехвачен")),
  "Ретиарий должен один раз перехватить ход сетью",
);
assert.ok(first.steps > 0, "Бой должен содержать хотя бы один шаг");
assert.ok(first.events.some((event) => event.type === "phase.start"), "В логе должны быть начала фаз");
assert.ok(first.events.some((event) => event.type === "phase.finish"), "В логе должны быть результаты фаз");
assert.equal(first.snapshots.length, first.steps + 2, "Нужны начальный, пошаговые и итоговый снимки");
assert.ok(
  first.events.every((event) => event.state?.eventSequence === event.sequence),
  "Каждое событие должно содержать состояние системы после этого события",
);
assert.ok(
  first.events.every((event) => event.state.step === event.step && event.state.phase === event.phase),
  "Состояние события должно соответствовать его шагу и фазе",
);
assert.ok(
  first.events.every((event) => Array.isArray(event.state.extensions)),
  "Состояние события должно включать runtime всех расширений",
);
assert.equal(first.events.at(-1).state.status, "finished", "Последнее событие должно содержать финальное состояние");
assert.notEqual(
  first.events[0].state.fighters[1].health,
  first.events.at(-1).state.fighters[1].health,
  "Ранние состояния журнала не должны изменяться вместе с финальным состоянием",
);
const exportedLog = createBattleLogExport(first, "2026-01-01T00:00:00.000Z");
assert.equal(exportedLog.format, "gladiator.battle-log");
assert.equal(exportedLog.formatVersion, 1);
assert.equal(exportedLog.replay.mode, "state-after-event");
assert.equal(exportedLog.replay.eventCount, first.events.length);
assert.equal(exportedLog.replay.lastSequence, first.events.at(-1).sequence);
assert.doesNotThrow(() => JSON.stringify(exportedLog), "Полный журнал должен сериализоваться в JSON");

const drawInput = createDefaultBattleInput();
drawInput.seed = "forced-draw";
drawInput.maxSteps = 1;
drawInput.fighters.forEach((fighter) => {
  fighter.base.health = 300;
  fighter.base.strength = 1;
  fighter.equipment.weaponPower = 0;
  fighter.equipment.armor = 50;
});
const draw = new BattleEngine(drawInput).simulate();

assert.deepEqual(draw.outcome, { type: "draw", reason: "step_limit" });
assert.ok(draw.fighters.every((fighter) => fighter.battleOutcome === "draw"));

const strongBonesResult = first.fighters.find((fighter) => fighter.id === "fighter-2");
assert.ok(strongBonesResult, "В результате должен присутствовать второй боец");
assert.ok(first.statistics["fighter-2"].perkActivations > 0, "Перк должен пройти через hook интерфейс");

const interceptorInput = createDefaultBattleInput();
interceptorInput.fighters[0].perks = ["turn-interceptor"];
interceptorInput.fighters[1].perks = [];
const intercepted = new BattleEngine(interceptorInput).simulate();
const interceptionEvent = intercepted.events.find(
  (event) => event.type === "perk.activated" && event.data.perkId === "turn-interceptor",
);
assert.ok(interceptionEvent, "Перк должен перехватить результат afterSelectActor");

const redheadInput = createDefaultBattleInput();
redheadInput.fighters[0].perks = ["redhead"];
redheadInput.fighters[1].perks = [];
const redheadResult = new BattleEngine(redheadInput).simulate();
assert.equal(redheadResult.snapshots[0].fighters[0].support, 38, "Рыжий должен понизить харизму на 10");

const skilledInput = createDefaultBattleInput();
skilledInput.fighters[0].perks = ["skilled-warrior"];
skilledInput.fighters[1].perks = [];
const skilledResult = new BattleEngine(skilledInput).simulate();
const armedEvent = skilledResult.events.find(
  (event) => event.type === "perk.hook"
    && event.message === "skilled-warrior.afterAction"
    && event.data.runtimeAfter?.guaranteedNextTurn === true,
);
const guaranteedTurnEvent = skilledResult.events.find(
  (event) => event.type === "perk.hook"
    && event.message === "skilled-warrior.afterSelectActor"
    && event.data.runtimeBefore?.guaranteedNextTurn === true,
);
assert.ok(armedEvent, "Умелый воин должен запомнить право на следующий ход");
assert.equal(
  guaranteedTurnEvent?.data.after.actorId,
  "fighter-1",
  "Умелый воин должен заменить выбранного бойца владельцем перка",
);
assert.equal(
  guaranteedTurnEvent?.data.runtimeAfter.guaranteedNextTurn,
  false,
  "Гарантированный ход должен расходоваться после перехвата выбора",
);

let achillesResult;
let achillesAction;
for (let seedIndex = 0; seedIndex < 100 && !achillesAction; seedIndex += 1) {
  const achillesInput = createDefaultBattleInput();
  achillesInput.seed = `achilles-${seedIndex}`;
  achillesInput.maxSteps = 40;
  achillesInput.fighters[0].base.health = 300;
  achillesInput.fighters[0].perks = ["achilles-leap"];
  achillesInput.fighters[1].base.health = 300;
  achillesInput.fighters[1].perks = [];
  achillesResult = new BattleEngine(achillesInput).simulate();
  achillesAction = achillesResult.snapshots
    .map((snapshot) => snapshot.lastAction)
    .find((action) => action?.attackType === "achilles-leap");
}
assert.ok(achillesAction, "Прыжок Ахилла должен активироваться при броске ниже 10%");
assert.equal(achillesAction.outcome, "hit", "Прыжок Ахилла всегда должен попадать");
assert.equal(achillesAction.strengthMultiplier, 1.5, "Прыжок Ахилла должен давать +50% силы");
assert.equal(achillesAction.unblockable, true, "Прыжок Ахилла нельзя заблокировать");
assert.equal(achillesAction.undodgeable, true, "От Прыжка Ахилла нельзя увернуться");
assert.ok(achillesAction.achillesLeapRoll < 0.1, "Активация должна соответствовать шансу 10%");
assert.deepEqual(
  achillesAction.weights,
  { miss: 0, dodge: 0, block: 0, hit: 1 },
  "Особый удар не должен попадать в обычный выбор промаха, блока или уворота",
);

const slotsInput = createDefaultBattleInput();
slotsInput.fighters[0].perks = ["light-footed", "crowd-favorite", "strong-bones", "cornered-beast"];
const slotted = new BattleEngine(slotsInput).simulate();
assert.equal(slotted.input.fighters[0].perks.length, 3, "Движок должен принимать не более трёх перков");
assert.ok(
  slotted.events.some(
    (event) => event.type === "perk.activated" && event.data.perkId === "light-footed",
  ),
  "Лёгкая поступь должна модифицировать усталость через beforeApplyEffects",
);

const temporaryInput = createDefaultBattleInput();
temporaryInput.fighters[0].temporaryPerks = ["bath-effect", "wine", "bath-effect"];
temporaryInput.fighters[0].injuries = ["leg-damage", "arm-damage", "head-damage"];
const temporaryResult = new BattleEngine(temporaryInput).simulate();
const initialFighter = temporaryResult.snapshots[0].fighters[0];
assert.equal(initialFighter.maxHealth, 151, "Временные эффекты должны суммировать здоровье");
assert.equal(initialFighter.strength, 63.15, "Травма руки должна примениться после экипировки и временных бонусов");
assert.equal(initialFighter.support, 52, "Харизма и травма головы должны менять поддержку");
assert.equal(initialFighter.fatigue, 18, "Стартовая усталость травм должна суммироваться");
assert.equal(initialFighter.traumas.length, 2, "Рука и нога должны стать стартовыми травмами");
assert.equal(initialFighter.temporaryPerks.length, 3, "Повторяющиеся временные эффекты разрешены");
const temporaryFighterResult = temporaryResult.fighters.find((fighter) => fighter.id === "fighter-1");
assert.equal(temporaryFighterResult.startingInjuries.length, 3, "Входные травмы сохраняются отдельно");
assert.ok(
  temporaryFighterResult.finalTraumas.length >= 2,
  "Финальное состояние должно включать стартовые физические травмы",
);
assert.ok(
  temporaryFighterResult.newTraumas.every((trauma) => trauma.source !== "starting-injury"),
  "Стартовые травмы не должны считаться новыми",
);
assert.ok(
  temporaryResult.statistics["fighter-1"].perkActivations >= 6,
  "Статистика должна учитывать стартовые расширения",
);
assert.ok(
  temporaryResult.events.some(
    (event) => event.type === "perk.activated"
      && event.extensionType === "injury"
      && event.data.extensionType === "injury",
  ),
  "Стартовые травмы должны проходить через общий hook-конвейер",
);

console.log(`OK: ${first.steps} шагов, ${first.events.length} событий, ${first.snapshots.length} снимков`);
