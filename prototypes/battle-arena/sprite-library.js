(function () {
"use strict";

/*
 * Каталог визуальных ассетов намеренно не знает о правилах боя, Canvas или DOM.
 * Сейчас каждый ассет — цветная заглушка. Позже в тех же полях можно указать
 * spriteSheet/frameSet, не меняя BattleEngine и BattleVisualEngine.
 */
const DEFAULT_SKIN_ID = "arena-red";

const CORE_VISUAL_STATES = Object.freeze({
  "idle.normal": Object.freeze({ kind: "loop", description: "Обычная стойка: лёгкое дыхание и перенос веса." }),
  "idle.tired": Object.freeze({ kind: "loop", description: "Уставшая стойка: опущенная защита и тяжёлое дыхание." }),
  "idle.injured": Object.freeze({ kind: "loop", description: "Раненая стойка: бережёт повреждённую сторону." }),
  greeting: Object.freeze({ kind: "one-shot", description: "Приветствие соперника перед стартовым сближением." }),
  advance: Object.freeze({ kind: "one-shot", description: "Сближение перед атакой." }),
  attack: Object.freeze({ kind: "one-shot", description: "Полная линия атаки, минимум пять кадров." }),
  "defense.block": Object.freeze({ kind: "one-shot", description: "Принятие удара щитом или оружием." }),
  "defense.dodge": Object.freeze({ kind: "one-shot", description: "Уход или backstep." }),
  "reaction.hit": Object.freeze({ kind: "one-shot", description: "Реакция на попадание." }),
  defeated: Object.freeze({ kind: "terminal", description: "Падение и лежачая поза." }),
  victory: Object.freeze({ kind: "terminal", description: "Победитель циклически повторяет победный салют." }),
  special: Object.freeze({ kind: "one-shot", description: "Классовый или перковый приём." }),
});

const SIX_FRAMES = Object.freeze([0, 1, 2, 3, 4, 5]);
const ANIMATION_SPRITE_ROWS = Object.freeze({
  "idle.normal": Object.freeze({ row: 0, frames: SIX_FRAMES, fps: 6, loop: true }),
  "idle.tired": Object.freeze({ row: 1, frames: SIX_FRAMES, fps: 5, loop: true }),
  "idle.injured": Object.freeze({ row: 2, frames: SIX_FRAMES, fps: 5, loop: true }),
  attack: Object.freeze({ row: 3, frames: SIX_FRAMES, fps: 12, loop: false }),
  "defense.block": Object.freeze({ row: 4, frames: SIX_FRAMES, fps: 20, loop: false, durationMs: 300 }),
  "defense.dodge": Object.freeze({ row: 5, frames: SIX_FRAMES, fps: 10, loop: false }),
  /* Вторая половина строки 6 — падение. Реакция на обычный удар использует
   * только первые три позы и возвращается в стойку, не изображая смерть. */
  "reaction.hit": Object.freeze({ row: 6, frames: Object.freeze([0, 1, 2, 1, 0]), fps: 10, loop: false }),
  defeated: Object.freeze({ row: 6, frames: Object.freeze([3, 4, 5]), fps: 8, loop: false }),
});
const UNIFIED_ANIMATION_SPRITE_ROWS = Object.freeze({
  ...ANIMATION_SPRITE_ROWS,
  advance: Object.freeze({ row: 7, frames: SIX_FRAMES, fps: 7, loop: true, durationMs: 900 }),
  retreat: Object.freeze({ row: 7, frames: Object.freeze([5, 4, 3, 2, 1, 0]), fps: 7, loop: true, durationMs: 900 }),
  greeting: Object.freeze({ row: 8, frames: SIX_FRAMES, fps: 4, loop: false, durationMs: 1400 }),
  victory: Object.freeze({ row: 9, frames: SIX_FRAMES, fps: 7, loop: true, durationMs: 860 }),
  special: Object.freeze({ row: 10, frames: SIX_FRAMES, fps: 10, loop: false, durationMs: 680 }),
});

/*
 * Контракт unified: тело и экипировка запечены в лист 6×11. Логическая
 * ячейка бойца всегда 256×256, но физическая ячейка может иметь прозрачный
 * буфер для длинного оружия; боец справа зеркалит исходник.
 */
const UNIFIED_ATLAS = Object.freeze({
  columns: 6,
  rows: 11,
  cellWidth: 384,
  cellHeight: 384,
  logicalWidth: 256,
  logicalHeight: 256,
  equipmentBuffer: Object.freeze({ top: 128, right: 64, bottom: 0, left: 64 }),
});
const RETIARIUS_ATLAS = Object.freeze({
  columns: 6,
  rows: 11,
  cellWidth: 384,
  cellHeight: 384,
  logicalWidth: 256,
  logicalHeight: 256,
  equipmentBuffer: Object.freeze({ top: 128, right: 64, bottom: 0, left: 64 }),
});
const UNIFIED_SWORDSMAN_GRID_ID = "unified-swordsman-v9";
const UNIFIED_RETIARIUS_GRID_ID = "unified-retiarius-v5";

const ARENA_BACKGROUNDS = Object.freeze({
  normal: Object.freeze({
    id: "normal",
    assetPath: "./assets/arena-normal-background-v1.png",
    fallbackColor: "#050607",
    groundY: 500,
    ambientLights: Object.freeze([
      Object.freeze({ x: 109, y: 283, scale: 1, phase: 0.08 }),
      Object.freeze({ x: 250, y: 283, scale: 1, phase: 0.61 }),
    ]),
  }),
  sand: Object.freeze({
    id: "sand",
    assetPath: "./assets/arena-sand-background-v2.png",
    fallbackColor: "#100c08",
    groundY: 465,
    ambientLights: Object.freeze([
      Object.freeze({ x: 18, y: 196, scale: 0.55, phase: 0.04 }),
      Object.freeze({ x: 70, y: 197, scale: 0.58, phase: 0.36 }),
      Object.freeze({ x: 123, y: 195, scale: 0.62, phase: 0.71 }),
      Object.freeze({ x: 177, y: 196, scale: 0.65, phase: 0.17 }),
      Object.freeze({ x: 231, y: 195, scale: 0.62, phase: 0.52 }),
      Object.freeze({ x: 284, y: 197, scale: 0.58, phase: 0.83 }),
      Object.freeze({ x: 338, y: 196, scale: 0.55, phase: 0.27 }),
    ]),
  }),
});

const BODY_ANIMATION_GRIDS = Object.freeze({
  [UNIFIED_SWORDSMAN_GRID_ID]: Object.freeze({
    id: UNIFIED_SWORDSMAN_GRID_ID,
    assetPath: "./assets/unified-swordsman-grid-v9.png",
    facing: "right",
    renderable: true,
    experimental: true,
    grid: UNIFIED_ATLAS,
    clips: UNIFIED_ANIMATION_SPRITE_ROWS,
    weaponLayers: Object.freeze({}),
    displayScale: 1,
    weaponBakedIn: true,
    bakedWeaponSkinId: "sword",
    baselineInset: 8 / UNIFIED_ATLAS.logicalHeight,
    sockets: Object.freeze({
      "hand.primary": Object.freeze({ x: 0.56, y: 0.48, rotation: 0 }),
      "hand.rear": Object.freeze({ x: 0.56, y: 0.48, rotation: 0 }),
    }),
  }),
  [UNIFIED_RETIARIUS_GRID_ID]: Object.freeze({
    id: UNIFIED_RETIARIUS_GRID_ID,
    assetPath: "./assets/unified-retiarius-grid-v5.png",
    facing: "right",
    renderable: true,
    experimental: true,
    grid: RETIARIUS_ATLAS,
    clips: UNIFIED_ANIMATION_SPRITE_ROWS,
    weaponLayers: Object.freeze({}),
    displayScale: 1,
    weaponBakedIn: true,
    bakedWeaponSkinId: "trident",
    baselineInset: 8 / RETIARIUS_ATLAS.logicalHeight,
    sockets: Object.freeze({
      "hand.primary": Object.freeze({ x: 0.56, y: 0.48, rotation: 0 }),
      "hand.rear": Object.freeze({ x: 0.38, y: 0.52, rotation: 0 }),
    }),
  }),
});

const EQUIPMENT_ANIMATION_PROFILES = Object.freeze({
  "murmillo-armor": Object.freeze({ id: "murmillo-armor", bodyGridId: UNIFIED_SWORDSMAN_GRID_ID, weaponSocket: null, attackClip: "attack", weaponMotion: "baked" }),
  "thraex-armor": Object.freeze({ id: "thraex-armor", bodyGridId: UNIFIED_SWORDSMAN_GRID_ID, weaponSocket: null, attackClip: "attack", weaponMotion: "baked" }),
  "retiarius-armor": Object.freeze({ id: "retiarius-armor", bodyGridId: UNIFIED_RETIARIUS_GRID_ID, weaponSocket: null, attackClip: "attack", weaponMotion: "baked" }),
  "secutor-armor": Object.freeze({ id: "secutor-armor", bodyGridId: UNIFIED_SWORDSMAN_GRID_ID, weaponSocket: null, attackClip: "attack", weaponMotion: "baked" }),
  "hoplomachus-armor": Object.freeze({ id: "hoplomachus-armor", bodyGridId: UNIFIED_SWORDSMAN_GRID_ID, weaponSocket: null, attackClip: "attack", weaponMotion: "baked" }),
});

const EQUIPMENT_PROFILE_BY_CLASS = Object.freeze({
  murmillo: "murmillo-armor",
  thraex: "thraex-armor",
  retiarius: "retiarius-armor",
  secutor: "secutor-armor",
  hoplomachus: "hoplomachus-armor",
});

const FIGHTER_SKINS = Object.freeze({
  "arena-red": Object.freeze({
    id: "arena-red",
    component: "fighter",
    placeholder: Object.freeze({ shape: "bar", color: "#ef5b5b", accent: "#ffc0a5" }),
    spriteSheet: null,
  }),
  "arena-cyan": Object.freeze({
    id: "arena-cyan",
    component: "fighter",
    placeholder: Object.freeze({ shape: "bar", color: "#3cc8df", accent: "#b9f5ff" }),
    spriteSheet: null,
  }),
  "arena-gold": Object.freeze({
    id: "arena-gold",
    component: "fighter",
    placeholder: Object.freeze({ shape: "bar", color: "#f2b84b", accent: "#fff0a3" }),
    spriteSheet: null,
  }),
});

const WEAPON_SKINS = Object.freeze({
  sword: Object.freeze({
    id: "sword", component: "weapon", placeholder: Object.freeze({ shape: "bar", color: "#f7df83", length: 40 }),
    facing: "right",
    vectorStyle: "gladius",
    spriteSheet: null,
  }),
  sica: Object.freeze({
    id: "sica", component: "weapon", placeholder: Object.freeze({ shape: "bar", color: "#ff9e5f", length: 33 }),
    facing: "left",
    vectorStyle: "sica",
    spriteSheet: null,
  }),
  trident: Object.freeze({
    id: "trident", component: "weapon", facing: "right", placeholder: Object.freeze({ shape: "bar", color: "#c59dff", length: 58 }),
    vectorStyle: "trident",
    spriteSheet: null,
  }),
  spear: Object.freeze({
    id: "spear", component: "weapon", facing: "right", placeholder: Object.freeze({ shape: "bar", color: "#8ee38c", length: 54 }), spriteSheet: null,
  }),
});

const WEAPON_BY_CLASS = Object.freeze({
  murmillo: "sword",
  thraex: "sica",
  retiarius: "trident",
  secutor: "sword",
  hoplomachus: "spear",
});

class SpriteLibrary {
  constructor({
    fighterSkins = FIGHTER_SKINS,
    weaponSkins = WEAPON_SKINS,
    arenaBackgrounds = ARENA_BACKGROUNDS,
  } = {}) {
    this.fighterSkins = fighterSkins;
    this.weaponSkins = weaponSkins;
    this.arenaBackgrounds = arenaBackgrounds;
  }

  resolveFighter(fighter, side) {
    const requestedSkin = fighter.visual?.skinId;
    const skinId = requestedSkin && this.fighterSkins[requestedSkin]
      ? requestedSkin
      : side === 0 ? DEFAULT_SKIN_ID : "arena-cyan";
    return this.fighterSkins[skinId];
  }

  resolveWeapon(fighter) {
    const requestedSkin = fighter.visual?.weaponSkinId;
    const skinId = requestedSkin && this.weaponSkins[requestedSkin]
      ? requestedSkin
      : WEAPON_BY_CLASS[fighter.fighterClass] || "sword";
    return this.weaponSkins[skinId];
  }

  resolveAnimationRig(fighter) {
    const armorSetId = fighter.armorSet?.definitionId?.split(".")[0];
    const profileId = fighter.visual?.equipmentAnimationProfile
      || armorSetId
      || EQUIPMENT_PROFILE_BY_CLASS[fighter.fighterClass]
      || "murmillo-armor";
    return EQUIPMENT_ANIMATION_PROFILES[profileId] || EQUIPMENT_ANIMATION_PROFILES["murmillo-armor"];
  }

  resolveBodyGrid(rig) {
    return BODY_ANIMATION_GRIDS[rig.bodyGridId]
      || BODY_ANIMATION_GRIDS[UNIFIED_SWORDSMAN_GRID_ID];
  }

  resolveArenaBackground(arenaType) {
    return this.arenaBackgrounds[arenaType] || this.arenaBackgrounds.normal;
  }
}

globalThis.GladiatorSpriteLibrary = {
  DEFAULT_SKIN_ID,
  FIGHTER_SKINS,
  WEAPON_SKINS,
  WEAPON_BY_CLASS,
  CORE_VISUAL_STATES,
  ANIMATION_SPRITE_ROWS,
  UNIFIED_ANIMATION_SPRITE_ROWS,
  UNIFIED_ATLAS,
  RETIARIUS_ATLAS,
  UNIFIED_SWORDSMAN_GRID_ID,
  UNIFIED_RETIARIUS_GRID_ID,
  ARENA_BACKGROUNDS,
  BODY_ANIMATION_GRIDS,
  EQUIPMENT_ANIMATION_PROFILES,
  EQUIPMENT_PROFILE_BY_CLASS,
  SpriteLibrary,
};
})();
