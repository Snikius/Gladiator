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
  SpriteLibrary,
  UNIFIED_ATLAS,
  UNIFIED_SWORDSMAN_GRID_ID,
} = globalThis.GladiatorSpriteLibrary;
const {
  BattleVisualEngine,
  INJURED_HEALTH_RATIO,
  POSITION_STAGES,
  PRESENTATIONS,
  RENDERER_MODES,
  createVisualFrame,
} = globalThis.GladiatorVisualEngine;
const { createSkeletalFrame } = globalThis.GladiatorPixiSkeletal;

const input = createDefaultBattleInput();
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

const mobileFrame = createVisualFrame(result.snapshots[0], input, undefined, {
  presentation: PRESENTATIONS.mobile,
  rendererMode: RENDERER_MODES.assets,
});
assert.equal(mobileFrame.presentation, "mobile", "Мобильная сцена должна иметь отдельную презентацию");
assert.equal(mobileFrame.rendererMode, "assets", "Режим ассетов переключается только в визуальном слое");
assert.equal(mobileFrame.components[0].assetPath, "./assets/unified-swordsman-grid-v8.png");
assert.equal(mobileFrame.components[0].animation.bodyGridId, UNIFIED_SWORDSMAN_GRID_ID);
assert.equal(mobileFrame.components[0].animation.equipmentProfileId, "murmillo-armor", "Профиль поз берётся из комплекта брони");
assert.equal(mobileFrame.components[0].animation.state, "idle.normal");
assert.equal(mobileFrame.components[0].animation.weaponBakedIn, true, "Меч является частью единого листа бойца");
assert.equal(UNIFIED_ATLAS.cellWidth, 256, "Единый лист использует ширину кадра 256 px");
assert.equal(UNIFIED_ATLAS.cellHeight, 256, "Единый лист использует высоту кадра 256 px");
assert.equal(UNIFIED_ATLAS.rows, 10, "Единый лист содержит движение, приветствие и победу");
assert.equal(BODY_ANIMATION_GRIDS[UNIFIED_SWORDSMAN_GRID_ID].grid.columns, 6);
assert.equal(BODY_ANIMATION_GRIDS[UNIFIED_SWORDSMAN_GRID_ID].clips.attack.frames.length, 6, "Атака занимает всю строку из шести кадров");
assert.equal(BODY_ANIMATION_GRIDS[UNIFIED_SWORDSMAN_GRID_ID].clips.attack.row, 3, "Атака использует собственную строку атласа");
assert.equal(BODY_ANIMATION_GRIDS[UNIFIED_SWORDSMAN_GRID_ID].clips["idle.normal"].loop, true, "Стойка должна быть циклической анимацией");
assert.equal(BODY_ANIMATION_GRIDS[UNIFIED_SWORDSMAN_GRID_ID].clips["defense.block"].fps, 20, "Блок должен быстро поднимать защиту");
assert.deepEqual(BODY_ANIMATION_GRIDS[UNIFIED_SWORDSMAN_GRID_ID].clips["reaction.hit"].frames, [0, 1, 2, 1, 0], "Реакция на удар не захватывает кадры падения");
assert.equal(BODY_ANIMATION_GRIDS[UNIFIED_SWORDSMAN_GRID_ID].clips.advance.row, 7, "Движение использует отдельную восьмую строку");
assert.deepEqual(BODY_ANIMATION_GRIDS[UNIFIED_SWORDSMAN_GRID_ID].clips.retreat.frames, [5, 4, 3, 2, 1, 0], "Движение назад переиспользует строку в обратном порядке");
assert.equal(BODY_ANIMATION_GRIDS[UNIFIED_SWORDSMAN_GRID_ID].clips.greeting.row, 8, "Приветствие занимает отдельную девятую строку");
assert.equal(BODY_ANIMATION_GRIDS[UNIFIED_SWORDSMAN_GRID_ID].clips.greeting.loop, false, "Приветствие проигрывается один раз");
assert.equal(BODY_ANIMATION_GRIDS[UNIFIED_SWORDSMAN_GRID_ID].clips.victory.row, 9, "Победа занимает отдельную десятую строку");
assert.equal(BODY_ANIMATION_GRIDS[UNIFIED_SWORDSMAN_GRID_ID].clips.victory.loop, false, "Победа удерживает последний кадр, а не зацикливается");
const standardInput = createDefaultBattleInput();
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
assert.equal(standardMobileFrame.components[1].animation.bodyGridId, UNIFIED_SWORDSMAN_GRID_ID, "Ретиарий временно использует тот же лист мечника");
assert.equal(standardMobileFrame.components[1].assetPath, standardMobileFrame.components[0].assetPath, "Все классы используют один ассет");
assert.equal(standardMobileFrame.components[1].animation.weaponSkinId, "sword", "Ретиарий временно отображается мечником");
assert.equal(standardMobileFrame.components[1].animation.assetHeight, 150, "Оба бойца имеют одинаковый визуальный масштаб");
assert.equal(standardMobileFrame.components[1].transform.x - standardMobileFrame.components[0].transform.x, 128, "Бойцы стоят ближе для ближнего боя");
assert.equal(standardMobileFrame.components[1].animation.mirrored, true, "Правый боец зеркалит единый исходный лист");
assert.equal(
  standardMobileFrame.components[0].transform.y
    - standardMobileFrame.components[0].animation.assetHeight * BODY_ANIMATION_GRIDS[UNIFIED_SWORDSMAN_GRID_ID].baselineInset,
  standardMobileFrame.arena.groundY,
  "Ноги спрайта стоят на линии земли",
);
assert.equal(standardMobileFrame.components[0].animation.assetHeight, 150, "Ассет помещается в компактную игровую сцену");
assert.equal(standardMobileFrame.arena.assetPath, ARENA_BACKGROUNDS.normal.assetPath, "Обычная арена получает каменный фон из библиотеки визуала");
assert.equal(standardMobileFrame.arena.groundY, 280, "Линия ног помещается в компактный Canvas высотой 300 px");
assert.equal(standardMobileFrame.arena.sourceGroundY, 500, "Фон обрезается с сохранением исходной линии земли");
assert.equal(INJURED_HEALTH_RATIO, 0.45, "Порог раненой стойки зафиксирован на 45% здоровья");
const injuredHealthSnapshot = JSON.parse(JSON.stringify(standardResult.snapshots[0]));
injuredHealthSnapshot.lastAction = null;
injuredHealthSnapshot.fighters[0].health = injuredHealthSnapshot.fighters[0].maxHealth * 0.44;
injuredHealthSnapshot.fighters[0].fatigue = 90;
const injuredHealthFrame = createVisualFrame(injuredHealthSnapshot, standardInput, undefined, {
  presentation: PRESENTATIONS.mobile,
  rendererMode: RENDERER_MODES.assets,
});
assert.equal(injuredHealthFrame.components[0].animation.clip, "idle.injured", "Ниже 45% здоровья включается раненая стойка даже при высокой усталости");
const thresholdHealthSnapshot = JSON.parse(JSON.stringify(injuredHealthSnapshot));
thresholdHealthSnapshot.fighters[0].health = thresholdHealthSnapshot.fighters[0].maxHealth * 0.45;
thresholdHealthSnapshot.fighters[0].fatigue = 0;
const thresholdHealthFrame = createVisualFrame(thresholdHealthSnapshot, standardInput, undefined, {
  presentation: PRESENTATIONS.mobile,
  rendererMode: RENDERER_MODES.assets,
});
assert.equal(thresholdHealthFrame.components[0].animation.clip, "idle.normal", "Ровно 45% ещё относится к обычной стойке");

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
assert.equal(dominantPressureFrame.arena.territoryOffset, 32, "Преимущество первого бойца сильнее сдвигает бой к правому краю");
assert.equal(
  dominantPressureFrame.components[0].transform.x - neutralPressureFrame.components[0].transform.x,
  32,
  "Напирающий боец визуально продвигается вперёд",
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
assert.equal(healthPressureFrame.arena.territoryOffset, 8, "Преимущество по здоровью умеренно сдвигает сцену");
const pressureMovementFrame = BattleVisualEngine.prototype.createPressureMovementFrame.call({
  frame: neutralPressureFrame,
  spriteLibrary: new SpriteLibrary(),
  presentation: PRESENTATIONS.mobile,
  rendererMode: RENDERER_MODES.assets,
}, dominantPressureSnapshot, standardInput, dominantPressureFrame);
assert.equal(pressureMovementFrame.components[0].animation.clip, "advance", "Напирающий использует строку движения вперёд");
assert.equal(pressureMovementFrame.components[1].animation.clip, "retreat", "Уступающий использует строку движения назад");
assert.equal(pressureMovementFrame.components[0].motion.duration, 900, "Визуальное перемещение предшествует действию и длится 900 мс");

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
assert.equal(approachEndGap, 128, "Сближение заканчивается на дистанции удара");
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

const sandInput = JSON.parse(JSON.stringify(standardInput));
sandInput.arena.type = "sand";
const sandFrame = createVisualFrame(null, sandInput, undefined, {
  presentation: PRESENTATIONS.mobile,
  rendererMode: RENDERER_MODES.assets,
});
assert.equal(sandFrame.arena.assetPath, ARENA_BACKGROUNDS.sand.assetPath, "Песчаная арена получает самостоятельный фон");

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
const frameIndexFor = BattleVisualEngine.prototype.animationFrameIndex;
assert.equal(frameIndexFor.call(null, blockingFighter, 0.6, 310), 5, "Блок уже удерживает защиту после 300 мс");
assert.ok(frameIndexFor.call(null, attackingFighter, 0.6, 310) < 5, "Атака в тот же момент ещё продолжается");
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
assert.equal(recoveredTarget.animation.sheet.loop, true, "Стойка продолжает проигрываться до следующего снимка боя");

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
assert.equal(defeatedTarget.animation.sheet.loop, false, "Смерть остаётся на финальном кадре");
assert.equal(
  frameIndexFor.call(null, defeatedTarget, 0, 0),
  defeatedTarget.animation.sheet.frames.length - 1,
  "Нулевая длительность смерти показывает финальный, а не первый кадр",
);
const actionMobileFrame = createVisualFrame(actionSnapshot, standardInput, undefined, {
  presentation: PRESENTATIONS.mobile,
  rendererMode: RENDERER_MODES.assets,
});
const actionActor = actionMobileFrame.components.find((component) => component.id === `${actionSnapshot.lastAction.actorId}:fighter`);
assert.equal(Math.abs(actionActor.motion.x), 12, "Во время удара атакующий сближается с целью на 12 px");
assert.equal(actionActor.motion.returnToOrigin, true, "После выпада атакующий плавно возвращается к боевой позиции");
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
const bloodParticles = BattleVisualEngine.prototype.criticalBloodParticles.call(null, criticalFrame, 0.65);
assert.ok(bloodParticles.length >= 6, "В середине критического удара рисуется веер капель крови");
assert.ok(bloodParticles.every((particle) => particle.alpha > 0 && particle.size >= 2), "Частицы остаются пиксельными и видимыми");
const nonCriticalSnapshot = JSON.parse(JSON.stringify(criticalSnapshot));
nonCriticalSnapshot.lastAction.critical = false;
nonCriticalSnapshot.lastAction.impact = "normal";
const nonCriticalFrame = createVisualFrame(nonCriticalSnapshot, standardInput, undefined, {
  presentation: PRESENTATIONS.mobile,
  rendererMode: RENDERER_MODES.assets,
});
assert.deepEqual(
  BattleVisualEngine.prototype.criticalBloodParticles.call(null, nonCriticalFrame, 0.65),
  [],
  "Обычный удар не создаёт кровь критического эффекта",
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

console.log("OK: visual frame uses one baked swordsman sprite per fighter");
