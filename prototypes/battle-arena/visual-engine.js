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
const PRESSURE_STEP_DISTANCE = 6;
const CRITICAL_BLOOD_PATTERN = Object.freeze([
  Object.freeze({ distance: 32, lift: 18, gravity: 10, size: 3, delay: 0, color: "#a91414" }),
  Object.freeze({ distance: 25, lift: 27, gravity: 13, size: 2, delay: 0.04, color: "#731010" }),
  Object.freeze({ distance: 39, lift: 9, gravity: 18, size: 2, delay: 0.08, color: "#c3261b" }),
  Object.freeze({ distance: 19, lift: 34, gravity: 17, size: 2, delay: 0.12, color: "#8d1111" }),
  Object.freeze({ distance: 46, lift: 22, gravity: 24, size: 2, delay: 0.16, color: "#5f0b0b" }),
  Object.freeze({ distance: 29, lift: 4, gravity: 29, size: 3, delay: 0.2, color: "#b71c16" }),
  Object.freeze({ distance: 15, lift: 20, gravity: 25, size: 2, delay: 0.24, color: "#7b0d0d" }),
  Object.freeze({ distance: 36, lift: 31, gravity: 28, size: 2, delay: 0.28, color: "#99130f" }),
]);

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
  const healthRatio = fighter.health / Math.max(1, fighter.maxHealth);
  if (healthRatio < INJURED_HEALTH_RATIO || fighter.traumas?.length || fighter.injuries?.length) return "idle.injured";
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
const presentationConfig = () => ({
  combatPositions: [120, 240],
  entrancePositions: [78, 282],
  groundY: 280,
  scale: 3.2,
  assetHeight: 150,
  pressureDistance: 40,
});

const resolveTerritoryOffset = (displayedOffset, desiredOffset) => (
  Math.abs(desiredOffset - displayedOffset) >= PRESSURE_STEP_DISTANCE
    ? desiredOffset
    : displayedOffset
);

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
  } = {},
) => {
  const config = presentationConfig(presentation);
  const arenaType = snapshot?.arena?.type || input.arena?.type || "normal";
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
  const anchorPositions = isEntrance ? config.entrancePositions : config.combatPositions;
  const positions = anchorPositions.map((position) => position + territoryOffset);
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
    version: 11,
    presentation,
    rendererMode,
    arena: freeze({
      type: arenaType,
      background: arenaBackground.fallbackColor,
      assetPath: arenaBackground.assetPath,
      sourceGroundY: arenaBackground.groundY,
      ambientLights: freeze((arenaBackground.ambientLights || []).map((light) => freeze({ ...light }))),
      groundY: config.groundY,
      initiativePressure: pressure.initiative,
      healthPressure: pressure.health,
      pressure: pressure.total,
      territoryOffset,
      desiredTerritoryOffset,
      positionStage,
    }),
    fighters: freeze(fighters.map((fighter) => freeze({
      id: fighter.id, name: fighter.name, health: fighter.health, maxHealth: fighter.maxHealth,
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
    this.playbackToken = 0;
    this.approachPending = true;
    this.territoryOffset = 0;
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
      });
    const movementFrame = initialApproach?.movementFrame
      || this.createPressureMovementFrame(snapshot, input, actionFrame);
    const recoveryFrame = this.createRecoveryFrame(snapshot, input, territoryOffset);
    this.stop();
    const token = this.playbackToken;
    this.approachPending = false;
    this.territoryOffset = territoryOffset;
    if (globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      this.setFrame(recoveryFrame || actionFrame);
      this.draw(1, 0);
      return actionFrame;
    }
    const playRecovery = recoveryFrame
      ? () => this.playFrame(recoveryFrame, token)
      : null;
    const playAction = () => this.playFrame(actionFrame, token, playRecovery);
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
    this.approachPending = true;
    this.territoryOffset = 0;
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
      { presentation: this.presentation, rendererMode: this.rendererMode },
    );
  }

  setFrame(frame) {
    this.transitionFrom = new Map(
      (this.frame?.components || []).map((component) => [component.id, component.transform]),
    );
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
    const backgroundDrawn = this.drawArenaBackground(context, canvas.width, canvas.height, frame);
    this.drawArenaLights(context, canvas.width, canvas.height, frame, animationClock, backgroundDrawn);
    this.drawArenaGuides(context, canvas.width, canvas.height, frame, backgroundDrawn);
    const fighters = frame.components.filter((component) => component.kind === "fighter");
    const weapons = frame.components.filter((component) => component.kind === "weapon");
    weapons.filter((component) => this.weaponLayer(component, progress, animationClock) === "behind")
      .forEach((component) => this.drawComponent(context, component, progress, animationClock, frame));
    fighters.forEach((component) => this.drawComponent(context, component, progress, animationClock, frame));
    weapons.filter((component) => this.weaponLayer(component, progress, animationClock) !== "behind")
      .forEach((component) => this.drawComponent(context, component, progress, animationClock, frame));
    this.drawCriticalBlood(context, frame, progress);
  }

  criticalBloodParticles(frame, progress) {
    if (!frame.action?.critical || frame.action.outcome !== "hit") return [];
    const target = frame.components.find((component) => (
      component.kind === "fighter" && component.fighterId === frame.action.targetId
    ));
    if (!target) return [];
    const burstProgress = clamp((progress - 0.28) / 0.62, 0, 1);
    if (burstProgress <= 0) return [];
    const awayFromAttacker = -target.transform.direction;
    const assetHeight = target.animation?.assetHeight || 150;
    const originX = target.transform.x + awayFromAttacker * 4;
    const originY = target.transform.y - assetHeight * 0.52;
    return CRITICAL_BLOOD_PATTERN.flatMap((particle) => {
      const flight = clamp(
        (burstProgress - particle.delay) / Math.max(0.01, 1 - particle.delay),
        0,
        1,
      );
      if (flight <= 0) return [];
      return [freeze({
        x: Math.round(originX + awayFromAttacker * particle.distance * flight),
        y: Math.round(originY - particle.lift * flight + particle.gravity * flight ** 2),
        size: particle.size,
        color: particle.color,
        alpha: clamp(1 - flight * 0.78, 0, 1),
      })];
    });
  }

  drawCriticalBlood(context, frame, progress) {
    const particles = this.criticalBloodParticles(frame, progress);
    if (!particles.length) return;
    context.save();
    particles.forEach((particle) => {
      context.globalAlpha = particle.alpha;
      context.fillStyle = particle.color;
      context.fillRect(particle.x, particle.y, particle.size, particle.size);
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

  drawArenaBackground(context, width, height, frame) {
    if (frame.rendererMode !== RENDERER_MODES.assets) return false;
    const image = this.loadAsset(frame.arena.assetPath);
    if (!image?.complete || !image.naturalWidth) return false;
    const sourceHeight = Math.min(image.naturalHeight, height);
    const sourceY = Math.min(
      image.naturalHeight - sourceHeight,
      Math.max(0, (frame.arena.sourceGroundY || image.naturalHeight) - frame.arena.groundY),
    );
    context.drawImage(
      image,
      0,
      sourceY,
      image.naturalWidth,
      sourceHeight,
      0,
      0,
      width,
      height,
    );
    return true;
  }

  arenaLightSprites(width, height, frame, animationClock = 0) {
    if (frame.rendererMode !== RENDERER_MODES.assets || !frame.arena.ambientLights?.length) return [];
    const image = this.loadAsset(frame.arena.assetPath);
    if (!image?.complete || !image.naturalWidth) return [];
    const sourceHeight = Math.min(image.naturalHeight, height);
    const sourceY = Math.min(
      image.naturalHeight - sourceHeight,
      Math.max(0, (frame.arena.sourceGroundY || image.naturalHeight) - frame.arena.groundY),
    );
    const scaleX = width / image.naturalWidth;
    const scaleY = height / sourceHeight;
    const seconds = animationClock / 1000;
    return frame.arena.ambientLights.flatMap((light) => {
      const x = light.x * scaleX;
      const y = (light.y - sourceY) * scaleY;
      if (x < -16 || x > width + 16 || y < -16 || y > height + 16) return [];
      const phase = (light.phase || 0) * Math.PI * 2;
      const wave = Math.sin(seconds * 7.1 + phase) * 0.62
        + Math.sin(seconds * 11.7 + phase * 1.7) * 0.38;
      const drift = Math.round(Math.sin(seconds * 5.3 + phase) * Math.max(1, light.scale || 1));
      const pulse = 0.82 + wave * 0.12;
      return [freeze({
        x: Math.round(x) + drift,
        y: Math.round(y),
        scale: (light.scale || 1) * scaleY,
        pulse,
      })];
    });
  }

  drawArenaLights(context, width, height, frame, animationClock, backgroundDrawn = false) {
    if (!backgroundDrawn) return;
    const lights = this.arenaLightSprites(width, height, frame, animationClock);
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
      const logicalAssetHeight = component.animation?.assetHeight || 255;
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
    const assetHeight = component.animation?.assetHeight || 255;
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
  BattleVisualEngine,
  INJURED_HEALTH_RATIO,
  PRESSURE_STEP_DISTANCE,
  POSITION_STAGES,
  PRESENTATIONS,
  RENDERER_MODES,
  createVisualFrame,
  resolveTerritoryOffset,
};
})();
