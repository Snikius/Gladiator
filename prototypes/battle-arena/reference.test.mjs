import assert from "node:assert/strict";
import "./reference-data.js";

const {
  classes, weapons, armor, perks, qualities, weaponItems, armorItems,
} = globalThis.GladiatorReferenceData;

assert.equal(classes.length, 5, "Справочник должен содержать пять классов");
assert.equal(weapons.length, 5, "Каждому классу нужен оружейный комплект");
assert.equal(armor.length, 5, "Каждому классу нужен комплект доспехов");
assert.equal(weaponItems.length, 20, "Нужно четыре экземпляра оружия для каждого класса");
assert.equal(armorItems.length, 20, "Нужно четыре экземпляра доспехов для каждого класса");

const classIds = new Set(classes.map((item) => item.id));
const perkIds = new Set(perks.map((item) => item.id));
assert.equal(perkIds.size, perks.length, "ID перков не должны повторяться");

classes.forEach((fighterClass) => {
  assert(classIds.has(fighterClass.beats), `${fighterClass.id}: неизвестный выгодный матчап`);
  assert(classIds.has(fighterClass.losesTo), `${fighterClass.id}: неизвестный невыгодный матчап`);
  assert.equal(weapons.filter((item) => item.classId === fighterClass.id).length, 1);
  assert.equal(armor.filter((item) => item.classId === fighterClass.id).length, 1);
  const weapon = weapons.find((item) => item.id === fighterClass.weaponId);
  assert(weapon, `${fighterClass.id}: отсутствует оружие`);
  assert(perkIds.has(weapon.techniqueId), `${fighterClass.id}: отсутствует классовый приём`);
});

assert.equal(perks.filter((item) => item.group === "technique").length, 5);
assert(perks.filter((item) => item.group === "weapon").length >= 5);
assert(perks.filter((item) => item.group === "armor").length >= 5);

const rare = qualities.find((item) => item.id === "rare");
const named = qualities.find((item) => item.id === "named");
[rare, named].forEach((quality) => {
  assert.match(quality.weaponPerks, /1–2/);
  assert.match(quality.armorPerks, /ровно 1/);
});

[...weaponItems, ...armorItems].forEach((item) => {
  assert(classIds.has(item.classId), `${item.id}: неизвестный класс`);
  assert(qualities.some((quality) => quality.id === item.quality), `${item.id}: неизвестное качество`);
  item.additionalPerkIds.forEach((perkId) => assert(perkIds.has(perkId), `${item.id}: неизвестный перк ${perkId}`));
});

[...weaponItems, ...armorItems].filter((item) => ["common", "good"].includes(item.quality)).forEach((item) => {
  assert.equal(item.additionalPerkIds.length, 0, `${item.id}: обычный и хороший предмет не получают доп. перки`);
});

weaponItems.filter((item) => ["rare", "named"].includes(item.quality)).forEach((item) => {
  assert(item.additionalPerkIds.length >= 1 && item.additionalPerkIds.length <= 2, `${item.id}: оружию нужно 1–2 перка`);
});
armorItems.filter((item) => ["rare", "named"].includes(item.quality)).forEach((item) => {
  assert.equal(item.additionalPerkIds.length, 1, `${item.id}: доспехам нужен ровно один перк`);
});

console.log(`OK: ${classes.length} классов, ${weaponItems.length + armorItems.length} предметов, ${perks.length} перков и эффектов`);
