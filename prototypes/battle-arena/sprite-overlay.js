(function () {
"use strict";

const root = document.documentElement;
const opacity = document.querySelector("#weapon-opacity");
const opacityValue = document.querySelector("#weapon-opacity-value");
const buttons = [...document.querySelectorAll("[data-layer-mode]")];
const canvas = document.querySelector("#sprite-preview-canvas");
const context = canvas.getContext("2d");
const bodySelect = document.querySelector("#preview-body");
const weaponSelect = document.querySelector("#preview-weapon");
const stateSelect = document.querySelector("#preview-state");
const mirrored = document.querySelector("#preview-mirrored");
const autoCycle = document.querySelector("#preview-auto-cycle");
const playButton = document.querySelector("#preview-play");
const frameLabel = document.querySelector("#preview-frame-label");

const ASSETS = Object.freeze({
  murmillo: "./assets/murmillo-body-overlay-grid-v3.png",
  retiarius: "./assets/retiarius-body-overlay-grid-v4.png",
  sword: "./assets/gladius-overlay-grid-v3.png",
  trident: "./assets/trident-overlay-grid-v4.png",
});
const COMPATIBLE_WEAPONS = Object.freeze({
  murmillo: Object.freeze([Object.freeze({ id: "sword", label: "Гладиус" })]),
  retiarius: Object.freeze([Object.freeze({ id: "trident", label: "Трезубец" })]),
});
const CLIPS = Object.freeze({
  "idle.normal": Object.freeze({ row: 0, fps: 6 }),
  "idle.tired": Object.freeze({ row: 1, fps: 5 }),
  "idle.injured": Object.freeze({ row: 2, fps: 5 }),
  attack: Object.freeze({ row: 3, fps: 12 }),
  "defense.block": Object.freeze({ row: 4, fps: 10 }),
  "defense.dodge": Object.freeze({ row: 5, fps: 12 }),
  "reaction.hit": Object.freeze({ row: 6, fps: 10, frames: Object.freeze([0, 1, 2, 1, 0]) }),
});
const LAYER_BY_BODY = Object.freeze({
  murmillo: Object.freeze({ default: Object.freeze(["behind", "behind", "behind", "behind", "behind", "behind"]) }),
  retiarius: Object.freeze({
    default: Object.freeze(["behind", "behind", "behind", "behind", "behind", "behind"]),
    attack: Object.freeze(["behind", "behind", "front", "front", "front", "behind"]),
  }),
});
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

const getImage = (assetId) => {
  const assetPath = ASSETS[assetId];
  if (!images.has(assetPath)) {
    const image = new Image();
    image.src = assetPath;
    images.set(assetPath, image);
  }
  return images.get(assetPath);
};

const currentElapsed = (now) => playing ? now - startedAt : pausedAt;

const syncCompatibleWeapons = () => {
  const compatible = COMPATIBLE_WEAPONS[bodySelect.value] || [];
  const previousWeapon = weaponSelect.value;
  weaponSelect.replaceChildren(...compatible.map(({ id, label }) => {
    const option = document.createElement("option");
    option.value = id;
    option.textContent = label;
    return option;
  }));
  if (compatible.some(({ id }) => id === previousWeapon)) {
    weaponSelect.value = previousWeapon;
  }
};

const drawLayer = (image, frame, row) => {
  if (!image.complete || !image.naturalWidth) return;
  const sourceWidth = image.naturalWidth / 6;
  const sourceHeight = image.naturalHeight / 7;
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
  const sequenceIndex = Math.floor(currentElapsed(now) / 1000 * clip.fps) % sequence.length;
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
  const drawBody = () => drawLayer(getImage(bodySelect.value), frame, clip.row);
  const drawWeapon = () => {
    context.save();
    context.globalAlpha = Number(opacity.value) / 100;
    drawLayer(getImage(weaponSelect.value), frame, clip.row);
    context.restore();
  };
  const mode = root.dataset.layerMode;
  const layers = LAYER_BY_BODY[bodySelect.value] || LAYER_BY_BODY.murmillo;
  const weaponLayer = (layers[stateSelect.value] || layers.default)[frame] || "front";
  if (mode === "body") {
    drawBody();
  } else if (mode === "weapon") {
    drawWeapon();
  } else if (weaponLayer === "behind") {
    drawWeapon();
    drawBody();
  } else {
    drawBody();
    drawWeapon();
  }
  context.restore();
  frameLabel.value = `Строка ${clip.row} · кадр ${frame} · ${clip.fps} FPS`;
  frameLabel.textContent = frameLabel.value;
  requestAnimationFrame(renderPreview);
};

const setWeaponOpacity = () => {
  const value = Number(opacity.value);
  root.style.setProperty("--weapon-opacity", String(value / 100));
  opacityValue.value = `${value}%`;
  opacityValue.textContent = `${value}%`;
};

opacity.addEventListener("input", setWeaponOpacity);
buttons.forEach((button) => {
  button.addEventListener("click", () => {
    const mode = button.dataset.layerMode;
    root.dataset.layerMode = mode;
    buttons.forEach((item) => item.classList.toggle("selected", item === button));
  });
});

[bodySelect, weaponSelect, stateSelect, mirrored].forEach((control) => {
  control.addEventListener("change", resetAnimationClock);
});
stateSelect.addEventListener("change", scheduleStateCycle);
autoCycle.addEventListener("change", scheduleStateCycle);
bodySelect.addEventListener("change", syncCompatibleWeapons);
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

setWeaponOpacity();
syncCompatibleWeapons();
scheduleStateCycle();
requestAnimationFrame(renderPreview);
})();
