(function () {
"use strict";

/*
 * Отдельный эксперимент: PixiJS рисует и анимирует иерархию костей.
 * Он намеренно не импортирует BattleEngine и не использует покадровый Canvas
 * движок. На вход получает тот же snapshot, что и остальные представления.
 */
const freeze = (value) => Object.freeze(value);
const WEAPON_BY_CLASS = Object.freeze({
  murmillo: "sword", thraex: "sica", retiarius: "trident", secutor: "sword", hoplomachus: "spear",
});
const WEAPON_COLORS = Object.freeze({
  sword: 0xe3c477, sica: 0xe99964, trident: 0xb191eb, spear: 0x91d47d,
});
const FIGHTER_COLORS = Object.freeze([0xc65252, 0x2caabd]);
const SKIN_COLOR = 0xcf9a6e;
const SLEEVE_COLOR = 0x6b4a35;
const INJURED_HEALTH_RATIO = 0.45;

/*
 * Углы руки подобраны офлайн через прямую кинематику (плечо → локоть →
 * кисть), а не на глаз: см. черновик расчёта в PR. `weapon` — это абсолютный
 * угол клинка в мировых координатах бойца, а не угол относительно кисти,
 * поэтому руку можно сгибать независимо от того, куда указывает лезвие.
 * armRotation(pose) конвертирует это в локальные rotation для upper/forearm/weapon.
 */
const ARM_POSES = Object.freeze({
  idle: Object.freeze({ upper: -0.35, forearm: -0.45, weapon: 1.3 }),
  windup: Object.freeze({ upper: 0.5, forearm: -0.9, weapon: 0.3 }),
  extend: Object.freeze({ upper: -0.9, forearm: -0.1, weapon: 1.5 }),
  block: Object.freeze({ upper: -0.3, forearm: -1.6, weapon: 2.05 }),
});
const lerpAngle = (from, to, t) => from + (to - from) * t;
const weaponLocalRotation = (pose) => pose.weapon - pose.upper - pose.forearm;

const fighterFromInput = (fighter) => ({
  id: fighter.id,
  name: fighter.name,
  fighterClass: fighter.fighterClass,
  health: fighter.base.health,
  maxHealth: fighter.base.health,
  fatigue: 0,
  visual: fighter.visual,
});

const visualStateForFighter = (fighter, action) => {
  if (fighter.health <= 0) return "defeated";
  if (action?.actorId === fighter.id) return "attack";
  if (action?.targetId === fighter.id) {
    return ({ hit: "reaction.hit", dodge: "defense.dodge", block: "defense.block" }[action.outcome] || "idle.normal");
  }
  const healthRatio = fighter.health / Math.max(1, fighter.maxHealth);
  if (healthRatio < INJURED_HEALTH_RATIO || fighter.traumas?.length || fighter.injuries?.length) return "idle.injured";
  if (fighter.fatigue >= 70) return "idle.tired";
  return "idle.normal";
};

const createSkeletalFrame = (snapshot, input) => {
  const sourceFighters = snapshot?.fighters || input.fighters.map(fighterFromInput);
  const fighters = sourceFighters.map((fighter, index) => ({
    ...fighter,
    visual: fighter.visual || input.fighters.find((candidate) => candidate.id === fighter.id)?.visual || input.fighters[index]?.visual,
  }));
  const action = snapshot?.lastAction || null;
  return freeze({
    version: 1,
    action: action ? freeze({ actorId: action.actorId, targetId: action.targetId, outcome: action.outcome }) : null,
    rigs: freeze(fighters.map((fighter, side) => freeze({
      fighterId: fighter.id,
      side,
      name: fighter.name,
      health: fighter.health,
      maxHealth: fighter.maxHealth,
      state: visualStateForFighter(fighter, action),
      weaponSkinId: fighter.visual?.weaponSkinId || WEAPON_BY_CLASS[fighter.fighterClass] || "sword",
    }))),
  });
};

class PixiSkeletalPreview {
  constructor(host) {
    this.host = host;
    this.app = null;
    this.frame = null;
    this.rigs = [];
    this.cueStartedAt = performance.now();
    this.ready = this.initialize().catch(() => {
      this.host.textContent = "PixiJS недоступен: Canvas-предпросмотры продолжают работать.";
      this.host.classList.add("pixi-unavailable");
    });
  }

  async initialize() {
    const PIXI = globalThis.PIXI;
    if (!PIXI) {
      this.host.textContent = "PixiJS не загрузился: Canvas-предпросмотр остаётся доступен.";
      this.host.classList.add("pixi-unavailable");
      return;
    }
    const app = new PIXI.Application();
    await app.init({
      width: 360,
      height: 420,
      backgroundColor: 0x050607,
      antialias: false,
      autoDensity: true,
      resolution: Math.min(globalThis.devicePixelRatio || 1, 2),
    });
    app.canvas.setAttribute("aria-label", "Экспериментальная скелетная анимация PixiJS");
    this.host.replaceChildren(app.canvas);
    this.app = app;
    app.ticker.add(() => this.animate());
    if (this.frame) this.buildScene();
  }

  present(snapshot, input) {
    this.frame = createSkeletalFrame(snapshot, input);
    this.cueStartedAt = performance.now();
    if (this.app) this.buildScene();
    return this.frame;
  }

  buildScene() {
    const { PIXI } = globalThis;
    this.app.stage.removeChildren().forEach((child) => child.destroy({ children: true }));
    this.rigs = this.frame.rigs.map((rig, index) => this.createRig(PIXI, rig, index));
    this.drawHud(PIXI);
  }

  createRig(PIXI, model, index) {
    const { Container, Graphics } = PIXI;
    const direction = index === 0 ? 1 : -1;
    const root = new Container();
    root.position.set(index === 0 ? 110 : 250, 332);
    root.scale.x = direction;
    this.app.stage.addChild(root);

    const torso = new Container();
    torso.y = -84;
    root.addChild(torso);
    torso.addChild(new Graphics().roundRect(-22, -46, 44, 58, 8).fill({ color: FIGHTER_COLORS[index] }));
    torso.addChild(new Graphics().circle(0, -64, 16).fill({ color: 0x252d31 }).stroke({ color: FIGHTER_COLORS[index], width: 3 }));

    /*
     * Кости идут строго встык: плечо → (0, UPPER_LEN) конец плеча = начало
     * предплечья → (0, FOREARM_LEN) конец предплечья = кисть. Оружие
     * крепится к кисти, а не к середине предплечья, поэтому клинок всегда
     * начинается ровно там, где кончается рука.
     */
    const UPPER_LEN = 36;
    const FOREARM_LEN = 34;
    const createArm = (x, sleeveColor) => {
      const upper = new Container();
      upper.position.set(x, -30);
      upper.addChild(new Graphics().roundRect(-6, 0, 12, UPPER_LEN, 6).fill({ color: sleeveColor }));
      const forearm = new Container();
      forearm.position.set(0, UPPER_LEN);
      forearm.addChild(new Graphics().roundRect(-5, 0, 10, FOREARM_LEN, 5).fill({ color: SKIN_COLOR }));
      const hand = new Container();
      hand.position.set(0, FOREARM_LEN);
      hand.addChild(new Graphics().circle(0, 0, 7).fill({ color: SKIN_COLOR }));
      forearm.addChild(hand);
      upper.addChild(forearm);
      torso.addChild(upper);
      return { upper, forearm, hand };
    };
    const primaryArm = createArm(23, FIGHTER_COLORS[index]);
    const secondaryArm = createArm(-23, SLEEVE_COLOR);

    const legLeft = new Container();
    legLeft.position.set(-13, 7);
    legLeft.addChild(new Graphics().roundRect(-7, 0, 14, 64, 7).fill({ color: 0x56666c }));
    torso.addChild(legLeft);
    const legRight = new Container();
    legRight.position.set(13, 7);
    legRight.addChild(new Graphics().roundRect(-7, 0, 14, 64, 7).fill({ color: 0x68777a }));
    torso.addChild(legRight);

    // Оружие принадлежит кисти, а не середине руки: это проверяемый контракт рига.
    const weapon = new Container();
    const weaponColor = WEAPON_COLORS[model.weaponSkinId] || WEAPON_COLORS.sword;
    // Тёмная обводка нужна, чтобы клинок не сливался с телесным цветом кисти.
    weapon.addChild(new Graphics().roundRect(-4, -46, 8, 47, 3).fill({ color: weaponColor }).stroke({ color: 0x1c1410, width: 1.5 }));
    weapon.addChild(new Graphics().rect(-9, -6, 18, 6).fill({ color: 0x6c5138 }).stroke({ color: 0x1c1410, width: 1 }));
    primaryArm.hand.addChild(weapon);

    return { model, root, torso, primaryArm, secondaryArm, legLeft, legRight, weapon, direction };
  }

  drawHud(PIXI) {
    const { Graphics } = PIXI;
    this.frame.rigs.forEach((rig, index) => {
      const x = index === 0 ? 18 : 198;
      const ratio = Math.max(0, rig.health / rig.maxHealth);
      this.app.stage.addChild(new Graphics().roundRect(x, 22, 144, 8, 3).fill({ color: 0x172024 }));
      this.app.stage.addChild(new Graphics().roundRect(x, 22, 144 * ratio, 8, 3).fill({ color: FIGHTER_COLORS[index] }));
    });
    this.app.stage.addChild(new Graphics().rect(14, 364, 332, 2).fill({ color: 0x1c363d }));
  }

  animate() {
    if (!this.rigs.length) return;
    const elapsed = (performance.now() - this.cueStartedAt) / 1000;
    this.rigs.forEach((rig) => this.poseRig(rig, elapsed));
  }

  poseRig(rig, elapsed) {
    const phase = elapsed * Math.PI * 2;
    const idle = Math.sin(phase * (rig.model.state === "idle.tired" ? 0.65 : 1)) * 0.045;
    const direction = rig.direction;
    rig.root.x = rig.model.side === 0 ? 110 : 250;
    rig.root.y = 332;
    rig.root.rotation = 0;
    rig.torso.rotation = idle;
    rig.primaryArm.upper.rotation = ARM_POSES.idle.upper;
    rig.primaryArm.forearm.rotation = ARM_POSES.idle.forearm;
    rig.weapon.rotation = weaponLocalRotation(ARM_POSES.idle);
    rig.secondaryArm.upper.rotation = -0.28;
    rig.secondaryArm.forearm.rotation = 0.15;
    rig.legLeft.rotation = -0.08;
    rig.legRight.rotation = 0.08;

    if (rig.model.state === "attack") {
      const swing = Math.min(elapsed / 0.56, 1);
      const upper = lerpAngle(ARM_POSES.windup.upper, ARM_POSES.extend.upper, swing);
      const forearm = lerpAngle(ARM_POSES.windup.forearm, ARM_POSES.extend.forearm, swing);
      const weaponAbs = lerpAngle(ARM_POSES.windup.weapon, ARM_POSES.extend.weapon, swing);
      rig.primaryArm.upper.rotation = upper;
      rig.primaryArm.forearm.rotation = forearm;
      rig.weapon.rotation = weaponAbs - upper - forearm;
      rig.root.x += direction * Math.sin(swing * Math.PI) * 22;
    } else if (rig.model.state === "defense.block") {
      rig.primaryArm.upper.rotation = ARM_POSES.block.upper;
      rig.primaryArm.forearm.rotation = ARM_POSES.block.forearm;
      rig.weapon.rotation = weaponLocalRotation(ARM_POSES.block);
    } else if (rig.model.state === "defense.dodge") {
      rig.root.x -= direction * Math.sin(Math.min(elapsed / 0.43, 1) * Math.PI) * 27;
      rig.torso.rotation = direction * -0.3;
    } else if (rig.model.state === "reaction.hit") {
      rig.root.x -= direction * Math.sin(Math.min(elapsed / 0.39, 1) * Math.PI) * 14;
      rig.torso.rotation = direction * -0.24;
    } else if (rig.model.state === "defeated") {
      rig.root.y += 45;
      rig.root.rotation = direction * 1.24;
    } else if (rig.model.state === "idle.tired") {
      rig.torso.y = -78 + Math.abs(Math.sin(phase * 0.6)) * 4;
    } else {
      rig.torso.y = -84;
    }
  }

  destroy() {
    this.app?.destroy({ removeView: true, children: true });
    this.app = null;
  }
}

globalThis.GladiatorPixiSkeletal = { PixiSkeletalPreview, createSkeletalFrame };
})();
