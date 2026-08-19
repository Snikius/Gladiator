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
  actionClass,
  actionText,
  buildBattleStoryEntries,
  initialConditionEntries,
});
})();
