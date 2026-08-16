(function () {
"use strict";

const data = globalThis.GladiatorReferenceData;
const root = document.querySelector("#catalog-root");
const search = document.querySelector("#catalog-search");
const sectionFilter = document.querySelector("#catalog-section");
const classFilter = document.querySelector("#catalog-class");
const emptyState = document.querySelector("#empty-state");

const sectionMeta = {
  class: { index: "01", title: "Классы гладиаторов", subtitle: "Пять стилей и их соотношения" },
  "weapon-set": { index: "02", title: "Классовое оружие", subtitle: "Обычная атака + один классовый приём" },
  "armor-set": { index: "03", title: "Комплекты доспехов", subtitle: "Защита, вес и визуальный силуэт" },
  "weapon-item": { index: "04", title: "Предметы оружия", subtitle: "Конкретные экземпляры четырёх уровней качества · наведите для подробностей" },
  "armor-item": { index: "05", title: "Предметы доспехов", subtitle: "Конкретные экземпляры четырёх уровней качества · наведите для подробностей" },
  fighter: { index: "06", title: "Перки бойца", subtitle: "Постоянные особенности · до трёх слотов" },
  temporary: { index: "07", title: "Временные эффекты", subtitle: "Действуют один бой · количество не ограничено" },
  injury: { index: "08", title: "Травмы", subtitle: "Работают через общий интерфейс перков" },
  technique: { index: "09", title: "Классовые приёмы", subtitle: "Ровно один у каждого типа классового оружия" },
  weapon: { index: "10", title: "Дополнительные перки оружия", subtitle: "Редкое и именное оружие · от одного до двух" },
  armor: { index: "11", title: "Защитные перки доспехов", subtitle: "Редкие и именные доспехи · ровно один" },
};

const iconPatterns = {
  sword: ["......2.",".....22.","....22..","...22...","..22....",".313....","..1.....",".1......"],
  sica: [".....22.","....2...","...22...","..22....",".22.....",".13.....","..1.....","..1....."],
  spear: ["......2.",".....22.","....21..","...11...","..11....",".11.....","11......","1......."],
  shield: [".22222..","2333332.","2331332.","2331332.",".33133..",".33133..","..313...","...1...."],
  net: ["2.2.2.2.",".2.2.2..","2.2.2.2.",".2.2.2..","2.2.2.2.",".2.2.2..","......1.",".......1"],
  helmet: ["..222...",".23332..","2333332.","2333332.","2311112.","23.11.2.",".3....3.",".3....3."],
  armor: [".2....2.","23322332","23333332",".333333.",".331133.",".331133.",".33..33.",".11..11."],
  greaves: [".22..22.",".33..33.",".33..33.",".31..13.",".31..13.",".31..13.",".11..11.","111..111"],
  shoulder: [".2222...","233332..","233332..",".3332...","..332...","..332...","..112...","...1...."],
  bone: ["22....22",".2....2.","..1111..","..1111..","..1111..","..1111..",".2....2.","22....22"],
  crowd: [".2..3..2","22233322",".2..3..2",".1..1..1","11111111",".1..1..1","1.11.11.","1.11.11."],
  turn: ["..2222..",".22..2..","22......","2..333..","2....3..","22..33..",".2222...","........"],
  boot: ["..22....","..33....","..33....","..33....","..31....","..31111.",".111111.","11111111"],
  hair: [".222222.","22222222","22333322",".333333.",".31..13.",".333333.","..3113..","...11..."],
  star: ["...2....","...2....",".2.2.2..","..222...","2222222.","..222...",".2.2.2..","...2...."],
  heart: [".22..22.","23322332","23333332",".333333.","..3333..","...33...","....3...","........"],
  leap: [".....2..","....222.","...232..","..331...",".3311...","..1.11..",".1...11.","1......."],
  claw: ["2..2..2.","2..2..2.",".2.2.2..",".2.2.2..","..333...",".33333..","3333333.",".11111.."],
  steam: [".2.2.2..","2.2.2...",".2.2.2..","........",".333333.",".333333.","..3113..","...11..."],
  wine: ["..222...","..222...","..232...","..333...","...3....","...1....","..111...",".11111.."],
  meal: ["........",".222222.","23333332",".333333.","..3113..","...11...",".111111.","........"],
  fist: ["..2222..",".233332.","23333332","23333332",".333333.","..3311..","..311...","..11...."],
  sun: ["2..2..2.",".2.2.2..","..333...","2233322.","..333...",".2.2.2..","2..2..2.","........"],
  flask: ["..111...","..111...","...1....","..222...",".23332..","2333332.","2333332.",".11111.."],
  moon: ["...222..","..233...",".233....",".233....",".233....","..233...","...222..","........"],
  arm: ["..22....",".2332...",".3332...","..331...","..3311..",".33111..","3311....","11......"],
  head: ["..2222..",".233332.","23333332","23311332","23333332",".331133.","..1111..","........"],
  ribs: [".2....2.",".233332.",".23..32.",".233332.",".23..32.",".233332.",".1....1.","........"],
  fatigue: ["........",".2.2.2..","..2.2...","........",".333333.",".3....3.","..1111..","........"],
  drop: ["...2....","...2....","..222...",".23332..","2333332.",".33333..","..111...","........"],
  balance: ["...1....","2221222.",".2.1.2..","22.1.22.","33.1.33.","...1....","..111...",".11111.."],
  "broken-shield": [".22222..","233.332.","23.1332.","2.31332.",".31.33..",".331.3..","..31....","...1...."],
  belt: ["........","........","22222222","33313333","22222222","........","........","........"],
  joint: ["..22....",".2332...",".3332...","..11....","...22...","..2332..","..3332..","...11..."],
  layers: ["2222222.",".3333332","..111113","22222221",".3333332","..111113","........","........"],
  plate: [".222222.","23333332","23311332","23311332","23311332","23333332",".311113.","..1111.."],
  sand: ["........","2...2...","..2...2.","........",".333333.","33333333","11111111","11111111"],
};

const palette = { 1: "#7c4e2c", 2: "#f0ce79", 3: "#c87838" };
const escapeHtml = (value) => String(value)
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&#039;");

const icon = (name) => {
  const pattern = iconPatterns[name] || iconPatterns.star;
  const pixels = pattern.flatMap((row, y) => [...row].map((cell, x) =>
    cell === "." ? "" : `<rect x="${x}" y="${y}" width="1" height="1" fill="${palette[cell]}"/>`,
  )).join("");
  return `<span class="pixel-icon" aria-hidden="true"><svg viewBox="0 0 8 8" shape-rendering="crispEdges">${pixels}</svg></span>`;
};

const className = (id) => data.classes.find((item) => item.id === id)?.name || id;
const perkById = (id) => data.perks.find((item) => item.id === id);
const qualityById = (id) => data.qualities.find((item) => item.id === id);
const statusBadge = (status) => status === "prototype"
  ? '<span class="status prototype">В ПРОТОТИПЕ</span>'
  : '<span class="status draft">ДРАФТ 0.6</span>';

const card = (item, type) => {
  const technique = item.techniqueId ? perkById(item.techniqueId) : null;
  const searchable = [item.name, item.id, item.description, item.effect, technique?.name, technique?.effect, ...(item.profile || [])].filter(Boolean).join(" ").toLowerCase();
  const cardClass = type === "class" ? item.id : (item.classId || "all");
  const classBadge = item.classId ? `<span class="class-badge">${escapeHtml(className(item.classId))}</span>` : "";
  const chips = (item.profile || []).map((value) => `<span>${escapeHtml(value)}</span>`).join("");
  const detail = item.effect || item.description;
  const special = type === "weapon-set"
    ? `<div class="card-link technique-description">
        <span>КЛАССОВЫЙ ПРИЁМ</span>
        <strong>${escapeHtml(technique?.name || item.techniqueId)}</strong>
        <p>${escapeHtml(technique?.effect || "Описание приёма ещё не задано.")}</p>
        <code>${escapeHtml(item.techniqueId)}</code>
      </div>`
    : "";
  const matchup = type === "class"
    ? `<div class="matchup"><span class="wins">▲ ${escapeHtml(className(item.beats))}</span><span class="loses">▼ ${escapeHtml(className(item.losesTo))}</span></div>`
    : "";
  return `<article class="catalog-card ${type}" data-card data-type="${type}" data-class="${cardClass}" data-search="${escapeHtml(searchable)}">
    <header>${icon(item.icon)}<div><div class="card-kicker">${escapeHtml(sectionMeta[type].title)}</div><h3>${escapeHtml(item.name)}</h3></div></header>
    <div class="card-badges">${item.status ? statusBadge(item.status) : ""}${classBadge}</div>
    ${item.role ? `<strong class="role">${escapeHtml(item.role)}</strong>` : ""}
    <p>${escapeHtml(detail)}</p>
    ${chips ? `<div class="chips">${chips}</div>` : ""}${special}${matchup}
    <code class="item-id">${escapeHtml(item.id)}</code>
  </article>`;
};

const statLabels = {
  weaponPower: "Сила оружия",
  accuracy: "Точность",
  armor: "Броня",
  weight: "Вес",
  mobility: "Подвижность",
};

const itemCell = (item, type) => {
  const equipment = type === "weapon-item"
    ? data.weapons.find((entry) => entry.id === item.setId)
    : data.armor.find((entry) => entry.id === item.setId);
  const technique = equipment?.techniqueId ? perkById(equipment.techniqueId) : null;
  const extraPerks = item.additionalPerkIds.map(perkById).filter(Boolean);
  const quality = qualityById(item.quality);
  const stats = Object.entries(item.stats).map(([key, value]) => `
    <div><dt>${escapeHtml(statLabels[key] || key)}</dt><dd>${value > 0 && key === "mobility" ? "+" : ""}${escapeHtml(value)}</dd></div>`).join("");
  const perkDetails = extraPerks.length
    ? extraPerks.map((perk) => `<li><strong>${escapeHtml(perk.name)}</strong><span>${escapeHtml(perk.effect)}</span></li>`).join("")
    : "<li class=\"empty-perk\">Дополнительных перков нет</li>";
  const searchable = [
    item.name, item.id, equipment?.name, quality?.name, className(item.classId),
    technique?.name, technique?.effect, ...extraPerks.flatMap((perk) => [perk.name, perk.effect]),
  ].filter(Boolean).join(" ").toLowerCase();
  return `<article class="item-cell quality-${item.quality}" tabindex="0" data-card data-type="${type}" data-class="${item.classId}" data-search="${escapeHtml(searchable)}" aria-label="${escapeHtml(item.name)} — показать описание">
    <span class="quality-corner">${escapeHtml(quality?.name.slice(0, 1) || "?")}</span>
    ${icon(item.icon)}
    <strong>${escapeHtml(item.name)}</strong>
    <small>${escapeHtml(className(item.classId))}</small>
    <div class="item-tooltip" role="tooltip">
      <div class="tooltip-heading"><span class="quality-label">${escapeHtml(quality?.name || item.quality)}</span><b>${type === "weapon-item" ? "ОРУЖИЕ" : "ДОСПЕХИ"}</b></div>
      <h3>${escapeHtml(item.name)}</h3>
      <p>${escapeHtml(equipment?.description || "")}</p>
      <dl class="item-stats">${stats}</dl>
      ${technique ? `<div class="tooltip-technique"><span>КЛАССОВЫЙ ПРИЁМ</span><strong>${escapeHtml(technique.name)}</strong><p>${escapeHtml(technique.effect)}</p></div>` : ""}
      <div class="tooltip-perks"><span>ДОПОЛНИТЕЛЬНЫЕ ПЕРКИ</span><ul>${perkDetails}</ul></div>
      <code>${escapeHtml(item.id)}</code>
    </div>
  </article>`;
};

const sections = [
  ["class", data.classes], ["weapon-set", data.weapons], ["armor-set", data.armor],
  ["weapon-item", data.weaponItems, "items"], ["armor-item", data.armorItems, "items"],
  ...["fighter", "temporary", "injury", "technique", "weapon", "armor"].map((group) =>
    [group, data.perks.filter((perk) => perk.group === group)]),
];

const render = () => {
  root.innerHTML = sections.map(([type, items, layout]) => {
    const meta = sectionMeta[type];
    return `<section class="catalog-section" data-catalog-section="${type}">
      <div class="section-title"><span>${meta.index}</span><div><h2>${meta.title}</h2><p>${meta.subtitle}</p></div><b data-visible-count>${items.length}</b></div>
      <div class="${layout === "items" ? "item-grid" : "card-grid"}">${items.map((item) => layout === "items" ? itemCell(item, type) : card(item, type)).join("")}</div>
    </section>`;
  }).join("");
};

const positionItemTooltip = (cell) => {
  const tooltip = cell.querySelector(".item-tooltip");
  const cellRect = cell.getBoundingClientRect();
  const tooltipRect = tooltip.getBoundingClientRect();
  const margin = 12;
  const left = Math.min(
    window.innerWidth - tooltipRect.width - margin,
    Math.max(margin, cellRect.left + (cellRect.width - tooltipRect.width) / 2),
  );
  const below = cellRect.bottom + 8;
  const above = cellRect.top - tooltipRect.height - 8;
  const top = below + tooltipRect.height <= window.innerHeight || above < margin ? below : above;
  tooltip.style.left = `${Math.round(left)}px`;
  tooltip.style.top = `${Math.round(Math.max(margin, top))}px`;
};

const bindItemTooltips = () => {
  document.querySelectorAll(".item-cell").forEach((cell) => {
    cell.addEventListener("mouseenter", () => positionItemTooltip(cell));
    cell.addEventListener("focusin", () => positionItemTooltip(cell));
  });
};

const applyFilters = () => {
  const query = search.value.trim().toLowerCase();
  const type = sectionFilter.value;
  const fighterClass = classFilter.value;
  let totalVisible = 0;
  document.querySelectorAll("[data-catalog-section]").forEach((section) => {
    let sectionVisible = 0;
    section.querySelectorAll("[data-card]").forEach((entry) => {
      const typeMatches = type === "all" || entry.dataset.type === type;
      const classMatches = fighterClass === "all" || entry.dataset.class === "all" || entry.dataset.class === fighterClass;
      const searchMatches = !query || entry.dataset.search.includes(query);
      const visible = typeMatches && classMatches && searchMatches;
      entry.hidden = !visible;
      if (visible) sectionVisible += 1;
    });
    section.hidden = sectionVisible === 0;
    section.querySelector("[data-visible-count]").textContent = sectionVisible;
    totalVisible += sectionVisible;
  });
  emptyState.hidden = totalVisible !== 0;
};

document.querySelector("#quality-grid").innerHTML = data.qualities.map((quality) => `
  <article class="quality-card ${quality.tone}"><span>${quality.name}</span><dl>
    <div><dt>Оружие</dt><dd>${quality.weaponPerks}</dd></div>
    <div><dt>Доспехи</dt><dd>${quality.armorPerks}</dd></div>
  </dl></article>`).join("");

document.querySelector("#catalog-counters").innerHTML = `
  <div><dt>КЛАССОВ</dt><dd>${data.classes.length}</dd></div>
  <div><dt>КОМПЛЕКТОВ</dt><dd>${data.weapons.length + data.armor.length}</dd></div>
  <div><dt>ПРЕДМЕТОВ</dt><dd>${data.weaponItems.length + data.armorItems.length}</dd></div>
  <div><dt>ПЕРКОВ И ЭФФЕКТОВ</dt><dd>${data.perks.length}</dd></div>`;

classFilter.innerHTML += data.classes.map((item) => `<option value="${item.id}">${item.name}</option>`).join("");
render();
bindItemTooltips();
[search, sectionFilter, classFilter].forEach((control) => control.addEventListener("input", applyFilters));
document.querySelector("#reset-filters").addEventListener("click", () => {
  search.value = ""; sectionFilter.value = "all"; classFilter.value = "all"; applyFilters(); search.focus();
});
})();
