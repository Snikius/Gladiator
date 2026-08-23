(function () {
"use strict";

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const round = (value, digits = 2) => Number(value.toFixed(digits));
const clone = (value) => JSON.parse(JSON.stringify(value));
const REFERENCE_DATA = globalThis.GladiatorReferenceData;
const MAX_BATTLE_STEPS = 2000;
const MAX_ARENA_MULTIPLIER = 10;
const MAX_BASE_ATTRIBUTE = 500;
const MAX_BASE_HEALTH = 500;

const COMBAT_RULES = Object.freeze({
  strikePower: Object.freeze({
    baseCoefficient: 0.625,
    minMultiplier: 0.85,
    maxMultiplier: 1.15,
    lightBelow: 0.95,
    strongFrom: 1.08,
  }),
  critical: Object.freeze({
    chance: 0.03,
    damageMultiplier: 2,
  }),
  classTechnique: Object.freeze({
    chance: 0.1,
  }),
  trauma: Object.freeze({
    baseChance: 0.12,
    damageRatioMultiplier: 0.9,
    maxChance: 0.45,
    armChance: 0.5,
  }),
  spectacle: Object.freeze({
    durationStartsAt: 4,
    durationFullAt: 36,
    durationWeight: 0.18,
    lastBreathWeight: 0.34,
    dramaWeight: 0.28,
    traumaBonusPerInjury: 0.08,
    maxTraumaBonus: 0.20,
    rewardDivisor: 2,
  }),
});

const SPECTACLE_TIERS = Object.freeze([
  Object.freeze({ id: "boring", minScore: 0, label: "Скучный бой" }),
  Object.freeze({ id: "ordinary", minScore: 25, label: "Обычный бой" }),
  Object.freeze({ id: "exciting", minScore: 50, label: "Захватывающий бой" }),
  Object.freeze({ id: "grand", minScore: 75, label: "Грандиозный бой" }),
]);

const spectacleTierForScore = (score) => [...SPECTACLE_TIERS]
  .reverse()
  .find((tier) => score >= tier.minScore) || SPECTACLE_TIERS[0];

const calculateSpectacle = (fighters, completedSteps, previousScore = 0) => {
  const rules = COMBAT_RULES.spectacle;
  const healthRatios = fighters.slice(0, 2).map((fighter) => clamp(
    Number(fighter.health) / Math.max(1, Number(fighter.maxHealth)),
    0,
    1,
  ));
  while (healthRatios.length < 2) healthRatios.push(1);
  const duration = clamp(
    (completedSteps - rules.durationStartsAt)
      / Math.max(1, rules.durationFullAt - rules.durationStartsAt),
    0,
    1,
  );
  const exhaustion = 1 - (healthRatios[0] + healthRatios[1]) / 2;
  const balance = 1 - Math.abs(healthRatios[0] - healthRatios[1]);
  const lastBreath = exhaustion * (0.65 + 0.35 * balance);
  const traumaCount = fighters.slice(0, 2).reduce((total, fighter) => (
    total + (fighter.traumas || []).filter((trauma) => trauma.source === "battle").length
  ), 0);
  const traumaBonus = Math.min(rules.maxTraumaBonus, traumaCount * rules.traumaBonusPerInjury);
  const rawScore = Math.round(100 * clamp(
    rules.durationWeight * duration
      + rules.lastBreathWeight * lastBreath
      + rules.dramaWeight * duration * lastBreath
      + traumaBonus,
    0,
    1,
  ));
  const score = clamp(Math.max(Math.round(previousScore) || 0, rawScore), 0, 100);
  const tier = spectacleTierForScore(score);
  return {
    formulaVersion: "spectacle-v1",
    score,
    tier: tier.id,
    factors: {
      completedSteps,
      duration: round(duration, 4),
      exhaustion: round(exhaustion, 4),
      balance: round(balance, 4),
      lastBreath: round(lastBreath, 4),
      traumaCount,
      traumaBonus: round(traumaBonus, 4),
      techniqueBonus: 0,
    },
  };
};

const calculateTraumaChance = (damage, maxHealth) => {
  const rules = COMBAT_RULES.trauma;
  return round(clamp(
    rules.baseChance + (damage / Math.max(1, maxHealth)) * rules.damageRatioMultiplier,
    rules.baseChance,
    rules.maxChance,
  ), 4);
};

if (!REFERENCE_DATA) {
  throw new Error("Сначала подключите reference-data.js — он содержит каталог экипировки");
}

const {
  classes: FIGHTER_CLASS_DEFINITIONS,
  weapons: WEAPON_SET_DEFINITIONS,
  armor: ARMOR_SET_DEFINITIONS,
  perks: ALL_MODIFIER_DEFINITIONS,
  qualities: EQUIPMENT_QUALITIES,
  weaponItems: WEAPON_ITEMS,
  armorItems: ARMOR_ITEMS,
} = REFERENCE_DATA;

const hashSeed = (seed) => {
  let hash = 2166136261;
  for (const char of String(seed)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const createRandom = (seed) => {
  let state = hashSeed(seed);
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
};

const weightedPick = (items, random) => {
  const total = items.reduce((sum, item) => sum + Math.max(0, item.weight), 0);
  if (total <= 0) return { ...items[0], roll: 0, totalWeight: 0 };
  const roll = random();
  let cursor = roll * total;
  for (const item of items) {
    cursor -= Math.max(0, item.weight);
    if (cursor <= 0) return { ...item, roll: round(roll, 6), totalWeight: round(total) };
  }
  return { ...items.at(-1), roll: round(roll, 6), totalWeight: round(total) };
};

const normalizeModifierRefs = (items, limit = Infinity) => items
  .filter(Boolean)
  .map((item) => (typeof item === "string" ? item : item.id))
  .filter(Boolean)
  .slice(0, limit);

const normalizePlayerBuffLoadout = (rawLoadout) => ({
  buffDefinitionIds: [...new Set(normalizeModifierRefs(
    rawLoadout?.buffDefinitionIds || rawLoadout || [],
    3,
  ))],
});

const normalizePlayerBuffCommands = (commands) => (commands || [])
  .filter(Boolean)
  .map((command, index) => ({
    type: "apply-player-buff",
    fighterId: String(command.fighterId || "fighter-1"),
    buffDefinitionId: String(command.buffDefinitionId || ""),
    afterIteration: Math.max(0, Math.floor(Number(command.afterIteration) || 0)),
    commandSequence: Math.max(1, Math.floor(Number(command.commandSequence) || index + 1)),
  }))
  .filter((command) => command.buffDefinitionId)
  .sort((left, right) => left.afterIteration - right.afterIteration || left.commandSequence - right.commandSequence);

const normalizeEquipmentRef = (rawRef, catalog, fighterClass, slot) => {
  const requestedId = typeof rawRef === "string" ? rawRef : rawRef?.definitionId;
  const item = catalog.find((candidate) => (
    candidate.id === requestedId && candidate.classId === fighterClass
  )) || catalog.find((candidate) => candidate.classId === fighterClass && candidate.quality === "common");
  if (!item) throw new Error(`Для класса ${fighterClass} отсутствует комплект ${slot}`);
  return {
    instanceId: rawRef?.instanceId || `${fighterClass}:${slot}:${item.id}`,
    definitionId: item.id,
    quality: item.quality,
    statValues: clone(item.stats),
    additionalPerkIds: [...item.additionalPerkIds],
  };
};

const normalizeInput = (input) => ({
  schemaVersion: 1,
  rulesetVersion: "prototype-0.6",
  seed: String(input.seed || "gladiator-prototype"),
  maxSteps: clamp(Number(input.maxSteps) || 80, 1, MAX_BATTLE_STEPS),
  arena: {
    type: input.arena?.type || "crowd",
    supportMultipliers: [
      clamp(Number(input.arena?.supportMultipliers?.[0]) || 1, 0.1, MAX_ARENA_MULTIPLIER),
      clamp(Number(input.arena?.supportMultipliers?.[1]) || 1, 0.1, MAX_ARENA_MULTIPLIER),
    ],
  },
  playerBuffCommands: normalizePlayerBuffCommands(input.playerBuffCommands),
  fighters: input.fighters.map((fighter, index) => {
    const requestedClass = fighter.fighterClass || fighter.equipmentType;
    const fighterClass = FIGHTER_CLASS_DEFINITIONS.some((item) => item.id === requestedClass)
      ? requestedClass
      : "murmillo";
    return {
      id: fighter.id || `fighter-${index + 1}`,
      name: fighter.name || `Боец ${index + 1}`,
      fighterClass,
      base: {
        strength: clamp(Number(fighter.base?.strength) || 50, 1, MAX_BASE_ATTRIBUTE),
        health: clamp(Number(fighter.base?.health) || 100, 1, MAX_BASE_HEALTH),
        charisma: clamp(Number(fighter.base?.charisma) || 50, 1, MAX_BASE_ATTRIBUTE),
      },
      criticalChance: Number.isFinite(Number(fighter.criticalChance))
        ? clamp(Number(fighter.criticalChance), 0, 1)
        : COMBAT_RULES.critical.chance,
      classTechniqueChance: Number.isFinite(Number(fighter.classTechniqueChance))
        ? clamp(Number(fighter.classTechniqueChance), 0, 1)
        : COMBAT_RULES.classTechnique.chance,
      equipment: {
        weaponSet: normalizeEquipmentRef(fighter.equipment?.weaponSet, WEAPON_ITEMS, fighterClass, "weapon"),
        armorSet: normalizeEquipmentRef(fighter.equipment?.armorSet, ARMOR_ITEMS, fighterClass, "armor"),
      },
      perks: [...new Set(normalizeModifierRefs(fighter.perks, 3))],
      buffs: normalizeModifierRefs(fighter.buffs || fighter.temporaryPerks || []),
      buffLoadout: normalizePlayerBuffLoadout(fighter.buffLoadout),
      injuries: normalizeModifierRefs(fighter.injuries || []),
    };
  }),
});

const ARENA_TYPES = [
  { id: "crowd", name: "Арена со зрителями" },
  { id: "normal", name: "Закрытая арена" },
  { id: "sand", name: "Песчаная арена" },
];

const PERK_DEFINITIONS = [
  {
    id: "cornered-beast",
    name: "Загнанный зверь",
    description: "При здоровье 35% и ниже увеличивает текущую силу на 50%.",
  },
  {
    id: "strong-bones",
    name: "Крепкие кости",
    description: "Снижает вероятность боевой и итоговой травмы на 65%.",
  },
  {
    id: "crowd-favorite",
    name: "Любимец толпы",
    description: "После каждого пересчёта получает +6 к динамической поддержке.",
  },
  {
    id: "turn-interceptor",
    name: "Перехват хода",
    description: "Один раз за бой заменяет уже выбранного противника на владельца перка.",
  },
  {
    id: "light-footed",
    name: "Лёгкая поступь",
    description: "Уменьшает получаемую за действия, блоки и увороты усталость на 25%.",
  },
  {
    id: "redhead",
    name: "Рыжий",
    description: "Понижает харизму на 10 перед началом боя. Публика почему-то предвзята.",
  },
  {
    id: "skilled-warrior",
    name: "Умелый воин",
    description: "После блока, уворота или промаха врага гарантированно получает следующий ход.",
  },
  {
    id: "show-off",
    name: "Позёр",
    description: "После собственного блока или уворота получает +5 поддержки и +2 усталости.",
  },
  {
    id: "lovable-loser",
    name: "Любимец неудач",
    description: "После собственного промаха получает +4 поддержки: публика оценила старание.",
  },
  {
    id: "achilles-leap",
    name: "Прыжок Ахилла",
    description: "С шансом 10% заменяет атаку ударом сверху: +50% силы, нельзя заблокировать или увернуться.",
  },
];

const BUFF_DEFINITIONS = [
  {
    id: "bath-effect",
    name: "Эффект бани",
    description: "+4 к силе, +8 к здоровью и +4 к харизме на этот бой.",
  },
  {
    id: "wine",
    name: "Вино",
    description: "+8 к харизме и +10 к здоровью, но −5 к силе.",
  },
  {
    id: "hearty-meal",
    name: "Сытный обед",
    description: "+15 к здоровью, но +6 стартовой усталости.",
  },
  {
    id: "trainer-warmup",
    name: "Разминка с тренером",
    description: "+7 к силе, но +4 стартовой усталости.",
  },
  {
    id: "priest-blessing",
    name: "Благословение жреца",
    description: "+5 к здоровью, +6 к харизме и +4 к поддержке.",
  },
  {
    id: "battle-tonic",
    name: "Боевой настой",
    description: "+9 к силе, −8 к здоровью и +8 стартовой усталости.",
  },
  {
    id: "good-sleep",
    name: "Хороший сон",
    description: "+3 к силе, +6 к здоровью и +2 к харизме.",
  },
];

const PLAYER_BUFF_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: "rally",
    name: "Соберись!",
    description: "Немедленно снимает 35% текущей усталости.",
  }),
  Object.freeze({
    id: "forward",
    name: "Вперёд!",
    description: "+18 инициативы на 5 итераций, затем −8 инициативы до конца боя.",
    durationIterations: 5,
  }),
  Object.freeze({
    id: "now",
    name: "Сейчас!",
    description: "+15 усталости и немедленный усиленный классовый удар с оглушением цели на 2 итерации.",
  }),
  Object.freeze({
    id: "hold-on",
    name: "Держись!",
    description: "Даёт 20% временного здоровья на 5 итераций, затем увеличивает получаемый урон на 25% до конца боя.",
    durationIterations: 5,
  }),
]);

const INJURY_DEFINITIONS = [
  {
    id: "leg-damage",
    name: "Повреждение ноги",
    description: "Травма ноги снижает инициативу; +8 стартовой усталости.",
  },
  {
    id: "arm-damage",
    name: "Повреждение руки",
    description: "Травма руки снижает текущую силу на 15%.",
  },
  {
    id: "head-damage",
    name: "Повреждение головы",
    description: "−12 к харизме и +10 стартовой усталости.",
  },
  {
    id: "bruised-ribs",
    name: "Ушиб рёбер",
    description: "−18 к максимальному здоровью и +5 стартовой усталости.",
  },
  {
    id: "exhaustion",
    name: "Истощение",
    description: "−8 к силе и +20 стартовой усталости.",
  },
];

const applyInitializationModifiers = (data, api, modifiers, message) => {
  const fighterIndex = data.fighters.findIndex((fighter) => fighter.id === api.ownerId);
  if (fighterIndex < 0) return data;
  const fighter = clone(data.fighters[fighterIndex]);
  const arenaMultiplier = data.arena.supportMultipliers[fighterIndex];

  if (modifiers.strength) {
    fighter.base.strength = clamp(round(fighter.base.strength + modifiers.strength), 1, MAX_BASE_ATTRIBUTE);
    fighter.strength = fighter.base.strength;
  }
  if (modifiers.health) {
    fighter.base.health = clamp(round(fighter.base.health + modifiers.health), 1, MAX_BASE_HEALTH);
    fighter.maxHealth = fighter.base.health;
    fighter.health = fighter.maxHealth;
  }
  if (modifiers.charisma) {
    fighter.base.charisma = clamp(round(fighter.base.charisma + modifiers.charisma), 1, MAX_BASE_ATTRIBUTE);
    fighter.support = clamp(round(fighter.support + modifiers.charisma * arenaMultiplier), 0, 150);
  }
  if (modifiers.support) {
    fighter.support = clamp(round(fighter.support + modifiers.support), 0, 150);
  }
  if (modifiers.fatigue) {
    fighter.fatigue = clamp(round(fighter.fatigue + modifiers.fatigue), 0, 150);
  }
  if (modifiers.trauma) {
    fighter.traumas.push({
      type: modifiers.trauma,
      step: 0,
      source: "starting-injury",
    });
  }

  const fighters = [...data.fighters];
  fighters[fighterIndex] = fighter;
  api.activate(message);
  return { ...data, fighters };
};

const applyClassEquipment = (data, api, fighterClassId) => {
  const fighterIndex = data.fighters.findIndex((fighter) => fighter.id === api.ownerId);
  const definition = FIGHTER_CLASS_DEFINITIONS.find((item) => item.id === fighterClassId);
  if (fighterIndex < 0 || !definition) return data;

  const fighter = clone(data.fighters[fighterIndex]);
  const opponent = data.fighters.find((candidate) => candidate.id !== api.ownerId);
  const hasMatchupAdvantage = opponent?.fighterClass === definition.beats;
  const hasMatchupDisadvantage = opponent?.fighterClass === definition.losesTo;
  fighter.matchup = {
    opponentClass: opponent?.fighterClass || null,
    relation: hasMatchupAdvantage ? "advantage" : (hasMatchupDisadvantage ? "disadvantage" : "neutral"),
    strengthMultiplier: hasMatchupAdvantage ? 1.15 : 1,
    initiativeBonus: hasMatchupAdvantage ? 10 : 0,
  };
  if (hasMatchupAdvantage) {
    fighter.base.strength = round(fighter.base.strength * fighter.matchup.strengthMultiplier);
    fighter.strength = fighter.base.strength;
    fighter.initiativeEquipmentBonus = fighter.matchup.initiativeBonus;
  }

  const fighters = [...data.fighters];
  fighters[fighterIndex] = fighter;
  api.activate(
    hasMatchupAdvantage
      ? `${definition.name}: преимущество класса даёт ×1.15 к силе и +10 инициативы`
      : `${definition.name}: классовый комплект подготовлен`,
  );
  return { ...data, fighters };
};

const checkClassTechniqueChance = (data, api) => {
  const owner = api.state.fighters.find((fighter) => fighter.id === api.ownerId);
  const chance = owner?.classTechniqueChance ?? COMBAT_RULES.classTechnique.chance;
  const roll = round(api.random(), 6);
  const activated = roll < chance;
  api.emit("modifier.chance.checked", "Проверен шанс классового приёма", {
    classTechniqueChance: chance,
    classTechniqueRoll: roll,
    activated,
  });
  return {
    activated,
    chance,
    roll,
    data: {
      ...data,
      classTechniqueChance: chance,
      classTechniqueRoll: roll,
    },
  };
};

const CLASS_TECHNIQUE_IMPLEMENTATIONS = {
  "weapon.murmillo-shield-advance": {
    beforeInitialize: (data, api) => applyClassEquipment(data, api, "murmillo"),
    afterAction(data, api, runtime) {
      if (runtime.counterStrike || data.targetId !== api.ownerId || data.outcome !== "hit") return data;
      const check = checkClassTechniqueChance(data, api);
      if (!check.activated) return check.data;
      runtime.counterStrike = { chance: check.chance, roll: check.roll };
      api.activate("Стена скутума: попадание превращено в блок");
      api.emit("modifier.runtime.changed", "Мурмиллон подготовил ответный удар", {
        counterStrike: runtime.counterStrike,
      });
      return {
        ...check.data,
        outcome: "block",
        damage: 0,
        traumaChance: 0,
        equipmentReaction: "murmillo-shield-wall",
      };
    },
    beforeAction(data, api, runtime) {
      if (!runtime.counterStrike || data.actorId !== api.ownerId) return data;
      const activation = runtime.counterStrike;
      runtime.counterStrike = null;
      api.activate("Наступление за щитом: ответный удар усилен");
      return {
        ...data,
        strengthMultiplier: (data.strengthMultiplier || 1) * 1.25,
        classTechnique: "weapon.murmillo-shield-advance",
        classTechniqueChance: activation.chance,
        classTechniqueRoll: activation.roll,
      };
    },
  },
  "weapon.thraex-hooking-slash": {
    beforeInitialize: (data, api) => applyClassEquipment(data, api, "thraex"),
    afterAction(data, api, runtime) {
      if (data.actorId !== api.ownerId || data.outcome !== "hit") return data;
      const check = checkClassTechniqueChance(data, api);
      if (!check.activated) return check.data;
      runtime.initiativeSurge = { chance: check.chance, roll: check.roll };
      api.emit("modifier.runtime.changed", "Фракиец подготовил рывок инициативы", {
        initiativeSurge: runtime.initiativeSurge,
      });
      return check.data;
    },
    beforeSelectActor(data, api, runtime) {
      if (!runtime.initiativeSurge) return data;
      const activation = runtime.initiativeSurge;
      runtime.initiativeSurge = null;
      api.activate("Рывок Фракийца: вес инициативы следующего выбора увеличен в 1.5 раза");
      return {
        ...data,
        candidates: data.candidates.map((candidate) => (
          candidate.fighterId === api.ownerId
            ? {
              ...candidate,
              weight: round(candidate.weight * 1.5),
              reason: "thraex-initiative-surge",
              classTechnique: "weapon.thraex-hooking-slash",
              classTechniqueChance: activation.chance,
              classTechniqueRoll: activation.roll,
            }
            : candidate
        )),
      };
    },
  },
  "weapon.retiarius-net-cast": {
    beforeInitialize: (data, api) => applyClassEquipment(data, api, "retiarius"),
    afterSelectActor(data, api, runtime) {
      if (runtime.netUsed || data.actorId === api.ownerId) return data;
      const check = checkClassTechniqueChance(data, api);
      if (!check.activated) return check.data;
      runtime.netUsed = true;
      api.activate("Сеть Ретиария: ход противника перехвачен");
      api.enqueue({
        type: "fatigue",
        fighterId: data.actorId,
        value: 6,
        reason: "class-technique:retiarius-net",
      });
      return {
        ...check.data,
        originalActorId: data.actorId,
        actorId: api.ownerId,
        reason: "class-technique:retiarius-net",
        classTechnique: "weapon.retiarius-net-cast",
      };
    },
  },
  "weapon.secutor-relentless-pursuit": {
    beforeInitialize: (data, api) => applyClassEquipment(data, api, "secutor"),
    afterAction(data, api, runtime) {
      if (data.actorId !== api.ownerId || !["miss", "dodge"].includes(data.outcome)) return data;
      const check = checkClassTechniqueChance(data, api);
      if (!check.activated) return check.data;
      runtime.pursuit = { chance: check.chance, roll: check.roll };
      api.emit("modifier.runtime.changed", "Секутор продолжает преследование", { pursuit: runtime.pursuit });
      return check.data;
    },
    beforeSelectActor(data, api, runtime) {
      if (!runtime.pursuit) return data;
      const activation = runtime.pursuit;
      runtime.pursuit = null;
      api.activate("Неотступное преследование усилило инициативу");
      return { ...data, candidates: data.candidates.map((candidate) => (
        candidate.fighterId === api.ownerId
          ? {
            ...candidate,
            weight: round(candidate.weight * 1.4),
            classTechnique: "weapon.secutor-relentless-pursuit",
            classTechniqueChance: activation.chance,
            classTechniqueRoll: activation.roll,
          }
          : candidate
      )) };
    },
  },
  "weapon.hoplomachus-spear-distance": {
    beforeInitialize: (data, api) => applyClassEquipment(data, api, "hoplomachus"),
    beforeAction(data, api, runtime) {
      if (runtime.used || data.actorId !== api.ownerId) return data;
      runtime.used = true;
      const check = checkClassTechniqueChance(data, api);
      if (!check.activated) return check.data;
      api.activate("Дистанция копья усилила первый удар");
      return {
        ...check.data,
        strengthMultiplier: 1.25,
        classTechnique: "weapon.hoplomachus-spear-distance",
      };
    },
  },
};

const EQUIPMENT_MODIFIER_IMPLEMENTATIONS = {
  "weapon.honed-edge": {
    afterAction(data, api, runtime) {
      if (runtime.used || data.actorId !== api.ownerId || data.outcome !== "hit") return data;
      runtime.used = true;
      api.activate("Отточенная кромка добавила 5 урона к первому попаданию");
      return { ...data, damage: data.damage + 5, specialAttack: "weapon.honed-edge" };
    },
  },
  "weapon.blood-seeker": {
    beforeAction(data, api) {
      if (data.actorId !== api.ownerId) return data;
      const target = api.state.fighters.find((fighter) => fighter.id === data.targetId);
      if (!target || target.health >= target.maxHealth) return data;
      api.activate("Ищущий кровь усилил удар по раненому противнику");
      return {
        ...data,
        strengthMultiplier: (data.strengthMultiplier || 1) * 1.1,
        specialAttack: "weapon.blood-seeker",
      };
    },
  },
  "weapon.counterweight": {
    beforeApplyEffects(data, api) {
      const changed = data.effects.some((effect) => effect.type === "fatigue" && effect.fighterId === api.ownerId && effect.reason === "action");
      if (!changed) return data;
      api.activate("Противовес уменьшил усталость от атаки");
      return { ...data, effects: data.effects.map((effect) => (
        effect.type === "fatigue" && effect.fighterId === api.ownerId && effect.reason === "action"
          ? { ...effect, value: round(effect.value * 0.8) }
          : effect
      )) };
    },
  },
  "weapon.guard-breaker": {
    afterAction(data, api) {
      if (data.actorId !== api.ownerId || data.outcome !== "block") return data;
      api.activate("Разрушитель защиты утомил заблокировавшего врага");
      api.enqueue({ type: "fatigue", fighterId: data.targetId, value: 4, reason: "equipment:guard-breaker" });
      return { ...data, specialAttack: "weapon.guard-breaker" };
    },
  },
  "weapon.quick-recovery": {
    afterAction(data, api) {
      if (data.actorId !== api.ownerId || data.outcome !== "miss") return data;
      api.activate("Быстрое возвращение снизило цену промаха");
      api.enqueue({ type: "fatigue", fighterId: api.ownerId, value: -2, reason: "equipment:quick-recovery" });
      return data;
    },
  },
  "weapon.deceptive-feint": {
    beforeAction(data, api) {
      if (data.actorId !== api.ownerId || api.random() >= 0.15) return data;
      api.activate("Обманный финт не позволяет заблокировать атаку");
      return { ...data, unblockable: true, specialAttack: "weapon.deceptive-feint" };
    },
  },
  "armor.reinforced-lining": {
    afterAction(data, api, runtime) {
      if (runtime.used || data.targetId !== api.ownerId || data.outcome !== "hit") return data;
      runtime.used = true;
      api.activate("Усиленная подкладка поглотила часть первого удара");
      return { ...data, damage: Math.max(1, data.damage - 6) };
    },
  },
  "armor.balanced-straps": {
    beforeApplyEffects(data, api) {
      if (data.action?.outcome !== "block" || data.action.targetId !== api.ownerId) return data;
      api.activate("Удобные ремни уменьшили усталость от блока");
      return { ...data, effects: data.effects.map((effect) => (
        effect.type === "fatigue" && effect.fighterId === api.ownerId
          ? { ...effect, value: round(effect.value * 0.7) }
          : effect
      )) };
    },
  },
  "armor.closed-visor": {
    afterAction(data, api) {
      if (data.targetId !== api.ownerId || data.outcome !== "hit") return data;
      api.activate("Закрытое забрало снизило вероятность травмы");
      return { ...data, traumaChance: round(data.traumaChance * 0.7, 4) };
    },
  },
  "armor.flexible-joints": {
    afterRecalculateInitiative(data, api) {
      if (data.fighterId !== api.ownerId) return data;
      api.activate("Подвижные сочленения добавили 4 инициативы");
      return { ...data, initiative: data.initiative + 4 };
    },
  },
  "armor.layered-padding": {
    afterAction(data, api) {
      if (data.targetId !== api.ownerId || data.outcome !== "hit") return data;
      api.activate("Многослойная стёжка уменьшила урон");
      return { ...data, damage: Math.max(1, data.damage - 3) };
    },
  },
  "armor.last-plate": {
    beforeApplyEffects(data, api, runtime) {
      if (runtime.used) return data;
      const owner = api.state.fighters.find((fighter) => fighter.id === api.ownerId);
      const healthEffect = data.effects.find((effect) => effect.type === "health" && effect.fighterId === api.ownerId);
      if (!owner || !healthEffect || owner.health + healthEffect.value > 0) return data;
      runtime.used = true;
      api.activate("Последняя пластина оставила бойцу 1 здоровье");
      return { ...data, effects: data.effects.map((effect) => (
        effect === healthEffect ? { ...effect, value: 1 - owner.health } : effect
      )) };
    },
  },
  "armor.sand-seals": {},
};

const PERK_IMPLEMENTATIONS = {
  "cornered-beast": {
    afterRecalculateStrength(data, api) {
      if (data.fighterId !== api.ownerId) return data;
      const fighter = api.state.fighters.find((item) => item.id === api.ownerId);
      if (!fighter || fighter.health / fighter.maxHealth > 0.35) return data;
      api.activate("Сила увеличена на 50% из-за низкого здоровья");
      return { ...data, strength: round(data.strength * 1.5) };
    },
  },
  "strong-bones": {
    afterAction(data, api) {
      if (data.targetId !== api.ownerId || data.outcome !== "hit") return data;
      api.activate("Вероятность боевой травмы снижена на 65%");
      return { ...data, traumaChance: round(data.traumaChance * 0.35, 4) };
    },
    beforeOutcome(data, api) {
      if (data.fighterId !== api.ownerId) return data;
      api.activate("Вероятность итоговой травмы снижена на 65%");
      return { ...data, injuryChance: round(data.injuryChance * 0.35, 4) };
    },
  },
  "crowd-favorite": {
    afterRecalculateSupport(data, api) {
      if (data.fighterId !== api.ownerId) return data;
      api.activate("Динамическая поддержка увеличена на 6");
      return { ...data, support: clamp(round(data.support + 6), 0, 150) };
    },
  },
  "turn-interceptor": {
    afterSelectActor(data, api, runtime) {
      if (runtime.used || data.actorId === api.ownerId) return data;
      runtime.used = true;
      api.activate("Выбранный следующий боец заменён владельцем перка");
      return {
        ...data,
        originalActorId: data.actorId,
        actorId: api.ownerId,
        reason: "modifier:turn-interceptor",
      };
    },
  },
  "light-footed": {
    beforeApplyEffects(data, api) {
      const hasFatigue = data.effects.some(
        (effect) => effect.type === "fatigue" && effect.fighterId === api.ownerId,
      );
      if (!hasFatigue) return data;
      api.activate("Получаемая усталость уменьшена на 25%");
      return {
        ...data,
        effects: data.effects.map((effect) => (
          effect.type === "fatigue" && effect.fighterId === api.ownerId
            ? { ...effect, value: round(effect.value * 0.75) }
            : effect
        )),
      };
    },
  },
  redhead: {
    beforeInitialize: (data, api) => applyInitializationModifiers(
      data, api, { charisma: -10 },
      "Рыжий понизил харизму перед боем",
    ),
  },
  "skilled-warrior": {
    afterAction(data, api, runtime) {
      const earnedTurn = data.targetId === api.ownerId
        && ["miss", "dodge", "block"].includes(data.outcome);
      if (!earnedTurn) return data;
      runtime.guaranteedNextTurn = true;
      runtime.trigger = data.outcome;
      api.emit("modifier.runtime.changed", "Умелый воин подготовил гарантированный ход", {
        guaranteedNextTurn: true,
        trigger: data.outcome,
      });
      return data;
    },
    afterSelectActor(data, api, runtime) {
      if (!runtime.guaranteedNextTurn) return data;
      const trigger = runtime.trigger;
      runtime.guaranteedNextTurn = false;
      runtime.trigger = null;
      api.activate(`Следующий ход гарантирован после события ${trigger}`);
      return {
        ...data,
        originalActorId: data.actorId,
        actorId: api.ownerId,
        reason: "modifier:skilled-warrior",
      };
    },
  },
  "show-off": {
    afterAction(data, api) {
      const successfulDefense = data.targetId === api.ownerId
        && ["dodge", "block"].includes(data.outcome);
      if (!successfulDefense) return data;
      api.activate("Эффектная защита впечатлила публику");
      api.enqueue({ type: "support", fighterId: api.ownerId, value: 5, reason: "modifier:show-off" });
      api.enqueue({ type: "fatigue", fighterId: api.ownerId, value: 2, reason: "modifier:show-off" });
      return data;
    },
  },
  "lovable-loser": {
    afterAction(data, api) {
      if (data.actorId !== api.ownerId || data.outcome !== "miss") return data;
      api.activate("Публика поддержала красивый, но неудачный замах");
      api.enqueue({ type: "support", fighterId: api.ownerId, value: 4, reason: "modifier:lovable-loser" });
      return data;
    },
  },
  "achilles-leap": {
    beforeAction(data, api) {
      if (data.actorId !== api.ownerId || data.action !== "attack") return data;
      const activationChance = 0.1;
      const activationRoll = round(api.random(), 6);
      if (activationRoll >= activationChance) {
        return { ...data, achillesLeapChance: activationChance, achillesLeapRoll: activationRoll };
      }
      api.activate("Прыжок Ахилла: неблокируемый удар сверху с бонусом +50% к силе");
      return {
        ...data,
        attackType: "achilles-leap",
        strengthMultiplier: 1.5,
        unblockable: true,
        undodgeable: true,
        achillesLeapChance: activationChance,
        achillesLeapRoll: activationRoll,
      };
    },
  },
};

const BUFF_IMPLEMENTATIONS = {
  "bath-effect": {
    beforeInitialize: (data, api) => applyInitializationModifiers(
      data, api, { strength: 4, health: 8, charisma: 4 },
      "Баня повысила силу, здоровье и харизму",
    ),
  },
  wine: {
    beforeInitialize: (data, api) => applyInitializationModifiers(
      data, api, { strength: -5, health: 10, charisma: 8 },
      "Вино повысило здоровье и харизму, но снизило силу",
    ),
  },
  "hearty-meal": {
    beforeInitialize: (data, api) => applyInitializationModifiers(
      data, api, { health: 15, fatigue: 6 },
      "Сытный обед повысил здоровье и добавил усталость",
    ),
  },
  "trainer-warmup": {
    beforeInitialize: (data, api) => applyInitializationModifiers(
      data, api, { strength: 7, fatigue: 4 },
      "Разминка повысила силу и немного утомила бойца",
    ),
  },
  "priest-blessing": {
    beforeInitialize: (data, api) => applyInitializationModifiers(
      data, api, { health: 5, charisma: 6, support: 4 },
      "Благословение повысило здоровье, харизму и поддержку",
    ),
  },
  "battle-tonic": {
    beforeInitialize: (data, api) => applyInitializationModifiers(
      data, api, { strength: 9, health: -8, fatigue: 8 },
      "Боевой настой повысил силу ценой здоровья и усталости",
    ),
  },
  "good-sleep": {
    beforeInitialize: (data, api) => applyInitializationModifiers(
      data, api, { strength: 3, health: 6, charisma: 2 },
      "Хороший сон повысил базовые характеристики",
    ),
  },
};

const PLAYER_BUFF_MODIFIER_IMPLEMENTATIONS = {
  "player-forward": {
    afterRecalculateInitiative(data, api) {
      if (data.fighterId !== api.ownerId) return data;
      return { ...data, initiative: round(data.initiative + 18) };
    },
  },
  "player-forward-penalty": {
    afterRecalculateInitiative(data, api) {
      if (data.fighterId !== api.ownerId) return data;
      return { ...data, initiative: Math.max(1, round(data.initiative - 8)) };
    },
  },
  "player-hold-on": {},
  "player-hold-on-penalty": {
    afterAction(data, api) {
      if (data.targetId !== api.ownerId || data.outcome !== "hit") return data;
      const target = api.state.fighters.find((fighter) => fighter.id === api.ownerId);
      const damage = Math.max(1, round(data.damage * 1.25));
      api.activate("Последствие «Держись!» увеличило получаемый урон на 25%");
      return {
        ...data,
        damage,
        traumaChance: target ? round(calculateTraumaChance(damage, target.maxHealth), 4) : data.traumaChance,
      };
    },
  },
  "player-stunned": {
    beforeSelectActor(data, api) {
      return {
        ...data,
        candidates: data.candidates.map((candidate) => (
          candidate.fighterId === api.ownerId
            ? { ...candidate, weight: 0, reason: "status:stunned" }
            : candidate
        )),
      };
    },
  },
};

const INJURY_IMPLEMENTATIONS = {
  "leg-damage": {
    beforeInitialize: (data, api) => applyInitializationModifiers(
      data, api, { trauma: "leg", fatigue: 8 },
      "Повреждение ноги снизило инициативу и добавило усталость",
    ),
  },
  "arm-damage": {
    beforeInitialize: (data, api) => applyInitializationModifiers(
      data, api, { trauma: "arm" },
      "Повреждение руки снизило силу",
    ),
  },
  "head-damage": {
    beforeInitialize: (data, api) => applyInitializationModifiers(
      data, api, { charisma: -12, fatigue: 10 },
      "Повреждение головы снизило харизму и добавило усталость",
    ),
  },
  "bruised-ribs": {
    beforeInitialize: (data, api) => applyInitializationModifiers(
      data, api, { health: -18, fatigue: 5 },
      "Ушиб рёбер снизил здоровье и добавил усталость",
    ),
  },
  exhaustion: {
    beforeInitialize: (data, api) => applyInitializationModifiers(
      data, api, { strength: -8, fatigue: 20 },
      "Истощение снизило силу и повысило усталость",
    ),
  },
};

const createStats = () => ({
  actions: 0,
  hits: 0,
  misses: 0,
  dodges: 0,
  blocks: 0,
  damageDealt: 0,
  damageReceived: 0,
  traumasReceived: 0,
  fatigueGained: 0,
  modifierActivations: 0,
  maxConsecutiveActions: 0,
});

const createDefaultBattleInput = () => ({
  seed: "arena-001",
  maxSteps: 80,
  arena: {
    type: "crowd",
    supportMultipliers: [1, 1],
  },
  fighters: [
    {
      id: "fighter-1",
      name: "Тит",
      base: { strength: 54, health: 200, charisma: 68 },
      criticalChance: COMBAT_RULES.critical.chance,
      classTechniqueChance: COMBAT_RULES.classTechnique.chance,
      fighterClass: "retiarius",
      equipment: {
        weaponSet: { definitionId: "retiarius-arms.good" },
        armorSet: { definitionId: "retiarius-armor.good" },
      },
      perks: ["strong-bones"],
      buffs: [],
      buffLoadout: { buffDefinitionIds: ["rally", "forward", "now"] },
      injuries: [],
    },
    {
      id: "fighter-2",
      name: "Маркус",
      base: { strength: 62, health: 240, charisma: 75 },
      criticalChance: COMBAT_RULES.critical.chance,
      classTechniqueChance: COMBAT_RULES.classTechnique.chance,
      fighterClass: "murmillo",
      equipment: {
        weaponSet: { definitionId: "murmillo-arms.good" },
        armorSet: { definitionId: "murmillo-armor.good" },
      },
      perks: ["cornered-beast"],
      buffs: [],
      buffLoadout: { buffDefinitionIds: [] },
      injuries: [],
    },
  ],
});

class BattleModifierManager {
  constructor(engine, instances) {
    this.engine = engine;
    this.instances = instances;
  }

  run(method, initialData) {
    let data = clone(initialData);
    for (const modifier of this.instances) {
      const hook = modifier.implementation[method];
      if (typeof hook !== "function") continue;
      const before = clone(data);
      const runtimeBefore = clone(modifier.runtime);
      const api = this.engine.createModifierApi(modifier);
      const returned = hook(clone(data), api, modifier.runtime);
      data = returned === undefined ? data : clone(returned);
      this.engine.emit("modifier.hook", `${modifier.id}.${method}`, {
        modifierId: modifier.id,
        kind: modifier.kind,
        instanceId: modifier.instanceId,
        ownerId: modifier.ownerId,
        sourceId: modifier.sourceId,
        before,
        after: data,
        runtimeBefore,
        runtimeAfter: clone(modifier.runtime),
      });
    }
    return data;
  }

  add(instance) {
    this.instances.push(instance);
    this.instances.sort((left, right) =>
      left.priority - right.priority
        || left.id.localeCompare(right.id)
        || left.instanceId.localeCompare(right.instanceId));
  }

  remove(instanceId) {
    const index = this.instances.findIndex((modifier) => modifier.instanceId === instanceId);
    if (index >= 0) this.instances.splice(index, 1);
  }

  snapshot() {
    return this.instances.map((modifier) => ({
      id: modifier.id,
      instanceId: modifier.instanceId,
      kind: modifier.kind,
      ownerId: modifier.ownerId,
      sourceId: modifier.sourceId,
      priority: modifier.priority,
      durationIterations: modifier.durationIterations ?? null,
      runtime: clone(modifier.runtime),
    }));
  }
}

class BattleEngine {
  constructor(rawInput) {
    this.input = normalizeInput(rawInput);
    if (this.input.fighters.length !== 2) {
      throw new Error("Прототип поддерживает ровно двух бойцов");
    }
    this.random = createRandom(this.input.seed);
    this.events = [];
    this.snapshots = [];
    this.sequence = 0;
    this.currentPhase = "idle";
    this.lastAction = null;
    this.lastActorId = null;
    this.consecutiveActions = 0;
    this.dynamicModifierSequence = 0;
    this.modifierManager = new BattleModifierManager(this, this.createModifiers());
    this.state = null;
  }

  createModifiers() {
    const modifiers = [];
    this.input.fighters.forEach((fighter) => {
      const addModifiers = (ids, implementations, kind, priority, sourceId = null) => {
        ids.forEach((modifierId, index) => {
          const implementation = implementations[modifierId];
          if (!implementation) return;
          modifiers.push({
            id: modifierId,
            instanceId: `${kind}:${fighter.id}:${index}:${modifierId}`,
            kind,
            ownerId: fighter.id,
            sourceId,
            priority,
            implementation,
            runtime: { activations: 0, used: false },
          });
        });
      };
      const weaponItem = WEAPON_ITEMS.find((item) => item.id === fighter.equipment.weaponSet.definitionId);
      const armorItem = ARMOR_ITEMS.find((item) => item.id === fighter.equipment.armorSet.definitionId);
      const weaponSet = WEAPON_SET_DEFINITIONS.find((item) => item.id === weaponItem?.setId);
      addModifiers(
        weaponSet ? [weaponSet.techniqueId] : [],
        CLASS_TECHNIQUE_IMPLEMENTATIONS,
        "class-technique",
        40,
        weaponItem?.id,
      );
      addModifiers(weaponItem?.additionalPerkIds || [], EQUIPMENT_MODIFIER_IMPLEMENTATIONS, "equipment", 45, weaponItem?.id);
      addModifiers(armorItem?.additionalPerkIds || [], EQUIPMENT_MODIFIER_IMPLEMENTATIONS, "equipment", 45, armorItem?.id);
      addModifiers(fighter.buffs, BUFF_IMPLEMENTATIONS, "buff", 50);
      addModifiers(fighter.injuries, INJURY_IMPLEMENTATIONS, "injury", 60);
      addModifiers(fighter.perks, PERK_IMPLEMENTATIONS, "perk", 100);
    });
    return modifiers.sort((left, right) =>
      left.priority - right.priority
        || left.id.localeCompare(right.id)
        || left.instanceId.localeCompare(right.instanceId),
    );
  }

  simulate() {
    this.initialize();
    this.processScheduledPlayerBuffCommands(0);

    while (this.state.status === "running") {
      this.runStep();
    }

    return this.finishBattle();
  }

  initialize() {
    const fighters = this.input.fighters.map((fighter, index) => {
      const weaponItem = WEAPON_ITEMS.find((item) => item.id === fighter.equipment.weaponSet.definitionId);
      const armorItem = ARMOR_ITEMS.find((item) => item.id === fighter.equipment.armorSet.definitionId);
      const weaponSet = WEAPON_SET_DEFINITIONS.find((item) => item.id === weaponItem.setId);
      const support = clamp(
        fighter.base.charisma * this.input.arena.supportMultipliers[index],
        0,
        150,
      );
      return {
        id: fighter.id,
        name: fighter.name,
        fighterClass: fighter.fighterClass,
        base: clone(fighter.base),
        criticalChance: fighter.criticalChance,
        classTechniqueChance: fighter.classTechniqueChance,
        equipment: {
          weaponSet: clone(fighter.equipment.weaponSet),
          armorSet: clone(fighter.equipment.armorSet),
          weaponPower: weaponItem.stats.weaponPower,
          accuracy: weaponItem.stats.accuracy,
          armor: armorItem.stats.armor,
          weight: weaponItem.stats.weight + armorItem.stats.weight,
          mobility: armorItem.stats.mobility,
        },
        equipmentPerks: [
          weaponSet.techniqueId,
          ...weaponItem.additionalPerkIds,
          ...armorItem.additionalPerkIds,
        ],
        matchup: null,
        initiativeEquipmentBonus: 0,
        maxHealth: fighter.base.health,
        health: fighter.base.health,
        temporaryHealth: 0,
        strength: fighter.base.strength,
        support: round(support),
        initiative: 1,
        fatigue: 0,
        traumas: [],
        perks: [...fighter.perks],
        buffs: [...fighter.buffs],
        buffLoadout: clone(fighter.buffLoadout),
        injuries: [...fighter.injuries],
        stats: createStats(),
      };
    });

    this.state = {
      step: 0,
      status: "running",
      outcome: null,
      fighters,
      arena: clone(this.input.arena),
      pendingEffects: [],
      playerBuffs: {
        applications: [],
        fighters: Object.fromEntries(fighters.map((fighter) => [fighter.id, {
          appliedCount: 0,
          buffs: fighter.buffLoadout.buffDefinitionIds.map((definitionId) => ({
            definitionId,
            state: "available",
            applicationId: null,
          })),
        }])),
      },
    };

    const initialized = this.runPhase(
      "initialize",
      "beforeInitialize",
      "afterInitialize",
      { fighters: clone(this.state.fighters), arena: clone(this.state.arena) },
      (data) => data,
    );
    this.state.fighters = initialized.fighters;
    this.state.arena = initialized.arena;
    this.modifierManager.instances.forEach((modifier) => {
      if (modifier.runtime.activations > 0) {
        this.getFighter(modifier.ownerId).stats.modifierActivations += modifier.runtime.activations;
      }
    });

    this.emit("battle.initialized", "Бой инициализирован", {
      input: this.input,
      dynamicState: this.state,
    });
    this.recalculateAll("initialization");
    this.runPhase(
      "battle-start",
      "beforeBattleStart",
      "afterBattleStart",
      { fighters: this.state.fighters.map((fighter) => this.fighterNumbers(fighter)) },
      (data) => data,
    );
    this.captureSnapshot("Начальное состояние");
  }

  addDynamicModifier({ id, kind, ownerId, sourceId = null, durationIterations = null }) {
    const implementation = PLAYER_BUFF_MODIFIER_IMPLEMENTATIONS[id];
    if (!implementation) throw new Error(`Неизвестный динамический модификатор ${id}`);
    const instance = {
      id,
      instanceId: `${kind}:${ownerId}:${++this.dynamicModifierSequence}:${id}`,
      kind,
      ownerId,
      sourceId,
      priority: 50,
      implementation,
      durationIterations,
      runtime: {
        activations: 1,
        used: false,
        activatedAfterIteration: this.state.step,
        ...(durationIterations == null ? {} : { remainingIterations: durationIterations }),
      },
    };
    this.modifierManager.add(instance);
    this.emit("modifier.added", `Добавлен модификатор ${id}`, {
      modifierId: id,
      kind,
      instanceId: instance.instanceId,
      ownerId,
      sourceId,
      durationIterations,
    });
    return instance;
  }

  tickTimedModifiers() {
    const expiring = [];
    this.modifierManager.instances.forEach((modifier) => {
      if (!Number.isInteger(modifier.runtime.remainingIterations)) return;
      if (modifier.runtime.activatedAfterIteration >= this.state.step) return;
      modifier.runtime.remainingIterations -= 1;
      this.emit("modifier.timer.changed", `Таймер ${modifier.id}: ${modifier.runtime.remainingIterations}`, {
        modifierId: modifier.id,
        instanceId: modifier.instanceId,
        ownerId: modifier.ownerId,
        remainingIterations: modifier.runtime.remainingIterations,
      });
      if (modifier.runtime.remainingIterations <= 0) expiring.push(modifier);
    });
    if (!expiring.length) return;

    expiring.forEach((modifier) => {
      this.modifierManager.remove(modifier.instanceId);
      this.emit("modifier.expired", `Истёк модификатор ${modifier.id}`, {
        modifierId: modifier.id,
        instanceId: modifier.instanceId,
        ownerId: modifier.ownerId,
        sourceId: modifier.sourceId,
      });
      if (modifier.id === "player-forward") {
        this.addDynamicModifier({
          id: "player-forward-penalty",
          kind: "debuff",
          ownerId: modifier.ownerId,
          sourceId: modifier.sourceId,
        });
      }
      if (modifier.id === "player-hold-on") {
        const fighter = this.getFighter(modifier.ownerId);
        const expiredTemporaryHealth = fighter.temporaryHealth;
        fighter.temporaryHealth = 0;
        this.emit("temporary-health.expired", `${fighter.name}: временное здоровье «Держись!» исчезло`, {
          fighterId: fighter.id,
          sourceId: modifier.sourceId,
          expiredTemporaryHealth,
        });
        this.addDynamicModifier({
          id: "player-hold-on-penalty",
          kind: "debuff",
          ownerId: modifier.ownerId,
          sourceId: modifier.sourceId,
        });
      }
      if (modifier.id === "player-stunned") {
        this.emit("status.expired", `${this.getFighter(modifier.ownerId).name} больше не оглушён`, {
          fighterId: modifier.ownerId,
          statusId: "stunned",
        });
      }
      const application = this.state.playerBuffs.applications.find((item) => (
        item.applicationId === modifier.sourceId
      ));
      if (application && modifier.id !== "player-forward-penalty") {
        application.state = "used";
        const buffState = this.state.playerBuffs.fighters[application.fighterId]?.buffs
          .find((item) => item.definitionId === application.buffDefinitionId);
        if (buffState) buffState.state = "used";
      }
    });
    this.recalculateAll("modifier-expired");
  }

  endTimedModifiersAtBattleEnd() {
    const timed = this.modifierManager.instances.filter((modifier) => (
      Number.isInteger(modifier.runtime.remainingIterations)
    ));
    timed.forEach((modifier) => {
      this.modifierManager.remove(modifier.instanceId);
      if (modifier.id === "player-hold-on") this.getFighter(modifier.ownerId).temporaryHealth = 0;
      this.emit("modifier.battle-ended", `Действие ${modifier.id} прекращено с завершением боя`, {
        modifierId: modifier.id,
        instanceId: modifier.instanceId,
        ownerId: modifier.ownerId,
        sourceId: modifier.sourceId,
        remainingIterations: modifier.runtime.remainingIterations,
      });
      const application = this.state.playerBuffs.applications.find((item) => item.applicationId === modifier.sourceId);
      if (application) {
        application.state = "used";
        const buffState = this.state.playerBuffs.fighters[application.fighterId]?.buffs
          .find((item) => item.definitionId === application.buffDefinitionId);
        if (buffState) buffState.state = "used";
      }
    });
  }

  processScheduledPlayerBuffCommands(afterIteration) {
    this.input.playerBuffCommands
      .filter((command) => command.afterIteration === afterIteration)
      .forEach((command) => this.applyPlayerBuffCommand(command));
  }

  rejectPlayerBuffCommand(command, reason) {
    this.emit("player-buff.rejected", `Баф ${command.buffDefinitionId} отклонён: ${reason}`, {
      command,
      reason,
    });
  }

  applyPlayerBuffCommand(command) {
    const fighterBuffs = this.state.playerBuffs.fighters[command.fighterId];
    const buffState = fighterBuffs?.buffs.find((item) => item.definitionId === command.buffDefinitionId);
    if (this.state.status !== "running") return this.rejectPlayerBuffCommand(command, "battle-finished");
    if (!fighterBuffs || !buffState) return this.rejectPlayerBuffCommand(command, "not-in-loadout");
    if (buffState.state !== "available") return this.rejectPlayerBuffCommand(command, "already-used");
    if (fighterBuffs.appliedCount >= 3) return this.rejectPlayerBuffCommand(command, "battle-limit-reached");
    const fighter = this.getFighter(command.fighterId);
    if (command.buffDefinitionId === "rally" && fighter.fatigue <= 0) {
      return this.rejectPlayerBuffCommand(command, "zero-fatigue");
    }

    const applicationId = `player-buff:${command.fighterId}:${command.commandSequence}:${command.buffDefinitionId}`;
    const isTimed = ["forward", "hold-on"].includes(command.buffDefinitionId);
    const application = {
      applicationId,
      commandSequence: command.commandSequence,
      fighterId: command.fighterId,
      buffDefinitionId: command.buffDefinitionId,
      appliedAfterIteration: command.afterIteration,
      state: isTimed ? "active" : "used",
    };
    fighterBuffs.appliedCount += 1;
    buffState.state = application.state;
    buffState.applicationId = applicationId;
    this.state.playerBuffs.applications.push(application);

    if (command.buffDefinitionId === "rally") {
      const nextFatigue = Math.floor(fighter.fatigue * 0.65);
      this.applyEffects([{
        type: "fatigue",
        fighterId: fighter.id,
        value: nextFatigue - fighter.fatigue,
        reason: "player-buff:rally",
      }]);
      this.recalculateAll("player-buff:rally");
    }
    if (command.buffDefinitionId === "forward") {
      this.addDynamicModifier({
        id: "player-forward",
        kind: "buff",
        ownerId: fighter.id,
        sourceId: applicationId,
        durationIterations: 5,
      });
      this.recalculateAll("player-buff:forward");
    }
    if (command.buffDefinitionId === "now") {
      this.applyEffects([{
        type: "fatigue",
        fighterId: fighter.id,
        value: 15,
        reason: "player-buff:now",
      }]);
      this.recalculateAll("player-buff:now");
    }
    if (command.buffDefinitionId === "hold-on") {
      this.addDynamicModifier({
        id: "player-hold-on",
        kind: "buff",
        ownerId: fighter.id,
        sourceId: applicationId,
        durationIterations: 5,
      });
      this.applyEffects([{
        type: "temporary-health",
        fighterId: fighter.id,
        value: round(fighter.maxHealth * 0.2),
        reason: "player-buff:hold-on",
      }]);
    }

    const definition = PLAYER_BUFF_DEFINITIONS.find((item) => item.id === command.buffDefinitionId);
    this.emit("player-buff.applied", `${fighter.name}: ${definition?.name || command.buffDefinitionId}`, {
      command,
      application: clone(application),
    });
    this.captureSnapshot(`${fighter.name} применяет «${definition?.name || command.buffDefinitionId}»`);

    if (command.buffDefinitionId === "now" && this.state.status === "running") {
      this.runPlayerBuffSpecialAction(fighter.id, applicationId);
    }
    return application;
  }

  runPlayerBuffSpecialAction(fighterId, applicationId) {
    const actor = this.getFighter(fighterId);
    const target = this.getOpponent(fighterId);
    if (actor.health <= 0 || target.health <= 0) return;
    this.state.step += 1;
    this.trackActionStreak(actor.id);
    const classTechnique = actor.equipmentPerks[0] || null;
    const attackType = actor.fighterClass === "retiarius"
      ? "retiarius-enhanced-jump"
      : "enhanced-class-technique";
    const actionSelection = this.runPhase(
      "select-action",
      "beforeSelectAction",
      "afterSelectAction",
      {
        actorId: actor.id,
        targetId: target.id,
        availableActions: ["enhanced-class-technique"],
        classTechnique,
        playerBuffApplicationId: applicationId,
      },
      (data) => ({
        ...data,
        action: "attack",
        attackType,
        specialAttack: "player-buff-now",
        strengthMultiplier: 1.25,
        unblockable: true,
        undodgeable: true,
        guaranteedHit: true,
        stunIterations: 2,
      }),
    );
    this.executeAction(actionSelection);
  }

  runStep() {
    this.state.step += 1;

    const selection = this.runPhase(
      "select-actor",
      "beforeSelectActor",
      "afterSelectActor",
      {
        candidates: this.state.fighters.map((fighter) => ({
          fighterId: fighter.id,
          weight: fighter.initiative,
        })),
      },
      (data) => {
        const selected = weightedPick(data.candidates, this.random);
        return {
          ...data,
          actorId: selected.fighterId,
          roll: selected.roll,
          totalWeight: selected.totalWeight,
          reason: selected.reason || "initiative-weighted-random",
          classTechnique: selected.classTechnique || null,
          classTechniqueChance: selected.classTechniqueChance ?? data.classTechniqueChance ?? null,
          classTechniqueRoll: selected.classTechniqueRoll ?? data.classTechniqueRoll ?? null,
        };
      },
    );

    const actor = this.getFighter(selection.actorId);
    const target = this.getOpponent(actor.id);
    this.trackActionStreak(actor.id);

    const actionSelection = this.runPhase(
      "select-action",
      "beforeSelectAction",
      "afterSelectAction",
      {
        actorId: actor.id,
        targetId: target.id,
        availableActions: ["attack"],
        classTechnique: selection.classTechnique || null,
        classTechniqueChance: selection.classTechniqueChance,
        classTechniqueRoll: selection.classTechniqueRoll,
      },
      (data) => ({ ...data, action: "attack" }),
    );

    this.executeAction(actionSelection);
  }

  executeAction(actionSelection) {
    const actor = this.getFighter(actionSelection.actorId);
    const target = this.getFighter(actionSelection.targetId);
    const resolvedAction = this.runPhase(
      "action",
      "beforeAction",
      "afterAction",
      actionSelection,
      (data) => this.resolveAction(data),
    );
    const action = this.finalizeActionDamage(resolvedAction);
    if (action.outcome === "hit") {
      this.emit("action.damage.resolved", "Рассчитаны сила попадания и критический удар", {
        actorId: action.actorId,
        targetId: action.targetId,
        strikePowerRoll: action.strikePowerRoll,
        strikePowerMultiplier: action.strikePowerMultiplier,
        damageBeforeCritical: action.damageBeforeCritical,
        criticalChance: action.criticalChance,
        criticalRoll: action.criticalRoll,
        critical: action.critical,
        criticalMultiplier: action.criticalMultiplier,
        classTechnique: action.classTechnique || null,
        classTechniqueChance: action.classTechniqueChance ?? null,
        classTechniqueRoll: action.classTechniqueRoll ?? null,
        damage: action.damage,
        impact: action.impact,
      });
    }

    const effects = this.createEffects(action);
    const effectsResult = this.runPhase(
      "apply-effects",
      "beforeApplyEffects",
      "afterApplyEffects",
      { actorId: actor.id, targetId: target.id, action, effects },
      (data) => ({ ...data, appliedEffects: data.effects }),
    );
    const queuedEffects = this.state.pendingEffects.splice(0);
    if (queuedEffects.length) {
      this.emit("effect.queue.flush", "Дополнительные эффекты перков добавлены к фазе", { queuedEffects });
    }
    this.applyEffects([...effectsResult.appliedEffects, ...queuedEffects]);

    if (action.stunIterations > 0 && target.health > 0) {
      this.addDynamicModifier({
        id: "player-stunned",
        kind: "status",
        ownerId: target.id,
        sourceId: action.playerBuffApplicationId || null,
        durationIterations: action.stunIterations,
      });
      this.emit("status.applied", `${target.name} оглушён`, {
        fighterId: target.id,
        statusId: "stunned",
        durationIterations: action.stunIterations,
        sourceApplicationId: action.playerBuffApplicationId || null,
      });
    }

    this.updateStats(action);
    this.lastAction = clone(action);
    this.recalculateAll("after-action");

    const defeatResult = this.runPhase(
      "defeat-check",
      "beforeDefeatCheck",
      "afterDefeatCheck",
      {
        fighters: this.state.fighters.map((fighter) => ({
          fighterId: fighter.id,
          health: fighter.health,
          defeated: fighter.health <= 0,
        })),
      },
      (data) => ({
        ...data,
        defeatedIds: data.fighters.filter((fighter) => fighter.defeated).map((fighter) => fighter.fighterId),
      }),
    );

    if (defeatResult.defeatedIds.length > 0) {
      const loserId = defeatResult.defeatedIds[0];
      this.state.outcome = {
        type: "victory",
        winnerId: this.getOpponent(loserId).id,
        loserId,
        reason: "defeat",
      };
      this.state.status = "finished";
      this.emit("battle.victory", `${this.getOpponent(loserId).name} побеждает`, this.state.outcome);
    } else {
      const stepLimit = this.runPhase(
        "step-limit-check",
        "beforeStepLimitCheck",
        "afterStepLimitCheck",
        { step: this.state.step, maxSteps: this.input.maxSteps },
        (data) => ({ ...data, reached: data.step >= data.maxSteps }),
      );
      if (stepLimit.reached) {
        this.state.outcome = { type: "draw", reason: "step_limit" };
        this.state.status = "finished";
        this.emit("battle.draw", "Лимит шагов достигнут: ничья", this.state.outcome);
      }
    }

    if (this.state.status === "running") {
      this.tickTimedModifiers();
    } else {
      this.endTimedModifiersAtBattleEnd();
    }
    this.captureSnapshot(this.describeAction(action));
    if (this.state.status === "running") {
      this.processScheduledPlayerBuffCommands(this.state.step);
    }
  }

  resolveAction(data) {
    const actor = this.getFighter(data.actorId);
    const target = this.getFighter(data.targetId);
    const fatigueEfficiency = clamp(1 - actor.fatigue / 160, 0.35, 1);
    const strengthMultiplier = data.strengthMultiplier || 1;
    const effectiveStrength = actor.strength * fatigueEfficiency * strengthMultiplier;

    if (data.attackType === "achilles-leap" || data.guaranteedHit) {
      const strike = this.rollStrikeDamage(actor, target, effectiveStrength);
      const damage = strike.damage;
      const traumaChance = calculateTraumaChance(damage, target.maxHealth);
      return {
        ...data,
        outcome: "hit",
        weights: { miss: 0, dodge: 0, block: 0, hit: 1 },
        actorFatigueBefore: actor.fatigue,
        targetFatigueBefore: target.fatigue,
        effectiveStrength: round(effectiveStrength),
        criticalChance: actor.criticalChance,
        ...strike,
        damage,
        traumaChance: round(traumaChance, 4),
        traumaRoll: round(this.random(), 6),
        outcomeRoll: null,
        totalOutcomeWeight: 1,
      };
    }

    const missWeight = Math.max(2, 9 + actor.fatigue * 0.32 - actor.equipment.accuracy * 0.8);
    const dodgeWeight = data.undodgeable ? 0 : clamp(
      9 + target.initiative * 0.1 - target.fatigue * 0.08 + target.equipment.mobility,
      4,
      32,
    );
    const blockWeight = data.unblockable ? 0 : clamp(10 + target.equipment.armor * 0.85 - target.fatigue * 0.09, 4, 34);
    const hitWeight = 52 + actor.strength * 0.18;
    const weights = [
      { outcome: "miss", weight: missWeight },
      { outcome: "dodge", weight: dodgeWeight },
      { outcome: "block", weight: blockWeight },
      { outcome: "hit", weight: hitWeight },
    ];
    const selectedOutcome = weightedPick(weights, this.random);
    const outcome = selectedOutcome.outcome;
    const strike = outcome === "hit"
      ? this.rollStrikeDamage(actor, target, effectiveStrength)
      : { strikePowerRoll: null, strikePowerMultiplier: null, damage: 0 };
    const damage = strike.damage;
    const traumaChance = outcome === "hit"
      ? calculateTraumaChance(damage, target.maxHealth)
      : 0;

    return {
      ...data,
      outcome,
      weights: Object.fromEntries(weights.map((item) => [item.outcome, round(item.weight)])),
      actorFatigueBefore: actor.fatigue,
      targetFatigueBefore: target.fatigue,
      effectiveStrength: round(effectiveStrength),
      criticalChance: actor.criticalChance,
      ...strike,
      damage,
      traumaChance: round(traumaChance, 4),
      traumaRoll: round(this.random(), 6),
      outcomeRoll: selectedOutcome.roll,
      totalOutcomeWeight: selectedOutcome.totalWeight,
    };
  }

  rollStrikeDamage(actor, target, effectiveStrength) {
    const rules = COMBAT_RULES.strikePower;
    const rawStrikePowerRoll = this.random();
    const strikePowerRoll = round(rawStrikePowerRoll, 6);
    const strikePowerMultiplier = round(
      rules.minMultiplier + rawStrikePowerRoll * (rules.maxMultiplier - rules.minMultiplier),
      4,
    );
    const attackPower = (effectiveStrength + actor.equipment.weaponPower)
      * rules.baseCoefficient
      * strikePowerMultiplier;
    return {
      strikePowerRoll,
      strikePowerMultiplier,
      damage: Math.max(1, Math.round(attackPower - target.equipment.armor * 0.6)),
    };
  }

  finalizeActionDamage(action) {
    const criticalChance = Number.isFinite(Number(action.criticalChance))
      ? clamp(Number(action.criticalChance), 0, 1)
      : COMBAT_RULES.critical.chance;
    if (action.outcome !== "hit") {
      return {
        ...action,
        damage: 0,
        damageBeforeCritical: 0,
        criticalChance,
        criticalRoll: null,
        critical: false,
        criticalMultiplier: 1,
        impact: null,
      };
    }
    const damageBeforeCritical = Math.max(1, Math.round(action.damage));
    const rawCriticalRoll = this.random();
    const criticalRoll = round(rawCriticalRoll, 6);
    const critical = rawCriticalRoll < criticalChance;
    const criticalMultiplier = critical ? COMBAT_RULES.critical.damageMultiplier : 1;
    const strikePowerMultiplier = action.strikePowerMultiplier ?? 1;
    const impact = critical
      ? "critical"
      : strikePowerMultiplier < COMBAT_RULES.strikePower.lightBelow
        ? "light"
        : strikePowerMultiplier >= COMBAT_RULES.strikePower.strongFrom
          ? "strong"
          : "normal";
    return {
      ...action,
      damageBeforeCritical,
      criticalChance,
      criticalRoll,
      critical,
      criticalMultiplier,
      damage: damageBeforeCritical * criticalMultiplier,
      impact,
    };
  }

  createEffects(action) {
    const actor = this.getFighter(action.actorId);
    const target = this.getFighter(action.targetId);
    const actorMultiplier = this.supportMultiplier(actor.id);
    const targetMultiplier = this.supportMultiplier(target.id);
    const effects = [
      {
        type: "fatigue",
        fighterId: actor.id,
        value: round(5 + actor.equipment.weight * 0.22),
        reason: "action",
      },
    ];

    if (action.outcome === "miss") {
      effects.push({ type: "support", fighterId: actor.id, value: round(-2 * actorMultiplier), reason: "miss" });
    }
    if (action.outcome === "dodge") {
      effects.push({ type: "fatigue", fighterId: target.id, value: round(4 + target.equipment.weight * 0.12), reason: "dodge" });
      effects.push({ type: "support", fighterId: target.id, value: round(2.5 * targetMultiplier), reason: "dodge" });
    }
    if (action.outcome === "block") {
      effects.push({ type: "fatigue", fighterId: target.id, value: round(5 + target.equipment.weight * 0.16), reason: "block" });
      effects.push({ type: "support", fighterId: target.id, value: round(1.5 * targetMultiplier), reason: "block" });
    }
    if (action.outcome === "hit") {
      effects.push({ type: "health", fighterId: target.id, value: -action.damage, reason: "hit" });
      effects.push({ type: "support", fighterId: actor.id, value: round(3 * actorMultiplier), reason: "hit" });
      effects.push({ type: "support", fighterId: target.id, value: round(-1.5 * targetMultiplier), reason: "wounded" });
      if (action.traumaRoll < action.traumaChance) {
        effects.push({
          type: "trauma",
          fighterId: target.id,
          value: this.random() < COMBAT_RULES.trauma.armChance ? "arm" : "leg",
          reason: "heavy-hit",
        });
      }
    }

    return effects;
  }

  applyEffects(effects) {
    for (const effect of effects) {
      const fighter = this.getFighter(effect.fighterId);
      const before = clone(fighter);
      if (effect.type === "health") {
        const incomingDamage = Math.max(0, -effect.value);
        const absorbed = Math.min(fighter.temporaryHealth || 0, incomingDamage);
        if (absorbed > 0) fighter.temporaryHealth = round(fighter.temporaryHealth - absorbed);
        fighter.health = round(fighter.health + effect.value + absorbed);
      }
      if (effect.type === "temporary-health") {
        fighter.temporaryHealth = Math.max(0, round(fighter.temporaryHealth + effect.value));
      }
      if (effect.type === "fatigue") {
        fighter.fatigue = clamp(round(fighter.fatigue + effect.value), 0, 150);
        fighter.stats.fatigueGained = round(fighter.stats.fatigueGained + effect.value);
      }
      if (effect.type === "support") {
        fighter.support = clamp(round(fighter.support + effect.value), 0, 150);
      }
      if (effect.type === "trauma") {
        fighter.traumas.push({
          type: effect.value,
          step: this.state.step,
          source: "battle",
          reason: effect.reason,
        });
        fighter.stats.traumasReceived += 1;
      }
      this.emit("effect.applied", `Применён эффект ${effect.type} к ${fighter.name}`, {
        effect,
        before: this.fighterNumbers(before),
        after: this.fighterNumbers(fighter),
      });
    }
  }

  recalculateAll(reason) {
    for (const fighter of this.state.fighters) {
      const strength = this.runPhase(
        "recalculate-strength",
        "beforeRecalculateStrength",
        "afterRecalculateStrength",
        {
          fighterId: fighter.id,
          baseStrength: fighter.base.strength,
          reason,
        },
        (data) => {
          const armPenalty = fighter.traumas.filter((trauma) => trauma.type === "arm").length * 0.15;
          return { ...data, strength: round(data.baseStrength * clamp(1 - armPenalty, 0.4, 1)) };
        },
      );
      fighter.strength = strength.strength;

      const support = this.runPhase(
        "recalculate-support",
        "beforeRecalculateSupport",
        "afterRecalculateSupport",
        { fighterId: fighter.id, support: fighter.support, reason },
        (data) => ({ ...data, support: clamp(round(data.support), 0, 150) }),
      );
      fighter.support = support.support;

      const initiative = this.runPhase(
        "recalculate-initiative",
        "beforeRecalculateInitiative",
        "afterRecalculateInitiative",
        {
          fighterId: fighter.id,
          support: fighter.support,
          strength: fighter.strength,
          fatigue: fighter.fatigue,
          reason,
        },
        (data) => {
          const legPenalty = fighter.traumas.filter((trauma) => trauma.type === "leg").length * 9;
          return {
            ...data,
            initiative: round(Math.max(
              1,
              15 + data.support * 0.55 + data.strength * 0.25 - data.fatigue * 0.45
                - legPenalty + fighter.equipment.mobility + (fighter.initiativeEquipmentBonus || 0),
            )),
          };
        },
      );
      fighter.initiative = initiative.initiative;
    }
  }

  runPhase(phase, beforeMethod, afterMethod, input, calculate) {
    this.currentPhase = phase;
    this.emit("phase.start", `Начало фазы ${phase}`, { input });
    const prepared = this.runHooks(beforeMethod, input);
    const calculated = calculate(clone(prepared));
    const result = this.runHooks(afterMethod, calculated);
    this.emit("phase.finish", `Завершение фазы ${phase}`, {
      prepared,
      calculated,
      result,
    });
    if (phase !== "apply-effects" && this.state?.pendingEffects?.length) {
      const queued = this.state.pendingEffects.splice(0);
      this.emit("effect.queue.flush", "Применение дополнительных эффектов перков", { queued });
      this.applyEffects(queued);
    }
    return result;
  }

  runHooks(method, initialData) {
    return this.modifierManager.run(method, initialData);
  }

  createModifierApi(modifier) {
    return {
      ownerId: modifier.ownerId,
      kind: modifier.kind,
      instanceId: modifier.instanceId,
      state: clone(this.state),
      random: () => this.random(),
      canActivate: () => true,
      enqueue: (effect) => this.state.pendingEffects.push(clone(effect)),
      emit: (type, message, data = {}) => this.emit(type, message, {
        modifierId: modifier.id,
        kind: modifier.kind,
        instanceId: modifier.instanceId,
        ownerId: modifier.ownerId,
        ...data,
      }),
      activate: (message) => {
        modifier.runtime.activations += 1;
        if (this.currentPhase !== "initialize") {
          this.getFighter(modifier.ownerId).stats.modifierActivations += 1;
        }
        this.emit("modifier.activated", message, {
          modifierId: modifier.id,
          kind: modifier.kind,
          instanceId: modifier.instanceId,
          ownerId: modifier.ownerId,
          activation: modifier.runtime.activations,
        });
      },
    };
  }

  updateStats(action) {
    const actor = this.getFighter(action.actorId);
    const target = this.getFighter(action.targetId);
    actor.stats.actions += 1;
    if (action.outcome === "hit") {
      actor.stats.hits += 1;
      actor.stats.damageDealt += action.damage;
      target.stats.damageReceived += action.damage;
    } else if (action.outcome === "miss") {
      actor.stats.misses += 1;
    } else if (action.outcome === "dodge") {
      target.stats.dodges += 1;
    } else if (action.outcome === "block") {
      target.stats.blocks += 1;
    }
  }

  trackActionStreak(actorId) {
    if (actorId === this.lastActorId) {
      this.consecutiveActions += 1;
    } else {
      this.lastActorId = actorId;
      this.consecutiveActions = 1;
    }
    const actor = this.getFighter(actorId);
    actor.stats.maxConsecutiveActions = Math.max(actor.stats.maxConsecutiveActions, this.consecutiveActions);
  }

  finishBattle() {
    let fighterResults = this.state.fighters.map((fighter) => {
      const outcomeType = this.state.outcome.type === "draw"
        ? "draw"
        : this.state.outcome.winnerId === fighter.id
          ? "victory"
          : "defeat";
      const healthRatio = fighter.health / fighter.maxHealth;
      const deathChance = fighter.health <= 0
        ? clamp(0.08 + fighter.stats.damageReceived / fighter.maxHealth * 0.14 + Math.abs(fighter.health) / fighter.maxHealth * 0.35, 0.05, 0.58)
        : clamp((1 - healthRatio) * 0.04 + fighter.traumas.length * 0.015, 0, 0.12);
      const injuryChance = clamp(
        0.08
          + fighter.stats.damageReceived / fighter.maxHealth * 0.32
          + fighter.traumas.length * 0.12
          + (outcomeType === "defeat" ? 0.12 : 0),
        0.05,
        0.78,
      );

      const outcome = this.runPhase(
        "outcome",
        "beforeOutcome",
        "afterOutcome",
        {
          fighterId: fighter.id,
          battleOutcome: outcomeType,
          deathChance: round(deathChance, 4),
          injuryChance: round(injuryChance, 4),
        },
        (data) => {
          const deathRoll = round(this.random(), 6);
          const injuryRoll = round(this.random(), 6);
          return {
            ...data,
            deathRoll,
            injuryRoll,
            survived: deathRoll >= data.deathChance,
            postBattleInjury: injuryRoll < data.injuryChance,
          };
        },
      );

      const postBattleInjury = outcome.survived && outcome.postBattleInjury;
      if (postBattleInjury) {
        fighter.traumas.push({ type: "post-battle", step: this.state.step, source: "outcome" });
        fighter.stats.traumasReceived += 1;
      }
      return {
        id: fighter.id,
        name: fighter.name,
        battleOutcome: outcomeType,
        survived: outcome.survived,
        postBattleInjury,
        deathChance: outcome.deathChance,
        deathRoll: outcome.deathRoll,
        injuryChance: outcome.injuryChance,
        injuryRoll: outcome.injuryRoll,
        finalState: this.fighterNumbers(fighter),
        startingInjuries: clone(fighter.injuries),
        newTraumas: clone(fighter.traumas.filter((trauma) => trauma.source !== "starting-injury")),
        finalTraumas: clone(fighter.traumas),
      };
    });

    const spectacle = this.createSpectacleState();
    const reward = {
      formulaVersion: "spectacle-half-v1",
      amount: Math.floor(spectacle.score / COMBAT_RULES.spectacle.rewardDivisor),
    };
    const finishData = this.runPhase(
      "battle-finish",
      "beforeBattleFinish",
      "afterBattleFinish",
      {
        outcome: clone(this.state.outcome),
        fighterResults: clone(fighterResults),
        spectacle: clone(spectacle),
        reward: clone(reward),
      },
      (data) => data,
    );
    this.state.outcome = finishData.outcome;
    fighterResults = finishData.fighterResults;
    this.emit("battle.finished", "Расчёт боя завершён", finishData);
    this.captureSnapshot("Итог боя");

    return {
      schemaVersion: this.input.schemaVersion,
      rulesetVersion: this.input.rulesetVersion,
      seed: this.input.seed,
      input: clone(this.input),
      outcome: clone(this.state.outcome),
      steps: this.state.step,
      fighters: fighterResults,
      finalArenaState: clone(this.state.arena),
      statistics: Object.fromEntries(
        this.state.fighters.map((fighter) => [fighter.id, clone(fighter.stats)]),
      ),
      spectacle: clone(this.snapshots.at(-1).spectacle),
      reward: clone(finishData.reward),
      playerBuffs: clone(this.state.playerBuffs),
      events: clone(this.events),
      snapshots: clone(this.snapshots),
    };
  }

  createSpectacleState() {
    return calculateSpectacle(
      this.state.fighters,
      this.state.step,
      this.snapshots.at(-1)?.spectacle?.score || 0,
    );
  }

  captureSnapshot(label) {
    this.snapshots.push({
      index: this.snapshots.length,
      step: this.state.step,
      label,
      status: this.state.status,
      outcome: clone(this.state.outcome),
      lastAction: clone(this.lastAction),
      arena: clone(this.state.arena),
      spectacle: this.createSpectacleState(),
      fighters: this.state.fighters.map((fighter) => ({
        ...this.fighterNumbers(fighter),
        name: fighter.name,
        perks: [...fighter.perks],
        buffs: [...fighter.buffs],
        injuries: [...fighter.injuries],
        traumas: clone(fighter.traumas),
        activeEffects: this.activeEffectsForFighter(fighter.id),
      })),
      playerBuffs: clone(this.state.playerBuffs),
      eventSequence: this.sequence,
    });
  }

  captureSystemState() {
    if (!this.state) return null;
    return {
      schemaVersion: 1,
      eventSequence: this.sequence,
      step: this.state.step,
      phase: this.currentPhase,
      status: this.state.status,
      outcome: clone(this.state.outcome),
      arena: clone(this.state.arena),
      spectacle: this.createSpectacleState(),
      fighters: clone(this.state.fighters),
      pendingEffects: clone(this.state.pendingEffects),
      playerBuffs: clone(this.state.playerBuffs),
      lastAction: clone(this.lastAction),
      turn: {
        lastActorId: this.lastActorId,
        consecutiveActions: this.consecutiveActions,
      },
      modifiers: this.modifierManager.snapshot(),
    };
  }

  emit(type, message, data = {}) {
    this.sequence += 1;
    this.events.push({
      sequence: this.sequence,
      step: this.state?.step ?? 0,
      phase: this.currentPhase,
      type,
      message,
      ...(data.kind ? { kind: data.kind } : {}),
      ...(data.instanceId ? { instanceId: data.instanceId } : {}),
      data: clone(data),
      state: this.captureSystemState(),
    });
  }

  fighterNumbers(fighter) {
    return {
      id: fighter.id,
      health: round(fighter.health),
      maxHealth: round(fighter.maxHealth),
      temporaryHealth: round(fighter.temporaryHealth || 0),
      strength: round(fighter.strength),
      support: round(fighter.support),
      initiative: round(fighter.initiative),
      fatigue: round(fighter.fatigue),
      criticalChance: fighter.criticalChance,
      classTechniqueChance: fighter.classTechniqueChance,
      weaponPower: round(fighter.equipment.weaponPower),
      accuracy: round(fighter.equipment.accuracy),
      armor: round(fighter.equipment.armor),
      equipmentWeight: round(fighter.equipment.weight),
      mobility: round(fighter.equipment.mobility),
      fighterClass: fighter.fighterClass,
      weaponSet: clone(fighter.equipment.weaponSet),
      armorSet: clone(fighter.equipment.armorSet),
      equipmentPerks: clone(fighter.equipmentPerks || []),
      matchup: clone(fighter.matchup),
      activeEffects: this.activeEffectsForFighter(fighter.id),
    };
  }

  activeEffectsForFighter(fighterId) {
    return this.modifierManager.instances
      .filter((modifier) => modifier.ownerId === fighterId && modifier.id.startsWith("player-"))
      .map((modifier) => ({
        id: modifier.id,
        kind: modifier.kind,
        remainingIterations: modifier.runtime.remainingIterations ?? null,
        sourceId: modifier.sourceId || null,
        temporaryHealth: modifier.id === "player-hold-on"
          ? round(this.getFighter(fighterId).temporaryHealth || 0)
          : null,
      }));
  }

  describeAction(action) {
    const actor = this.getFighter(action.actorId).name;
    const target = this.getFighter(action.targetId).name;
    if (action.outcome === "hit" && action.critical) {
      return `${actor} наносит критический удар ${target}: ${action.damageBeforeCritical} × 2 = ${action.damage}`;
    }
    if (action.attackType === "achilles-leap") {
      return `${actor} выполняет Прыжок Ахилла и ранит ${target} на ${action.damage}`;
    }
    if (action.specialAttack === "player-buff-now") {
      return `${actor} выполняет усиленный классовый удар, наносит ${action.damage} урона и оглушает ${target}`;
    }
    const labels = {
      miss: `${actor} промахивается`,
      dodge: `${target} уклоняется от атаки ${actor}`,
      block: `${target} блокирует атаку ${actor}`,
      hit: `${actor} ранит ${target} на ${action.damage}`,
    };
    return labels[action.outcome] || `${actor} выполняет действие`;
  }

  supportMultiplier(fighterId) {
    const index = this.state.fighters.findIndex((fighter) => fighter.id === fighterId);
    return this.state.arena.supportMultipliers[index];
  }

  getFighter(fighterId) {
    const fighter = this.state.fighters.find((item) => item.id === fighterId);
    if (!fighter) throw new Error(`Боец ${fighterId} не найден`);
    return fighter;
  }

  getOpponent(fighterId) {
    return this.state.fighters.find((fighter) => fighter.id !== fighterId);
  }
}

const createBattleLogExport = (result, exportedAt = new Date().toISOString()) => ({
  format: "gladiator.battle-log",
  formatVersion: 1,
  exportedAt,
  prototype: "battle-arena-0.6",
  replay: {
    mode: "state-after-event",
    eventCount: result.events.length,
    firstSequence: result.events[0]?.sequence ?? null,
    lastSequence: result.events.at(-1)?.sequence ?? null,
    description: "Каждое событие содержит полное состояние системы после записи события.",
  },
  ...clone(result),
});

globalThis.GladiatorBattle = {
  ARENA_TYPES,
  BattleEngine,
  BattleModifierManager,
  COMBAT_RULES,
  FIGHTER_CLASS_DEFINITIONS,
  EQUIPMENT_QUALITIES,
  WEAPON_SET_DEFINITIONS,
  ARMOR_SET_DEFINITIONS,
  WEAPON_ITEMS,
  ARMOR_ITEMS,
  ALL_MODIFIER_DEFINITIONS,
  INJURY_DEFINITIONS,
  MAX_ARENA_MULTIPLIER,
  MAX_BASE_ATTRIBUTE,
  MAX_BASE_HEALTH,
  MAX_BATTLE_STEPS,
  PERK_DEFINITIONS,
  BUFF_DEFINITIONS,
  PLAYER_BUFF_DEFINITIONS,
  SPECTACLE_TIERS,
  calculateSpectacle,
  calculateTraumaChance,
  createBattleLogExport,
  createDefaultBattleInput,
};
})();
