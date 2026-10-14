// WebGL1 kaleidoscope renderer. Two render modes:
//
// MODE 0 "centered" — a single isosceles triangle slice of the source image,
// apex at the screen centre, apex angle = 360/n degrees, apex-to-base height
// h, mirrored across its own two slanted edges (n copies around the centre)
// and across its base, repeatedly, out to the canvas edge.
//
// MODE 1 "tessellating" — the same mirror-fold trick, but applied at every
// point of a repeating lattice instead of once at screen centre, so the
// whole canvas is edge-to-edge mirror-tiled. Both folds happen analytically
// per pixel (no recursive draw calls), so cost is independent of how many
// tiles are visible.
//
// The 8 presets are the regular {3,6},{4,4},{6,3} tilings plus the 5
// Archimedean (semiregular) tilings that still have full mirror symmetry —
// trihexagonal, truncated square, truncated hexagonal, rhombitrihexagonal,
// truncated trihexagonal. (The other 3 Archimedean tilings — snub square,
// snub trihexagonal, elongated triangular — have no reflection symmetry, so
// "edges are mirrors" naturally excludes them.) Each preset picks one of
// three lattices (square corners/centres, triangular-tiling vertices, or
// triangular-tiling edge-midpoints — the latter is the kagome arrangement
// that is literally the trihexagonal tiling's vertex set) and a fold order
// n matched to that lattice point's valence in the real tiling.

const VERTEX_SRC = `
attribute vec2 aPosition;
void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

const FRAGMENT_SRC = `
precision highp float;

uniform vec2 uResolution;
uniform vec2 uImageSize;
uniform float uN;            // centred mode: polygon number, 3..12
uniform float uH;            // cell/triangle size, fraction of min(canvas dimension)
uniform vec2 uLocation;      // 0..1, pan within the source image
uniform sampler2D uImage;
uniform float uHasImage;
uniform float uMode;         // 0 = centred, 1 = tessellating
uniform float uTessIndex;    // 0..7, which tessellation preset

const float TWO_PI = 6.28318530718;
const float PI = 3.14159265359;
const float SQRT3 = 1.73205080757;

float mirrorWrap(float x) {
  float t = mod(x, 2.0);
  return t > 1.0 ? 2.0 - t : t;
}

// Fold angle (radians) into [0, PI/n], mirroring across the n wedge edges
// around the origin — this is what turns an n-wedge sector into a mirror.
float angleFold(float angle, float n) {
  float sector = TWO_PI / n;
  float a = mod(angle, sector);
  return abs(a - sector * 0.5);
}

vec2 rotate(vec2 p, float a) {
  float c = cos(a), s = sin(a);
  return vec2(c * p.x - s * p.y, s * p.x + c * p.y);
}

// Reflect-fold (angle around a local origin only — no radius fold) and
// return the resulting offset vector, used by both modes.
vec2 mirrorOffset(vec2 local, float n) {
  float r = length(local);
  float a = angleFold(atan(local.y, local.x), n);
  return vec2(r * cos(a), r * sin(a));
}

// --- centred mode -----------------------------------------------------

vec2 centredOffset(vec2 p, float n, float H) {
  float a = angleFold(atan(p.y, p.x), n);
  float r = mod(length(p), 2.0 * H);
  r = H - abs(r - H);
  return vec2(r * cos(a), r * sin(a));
}

// --- tessellating mode: lattices ---------------------------------------

// Square lattice: nearest corner of a grid with spacing 'cell'.
vec2 squareLocal(vec2 p, float cell) {
  vec2 c = mod(p, cell) - cell * 0.5;
  return c;
}

// Axial-round a triangular lattice coordinate (standard hex-grid rounding
// via cube coordinates) so "nearest vertex" is correct everywhere,
// including near cell boundaries.
vec2 axialRound(vec2 ab) {
  float x = ab.x, z = ab.y, y = -x - z;
  float rx = floor(x + 0.5), ry = floor(y + 0.5), rz = floor(z + 0.5);
  float dx = abs(rx - x), dy = abs(ry - y), dz = abs(rz - z);
  if (dx > dy && dx > dz) rx = -ry - rz;
  else if (dy > dz) ry = -rx - rz;
  else rz = -rx - ry;
  return vec2(rx, rz);
}

// Nearest vertex of a triangular lattice (spacing 'cell') to point p.
vec2 hexVertexCenter(vec2 p, float cell) {
  vec2 ab = vec2(p.x / cell - p.y / (cell * SQRT3), p.y * 2.0 / (cell * SQRT3));
  vec2 r = axialRound(ab);
  return vec2(r.x * cell + r.y * cell * 0.5, r.y * cell * SQRT3 * 0.5);
}

vec2 hexVertexLocal(vec2 p, float cell) {
  return p - hexVertexCenter(p, cell);
}

// Nearest edge-midpoint of a triangular lattice (the kagome / trihexagonal
// vertex set): find the nearest lattice vertex, then the nearest of its 6
// neighbour directions, and return position relative to that edge's
// midpoint, rotated so the local mirror line (perpendicular to the edge)
// lines up with the angle-fold's reference axis.
vec2 hexEdgeMidLocal(vec2 p, float cell) {
  vec2 vcenter = hexVertexCenter(p, cell);
  vec2 rel = p - vcenter;
  float ang = atan(rel.y, rel.x);
  float sector = PI / 3.0;
  float dir = sector * floor(ang / sector + 0.5);
  vec2 edgeMid = vcenter + cell * 0.5 * vec2(cos(dir), sin(dir));
  vec2 local = p - edgeMid;
  return rotate(local, -(dir + PI * 0.5));
}

// Preset table: lattice type (0=square, 1=hex-vertex, 2=hex-edge-mid) and
// fold order n, matched to that lattice point's valence in the named tiling.
void tessPreset(float index, out float latticeType, out float n) {
  if (index < 0.5) { latticeType = 1.0; n = 3.0; }       // 0 Triangular {3,6}
  else if (index < 1.5) { latticeType = 0.0; n = 4.0; }  // 1 Square {4,4}
  else if (index < 2.5) { latticeType = 1.0; n = 6.0; }  // 2 Hexagonal {6,3}
  else if (index < 3.5) { latticeType = 2.0; n = 2.0; }  // 3 Trihexagonal (3.6.3.6)
  else if (index < 4.5) { latticeType = 0.0; n = 8.0; }  // 4 Truncated square (4.8.8)
  else if (index < 5.5) { latticeType = 1.0; n = 12.0; } // 5 Truncated hexagonal (3.12.12)
  else if (index < 6.5) { latticeType = 2.0; n = 4.0; }  // 6 Rhombitrihexagonal (3.4.6.4)
  else { latticeType = 2.0; n = 12.0; }                  // 7 Truncated trihexagonal (4.6.12)
}

vec2 tessOffset(vec2 p, float index, float cell) {
  float latticeType, n;
  tessPreset(index, latticeType, n);
  vec2 local;
  if (latticeType < 0.5) local = squareLocal(p, cell);
  else if (latticeType < 1.5) local = hexVertexLocal(p, cell);
  else local = hexEdgeMidLocal(p, cell);
  return mirrorOffset(local, n);
}

void main() {
  vec2 p = gl_FragCoord.xy - 0.5 * uResolution;
  float H = max(uH * min(uResolution.x, uResolution.y), 1.0);

  vec2 offset;
  if (uMode < 0.5) {
    offset = centredOffset(p, max(floor(uN + 0.5), 3.0), H);
  } else {
    offset = tessOffset(p, floor(uTessIndex + 0.5), H);
  }

  vec2 sampleUV = uLocation + offset / min(uResolution.x, uResolution.y);
  sampleUV = vec2(mirrorWrap(sampleUV.x), mirrorWrap(sampleUV.y));

  vec3 color;
  if (uHasImage > 0.5) {
    color = texture2D(uImage, sampleUV).rgb;
  } else {
    color = vec3(0.08 + 0.05 * sin(sampleUV.x * 40.0), 0.08, 0.1 + 0.05 * cos(sampleUV.y * 40.0));
  }

  gl_FragColor = vec4(color, 1.0);
}
`;

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compile error: ${log}`);
  }
  return shader;
}

export const TESS_PRESETS = [
  'Triangular',
  'Square',
  'Hexagonal',
  'Trihexagonal',
  'Truncated square',
  'Truncated hexagonal',
  'Rhombitrihexagonal',
  'Truncated trihexagonal',
];

export function createKaleidoscope(canvas) {
  const gl = canvas.getContext('webgl', { antialias: true, preserveDrawingBuffer: false });
  if (!gl) {
    throw new Error('WebGL is not available in this browser.');
  }

  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SRC);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SRC);

  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program);
    throw new Error(`Program link error: ${log}`);
  }
  gl.useProgram(program);

  const quadBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, -1, 1, 1, -1, 1]),
    gl.STATIC_DRAW
  );
  const aPosition = gl.getAttribLocation(program, 'aPosition');
  gl.enableVertexAttribArray(aPosition);
  gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);

  const uniforms = {
    uResolution: gl.getUniformLocation(program, 'uResolution'),
    uImageSize: gl.getUniformLocation(program, 'uImageSize'),
    uN: gl.getUniformLocation(program, 'uN'),
    uH: gl.getUniformLocation(program, 'uH'),
    uLocation: gl.getUniformLocation(program, 'uLocation'),
    uImage: gl.getUniformLocation(program, 'uImage'),
    uHasImage: gl.getUniformLocation(program, 'uHasImage'),
    uMode: gl.getUniformLocation(program, 'uMode'),
    uTessIndex: gl.getUniformLocation(program, 'uTessIndex'),
  };

  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  const state = {
    mode: 0, // 0 = centred, 1 = tessellating
    n: 6,
    h: 0.3,
    tessIndex: 2, // hexagonal
    locX: 0.5,
    locY: 0.5,
    hasImage: false,
    imageSize: [1, 1],
  };

  function setImage(imageSource) {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, imageSource);
    state.hasImage = true;
    state.imageSize = [imageSource.width, imageSource.height];
  }

  function resize(widthPx, heightPx) {
    canvas.width = widthPx;
    canvas.height = heightPx;
    gl.viewport(0, 0, widthPx, heightPx);
  }

  function render() {
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    gl.enableVertexAttribArray(aPosition);
    gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);

    gl.uniform2f(uniforms.uResolution, canvas.width, canvas.height);
    gl.uniform2f(uniforms.uImageSize, state.imageSize[0], state.imageSize[1]);
    gl.uniform1f(uniforms.uN, state.n);
    gl.uniform1f(uniforms.uH, state.h);
    gl.uniform2f(uniforms.uLocation, state.locX, state.locY);
    gl.uniform1f(uniforms.uHasImage, state.hasImage ? 1 : 0);
    gl.uniform1f(uniforms.uMode, state.mode);
    gl.uniform1f(uniforms.uTessIndex, state.tessIndex);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(uniforms.uImage, 0);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  return { gl, state, setImage, resize, render };
}
