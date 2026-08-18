import assert from "node:assert/strict";
import "./reference-data.js";
import "./battle-engine.js";
import "./sprite-library.js";
import "./visual-engine.js";
import "./pixi-skeletal-engine.js";

const { BattleEngine, createDefaultBattleInput } = globalThis.GladiatorBattle;
const { BODY_ANIMATION_GRIDS, WEAPON_SKINS, OVERLAY_ATLAS } = globalThis.GladiatorSpriteLibrary;
const { PRESENTATIONS, RENDERER_MODES, createVisualFrame } = globalThis.GladiatorVisualEngine;
const { createSkeletalFrame } = globalThis.GladiatorPixiSkeletal;

const input = createDefaultBattleInput();
input.fighters[0].visual = { skinId: "arena-gold", weaponSkinId: "spear" };
const inputBeforeRender = JSON.stringify(input);
const result = new BattleEngine(input).simulate();
const snapshotBeforeRender = JSON.stringify(result.snapshots[0]);
const initialFrame = createVisualFrame(result.snapshots[0], input);

assert.equal(initialFrame.components.length, 4, "На двух бойцов приходится по телу и оружию");
assert.deepEqual(
  initialFrame.components.map((component) => component.kind),
  ["fighter", "weapon", "fighter", "weapon"],
);
assert.equal(initialFrame.components[0].skinId, "arena-gold", "Скин берётся из визуального входа, а не из боя");
assert.equal(initialFrame.components[1].skinId, "spear", "Оружейный скин заменяется без правки правил боя");
assert.equal(JSON.stringify(input), inputBeforeRender, "Визуальный адаптер не меняет вход симуляции");
assert.equal(JSON.stringify(result.snapshots[0]), snapshotBeforeRender, "Визуальный адаптер не меняет снимок боя");

const actionSnapshot = result.snapshots.find((snapshot) => snapshot.lastAction?.actorId);
const actionFrame = createVisualFrame(actionSnapshot, input);
const actorWeapon = actionFrame.components.find((component) => component.id === `${actionSnapshot.lastAction.actorId}:weapon`);
assert.ok(actorWeapon.motion.duration > 0, "Действие боя должно стать движением визуального компонента");
assert.ok(Object.isFrozen(actionFrame), "Кадр реплея неизменяем");

const mobileFrame = createVisualFrame(result.snapshots[0], input, undefined, {
  presentation: PRESENTATIONS.mobile,
  rendererMode: RENDERER_MODES.assets,
});
assert.equal(mobileFrame.presentation, "mobile", "Мобильная сцена должна иметь отдельную презентацию");
assert.equal(mobileFrame.rendererMode, "assets", "Режим ассетов переключается только в визуальном слое");
assert.equal(mobileFrame.components[0].assetPath, "./assets/murmillo-body-overlay-grid-v3.png");
assert.equal(mobileFrame.components[0].animation.bodyGridId, "murmillo-body-overlay-v3");
assert.equal(mobileFrame.components[0].animation.equipmentProfileId, "murmillo-armor", "Профиль поз берётся из комплекта брони");
assert.equal(mobileFrame.components[0].animation.state, "idle.normal");
assert.equal(mobileFrame.components[0].animation.weaponBakedIn, false, "Оружие не является частью листа тела");
assert.equal(mobileFrame.components[1].attachment.socket, "hand.primary", "Оружие должно крепиться к сокету тела, а не быть частью body-grid");
assert.equal(OVERLAY_ATLAS.cellWidth, 256, "Все слои overlay используют одну ширину кадра");
assert.equal(OVERLAY_ATLAS.cellHeight, 256, "Все слои overlay используют одну высоту кадра");
assert.equal(BODY_ANIMATION_GRIDS["murmillo-body-overlay-v3"].grid.columns, 6);
assert.equal(BODY_ANIMATION_GRIDS["murmillo-body-overlay-v3"].clips.attack.frames.length, 6, "Атака занимает всю строку из шести кадров");
assert.equal(BODY_ANIMATION_GRIDS["murmillo-body-overlay-v3"].clips.attack.row, 3, "Атака использует собственную строку атласа");
assert.equal(BODY_ANIMATION_GRIDS["murmillo-body-overlay-v3"].clips["idle.normal"].loop, true, "Стойка должна быть циклической анимацией");
assert.equal(mobileFrame.components[1].animation, null, "Нестандартное оружие без листа не зависит от тела");
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
assert.equal(standardMobileFrame.components[1].assetPath, WEAPON_SKINS.sword.assetPath, "Гладиус остаётся отдельным компонентом оружия");
assert.equal(standardMobileFrame.components[1].animation.sheet.columns, 6, "Оружие использует ту же сетку 6×7, что и тело");
assert.equal(standardMobileFrame.components[1].attachment.mode, "frame-overlay", "Клинок накладывается трафаретом по кадрам тела, а не привязан к сокету");
assert.equal(standardMobileFrame.components[0].animation.mirrored, false, "Левый боец смотрит в центр без отражения исходного листа");
assert.equal(standardMobileFrame.components[2].animation.bodyGridId, "retiarius-body-overlay-v4", "Ретиарий получает отдельное тело без оружия");
assert.equal(standardMobileFrame.components[3].skinId, "trident", "Ретиарий получает отдельный слой трезубца");
assert.equal(standardMobileFrame.components[3].attachment.socket, "hand.rear", "Трезубец регистрируется по хвату задней руки");
assert.equal(standardMobileFrame.components[1].animation.layerByFrame[0], "behind", "Тело мурмиллона рисуется над мечом");
assert.equal(BODY_ANIMATION_GRIDS["retiarius-body-overlay-v4"].weaponLayers.attack[2], "front", "Глубина оружия может меняться в отдельном кадре");
assert.equal(standardMobileFrame.components[2].animation.mirrored, true, "Правый боец зеркалит исходный правый лист");
assert.equal(standardMobileFrame.components[0].transform.y, standardMobileFrame.arena.groundY, "Ноги спрайта стоят на линии земли");
assert.equal(standardMobileFrame.components[0].animation.assetHeight, 170, "Ассет помещается в безопасную область мобильной сцены");
const actionMobileFrame = createVisualFrame(actionSnapshot, standardInput, undefined, {
  presentation: PRESENTATIONS.mobile,
  rendererMode: RENDERER_MODES.assets,
});
const actionActor = actionMobileFrame.components.find((component) => component.id === `${actionSnapshot.lastAction.actorId}:fighter`);
assert.equal(actionActor.motion.x, 0, "Покадровая атака не сдвигает весь спрайт и не обрезается сценой");
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

console.log("OK: visual frame has isolated fighter and weapon components");
