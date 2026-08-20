(function () {
"use strict";

const { SpriteLibrary } = globalThis.GladiatorSpriteLibrary || {};

if (!SpriteLibrary) {
  throw new Error("Сначала подключите sprite-library.js");
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const lerp = (from, to, progress) => from + (to - from) * progress;
const easeOut = (progress) => 1 - (1 - progress) ** 3;
const freeze = (value) => Object.freeze(value);
const PRESENTATIONS = Object.freeze({ mobile: "mobile" });
const RENDERER_MODES = Object.freeze({ lines: "lines", assets: "assets" });
const POSITION_STAGES = Object.freeze({ entrance: "entrance", combat: "combat" });
const INJURED_HEALTH_RATIO = 0.45;
const PRESSURE_STEP_DISTANCE = 12;
const PRESSURE_DISTANCE = 60;
const ARENA_CAMERA_FOLLOW_RATIO = 0.35;
const ARENA_CAMERA_ZOOM = 1.15;
const BLOOD_PATTERN = Object.freeze([
  Object.freeze({ distance: 12, lift: 5, gravity: 4, size: 9, delay: 0, color: "#e13728" }),
  Object.freeze({ distance: 20, lift: 13, gravity: 6, size: 8, delay: 0.01, color: "#c91f1a" }),
  Object.freeze({ distance: 29, lift: 2, gravity: 8, size: 7, delay: 0.02, color: "#9d1513" }),
  Object.freeze({ distance: 37, lift: 24, gravity: 10, size: 6, delay: 0.03, color: "#d62b20" }),
  Object.freeze({ distance: 48, lift: 35, gravity: 14, size: 5, delay: 0.05, color: "#8d1111" }),
  Object.freeze({ distance: 61, lift: 16, gravity: 18, size: 5, delay: 0.07, color: "#c3261b" }),
  Object.freeze({ distance: 73, lift: 43, gravity: 22, size: 4, delay: 0.09, color: "#a91414" }),
  Object.freeze({ distance: 84, lift: 27, gravity: 26, size: 4, delay: 0.11, color: "#731010" }),
  Object.freeze({ distance: 55, lift: 52, gravity: 28, size: 4, delay: 0.13, color: "#b71916" }),
  Object.freeze({ distance: 42, lift: 61, gravity: 31, size: 3, delay: 0.15, color: "#99130f" }),
  Object.freeze({ distance: 94, lift: 36, gravity: 34, size: 3, delay: 0.17, color: "#d62b20" }),
  Object.freeze({ distance: 68, lift: 7, gravity: 39, size: 5, delay: 0.19, color: "#7b0d0d" }),
  Object.freeze({ distance: 52, lift: -8, gravity: 45, size: 4, delay: 0.21, color: "#5f0b0b" }),
  Object.freeze({ distance: 33, lift: 39, gravity: 38, size: 4, delay: 0.23, color: "#e13728" }),
  Object.freeze({ distance: 103, lift: 51, gravity: 46, size: 3, delay: 0.25, color: "#8d1111" }),
  Object.freeze({ distance: 88, lift: 12, gravity: 52, size: 3, delay: 0.27, color: "#c3261b" }),
  Object.freeze({ distance: 64, lift: 68, gravity: 50, size: 3, delay: 0.29, color: "#731010" }),
  Object.freeze({ distance: 46, lift: 21, gravity: 55, size: 3, delay: 0.31, color: "#a91414" }),
  Object.freeze({ distance: 112, lift: 33, gravity: 61, size: 3, delay: 0.33, color: "#5f0b0b" }),
  Object.freeze({ distance: 78, lift: 58, gravity: 58, size: 2, delay: 0.35, color: "#d62b20" }),
  Object.freeze({ distance: 58, lift: 4, gravity: 64, size: 3, delay: 0.37, color: "#8d1111" }),
  Object.freeze({ distance: 97, lift: 73, gravity: 68, size: 2, delay: 0.39, color: "#b71916" }),
  Object.freeze({ distance: 121, lift: 17, gravity: 72, size: 2, delay: 0.41, color: "#731010" }),
  Object.freeze({ distance: 70, lift: 31, gravity: 74, size: 2, delay: 0.43, color: "#c3261b" }),
  Object.freeze({ distance: 39, lift: 52, gravity: 69, size: 2, delay: 0.45, color: "#99130f" }),
  Object.freeze({ distance: 108, lift: 62, gravity: 77, size: 2, delay: 0.47, color: "#5f0b0b" }),
  Object.freeze({ distance: 86, lift: -3, gravity: 81, size: 2, delay: 0.49, color: "#a91414" }),
  Object.freeze({ distance: 126, lift: 45, gravity: 84, size: 2, delay: 0.51, color: "#7b0d0d" }),
  Object.freeze({ distance: 34, lift: 78, gravity: 86, size: 3, delay: 0.53 }),
  Object.freeze({ distance: 139, lift: 25, gravity: 92, size: 2, delay: 0.55 }),
  Object.freeze({ distance: 116, lift: 82, gravity: 96, size: 2, delay: 0.57 }),
  Object.freeze({ distance: 74, lift: -12, gravity: 101, size: 3, delay: 0.59 }),
  Object.freeze({ distance: 148, lift: 57, gravity: 106, size: 2, delay: 0.61 }),
  Object.freeze({ distance: 51, lift: 93, gravity: 109, size: 2, delay: 0.63 }),
  Object.freeze({ distance: 131, lift: 4, gravity: 114, size: 2, delay: 0.65 }),
  Object.freeze({ distance: 96, lift: 71, gravity: 118, size: 2, delay: 0.67 }),
  Object.freeze({ distance: 27, lift: 18, gravity: 24, size: 3, delay: 0.04 }),
  Object.freeze({ distance: 44, lift: 47, gravity: 37, size: 2, delay: 0.08 }),
  Object.freeze({ distance: 63, lift: 29, gravity: 49, size: 3, delay: 0.12 }),
  Object.freeze({ distance: 81, lift: 64, gravity: 63, size: 2, delay: 0.16 }),
  Object.freeze({ distance: 102, lift: 38, gravity: 79, size: 2, delay: 0.2 }),
  Object.freeze({ distance: 119, lift: 77, gravity: 93, size: 2, delay: 0.24 }),
  Object.freeze({ distance: 137, lift: 22, gravity: 111, size: 2, delay: 0.28 }),
]);
const BLOOD_COLORS = Object.freeze(["#260409", "#3a060e", "#4f0813", "#610a17", "#70101b"]);
const BLOOD_IMPACT_PROFILES = Object.freeze({
  light: Object.freeze({ count: 7, size: 0.48, distance: 0.38, lift: 0.5, gravity: 0.85, alphaFade: 0.76 }),
  normal: Object.freeze({ count: 14, size: 0.66, distance: 0.58, lift: 0.68, gravity: 1, alphaFade: 0.68 }),
  strong: Object.freeze({ count: 26, size: 0.9, distance: 0.86, lift: 0.88, gravity: 1.2, alphaFade: 0.6 }),
  critical: Object.freeze({ count: 43, size: 1.28, distance: 1.22, lift: 1.05, gravity: 1.65, alphaFade: 0.46 }),
});
const BLOOD_STAIN_PROFILES = Object.freeze({
  light: Object.freeze({ count: 1, scale: 0.75 }),
  normal: Object.freeze({ count: 2, scale: 0.95 }),
  strong: Object.freeze({ count: 4, scale: 1.15 }),
  critical: Object.freeze({ count: 7, scale: 1.4 }),
});
const BLOOD_STAIN_SIZE_MULTIPLIER = 1.2;
const BLOOD_STAIN_LIFETIME_MULTIPLIER = 1.2;
const INJURED_BLEED_CYCLE_MS = 1050;

const isInjuredFighter = (fighter) => fighter.health > 0 && (
  fighter.health / Math.max(1, fighter.maxHealth) < INJURED_HEALTH_RATIO
  || fighter.traumas?.length
  || fighter.injuries?.length
);

const fighterFromInput = (fighter) => ({
  id: fighter.id,
  name: fighter.name,
  fighterClass: fighter.fighterClass,
  health: fighter.base.health,
  maxHealth: fighter.base.health,
  fatigue: 0,
  visual: fighter.visual,
});

const isSpecialAction = (action) => Boolean(
  action?.attackType === "achilles-leap"
  || action?.classTechnique
  || action?.specialAttack,
);

const isRangedSpecialAction = (action) => (
  action?.classTechnique === "weapon.retiarius-net-cast"
);

const actionMotion = (fighter, action) => {
  if (!action) return "idle";
  if (action.actorId === fighter.id) {
    if (isSpecialAction(action)) return isRangedSpecialAction(action) ? "special-ranged" : "special";
    return "attack";
  }
  if (action.targetId === fighter.id) return action.outcome;
  return "idle";
};

const visualStateForFighter = (fighter, action, outcome, showOutcome) => {
  if (fighter.health <= 0) return "defeated";
  if (showOutcome && outcome?.type === "victory" && outcome.winnerId === fighter.id) return "victory";
  if (action?.actorId === fighter.id) return isSpecialAction(action) ? "special" : "attack";
  if (action?.targetId === fighter.id) {
    return ({ hit: "reaction.hit", dodge: "defense.dodge", block: "defense.block" }[action.outcome] || "idle.normal");
  }
  if (isInjuredFighter(fighter)) return "idle.injured";
  if (fighter.fatigue >= 70) return "idle.tired";
  return "idle.normal";
};

const visualPressure = (fighters) => {
  const difference = (fighters[0]?.initiative || 0) - (fighters[1]?.initiative || 0);
  const initiative = Math.abs(difference) < 8 ? 0 : clamp(difference / 70, -1, 1);
  const healthRatio = (fighter) => clamp(
    (fighter?.health || 0) / Math.max(1, fighter?.maxHealth || 1),
    0,
    1,
  );
  const health = clamp((healthRatio(fighters[0]) - healthRatio(fighters[1])) * 0.5, -0.5, 0.5);
  return freeze({ initiative, health, total: clamp(initiative + health, -1, 1) });
};

const componentMotion = (kind, motion, direction, scale) => {
  const idle = freeze({ duration: 0, x: 0, y: 0, rotation: 0 });
  if (motion === "idle") return idle;
  if (motion === "attack" || motion === "leap" || motion === "special" || motion === "special-ranged") {
    const rangedSpecial = motion === "special-ranged";
    return freeze({
      duration: motion === "leap" ? 760 : motion.startsWith("special") ? 680 : 560,
      x: direction * (rangedSpecial ? 0 : motion === "leap" ? 28 : motion === "special" ? 22 : 18) * scale,
      y: (motion === "leap" || motion === "special" ? -12 : -4) * scale,
      rotation: kind === "weapon" ? direction * (motion === "leap" ? 1.15 : 0.55) : 0,
    });
  }
  if (motion === "dodge") return freeze({ duration: 430, x: direction * -16 * scale, y: 0, rotation: 0 });
  if (motion === "block") return freeze({ duration: 300, x: direction * -4 * scale, y: 0, rotation: kind === "weapon" ? direction * -0.24 : 0 });
  if (motion === "hit") return freeze({ duration: 390, x: direction * -10 * scale, y: 5 * scale, rotation: direction * -0.12 });
  if (motion === "advance" || motion === "retreat") return freeze({ duration: 900, x: 0, y: 0, rotation: 0 });
  return freeze({ duration: 400, x: 0, y: 0, rotation: kind === "weapon" ? direction * 0.25 : 0 });
};

const sheetMotion = (motion, sheetClip, direction) => {
  const duration = sheetClip?.durationMs
    ?? ({ attack: 560, leap: 760, special: 680, "special-ranged": 680, dodge: 430, block: 300, hit: 390 }[motion] || 0);
  const lunge = motion === "leap" ? 18 : motion === "special" ? 14 : motion === "attack" ? 12 : 0;
  return freeze({
    duration,
    x: direction * lunge,
    y: 0,
    rotation: 0,
    returnToOrigin: lunge > 0,
  });
};

/* Логическое тело выводится высотой 150 px. Физический кадр может быть больше
 * 256×256 за счёт прозрачного буфера оружия; он не меняет масштаб тела. */
const presentationConfig = (sceneHeight = 300) => {
  const extraHeight = clamp(Math.round(sceneHeight) - 300, 0, 40);
  return ({
    combatPositions: [120, 240],
    entrancePositions: [78, 282],
    groundY: 280 + Math.round(extraHeight * 0.55),
    scale: 3.2,
    assetHeight: 150,
    pressureDistance: PRESSURE_DISTANCE,
  });
};

const resolveTerritoryOffset = (displayedOffset, desiredOffset) => (
  Math.abs(desiredOffset - displayedOffset) >= PRESSURE_STEP_DISTANCE
    ? desiredOffset
    : displayedOffset
);

const arenaViewport = (width, height, frame, image, cameraOffset = frame.arena.cameraOffset || 0) => {
  const zoom = frame.arena.cameraZoom || 1;
  const sourceWidth = Math.min(image.naturalWidth, width / zoom);
  const sourceHeight = Math.min(image.naturalHeight, height);
  const centeredSourceX = (image.naturalWidth - sourceWidth) / 2;
  const sourceX = clamp(
    centeredSourceX + cameraOffset / zoom,
    0,
    image.naturalWidth - sourceWidth,
  );
  const sourceY = clamp(
    (frame.arena.sourceGroundY || image.naturalHeight) - frame.arena.groundY,
    0,
    image.naturalHeight - sourceHeight,
  );
  return freeze({
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    scaleX: width / sourceWidth,
    scaleY: height / sourceHeight,
  });
};

/*
 * Чистый адаптер: вход — снимок симуляции, выход — визуальная сцена.
 * Он не меняет snapshot и не импортирует BattleEngine, поэтому реплей можно
 * передать из сети, файла или другого боевого движка.
 */
const createVisualFrame = (
  snapshot,
  input,
  spriteLibrary = new SpriteLibrary(),
  {
    presentation = PRESENTATIONS.mobile,
    rendererMode = RENDERER_MODES.lines,
    positionStage = POSITION_STAGES.combat,
    territoryOffsetOverride = null,
    sceneHeight = 300,
  } = {},
) => {
  const config = presentationConfig(sceneHeight);
  const arenaType = snapshot?.arena?.type || input.arena?.type || "crowd";
  const arenaBackground = spriteLibrary.resolveArenaBackground(arenaType);
  const sourceFighters = snapshot?.fighters || input.fighters.map(fighterFromInput);
  const fighters = sourceFighters.map((fighter, index) => ({
    ...fighter,
    visual: fighter.visual || input.fighters.find((candidate) => candidate.id === fighter.id)?.visual || input.fighters[index]?.visual,
  }));
  const pressure = visualPressure(fighters);
  const isEntrance = positionStage === POSITION_STAGES.entrance;
  const desiredTerritoryOffset = isEntrance ? 0 : Math.round(pressure.total * config.pressureDistance);
  const territoryOffset = isEntrance
    ? 0
    : Number.isFinite(territoryOffsetOverride)
      ? clamp(Math.round(territoryOffsetOverride), -config.pressureDistance, config.pressureDistance)
      : desiredTerritoryOffset;
  const cameraOffset = isEntrance ? 0 : Math.round(territoryOffset * ARENA_CAMERA_FOLLOW_RATIO);
  const screenTerritoryOffset = territoryOffset - cameraOffset;
  const anchorPositions = isEntrance ? config.entrancePositions : config.combatPositions;
  const positions = anchorPositions.map((position) => position + screenTerritoryOffset);
  const showOutcome = snapshot?.label === "Итог боя";
  const action = showOutcome ? null : snapshot?.lastAction;
  const components = fighters.flatMap((fighter, side) => {
    const direction = side === 0 ? 1 : -1;
    const fighterSkin = spriteLibrary.resolveFighter(fighter, side);
    const weaponSkin = spriteLibrary.resolveWeapon(fighter);
    const animationRig = spriteLibrary.resolveAnimationRig(fighter);
    const bodyGrid = spriteLibrary.resolveBodyGrid(animationRig);
    const visualMovement = fighter.health > 0 ? snapshot?.visualMovement?.[fighter.id] : null;
    const visualState = visualMovement || visualStateForFighter(fighter, action, snapshot?.outcome, showOutcome);
    const motion = visualMovement || (visualState === "victory" ? "victory" : actionMotion(fighter, action));
    const spriteAssets = rendererMode === RENDERER_MODES.assets && bodyGrid.renderable;
    const desiredFacing = side === 0 ? "right" : "left";
    const bodyClip = bodyGrid.clips[visualState]
      ? visualState
      : motion === "leap" || motion.startsWith("special") ? animationRig.attackClip : "idle.normal";
    const sheetClip = bodyGrid.clips[bodyClip];
    const weaponClip = weaponSkin.spriteSheet?.clips?.[bodyClip] || null;
    const usesVectorWeapon = spriteAssets && Boolean(weaponSkin.vectorStyle);
    const assetHeight = config.assetHeight * (bodyGrid.displayScale || 1);
    const baselineOffset = spriteAssets ? assetHeight * (bodyGrid.baselineInset || 0) : 0;
    const base = {
      x: positions[side],
      y: spriteAssets ? config.groundY + baselineOffset : fighter.health <= 0 ? config.groundY - 9 : config.groundY - 38 * config.scale,
      direction,
      scale: config.scale,
    };
    const fighterComponent = freeze({
        id: fighter.id + ":fighter", fighterId: fighter.id, kind: "fighter", skinId: fighterSkin.id,
        placeholder: fighterSkin.placeholder,
        assetPath: bodyGrid.renderable ? bodyGrid.assetPath : null,
        animation: freeze({
          equipmentProfileId: animationRig.id, bodyGridId: bodyGrid.id, state: visualState,
          clip: bodyClip, experimental: bodyGrid.experimental, weaponBakedIn: bodyGrid.weaponBakedIn,
          renderScale: bodyGrid.stateRenderScales?.[visualState] || 1,
          weaponSkinId: bodyGrid.weaponBakedIn ? bodyGrid.bakedWeaponSkinId : weaponSkin.id,
          sheet: freeze({
            columns: bodyGrid.grid.columns,
            rows: bodyGrid.grid.rows,
            logicalWidth: bodyGrid.grid.logicalWidth || bodyGrid.grid.cellWidth,
            logicalHeight: bodyGrid.grid.logicalHeight || bodyGrid.grid.cellHeight,
            equipmentBuffer: bodyGrid.grid.equipmentBuffer || null,
            ...sheetClip,
          }),
          mirrored: (bodyGrid.facing || "right") !== desiredFacing,
          assetHeight: assetHeight || null,
        }),
        transform: freeze(base), motion: spriteAssets ? sheetMotion(motion, sheetClip, direction) : componentMotion("fighter", motion, direction, config.scale),
      });
    if (bodyGrid.weaponBakedIn) return [fighterComponent];
    return [
      fighterComponent,
      freeze({
        id: fighter.id + ":weapon", fighterId: fighter.id, kind: "weapon", skinId: weaponSkin.id,
        placeholder: weaponSkin.placeholder, assetPath: weaponSkin.assetPath || null,
        attachment: freeze({
          socket: animationRig.weaponSocket,
          ...bodyGrid.sockets[animationRig.weaponSocket],
          motion: animationRig.weaponMotion,
          mode: weaponSkin.spriteSheet?.frameOverlay ? "frame-overlay" : usesVectorWeapon ? "asset-socket" : "socket",
        }),
        animation: weaponClip
          ? freeze({
            state: visualState, clip: bodyClip, experimental: weaponSkin.spriteSheet.experimental,
            renderScale: bodyGrid.stateRenderScales?.[visualState] || 1,
            sheet: freeze({ ...weaponSkin.spriteSheet.grid, ...weaponClip }),
            blendMode: weaponSkin.spriteSheet.blendMode,
            frameOverlay: weaponSkin.spriteSheet.frameOverlay,
            layerByFrame: bodyGrid.weaponLayers?.[bodyClip] || null,
            mirrored: (weaponSkin.facing || "right") !== desiredFacing,
            assetHeight: assetHeight || null,
          })
          : usesVectorWeapon
            ? freeze({ vectorFallback: weaponSkin.vectorStyle, assetHeight: assetHeight || null })
            : null,
        transform: freeze(base),
        /* frameOverlay — буквальный трафарет над телом. Его движение уже
         * содержится в соответствующем кадре атласа, поэтому трансформ
         * оружия должен оставаться тождественным трансформу тела. */
        motion: spriteAssets && weaponSkin.spriteSheet?.frameOverlay
          ? sheetMotion(motion, sheetClip, direction)
          : componentMotion("weapon", motion, direction, config.scale),
      }),
    ];
  });
  return freeze({
    version: 12,
    presentation,
    rendererMode,
    arena: freeze({
      type: arenaType,
      background: arenaBackground.fallbackColor,
      assetPath: arenaBackground.assetPath,
      sourceGroundY: arenaBackground.groundY,
      ambientLights: freeze((arenaBackground.ambientLights || []).map((light) => freeze({ ...light }))),
      crowdMotion: freeze((arenaBackground.crowdMotion || []).map((spectator) => freeze({ ...spectator }))),
      groundY: config.groundY,
      initiativePressure: pressure.initiative,
      healthPressure: pressure.health,
      pressure: pressure.total,
      territoryOffset,
      desiredTerritoryOffset,
      screenTerritoryOffset,
      cameraOffset,
      cameraZoom: ARENA_CAMERA_ZOOM,
      positionStage,
    }),
    fighters: freeze(fighters.map((fighter) => freeze({
      id: fighter.id, name: fighter.name, health: fighter.health, maxHealth: fighter.maxHealth,
      injured: Boolean(isInjuredFighter(fighter)),
    }))),
    action: action ? freeze({
      actorId: action.actorId,
      targetId: action.targetId,
      outcome: action.outcome,
      critical: Boolean(action.critical),
      impact: action.impact || null,
      attackType: action.attackType || null,
      classTechnique: action.classTechnique || null,
      specialAttack: action.specialAttack || null,
    }) : null,
    components: freeze(components),
  });
};

class BattleVisualEngine {
  constructor(canvas, {
    spriteLibrary = new SpriteLibrary(),
    presentation = PRESENTATIONS.mobile,
    rendererMode = RENDERER_MODES.lines,
  } = {}) {
    if (!canvas?.getContext) throw new Error("BattleVisualEngine требует canvas");
    this.canvas = canvas;
    this.context = canvas.getContext("2d");
    this.spriteLibrary = spriteLibrary;
    this.presentation = presentation;
    this.rendererMode = rendererMode;
    this.frame = null;
    this.animationFrame = null;
    this.assets = new Map();
    this.transitionFrom = new Map();
    this.transitionFromArenaCameraOffset = 0;
    this.playbackToken = 0;
    this.approachPending = true;
    this.territoryOffset = 0;
    this.bloodStains = [];
    this.bloodStainKeys = new Set();
  }

  setRendererMode(rendererMode) {
    if (!Object.values(RENDERER_MODES).includes(rendererMode)) {
      throw new Error("Неизвестный режим визуализации: " + rendererMode);
    }
    this.rendererMode = rendererMode;
  }

  present(snapshot, input) {
    const desiredActionFrame = createVisualFrame(snapshot, input, this.spriteLibrary, {
      presentation: this.presentation,
      rendererMode: this.rendererMode,
      sceneHeight: this.canvas?.height || 300,
    });
    const initialApproach = this.approachPending
      ? this.createInitialApproach(snapshot, input)
      : null;
    const desiredOffset = desiredActionFrame.arena.territoryOffset;
    const territoryOffset = initialApproach
      ? desiredOffset
      : resolveTerritoryOffset(this.territoryOffset, desiredOffset);
    const actionFrame = territoryOffset === desiredOffset
      ? desiredActionFrame
      : createVisualFrame(snapshot, input, this.spriteLibrary, {
        presentation: this.presentation,
        rendererMode: this.rendererMode,
        territoryOffsetOverride: territoryOffset,
        sceneHeight: this.canvas?.height || 300,
      });
    const movementFrame = initialApproach?.movementFrame
      || this.createPressureMovementFrame(snapshot, input, actionFrame);
    const recoveryFrame = this.createRecoveryFrame(snapshot, input, territoryOffset);
    const bloodStainKey = [
      snapshot?.step ?? snapshot?.label ?? "frame",
      actionFrame.action?.actorId,
      actionFrame.action?.targetId,
      actionFrame.action?.impact,
    ].join(":");
    this.stop();
    const token = this.playbackToken;
    this.approachPending = false;
    this.territoryOffset = territoryOffset;
    if (globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      this.recordBloodStains(actionFrame, bloodStainKey, performance.now(), 0);
      this.setFrame(recoveryFrame || actionFrame);
      this.draw(1, 0);
      return actionFrame;
    }
    const playRecovery = recoveryFrame
      ? () => this.playFrame(recoveryFrame, token)
      : null;
    const playAction = () => {
      const actionDuration = Math.max(...actionFrame.components.map((component) => component.motion.duration), 0);
      this.recordBloodStains(actionFrame, bloodStainKey, performance.now(), actionDuration * 0.38);
      this.playFrame(actionFrame, token, playRecovery);
    };
    if (initialApproach) {
      this.setFrame(initialApproach.startFrame);
      this.draw(0, 0);
    }
    const playMovement = movementFrame
      ? () => this.playFrame(movementFrame, token, playAction)
      : playAction;
    if (initialApproach?.greetingFrame) {
      this.playFrame(initialApproach.greetingFrame, token, playMovement);
    } else {
      playMovement();
    }
    return actionFrame;
  }

  resetEncounter() {
    this.stop();
    this.frame = null;
    this.transitionFrom = new Map();
    this.transitionFromArenaCameraOffset = 0;
    this.approachPending = true;
    this.territoryOffset = 0;
    this.bloodStains = [];
    this.bloodStainKeys.clear();
  }

  createInitialApproach(snapshot, input) {
    if (!snapshot?.fighters?.length || snapshot.fighters.some((fighter) => fighter.health <= 0)) return null;
    const [left, right] = snapshot.fighters;
    const neutralSnapshot = { ...snapshot, lastAction: null, visualMovement: undefined };
    const startFrame = createVisualFrame(
      neutralSnapshot,
      input,
      this.spriteLibrary,
      {
        presentation: this.presentation,
        rendererMode: this.rendererMode,
        positionStage: POSITION_STAGES.entrance,
        sceneHeight: this.canvas?.height || 300,
      },
    );
    const greetingFrame = createVisualFrame(
      {
        ...neutralSnapshot,
        visualMovement: { [left.id]: "greeting", [right.id]: "greeting" },
      },
      input,
      this.spriteLibrary,
      {
        presentation: this.presentation,
        rendererMode: this.rendererMode,
        positionStage: POSITION_STAGES.entrance,
        sceneHeight: this.canvas?.height || 300,
      },
    );
    const movementFrame = createVisualFrame(
      {
        ...neutralSnapshot,
        visualMovement: { [left.id]: "advance", [right.id]: "advance" },
      },
      input,
      this.spriteLibrary,
      {
        presentation: this.presentation,
        rendererMode: this.rendererMode,
        positionStage: POSITION_STAGES.combat,
        sceneHeight: this.canvas?.height || 300,
      },
    );
    return freeze({ startFrame, greetingFrame, movementFrame });
  }

  createRecoveryFrame(snapshot, input, territoryOffsetOverride = null) {
    if (!snapshot?.lastAction || snapshot.label === "Итог боя") return null;
    return createVisualFrame(
      { ...snapshot, lastAction: null, visualMovement: undefined },
      input,
      this.spriteLibrary,
      {
        presentation: this.presentation,
        rendererMode: this.rendererMode,
        territoryOffsetOverride,
        sceneHeight: this.canvas?.height || 300,
      },
    );
  }

  createPressureMovementFrame(snapshot, input, actionFrame) {
    if (!this.frame || !snapshot?.fighters?.length || snapshot.fighters.some((fighter) => fighter.health <= 0)) return null;
    const shift = actionFrame.arena.territoryOffset - (this.frame.arena?.territoryOffset || 0);
    if (Math.abs(shift) < PRESSURE_STEP_DISTANCE) return null;
    const [left, right] = snapshot.fighters;
    const visualMovement = shift > 0
      ? { [left.id]: "advance", [right.id]: "retreat" }
      : { [left.id]: "retreat", [right.id]: "advance" };
    return createVisualFrame(
      { ...snapshot, lastAction: null, visualMovement },
      input,
      this.spriteLibrary,
      {
        presentation: this.presentation,
        rendererMode: this.rendererMode,
        sceneHeight: this.canvas?.height || 300,
      },
    );
  }

  setFrame(frame) {
    this.transitionFrom = new Map(
      (this.frame?.components || []).map((component) => [component.id, component.transform]),
    );
    this.transitionFromArenaCameraOffset = this.frame?.arena?.cameraOffset
      ?? frame.arena?.cameraOffset
      ?? 0;
    this.frame = frame;
  }

  playFrame(frame, token, onComplete = null) {
    if (token !== this.playbackToken) return;
    this.setFrame(frame);
    const duration = Math.max(...frame.components.map((component) => component.motion.duration), 0);
    const hasLoop = frame.components.some((component) => component.animation?.sheet?.loop);
    const hasTerminalLoop = frame.components.some((component) => (
      component.animation?.state === "victory" && component.animation?.sheet?.loop
    ));
    if (!duration && hasLoop) {
      const startedAt = performance.now();
      const animateLoop = (now) => {
        if (token !== this.playbackToken) return;
        this.draw(0, now - startedAt);
        this.animationFrame = requestAnimationFrame(animateLoop);
      };
      this.animationFrame = requestAnimationFrame(animateLoop);
      return;
    }
    if (!duration) {
      this.draw(1, 0);
      onComplete?.();
      return;
    }
    const startedAt = performance.now();
    const animate = (now) => {
      if (token !== this.playbackToken) return;
      const progress = clamp((now - startedAt) / duration, 0, 1);
      this.draw(progress, now - startedAt);
      if (progress < 1) {
        this.animationFrame = requestAnimationFrame(animate);
      } else if (hasTerminalLoop) {
        /* Итоговый салют остаётся живым до следующего setFrame/stop. Обычные
         * циклы движения завершаются по duration и продолжают цепочку боя. */
        this.animationFrame = requestAnimationFrame(animate);
      } else {
        this.animationFrame = null;
        onComplete?.();
      }
    };
    this.animationFrame = requestAnimationFrame(animate);
  }

  stop() {
    if (this.animationFrame !== null) cancelAnimationFrame(this.animationFrame);
    this.animationFrame = null;
    this.playbackToken += 1;
  }

  destroy() {
    this.stop();
  }

  draw(progress, animationClock = 0) {
    if (!this.frame) return;
    const { context, canvas, frame } = this;
    context.imageSmoothingEnabled = false;
    context.fillStyle = frame.arena.background;
    context.fillRect(0, 0, canvas.width, canvas.height);
    const cameraOffset = lerp(
      this.transitionFromArenaCameraOffset ?? frame.arena.cameraOffset,
      frame.arena.cameraOffset,
      easeOut(progress),
    );
    const backgroundDrawn = this.drawArenaBackground(
      context,
      canvas.width,
      canvas.height,
      frame,
      cameraOffset,
    );
    this.drawArenaLights(context, canvas.width, canvas.height, frame, animationClock, backgroundDrawn, cameraOffset);
    this.drawArenaCrowd(context, canvas.width, canvas.height, frame, animationClock, backgroundDrawn, cameraOffset);
    this.drawArenaGuides(context, canvas.width, canvas.height, frame, backgroundDrawn);
    this.drawFighterShadows(context, frame, progress, animationClock);
    this.drawBloodStains(context, frame, performance.now(), cameraOffset);
    const fighters = frame.components.filter((component) => component.kind === "fighter");
    const weapons = frame.components.filter((component) => component.kind === "weapon");
    weapons.filter((component) => this.weaponLayer(component, progress, animationClock) === "behind")
      .forEach((component) => this.drawComponent(context, component, progress, animationClock, frame));
    fighters.forEach((component) => this.drawComponent(context, component, progress, animationClock, frame));
    weapons.filter((component) => this.weaponLayer(component, progress, animationClock) !== "behind")
      .forEach((component) => this.drawComponent(context, component, progress, animationClock, frame));
    this.drawInjuredBlood(context, frame, performance.now());
    this.drawBlood(context, frame, progress);
  }

  fighterShadowSprites(frame, progress = 0, animationClock = 0) {
    const easing = easeOut(progress);
    return frame.components
      .filter((component) => component.kind === "fighter")
      .map((component) => {
        const previous = this.transitionFrom?.get?.(component.id);
        const motionEasing = component.motion.returnToOrigin
          ? Math.sin(Math.PI * progress)
          : easing;
        const baseX = lerp(previous?.x ?? component.transform.x, component.transform.x, easing);
        const x = baseX + component.motion.x * motionEasing;
        const lift = Math.max(0, -component.motion.y * motionEasing);
        const hash = [...component.fighterId].reduce((value, character) => value + character.charCodeAt(0), 0);
        const pulse = Math.sin(animationClock / 230 + hash * 0.37);
        const defeated = component.animation?.state === "defeated";
        const baseWidth = defeated ? 80 : 54;
        const liftScale = 1 - Math.min(0.16, lift / 70);
        return freeze({
          fighterId: component.fighterId,
          x: Math.round(x),
          y: frame.arena.groundY - 1,
          width: Math.round((baseWidth + (defeated ? 0 : pulse * 2)) * liftScale),
          height: defeated ? 7 : 6 + (pulse > 0.55 ? 1 : 0),
          alpha: (defeated ? 0.32 : 0.4 + pulse * 0.025) * liftScale,
        });
      });
  }

  drawFighterShadows(context, frame, progress = 0, animationClock = 0) {
    const shadows = this.fighterShadowSprites(frame, progress, animationClock);
    if (!shadows.length) return;
    context.save();
    context.fillStyle = "#080503";
    shadows.forEach((shadow) => {
      const left = Math.round(shadow.x - shadow.width / 2);
      context.globalAlpha = shadow.alpha * 0.55;
      context.fillRect(left + 7, shadow.y - 2, shadow.width - 14, 1);
      context.globalAlpha = shadow.alpha;
      context.fillRect(left, shadow.y - 1, shadow.width, shadow.height - 2);
      context.globalAlpha = shadow.alpha * 0.45;
      context.fillRect(left + 6, shadow.y + shadow.height - 3, shadow.width - 12, 1);
    });
    context.restore();
  }

  injuredBloodDrops(frame, now = performance.now()) {
    return frame.fighters.flatMap((fighter) => {
      if (!fighter.injured || fighter.health <= 0) return [];
      const component = frame.components.find((candidate) => (
        candidate.kind === "fighter" && candidate.fighterId === fighter.id
      ));
      if (!component) return [];
      const hash = [...fighter.id].reduce((value, character) => value + character.charCodeAt(0), 0);
      const originX = component.transform.x - component.transform.direction * 5;
      const assetHeight = component.animation?.assetHeight || 150;
      const originY = frame.arena.groundY - assetHeight * 0.43;
      return [0, 0.52].map((phaseOffset, index) => {
        const phase = ((now + hash * 17 + phaseOffset * INJURED_BLEED_CYCLE_MS)
          % INJURED_BLEED_CYCLE_MS) / INJURED_BLEED_CYCLE_MS;
        const fall = clamp(phase / 0.78, 0, 1);
        const landed = phase >= 0.78;
        return freeze({
          fighterId: fighter.id,
          x: Math.round(originX + (index ? 2 : -1)),
          y: landed
            ? frame.arena.groundY + 3
            : Math.round(originY + (frame.arena.groundY - originY) * fall ** 2),
          width: landed ? 5 : fall > 0.58 ? 2 : 3,
          height: landed ? 1 : 3,
          color: index ? "#590916" : "#6d0c1a",
          alpha: landed ? clamp((1 - phase) / 0.22 * 0.7, 0, 0.7) : 0.82,
          landed,
        });
      });
    });
  }

  drawInjuredBlood(context, frame, now = performance.now()) {
    const drops = this.injuredBloodDrops(frame, now);
    if (!drops.length) return;
    context.save();
    drops.forEach((drop) => {
      context.globalAlpha = drop.alpha;
      context.fillStyle = drop.color;
      context.fillRect(
        Math.round(drop.x - drop.width / 2),
        drop.y,
        drop.width,
        drop.height,
      );
    });
    context.restore();
  }

  bloodParticles(frame, progress) {
    if (frame.action?.outcome !== "hit") return [];
    const impact = frame.action.critical ? "critical" : frame.action.impact || "normal";
    const profile = BLOOD_IMPACT_PROFILES[impact] || BLOOD_IMPACT_PROFILES.normal;
    const target = frame.components.find((component) => (
      component.kind === "fighter" && component.fighterId === frame.action.targetId
    ));
    if (!target) return [];
    const burstProgress = clamp((progress - 0.1) / 0.9, 0, 1);
    if (burstProgress <= 0) return [];
    const awayFromAttacker = -target.transform.direction;
    const assetHeight = target.animation?.assetHeight || 150;
    const originX = target.transform.x + awayFromAttacker * 4;
    const originY = target.transform.y - assetHeight * 0.52;
    return BLOOD_PATTERN.slice(0, profile.count).flatMap((particle, index) => {
      const flight = clamp(
        (burstProgress - particle.delay) / Math.max(0.01, 1 - particle.delay),
        0,
        1,
      );
      if (flight <= 0) return [];
      /* Основной веер летит от атакующего, но часть капель отскакивает в
       * противоположную сторону. На крите обратный разлёт шире. */
      const reverse = index % (impact === "critical" ? 4 : 6) === 0;
      const horizontalDirection = reverse
        ? -(impact === "critical" ? 0.5 + (index % 3) * 0.16 : 0.32)
        : 0.76 + (index % 4) * 0.1;
      const gravity = particle.gravity * profile.gravity;
      return [freeze({
        sourceIndex: index,
        impact,
        originX,
        x: Math.round(originX + awayFromAttacker * horizontalDirection * particle.distance * profile.distance * flight),
        y: Math.round(originY - particle.lift * profile.lift * flight + gravity * flight ** 2),
        size: Math.max(1, Math.round(particle.size * profile.size)),
        color: BLOOD_COLORS[index % BLOOD_COLORS.length],
        alpha: clamp(0.94 - flight * profile.alphaFade, 0.12, 1),
      })];
    });
  }

  drawBlood(context, frame, progress) {
    const particles = this.bloodParticles(frame, progress);
    if (!particles.length) return;
    context.save();
    particles.forEach((particle) => {
      context.globalAlpha = particle.alpha;
      context.fillStyle = particle.color;
      context.fillRect(particle.x, particle.y, particle.size, particle.size);
    });
    context.restore();
  }

  recordBloodStains(frame, key, now = performance.now(), delayMs = 0) {
    if (frame.action?.outcome !== "hit" || this.bloodStainKeys.has(key)) return [];
    const target = frame.components.find((component) => (
      component.kind === "fighter" && component.fighterId === frame.action.targetId
    ));
    if (!target) return [];
    const impact = frame.action.critical ? "critical" : frame.action.impact || "normal";
    const profile = BLOOD_STAIN_PROFILES[impact] || BLOOD_STAIN_PROFILES.normal;
    const awayFromAttacker = -target.transform.direction;
    const offsets = [7, -5, 15, -13, 23, -21, 31];
    const created = offsets.slice(0, profile.count).map((offset, index) => freeze({
      key: `${key}:${index}`,
      impact,
      createdAt: now + delayMs + index * 45,
      lifetime: Math.round((2600 + index * 110) * BLOOD_STAIN_LIFETIME_MULTIPLIER),
      worldX: clamp(Math.round(target.transform.x + awayFromAttacker * offset), 4, this.canvas.width - 4)
        + (frame.arena.cameraOffset || 0),
      y: frame.arena.groundY + 3 + (index * 5) % 14,
      width: Math.max(3, Math.round((7 - index % 3) * profile.scale * BLOOD_STAIN_SIZE_MULTIPLIER)),
      height: Math.max(2, Math.round((3 + index % 2) * profile.scale * BLOOD_STAIN_SIZE_MULTIPLIER)),
    }));
    this.bloodStainKeys.add(key);
    this.bloodStains = [...this.bloodStains, ...created].slice(-36);
    return created;
  }

  bloodStainSprites(frame, now = performance.now(), cameraOffset = frame.arena.cameraOffset || 0) {
    const visible = [];
    this.bloodStains = this.bloodStains.filter((stain) => {
      const age = now - stain.createdAt;
      if (age >= stain.lifetime) return false;
      if (age < 0) return true;
      const progress = clamp(age / stain.lifetime, 0, 1);
      const fade = progress < 0.24 ? 1 : 1 - (progress - 0.24) / 0.76;
      const red = Math.round(92 - 61 * progress);
      const green = Math.round(10 - 6 * progress);
      const blue = Math.round(23 - 14 * progress);
      visible.push(freeze({
        ...stain,
        x: stain.worldX - cameraOffset,
        color: `rgb(${red}, ${green}, ${blue})`,
        alpha: clamp(0.78 * fade, 0, 0.78),
      }));
      return true;
    });
    return visible;
  }

  drawBloodStains(context, frame, now = performance.now(), cameraOffset = frame.arena.cameraOffset || 0) {
    const stains = this.bloodStainSprites(frame, now, cameraOffset);
    if (!stains.length) return;
    context.save();
    stains.forEach((stain) => {
      context.globalAlpha = stain.alpha;
      context.fillStyle = stain.color;
      context.fillRect(
        Math.round(stain.x - stain.width / 2),
        stain.y,
        stain.width,
        stain.height,
      );
      context.fillRect(
        stain.x + (stain.x % 2 ? stain.width : -stain.width),
        stain.y + stain.height,
        Math.max(1, Math.round(stain.width / 3)),
        1,
      );
    });
    context.restore();
  }

  animationFrameIndex(component, progress, animationClock) {
    const sheet = component.animation?.sheet;
    if (!sheet?.frames?.length) return 0;
    if (sheet.loop) {
      return Math.floor(animationClock / 1000 * sheet.fps) % sheet.frames.length;
    }
    if (!component.motion?.duration) return sheet.frames.length - 1;
    const componentProgress = component.motion?.duration
      ? clamp(animationClock / component.motion.duration, 0, 1)
      : progress;
    return Math.min(sheet.frames.length - 1, Math.floor(componentProgress * sheet.frames.length));
  }

  weaponLayer(component, progress, animationClock) {
    const frameIndex = this.animationFrameIndex(component, progress, animationClock);
    return component.animation?.layerByFrame?.[frameIndex] || "front";
  }

  drawArenaBackground(context, width, height, frame, cameraOffset = frame.arena.cameraOffset || 0) {
    if (frame.rendererMode !== RENDERER_MODES.assets) return false;
    const image = this.loadAsset(frame.arena.assetPath);
    if (!image?.complete || !image.naturalWidth) return false;
    const viewport = arenaViewport(width, height, frame, image, cameraOffset);
    context.drawImage(
      image,
      viewport.sourceX,
      viewport.sourceY,
      viewport.sourceWidth,
      viewport.sourceHeight,
      0,
      0,
      width,
      height,
    );
    return true;
  }

  arenaLightSprites(width, height, frame, animationClock = 0, cameraOffset = frame.arena.cameraOffset || 0) {
    if (frame.rendererMode !== RENDERER_MODES.assets || !frame.arena.ambientLights?.length) return [];
    const image = this.loadAsset(frame.arena.assetPath);
    if (!image?.complete || !image.naturalWidth) return [];
    const viewport = arenaViewport(width, height, frame, image, cameraOffset);
    const seconds = animationClock / 1000;
    return frame.arena.ambientLights.flatMap((light) => {
      const x = (light.x - viewport.sourceX) * viewport.scaleX;
      const y = (light.y - viewport.sourceY) * viewport.scaleY;
      if (x < -16 || x > width + 16 || y < -16 || y > height + 16) return [];
      const phase = (light.phase || 0) * Math.PI * 2;
      const wave = Math.sin(seconds * 7.1 + phase) * 0.62
        + Math.sin(seconds * 11.7 + phase * 1.7) * 0.38;
      const drift = Math.round(Math.sin(seconds * 5.3 + phase) * Math.max(1, light.scale || 1));
      const pulse = 0.82 + wave * 0.12;
      return [freeze({
        x: Math.round(x) + drift,
        y: Math.round(y),
        scale: (light.scale || 1) * viewport.scaleY,
        pulse,
      })];
    });
  }

  drawArenaLights(context, width, height, frame, animationClock, backgroundDrawn = false, cameraOffset = frame.arena.cameraOffset || 0) {
    if (!backgroundDrawn) return;
    const lights = this.arenaLightSprites(width, height, frame, animationClock, cameraOffset);
    if (!lights.length) return;
    context.save();
    context.globalCompositeOperation = "screen";
    lights.forEach((light) => {
      const unit = Math.max(1, Math.round(light.scale * 2));
      const radius = Math.max(7, Math.round(13 * light.scale * light.pulse));
      if (typeof context.createRadialGradient === "function") {
        const glow = context.createRadialGradient(light.x, light.y, 0, light.x, light.y, radius);
        glow.addColorStop(0, `rgba(255, 178, 61, ${0.2 * light.pulse})`);
        glow.addColorStop(0.45, `rgba(219, 83, 20, ${0.11 * light.pulse})`);
        glow.addColorStop(1, "rgba(76, 18, 4, 0)");
        context.fillStyle = glow;
        context.fillRect(light.x - radius, light.y - radius, radius * 2, radius * 2);
      }
      context.globalAlpha = clamp(0.68 + light.pulse * 0.22, 0, 1);
      context.fillStyle = "#9b2d0f";
      context.fillRect(light.x - unit, light.y - unit * 3, unit * 2, unit * 4);
      context.fillStyle = "#e66a1b";
      context.fillRect(light.x, light.y - unit * 4, unit, unit * 3);
      context.fillStyle = "#ffd56a";
      context.fillRect(light.x - unit, light.y - unit * 2, unit, unit * 2);
    });
    context.restore();
  }

  arenaCrowdSprites(width, height, frame, animationClock = 0, cameraOffset = frame.arena.cameraOffset || 0) {
    if (frame.rendererMode !== RENDERER_MODES.assets || !frame.arena.crowdMotion?.length) return [];
    const image = this.loadAsset(frame.arena.assetPath);
    if (!image?.complete || !image.naturalWidth) return [];
    const viewport = arenaViewport(width, height, frame, image, cameraOffset);
    const seconds = animationClock / 1000;
    return frame.arena.crowdMotion.flatMap((spectator) => {
      const x = (spectator.x - viewport.sourceX) * viewport.scaleX;
      const y = (spectator.y - viewport.sourceY) * viewport.scaleY;
      if (x < -8 || x > width + 8 || y < -8 || y > height + 8) return [];
      const phase = (spectator.phase || 0) * Math.PI * 2;
      const sway = Math.sin(seconds * 1.7 + phase);
      const bob = Math.sin(seconds * 2.25 + phase * 1.35);
      const cheerWave = Math.sin(seconds * 0.96 + phase * 1.9);
      const cheer = cheerWave > 0.58;
      const armLift = cheer ? 1 + (cheerWave > 0.86 ? 1 : 0) : 0;
      return [freeze({
        x: Math.round(x + sway * 1.7),
        y: Math.round(y - Math.max(0, bob) - armLift),
        scale: Math.max(1, Math.round((spectator.scale || 1) * viewport.scaleY)),
        cheer,
        armLift,
        alpha: 0.3 + (sway + 1) * 0.065,
      })];
    });
  }

  drawArenaCrowd(context, width, height, frame, animationClock, backgroundDrawn = false, cameraOffset = frame.arena.cameraOffset || 0) {
    if (!backgroundDrawn) return;
    const spectators = this.arenaCrowdSprites(width, height, frame, animationClock, cameraOffset);
    if (!spectators.length) return;
    context.save();
    spectators.forEach((spectator) => {
      const unit = spectator.scale;
      context.globalAlpha = spectator.alpha;
      context.fillStyle = "#c1844e";
      context.fillRect(spectator.x - unit, spectator.y - unit * 3, unit * 2, unit * 2);
      context.fillStyle = "#4b2419";
      context.fillRect(spectator.x - unit, spectator.y - unit, unit * 2, unit * 3);
      if (spectator.cheer) {
        context.fillStyle = "#9a5a35";
        context.fillRect(
          spectator.x - unit * 2,
          spectator.y - unit * (3 + spectator.armLift),
          unit,
          unit * (3 + spectator.armLift),
        );
        context.fillRect(
          spectator.x + unit,
          spectator.y - unit * (4 + spectator.armLift),
          unit,
          unit * (4 + spectator.armLift),
        );
      }
    });
    context.restore();
  }

  drawArenaGuides(context, width, height, frame, backgroundDrawn = false) {
    const color = frame.arena.type === "sand" ? "#3d2a12" : "#10232d";
    const groundY = frame.arena.groundY;
    if (!backgroundDrawn) {
      context.strokeStyle = color;
      context.lineWidth = 2;
      context.setLineDash([9, 7]);
      context.beginPath();
      context.moveTo(12, groundY);
      context.lineTo(width - 12, groundY);
      context.stroke();
      context.setLineDash([]);
      context.fillStyle = frame.arena.type === "sand" ? "#171008" : "#081116";
      context.fillRect(0, groundY + 2, width, height - groundY);
    }
  }

  drawComponent(context, component, progress, animationClock, frame) {
    const easing = easeOut(progress);
    const motionEasing = component.motion.returnToOrigin
      ? Math.sin(Math.PI * progress)
      : easing;
    const previous = this.transitionFrom.get(component.id);
    const baseX = lerp(previous?.x ?? component.transform.x, component.transform.x, easing);
    const baseY = lerp(previous?.y ?? component.transform.y, component.transform.y, easing);
    const x = baseX + component.motion.x * motionEasing;
    const y = baseY + component.motion.y * motionEasing;
    context.save();
    context.translate(x, y);
    context.rotate(lerp(0, component.motion.rotation, motionEasing));
    /*
     * "assets" — это цель, не гарантия: не у каждого бойца есть готовый лист.
     * Каждый компонент откатывается на простую заливку самостоятельно, а не
     * весь экран целиком, иначе боец без ассета становится невидимым.
     */
    let drawn = false;
    if (frame.rendererMode === RENDERER_MODES.assets && (component.kind === "fighter" || component.kind === "weapon")) {
      drawn = this.drawAsset(context, component, progress, animationClock);
      if (!drawn && component.kind === "weapon" && component.animation?.vectorFallback) {
        this.drawAttachedVectorWeapon(context, component);
        drawn = true;
      }
    }
    if (!drawn) this.drawLineComponent(context, component);
    context.restore();
  }

  drawLineComponent(context, component) {
    const { direction, scale } = component.transform;
    if (component.kind === "fighter") {
      const isDown = component.transform.y > 130 * scale;
      context.fillStyle = component.placeholder.color;
      context.fillRect(-7 * scale, isDown ? 9 * scale : 0, 14 * scale, isDown ? 7 * scale : 38 * scale);
      context.fillStyle = component.placeholder.accent;
      context.fillRect(-7 * scale, isDown ? 9 * scale : 0, 14 * scale, 4 * scale);
      context.fillStyle = "#182126";
      context.fillRect(-3 * scale, isDown ? 4 * scale : -8 * scale, 6 * scale, 8 * scale);
      return;
    }
    /* Заглушка-полоска рисуется из точки (0,0), поэтому её надо подвинуть к
     * бедру бойца-полоски. Ассетные и векторные варианты уже несут это
     * смещение в собственных координатах сокета — им это не нужно. */
    context.translate(direction * 10 * scale, 18 * scale);
    const length = component.placeholder.length * scale;
    context.fillStyle = component.placeholder.color;
    context.fillRect(0, -2 * scale, direction * length, 4 * scale);
    context.fillStyle = "#ffffff";
    context.fillRect(direction * (length - 5 * scale), -2 * scale, direction * 5 * scale, 4 * scale);
  }

  drawAsset(context, component, progress, animationClock) {
    const image = this.loadAsset(component.assetPath);
    if (!image?.complete || !image.naturalWidth) return false;
    const sheet = component.animation?.sheet;
    if (component.kind === "fighter") context.filter = "brightness(0.8) saturate(0.86) contrast(1.08)";
    if (component.animation?.blendMode) context.globalCompositeOperation = component.animation.blendMode;
    if (component.animation?.mirrored) context.scale(-1, 1);
    if (sheet?.frames) {
      const frameIndex = this.animationFrameIndex(component, progress, animationClock);
      const frame = sheet.frames[frameIndex];
      const sourceWidth = image.naturalWidth / sheet.columns;
      const sourceHeight = image.naturalHeight / sheet.rows;
      const logicalHeight = sheet.logicalHeight || sourceHeight;
      const logicalAssetHeight = (component.animation?.assetHeight || 255)
        * (component.animation?.renderScale || 1);
      const logicalScale = logicalAssetHeight / logicalHeight;
      const assetHeight = sourceHeight * logicalScale;
      const assetWidth = sourceWidth * logicalScale;
      context.drawImage(
        image,
        frame * sourceWidth,
        sheet.row * sourceHeight,
        sourceWidth,
        sourceHeight,
        -assetWidth / 2,
        -assetHeight,
        assetWidth,
        assetHeight,
      );
      return true;
    }
    const assetHeight = (component.animation?.assetHeight || 255)
      * (component.animation?.renderScale || 1);
    const assetWidth = assetHeight * (image.naturalWidth / image.naturalHeight);
    context.drawImage(image, -assetWidth / 2, -assetHeight, assetWidth, assetHeight);
    return true;
  }

  drawAttachedVectorWeapon(context, component) {
    const assetHeight = component.animation.assetHeight || 220;
    const assetWidth = assetHeight;
    const socket = component.attachment;
    const direction = component.transform.direction;
    const x = -assetWidth / 2 + socket.x * assetWidth;
    const y = -assetHeight + socket.y * assetHeight;
    context.save();
    context.translate(x, y);
    context.scale(direction, 1);
    context.rotate(component.animation.vectorFallback === "sica" ? -0.32 : -0.12);
    context.fillStyle = "#6e5136";
    context.fillRect(-12, -3, 14, 6);
    context.fillStyle = "#d4d7d3";
    if (component.animation.vectorFallback === "sica") {
      context.beginPath();
      context.moveTo(1, -4);
      context.quadraticCurveTo(18, -12, 35, -3);
      context.quadraticCurveTo(24, 7, 4, 4);
      context.closePath();
      context.fill();
    } else {
      context.beginPath();
      context.moveTo(1, -4);
      context.lineTo(34, -4);
      context.lineTo(41, 0);
      context.lineTo(34, 4);
      context.lineTo(1, 4);
      context.closePath();
      context.fill();
    }
    context.fillStyle = "#f0c776";
    context.fillRect(-2, -6, 4, 12);
    context.restore();
  }

  loadAsset(assetPath) {
    if (!assetPath || !globalThis.Image) return null;
    if (!this.assets.has(assetPath)) {
      const image = new Image();
      image.addEventListener("load", () => this.draw(1, 0));
      image.src = assetPath;
      this.assets.set(assetPath, image);
    }
    return this.assets.get(assetPath);
  }

}

globalThis.GladiatorVisualEngine = {
  ARENA_CAMERA_FOLLOW_RATIO,
  ARENA_CAMERA_ZOOM,
  BattleVisualEngine,
  INJURED_HEALTH_RATIO,
  PRESSURE_STEP_DISTANCE,
  PRESSURE_DISTANCE,
  POSITION_STAGES,
  PRESENTATIONS,
  RENDERER_MODES,
  createVisualFrame,
  resolveTerritoryOffset,
};
})();
