import assert from "node:assert/strict";
import "./reference-data.js";
import "./battle-engine.js";

const {
  ARENA_TYPES,
  BattleEngine,
  BattleModifierManager,
  COMBAT_RULES,
  FIGHTER_CLASS_DEFINITIONS,
  INJURY_DEFINITIONS,
  MAX_ARENA_MULTIPLIER,
  MAX_BASE_ATTRIBUTE,
  MAX_BASE_HEALTH,
  MAX_BATTLE_STEPS,
  PERK_DEFINITIONS,
  BUFF_DEFINITIONS,
  calculateTraumaChance,
  createBattleLogExport,
  createDefaultBattleInput,
} = globalThis.GladiatorBattle;

assert.deepEqual(ARENA_TYPES.map((arena) => arena.id), ["crowd", "normal", "sand"]);
assert.deepEqual(
  FIGHTER_CLASS_DEFINITIONS.map((type) => [type.id, type.beats]),
  [["murmillo", "thraex"], ["thraex", "hoplomachus"], ["retiarius", "murmillo"], ["secutor", "retiarius"], ["hoplomachus", "secutor"]],
  "Пять классов должны образовывать замкнутый цикл преимуществ",
);
assert.equal(PERK_DEFINITIONS.length, 10, "В прототипе должно быть десять постоянных перков");
assert.equal(BUFF_DEFINITIONS.length, 7, "Нужно семь временных эффектов");
assert.equal(INJURY_DEFINITIONS.length, 5, "Нужно пять стартовых травм");
assert.equal(typeof BattleModifierManager, "function", "BattleModifierManager должен быть публичной частью прототипа");

const first = new BattleEngine(createDefaultBattleInput()).simulate();
const second = new BattleEngine(createDefaultBattleInput()).simulate();

assert.deepEqual(first, second, "Одинаковый seed должен давать идентичный полный результат");
assert.equal(first.input.arena.type, "crowd", "Новый бой по умолчанию проходит на арене со зрителями");
assert.deepEqual(
  first.input.fighters.map((fighter) => fighter.base.health),
  [210, 180],
  "Стартовое здоровье бойцов по умолчанию зафиксировано отдельно для каждого",
);
assert.equal(MAX_BASE_HEALTH, 500, "Предельное базовое здоровье равно 500");
const cappedHealthInput = createDefaultBattleInput();
cappedHealthInput.fighters[0].base.health = 500;
cappedHealthInput.fighters[1].base.health = 900;
assert.deepEqual(
  new BattleEngine(cappedHealthInput).input.fighters.map((fighter) => fighter.base.health),
  [500, 500],
  "Значение 500 сохраняется, а превышение предела обрезается движком",
);
assert.deepEqual(
  [MAX_BATTLE_STEPS, MAX_ARENA_MULTIPLIER, MAX_BASE_ATTRIBUTE],
  [2000, 10, 500],
  "Расширенные пределы калькулятора опубликованы движком",
);
const expandedLimitsInput = createDefaultBattleInput();
expandedLimitsInput.maxSteps = 9000;
expandedLimitsInput.arena.supportMultipliers = [25, 10];
expandedLimitsInput.fighters[0].base.strength = 900;
expandedLimitsInput.fighters[0].base.charisma = 700;
expandedLimitsInput.fighters[0].criticalChance = 1;
expandedLimitsInput.fighters[0].classTechniqueChance = 1;
const expandedLimits = new BattleEngine(expandedLimitsInput).input;
assert.equal(expandedLimits.maxSteps, 2000, "Число шагов ограничивается новым пределом 2000");
assert.deepEqual(expandedLimits.arena.supportMultipliers, [10, 10]);
assert.deepEqual(
  [expandedLimits.fighters[0].base.strength, expandedLimits.fighters[0].base.charisma],
  [500, 500],
);
assert.deepEqual(
  [expandedLimits.fighters[0].criticalChance, expandedLimits.fighters[0].classTechniqueChance],
  [1, 1],
  "Калькулятор допускает стопроцентные шансы",
);
assert.equal(COMBAT_RULES.critical.chance, 0.03, "Базовый шанс критического удара равен 3%");
assert.equal(COMBAT_RULES.critical.damageMultiplier, 2, "Критический удар удваивает урон");
assert.equal(COMBAT_RULES.classTechnique.chance, 0.1, "Базовый шанс классового приёма равен 10%");
assert.deepEqual(
  first.input.fighters.map((fighter) => fighter.criticalChance),
  [0.03, 0.03],
  "Каждый боец получает собственный базовый шанс крита 3%",
);
assert.deepEqual(
  first.input.fighters.map((fighter) => fighter.classTechniqueChance),
  [0.1, 0.1],
  "Каждый боец получает собственный базовый шанс классового приёма 10%",
);
const configuredCriticalInput = createDefaultBattleInput();
configuredCriticalInput.fighters[0].criticalChance = 0;
configuredCriticalInput.fighters[1].criticalChance = 0.5;
configuredCriticalInput.fighters[0].classTechniqueChance = 0;
configuredCriticalInput.fighters[1].classTechniqueChance = 0.5;
const configuredCriticalEngine = new BattleEngine(configuredCriticalInput);
assert.deepEqual(
  configuredCriticalEngine.input.fighters.map((fighter) => fighter.criticalChance),
  [0, 0.5],
  "Индивидуальные шансы крита сохраняются во входе боя",
);
assert.deepEqual(
  configuredCriticalEngine.input.fighters.map((fighter) => fighter.classTechniqueChance),
  [0, 0.5],
  "Индивидуальные шансы классового приёма сохраняются во входе боя",
);
const configuredCriticalResult = configuredCriticalEngine.simulate();
const configuredChanceByFighter = new Map([
  ["fighter-1", 0],
  ["fighter-2", 0.5],
]);
assert.ok(
  configuredCriticalResult.snapshots
    .map((snapshot) => snapshot.lastAction)
    .filter(Boolean)
    .every((action) => action.criticalChance === configuredChanceByFighter.get(action.actorId)),
  "Каждое действие использует шанс крита именно атакующего бойца",
);
assert.deepEqual(
  COMBAT_RULES.trauma,
  { baseChance: 0.12, damageRatioMultiplier: 0.9, maxChance: 0.45, armChance: 0.5 },
  "Вероятности боевой травмы вынесены в правила",
);
assert.equal(calculateTraumaChance(0, 100), 0.12, "Успешное попадание имеет базовые 12% травмы");
assert.equal(calculateTraumaChance(20, 100), 0.3, "Сила попадания значительно повышает шанс травмы");
assert.equal(calculateTraumaChance(100, 100), 0.45, "Шанс травмы ограничен сверху 45%");
assert.deepEqual(
  [COMBAT_RULES.strikePower.minMultiplier, COMBAT_RULES.strikePower.maxMultiplier],
  [0.85, 1.15],
  "Случайная сила попадания ограничена диапазоном 85–115%",
);
const hitActions = first.snapshots
  .slice(1, -1)
  .map((snapshot) => snapshot.lastAction)
  .filter((action) => action?.outcome === "hit");
assert.ok(hitActions.length > 0, "Детерминированный бой должен содержать успешные попадания");
assert.ok(hitActions.every((action) => (
  action.strikePowerMultiplier >= COMBAT_RULES.strikePower.minMultiplier
    && action.strikePowerMultiplier <= COMBAT_RULES.strikePower.maxMultiplier
)), "Множитель каждого попадания остаётся в заданных границах");
assert.ok(hitActions.every((action) => (
  action.damage === action.damageBeforeCritical * action.criticalMultiplier
)), "Финальный урон явно выводится из урона до критической проверки");
assert.ok(
  first.events.some((event) => event.type === "action.damage.resolved"
    && typeof event.data.strikePowerRoll === "number"
    && typeof event.data.criticalRoll === "number"),
  "Точные броски силы и крита сохраняются в техническом журнале",
);

const traumaInput = createDefaultBattleInput();
traumaInput.fighters.forEach((fighter) => { fighter.perks = []; });
const traumaResult = new BattleEngine(traumaInput).simulate();
const traumaSnapshot = traumaResult.snapshots.find((snapshot) => (
  snapshot.fighters.some((fighter) => fighter.traumas.some((trauma) => trauma.source === "battle"))
));
assert.ok(traumaSnapshot, "Повышенная вероятность должна давать наблюдаемую боевую травму в детерминированном бою");
const traumatizedFighter = traumaSnapshot.fighters.find((fighter) => (
  fighter.traumas.some((trauma) => trauma.source === "battle")
));
const newTrauma = traumatizedFighter.traumas.find((trauma) => trauma.source === "battle");
assert.equal(newTrauma.type, "arm", "Контрольный seed детерминированно выбирает травму руки");
assert.equal(traumaSnapshot.lastAction.targetId, traumatizedFighter.id, "Травма появляется у цели текущего попадания");
const fighterBeforeTrauma = traumaResult.snapshots[traumaSnapshot.index - 1].fighters.find(
  (fighter) => fighter.id === traumatizedFighter.id,
);
assert.ok(
  traumatizedFighter.strength < fighterBeforeTrauma.strength,
  "Дебафф травмы руки применяется до фиксации того же снимка",
);

const forcedCritical = BattleEngine.prototype.finalizeActionDamage.call(
  { random: () => 0.029999 },
  { outcome: "hit", damage: 19, strikePowerMultiplier: 1 },
);
assert.equal(forcedCritical.critical, true, "Бросок ниже 3% создаёт критический удар");
assert.equal(forcedCritical.damage, 38, "Критический удар удваивает рассчитанный урон");
assert.equal(forcedCritical.impact, "critical", "Крит имеет отдельную качественную категорию");
const criticalBoundary = BattleEngine.prototype.finalizeActionDamage.call(
  { random: () => 0.03 },
  { outcome: "hit", damage: 19, strikePowerMultiplier: 1 },
);
assert.equal(criticalBoundary.critical, false, "Граница 0.03 не входит в успешный критический бросок");
const disabledCritical = BattleEngine.prototype.finalizeActionDamage.call(
  { random: () => 0 },
  { outcome: "hit", damage: 19, strikePowerMultiplier: 1, criticalChance: 0 },
);
assert.equal(disabledCritical.critical, false, "При настройке 0% критический удар невозможен");
const frequentCritical = BattleEngine.prototype.finalizeActionDamage.call(
  { random: () => 0.3 },
  { outcome: "hit", damage: 19, strikePowerMultiplier: 1, criticalChance: 0.5 },
);
assert.equal(frequentCritical.critical, true, "Настройка 50% применяется к конкретному атакующему");
assert.equal(frequentCritical.criticalChance, 0.5, "Использованный шанс сохраняется в результате действия");
const impactCases = [
  [0.9, "light"],
  [1, "normal"],
  [1.1, "strong"],
];
impactCases.forEach(([strikePowerMultiplier, expectedImpact]) => {
  const categorized = BattleEngine.prototype.finalizeActionDamage.call(
    { random: () => 0.5 },
    { outcome: "hit", damage: 19, strikePowerMultiplier },
  );
  assert.equal(categorized.impact, expectedImpact, `Множитель ${strikePowerMultiplier} получает категорию ${expectedImpact}`);
});
const defaultMurmillo = first.snapshots[0].fighters[0];
assert.equal(defaultMurmillo.fighterClass, "murmillo");
assert.deepEqual(
  {
    weaponPower: defaultMurmillo.weaponPower,
    armor: defaultMurmillo.armor,
    weight: defaultMurmillo.equipmentWeight,
  },
  { weaponPower: 15, armor: 16, weight: 24 },
  "Движок должен разрешить выбранные оружие и доспехи",
);
assert.equal(defaultMurmillo.matchup.relation, "advantage", "Мурмиллон должен иметь преимущество против Фракийца");
assert.equal(defaultMurmillo.matchup.strengthMultiplier, 1.15);
assert.equal(defaultMurmillo.matchup.initiativeBonus, 10);
assert.ok(
  first.events.some((event) => event.type === "modifier.activated"
    && event.data.modifierId === "weapon.murmillo-shield-advance"
    && event.data.kind === "class-technique"),
  "Оружейный комплект должен создавать классовый приём",
);
const shieldWallInput = createDefaultBattleInput();
shieldWallInput.seed = "shield-0";
shieldWallInput.fighters.forEach((fighter) => { fighter.base.health = 300; });
shieldWallInput.fighters[0].classTechniqueChance = 1;
const shieldWallResult = new BattleEngine(shieldWallInput).simulate();
assert.ok(
  shieldWallResult.events.some((event) => event.type === "modifier.activated"
    && event.data.modifierId === "weapon.murmillo-shield-advance"
    && event.message.includes("Стена скутума")),
  "Мурмиллон должен один раз превратить попадание в блок",
);
const murmilloCounterStrike = shieldWallResult.snapshots
  .map((snapshot) => snapshot.lastAction)
  .find((action) => action?.classTechnique === "weapon.murmillo-shield-advance");
assert.ok(murmilloCounterStrike, "После блока Мурмиллон должен выполнить видимый классовый ответный удар");
assert.equal(murmilloCounterStrike.actorId, "fighter-1", "Ответный классовый удар выполняет владелец техники");
assert.equal(murmilloCounterStrike.strengthMultiplier, 1.25, "Ответный удар получает усиление силы 25%");
const disabledShieldInput = createDefaultBattleInput();
disabledShieldInput.maxSteps = 80;
disabledShieldInput.fighters.forEach((fighter) => { fighter.base.health = 300; });
disabledShieldInput.fighters[0].classTechniqueChance = 0;
const disabledShieldResult = new BattleEngine(disabledShieldInput).simulate();
assert.equal(
  disabledShieldResult.events.some((event) => event.type === "modifier.activated"
    && event.data.modifierId === "weapon.murmillo-shield-advance"
    && event.message.includes("Стена скутума")),
  false,
  "Настройка 0% полностью отключает классовый приём",
);

const equipmentMechanicsInput = createDefaultBattleInput();
equipmentMechanicsInput.seed = "equipment-mechanics";
equipmentMechanicsInput.maxSteps = 80;
equipmentMechanicsInput.fighters[0].base.health = 300;
equipmentMechanicsInput.fighters[0].fighterClass = "thraex";
equipmentMechanicsInput.fighters[0].equipment = {
  weaponSet: { definitionId: "thraex-arms.good" },
  armorSet: { definitionId: "thraex-armor.good" },
};
equipmentMechanicsInput.fighters[0].perks = [];
equipmentMechanicsInput.fighters[0].classTechniqueChance = 1;
equipmentMechanicsInput.fighters[1].base.health = 300;
equipmentMechanicsInput.fighters[1].fighterClass = "retiarius";
equipmentMechanicsInput.fighters[1].equipment = {
  weaponSet: { definitionId: "retiarius-arms.good" },
  armorSet: { definitionId: "retiarius-armor.good" },
};
equipmentMechanicsInput.fighters[1].perks = [];
equipmentMechanicsInput.fighters[1].classTechniqueChance = 1;
const equipmentMechanics = new BattleEngine(equipmentMechanicsInput).simulate();
assert.ok(
  equipmentMechanics.events.some((event) => event.type === "modifier.activated"
    && event.data.modifierId === "weapon.thraex-hooking-slash"
    && event.message.includes("вес инициативы")),
  "Фракиец должен расходовать рывок инициативы после попадания",
);
assert.ok(
  equipmentMechanics.events.some((event) => event.type === "modifier.activated"
    && event.data.modifierId === "weapon.retiarius-net-cast"
    && event.message.includes("ход противника перехвачен")),
  "Ретиарий должен один раз перехватить ход сетью",
);
assert.ok(
  equipmentMechanics.snapshots.some((snapshot) => (
    snapshot.lastAction?.classTechnique === "weapon.retiarius-net-cast"
      && snapshot.lastAction.classTechniqueChance === 1
      && snapshot.lastAction.classTechniqueRoll < 1
  )),
  "Перехват сетью должен сохранять шанс и бросок в действии для визуального реплея",
);
assert.ok(
  equipmentMechanics.snapshots.some((snapshot) => (
    snapshot.lastAction?.actorId === "fighter-1"
      && snapshot.lastAction.classTechnique === "weapon.thraex-hooking-slash"
  )),
  "Рывок Фракийца должен помечать следующий удар для специальной анимации",
);

const namedEquipmentInput = createDefaultBattleInput();
namedEquipmentInput.fighters[0].equipment = {
  weaponSet: { definitionId: "murmillo-arms.named" },
  armorSet: { definitionId: "murmillo-armor.named" },
};
const namedEquipment = new BattleEngine(namedEquipmentInput).simulate();
assert.deepEqual(
  namedEquipment.input.fighters[0].equipment.weaponSet.additionalPerkIds,
  ["weapon.guard-breaker", "weapon.quick-recovery"],
  "Именное оружие должно передавать два дополнительных модификатора",
);
assert.ok(
  namedEquipment.events[0].state.modifiers.some((modifier) => modifier.kind === "equipment"),
  "Эффекты редких предметов должны создаваться как BattleModifier kind=equipment",
);

for (const fighterClass of ["secutor", "hoplomachus"]) {
  const classInput = createDefaultBattleInput();
  if (fighterClass === "secutor") {
    classInput.seed = "secutor-special-0";
    classInput.maxSteps = 100;
    classInput.fighters.forEach((fighter) => {
      fighter.base.health = 300;
      fighter.perks = [];
    });
  }
  classInput.fighters[0].fighterClass = fighterClass;
  classInput.fighters[0].classTechniqueChance = 1;
  classInput.fighters[0].equipment = {
    weaponSet: { definitionId: `${fighterClass}-arms.good` },
    armorSet: { definitionId: `${fighterClass}-armor.good` },
  };
  const classResult = new BattleEngine(classInput).simulate();
  assert.equal(classResult.snapshots[0].fighters[0].fighterClass, fighterClass);
  assert.ok(
    classResult.events.some((event) => event.type === "modifier.activated" && event.data.kind === "class-technique"),
    `${fighterClass}: классовый приём должен исполняться как BattleModifier`,
  );
  if (fighterClass === "hoplomachus") {
    assert.ok(
      classResult.snapshots.some((snapshot) => (
        snapshot.lastAction?.classTechnique === "weapon.hoplomachus-spear-distance"
      )),
      "Усиленный удар Гопломаха должен быть отмечен как классовый приём",
    );
  }
  if (fighterClass === "secutor") {
    assert.ok(
      classResult.snapshots.some((snapshot) => (
        snapshot.lastAction?.actorId === "fighter-1"
          && snapshot.lastAction.classTechnique === "weapon.secutor-relentless-pursuit"
      )),
      "Преследование Секутора должно помечать следующую атаку как классовый приём",
    );
  }
}
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
  first.events.every((event) => Array.isArray(event.state.modifiers)),
  "Состояние события должно включать runtime всех модификаторов арены",
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
});
const draw = new BattleEngine(drawInput).simulate();

assert.deepEqual(draw.outcome, { type: "draw", reason: "step_limit" });
assert.ok(draw.fighters.every((fighter) => fighter.battleOutcome === "draw"));

const strongBonesResult = first.fighters.find((fighter) => fighter.id === "fighter-2");
assert.ok(strongBonesResult, "В результате должен присутствовать второй боец");
assert.ok(first.statistics["fighter-2"].modifierActivations > 0, "Перк должен пройти через hook интерфейс");

const interceptorInput = createDefaultBattleInput();
interceptorInput.fighters[0].perks = ["turn-interceptor"];
interceptorInput.fighters[1].perks = [];
const intercepted = new BattleEngine(interceptorInput).simulate();
const interceptionEvent = intercepted.events.find(
  (event) => event.type === "modifier.activated" && event.data.modifierId === "turn-interceptor",
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
  (event) => event.type === "modifier.hook"
    && event.message === "skilled-warrior.afterAction"
    && event.data.runtimeAfter?.guaranteedNextTurn === true,
);
const guaranteedTurnEvent = skilledResult.events.find(
  (event) => event.type === "modifier.hook"
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
    (event) => event.type === "modifier.activated" && event.data.modifierId === "light-footed",
  ),
  "Лёгкая поступь должна модифицировать усталость через beforeApplyEffects",
);

const temporaryInput = createDefaultBattleInput();
temporaryInput.fighters[0].buffs = ["bath-effect", "wine", "bath-effect"];
temporaryInput.fighters[0].injuries = ["leg-damage", "arm-damage", "head-damage"];
const temporaryResult = new BattleEngine(temporaryInput).simulate();
const initialFighter = temporaryResult.snapshots[0].fighters[0];
assert.equal(
  initialFighter.maxHealth,
  temporaryInput.fighters[0].base.health + 26,
  "Временные эффекты должны суммировать здоровье поверх текущего базового значения",
);
assert.equal(initialFighter.strength, 63.15, "Травма руки должна примениться после экипировки и временных бонусов");
assert.equal(initialFighter.support, 52, "Харизма и травма головы должны менять поддержку");
assert.equal(initialFighter.fatigue, 18, "Стартовая усталость травм должна суммироваться");
assert.equal(initialFighter.traumas.length, 2, "Рука и нога должны стать стартовыми травмами");
assert.equal(initialFighter.buffs.length, 3, "Повторяющиеся временные эффекты разрешены");
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
  temporaryResult.statistics["fighter-1"].modifierActivations >= 6,
  "Статистика должна учитывать стартовые расширения",
);
assert.ok(
  temporaryResult.events.some(
    (event) => event.type === "modifier.activated"
      && event.kind === "injury"
      && event.data.kind === "injury",
  ),
  "Стартовые травмы должны проходить через общий hook-конвейер",
);

console.log(`OK: ${first.steps} шагов, ${first.events.length} событий, ${first.snapshots.length} снимков`);
