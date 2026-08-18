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
  advance: Object.freeze({ kind: "one-shot", description: "Сближение перед атакой." }),
  attack: Object.freeze({ kind: "one-shot", description: "Полная линия атаки, минимум пять кадров." }),
  "defense.block": Object.freeze({ kind: "one-shot", description: "Принятие удара щитом или оружием." }),
  "defense.dodge": Object.freeze({ kind: "one-shot", description: "Уход или backstep." }),
  "reaction.hit": Object.freeze({ kind: "one-shot", description: "Реакция на попадание." }),
  defeated: Object.freeze({ kind: "terminal", description: "Падение и лежачая поза." }),
  victory: Object.freeze({ kind: "loop", description: "Будущий победный loop после результата." }),
  special: Object.freeze({ kind: "one-shot", description: "Классовый или перковый приём." }),
});

const SIX_FRAMES = Object.freeze([0, 1, 2, 3, 4, 5]);
const ANIMATION_SPRITE_ROWS = Object.freeze({
  "idle.normal": Object.freeze({ row: 0, frames: SIX_FRAMES, fps: 6, loop: true }),
  "idle.tired": Object.freeze({ row: 1, frames: SIX_FRAMES, fps: 5, loop: true }),
  "idle.injured": Object.freeze({ row: 2, frames: SIX_FRAMES, fps: 5, loop: true }),
  attack: Object.freeze({ row: 3, frames: SIX_FRAMES, fps: 12, loop: false }),
  "defense.block": Object.freeze({ row: 4, frames: SIX_FRAMES, fps: 10, loop: false }),
  "defense.dodge": Object.freeze({ row: 5, frames: SIX_FRAMES, fps: 12, loop: false }),
  "reaction.hit": Object.freeze({ row: 6, frames: SIX_FRAMES, fps: 10, loop: false }),
  defeated: Object.freeze({ row: 6, frames: Object.freeze([3, 4, 5]), fps: 8, loop: false }),
});

/* Старые листы v1 не выдерживают границы ячеек 6×7. */
const SAFE_GENERATED_BODY_ROWS = Object.freeze({
  "idle.normal": ANIMATION_SPRITE_ROWS["idle.normal"],
  "idle.tired": ANIMATION_SPRITE_ROWS["idle.tired"],
  "idle.injured": ANIMATION_SPRITE_ROWS["idle.injured"],
  attack: Object.freeze({ row: 0, frames: SIX_FRAMES, fps: 8, loop: false }),
  "defense.block": Object.freeze({ row: 0, frames: SIX_FRAMES, fps: 8, loop: false }),
  "defense.dodge": Object.freeze({ row: 0, frames: SIX_FRAMES, fps: 8, loop: false }),
  "reaction.hit": Object.freeze({ row: 0, frames: SIX_FRAMES, fps: 8, loop: false }),
  defeated: Object.freeze({ row: 2, frames: Object.freeze([3, 4, 5]), fps: 6, loop: false }),
});

/*
 * Контракт overlay v4: тело и оружие — листы ровно 6×7, 1536×1792 px.
 * Следовательно, кадр всегда 256×256 px с безопасным полем 32 px. Накладывается одноимённая ячейка
 * без дополнительного сдвига или поворота. Оба исходных листа смотрят вправо;
 * боец справа и его оружие синхронно зеркалятся визуальным адаптером.
 */
const OVERLAY_ATLAS = Object.freeze({ columns: 6, rows: 7, cellWidth: 256, cellHeight: 256 });
const WEAPON_OVERLAY_CLIPS = ANIMATION_SPRITE_ROWS;
const SIX_BEHIND = Object.freeze(["behind", "behind", "behind", "behind", "behind", "behind"]);
const MURMILLO_WEAPON_LAYERS = Object.freeze(Object.fromEntries(
  Object.keys(ANIMATION_SPRITE_ROWS).map((clip) => [clip, SIX_BEHIND]),
));
const RETIARIUS_WEAPON_LAYERS = Object.freeze({
  "idle.normal": SIX_BEHIND,
  "idle.tired": SIX_BEHIND,
  "idle.injured": SIX_BEHIND,
  attack: Object.freeze(["behind", "behind", "front", "front", "front", "behind"]),
  "defense.block": SIX_BEHIND,
  "defense.dodge": SIX_BEHIND,
  "reaction.hit": SIX_BEHIND,
  defeated: Object.freeze(["behind", "behind", "behind"]),
});

const weaponOverlaySheet = (assetPath) => Object.freeze({
  assetPath,
  experimental: true,
  frameOverlay: true,
  grid: OVERLAY_ATLAS,
  clips: WEAPON_OVERLAY_CLIPS,
});

const bodySpriteGrid = (
  id,
  assetPath,
  facing,
  handSocket,
  clips = SAFE_GENERATED_BODY_ROWS,
  weaponLayers = Object.freeze({}),
) => Object.freeze({
  id,
  assetPath,
  facing,
  renderable: true,
  experimental: true,
  grid: OVERLAY_ATLAS,
  clips,
  weaponLayers,
  sockets: Object.freeze({
    "hand.primary": Object.freeze(handSocket),
    "hand.rear": Object.freeze(handSocket),
  }),
});

/* Сетки содержат только тело, одежду и броню — без оружия и щита. */
const BODY_ANIMATION_GRIDS = Object.freeze({
  "murmillo-body-overlay-v3": bodySpriteGrid(
    "murmillo-body-overlay-v3",
    "./assets/murmillo-body-overlay-grid-v3.png",
    "right",
    { x: 0.56, y: 0.48, rotation: 0 },
    ANIMATION_SPRITE_ROWS,
    MURMILLO_WEAPON_LAYERS,
  ),
  "retiarius-body-overlay-v4": bodySpriteGrid(
    "retiarius-body-overlay-v4",
    "./assets/retiarius-body-overlay-grid-v4.png",
    "right",
    { x: 0.56, y: 0.48, rotation: 0 },
    ANIMATION_SPRITE_ROWS,
    RETIARIUS_WEAPON_LAYERS,
  ),
  "murmillo-body-unarmed-v1": bodySpriteGrid(
    "murmillo-body-unarmed-v1",
    "./assets/murmillo-body-unarmed-sprite-sheet-v1.png",
    "right",
    { x: 0.72, y: 0.42, rotation: -0.12 },
  ),
  "thraex-body-unarmed-v1": bodySpriteGrid(
    "thraex-body-unarmed-v1",
    "./assets/thraex-body-unarmed-sprite-sheet-v1.png",
    "left",
    { x: 0.28, y: 0.42, rotation: 0.12 },
  ),
  "crimson-unarmed-v1": Object.freeze({
    id: "crimson-unarmed-v1",
    assetPath: "./assets/gladiator-crimson-body-grid-v1.png",
    facing: "right",
    experimental: true,
    grid: Object.freeze({ columns: 4, rows: 3, cellWidth: 256, cellHeight: 512 }),
    clips: Object.freeze({
      idle: Object.freeze({ frames: [0, 1], fps: 4, loop: true }),
      advance: Object.freeze({ frames: [1, 2], fps: 8, loop: false }),
      attack: Object.freeze({ frames: [2, 3], fps: 10, loop: false }),
      dodge: Object.freeze({ frames: [4, 5], fps: 10, loop: false }),
      block: Object.freeze({ frames: [6], fps: 1, loop: false }),
      hit: Object.freeze({ frames: [7, 8], fps: 10, loop: false }),
      defeated: Object.freeze({ frames: [9, 10, 11], fps: 8, loop: false }),
    }),
    sockets: Object.freeze({
      // Нормализованные точки в пределах клетки. Отсюда крепится оружие.
      "hand.primary": Object.freeze({ x: 0.72, y: 0.42, rotation: -0.12 }),
      "hand.secondary": Object.freeze({ x: 0.31, y: 0.45, rotation: 0.08 }),
    }),
  }),
});

const EQUIPMENT_ANIMATION_PROFILES = Object.freeze({
  "murmillo-armor": Object.freeze({ id: "murmillo-armor", bodyGridId: "murmillo-body-overlay-v3", weaponSocket: "hand.primary", attackClip: "attack", weaponMotion: "slash" }),
  "thraex-armor": Object.freeze({ id: "thraex-armor", bodyGridId: "thraex-body-unarmed-v1", weaponSocket: "hand.primary", attackClip: "attack", weaponMotion: "hook-slash" }),
  "retiarius-armor": Object.freeze({ id: "retiarius-armor", bodyGridId: "retiarius-body-overlay-v4", weaponSocket: "hand.rear", attackClip: "attack", weaponMotion: "thrust" }),
  "secutor-armor": Object.freeze({ id: "secutor-armor", bodyGridId: "crimson-unarmed-v1", weaponSocket: "hand.primary", attackClip: "attack", weaponMotion: "thrust" }),
  "hoplomachus-armor": Object.freeze({ id: "hoplomachus-armor", bodyGridId: "crimson-unarmed-v1", weaponSocket: "hand.primary", attackClip: "attack", weaponMotion: "thrust" }),
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
    assetPath: "./assets/gladiator-crimson-placeholder.png",
    spriteSheet: null,
  }),
  "arena-cyan": Object.freeze({
    id: "arena-cyan",
    component: "fighter",
    placeholder: Object.freeze({ shape: "bar", color: "#3cc8df", accent: "#b9f5ff" }),
    assetPath: "./assets/gladiator-cyan-placeholder.png",
    spriteSheet: null,
  }),
  "arena-gold": Object.freeze({
    id: "arena-gold",
    component: "fighter",
    placeholder: Object.freeze({ shape: "bar", color: "#f2b84b", accent: "#fff0a3" }),
    assetPath: "./assets/gladiator-crimson-placeholder.png",
    spriteSheet: null,
  }),
});

const WEAPON_SKINS = Object.freeze({
  sword: Object.freeze({
    id: "sword", component: "weapon", placeholder: Object.freeze({ shape: "bar", color: "#f7df83", length: 40 }),
    facing: "right",
    vectorStyle: "gladius",
    assetPath: "./assets/gladius-overlay-grid-v3.png",
    spriteSheet: weaponOverlaySheet("./assets/gladius-overlay-grid-v3.png"),
  }),
  sica: Object.freeze({
    id: "sica", component: "weapon", placeholder: Object.freeze({ shape: "bar", color: "#ff9e5f", length: 33 }),
    facing: "left",
    vectorStyle: "sica",
    assetPath: "./assets/sica-overlay-sheet-v2.png",
    spriteSheet: weaponOverlaySheet("./assets/sica-overlay-sheet-v2.png"),
  }),
  trident: Object.freeze({
    id: "trident", component: "weapon", facing: "right", placeholder: Object.freeze({ shape: "bar", color: "#c59dff", length: 58 }),
    assetPath: "./assets/trident-overlay-grid-v4.png",
    spriteSheet: weaponOverlaySheet("./assets/trident-overlay-grid-v4.png"),
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
  constructor({ fighterSkins = FIGHTER_SKINS, weaponSkins = WEAPON_SKINS } = {}) {
    this.fighterSkins = fighterSkins;
    this.weaponSkins = weaponSkins;
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
      || BODY_ANIMATION_GRIDS["crimson-unarmed-v1"];
  }
}

globalThis.GladiatorSpriteLibrary = {
  DEFAULT_SKIN_ID,
  FIGHTER_SKINS,
  WEAPON_SKINS,
  WEAPON_BY_CLASS,
  CORE_VISUAL_STATES,
  ANIMATION_SPRITE_ROWS,
  SAFE_GENERATED_BODY_ROWS,
  OVERLAY_ATLAS,
  BODY_ANIMATION_GRIDS,
  EQUIPMENT_ANIMATION_PROFILES,
  EQUIPMENT_PROFILE_BY_CLASS,
  SpriteLibrary,
};
})();
