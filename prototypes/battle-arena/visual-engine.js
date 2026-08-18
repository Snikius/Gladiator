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

const fighterFromInput = (fighter) => ({
  id: fighter.id,
  name: fighter.name,
  fighterClass: fighter.fighterClass,
  health: fighter.base.health,
  maxHealth: fighter.base.health,
  fatigue: 0,
  visual: fighter.visual,
});

const actionMotion = (fighter, action) => {
  if (!action) return "idle";
  if (action.actorId === fighter.id) return action.attackType === "achilles-leap" ? "leap" : "attack";
  if (action.targetId === fighter.id) return action.outcome;
  return "idle";
};

const visualStateForFighter = (fighter, action) => {
  if (fighter.health <= 0) return "defeated";
  if (action?.actorId === fighter.id) return "attack";
  if (action?.targetId === fighter.id) {
    return ({ hit: "reaction.hit", dodge: "defense.dodge", block: "defense.block" }[action.outcome] || "idle.normal");
  }
  if (fighter.fatigue >= 70) return "idle.tired";
  if (fighter.traumas?.length || fighter.injuries?.length) return "idle.injured";
  return "idle.normal";
};

const componentMotion = (kind, motion, direction, scale) => {
  const idle = freeze({ duration: 0, x: 0, y: 0, rotation: 0 });
  if (motion === "idle") return idle;
  if (motion === "attack" || motion === "leap") {
    return freeze({
      duration: motion === "leap" ? 760 : 560,
      x: direction * (motion === "leap" ? 28 : 18) * scale,
      y: (motion === "leap" ? -22 : -4) * scale,
      rotation: kind === "weapon" ? direction * (motion === "leap" ? 1.15 : 0.55) : 0,
    });
  }
  if (motion === "dodge") return freeze({ duration: 430, x: direction * -16 * scale, y: 0, rotation: 0 });
  if (motion === "block") return freeze({ duration: 400, x: direction * -4 * scale, y: 0, rotation: kind === "weapon" ? direction * -0.24 : 0 });
  if (motion === "hit") return freeze({ duration: 390, x: direction * -10 * scale, y: 5 * scale, rotation: direction * -0.12 });
  return freeze({ duration: 400, x: 0, y: 0, rotation: kind === "weapon" ? direction * 0.25 : 0 });
};

const sheetMotion = (motion) => {
  const duration = ({ attack: 560, leap: 760, dodge: 430, block: 400, hit: 390 }[motion] || 0);
  return freeze({ duration, x: 0, y: 0, rotation: 0 });
};

/* Ассет выводится высотой 170 px из безопасного кадра 256×256. Два бойца
 * помещаются рядом в мобильной области и не обрезаются по краям. */
const presentationConfig = () => ({ positions: [92, 268], groundY: 500, scale: 3.2, assetHeight: 170 });

/*
 * Чистый адаптер: вход — снимок симуляции, выход — визуальная сцена.
 * Он не меняет snapshot и не импортирует BattleEngine, поэтому реплей можно
 * передать из сети, файла или другого боевого движка.
 */
const createVisualFrame = (
  snapshot,
  input,
  spriteLibrary = new SpriteLibrary(),
  { presentation = PRESENTATIONS.mobile, rendererMode = RENDERER_MODES.lines } = {},
) => {
  const config = presentationConfig(presentation);
  const sourceFighters = snapshot?.fighters || input.fighters.map(fighterFromInput);
  const fighters = sourceFighters.map((fighter, index) => ({
    ...fighter,
    visual: fighter.visual || input.fighters.find((candidate) => candidate.id === fighter.id)?.visual || input.fighters[index]?.visual,
  }));
  const action = snapshot?.lastAction;
  const components = fighters.flatMap((fighter, side) => {
    const direction = side === 0 ? 1 : -1;
    const fighterSkin = spriteLibrary.resolveFighter(fighter, side);
    const weaponSkin = spriteLibrary.resolveWeapon(fighter);
    const animationRig = spriteLibrary.resolveAnimationRig(fighter);
    const bodyGrid = spriteLibrary.resolveBodyGrid(animationRig);
    const motion = actionMotion(fighter, action);
    const visualState = visualStateForFighter(fighter, action);
    const spriteAssets = rendererMode === RENDERER_MODES.assets && bodyGrid.renderable;
    const desiredFacing = side === 0 ? "right" : "left";
    const bodyClip = bodyGrid.clips[visualState]
      ? visualState
      : motion === "leap" ? animationRig.attackClip : "idle.normal";
    const sheetClip = bodyGrid.clips[bodyClip];
    const weaponClip = weaponSkin.spriteSheet?.clips?.[bodyClip] || null;
    const usesVectorWeapon = spriteAssets && Boolean(weaponSkin.vectorStyle);
    const base = {
      x: config.positions[side],
      y: spriteAssets ? config.groundY : fighter.health <= 0 ? config.groundY - 9 : config.groundY - 38 * config.scale,
      direction,
      scale: config.scale,
    };
    return [
      freeze({
        id: fighter.id + ":fighter", fighterId: fighter.id, kind: "fighter", skinId: fighterSkin.id,
        placeholder: fighterSkin.placeholder,
        assetPath: bodyGrid.renderable ? bodyGrid.assetPath : null,
        animation: freeze({
          equipmentProfileId: animationRig.id, bodyGridId: bodyGrid.id, state: visualState,
          clip: bodyClip, experimental: bodyGrid.experimental, weaponBakedIn: false,
          sheet: freeze({ columns: bodyGrid.grid.columns, rows: bodyGrid.grid.rows, ...sheetClip }),
          mirrored: (bodyGrid.facing || "right") !== desiredFacing,
          assetHeight: config.assetHeight || null,
        }),
        transform: freeze(base), motion: spriteAssets ? sheetMotion(motion) : componentMotion("fighter", motion, direction, config.scale),
      }),
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
            assetHeight: config.assetHeight || null,
          })
          : usesVectorWeapon
            ? freeze({ vectorFallback: weaponSkin.vectorStyle, assetHeight: config.assetHeight || null })
            : null,
        transform: freeze(base),
        /* frameOverlay — буквальный трафарет над телом. Его движение уже
         * содержится в соответствующем кадре атласа, поэтому трансформ
         * оружия должен оставаться тождественным трансформу тела. */
        motion: spriteAssets && weaponSkin.spriteSheet?.frameOverlay
          ? sheetMotion(motion)
          : componentMotion("weapon", motion, direction, config.scale),
      }),
    ];
  });
  return freeze({
    version: 5,
    presentation,
    rendererMode,
    arena: freeze({ type: snapshot?.arena?.type || input.arena?.type || "normal", background: "#050607", groundY: config.groundY }),
    fighters: freeze(fighters.map((fighter) => freeze({
      id: fighter.id, name: fighter.name, health: fighter.health, maxHealth: fighter.maxHealth,
    }))),
    action: action ? freeze({ actorId: action.actorId, targetId: action.targetId, outcome: action.outcome }) : null,
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
  }

  setRendererMode(rendererMode) {
    if (!Object.values(RENDERER_MODES).includes(rendererMode)) {
      throw new Error("Неизвестный режим визуализации: " + rendererMode);
    }
    this.rendererMode = rendererMode;
  }

  present(snapshot, input) {
    this.frame = createVisualFrame(snapshot, input, this.spriteLibrary, {
      presentation: this.presentation,
      rendererMode: this.rendererMode,
    });
    this.stop();
    const duration = Math.max(...this.frame.components.map((component) => component.motion.duration), 0);
    const hasLoop = this.frame.components.some((component) => component.animation?.sheet?.loop);
    if (globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      this.draw(1, 0);
      return this.frame;
    }
    if (!duration && hasLoop) {
      const startedAt = performance.now();
      const animateLoop = (now) => {
        this.draw(0, now - startedAt);
        this.animationFrame = requestAnimationFrame(animateLoop);
      };
      this.animationFrame = requestAnimationFrame(animateLoop);
      return this.frame;
    }
    if (!duration) {
      this.draw(1, 0);
      return this.frame;
    }
    const startedAt = performance.now();
    const animate = (now) => {
      const progress = clamp((now - startedAt) / duration, 0, 1);
      this.draw(progress, now - startedAt);
      if (progress < 1) this.animationFrame = requestAnimationFrame(animate);
    };
    this.animationFrame = requestAnimationFrame(animate);
    return this.frame;
  }

  stop() {
    if (this.animationFrame !== null) cancelAnimationFrame(this.animationFrame);
    this.animationFrame = null;
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
    this.drawArenaGuides(context, canvas.width, canvas.height, frame);
    this.drawHud(context, frame.fighters, canvas.width, frame.presentation);
    const fighters = frame.components.filter((component) => component.kind === "fighter");
    const weapons = frame.components.filter((component) => component.kind === "weapon");
    weapons.filter((component) => this.weaponLayer(component, progress, animationClock) === "behind")
      .forEach((component) => this.drawComponent(context, component, progress, animationClock, frame));
    fighters.forEach((component) => this.drawComponent(context, component, progress, animationClock, frame));
    weapons.filter((component) => this.weaponLayer(component, progress, animationClock) !== "behind")
      .forEach((component) => this.drawComponent(context, component, progress, animationClock, frame));
    this.drawCaption(context, frame, canvas.width, canvas.height);
  }

  animationFrameIndex(component, progress, animationClock) {
    const sheet = component.animation?.sheet;
    if (!sheet?.frames?.length) return 0;
    return sheet.loop
      ? Math.floor(animationClock / 1000 * sheet.fps) % sheet.frames.length
      : Math.min(sheet.frames.length - 1, Math.floor(progress * sheet.frames.length));
  }

  weaponLayer(component, progress, animationClock) {
    const frameIndex = this.animationFrameIndex(component, progress, animationClock);
    return component.animation?.layerByFrame?.[frameIndex] || "front";
  }

  drawArenaGuides(context, width, height, frame) {
    const color = frame.arena.type === "sand" ? "#3d2a12" : "#10232d";
    const groundY = frame.arena.groundY;
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
    context.fillStyle = "#d9e4e9";
    context.font = "700 12px system-ui";
    context.textAlign = "center";
    context.fillText(frame.rendererMode === RENDERER_MODES.assets ? "БОЙ · АССЕТЫ" : "БОЙ · КАРКАС", width / 2, 34);
    context.fillStyle = "#55636a";
    context.font = "10px system-ui";
    context.fillText("мобильный предпросмотр", width / 2, 51);
    context.textAlign = "start";
  }

  drawHud(context, fighters, width, presentation) {
    const barWidth = 136;
    const y = 82;
    const labelY = 105;
    fighters.forEach((fighter, index) => {
      const x = index === 0 ? 16 : width - barWidth - 16;
      const color = index === 0 ? "#ef5b5b" : "#3cc8df";
      const ratio = clamp(fighter.health / fighter.maxHealth, 0, 1);
      context.fillStyle = "#151b20";
      context.fillRect(x, y, barWidth, 9);
      context.fillStyle = color;
      context.fillRect(x, y, Math.round(barWidth * ratio), 9);
      context.fillStyle = "#d9e4e9";
      context.font = "10px system-ui";
      context.fillText(fighter.name.toUpperCase().slice(0, 13), x, labelY);
    });
  }

  drawComponent(context, component, progress, animationClock, frame) {
    const easing = easeOut(progress);
    const x = lerp(component.transform.x, component.transform.x + component.motion.x, easing);
    const y = lerp(component.transform.y, component.transform.y + component.motion.y, easing);
    context.save();
    context.translate(x, y);
    context.rotate(lerp(0, component.motion.rotation, easing));
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
    if (component.animation?.blendMode) context.globalCompositeOperation = component.animation.blendMode;
    if (component.animation?.mirrored) context.scale(-1, 1);
    if (sheet?.frames) {
      const frameIndex = this.animationFrameIndex(component, progress, animationClock);
      const frame = sheet.frames[frameIndex];
      const sourceWidth = image.naturalWidth / sheet.columns;
      const sourceHeight = image.naturalHeight / sheet.rows;
      const assetHeight = component.animation?.assetHeight || 255;
      const assetWidth = assetHeight * (sourceWidth / sourceHeight);
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

  drawCaption(context, frame, width, height) {
    const action = frame.action;
    const title = action ? ({ hit: "УДАР", miss: "ПРОМАХ", dodge: "УВОРОТ", block: "БЛОК" }[action.outcome] || "ДЕЙСТВИЕ") : "ГОТОВНОСТЬ";
    context.fillStyle = "#aab8bd";
    context.font = "700 13px system-ui";
    context.textAlign = "center";
    context.fillText(title, width / 2, height - 32);
    context.textAlign = "start";
  }
}

globalThis.GladiatorVisualEngine = {
  BattleVisualEngine,
  PRESENTATIONS,
  RENDERER_MODES,
  createVisualFrame,
};
})();
