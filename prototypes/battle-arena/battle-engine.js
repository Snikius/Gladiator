(function () {
"use strict";

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const round = (value, digits = 2) => Number(value.toFixed(digits));
const clone = (value) => JSON.parse(JSON.stringify(value));

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

const normalizeInput = (input) => ({
  schemaVersion: 1,
  rulesetVersion: "prototype-0.4",
  seed: String(input.seed || "gladiator-prototype"),
  maxSteps: clamp(Number(input.maxSteps) || 80, 1, 500),
  arena: {
    type: input.arena?.type || "normal",
    supportMultipliers: [
      clamp(Number(input.arena?.supportMultipliers?.[0]) || 1, 0.1, 3),
      clamp(Number(input.arena?.supportMultipliers?.[1]) || 1, 0.1, 3),
    ],
  },
  fighters: input.fighters.map((fighter, index) => ({
    id: fighter.id || `fighter-${index + 1}`,
    name: fighter.name || `Боец ${index + 1}`,
    base: {
      strength: clamp(Number(fighter.base?.strength) || 50, 1, 100),
      health: clamp(Number(fighter.base?.health) || 100, 1, 300),
      charisma: clamp(Number(fighter.base?.charisma) || 50, 1, 100),
    },
    equipment: {
      weaponPower: clamp(Number(fighter.equipment?.weaponPower) || 0, 0, 50),
      armor: clamp(Number(fighter.equipment?.armor) || 0, 0, 50),
      weight: clamp(Number(fighter.equipment?.weight) || 0, 0, 50),
    },
    perks: [...new Set((fighter.perks || []).filter(Boolean))].slice(0, 3),
    temporaryPerks: (fighter.temporaryPerks || []).filter(Boolean),
    injuries: (fighter.injuries || []).filter(Boolean),
  })),
});

const ARENA_TYPES = [
  { id: "normal", name: "Обычная арена" },
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
];

const TEMPORARY_PERK_DEFINITIONS = [
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
    fighter.base.strength = clamp(round(fighter.base.strength + modifiers.strength), 1, 200);
    fighter.strength = fighter.base.strength;
  }
  if (modifiers.health) {
    fighter.base.health = clamp(round(fighter.base.health + modifiers.health), 1, 500);
    fighter.maxHealth = fighter.base.health;
    fighter.health = fighter.maxHealth;
  }
  if (modifiers.charisma) {
    fighter.base.charisma = clamp(round(fighter.base.charisma + modifiers.charisma), 1, 200);
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
        reason: "perk:turn-interceptor",
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
      api.emit("perk.state.changed", "Умелый воин подготовил гарантированный ход", {
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
        reason: "perk:skilled-warrior",
      };
    },
  },
  "show-off": {
    afterAction(data, api) {
      const successfulDefense = data.targetId === api.ownerId
        && ["dodge", "block"].includes(data.outcome);
      if (!successfulDefense) return data;
      api.activate("Эффектная защита впечатлила публику");
      api.enqueue({ type: "support", fighterId: api.ownerId, value: 5, reason: "perk:show-off" });
      api.enqueue({ type: "fatigue", fighterId: api.ownerId, value: 2, reason: "perk:show-off" });
      return data;
    },
  },
  "lovable-loser": {
    afterAction(data, api) {
      if (data.actorId !== api.ownerId || data.outcome !== "miss") return data;
      api.activate("Публика поддержала красивый, но неудачный замах");
      api.enqueue({ type: "support", fighterId: api.ownerId, value: 4, reason: "perk:lovable-loser" });
      return data;
    },
  },
};

const TEMPORARY_PERK_IMPLEMENTATIONS = {
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
  perkActivations: 0,
  maxConsecutiveActions: 0,
});

const createDefaultBattleInput = () => ({
  seed: "arena-001",
  maxSteps: 80,
  arena: {
    type: "normal",
    supportMultipliers: [1, 1],
  },
  fighters: [
    {
      id: "fighter-1",
      name: "Маркус",
      base: { strength: 62, health: 125, charisma: 48 },
      equipment: { weaponPower: 14, armor: 12, weight: 11 },
      perks: ["cornered-beast"],
      temporaryPerks: [],
      injuries: [],
    },
    {
      id: "fighter-2",
      name: "Тит",
      base: { strength: 54, health: 112, charisma: 68 },
      equipment: { weaponPower: 11, armor: 8, weight: 7 },
      perks: ["strong-bones"],
      temporaryPerks: [],
      injuries: [],
    },
  ],
});

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
    this.extensions = this.createExtensions();
    this.state = null;
  }

  createExtensions() {
    const extensions = [];
    this.input.fighters.forEach((fighter) => {
      const addExtensions = (ids, implementations, extensionType, priority) => {
        ids.forEach((extensionId, index) => {
          const implementation = implementations[extensionId];
          if (!implementation) return;
          extensions.push({
            id: extensionId,
            instanceId: `${extensionType}:${fighter.id}:${index}:${extensionId}`,
            extensionType,
            ownerId: fighter.id,
            priority,
            implementation,
            runtime: { activations: 0, used: false },
          });
        });
      };
      addExtensions(fighter.temporaryPerks, TEMPORARY_PERK_IMPLEMENTATIONS, "temporary-perk", 50);
      addExtensions(fighter.injuries, INJURY_IMPLEMENTATIONS, "injury", 60);
      addExtensions(fighter.perks, PERK_IMPLEMENTATIONS, "perk", 100);
    });
    return extensions.sort((left, right) =>
      left.priority - right.priority
        || left.id.localeCompare(right.id)
        || left.instanceId.localeCompare(right.instanceId),
    );
  }

  simulate() {
    this.initialize();

    while (this.state.status === "running") {
      this.runStep();
    }

    return this.finishBattle();
  }

  initialize() {
    const fighters = this.input.fighters.map((fighter, index) => {
      const support = clamp(
        fighter.base.charisma * this.input.arena.supportMultipliers[index],
        0,
        150,
      );
      return {
        id: fighter.id,
        name: fighter.name,
        base: clone(fighter.base),
        equipment: clone(fighter.equipment),
        maxHealth: fighter.base.health,
        health: fighter.base.health,
        strength: fighter.base.strength,
        support: round(support),
        initiative: 1,
        fatigue: 0,
        traumas: [],
        perks: [...fighter.perks],
        temporaryPerks: [...fighter.temporaryPerks],
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
    this.extensions.forEach((extension) => {
      if (extension.runtime.activations > 0) {
        this.getFighter(extension.ownerId).stats.perkActivations += extension.runtime.activations;
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
          reason: "initiative-weighted-random",
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
      { actorId: actor.id, targetId: target.id, availableActions: ["attack"] },
      (data) => ({ ...data, action: "attack" }),
    );

    const action = this.runPhase(
      "action",
      "beforeAction",
      "afterAction",
      actionSelection,
      (data) => this.resolveAction(data),
    );

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

    this.captureSnapshot(this.describeAction(action));
  }

  resolveAction(data) {
    const actor = this.getFighter(data.actorId);
    const target = this.getFighter(data.targetId);
    const missWeight = 9 + actor.fatigue * 0.32;
    const dodgeWeight = clamp(9 + target.initiative * 0.1 - target.fatigue * 0.08, 4, 32);
    const blockWeight = clamp(10 + target.equipment.armor * 0.85 - target.fatigue * 0.09, 4, 34);
    const hitWeight = 52 + actor.strength * 0.18;
    const weights = [
      { outcome: "miss", weight: missWeight },
      { outcome: "dodge", weight: dodgeWeight },
      { outcome: "block", weight: blockWeight },
      { outcome: "hit", weight: hitWeight },
    ];
    const selectedOutcome = weightedPick(weights, this.random);
    const outcome = selectedOutcome.outcome;
    const fatigueEfficiency = clamp(1 - actor.fatigue / 160, 0.35, 1);
    const effectiveStrength = actor.strength * fatigueEfficiency;
    const damage = outcome === "hit"
      ? Math.max(
          1,
          Math.round(
            (effectiveStrength + actor.equipment.weaponPower) * (0.45 + this.random() * 0.35)
              - target.equipment.armor * 0.6,
          ),
        )
      : 0;
    const traumaChance = outcome === "hit"
      ? clamp(0.03 + (damage / target.maxHealth) * 0.42, 0.03, 0.45)
      : 0;

    return {
      ...data,
      outcome,
      weights: Object.fromEntries(weights.map((item) => [item.outcome, round(item.weight)])),
      actorFatigueBefore: actor.fatigue,
      targetFatigueBefore: target.fatigue,
      effectiveStrength: round(effectiveStrength),
      damage,
      traumaChance: round(traumaChance, 4),
      traumaRoll: round(this.random(), 6),
      outcomeRoll: selectedOutcome.roll,
      totalOutcomeWeight: selectedOutcome.totalWeight,
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
          value: this.random() < 0.5 ? "arm" : "leg",
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
        fighter.health = round(fighter.health + effect.value);
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
            initiative: round(Math.max(1, 15 + data.support * 0.55 + data.strength * 0.25 - data.fatigue * 0.45 - legPenalty)),
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
    let data = clone(initialData);
    for (const extension of this.extensions) {
      const hook = extension.implementation[method];
      if (typeof hook !== "function") continue;
      const before = clone(data);
      const runtimeBefore = clone(extension.runtime);
      const api = this.createPerkApi(extension);
      const returned = hook(clone(data), api, extension.runtime);
      data = returned === undefined ? data : clone(returned);
      this.emit("perk.hook", `${extension.id}.${method}`, {
        perkId: extension.id,
        extensionType: extension.extensionType,
        instanceId: extension.instanceId,
        ownerId: extension.ownerId,
        before,
        after: data,
        runtimeBefore,
        runtimeAfter: clone(extension.runtime),
      });
    }
    return data;
  }

  createPerkApi(extension) {
    return {
      ownerId: extension.ownerId,
      extensionType: extension.extensionType,
      instanceId: extension.instanceId,
      state: clone(this.state),
      random: () => this.random(),
      canActivate: () => true,
      enqueue: (effect) => this.state.pendingEffects.push(clone(effect)),
      emit: (type, message, data = {}) => this.emit(type, message, {
        perkId: extension.id,
        extensionType: extension.extensionType,
        instanceId: extension.instanceId,
        ownerId: extension.ownerId,
        ...data,
      }),
      activate: (message) => {
        extension.runtime.activations += 1;
        if (this.currentPhase !== "initialize") {
          this.getFighter(extension.ownerId).stats.perkActivations += 1;
        }
        this.emit("perk.activated", message, {
          perkId: extension.id,
          extensionType: extension.extensionType,
          instanceId: extension.instanceId,
          ownerId: extension.ownerId,
          activation: extension.runtime.activations,
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

    const finishData = this.runPhase(
      "battle-finish",
      "beforeBattleFinish",
      "afterBattleFinish",
      { outcome: clone(this.state.outcome), fighterResults: clone(fighterResults) },
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
      events: clone(this.events),
      snapshots: clone(this.snapshots),
    };
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
      fighters: this.state.fighters.map((fighter) => ({
        ...this.fighterNumbers(fighter),
        name: fighter.name,
        perks: [...fighter.perks],
        temporaryPerks: [...fighter.temporaryPerks],
        injuries: [...fighter.injuries],
        traumas: clone(fighter.traumas),
      })),
      eventSequence: this.sequence,
    });
  }

  emit(type, message, data = {}) {
    this.sequence += 1;
    this.events.push({
      sequence: this.sequence,
      step: this.state?.step ?? 0,
      phase: this.currentPhase,
      type,
      message,
      ...(data.extensionType ? { extensionType: data.extensionType } : {}),
      ...(data.instanceId ? { instanceId: data.instanceId } : {}),
      data: clone(data),
    });
  }

  fighterNumbers(fighter) {
    return {
      id: fighter.id,
      health: round(fighter.health),
      maxHealth: round(fighter.maxHealth),
      strength: round(fighter.strength),
      support: round(fighter.support),
      initiative: round(fighter.initiative),
      fatigue: round(fighter.fatigue),
      weaponPower: round(fighter.equipment.weaponPower),
      armor: round(fighter.equipment.armor),
      equipmentWeight: round(fighter.equipment.weight),
    };
  }

  describeAction(action) {
    const actor = this.getFighter(action.actorId).name;
    const target = this.getFighter(action.targetId).name;
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

globalThis.GladiatorBattle = {
  ARENA_TYPES,
  BattleEngine,
  INJURY_DEFINITIONS,
  PERK_DEFINITIONS,
  TEMPORARY_PERK_DEFINITIONS,
  createDefaultBattleInput,
};
})();
