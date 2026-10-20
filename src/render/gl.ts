/**
 * A small WebGL helper for full-screen shader passes: the looks and modes that need to
 * compute every pixel (the Droste spiral, the caustics). All passes share one offscreen
 * WebGL canvas. A pass renders into it and returns it; the caller draws it onto a 2D
 * canvas at once, before the next pass reuses it.
 */

/** Uniform values: a number is a float, an array of 2 to 4 numbers a vector. */
export type Uniforms = Record<string, number | readonly number[]>;

export interface Pass {
  /**
   * Renders the pass at `width` × `height` pixels, with `texture` (a canvas) bound to
   * `u_tex` when given. `u_res` is set to the size. Returns the WebGL canvas.
   */
  render(
    width: number,
    height: number,
    uniforms: Uniforms,
    texture?: TexImageSource,
  ): HTMLCanvasElement;
}

const VERTEX = `attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }`;

let canvas: HTMLCanvasElement | null = null;
let gl: WebGLRenderingContext | null = null;
let failed = false;
let texture: WebGLTexture | null = null;

function context(): WebGLRenderingContext | null {
  if (gl || failed) return gl;
  canvas = document.createElement('canvas');
  gl = canvas.getContext('webgl', { preserveDrawingBuffer: true, antialias: false, alpha: false });
  if (!gl) {
    failed = true;
    return null;
  }
  // One triangle that covers the screen.
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  // Texture rows bottom-up, as gl_FragCoord counts them.
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  return gl;
}

function compile(g: WebGLRenderingContext, type: number, source: string): WebGLShader {
  const shader = g.createShader(type);
  if (!shader) throw new Error('WebGL: no shader');
  g.shaderSource(shader, source);
  g.compileShader(shader);
  if (!g.getShaderParameter(shader, g.COMPILE_STATUS)) {
    throw new Error(`WebGL shader: ${g.getShaderInfoLog(shader)}`);
  }
  return shader;
}

/** A pass with this fragment shader, or null where WebGL does not work. */
export function glPass(fragment: string): Pass | null {
  const g = context();
  if (!g || !canvas) return null;
  let program: WebGLProgram;
  try {
    const p = g.createProgram();
    if (!p) return null;
    g.attachShader(p, compile(g, g.VERTEX_SHADER, VERTEX));
    g.attachShader(p, compile(g, g.FRAGMENT_SHADER, `precision highp float;\n${fragment}`));
    g.linkProgram(p);
    if (!g.getProgramParameter(p, g.LINK_STATUS))
      throw new Error(`WebGL link: ${g.getProgramInfoLog(p)}`);
    program = p;
  } catch (error) {
    console.error(error);
    return null;
  }
  const locations = new Map<string, WebGLUniformLocation | null>();
  const where = (name: string): WebGLUniformLocation | null => {
    if (!locations.has(name)) locations.set(name, g.getUniformLocation(program, name));
    return locations.get(name) ?? null;
  };
  const position = g.getAttribLocation(program, 'a_pos');
  const target = canvas;

  return {
    render(width, height, uniforms, source) {
      const w = Math.max(1, Math.round(width));
      const h = Math.max(1, Math.round(height));
      if (target.width !== w || target.height !== h) {
        target.width = w;
        target.height = h;
      }
      g.viewport(0, 0, w, h);
      g.useProgram(program);
      g.enableVertexAttribArray(position);
      g.vertexAttribPointer(position, 2, g.FLOAT, false, 0, 0);
      if (source) {
        g.activeTexture(g.TEXTURE0);
        g.bindTexture(g.TEXTURE_2D, texture);
        g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, g.RGBA, g.UNSIGNED_BYTE, source);
        g.uniform1i(where('u_tex'), 0);
      }
      g.uniform2f(where('u_res'), w, h);
      for (const [name, value] of Object.entries(uniforms)) {
        const at = where(name);
        if (!at) continue;
        if (typeof value === 'number') g.uniform1f(at, value);
        else if (value.length === 2) g.uniform2f(at, value[0], value[1]);
        else if (value.length === 3) g.uniform3f(at, value[0], value[1], value[2]);
        else g.uniform4f(at, value[0], value[1], value[2], value[3]);
      }
      g.drawArrays(g.TRIANGLES, 0, 3);
      return target;
    },
  };
}
