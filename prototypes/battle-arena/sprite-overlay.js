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

const ASSET_PATH = "./assets/unified-swordsman-grid-v8.png";
const CLIPS = Object.freeze({
  "idle.normal": Object.freeze({ row: 0, fps: 6 }),
  "idle.tired": Object.freeze({ row: 1, fps: 5 }),
  "idle.injured": Object.freeze({ row: 2, fps: 5 }),
  attack: Object.freeze({ row: 3, fps: 12 }),
  "defense.block": Object.freeze({ row: 4, fps: 20 }),
  "defense.dodge": Object.freeze({ row: 5, fps: 10 }),
  "reaction.hit": Object.freeze({ row: 6, fps: 10, frames: Object.freeze([0, 1, 2, 1, 0]) }),
  defeated: Object.freeze({ row: 6, fps: 8, frames: Object.freeze([3, 4, 5]), loop: false }),
  advance: Object.freeze({ row: 7, fps: 7 }),
  retreat: Object.freeze({ row: 7, fps: 7, frames: Object.freeze([5, 4, 3, 2, 1, 0]) }),
  greeting: Object.freeze({ row: 8, fps: 4, loop: false }),
  victory: Object.freeze({ row: 9, fps: 7, loop: false }),
});
let image = null;
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

const getImage = () => {
  if (!image) {
    image = new Image();
    image.src = ASSET_PATH;
  }
  return image;
};

const currentElapsed = (now) => playing ? now - startedAt : pausedAt;

const drawLayer = (image, frame, row) => {
  if (!image.complete || !image.naturalWidth) return;
  const sourceWidth = image.naturalWidth / 6;
  const sourceHeight = image.naturalHeight / 10;
  context.drawImage(
    image,
    frame * sourceWidth,
    row * sourceHeight,
    sourceWidth,
    sourceHeight,
    0,
    0,
    canvas.width,
    canvas.height,
  );
};

const renderPreview = (now) => {
  const clip = CLIPS[stateSelect.value];
  const sequence = clip.frames || [0, 1, 2, 3, 4, 5];
  const elapsedFrame = Math.floor(currentElapsed(now) / 1000 * clip.fps);
  const sequenceIndex = clip.loop === false
    ? Math.min(elapsedFrame, sequence.length - 1)
    : elapsedFrame % sequence.length;
  const frame = sequence[sequenceIndex];
  context.imageSmoothingEnabled = false;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#050607";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.save();
  if (mirrored.checked) {
    context.translate(canvas.width, 0);
    context.scale(-1, 1);
  }
  drawLayer(getImage(), frame, clip.row);
  context.restore();
  frameLabel.value = `Строка ${clip.row} · кадр ${frame} · ${clip.fps} FPS`;
  frameLabel.textContent = frameLabel.value;
  requestAnimationFrame(renderPreview);
};

[bodySelect, stateSelect, mirrored].forEach((control) => {
  control.addEventListener("change", resetAnimationClock);
});
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

scheduleStateCycle();
requestAnimationFrame(renderPreview);
})();
