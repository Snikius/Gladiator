(function () {
"use strict";

const battle = globalThis.GladiatorBattle;
if (!battle) throw new Error("Сначала подключите battle-engine.js");

const definitionName = (definitions, id) => (
  definitions.find((definition) => definition.id === id)?.name || id
);

const groupedNames = (ids, definitions) => {
  const counts = new Map();
  (ids || []).forEach((id) => {
    const name = definitionName(definitions, id);
    counts.set(name, (counts.get(name) || 0) + 1);
  });
  return [...counts].map(([name, count]) => count > 1 ? `${name} ×${count}` : name);
};

const actionText = (snapshot) => {
  const action = snapshot.lastAction;
  if (!action) return null;
  const actor = snapshot.fighters.find((fighter) => fighter.id === action.actorId)?.name || action.actorId;
  const target = snapshot.fighters.find((fighter) => fighter.id === action.targetId)?.name || action.targetId;
  if (action.outcome === "miss") return `${actor} промахивается — ${target} удерживает позицию`;
  if (action.outcome === "dodge") return `${target} уклоняется от атаки ${actor}`;
  if (action.outcome === "block") return `${target} блокирует удар ${actor}`;
  const hitLabels = {
    light: `${actor} слегка ранит ${target}`,
    normal: `${actor} ранит ${target}`,
    strong: `${actor} наносит ${target} сильный удар`,
    critical: `${actor} наносит ${target} критический удар`,
  };
  return hitLabels[action.impact] || `${actor} атакует ${target}`;
};

const actionClass = (action) => action.outcome === "hit"
  ? `impact-${action.impact || "normal"}`
  : `outcome-${action.outcome || "action"}`;

const traumaName = (trauma) => trauma.type === "arm"
  ? "травму руки"
  : trauma.type === "leg"
    ? "травму ноги"
    : "боевую травму";

const initialConditionEntries = (input) => input.fighters.flatMap((fighter) => {
  const buffs = groupedNames(fighter.buffs, battle.BUFF_DEFINITIONS);
  const injuries = groupedNames(fighter.injuries, battle.INJURY_DEFINITIONS);
  const parts = [];
  if (buffs.length) parts.push(`баффы — ${buffs.join(", ")}`);
  if (injuries.length) parts.push(`травмы — ${injuries.join(", ")}`);
  if (!parts.length) return [];
  return [{
    kind: "initial",
    className: "state-initial",
    step: 0,
    text: `${fighter.name} вступает в бой: ${parts.join("; ")}`,
  }];
});

const receivedTraumas = (snapshot) => snapshot.fighters.flatMap((fighter) => (
  (fighter.traumas || [])
    .filter((trauma) => trauma.source === "battle" && trauma.step === snapshot.step)
    .map((trauma) => ({ fighter, trauma }))
));

const BLOOD_STAIN_THRESHOLDS = Object.freeze([0, 0.22, 0.46, 0.7]);

const fighterBloodLevels = (snapshot) => (snapshot?.fighters || []).map((fighter) => {
  const maxHealth = Math.max(1, Number(fighter.maxHealth) || 1);
  const health = Math.max(0, Number(fighter.health) || 0);
  const healthRatio = Math.max(0, Math.min(1, health / maxHealth));
  return healthRatio < 0.7
    ? Math.max(0, Math.min(1, (0.7 - healthRatio) / 0.7))
    : 0;
});

const bloodStainProgress = (bloodLevel, stainIndex) => {
  const threshold = BLOOD_STAIN_THRESHOLDS[stainIndex];
  if (!Number.isFinite(threshold) || bloodLevel <= threshold) return 0;
  return Math.max(0, Math.min(1, (bloodLevel - threshold) / (1 - threshold)));
};

/* Визуальная случайность должна быть стабильной между render-вызовами, иначе
 * пятно дрожит. Id бойца и номер пятна задают постоянный предел роста 0.58…1. */
const bloodStainGrowthLimit = (fighterId, stainIndex) => {
  const key = `${fighterId}:${stainIndex}`;
  const hash = [...key].reduce(
    (value, character) => Math.imul(value ^ character.charCodeAt(0), 16777619) >>> 0,
    2166136261,
  );
  return Number((0.58 + (hash % 43) / 100).toFixed(2));
};

const buildBattleStoryEntries = (result, currentSnapshot, limit = 3) => {
  if (!result || !currentSnapshot) return [];
  const entries = initialConditionEntries(result.input);
  result.snapshots.forEach((snapshot) => {
    if (snapshot.index > currentSnapshot.index || snapshot.label === "Итог боя" || !snapshot.lastAction?.actorId) return;
    entries.push({
      kind: "action",
      className: actionClass(snapshot.lastAction),
      step: snapshot.step,
      text: actionText(snapshot),
    });
    receivedTraumas(snapshot).forEach(({ fighter, trauma }) => {
      entries.push({
        kind: "trauma",
        className: "state-trauma",
        step: snapshot.step,
        text: `${fighter.name} получает ${traumaName(trauma)}`,
      });
    });
  });
  return entries.slice(-Math.max(1, limit));
};

globalThis.GladiatorBattleStory = Object.freeze({
  BLOOD_STAIN_THRESHOLDS,
  actionClass,
  actionText,
  bloodStainGrowthLimit,
  bloodStainProgress,
  buildBattleStoryEntries,
  fighterBloodLevels,
  initialConditionEntries,
});
})();
