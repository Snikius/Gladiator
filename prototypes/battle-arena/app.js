(function () {
"use strict";

const {
  ARENA_TYPES,
  BattleEngine,
  INJURY_DEFINITIONS,
  PERK_DEFINITIONS,
  TEMPORARY_PERK_DEFINITIONS,
  createBattleLogExport,
  createDefaultBattleInput,
} = globalThis.GladiatorBattle;

const elements = {
  form: document.querySelector("#setup-form"),
  startButton: document.querySelector('#setup-form button[type="submit"]'),
  seed: document.querySelector("#seed"),
  maxSteps: document.querySelector("#max-steps"),
  arenaType: document.querySelector("#arena-type"),
  multiplier1: document.querySelector("#arena-multiplier-1"),
  multiplier2: document.querySelector("#arena-multiplier-2"),
  restoreDefaults: document.querySelector("#restore-defaults"),
  canvas: document.querySelector("#arena-canvas"),
  pixelArena: document.querySelector("#pixel-arena"),
  arenaEvent: document.querySelector("#arena-event"),
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
const PLAYBACK_STEP_MS = 1500;

const escapeHtml = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

const formatNumber = (value, digits = 2) => Number(value).toLocaleString("ru-RU", {
  maximumFractionDigits: digits,
});

const percent = (value) => `${formatNumber(value * 100, 2)}%`;

const arenaName = (arenaId) => ARENA_TYPES.find((arena) => arena.id === arenaId)?.name || arenaId;
const perkName = (perkId) => PERK_DEFINITIONS.find((perk) => perk.id === perkId)?.name || perkId;
const effectDefinitions = {
  temporaryPerks: TEMPORARY_PERK_DEFINITIONS,
  injuries: INJURY_DEFINITIONS,
};
const effectName = (type, effectId) =>
  effectDefinitions[type].find((effect) => effect.id === effectId)?.name || effectId;

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
      <section class="effect-builder temporary-builder">
        <div class="effect-builder-heading">
          <div>
            <strong>Временные эффекты</strong>
            <small>Действуют один бой · количество не ограничено</small>
          </div>
          <button type="button" data-add-effect="temporaryPerks" data-fighter-index="${fighterIndex}">+ Добавить</button>
        </div>
        <div class="dynamic-effect-list" data-effect-list="temporaryPerks" data-fighter-index="${fighterIndex}"></div>
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
      weaponPower: fighter.equipment.weaponPower,
      armor: fighter.equipment.armor,
      weight: fighter.equipment.weight,
    };
    Object.entries(values).forEach(([field, value]) => {
      form.querySelector(`[data-field="${field}"]`).value = value;
    });
    document.querySelectorAll(`[data-fighter-perk="${index}"]`).forEach((select, slot) => {
      select.value = fighter.perks[slot] || "";
    });
    ["temporaryPerks", "injuries"].forEach((type) => {
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
    equipment: {
      weaponPower: Number(read("weaponPower")),
      armor: Number(read("armor")),
      weight: Number(read("weight")),
    },
    perks: [...new Set(
      [...document.querySelectorAll(`[data-fighter-perk="${index}"]`)]
        .map((select) => select.value)
        .filter(Boolean),
    )],
    temporaryPerks: [...document.querySelectorAll(`[data-fighter-effect="${index}"][data-effect-type="temporaryPerks"]`)]
      .map((select) => select.value)
      .filter(Boolean),
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
});

const statusLabel = (fighter) => {
  const healthRatio = fighter.health / fighter.maxHealth;
  if (fighter.health <= 0) return "ПОВЕРЖЕН";
  if (healthRatio <= 0.2) return "ЕДВА СТОИТ";
  if (fighter.fatigue >= 85) return "ИЗМОЖДЁН";
  if (fighter.fatigue >= 55) return "ТЯЖЕЛО ДЫШИТ";
  if (healthRatio <= 0.55) return "ДЕРЖИТСЯ";
  return "СВЕЖ И СОБРАН";
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

const renderNumbers = (snapshot) => {
  if (!snapshot) return;
  const input = currentResult?.input || readInput();
  elements.fighterNumbers.innerHTML = snapshot.fighters.map((fighter, index) => {
    const base = input.fighters[index].base;
    const multiplier = snapshot.arena.supportMultipliers[index];
    const traumas = fighter.traumas?.length
      ? fighter.traumas.map((trauma) => `${trauma.type}@${trauma.step}`).join(", ")
      : "нет";
    const perks = fighter.perks?.length ? fighter.perks.map(perkName).join(", ") : "нет";
    return `
      <article class="number-card fighter-${index === 0 ? "one" : "two"}">
        <h3>
          <span>${escapeHtml(fighter.name)}</span>
          <small>${statusLabel(fighter)}</small>
        </h3>
        ${meterRow("Здоровье", Math.max(0, fighter.health), fighter.maxHealth, "health", `${formatNumber(fighter.health)} / ${formatNumber(fighter.maxHealth)}`)}
        ${meterRow("Сила", fighter.strength, 150, "strength", `${formatNumber(fighter.strength)} / база ${base.strength}`)}
        ${meterRow("Поддержка", fighter.support, 150, "support")}
        ${meterRow("Инициатива", fighter.initiative, 150, "initiative")}
        ${meterRow("Усталость", fighter.fatigue, 150, "fatigue")}
        <p class="equipment-line">
          ХАРИЗМА ${base.charisma} · МНОЖИТЕЛЬ АРЕНЫ ${formatNumber(multiplier)} ·
          ОРУЖИЕ +${fighter.weaponPower} · БРОНЯ ${fighter.armor} · ВЕС ${fighter.equipmentWeight}
        </p>
        <p class="perks-line">ПЕРКИ: ${escapeHtml(perks)}</p>
        <p class="trauma-line">ТРАВМЫ: ${escapeHtml(traumas)}</p>
      </article>
    `;
  }).join("");
};

const paletteForArena = (type) => {
  if (type === "normal") {
    return { sky: "#78909a", upper: "#665f59", wall: "#8a8177", dark: "#393432", sand: "#a99676", light: "#c7b591" };
  }
  return { sky: "#bd8356", upper: "#684638", wall: "#916342", dark: "#38251f", sand: "#c79652", light: "#ebc477" };
};

const seededVisualRandom = (seed) => {
  let value = [...String(seed)].reduce((sum, character) => (sum * 31 + character.charCodeAt(0)) >>> 0, 7);
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 4294967296;
  };
};

const drawPixelFighter = (context, x, ground, side, fighter, isActive) => {
  const facing = side === 0 ? 1 : -1;
  const team = side === 0 ? "#b9473f" : "#4f8b99";
  const teamLight = side === 0 ? "#e06a54" : "#76b6b6";
  const skin = "#bb7b4b";
  const skinLight = "#d99a61";
  const bronze = "#a56a2b";
  const metal = "#d1a95c";
  const dark = "#2a1b18";
  const down = fighter.health <= 0;
  const tired = fighter.fatigue >= 70;
  const bodyY = down ? ground - 6 : ground - (tired ? 27 : 30);

  context.fillStyle = "rgba(29,18,14,.45)";
  context.fillRect(x - 10, ground - 2, 22, 3);

  if (down) {
    context.fillStyle = team;
    context.fillRect(x - 7, ground - 8, 17, 5);
    context.fillStyle = skin;
    context.fillRect(x + 9 * facing - 3, ground - 9, 6, 6);
    context.fillStyle = bronze;
    context.fillRect(x - 11, ground - 5, 7, 3);
    return;
  }

  context.fillStyle = dark;
  context.fillRect(x - 5, bodyY + 18, 4, 10);
  context.fillRect(x + 2, bodyY + 18, 4, 10);
  context.fillStyle = bronze;
  context.fillRect(x - 6, bodyY + 27, 5, 3);
  context.fillRect(x + 2, bodyY + 27, 6, 3);

  context.fillStyle = team;
  context.fillRect(x - 7, bodyY + 7, 14, 13);
  context.fillStyle = teamLight;
  context.fillRect(x - 5, bodyY + 8, 10, 3);
  context.fillStyle = bronze;
  context.fillRect(x - 8, bodyY + 17, 16, 3);
  context.fillStyle = metal;
  context.fillRect(x - 4, bodyY + 11, 8, 5);

  context.fillStyle = skin;
  context.fillRect(x - 4, bodyY, 8, 8);
  context.fillStyle = skinLight;
  context.fillRect(x - 3, bodyY + 1, 5, 3);
  context.fillStyle = bronze;
  context.fillRect(x - 5, bodyY - 2, 10, 3);
  context.fillRect(x - 4, bodyY - 4, 8, 2);
  context.fillStyle = dark;
  context.fillRect(x + 2 * facing, bodyY + 3, 1, 1);

  context.fillStyle = skin;
  context.fillRect(x + 6 * facing, bodyY + 9, 7 * facing, 3);
  context.fillRect(x - 8 * facing, bodyY + 10, 5 * facing, 3);

  if (side === 0) {
    const shieldX = x - 10 * facing;
    context.fillStyle = bronze;
    context.fillRect(shieldX - 4, bodyY + 7, 8, 13);
    context.fillStyle = metal;
    context.fillRect(shieldX - 2, bodyY + 9, 4, 9);
    context.fillStyle = "#ecdfb1";
    context.fillRect(x + 12, bodyY + 8, 15, 2);
    context.fillStyle = dark;
    context.fillRect(x + 7, bodyY + 8, 6, 3);
  } else {
    context.fillStyle = "#6b4128";
    context.fillRect(x - 29, bodyY + 7, 35, 2);
    context.fillStyle = metal;
    context.fillRect(x - 32, bodyY + 6, 5, 4);
    context.fillStyle = bronze;
    context.fillRect(x + 7, bodyY + 8, 7, 12);
    context.fillStyle = teamLight;
    context.fillRect(x + 9, bodyY + 10, 3, 8);
  }

  if (isActive) {
    context.fillStyle = "#f2d187";
    context.fillRect(x - 3, bodyY - 10, 2, 2);
    context.fillRect(x + 2, bodyY - 9, 2, 2);
    context.fillRect(x, bodyY - 13, 2, 2);
  }
};

const drawArena = (snapshot, input) => {
  const context = elements.canvas.getContext("2d");
  context.imageSmoothingEnabled = false;
  const type = snapshot?.arena?.type || input.arena.type;
  const palette = paletteForArena(type);
  const random = seededVisualRandom(input.seed);
  context.clearRect(0, 0, 320, 180);

  context.fillStyle = palette.sky;
  context.fillRect(0, 0, 320, 52);
  context.fillStyle = palette.upper;
  context.fillRect(0, 24, 320, 68);
  context.fillStyle = palette.dark;
  context.fillRect(0, 29, 320, 8);
  context.fillRect(0, 51, 320, 5);

  for (let row = 0; row < 4; row += 1) {
    for (let column = 0; column < 52; column += 1) {
      if (random() < 0.18) continue;
      const x = column * 7 + (row % 2 ? 3 : 0);
      const y = 32 + row * 12 + Math.floor(random() * 3);
      const colors = ["#b94b3e", "#d19a50", "#586e66", "#5f3940", "#c3a36d"];
      context.fillStyle = colors[Math.floor(random() * colors.length)];
      context.fillRect(x, y, 3, 5);
      context.fillStyle = "#b77a4e";
      context.fillRect(x, y - 2, 3, 2);
    }
  }

  context.fillStyle = palette.wall;
  context.fillRect(0, 78, 320, 43);
  context.fillStyle = palette.dark;
  for (let x = 13; x < 320; x += 37) {
    context.fillRect(x, 90, 17, 31);
    context.fillStyle = palette.upper;
    context.fillRect(x + 3, 86, 11, 8);
    context.fillStyle = palette.dark;
  }
  context.fillStyle = palette.light;
  context.fillRect(0, 78, 320, 4);
  context.fillRect(0, 115, 320, 5);

  context.fillStyle = palette.sand;
  context.fillRect(0, 120, 320, 60);
  for (let index = 0; index < 120; index += 1) {
    context.fillStyle = random() > 0.5 ? palette.light : palette.upper;
    context.fillRect(Math.floor(random() * 320), 123 + Math.floor(random() * 55), 1 + Math.floor(random() * 3), 1);
  }

  const fighters = snapshot?.fighters || input.fighters.map((fighter, index) => ({
    id: fighter.id,
    name: fighter.name,
    health: fighter.base.health,
    maxHealth: fighter.base.health,
    fatigue: 0,
  }));
  const activeActorId = snapshot?.lastAction?.actorId;
  drawPixelFighter(context, 112, 165, 0, fighters[0], activeActorId === fighters[0].id);
  drawPixelFighter(context, 208, 165, 1, fighters[1], activeActorId === fighters[1].id);

  const drawHud = (fighter, x, color) => {
    const ratio = Math.max(0, Math.min(1, fighter.health / fighter.maxHealth));
    context.fillStyle = "#17100d";
    context.fillRect(x, 7, 93, 9);
    context.fillStyle = color;
    context.fillRect(x + 2, 9, Math.round(89 * ratio), 5);
    context.fillStyle = "#f1dfb5";
    context.font = "7px monospace";
    context.fillText(fighter.name.toUpperCase().slice(0, 13), x, 24);
  };
  drawHud(fighters[0], 9, "#d75343");
  drawHud(fighters[1], 218, "#66a5ad");

  if (snapshot?.lastAction?.outcome === "hit" && snapshot.label !== "Итог боя") {
    const targetX = snapshot.lastAction.targetId === fighters[0].id ? 103 : 219;
    context.fillStyle = "#f4d77f";
    context.fillRect(targetX, 132, 3, 3);
    context.fillRect(targetX - 4, 128, 2, 2);
    context.fillStyle = "#b9473f";
    context.fillRect(targetX + 4, 127, 2, 2);
  }

  renderDomArena(snapshot, input);
};

const renderDomArena = (snapshot, input) => {
  const fighters = snapshot?.fighters || input.fighters.map((fighter) => ({
    id: fighter.id,
    name: fighter.name,
    health: fighter.base.health,
    maxHealth: fighter.base.health,
    fatigue: 0,
  }));
  elements.pixelArena.className = `pixel-arena ${snapshot?.arena?.type || input.arena.type}`;

  fighters.forEach((fighter, index) => {
    const sprite = elements.pixelArena.querySelector(`[data-dom-fighter="${index}"]`);
    sprite.classList.remove("attacking", "hit", "dodging", "blocking");
    sprite.classList.toggle("active", snapshot?.lastAction?.actorId === fighter.id);
    sprite.classList.toggle("tired", fighter.fatigue >= 70 && fighter.health > 0);
    sprite.classList.toggle("defeated", fighter.health <= 0);

    const health = elements.pixelArena.querySelector(`.pixel-health-${index === 0 ? "one" : "two"}`);
    health.querySelector("i").style.width = `${Math.max(0, Math.min(100, fighter.health / fighter.maxHealth * 100))}%`;
    health.querySelector("span").textContent = fighter.name.toUpperCase().slice(0, 13);
    const stats = elements.pixelArena.querySelector(`[data-arena-stats="${index}"]`);
    stats.innerHTML = [
      ["HP", `${formatNumber(fighter.health)}/${formatNumber(fighter.maxHealth)}`],
      ["СИЛ", formatNumber(fighter.strength)],
      ["ПОД", formatNumber(fighter.support)],
      ["ИНИ", formatNumber(fighter.initiative)],
      ["УСТ", formatNumber(fighter.fatigue)],
      ["ОРЖ", formatNumber(fighter.weaponPower)],
      ["БРН", formatNumber(fighter.armor)],
      ["ТРВ", fighter.traumas?.length || 0],
    ].map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join("");
    const effects = [
      ...(fighter.temporaryPerks || []).map((effectId) => ({
        type: "temporary",
        name: effectName("temporaryPerks", effectId),
      })),
      ...(fighter.injuries || []).map((effectId) => ({
        type: "injury",
        name: effectName("injuries", effectId),
      })),
    ];
    const effectsPanel = elements.pixelArena.querySelector(`[data-arena-effects="${index}"]`);
    effectsPanel.innerHTML = effects.slice(0, 3).map((effect) => `
      <b class="${effect.type}">${effect.type === "injury" ? "!" : "+"} ${escapeHtml(effect.name)}</b>
    `).join("");
    if (effects.length > 3) {
      effectsPanel.insertAdjacentHTML("beforeend", `<b class="more">+${effects.length - 3}</b>`);
    }
    effectsPanel.classList.toggle("empty", effects.length === 0);
  });

  const action = snapshot?.lastAction;
  if (action && snapshot.label !== "Итог боя") {
    void elements.pixelArena.offsetWidth;
    const actorIndex = fighters.findIndex((fighter) => fighter.id === action.actorId);
    const targetIndex = fighters.findIndex((fighter) => fighter.id === action.targetId);
    const actorSprite = elements.pixelArena.querySelector(`[data-dom-fighter="${actorIndex}"]`);
    const targetSprite = elements.pixelArena.querySelector(`[data-dom-fighter="${targetIndex}"]`);
    actorSprite?.classList.add("attacking");
    if (action.outcome === "hit") targetSprite?.classList.add("hit");
    if (action.outcome === "dodge") targetSprite?.classList.add("dodging");
    if (action.outcome === "block") targetSprite?.classList.add("blocking");
  }

  const impact = elements.pixelArena.querySelector(".pixel-impact");
  impact.className = "pixel-impact";
  if (snapshot?.lastAction?.outcome === "hit" && snapshot.label !== "Итог боя") {
    const targetIndex = fighters.findIndex((fighter) => fighter.id === snapshot.lastAction.targetId);
    void impact.offsetWidth;
    impact.classList.add("visible", targetIndex === 0 ? "target-one" : "target-two");
  }

  renderArenaEvent(snapshot, fighters);
};

const renderArenaEvent = (snapshot, fighters) => {
  const action = snapshot?.lastAction;
  let title = snapshot?.step ? `ХОД ${snapshot.step}` : "НАЧАЛО БОЯ";
  let detail = "Бойцы занимают позиции";
  let stateClass = "idle";

  if (snapshot?.label === "Итог боя") {
    title = "БОЙ ЗАВЕРШЁН";
    if (snapshot.outcome?.type === "draw") {
      detail = "Лимит ходов достигнут — ничья";
      stateClass = "draw";
    } else {
      const winner = fighters.find((fighter) => fighter.id === snapshot.outcome?.winnerId);
      detail = `${winner?.name || "Боец"} одерживает победу`;
      stateClass = "victory";
    }
  } else if (action) {
    const actor = fighters.find((fighter) => fighter.id === action.actorId);
    const target = fighters.find((fighter) => fighter.id === action.targetId);
    const actorName = actor?.name || "Боец";
    const targetName = target?.name || "противник";
    const messages = {
      hit: `${targetName} ранен: ${actorName} наносит ${action.damage} урона`,
      miss: `${actorName} не попадает по бойцу ${targetName}`,
      dodge: `${targetName} полностью уклоняется от атаки ${actorName}`,
      block: `${targetName} принимает удар ${actorName} на блок`,
    };
    const titles = {
      hit: `ХОД ${snapshot.step} · РАНЕНИЕ −${action.damage} HP`,
      miss: `ХОД ${snapshot.step} · ПРОМАХ`,
      dodge: `ХОД ${snapshot.step} · УВОРОТ`,
      block: `ХОД ${snapshot.step} · БЛОК`,
    };
    title = titles[action.outcome] || title;
    detail = messages[action.outcome] || snapshot.label;
    stateClass = action.outcome;
  }

  elements.arenaEvent.className = "arena-event";
  void elements.arenaEvent.offsetWidth;
  elements.arenaEvent.className = `arena-event ${stateClass}`;
  elements.arenaEvent.querySelector("strong").textContent = title;
  elements.arenaEvent.querySelector("span").textContent = detail;
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
  if (snapshot.label !== "Итог боя" && snapshot.lastAction?.outcome) {
    elements.battleCallout.classList.add(snapshot.lastAction.outcome);
  }
  if (snapshot.outcome?.type === "victory") elements.battleCallout.classList.add("victory");
  if (snapshot.outcome?.type === "draw") elements.battleCallout.classList.add("draw");
  renderNumbers(snapshot);
  drawArena(snapshot, currentResult.input);
};

const renderEventState = (event) => {
  if (!currentResult || !event?.state) return;
  const state = event.state;
  const snapshot = {
    step: state.step,
    label: state.status === "finished" ? "Итог боя" : `Событие #${event.sequence}`,
    status: state.status,
    outcome: state.outcome,
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
  drawArena(snapshot, currentResult.input);
};

const renderResult = (result) => {
  const isDraw = result.outcome.type === "draw";
  const winner = isDraw ? null : result.fighters.find((fighter) => fighter.id === result.outcome.winnerId);
  const outcomeLabels = { victory: "ПОБЕДА", defeat: "ПОРАЖЕНИЕ", draw: "НИЧЬЯ" };
  elements.resultTitle.textContent = isDraw ? "НИЧЬЯ" : `${winner.name} ПОБЕЖДАЕТ`;
  elements.resultDescription.textContent = isDraw
    ? `За ${result.steps} шагов победитель не определён. Причина: ${result.outcome.reason}.`
    : `Бой завершён за ${result.steps} шагов. Причина: ${result.outcome.reason}.`;
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

const scheduleNextSnapshot = (delay = PLAYBACK_STEP_MS) => {
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
    renderSnapshot(0);
  }
  isPlaying = true;
  elements.playPause.textContent = "Ⅱ";
  elements.playPause.title = "Поставить на паузу";
  scheduleNextSnapshot(restart ? 900 : PLAYBACK_STEP_MS);
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
    ["perkActivations", "Перки"],
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
  "perk.activated",
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
    if (event.type.startsWith("perk.")) classes.push("perk-event");
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
  currentResult = null;
  currentSnapshotIndex = 0;
  elements.resultPanel.hidden = true;
  elements.statisticsPanel.hidden = true;
  elements.logPanel.hidden = true;
  elements.timeline.hidden = true;
  elements.startButton.textContent = "▶ Начать симуляцию";
};

const renderPreview = () => {
  const input = readInput();
  const snapshot = {
    step: 0,
    label: "Предварительный просмотр",
    arena: input.arena,
    lastAction: null,
    fighters: input.fighters.map((fighter, index) => ({
      id: fighter.id,
      name: fighter.name,
      health: fighter.base.health,
      maxHealth: fighter.base.health,
      strength: fighter.base.strength,
      support: fighter.base.charisma * input.arena.supportMultipliers[index],
      initiative: 0,
      fatigue: 0,
      weaponPower: fighter.equipment.weaponPower,
      armor: fighter.equipment.armor,
      equipmentWeight: fighter.equipment.weight,
      perks: fighter.perks,
      temporaryPerks: fighter.temporaryPerks,
      injuries: fighter.injuries,
      traumas: [],
    })),
  };
  elements.arenaName.textContent = arenaName(input.arena.type);
  elements.arenaSeed.textContent = input.seed;
  elements.arenaStep.textContent = `0 / ${input.maxSteps}`;
  renderNumbers(snapshot);
  drawArena(snapshot, input);
};

const startBattle = (event) => {
  event.preventDefault();
  if (!elements.form.reportValidity()) return;
  try {
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
    elements.startButton.textContent = "↻ Запустить заново";
    renderSnapshot(0);
    playBattle({ restart: true });
  } catch (error) {
    console.error(error);
    elements.battleCallout.textContent = `Ошибка симуляции: ${error.message}`;
    elements.battleCallout.className = "battle-callout draw";
  }
};

populateMenus();
setFormFromInput(createDefaultBattleInput());
renderPreview();

elements.form.addEventListener("submit", startBattle);
elements.form.addEventListener("input", () => {
  renderPerkSlotDescriptions();
  if (!currentResult) renderPreview();
});
elements.form.addEventListener("click", (event) => {
  const addButton = event.target.closest("[data-add-effect]");
  if (addButton) {
    appendEffectRow(Number(addButton.dataset.fighterIndex), addButton.dataset.addEffect);
    renderPerkSlotDescriptions();
    if (!currentResult) renderPreview();
    return;
  }
  const removeButton = event.target.closest("[data-remove-effect]");
  if (removeButton) {
    removeButton.closest(".dynamic-effect-row").remove();
    if (!currentResult) renderPreview();
  }
});
elements.restoreDefaults.addEventListener("click", () => {
  resetResults();
  setFormFromInput(createDefaultBattleInput());
  elements.battleCallout.textContent = "Настройте бойцов и запустите симуляцию";
  elements.battleCallout.className = "battle-callout idle";
  renderPreview();
});
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
})();
