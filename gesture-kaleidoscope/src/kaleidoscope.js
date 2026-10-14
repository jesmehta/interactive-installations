// WebGL1 kaleidoscope renderer.
//
// The effect: an isosceles triangle slice of the source image (apex at the
// screen centre, apex angle = 360/n degrees, apex-to-base height = h) is
// mirrored across its own two slanted edges to tile n copies around the
// centre, and mirrored across its base, repeatedly, out to the canvas edge.
// Both folds are done analytically in the fragment shader (angle fold for
// the sides, triangle-wave radius fold for the base) rather than by drawing
// recursive copies, so cost is independent of how many reflections are
// visible.

const VERTEX_SRC = `
attribute vec2 aPosition;
void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

const FRAGMENT_SRC = `
precision highp float;

uniform vec2 uResolution;   // canvas size in device pixels
uniform vec2 uImageSize;    // natural image size in pixels
uniform float uN;           // polygon number, 3..12
uniform float uH;           // apex-to-base height, as a fraction of min(canvas dimension)
uniform vec2 uLocation;     // 0..1, apex position within the source image
uniform sampler2D uImage;
uniform float uHasImage;

const float TWO_PI = 6.28318530718;

// Mirror-repeat fold of x onto [0,1], defined for any real x.
float mirrorWrap(float x) {
  float t = mod(x, 2.0);
  return t > 1.0 ? 2.0 - t : t;
}

void main() {
  vec2 p = gl_FragCoord.xy - 0.5 * uResolution;

  float angle = atan(p.y, p.x);
  float radius = length(p);

  float n = max(floor(uN + 0.5), 3.0);
  float sector = TWO_PI / n;

  // Fold rotationally into one wedge, then mirror about its bisector so the
  // wedge's two straight edges act as mirror lines (this is what produces
  // the n rotated+mirrored copies around the centre).
  float a = mod(angle, sector);
  a = abs(a - sector * 0.5);

  // Triangle-wave fold of the radius against the apex-to-base height, so
  // the base edge is mirrored repeatedly out to the canvas edge.
  float H = max(uH * min(uResolution.x, uResolution.y), 1.0);
  float r = mod(radius, 2.0 * H);
  r = H - abs(r - H);

  vec2 local = vec2(r * cos(a), r * sin(a));

  // Map the local (canvas-pixel) offset into source-image UV space, panned
  // by uLocation, and mirror-wrap so panning near the image edge still
  // samples something instead of going transparent/black.
  vec2 sampleUV = uLocation + local / min(uResolution.x, uResolution.y);
  sampleUV = vec2(mirrorWrap(sampleUV.x), mirrorWrap(sampleUV.y));

  vec3 color;
  if (uHasImage > 0.5) {
    color = texture2D(uImage, sampleUV).rgb;
  } else {
    // Placeholder pattern before an image is loaded.
    color = vec3(0.08 + 0.05 * sin(a * 8.0), 0.08, 0.1 + 0.05 * cos(r * 0.05));
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

  // Fullscreen quad.
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
  };

  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  const state = {
    n: 6,
    h: 0.3,
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

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(uniforms.uImage, 0);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  return { gl, state, setImage, resize, render };
}
