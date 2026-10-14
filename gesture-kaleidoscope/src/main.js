import { createKaleidoscope } from './kaleidoscope.js';

const canvas = document.getElementById('glcanvas');
const kaleidoscope = createKaleidoscope(canvas);

const nSlider = document.getElementById('nSlider');
const hSlider = document.getElementById('hSlider');
const nVal = document.getElementById('nVal');
const hVal = document.getElementById('hVal');
const locVal = document.getElementById('locVal');
const imageInput = document.getElementById('imageInput');
const fullscreenBtn = document.getElementById('fullscreenBtn');

function resizeCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  kaleidoscope.resize(Math.round(window.innerWidth * dpr), Math.round(window.innerHeight * dpr));
}
window.addEventListener('resize', resizeCanvas);
document.addEventListener('fullscreenchange', resizeCanvas);
resizeCanvas();

// --- slider inputs ---
nSlider.addEventListener('input', () => {
  kaleidoscope.state.n = Number(nSlider.value);
  nVal.textContent = nSlider.value;
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
  // Flip y: WebGL's gl_FragCoord is bottom-up, mouse clientY is top-down.
  const y = 1 - event.clientY / window.innerHeight;
  kaleidoscope.state.locX = x;
  kaleidoscope.state.locY = y;
  locVal.textContent = `${x.toFixed(2)}, ${y.toFixed(2)}`;
});

// --- click (not drag) and Space toggle the controls overlay ---
let pointerDownPos = null;
let pointerDownTime = 0;

window.addEventListener('pointerdown', (event) => {
  pointerDownPos = { x: event.clientX, y: event.clientY };
  pointerDownTime = performance.now();
});

window.addEventListener('pointerup', (event) => {
  if (!pointerDownPos) return;
  const dx = event.clientX - pointerDownPos.x;
  const dy = event.clientY - pointerDownPos.y;
  const moved = Math.hypot(dx, dy);
  const elapsed = performance.now() - pointerDownTime;
  pointerDownPos = null;
  if (moved < 6 && elapsed < 400) {
    toggleControls();
  }
});

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
