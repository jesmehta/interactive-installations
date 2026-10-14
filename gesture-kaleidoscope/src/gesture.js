// Pose-driven gesture control via MediaPipe Tasks Vision PoseLandmarker,
// loaded from CDN (no npm dependency, same approach as other camera-driven
// exercises in this workspace — see aadit-throw-and-pinch, which uses
// @mediapipe/tasks-vision's HandLandmarker the same way).
//
// Maps: right-arm angle -> n, left-arm angle -> h, nose position -> x,y pan.
// Up to 2 people can be in frame; the larger/closer one is picked initially,
// then tracking stays "locked" to whichever detected pose is nearest the
// previously-locked position each frame, so it doesn't flicker between two
// people. If the locked person is lost, the lock holds for a grace period
// (in case of a momentary missed detection) before re-picking the best
// candidate.

const VISION_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task';

const LOCK_GRACE_MS = 1000;
const LOCK_CONTINUITY_DIST = 0.35; // normalized image-space distance
const SMOOTH = 0.2;

// BlazePose landmark indices
const NOSE = 0,
  L_SHOULDER = 11,
  R_SHOULDER = 12,
  L_ELBOW = 13,
  R_ELBOW = 14,
  L_WRIST = 15,
  R_WRIST = 16,
  L_HIP = 23,
  R_HIP = 24;

function dist(a, b) {
  const dx = a.x - b.x,
    dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}
function mid(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}
function lerp(a, b, t) {
  return a + (b - a) * t;
}

function personSize(lm) {
  const ls = lm[L_SHOULDER],
    rs = lm[R_SHOULDER],
    lh = lm[L_HIP],
    rh = lm[R_HIP];
  if (!ls || !rs || !lh || !rh) return 0;
  return dist(ls, rs) + dist(mid(ls, rs), mid(lh, rh));
}

function personAnchor(lm) {
  return lm[NOSE] || lm[L_SHOULDER] || lm[R_SHOULDER] || null;
}

// Angle of an arm (shoulder->wrist): 0 = hanging straight down, PI = raised
// straight up, PI/2 = out to the side. abs() folds "out to the left" and
// "out to the right" of that one arm onto the same 0..PI range.
function armAngle(lm, shoulderIdx, wristIdx) {
  const s = lm[shoulderIdx],
    w = lm[wristIdx];
  if (!s || !w) return null;
  const dx = w.x - s.x,
    dy = w.y - s.y;
  return Math.abs(Math.atan2(dx, dy));
}

export function createGestureController(videoEl, overlayCanvas) {
  const overlayCtx = overlayCanvas.getContext('2d');

  let poseLandmarker = null;
  let stream = null;
  let active = false;
  let lastVideoTime = -1;
  let rafId = null;

  let lockedAnchor = null;
  let lastSeenAt = 0;

  const smoothed = { nT: 0.5, hT: 0.3, x: 0.5, y: 0.5 };
  const output = { hasPerson: false, personCount: 0, nT: 0.5, hT: 0.3, x: 0.5, y: 0.5 };

  const controller = {
    status: 'idle', // idle | loading | tracking | error
    statusMessage: '',
    output,
    get active() {
      return active;
    },
    enable,
    disable,
  };

  async function enable() {
    if (active) return;
    controller.status = 'loading';
    controller.statusMessage = 'Starting camera…';
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 480, height: 360, facingMode: 'user' },
        audio: false,
      });
      videoEl.srcObject = stream;
      await videoEl.play();

      if (!poseLandmarker) {
        controller.statusMessage = 'Loading pose model…';
        const { PoseLandmarker, FilesetResolver } = await import(/* @vite-ignore */ `${VISION_BASE}/vision_bundle.mjs`);
        const vision = await FilesetResolver.forVisionTasks(`${VISION_BASE}/wasm`);
        poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
          runningMode: 'VIDEO',
          numPoses: 2,
        });
      }

      active = true;
      controller.status = 'tracking';
      controller.statusMessage = 'Looking for a person…';
      loop();
    } catch (err) {
      console.error(err);
      controller.status = 'error';
      controller.statusMessage = 'Camera/model unavailable: ' + err.message;
      active = false;
    }
  }

  function disable() {
    active = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }
    videoEl.srcObject = null;
    overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    output.hasPerson = false;
    controller.status = 'idle';
    controller.statusMessage = '';
  }

  function selectPerson(poses, now) {
    if (poses.length === 0) return null;

    if (lockedAnchor && now - lastSeenAt < LOCK_GRACE_MS) {
      let best = null,
        bestD = Infinity;
      for (const lm of poses) {
        const a = personAnchor(lm);
        if (!a) continue;
        const d = dist(a, lockedAnchor);
        if (d < bestD) {
          bestD = d;
          best = lm;
        }
      }
      if (best && bestD < LOCK_CONTINUITY_DIST) {
        lockedAnchor = personAnchor(best);
        lastSeenAt = now;
        return best;
      }
    }

    // No valid lock (or grace period expired): pick whoever is larger in
    // frame, i.e. closer to the camera / more visually distinct.
    let best = null,
      bestSize = -1;
    for (const lm of poses) {
      const s = personSize(lm);
      if (s > bestSize) {
        bestSize = s;
        best = lm;
      }
    }
    if (best) {
      lockedAnchor = personAnchor(best);
      lastSeenAt = now;
    }
    return best;
  }

  function drawSkeleton(lm) {
    overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    if (!lm) return;
    const w = overlayCanvas.width,
      h = overlayCanvas.height;
    const bones = [
      [L_SHOULDER, R_SHOULDER],
      [L_SHOULDER, L_ELBOW],
      [L_ELBOW, L_WRIST],
      [R_SHOULDER, R_ELBOW],
      [R_ELBOW, R_WRIST],
      [L_SHOULDER, L_HIP],
      [R_SHOULDER, R_HIP],
      [L_HIP, R_HIP],
    ];
    overlayCtx.strokeStyle = '#4ade80';
    overlayCtx.lineWidth = 3;
    overlayCtx.beginPath();
    for (const [a, b] of bones) {
      const pa = lm[a],
        pb = lm[b];
      if (!pa || !pb) continue;
      overlayCtx.moveTo(pa.x * w, pa.y * h);
      overlayCtx.lineTo(pb.x * w, pb.y * h);
    }
    overlayCtx.stroke();
    const nose = lm[NOSE];
    if (nose) {
      overlayCtx.fillStyle = '#facc15';
      overlayCtx.beginPath();
      overlayCtx.arc(nose.x * w, nose.y * h, 6, 0, Math.PI * 2);
      overlayCtx.fill();
    }
  }

  function loop() {
    if (!active) return;
    rafId = requestAnimationFrame(loop);
    if (videoEl.readyState < 2) return;
    if (videoEl.currentTime === lastVideoTime) return;
    lastVideoTime = videoEl.currentTime;

    overlayCanvas.width = videoEl.videoWidth || 480;
    overlayCanvas.height = videoEl.videoHeight || 360;

    const now = performance.now();
    const result = poseLandmarker.detectForVideo(videoEl, now);
    const poses = result.landmarks || [];
    output.personCount = poses.length;

    const chosen = selectPerson(poses, now);
    drawSkeleton(chosen);

    if (!chosen) {
      output.hasPerson = false;
      controller.statusMessage = poses.length === 0 ? 'Looking for a person…' : 'Lost lock, reacquiring…';
      return;
    }

    const rAngle = armAngle(chosen, R_SHOULDER, R_WRIST);
    const lAngle = armAngle(chosen, L_SHOULDER, L_WRIST);
    const anchor = personAnchor(chosen);

    if (rAngle !== null) smoothed.nT = lerp(smoothed.nT, Math.min(1, rAngle / Math.PI), SMOOTH);
    if (lAngle !== null) smoothed.hT = lerp(smoothed.hT, Math.min(1, lAngle / Math.PI), SMOOTH);
    if (anchor) {
      smoothed.x = lerp(smoothed.x, anchor.x, SMOOTH);
      smoothed.y = lerp(smoothed.y, anchor.y, SMOOTH);
    }

    output.nT = smoothed.nT;
    output.hT = smoothed.hT;
    output.x = smoothed.x;
    output.y = smoothed.y;
    output.hasPerson = true;
    controller.statusMessage = `Tracking (${poses.length} seen)`;
  }

  return controller;
}
