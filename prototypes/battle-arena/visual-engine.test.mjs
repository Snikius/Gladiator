import assert from "node:assert/strict";
import "./reference-data.js";
import "./battle-engine.js";
import "./sprite-library.js";
import "./visual-engine.js";
import "./pixi-skeletal-engine.js";

const { BattleEngine, createDefaultBattleInput } = globalThis.GladiatorBattle;
const {
  ARENA_BACKGROUNDS,
  BODY_ANIMATION_GRIDS,
  RETIARIUS_ATLAS,
  SpriteLibrary,
  UNIFIED_ATLAS,
  UNIFIED_RETIARIUS_GRID_ID,
  UNIFIED_SWORDSMAN_GRID_ID,
  animationFrameForElapsed,
  clipIntroDurationMs,
  defineAnimationClip,
} = globalThis.GladiatorSpriteLibrary;
const {
  ARENA_CAMERA_FOLLOW_RATIO,
  ARENA_CAMERA_ZOOM,
  BattleVisualEngine,
  INJURED_HEALTH_RATIO,
  MILD_INJURED_HEALTH_RATIO,
  PRESSURE_STEP_DISTANCE,
  PRESSURE_DISTANCE,
  POSITION_STAGES,
  PRESENTATIONS,
  RENDERER_MODES,
  actionMotion,
  attackTrailStrokes,
  createVisualFrame,
  drawAttackTrailStrokes,
  resolveTerritoryOffset,
  sheetMotion,
} = globalThis.GladiatorVisualEngine;
const { createSkeletalFrame } = globalThis.GladiatorPixiSkeletal;

const input = createDefaultBattleInput();
input.fighters[0].fighterClass = "murmillo";
input.fighters[0].equipment = {
  weaponSet: { definitionId: "murmillo-arms.good" },
  armorSet: { definitionId: "murmillo-armor.good" },
};
input.fighters[0].visual = { skinId: "arena-gold", weaponSkinId: "spear" };
const inputBeforeRender = JSON.stringify(input);
const result = new BattleEngine(input).simulate();
const snapshotBeforeRender = JSON.stringify(result.snapshots[0]);
const initialFrame = createVisualFrame(result.snapshots[0], input);

assert.equal(initialFrame.components.length, 2, "На двух бойцов приходится по одному запечённому спрайту");
assert.deepEqual(
  initialFrame.components.map((component) => component.kind),
  ["fighter", "fighter"],
);
assert.equal(initialFrame.components[0].skinId, "arena-gold", "Скин берётся из визуального входа, а не из боя");
assert.equal(initialFrame.components[0].animation.weaponSkinId, "sword", "На время разработки всем классам показан мечник");
assert.equal(initialFrame.components.some((component) => component.kind === "weapon"), false, "Отдельный оружейный компонент отключён");
assert.equal(JSON.stringify(input), inputBeforeRender, "Визуальный адаптер не меняет вход симуляции");
assert.equal(JSON.stringify(result.snapshots[0]), snapshotBeforeRender, "Визуальный адаптер не меняет снимок боя");

const actionSnapshot = result.snapshots.find((snapshot) => snapshot.lastAction?.actorId);
const actionFrame = createVisualFrame(actionSnapshot, input);
const actorSprite = actionFrame.components.find((component) => component.id === `${actionSnapshot.lastAction.actorId}:fighter`);
assert.ok(actorSprite.motion.duration > 0, "Действие боя должно стать движением единого визуального компонента");
assert.ok(Object.isFrozen(actionFrame), "Кадр реплея неизменяем");

const enhancedBuffInput = createDefaultBattleInput();
enhancedBuffInput.fighters[0].base.strength = 20;
enhancedBuffInput.fighters[1].base.health = 500;
enhancedBuffInput.playerBuffCommands = [{
  fighterId: "fighter-1",
  buffDefinitionId: "now",
  afterIteration: 0,
  commandSequence: 1,
}];
const enhancedBuffResult = new BattleEngine(enhancedBuffInput).simulate();
const enhancedBuffSnapshot = enhancedBuffResult.snapshots.find((snapshot) => snapshot.lastAction?.specialAttack === "player-buff-now");
const enhancedBuffFrame = createVisualFrame(enhancedBuffSnapshot, enhancedBuffInput, undefined, {
  presentation: PRESENTATIONS.mobile,
  rendererMode: RENDERER_MODES.assets,
});
assert.equal(
  enhancedBuffFrame.components.find((component) => component.fighterId === "fighter-1").animation.clip,
  "special.enhanced",
  "Ударный баф проигрывает линейку усиленного классового удара",
);
assert.equal(
  enhancedBuffFrame.components.find((component) => component.fighterId === "fighter-2").animation.clip,
  "reaction.stunned",
  "Цель ударного бафа сразу проигрывает линейку оглушения",
);
const retiariusBuffInput = createDefaultBattleInput();
retiariusBuffInput.fighters[0].fighterClass = "retiarius";
retiariusBuffInput.fighters[0].equipment = {
  weaponSet: { definitionId: "retiarius-arms.good" },
  armorSet: { definitionId: "retiarius-armor.good" },
};
retiariusBuffInput.fighters[0].base.strength = 20;
retiariusBuffInput.fighters[1].base.health = 500;
retiariusBuffInput.playerBuffCommands = enhancedBuffInput.playerBuffCommands;
const retiariusBuffResult = new BattleEngine(retiariusBuffInput).simulate();
const retiariusBuffSnapshot = retiariusBuffResult.snapshots.find((snapshot) => snapshot.lastAction?.specialAttack === "player-buff-now");
const retiariusBuffFrame = createVisualFrame(retiariusBuffSnapshot, retiariusBuffInput, undefined, {
  presentation: PRESENTATIONS.mobile,
  rendererMode: RENDERER_MODES.assets,
});
assert.equal(retiariusBuffSnapshot.lastAction.attackType, "retiarius-enhanced-jump", "Ретиарий получает прыжковый тип усиленного удара");
assert.equal(retiariusBuffSnapshot.lastAction.stunIterations, 2, "Ретиарий оглушает усиленным ударом на две итерации");
assert.equal(
  retiariusBuffFrame.components.find((component) => component.fighterId === "fighter-1").animation.clip,
  "special.enhanced",
  "Ретиарий использует собственную строку усиленного прыжкового удара",
);
const retiariusEnhancedActor = retiariusBuffFrame.components.find((component) => component.fighterId === "fighter-1");
const sharedRetiariusEnhancedMotion = sheetMotion(
  actionMotion({ id: "fighter-1" }, retiariusBuffFrame.action),
  retiariusEnhancedActor.animation.sheet,
  retiariusEnhancedActor.transform.direction,
);
assert.deepEqual(
  sharedRetiariusEnhancedMotion,
  retiariusEnhancedActor.motion,
  "Наложения и бой получают движение усиленного ретиария из одного расчёта",
);
assert.equal(retiariusEnhancedActor.motion.x, 14, "Усиленный ретиарий делает короткий выпад, а не остаётся в позиции броска сети");
const actualRetiariusEnhancedTrails = attackTrailStrokes(retiariusBuffFrame, 0.56);
const overlayRetiariusEnhancedTrails = attackTrailStrokes({
  ...retiariusBuffFrame,
  action: { ...retiariusBuffFrame.action, classTechnique: null },
}, 0.56);
assert.deepEqual(
  actualRetiariusEnhancedTrails,
  overlayRetiariusEnhancedTrails,
  "Признак классового броска сети не меняет развод усиленного прыжкового удара",
);
assert.ok(
  actualRetiariusEnhancedTrails.every((trail) => trail.kind === "enhanced-thrust"),
  "Реальный усиленный удар рисует диагональный след трезубца вместо линий сети",
);
const trailFrame = (outcome, overrides = {}) => ({
  ...actionFrame,
  action: {
    ...actionFrame.action,
    outcome,
    critical: false,
    classTechnique: null,
    specialAttack: null,
    ...overrides,
  },
});
const missTrails = attackTrailStrokes(trailFrame("miss"), 0.4);
const blockTrails = attackTrailStrokes(trailFrame("block"), 0.4);
const hitTrails = attackTrailStrokes(trailFrame("hit"), 0.4);
const criticalTrails = attackTrailStrokes(trailFrame("hit", { critical: true }), 0.4);
assert.equal(missTrails.length, 3, "Промах оставляет широкий развод из трёх воздушных следов");
assert.ok(missTrails.every((trail) => trail.points.length >= 2), "Каждая линия промаха имеет видимую траекторию");
assert.ok(missTrails[1].alpha > 0.5, "Центральная линия промаха остаётся заметной на мобильном масштабе");
assert.ok(missTrails[0].alpha > hitTrails[0].alpha, "След промаха заметнее следа попадания, которое поддержано реакцией и кровью");
const trailForwardExtent = (trail) => (
  (trail.points.at(-1).x - actorSprite.transform.x) * actorSprite.transform.direction
);
assert.ok(
  trailForwardExtent(missTrails[1]) > trailForwardExtent(hitTrails[1]) + 15,
  "Промах уходит заметно дальше по направлению удара, а не обрывается у точки контакта",
);
assert.ok(missTrails[1].width > blockTrails[1].width, "Развод промаха шире защитного контакта");
assert.notEqual(blockTrails[0].color, hitTrails[0].color, "Блок отделён холодным металлическим оттенком");
assert.ok(criticalTrails[0].width > hitTrails[0].width, "Критический удар получает более широкий след");
assert.deepEqual(attackTrailStrokes(trailFrame("miss"), 0), [], "До взмаха воздушного следа нет");
assert.deepEqual(attackTrailStrokes(trailFrame("miss"), 1), [], "После взмаха воздушный след полностью затухает");
let renderedTrailPasses = 0;
drawAttackTrailStrokes({
  save() {},
  restore() {},
  set lineCap(value) {},
  set lineJoin(value) {},
  set globalAlpha(value) {},
  set strokeStyle(value) {},
  set lineWidth(value) {},
  setLineDash() {},
  beginPath() {},
  moveTo() {},
  lineTo() {},
  stroke() { renderedTrailPasses += 1; },
}, missTrails);
assert.equal(renderedTrailPasses, missTrails.length * 3, "Общий рендерер рисует подложку, основной развод и режущую кромку каждой линии");

const mobileFrame = createVisualFrame(result.snapshots[0], input, undefined, {
  presentation: PRESENTATIONS.mobile,
  rendererMode: RENDERER_MODES.assets,
});
assert.equal(mobileFrame.presentation, "mobile", "Мобильная сцена должна иметь отдельную презентацию");
assert.equal(mobileFrame.rendererMode, "assets", "Режим ассетов переключается только в визуальном слое");
assert.equal(mobileFrame.components[0].assetPath, "./assets/unified-swordsman-grid-v16.png");
assert.equal(mobileFrame.components[0].animation.bodyGridId, UNIFIED_SWORDSMAN_GRID_ID);
assert.equal(mobileFrame.components[0].animation.equipmentProfileId, "murmillo-armor", "Профиль поз берётся из комплекта брони");
assert.equal(mobileFrame.components[0].animation.state, "idle.normal");
assert.equal(mobileFrame.components[0].animation.weaponBakedIn, true, "Меч является частью единого листа бойца");
assert.equal(UNIFIED_ATLAS.cellWidth, 384, "Единый лист использует физическую ширину кадра 384 px");
assert.equal(UNIFIED_ATLAS.cellHeight, 384, "Единый лист использует физическую высоту кадра 384 px");
assert.equal(UNIFIED_ATLAS.logicalWidth, 256, "Масштаб тела считается по логической ширине 256 px");
assert.equal(UNIFIED_ATLAS.logicalHeight, 256, "Масштаб тела считается по логической высоте 256 px");
assert.equal(UNIFIED_ATLAS.rows, 14, "Лист мечника содержит дополнительные строки усиленного приёма, оглушения и удара с разворота");
assert.equal(BODY_ANIMATION_GRIDS[UNIFIED_SWORDSMAN_GRID_ID].grid.columns, 6);
assert.equal(BODY_ANIMATION_GRIDS[UNIFIED_SWORDSMAN_GRID_ID].clips.attack.frames.length, 6, "Атака занимает всю строку из шести кадров");
assert.equal(BODY_ANIMATION_GRIDS[UNIFIED_SWORDSMAN_GRID_ID].clips.attack.row, 3, "Атака использует собственную строку атласа");
assert.deepEqual(BODY_ANIMATION_GRIDS[UNIFIED_SWORDSMAN_GRID_ID].clips["idle.normal"].playback.repeat.sequence, [0, 1, 2, 3, 4, 5], "Стойка должна быть циклической анимацией");
assert.equal(BODY_ANIMATION_GRIDS[UNIFIED_SWORDSMAN_GRID_ID].clips["idle.injured.light"].row, 2, "Слабая и полная раненые стойки используют один ряд ассета");
assert.deepEqual(BODY_ANIMATION_GRIDS[UNIFIED_SWORDSMAN_GRID_ID].clips["idle.injured.light"].playback.repeat.sequence, [0, 1], "Слабая раненая стойка не доходит до глубоких кадров");
assert.equal(BODY_ANIMATION_GRIDS[UNIFIED_SWORDSMAN_GRID_ID].clips["idle.injured.light"].fps, 1.5, "Слабая раненая стойка меняет позу медленно и не выглядит частым поклоном");
assert.deepEqual(BODY_ANIMATION_GRIDS[UNIFIED_SWORDSMAN_GRID_ID].clips["idle.injured"].playback.repeat.sequence, [0, 1, 2, 3, 4, 5], "Полная раненая стойка использует весь ряд");
assert.equal(BODY_ANIMATION_GRIDS[UNIFIED_SWORDSMAN_GRID_ID].clips["defense.block"].fps, 20, "Блок должен быстро поднимать защиту");
const fullDodgeClip = BODY_ANIMATION_GRIDS[UNIFIED_SWORDSMAN_GRID_ID].clips["defense.dodge"];
const shortMissClip = BODY_ANIMATION_GRIDS[UNIFIED_SWORDSMAN_GRID_ID].clips["defense.miss"];
assert.equal(shortMissClip.row, fullDodgeClip.row, "Промах переиспользует строку уклонения без нового ассета");
assert.deepEqual(shortMissClip.frames, [0, 1, 2, 1, 0], "Короткий уход не доходит до глубоких кадров уклонения");
assert.ok(clipIntroDurationMs(shortMissClip) < clipIntroDurationMs(fullDodgeClip), "Реакция на промах короче полного уклонения");
assert.deepEqual(BODY_ANIMATION_GRIDS[UNIFIED_SWORDSMAN_GRID_ID].clips["reaction.hit"].frames, [0, 1, 2, 1, 0], "Реакция на удар не захватывает кадры падения");
assert.equal(BODY_ANIMATION_GRIDS[UNIFIED_SWORDSMAN_GRID_ID].clips.advance.row, 7, "Движение использует отдельную восьмую строку");
assert.deepEqual(BODY_ANIMATION_GRIDS[UNIFIED_SWORDSMAN_GRID_ID].clips.retreat.frames, [5, 4, 3, 2, 1, 0], "Движение назад переиспользует строку в обратном порядке");
assert.equal(BODY_ANIMATION_GRIDS[UNIFIED_SWORDSMAN_GRID_ID].clips.greeting.row, 8, "Приветствие занимает отдельную девятую строку");
assert.equal(BODY_ANIMATION_GRIDS[UNIFIED_SWORDSMAN_GRID_ID].clips.greeting.playback.repeat, null, "Приветствие проигрывается один раз");
assert.equal(BODY_ANIMATION_GRIDS[UNIFIED_SWORDSMAN_GRID_ID].clips.victory.row, 9, "Победа занимает отдельную десятую строку");
assert.deepEqual(BODY_ANIMATION_GRIDS[UNIFIED_SWORDSMAN_GRID_ID].clips.victory.playback.repeat.sequence, [4, 5], "После полного победного салюта повторяются только два последних кадра");
assert.equal(BODY_ANIMATION_GRIDS[UNIFIED_SWORDSMAN_GRID_ID].clips.victory.playback.repeat.keepAlive, true, "Финальный цикл остаётся активным до нового боя");
assert.equal(BODY_ANIMATION_GRIDS[UNIFIED_SWORDSMAN_GRID_ID].clips.special.row, 10, "Особый приём занимает отдельную одиннадцатую строку");
assert.equal(BODY_ANIMATION_GRIDS[UNIFIED_SWORDSMAN_GRID_ID].clips.special.frames.length, 6, "Особый приём использует все шесть кадров строки");
assert.equal(BODY_ANIMATION_GRIDS[UNIFIED_SWORDSMAN_GRID_ID].clips["special.enhanced"].row, 11, "Усиленный классовый удар занимает строку 11");
assert.equal(BODY_ANIMATION_GRIDS[UNIFIED_SWORDSMAN_GRID_ID].clips["reaction.stunned"].row, 12, "Оглушение занимает строку 12");
assert.deepEqual(BODY_ANIMATION_GRIDS[UNIFIED_SWORDSMAN_GRID_ID].clips["reaction.stunned"].frames, [0, 1, 2, 4, 2, 4, 2, 5], "Оглушение пропускает четвёртый кадр и циклически чередует третий с пятым перед восстановлением");
assert.deepEqual(BODY_ANIMATION_GRIDS[UNIFIED_SWORDSMAN_GRID_ID].clips["reaction.stunned"].playback.repeat.sequence, [0, 1, 2, 4, 2, 4, 2, 5], "Preview повторяет полную последовательность оглушения");
assert.equal(BODY_ANIMATION_GRIDS[UNIFIED_SWORDSMAN_GRID_ID].clips["reaction.stunned"].playback.repeat.keepAlive, true, "Оглушение остаётся зацикленным до смены состояния");
assert.deepEqual(BODY_ANIMATION_GRIDS[UNIFIED_SWORDSMAN_GRID_ID].clips["reaction.stunned"].playback.frameDurationsMs, [160, 160, 230, 230, 230, 230, 230, 180], "Внутренние кадры оглушения 3↔5 удерживаются дольше входа");
assert.equal(animationFrameForElapsed(BODY_ANIMATION_GRIDS[UNIFIED_SWORDSMAN_GRID_ID].clips["reaction.stunned"], 500), 2, "Третий кадр оглушения удерживается 230 мс");
assert.equal(animationFrameForElapsed(BODY_ANIMATION_GRIDS[UNIFIED_SWORDSMAN_GRID_ID].clips["reaction.stunned"], 600), 4, "После замедленной выдержки цикл переходит к пятому кадру");
assert.equal(BODY_ANIMATION_GRIDS[UNIFIED_SWORDSMAN_GRID_ID].clips["attack.spinning"].row, 13, "Удар с разворота занимает строку 13");
assert.deepEqual(BODY_ANIMATION_GRIDS[UNIFIED_SWORDSMAN_GRID_ID].clips["attack.spinning"].frames, [0, 1, 2, 3, 4, 5], "Удар с разворота использует все шесть кадров");
const arbitraryClip = defineAnimationClip({
  row: 12,
  fps: 10,
  sequence: [0, 2, 1, 3],
  repeatSequence: [4, 3],
  keepAlive: true,
  durationMs: 400,
});
assert.deepEqual(arbitraryClip.playback.sequence, [0, 2, 1, 3], "Шаблон принимает произвольную вступительную последовательность");
assert.equal(animationFrameForElapsed(arbitraryClip, 250), 1, "Произвольная последовательность проигрывается в заданном порядке");
assert.equal(animationFrameForElapsed(arbitraryClip, 400), 4, "Повтор может использовать кадр, которого не было во вступлении");
assert.equal(animationFrameForElapsed(arbitraryClip, 500), 3, "Повторяемый сегмент имеет независимый порядок кадров");
const standardInput = createDefaultBattleInput();
standardInput.fighters[0].fighterClass = "murmillo";
standardInput.fighters[0].equipment = {
  weaponSet: { definitionId: "murmillo-arms.good" },
  armorSet: { definitionId: "murmillo-armor.good" },
};
standardInput.fighters[1].fighterClass = "retiarius";
standardInput.fighters[1].equipment = {
  weaponSet: { definitionId: "retiarius-arms.good" },
  armorSet: { definitionId: "retiarius-armor.good" },
};
const standardResult = new BattleEngine(standardInput).simulate();
const standardMobileFrame = createVisualFrame(standardResult.snapshots[0], standardInput, undefined, {
  presentation: PRESENTATIONS.mobile,
  rendererMode: RENDERER_MODES.assets,
});
assert.equal(standardMobileFrame.components[0].animation.mirrored, false, "Левый боец смотрит в центр без отражения исходного листа");
assert.equal(standardMobileFrame.components[1].animation.bodyGridId, UNIFIED_RETIARIUS_GRID_ID, "Ретиарий использует собственный единый лист");
assert.equal(standardMobileFrame.components[1].assetPath, "./assets/unified-retiarius-grid-v8.png", "Игра использует расширенный атлас ретиария");
assert.equal(BODY_ANIMATION_GRIDS[UNIFIED_RETIARIUS_GRID_ID].grid.rows, 13, "Ретиарий содержит строки усиленного удара и оглушения");
assert.equal(BODY_ANIMATION_GRIDS[UNIFIED_RETIARIUS_GRID_ID].clips["special.enhanced"].row, 11, "Усиленный удар ретиария занимает строку 11");
assert.deepEqual(BODY_ANIMATION_GRIDS[UNIFIED_RETIARIUS_GRID_ID].clips["special.enhanced"].frames, [0, 1, 2, 3, 4, 5], "Усиленный удар ретиария использует все шесть кадров");
assert.equal(BODY_ANIMATION_GRIDS[UNIFIED_RETIARIUS_GRID_ID].clips["reaction.stunned"].row, 12, "Оглушение ретиария занимает строку 12");
assert.deepEqual(BODY_ANIMATION_GRIDS[UNIFIED_RETIARIUS_GRID_ID].clips["reaction.stunned"].frames, [0, 1, 2, 4, 2, 4, 2, 5], "Ретиарий использует общий замедленный цикл оглушения");
assert.notEqual(standardMobileFrame.components[1].assetPath, standardMobileFrame.components[0].assetPath, "Ретиарий не подменяется ассетом мечника");
assert.equal(standardMobileFrame.components[1].animation.weaponSkinId, "trident", "Трезубец запечён в кадры ретиария");
assert.equal(standardMobileFrame.components[1].animation.assetHeight, 150, "Оба бойца имеют одинаковый визуальный масштаб");
assert.equal(RETIARIUS_ATLAS.cellHeight, 384, "Физическая ячейка ретиария содержит буфер для длинного оружия");
assert.equal(RETIARIUS_ATLAS.logicalHeight, 256, "Логический размер тела не включает оружейный буфер");
const retiariusActionBase = {
  actorId: standardMobileFrame.fighters[1].id,
  targetId: standardMobileFrame.fighters[0].id,
  outcome: "miss",
  critical: false,
  classTechnique: null,
  specialAttack: null,
};
const retiariusTrails = attackTrailStrokes({ ...standardMobileFrame, action: retiariusActionBase }, 0.4);
const retiariusNetTrails = attackTrailStrokes({
  ...standardMobileFrame,
  action: { ...retiariusActionBase, classTechnique: "weapon.retiarius-net-cast" },
}, 0.4);
const retiariusEnhancedTrails = attackTrailStrokes({
  ...standardMobileFrame,
  action: { ...retiariusActionBase, attackType: "retiarius-enhanced-jump", enhancedClassTechnique: true },
}, 0.56);
const retiariusEnhancedHitTrails = attackTrailStrokes({
  ...standardMobileFrame,
  action: { ...retiariusActionBase, outcome: "hit", attackType: "retiarius-enhanced-jump", enhancedClassTechnique: true },
}, 0.56);
assert.deepEqual(
  retiariusEnhancedHitTrails,
  retiariusEnhancedTrails,
  "Усиленный удар ретиария использует одинаковый воздушный след в наложениях и при реальном попадании",
);
const swordsmanActionBase = {
  actorId: standardMobileFrame.fighters[0].id,
  targetId: standardMobileFrame.fighters[1].id,
  outcome: "miss",
  critical: false,
  classTechnique: null,
  specialAttack: null,
};
const swordsmanTrails = attackTrailStrokes({ ...standardMobileFrame, action: swordsmanActionBase }, 0.5);
const swordsmanSpecialRaiseTrails = attackTrailStrokes({
  ...standardMobileFrame,
  action: { ...swordsmanActionBase, specialAttack: "preview-sword-special" },
}, 0.38);
const swordsmanSpecialTrails = attackTrailStrokes({
  ...standardMobileFrame,
  action: { ...swordsmanActionBase, specialAttack: "preview-sword-special" },
}, 0.7);
const swordsmanSpinningTrails = attackTrailStrokes({
  ...standardMobileFrame,
  action: { ...swordsmanActionBase, attackType: "spinning-strike" },
}, 0.58);
const trailVerticalTravel = (trail) => trail.points.at(-1).y - trail.points[0].y;
const trailHorizontalTravel = (trail) => Math.abs(trail.points.at(-1).x - trail.points[0].x);
assert.ok(retiariusTrails.every((trail) => trail.kind === "thrust"), "Трезубец оставляет прямой след выпада, а не мечевую дугу");
assert.ok(Math.abs(trailVerticalTravel(retiariusTrails[1])) < 14, "Обычный выпад ретиария остаётся почти горизонтальным");
assert.equal(retiariusNetTrails.length, 3, "Бросок сети читается как веер из трёх воздушных линий");
assert.ok(retiariusNetTrails.every((trail) => trail.kind === "net"), "Особый приём ретиария использует профиль сети");
assert.ok(Math.abs(trailVerticalTravel(retiariusNetTrails[1])) < 8, "Центральная линия броска сети следует горизонтальному движению руки");
assert.equal(retiariusEnhancedTrails.length, 3, "Усиленный прыжковый удар получает широкий след трезубца");
assert.ok(retiariusEnhancedTrails.every((trail) => trail.kind === "enhanced-thrust"), "Усиленный удар ретиария не переиспользует профиль сети или обычного выпада");
assert.ok(trailVerticalTravel(retiariusEnhancedTrails[1]) > 30, "След усиленного трезубца идёт сверху вниз по траектории прыжкового удара");
const enhancedTrailDx = Math.abs(retiariusEnhancedTrails[1].points.at(-1).x - retiariusEnhancedTrails[1].points[0].x);
const enhancedTrailDy = Math.abs(trailVerticalTravel(retiariusEnhancedTrails[1]));
assert.ok(enhancedTrailDy / enhancedTrailDx > 0.9 && enhancedTrailDy / enhancedTrailDx < 1.1, "След усиленного трезубца сохраняет прямой угол около 45 градусов");
assert.ok(trailVerticalTravel(swordsmanTrails[1]) > 25, "Обычный мечевой след идёт от верхнего замаха вниз к цели");
assert.ok(trailVerticalTravel(swordsmanSpecialRaiseTrails[1]) < -10, "След спецприёма сначала поднимается вместе с вертикальным клинком");
assert.ok(trailVerticalTravel(swordsmanSpecialTrails[1]) > 45, "Особый удар мечника получает более высокий нисходящий размах");
assert.equal(swordsmanSpinningTrails.length, 3, "Разворот получает более широкий след из трёх линий");
assert.ok(swordsmanSpinningTrails.every((trail) => trail.kind === "spinning-slash"), "Разворот использует отдельный профиль следа меча");
assert.ok(Math.abs(trailVerticalTravel(swordsmanSpinningTrails[1])) < 10, "След разворота идёт почти прямо по горизонтальной траектории меча");
assert.ok(trailHorizontalTravel(swordsmanSpinningTrails[1]) > trailHorizontalTravel(swordsmanTrails[1]) + 20, "След разворота заметно длиннее обычного размаха");
assert.equal(standardMobileFrame.components[1].animation.sheet.logicalHeight, 256, "Рендерер масштабирует ретиария по логическому телу");
let bufferedDrawArgs = null;
const bufferedContext = {
  set filter(value) {},
  scale() {},
  drawImage(...args) { bufferedDrawArgs = args; },
};
BattleVisualEngine.prototype.drawAsset.call({
  loadAsset: () => ({ complete: true, naturalWidth: 2304, naturalHeight: 4992 }),
  animationFrameColumn: () => 0,
}, bufferedContext, standardMobileFrame.components[1], 0, 0);
assert.equal(bufferedDrawArgs[3], 384, "Рендерер вырезает полную физическую ширину буферного кадра");
assert.equal(bufferedDrawArgs[4], 384, "Рендерер вырезает полную физическую высоту буферного кадра");
assert.equal(bufferedDrawArgs[7], 225, "Буфер расширяет рисунок, не меняя логическую высоту тела 150 px");
assert.equal(bufferedDrawArgs[8], 225, "Оружейный буфер выводится целиком поверх сцены");
assert.equal(standardMobileFrame.components[1].transform.x - standardMobileFrame.components[0].transform.x, 120, "Бойцы стоят ближе для ближнего боя");
assert.equal(standardMobileFrame.components[1].animation.mirrored, true, "Правый боец зеркалит единый исходный лист");
assert.equal(
  standardMobileFrame.components[0].transform.y
    - standardMobileFrame.components[0].animation.assetHeight * BODY_ANIMATION_GRIDS[UNIFIED_SWORDSMAN_GRID_ID].baselineInset,
  standardMobileFrame.arena.groundY,
  "Ноги спрайта стоят на линии земли",
);
assert.equal(standardMobileFrame.components[0].animation.assetHeight, 150, "Ассет помещается в компактную игровую сцену");
assert.equal(standardMobileFrame.arena.assetPath, ARENA_BACKGROUNDS.crowd.assetPath, "Арена со зрителями является новым фоном по умолчанию");
assert.equal(standardMobileFrame.arena.ambientLights.length, 2, "Арена со зрителями передаёт два независимых факела");
assert.equal(standardMobileFrame.arena.crowdMotion.length, 16, "Фон толпы получает компактный процедурный слой зрителей");
assert.equal(standardMobileFrame.arena.groundY, 280, "Линия ног помещается в компактный Canvas высотой 300 px");
const tallMobileFrame = createVisualFrame(standardResult.snapshots[0], standardInput, undefined, {
  presentation: PRESENTATIONS.mobile,
  rendererMode: RENDERER_MODES.assets,
  sceneHeight: 324,
});
assert.equal(tallMobileFrame.arena.groundY, 293, "Высокий мобильный экран добавляет арену без растягивания бойцов");
assert.equal(tallMobileFrame.components[0].animation.assetHeight, 150, "Адаптивная высота сцены не меняет рост бойца");
const idleShadows = BattleVisualEngine.prototype.fighterShadowSprites.call(
  { transitionFrom: new Map() },
  standardMobileFrame,
  0,
);
assert.equal(idleShadows.length, 2, "Под каждым бойцом создаётся отдельная процедурная тень");
assert.ok(idleShadows.every((shadow) => shadow.y === standardMobileFrame.arena.groundY - 1), "Тени заходят под стопы на линии земли");
assert.ok(idleShadows.every((shadow) => shadow.width >= 52), "Тень немного шире стойки бойца");
const animatedIdleShadows = BattleVisualEngine.prototype.fighterShadowSprites.call(
  { transitionFrom: new Map() },
  standardMobileFrame,
  0,
  500,
);
assert.notEqual(animatedIdleShadows[0].width, idleShadows[0].width, "Тень слегка меняется вместе с циклом стойки");
const actionShadows = BattleVisualEngine.prototype.fighterShadowSprites.call(
  { transitionFrom: new Map() },
  actionFrame,
  0.5,
);
const actorShadow = actionShadows.find((shadow) => shadow.fighterId === actionSnapshot.lastAction.actorId);
assert.notEqual(actorShadow.x, actorSprite.transform.x, "Тень следует за корнем бойца во время выпада");
assert.equal(standardMobileFrame.arena.sourceGroundY, 470, "Новый фон обрезается с сохранением исходной линии земли");
assert.equal(INJURED_HEALTH_RATIO, 0.45, "Порог полной раненой стойки зафиксирован на 45% здоровья");
assert.equal(MILD_INJURED_HEALTH_RATIO, 0.7, "Слабая раненая стойка начинается ниже 70% здоровья");
const injuredHealthSnapshot = JSON.parse(JSON.stringify(standardResult.snapshots[0]));
injuredHealthSnapshot.lastAction = null;
injuredHealthSnapshot.fighters[0].health = injuredHealthSnapshot.fighters[0].maxHealth * 0.44;
injuredHealthSnapshot.fighters[0].fatigue = 90;
const injuredHealthFrame = createVisualFrame(injuredHealthSnapshot, standardInput, undefined, {
  presentation: PRESENTATIONS.mobile,
  rendererMode: RENDERER_MODES.assets,
});
assert.equal(injuredHealthFrame.components[0].animation.clip, "idle.injured", "Ниже 45% здоровья включается раненая стойка даже при высокой усталости");
assert.equal(injuredHealthFrame.fighters[0].injured, true, "Визуальный кадр помечает живого раненого бойца для постоянной крови");
const injuredDrops = BattleVisualEngine.prototype.injuredBloodDrops.call(null, injuredHealthFrame, 0);
assert.equal(injuredDrops.length, 2, "Под раненым бойцом постоянно чередуются две капли крови");
assert.ok(injuredDrops.some((drop) => !drop.landed), "В цикле раненого видна падающая капля");
assert.ok(injuredDrops.every((drop) => drop.fighterId === injuredHealthFrame.fighters[0].id));
const thresholdHealthSnapshot = JSON.parse(JSON.stringify(injuredHealthSnapshot));
thresholdHealthSnapshot.fighters[0].health = thresholdHealthSnapshot.fighters[0].maxHealth * 0.45;
thresholdHealthSnapshot.fighters[0].fatigue = 0;
const thresholdHealthFrame = createVisualFrame(thresholdHealthSnapshot, standardInput, undefined, {
  presentation: PRESENTATIONS.mobile,
  rendererMode: RENDERER_MODES.assets,
});
assert.equal(thresholdHealthFrame.components[0].animation.clip, "idle.injured.light", "Ровно 45% уже относится к слабой, но не к полной раненой стойке");
assert.equal(thresholdHealthFrame.fighters[0].injured, true, "Слабая раненая стойка сохраняет признак ранения");
const mildHealthSnapshot = JSON.parse(JSON.stringify(thresholdHealthSnapshot));
mildHealthSnapshot.fighters[0].health = mildHealthSnapshot.fighters[0].maxHealth * 0.6;
const mildHealthFrame = createVisualFrame(mildHealthSnapshot, standardInput, undefined, {
  presentation: PRESENTATIONS.mobile,
  rendererMode: RENDERER_MODES.assets,
});
assert.equal(mildHealthFrame.components[0].animation.clip, "idle.injured.light", "При 60% здоровья используется слабая раненая стойка");
const traumaSnapshot = JSON.parse(JSON.stringify(standardResult.snapshots[0]));
traumaSnapshot.lastAction = null;
traumaSnapshot.fighters[0].health = traumaSnapshot.fighters[0].maxHealth;
traumaSnapshot.fighters[0].traumas = [{ id: "test-trauma" }];
const traumaFrame = createVisualFrame(traumaSnapshot, standardInput, undefined, {
  presentation: PRESENTATIONS.mobile,
  rendererMode: RENDERER_MODES.assets,
});
assert.equal(traumaFrame.components[0].animation.clip, "idle.injured.light", "Травма гарантирует слабую раненую стойку даже при полном здоровье");
const healthyThresholdSnapshot = JSON.parse(JSON.stringify(thresholdHealthSnapshot));
healthyThresholdSnapshot.fighters[0].health = healthyThresholdSnapshot.fighters[0].maxHealth * 0.7;
healthyThresholdSnapshot.fighters[0].traumas = [];
healthyThresholdSnapshot.fighters[0].injuries = [];
const healthyThresholdFrame = createVisualFrame(healthyThresholdSnapshot, standardInput, undefined, {
  presentation: PRESENTATIONS.mobile,
  rendererMode: RENDERER_MODES.assets,
});
assert.equal(healthyThresholdFrame.components[0].animation.clip, "idle.normal", "Ровно 70% без травм ещё относится к обычной стойке");
assert.equal(healthyThresholdFrame.fighters[0].injured, false, "Ровно при 70% постоянное кровотечение ещё не включается");
assert.deepEqual(
  BattleVisualEngine.prototype.injuredBloodDrops.call(null, healthyThresholdFrame, 0),
  [],
  "Под нераненым бойцом дополнительные капли не рисуются",
);

const neutralPressureSnapshot = JSON.parse(JSON.stringify(standardResult.snapshots[0]));
neutralPressureSnapshot.lastAction = null;
neutralPressureSnapshot.fighters[0].initiative = 50;
neutralPressureSnapshot.fighters[1].initiative = 50;
const entranceFrame = createVisualFrame(neutralPressureSnapshot, standardInput, undefined, {
  presentation: PRESENTATIONS.mobile,
  rendererMode: RENDERER_MODES.assets,
  positionStage: POSITION_STAGES.entrance,
});
assert.equal(entranceFrame.arena.positionStage, "entrance", "Стартовая расстановка помечена отдельно от боевой");
assert.equal(
  entranceFrame.components[1].transform.x - entranceFrame.components[0].transform.x,
  204,
  "Перед боем гладиаторы стоят дальше дистанции удара",
);
const neutralPressureFrame = createVisualFrame(neutralPressureSnapshot, standardInput, undefined, {
  presentation: PRESENTATIONS.mobile,
  rendererMode: RENDERER_MODES.assets,
});
const dominantPressureSnapshot = JSON.parse(JSON.stringify(neutralPressureSnapshot));
dominantPressureSnapshot.fighters[0].initiative = 120;
dominantPressureSnapshot.fighters[1].initiative = 20;
const dominantPressureFrame = createVisualFrame(dominantPressureSnapshot, standardInput, undefined, {
  presentation: PRESENTATIONS.mobile,
  rendererMode: RENDERER_MODES.assets,
});
assert.equal(PRESSURE_DISTANCE, 60, "Подвижная камера расширяет территорию боя до шестидесяти пикселей в каждую сторону");
assert.equal(ARENA_CAMERA_FOLLOW_RATIO, 0.35, "Камера следует только за частью мирового смещения боя");
assert.equal(ARENA_CAMERA_ZOOM, 1.15, "Фон имеет безопасный запас для горизонтальной панорамы");
assert.equal(dominantPressureFrame.arena.territoryOffset, 60, "Преимущество первого бойца сильнее сдвигает бой к правому краю");
assert.equal(dominantPressureFrame.arena.cameraOffset, 21, "Камера следует за центром боя на 35 процентов территориального сдвига");
assert.equal(dominantPressureFrame.arena.screenTerritoryOffset, 39, "Остаток движения остаётся видимым на экране бойцов");
assert.equal(
  dominantPressureFrame.components[0].transform.x - neutralPressureFrame.components[0].transform.x,
  39,
  "Напирающий боец продвигается вперёд, пока камера удерживает его в безопасной зоне",
);
const healthPressureSnapshot = JSON.parse(JSON.stringify(neutralPressureSnapshot));
healthPressureSnapshot.fighters[0].health = healthPressureSnapshot.fighters[0].maxHealth;
healthPressureSnapshot.fighters[1].health = healthPressureSnapshot.fighters[1].maxHealth * 0.5;
const healthPressureFrame = createVisualFrame(healthPressureSnapshot, standardInput, undefined, {
  presentation: PRESENTATIONS.mobile,
  rendererMode: RENDERER_MODES.assets,
});
assert.equal(healthPressureFrame.arena.initiativePressure, 0, "Равная инициатива не создаёт собственное давление");
assert.equal(healthPressureFrame.arena.healthPressure, 0.25, "Половина запаса здоровья даёт четверть визуального давления");
assert.equal(healthPressureFrame.arena.territoryOffset, 15, "Преимущество по здоровью умеренно сдвигает сцену");
assert.equal(PRESSURE_STEP_DISTANCE, 12, "Ходьба требует накопить полноценный шаг в двенадцать пикселей");
const minorPressureSnapshot = JSON.parse(JSON.stringify(neutralPressureSnapshot));
minorPressureSnapshot.fighters[0].initiative = 59;
const minorPressureFrame = createVisualFrame(minorPressureSnapshot, standardInput, undefined, {
  presentation: PRESENTATIONS.mobile,
  rendererMode: RENDERER_MODES.assets,
});
assert.equal(minorPressureFrame.arena.territoryOffset, 8, "Небольшое преимущество создаёт только желаемый сдвиг");
assert.equal(resolveTerritoryOffset(0, minorPressureFrame.arena.territoryOffset), 0, "Неполный шаг остаётся накопленным без движения");
const accumulatedPressureSnapshot = JSON.parse(JSON.stringify(neutralPressureSnapshot));
accumulatedPressureSnapshot.fighters[0].initiative = 68;
const accumulatedPressureFrame = createVisualFrame(accumulatedPressureSnapshot, standardInput, undefined, {
  presentation: PRESENTATIONS.mobile,
  rendererMode: RENDERER_MODES.assets,
});
assert.equal(accumulatedPressureFrame.arena.territoryOffset, 15, "Рост преимущества накапливает расстояние для полноценного шага");
assert.equal(resolveTerritoryOffset(0, accumulatedPressureFrame.arena.territoryOffset), 15, "Полный шаг фиксирует новую территорию");
const cameraBackground = { complete: true, naturalWidth: 360, naturalHeight: 560 };
let neutralBackgroundCrop = null;
let dominantBackgroundCrop = null;
BattleVisualEngine.prototype.drawArenaBackground.call(
  { loadAsset: () => cameraBackground },
  { drawImage: (...args) => { neutralBackgroundCrop = args; } },
  360,
  300,
  neutralPressureFrame,
);
BattleVisualEngine.prototype.drawArenaBackground.call(
  { loadAsset: () => cameraBackground },
  { drawImage: (...args) => { dominantBackgroundCrop = args; } },
  360,
  300,
  dominantPressureFrame,
);
assert.ok(neutralBackgroundCrop[3] < 360, "Overscan использует увеличенный горизонтальный фрагмент фона без пустых краёв");
assert.ok(dominantBackgroundCrop[1] > neutralBackgroundCrop[1], "При теснении вправо окно фона следует за боем вправо");
const heldMinorPressureFrame = createVisualFrame(minorPressureSnapshot, standardInput, undefined, {
  presentation: PRESENTATIONS.mobile,
  rendererMode: RENDERER_MODES.assets,
  territoryOffsetOverride: 0,
});
const skippedPressureMovement = BattleVisualEngine.prototype.createPressureMovementFrame.call({
  frame: neutralPressureFrame,
  spriteLibrary: new SpriteLibrary(),
  presentation: PRESENTATIONS.mobile,
  rendererMode: RENDERER_MODES.assets,
}, minorPressureSnapshot, standardInput, heldMinorPressureFrame);
assert.equal(skippedPressureMovement, null, "Неполный накопленный шаг не запускает анимацию ходьбы");
const pressureMovementFrame = BattleVisualEngine.prototype.createPressureMovementFrame.call({
  frame: neutralPressureFrame,
  spriteLibrary: new SpriteLibrary(),
  presentation: PRESENTATIONS.mobile,
  rendererMode: RENDERER_MODES.assets,
}, dominantPressureSnapshot, standardInput, dominantPressureFrame);
assert.equal(pressureMovementFrame.components[0].animation.clip, "advance", "Напирающий использует строку движения вперёд");
assert.equal(pressureMovementFrame.components[1].animation.clip, "retreat", "Уступающий использует строку движения назад");
assert.equal(pressureMovementFrame.components[0].motion.duration, 900, "Визуальное перемещение предшествует действию и длится 900 мс");
assert.equal(pressureMovementFrame.arena.cameraOffset, 21, "Фаза ходьбы переносит фон вместе с новой территорией");

const initialApproach = BattleVisualEngine.prototype.createInitialApproach.call({
  spriteLibrary: new SpriteLibrary(),
  presentation: PRESENTATIONS.mobile,
  rendererMode: RENDERER_MODES.assets,
}, neutralPressureSnapshot, standardInput);
const approachStartGap = initialApproach.startFrame.components[1].transform.x
  - initialApproach.startFrame.components[0].transform.x;
const approachEndGap = initialApproach.movementFrame.components[1].transform.x
  - initialApproach.movementFrame.components[0].transform.x;
assert.equal(approachStartGap, 204, "Сближение начинается с дальней позиции");
assert.equal(approachEndGap, 120, "Сближение заканчивается на дистанции удара");
assert.deepEqual(
  initialApproach.greetingFrame.components.map((component) => component.animation.clip),
  ["greeting", "greeting"],
  "Перед сближением оба гладиатора приветствуют друг друга",
);
assert.equal(initialApproach.greetingFrame.arena.positionStage, "entrance", "Приветствие проходит на стартовой дистанции");
assert.deepEqual(
  initialApproach.movementFrame.components.map((component) => component.animation.clip),
  ["advance", "advance"],
  "В начале боя оба гладиатора идут навстречу",
);
assert.equal(initialApproach.greetingFrame.components[0].motion.duration, 1400, "Приветствие остаётся заметным в течение 1400 мс");
assert.equal(initialApproach.movementFrame.components[0].motion.duration, 900, "Стартовое сближение проигрывается медленнее за 900 мс");

const finalSnapshot = standardResult.snapshots.at(-1);
if (finalSnapshot.outcome?.type === "victory") {
  const finalFrame = createVisualFrame(finalSnapshot, standardInput, undefined, {
    presentation: PRESENTATIONS.mobile,
    rendererMode: RENDERER_MODES.assets,
  });
  const winner = finalFrame.components.find((component) => component.fighterId === finalSnapshot.outcome.winnerId);
  assert.equal(winner.animation.clip, "victory", "Победитель поднимает меч только в итоговом снимке");
  assert.deepEqual(winner.animation.sheet.playback.repeat.sequence, [4, 5], "Победный салют удерживает только финальный двухкадровый цикл");
  assert.equal(winner.motion.duration, 860, "Победная строка проигрывается полностью");
  assert.equal(
    BattleVisualEngine.prototype.createRecoveryFrame.call({
      spriteLibrary: new SpriteLibrary(),
      presentation: PRESENTATIONS.mobile,
      rendererMode: RENDERER_MODES.assets,
    }, finalSnapshot, standardInput),
    null,
    "Итоговая победная поза не заменяется восстановительной стойкой",
  );
}

const swordsmanVictorySnapshot = JSON.parse(JSON.stringify(standardResult.snapshots[0]));
swordsmanVictorySnapshot.label = "Итог боя";
swordsmanVictorySnapshot.outcome = {
  type: "victory",
  winnerId: swordsmanVictorySnapshot.fighters[0].id,
};
const swordsmanVictoryFrame = createVisualFrame(swordsmanVictorySnapshot, standardInput, undefined, {
  presentation: PRESENTATIONS.mobile,
  rendererMode: RENDERER_MODES.assets,
});
const swordsmanWinner = swordsmanVictoryFrame.components.find(
  (component) => component.fighterId === swordsmanVictorySnapshot.outcome.winnerId,
);
assert.equal(swordsmanWinner.animation.clip, "victory", "Мечник использует победную строку");
assert.deepEqual(
  [0, 800, 860, 1003, 1146].map((elapsed) => animationFrameForElapsed(swordsmanWinner.animation.sheet, elapsed)),
  [0, 5, 4, 5, 4],
  "Победа один раз проходит кадры 0–5, затем чередует только 4 и 5",
);
assert.equal(
  swordsmanWinner.animation.renderScale,
  1.08,
  "Победный мечник получает явную коррекцию масштаба поверх атласа",
);
let victoryDrawArgs = null;
BattleVisualEngine.prototype.drawAsset.call({
  loadAsset: () => ({ complete: true, naturalWidth: 2304, naturalHeight: 5376 }),
  animationFrameColumn: () => 0,
}, {
  set filter(value) {},
  scale() {},
  drawImage(...args) { victoryDrawArgs = args; },
}, swordsmanWinner, 0, 0);
assert.equal(victoryDrawArgs[8], 243, "Победная ячейка мечника рисуется на 8% крупнее от линии стоп");

const retiariusVictorySnapshot = JSON.parse(JSON.stringify(standardResult.snapshots[0]));
retiariusVictorySnapshot.label = "Итог боя";
retiariusVictorySnapshot.outcome = {
  type: "victory",
  winnerId: retiariusVictorySnapshot.fighters[1].id,
};
const retiariusVictoryFrame = createVisualFrame(retiariusVictorySnapshot, standardInput, undefined, {
  presentation: PRESENTATIONS.mobile,
  rendererMode: RENDERER_MODES.assets,
});
const retiariusWinner = retiariusVictoryFrame.components.find(
  (component) => component.fighterId === retiariusVictorySnapshot.outcome.winnerId,
);
assert.equal(retiariusWinner.animation.clip, "victory", "Ретиарий использует собственную победную строку");
assert.equal(retiariusWinner.animation.renderScale, 0.77, "Крупная победная строка ретиария выравнивается с его обычным ростом");
assert.equal(swordsmanWinner.animation.renderScale, 1.08, "Коррекция победного размера мечника не изменилась");

const sandInput = JSON.parse(JSON.stringify(standardInput));
sandInput.arena.type = "sand";
const sandFrame = createVisualFrame(null, sandInput, undefined, {
  presentation: PRESENTATIONS.mobile,
  rendererMode: RENDERER_MODES.assets,
});
assert.equal(sandFrame.arena.assetPath, ARENA_BACKGROUNDS.sand.assetPath, "Песчаная арена получает самостоятельный фон");
assert.equal(sandFrame.arena.ambientLights.length, 7, "Песчаная арена передаёт ряд небольших источников света");
assert.equal(sandFrame.arena.crowdMotion.length, 0, "Песчаная арена не получает слой зрителей новой арены");
const closedInput = JSON.parse(JSON.stringify(standardInput));
closedInput.arena.type = "normal";
const closedFrame = createVisualFrame(null, closedInput, undefined, {
  presentation: PRESENTATIONS.mobile,
  rendererMode: RENDERER_MODES.assets,
});
assert.equal(closedFrame.arena.assetPath, ARENA_BACKGROUNDS.normal.assetPath, "Прежний каменный фон сохранён как закрытая арена");
assert.equal(closedFrame.arena.crowdMotion.length, 0, "Закрытая арена не имитирует движение толпы");
const loadedBackground = { complete: true, naturalWidth: 360, naturalHeight: 560 };
const lightRenderer = { loadAsset: () => loadedBackground };
const crowdLights = BattleVisualEngine.prototype.arenaLightSprites.call(
  lightRenderer,
  360,
  300,
  standardMobileFrame,
  0,
);
assert.equal(crowdLights.length, 2, "Оба видимых факела новой арены получают пиксельные спрайты");
assert.deepEqual(crowdLights.map((light) => light.y), [164, 164], "Координаты огня проходят тот же вертикальный crop, что и новый фон");
assert.notEqual(crowdLights[0].pulse, crowdLights[1].pulse, "Разные фазы не дают факелам мерцать синхронно");
const crowdRenderer = { loadAsset: () => loadedBackground };
const crowdAtRest = BattleVisualEngine.prototype.arenaCrowdSprites.call(
  crowdRenderer,
  360,
  300,
  standardMobileFrame,
  0,
);
const crowdLater = BattleVisualEngine.prototype.arenaCrowdSprites.call(
  crowdRenderer,
  360,
  300,
  standardMobileFrame,
  900,
);
assert.ok(crowdAtRest.length >= 15, "Сдвинутая камера сохраняет почти весь процедурный слой зрителей в кадре");
assert.notDeepEqual(crowdLater, crowdAtRest, "Зрители слегка покачиваются и иногда поднимают руки");
const sandLights = BattleVisualEngine.prototype.arenaLightSprites.call(
  lightRenderer,
  360,
  300,
  sandFrame,
  500,
);
assert.equal(sandLights.length, 7, "Все огни песчаной арены остаются внутри видимого фрагмента");
assert.ok(sandLights.every((light) => light.y >= 9 && light.y <= 12), "Малые огни располагаются вдоль верхней стены сцены");

const blockSnapshot = JSON.parse(JSON.stringify(standardResult.snapshots[0]));
blockSnapshot.fighters[1].fatigue = 75;
blockSnapshot.lastAction = {
  actorId: blockSnapshot.fighters[0].id,
  targetId: blockSnapshot.fighters[1].id,
  attackType: "standard",
  outcome: "block",
};
const blockFrame = createVisualFrame(blockSnapshot, standardInput, undefined, {
  presentation: PRESENTATIONS.mobile,
  rendererMode: RENDERER_MODES.assets,
});
const blockingFighter = blockFrame.components.find((component) => component.fighterId === blockSnapshot.lastAction.targetId);
const attackingFighter = blockFrame.components.find((component) => component.fighterId === blockSnapshot.lastAction.actorId);
assert.equal(attackingFighter.animation.clip, "attack", "Атакующий в снимке боя использует строку атаки");
assert.equal(blockingFighter.animation.clip, "defense.block", "Заблокировавший удар использует строку блока");
assert.equal(blockingFighter.motion.duration, 300, "Блок в симуляторе завершается за 300 мс");
const frameFor = BattleVisualEngine.prototype.animationFrameColumn;
assert.equal(frameFor.call(null, blockingFighter, 0.6, 310), 5, "Блок уже удерживает защиту после 300 мс");
assert.ok(frameFor.call(null, attackingFighter, 0.6, 310) < 5, "Атака в тот же момент ещё продолжается");
const missSnapshot = JSON.parse(JSON.stringify(blockSnapshot));
missSnapshot.lastAction.outcome = "miss";
const missFrame = createVisualFrame(missSnapshot, standardInput, undefined, {
  presentation: PRESENTATIONS.mobile,
  rendererMode: RENDERER_MODES.assets,
});
const missedFighter = missFrame.components.find(
  (component) => component.fighterId === missSnapshot.lastAction.targetId,
);
assert.equal(missedFighter.animation.clip, "defense.miss", "Цель промаха получает отдельный короткий уход");
assert.equal(missedFighter.motion.duration, 280, "Короткий уход завершается за 280 мс");
assert.equal(frameFor.call(null, missedFighter, 0.5, 140), 2, "В середине реакции используется только неглубокий кадр уклонения");
assert.equal(frameFor.call(null, missedFighter, 1, 280), 0, "Реакция на промах возвращает бойца в исходную позу");
const recoveryContext = {
  spriteLibrary: new SpriteLibrary(),
  presentation: PRESENTATIONS.mobile,
  rendererMode: RENDERER_MODES.assets,
};
const recoveryFrame = BattleVisualEngine.prototype.createRecoveryFrame.call(
  recoveryContext,
  blockSnapshot,
  standardInput,
);
const recoveredTarget = recoveryFrame.components.find(
  (component) => component.fighterId === blockSnapshot.lastAction.targetId,
);
assert.equal(recoveryFrame.action, null, "После одноразового действия визуальный кадр очищает действие");
assert.equal(recoveredTarget.animation.clip, "idle.tired", "После блока боец возвращается в актуальную уставшую стойку");
assert.equal(recoveredTarget.animation.sheet.playback.repeat.keepAlive, true, "Стойка продолжает проигрываться до следующего снимка боя");

const defeatedSnapshot = JSON.parse(JSON.stringify(blockSnapshot));
defeatedSnapshot.fighters[1].health = 0;
const defeatedRecoveryFrame = BattleVisualEngine.prototype.createRecoveryFrame.call(
  recoveryContext,
  defeatedSnapshot,
  standardInput,
);
const defeatedTarget = defeatedRecoveryFrame.components.find(
  (component) => component.fighterId === defeatedSnapshot.lastAction.targetId,
);
assert.equal(defeatedTarget.animation.clip, "defeated", "Поверженный боец не возвращается из смерти в стойку");
assert.equal(defeatedTarget.animation.sheet.playback.repeat, null, "Смерть остаётся на финальном кадре");
assert.equal(
  frameFor.call(null, defeatedTarget, 0, 0),
  defeatedTarget.animation.sheet.frames.at(-1),
  "Нулевая длительность смерти показывает финальный, а не первый кадр",
);
const actionMobileFrame = createVisualFrame(actionSnapshot, standardInput, undefined, {
  presentation: PRESENTATIONS.mobile,
  rendererMode: RENDERER_MODES.assets,
});
const actionActor = actionMobileFrame.components.find((component) => component.id === `${actionSnapshot.lastAction.actorId}:fighter`);
assert.equal(Math.abs(actionActor.motion.x), 12, "Во время удара атакующий сближается с целью на 12 px");
assert.equal(actionActor.motion.returnToOrigin, true, "После выпада атакующий плавно возвращается к боевой позиции");
const swordsmanSpecialSnapshot = JSON.parse(JSON.stringify(standardResult.snapshots[0]));
swordsmanSpecialSnapshot.lastAction = {
  actorId: swordsmanSpecialSnapshot.fighters[0].id,
  targetId: swordsmanSpecialSnapshot.fighters[1].id,
  attackType: "achilles-leap",
  outcome: "hit",
};
const swordsmanSpecialFrame = createVisualFrame(swordsmanSpecialSnapshot, standardInput, undefined, {
  presentation: PRESENTATIONS.mobile,
  rendererMode: RENDERER_MODES.assets,
});
const swordsmanSpecialActor = swordsmanSpecialFrame.components.find(
  (component) => component.fighterId === swordsmanSpecialSnapshot.lastAction.actorId,
);
assert.equal(swordsmanSpecialActor.animation.clip, "special", "Прыжок Ахилла использует отдельную строку особого удара");
assert.equal(Math.abs(swordsmanSpecialActor.motion.x), 14, "Силовой особый удар получает отдельный короткий выпад");
const murmilloTechniqueInput = createDefaultBattleInput();
murmilloTechniqueInput.fighters[0].fighterClass = "murmillo";
murmilloTechniqueInput.fighters[0].equipment = {
  weaponSet: { definitionId: "murmillo-arms.good" },
  armorSet: { definitionId: "murmillo-armor.good" },
};
murmilloTechniqueInput.seed = "shield-0";
murmilloTechniqueInput.fighters.forEach((fighter) => { fighter.base.health = 300; });
murmilloTechniqueInput.fighters[0].classTechniqueChance = 1;
const murmilloTechniqueResult = new BattleEngine(murmilloTechniqueInput).simulate();
const murmilloTechniqueSnapshot = murmilloTechniqueResult.snapshots.find((snapshot) => (
  snapshot.lastAction?.classTechnique === "weapon.murmillo-shield-advance"
));
assert.ok(murmilloTechniqueSnapshot, "Движок создаёт отдельный снимок ответного приёма Мурмиллона");
const murmilloTechniqueFrame = createVisualFrame(murmilloTechniqueSnapshot, murmilloTechniqueInput, undefined, {
  presentation: PRESENTATIONS.mobile,
  rendererMode: RENDERER_MODES.assets,
});
const murmilloTechniqueActor = murmilloTechniqueFrame.components.find((component) => (
  component.fighterId === murmilloTechniqueSnapshot.lastAction.actorId
));
assert.equal(murmilloTechniqueActor.animation.clip, "special", "Ответный приём Мурмиллона использует строку special");
assert.equal(murmilloTechniqueActor.animation.sheet.row, 10, "Классовый приём мечника проигрывает всю одиннадцатую строку атласа");
const retiariusSpecialSnapshot = JSON.parse(JSON.stringify(standardResult.snapshots[0]));
retiariusSpecialSnapshot.lastAction = {
  actorId: retiariusSpecialSnapshot.fighters[1].id,
  targetId: retiariusSpecialSnapshot.fighters[0].id,
  classTechnique: "weapon.retiarius-net-cast",
  outcome: "hit",
};
const retiariusSpecialFrame = createVisualFrame(retiariusSpecialSnapshot, standardInput, undefined, {
  presentation: PRESENTATIONS.mobile,
  rendererMode: RENDERER_MODES.assets,
});
const retiariusSpecialActor = retiariusSpecialFrame.components.find(
  (component) => component.fighterId === retiariusSpecialSnapshot.lastAction.actorId,
);
assert.equal(retiariusSpecialActor.animation.clip, "special", "Перехват сетью использует отдельную строку ретиария");
assert.equal(Math.abs(retiariusSpecialActor.motion.x), 0, "Бросок сети не сдвигает ретиария дополнительным выпадом");
assert.equal(retiariusSpecialFrame.action.classTechnique, "weapon.retiarius-net-cast", "Визуальный кадр сохраняет доменный id классового приёма");
const criticalSnapshot = JSON.parse(JSON.stringify(actionSnapshot));
criticalSnapshot.lastAction = {
  ...criticalSnapshot.lastAction,
  outcome: "hit",
  critical: true,
  impact: "critical",
};
const criticalFrame = createVisualFrame(criticalSnapshot, standardInput, undefined, {
  presentation: PRESENTATIONS.mobile,
  rendererMode: RENDERER_MODES.assets,
});
assert.equal(criticalFrame.action.critical, true, "Визуальный кадр сохраняет признак критического попадания");
assert.equal(criticalFrame.action.impact, "critical", "Категория критического удара доступна эффектам Canvas");
const bloodFrameFor = (impact, critical = false, outcome = "hit") => {
  const snapshot = JSON.parse(JSON.stringify(criticalSnapshot));
  snapshot.lastAction.critical = critical;
  snapshot.lastAction.impact = impact;
  snapshot.lastAction.outcome = outcome;
  return createVisualFrame(snapshot, standardInput, undefined, {
    presentation: PRESENTATIONS.mobile,
    rendererMode: RENDERER_MODES.assets,
  });
};
const bloodAt = (frame, progress) => BattleVisualEngine.prototype.bloodParticles.call(null, frame, progress);
const lightBlood = bloodAt(bloodFrameFor("light"), 0.65);
const normalBlood = bloodAt(bloodFrameFor("normal"), 0.65);
const strongBlood = bloodAt(bloodFrameFor("strong"), 0.65);
const criticalBlood = bloodAt(criticalFrame, 0.65);
const enhancedBlood = bloodAt(enhancedBuffFrame, 0.23);
assert.ok(lightBlood.length > 0, "Даже лёгкое успешное попадание создаёт немного крови");
assert.ok(
  lightBlood.length < normalBlood.length
    && normalBlood.length < strongBlood.length
    && strongBlood.length < criticalBlood.length,
  "Количество крови последовательно растёт от лёгкого удара к критическому",
);
assert.ok(criticalBlood.length >= 30, "Критический удар создаёт особенно плотный веер крови");
assert.ok(criticalBlood.some((particle) => particle.size >= 11), "Крит содержит увеличенные крупные сгустки");
assert.ok(enhancedBlood.length > criticalBlood.length, "Усиленный классовый удар создаёт больше крови, чем критический");
const enhancedBloodTarget = enhancedBuffFrame.components.find((component) => (
  component.kind === "fighter" && component.fighterId === enhancedBuffFrame.action.targetId
));
const enhancedBodyTop = enhancedBloodTarget.transform.y - enhancedBloodTarget.animation.assetHeight * 0.8;
const enhancedBodyBottom = enhancedBloodTarget.transform.y - enhancedBloodTarget.animation.assetHeight * 0.15;
assert.ok(
  enhancedBlood.filter((particle) => particle.y >= enhancedBodyTop && particle.y <= enhancedBodyBottom).length
    >= enhancedBlood.length * 0.8,
  "Основная масса крови усиленного удара остаётся на уровне корпуса поражённого бойца",
);
const enhancedBloodFallen = bloodAt(enhancedBuffFrame, 0.58);
assert.ok(
  enhancedBloodFallen.filter((particle) => particle.y >= enhancedBuffFrame.arena.groundY - 6).length
    >= enhancedBloodFallen.length * 0.7,
  "После быстрого распыления кровь усиленного удара падает к земле",
);
assert.ok(
  criticalBlood.every((particle) => /^#(?:26|3a|4f|61|70)/i.test(particle.color)),
  "Вся кровь использует тёмную бордовую палитру",
);
assert.deepEqual(
  [
    bloodAt(bloodFrameFor("light"), 0.95).length,
    bloodAt(bloodFrameFor("normal"), 0.95).length,
    bloodAt(bloodFrameFor("strong"), 0.95).length,
    bloodAt(criticalFrame, 0.95).length,
  ],
  [7, 14, 26, 43],
  "У каждого уровня попадания стало немного больше брызг",
);
assert.equal(bloodAt(enhancedBuffFrame, 0.95).length, 86, "Усиленный удар создаёт двойной плотный выброс крови");
assert.ok(
  criticalBlood.some((particle) => particle.x < particle.originX)
    && criticalBlood.some((particle) => particle.x > particle.originX),
  "При крите частицы разлетаются в обе стороны от точки попадания",
);
const criticalEarlyDrop = bloodAt(criticalFrame, 0.45).find((particle) => particle.sourceIndex === 0);
const criticalLateDrop = bloodAt(criticalFrame, 0.95).find((particle) => particle.sourceIndex === 0);
assert.ok(criticalLateDrop.y > criticalEarlyDrop.y, "Гравитация опускает каплю после верхней точки траектории");
assert.deepEqual(bloodAt(bloodFrameFor(null, false, "miss"), 0.65), [], "Промах не создаёт кровь");
const stainRenderer = {
  canvas: { width: 360 },
  bloodStains: [],
  bloodStainKeys: new Set(),
};
const recordedStains = BattleVisualEngine.prototype.recordBloodStains.call(
  stainRenderer,
  criticalFrame,
  "critical-hit:1",
  1000,
  0,
);
assert.equal(recordedStains.length, 7, "Крит оставляет на полу заметную группу пятен");
assert.equal(recordedStains[0].width, 12, "Напольные пятна увеличены на 20 процентов");
assert.equal(recordedStains[0].lifetime, 3120, "Напольные пятна исчезают на 20 процентов дольше");
assert.deepEqual(
  BattleVisualEngine.prototype.recordBloodStains.call(stainRenderer, criticalFrame, "critical-hit:1", 1000, 0),
  [],
  "Повторная отрисовка одного снимка не дублирует пятна",
);
const freshStains = BattleVisualEngine.prototype.bloodStainSprites.call(stainRenderer, initialFrame, 1400);
const darkenedStains = BattleVisualEngine.prototype.bloodStainSprites.call(stainRenderer, initialFrame, 2600);
const redChannel = (stain) => Number(stain.color.match(/\d+/)?.[0]);
assert.equal(freshStains.length, 7, "Пятна сохраняются после перехода к стойке без lastAction");
assert.ok(redChannel(darkenedStains[0]) < redChannel(freshStains[0]), "Кровь на полу постепенно темнеет");
assert.ok(darkenedStains[0].alpha < freshStains[0].alpha, "Пятно постепенно становится прозрачнее");
assert.deepEqual(
  BattleVisualEngine.prototype.bloodStainSprites.call(stainRenderer, initialFrame, 5500),
  [],
  "Старые пятна полностью исчезают примерно через четыре секунды",
);
assert.equal(initialFrame.presentation, PRESENTATIONS.mobile, "Визуальный движок больше не создаёт отладочную Canvas-презентацию");
assert.equal(
  mobileFrame.components[0].transform.scale,
  initialFrame.components[0].transform.scale,
  "По умолчанию визуальный кадр использует мобильную сцену",
);

const skeletalFrame = createSkeletalFrame(result.snapshots[0], input);
assert.equal(skeletalFrame.rigs.length, 2, "Pixi-предпросмотр получает два независимых скелетных рига");
assert.equal(skeletalFrame.rigs[0].weaponSkinId, "spear", "Скелетный риг получает скин оружия отдельно от тела");
assert.equal(skeletalFrame.rigs[0].state, "idle.normal", "Скелетный адаптер выводит состояние из снимка боя");

console.log("OK: visual frame resolves baked swordsman and retiarius sprites");
