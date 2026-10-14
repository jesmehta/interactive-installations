import { createKaleidoscope, TESS_PRESETS } from './kaleidoscope.js';

const canvas = document.getElementById('glcanvas');
const kaleidoscope = createKaleidoscope(canvas);

const nSlider = document.getElementById('nSlider');
const hSlider = document.getElementById('hSlider');
const nLabel = document.getElementById('nLabel');
const hVal = document.getElementById('hVal');
const locVal = document.getElementById('locVal');
const imageInput = document.getElementById('imageInput');
const fullscreenBtn = document.getElementById('fullscreenBtn');
const modeCenteredBtn = document.getElementById('modeCentered');
const modeTessBtn = document.getElementById('modeTess');

function resizeCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  kaleidoscope.resize(Math.round(window.innerWidth * dpr), Math.round(window.innerHeight * dpr));
}
window.addEventListener('resize', resizeCanvas);
document.addEventListener('fullscreenchange', resizeCanvas);
resizeCanvas();

// --- mode switch ---
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

// --- slider inputs ---
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

// --- mouse drives location x,y (pans the sampled triangle over the image) ---
window.addEventListener('mousemove', (event) => {
  const x = event.clientX / window.innerWidth;
  const y = event.clientY / window.innerHeight;
  kaleidoscope.state.locX = x;
  kaleidoscope.state.locY = y;
  locVal.textContent = `${x.toFixed(2)}, ${y.toFixed(2)}`;
});

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
  kaleidoscope.render();
  requestAnimationFrame(frame);
}
frame();
