"use client";

import React, { useEffect, useRef, useState } from "react";

interface ChatBackgroundProps {
  isListening?: boolean;
  isSpeaking?: boolean;
  isProcessing?: boolean;
}

/*
 * Latar area chat bergaya hero studio fraxbit: bidang titik 3D (perspektif) yang
 * bergelombang seperti permukaan laut, sebagian kecil titik berkedip merah aksen,
 * kubah titik (lensa) yang ngikutin kursor, dan memudar ke atas lewat mask. Ditulis
 * ulang sendiri dengan WebGL murni. Gelombang makin tinggi & cepat saat mic / suara /
 * proses aktif.
 */

const VERT = `
attribute vec2 aPos;    // x: -1..1 melintang, y: 0 (dekat) .. 1 (jauh)
attribute float aRnd;   // 0..1 acak per titik

uniform mat4 uMVP;
uniform float uT;
uniform float uHeight;
uniform float uAspect;
uniform float uDpr;
uniform float uSize;
uniform vec2 uPointer;
uniform float uPointerOn;
uniform float uHalfNear;
uniform float uWiden;
uniform float uDomeR;
uniform float uDomeH;
uniform float uDomeDrop;

varying float vA;
varying float vSpark;
varying float vLift;
varying float vBlink;

const float FAR = 12.0;

float swell(vec2 q, float t) {
  float a = sin(q.x * 0.75 + t * 0.55) * 0.32;
  float b = sin(q.y * 0.58 - t * 0.35 + q.x * 0.27) * 0.4;
  float c = sin((q.x - q.y) * 1.6 + t * 0.8) * 0.08;
  return a + b + c;
}

void main() {
  float z = aPos.y * FAR;
  vec2 q = vec2(aPos.x * (uHalfNear + z * uWiden), z);
  float h = swell(q, uT) * uHeight;
  vec4 w = vec4(q.x, h, -q.y, 1.0);

  // Kubah/lensa di sekitar kursor. Jarak dihitung di layar (NDC, dikoreksi aspek),
  // titik pusatnya digeser sedikit ke bawah supaya kubah yang terangkat kelihatan
  // pas di tengah kursor.
  vec4 c = uMVP * w;
  vec2 s = (c.xy / c.w - (uPointer - vec2(0.0, uDomeDrop))) * vec2(uAspect, 1.0);
  float r = length(s) / uDomeR;
  float dome = sqrt(max(1.0 - r * r, 0.0)) * uPointerOn;      // bentuk setengah bola
  float edge = smoothstep(1.0, 0.75, r) * uPointerOn;
  w.y += dome * uDomeH;
  w.x += (s.x / max(length(s), 1e-4)) * dome * dome * 0.18;   // dorong sedikit ke samping
  float lift = max(dome, edge * 0.35);
  c = uMVP * w;
  gl_Position = c;

  float sides = smoothstep(1.0, 0.8, abs(aPos.x));
  float far = smoothstep(0.62, 0.2, aPos.y);
  float near = smoothstep(0.0, 0.05, aPos.y);
  vA = sides * far * near;
  vSpark = step(0.99, aRnd);
  vLift = lift * 0.9 + clamp(h, -0.6, 0.6) * 0.4;
  vBlink = 0.55 + 0.45 * sin(uT * 2.2 + aRnd * 90.0);

  float px = uSize * (1.0 + vSpark * 1.6 + lift * 1.5) / c.w;
  gl_PointSize = max(px, 1.0) * uDpr;
}
`;

const FRAG = `
precision mediump float;
uniform vec3 uInk;
uniform vec3 uRed;
uniform float uOpacity;
varying float vA;
varying float vSpark;
varying float vLift;
varying float vBlink;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float disc = smoothstep(0.5, 0.3, d);
  float shade = 0.55 + vLift;
  float a = disc * vA * uOpacity * mix(shade, vBlink, vSpark);
  gl_FragColor = vec4(mix(uInk, uRed, vSpark), a);
}
`;

type Vec3 = [number, number, number];
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a: Vec3): Vec3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

function perspective(fov: number, aspect: number, near: number, far: number) {
  const f = 1 / Math.tan(fov / 2);
  const nf = 1 / (near - far);
  return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]);
}

function lookAt(eye: Vec3, target: Vec3) {
  const z = norm(sub(eye, target));
  const x = norm(cross([0, 1, 0], z));
  const y = cross(z, x);
  return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, eye), -dot(y, eye), -dot(z, eye), 1]);
}

function mul(a: Float32Array, b: Float32Array) {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++)
      o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  return o;
}

function toRgb(color: string, fallback: Vec3): Vec3 {
  const m = color.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return fallback;
  let hex = m[1];
  if (hex.length === 3) hex = hex.split("").map((ch) => ch + ch).join("");
  const n = parseInt(hex, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) ?? "shader");
  return sh;
}

// Geser seluruh latar ke bawah (px) biar bidang titik lebih turun.
const SHIFT_DOWN = 20;

export function ChatBackground({ isListening = false, isSpeaking = false, isProcessing = false }: ChatBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const energyTarget = useRef(0);
  const [ready, setReady] = useState(false);

  energyTarget.current = isSpeaking ? 1 : isListening ? 0.7 : isProcessing ? 0.4 : 0;

  // Ukuran latar dikunci ke seluruh baris workspace (induk dari <main>), bukan ke <main>.
  // Jadi waktu panel preview kebuka dan area chat menyempit, latar TIDAK ikut mengecil:
  // ukurannya tetap, cuma kepotong oleh <main> yang overflow-hidden.
  useEffect(() => {
    const wrap = wrapRef.current;
    const main = wrap?.parentElement;
    const row = main?.parentElement;
    if (!wrap || !main || !row) return;
    const fit = () => {
      const rr = row.getBoundingClientRect();
      const mr = main.getBoundingClientRect();
      wrap.style.left = `${rr.left - mr.left}px`;
      wrap.style.top = `${rr.top - mr.top + SHIFT_DOWN}px`;
      wrap.style.width = `${rr.width}px`;
      wrap.style.height = `${rr.height}px`;
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(row);
    ro.observe(main);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", { alpha: true, antialias: false, depth: false, premultipliedAlpha: false, powerPreference: "low-power" });
    if (!gl || gl.isContextLost()) return;

    const prog = gl.createProgram()!;
    try {
      gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
      gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    } catch (err) {
      console.warn("[chat-background]", err);
      return;
    }
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);

    const small = window.matchMedia("(max-width: 767px)").matches;
    const cols = small ? 100 : 180;
    const rows = small ? 64 : 90;
    const count = cols * rows;
    const pos = new Float32Array(count * 2);
    const rnd = new Float32Array(count);
    for (let j = 0, i = 0; j < rows; j++)
      for (let k = 0; k < cols; k++, i++) {
        pos[i * 2] = (k / (cols - 1)) * 2 - 1;
        pos[i * 2 + 1] = Math.pow(j / (rows - 1), 1.45);
        rnd[i] = Math.random();
      }
    const buffers = (
      [
        ["aPos", pos, 2],
        ["aRnd", rnd, 1],
      ] as const
    ).map(([name, data, size]) => {
      const b = gl.createBuffer()!;
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, name);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
      return b;
    });

    const u = (n: string) => gl.getUniformLocation(prog, n);
    const U = {
      mvp: u("uMVP"), t: u("uT"), height: u("uHeight"), aspect: u("uAspect"), dpr: u("uDpr"), size: u("uSize"),
      pointer: u("uPointer"), pointerOn: u("uPointerOn"), halfNear: u("uHalfNear"), widen: u("uWiden"),
      domeR: u("uDomeR"), domeH: u("uDomeH"), domeDrop: u("uDomeDrop"),
      ink: u("uInk"), red: u("uRed"), opacity: u("uOpacity"),
    };

    const readColors = () => {
      const cs = getComputedStyle(document.documentElement);
      gl.uniform3fv(U.ink, toRgb(cs.getPropertyValue("--fg"), [0.07, 0.08, 0.09]));
      gl.uniform3fv(U.red, toRgb(cs.getPropertyValue("--accent"), [0.94, 0.14, 0.24]));
    };
    readColors();

    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let proj = perspective(Math.PI / 5, 1, 0.1, 60);
    let aspect = 1;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, small ? 1.5 : 2);
      const cw = canvas.clientWidth;
      const ch = canvas.clientHeight;
      if (!cw || !ch) return;
      canvas.width = Math.round(cw * dpr);
      canvas.height = Math.round(ch * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
      aspect = cw / ch;
      const fov = aspect < 1 ? Math.PI / 3 : Math.PI / 5;
      proj = perspective(fov, aspect, 0.1, 60);
      const widen = Math.tan(fov / 2) * aspect * 1.3;
      gl.uniform1f(U.widen, widen);
      gl.uniform1f(U.halfNear, 2.8 * widen);
      gl.uniform1f(U.aspect, aspect);
      gl.uniform1f(U.dpr, dpr);
      gl.uniform1f(U.size, small ? 7 : 8);
      // ukuran kubah: radius di layar (relatif tinggi area), tinggi angkat, dan koreksi posisi
      gl.uniform1f(U.domeR, small ? 0.3 : 0.24);
      gl.uniform1f(U.domeH, 0.32);
      gl.uniform1f(U.domeDrop, 0.2);
    };

    const view = lookAt([0, 1.15, 2.3], [0, 0.35, -6]);
    const state = { t: 12, energy: 0, intro: reduced ? 1 : 0, px: 0, py: -0.4, tx: 0, ty: -0.4, on: 0, onTarget: 0 };

    const render = () => {
      gl.uniformMatrix4fv(U.mvp, false, mul(proj, view));
      gl.uniform1f(U.t, state.t);
      gl.uniform1f(U.height, state.intro * (1 + state.energy * 0.9));
      gl.uniform1f(U.opacity, state.intro * (0.75 + state.energy * 0.25));
      gl.uniform2f(U.pointer, state.px, state.py);
      gl.uniform1f(U.pointerOn, state.on);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.POINTS, 0, count);
    };

    let raf = 0;
    let last = performance.now();
    let visible = true;
    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      state.energy += (energyTarget.current - state.energy) * 0.04;
      state.t += dt * (1 + state.energy * 1.4);
      state.intro += (1 - state.intro) * 0.025;
      // ngikutin kursor dengan halus, sama cepatnya di 60 atau 120 fps
      const kf = 1 - Math.pow(0.9, dt * 60);
      state.px += (state.tx - state.px) * kf;
      state.py += (state.ty - state.py) * kf;
      state.on += (state.onTarget - state.on) * (1 - Math.pow(0.94, dt * 60));
      render();
      raf = requestAnimationFrame(frame);
    };
    const sync = () => {
      cancelAnimationFrame(raf);
      if (reduced || !visible || document.hidden) return;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    };

    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      const inside = e.clientY >= r.top && e.clientY <= r.bottom && e.clientX >= r.left && e.clientX <= r.right;
      state.onTarget = inside ? 1 : 0;
      if (inside) {
        state.tx = ((e.clientX - r.left) / r.width) * 2 - 1;
        state.ty = -(((e.clientY - r.top) / r.height) * 2 - 1);
      }
    };
    const onLeave = () => (state.onTarget = 0);
    const onTheme = () => {
      readColors();
      if (reduced) render();
    };

    const ro = new ResizeObserver(() => {
      resize();
      if (reduced) render();
    });
    ro.observe(canvas);
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      sync();
    });
    io.observe(canvas);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    window.addEventListener("vox-theme", onTheme);
    mq.addEventListener("change", onTheme);
    document.addEventListener("visibilitychange", sync);
    if (!reduced) {
      window.addEventListener("pointermove", onMove, { passive: true });
      document.documentElement.addEventListener("pointerleave", onLeave);
    }

    resize();
    render();
    setReady(true);
    sync();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener("vox-theme", onTheme);
      mq.removeEventListener("change", onTheme);
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      // Jangan loseContext(): React StrictMode memasang ulang efek di canvas yang sama,
      // dan context yang sudah "hilang" bikin canvas jadi bidang putih polos.
      buffers.forEach((b) => gl.deleteBuffer(b));
      gl.deleteProgram(prog);
      setReady(false);
    };
  }, []);

  return (
    <div
      ref={wrapRef}
      aria-hidden="true"
      className="absolute inset-0 pointer-events-none [mask-image:linear-gradient(to_bottom,transparent_30%,black_75%)]"
    >
      <canvas
        ref={canvasRef}
        className={`size-full transition-opacity duration-1000 ${ready ? "opacity-60 sm:opacity-100" : "opacity-0"}`}
      />
    </div>
  );
}
