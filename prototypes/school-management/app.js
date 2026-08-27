const {
  DEFAULT_MANAGEMENT_INPUT,
  SchoolManagementEngine,
} = globalThis.GladiatorManagement;

const $ = (selector) => document.querySelector(selector);

const elements = {
  form: $("#economy-form"),
  initialTreasury: $("#initial-treasury"),
  initialTier: $("#initial-tier"),
  fighterCapacity: $("#fighter-capacity"),
  income: $("#income"),
  food: $("#food"),
  medicine: $("#medicine"),
  wages: $("#wages"),
  phone: $("#phone"),
  gameScreen: $(".game-screen"),
  schoolScene: $("#school-scene"),
  schoolSceneImage: $("#school-scene-image"),
  battleOverlay: $("#phone-battle-overlay"),
  battleFrame: $("#phone-battle-frame"),
  schoolHomeView: $("#school-home-view"),
  battlesView: $("#battles-view"),
  battlesSection: $("#battles-section-button"),
  battlesBackHome: $("#battles-back-home"),
  battleOffersCount: $("#battle-offers-count"),
  battleOfferSummary: $("#battle-offer-summary"),
  battleCurrentTurn: $("#battle-current-turn"),
  battleAssignedSummary: $("#battle-assigned-summary"),
  battleOfferList: $("#battle-offer-list"),
  battleResultsList: $("#battle-results-list"),
  turnSummaryModal: $("#turn-summary-modal"),
  turnSummaryTitle: $("#turn-summary-title"),
  turnSummaryContent: $("#turn-summary-content"),
  marketView: $("#market-view"),
  marketSection: $("#market-section-button"),
  marketBackHome: $("#market-back-home"),
  marketOffersCount: $("#market-offers-count"),
  marketOfferSummary: $("#market-offer-summary"),
  marketTreasury: $("#market-treasury"),
  marketCapacity: $("#market-capacity"),
  marketNotice: $("#market-notice"),
  marketOfferList: $("#market-offer-list"),
  armoryView: $("#armory-view"),
  armorySection: $("#armory-section-button"),
  armoryBackHome: $("#armory-back-home"),
  armoryOrdersHomeCount: $("#armory-orders-home-count"),
  armoryOrderSummary: $("#armory-order-summary"),
  armoryTreasury: $("#armory-treasury"),
  armoryOrdersCount: $("#armory-orders-count"),
  armoryNotice: $("#armory-notice"),
  armoryCatalogList: $("#armory-catalog-list"),
  armoryOrdersList: $("#armory-orders-list"),
  armoryInventoryList: $("#armory-inventory-list"),
  upgradesView: $("#upgrades-view"),
  upgradesSection: $("#upgrades-section-button"),
  upgradesBackHome: $("#upgrades-back-home"),
  schoolUpgradesHomeCount: $("#school-upgrades-home-count"),
  schoolUpgradesSummary: $("#school-upgrades-summary"),
  schoolUpgradesTreasury: $("#school-upgrades-treasury"),
  schoolUpgradesOrdersCount: $("#school-upgrades-orders-count"),
  schoolUpgradesNotice: $("#school-upgrades-notice"),
  schoolUpgradeList: $("#school-upgrade-list"),
  medicineView: $("#medicine-view"),
  medicineSection: $("#medicine-section-button"),
  medicineBackHome: $("#medicine-back-home"),
  medicineHomeCount: $("#medicine-home-count"),
  medicineInjuredSummary: $("#medicine-injured-summary"),
  medicineLevel: $("#medicine-level"),
  medicineCapacity: $("#medicine-capacity"),
  medicineDuration: $("#medicine-duration"),
  medicineNotice: $("#medicine-notice"),
  medicineSlotList: $("#medicine-slot-list"),
  medicineCandidateList: $("#medicine-candidate-list"),
  restView: $("#rest-view"),
  restSection: $("#rest-section-button"),
  restBackHome: $("#rest-back-home"),
  restHomeCount: $("#rest-home-count"),
  restActiveSummary: $("#rest-active-summary"),
  restTreasury: $("#rest-treasury"),
  restExpenses: $("#rest-expenses"),
  restNotice: $("#rest-notice"),
  restActivityList: $("#rest-activity-list"),
  restFighterList: $("#rest-fighter-list"),
  fightersView: $("#fighters-view"),
  fightersSection: $("#fighters-section-button"),
  fightersBackHome: $("#fighters-back-home"),
  fightersCount: $("#fighters-count"),
  fighterCapacitySummary: $("#fighter-capacity-summary"),
  fighterRosterPanel: $("#fighter-roster-panel"),
  rosterCount: $("#roster-count"),
  rosterUpkeep: $("#roster-upkeep"),
  rosterNotice: $("#roster-notice"),
  fighterList: $("#fighter-list"),
  rosterEmpty: $("#roster-empty"),
  fighterDetailPanel: $("#fighter-detail-panel"),
  fighterBackList: $("#fighter-back-list"),
  fighterDetail: $("#fighter-detail"),
  viewportPreset: $("#viewport-preset"),
  turnNumber: $("#turn-number"),
  headerTierNumber: $("#header-tier-number"),
  sceneTierNumber: $("#scene-tier-number"),
  treasury: $("#treasury"),
  tierNumber: $("#tier-number"),
  tierProgress: $("#tier-progress"),
  tierProgressText: $("#tier-progress-text"),
  expenseTotal: $("#expense-total"),
  expenseToggle: $("#expense-toggle"),
  expenseDetails: $("#expense-details"),
  incomeTotal: $("#income-total"),
  incomeCard: $(".income-card"),
  incomeNote: $("#income-note"),
  forecast: $("#forecast"),
  forecastLabel: $("#forecast-label"),
  turnForecast: $("#turn-forecast"),
  turnNet: $("#turn-net"),
  endTurn: $("#end-turn"),
  endTurnLabel: $("#end-turn-label"),
  snapshotLabel: $("#snapshot-label"),
  snapshotCount: $("#snapshot-count"),
  snapshotSlider: $("#snapshot-slider"),
  previousSnapshot: $("#previous-snapshot"),
  nextSnapshot: $("#next-snapshot"),
  ledger: $("#ledger"),
};

const returnedManualBattleToken = new URLSearchParams(window.location.search).get("manualBattleResult");
let restoredManualBattle = false;
let engine = new SchoolManagementEngine(DEFAULT_MANAGEMENT_INPUT);
if (returnedManualBattleToken) {
  const storageKey = `gladiator-management-battle:${returnedManualBattleToken}`;
  try {
    const payload = JSON.parse(localStorage.getItem(storageKey) || "null");
    const battleResult = JSON.parse(localStorage.getItem(`${storageKey}:result`) || "null");
    if (payload?.managementSession && battleResult) {
      engine = SchoolManagementEngine.fromResult(payload.managementSession);
      engine.recordManualBattleResult(payload.offerId, payload.fighterId, battleResult.outcome);
      restoredManualBattle = true;
      localStorage.removeItem(storageKey);
      localStorage.removeItem(`${storageKey}:result`);
    }
  } catch (_error) {
    restoredManualBattle = false;
  }
  window.history.replaceState({}, "", window.location.pathname);
}
let viewedSnapshotIndex = engine.result().snapshots.length - 1;
let isEndingTurn = false;
let turnResolutionId = 0;
let selectedFighterId = null;
let renderedFighterState = null;
let activeManualBattle = null;

const END_TURN_LOADING_MS = 1250;
const MANUAL_BATTLE_STORAGE_PREFIX = "gladiator-management-battle:";

const number = new Intl.NumberFormat("ru-RU");
const money = (value) => number.format(value);
const signed = (value) => `${value >= 0 ? "+" : "−"}${money(Math.abs(value))}`;
const readInteger = (element) => Math.max(0, Math.round(Number(element.value) || 0));
const escapeHTML = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

const idleAnimationStyle = (fighterId) => {
  const hash = [...String(fighterId)].reduce(
    (value, character) => Math.imul(value ^ character.charCodeAt(0), 16777619) >>> 0,
    2166136261,
  );
  const duration = 2.65 + (hash % 8) * 0.09;
  const delay = -duration * (((hash >>> 5) % 100) / 100);
  return `--idle-duration:${duration.toFixed(2)}s;--idle-delay:${delay.toFixed(2)}s`;
};

const idleSpriteHTML = (fighter, { profile = false } = {}) => `
  <span class="fighter-idle-sprite ${profile ? "fighter-profile-sprite" : ""}"
    style="${idleAnimationStyle(fighter.id)}" ${profile ? `role="img" aria-label="${escapeHTML(fighter.name)}"` : 'aria-hidden="true"'}>
    <img class="fighter-idle-motion" src="${escapeHTML(fighter.idleSprite)}" alt="" />
  </span>
`;

const createInitialFighters = (totalUpkeep) => {
  const fighters = JSON.parse(JSON.stringify(DEFAULT_MANAGEMENT_INPUT.fighters));
  const defaultTotal = fighters.reduce((sum, fighter) => sum + fighter.upkeep, 0) || 1;
  let allocated = 0;
  return fighters.map((fighter, index) => {
    const upkeep = index === fighters.length - 1
      ? Math.max(0, totalUpkeep - allocated)
      : Math.round(totalUpkeep * fighter.upkeep / defaultTotal);
    allocated += upkeep;
    return { ...fighter, upkeep };
  });
};
const toRoman = (value) => {
  const roman = [
    [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"],
    [100, "C"], [90, "XC"], [50, "L"], [40, "XL"],
    [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
  ];
  let remaining = Math.max(1, Math.round(Number(value) || 1));
  return roman.reduce((result, [amount, symbol]) => {
    while (remaining >= amount) {
      result += symbol;
      remaining -= amount;
    }
    return result;
  }, "");
};

const currentResult = () => engine.result();

const SCHOOL_TIER_SCENES = Object.freeze({
  1: {
    src: "./assets/school-tier-1-courtyard-v4.png",
    alt: "Скромный двор школы гладиаторов первого уровня",
  },
  2: {
    src: "./assets/school-tier-2-courtyard-v1.png",
    alt: "Укреплённый и обустроенный двор школы гладиаторов второго уровня",
  },
  3: {
    src: "./assets/school-tier-3-courtyard-v1.png",
    alt: "Состоятельный двор школы гладиаторов третьего уровня",
  },
});

const isLatestSnapshot = () => viewedSnapshotIndex === currentResult().snapshots.length - 1;

const setEndTurnLoading = (loading) => {
  isEndingTurn = loading;
  elements.endTurn.classList.toggle("is-processing", loading);
  elements.endTurn.setAttribute("aria-busy", String(loading));
  elements.endTurn.disabled = loading
    || viewedSnapshotIndex !== currentResult().snapshots.length - 1;
  elements.fightersSection.disabled = true;
  elements.battlesSection.disabled = loading
    || viewedSnapshotIndex !== currentResult().snapshots.length - 1;
  elements.marketSection.disabled = true;
  elements.armorySection.disabled = true;
  elements.upgradesSection.disabled = loading
    || viewedSnapshotIndex !== currentResult().snapshots.length - 1;
  elements.medicineSection.disabled = true;
  elements.restSection.disabled = true;
  elements.battlesView.setAttribute("aria-busy", String(loading));
  elements.battleOfferList.querySelectorAll("[data-fighter-picker]").forEach((button) => {
    button.disabled = loading;
  });
  if (loading) {
    elements.battleOfferList.querySelectorAll("[data-fighter-picker-menu]").forEach((menu) => {
      menu.hidden = true;
    });
  }
  if (loading) {
    const assignedBattles = currentResult().state.battleOffers
      ?.filter(({ assignedFighterId }) => assignedFighterId).length || 0;
    elements.endTurnLabel.textContent = "ПРОХОДИТ ВРЕМЯ";
    elements.turnNet.textContent = assignedBattles
      ? `Автоматически проводим боёв: ${assignedBattles}`
      : "Подводим итоги школы…";
  }
};

const renderExpenseDetails = (expenses) => {
  elements.expenseDetails.innerHTML = expenses.map((expense) => `
    <div>
      <span>${expense.label}</span>
      <strong>−${money(expense.amount)}</strong>
    </div>
  `).join("");
};

const markerHTML = (label, kind) => `
  <span class="fighter-marker ${kind}">${escapeHTML(label)}</span>
`;

const equipmentClassMarkHTML = (classId) => {
  const classDefinition = currentResult().input.fighterClassCatalog
    .find(({ id }) => id === classId);
  return `<i class="equipment-class-mark" aria-hidden="true">${escapeHTML(classDefinition?.icon || "•")}</i>`;
};

const fighterClassLabelHTML = (classId, label) => classId
  ? `<span class="fighter-class-label equipment-class-${escapeHTML(classId)}">${equipmentClassMarkHTML(classId)}${escapeHTML(label)}</span>`
  : escapeHTML(label);

const renderFighterRoster = (state) => {
  renderedFighterState = state;
  const fighters = state.fighters || [];
  const capacity = state.fighterCapacity || fighters.length;
  const upkeep = fighters.reduce((sum, fighter) => sum + fighter.upkeep, 0);
  const countLabel = `${fighters.length}/${capacity}`;
  elements.fightersCount.textContent = countLabel;
  elements.fighterCapacitySummary.textContent = `${fighters.length} / ${capacity}`;
  elements.rosterCount.textContent = `${fighters.length} / ${capacity}`;
  elements.rosterUpkeep.textContent = `−${money(upkeep)} / ХОД`;
  elements.rosterEmpty.hidden = fighters.length > 0;
  elements.fighterList.hidden = fighters.length === 0;
  elements.fighterList.innerHTML = fighters.map((fighter) => {
    const markers = [
      ...fighter.perks.slice(0, 1).map((label) => markerHTML(label, "perk")),
      ...fighter.injuries.slice(0, 1).map((label) => markerHTML(label, "injury")),
    ].join("");
    return `
      <button class="fighter-card" type="button" data-fighter-id="${escapeHTML(fighter.id)}">
        <span class="fighter-card-portrait is-face">
          <img src="${escapeHTML(fighter.rosterPortrait || fighter.portrait)}" alt="" />
          ${fighter.trainingTurnsRemaining > 0 ? `
            <span class="fighter-training-badge">
              <img src="./assets/icons/hourglass-v1.png" alt="" />
              ${fighter.trainingTurnsRemaining} ХОД
            </span>
          ` : ""}
        </span>
        <span class="fighter-card-body">
          <span class="fighter-card-title">
            <strong>${escapeHTML(fighter.name)}</strong>
            <em>${fighterClassLabelHTML(fighter.fighterClass, fighter.classLabel)}</em>
          </span>
          <span class="fighter-condition">${escapeHTML(fighter.condition)}</span>
          <span class="fighter-card-markers">${markers || '<span class="fighter-marker neutral">Без травм</span>'}</span>
          <span class="fighter-card-economy">
            <span>ПОБЕДЫ <b>${fighter.wins}</b></span>
            <span>ОПЫТ <b>${fighter.experience}</b></span>
            <span>СОДЕРЖАНИЕ <b>−${money(fighter.upkeep)}</b></span>
            <span>ПРОДАЖА <b>+${money(engine.getFighterSalePrice(fighter))}</b></span>
          </span>
        </span>
        <span class="fighter-card-arrow" aria-hidden="true">›</span>
      </button>
    `;
  }).join("");
};

const renderFighterDetail = () => {
  const fighter = renderedFighterState?.fighters?.find(({ id }) => id === selectedFighterId);
  if (!fighter) {
    selectedFighterId = null;
    elements.fighterDetailPanel.hidden = true;
    elements.fighterRosterPanel.hidden = false;
    return;
  }
  const salePrice = engine.getFighterSalePrice(fighter);
  const currentTreasury = renderedFighterState.treasury;
  const assignedToBattle = renderedFighterState.battleOffers
    ?.some(({ assignedFighterId }) => assignedFighterId === fighter.id);
  const isTraining = fighter.trainingTurnsRemaining > 0;
  const treatment = renderedFighterState.treatmentOrders
    ?.find(({ fighterId }) => fighterId === fighter.id);
  const restOrder = renderedFighterState.restOrders
    ?.find(({ fighterId }) => fighterId === fighter.id);
  const canSell = isLatestSnapshot() && !isEndingTurn && !assignedToBattle && !isTraining && !treatment && !restOrder;
  const perks = fighter.perks.length
    ? fighter.perks.map((label) => markerHTML(label, "perk")).join("")
    : markerHTML("Нет постоянных перков", "neutral");
  const injuries = fighter.injuries.length
    ? fighter.injuries.map((label) => markerHTML(label, "injury")).join("")
    : markerHTML("Нет травм", "healthy");
  const specialization = !fighter.fighterClass ? `
      <section class="fighter-profile-section specialization-panel">
        <h3>НАЗНАЧИТЬ СПЕЦИАЛИЗАЦИЮ</h3>
        <p>Обучение оплачивается сразу. Выбор постоянный; после него бойцу понадобится подходящий комплект оружия и доспехов.</p>
        <div class="specialization-grid">
          ${currentResult().input.fighterClassCatalog.map((item) => `
            <button class="equipment-class-${escapeHTML(item.id)}" type="button" data-specialization-id="${escapeHTML(item.id)}" ${canSell && currentTreasury >= item.specializationPrice ? "" : "disabled"}>
              ${equipmentClassMarkHTML(item.id)}
              <span>${escapeHTML(item.label)}</span>
              <b class="specialization-price"><img src="./assets/icons/coins-v1.png" alt="" />${money(item.specializationPrice)}</b>
            </button>
          `).join("")}
        </div>
      </section>
  ` : "";
  elements.fighterDetail.innerHTML = `
    <article class="fighter-profile">
      <div class="fighter-profile-hero">
        ${fighter.idleSprite ? idleSpriteHTML(fighter, { profile: true }) : `<img src="${escapeHTML(fighter.portrait)}" alt="${escapeHTML(fighter.name)}" />`}
        ${isTraining ? `<span class="fighter-training-badge profile"><img src="./assets/icons/hourglass-v1.png" alt="" />${fighter.trainingTurnsRemaining} ХОД</span>` : ""}
        ${treatment ? `<span class="fighter-training-badge profile treatment"><img src="./assets/icons/medicine-v1.png" alt="" />${treatment.turnsRemaining} ${treatment.turnsRemaining === 1 ? "ХОД" : "ХОДА"}</span>` : ""}
        ${restOrder ? `<span class="fighter-training-badge profile resting"><img src="./assets/icons/rest-v1.png" alt="" />${restOrder.activityName}</span>` : ""}
        <div>
          <small>${fighterClassLabelHTML(fighter.fighterClass, fighter.classLabel)}</small>
          <h2>${escapeHTML(fighter.name)}</h2>
          <strong>${escapeHTML(fighter.condition)}</strong>
        </div>
      </div>

      <div class="fighter-profile-metrics">
        <span><small>ПОБЕДЫ</small><b>${fighter.wins}</b></span>
        <span><small>ОПЫТ</small><b>${fighter.experience}</b></span>
        <span><small>СОДЕРЖАНИЕ</small><b>−${money(fighter.upkeep)}</b></span>
        <span><small>ЦЕНА ПРОДАЖИ</small><b>+${money(salePrice)}</b></span>
      </div>

      ${specialization}

      <section class="fighter-profile-section">
        <h3>СНАРЯЖЕНИЕ</h3>
        <div class="equipment-slot">
          <span>ОРУЖИЕ</span>
          <strong>${escapeHTML(fighter.equipment.weapon.name)}</strong>
          <em>${escapeHTML(fighter.equipment.weapon.quality)}</em>
        </div>
        <div class="equipment-slot">
          <span>ДОСПЕХИ</span>
          <strong>${escapeHTML(fighter.equipment.armor.name)}</strong>
          <em>${escapeHTML(fighter.equipment.armor.quality)}</em>
        </div>
      </section>

      <section class="fighter-profile-section">
        <h3>ПОСТОЯННЫЕ ПЕРКИ</h3>
        <div class="fighter-detail-markers">${perks}</div>
      </section>

      <section class="fighter-profile-section">
        <h3>ТРАВМЫ</h3>
        <div class="fighter-detail-markers">${injuries}</div>
      </section>

      <section class="fighter-sale-block">
        <div><span>Цена покупки</span><strong>${money(fighter.purchasePrice)} HS</strong></div>
        <div><span>Текущая цена продажи</span><strong>+${money(salePrice)} HS</strong></div>
        <button id="sell-fighter" type="button" ${canSell ? "" : "disabled"}>ПРОДАТЬ БОЙЦА</button>
        ${canSell ? "" : `<small>${isTraining ? "Боец обучается: действия станут доступны на следующем ходу." : (treatment ? "Боец находится в Саниарии до окончания лечения." : (restOrder ? "Боец отдыхает и вернётся после завершения хода." : (assignedToBattle ? "Сначала снимите назначение бойца на бой." : "Продажа доступна только в текущем состоянии школы.")))}</small>`}
        <div class="sale-confirmation" id="sale-confirmation" hidden>
          <strong>Продать ${escapeHTML(fighter.name)}?</strong>
          <p>Боец будет удалён из состава без возможности отмены.</p>
          <div><span>Казна сейчас</span><b>${money(currentTreasury)} HS</b></div>
          <div><span>После продажи</span><b>${money(currentTreasury + salePrice)} HS</b></div>
          <span class="sale-confirmation-actions">
            <button id="cancel-fighter-sale" type="button">ОТМЕНА</button>
            <button id="confirm-fighter-sale" type="button">ПРОДАТЬ ЗА ${money(salePrice)}</button>
          </span>
        </div>
      </section>
    </article>
  `;
};

const renderBattlePage = (state) => {
  const offers = state.battleOffers || [];
  const fighters = state.fighters || [];
  const treatedFighterIds = new Set((state.treatmentOrders || []).map(({ fighterId }) => fighterId));
  const restingFighterIds = new Set((state.restOrders || []).map(({ fighterId }) => fighterId));
  const eligibleFighters = fighters.filter(({ id, fighterClass, trainingTurnsRemaining }) => (
    ["murmillo", "retiarius"].includes(fighterClass)
    && trainingTurnsRemaining <= 0
    && !treatedFighterIds.has(id)
    && !restingFighterIds.has(id)
  ));
  const assignedIds = new Set(offers.map(({ assignedFighterId }) => assignedFighterId).filter(Boolean));
  const assignedCount = assignedIds.size;
  elements.battleOffersCount.textContent = String(offers.filter(({ assignedFighterId }) => !assignedFighterId).length);
  elements.battleOfferSummary.textContent = String(offers.length);
  elements.battleCurrentTurn.textContent = String(state.turn);
  elements.battleAssignedSummary.textContent = `${assignedCount} / ${offers.length}`;
  elements.battleOfferList.innerHTML = offers.map((offer, index) => {
    const assignedFighter = fighters.find(({ id }) => id === offer.assignedFighterId);
    const fighterOptions = eligibleFighters.map((fighter) => {
      const usedElsewhere = assignedIds.has(fighter.id) && fighter.id !== offer.assignedFighterId;
      return `
        <button class="fighter-picker-option ${fighter.id === offer.assignedFighterId ? "is-selected" : ""}" type="button"
          data-assign-offer-id="${escapeHTML(offer.id)}" data-assign-fighter-id="${escapeHTML(fighter.id)}" ${usedElsewhere ? "disabled" : ""}>
          <span class="fighter-picker-portrait"><img src="${escapeHTML(fighter.rosterPortrait || fighter.portrait)}" alt="" /></span>
          <span class="fighter-picker-copy">
            <strong>${escapeHTML(fighter.name)}</strong>
            <small>${fighterClassLabelHTML(fighter.fighterClass, fighter.classLabel)}</small>
            <em>${escapeHTML(fighter.condition)}</em>
          </span>
          <b>${usedElsewhere ? "НАЗНАЧЕН" : (fighter.id === offer.assignedFighterId ? "✓" : "›")}</b>
        </button>
      `;
    }).join("");
    const levelMarks = Array.from({ length: 3 }, (_, levelIndex) => (
      `<i class="${levelIndex < offer.difficultyLevel ? "is-active" : ""}"></i>`
    )).join("");
    const lossReward = Math.round(offer.victoryReward * currentResult().input.battleRules.lossRewardRate);
    const manualOutcome = offer.manualResult?.outcome || null;
    const manualOutcomeLabel = manualOutcome === "victory"
      ? "ПОБЕДА"
      : manualOutcome === "defeat"
        ? "ПОРАЖЕНИЕ"
        : manualOutcome === "draw"
          ? "НИЧЬЯ"
          : null;
    const manualOutcomeNote = manualOutcome === "victory"
      ? "Соперник повержен · результат будет учтён в конце хода"
      : manualOutcome === "defeat"
        ? "Ваш боец проиграл · результат будет учтён в конце хода"
        : "Бой завершился без победителя · результат будет учтён в конце хода";
    const fighterCondition = offer.manualResult?.fighterCondition || null;
    const fighterConditionStatus = ["healthy", "injured", "dead"].includes(fighterCondition?.status)
      ? fighterCondition.status
      : "healthy";
    return `
      <article class="battle-offer-card difficulty-${escapeHTML(offer.difficultyId)} ${assignedFighter ? "is-assigned" : ""} ${manualOutcome ? `has-result ${manualOutcome}` : ""}">
        <header>
          <span>ПРЕДЛОЖЕНИЕ ${index + 1}</span>
          <b>${escapeHTML(offer.difficulty)}</b>
        </header>
        <div class="battle-offer-opponent">
          <span class="battle-opponent-portrait ${manualOutcome === "victory" ? "is-defeated" : ""}">
            <img class="battle-opponent-image" src="${escapeHTML(offer.opponentPortrait)}" alt="${escapeHTML(offer.opponentName)}" />
            ${manualOutcome === "victory" ? '<img class="battle-defeated-mark" src="./assets/icons/defeated-blood-cross-v1.png" alt="Соперник побеждён" />' : ""}
          </span>
          <div>
            <small>${escapeHTML(offer.arena)}</small>
            <strong>${escapeHTML(offer.opponentName)}</strong>
            <em>${escapeHTML(offer.opponentClass)}</em>
          </div>
          <b class="battle-versus-mark">VS</b>
        </div>
        <div class="battle-offer-level">
          <span><small>УРОВЕНЬ СОПЕРНИКА</small><strong>${offer.difficultyLevel} / 3</strong></span>
          <div>${levelMarks}</div>
        </div>
        <div class="battle-reward-outcomes">
          <div><strong>ПОБЕДА</strong><span class="battle-resource-value money"><img src="./assets/icons/coins-v1.png" alt="" />+${money(offer.victoryReward)}</span><span class="battle-resource-value experience"><img src="./assets/icons/experience-v1.png" alt="" />+${money(offer.victoryExperience)}</span></div>
          <div><strong>ПОРАЖЕНИЕ</strong><span class="battle-resource-value money"><img src="./assets/icons/coins-v1.png" alt="" />+${money(lossReward)}</span><span class="battle-resource-value experience"><img src="./assets/icons/experience-v1.png" alt="" />+${money(offer.defeatExperience)}</span></div>
        </div>
        <div class="battle-assignment">
          <span>ВАШ БОЕЦ</span>
          <button class="fighter-picker-trigger ${assignedFighter ? "has-fighter" : ""}" type="button"
            data-fighter-picker="${escapeHTML(offer.id)}" aria-expanded="false" ${isEndingTurn ? "disabled" : ""}>
            ${assignedFighter ? `
              <span class="fighter-picker-portrait"><img src="${escapeHTML(assignedFighter.rosterPortrait || assignedFighter.portrait)}" alt="" /></span>
              <span class="fighter-picker-copy"><strong>${escapeHTML(assignedFighter.name)}</strong><small>${fighterClassLabelHTML(assignedFighter.fighterClass, assignedFighter.classLabel)}</small><em>${escapeHTML(assignedFighter.condition)}</em></span>
            ` : `
              <span class="fighter-picker-empty-mark">+</span>
              <span class="fighter-picker-copy"><strong>Назначить бойца</strong><em>Открыть состав школы</em></span>
            `}
            <b class="fighter-picker-chevron">⌄</b>
          </button>
          <div class="fighter-picker-menu" data-fighter-picker-menu="${escapeHTML(offer.id)}" hidden>
            ${assignedFighter ? `<button class="fighter-picker-clear" type="button" data-assign-offer-id="${escapeHTML(offer.id)}" data-assign-fighter-id="">СНЯТЬ НАЗНАЧЕНИЕ</button>` : ""}
            ${fighterOptions || '<div class="fighter-picker-empty">Нет свободных Ретиариев или Мечников</div>'}
          </div>
        </div>
        <div class="battle-auto-note ${manualOutcome ? `is-result ${manualOutcome}` : assignedFighter ? "is-ready" : ""}">
          ${manualOutcome && assignedFighter ? `<img class="battle-result-fighter-icon" src="${escapeHTML(assignedFighter.rosterPortrait || assignedFighter.portrait)}" alt="${escapeHTML(assignedFighter.name)}" />` : ""}
          <div class="battle-result-copy">
            <strong>${manualOutcomeLabel || (assignedFighter ? `Боец: ${escapeHTML(assignedFighter.name)}` : "Назначьте бойца")}</strong>
            <span>${manualOutcome ? manualOutcomeNote : assignedFighter ? "Бой можно провести сейчас или рассчитать в конце хода" : "Без назначения бой не состоится"}</span>
            ${fighterCondition ? `<em class="battle-fighter-condition ${fighterConditionStatus}">СОСТОЯНИЕ: ${escapeHTML(fighterCondition.label)}</em>` : ""}
          </div>
        </div>
        <button class="manual-battle-button ${assignedFighter && !offer.manualResult ? "is-active" : ""}" type="button"
          data-manual-battle="${escapeHTML(offer.id)}" ${assignedFighter && !offer.manualResult && !isEndingTurn ? "" : "disabled"}>${offer.manualResult ? "✓ БОЙ ЗАВЕРШЁН" : "▣ ПРОВЕСТИ БОЙ"}</button>
        <small class="manual-battle-note">Сессия школы сохранится · после боя вы вернётесь к этому ходу</small>
      </article>
    `;
  }).join("");

  if (!offers.length) {
    elements.battleOfferList.innerHTML = '<div class="battle-offers-empty">На этом ходу предложений нет.</div>';
  }

  const results = state.lastBattleResults || [];
  elements.battleResultsList.innerHTML = results.length
    ? results.map((result) => `
      <article class="battle-result-card ${result.outcome}">
        <span class="battle-result-portrait battle-result-faces">
          <img src="${escapeHTML(result.fighterPortrait)}" alt="" />
          <img src="${escapeHTML(result.opponentPortrait)}" alt="" />
        </span>
        <div>
          <small>${result.outcome === "victory" ? "ПОБЕДА" : "ПОРАЖЕНИЕ"}</small>
          <strong>${escapeHTML(result.fighterName)} — ${escapeHTML(result.opponentName)}</strong>
          <p>${escapeHTML(result.summary)}</p>
          <em>${escapeHTML(result.arena)}</em>
        </div>
        <span class="battle-result-resources">
          <b><img src="./assets/icons/coins-v1.png" alt="" />+${money(result.reward)}</b>
          <b><img src="./assets/icons/experience-v1.png" alt="" />+${money(result.experience)}</b>
        </span>
      </article>
    `).join("")
    : '<div class="battle-results-empty">В прошлом ходу боёв не было.</div>';
};

const battleEquipmentQuality = (fighter, slot) => (
  fighter.equipment?.[slot]?.quality === "Хорошее" ? "good" : "common"
);

const battlePerkIds = (fighter) => {
  const perkMap = {
    "Крепкие кости": "strong-bones",
    "Любимец толпы": "crowd-favorite",
    "Лёгкая поступь": "light-footed",
    "Быстрая реакция": "turn-interceptor",
  };
  return (fighter.perks || []).map((perk) => perkMap[perk]).filter(Boolean);
};

const battleInjuryIds = (fighter) => (fighter.injuries || []).map((injury) => (
  injury.toLowerCase().includes("ног") ? "leg-damage"
    : injury.toLowerCase().includes("рук") ? "arm-damage"
      : null
)).filter(Boolean);

const battleArenaType = (arena) => ({
  "Малая арена": "sand",
  "Городские игры": "crowd",
  "Вечерние игры": "normal",
  "Военный праздник": "crowd",
}[arena] || "normal");

const createManualBattleInput = (offer, fighter) => {
  const playerClass = fighter.fighterClass === "retiarius" ? "retiarius" : "murmillo";
  const opponentClass = offer.combatArchetype === "retiarius" ? "retiarius" : "murmillo";
  const equipment = (fighterClass, weaponQuality = "good", armorQuality = "good") => ({
    weaponSet: { definitionId: `${fighterClass}-arms.${weaponQuality}` },
    armorSet: { definitionId: `${fighterClass}-armor.${armorQuality}` },
  });
  return {
    seed: `management-${offer.id}-${fighter.id}`,
    maxSteps: 80,
    arena: { type: battleArenaType(offer.arena), supportMultipliers: [1, 1] },
    fighters: [
      {
        id: "fighter-1",
        name: fighter.name,
        base: {
          strength: 50 + fighter.wins * 2 + Math.floor(fighter.experience / 6),
          health: playerClass === "murmillo" ? 220 : 195,
          charisma: 52 + fighter.wins * 3,
        },
        criticalChance: 0.03,
        classTechniqueChance: 0.1,
        fighterClass: playerClass,
        equipment: equipment(
          playerClass,
          battleEquipmentQuality(fighter, "weapon"),
          battleEquipmentQuality(fighter, "armor"),
        ),
        perks: battlePerkIds(fighter),
        buffs: [],
        buffLoadout: { buffDefinitionIds: ["rally", "forward", "now"] },
        injuries: battleInjuryIds(fighter),
      },
      {
        id: "fighter-2",
        name: offer.opponentName,
        base: {
          strength: 46 + offer.difficultyLevel * 8,
          health: (opponentClass === "murmillo" ? 205 : 180) + offer.difficultyLevel * 14,
          charisma: 48 + offer.difficultyLevel * 7,
        },
        criticalChance: 0.03,
        classTechniqueChance: 0.1,
        fighterClass: opponentClass,
        equipment: equipment(opponentClass),
        perks: offer.difficultyLevel === 3 ? ["cornered-beast"] : [],
        buffs: [],
        buffLoadout: { buffDefinitionIds: [] },
        injuries: [],
      },
    ],
  };
};

const launchManualBattle = (offerId) => {
  const state = currentResult().state;
  const offer = state.battleOffers.find(({ id }) => id === offerId);
  const fighter = state.fighters.find(({ id }) => id === offer?.assignedFighterId);
  if (!offer || !fighter) return;
  const token = globalThis.crypto?.randomUUID?.()
    || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const storageKey = `${MANUAL_BATTLE_STORAGE_PREFIX}${token}`;
  const payload = {
    offerId: offer.id,
    fighterId: fighter.id,
    returnLabel: "Вернуться в школу",
    input: createManualBattleInput(offer, fighter),
    managementSession: currentResult(),
  };
  try {
    localStorage.setItem(storageKey, JSON.stringify(payload));
  } catch (_error) {
    return;
  }
  const arenaUrl = new URL("../battle-arena/index.html", window.location.href);
  arenaUrl.searchParams.set("mobile", "1");
  arenaUrl.searchParams.set("managementBattle", token);
  activeManualBattle = { token, storageKey, offerId: offer.id, fighterId: fighter.id };
  document.body.classList.add("phone-battle-active");
  elements.battleOverlay.hidden = false;
  elements.gameScreen.setAttribute("aria-hidden", "true");
  elements.battleFrame.src = arenaUrl.href;
  window.requestAnimationFrame(() => {
    const phoneTop = elements.phone.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: Math.max(0, phoneTop - 12), behavior: "auto" });
  });
};

const closeManualBattleOverlay = () => {
  document.body.classList.remove("phone-battle-active");
  elements.battleOverlay.hidden = true;
  elements.gameScreen.removeAttribute("aria-hidden");
  elements.battleFrame.src = "about:blank";
  activeManualBattle = null;
};

const acceptManualBattleResult = (message) => {
  if (
    !activeManualBattle
    || message?.token !== activeManualBattle.token
    || !["victory", "defeat", "draw"].includes(message.outcome)
  ) return;
  try {
    engine.recordManualBattleResult(
      activeManualBattle.offerId,
      activeManualBattle.fighterId,
      message.outcome,
    );
    localStorage.removeItem(activeManualBattle.storageKey);
    localStorage.removeItem(`${activeManualBattle.storageKey}:result`);
    closeManualBattleOverlay();
    renderSnapshot(currentResult().snapshots.length - 1);
    showBattlesView();
  } catch (_error) {
    closeManualBattleOverlay();
  }
};

const showTurnSummary = (state) => {
  const summary = state.lastTurn;
  if (!summary) return;
  const results = state.lastBattleResults || [];
  elements.turnSummaryTitle.textContent = `ХОД ${summary.turn} ЗАВЕРШЁН`;
  const battleCards = results.map((result) => {
    const fighterWon = result.outcome === "victory";
    const opponentWon = result.outcome === "defeat";
    const condition = result.fighterCondition || { status: "healthy", label: "Без новых травм" };
    const conditionStatus = ["healthy", "injured", "dead"].includes(condition.status)
      ? condition.status
      : "healthy";
    return `
      <article class="turn-summary-battle ${result.outcome}">
        <div class="turn-summary-duel" aria-label="${escapeHTML(result.fighterName)} против ${escapeHTML(result.opponentName)}">
          <span class="turn-summary-combatant is-player ${fighterWon ? "is-winner" : opponentWon ? "is-loser" : "is-draw"}">
            <img class="turn-summary-avatar" src="${escapeHTML(result.fighterPortrait)}" alt="${escapeHTML(result.fighterName)}" />
            ${opponentWon ? '<img class="turn-summary-defeated-mark" src="./assets/icons/defeated-blood-cross-v1.png" alt="Боец повержен" />' : ""}
          </span>
          <i class="turn-summary-cross">×</i>
          <span class="turn-summary-combatant is-opponent ${opponentWon ? "is-winner" : fighterWon ? "is-loser" : "is-draw"}">
            <img class="turn-summary-avatar" src="${escapeHTML(result.opponentPortrait)}" alt="${escapeHTML(result.opponentName)}" />
            ${fighterWon ? '<img class="turn-summary-defeated-mark" src="./assets/icons/defeated-blood-cross-v1.png" alt="Соперник повержен" />' : ""}
          </span>
        </div>
        <div class="turn-summary-result-copy">
          <small>БОЙ</small>
          <strong>${result.outcome === "victory" ? "ПОБЕДА" : result.outcome === "draw" ? "НИЧЬЯ" : "ПОРАЖЕНИЕ"}</strong>
          <p>${escapeHTML(result.summary)}</p>
          <em class="turn-summary-fighter-condition ${conditionStatus}">СОСТОЯНИЕ БОЙЦА: ${escapeHTML(condition.label)}</em>
        </div>
        <div class="turn-summary-rewards">
          <b>+${money(result.reward)} HS</b>
          <span>+${money(result.schoolProgress || 0)} ОПЫТА</span>
        </div>
      </article>
    `;
  }).join("");
  elements.turnSummaryContent.innerHTML = `
    ${results.length ? `<section class="turn-summary-battles"><header><small>БОИ ПРОШЛОГО ХОДА</small><strong>${results.length}</strong></header>${battleCards}</section>` : ""}
    ${results.length ? `
      <section class="turn-summary-school-progress">
        <header><small>ОПЫТ ШКОЛЫ</small><strong>+${money(summary.tierProgressGained || 0)}</strong></header>
        <div><progress max="${state.tierProgressMax}" value="${summary.tierProgressAfter || 0}"></progress><b>${money(summary.tierProgressAfter || 0)}/${money(state.tierProgressMax)}</b></div>
        <p>${summary.tierUpgradeAvailable
          ? (state.treasury >= 0
            ? `Доступно повышение до уровня ${toRoman(state.tier + 1)} за ${money(summary.tierUpgradeCost)} HS.`
            : "Прогресс заполнен. Для повышения нужно выйти из долга.")
          : `До следующего уровня осталось ${money(Math.max(0, state.tierProgressMax - (summary.tierProgressAfter || 0)))} опыта.`}</p>
      </section>
    ` : ""}
    <section class="turn-summary-economy">
      <header><small>ЭКОНОМИКА</small><strong>${signed(summary.net)} HS</strong></header>
      <div><span>Заработано</span><b class="positive">+${money(summary.income)} HS</b></div>
      <div><span>Потрачено</span><b class="negative">−${money(summary.expenses)} HS</b></div>
      <div><span>Казна</span><b>${money(summary.balanceBefore)} → ${money(summary.balanceAfter)} HS</b></div>
    </section>
  `;
  elements.turnSummaryModal.hidden = false;
};

const closeTurnSummary = () => {
  elements.turnSummaryModal.hidden = true;
};

const renderMarketPage = (state) => {
  const offers = state.marketOffers || [];
  const atCapacity = state.fighters.length >= state.fighterCapacity;
  elements.marketOffersCount.textContent = String(offers.length);
  elements.marketOfferSummary.textContent = String(offers.length);
  elements.marketTreasury.textContent = `${money(state.treasury)} HS`;
  elements.marketCapacity.textContent = `${state.fighters.length} / ${state.fighterCapacity}`;
  elements.marketOfferList.innerHTML = offers.map((offer) => {
    const insufficient = state.treasury < offer.price;
    const disabled = insufficient || atCapacity || !isLatestSnapshot() || isEndingTurn;
    const label = atCapacity ? "НЕТ МЕСТА" : (insufficient ? "НЕ ХВАТАЕТ" : `КУПИТЬ · ${money(offer.price)}`);
    return `
      <article class="market-offer-card">
        <span class="market-portrait"><img src="${escapeHTML(offer.portrait)}" alt="${escapeHTML(offer.name)}" /></span>
        <div class="market-offer-copy">
          <small>РАБ · БЕЗ СПЕЦИАЛИЗАЦИИ</small>
          <strong>${escapeHTML(offer.name)}</strong>
          <span class="fighter-marker ${offer.perk ? "perk" : "neutral"}">${escapeHTML(offer.perk || "Без перка")}</span>
          <em>Содержание −${money(offer.upkeep)} / ход</em>
        </div>
        <button type="button" data-buy-market-offer="${escapeHTML(offer.id)}" ${disabled ? "disabled" : ""}>
          <img src="./assets/icons/coins-v1.png" alt="" />${label}
        </button>
      </article>
    `;
  }).join("") || '<div class="commerce-empty">На этом ходу торговля окончена. Новые кандидаты появятся после завершения хода.</div>';
};

const renderArmoryPage = (state) => {
  const catalog = currentResult().input.armoryCatalog || [];
  const orders = state.craftOrders || [];
  const inventory = state.inventory || [];
  elements.armoryOrdersHomeCount.textContent = String(orders.length);
  elements.armoryOrderSummary.textContent = String(orders.length);
  elements.armoryTreasury.textContent = `${money(state.treasury)} HS`;
  elements.armoryOrdersCount.textContent = String(orders.length);
  elements.armoryCatalogList.innerHTML = catalog.map((item) => {
    const insufficient = state.treasury < item.price;
    const readyLabel = item.craftTurns === 0 ? "СРАЗУ" : `${item.craftTurns} ${item.craftTurns === 1 ? "ХОД" : "ХОДА"}`;
    return `
      <article class="armory-item-card equipment-class-${escapeHTML(item.classId)} equipment-quality-${escapeHTML(item.quality)}">
        <span class="armory-item-icon"><img src="${escapeHTML(item.icon || "./assets/icons/armory-v1.png")}" alt="" /></span>
        <div><small>${equipmentClassMarkHTML(item.classId)}${escapeHTML(item.classLabel)} · ${escapeHTML(item.slotLabel)}</small><strong>${escapeHTML(item.name)}</strong><span><em>${escapeHTML(item.qualityLabel)}</em><b>${readyLabel}</b></span></div>
        <button type="button" data-buy-armory-item="${escapeHTML(item.id)}" ${insufficient || !isLatestSnapshot() || isEndingTurn ? "disabled" : ""}><img src="./assets/icons/coins-v1.png" alt="" />${insufficient ? "НЕ ХВАТАЕТ" : money(item.price)}</button>
      </article>
    `;
  }).join("");
  elements.armoryOrdersList.innerHTML = orders.map((order) => `
    <div class="armory-stock-row order equipment-class-${escapeHTML(order.item.classId)} equipment-quality-${escapeHTML(order.item.quality)}"><span><small>${equipmentClassMarkHTML(order.item.classId)}${escapeHTML(order.item.classLabel)} · ${escapeHTML(order.item.slotLabel)}</small><strong>${escapeHTML(order.item.name)}</strong></span><b>${order.turnsRemaining} ${order.turnsRemaining === 1 ? "ХОД" : "ХОДА"}</b></div>
  `).join("") || '<div class="commerce-empty">Активных заказов нет.</div>';
  elements.armoryInventoryList.innerHTML = inventory.map((item) => `
    <div class="armory-stock-row equipment-class-${escapeHTML(item.classId)} equipment-quality-${escapeHTML(item.quality)}"><span><small>${equipmentClassMarkHTML(item.classId)}${escapeHTML(item.classLabel)} · ${escapeHTML(item.slotLabel)}</small><strong>${escapeHTML(item.name)}</strong></span><b>ГОТОВО</b></div>
  `).join("") || '<div class="commerce-empty">Склад пока пуст.</div>';
};

const renderSchoolUpgradesPage = (state) => {
  const result = currentResult();
  const maxTier = result.input.tierRules.maxTier || 3;
  const currentTier = state.tier;
  const nextTier = Math.min(maxTier, currentTier + 1);
  const tierProgress = Math.min(state.tierProgress, state.tierProgressMax);
  const progressPercent = Math.round(tierProgress / state.tierProgressMax * 100);
  const remainingProgress = Math.max(0, state.tierProgressMax - tierProgress);
  const price = Math.round(
    result.input.tierRules.upgradeBaseCost
    * (1 + (currentTier - 1) * result.input.tierRules.upgradeCostGrowth),
  );
  const atMaxTier = currentTier >= maxTier;
  const displayedTierProgress = atMaxTier ? state.tierProgressMax : tierProgress;
  const progressReady = tierProgress >= state.tierProgressMax;
  const blockedByDebt = state.treasury < 0;
  const disabled = atMaxTier || !progressReady || blockedByDebt || !isLatestSnapshot() || isEndingTurn;
  const buttonLabel = atMaxTier
    ? "ДОСТИГНУТ МАКСИМАЛЬНЫЙ УРОВЕНЬ"
    : blockedByDebt
      ? "НЕДОСТУПНО · ШКОЛА В ДОЛГУ"
      : !progressReady
        ? `НУЖНО ЕЩЁ ${remainingProgress} ОПЫТА`
        : `ПОВЫСИТЬ ДО УРОВНЯ ${toRoman(nextTier)} · ${money(price)} HS`;
  elements.schoolUpgradesHomeCount.textContent = toRoman(currentTier);
  elements.schoolUpgradesSummary.textContent = toRoman(currentTier);
  elements.schoolUpgradesTreasury.textContent = `${money(state.treasury)} HS`;
  elements.schoolUpgradesOrdersCount.textContent = toRoman(currentTier);
  elements.schoolUpgradeList.innerHTML = `
    <article class="school-upgrade-card school-tier-upgrade-card ${atMaxTier ? "is-max-tier" : ""}">
      <div class="school-tier-special-mark"><img src="./assets/icons/school-tier-v1.png" alt="" /><span><small>ОСОБОЕ УЛУЧШЕНИЕ</small><strong>УРОВЕНЬ ВСЕЙ ШКОЛЫ</strong></span></div>
      <div class="school-tier-transition" aria-label="${atMaxTier ? `Текущий максимальный уровень ${toRoman(currentTier)}` : `Переход с уровня ${toRoman(currentTier)} на уровень ${toRoman(nextTier)}`}">
        <span class="school-tier-transition-current"><small>ТЕКУЩИЙ</small><b>${toRoman(currentTier)}</b></span>
        ${atMaxTier ? '<i class="school-tier-max-mark">МАКСИМУМ</i>' : `
          <i class="school-tier-transition-arrow" aria-hidden="true">→</i>
          <span class="school-tier-transition-next"><small>СЛЕДУЮЩИЙ</small><b>${toRoman(nextTier)}</b></span>
        `}
      </div>
      <div class="school-upgrade-copy school-tier-upgrade-copy">
        <small>LUDUS MAGNUS</small>
        <strong>${atMaxTier ? `ШКОЛА · УРОВЕНЬ ${toRoman(currentTier)}` : `ШКОЛА · ${toRoman(currentTier)} → ${toRoman(nextTier)}`}</strong>
        <p>${atMaxTier ? "Школа достигла последнего доступного уровня прототипа." : "Главное развитие людуса: укрепляет школу и увеличивает вместимость состава."}</p>
      </div>
      <div class="school-tier-progress-block">
        <span><small>ОПЫТ ШКОЛЫ</small><b>${atMaxTier ? "ЗАВЕРШЕНО" : `${tierProgress}/${state.tierProgressMax}`}</b></span>
        <progress max="${state.tierProgressMax}" value="${displayedTierProgress}" aria-label="Опыт школы для повышения уровня"></progress>
        <em>${atMaxTier ? "МАКСИМУМ" : progressReady ? "ГОТОВО К ПОВЫШЕНИЮ" : `${progressPercent}%`}</em>
      </div>
      <div class="school-upgrade-costs school-tier-upgrade-benefits">
        <span><small>ЦЕНА ПЕРЕХОДА</small><b><img src="./assets/icons/coins-v1.png" alt="" />${atMaxTier ? "—" : `${money(price)} HS`}</b></span>
        <span><small>ВМЕСТИМОСТЬ</small><b>${state.fighterCapacity}${atMaxTier ? "" : ` → ${state.fighterCapacity + result.input.tierRules.fighterCapacityPerTier}`}</b></span>
      </div>
      <button type="button" data-upgrade-school-tier ${disabled ? "disabled" : ""}>${buttonLabel}</button>
    </article>
  `;
};

const renderMedicinePage = (state) => {
  const orders = state.treatmentOrders || [];
  const injured = (state.fighters || []).filter(({ injuries }) => injuries.length > 0);
  const candidates = injured.filter(({ id }) => !orders.some(({ fighterId }) => fighterId === id));
  const level = state.schoolUpgrades?.saniarium?.level || 1;
  const capacity = level;
  const duration = currentResult().input.treatmentTurns || 2;
  const hasFreeSlot = orders.length < capacity;
  elements.medicineHomeCount.textContent = String(injured.length);
  elements.medicineInjuredSummary.textContent = String(injured.length);
  elements.medicineLevel.textContent = toRoman(level);
  elements.medicineCapacity.textContent = `${orders.length} / ${capacity}`;
  elements.medicineDuration.textContent = `${duration} ${duration === 1 ? "ХОД" : "ХОДА"}`;
  elements.medicineSlotList.innerHTML = Array.from({ length: capacity }, (_, index) => {
    const order = orders[index];
    if (!order) {
      return `
        <button class="medicine-slot is-empty" type="button" data-treatment-drop ${!hasFreeSlot || !candidates.length || !isLatestSnapshot() || isEndingTurn ? "disabled" : ""}>
          <span>+</span><strong>СВОБОДНАЯ ЯЧЕЙКА</strong><small>${candidates.length ? "ВЫБЕРИТЕ РАНЕНОГО НИЖЕ" : "НЕТ РАНЕНЫХ БОЙЦОВ"}</small>
        </button>
      `;
    }
    const fighter = state.fighters.find(({ id }) => id === order.fighterId);
    if (!fighter) return "";
    const progress = Math.round((1 - order.turnsRemaining / order.totalTurns) * 100);
    return `
      <article class="medicine-slot is-occupied">
        <span class="medicine-slot-portrait"><img src="${escapeHTML(fighter.rosterPortrait || fighter.portrait)}" alt="" /><i><img src="./assets/icons/hourglass-v1.png" alt="" /></i></span>
        <div><small>ЯЧЕЙКА ${index + 1} · ЛЕЧЕНИЕ</small><strong>${escapeHTML(fighter.name)}</strong><em>${escapeHTML(order.injuries.join(" · "))}</em></div>
        <b>${order.turnsRemaining} ${order.turnsRemaining === 1 ? "ХОД" : "ХОДА"}</b>
        <span class="medicine-treatment-progress"><i style="width:${progress}%"></i></span>
      </article>
    `;
  }).join("");
  elements.medicineCandidateList.innerHTML = candidates.map((fighter) => {
    const unavailable = !hasFreeSlot || fighter.trainingTurnsRemaining > 0
      || state.battleOffers.some(({ assignedFighterId }) => assignedFighterId === fighter.id)
      || (state.restOrders || []).some(({ fighterId }) => fighterId === fighter.id)
      || !isLatestSnapshot() || isEndingTurn;
    return `
      <article class="medicine-candidate" draggable="${unavailable ? "false" : "true"}" data-treatment-fighter="${escapeHTML(fighter.id)}">
        <span><img src="${escapeHTML(fighter.rosterPortrait || fighter.portrait)}" alt="" /></span>
        <div><small>${escapeHTML(fighter.classLabel)}</small><strong>${escapeHTML(fighter.name)}</strong><em>${fighter.injuries.map(escapeHTML).join(" · ")}</em></div>
        <button type="button" data-start-treatment="${escapeHTML(fighter.id)}" ${unavailable ? "disabled" : ""}>${hasFreeSlot ? "ЛЕЧИТЬ" : "НЕТ МЕСТ"}</button>
      </article>
    `;
  }).join("") || '<div class="commerce-empty medicine-empty">Все раненые уже лечатся или бойцы здоровы.</div>';
};

const renderRestPage = (state) => {
  const catalog = (currentResult().input.restActivityCatalog || [])
    .filter(({ requiredTier }) => requiredTier <= state.tier);
  const orders = state.restOrders || [];
  const busyIds = new Set([
    ...orders.map(({ fighterId }) => fighterId),
    ...(state.treatmentOrders || []).map(({ fighterId }) => fighterId),
    ...(state.battleOffers || []).map(({ assignedFighterId }) => assignedFighterId).filter(Boolean),
    ...(state.fighters || []).filter(({ trainingTurnsRemaining }) => trainingTurnsRemaining > 0).map(({ id }) => id),
  ]);
  const freeFighters = (state.fighters || []).filter(({ id }) => !busyIds.has(id));
  const activeExpenses = orders.reduce((sum, { price }) => sum + price, 0);
  elements.restHomeCount.textContent = String(orders.length);
  elements.restActiveSummary.textContent = String(orders.length);
  elements.restTreasury.textContent = `${money(state.treasury)} HS`;
  elements.restExpenses.textContent = `−${money(activeExpenses)} HS`;
  elements.restActivityList.innerHTML = catalog.map((activity) => {
    const activityOrders = orders.filter(({ activityId }) => activityId === activity.id);
    const slots = Array.from({ length: activity.capacity }, (_, index) => {
      const order = activityOrders[index];
      if (!order) return '<div class="rest-slot is-empty"><span>+</span><small>СВОБОДНО</small></div>';
      const fighter = state.fighters.find(({ id }) => id === order.fighterId);
      if (!fighter) return "";
      return `
        <div class="rest-slot is-occupied">
          <span><img src="${escapeHTML(fighter.rosterPortrait || fighter.portrait)}" alt="" /></span>
          <div><small>${escapeHTML(fighter.classLabel)}</small><strong>${escapeHTML(fighter.name)}</strong><em>${order.turnsRemaining} ${order.turnsRemaining === 1 ? "ХОД" : "ХОДА"}</em></div>
        </div>
      `;
    }).join("");
    return `
      <article class="rest-activity-card">
        <header><div><small>${escapeHTML(activity.latinName)}</small><strong>${escapeHTML(activity.name)}</strong></div><b>${activityOrders.length} / ${activity.capacity}</b></header>
        <p>${escapeHTML(activity.description)}</p>
        <div class="rest-activity-meta">
          <span><small>ЦЕНА</small><b><img src="./assets/icons/coins-v1.png" alt="" />${money(activity.price)} HS</b></span>
          <span><small>СРОК</small><b><img src="./assets/icons/hourglass-v1.png" alt="" />${activity.turns} ${activity.turns === 1 ? "ХОД" : "ХОДА"}</b></span>
        </div>
        <div class="rest-slot-list">${slots}</div>
      </article>
    `;
  }).join("");
  elements.restFighterList.innerHTML = freeFighters.map((fighter) => `
    <article class="rest-fighter-card">
      <span><img src="${escapeHTML(fighter.rosterPortrait || fighter.portrait)}" alt="" /></span>
      <div><small>${escapeHTML(fighter.classLabel)}</small><strong>${escapeHTML(fighter.name)}</strong><em>${escapeHTML(fighter.condition)}</em></div>
      <div class="rest-choice-list">
        ${catalog.map((activity) => {
          const occupied = orders.filter(({ activityId }) => activityId === activity.id).length;
          const disabled = occupied >= activity.capacity || state.treasury < activity.price || !isLatestSnapshot() || isEndingTurn;
          return `<button type="button" data-start-rest="${escapeHTML(fighter.id)}" data-rest-activity="${escapeHTML(activity.id)}" ${disabled ? "disabled" : ""}>${escapeHTML(activity.name)} <b>${money(activity.price)}</b></button>`;
        }).join("")}
      </div>
    </article>
  `).join("") || '<div class="commerce-empty">Сейчас нет свободных бойцов.</div>';
};

const showFighterRoster = () => {
  selectedFighterId = null;
  elements.fighterDetailPanel.hidden = true;
  elements.fighterRosterPanel.hidden = false;
  elements.gameScreen.scrollTop = 0;
};

const showHomeView = () => {
  selectedFighterId = null;
  elements.fightersView.hidden = true;
  elements.battlesView.hidden = true;
  elements.marketView.hidden = true;
  elements.armoryView.hidden = true;
  elements.upgradesView.hidden = true;
  elements.medicineView.hidden = true;
  elements.restView.hidden = true;
  elements.schoolHomeView.hidden = false;
  elements.gameScreen.scrollTop = 0;
};

const showFightersView = () => {
  if (!isLatestSnapshot() || isEndingTurn) return;
  elements.schoolHomeView.hidden = true;
  elements.battlesView.hidden = true;
  elements.marketView.hidden = true;
  elements.armoryView.hidden = true;
  elements.upgradesView.hidden = true;
  elements.medicineView.hidden = true;
  elements.restView.hidden = true;
  elements.fightersView.hidden = false;
  elements.rosterNotice.hidden = true;
  renderFighterRoster(currentResult().state);
  showFighterRoster();
};

const showBattlesView = () => {
  if (!isLatestSnapshot() || isEndingTurn) return;
  elements.schoolHomeView.hidden = true;
  elements.fightersView.hidden = true;
  elements.marketView.hidden = true;
  elements.armoryView.hidden = true;
  elements.upgradesView.hidden = true;
  elements.medicineView.hidden = true;
  elements.restView.hidden = true;
  elements.battlesView.hidden = false;
  renderBattlePage(currentResult().state);
  elements.gameScreen.scrollTop = 0;
};

const showMarketView = () => {
  if (!isLatestSnapshot() || isEndingTurn) return;
  elements.schoolHomeView.hidden = true;
  elements.fightersView.hidden = true;
  elements.battlesView.hidden = true;
  elements.armoryView.hidden = true;
  elements.upgradesView.hidden = true;
  elements.medicineView.hidden = true;
  elements.restView.hidden = true;
  elements.marketView.hidden = false;
  elements.marketNotice.hidden = true;
  renderMarketPage(currentResult().state);
  elements.gameScreen.scrollTop = 0;
};

const showArmoryView = () => {
  if (!isLatestSnapshot() || isEndingTurn) return;
  elements.schoolHomeView.hidden = true;
  elements.fightersView.hidden = true;
  elements.battlesView.hidden = true;
  elements.marketView.hidden = true;
  elements.upgradesView.hidden = true;
  elements.medicineView.hidden = true;
  elements.restView.hidden = true;
  elements.armoryView.hidden = false;
  elements.armoryNotice.hidden = true;
  renderArmoryPage(currentResult().state);
  elements.gameScreen.scrollTop = 0;
};

const showUpgradesView = () => {
  if (!isLatestSnapshot() || isEndingTurn) return;
  elements.schoolHomeView.hidden = true;
  elements.fightersView.hidden = true;
  elements.battlesView.hidden = true;
  elements.marketView.hidden = true;
  elements.armoryView.hidden = true;
  elements.medicineView.hidden = true;
  elements.restView.hidden = true;
  elements.upgradesView.hidden = false;
  elements.schoolUpgradesNotice.hidden = true;
  renderSchoolUpgradesPage(currentResult().state);
  elements.gameScreen.scrollTop = 0;
};

const showMedicineView = () => {
  if (!isLatestSnapshot() || isEndingTurn) return;
  elements.schoolHomeView.hidden = true;
  elements.fightersView.hidden = true;
  elements.battlesView.hidden = true;
  elements.marketView.hidden = true;
  elements.armoryView.hidden = true;
  elements.upgradesView.hidden = true;
  elements.restView.hidden = true;
  elements.medicineView.hidden = false;
  elements.medicineNotice.hidden = true;
  renderMedicinePage(currentResult().state);
  elements.gameScreen.scrollTop = 0;
};

const showRestView = () => {
  if (!isLatestSnapshot() || isEndingTurn) return;
  elements.schoolHomeView.hidden = true;
  elements.fightersView.hidden = true;
  elements.battlesView.hidden = true;
  elements.marketView.hidden = true;
  elements.armoryView.hidden = true;
  elements.upgradesView.hidden = true;
  elements.medicineView.hidden = true;
  elements.restView.hidden = false;
  elements.restNotice.hidden = true;
  renderRestPage(currentResult().state);
  elements.gameScreen.scrollTop = 0;
};

const renderLedger = (result, eventSequence) => {
  const events = result.events.filter((event) => event.sequence <= eventSequence).slice(-8).reverse();
  if (!events.length) {
    elements.ledger.innerHTML = '<p class="ledger-empty">Завершите первый ход — здесь появятся операции казны.</p>';
    return;
  }
  elements.ledger.innerHTML = events.map((event) => `
    <div class="ledger-row ${event.amount >= 0 ? "positive" : "negative"}">
      <span><small>Ход ${event.turn}</small>${event.label}</span>
      <strong>${signed(event.amount)}</strong>
      <em>${money(event.balanceBefore)} → ${money(event.balanceAfter)}</em>
    </div>
  `).join("");
};

const renderSnapshot = (index, { animate = false } = {}) => {
  const result = currentResult();
  const snapshot = result.snapshots[index];
  if (!snapshot) return;
  viewedSnapshotIndex = index;

  const { state, economy } = snapshot;
  const incomeKnown = economy.incomeKnown !== false;
  const net = incomeKnown ? economy.income - economy.expenseTotal : null;
  const tierRoman = toRoman(state.tier);
  const tierProgress = Math.min(state.tierProgressMax, state.tierProgress);
  elements.turnNumber.textContent = `ХОД ${state.turn}`;
  elements.headerTierNumber.textContent = tierRoman;
  elements.sceneTierNumber.textContent = tierRoman;
  const tierScene = SCHOOL_TIER_SCENES[Math.min(3, state.tier)] || SCHOOL_TIER_SCENES[3];
  elements.schoolSceneImage.src = tierScene.src;
  elements.schoolSceneImage.alt = tierScene.alt;
  elements.schoolScene.setAttribute("aria-label", `Двор школы ${state.tier} уровня`);
  elements.treasury.textContent = money(state.treasury);
  elements.tierNumber.textContent = tierRoman;
  elements.tierProgress.max = state.tierProgressMax;
  elements.tierProgress.value = tierProgress;
  elements.tierProgressText.textContent = `${tierProgress}/${state.tierProgressMax}`;
  elements.expenseTotal.textContent = `−${money(economy.expenseTotal)}`;
  elements.incomeTotal.textContent = incomeKnown ? `+${money(economy.income)}` : "?";
  elements.incomeNote.textContent = incomeKnown
    ? (economy.income > 0 ? "Известный доход текущего хода" : "Бойцы пока не назначены")
    : "Зависит от результатов назначенных боёв";
  elements.incomeCard.classList.toggle("is-unknown", !incomeKnown);
  elements.forecast.textContent = incomeKnown ? money(economy.forecastTreasury) : "?";
  elements.forecastLabel.textContent = incomeKnown ? "После расчёта хода" : "После автобоёв и расходов";
  elements.turnNet.textContent = incomeKnown
    ? `Казна изменится на ${signed(net)}`
    : "Итог зависит от результатов боёв";
  elements.snapshotLabel.textContent = snapshot.label;
  elements.snapshotCount.textContent = `${result.snapshots.length} ${result.snapshots.length === 1 ? "снимок" : "снимка"}`;
  elements.snapshotSlider.max = String(result.snapshots.length - 1);
  elements.snapshotSlider.value = String(index);
  elements.previousSnapshot.disabled = index === 0;
  elements.nextSnapshot.disabled = index === result.snapshots.length - 1;
  elements.turnForecast.classList.toggle("is-debt", incomeKnown && economy.forecastTreasury < 0);
  elements.turnForecast.classList.toggle("is-unknown", !incomeKnown);
  elements.endTurn.disabled = isEndingTurn || index !== result.snapshots.length - 1;
  elements.fightersSection.disabled = true;
  elements.battlesSection.disabled = isEndingTurn || index !== result.snapshots.length - 1;
  elements.marketSection.disabled = true;
  elements.armorySection.disabled = true;
  elements.upgradesSection.disabled = isEndingTurn || index !== result.snapshots.length - 1;
  elements.medicineSection.disabled = true;
  elements.restSection.disabled = true;
  if (!isEndingTurn) {
    elements.endTurnLabel.textContent = index === result.snapshots.length - 1
      ? "КОНЕЦ ХОДА"
      : "ПРОСМОТР ИСТОРИИ";
  }
  renderExpenseDetails(economy.expenses);
  renderLedger(result, snapshot.eventSequence);
  renderFighterRoster(state);
  renderBattlePage(state);
  renderMarketPage(state);
  renderArmoryPage(state);
  renderSchoolUpgradesPage(state);
  renderMedicinePage(state);
  renderRestPage(state);
  if (!elements.fighterDetailPanel.hidden) renderFighterDetail();

  if (animate) {
    elements.treasury.classList.remove("value-changed");
    void elements.treasury.offsetWidth;
    elements.treasury.classList.add("value-changed");
  }
};

const resetEngine = () => {
  turnResolutionId += 1;
  isEndingTurn = false;
  engine = new SchoolManagementEngine({
    initialTreasury: readInteger(elements.initialTreasury),
    tier: Math.max(1, readInteger(elements.initialTier)),
    fighterCapacity: Math.max(2, readInteger(elements.fighterCapacity)),
    incomePerTurn: readInteger(elements.income),
    battleOffersEnabled: true,
    marketEnabled: true,
    armoryEnabled: true,
    schoolUpgradesEnabled: true,
    medicineEnabled: true,
    restEnabled: true,
    expenses: [
      { id: "food", label: "Еда", amount: readInteger(elements.food) },
      { id: "medicine", label: "Лечение", amount: readInteger(elements.medicine) },
    ],
    fighters: createInitialFighters(readInteger(elements.wages)),
  });
  elements.expenseToggle.setAttribute("aria-expanded", "false");
  elements.expenseDetails.hidden = true;
  elements.endTurn.classList.remove("is-processing");
  elements.endTurn.setAttribute("aria-busy", "false");
  elements.rosterNotice.hidden = true;
  showHomeView();
  renderSnapshot(0);
};

elements.form.addEventListener("submit", (event) => {
  event.preventDefault();
  resetEngine();
});

elements.expenseToggle.addEventListener("click", () => {
  const expanded = elements.expenseToggle.getAttribute("aria-expanded") === "true";
  elements.expenseToggle.setAttribute("aria-expanded", String(!expanded));
  elements.expenseDetails.hidden = expanded;
});

elements.fightersSection.addEventListener("click", showFightersView);
elements.battlesSection.addEventListener("click", showBattlesView);
elements.marketSection.addEventListener("click", showMarketView);
elements.armorySection.addEventListener("click", showArmoryView);
elements.upgradesSection.addEventListener("click", showUpgradesView);
elements.medicineSection.addEventListener("click", showMedicineView);
elements.restSection.addEventListener("click", showRestView);
elements.fightersBackHome.addEventListener("click", showHomeView);
elements.battlesBackHome.addEventListener("click", showHomeView);
elements.marketBackHome.addEventListener("click", showHomeView);
elements.armoryBackHome.addEventListener("click", showHomeView);
elements.upgradesBackHome.addEventListener("click", showHomeView);
elements.medicineBackHome.addEventListener("click", showHomeView);
elements.restBackHome.addEventListener("click", showHomeView);
elements.fighterBackList.addEventListener("click", showFighterRoster);

elements.fighterList.addEventListener("click", (event) => {
  const card = event.target.closest("[data-fighter-id]");
  if (!card) return;
  selectedFighterId = card.dataset.fighterId;
  elements.fighterRosterPanel.hidden = true;
  elements.fighterDetailPanel.hidden = false;
  renderFighterDetail();
  elements.gameScreen.scrollTop = 0;
});

elements.fighterDetail.addEventListener("click", (event) => {
  const specialization = event.target.closest("[data-specialization-id]");
  if (specialization && selectedFighterId && isLatestSnapshot() && !isEndingTurn) {
    engine.assignFighterSpecialization(selectedFighterId, specialization.dataset.specializationId);
    renderSnapshot(currentResult().snapshots.length - 1, { animate: true });
    renderFighterDetail();
    return;
  }
  if (event.target.closest("#sell-fighter")) {
    const confirmation = $("#sale-confirmation");
    if (confirmation) confirmation.hidden = false;
    return;
  }
  if (event.target.closest("#cancel-fighter-sale")) {
    const confirmation = $("#sale-confirmation");
    if (confirmation) confirmation.hidden = true;
    return;
  }
  if (!event.target.closest("#confirm-fighter-sale") || !selectedFighterId || !isLatestSnapshot()) return;
  const sale = engine.sellFighter(selectedFighterId);
  const result = currentResult();
  renderSnapshot(result.snapshots.length - 1, { animate: true });
  showFighterRoster();
  elements.rosterNotice.textContent = `${sale.fighter.name} продан: +${money(sale.salePrice)} HS`;
  elements.rosterNotice.hidden = false;
});

elements.marketOfferList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-buy-market-offer]");
  if (!button || button.disabled || !isLatestSnapshot() || isEndingTurn) return;
  const purchase = engine.purchaseMarketOffer(button.dataset.buyMarketOffer);
  renderSnapshot(currentResult().snapshots.length - 1, { animate: true });
  elements.marketNotice.textContent = `${purchase.fighter.name} куплен. Назначьте ему специализацию в разделе бойцов.`;
  elements.marketNotice.hidden = false;
});

elements.armoryCatalogList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-buy-armory-item]");
  if (!button || button.disabled || !isLatestSnapshot() || isEndingTurn) return;
  const purchase = engine.purchaseArmoryItem(button.dataset.buyArmoryItem);
  renderSnapshot(currentResult().snapshots.length - 1, { animate: true });
  elements.armoryNotice.textContent = purchase.order
    ? `${purchase.item.name}: заказ принят.`
    : `${purchase.item.name}: сразу добавлен на склад.`;
  elements.armoryNotice.hidden = false;
});

elements.schoolUpgradeList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-upgrade-school-tier]");
  if (!button || button.disabled || !isLatestSnapshot() || isEndingTurn) return;
  engine.upgradeTier();
  renderSnapshot(currentResult().snapshots.length - 1, { animate: true });
  elements.schoolUpgradesNotice.textContent = `Школа повышена до уровня ${toRoman(currentResult().state.tier)}.`;
  elements.schoolUpgradesNotice.hidden = false;
});

const startTreatmentFromMedicine = (fighterId) => {
  if (!fighterId || !isLatestSnapshot() || isEndingTurn) return;
  const treatment = engine.startTreatment(fighterId);
  renderSnapshot(currentResult().snapshots.length - 1);
  elements.medicineNotice.textContent = `${treatment.fighter.name} помещён в Саниарий. Лечение займёт ${treatment.order.totalTurns} хода.`;
  elements.medicineNotice.hidden = false;
};

elements.medicineCandidateList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-start-treatment]");
  if (!button || button.disabled) return;
  startTreatmentFromMedicine(button.dataset.startTreatment);
});

elements.medicineCandidateList.addEventListener("dragstart", (event) => {
  const card = event.target.closest("[data-treatment-fighter]");
  if (!card || card.getAttribute("draggable") !== "true") return;
  event.dataTransfer.setData("text/plain", card.dataset.treatmentFighter);
  event.dataTransfer.effectAllowed = "move";
  card.classList.add("is-dragging");
});

elements.medicineCandidateList.addEventListener("dragend", (event) => {
  event.target.closest("[data-treatment-fighter]")?.classList.remove("is-dragging");
});

elements.medicineSlotList.addEventListener("dragover", (event) => {
  if (!event.target.closest("[data-treatment-drop]:not(:disabled)")) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
});

elements.medicineSlotList.addEventListener("drop", (event) => {
  if (!event.target.closest("[data-treatment-drop]:not(:disabled)")) return;
  event.preventDefault();
  startTreatmentFromMedicine(event.dataTransfer.getData("text/plain"));
});

elements.restFighterList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-start-rest]");
  if (!button || button.disabled || !isLatestSnapshot() || isEndingTurn) return;
  const rest = engine.startRest(button.dataset.startRest, button.dataset.restActivity);
  renderSnapshot(currentResult().snapshots.length - 1, { animate: true });
  elements.restNotice.textContent = `${rest.fighter.name}: место в «${rest.activity.name}» оплачено, −${money(rest.activity.price)} HS.`;
  elements.restNotice.hidden = false;
});

elements.battleOfferList.addEventListener("click", (event) => {
  if (isEndingTurn || !isLatestSnapshot()) return;

  const manualBattle = event.target.closest("[data-manual-battle]");
  if (manualBattle) {
    if (!manualBattle.disabled) launchManualBattle(manualBattle.dataset.manualBattle);
    return;
  }

  const assignment = event.target.closest("[data-assign-offer-id]");
  if (assignment) {
    if (assignment.disabled) return;
    engine.assignFighterToBattle(
      assignment.dataset.assignOfferId,
      assignment.dataset.assignFighterId || null,
    );
    const result = currentResult();
    renderSnapshot(result.snapshots.length - 1);
    return;
  }

  const trigger = event.target.closest("[data-fighter-picker]");
  if (!trigger || trigger.disabled) return;
  const offerId = trigger.dataset.fighterPicker;
  const menus = [...elements.battleOfferList.querySelectorAll("[data-fighter-picker-menu]")];
  const targetMenu = menus.find((menu) => menu.dataset.fighterPickerMenu === offerId);
  if (!targetMenu) return;
  const shouldOpen = targetMenu.hidden;
  menus.forEach((menu) => { menu.hidden = true; });
  elements.battleOfferList.querySelectorAll("[data-fighter-picker]").forEach((button) => {
    button.setAttribute("aria-expanded", "false");
  });
  targetMenu.hidden = !shouldOpen;
  trigger.setAttribute("aria-expanded", String(shouldOpen));
});

elements.endTurn.addEventListener("click", async () => {
  if (isEndingTurn || viewedSnapshotIndex !== currentResult().snapshots.length - 1) return;
  const resolutionId = ++turnResolutionId;
  setEndTurnLoading(true);
  await new Promise((resolve) => setTimeout(resolve, END_TURN_LOADING_MS));
  if (resolutionId !== turnResolutionId) return;
  engine.endTurn();
  setEndTurnLoading(false);
  renderSnapshot(currentResult().snapshots.length - 1, { animate: true });
  showTurnSummary(currentResult().state);
});

elements.turnSummaryModal.addEventListener("click", (event) => {
  if (event.target.closest("[data-close-turn-summary]")) closeTurnSummary();
});

window.addEventListener("message", (event) => {
  if (event.origin !== window.location.origin) return;
  if (event.source !== elements.battleFrame.contentWindow) return;
  if (event.data?.type !== "management-battle-result") return;
  acceptManualBattleResult(event.data);
});

elements.snapshotSlider.addEventListener("input", () => {
  renderSnapshot(Number(elements.snapshotSlider.value));
});

elements.previousSnapshot.addEventListener("click", () => renderSnapshot(viewedSnapshotIndex - 1));
elements.nextSnapshot.addEventListener("click", () => renderSnapshot(viewedSnapshotIndex + 1));

elements.viewportPreset.addEventListener("change", () => {
  const [width, height] = elements.viewportPreset.value.split("x").map(Number);
  elements.phone.style.setProperty("--device-width", `${width}px`);
  elements.phone.style.setProperty("--device-height", `${height}px`);
});

renderSnapshot(viewedSnapshotIndex);
if (restoredManualBattle) showBattlesView();
