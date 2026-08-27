(function initializeManagementEngine(globalScope) {
"use strict";

const DEFAULT_INPUT = Object.freeze({
  schemaVersion: 1,
  rulesetVersion: "school-economy-v1.0",
  initialTreasury: 180,
  tier: 1,
  tierProgress: 0,
  tierProgressMax: 100,
  fighterCapacity: 4,
  incomePerTurn: 38,
  battleOffersEnabled: true,
  battleRules: {
    offersPerTurn: 3,
    lossRewardRate: 0.45,
    defeatDeathChance: 0.3,
  },
  tierRules: {
    maxTier: 3,
    baseProgressPerBattle: 20,
    defeatProgressRate: 0.5,
    drawProgressRate: 0.75,
    upgradeBaseCost: 100,
    upgradeCostGrowth: 0.5,
    fighterCapacityPerTier: 1,
  },
  marketEnabled: true,
  marketRules: {
    offersPerTurn: 3,
    perkChance: 0.5,
  },
  armoryEnabled: true,
  schoolUpgradesEnabled: true,
  medicineEnabled: true,
  treatmentTurns: 2,
  restEnabled: true,
  expenses: [
    { id: "food", label: "Еда", amount: 18 },
    { id: "medicine", label: "Лечение", amount: 9 },
  ],
  saleRules: {
    baseShare: 0.5,
    winGrowth: 0.08,
  },
  fighters: [
    {
      id: "marcus-murmillo",
      name: "Марк Мурмиллон",
      fighterClass: "murmillo",
      classLabel: "Мурмиллон",
      portrait: "./assets/fighters/mark-murmillo-v1.png",
      rosterPortrait: "./assets/fighters/mark-murmillo-face-v1.png",
      idleSprite: "./assets/fighters/mark-murmillo-idle-v4.png",
      condition: "Свеж и собран",
      wins: 3,
      experience: 46,
      upkeep: 9,
      purchasePrice: 120,
      injuryValueMultiplier: 1,
      equipment: {
        weapon: { name: "Гладиус и скутум", quality: "Хорошее" },
        armor: { name: "Шлем, маника и поножа", quality: "Обычное" },
      },
      perks: ["Крепкие кости", "Любимец толпы"],
      injuries: [],
    },
    {
      id: "lucius-retiarius",
      name: "Луций Ретиарий",
      fighterClass: "retiarius",
      classLabel: "Ретиарий",
      portrait: "./assets/fighters/lucius-retiarius-v1.png",
      rosterPortrait: "./assets/fighters/lucius-retiarius-face-v1.png",
      idleSprite: "./assets/fighters/lucius-retiarius-idle-v4.png",
      condition: "Держится",
      wins: 1,
      experience: 22,
      upkeep: 7,
      purchasePrice: 100,
      injuryValueMultiplier: 0.82,
      equipment: {
        weapon: { name: "Сеть, трезубец и кинжал", quality: "Обычное" },
        armor: { name: "Галерус и маника", quality: "Хорошее" },
      },
      perks: ["Лёгкая поступь"],
      injuries: ["Повреждение ноги"],
    },
  ],
});

const clone = (value) => JSON.parse(JSON.stringify(value));

const BATTLE_OPPONENT_CATALOG = Object.freeze([
  { id: "aulus-retiarius", opponentName: "Авл Ретиарий", opponentClass: "Ретиарий", combatArchetype: "retiarius", opponentPortrait: "./assets/opponents/aulus-retiarius-v1.png" },
  { id: "quintus-retiarius", opponentName: "Квинт Ретиарий", opponentClass: "Ретиарий", combatArchetype: "retiarius", opponentPortrait: "./assets/opponents/quintus-retiarius-v1.png" },
  { id: "gaius-swordsman", opponentName: "Гай Мечник", opponentClass: "Мечник", combatArchetype: "swordsman", opponentPortrait: "./assets/opponents/gaius-murmillo-v1.png" },
  { id: "publius-swordsman", opponentName: "Публий Мечник", opponentClass: "Мечник", combatArchetype: "swordsman", opponentPortrait: "./assets/opponents/publius-swordsman-v1.png" },
  { id: "sextus-swordsman", opponentName: "Секст Мечник", opponentClass: "Мечник", combatArchetype: "swordsman", opponentPortrait: "./assets/opponents/sextus-swordsman-v1.png" },
]);

const BATTLE_DIFFICULTY_CATALOG = Object.freeze([
  { id: "low", level: 1, label: "Лёгкий бой", rewardBonus: 0, experienceReward: 18, winChance: 0.66 },
  { id: "medium", level: 2, label: "Равный бой", rewardBonus: 10, experienceReward: 23, winChance: 0.56 },
  { id: "high", level: 3, label: "Тяжёлый бой", rewardBonus: 20, experienceReward: 28, winChance: 0.44 },
]);

const BATTLE_INJURY_POOL = Object.freeze([
  "Рассечение",
  "Ушиб рёбер",
  "Повреждение руки",
  "Повреждение ноги",
]);

const BATTLE_ARENA_CATALOG = Object.freeze([
  "Малая арена",
  "Городские игры",
  "Вечерние игры",
  "Военный праздник",
]);

const MARKET_CANDIDATE_CATALOG = Object.freeze([
  { name: "Авл", portrait: "./assets/market/slave-portrait-a-v1.png", basePrice: 62, upkeep: 6 },
  { name: "Басс", portrait: "./assets/market/slave-portrait-b-v1.png", basePrice: 70, upkeep: 7 },
  { name: "Сервий", portrait: "./assets/market/slave-portrait-c-v1.png", basePrice: 54, upkeep: 5 },
  { name: "Нумерий", portrait: "./assets/market/slave-portrait-b-v1.png", basePrice: 66, upkeep: 6 },
  { name: "Теренций", portrait: "./assets/market/slave-portrait-a-v1.png", basePrice: 76, upkeep: 7 },
  { name: "Вибий", portrait: "./assets/market/slave-portrait-c-v1.png", basePrice: 58, upkeep: 5 },
]);

const MARKET_PERK_POOL = Object.freeze([
  "Крепкие кости",
  "Лёгкая поступь",
  "Выносливый",
  "Быстрая реакция",
]);

const FIGHTER_CLASS_CATALOG = Object.freeze([
  { id: "murmillo", label: "Мурмиллон", icon: "▣", color: "#b96f45", specializationPrice: 24 },
  { id: "thraex", label: "Фракиец", icon: "◒", color: "#bca447", specializationPrice: 22 },
  { id: "retiarius", label: "Ретиарий", icon: "♆", color: "#4b9b91", specializationPrice: 20 },
  { id: "secutor", label: "Секутор", icon: "⬟", color: "#a8515e", specializationPrice: 26 },
  { id: "hoplomachus", label: "Гопломах", icon: "†", color: "#6889b0", specializationPrice: 23 },
]);

const ARMORY_CLASS_SETS = Object.freeze([
  { id: "murmillo", label: "Мурмиллон", iconPrefix: "murmillo", commonWeapon: "Учебный гладиус и простой скутум", goodWeapon: "Кованый гладиус и укреплённый скутум", commonArmor: "Стёганка, маника и простая поножа", goodArmor: "Подогнанный комплект Мурмиллона", priceOffset: 4 },
  { id: "thraex", label: "Фракиец", commonWeapon: "Простая сика и плетёная пармула", goodWeapon: "Кованая сика и обитая пармула", commonArmor: "Маника и простые высокие поножи", goodArmor: "Подвижный комплект Фракийца", priceOffset: 2 },
  { id: "retiarius", label: "Ретиарий", iconPrefix: "retiarius", commonWeapon: "Простой трезубец, сеть и кинжал", goodWeapon: "Сбалансированный трезубец и крепкая сеть", commonArmor: "Кожаная маника и простой галерус", goodArmor: "Усиленный галерус и подогнанная маника", priceOffset: 0 },
  { id: "secutor", label: "Секутор", commonWeapon: "Учебный гладиус и простой скутум", goodWeapon: "Закалённый гладиус и тяжёлый скутум", commonArmor: "Гладкий шлем, маника и поножа", goodArmor: "Закрытый комплект Секутора", priceOffset: 6 },
  { id: "hoplomachus", label: "Гопломах", commonWeapon: "Простое копьё, щит и кинжал", goodWeapon: "Кованое копьё и укреплённый щит", commonArmor: "Стёганка и простые высокие поножи", goodArmor: "Подогнанный комплект Гопломаха", priceOffset: 3 },
]);

const ARMORY_CATALOG = Object.freeze(ARMORY_CLASS_SETS.flatMap((set) => [
  { id: `${set.id}-weapon-common`, name: set.commonWeapon, icon: set.iconPrefix ? `./assets/equipment/${set.iconPrefix}-weapon-v1.png` : null, slot: "weapon", slotLabel: "Оружие", classId: set.id, classLabel: set.label, quality: "common", qualityLabel: "Обычное", price: 18 + set.priceOffset, craftTurns: 0 },
  { id: `${set.id}-armor-common`, name: set.commonArmor, icon: set.iconPrefix ? `./assets/equipment/${set.iconPrefix}-armor-v1.png` : null, slot: "armor", slotLabel: "Обмундирование", classId: set.id, classLabel: set.label, quality: "common", qualityLabel: "Обычное", price: 22 + set.priceOffset, craftTurns: 0 },
  { id: `${set.id}-weapon-good`, name: set.goodWeapon, icon: set.iconPrefix ? `./assets/equipment/${set.iconPrefix}-weapon-v1.png` : null, slot: "weapon", slotLabel: "Оружие", classId: set.id, classLabel: set.label, quality: "good", qualityLabel: "Хорошее", price: 50 + set.priceOffset, craftTurns: 1 },
  { id: `${set.id}-armor-good`, name: set.goodArmor, icon: set.iconPrefix ? `./assets/equipment/${set.iconPrefix}-armor-v1.png` : null, slot: "armor", slotLabel: "Обмундирование", classId: set.id, classLabel: set.label, quality: "good", qualityLabel: "Хорошее", price: 58 + set.priceOffset, craftTurns: 2 },
]));

const SCHOOL_UPGRADE_CATALOG = Object.freeze([
  {
    id: "saniarium",
    name: "Саниарий",
    latinName: "SANIARIUM",
    description: "Лечебница гладиаторов. Развитие ускорит восстановление и откроет более сложное лечение.",
    icon: "./assets/upgrades/saniarium-upgrade-v1.png",
    basePrice: 75,
    baseTurns: 1,
  },
  {
    id: "armamentarium",
    name: "Оружейня",
    latinName: "ARMAMENTARIUM",
    description: "Кузница и оружейный склад. Развитие откроет снаряжение более высокого качества.",
    icon: "./assets/upgrades/armamentarium-upgrade-v1.png",
    basePrice: 110,
    baseTurns: 2,
  },
]);

const REST_ACTIVITY_CATALOG = Object.freeze([
  {
    id: "balneum",
    name: "Баня",
    latinName: "BALNEUM",
    description: "Тёплая вода и пар снимают напряжение после тренировок.",
    effect: "Тело отдохнуло",
    price: 8,
    turns: 1,
    capacity: 2,
    requiredTier: 1,
  },
  {
    id: "popina",
    name: "Трактир",
    latinName: "POPINA",
    description: "Вино, еда и разговоры возвращают бойцу расположение духа.",
    effect: "Дух восстановлен",
    price: 12,
    turns: 1,
    capacity: 1,
    requiredTier: 1,
  },
]);

const stableHash = (value) => {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const asInteger = (value, fallback, minimum = 0) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(minimum, Math.round(parsed));
};

const asNumber = (value, fallback, minimum = 0, maximum = Infinity) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
};

const normalizeFighter = (fighter, index) => ({
  id: String(fighter.id || `fighter-${index + 1}`),
  name: String(fighter.name || `Боец ${index + 1}`),
  fighterClass: fighter.fighterClass ? String(fighter.fighterClass) : null,
  classLabel: String(
    fighter.classLabel
    || FIGHTER_CLASS_CATALOG.find(({ id }) => id === fighter.fighterClass)?.label
    || "Без специализации"
  ),
  portrait: String(fighter.portrait || ""),
  rosterPortrait: String(fighter.rosterPortrait || fighter.portrait || ""),
  idleSprite: String(fighter.idleSprite || ""),
  condition: String(fighter.condition || "Держится"),
  trainingTurnsRemaining: asInteger(fighter.trainingTurnsRemaining, 0),
  wins: asInteger(fighter.wins, 0),
  experience: asInteger(fighter.experience, 0),
  upkeep: asInteger(fighter.upkeep, 0),
  purchasePrice: asInteger(fighter.purchasePrice, 0),
  injuryValueMultiplier: asNumber(fighter.injuryValueMultiplier, 1, 0, 1),
  equipment: {
    weapon: {
      name: String(fighter.equipment?.weapon?.name || "Нет оружейного комплекта"),
      quality: String(fighter.equipment?.weapon?.quality || "Обычное"),
    },
    armor: {
      name: String(fighter.equipment?.armor?.name || "Нет комплекта доспехов"),
      quality: String(fighter.equipment?.armor?.quality || "Обычное"),
    },
  },
  perks: Array.isArray(fighter.perks) ? fighter.perks.slice(0, 3).map(String) : [],
  injuries: Array.isArray(fighter.injuries) ? fighter.injuries.map(String) : [],
  lastRest: fighter.lastRest ? String(fighter.lastRest) : null,
});

const normalizeManagementInput = (rawInput = {}) => {
  const input = { ...DEFAULT_INPUT, ...rawInput };
  const expenses = Array.isArray(rawInput.expenses)
    ? rawInput.expenses
    : DEFAULT_INPUT.expenses;
  const useDefaults = Object.keys(rawInput).length === 0;
  const fighterSource = Array.isArray(rawInput.fighters)
    ? rawInput.fighters
    : (useDefaults ? DEFAULT_INPUT.fighters : []);
  const fighters = fighterSource.map(normalizeFighter);
  const saleRules = { ...DEFAULT_INPUT.saleRules, ...(rawInput.saleRules || {}) };
  const battleRules = { ...DEFAULT_INPUT.battleRules, ...(rawInput.battleRules || {}) };
  const tierRules = { ...DEFAULT_INPUT.tierRules, ...(rawInput.tierRules || {}) };
  const marketRules = { ...DEFAULT_INPUT.marketRules, ...(rawInput.marketRules || {}) };

  return {
    schemaVersion: 1,
    rulesetVersion: String(input.rulesetVersion || DEFAULT_INPUT.rulesetVersion),
    initialTreasury: asInteger(input.initialTreasury, DEFAULT_INPUT.initialTreasury),
    tier: Math.min(
      asInteger(input.tier, DEFAULT_INPUT.tier, 1),
      asInteger(tierRules.maxTier, DEFAULT_INPUT.tierRules.maxTier, 1),
    ),
    tierProgress: asInteger(input.tierProgress, DEFAULT_INPUT.tierProgress),
    tierProgressMax: asInteger(input.tierProgressMax, DEFAULT_INPUT.tierProgressMax, 1),
    fighterCapacity: Math.max(
      fighters.length,
      asInteger(input.fighterCapacity, DEFAULT_INPUT.fighterCapacity, 1),
    ),
    incomePerTurn: asInteger(input.incomePerTurn, DEFAULT_INPUT.incomePerTurn),
    battleOffersEnabled: Boolean(
      rawInput.battleOffersEnabled ?? (useDefaults ? DEFAULT_INPUT.battleOffersEnabled : false)
    ),
    battleRules: {
      offersPerTurn: asInteger(battleRules.offersPerTurn, DEFAULT_INPUT.battleRules.offersPerTurn, 1),
      lossRewardRate: asNumber(battleRules.lossRewardRate, DEFAULT_INPUT.battleRules.lossRewardRate, 0, 1),
      defeatDeathChance: asNumber(
        battleRules.defeatDeathChance,
        DEFAULT_INPUT.battleRules.defeatDeathChance,
        0,
        1,
      ),
    },
    tierRules: {
      maxTier: asInteger(
        tierRules.maxTier,
        DEFAULT_INPUT.tierRules.maxTier,
        1,
      ),
      baseProgressPerBattle: asInteger(
        tierRules.baseProgressPerBattle,
        DEFAULT_INPUT.tierRules.baseProgressPerBattle,
      ),
      defeatProgressRate: asNumber(
        tierRules.defeatProgressRate,
        DEFAULT_INPUT.tierRules.defeatProgressRate,
        0,
        1,
      ),
      drawProgressRate: asNumber(
        tierRules.drawProgressRate,
        DEFAULT_INPUT.tierRules.drawProgressRate,
        0,
        1,
      ),
      upgradeBaseCost: asInteger(
        tierRules.upgradeBaseCost,
        DEFAULT_INPUT.tierRules.upgradeBaseCost,
      ),
      upgradeCostGrowth: asNumber(
        tierRules.upgradeCostGrowth,
        DEFAULT_INPUT.tierRules.upgradeCostGrowth,
      ),
      fighterCapacityPerTier: asInteger(
        tierRules.fighterCapacityPerTier,
        DEFAULT_INPUT.tierRules.fighterCapacityPerTier,
      ),
    },
    marketEnabled: Boolean(
      rawInput.marketEnabled ?? (useDefaults ? DEFAULT_INPUT.marketEnabled : false)
    ),
    marketRules: {
      offersPerTurn: asInteger(marketRules.offersPerTurn, DEFAULT_INPUT.marketRules.offersPerTurn, 1),
      perkChance: asNumber(marketRules.perkChance, DEFAULT_INPUT.marketRules.perkChance, 0, 1),
    },
    armoryEnabled: Boolean(
      rawInput.armoryEnabled ?? (useDefaults ? DEFAULT_INPUT.armoryEnabled : false)
    ),
    armoryCatalog: clone(ARMORY_CATALOG),
    schoolUpgradesEnabled: Boolean(
      rawInput.schoolUpgradesEnabled ?? (useDefaults ? DEFAULT_INPUT.schoolUpgradesEnabled : false)
    ),
    schoolUpgradeCatalog: clone(SCHOOL_UPGRADE_CATALOG),
    medicineEnabled: Boolean(
      rawInput.medicineEnabled ?? (useDefaults ? DEFAULT_INPUT.medicineEnabled : false)
    ),
    treatmentTurns: asInteger(input.treatmentTurns, DEFAULT_INPUT.treatmentTurns, 1),
    restEnabled: Boolean(
      rawInput.restEnabled ?? (useDefaults ? DEFAULT_INPUT.restEnabled : false)
    ),
    restActivityCatalog: clone(REST_ACTIVITY_CATALOG),
    fighterClassCatalog: clone(FIGHTER_CLASS_CATALOG),
    expenses: expenses.map((expense, index) => ({
      id: String(expense.id || `expense-${index + 1}`),
      label: String(expense.label || `Расход ${index + 1}`),
      amount: asInteger(expense.amount, 0),
    })),
    saleRules: {
      baseShare: asNumber(saleRules.baseShare, DEFAULT_INPUT.saleRules.baseShare, 0, 1),
      winGrowth: asNumber(saleRules.winGrowth, DEFAULT_INPUT.saleRules.winGrowth),
    },
    fighters,
  };
};

class SchoolManagementEngine {
  static fromResult(serializedResult) {
    if (!serializedResult?.input || !serializedResult?.state) {
      throw new Error("MANAGEMENT_SESSION_INVALID");
    }
    const engine = Object.create(SchoolManagementEngine.prototype);
    engine.input = normalizeManagementInput(serializedResult.input);
    engine.events = clone(serializedResult.events || []);
    engine.snapshots = clone(serializedResult.snapshots || []);
    engine.state = clone(serializedResult.state);
    engine.sequence = engine.events.reduce(
      (maximum, event) => Math.max(maximum, asInteger(event.sequence, 0)),
      0,
    );
    return engine;
  }

  constructor(rawInput = {}) {
    this.input = normalizeManagementInput(rawInput);
    this.sequence = 0;
    this.events = [];
    this.snapshots = [];
    this.state = {
      turn: 1,
      treasury: this.input.initialTreasury,
      tier: this.input.tier,
      tierProgress: this.input.tierProgress,
      tierProgressMax: this.input.tierProgressMax,
      fighterCapacity: this.input.fighterCapacity,
      fighters: clone(this.input.fighters),
      battleOffers: [],
      lastBattleResults: [],
      battleHistory: [],
      marketOffers: [],
      inventory: [],
      craftOrders: [],
      schoolUpgrades: Object.fromEntries(
        this.input.schoolUpgradeCatalog.map(({ id }) => [id, { id, level: 1 }]),
      ),
      schoolUpgradeOrders: [],
      treatmentOrders: [],
      restOrders: [],
      status: "normal",
      lastTurn: null,
    };
    this.state.battleOffers = this.input.battleOffersEnabled
      ? this.createBattleOffers(this.state.turn)
      : [];
    this.state.marketOffers = this.input.marketEnabled
      ? this.createMarketOffers(this.state.turn)
      : [];
    this.captureSnapshot("Начало управления");
  }

  createBattleOffers(turn) {
    const difficultyOrder = BATTLE_DIFFICULTY_CATALOG
      .map((difficulty) => ({
        difficulty,
        order: stableHash(`battle:difficulty:${turn}:${difficulty.id}`),
      }))
      .sort((left, right) => left.order - right.order)
      .map(({ difficulty }) => difficulty);
    const firstArchetype = stableHash(`battle:archetype:${turn}`) % 2 === 0
      ? "retiarius"
      : "swordsman";

    return Array.from({ length: this.input.battleRules.offersPerTurn }, (_, index) => {
      const combatArchetype = index % 2 === 0
        ? firstArchetype
        : (firstArchetype === "retiarius" ? "swordsman" : "retiarius");
      const opponents = BATTLE_OPPONENT_CATALOG
        .filter((opponent) => opponent.combatArchetype === combatArchetype);
      const opponentIndex = (
        stableHash(`battle:opponent:${turn}:${combatArchetype}`) + Math.floor(index / 2)
      ) % opponents.length;
      const opponent = opponents[opponentIndex];
      const difficulty = difficultyOrder[index % difficultyOrder.length];
      const arena = BATTLE_ARENA_CATALOG[
        stableHash(`battle:arena:${turn}:${index}`) % BATTLE_ARENA_CATALOG.length
      ];
      return {
        id: `turn-${turn}-offer-${index + 1}`,
        turn,
        ...clone(opponent),
        arena,
        difficultyId: difficulty.id,
        difficultyLevel: difficulty.level,
        difficulty: difficulty.label,
        victoryReward: this.input.incomePerTurn + difficulty.rewardBonus,
        victoryExperience: difficulty.experienceReward,
        defeatExperience: Math.max(1, Math.round(difficulty.experienceReward * 0.5)),
        winChance: difficulty.winChance,
        assignedFighterId: null,
        manualResult: null,
      };
    });
  }

  createMarketOffers(turn) {
    return Array.from({ length: this.input.marketRules.offersPerTurn }, (_, index) => {
      const candidateIndex = (turn * 3 + index - 3) % MARKET_CANDIDATE_CATALOG.length;
      const candidate = MARKET_CANDIDATE_CATALOG[candidateIndex];
      const seed = stableHash(`market:${turn}:${index}:${candidate.name}`);
      const hasPerk = (seed % 1000) / 1000 < this.input.marketRules.perkChance;
      const perk = hasPerk ? MARKET_PERK_POOL[(seed >>> 8) % MARKET_PERK_POOL.length] : null;
      return {
        id: `turn-${turn}-slave-${index + 1}`,
        turn,
        name: candidate.name,
        portrait: candidate.portrait,
        price: candidate.basePrice + (seed % 13),
        upkeep: candidate.upkeep,
        perk,
        condition: "Не обучен",
      };
    });
  }

  purchaseMarketOffer(offerId) {
    const offerIndex = this.state.marketOffers.findIndex(({ id }) => id === offerId);
    if (offerIndex === -1) throw new Error("MARKET_OFFER_NOT_FOUND");
    if (this.state.fighters.length >= this.state.fighterCapacity) throw new Error("FIGHTER_CAPACITY_REACHED");
    const offer = this.state.marketOffers[offerIndex];
    if (this.state.treasury < offer.price) throw new Error("INSUFFICIENT_FUNDS");
    this.applyTransaction("fighter.purchased", `Покупка раба: ${offer.name}`, -offer.price, { offerId });
    const fighter = normalizeFighter({
      id: `slave-${this.state.turn}-${this.sequence}-${offer.name.toLowerCase()}`,
      name: offer.name,
      fighterClass: null,
      classLabel: "Без специализации",
      portrait: offer.portrait,
      condition: "Нуждается в обучении",
      wins: 0,
      experience: 0,
      upkeep: offer.upkeep,
      purchasePrice: offer.price,
      injuryValueMultiplier: 1,
      equipment: {},
      perks: offer.perk ? [offer.perk] : [],
      injuries: [],
    }, this.state.fighters.length);
    this.state.fighters.push(fighter);
    this.state.marketOffers.splice(offerIndex, 1);
    this.state.status = this.state.treasury < 0 ? "debt" : "normal";
    const snapshot = this.captureSnapshot(`${offer.name} куплен на рынке`);
    return { fighter: clone(fighter), snapshot };
  }

  assignFighterSpecialization(fighterId, classId) {
    const fighter = this.state.fighters.find(({ id }) => id === fighterId);
    if (!fighter) throw new Error("FIGHTER_NOT_FOUND");
    if (this.state.treatmentOrders.some(({ fighterId: id }) => id === fighterId)) {
      throw new Error("FIGHTER_IN_TREATMENT");
    }
    if (this.state.restOrders.some(({ fighterId: id }) => id === fighterId)) {
      throw new Error("FIGHTER_RESTING");
    }
    if (fighter.fighterClass) throw new Error("FIGHTER_SPECIALIZATION_ALREADY_ASSIGNED");
    const specialization = FIGHTER_CLASS_CATALOG.find(({ id }) => id === classId);
    if (!specialization) throw new Error("FIGHTER_SPECIALIZATION_INVALID");
    if (this.state.treasury < specialization.specializationPrice) throw new Error("INSUFFICIENT_FUNDS");
    this.applyTransaction(
      "fighter.specialized",
      `Обучение: ${fighter.name} — ${specialization.label}`,
      -specialization.specializationPrice,
      { fighterId: fighter.id, classId: specialization.id },
    );
    fighter.fighterClass = specialization.id;
    fighter.classLabel = specialization.label;
    fighter.trainingTurnsRemaining = 1;
    fighter.condition = "Обучается · 1 ход";
    const snapshot = this.captureSnapshot(`${fighter.name}: назначена специализация ${specialization.label}`);
    return { fighter: clone(fighter), price: specialization.specializationPrice, snapshot };
  }

  purchaseArmoryItem(definitionId) {
    if (!this.input.armoryEnabled) throw new Error("ARMORY_DISABLED");
    const definition = this.input.armoryCatalog.find(({ id }) => id === definitionId);
    if (!definition) throw new Error("ARMORY_ITEM_NOT_FOUND");
    if (this.state.treasury < definition.price) throw new Error("INSUFFICIENT_FUNDS");
    this.applyTransaction("armory.purchased", `Оружейня: ${definition.name}`, -definition.price, { definitionId });
    const item = {
      instanceId: `equipment-${this.state.turn}-${this.sequence}`,
      definitionId: definition.id,
      name: definition.name,
      icon: definition.icon,
      slot: definition.slot,
      slotLabel: definition.slotLabel,
      classId: definition.classId,
      classLabel: definition.classLabel,
      quality: definition.quality,
      qualityLabel: definition.qualityLabel,
    };
    let order = null;
    if (definition.craftTurns === 0) {
      this.state.inventory.push(item);
    } else {
      order = {
        id: `order-${item.instanceId}`,
        item,
        placedTurn: this.state.turn,
        turnsRemaining: definition.craftTurns,
        totalTurns: definition.craftTurns,
      };
      this.state.craftOrders.push(order);
    }
    const snapshot = this.captureSnapshot(
      definition.craftTurns === 0 ? `${definition.name} куплен` : `${definition.name} заказан`,
    );
    return { item: clone(item), order: clone(order), snapshot };
  }

  advanceCraftOrders() {
    const completed = [];
    this.state.craftOrders.forEach((order) => {
      order.turnsRemaining -= 1;
      if (order.turnsRemaining <= 0) completed.push(order);
    });
    completed.forEach((order) => {
      this.state.inventory.push(order.item);
      this.events.push({
        sequence: ++this.sequence,
        turn: this.state.turn,
        type: "armory.completed",
        label: `Готово: ${order.item.name}`,
        amount: 0,
        balanceBefore: this.state.treasury,
        balanceAfter: this.state.treasury,
        details: { orderId: order.id, instanceId: order.item.instanceId },
      });
    });
    this.state.craftOrders = this.state.craftOrders.filter(({ turnsRemaining }) => turnsRemaining > 0);
    return completed.map(clone);
  }

  getSchoolUpgradeQuote(definitionId) {
    const definition = this.input.schoolUpgradeCatalog.find(({ id }) => id === definitionId);
    if (!definition) throw new Error("SCHOOL_UPGRADE_NOT_FOUND");
    const currentLevel = this.state.schoolUpgrades[definitionId]?.level || 1;
    return {
      definition: clone(definition),
      currentLevel,
      targetLevel: currentLevel + 1,
      price: Math.round(definition.basePrice * (1 + 0.65 * (currentLevel - 1))),
      turns: definition.baseTurns + currentLevel - 1,
      activeOrder: clone(
        this.state.schoolUpgradeOrders.find(({ definitionId: id }) => id === definitionId) || null,
      ),
    };
  }

  startSchoolUpgrade(definitionId) {
    if (!this.input.schoolUpgradesEnabled) throw new Error("SCHOOL_UPGRADES_DISABLED");
    const quote = this.getSchoolUpgradeQuote(definitionId);
    if (quote.activeOrder) throw new Error("SCHOOL_UPGRADE_IN_PROGRESS");
    if (this.state.treasury < quote.price) throw new Error("INSUFFICIENT_FUNDS");
    this.applyTransaction(
      "school.upgrade.started",
      `Улучшение: ${quote.definition.name} до уровня ${quote.targetLevel}`,
      -quote.price,
      { definitionId, targetLevel: quote.targetLevel },
    );
    const order = {
      id: `school-upgrade-${definitionId}-${this.state.turn}-${this.sequence}`,
      definitionId,
      name: quote.definition.name,
      icon: quote.definition.icon,
      targetLevel: quote.targetLevel,
      price: quote.price,
      totalTurns: quote.turns,
      turnsRemaining: quote.turns,
      placedTurn: this.state.turn,
    };
    this.state.schoolUpgradeOrders.push(order);
    const snapshot = this.captureSnapshot(`${quote.definition.name}: начато улучшение`);
    return { order: clone(order), snapshot };
  }

  advanceSchoolUpgrades() {
    const completed = [];
    this.state.schoolUpgradeOrders.forEach((order) => {
      order.turnsRemaining -= 1;
      if (order.turnsRemaining <= 0) completed.push(order);
    });
    completed.forEach((order) => {
      this.state.schoolUpgrades[order.definitionId].level = order.targetLevel;
      this.events.push({
        sequence: ++this.sequence,
        turn: this.state.turn,
        type: "school.upgrade.completed",
        label: `Улучшено: ${order.name} — уровень ${order.targetLevel}`,
        amount: 0,
        balanceBefore: this.state.treasury,
        balanceAfter: this.state.treasury,
        details: { definitionId: order.definitionId, targetLevel: order.targetLevel },
      });
    });
    this.state.schoolUpgradeOrders = this.state.schoolUpgradeOrders
      .filter(({ turnsRemaining }) => turnsRemaining > 0);
    return completed.map(clone);
  }

  get treatmentCapacity() {
    return this.state.schoolUpgrades.saniarium?.level || 1;
  }

  startTreatment(fighterId) {
    if (!this.input.medicineEnabled) throw new Error("MEDICINE_DISABLED");
    const fighter = this.state.fighters.find(({ id }) => id === fighterId);
    if (!fighter) throw new Error("FIGHTER_NOT_FOUND");
    if (!fighter.injuries.length) throw new Error("FIGHTER_NOT_INJURED");
    if (fighter.trainingTurnsRemaining > 0) throw new Error("FIGHTER_TRAINING_IN_PROGRESS");
    if (this.state.battleOffers.some(({ assignedFighterId }) => assignedFighterId === fighterId)) {
      throw new Error("FIGHTER_ASSIGNED_TO_BATTLE");
    }
    if (this.state.treatmentOrders.some(({ fighterId: id }) => id === fighterId)) {
      throw new Error("FIGHTER_ALREADY_IN_TREATMENT");
    }
    if (this.state.restOrders.some(({ fighterId: id }) => id === fighterId)) {
      throw new Error("FIGHTER_RESTING");
    }
    if (this.state.treatmentOrders.length >= this.treatmentCapacity) {
      throw new Error("SANIARIUM_CAPACITY_REACHED");
    }
    const order = {
      id: `treatment-${fighterId}-${this.state.turn}-${this.sequence}`,
      fighterId,
      totalTurns: this.input.treatmentTurns,
      turnsRemaining: this.input.treatmentTurns,
      injuries: clone(fighter.injuries),
      placedTurn: this.state.turn,
    };
    this.state.treatmentOrders.push(order);
    fighter.condition = `Лечится · ${order.turnsRemaining} хода`;
    this.events.push({
      sequence: ++this.sequence,
      turn: this.state.turn,
      type: "medicine.treatment.started",
      label: `Лечение: ${fighter.name}`,
      amount: 0,
      balanceBefore: this.state.treasury,
      balanceAfter: this.state.treasury,
      details: { fighterId, treatmentId: order.id },
    });
    const snapshot = this.captureSnapshot(`${fighter.name} помещён в Саниарий`);
    return { order: clone(order), fighter: clone(fighter), snapshot };
  }

  advanceTreatments() {
    const completed = [];
    this.state.treatmentOrders.forEach((order) => {
      order.turnsRemaining -= 1;
      const fighter = this.state.fighters.find(({ id }) => id === order.fighterId);
      if (!fighter) {
        order.turnsRemaining = 0;
        return;
      }
      if (order.turnsRemaining > 0) {
        fighter.condition = `Лечится · ${order.turnsRemaining} ход`;
        return;
      }
      fighter.injuries = [];
      fighter.injuryValueMultiplier = 1;
      fighter.condition = "Восстановлен и готов";
      completed.push({ order, fighter });
      this.events.push({
        sequence: ++this.sequence,
        turn: this.state.turn,
        type: "medicine.treatment.completed",
        label: `Вылечен: ${fighter.name}`,
        amount: 0,
        balanceBefore: this.state.treasury,
        balanceAfter: this.state.treasury,
        details: { fighterId: fighter.id, treatmentId: order.id },
      });
    });
    this.state.treatmentOrders = this.state.treatmentOrders
      .filter(({ turnsRemaining }) => turnsRemaining > 0);
    return completed.map(clone);
  }

  startRest(fighterId, activityId) {
    if (!this.input.restEnabled) throw new Error("REST_DISABLED");
    const fighter = this.state.fighters.find(({ id }) => id === fighterId);
    if (!fighter) throw new Error("FIGHTER_NOT_FOUND");
    const activity = this.input.restActivityCatalog.find(({ id }) => id === activityId);
    if (!activity || activity.requiredTier > this.state.tier) throw new Error("REST_ACTIVITY_NOT_AVAILABLE");
    if (fighter.trainingTurnsRemaining > 0) throw new Error("FIGHTER_TRAINING_IN_PROGRESS");
    if (this.state.treatmentOrders.some(({ fighterId: id }) => id === fighterId)) {
      throw new Error("FIGHTER_IN_TREATMENT");
    }
    if (this.state.restOrders.some(({ fighterId: id }) => id === fighterId)) {
      throw new Error("FIGHTER_ALREADY_RESTING");
    }
    if (this.state.battleOffers.some(({ assignedFighterId }) => assignedFighterId === fighterId)) {
      throw new Error("FIGHTER_ASSIGNED_TO_BATTLE");
    }
    if (this.state.restOrders.filter(({ activityId: id }) => id === activityId).length >= activity.capacity) {
      throw new Error("REST_CAPACITY_REACHED");
    }
    if (this.state.treasury < activity.price) throw new Error("INSUFFICIENT_FUNDS");
    this.applyTransaction(
      "rest.started",
      `Отдых: ${fighter.name} — ${activity.name}`,
      -activity.price,
      { fighterId, activityId },
    );
    const order = {
      id: `rest-${activityId}-${fighterId}-${this.state.turn}-${this.sequence}`,
      fighterId,
      activityId,
      activityName: activity.name,
      effect: activity.effect,
      price: activity.price,
      totalTurns: activity.turns,
      turnsRemaining: activity.turns,
      placedTurn: this.state.turn,
    };
    this.state.restOrders.push(order);
    fighter.condition = `Отдыхает · ${activity.name}`;
    const snapshot = this.captureSnapshot(`${fighter.name}: назначен отдых в ${activity.name}`);
    return { order: clone(order), fighter: clone(fighter), activity: clone(activity), snapshot };
  }

  advanceRestOrders() {
    const completed = [];
    this.state.restOrders.forEach((order) => {
      order.turnsRemaining -= 1;
      const fighter = this.state.fighters.find(({ id }) => id === order.fighterId);
      if (!fighter) {
        order.turnsRemaining = 0;
        return;
      }
      if (order.turnsRemaining > 0) return;
      fighter.lastRest = order.effect;
      fighter.condition = `${order.effect} · готов`;
      completed.push({ order, fighter });
      this.events.push({
        sequence: ++this.sequence,
        turn: this.state.turn,
        type: "rest.completed",
        label: `Отдых завершён: ${fighter.name} — ${order.activityName}`,
        amount: 0,
        balanceBefore: this.state.treasury,
        balanceAfter: this.state.treasury,
        details: { fighterId: fighter.id, activityId: order.activityId },
      });
    });
    this.state.restOrders = this.state.restOrders.filter(({ turnsRemaining }) => turnsRemaining > 0);
    return completed.map(clone);
  }

  advanceFighterTraining() {
    const completed = [];
    this.state.fighters.forEach((fighter) => {
      if (fighter.trainingTurnsRemaining <= 0) return;
      fighter.trainingTurnsRemaining -= 1;
      if (fighter.trainingTurnsRemaining > 0) {
        fighter.condition = `Обучается · ${fighter.trainingTurnsRemaining} ход`;
        return;
      }
      fighter.condition = "Обучен и готов";
      completed.push(fighter);
      this.events.push({
        sequence: ++this.sequence,
        turn: this.state.turn,
        type: "fighter.training.completed",
        label: `Обучение завершено: ${fighter.name}`,
        amount: 0,
        balanceBefore: this.state.treasury,
        balanceAfter: this.state.treasury,
        details: { fighterId: fighter.id, classId: fighter.fighterClass },
      });
    });
    return completed.map(clone);
  }

  get projectedIncomeKnown() {
    if (!this.input.battleOffersEnabled) return true;
    return !this.state.battleOffers.some(({ assignedFighterId }) => assignedFighterId);
  }

  get projectedIncome() {
    if (!this.input.battleOffersEnabled) return this.input.incomePerTurn;
    return this.projectedIncomeKnown ? 0 : null;
  }

  assignFighterToBattle(offerId, fighterId = null) {
    const offer = this.state.battleOffers.find(({ id }) => id === offerId);
    if (!offer) throw new Error("BATTLE_OFFER_NOT_FOUND");
    if (fighterId !== null && !this.state.fighters.some(({ id }) => id === fighterId)) {
      throw new Error("FIGHTER_NOT_FOUND");
    }
    if (fighterId && !this.state.fighters.find(({ id }) => id === fighterId)?.fighterClass) {
      throw new Error("FIGHTER_SPECIALIZATION_REQUIRED");
    }
    if (fighterId && this.state.fighters.find(({ id }) => id === fighterId)?.trainingTurnsRemaining > 0) {
      throw new Error("FIGHTER_TRAINING_IN_PROGRESS");
    }
    if (fighterId && this.state.treatmentOrders.some(({ fighterId: id }) => id === fighterId)) {
      throw new Error("FIGHTER_IN_TREATMENT");
    }
    if (fighterId && this.state.restOrders.some(({ fighterId: id }) => id === fighterId)) {
      throw new Error("FIGHTER_RESTING");
    }
    if (fighterId) {
      this.state.battleOffers.forEach((candidate) => {
        if (candidate.id !== offerId && candidate.assignedFighterId === fighterId) {
          candidate.assignedFighterId = null;
        }
      });
    }
    offer.assignedFighterId = fighterId || null;
    offer.manualResult = null;
    const fighter = this.state.fighters.find(({ id }) => id === fighterId);
    return this.captureSnapshot(
      fighter ? `${fighter.name} назначен на бой` : "Назначение на бой снято",
    );
  }

  recordManualBattleResult(offerId, fighterId, outcome) {
    const offer = this.state.battleOffers.find(({ id }) => id === offerId);
    if (!offer) throw new Error("BATTLE_OFFER_NOT_FOUND");
    if (!offer.assignedFighterId || offer.assignedFighterId !== fighterId) {
      throw new Error("BATTLE_FIGHTER_ASSIGNMENT_CHANGED");
    }
    if (!["victory", "defeat", "draw"].includes(outcome)) {
      throw new Error("BATTLE_OUTCOME_INVALID");
    }
    const fighter = this.state.fighters.find(({ id }) => id === fighterId);
    offer.manualResult = {
      outcome,
      recordedTurn: this.state.turn,
      fighterCondition: this.createBattleFighterCondition(offer, fighter, outcome),
    };
    return this.captureSnapshot(`Бой завершён: ${fighter?.name || "боец"}`);
  }

  createBattleFighterCondition(offer, fighter, outcome) {
    if (outcome !== "defeat") {
      return {
        status: "healthy",
        label: fighter.injuries.length
          ? `Без новых травм · ${fighter.injuries.join(", ")}`
          : "Без новых травм",
        injury: null,
        deathChance: 0,
      };
    }
    const deathChance = this.input.battleRules.defeatDeathChance;
    const deathRoll = (stableHash(`battle-death:${offer.id}:${fighter.id}`) % 10000) / 10000;
    if (deathRoll < deathChance) {
      return {
        status: "dead",
        label: "Погиб на арене",
        injury: null,
        deathChance,
      };
    }
    const injuryIndex = stableHash(`battle-injury:${offer.id}:${fighter.id}`) % BATTLE_INJURY_POOL.length;
    const orderedInjuries = BATTLE_INJURY_POOL.map((_, offset) => (
      BATTLE_INJURY_POOL[(injuryIndex + offset) % BATTLE_INJURY_POOL.length]
    ));
    const injury = orderedInjuries.find((candidate) => !fighter.injuries.includes(candidate))
      || orderedInjuries[0];
    return {
      status: "injured",
      label: `Травма: ${injury}`,
      injury,
      deathChance,
    };
  }

  get fighterUpkeep() {
    return this.state.fighters.reduce((sum, fighter) => sum + fighter.upkeep, 0);
  }

  get tierUpgradeCost() {
    return Math.round(
      this.input.tierRules.upgradeBaseCost
      * (1 + (this.state.tier - 1) * this.input.tierRules.upgradeCostGrowth),
    );
  }

  get canUpgradeTier() {
    return this.state.tier < this.input.tierRules.maxTier
      && this.state.tierProgress >= this.state.tierProgressMax
      && this.state.treasury >= 0;
  }

  applyTierProgress(battleResults) {
    const progressBefore = this.state.tierProgress;
    if (this.state.tier >= this.input.tierRules.maxTier) {
      battleResults.forEach((result) => { result.schoolProgress = 0; });
      return { before: progressBefore, after: progressBefore, gained: 0 };
    }
    battleResults.forEach((result) => {
      const multiplier = result.outcome === "victory"
        ? 1
        : result.outcome === "draw"
          ? this.input.tierRules.drawProgressRate
          : this.input.tierRules.defeatProgressRate;
      const calculatedProgress = Math.round(this.input.tierRules.baseProgressPerBattle * multiplier);
      const availableProgress = Math.max(0, this.state.tierProgressMax - this.state.tierProgress);
      result.schoolProgress = Math.min(calculatedProgress, availableProgress);
      this.state.tierProgress += result.schoolProgress;
    });
    return {
      before: progressBefore,
      after: this.state.tierProgress,
      gained: this.state.tierProgress - progressBefore,
    };
  }

  upgradeTier() {
    if (this.state.tier >= this.input.tierRules.maxTier) {
      throw new Error("TIER_MAX_REACHED");
    }
    if (this.state.tierProgress < this.state.tierProgressMax) {
      throw new Error("TIER_PROGRESS_REQUIRED");
    }
    if (this.state.treasury < 0) throw new Error("TIER_UPGRADE_BLOCKED_BY_DEBT");
    const cost = this.tierUpgradeCost;
    const previousTier = this.state.tier;
    this.applyTransaction(
      "tier.upgraded",
      `Повышение школы до уровня ${previousTier + 1}`,
      -cost,
      { previousTier, nextTier: previousTier + 1, cost },
    );
    this.state.tier += 1;
    this.state.tierProgress = 0;
    this.state.fighterCapacity += this.input.tierRules.fighterCapacityPerTier;
    this.state.status = this.state.treasury < 0 ? "debt" : "normal";
    return this.captureSnapshot(`Школа повышена до уровня ${this.state.tier}`);
  }

  get expenses() {
    const expenses = clone(this.input.expenses);
    if (this.state.fighters.length || this.input.fighters.length) {
      expenses.push({
        id: "fighters-upkeep",
        label: "Содержание бойцов",
        amount: this.fighterUpkeep,
      });
    }
    return expenses;
  }

  get expenseTotal() {
    return this.expenses.reduce((sum, expense) => sum + expense.amount, 0);
  }

  getFighterSalePrice(fighterOrId) {
    const fighter = typeof fighterOrId === "string"
      ? this.state.fighters.find(({ id }) => id === fighterOrId)
      : fighterOrId;
    if (!fighter) return 0;
    const { baseShare, winGrowth } = this.input.saleRules;
    return Math.round(
      fighter.purchasePrice
      * baseShare
      * (1 + winGrowth * fighter.wins)
      * fighter.injuryValueMultiplier,
    );
  }

  sellFighter(fighterId) {
    const fighterIndex = this.state.fighters.findIndex(({ id }) => id === fighterId);
    if (fighterIndex === -1) throw new Error("FIGHTER_NOT_FOUND");
    const fighter = this.state.fighters[fighterIndex];
    if (fighter.trainingTurnsRemaining > 0) throw new Error("FIGHTER_TRAINING_IN_PROGRESS");
    if (this.state.treatmentOrders.some(({ fighterId: id }) => id === fighterId)) {
      throw new Error("FIGHTER_IN_TREATMENT");
    }
    if (this.state.restOrders.some(({ fighterId: id }) => id === fighterId)) {
      throw new Error("FIGHTER_RESTING");
    }
    if (this.state.battleOffers.some(({ assignedFighterId }) => assignedFighterId === fighterId)) {
      throw new Error("FIGHTER_ASSIGNED_TO_BATTLE");
    }
    const salePrice = this.getFighterSalePrice(fighter);
    this.state.fighters.splice(fighterIndex, 1);
    this.applyTransaction(
      "fighter.sold",
      `Продажа: ${fighter.name}`,
      salePrice,
      { fighterId: fighter.id, salePrice },
    );
    this.state.status = this.state.treasury < 0 ? "debt" : "normal";
    const snapshot = this.captureSnapshot(`Продан ${fighter.name}`);
    return { fighter: clone(fighter), salePrice, snapshot };
  }

  get forecastTreasury() {
    if (!this.projectedIncomeKnown) return null;
    return this.state.treasury + this.projectedIncome - this.expenseTotal;
  }

  resolveAssignedBattles() {
    const results = [];
    const deadFighterIds = new Set();
    let income = 0;
    this.state.battleOffers.forEach((offer) => {
      if (!offer.assignedFighterId) return;
      const fighter = this.state.fighters.find(({ id }) => id === offer.assignedFighterId);
      if (!fighter) return;
      const roll = (stableHash(`${offer.id}:${fighter.id}`) % 1000) / 1000;
      const outcome = offer.manualResult?.outcome
        || (roll < offer.winChance ? "victory" : "defeat");
      const reward = outcome === "victory"
        ? offer.victoryReward
        : Math.round(offer.victoryReward * this.input.battleRules.lossRewardRate);
      const experience = outcome === "victory"
        ? offer.victoryExperience
        : offer.defeatExperience;
      const fighterCondition = clone(
        offer.manualResult?.fighterCondition
        || this.createBattleFighterCondition(offer, fighter, outcome),
      );
      if (outcome === "victory") fighter.wins += 1;
      fighter.experience += experience;
      if (fighterCondition.status === "dead") {
        fighter.condition = "Погиб на арене";
        deadFighterIds.add(fighter.id);
      } else if (fighterCondition.injury) {
        if (!fighter.injuries.includes(fighterCondition.injury)) {
          fighter.injuries.push(fighterCondition.injury);
        }
        fighter.condition = fighterCondition.label;
      }
      const result = {
        id: `result-${offer.id}`,
        turn: this.state.turn,
        offerId: offer.id,
        fighterId: fighter.id,
        fighterName: fighter.name,
        fighterClass: fighter.classLabel,
        fighterPortrait: fighter.rosterPortrait || fighter.portrait,
        opponentName: offer.opponentName,
        opponentClass: offer.opponentClass,
        opponentPortrait: offer.opponentPortrait,
        arena: offer.arena,
        outcome,
        resolutionMode: offer.manualResult ? "manual" : "automatic",
        fighterCondition,
        reward,
        experience,
        summary: outcome === "victory"
          ? `${fighter.name} победил в бою против ${offer.opponentName}.`
          : outcome === "draw"
            ? `Бой ${fighter.name} против ${offer.opponentName} завершился без победителя.`
            : `${fighter.name} проиграл бой против ${offer.opponentName}, но школа получила часть награды.`,
      };
      results.push(result);
      income += reward;
      this.applyTransaction(
        "battle.reward",
        outcome === "victory" ? `Победа: ${fighter.name}` : `Участие в бою: ${fighter.name}`,
        reward,
        { offerId: offer.id, fighterId: fighter.id, outcome },
      );
    });
    if (deadFighterIds.size) {
      this.state.fighters = this.state.fighters.filter(({ id }) => !deadFighterIds.has(id));
      this.state.treatmentOrders = this.state.treatmentOrders.filter(({ fighterId }) => !deadFighterIds.has(fighterId));
      this.state.restOrders = this.state.restOrders.filter(({ fighterId }) => !deadFighterIds.has(fighterId));
    }
    return { results, income };
  }

  applyTransaction(type, label, amount, details = {}) {
    const balanceBefore = this.state.treasury;
    this.state.treasury += amount;
    this.events.push({
      sequence: ++this.sequence,
      turn: this.state.turn,
      type,
      label,
      amount,
      balanceBefore,
      balanceAfter: this.state.treasury,
      details: clone(details),
    });
  }

  endTurn() {
    const completedTurn = this.state.turn;
    const balanceBefore = this.state.treasury;
    const turnExpenses = this.expenses;
    let income = this.input.incomePerTurn;
    let battleResults = [];
    const tierProgressBefore = this.state.tierProgress;

    if (this.input.battleOffersEnabled) {
      const resolution = this.resolveAssignedBattles();
      income = resolution.income;
      battleResults = resolution.results;
    } else {
      this.applyTransaction("turn.income", "Доход школы", this.input.incomePerTurn);
    }
    turnExpenses.forEach((expense) => {
      this.applyTransaction(
        "turn.expense",
        expense.label,
        -expense.amount,
        { expenseId: expense.id },
      );
    });
    this.advanceCraftOrders();
    this.advanceFighterTraining();
    this.advanceSchoolUpgrades();
    this.advanceTreatments();
    this.advanceRestOrders();

    this.state.status = this.state.treasury < 0 ? "debt" : "normal";
    const tierProgress = this.applyTierProgress(battleResults);
    this.state.lastBattleResults = clone(battleResults);
    this.state.battleHistory.push(...clone(battleResults));
    this.state.lastTurn = {
      turn: completedTurn,
      balanceBefore,
      income,
      expenses: turnExpenses.reduce((sum, expense) => sum + expense.amount, 0),
      net: income - turnExpenses.reduce((sum, expense) => sum + expense.amount, 0),
      balanceAfter: this.state.treasury,
      tierProgressBefore,
      tierProgressAfter: tierProgress.after,
      tierProgressGained: tierProgress.gained,
      tierUpgradeAvailable: this.canUpgradeTier,
      tierUpgradeCost: this.tierUpgradeCost,
    };
    this.state.turn += 1;
    this.state.battleOffers = this.input.battleOffersEnabled
      ? this.createBattleOffers(this.state.turn)
      : [];
    this.state.marketOffers = this.input.marketEnabled
      ? this.createMarketOffers(this.state.turn)
      : [];
    this.captureSnapshot(`Итог хода ${completedTurn}`);
    return this.snapshots.at(-1);
  }

  captureSnapshot(label) {
    const snapshot = {
      index: this.snapshots.length,
      label,
      state: clone(this.state),
      economy: {
        income: this.projectedIncome,
        incomeKnown: this.projectedIncomeKnown,
        expenses: this.expenses,
        expenseTotal: this.expenseTotal,
        forecastTreasury: this.forecastTreasury,
      },
      eventSequence: this.sequence,
    };
    this.snapshots.push(snapshot);
    return snapshot;
  }

  result() {
    return {
      schemaVersion: this.input.schemaVersion,
      rulesetVersion: this.input.rulesetVersion,
      input: clone(this.input),
      state: clone(this.state),
      events: clone(this.events),
      snapshots: clone(this.snapshots),
    };
  }
}

const DEFAULT_MANAGEMENT_INPUT = clone(DEFAULT_INPUT);

globalScope.GladiatorManagement = Object.freeze({
  DEFAULT_MANAGEMENT_INPUT,
  SchoolManagementEngine,
  normalizeManagementInput,
});

})(globalThis);
