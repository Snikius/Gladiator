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

let engine = new SchoolManagementEngine(DEFAULT_MANAGEMENT_INPUT);
let viewedSnapshotIndex = 0;
let isEndingTurn = false;
let turnResolutionId = 0;
let selectedFighterId = null;
let renderedFighterState = null;

const END_TURN_LOADING_MS = 1250;

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

const isLatestSnapshot = () => viewedSnapshotIndex === currentResult().snapshots.length - 1;

const setEndTurnLoading = (loading) => {
  isEndingTurn = loading;
  elements.endTurn.classList.toggle("is-processing", loading);
  elements.endTurn.setAttribute("aria-busy", String(loading));
  elements.endTurn.disabled = loading
    || viewedSnapshotIndex !== currentResult().snapshots.length - 1;
  elements.fightersSection.disabled = loading
    || viewedSnapshotIndex !== currentResult().snapshots.length - 1;
  elements.battlesSection.disabled = loading
    || viewedSnapshotIndex !== currentResult().snapshots.length - 1;
  elements.marketSection.disabled = loading
    || viewedSnapshotIndex !== currentResult().snapshots.length - 1;
  elements.armorySection.disabled = loading
    || viewedSnapshotIndex !== currentResult().snapshots.length - 1;
  elements.upgradesSection.disabled = loading
    || viewedSnapshotIndex !== currentResult().snapshots.length - 1;
  elements.medicineSection.disabled = loading
    || viewedSnapshotIndex !== currentResult().snapshots.length - 1;
  elements.restSection.disabled = loading
    || viewedSnapshotIndex !== currentResult().snapshots.length - 1;
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
    fighterClass && trainingTurnsRemaining <= 0 && !treatedFighterIds.has(id) && !restingFighterIds.has(id)
  ));
  const assignedIds = new Set(offers.map(({ assignedFighterId }) => assignedFighterId).filter(Boolean));
  const assignedCount = assignedIds.size;
  const unassignedCount = offers.filter(({ assignedFighterId }) => !assignedFighterId).length;
  elements.battleOffersCount.textContent = String(unassignedCount);
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
          <span class="fighter-picker-portrait"><img src="${escapeHTML(fighter.portrait)}" alt="" /></span>
          <span class="fighter-picker-copy">
            <strong>${escapeHTML(fighter.name)}</strong>
            <small>${fighterClassLabelHTML(fighter.fighterClass, fighter.classLabel)}</small>
            <em>${escapeHTML(fighter.condition)}</em>
          </span>
          <b>${usedElsewhere ? "НАЗНАЧЕН" : (fighter.id === offer.assignedFighterId ? "✓" : "›")}</b>
        </button>
      `;
    }).join("");
    const lossReward = Math.round(offer.victoryReward * currentResult().input.battleRules.lossRewardRate);
    return `
      <article class="battle-offer-card ${assignedFighter ? "is-assigned" : ""}">
        <header>
          <span>ПРЕДЛОЖЕНИЕ ${index + 1}</span>
          <b>${escapeHTML(offer.difficulty)}</b>
        </header>
        <div class="battle-offer-opponent">
          <span class="battle-opponent-portrait">
            <img src="${escapeHTML(offer.opponentPortrait)}" alt="${escapeHTML(offer.opponentName)}" />
          </span>
          <div>
            <small>${escapeHTML(offer.arena)}</small>
            <strong>${escapeHTML(offer.opponentName)}</strong>
            <em>${escapeHTML(offer.opponentClass)}</em>
          </div>
          <b class="battle-versus-mark">VS</b>
        </div>
        <div class="battle-reward-outcomes">
          <div>
            <strong>ПОБЕДА</strong>
            <span class="battle-resource-value money"><img src="./assets/icons/coins-v1.png" alt="" />+${money(offer.victoryReward)}</span>
            <span class="battle-resource-value experience"><img src="./assets/icons/experience-v1.png" alt="" />+${money(offer.victoryExperience)}</span>
          </div>
          <div>
            <strong>ПОРАЖЕНИЕ</strong>
            <span class="battle-resource-value money"><img src="./assets/icons/coins-v1.png" alt="" />+${money(lossReward)}</span>
            <span class="battle-resource-value experience"><img src="./assets/icons/experience-v1.png" alt="" />+${money(offer.defeatExperience)}</span>
          </div>
        </div>
        <div class="battle-assignment">
          <span>ВАШ БОЕЦ</span>
          <button class="fighter-picker-trigger ${assignedFighter ? "has-fighter" : ""}" type="button"
            data-fighter-picker="${escapeHTML(offer.id)}" aria-expanded="false" ${isEndingTurn ? "disabled" : ""}>
            ${assignedFighter ? `
              <span class="fighter-picker-portrait"><img src="${escapeHTML(assignedFighter.portrait)}" alt="" /></span>
              <span class="fighter-picker-copy">
                <strong>${escapeHTML(assignedFighter.name)}</strong>
                <small>${fighterClassLabelHTML(assignedFighter.fighterClass, assignedFighter.classLabel)}</small>
                <em>${escapeHTML(assignedFighter.condition)}</em>
              </span>
            ` : `
              <span class="fighter-picker-empty-mark">+</span>
              <span class="fighter-picker-copy">
                <strong>Назначить бойца</strong>
                <em>Открыть состав школы</em>
              </span>
            `}
            <b class="fighter-picker-chevron">⌄</b>
          </button>
          <div class="fighter-picker-menu" data-fighter-picker-menu="${escapeHTML(offer.id)}" hidden>
            ${assignedFighter ? `
              <button class="fighter-picker-clear" type="button" data-assign-offer-id="${escapeHTML(offer.id)}" data-assign-fighter-id="">СНЯТЬ НАЗНАЧЕНИЕ</button>
            ` : ""}
            ${fighterOptions || '<div class="fighter-picker-empty">Нет бойцов со специализацией</div>'}
          </div>
        </div>
        <div class="battle-auto-note ${assignedFighter ? "is-ready" : ""}">
          <strong>${assignedFighter ? `Автобой: ${escapeHTML(assignedFighter.name)}` : "Назначьте бойца"}</strong>
          <span>${assignedFighter ? "Будет проведён при завершении хода" : "Без назначения бой не состоится"}</span>
        </div>
        <button class="manual-battle-button" type="button" disabled>▣ ПРОВЕСТИ БОЙ САМОМУ</button>
        <small class="manual-battle-note">Просмотр боя пока закрыт · доступен только автобой</small>
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
  const catalog = currentResult().input.schoolUpgradeCatalog || [];
  const orders = state.schoolUpgradeOrders || [];
  elements.schoolUpgradesHomeCount.textContent = String(orders.length);
  elements.schoolUpgradesSummary.textContent = String(orders.length);
  elements.schoolUpgradesTreasury.textContent = `${money(state.treasury)} HS`;
  elements.schoolUpgradesOrdersCount.textContent = String(orders.length);
  elements.schoolUpgradeList.innerHTML = catalog.map((definition) => {
    const currentLevel = state.schoolUpgrades?.[definition.id]?.level || 1;
    const targetLevel = currentLevel + 1;
    const price = Math.round(definition.basePrice * (1 + 0.65 * (currentLevel - 1)));
    const turns = definition.baseTurns + currentLevel - 1;
    const activeOrder = orders.find(({ definitionId }) => definitionId === definition.id);
    const insufficient = state.treasury < price;
    const disabled = activeOrder || insufficient || !isLatestSnapshot() || isEndingTurn;
    return `
      <article class="school-upgrade-card ${activeOrder ? "is-building" : ""}">
        <span class="school-upgrade-art"><img src="${escapeHTML(definition.icon)}" alt="" /></span>
        <div class="school-upgrade-copy">
          <small>${escapeHTML(definition.latinName)}</small>
          <strong>${escapeHTML(definition.name)}</strong>
          <span class="school-upgrade-level">УРОВЕНЬ ${toRoman(currentLevel)} <i>→</i> ${toRoman(activeOrder?.targetLevel || targetLevel)}</span>
          <p>${escapeHTML(definition.description)}</p>
        </div>
        <div class="school-upgrade-costs">
          <span><small>ЦЕНА</small><b><img src="./assets/icons/coins-v1.png" alt="" />${money(activeOrder?.price || price)} HS</b></span>
          <span><small>СРОК</small><b><img src="./assets/icons/hourglass-v1.png" alt="" />${activeOrder?.turnsRemaining || turns} ${((activeOrder?.turnsRemaining || turns) === 1) ? "ХОД" : "ХОДА"}</b></span>
        </div>
        ${activeOrder ? `
          <div class="school-upgrade-progress"><span><i style="width:${Math.round((1 - activeOrder.turnsRemaining / activeOrder.totalTurns) * 100)}%"></i></span><b>СТРОИТСЯ · ${activeOrder.turnsRemaining} ${activeOrder.turnsRemaining === 1 ? "ХОД" : "ХОДА"}</b></div>
        ` : `
          <button type="button" data-start-school-upgrade="${escapeHTML(definition.id)}" ${disabled ? "disabled" : ""}>${insufficient ? "НЕ ХВАТАЕТ ДЕНЕГ" : `УЛУЧШИТЬ ДО УРОВНЯ ${toRoman(targetLevel)}`}</button>
        `}
      </article>
    `;
  }).join("");
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
  elements.fightersSection.disabled = isEndingTurn || index !== result.snapshots.length - 1;
  elements.battlesSection.disabled = isEndingTurn || index !== result.snapshots.length - 1;
  elements.marketSection.disabled = isEndingTurn || index !== result.snapshots.length - 1;
  elements.armorySection.disabled = isEndingTurn || index !== result.snapshots.length - 1;
  elements.upgradesSection.disabled = isEndingTurn || index !== result.snapshots.length - 1;
  elements.medicineSection.disabled = isEndingTurn || index !== result.snapshots.length - 1;
  elements.restSection.disabled = isEndingTurn || index !== result.snapshots.length - 1;
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
  const button = event.target.closest("[data-start-school-upgrade]");
  if (!button || button.disabled || !isLatestSnapshot() || isEndingTurn) return;
  const upgrade = engine.startSchoolUpgrade(button.dataset.startSchoolUpgrade);
  renderSnapshot(currentResult().snapshots.length - 1, { animate: true });
  elements.schoolUpgradesNotice.textContent = `${upgrade.order.name}: строительство уровня ${toRoman(upgrade.order.targetLevel)} начато.`;
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

renderSnapshot(0);
