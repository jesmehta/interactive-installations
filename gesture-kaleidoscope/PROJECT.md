# Gesture Kaleidoscope

## Intent

A fullscreen-projectable kaleidoscope for a live installation. The whole
browser window is the canvas; a loaded image is reflected through a
mirror-fold pattern, controllable first by mouse/sliders and then — the
actual goal — by a performer's body pose via webcam, so the installation
becomes something a person can stand in front of and control with their
arms and position, no mouse or keyboard involved.

> **"make me a page where the entire window can go fullscreen and be
> projected, which means the entire window is the canvas. But there are
> controls overlaid that can be used to set settings and then dissappear
> completely on input and reappear on input, input being something
> specific like a mouse click or keyboard space press."**
>
> **"the projected image is a kaledoscopic effect of a loaded image. An
> isoceles trinagular slice of the loaded image is reflected recursively
> till the edge of the canvas across all three sides of the triangle"**
>
> load image · n (polygon number, 3–12, controls reflections around the
> centre) · h (height, apex-to-base distance) · location x,y (pans the
> triangle across the image, from mouse initially)
>
> **"phase 1 - inputs from sliders, mouse etc / phase 2 - connect inputs
> to gesture controls using posenet or other ml based trackers... angle
> of right arm maps to n / angle of left arm maps to h / location of
> person, esp head/face, maps to x,y / lock in on one set of these
> inputs, but can be picked up from 1-2 people in the webcam's view,
> whoever is more distinct or closer"**
>
> **"ask me queastions for clarity, and lets do phase 1 first befopre
> going on to phase 2"**

## Design decisions

**Analytic per-pixel folding, not recursive drawing.** The spec describes
the reflection as literally recursive ("reflected recursively till the
edge of canvas"). Implementing that as recursive draw calls (Canvas2D,
clip+transform, repeated) would get expensive fast and scale badly with
canvas size. Instead both folds — the n-wedge angular mirror and the
radius/lattice-position mirror — are closed-form functions evaluated once
per pixel in a WebGL1 fragment shader (`mod`/`abs` triangle-wave folds).
Cost is therefore independent of how many reflections are visible on
screen, which matters for a fullscreen projection.

**Tessellating mode reuses the centered mode's math, not a new system.**
When asked for a second mode covering the 3 regular tilings plus the
Archimedean ones, the key realization was that *all* of these (plus the
original centered kaleidoscope) are variations on the same primitive: fold
a point into a wedge around some center, then sample. Centered mode folds
around one center (screen middle); tessellating mode folds around the
*nearest point of a repeating lattice* instead. Three lattice types
(square grid, triangular-tiling vertices, triangular-tiling edge-midpoints
— the latter is the kagome point set, literally the trihexagonal tiling's
own vertices) combined with a fold order matched to each point's real
valence in the named tiling (e.g. truncated hexagonal's 12-gons → 12-fold
mirror) reproduces all 8 tilings from one function. The 3 Archimedean
tilings with no reflection symmetry (snub square, snub trihexagonal,
elongated triangular) are excluded, which lines up naturally with the
brief's "edges are mirrors" framing rather than needing a separate rule.

> **"ok, now give me two modes - the current centred kaleidoscope and a
> new one - tessellating - trinmagle, square, hexagon, as well as the
> archimedean tessellations - the edges of each polygon are mirrors, and
> the height control controls the size, the n side control jumps from
> 3-4-6-another-3-5 archimedean tessellations"**

**MediaPipe Tasks Vision over TensorFlow.js/PoseNet.** The brief named
PoseNet but said "using same library is not necessRY" and pointed at
`aadit-throw-and-pinch` (another project in this workspace) for
reference. That project uses `@mediapipe/tasks-vision`'s HandLandmarker,
loaded from CDN with no npm dependency. Gesture control here needs
full-body arm angles and head position rather than hand shape, so it uses
the same library's **PoseLandmarker** instead — same loading pattern,
same ecosystem, different landmarker for a different need. PoseLandmarker
also natively supports multi-pose detection, which maps directly onto the
"1–2 people in frame" requirement.

**Hysteresis bucketing for gesture flicker, not just smoothing.** The
first attempt at "smoother changes" reached for continuous interpolation
everywhere. The real complaint turned out to be narrower and different:
gesture-driven `n` could flip back and forth when pose-angle noise sat
right on an integer boundary — a *stability* problem, not a *smoothness*
problem. The fix that actually matches the complaint is hysteresis
bucketing (only accept a new bucket once the input has moved convincingly
past the boundary), kept separate from the render-side easing that makes
real changes animate instead of pop.

> **"is there any way to make the chnages smoother ? both modes and both
> parameters ?"**
>
> **"or not flicker and jitter atleast"**
>
> **"use bucket intervals instead of absolute values ?"**

**Cartesian hand height over polar arm angle, for the same reason as the
bucketing fix: match the actual failure mode.** The original phase-2 spec
asked for arm *angle*, computed via `atan2` of the shoulder→wrist vector.
That has a real flaw: angle is noisy exactly when the vector is short
(arm bent close to the body), since a small positional wobble swings the
angle a lot — more pose jitter precisely where control should feel most
stable. Hand *height* (wrist y relative to shoulder, normalized by
shoulder-to-hip distance so it's consistent regardless of distance from
the camera) is a direct coordinate difference with no such blowup, and
"raise your hand" is a more directly discoverable gesture than "angle
your arm just so" — better control and better discoverability from the
same change.

> **"can the controls be mapped not to the angle of the arms but the
> vertical location of the respective hand - cartesian instead of polar,
> will reduce the jitter and make it easier to control, better
> discoverability"**

**2-pass target-bitrate encoding for exact file-size limits, not CRF.**
CRF targets a *quality* level, not a size — fine for "compress without
much quality loss," but useless for "must fit under WhatsApp's 180MB
cap." For that, 2-pass encoding computes the bitrate needed for the
video's actual duration, then hits it accurately. (Hit one real bug
along the way: pass 1 used `-preset fast` and pass 2 used `-preset
medium` for speed, but libx264 requires matching encoder settings —
specifically weighted-prediction mode — between passes; mismatched
presets made pass 2 fail outright. Fixed by using the same preset for
both passes.) Also worth knowing: this specific content (a constantly
morphing, densely tessellated kaleidoscope) is close to worst-case for
H.264 — near-zero frame-to-frame redundancy — so an initial attempt at a
near-lossless CRF actually produced a *larger* file than the source.

> **"whatsapp has a 180 mb file limit, so give me the 90 mb version and a
> 170 mb version"**

**Crossfade, not numeric interpolation, for tessellating-preset
switches.** `n` and `h` are continuous quantities, so morphing them as
plain numbers (even through fractional, not-quite-an-integer wedge
counts) looks natural. Tessellating presets are not continuous — switching
from the square lattice to the hexagonal one is a change of lattice
*type*, not a number sweeping from 1 to 2. There's no meaningful
in-between geometry, so instead the shader samples both the old and new
preset's offsets and crossfades the resulting colors, which reads as
smooth without pretending the two patterns are numerically related.

**Repo structure follows this workspace's existing conventions, found by
checking first rather than assuming.** The git repo root turned out to be
`interactive-installations` (one level above this project), and commit
conventions (no Claude co-author, logical-hunk commits) and the
documentation shape (intent/decisions/changelog/quotes) were confirmed
against this workspace's existing patterns (`D:\FabWorld\CLAUDE.md`, the
auto-memory system, and CabinetOfCuriosities's own sync-todo convention)
rather than invented fresh.

## Changelog

- **Phase 1 scaffold** — Vite vanilla-JS project, WebGL1 shader, centered
  kaleidoscope mode (n = 3–12 sides, h = apex height, mouse-driven x/y
  pan), control panel that hides/shows, fullscreen toggle.
- **Fix: mouse y-pan inversion** — a flip meant to correct for WebGL's
  bottom-up `gl_FragCoord` actually inverted panning direction; caught via
  screenshot-testing against a quadrant-colored test image.
- **Fix: click-to-toggle removed, Space only** — clicking the control
  panel itself (e.g. dragging a slider) was toggling the panel's own
  visibility.

  > **"dont use mouseclicked to show hide controls, it is picking up
  > control panel clicks as well, space is enough"**

- **Tessellating render mode** — 8 edge-to-edge mirror tilings (3 regular
  + 5 mirror-symmetric Archimedean), selectable via a stepped pattern
  slider; `h` now also controls tile/lattice size in this mode.
- **Phase 2: pose-driven gesture control** — MediaPipe PoseLandmarker via
  CDN; right-arm angle → n/pattern, left-arm angle → h, nose position →
  x,y; locks onto the larger/closer of up to 2 detected people, with
  grace-period re-acquisition if the lock is briefly lost; mirrored
  self-view preview with skeleton overlay for setup feedback.
- **Default image on load** — `public/seahorse.jpg` loads automatically so
  there's something to look at immediately.

  > **"D:\Projects\gesture-kaleidoscope\seahorse.jpg use a default
  > image"**

- **Smooth transitions + anti-flicker** — `n`/`h` now ease continuously
  (~320ms) instead of snapping; tessellating-preset switches crossfade;
  gesture-driven `n`/pattern selection uses hysteresis bucketing so pose
  noise near a boundary doesn't flicker.
- **Project moved** from `D:\Projects\gesture-kaleidoscope` to
  `D:\Projects\interactive-installations\gesture-kaleidoscope`.

  > **"the project has been moved to
  > D:\Projects\interactive-installations\gesture-kaleidoscope"**

- **Gesture mapping switched from arm angle to hand height** — cartesian
  (wrist height relative to shoulder, normalized by torso size) instead
  of polar (shoulder→wrist angle), to cut jitter and improve
  discoverability. Right hand → n/pattern, left hand → h, same as before.
- **Demo video compression** — a 1080p30 screen capture of the live
  kaleidoscope (`demo/Kaledoscope_demo.mp4`, ~244MB, no audio) compressed
  to two WhatsApp-safe sizes via 2-pass bitrate targeting:
  `Kaledoscope_demo-90mb.mp4` (~87MB) and `Kaledoscope_demo-170mb.mp4`
  (~164MB). All three live in `demo/`, which is gitignored rather than
  committed.
- **Runs as a plain static page** (2026-10-18): `index.html` now references
  `./src/...` instead of `/src/...`, and the default image moved from
  `public/seahorse.jpg` (Vite serves `public/` at the site root) to
  `assets/seahorse.jpg`, loaded by relative path. Vite was only ever acting
  as a dev server here, since there are no npm dependencies and MediaPipe
  comes from a CDN. The folder now works unbuilt from Live Server, any
  static host or a GitHub Pages subpath, as well as from `npm run dev`. It
  still won't run from `file://` (browsers block ES modules there) and
  needs `https`/`localhost` for the camera. Linked from the repo-root
  landing page alongside `video-filters/`.

## Notes

- Dev server must bind IPv4 explicitly (`npm run dev -- --port 5183 --host
  127.0.0.1`) — the Vite default bound IPv6-only `::1`, which the
  browser couldn't reach.
- Gesture mapping (hand-height range, smoothing feel, lock behavior with
  two people) was verified mechanically (loads, runs, no errors, against
  a fake camera device) but not for actual feel, which needs a real
  person in front of a real webcam.
- An untracked `public/ajrakh_print.jpg` test image was noted here
  earlier. It wasn't in this checkout when `public/` was retired
  (2026-10-18), so it may still exist on the original `D:\Projects` copy.
