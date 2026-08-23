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
  "idle.injured.light": Object.freeze({ kind: "loop", description: "Слабая раненая стойка: сокращённый цикл без глубоких кадров." }),
  "idle.injured": Object.freeze({ kind: "loop", description: "Раненая стойка: бережёт повреждённую сторону." }),
  greeting: Object.freeze({ kind: "one-shot", description: "Приветствие соперника перед стартовым сближением." }),
  advance: Object.freeze({ kind: "one-shot", description: "Сближение перед атакой." }),
  attack: Object.freeze({ kind: "one-shot", description: "Полная линия атаки, минимум пять кадров." }),
  "attack.spinning": Object.freeze({ kind: "one-shot", description: "Удар мечом с полным разворотом корпуса." }),
  "defense.block": Object.freeze({ kind: "one-shot", description: "Принятие удара щитом или оружием." }),
  "defense.dodge": Object.freeze({ kind: "one-shot", description: "Уход или backstep." }),
  "defense.miss": Object.freeze({ kind: "one-shot", description: "Короткий неглубокий уход от прошедшего мимо оружия." }),
  "reaction.hit": Object.freeze({ kind: "one-shot", description: "Реакция на попадание." }),
  defeated: Object.freeze({ kind: "terminal", description: "Падение и лежачая поза." }),
  victory: Object.freeze({ kind: "terminal", description: "Победитель завершает салют и удерживает живую финальную позу." }),
  special: Object.freeze({ kind: "one-shot", description: "Классовый или перковый приём." }),
  "special.enhanced": Object.freeze({ kind: "one-shot", description: "Усиленная версия классового приёма." }),
  "reaction.stunned": Object.freeze({ kind: "loop", description: "Оглушённый боец приседает и прикрывает голову свободной рукой." }),
});

const SIX_FRAMES = Object.freeze([0, 1, 2, 3, 4, 5]);
const defineAnimationClip = ({
  row,
  fps,
  sequence = SIX_FRAMES,
  repeatSequence = null,
  frameDurationsMs = null,
  repeatFrameDurationsMs = null,
  keepAlive = false,
  durationMs,
}) => {
  const frozenSequence = Object.freeze([...sequence]);
  const frozenFrameDurations = frameDurationsMs
    ? Object.freeze([...frameDurationsMs])
    : null;
  const repeat = repeatSequence
    ? Object.freeze({
      sequence: Object.freeze([...repeatSequence]),
      frameDurationsMs: repeatFrameDurationsMs
        ? Object.freeze([...repeatFrameDurationsMs])
        : null,
      keepAlive,
    })
    : null;
  return Object.freeze({
    row,
    fps,
    durationMs,
    /* frames оставлен как read-only alias для рендера старых интеграций;
     * каноническая временная схема находится в playback. */
    frames: frozenSequence,
    playback: Object.freeze({ sequence: frozenSequence, frameDurationsMs: frozenFrameDurations, repeat }),
  });
};

const clipFrameSequence = (clip) => clip?.playback?.sequence || clip?.frames || [];
const clipRepeat = (clip) => clip?.playback?.repeat
  || (clip?.loop ? { sequence: clipFrameSequence(clip), keepAlive: false } : null);
const clipIntroDurationMs = (clip) => clip?.durationMs
  ?? clip?.playback?.frameDurationsMs?.reduce((total, value) => total + value, 0)
  ?? (clipFrameSequence(clip).length && clip?.fps
    ? clipFrameSequence(clip).length / clip.fps * 1000
    : 0);

const animationFrameForElapsed = (clip, elapsedMs = 0, introDurationOverride) => {
  const sequence = clipFrameSequence(clip);
  if (!sequence.length) return 0;
  const elapsed = Math.max(0, elapsedMs);
  const introDuration = introDurationOverride ?? clipIntroDurationMs(clip);
  const repeat = clipRepeat(clip);
  if (repeat?.sequence?.length && elapsed >= introDuration) {
    if (repeat.frameDurationsMs?.length === repeat.sequence.length) {
      const repeatDuration = repeat.frameDurationsMs.reduce((total, value) => total + value, 0);
      let repeatElapsed = (elapsed - introDuration) % repeatDuration;
      for (let index = 0; index < repeat.sequence.length; index += 1) {
        if (repeatElapsed < repeat.frameDurationsMs[index]) return repeat.sequence[index];
        repeatElapsed -= repeat.frameDurationsMs[index];
      }
    }
    const repeatElapsedFrame = Math.floor((elapsed - introDuration) / 1000 * clip.fps);
    return repeat.sequence[repeatElapsedFrame % repeat.sequence.length];
  }

  const frameDurations = clip?.playback?.frameDurationsMs;
  if (frameDurations?.length === sequence.length) {
    let introElapsed = Math.min(elapsed, Math.max(0, introDuration - 0.001));
    for (let index = 0; index < sequence.length; index += 1) {
      if (introElapsed < frameDurations[index]) return sequence[index];
      introElapsed -= frameDurations[index];
    }
  }

  if (!introDuration) return sequence.at(-1);
  const sequenceIndex = Math.min(
    sequence.length - 1,
    Math.floor(elapsed / introDuration * sequence.length),
  );
  return sequence[sequenceIndex];
};

const ANIMATION_SPRITE_ROWS = Object.freeze({
  "idle.normal": defineAnimationClip({ row: 0, fps: 6, repeatSequence: SIX_FRAMES, keepAlive: true }),
  "idle.tired": defineAnimationClip({ row: 1, fps: 5, repeatSequence: SIX_FRAMES, keepAlive: true }),
  "idle.injured.light": defineAnimationClip({ row: 2, fps: 1.5, sequence: [0, 1], repeatSequence: [0, 1], keepAlive: true }),
  "idle.injured": defineAnimationClip({ row: 2, fps: 5, repeatSequence: SIX_FRAMES, keepAlive: true }),
  attack: defineAnimationClip({ row: 3, fps: 12 }),
  "defense.block": defineAnimationClip({ row: 4, fps: 20, durationMs: 300 }),
  "defense.dodge": defineAnimationClip({ row: 5, fps: 10 }),
  /* Промах использует только неглубокую часть уклонения и сразу возвращает
   * бойца в исходную позу. Отдельный клип не требует нового ряда ассета. */
  "defense.miss": defineAnimationClip({ row: 5, fps: 18, sequence: [0, 1, 2, 1, 0], durationMs: 280 }),
  /* Вторая половина строки 6 — падение. Реакция на обычный удар использует
   * только первые три позы и возвращается в стойку, не изображая смерть. */
  "reaction.hit": defineAnimationClip({ row: 6, fps: 10, sequence: [0, 1, 2, 1, 0] }),
  defeated: defineAnimationClip({ row: 6, fps: 8, sequence: [3, 4, 5] }),
});
const UNIFIED_ANIMATION_SPRITE_ROWS = Object.freeze({
  ...ANIMATION_SPRITE_ROWS,
  advance: defineAnimationClip({ row: 7, fps: 7, repeatSequence: SIX_FRAMES, durationMs: 900 }),
  retreat: defineAnimationClip({ row: 7, fps: 7, sequence: [5, 4, 3, 2, 1, 0], repeatSequence: [5, 4, 3, 2, 1, 0], durationMs: 900 }),
  greeting: defineAnimationClip({ row: 8, fps: 4, durationMs: 1400 }),
  victory: defineAnimationClip({ row: 9, fps: 7, repeatSequence: [4, 5], keepAlive: true, durationMs: 860 }),
  special: defineAnimationClip({ row: 10, fps: 10, durationMs: 680 }),
});
const STUNNED_ANIMATION_CLIP = defineAnimationClip({
  row: 12,
  fps: 6,
  sequence: [0, 1, 2, 4, 2, 4, 2, 5],
  repeatSequence: [0, 1, 2, 4, 2, 4, 2, 5],
  frameDurationsMs: [160, 160, 230, 230, 230, 230, 230, 180],
  repeatFrameDurationsMs: [160, 160, 230, 230, 230, 230, 230, 180],
  keepAlive: true,
  durationMs: 1650,
});
const UNIFIED_SWORDSMAN_ANIMATION_SPRITE_ROWS = Object.freeze({
  ...UNIFIED_ANIMATION_SPRITE_ROWS,
  "special.enhanced": defineAnimationClip({ row: 11, fps: 11, durationMs: 760 }),
  "reaction.stunned": STUNNED_ANIMATION_CLIP,
  "attack.spinning": defineAnimationClip({ row: 13, fps: 10, durationMs: 780 }),
});
const UNIFIED_RETIARIUS_ANIMATION_SPRITE_ROWS = Object.freeze({
  ...UNIFIED_ANIMATION_SPRITE_ROWS,
  "special.enhanced": defineAnimationClip({ row: 11, fps: 10, durationMs: 780 }),
  "reaction.stunned": STUNNED_ANIMATION_CLIP,
});

/*
 * Контракт мечника: тело и экипировка запечены в лист 6×14. Ретиарий расширен
 * до 13 строк усиленным ударом и оглушением. Логическая ячейка бойца всегда 256×256, но
 * физическая ячейка может иметь прозрачный буфер для длинного оружия;
 * боец справа зеркалит исходник.
 */
const UNIFIED_ATLAS = Object.freeze({
  columns: 6,
  rows: 14,
  cellWidth: 384,
  cellHeight: 384,
  logicalWidth: 256,
  logicalHeight: 256,
  equipmentBuffer: Object.freeze({ top: 128, right: 64, bottom: 0, left: 64 }),
});
const RETIARIUS_ATLAS = Object.freeze({
  columns: 6,
  rows: 13,
  cellWidth: 384,
  cellHeight: 384,
  logicalWidth: 256,
  logicalHeight: 256,
  equipmentBuffer: Object.freeze({ top: 128, right: 64, bottom: 0, left: 64 }),
});
const UNIFIED_SWORDSMAN_GRID_ID = "unified-swordsman-v16";
const UNIFIED_RETIARIUS_GRID_ID = "unified-retiarius-v8";

const ARENA_BACKGROUNDS = Object.freeze({
  crowd: Object.freeze({
    id: "crowd",
    assetPath: "./assets/arena-crowd-background-v1.png",
    fallbackColor: "#100b09",
    groundY: 470,
    ambientLights: Object.freeze([
      Object.freeze({ x: 84, y: 354, scale: 0.9, phase: 0.14 }),
      Object.freeze({ x: 278, y: 354, scale: 0.9, phase: 0.67 }),
    ]),
    crowdMotion: Object.freeze([
      Object.freeze({ x: 18, y: 214, scale: 0.8, phase: 0.04 }),
      Object.freeze({ x: 39, y: 236, scale: 1, phase: 0.31 }),
      Object.freeze({ x: 61, y: 208, scale: 0.8, phase: 0.72 }),
      Object.freeze({ x: 82, y: 252, scale: 1, phase: 0.19 }),
      Object.freeze({ x: 106, y: 224, scale: 0.9, phase: 0.53 }),
      Object.freeze({ x: 128, y: 258, scale: 1, phase: 0.87 }),
      Object.freeze({ x: 151, y: 211, scale: 0.8, phase: 0.38 }),
      Object.freeze({ x: 174, y: 242, scale: 1, phase: 0.08 }),
      Object.freeze({ x: 196, y: 218, scale: 0.9, phase: 0.61 }),
      Object.freeze({ x: 218, y: 258, scale: 1, phase: 0.27 }),
      Object.freeze({ x: 241, y: 229, scale: 0.9, phase: 0.94 }),
      Object.freeze({ x: 263, y: 207, scale: 0.8, phase: 0.45 }),
      Object.freeze({ x: 284, y: 249, scale: 1, phase: 0.13 }),
      Object.freeze({ x: 306, y: 220, scale: 0.9, phase: 0.79 }),
      Object.freeze({ x: 326, y: 256, scale: 1, phase: 0.35 }),
      Object.freeze({ x: 344, y: 211, scale: 0.8, phase: 0.57 }),
    ]),
  }),
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
    assetPath: "./assets/unified-swordsman-grid-v16.png",
    facing: "right",
    renderable: true,
    experimental: true,
    grid: UNIFIED_ATLAS,
    clips: UNIFIED_SWORDSMAN_ANIMATION_SPRITE_ROWS,
    weaponLayers: Object.freeze({}),
    displayScale: 1,
    stateRenderScales: Object.freeze({ victory: 1.08 }),
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
    assetPath: "./assets/unified-retiarius-grid-v8.png",
    facing: "right",
    renderable: true,
    experimental: true,
    grid: RETIARIUS_ATLAS,
    clips: UNIFIED_RETIARIUS_ANIMATION_SPRITE_ROWS,
    weaponLayers: Object.freeze({}),
    displayScale: 1,
    // Победная строка исходного атласа нарисована крупнее остальных строк.
    // Компенсация сохраняет рост ретиария при переходе из стойки в салют.
    stateRenderScales: Object.freeze({ victory: 0.77 }),
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
    return this.arenaBackgrounds[arenaType] || this.arenaBackgrounds.crowd;
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
  animationFrameForElapsed,
  clipFrameSequence,
  clipIntroDurationMs,
  clipRepeat,
  defineAnimationClip,
  SpriteLibrary,
};
})();
