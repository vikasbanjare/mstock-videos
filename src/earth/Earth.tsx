/**
 * Shared Earth engine for the four films: a real-texture globe (NASA Blue Marble day + city lights,
 * via the three.js example textures), a soft terminator, clouds, atmosphere, stars, and a generic
 * additive glow-points layer used for city flares, rivers of light and market dots.
 */
import { useThree } from "@react-three/fiber";
import { geoEquirectangular, geoPath } from "d3-geo";
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { continueRender, delayRender, staticFile } from "remotion";
import * as THREE from "three";
import { feature } from "topojson-client";
import countries from "world-atlas/countries-50m.json";

export type Tex = { day: THREE.Texture; night: THREE.Texture; spec: THREE.Texture; clouds: THREE.Texture; mask: THREE.Texture };

/** Equirectangular mask (white = country), drawn from Natural Earth via world-atlas. */
const countryMask = (ids: string[], blur = 2) => {
  const c = document.createElement("canvas");
  c.width = 2048;
  c.height = 1024;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, 2048, 1024);
  const proj = geoEquirectangular().scale(1024 / Math.PI).translate([1024, 512]);
  const path = geoPath(proj, ctx);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fc = feature(countries as any, (countries as any).objects.countries) as any;
  ctx.filter = `blur(${blur}px)`;
  ctx.fillStyle = "#fff";
  for (const f of fc.features) {
    if (!ids.includes(String(f.id))) continue;
    ctx.beginPath();
    path(f);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
};

/** The country feature itself (for sampling points inside it). */
export const countryFeature = (id: string) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fc = feature(countries as any, (countries as any).objects.countries) as any;
  return fc.features.find((f: { id: string }) => String(f.id) === id);
};

export const useEarthTextures = (maskIds: string[] = ["356"]): Tex | null => {
  const [tex, setTex] = useState<Tex | null>(null);
  const [handle] = useState(() => delayRender("Loading Earth textures"));
  useEffect(() => {
    const loader = new THREE.TextureLoader();
    const load = (p: string, srgb: boolean) =>
      new Promise<THREE.Texture>((res, rej) =>
        loader.load(
          staticFile(p),
          (t) => {
            if (srgb) t.colorSpace = THREE.SRGBColorSpace;
            t.anisotropy = 8;
            res(t);
          },
          undefined,
          rej,
        ),
      );
    Promise.all([
      load("earth/earth_day_4096.jpg", true),
      load("earth/earth_lights_2048.png", true),
      load("earth/earth_specular_2048.jpg", false),
      load("earth/clouds_l.png", false),
    ]).then(([day, night, spec, clouds]) => {
      setTex({ day, night, spec, clouds, mask: countryMask(maskIds) });
      continueRender(handle);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return tex;
};

const earthVert = /* glsl */ `
varying vec2 vUv; varying vec3 vN; varying vec3 vW;
void main(){
  vUv = uv;
  vN = normalize(mat3(modelMatrix) * normal);
  vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const earthFrag = /* glsl */ `
uniform sampler2D day, night, spec, mask;
uniform vec3 sun; uniform float maskLights, worldLights, dayGain, lightsGain;
uniform vec3 lightTint;
varying vec2 vUv; varying vec3 vN; varying vec3 vW;
void main(){
  vec3 n = normalize(vN);
  vec3 v = normalize(cameraPosition - vW);
  float d = dot(n, sun);
  float dayK = smoothstep(-0.10, 0.16, d);
  vec3 col = texture2D(day, vUv).rgb;
  float g = dot(col, vec3(0.299,0.587,0.114));
  col = mix(vec3(g), col, 0.82);                                   // a touch desaturated, more filmic
  vec3 lit = col * (0.05 + 1.5 * pow(max(d, 0.0), 0.8)) * dayGain;
  float term = exp(-pow((d - 0.02) / 0.11, 2.0));
  lit += vec3(1.0, 0.42, 0.12) * term * 0.16 * col.r * 3.0;       // warm dusk band
  // ocean glint
  float s = texture2D(spec, vUv).r;
  vec3 h = normalize(sun + v);
  lit += vec3(1.0, 0.86, 0.7) * pow(max(dot(n, h), 0.0), 500.0) * s * 0.22 * dayK;
  // night side: faint navy plus city lights
  vec3 nightBase = col * vec3(0.10, 0.16, 0.30) * 0.10;
  float L = texture2D(night, vUv).r;
  L = pow(L, 1.35);
  float m = texture2D(mask, vUv).r;
  float on = mix(worldLights, maskLights, m);
  float dark = 1.0 - smoothstep(-0.16, 0.06, d);
  vec3 lights = lightTint * L * on * dark * lightsGain;
  vec3 outc = mix(nightBase, lit, dayK) + lights;
  float rim = pow(max(dot(n, v), 0.0), 0.35);
  outc *= mix(0.6, 1.0, rim);
  // atmospheric haze thickening toward the limb
  float haze = pow(1.0 - max(dot(n, v), 0.0), 3.0);
  vec3 hz = mix(vec3(0.30, 0.56, 1.0), vec3(1.0, 0.48, 0.18), exp(-pow((d - 0.02) / 0.2, 2.0)) * 0.85);
  outc += hz * haze * 0.55 * smoothstep(-0.3, 0.25, d);
  gl_FragColor = vec4(outc, 1.0);
}`;

const cloudFrag = /* glsl */ `
uniform sampler2D clouds; uniform vec3 sun; uniform float amount;
varying vec2 vUv; varying vec3 vN; varying vec3 vW;
void main(){
  vec3 n = normalize(vN);
  float d = dot(n, sun);
  float a = texture2D(clouds, vUv).r;
  float lit = smoothstep(-0.12, 0.25, d);
  vec3 c = vec3(1.0) * (0.04 + 0.95 * max(d, 0.0));
  c += vec3(1.0, 0.45, 0.15) * exp(-pow((d - 0.03) / 0.1, 2.0)) * 0.25;
  gl_FragColor = vec4(c, a * amount * (0.12 + 0.88 * lit));
}`;

const atmoFrag = /* glsl */ `
uniform vec3 sun; uniform float gain;
varying vec2 vUv; varying vec3 vN; varying vec3 vW;
void main(){
  // impact parameter of the view ray: glow falls off smoothly with height above the limb
  vec3 d = normalize(vW - cameraPosition);
  float tc = -dot(cameraPosition, d);
  vec3 p = tc > 0.0 ? cameraPosition + d * tc : cameraPosition;
  float h = length(p) - 1.0;
  float dens = exp(-max(h, 0.0) / 0.011);
  float s = dot(normalize(p), sun);
  vec3 blue = vec3(0.30, 0.56, 1.0);
  vec3 dusk = vec3(1.0, 0.48, 0.18);
  vec3 c = mix(blue, dusk, exp(-pow((s - 0.02) / 0.2, 2.0)) * 0.85);
  float lit = smoothstep(-0.3, 0.25, s);
  gl_FragColor = vec4(c * dens * (0.04 + 1.0 * lit) * gain, 1.0);
}`;

export const Globe: React.FC<{
  tex: Tex;
  sun: THREE.Vector3;
  maskLights: number;
  worldLights: number;
  dayGain?: number;
  lightsGain?: number;
  clouds?: number;
  cloudSpin?: number;
  atmo?: number;
}> = ({ tex, sun, maskLights, worldLights, dayGain = 1, lightsGain = 2.4, clouds = 0.55, cloudSpin = 0, atmo = 1 }) => {
  const earthMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: earthVert,
        fragmentShader: earthFrag,
        uniforms: {
          day: { value: tex.day },
          night: { value: tex.night },
          spec: { value: tex.spec },
          mask: { value: tex.mask },
          sun: { value: new THREE.Vector3() },
          maskLights: { value: 0 },
          worldLights: { value: 0 },
          dayGain: { value: 1 },
          lightsGain: { value: 1 },
          lightTint: { value: new THREE.Color(1.0, 0.7, 0.36) },
        },
      }),
    [tex],
  );
  const cloudMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: earthVert,
        fragmentShader: cloudFrag,
        transparent: true,
        depthWrite: false,
        uniforms: { clouds: { value: tex.clouds }, sun: { value: new THREE.Vector3() }, amount: { value: 0.5 } },
      }),
    [tex],
  );
  const atmoMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: earthVert,
        fragmentShader: atmoFrag,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        uniforms: { sun: { value: new THREE.Vector3() }, gain: { value: 1 } },
      }),
    [],
  );
  const atmoFront = useMemo(() => {
    const m = atmoMat.clone();
    m.side = THREE.FrontSide;
    m.uniforms = { sun: { value: new THREE.Vector3() }, gain: { value: 0.35 } };
    return m;
  }, [atmoMat]);
  const { invalidate } = useThree();
  useLayoutEffect(() => {
    earthMat.uniforms.sun.value.copy(sun);
    earthMat.uniforms.maskLights.value = maskLights;
    earthMat.uniforms.worldLights.value = worldLights;
    earthMat.uniforms.dayGain.value = dayGain;
    earthMat.uniforms.lightsGain.value = lightsGain;
    cloudMat.uniforms.sun.value.copy(sun);
    cloudMat.uniforms.amount.value = clouds;
    atmoMat.uniforms.sun.value.copy(sun);
    atmoMat.uniforms.gain.value = atmo;
    atmoFront.uniforms.sun.value.copy(sun);
    atmoFront.uniforms.gain.value = 0.35 * atmo;
    invalidate();
  });
  return (
    <>
      <mesh material={earthMat}>
        <sphereGeometry args={[1, 192, 128]} />
      </mesh>
      <mesh material={cloudMat} rotation={[0, cloudSpin, 0]}>
        <sphereGeometry args={[1.006, 160, 96]} />
      </mesh>
      <mesh material={atmoMat}>
        <sphereGeometry args={[1.08, 128, 96]} />
      </mesh>
    </>
  );
};

/* ---------------------------------------------------------------- glow points */
const pointsVert = /* glsl */ `
attribute float size; attribute float alpha; attribute vec3 tint;
uniform float scale, maxPx, nearFade;
varying float vA; varying vec3 vC;
void main(){
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  float px = size * scale / -mv.z;
  gl_PointSize = clamp(px, 1.0, maxPx);
  vA = alpha * min(1.0, px / max(1.0, px)) * smoothstep(nearFade * 0.4, nearFade, -mv.z);
  vC = tint;
}`;
const pointsFrag = /* glsl */ `
varying float vA; varying vec3 vC;
void main(){
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float r = dot(p, p);
  if (r > 1.0) discard;
  float core = exp(-r * 9.0);
  float halo = exp(-r * 2.6) * 0.35;
  gl_FragColor = vec4(vC * (core + halo) * vA, 1.0);
}`;

/** A fixed-capacity additive points layer. `fill` writes positions/size/alpha/tint each frame. */
export const GlowPoints: React.FC<{
  count: number;
  fill: (pos: Float32Array, size: Float32Array, alpha: Float32Array, tint: Float32Array) => void;
  depthTest?: boolean;
  t: number;
  maxPx?: number;
  nearFade?: number;
}> = ({ count, fill, depthTest = true, t, maxPx = 96, nearFade = 0 }) => {
  const { geo, mat } = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    g.setAttribute("size", new THREE.BufferAttribute(new Float32Array(count), 1));
    g.setAttribute("alpha", new THREE.BufferAttribute(new Float32Array(count), 1));
    g.setAttribute("tint", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 100);
    const m = new THREE.ShaderMaterial({
      vertexShader: pointsVert,
      fragmentShader: pointsFrag,
      transparent: true,
      depthWrite: false,
      depthTest,
      blending: THREE.AdditiveBlending,
      uniforms: { scale: { value: 1 }, maxPx: { value: 96 }, nearFade: { value: 0 } },
    });
    return { geo: g, mat: m };
  }, [count, depthTest]);
  const { size, gl, invalidate } = useThree();
  const ref = useRef<THREE.Points>(null);
  useLayoutEffect(() => {
    const a = geo.attributes;
    fill(a.position.array as Float32Array, a.size.array as Float32Array, a.alpha.array as Float32Array, a.tint.array as Float32Array);
    a.position.needsUpdate = a.size.needsUpdate = a.alpha.needsUpdate = a.tint.needsUpdate = true;
    // world-size → pixels for a 35° vertical fov
    mat.uniforms.maxPx.value = maxPx * gl.getPixelRatio() * (size.height / 1080);
    mat.uniforms.nearFade.value = nearFade;
    mat.uniforms.scale.value = (size.height * gl.getPixelRatio()) / (2 * Math.tan((35 * Math.PI) / 360));
    invalidate();
  }, [t, fill, geo, mat, size, gl, invalidate, maxPx, nearFade]);
  return <points ref={ref} geometry={geo} material={mat} frustumCulled={false} />;
};

/** Deterministic random. */
export const rng = (seed: number) => {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let x = s;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
};

export const Stars: React.FC<{ t: number; n?: number; gain?: number }> = ({ t, n = 2600, gain = 1 }) => {
  const data = useMemo(() => {
    const r = rng(7);
    return Array.from({ length: n }, () => {
      const u = r() * 2 - 1;
      const th = r() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      return { x: s * Math.cos(th) * 60, y: u * 60, z: s * Math.sin(th) * 60, m: Math.pow(r(), 6), tw: r() * 6.28, w: r() };
    });
  }, [n]);
  const fill = useMemo(
    () => (pos: Float32Array, size: Float32Array, alpha: Float32Array, tint: Float32Array) => {
      data.forEach((s, i) => {
        pos.set([s.x, s.y, s.z], i * 3);
        size[i] = 0.1 + s.m * 0.35;
        alpha[i] = gain * (0.25 + 0.75 * s.m) * (0.85 + 0.15 * Math.sin(t * 2 + s.tw));
        tint.set(s.w > 0.85 ? [1, 0.85, 0.7] : [0.8, 0.88, 1], i * 3);
      });
    },
    [data, t, gain],
  );
  return <GlowPoints count={n} fill={fill} t={t} />;
};
