(function () {
"use strict";

const canvas = document.querySelector("#sprite-preview-canvas");
const context = canvas.getContext("2d");
const bodySelect = document.querySelector("#preview-body");
const stateSelect = document.querySelector("#preview-state");
const mirrored = document.querySelector("#preview-mirrored");
const autoCycle = document.querySelector("#preview-auto-cycle");
const playButton = document.querySelector("#preview-play");
const frameLabel = document.querySelector("#preview-frame-label");

const {
  BODY_ANIMATION_GRIDS,
  UNIFIED_RETIARIUS_GRID_ID,
  UNIFIED_SWORDSMAN_GRID_ID,
  animationFrameForElapsed,
} = globalThis.GladiatorSpriteLibrary || {};

if (!BODY_ANIMATION_GRIDS || !animationFrameForElapsed) {
  throw new Error("Сначала подключите sprite-library.js");
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

const syncCharacterControls = () => {
  resetAnimationClock();
  scheduleStateCycle();
};

const renderPreview = (now) => {
  const retiarius = bodySelect.value === "retiarius";
  const asset = retiarius ? ASSET_PATHS.retiarius : ASSET_PATHS.swordsman;
  const clip = CLIPS[stateSelect.value];
  const frame = animationFrameForElapsed(clip, currentElapsed(now));
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
  const repeatLabel = clip.playback.repeat?.sequence?.length
    ? ` · цикл ${clip.playback.repeat.sequence.join("→")}`
    : " · разовая";
  frameLabel.value = `${retiarius ? "Ретиарий" : "Мечник"} · строка ${clip.row} · кадр ${frame} · ${clip.fps} FPS${repeatLabel}`;
  frameLabel.textContent = frameLabel.value;
  requestAnimationFrame(renderPreview);
};

[stateSelect, mirrored].forEach((control) => {
  control.addEventListener("change", resetAnimationClock);
});
bodySelect.addEventListener("change", syncCharacterControls);
stateSelect.addEventListener("change", scheduleStateCycle);
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
