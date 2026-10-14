import { createKaleidoscope, TESS_PRESETS } from './kaleidoscope.js';
import { createGestureController } from './gesture.js';

const canvas = document.getElementById('glcanvas');
const kaleidoscope = createKaleidoscope(canvas);

const nSlider = document.getElementById('nSlider');
const hSlider = document.getElementById('hSlider');
const nLabel = document.getElementById('nLabel');
const hVal = document.getElementById('hVal');
const locLabel = document.getElementById('locLabel');
const locVal = document.getElementById('locVal');
const imageInput = document.getElementById('imageInput');
const fullscreenBtn = document.getElementById('fullscreenBtn');
const modeCenteredBtn = document.getElementById('modeCentered');
const modeTessBtn = document.getElementById('modeTess');
const inputMouseBtn = document.getElementById('inputMouse');
const inputGestureBtn = document.getElementById('inputGesture');
const gesturePanel = document.getElementById('gesturePanel');
const cameraBtn = document.getElementById('cameraBtn');
const gestureStatus = document.getElementById('gestureStatus');
const gestureVideo = document.getElementById('gestureVideo');
const gestureOverlay = document.getElementById('gestureOverlay');

const gesture = createGestureController(gestureVideo, gestureOverlay);

function resizeCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  kaleidoscope.resize(Math.round(window.innerWidth * dpr), Math.round(window.innerHeight * dpr));
}
window.addEventListener('resize', resizeCanvas);
document.addEventListener('fullscreenchange', resizeCanvas);
resizeCanvas();

// --- render mode switch (Centered / Tessellating) ---
function setMode(mode) {
  kaleidoscope.state.mode = mode;
  modeCenteredBtn.classList.toggle('active', mode === 0);
  modeTessBtn.classList.toggle('active', mode === 1);
  if (mode === 0) {
    nSlider.min = 3;
    nSlider.max = 12;
    nSlider.step = 1;
    nSlider.value = kaleidoscope.state.n;
    updateNLabel();
  } else {
    nSlider.min = 0;
    nSlider.max = TESS_PRESETS.length - 1;
    nSlider.step = 1;
    nSlider.value = kaleidoscope.state.tessIndex;
    updateNLabel();
  }
}

function updateNLabel() {
  if (kaleidoscope.state.mode === 0) {
    nLabel.textContent = `n (sides): ${nSlider.value}`;
  } else {
    nLabel.textContent = `Pattern: ${TESS_PRESETS[Number(nSlider.value)]}`;
  }
}

modeCenteredBtn.addEventListener('click', () => setMode(0));
modeTessBtn.addEventListener('click', () => setMode(1));
setMode(0);

// --- slider inputs (manual, only live in Mouse input mode) ---
nSlider.addEventListener('input', () => {
  if (kaleidoscope.state.mode === 0) {
    kaleidoscope.state.n = Number(nSlider.value);
  } else {
    kaleidoscope.state.tessIndex = Number(nSlider.value);
  }
  updateNLabel();
});

hSlider.addEventListener('input', () => {
  kaleidoscope.state.h = Number(hSlider.value);
  hVal.textContent = Number(hSlider.value).toFixed(2);
});

// --- image loading ---
imageInput.addEventListener('change', (event) => {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  const img = new Image();
  img.onload = () => {
    kaleidoscope.setImage(img);
    URL.revokeObjectURL(img.src);
  };
  img.src = URL.createObjectURL(file);
});

// --- default image, so there's something to look at before loading your own ---
const defaultImg = new Image();
defaultImg.onload = () => kaleidoscope.setImage(defaultImg);
defaultImg.src = '/seahorse.jpg';

// --- input mode: Mouse vs Gesture ---
let inputMode = 'mouse';

function setInputMode(mode) {
  inputMode = mode;
  inputMouseBtn.classList.toggle('active', mode === 'mouse');
  inputGestureBtn.classList.toggle('active', mode === 'gesture');
  gesturePanel.hidden = mode !== 'gesture';
  nSlider.disabled = mode === 'gesture';
  hSlider.disabled = mode === 'gesture';
  locLabel.textContent = mode === 'gesture' ? 'location (face-driven)' : 'location (mouse-driven)';
}

inputMouseBtn.addEventListener('click', () => setInputMode('mouse'));
inputGestureBtn.addEventListener('click', () => setInputMode('gesture'));

cameraBtn.addEventListener('click', async () => {
  if (gesture.active) {
    gesture.disable();
    cameraBtn.textContent = 'Enable camera';
  } else {
    cameraBtn.textContent = 'Starting…';
    cameraBtn.disabled = true;
    await gesture.enable();
    cameraBtn.disabled = false;
    cameraBtn.textContent = gesture.active ? 'Disable camera' : 'Enable camera';
  }
});

// --- mouse drives location x,y (pans the sampled triangle over the image) ---
window.addEventListener('mousemove', (event) => {
  if (inputMode !== 'mouse') return;
  const x = event.clientX / window.innerWidth;
  const y = event.clientY / window.innerHeight;
  kaleidoscope.state.locX = x;
  kaleidoscope.state.locY = y;
  locVal.textContent = `${x.toFixed(2)}, ${y.toFixed(2)}`;
});

// --- hysteresis bucketing for gesture-driven n / pattern selection ---
// Raw pose-angle noise can sit right on a bucket boundary and flip back and
// forth every frame. A bucketer only accepts a new bucket once the input has
// moved convincingly (by `margin` extra bucket-widths) past the boundary
// with the *current* bucket, so small jitter near an edge holds steady.
function createHysteresisBucketer(count, initialIndex, margin = 0.18) {
  let current = initialIndex;
  return (t01) => {
    const raw = Math.min(1, Math.max(0, t01)) * (count - 1);
    if (raw < current - 0.5 - margin || raw > current + 0.5 + margin) {
      current = Math.round(raw);
    }
    return current;
  };
}

const nBucketer = createHysteresisBucketer(10, 3); // n = 3..12 -> bucket index n-3, starts at n=6
const tessBucketer = createHysteresisBucketer(TESS_PRESETS.length, 2); // starts at Hexagonal

// --- apply gesture output each frame when Gesture input mode is active ---
function applyGesture() {
  gestureStatus.textContent = gesture.statusMessage || gesture.status;
  if (!gesture.active || !gesture.output.hasPerson) return;

  const { nT, hT, x, y } = gesture.output;

  if (kaleidoscope.state.mode === 0) {
    const n = 3 + nBucketer(nT); // 3..12
    kaleidoscope.state.n = n;
    nSlider.value = n;
  } else {
    const idx = tessBucketer(nT);
    kaleidoscope.state.tessIndex = idx;
    nSlider.value = idx;
  }
  updateNLabel();

  const h = 0.03 + hT * (1.2 - 0.03);
  kaleidoscope.state.h = h;
  hSlider.value = h;
  hVal.textContent = h.toFixed(2);

  kaleidoscope.state.locX = x;
  kaleidoscope.state.locY = y;
  locVal.textContent = `${x.toFixed(2)}, ${y.toFixed(2)}`;
}

// --- Space toggles the controls overlay ---
window.addEventListener('keydown', (event) => {
  if (event.code === 'Space') {
    event.preventDefault();
    toggleControls();
  }
});

function toggleControls() {
  document.body.classList.toggle('hide-controls');
}

// --- fullscreen ---
fullscreenBtn.addEventListener('click', () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
  } else {
    document.exitFullscreen().catch(() => {});
  }
});

// --- render loop ---
function frame() {
  if (inputMode === 'gesture') applyGesture();
  kaleidoscope.render();
  requestAnimationFrame(frame);
}
frame();
