(function () {
"use strict";

const {
  ARENA_TYPES,
  BattleEngine,
  FIGHTER_CLASS_DEFINITIONS,
  EQUIPMENT_QUALITIES,
  WEAPON_SET_DEFINITIONS,
  WEAPON_ITEMS,
  ARMOR_ITEMS,
  ALL_MODIFIER_DEFINITIONS,
  INJURY_DEFINITIONS,
  PERK_DEFINITIONS,
  SPECTACLE_TIERS,
  BUFF_DEFINITIONS,
  PLAYER_BUFF_DEFINITIONS,
  createBattleLogExport,
  createDefaultBattleInput,
} = globalThis.GladiatorBattle;

const { BattleVisualEngine, RENDERER_MODES } = globalThis.GladiatorVisualEngine || {};
const {
  bloodStainGrowthLimit,
  bloodStainProgress,
  bloodSplashVisible,
  buildBattleStoryEntries,
  fighterBloodLevels,
} = globalThis.GladiatorBattleStory;

const mobilePageParams = new URLSearchParams(window.location.search);
let isMobileFullscreenMode = mobilePageParams.get("mobile") === "1";
document.body.classList.toggle("mobile-fullscreen-mode", isMobileFullscreenMode);

const elements = {
  form: document.querySelector("#setup-form"),
  startButton: document.querySelector('#setup-form button[type="submit"]'),
  seed: document.querySelector("#seed"),
  maxSteps: document.querySelector("#max-steps"),
  arenaType: document.querySelector("#arena-type"),
  multiplier1: document.querySelector("#arena-multiplier-1"),
  multiplier2: document.querySelector("#arena-multiplier-2"),
  restoreDefaults: document.querySelector("#restore-defaults"),
  spriteVisualCanvas: document.querySelector("#mobile-arena-canvas"),
  mobileDevice: document.querySelector(".mobile-device"),
  mobileViewportPreset: document.querySelector("#mobile-viewport-preset"),
  mobileViewportReadout: document.querySelector("#mobile-viewport-readout"),
  mobileFullscreenLink: document.querySelector("#mobile-fullscreen-link"),
  mobileExitFullscreen: document.querySelector("#mobile-exit-fullscreen"),
  mobileNativeFullscreen: document.querySelector("#mobile-native-fullscreen"),
  mobileStartButton: document.querySelector("#mobile-start-battle"),
  mobileArenaHeader: document.querySelector("#mobile-arena-header"),
  mobileSpectacleVerdict: document.querySelector("#mobile-spectacle-verdict"),
  mobileBattleStory: document.querySelector(".mobile-battle-story"),
  mobileBattleFeed: document.querySelector("#mobile-battle-feed"),
  mobileBuffControl: document.querySelector("#mobile-buff-control"),
  mobileBuffTrigger: document.querySelector("#mobile-buff-trigger"),
  mobileBuffStatus: document.querySelector("#mobile-buff-status"),
  mobileBuffOptions: [...document.querySelectorAll("[data-buff-choice]")],
  predictionSamples: document.querySelector("#prediction-samples"),
  calculatePrediction: document.querySelector("#calculate-prediction"),
  predictionResult: document.querySelector("#prediction-result"),
  arenaName: document.querySelector("#arena-name"),
  arenaSeed: document.querySelector("#arena-seed"),
  arenaStep: document.querySelector("#arena-step"),
  battleCallout: document.querySelector("#battle-callout"),
  timeline: document.querySelector("#timeline"),
  slider: document.querySelector("#step-slider"),
  previousStep: document.querySelector("#previous-step"),
  nextStep: document.querySelector("#next-step"),
  playPause: document.querySelector("#play-pause"),
  snapshotLabel: document.querySelector("#snapshot-label"),
  fighterNumbers: document.querySelector("#fighter-numbers"),
  snapshotDetails: document.querySelector("#snapshot-details"),
  resultPanel: document.querySelector("#result-panel"),
  resultTitle: document.querySelector("#result-title"),
  resultDescription: document.querySelector("#result-description"),
  fighterOutcomes: document.querySelector("#fighter-outcomes"),
  downloadBattle: document.querySelector("#download-battle"),
  downloadLog: document.querySelector("#download-log"),
  statisticsPanel: document.querySelector("#statistics-panel"),
  statisticsTable: document.querySelector("#statistics-table"),
  logPanel: document.querySelector("#log-panel"),
  logSummary: document.querySelector("#log-summary"),
  logFilter: document.querySelector("#log-filter"),
  keyEventsOnly: document.querySelector("#key-events-only"),
  battleLog: document.querySelector("#battle-log"),
};

let currentResult = null;
let currentSnapshotIndex = 0;
let playbackTimer = null;
let isPlaying = false;
let mobileBuffHoldTimer = null;
let mobileBuffStatusTimer = null;
let ignoreMobileBuffClickUntil = 0;
let mobileBuffHoldOpened = false;
let playerBuffCommandSequence = 0;
let predictionRunId = 0;
const MOBILE_BUFF_HOLD_MS = 340;
const PLAYBACK_STEP_MS = 1000;
const INTRO_PLAYBACK_STEP_MS = 3600;
const PLAYBACK_PAUSE_MIN_MULTIPLIER = 1;
const PLAYBACK_PAUSE_MAX_MULTIPLIER = 3;
const randomPlaybackDelay = () => Math.round(PLAYBACK_STEP_MS * (
  PLAYBACK_PAUSE_MIN_MULTIPLIER
  + Math.random() * (PLAYBACK_PAUSE_MAX_MULTIPLIER - PLAYBACK_PAUSE_MIN_MULTIPLIER)
));
const spriteVisualEngine = BattleVisualEngine && elements.spriteVisualCanvas
  ? new BattleVisualEngine(elements.spriteVisualCanvas, { rendererMode: RENDERER_MODES.assets })
  : null;
const spriteRendererButtons = [...document.querySelectorAll("[data-renderer-mode]")];
const MOBILE_ARENA_BASE_HEIGHT = 300;
const MOBILE_ARENA_MAX_EXTRA_HEIGHT = 24;

const mobileArenaHeightForViewport = (width, height) => {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0) return MOBILE_ARENA_BASE_HEIGHT;
  const normalizedHeight = height * 360 / width;
  const extraHeight = Math.max(0, Math.min(
    MOBILE_ARENA_MAX_EXTRA_HEIGHT,
    Math.round((normalizedHeight - 640) * 0.16),
  ));
  return MOBILE_ARENA_BASE_HEIGHT + extraHeight;
};

const syncMobileArenaHeight = () => {
  const option = elements.mobileViewportPreset?.selectedOptions[0];
  const viewportWidth = isMobileFullscreenMode ? window.innerWidth : Number(option?.dataset.width);
  const viewportHeight = isMobileFullscreenMode ? window.innerHeight : Number(option?.dataset.height);
  const nextHeight = mobileArenaHeightForViewport(viewportWidth, viewportHeight);
  if (!elements.spriteVisualCanvas || elements.spriteVisualCanvas.height === nextHeight) return false;
  elements.spriteVisualCanvas.height = nextHeight;
  if (lastVisualSnapshot) {
    spriteVisualEngine?.present(lastVisualSnapshot, lastVisualInput);
    renderMobileBattleUi(lastVisualSnapshot, lastVisualInput);
  }
  return true;
};

const formatViewportRatio = (width, height) => {
  const ratioToNine = (height / width) * 9;
  return `${ratioToNine.toLocaleString("ru-RU", { maximumFractionDigits: 1 })}:9`;
};

const applyMobileViewportPreset = () => {
  const option = elements.mobileViewportPreset?.selectedOptions[0];
  if (!option || !elements.mobileDevice) return;
  const width = Number(option.dataset.width);
  const height = Number(option.dataset.height);
  if (!Number.isFinite(width) || !Number.isFinite(height)) return;

  // Значение пресета описывает игровой viewport. Рамка телефона добавляется
  // снаружи и масштабируется вместе с ним, если панель уже выбранного размера.
  const shellWidth = width + 28;
  const shellHeight = height + 44;
  elements.mobileDevice.style.setProperty("--mobile-device-width", `${shellWidth}px`);
  elements.mobileDevice.style.setProperty("--mobile-device-ratio", `${shellWidth} / ${shellHeight}`);
  elements.mobileDevice.dataset.viewportPreset = option.value;
  if (elements.mobileViewportReadout) {
    elements.mobileViewportReadout.textContent = `Viewport ${width}×${height} CSS px · ${formatViewportRatio(width, height)}`;
  }
  syncMobileArenaHeight();
};

const requestNativeFullscreen = () => {
  if (document.fullscreenElement || !document.documentElement.requestFullscreen) return;
  document.documentElement.requestFullscreen({ navigationUI: "hide" }).catch(() => {
    // iOS и часть встроенных браузеров не дают полноэкранный API. Макет всё
    // равно занимает весь динамический viewport благодаря mobile-режиму CSS.
  });
};

const mobileModeUrl = (enabled) => {
  const url = new URL(window.location.href);
  if (enabled) url.searchParams.set("mobile", "1");
  else url.searchParams.delete("mobile");
  return url;
};

const setMobileFullscreenMode = (enabled, { updateUrl = false, nativeFullscreen = false } = {}) => {
  isMobileFullscreenMode = enabled;
  document.body.classList.toggle("mobile-fullscreen-mode", enabled);
  if (updateUrl) window.history.pushState({ mobileFullscreen: enabled }, "", mobileModeUrl(enabled));
  syncMobileArenaHeight();
  if (nativeFullscreen && enabled) requestNativeFullscreen();
  if (!enabled && document.fullscreenElement && document.exitFullscreen) {
    document.exitFullscreen().catch(() => {});
  }
  window.scrollTo({ top: 0, left: 0 });
};

const setBattleStartLabels = (debugLabel, mobileLabel) => {
  elements.startButton.textContent = debugLabel;
  if (elements.mobileStartButton) elements.mobileStartButton.textContent = mobileLabel;
};

let lastVisualSnapshot = null;
let lastVisualInput = null;

// UI передаёт только снимок состояния и входные данные. Визуальный движок не
// получает BattleEngine и не может влиять на расчёт боя.
const renderVisual = (snapshot, input) => {
  lastVisualSnapshot = snapshot;
  lastVisualInput = input;
  spriteVisualEngine?.present(snapshot, input);
};

spriteRendererButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (!spriteVisualEngine) return;
    spriteVisualEngine.setRendererMode(button.dataset.rendererMode);
    spriteRendererButtons.forEach((other) => other.classList.toggle("selected", other === button));
    if (lastVisualSnapshot) spriteVisualEngine.present(lastVisualSnapshot, lastVisualInput);
  });
});

const escapeHtml = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

const SPECTACLE_ICON = `
  <svg class="spectacle-mask-icon" viewBox="0 0 56 42" aria-hidden="true">
    <g class="mask-tragedy" transform="rotate(8 37 18)">
      <path class="mask-tragedy-shell" d="M22 3c8-3 18-2 28 2l-1 15c-1 9-6 15-14 19-7-4-11-10-12-18L22 3Z" />
      <path class="mask-shadow" d="M38 4c5 0 9 1 12 2l-1 14c-1 8-5 14-13 18 3-8 4-21 2-34Z" />
      <path class="mask-feature" d="m27 13 7-3 4 4-9 2Zm13-2 6 4-8 1Z" />
      <path class="mask-feature" d="M29 29c3-6 9-7 14-2l-2 2c-4-2-7-1-10 2Z" />
      <path class="mask-glint" d="M26 7c6-2 12-2 18 0" />
    </g>
    <g class="mask-comedy" transform="rotate(-7 20 24)">
      <path class="mask-comedy-shell" d="M4 9c9-3 19-3 29 0l-1 15c-1 9-6 15-14 18C10 38 6 32 5 24L4 9Z" />
      <path class="mask-highlight" d="M5 10c7-2 13-2 19-1-1 12-5 21-14 27-3-4-5-8-5-13L5 10Z" />
      <path class="mask-feature" d="m9 18 7-4 5 4-10 2Zm13-3 6 4-9 1Z" />
      <path class="mask-feature" d="M10 27c6 4 12 4 18-1-2 8-13 11-18 1Z" />
      <path class="mask-glint" d="M8 12c6-2 12-2 18-1" />
    </g>
  </svg>`;

const spectacleTier = (tierId) => SPECTACLE_TIERS.find((tier) => tier.id === tierId)
  || SPECTACLE_TIERS[0];

const battleStoryStamp = (className) => {
  const stampPaths = className === "state-trauma"
    ? '<path d="M6 1h4v5h5v4h-5v5H6v-5H1V6h5z"/>'
    : className === "state-player-buff"
      ? '<path d="M2 6h3l6-4v12l-6-4H2V6Zm3 5 1 4H4l-1-4m10-6c1.4 1.4 1.4 4.6 0 6" fill="none" stroke="currentColor" stroke-width="1.5"/>'
    : className === "state-initial"
      ? '<path d="M3 13V7a5 5 0 0 1 10 0v6H3Zm2-5h6M8 2v11" fill="none" stroke="currentColor" stroke-width="1.5"/>'
      : className === "outcome-block"
        ? '<path d="M8 1 13 3v4c0 3.4-1.8 6-5 8-3.2-2-5-4.6-5-8V3l5-2Zm0 3v7" fill="none" stroke="currentColor" stroke-width="1.5"/>'
        : className === "outcome-dodge"
          ? '<path d="M2 12c2.8-5.6 6.4-7.5 11-5.7M10 3l3 3-4 2" fill="none" stroke="currentColor" stroke-width="1.7"/>'
          : className === "outcome-miss"
            ? '<path d="m3 13 4-4m2-2 4-4M2 10l4 4m4-12 4 4" fill="none" stroke="currentColor" stroke-width="1.6"/>'
            : className === "impact-critical"
              ? '<path d="M8 1c2.5 3.4 4 5.6 4 8a4 4 0 0 1-8 0c0-2.4 1.5-4.6 4-8Z"/><circle cx="13.5" cy="12.5" r="1.3"/>'
              : className === "impact-strong"
                ? '<path d="m2 3 3 1 8 8-1 2-8-8-2-3Zm12 0-3 1-3 3M5 9l-2 3 1 2 3-3" fill="none" stroke="currentColor" stroke-width="1.5"/>'
                : className === "impact-light"
                  ? '<path d="m12 2 2 2-7 7-3 1 1-3 7-7Zm-9 11 2 2" fill="none" stroke="currentColor" stroke-width="1.3"/>'
                  : '<path d="m12 2 2 2-7 7-3 1 1-3 7-7ZM3 13l2 2M9 5l2 2" fill="none" stroke="currentColor" stroke-width="1.7"/>';
  return `<span class="mobile-story-stamp" aria-hidden="true"><svg viewBox="0 0 16 16" focusable="false">${stampPaths}</svg></span>`;
};

const MOBILE_STORY_SCROLL_MS = 620;
let mobileStoryScrollToken = 0;

const mobileStoryKey = (entry) => [
  entry.kind || "story",
  entry.step ?? "",
  entry.className,
  entry.text,
].join("|");

const createMobileStoryEntryNode = (entry) => {
  const item = document.createElement("li");
  item.className = entry.className;
  item.dataset.storyKey = mobileStoryKey(entry);

  if (entry.className !== "empty") {
    item.insertAdjacentHTML("beforeend", battleStoryStamp(entry.className));
    const copy = document.createElement("span");
    copy.className = "mobile-story-copy";
    copy.textContent = entry.text;
    item.append(copy);
  } else {
    item.textContent = entry.text;
  }

  return item;
};

const formatNumber = (value, digits = 2) => Number(value).toLocaleString("ru-RU", {
  maximumFractionDigits: digits,
});

const percent = (value) => `${formatNumber(value * 100, 2)}%`;

const arenaName = (arenaId) => ARENA_TYPES.find((arena) => arena.id === arenaId)?.name || arenaId;
const fighterClass = (classId) => FIGHTER_CLASS_DEFINITIONS.find((item) => item.id === classId);
const fighterClassName = (classId) => fighterClass(classId)?.name || classId;
const modifierName = (modifierId) => ALL_MODIFIER_DEFINITIONS.find((item) => item.id === modifierId)?.name || modifierId;
const qualityName = (qualityId) => EQUIPMENT_QUALITIES.find((item) => item.id === qualityId)?.name || qualityId;
const equipmentGlyphs = {
  shield: "▣", sica: "⌁", net: "#", helmet: "◉", spear: "↟",
  sword: "†", armor: "▤", greaves: "∥", shoulder: "◒",
};
const equipmentGlyph = (name) => equipmentGlyphs[name] || "◆";
const equipmentStatNames = {
  weaponPower: "урон",
  accuracy: "точность",
  armor: "броня",
  weight: "вес",
  mobility: "подвижность",
};
const renderCombatParameters = (fighter, base, arenaMultiplier) => {
  const parameters = [
    {
      label: "Класс",
      value: fighterClassName(fighter.fighterClass),
      description: "Определяет доступный стиль оружия и уникальный классовый приём.",
    },
    {
      label: "Харизма",
      value: formatNumber(base.charisma),
      description: "Базовый источник поддержки: харизма умножается на множитель арены.",
    },
    {
      label: "Множитель арены",
      value: formatNumber(arenaMultiplier),
      description: "Усиливает или ослабляет вклад харизмы и её изменений в поддержку бойца.",
    },
    {
      label: "Крит",
      value: percent(fighter.criticalChance),
      description: "Шанс после успешного попадания нанести двойной урон.",
    },
    {
      label: "Приём",
      value: percent(fighter.classTechniqueChance),
      description: "Шанс активировать уникальную технику выбранного оружейного стиля.",
    },
    {
      label: "Оружие",
      value: `+${formatNumber(fighter.weaponPower)}`,
      description: "Прибавляется к эффективной силе перед расчётом урона и вычитанием брони.",
    },
    {
      label: "Точность",
      value: formatNumber(fighter.accuracy),
      description: "Каждая единица снижает вес промаха на 0,8: чем выше значение, тем реже промахи.",
    },
    {
      label: "Броня",
      value: formatNumber(fighter.armor),
      description: "Каждая единица повышает шанс блока и уменьшает урон попадания на 0,6.",
    },
    {
      label: "Вес",
      value: formatNumber(fighter.equipmentWeight),
      description: "Увеличивает усталость от действия, блока и уклонения; тяжёлая экипировка быстрее утомляет.",
    },
    {
      label: "Подвижность",
      value: `${fighter.mobility > 0 ? "+" : ""}${formatNumber(fighter.mobility)}`,
      description: "Прибавляется к инициативе и вероятности уклонения. Отрицательное значение снижает оба показателя.",
    },
  ];
  return `
    <section class="combat-parameter-panel" aria-label="Расшифровка боевых параметров">
      <h4>Боевые параметры <small>как значения влияют на бой</small></h4>
      <dl class="combat-parameter-list">
        ${parameters.map((parameter) => `
          <div class="combat-parameter">
            <dt><span>${escapeHtml(parameter.label)}</span><strong>${escapeHtml(String(parameter.value))}</strong></dt>
            <dd>${escapeHtml(parameter.description)}</dd>
          </div>
        `).join("")}
      </dl>
    </section>
  `;
};
const effectDefinitions = {
  buffs: BUFF_DEFINITIONS,
  injuries: INJURY_DEFINITIONS,
};
const effectName = (type, effectId) =>
  effectDefinitions[type].find((effect) => effect.id === effectId)?.name || effectId;

/* Интерфейс и движок используют один стартовый состав: игрок-ретиарий слева,
 * усиленный мечник-противник справа. */
const createSimulatorDefaultInput = () => createDefaultBattleInput();

const appendEffectRow = (fighterIndex, type, selectedValue = "") => {
  const list = document.querySelector(`[data-effect-list="${type}"][data-fighter-index="${fighterIndex}"]`);
  const definitions = effectDefinitions[type];
  const row = document.createElement("div");
  row.className = `dynamic-effect-row ${type === "injuries" ? "injury-row" : "temporary-row"}`;
  row.innerHTML = `
    <select data-fighter-effect="${fighterIndex}" data-effect-type="${type}" aria-label="${type === "injuries" ? "Стартовая травма" : "Временный эффект"}">
      <option value="">— Выберите ${type === "injuries" ? "травму" : "эффект"} —</option>
      ${definitions.map((definition) => `
        <option value="${definition.id}">${escapeHtml(definition.name)}</option>
      `).join("")}
    </select>
    <button class="remove-effect" type="button" data-remove-effect title="Удалить строку">×</button>
    <small data-effect-description>Элемент не выбран</small>
  `;
  row.querySelector("select").value = selectedValue;
  list.append(row);
};

const equipmentItem = (itemId) => [...WEAPON_ITEMS, ...ARMOR_ITEMS].find((item) => item.id === itemId);

const equipmentPreview = (item) => {
  const stats = Object.entries(item.stats)
    .map(([key, value]) => `${equipmentStatNames[key] || key}: ${value > 0 && key === "mobility" ? "+" : ""}${value}`)
    .join(" · ");
  const weaponSet = item.slot === "weapon"
    ? WEAPON_SET_DEFINITIONS.find((candidate) => candidate.id === item.setId)
    : null;
  const technique = weaponSet ? `Приём: ${modifierName(weaponSet.techniqueId)}` : null;
  const extraNames = item.additionalPerkIds.map(modifierName).join(", ");
  const extras = [technique, extraNames ? `Доп.: ${extraNames}` : "без дополнительного эффекта"]
    .filter(Boolean)
    .join(" · ");
  return `<span class="equipment-icon">${equipmentGlyph(item.icon)}</span>
    <span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(qualityName(item.quality))} · ${escapeHtml(stats)}</small><em>${escapeHtml(extras)}</em></span>`;
};

const updateEquipmentPreview = (picker) => {
  ["weapon", "armor"].forEach((slot) => {
    const select = picker.querySelector(`[data-equipment-slot="${slot}"]`);
    const item = equipmentItem(select.value);
    const preview = picker.querySelector(`[data-equipment-preview="${slot}"]`);
    preview.className = `equipment-preview quality-${item.quality}`;
    preview.innerHTML = equipmentPreview(item);
  });
};

const renderEquipmentPicker = (fighterIndex, classId, weaponId, armorId) => {
  const picker = document.querySelector(`[data-equipment-picker="${fighterIndex}"]`);
  const selectedClass = fighterClass(classId) || FIGHTER_CLASS_DEFINITIONS[0];
  const weapons = WEAPON_ITEMS.filter((item) => item.classId === selectedClass.id);
  const armors = ARMOR_ITEMS.filter((item) => item.classId === selectedClass.id);
  const selectedWeapon = weapons.some((item) => item.id === weaponId) ? weaponId : weapons[0].id;
  const selectedArmor = armors.some((item) => item.id === armorId) ? armorId : armors[0].id;
  picker.innerHTML = `
    <p class="sublegend">Класс и комплекты</p>
    <div class="class-choice" role="group" aria-label="Класс гладиатора">
      ${FIGHTER_CLASS_DEFINITIONS.map((item) => `<button type="button" data-class-choice="${item.id}" class="${item.id === selectedClass.id ? "selected" : ""}" title="${escapeHtml(item.description)}"><b>${equipmentGlyph(item.icon)}</b><span>${escapeHtml(item.name)}</span></button>`).join("")}
    </div>
    <input type="hidden" data-fighter-class value="${selectedClass.id}" />
    <label class="equipment-select"><span>Оружейный комплект</span><select data-equipment-slot="weapon">
      ${weapons.map((item) => `<option value="${item.id}" ${item.id === selectedWeapon ? "selected" : ""}>${escapeHtml(qualityName(item.quality))} · ${escapeHtml(item.name)}</option>`).join("")}
    </select></label>
    <div class="equipment-preview quality-${equipmentItem(selectedWeapon).quality}" data-equipment-preview="weapon"></div>
    <label class="equipment-select"><span>Комплект доспехов</span><select data-equipment-slot="armor">
      ${armors.map((item) => `<option value="${item.id}" ${item.id === selectedArmor ? "selected" : ""}>${escapeHtml(qualityName(item.quality))} · ${escapeHtml(item.name)}</option>`).join("")}
    </select></label>
    <div class="equipment-preview quality-${equipmentItem(selectedArmor).quality}" data-equipment-preview="armor"></div>`;
  updateEquipmentPreview(picker);
};

const populateMenus = () => {
  elements.arenaType.innerHTML = ARENA_TYPES
    .map((arena) => `<option value="${arena.id}">${escapeHtml(arena.name)}</option>`)
    .join("");

  document.querySelectorAll("[data-perks]").forEach((container) => {
    const fighterIndex = Number(container.dataset.perks);
    container.innerHTML = `
      <p class="sublegend">Перки · максимум 3</p>
      ${[0, 1, 2].map((slot) => `
        <label class="perk-slot">
          <span>Слот ${slot + 1}</span>
          <select data-fighter-perk="${fighterIndex}" data-perk-slot="${slot}">
            <option value="">— Пустой слот —</option>
            ${PERK_DEFINITIONS.map((perk) => `
              <option value="${perk.id}">${escapeHtml(perk.name)}</option>
            `).join("")}
          </select>
          <small data-perk-description>Перк не выбран</small>
        </label>
      `).join("")}
      ${fighterIndex === 0 ? `
        <section class="effect-builder player-buff-loadout">
          <div class="effect-builder-heading">
            <div>
              <strong>Боевые усиления</strong>
              <small>До трёх уникальных команд игрока</small>
            </div>
          </div>
          ${[0, 1, 2].map((slot) => `
            <label class="perk-slot player-buff-slot">
              <span>Усиление ${slot + 1}</span>
              <select data-player-buff-slot="${slot}">
                <option value="">— Пустой слот —</option>
                ${PLAYER_BUFF_DEFINITIONS.map((buff) => `
                  <option value="${buff.id}">${escapeHtml(buff.name)}</option>
                `).join("")}
              </select>
              <small data-player-buff-description>Усиление не выбрано</small>
            </label>
          `).join("")}
        </section>
      ` : ""}
      <section class="effect-builder temporary-builder">
        <div class="effect-builder-heading">
          <div>
            <strong>Временные эффекты</strong>
            <small>Действуют один бой · количество не ограничено</small>
          </div>
          <button type="button" data-add-effect="buffs" data-fighter-index="${fighterIndex}">+ Добавить</button>
        </div>
        <div class="dynamic-effect-list" data-effect-list="buffs" data-fighter-index="${fighterIndex}"></div>
      </section>
      <section class="effect-builder injury-builder">
        <div class="effect-builder-heading">
          <div>
            <strong>Стартовые травмы</strong>
            <small>Применяются до начала боя · количество не ограничено</small>
          </div>
          <button type="button" data-add-effect="injuries" data-fighter-index="${fighterIndex}">+ Добавить</button>
        </div>
        <div class="dynamic-effect-list" data-effect-list="injuries" data-fighter-index="${fighterIndex}"></div>
      </section>
    `;
  });
};

const renderPerkSlotDescriptions = () => {
  document.querySelectorAll("[data-perk-slot]").forEach((select) => {
    const perk = PERK_DEFINITIONS.find((item) => item.id === select.value);
    select.closest(".perk-slot").querySelector("[data-perk-description]").textContent =
      perk?.description || "Перк не выбран";
  });

  [0, 1].forEach((fighterIndex) => {
    const selects = [...document.querySelectorAll(`[data-fighter-perk="${fighterIndex}"]`)];
    selects.forEach((select) => {
      const chosenInOtherSlots = new Set(
        selects.filter((other) => other !== select).map((other) => other.value).filter(Boolean),
      );
      [...select.options].forEach((option) => {
        option.disabled = Boolean(option.value && chosenInOtherSlots.has(option.value));
      });
    });
  });

  document.querySelectorAll("[data-effect-type]").forEach((select) => {
    const definition = effectDefinitions[select.dataset.effectType]
      .find((item) => item.id === select.value);
    select.closest(".dynamic-effect-row").querySelector("[data-effect-description]").textContent =
      definition?.description || "Элемент не выбран";
  });

  const buffSelects = [...document.querySelectorAll("[data-player-buff-slot]")];
  buffSelects.forEach((select) => {
    const definition = PLAYER_BUFF_DEFINITIONS.find((item) => item.id === select.value);
    select.closest(".player-buff-slot").querySelector("[data-player-buff-description]").textContent =
      definition?.description || "Усиление не выбрано";
    const chosenInOtherSlots = new Set(
      buffSelects.filter((other) => other !== select).map((other) => other.value).filter(Boolean),
    );
    [...select.options].forEach((option) => {
      option.disabled = Boolean(option.value && chosenInOtherSlots.has(option.value));
    });
  });
};

const setFormFromInput = (input) => {
  elements.seed.value = input.seed;
  elements.maxSteps.value = input.maxSteps;
  elements.arenaType.value = input.arena.type;
  elements.multiplier1.value = input.arena.supportMultipliers[0];
  elements.multiplier2.value = input.arena.supportMultipliers[1];

  document.querySelectorAll("[data-fighter-form]").forEach((form, index) => {
    const fighter = input.fighters[index];
    const values = {
      name: fighter.name,
      strength: fighter.base.strength,
      health: fighter.base.health,
      charisma: fighter.base.charisma,
      criticalChance: fighter.criticalChance,
      classTechniqueChance: fighter.classTechniqueChance,
    };
    Object.entries(values).forEach(([field, value]) => {
      form.querySelector(`[data-field="${field}"]`).value = value;
    });
    renderEquipmentPicker(
      index,
      fighter.fighterClass,
      fighter.equipment.weaponSet.definitionId,
      fighter.equipment.armorSet.definitionId,
    );
    document.querySelectorAll(`[data-fighter-perk="${index}"]`).forEach((select, slot) => {
      select.value = fighter.perks[slot] || "";
    });
    if (index === 0) {
      document.querySelectorAll("[data-player-buff-slot]").forEach((select, slot) => {
        select.value = fighter.buffLoadout?.buffDefinitionIds?.[slot] || "";
      });
    }
    ["buffs", "injuries"].forEach((type) => {
      const list = document.querySelector(`[data-effect-list="${type}"][data-fighter-index="${index}"]`);
      list.innerHTML = "";
      (fighter[type] || []).forEach((effectId) => appendEffectRow(index, type, effectId));
    });
  });
  renderPerkSlotDescriptions();
};

const readFighter = (index) => {
  const form = document.querySelector(`[data-fighter-form="${index}"]`);
  const read = (field) => form.querySelector(`[data-field="${field}"]`).value;
  return {
    id: `fighter-${index + 1}`,
    name: read("name").trim() || `Боец ${index + 1}`,
    base: {
      strength: Number(read("strength")),
      health: Number(read("health")),
      charisma: Number(read("charisma")),
    },
    criticalChance: Number(read("criticalChance")),
    classTechniqueChance: Number(read("classTechniqueChance")),
    equipment: {
      weaponSet: { definitionId: form.querySelector('[data-equipment-slot="weapon"]').value },
      armorSet: { definitionId: form.querySelector('[data-equipment-slot="armor"]').value },
    },
    fighterClass: form.querySelector("[data-fighter-class]").value,
    perks: [...new Set(
      [...document.querySelectorAll(`[data-fighter-perk="${index}"]`)]
        .map((select) => select.value)
        .filter(Boolean),
    )],
    buffs: [...document.querySelectorAll(`[data-fighter-effect="${index}"][data-effect-type="buffs"]`)]
      .map((select) => select.value)
      .filter(Boolean),
    buffLoadout: {
      buffDefinitionIds: index === 0
        ? [...document.querySelectorAll("[data-player-buff-slot]")].map((select) => select.value).filter(Boolean)
        : [],
    },
    injuries: [...document.querySelectorAll(`[data-fighter-effect="${index}"][data-effect-type="injuries"]`)]
      .map((select) => select.value)
      .filter(Boolean),
  };
};

const readInput = () => ({
  seed: elements.seed.value.trim() || "gladiator-prototype",
  maxSteps: Number(elements.maxSteps.value),
  arena: {
    type: elements.arenaType.value,
    supportMultipliers: [Number(elements.multiplier1.value), Number(elements.multiplier2.value)],
  },
  fighters: [readFighter(0), readFighter(1)],
  playerBuffCommands: [],
});

const setPredictionMessage = (message, state = "is-empty") => {
  if (!elements.predictionResult) return;
  elements.predictionResult.className = `prediction-result ${state}`;
  elements.predictionResult.innerHTML = `<p>${escapeHtml(message)}</p>`;
};

const invalidatePrediction = () => {
  predictionRunId += 1;
  elements.predictionResult?.removeAttribute("aria-busy");
  if (elements.calculatePrediction) {
    elements.calculatePrediction.disabled = false;
    elements.calculatePrediction.textContent = "◎ Рассчитать прогноз";
  }
  setPredictionMessage("Настройки изменились — рассчитайте прогноз заново.");
};

const wilsonInterval = (successes, samples) => {
  const probability = successes / samples;
  const z = 1.96;
  const zSquared = z * z;
  const denominator = 1 + zSquared / samples;
  const center = (probability + zSquared / (2 * samples)) / denominator;
  const margin = z * Math.sqrt(
    probability * (1 - probability) / samples + zSquared / (4 * samples * samples),
  ) / denominator;
  return [Math.max(0, center - margin), Math.min(1, center + margin)];
};

const renderPrediction = ({ samples, wins, draws, totalSteps, fighters, exactResult, baseSeed }) => {
  const exactWinner = exactResult.outcome.type === "draw"
    ? null
    : exactResult.fighters.find((fighter) => fighter.id === exactResult.outcome.winnerId);
  const exactOutcome = exactWinner
    ? `${exactWinner.name} победит за ${exactResult.steps} ходов`
    : `ничья после ${exactResult.steps} ходов`;
  const fighterCards = fighters.map((fighter) => {
    const fighterWins = wins.get(fighter.id) || 0;
    const winRate = fighterWins / samples;
    const [intervalMin, intervalMax] = wilsonInterval(fighterWins, samples);
    return `
      <article class="prediction-fighter">
        <div class="prediction-fighter-header">
          <span>${escapeHtml(fighter.name)}</span>
          <strong>${percent(winRate)}</strong>
        </div>
        <div class="prediction-bar" aria-label="Вероятность победы ${percent(winRate)}">
          <i style="width: ${Math.max(0, Math.min(100, winRate * 100))}%"></i>
        </div>
        <small>${fighterWins} побед из ${samples}</small>
        <small>95%-й диапазон: ${percent(intervalMin)}–${percent(intervalMax)}</small>
      </article>`;
  }).join("");
  elements.predictionResult.className = "prediction-result";
  elements.predictionResult.innerHTML = `
    <p class="prediction-seed-outcome">
      Текущий seed <code>${escapeHtml(baseSeed)}</code>: <strong>${escapeHtml(exactOutcome)}</strong> без ручных бафов.
    </p>
    ${fighterCards}
    <p class="prediction-summary">
      Ничья: <strong>${percent(draws / samples)}</strong> ·
      средняя длительность: <strong>${formatNumber(totalSteps / samples, 1)} хода</strong> ·
      выборка: <strong>${samples} боёв</strong>
    </p>`;
};

const calculatePrediction = async () => {
  if (!elements.form.reportValidity()) return;
  const runId = ++predictionRunId;
  const samples = Number(elements.predictionSamples?.value) || 100;
  const baseInput = readInput();
  const wins = new Map(baseInput.fighters.map((fighter) => [fighter.id, 0]));
  let draws = 0;
  let totalSteps = 0;

  elements.calculatePrediction.disabled = true;
  elements.calculatePrediction.textContent = "Считаем…";
  elements.predictionResult?.setAttribute("aria-busy", "true");
  setPredictionMessage(`Выполнено 0 из ${samples} боёв…`, "is-progress");

  try {
    const exactResult = new BattleEngine(JSON.parse(JSON.stringify(baseInput))).simulate();
    for (let index = 0; index < samples; index += 1) {
      const sampleInput = JSON.parse(JSON.stringify(baseInput));
      sampleInput.seed = `${baseInput.seed}::prediction-${index + 1}`;
      const result = new BattleEngine(sampleInput).simulate();
      totalSteps += result.steps;
      if (result.outcome.type === "draw") {
        draws += 1;
      } else {
        wins.set(result.outcome.winnerId, (wins.get(result.outcome.winnerId) || 0) + 1);
      }

      if ((index + 1) % 5 === 0 && index + 1 < samples) {
        if (runId !== predictionRunId) return;
        setPredictionMessage(`Выполнено ${index + 1} из ${samples} боёв…`, "is-progress");
        await new Promise((resolve) => window.setTimeout(resolve, 0));
      }
    }
    if (runId !== predictionRunId) return;
    renderPrediction({
      samples,
      wins,
      draws,
      totalSteps,
      fighters: baseInput.fighters,
      exactResult,
      baseSeed: baseInput.seed,
    });
  } catch (error) {
    console.error(error);
    if (runId === predictionRunId) setPredictionMessage(`Не удалось построить прогноз: ${error.message}`);
  } finally {
    if (runId === predictionRunId) {
      elements.calculatePrediction.disabled = false;
      elements.calculatePrediction.textContent = "↻ Пересчитать прогноз";
      elements.predictionResult?.removeAttribute("aria-busy");
    }
  }
};

const statusLabel = (fighter) => {
  const healthRatio = fighter.health / fighter.maxHealth;
  if (fighter.health <= 0) return "ПОВЕРЖЕН";
  if (fighter.activeEffects?.some((effect) => effect.id === "player-stunned")) return "ОГЛУШЁН";
  if (healthRatio <= 0.2) return "ЕДВА СТОИТ";
  if (healthRatio < 0.45) return "РАНЕН";
  if (fighter.fatigue >= 85) return "ИЗМОЖДЁН";
  if (fighter.fatigue >= 55) return "ТЯЖЕЛО ДЫШИТ";
  if (healthRatio <= 0.55) return "ДЕРЖИТСЯ";
  return "СВЕЖ И СОБРАН";
};

const conditionGlyph = (conditionId) => {
  if (conditionId === "player-forward") return "➤";
  if (conditionId === "player-forward-penalty") return "↓";
  if (conditionId === "player-stunned") return "✹";
  if (conditionId === "player-hold-on") return "◆";
  if (conditionId === "player-hold-on-penalty") return "↓";
  if (conditionId.includes("leg")) return "⌁";
  if (conditionId.includes("arm")) return "†";
  if (conditionId.includes("head")) return "◉";
  if (conditionId.includes("ribs")) return "≋";
  if (conditionId.includes("exhaust")) return "⌛";
  if (conditionId.includes("post-battle")) return "☠";
  return "✦";
};

const mobileConditions = (fighter) => {
  const injuries = fighter.injuries || [];
  const startingTraumaTypes = new Set(injuries.flatMap((injuryId) => (
    injuryId === "leg-damage" ? ["leg"] : injuryId === "arm-damage" ? ["arm"] : []
  )));
  return [
    ...(fighter.activeEffects || []).map((effect) => ({
      id: effect.id,
      label: effect.id === "player-forward"
        ? `Вперёд! · осталось ${effect.remainingIterations}`
        : effect.id === "player-forward-penalty"
          ? "Последствие «Вперёд!» · −8 инициативы"
          : effect.id === "player-stunned"
            ? `Оглушение · осталось ${effect.remainingIterations}`
            : effect.id === "player-hold-on"
              ? `Держись! · +${formatNumber(effect.temporaryHealth)} временного здоровья · осталось ${effect.remainingIterations}`
              : effect.id === "player-hold-on-penalty"
                ? "Последствие «Держись!» · получаемый урон +25%"
            : effect.id,
      source: effect.kind === "status" ? "status" : effect.kind,
    })),
    ...injuries.map((injuryId) => ({
      id: injuryId,
      label: modifierName(injuryId),
      source: "injury",
    })),
    ...(fighter.traumas || [])
      .filter((trauma) => trauma.source !== "starting-injury" || !startingTraumaTypes.has(trauma.type))
      .map((trauma) => ({
        id: trauma.type || "trauma",
        label: trauma.type === "arm"
          ? "Травма руки"
          : trauma.type === "leg"
            ? "Травма ноги"
            : trauma.type === "post-battle"
              ? "Итоговая травма"
              : "Боевая травма",
        source: "trauma",
      })),
  ];
};

const combatConditionDescription = (fighter) => {
  const healthRatio = fighter.health / Math.max(1, fighter.maxHealth);
  if (fighter.health <= 0) return "Здоровье исчерпано; боец больше не участвует в действиях.";
  if (fighter.activeEffects?.some((effect) => effect.id === "player-stunned")) {
    return "Боец оглушён и пропускает следующую итерацию выбора действия.";
  }
  if (healthRatio <= 0.2) return "Критически мало здоровья: боец едва держится на ногах.";
  if (healthRatio < 0.45) return "Тяжёлое ранение заметно изменяет стойку бойца.";
  if (fighter.fatigue >= 85) return "Крайняя усталость сильно снижает эффективную силу и инициативу.";
  if (fighter.fatigue >= 55) return "Высокая усталость снижает эффективную силу и инициативу.";
  if (healthRatio <= 0.55) return "Здоровье опустилось ниже безопасного уровня.";
  return "Нет критических состояний здоровья или усталости.";
};

const fighterStateEntries = (fighter) => {
  const entries = [{
    kind: "condition",
    name: statusLabel(fighter),
    description: combatConditionDescription(fighter),
  }];
  (fighter.activeEffects || []).forEach((effect) => {
    if (effect.id === "player-forward") {
      entries.push({
        kind: "buff",
        name: "Вперёд!",
        description: `Инициатива повышена на 18. Осталось итераций: ${effect.remainingIterations}; после истечения появится штраф −8.`,
      });
    } else if (effect.id === "player-forward-penalty") {
      entries.push({
        kind: "debuff",
        name: "Последствие «Вперёд!»",
        description: "Инициатива снижена на 8 до конца боя.",
      });
    } else if (effect.id === "player-stunned") {
      entries.push({
        kind: "status",
        name: "Оглушение",
        description: `Боец не может быть выбран для действия. Осталось итераций: ${effect.remainingIterations}.`,
      });
    } else if (effect.id === "player-hold-on") {
      entries.push({
        kind: "buff",
        name: "Держись!",
        description: `Временное здоровье: ${formatNumber(effect.temporaryHealth)}. Осталось итераций: ${effect.remainingIterations}; затем получаемый урон увеличится на 25%.`,
      });
    } else if (effect.id === "player-hold-on-penalty") {
      entries.push({
        kind: "debuff",
        name: "Последствие «Держись!»",
        description: "Получаемый урон увеличен на 25% до конца боя.",
      });
    }
  });
  (fighter.buffs || []).forEach((buffId) => {
    const definition = BUFF_DEFINITIONS.find((item) => item.id === buffId);
    entries.push({ kind: "buff", name: definition?.name || buffId, description: definition?.description || "Временный эффект боя." });
  });
  (fighter.injuries || []).forEach((injuryId) => {
    const definition = INJURY_DEFINITIONS.find((item) => item.id === injuryId);
    entries.push({ kind: "injury", name: definition?.name || injuryId, description: definition?.description || "Стартовая травма бойца." });
  });
  (fighter.traumas || []).forEach((trauma) => {
    const traumaDescription = trauma.type === "arm"
      ? "Травма руки снижает текущую силу на 15%."
      : trauma.type === "leg"
        ? "Травма ноги снижает инициативу на 9."
        : trauma.type === "post-battle"
          ? "Итоговая травма, полученная после завершения боя."
          : "Боевая травма влияет на состояние бойца.";
    entries.push({
      kind: "trauma",
      name: trauma.type === "arm" ? "Травма руки" : trauma.type === "leg" ? "Травма ноги" : "Итоговая травма",
      description: `${traumaDescription} Получена на итерации ${trauma.step}.`,
    });
  });
  (fighter.perks || []).forEach((perkId) => {
    const definition = PERK_DEFINITIONS.find((item) => item.id === perkId);
    entries.push({ kind: "perk", name: definition?.name || perkId, description: definition?.description || "Постоянный перк бойца." });
  });
  return entries;
};

const renderFighterStateEntries = (fighter) => {
  const entries = fighterStateEntries(fighter);
  return `
    <section class="fighter-state-panel">
      <h4><span>Состояния и эффекты</span><b>${entries.length}</b></h4>
      <ul>
        ${entries.map((entry) => `
          <li class="fighter-state-${escapeHtml(entry.kind)}">
            <div><strong>${escapeHtml(entry.name)}</strong><small>${escapeHtml(entry.kind)}</small></div>
            <p>${escapeHtml(entry.description)}</p>
          </li>
        `).join("")}
      </ul>
    </section>
  `;
};

const meterRow = (label, value, max, className, displayValue = null) => {
  const width = Math.max(0, Math.min(100, (value / max) * 100));
  return `
    <div class="meter-row">
      <span>${escapeHtml(label)}</span>
      <div class="meter ${className}"><i style="width:${width}%"></i></div>
      <output>${escapeHtml(displayValue ?? formatNumber(value))}</output>
    </div>
  `;
};

const fitMobileBattleFeed = () => {
  if (!elements.mobileBattleStory || !elements.mobileBattleFeed) return;
  const storyStyle = window.getComputedStyle(elements.mobileBattleStory);
  const bottomPadding = Number.parseFloat(storyStyle.paddingBottom) || 0;
  const availableHeight = Math.max(
    0,
    elements.mobileBattleStory.clientHeight
      - elements.mobileBattleFeed.offsetTop
      - bottomPadding
      - 5,
  );
  while (
    elements.mobileBattleFeed.children.length > 1
    && elements.mobileBattleFeed.scrollHeight > availableHeight
  ) {
    elements.mobileBattleFeed.firstElementChild.remove();
  }
  elements.mobileBattleFeed.dataset.visibleEntries = String(elements.mobileBattleFeed.children.length);
};

const updateMobileBattleFeed = (entries) => {
  if (!elements.mobileBattleFeed || !elements.mobileBattleStory) return;

  const oldItems = [...elements.mobileBattleFeed.children];
  const oldPositions = new Map();
  const reusableItems = new Map();
  oldItems.forEach((item) => {
    const key = item.dataset.storyKey;
    if (!key) return;
    oldPositions.set(key, item.getBoundingClientRect().top);
    reusableItems.set(key, item);
    item.getAnimations?.().forEach((animation) => animation.cancel());
  });

  const fragment = document.createDocumentFragment();
  entries.forEach((entry) => {
    const key = mobileStoryKey(entry);
    fragment.append(reusableItems.get(key) || createMobileStoryEntryNode(entry));
  });
  elements.mobileBattleFeed.replaceChildren(fragment);
  fitMobileBattleFeed();

  const visibleItems = [...elements.mobileBattleFeed.children];
  const previousSignature = oldItems.map((item) => item.dataset.storyKey || "").join("\n");
  const nextSignature = visibleItems.map((item) => item.dataset.storyKey || "").join("\n");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (previousSignature === nextSignature || reduceMotion || typeof visibleItems[0]?.animate !== "function") return;

  const token = ++mobileStoryScrollToken;
  elements.mobileBattleStory.classList.add("is-scrolling");
  window.requestAnimationFrame(() => {
    if (token !== mobileStoryScrollToken) return;
    const animations = visibleItems.map((item) => {
      const oldTop = oldPositions.get(item.dataset.storyKey);
      const newTop = item.getBoundingClientRect().top;
      const isNew = oldTop === undefined;
      const offset = isNew ? 20 : oldTop - newTop;
      if (!isNew && Math.abs(offset) < 0.5) return null;

      return item.animate([
        {
          transform: `translateY(${offset}px) rotate(${isNew ? "0.18deg" : "-0.08deg"})`,
          opacity: isNew ? 0.08 : 1,
          filter: isNew ? "sepia(.45) blur(.25px)" : "none",
        },
        {
          transform: "translateY(0) rotate(0)",
          opacity: 1,
          filter: "none",
        },
      ], {
        duration: MOBILE_STORY_SCROLL_MS,
        easing: "cubic-bezier(.22, .75, .25, 1)",
        fill: "both",
      });
    }).filter(Boolean);

    if (!animations.length) {
      elements.mobileBattleStory.classList.remove("is-scrolling");
      return;
    }
    Promise.allSettled(animations.map((animation) => animation.finished)).then(() => {
      if (token !== mobileStoryScrollToken) return;
      animations.forEach((animation) => animation.cancel());
      elements.mobileBattleStory.classList.remove("is-scrolling");
    });
  });
};

const showMobileBuffStatus = (message, durationMs = 0) => {
  if (!elements.mobileBuffControl || !elements.mobileBuffStatus) return;
  clearTimeout(mobileBuffStatusTimer);
  elements.mobileBuffStatus.textContent = message;
  elements.mobileBuffControl.classList.add("show-status");
  if (durationMs > 0) {
    mobileBuffStatusTimer = window.setTimeout(() => {
      elements.mobileBuffControl?.classList.remove("show-status");
    }, durationMs);
  }
};

const setMobileBuffMenuOpen = (open) => {
  if (!elements.mobileBuffControl || !elements.mobileBuffTrigger) return;
  elements.mobileBuffControl.dataset.open = String(open);
  elements.mobileBuffTrigger.setAttribute("aria-expanded", String(open));
  elements.mobileBuffTrigger.setAttribute(
    "aria-label",
    open
      ? "Закрыть боевые усиления"
      : elements.mobileBuffTrigger.disabled
        ? "Усиления доступны только во время боя"
        : "Открыть боевые усиления. На мобильном устройстве удерживайте кнопку",
  );
  if (!open) {
    elements.mobileBuffControl.classList.remove("show-status");
  }
};

const stopMobileBuffHold = () => {
  clearTimeout(mobileBuffHoldTimer);
  mobileBuffHoldTimer = null;
  elements.mobileBuffControl?.classList.remove("is-pressing");
};

const setMobileBuffAvailability = (available, unavailableLabel = "Усиления доступны только во время боя") => {
  if (!elements.mobileBuffTrigger) return;
  elements.mobileBuffTrigger.disabled = !available;
  elements.mobileBuffTrigger.title = available
    ? "Боевые усиления"
    : unavailableLabel;
  if (available) {
    elements.mobileBuffTrigger.setAttribute(
      "aria-label",
      "Открыть боевые усиления. На мобильном устройстве удерживайте кнопку",
    );
  }
  if (!available) {
    elements.mobileBuffTrigger.setAttribute("aria-label", unavailableLabel);
    stopMobileBuffHold();
    setMobileBuffMenuOpen(false);
  }
};

const playerBuffRejectionLabel = (reason) => ({
  "zero-fatigue": "Усталости ещё нет",
  "already-used": "Это усиление уже использовано",
  "battle-limit-reached": "Лимит усилений исчерпан",
  "battle-finished": "Бой уже завершён",
  "not-in-loadout": "Усиления нет в наборе",
}[reason] || "Усиление сейчас недоступно");

const applyPlayerBuffFromUi = (option) => {
  if (!currentResult || option.disabled) return;
  const label = option.querySelector("b")?.textContent?.trim() || "Усиление";
  const glyph = option.querySelector("span")?.textContent || "✹";
  const snapshot = currentResult.snapshots[currentSnapshotIndex];
  const fighterId = currentResult.input.fighters[0].id;
  const commandSequence = ++playerBuffCommandSequence;
  const command = {
    type: "apply-player-buff",
    fighterId,
    buffDefinitionId: option.dataset.buffChoice,
    afterIteration: snapshot.step,
    commandSequence,
  };
  const wasPlaying = isPlaying;
  clearPlayback();
  const nextInput = JSON.parse(JSON.stringify(currentResult.input));
  nextInput.playerBuffCommands = [...(nextInput.playerBuffCommands || []), command];
  const nextResult = new BattleEngine(nextInput).simulate();
  const commandEvent = nextResult.events.find((event) => (
    ["player-buff.applied", "player-buff.rejected"].includes(event.type)
      && event.data.command?.commandSequence === commandSequence
  ));
  currentResult = nextResult;
  elements.slider.max = currentResult.snapshots.length - 1;
  const accepted = commandEvent?.type === "player-buff.applied";
  let targetIndex = currentResult.snapshots.findIndex((item) => (
    item.playerBuffs?.applications?.some((application) => application.commandSequence === commandSequence)
  ));
  if (accepted && option.dataset.buffChoice === "now") {
    const specialIndex = currentResult.snapshots.findIndex((item) => (
      item.lastAction?.playerBuffApplicationId === commandEvent.data.application.applicationId
    ));
    if (specialIndex >= 0) targetIndex = specialIndex;
  }
  if (targetIndex < 0) {
    targetIndex = currentResult.snapshots.reduce((best, item, index) => (
      item.step <= snapshot.step ? index : best
    ), 0);
  }
  hideBattleReport();
  renderSnapshot(targetIndex);
  setMobileBuffMenuOpen(false);
  if (accepted) {
    const triggerGlyph = elements.mobileBuffTrigger?.querySelector(".mobile-buff-trigger-icon");
    if (triggerGlyph) triggerGlyph.textContent = glyph;
    showMobileBuffStatus(`${label} · применено`, 1600);
    if (wasPlaying && currentSnapshotIndex < currentResult.snapshots.length - 1) playBattle();
  } else {
    showMobileBuffStatus(playerBuffRejectionLabel(commandEvent?.data.reason), 1600);
  }
};

const renderMobileBuffControls = (snapshot, input) => {
  const fighterId = input.fighters[0]?.id;
  const fighterBuffs = snapshot.playerBuffs?.fighters?.[fighterId];
  const inProgress = Boolean(currentResult) && snapshot.label !== "Итог боя" && snapshot.status !== "finished";
  const appliedCount = fighterBuffs?.appliedCount || 0;
  const loadout = fighterBuffs?.buffs || [];
  const loadoutIds = loadout.map((buff) => buff.definitionId);
  const remaining = Math.min(
    Math.max(0, 3 - appliedCount),
    loadout.filter((buff) => buff.state === "available").length,
  );
  const count = elements.mobileBuffTrigger?.querySelector(".mobile-buff-trigger-count");
  if (count) {
    count.textContent = String(remaining);
    count.setAttribute("aria-label", `Доступно усилений: ${remaining}`);
  }
  elements.mobileBuffOptions.forEach((option) => {
    const definition = PLAYER_BUFF_DEFINITIONS.find((item) => item.id === option.dataset.buffChoice);
    const slot = loadoutIds.indexOf(option.dataset.buffChoice);
    const state = loadout.find((item) => item.definitionId === option.dataset.buffChoice)?.state || "unselected";
    option.hidden = slot < 0;
    if (slot >= 0) option.dataset.buffSlot = String(slot);
    else delete option.dataset.buffSlot;
    option.disabled = slot < 0 || !inProgress || state !== "available" || remaining <= 0;
    option.classList.toggle("is-active", state === "active");
    option.classList.toggle("is-used", state === "used");
    const stateLabel = state === "active" ? "Активно" : state === "used" ? "Использовано" : state === "available" ? "Доступно" : "Не выбрано";
    option.setAttribute("aria-label", `${definition?.name || option.dataset.buffChoice}. ${definition?.description || ""} ${stateLabel}`);
  });
  setMobileBuffAvailability(
    inProgress && remaining > 0 && loadoutIds.length > 0,
    inProgress
      ? loadoutIds.length > 0 ? "Все усиления использованы" : "Набор усилений пуст"
      : "Усиления доступны только во время боя",
  );
};

const renderMobileBattleUi = (snapshot, input) => {
  if (!snapshot || !elements.mobileArenaHeader || !elements.mobileBattleFeed) return;
  renderMobileBuffControls(snapshot, input);
  fighterBloodLevels(snapshot).forEach((level, index) => {
    const bloodLayer = elements.mobileBattleStory
      ?.querySelector(`.mobile-story-blood.side-${index + 1}`);
    bloodLayer?.querySelectorAll(".mobile-story-stain").forEach((stain, stainIndex) => {
      const progress = bloodStainProgress(level, stainIndex);
      const growthLimit = bloodStainGrowthLimit(snapshot.fighters[index]?.id || index, stainIndex);
      const visibleGrowth = Math.min(progress, growthLimit);
      stain.style.setProperty("--stain-opacity", progress > 0
        ? (0.14 + visibleGrowth * 0.38).toFixed(3)
        : "0");
      stain.style.setProperty("--stain-scale", (0.62 + visibleGrowth * 0.58).toFixed(3));
    });
    bloodLayer?.querySelectorAll(".mobile-story-splash").forEach((splash, splashIndex) => {
      splash.classList.toggle("is-visible", bloodSplashVisible(level, splashIndex));
    });
  });
  const arena = arenaName(snapshot.arena?.type || input.arena.type);
  const spectacle = snapshot.spectacle || { score: 0, tier: "boring" };
  const spectacleLevel = spectacleTier(spectacle.tier);
  const isFinalSpectacle = snapshot.label === "Итог боя";
  const fighters = snapshot.fighters.map((fighter, index) => {
    const health = Math.max(0, fighter.health);
    const healthRatio = Math.max(0, Math.min(1, health / fighter.maxHealth));
    const fatigueRatio = Math.max(0, Math.min(1, fighter.fatigue / 150));
    const conditions = mobileConditions(fighter);
    const visibleConditions = conditions.slice(0, 3);
    const conditionSlots = Array.from({ length: 3 }, (_, slotIndex) => {
      const condition = visibleConditions[slotIndex];
      if (condition) {
        return `<i class="condition-${condition.source}" title="${escapeHtml(condition.label)}">${conditionGlyph(condition.id)}</i>`;
      }
      if (!conditions.length && slotIndex === 0) {
        return "<i class=\"condition-clear\" title=\"Травм нет\">◇</i>";
      }
      return "<i class=\"condition-empty\" aria-hidden=\"true\"></i>";
    }).join("");
    const conditionLabel = conditions.length
      ? conditions.map((condition) => condition.label).join(", ")
      : "Травм нет";
    return `
      <article class="mobile-fighter-card side-${index + 1}">
        <span class="mobile-fighter-avatar" data-fighter-class="${escapeHtml(fighter.fighterClass)}" aria-hidden="true"></span>
        <div class="mobile-fighter-copy">
          <strong>${escapeHtml(fighter.name)}</strong>
          <small>${escapeHtml(fighterClassName(fighter.fighterClass))}</small>
          <div class="mobile-health-track ${fighter.temporaryHealth > 0 ? "has-temporary-health" : ""}" aria-label="Здоровье ${escapeHtml(fighter.name)}${fighter.temporaryHealth > 0 ? `, временное здоровье ${formatNumber(fighter.temporaryHealth)}` : ""}">
            <i style="width:${healthRatio * 100}%"></i>
            <span>${formatNumber(health)} / ${formatNumber(fighter.maxHealth)}${fighter.temporaryHealth > 0 ? ` · +${formatNumber(fighter.temporaryHealth)}` : ""}</span>
          </div>
          <div class="mobile-fatigue" aria-label="Усталость ${escapeHtml(fighter.name)}: ${formatNumber(fighter.fatigue)} из 150">
            <span>УСТ</span>
            <div class="mobile-fatigue-track"><i style="width:${fatigueRatio * 100}%"></i></div>
          </div>
          <div class="mobile-condition-strip">
            <div class="mobile-condition-icons" aria-label="${escapeHtml(conditionLabel)}">
              ${conditionSlots}
              <b class="condition-overflow">${conditions.length > visibleConditions.length ? `+${conditions.length - visibleConditions.length}` : ""}</b>
            </div>
          </div>
        </div>
      </article>
    `;
  });
  elements.mobileArenaHeader.innerHTML = `
    <div class="mobile-arena-title">
      <b>АРЕНА</b>
      <span>${escapeHtml(arena)} · раунд ${formatNumber(snapshot.step)}</span>
    </div>
    <div class="mobile-versus">
      ${fighters[0]}
      <div class="mobile-versus-center">
        <strong class="mobile-vs">VS</strong>
      </div>
      ${fighters[1]}
      <span class="mobile-spectacle-meter" aria-label="Зрелищность: ${spectacle.score}, ${escapeHtml(spectacleLevel.label)}" title="${escapeHtml(spectacleLevel.label)}">
        ${SPECTACLE_ICON}<b>${spectacle.score}</b>
      </span>
    </div>
  `;
  if (elements.mobileSpectacleVerdict) {
    elements.mobileSpectacleVerdict.hidden = !isFinalSpectacle;
    elements.mobileSpectacleVerdict.innerHTML = isFinalSpectacle ? `
      ${SPECTACLE_ICON}
      <strong>${escapeHtml(spectacleLevel.label)}</strong>
      <small>Зрелищность ${spectacle.score}${currentResult?.reward ? ` · награда ${currentResult.reward.amount}` : ""}</small>
    ` : "";
  }

  const recentStory = buildBattleStoryEntries(currentResult, snapshot, 60);
  updateMobileBattleFeed(recentStory.length
    ? recentStory
    : [{ kind: "empty", step: -1, className: "empty", text: "Бой ещё не начался." }]);
};

const renderNumbers = (snapshot) => {
  if (!snapshot) return;
  const input = currentResult?.input || readInput();
  const lastAction = snapshot.lastAction;
  const actor = lastAction ? snapshot.fighters.find((fighter) => fighter.id === lastAction.actorId) : null;
  const target = lastAction ? snapshot.fighters.find((fighter) => fighter.id === lastAction.targetId) : null;
  const actionState = lastAction
    ? `${actor?.name || lastAction.actorId} → ${target?.name || lastAction.targetId} · ${lastAction.attackType || "действие"} · ${lastAction.outcome || "без исхода"}`
    : "Ожидание симуляции";
  renderMobileBattleUi(snapshot, input);
  elements.snapshotDetails.innerHTML = `
    <div><span>АРЕНА</span><strong>${escapeHtml(arenaName(snapshot.arena?.type || input.arena.type))}</strong></div>
    <div><span>SEED</span><strong>${escapeHtml(currentResult?.seed || input.seed)}</strong></div>
    <div><span>ШАГ</span><strong>${formatNumber(snapshot.step)} / ${formatNumber(input.maxSteps)}</strong></div>
    <div><span>ЗРЕЛИЩНОСТЬ</span><strong>${formatNumber(snapshot.spectacle?.score || 0)} · ${escapeHtml(spectacleTier(snapshot.spectacle?.tier).label)}</strong></div>
    <div class="snapshot-action"><span>ДЕЙСТВИЕ</span><strong>${escapeHtml(actionState)}</strong></div>
  `;
  elements.fighterNumbers.innerHTML = snapshot.fighters.map((fighter, index) => {
    const base = input.fighters[index].base;
    const multiplier = snapshot.arena.supportMultipliers[index];
    return `
      <article class="number-card fighter-${index === 0 ? "one" : "two"}">
        <h3>
          <span>${escapeHtml(fighter.name)}</span>
          <small>${statusLabel(fighter)}</small>
        </h3>
        ${meterRow("Здоровье", Math.max(0, fighter.health), fighter.maxHealth, "health", `${formatNumber(fighter.health)} / ${formatNumber(fighter.maxHealth)}`)}
        ${fighter.temporaryHealth > 0 ? meterRow("Временное здоровье", fighter.temporaryHealth, fighter.maxHealth * 0.2, "temporary-health", `+${formatNumber(fighter.temporaryHealth)}`) : ""}
        ${meterRow("Сила", fighter.strength, 150, "strength", `${formatNumber(fighter.strength)} / база ${base.strength}`)}
        ${meterRow("Поддержка", fighter.support, 150, "support")}
        ${meterRow("Инициатива", fighter.initiative, 150, "initiative")}
        ${meterRow("Усталость", fighter.fatigue, 150, "fatigue")}
        ${renderCombatParameters(fighter, base, multiplier)}
        ${renderFighterStateEntries(fighter)}
      </article>
    `;
  }).join("");
};


const renderSnapshot = (index) => {
  if (!currentResult) return;
  currentSnapshotIndex = Math.max(0, Math.min(index, currentResult.snapshots.length - 1));
  const snapshot = currentResult.snapshots[currentSnapshotIndex];
  elements.slider.value = currentSnapshotIndex;
  elements.snapshotLabel.textContent = `#${currentSnapshotIndex} · ${snapshot.label}`;
  elements.arenaStep.textContent = `${snapshot.step} / ${currentResult.input.maxSteps}`;
  elements.battleCallout.textContent = snapshot.label;
  elements.battleCallout.className = "battle-callout";
  if (snapshot.label !== "Итог боя" && snapshot.lastAction?.attackType === "achilles-leap") {
    elements.battleCallout.classList.add("achilles-leap");
  } else if (snapshot.label !== "Итог боя" && snapshot.lastAction?.outcome) {
    elements.battleCallout.classList.add(snapshot.lastAction.outcome);
  }
  if (snapshot.outcome?.type === "victory") elements.battleCallout.classList.add("victory");
  if (snapshot.outcome?.type === "draw") elements.battleCallout.classList.add("draw");
  renderNumbers(snapshot);
  renderVisual(snapshot, currentResult.input);
};

const renderEventState = (event) => {
  if (!currentResult || !event?.state) return;
  const state = event.state;
  const snapshot = {
    step: state.step,
    label: state.status === "finished" ? "Итог боя" : `Событие #${event.sequence}`,
    status: state.status,
    outcome: state.outcome,
    spectacle: state.spectacle,
    lastAction: state.lastAction,
    arena: state.arena,
    fighters: state.fighters,
  };
  elements.snapshotLabel.textContent = `EVENT #${event.sequence} · ${event.phase} / ${event.type}`;
  elements.arenaStep.textContent = `${state.step} / ${currentResult.input.maxSteps}`;
  elements.battleCallout.textContent = `#${event.sequence} · ${event.message}`;
  elements.battleCallout.className = "battle-callout";
  if (snapshot.label !== "Итог боя" && snapshot.lastAction?.outcome) {
    elements.battleCallout.classList.add(snapshot.lastAction.outcome);
  }
  if (state.outcome?.type === "victory") elements.battleCallout.classList.add("victory");
  if (state.outcome?.type === "draw") elements.battleCallout.classList.add("draw");
  renderNumbers(snapshot);
  renderVisual(snapshot, currentResult.input);
};

const renderResult = (result) => {
  const isDraw = result.outcome.type === "draw";
  const winner = isDraw ? null : result.fighters.find((fighter) => fighter.id === result.outcome.winnerId);
  const outcomeLabels = { victory: "ПОБЕДА", defeat: "ПОРАЖЕНИЕ", draw: "НИЧЬЯ" };
  elements.resultTitle.textContent = isDraw ? "НИЧЬЯ" : `${winner.name} ПОБЕЖДАЕТ`;
  elements.resultDescription.textContent = isDraw
    ? `За ${result.steps} шагов победитель не определён. ${spectacleTier(result.spectacle.tier).label}: ${result.spectacle.score}, награда ${result.reward.amount}.`
    : `Бой завершён за ${result.steps} шагов. ${spectacleTier(result.spectacle.tier).label}: ${result.spectacle.score}, награда ${result.reward.amount}.`;
  elements.fighterOutcomes.innerHTML = result.fighters.map((fighter) => `
    <article class="outcome-card">
      <h3>${escapeHtml(fighter.name)} — ${outcomeLabels[fighter.battleOutcome]}</h3>
      <dl>
        <dt>Судьба</dt><dd>${fighter.survived ? "ВЫЖИЛ" : "ПОГИБ"}</dd>
        <dt>Итоговая травма</dt><dd>${fighter.postBattleInjury ? "ДА" : "НЕТ"}</dd>
        <dt>Шанс гибели</dt><dd>${percent(fighter.deathChance)}</dd>
        <dt>Бросок гибели</dt><dd>${formatNumber(fighter.deathRoll, 6)}</dd>
        <dt>Шанс травмы</dt><dd>${percent(fighter.injuryChance)}</dd>
        <dt>Бросок травмы</dt><dd>${formatNumber(fighter.injuryRoll, 6)}</dd>
        <dt>Здоровье</dt><dd>${formatNumber(fighter.finalState.health)}</dd>
        <dt>Стартовые травмы</dt><dd>${fighter.startingInjuries.length}</dd>
        <dt>Новые травмы</dt><dd>${fighter.newTraumas.length}</dd>
        <dt>Всего физических травм</dt><dd>${fighter.finalTraumas.length}</dd>
      </dl>
    </article>
  `).join("");
  elements.resultPanel.hidden = false;
};

const renderBattleReport = () => {
  if (!currentResult) return;
  renderResult(currentResult);
  renderStatistics(currentResult);
  renderLog();
};

const hideBattleReport = () => {
  elements.resultPanel.hidden = true;
  elements.statisticsPanel.hidden = true;
  elements.logPanel.hidden = true;
};

const clearPlayback = () => {
  if (playbackTimer !== null) window.clearTimeout(playbackTimer);
  playbackTimer = null;
  isPlaying = false;
  elements.playPause.textContent = "▶";
  elements.playPause.title = "Продолжить воспроизведение";
};

const completePlayback = () => {
  clearPlayback();
  elements.playPause.textContent = "↻";
  elements.playPause.title = "Повторить бой";
  renderBattleReport();
};

const scheduleNextSnapshot = (delay = randomPlaybackDelay()) => {
  if (!isPlaying) return;
  playbackTimer = window.setTimeout(() => {
    if (!isPlaying || !currentResult) return;
    const nextIndex = currentSnapshotIndex + 1;
    if (nextIndex >= currentResult.snapshots.length) {
      completePlayback();
      return;
    }
    renderSnapshot(nextIndex);
    if (nextIndex === currentResult.snapshots.length - 1) {
      completePlayback();
    } else {
      scheduleNextSnapshot();
    }
  }, delay);
};

const playBattle = ({ restart = false } = {}) => {
  if (!currentResult) return;
  clearPlayback();
  if (restart || currentSnapshotIndex >= currentResult.snapshots.length - 1) {
    hideBattleReport();
    spriteVisualEngine?.resetEncounter();
    renderSnapshot(0);
  }
  isPlaying = true;
  elements.playPause.textContent = "Ⅱ";
  elements.playPause.title = "Поставить на паузу";
  scheduleNextSnapshot(restart ? INTRO_PLAYBACK_STEP_MS : randomPlaybackDelay());
};

const pauseAndRender = (index) => {
  clearPlayback();
  renderSnapshot(index);
  if (currentResult && currentSnapshotIndex === currentResult.snapshots.length - 1) {
    renderBattleReport();
    elements.playPause.textContent = "↻";
  }
};

const renderStatistics = (result) => {
  const columns = [
    ["actions", "Действия"],
    ["hits", "Попадания"],
    ["misses", "Промахи"],
    ["dodges", "Увороты"],
    ["blocks", "Блоки"],
    ["damageDealt", "Урон нанесён"],
    ["damageReceived", "Урон получен"],
    ["traumasReceived", "Травмы"],
    ["fatigueGained", "Усталость +"],
    ["modifierActivations", "Модификаторы"],
    ["maxConsecutiveActions", "Серия"],
  ];
  elements.statisticsTable.innerHTML = `
    <thead>
      <tr><th>Боец</th>${columns.map(([, title]) => `<th>${title}</th>`).join("")}</tr>
    </thead>
    <tbody>
      ${result.fighters.map((fighter) => {
        const stats = result.statistics[fighter.id];
        return `<tr><td>${escapeHtml(fighter.name)}</td>${columns.map(([key]) => `<td>${formatNumber(stats[key])}</td>`).join("")}</tr>`;
      }).join("")}
    </tbody>
  `;
  elements.statisticsPanel.hidden = false;
};

const keyEventTypes = new Set([
  "battle.initialized",
  "battle.victory",
  "battle.draw",
  "battle.finished",
  "effect.applied",
  "modifier.activated",
]);

const renderLog = () => {
  if (!currentResult) return;
  const query = elements.logFilter.value.trim().toLocaleLowerCase("ru-RU");
  const onlyKey = elements.keyEventsOnly.checked;
  const events = currentResult.events.filter((event) => {
    if (onlyKey && !keyEventTypes.has(event.type)) return false;
    if (!query) return true;
    return `${event.type} ${event.phase} ${event.message} ${JSON.stringify(event.data)} ${JSON.stringify(event.state)}`
      .toLocaleLowerCase("ru-RU")
      .includes(query);
  });
  elements.logSummary.textContent = `${events.length} из ${currentResult.events.length} событий · все фазы, хуки, броски и изменения`;
  elements.battleLog.innerHTML = events.map((event) => {
    const classes = ["log-entry"];
    if (keyEventTypes.has(event.type)) classes.push("key-event");
    if (event.type.startsWith("modifier.")) classes.push("modifier-event");
    return `
      <details class="${classes.join(" ")}" data-sequence="${event.sequence}">
        <summary>
          <span>#${event.sequence}</span>
          <span>S${event.step}</span>
          <span class="log-type">${escapeHtml(event.phase)} / ${escapeHtml(event.type)}</span>
          <span>${escapeHtml(event.message)}</span>
        </summary>
        <div class="log-entry-payload">
          <h4>Данные события</h4>
          <pre>${escapeHtml(JSON.stringify(event.data, null, 2))}</pre>
          <h4>Состояние после события</h4>
          <pre>${escapeHtml(JSON.stringify(event.state, null, 2))}</pre>
        </div>
      </details>
    `;
  }).join("") || "<p class=\"battle-callout\">События не найдены</p>";

  elements.battleLog.querySelectorAll("details").forEach((entry) => {
    entry.addEventListener("toggle", () => {
      if (!entry.open) return;
      const sequence = Number(entry.dataset.sequence);
      const event = currentResult.events.find((item) => item.sequence === sequence);
      renderEventState(event);
    });
  });
  elements.logPanel.hidden = false;
};

const downloadBattle = (event) => {
  if (!currentResult) return;
  const payload = createBattleLogExport(currentResult);
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = event.currentTarget;
  link.href = url;
  link.download = `battle-log-${currentResult.seed}-${Date.now()}.json`.replace(/[^a-zA-Z0-9._-]/g, "-");
  window.setTimeout(() => {
    URL.revokeObjectURL(url);
    link.removeAttribute("href");
  }, 1000);
};

const resetResults = () => {
  clearPlayback();
  playerBuffCommandSequence = 0;
  currentResult = null;
  currentSnapshotIndex = 0;
  elements.resultPanel.hidden = true;
  elements.statisticsPanel.hidden = true;
  elements.logPanel.hidden = true;
  elements.timeline.hidden = true;
  setBattleStartLabels("▶ Начать симуляцию", "▶ Начать бой");
};

const renderPreview = () => {
  const input = readInput();
  const normalizedInput = new BattleEngine(input).input;
  const snapshot = {
    step: 0,
    label: "Предварительный просмотр",
    arena: input.arena,
    lastAction: null,
    spectacle: { formulaVersion: "spectacle-v1", score: 0, tier: "boring" },
    fighters: normalizedInput.fighters.map((fighter, index) => {
      const weapon = equipmentItem(fighter.equipment.weaponSet.definitionId);
      const armor = equipmentItem(fighter.equipment.armorSet.definitionId);
      return ({
      id: fighter.id,
      name: fighter.name,
      health: fighter.base.health,
      maxHealth: fighter.base.health,
      temporaryHealth: 0,
      strength: fighter.base.strength,
      criticalChance: fighter.criticalChance,
      classTechniqueChance: fighter.classTechniqueChance,
      support: fighter.base.charisma * input.arena.supportMultipliers[index],
      initiative: 0,
      fatigue: 0,
      weaponPower: weapon.stats.weaponPower,
      accuracy: weapon.stats.accuracy,
      armor: armor.stats.armor,
      equipmentWeight: weapon.stats.weight + armor.stats.weight,
      mobility: armor.stats.mobility,
      fighterClass: fighter.fighterClass,
      weaponSet: fighter.equipment.weaponSet,
      armorSet: fighter.equipment.armorSet,
      equipmentPerks: [
        ...weapon.additionalPerkIds,
        ...armor.additionalPerkIds,
      ],
      perks: fighter.perks,
      buffs: fighter.buffs,
      injuries: fighter.injuries,
      traumas: [],
    }); }),
  };
  elements.arenaName.textContent = arenaName(input.arena.type);
  elements.arenaSeed.textContent = input.seed;
  elements.arenaStep.textContent = `0 / ${input.maxSteps}`;
  renderNumbers(snapshot);
  renderVisual(snapshot, input);
};

const startBattle = (event) => {
  event.preventDefault();
  if (!elements.form.reportValidity()) return;
  if (!isMobileFullscreenMode && window.matchMedia("(max-width: 700px)").matches) {
    setMobileFullscreenMode(true, { updateUrl: true, nativeFullscreen: true });
  }
  try {
    playerBuffCommandSequence = 0;
    const input = readInput();
    const engine = new BattleEngine(input);
    currentResult = engine.simulate();
    elements.arenaName.textContent = arenaName(currentResult.input.arena.type);
    elements.arenaSeed.textContent = currentResult.seed;
    elements.timeline.hidden = false;
    elements.slider.min = 0;
    elements.slider.max = currentResult.snapshots.length - 1;
    elements.slider.value = 0;
    hideBattleReport();
    setBattleStartLabels("↻ Запустить заново", "↻ Новый бой");
    playBattle({ restart: true });
  } catch (error) {
    console.error(error);
    elements.battleCallout.textContent = `Ошибка симуляции: ${error.message}`;
    elements.battleCallout.className = "battle-callout draw";
  }
};

populateMenus();
setFormFromInput(createSimulatorDefaultInput());
applyMobileViewportPreset();
renderPreview();

elements.form.addEventListener("submit", startBattle);
elements.form.addEventListener("input", () => {
  document.querySelectorAll("[data-equipment-picker]").forEach(updateEquipmentPreview);
  renderPerkSlotDescriptions();
  invalidatePrediction();
  if (!currentResult) renderPreview();
});
elements.form.addEventListener("click", (event) => {
  const classButton = event.target.closest("[data-class-choice]");
  if (classButton) {
    const picker = classButton.closest("[data-equipment-picker]");
    renderEquipmentPicker(Number(picker.dataset.equipmentPicker), classButton.dataset.classChoice);
    invalidatePrediction();
    if (!currentResult) renderPreview();
    return;
  }
  const addButton = event.target.closest("[data-add-effect]");
  if (addButton) {
    appendEffectRow(Number(addButton.dataset.fighterIndex), addButton.dataset.addEffect);
    renderPerkSlotDescriptions();
    invalidatePrediction();
    if (!currentResult) renderPreview();
    return;
  }
  const removeButton = event.target.closest("[data-remove-effect]");
  if (removeButton) {
    removeButton.closest(".dynamic-effect-row").remove();
    invalidatePrediction();
    if (!currentResult) renderPreview();
  }
});
elements.restoreDefaults.addEventListener("click", () => {
  resetResults();
  setFormFromInput(createSimulatorDefaultInput());
  invalidatePrediction();
  elements.battleCallout.textContent = "Настройте бойцов и запустите симуляцию";
  elements.battleCallout.className = "battle-callout idle";
  renderPreview();
});
elements.calculatePrediction?.addEventListener("click", calculatePrediction);
elements.predictionSamples?.addEventListener("change", invalidatePrediction);
elements.slider.addEventListener("input", () => pauseAndRender(Number(elements.slider.value)));
elements.previousStep.addEventListener("click", () => pauseAndRender(currentSnapshotIndex - 1));
elements.nextStep.addEventListener("click", () => pauseAndRender(currentSnapshotIndex + 1));
elements.playPause.addEventListener("click", () => {
  if (isPlaying) {
    clearPlayback();
  } else {
    playBattle({ restart: currentSnapshotIndex >= (currentResult?.snapshots.length || 1) - 1 });
  }
});
elements.downloadBattle.addEventListener("click", downloadBattle);
elements.downloadLog.addEventListener("click", downloadBattle);
elements.logFilter.addEventListener("input", renderLog);
elements.keyEventsOnly.addEventListener("change", renderLog);
elements.mobileViewportPreset?.addEventListener("change", applyMobileViewportPreset);
elements.mobileFullscreenLink?.addEventListener("click", (event) => {
  event.preventDefault();
  setMobileFullscreenMode(true, { updateUrl: true, nativeFullscreen: true });
});
elements.mobileExitFullscreen?.addEventListener("click", (event) => {
  event.preventDefault();
  setMobileFullscreenMode(false, { updateUrl: true });
});
elements.mobileNativeFullscreen?.addEventListener("click", requestNativeFullscreen);
elements.mobileStartButton?.addEventListener("click", () => elements.form.requestSubmit());
elements.mobileBuffTrigger?.addEventListener("pointerdown", (event) => {
  if (event.pointerType === "mouse") return;
  event.preventDefault();
  ignoreMobileBuffClickUntil = Date.now() + 600;
  if (elements.mobileBuffControl?.dataset.open === "true") {
    setMobileBuffMenuOpen(false);
    return;
  }
  mobileBuffHoldOpened = false;
  elements.mobileBuffControl?.classList.add("is-pressing");
  mobileBuffHoldTimer = window.setTimeout(() => {
    mobileBuffHoldTimer = null;
    mobileBuffHoldOpened = true;
    elements.mobileBuffControl?.classList.remove("is-pressing");
    setMobileBuffMenuOpen(true);
  }, MOBILE_BUFF_HOLD_MS);
});
elements.mobileBuffTrigger?.addEventListener("pointerup", (event) => {
  if (event.pointerType === "mouse") return;
  event.preventDefault();
  const opened = mobileBuffHoldOpened;
  stopMobileBuffHold();
  if (!opened && elements.mobileBuffControl?.dataset.open !== "true") {
    showMobileBuffStatus("Удерживайте, чтобы открыть", 1200);
  }
  mobileBuffHoldOpened = false;
});
elements.mobileBuffTrigger?.addEventListener("pointercancel", () => {
  stopMobileBuffHold();
  mobileBuffHoldOpened = false;
});
elements.mobileBuffTrigger?.addEventListener("contextmenu", (event) => event.preventDefault());
elements.mobileBuffTrigger?.addEventListener("click", (event) => {
  if (Date.now() < ignoreMobileBuffClickUntil) {
    event.preventDefault();
    return;
  }
  setMobileBuffMenuOpen(elements.mobileBuffControl?.dataset.open !== "true");
});
elements.mobileBuffOptions.forEach((option) => {
  option.addEventListener("click", () => applyPlayerBuffFromUi(option));
});
document.addEventListener("pointerdown", (event) => {
  if (elements.mobileBuffControl?.dataset.open !== "true") return;
  if (elements.mobileBuffControl.contains(event.target)) return;
  setMobileBuffMenuOpen(false);
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && elements.mobileBuffControl?.dataset.open === "true") {
    setMobileBuffMenuOpen(false);
    elements.mobileBuffTrigger?.focus();
  }
});
window.addEventListener("popstate", () => {
  setMobileFullscreenMode(new URLSearchParams(window.location.search).get("mobile") === "1");
});
let mobileLayoutResizeFrame = null;
window.addEventListener("resize", () => {
  if (mobileLayoutResizeFrame !== null) cancelAnimationFrame(mobileLayoutResizeFrame);
  mobileLayoutResizeFrame = requestAnimationFrame(() => {
    mobileLayoutResizeFrame = null;
    if (!syncMobileArenaHeight() && lastVisualSnapshot) {
      renderMobileBattleUi(lastVisualSnapshot, lastVisualInput);
    }
  });
});
})();
