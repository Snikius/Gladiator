(function () {
"use strict";

const canvas = document.querySelector("#sprite-preview-canvas");
const context = canvas.getContext("2d");
const bodySelect = document.querySelector("#preview-body");
const stateSelect = document.querySelector("#preview-state");
const outcomeSelect = document.querySelector("#preview-outcome");
const mirrored = document.querySelector("#preview-mirrored");
const autoCycle = document.querySelector("#preview-auto-cycle");
const playButton = document.querySelector("#preview-play");
const frameLabel = document.querySelector("#preview-frame-label");

const {
  BODY_ANIMATION_GRIDS,
  UNIFIED_RETIARIUS_GRID_ID,
  UNIFIED_SWORDSMAN_GRID_ID,
  animationFrameForElapsed,
  clipIntroDurationMs,
} = globalThis.GladiatorSpriteLibrary || {};
const {
  attackTrailStrokes,
  drawAttackTrailStrokes,
} = globalThis.GladiatorVisualEngine || {};

if (!BODY_ANIMATION_GRIDS || !animationFrameForElapsed || !attackTrailStrokes || !drawAttackTrailStrokes) {
  throw new Error("Сначала подключите sprite-library.js и visual-engine.js");
}

const swordsmanGrid = BODY_ANIMATION_GRIDS[UNIFIED_SWORDSMAN_GRID_ID];
const retiariusGrid = BODY_ANIMATION_GRIDS[UNIFIED_RETIARIUS_GRID_ID];

const ASSET_PATHS = Object.freeze({
  swordsman: Object.freeze({
    path: swordsmanGrid.assetPath,
    cellWidth: swordsmanGrid.grid.cellWidth,
    cellHeight: swordsmanGrid.grid.cellHeight,
    stateRenderScales: swordsmanGrid.stateRenderScales,
  }),
  retiarius: Object.freeze({
    path: retiariusGrid.assetPath,
    cellWidth: retiariusGrid.grid.cellWidth,
    cellHeight: retiariusGrid.grid.cellHeight,
    stateRenderScales: retiariusGrid.stateRenderScales,
  }),
});
const CLIPS = swordsmanGrid.clips;
const images = new Map();
let playing = true;
let startedAt = performance.now();
let pausedAt = 0;
let stateCycleTimer = null;
const TRAIL_PREVIEW_STATES = new Set(["attack", "special"]);
const TRAIL_PREVIEW_PAUSE_MS = 520;

const resetAnimationClock = () => {
  startedAt = performance.now();
  pausedAt = 0;
};

const scheduleStateCycle = () => {
  window.clearTimeout(stateCycleTimer);
  stateCycleTimer = null;
  if (!autoCycle.checked) return;
  stateCycleTimer = window.setTimeout(() => {
    stateSelect.selectedIndex = (stateSelect.selectedIndex + 1) % stateSelect.options.length;
    resetAnimationClock();
    syncTrailControls();
    scheduleStateCycle();
  }, 4000);
};

const getImage = (assetPath) => {
  if (!images.has(assetPath)) {
    const image = new Image();
    image.src = assetPath;
    images.set(assetPath, image);
  }
  return images.get(assetPath);
};

const currentElapsed = (now) => playing ? now - startedAt : pausedAt;

const drawLayer = (image, asset, frame, row, renderScale = 1) => {
  if (!image.complete || !image.naturalWidth) return;
  const sourceWidth = image.naturalWidth / 6;
  const sourceHeight = image.naturalHeight / 11;
  const renderedWidth = asset.cellWidth * renderScale;
  const renderedHeight = asset.cellHeight * renderScale;
  context.drawImage(
    image,
    frame * sourceWidth,
    row * sourceHeight,
    sourceWidth,
    sourceHeight,
    (canvas.width - renderedWidth) / 2,
    canvas.height - renderedHeight,
    renderedWidth,
    renderedHeight,
  );
};

const previewTrailAction = (retiarius) => {
  const selectedOutcome = outcomeSelect.value;
  const special = stateSelect.value === "special";
  return Object.freeze({
    actorId: "preview-actor",
    targetId: "preview-target",
    outcome: selectedOutcome === "critical" ? "hit" : selectedOutcome,
    critical: selectedOutcome === "critical",
    classTechnique: special && retiarius ? "weapon.retiarius-net-cast" : null,
    specialAttack: special && !retiarius ? "preview-sword-special" : null,
  });
};

const drawPreviewTrail = (retiarius, elapsedMs, durationMs) => {
  if (!TRAIL_PREVIEW_STATES.has(stateSelect.value) || elapsedMs >= durationMs) return;
  const direction = mirrored.checked ? -1 : 1;
  const actorX = canvas.width / 2;
  const targetX = direction > 0 ? canvas.width - 24 : 24;
  const frame = {
    action: previewTrailAction(retiarius),
    components: [
      {
        kind: "fighter",
        fighterId: "preview-actor",
        transform: { x: actorX, y: canvas.height, direction },
        animation: {
          assetHeight: 256,
          equipmentProfileId: retiarius ? "retiarius-armor" : "murmillo-armor",
          weaponSkinId: retiarius ? "trident" : "sword",
        },
      },
      {
        kind: "fighter",
        fighterId: "preview-target",
        transform: { x: targetX, y: canvas.height, direction: -direction },
        animation: { assetHeight: 256 },
      },
    ],
  };
  drawAttackTrailStrokes(context, attackTrailStrokes(frame, elapsedMs / durationMs));
};

const syncTrailControls = () => {
  const enabled = TRAIL_PREVIEW_STATES.has(stateSelect.value);
  outcomeSelect.disabled = !enabled;
  outcomeSelect.closest("label")?.classList.toggle("is-disabled", !enabled);
};

const syncCharacterControls = () => {
  resetAnimationClock();
  syncTrailControls();
  scheduleStateCycle();
};

const renderPreview = (now) => {
  const retiarius = bodySelect.value === "retiarius";
  const asset = retiarius ? ASSET_PATHS.retiarius : ASSET_PATHS.swordsman;
  const clip = CLIPS[stateSelect.value];
  const rawElapsed = currentElapsed(now);
  const trailPreview = TRAIL_PREVIEW_STATES.has(stateSelect.value);
  const clipDuration = clipIntroDurationMs(clip);
  const previewCycleDuration = clipDuration + TRAIL_PREVIEW_PAUSE_MS;
  const animationElapsed = trailPreview ? rawElapsed % previewCycleDuration : rawElapsed;
  const frame = animationFrameForElapsed(clip, animationElapsed);
  context.imageSmoothingEnabled = false;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#050607";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.save();
  if (mirrored.checked) {
    context.translate(canvas.width, 0);
    context.scale(-1, 1);
  }
  drawLayer(
    getImage(asset.path),
    asset,
    frame,
    clip.row,
    asset.stateRenderScales?.[stateSelect.value] || 1,
  );
  context.restore();
  drawPreviewTrail(retiarius, animationElapsed, clipDuration);
  const repeatLabel = clip.playback.repeat?.sequence?.length
    ? ` · цикл ${clip.playback.repeat.sequence.join("→")}`
    : " · разовая";
  const trailLabel = trailPreview ? ` · развод ${outcomeSelect.selectedOptions[0].text}` : "";
  frameLabel.value = `${retiarius ? "Ретиарий" : "Мечник"} · строка ${clip.row} · кадр ${frame} · ${clip.fps} FPS${repeatLabel}${trailLabel}`;
  frameLabel.textContent = frameLabel.value;
  requestAnimationFrame(renderPreview);
};

[stateSelect, outcomeSelect, mirrored].forEach((control) => {
  control.addEventListener("change", resetAnimationClock);
});
bodySelect.addEventListener("change", syncCharacterControls);
stateSelect.addEventListener("change", () => {
  syncTrailControls();
  scheduleStateCycle();
});
autoCycle.addEventListener("change", scheduleStateCycle);
playButton.addEventListener("click", () => {
  if (playing) {
    pausedAt = performance.now() - startedAt;
  } else {
    startedAt = performance.now() - pausedAt;
  }
  playing = !playing;
  playButton.textContent = playing ? "Ⅱ Пауза" : "▶ Продолжить";
  playButton.setAttribute("aria-pressed", String(playing));
});

syncCharacterControls();
requestAnimationFrame(renderPreview);
})();
