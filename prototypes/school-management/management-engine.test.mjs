import assert from "node:assert/strict";
import "./management-engine.js";

const { SchoolManagementEngine } = globalThis.GladiatorManagement;

const engine = new SchoolManagementEngine({
  initialTreasury: 100,
  tier: 3,
  incomePerTurn: 20,
  expenses: [
    { id: "food", label: "Еда", amount: 12 },
    { id: "wages", label: "Жалование", amount: 18 },
  ],
});

assert.equal(engine.expenseTotal, 30);
assert.equal(engine.forecastTreasury, 90);
assert.equal(engine.result().snapshots.length, 1);
assert.equal(engine.result().state.tier, 3);

engine.endTurn();
let result = engine.result();
assert.equal(result.state.treasury, 90);
assert.equal(result.state.turn, 2);
assert.equal(result.events.length, 3);
assert.deepEqual(result.events.map((event) => event.amount), [20, -12, -18]);
assert.equal(result.snapshots.length, 2);

engine.endTurn();
result = engine.result();
assert.equal(result.state.treasury, 80);
assert.equal(result.state.turn, 3);
assert.equal(result.snapshots.at(-1).economy.forecastTreasury, 70);

const debtEngine = new SchoolManagementEngine({
  initialTreasury: 5,
  incomePerTurn: 0,
  expenses: [{ id: "food", label: "Еда", amount: 10 }],
});
debtEngine.endTurn();
assert.equal(debtEngine.result().state.status, "debt");
assert.equal(debtEngine.result().state.treasury, -5);

const rosterEngine = new SchoolManagementEngine({
  initialTreasury: 100,
  fighterCapacity: 4,
  incomePerTurn: 0,
  expenses: [{ id: "food", label: "Еда", amount: 10 }],
  saleRules: { baseShare: 0.5, winGrowth: 0.1 },
  fighters: [
    {
      id: "test-murmillo",
      name: "Тестовый мурмиллон",
      fighterClass: "murmillo",
      classLabel: "Мурмиллон",
      wins: 2,
      upkeep: 8,
      purchasePrice: 100,
      injuryValueMultiplier: 1,
    },
    {
      id: "test-retiarius",
      name: "Тестовый ретиарий",
      fighterClass: "retiarius",
      classLabel: "Ретиарий",
      wins: 0,
      upkeep: 6,
      purchasePrice: 80,
      injuryValueMultiplier: 0.5,
    },
  ],
});

assert.equal(rosterEngine.fighterUpkeep, 14);
assert.equal(rosterEngine.expenseTotal, 24);
assert.equal(rosterEngine.getFighterSalePrice("test-murmillo"), 60);
assert.equal(rosterEngine.getFighterSalePrice("test-retiarius"), 20);

const sale = rosterEngine.sellFighter("test-murmillo");
assert.equal(sale.salePrice, 60);
assert.equal(rosterEngine.result().state.treasury, 160);
assert.equal(rosterEngine.result().state.fighters.length, 1);
assert.equal(rosterEngine.fighterUpkeep, 6);
assert.equal(rosterEngine.expenseTotal, 16);
assert.equal(rosterEngine.result().events.at(-1).type, "fighter.sold");
assert.equal(rosterEngine.result().snapshots.at(-1).economy.forecastTreasury, 144);

const battleEngine = new SchoolManagementEngine({
  initialTreasury: 100,
  incomePerTurn: 40,
  battleOffersEnabled: true,
  battleRules: { offersPerTurn: 2, lossRewardRate: 0.5, defeatDeathChance: 0 },
  expenses: [{ id: "food", label: "Еда", amount: 5 }],
  fighters: [
    {
      id: "battle-fighter-1",
      name: "Первый боец",
      fighterClass: "murmillo",
      classLabel: "Мурмиллон",
      wins: 0,
      upkeep: 0,
      purchasePrice: 100,
    },
    {
      id: "battle-fighter-2",
      name: "Второй боец",
      fighterClass: "retiarius",
      classLabel: "Ретиарий",
      wins: 0,
      upkeep: 0,
      purchasePrice: 100,
    },
  ],
});

let battleState = battleEngine.result().state;
assert.equal(battleState.battleOffers.length, 2);
assert.equal(battleEngine.projectedIncomeKnown, true);
assert.equal(battleEngine.forecastTreasury, 95);

battleEngine.assignFighterToBattle(battleState.battleOffers[0].id, "battle-fighter-1");
assert.equal(battleEngine.projectedIncomeKnown, false);
assert.equal(battleEngine.forecastTreasury, null);
assert.throws(() => battleEngine.sellFighter("battle-fighter-1"), /FIGHTER_ASSIGNED_TO_BATTLE/);

battleState = battleEngine.result().state;
assert.equal(battleState.battleOffers.every(({ opponentPortrait }) => opponentPortrait.endsWith(".png")), true);
assert.deepEqual(
  [...new Set(battleState.battleOffers.map(({ combatArchetype }) => combatArchetype))].sort(),
  ["retiarius", "swordsman"],
);
assert.equal(
  battleState.battleOffers.every(({ difficultyId }) => ["low", "medium", "high"].includes(difficultyId)),
  true,
);
assert.equal(battleState.battleOffers.every(({ victoryExperience, defeatExperience }) => victoryExperience > defeatExperience), true);
const experienceBeforeBattles = battleState.fighters.reduce((sum, fighter) => sum + fighter.experience, 0);
battleEngine.assignFighterToBattle(battleState.battleOffers[1].id, "battle-fighter-2");
battleEngine.recordManualBattleResult(battleState.battleOffers[0].id, "battle-fighter-1", "victory");
const restoredBattleEngine = SchoolManagementEngine.fromResult(battleEngine.result());
assert.deepEqual(restoredBattleEngine.result().state, battleEngine.result().state);
assert.deepEqual(restoredBattleEngine.result().events, battleEngine.result().events);
assert.throws(
  () => battleEngine.recordManualBattleResult(battleState.battleOffers[1].id, "battle-fighter-1", "victory"),
  /BATTLE_FIGHTER_ASSIGNMENT_CHANGED/,
);
battleEngine.endTurn();
battleState = battleEngine.result().state;
assert.equal(battleState.turn, 2);
assert.equal(battleState.lastBattleResults.length, 2);
assert.equal(battleState.battleHistory.length, 2);
assert.equal(battleState.battleOffers.length, 2);
assert.equal(battleState.battleOffers.every(({ assignedFighterId }) => assignedFighterId === null), true);
assert.equal(battleEngine.result().events.filter(({ type }) => type === "battle.reward").length, 2);
assert.equal(battleState.lastTurn.income, battleState.lastBattleResults.reduce((sum, result) => sum + result.reward, 0));
assert.equal(battleState.lastBattleResults.every(({ experience }) => experience > 0), true);
assert.equal(
  battleState.tierProgress,
  battleState.lastBattleResults.reduce((sum, result) => sum + result.schoolProgress, 0),
);
assert.equal(battleState.lastTurn.tierProgressGained, battleState.tierProgress);
assert.equal(battleState.lastBattleResults.find(({ fighterId }) => fighterId === "battle-fighter-1").resolutionMode, "manual");
assert.equal(battleState.lastBattleResults.find(({ fighterId }) => fighterId === "battle-fighter-1").outcome, "victory");
assert.equal(battleState.lastBattleResults.find(({ fighterId }) => fighterId === "battle-fighter-1").fighterCondition.status, "healthy");
assert.equal(battleState.lastBattleResults.find(({ fighterId }) => fighterId === "battle-fighter-2").resolutionMode, "automatic");
assert.equal(battleState.lastBattleResults.every(({ fighterCondition }) => typeof fighterCondition.label === "string"), true);
assert.equal(
  battleState.fighters.reduce((sum, fighter) => sum + fighter.experience, 0),
  experienceBeforeBattles + battleState.lastBattleResults.reduce((sum, result) => sum + result.experience, 0),
);
assert.equal(battleState.treasury, 100 + battleState.lastTurn.income - 5);

const generatedBattleEngine = new SchoolManagementEngine({
  initialTreasury: 0,
  incomePerTurn: 0,
  battleOffersEnabled: true,
  battleRules: { offersPerTurn: 3 },
  expenses: [],
  fighters: [],
});
assert.equal(generatedBattleEngine.result().input.battleRules.defeatDeathChance, 0.3);
const sameGeneratedBattleEngine = new SchoolManagementEngine({
  initialTreasury: 0,
  incomePerTurn: 0,
  battleOffersEnabled: true,
  battleRules: { offersPerTurn: 3 },
  expenses: [],
  fighters: [],
});
const firstGeneratedOffers = generatedBattleEngine.result().state.battleOffers;
assert.equal(firstGeneratedOffers.length, 3);
assert.equal(new Set(firstGeneratedOffers.map(({ difficultyLevel }) => difficultyLevel)).size, 3);
assert.equal(new Set(firstGeneratedOffers.map(({ combatArchetype }) => combatArchetype)).size, 2);
assert.deepEqual(firstGeneratedOffers, sameGeneratedBattleEngine.result().state.battleOffers);
generatedBattleEngine.endTurn();
assert.notDeepEqual(
  generatedBattleEngine.result().state.battleOffers.map(({ opponentName, difficultyId, arena }) => ({ opponentName, difficultyId, arena })),
  firstGeneratedOffers.map(({ opponentName, difficultyId, arena }) => ({ opponentName, difficultyId, arena })),
);

const fatalBattleEngine = new SchoolManagementEngine({
  initialTreasury: 0,
  incomePerTurn: 0,
  battleOffersEnabled: true,
  battleRules: { offersPerTurn: 1, defeatDeathChance: 1 },
  expenses: [],
  fighters: [{
    id: "doomed-fighter",
    name: "Обречённый боец",
    fighterClass: "murmillo",
    classLabel: "Мурмиллон",
    upkeep: 0,
  }],
});
let fatalBattleState = fatalBattleEngine.result().state;
fatalBattleEngine.assignFighterToBattle(fatalBattleState.battleOffers[0].id, "doomed-fighter");
fatalBattleEngine.recordManualBattleResult(fatalBattleState.battleOffers[0].id, "doomed-fighter", "defeat");
fatalBattleState = fatalBattleEngine.result().state;
assert.equal(fatalBattleState.battleOffers[0].manualResult.fighterCondition.status, "dead");
fatalBattleEngine.endTurn();
fatalBattleState = fatalBattleEngine.result().state;
assert.equal(fatalBattleState.lastBattleResults[0].fighterCondition.label, "Погиб на арене");
assert.equal(fatalBattleState.fighters.length, 0);

const injuredBattleEngine = new SchoolManagementEngine({
  initialTreasury: 0,
  incomePerTurn: 0,
  battleOffersEnabled: true,
  battleRules: { offersPerTurn: 1, defeatDeathChance: 0 },
  expenses: [],
  fighters: [{
    id: "injured-fighter",
    name: "Раненый боец",
    fighterClass: "retiarius",
    classLabel: "Ретиарий",
    upkeep: 0,
  }],
});
let injuredBattleState = injuredBattleEngine.result().state;
injuredBattleEngine.assignFighterToBattle(injuredBattleState.battleOffers[0].id, "injured-fighter");
injuredBattleEngine.recordManualBattleResult(injuredBattleState.battleOffers[0].id, "injured-fighter", "defeat");
injuredBattleEngine.endTurn();
injuredBattleState = injuredBattleEngine.result().state;
assert.equal(injuredBattleState.lastBattleResults[0].fighterCondition.status, "injured");
assert.equal(injuredBattleState.fighters[0].injuries.length, 1);

const defeatProgressEngine = new SchoolManagementEngine({
  initialTreasury: 100,
  incomePerTurn: 0,
  battleOffersEnabled: true,
  battleRules: { offersPerTurn: 1, lossRewardRate: 0.2, defeatDeathChance: 0 },
  tierRules: { baseProgressPerBattle: 20, defeatProgressRate: 0.5 },
  expenses: [],
  fighters: [{
    id: "progress-fighter",
    name: "Боец прогресса",
    fighterClass: "murmillo",
    classLabel: "Мурмиллон",
    upkeep: 0,
  }],
});
let defeatProgressState = defeatProgressEngine.result().state;
defeatProgressEngine.assignFighterToBattle(defeatProgressState.battleOffers[0].id, "progress-fighter");
defeatProgressEngine.recordManualBattleResult(defeatProgressState.battleOffers[0].id, "progress-fighter", "defeat");
defeatProgressEngine.endTurn();
defeatProgressState = defeatProgressEngine.result().state;
assert.equal(defeatProgressState.tierProgress, 10);
assert.equal(defeatProgressState.lastBattleResults[0].schoolProgress, 10);

const tierUpgradeEngine = new SchoolManagementEngine({
  initialTreasury: 200,
  tier: 1,
  tierProgress: 100,
  tierProgressMax: 100,
  fighterCapacity: 4,
  tierRules: { upgradeBaseCost: 100, upgradeCostGrowth: 0.5, fighterCapacityPerTier: 1 },
  expenses: [],
});
assert.equal(tierUpgradeEngine.canUpgradeTier, true);
assert.equal(tierUpgradeEngine.tierUpgradeCost, 100);
tierUpgradeEngine.upgradeTier();
const upgradedTierState = tierUpgradeEngine.result().state;
assert.equal(upgradedTierState.tier, 2);
assert.equal(upgradedTierState.tierProgress, 0);
assert.equal(upgradedTierState.fighterCapacity, 5);
assert.equal(upgradedTierState.treasury, 100);
assert.equal(tierUpgradeEngine.tierUpgradeCost, 150);
assert.equal(tierUpgradeEngine.result().events.at(-1).type, "tier.upgraded");

const maxTierEngine = new SchoolManagementEngine({
  initialTreasury: 500,
  tier: 3,
  tierProgress: 100,
  tierProgressMax: 100,
  tierRules: { maxTier: 3 },
  expenses: [],
});
assert.equal(maxTierEngine.canUpgradeTier, false);
assert.throws(() => maxTierEngine.upgradeTier(), /TIER_MAX_REACHED/);
const maxTierBattle = [{ outcome: "victory" }];
assert.deepEqual(maxTierEngine.applyTierProgress(maxTierBattle), { before: 100, after: 100, gained: 0 });
assert.equal(maxTierBattle[0].schoolProgress, 0);
assert.equal(new SchoolManagementEngine({ tier: 4, tierRules: { maxTier: 3 } }).result().state.tier, 3);

const debtTierEngine = new SchoolManagementEngine({
  initialTreasury: 0,
  incomePerTurn: 0,
  tierProgress: 100,
  tierProgressMax: 100,
  expenses: [{ id: "debt", label: "Долг", amount: 1 }],
});
debtTierEngine.endTurn();
assert.equal(debtTierEngine.canUpgradeTier, false);
assert.throws(() => debtTierEngine.upgradeTier(), /TIER_UPGRADE_BLOCKED_BY_DEBT/);

const commerceEngine = new SchoolManagementEngine({
  initialTreasury: 500,
  fighterCapacity: 2,
  incomePerTurn: 0,
  battleOffersEnabled: true,
  battleRules: { offersPerTurn: 1 },
  marketEnabled: true,
  marketRules: { offersPerTurn: 3, perkChance: 0.5 },
  armoryEnabled: true,
  expenses: [],
  fighters: [],
});

let commerceState = commerceEngine.result().state;
assert.equal(commerceState.marketOffers.length, 3);
assert.equal(commerceState.marketOffers.every(({ perk }) => perk === null || typeof perk === "string"), true);
const firstCandidate = commerceState.marketOffers[0];
const treasuryBeforeCandidate = commerceState.treasury;
const marketPurchase = commerceEngine.purchaseMarketOffer(firstCandidate.id);
commerceState = commerceEngine.result().state;
assert.equal(commerceState.treasury, treasuryBeforeCandidate - firstCandidate.price);
assert.equal(commerceState.marketOffers.length, 2);
assert.equal(marketPurchase.fighter.fighterClass, null);
assert.equal(marketPurchase.fighter.classLabel, "Без специализации");
assert.equal(marketPurchase.fighter.perks.length <= 1, true);
assert.throws(
  () => commerceEngine.assignFighterToBattle(commerceState.battleOffers[0].id, marketPurchase.fighter.id),
  /FIGHTER_SPECIALIZATION_REQUIRED/,
);
const specializationTreasuryBefore = commerceEngine.result().state.treasury;
const specializationPrice = commerceEngine.result().input.fighterClassCatalog
  .find(({ id }) => id === "murmillo").specializationPrice;
commerceEngine.assignFighterSpecialization(marketPurchase.fighter.id, "murmillo");
assert.equal(commerceEngine.result().state.fighters[0].fighterClass, "murmillo");
assert.equal(commerceEngine.result().state.fighters[0].trainingTurnsRemaining, 1);
assert.equal(commerceEngine.result().state.treasury, specializationTreasuryBefore - specializationPrice);
assert.equal(commerceEngine.result().events.at(-1).type, "fighter.specialized");
assert.throws(
  () => commerceEngine.assignFighterToBattle(
    commerceEngine.result().state.battleOffers[0].id,
    marketPurchase.fighter.id,
  ),
  /FIGHTER_TRAINING_IN_PROGRESS/,
);
assert.throws(() => commerceEngine.sellFighter(marketPurchase.fighter.id), /FIGHTER_TRAINING_IN_PROGRESS/);
assert.throws(
  () => commerceEngine.assignFighterSpecialization(marketPurchase.fighter.id, "retiarius"),
  /FIGHTER_SPECIALIZATION_ALREADY_ASSIGNED/,
);

const poorTrainingEngine = new SchoolManagementEngine({
  initialTreasury: 0,
  incomePerTurn: 0,
  expenses: [],
  fighters: [{ id: "untrained", name: "Необученный", fighterClass: null }],
});
assert.throws(
  () => poorTrainingEngine.assignFighterSpecialization("untrained", "retiarius"),
  /INSUFFICIENT_FUNDS/,
);
assert.equal(poorTrainingEngine.result().state.fighters[0].fighterClass, null);

const commonDefinition = commerceEngine.result().input.armoryCatalog.find(({ craftTurns }) => craftTurns === 0);
const goodDefinition = commerceEngine.result().input.armoryCatalog.find(({ craftTurns }) => craftTurns === 2);
assert.deepEqual(
  [...new Set(commerceEngine.result().input.armoryCatalog.map(({ classId }) => classId))].sort(),
  ["hoplomachus", "murmillo", "retiarius", "secutor", "thraex"],
);
assert.equal(commerceEngine.result().input.armoryCatalog.length, 20);
assert.equal(
  commerceEngine.result().input.armoryCatalog
    .filter(({ classId }) => classId === "murmillo" || classId === "retiarius")
    .every(({ icon }) => icon?.endsWith(".png")),
  true,
);
assert.equal(
  commerceEngine.result().input.fighterClassCatalog
    .every(({ icon, color }) => icon && /^#[0-9a-f]{6}$/i.test(color)),
  true,
);
const inventoryBefore = commerceEngine.result().state.inventory.length;
commerceEngine.purchaseArmoryItem(commonDefinition.id);
assert.equal(commerceEngine.result().state.inventory.length, inventoryBefore + 1);
commerceEngine.purchaseArmoryItem(goodDefinition.id);
commerceState = commerceEngine.result().state;
assert.equal(commerceState.craftOrders.length, 1);
assert.equal(commerceState.craftOrders[0].turnsRemaining, 2);
commerceEngine.endTurn();
assert.equal(commerceEngine.result().state.craftOrders[0].turnsRemaining, 1);
assert.equal(commerceEngine.result().state.fighters[0].trainingTurnsRemaining, 0);
assert.equal(commerceEngine.result().state.fighters[0].condition, "Обучен и готов");
assert.equal(commerceEngine.result().events.filter(({ type }) => type === "fighter.training.completed").length, 1);
commerceEngine.endTurn();
commerceState = commerceEngine.result().state;
assert.equal(commerceState.craftOrders.length, 0);
assert.equal(commerceState.inventory.some(({ definitionId }) => definitionId === goodDefinition.id), true);
assert.equal(commerceEngine.result().events.filter(({ type }) => type === "armory.completed").length, 1);
assert.equal(commerceState.marketOffers.length, 3);

const upgradesEngine = new SchoolManagementEngine({
  initialTreasury: 300,
  incomePerTurn: 0,
  expenses: [],
  schoolUpgradesEnabled: true,
  fighters: [],
});

const saniariumQuote = upgradesEngine.getSchoolUpgradeQuote("saniarium");
assert.equal(saniariumQuote.currentLevel, 1);
assert.equal(saniariumQuote.targetLevel, 2);
assert.equal(saniariumQuote.price, 75);
assert.equal(saniariumQuote.turns, 1);
assert.equal(saniariumQuote.definition.icon.endsWith(".png"), true);

upgradesEngine.startSchoolUpgrade("saniarium");
assert.equal(upgradesEngine.result().state.treasury, 225);
assert.equal(upgradesEngine.result().state.schoolUpgradeOrders.length, 1);
assert.throws(() => upgradesEngine.startSchoolUpgrade("saniarium"), /SCHOOL_UPGRADE_IN_PROGRESS/);
upgradesEngine.endTurn();
assert.equal(upgradesEngine.result().state.schoolUpgrades.saniarium.level, 2);
assert.equal(upgradesEngine.result().state.schoolUpgradeOrders.length, 0);
assert.equal(upgradesEngine.result().events.filter(({ type }) => type === "school.upgrade.completed").length, 1);

const armamentariumQuote = upgradesEngine.getSchoolUpgradeQuote("armamentarium");
assert.equal(armamentariumQuote.price, 110);
assert.equal(armamentariumQuote.turns, 2);
upgradesEngine.startSchoolUpgrade("armamentarium");
upgradesEngine.endTurn();
assert.equal(upgradesEngine.result().state.schoolUpgradeOrders[0].turnsRemaining, 1);
upgradesEngine.endTurn();
assert.equal(upgradesEngine.result().state.schoolUpgrades.armamentarium.level, 2);
assert.equal(upgradesEngine.result().state.schoolUpgradeOrders.length, 0);

const poorUpgradesEngine = new SchoolManagementEngine({
  initialTreasury: 0,
  incomePerTurn: 0,
  expenses: [],
  schoolUpgradesEnabled: true,
  fighters: [],
});
assert.throws(() => poorUpgradesEngine.startSchoolUpgrade("saniarium"), /INSUFFICIENT_FUNDS/);

const treatmentEngine = new SchoolManagementEngine({
  initialTreasury: 500,
  incomePerTurn: 0,
  expenses: [],
  battleOffersEnabled: true,
  battleRules: { offersPerTurn: 1 },
  schoolUpgradesEnabled: true,
  medicineEnabled: true,
  treatmentTurns: 2,
  fighters: [
    { id: "injured-1", name: "Первый раненый", fighterClass: "murmillo", injuries: ["Повреждение руки"], injuryValueMultiplier: 0.8 },
    { id: "injured-2", name: "Второй раненый", fighterClass: "retiarius", injuries: ["Повреждение ноги"] },
    { id: "injured-3", name: "Третий раненый", fighterClass: "thraex", injuries: ["Повреждение руки"] },
  ],
});

assert.equal(treatmentEngine.treatmentCapacity, 1);
treatmentEngine.startTreatment("injured-1");
assert.equal(treatmentEngine.result().state.treatmentOrders.length, 1);
assert.throws(() => treatmentEngine.startTreatment("injured-2"), /SANIARIUM_CAPACITY_REACHED/);
assert.throws(() => treatmentEngine.sellFighter("injured-1"), /FIGHTER_IN_TREATMENT/);
assert.throws(
  () => treatmentEngine.assignFighterToBattle(treatmentEngine.result().state.battleOffers[0].id, "injured-1"),
  /FIGHTER_IN_TREATMENT/,
);
treatmentEngine.endTurn();
assert.equal(treatmentEngine.result().state.treatmentOrders[0].turnsRemaining, 1);
treatmentEngine.endTurn();
assert.equal(treatmentEngine.result().state.treatmentOrders.length, 0);
assert.deepEqual(treatmentEngine.result().state.fighters.find(({ id }) => id === "injured-1").injuries, []);
assert.equal(treatmentEngine.result().state.fighters.find(({ id }) => id === "injured-1").injuryValueMultiplier, 1);
assert.equal(treatmentEngine.result().events.filter(({ type }) => type === "medicine.treatment.completed").length, 1);

treatmentEngine.startSchoolUpgrade("saniarium");
treatmentEngine.endTurn();
assert.equal(treatmentEngine.treatmentCapacity, 2);
treatmentEngine.startTreatment("injured-2");
treatmentEngine.startTreatment("injured-3");
assert.equal(treatmentEngine.result().state.treatmentOrders.length, 2);

const restEngine = new SchoolManagementEngine({
  initialTreasury: 100,
  incomePerTurn: 0,
  expenses: [],
  battleOffersEnabled: true,
  battleRules: { offersPerTurn: 1 },
  restEnabled: true,
  fighters: [
    { id: "rest-1", name: "Отдыхающий I", fighterClass: "murmillo" },
    { id: "rest-2", name: "Отдыхающий II", fighterClass: "retiarius" },
    { id: "rest-3", name: "Отдыхающий III", fighterClass: "thraex" },
    { id: "rest-4", name: "Свободный", fighterClass: "secutor" },
  ],
});

assert.deepEqual(restEngine.result().input.restActivityCatalog.map(({ id }) => id), ["balneum", "popina"]);
restEngine.startRest("rest-1", "balneum");
restEngine.startRest("rest-2", "balneum");
assert.throws(() => restEngine.startRest("rest-3", "balneum"), /REST_CAPACITY_REACHED/);
restEngine.startRest("rest-3", "popina");
assert.equal(restEngine.result().state.treasury, 72);
assert.equal(restEngine.result().state.restOrders.length, 3);
assert.throws(() => restEngine.sellFighter("rest-1"), /FIGHTER_RESTING/);
assert.throws(
  () => restEngine.assignFighterToBattle(restEngine.result().state.battleOffers[0].id, "rest-1"),
  /FIGHTER_RESTING/,
);
restEngine.endTurn();
assert.equal(restEngine.result().state.restOrders.length, 0);
assert.equal(restEngine.result().state.fighters.find(({ id }) => id === "rest-1").lastRest, "Тело отдохнуло");
assert.equal(restEngine.result().events.filter(({ type }) => type === "rest.completed").length, 3);

console.log("management-engine: ok");
