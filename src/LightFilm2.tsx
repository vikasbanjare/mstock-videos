/**
 * Light film v2: same story, music and sound as v1, rebuilt for motion.
 * - one light line morphs through every scene (crack → horizon → ring → ₹ → arc → app → chart → comma)
 * - the camera never stops: drift and breathing plus one motivated move per scene
 * - a parallax layer of light dust keeps every frame alive
 * - the light pulses on every music beat
 */
import React, { useLayoutEffect, useRef } from "react";
import { AbsoluteFill, Html5Audio, Img, Sequence, staticFile, useCurrentFrame } from "remotion";
import { Field, Line, Odometer, S, glow } from "./LightFilm";
import { SHAPES, Pt, blend, sample, toD } from "./morph";
import { FPS, inExpo, inOut, outExpo, tw } from "./theme";
import timings from "./timings.json";

const OR = "#F58220";
const HOT = "#FFC48A";
const INK = "rgba(255,255,255,0.9)";
const DIM = "rgba(255,255,255,0.46)";
const F = "'Open Sans', sans-serif";
const BEATS: number[] = timings.beats;
const LOGO_T = 27.85;

const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
const hash = (i: number, j = 0) => {
  const x = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
  return x - Math.floor(x);
};
const win = (t: number, a: number, b: number, fi = 0.5, fo = 0.4) => Math.min(tw(t, a, a + fi), 1 - tw(t, b - fo, b, 0, 1, inExpo));

/** 0..1 flash that decays after each music beat. */
const beatPulse = (t: number) => {
  let best = 0;
  for (const b of BEATS) if (t >= b && t - b < 0.6) best = Math.max(best, Math.exp(-(t - b) / 0.18));
  return best;
};

/* ------------------------------------------------------------------ camera: always moving */
const camera = (t: number) => {
  let s = 1 + 0.025 * Math.sin(t * 0.42);
  let x = 14 * Math.sin(t * 0.27);
  let y = 9 * Math.sin(t * 0.33 + 1);
  let r = 0.35 * Math.sin(t * 0.21);
  let ox = 960;
  let oy = 540;
  // 1 · creep toward the crack
  if (t < S.door) s *= lerp(1, 1.12, tw(t, 0, S.door, 0, 1, (k) => k));
  // 2 · door: continue the push, then dive through it
  else if (t < S.us) {
    s *= 1.12 + 0.08 * tw(t, S.door, S.us - 1, 0, 1, (k) => k);
    s *= 1 + 9 * Math.pow(tw(t, S.us - 1.0, S.us, 0, 1, (k) => k), 2.6);
  }
  // 3 · horizon: pull back from close on the line
  else if (t < S.slice) {
    s *= lerp(1.18, 1.0, tw(t, S.us, S.us + 2.4, 0, 1, outExpo));
    y += lerp(-40, 0, tw(t, S.us, S.us + 2.4, 0, 1, outExpo));
  }
  // 4 · disc: truck right and push toward $1
  else if (t < S.count) {
    const k = tw(t, S.slice, S.count, 0, 1, (q) => q);
    s *= lerp(1.0, 1.1, k);
    x += lerp(60, -70, k);
    ox = 900;
  }
  // 5 · points: the field flies past on its own; the frame rolls a touch
  else if (t < S.digital) r += lerp(-1.2, 1.2, tw(t, S.count, S.digital, 0, 1, (q) => q));
  // 6 · ring and ₹: slow push
  else if (t < S.app) s *= lerp(1.02, 1.1, tw(t, S.digital, S.app, 0, 1, (q) => q));
  // 7 · India–US: truck left to right with the arc
  else if (t < S.end) {
    x += lerp(80, -80, tw(t, S.app, S.end, 0, 1, inOut));
    s *= 1.04;
  }
  // 8 · chart: ride up the line, then settle dead still for the lockup
  else {
    const k = tw(t, S.end, LOGO_T, 0, 1, inOut);
    s *= lerp(1.12, 1.0, k);
    x += lerp(140, 0, k);
    y += lerp(-60, 0, k);
    const still = tw(t, LOGO_T, LOGO_T + 0.6);
    s = lerp(s, 1, still);
    x = lerp(x, 0, still);
    y = lerp(y, 0, still);
    r = lerp(r, 0, still);
  }
  return { s, x, y, r, ox, oy };
};

/* ------------------------------------------------------------------ light dust with parallax */
const Dust: React.FC<{ t: number; cx: number; cy: number }> = ({ t, cx, cy }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const g = ref.current!.getContext("2d")!;
    g.clearRect(0, 0, 1920, 1080);
    const level = 1 - 0.75 * tw(t, LOGO_T, LOGO_T + 0.8);
    for (let i = 0; i < 260; i++) {
      const d = 0.25 + hash(i, 1) * 0.9; // depth: near motes move more
      const x = (hash(i) * 2200 + t * (8 + 26 * d) * (hash(i, 3) - 0.3) * 2 + cx * d * 1.6) % 2200 - 140;
      const y = (hash(i, 2) * 1300 - t * (6 + 20 * d) + cy * d * 1.6 + 1300 * 4) % 1300 - 110;
      const tw2 = 0.5 + 0.5 * Math.sin(t * (1 + hash(i, 4) * 2) + i);
      const a = (0.04 + 0.22 * d * tw2) * level;
      const r = 0.6 + d * 2.2;
      g.fillStyle = hash(i, 5) > 0.7 ? `rgba(245,150,70,${a})` : `rgba(220,230,255,${a * 0.8})`;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
      if (d > 1.0) {
        // the nearest few are out of focus
        g.fillStyle = `rgba(255,200,150,${a * 0.25})`;
        g.beginPath();
        g.arc(x, y, r * 4, 0, Math.PI * 2);
        g.fill();
      }
    }
  }, [t, cx, cy]);
  return <canvas ref={ref} width={1920} height={1080} style={{ position: "absolute", inset: 0, mixBlendMode: "screen" }} />;
};

/* ------------------------------------------------------------------ the light line */
type Key = { at: number; shape: keyof typeof SHAPES; dur: number; wave?: number };
const KEYS: Key[] = [
  { at: 0, shape: "crack", dur: 0 },
  { at: S.us - 0.02, shape: "horizon", dur: 0 },
  { at: S.slice + 0.05, shape: "ring", dur: 0.95, wave: 0.45 },
  { at: S.digital + 0.55, shape: "progress", dur: 0 },
  { at: S.digital + 2.8, shape: "rupee", dur: 0.9, wave: 0.3 },
  { at: S.app + 0.05, shape: "arc", dur: 0.8, wave: 0.25 },
  { at: S.app + 1.55, shape: "app", dur: 0.9, wave: 0.4 },
  { at: S.end + 0.02, shape: "chart", dur: 1.0, wave: 0.5 },
  { at: LOGO_T - 0.45, shape: "comma", dur: 0.5, wave: 0.2 },
];

const lineState = (t: number): { pts: Pt[]; from: number; to: number; alpha: number } => {
  let k = 0;
  while (k + 1 < KEYS.length && KEYS[k + 1].at <= t) k++;
  const key = KEYS[k];
  const target = sample(SHAPES[key.shape]);
  let pts = target;
  if (k > 0 && key.dur > 0 && t < key.at + key.dur) {
    pts = blend(sample(SHAPES[KEYS[k - 1].shape]), target, (t - key.at) / key.dur, key.wave ?? 0.35);
  }
  let from = 0;
  let to = 1;
  let alpha = 1;
  switch (key.shape) {
    case "crack": {
      const g = tw(t, 0.15, 1.1, 0, 1, outExpo);
      from = 0.5 - g / 2;
      to = 0.5 + g / 2;
      alpha = 1 - tw(t, S.door + 0.2, S.door + 0.9);
      break;
    }
    case "horizon": {
      const g = tw(t, S.us, S.us + 0.9, 0, 1, outExpo);
      from = 0.5 - g / 2;
      to = 0.5 + g / 2;
      break;
    }
    case "ring":
      // the ring dissolves into the burst of points
      alpha = 1 - tw(t, S.count - 0.15, S.count + 0.25);
      if (t > S.count + 0.3 && t < S.digital + 0.55) alpha = 0;
      break;
    case "progress":
      to = tw(t, S.digital + 0.7, S.digital + 2.2, 0.002, 1, inOut);
      alpha = tw(t, S.digital + 0.55, S.digital + 0.8);
      break;
    case "comma":
      alpha = 1 - tw(t, LOGO_T + 0.05, LOGO_T + 0.4);
      break;
  }
  return { pts, from, to, alpha };
};

const LightLine: React.FC<{ t: number }> = ({ t }) => {
  const { pts, from, to, alpha } = lineState(t);
  if (alpha <= 0.001) return null;
  const d = toD(pts, from, to);
  const pulse = beatPulse(t);
  const head = pts[Math.min(pts.length - 1, Math.floor(to * (pts.length - 1)))];
  const showHead = t > S.end + 0.1 && t < LOGO_T + 0.4;
  return (
    <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, overflow: "visible", opacity: alpha }}>
      <defs>
        <filter id="wide" filterUnits="userSpaceOnUse" x="-200" y="-200" width="2320" height="1480">
          <feGaussianBlur stdDeviation="14" />
        </filter>
        <filter id="mid" filterUnits="userSpaceOnUse" x="-200" y="-200" width="2320" height="1480">
          <feGaussianBlur stdDeviation="3.5" />
        </filter>
      </defs>
      <path d={d} fill="none" stroke={OR} strokeWidth={22} strokeLinecap="round" strokeLinejoin="round" filter="url(#wide)" opacity={0.32 + 0.35 * pulse} />
      <path d={d} fill="none" stroke={OR} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" filter="url(#mid)" opacity={0.85} />
      <path d={d} fill="none" stroke="#FFE6CC" strokeWidth={2.4 + 0.8 * pulse} strokeLinecap="round" strokeLinejoin="round" />
      {showHead ? (
        <g opacity={tw(t, S.end + 0.6, S.end + 0.9)}>
          <circle cx={head[0]} cy={head[1]} r={20 + 10 * pulse} fill={OR} filter="url(#wide)" opacity={0.7} />
          <circle cx={head[0]} cy={head[1]} r={8} fill="#fff" />
        </g>
      ) : null}
    </svg>
  );
};

/* ------------------------------------------------------------------ the film */
export const LightFilm2: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const cam = camera(t);
  const pulse = beatPulse(t);

  // door
  const crackH = 480;
  const doorW = tw(t, S.door - 0.1, S.door + 1.2, 2, 380, inOut);
  const doorOn = t > S.door - 0.15 && t < S.us + 0.1;
  const flicker = 0.9 + 0.1 * Math.sin(t * 23) * Math.sin(t * 7.3);
  const whiteout = tw(t, S.us - 0.22, S.us - 0.02);

  // disc and slice
  const discOn = win(t, S.slice + 0.6, S.count + 0.2, 0.6, 0.35);
  const sliceIn = tw(t, S.slice + 0.95, S.slice + 1.4, 0, 1, outExpo);
  const sliceOut = tw(t, S.slice + 1.1, S.slice + 1.8, 0, 1, outExpo);
  const sliceGone = tw(t, S.count - 0.2, S.count + 0.25, 0, 1, inExpo);
  const R = 230;
  const wedge = `M0 0 L${R} 0 A${R} ${R} 0 0 0 ${R * Math.cos((-40 * Math.PI) / 180)} ${R * Math.sin((-40 * Math.PI) / 180)} Z`;

  // India and US
  const dots = win(t, S.app + 0.3, S.app + 1.75, 0.35, 0.3);

  const logo = tw(t, LOGO_T, LOGO_T + 0.7, 0, 1, outExpo);
  const end = tw(t, LOGO_T + 0.6, LOGO_T + 1.1);

  // type drifts while it holds, so a reading frame is never frozen
  const drift = (a: number) => ({ transform: `translateY(${-(t - a) * 7}px)` });

  return (
    <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 46%, #0C1E36 0%, #071226 42%, #02060D 100%)", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: -200, background: `radial-gradient(ellipse at ${40 + Math.sin(t * 0.3) * 10}% ${55 + Math.cos(t * 0.25) * 8}%, rgba(4,59,114,${0.5 + 0.12 * pulse}) 0%, rgba(4,59,114,0) 55%)` }} />
      <Dust t={t} cx={cam.x} cy={cam.y} />

      {/* ───────────── the world, under one moving camera */}
      <div style={{ position: "absolute", inset: 0, transformOrigin: `${cam.ox}px ${cam.oy}px`, transform: `translate(${cam.x}px, ${cam.y}px) scale(${cam.s}) rotate(${cam.r}deg)` }}>
        {/* door */}
        {doorOn ? (
          <>
            <div
              style={{
                position: "absolute",
                left: 960 - 900,
                top: 780,
                width: 1800,
                height: 300,
                clipPath: `polygon(${50 - (doorW / 1800) * 50}% 0, ${50 + (doorW / 1800) * 50}% 0, 100% 100%, 0 100%)`,
                background: "linear-gradient(to bottom, rgba(245,130,32,0.55), rgba(245,130,32,0))",
                opacity: tw(t, S.door, S.door + 1.0),
              }}
            />
            <div style={{ position: "absolute", left: 960 - doorW / 2 - 120, top: 300 - 120, width: doorW + 240, height: crackH + 240, borderRadius: 60, background: OR, filter: "blur(70px)", opacity: (0.22 + 0.5 * tw(t, S.door, S.door + 1.2)) * (0.85 + 0.3 * pulse) }} />
            <div
              style={{
                position: "absolute",
                left: 960 - doorW / 2,
                top: 540 - crackH / 2,
                width: doorW,
                height: crackH,
                borderRadius: 4,
                background: `radial-gradient(ellipse at 50% 60%, #FFFFFF 0%, ${HOT} ${18 + 10 * tw(t, S.door, S.door + 1)}%, ${OR} 70%, #C8590A 100%)`,
                boxShadow: glow(flicker),
                opacity: tw(t, S.door - 0.15, S.door + 0.2) * flicker,
              }}
            />
            {Array.from({ length: 26 }, (_, i) => {
              const st = S.door + 0.4 + (i % 13) * 0.11;
              const q = clamp((t - st) / 2.2);
              if (q <= 0 || q >= 1) return null;
              const x = 960 + (hash(i) - 0.5) * doorW * 1.4 + Math.sin(t * 2 + i) * 10;
              const y = 760 - q * (380 + hash(i, 1) * 200);
              return <div key={i} style={{ position: "absolute", left: x, top: y, width: 4, height: 4, borderRadius: 2, background: HOT, opacity: Math.sin(q * Math.PI) * 0.8, boxShadow: `0 0 8px ${OR}` }} />;
            })}
          </>
        ) : null}

        {/* disc and the slice of light */}
        {discOn > 0 ? (
          <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, opacity: discOn, overflow: "visible" }}>
            <defs>
              <radialGradient id="disc2" cx="40%" cy="35%">
                <stop offset="0%" stopColor="#1C3D66" />
                <stop offset="100%" stopColor="#0A1A30" />
              </radialGradient>
              <radialGradient id="slice2" cx="30%" cy="30%">
                <stop offset="0%" stopColor="#FFD3A6" />
                <stop offset="55%" stopColor={OR} />
                <stop offset="100%" stopColor="#C2560A" />
              </radialGradient>
              <filter id="soft2"><feGaussianBlur stdDeviation="20" /></filter>
            </defs>
            <g transform={`translate(640 540) rotate(${(t - S.slice) * 6})`}>
              <circle r={R - 2} fill="url(#disc2)" />
              {/* fine engraved rings on the disc so it reads as an object, not a flat circle */}
              {Array.from({ length: 9 }, (_, i) => (
                <circle key={i} r={R - 22 - i * 22} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
              ))}
            </g>
            <g transform={`translate(640 540) translate(${sliceOut * 80 * (1 - sliceGone)} ${-sliceOut * 52 * (1 - sliceGone)}) scale(${(1 - sliceGone) * (0.96 + 0.04 * sliceIn)})`} opacity={sliceIn}>
              <path d={wedge} fill={OR} filter="url(#soft2)" opacity={0.65 * sliceOut * (0.8 + 0.4 * pulse)} />
              <path d={wedge} fill="url(#slice2)" />
            </g>
          </svg>
        ) : null}

        {/* 5,000 points */}
        <Field t={t} />

        {/* India and US */}
        {dots > 0 ? (
          <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, opacity: dots }}>
            {[560, 1360].map((x, i) => (
              <g key={i}>
                <circle cx={x} cy={500} r={20 + 8 * pulse} fill={OR} opacity={0.35} style={{ filter: "blur(6px)" }} />
                <circle cx={x} cy={500} r={8} fill="#fff" />
                <text x={x} y={556} textAnchor="middle" fontFamily="Open Sans" fontWeight={600} fontSize={22} letterSpacing="5" fill={DIM}>
                  {i ? "US" : "INDIA"}
                </text>
              </g>
            ))}
          </svg>
        ) : null}

        {/* the one light line that becomes every shape */}
        <LightLine t={t} />

        {/* type lives in the world and drifts with it */}
        <div style={drift(0.7)}>
          <Line t={t} text="How many do you own?" at={0.7} out={S.door - 0.05} y={880} />
        </div>
        <div style={drift(S.door)}>
          <Line t={t} text="Now you can." at={S.door + 0.45} out={S.us - 0.75} y={880} weight={400} />
        </div>
        {t > S.us - 0.05 && t < S.slice + 0.25 ? (
          <>
            <div style={{ position: "absolute", left: 0, right: 0, top: 360, textAlign: "center", opacity: 1 - tw(t, S.slice - 0.2, S.slice + 0.2), filter: `blur(${tw(t, S.slice - 0.2, S.slice + 0.2) * 12}px)` }}>
              <div
                style={{
                  display: "inline-block",
                  fontFamily: F,
                  fontWeight: 600,
                  fontSize: 170,
                  letterSpacing: `${-0.03 + 0.02 * tw(t, S.us, S.slice, 0, 1, (k) => k)}em`,
                  color: "#fff",
                  clipPath: `inset(0 ${100 - tw(t, S.us + 0.25, S.us + 1.2, 0, 100, outExpo)}% 0 0)`,
                  textShadow: `0 0 ${30 + 30 * pulse}px rgba(245,130,32,0.3)`,
                }}
              >
                US stocks,
              </div>
            </div>
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: 660,
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: 26,
                opacity: tw(t, S.us + 1.6, S.us + 2.2) * (1 - tw(t, S.slice - 0.2, S.slice + 0.2)),
                filter: `blur(${(1 - tw(t, S.us + 1.6, S.us + 2.2)) * 10}px)`,
                transform: `translateY(${(1 - tw(t, S.us + 1.6, S.us + 2.4, 0, 1, outExpo)) * 30}px)`,
              }}
            >
              <span style={{ fontFamily: F, fontWeight: 300, fontSize: 64, color: INK }}>on</span>
              <Img src={staticFile("brand/mstock-logo-dark.svg")} style={{ height: 120 }} />
            </div>
          </>
        ) : null}
        <div style={drift(S.slice)}>
          <Line t={t} text="Own a slice." at={S.slice + 1.1} out={S.count - 0.1} x={1060} y={330} align="left" size={60} />
        </div>
        {t > S.slice + 1.9 && t < S.count + 0.1 ? (
          <div style={{ position: "absolute", left: 1060, top: 430, display: "flex", alignItems: "baseline", gap: 24, opacity: win(t, S.slice + 1.9, S.count + 0.1, 0.4, 0.35), transform: `scale(${0.94 + 0.06 * tw(t, S.slice + 1.9, S.slice + 2.6, 0, 1, outExpo)})`, transformOrigin: "0 70%" }}>
            <span style={{ fontFamily: F, fontWeight: 300, fontSize: 60, color: INK }}>From</span>
            <svg width={330} height={230} style={{ overflow: "visible" }}>
              <defs>
                <linearGradient id="dollar2" x1="0" x2="1" y1="0" y2="1">
                  <stop offset="0%" stopColor="#FFFFFF" />
                  <stop offset={`${clamp(0.2 + 0.6 * ((t * 0.5) % 1)) * 100}%`} stopColor={HOT} />
                  <stop offset="100%" stopColor={OR} />
                </linearGradient>
              </defs>
              <text x={0} y={200} fontFamily="Open Sans" fontWeight={600} fontSize={240} letterSpacing="-6" fill="url(#dollar2)">
                $1
              </text>
              <text x={262} y={96} fontFamily="Open Sans" fontWeight={400} fontSize={90} fill={OR}>
                *
              </text>
            </svg>
          </div>
        ) : null}
        <div style={{ position: "absolute", left: 1060, top: 980, fontFamily: F, fontSize: 22, color: DIM, opacity: win(t, S.slice + 2.0, S.count + 0.1, 0.4, 0.35) }}>*Eligible fractional US stocks and ETFs only.</div>

        {t > S.count + 0.3 && t < S.digital + 0.1 ? (
          <div style={{ position: "absolute", left: 0, right: 0, top: 360, opacity: win(t, S.count + 0.3, S.digital + 0.1, 0.3, 0.45), transform: `scale(${1 + 0.05 * tw(t, S.count + 0.3, S.digital, 0, 1, (k) => k)})` }}>
            <Odometer t={t} at={S.count + 0.35} />
          </div>
        ) : null}
        <div style={drift(S.count)}>
          <Line t={t} text="US stocks and ETFs" at={S.count + 1.4} out={S.digital + 0.05} y={620} size={50} />
        </div>
        {t > S.digital + 0.8 && t < S.digital + 2.85 ? (
          <div style={{ position: "absolute", left: 0, right: 0, top: 472, textAlign: "center", fontFamily: F, fontWeight: 600, fontSize: 120, color: "#fff", opacity: win(t, S.digital + 0.8, S.digital + 2.85, 0.4, 0.3) }}>
            {Math.round(tw(t, S.digital + 0.7, S.digital + 2.2, 0, 1, inOut) * 100)}%
          </div>
        ) : null}
        <div style={drift(S.digital)}>
          <Line t={t} text="digital account opening." at={S.digital + 1.0} out={S.digital + 3.1} y={790} size={50} />
        </div>
        <div style={drift(S.digital + 3)}>
          <Line t={t} text="Add funds in rupees." at={S.digital + 3.2} out={S.app + 0.2} y={790} size={50} />
        </div>
        <div style={drift(S.app)}>
          <Line t={t} text="One app for Indian and US investing." at={S.app + 1.6} out={S.end - 0.05} y={860} size={50} />
        </div>
        <Line t={t} text="Customer by habit." at={S.end + 0.2} out={LOGO_T - 0.1} x={180} y={250} align="left" size={50} color={DIM} />
        <Line t={t} text="Shareholder by choice." at={S.end + 1.0} out={LOGO_T - 0.1} x={180} y={320} align="left" size={84} weight={600} color="#fff" accent={[2]} />
      </div>

      {/* whiteout through the door */}
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 50%, #FFF4EA 0%, #FFD0A0 40%, #F58220 100%)", opacity: whiteout * (1 - tw(t, S.us - 0.02, S.us + 0.3)) }} />

      {/* lockup: the comma of light lands and the logo resolves around it; dead still after */}
      {logo > 0 ? (
        <>
          <div style={{ position: "absolute", left: 960 - 420, top: 300, width: 840, height: 300, background: "radial-gradient(ellipse at 50% 50%, rgba(245,130,32,0.18), rgba(245,130,32,0) 65%)", opacity: logo }} />
          <Img src={staticFile("brand/mstock-logo-dark.svg")} style={{ position: "absolute", left: 960 - 350, top: 320, width: 700, opacity: logo, filter: `blur(${(1 - logo) * 14}px)`, transform: `scale(${1.06 - 0.06 * logo})` }} />
          <div style={{ position: "absolute", left: 0, right: 0, top: 650, textAlign: "center", opacity: end }}>
            <span style={{ fontFamily: F, fontWeight: 600, fontSize: 26, letterSpacing: "0.3em", color: DIM }}>
              US STOCKS <span style={{ color: OR }}>·</span> NOW OPEN
            </span>
          </div>
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 38, textAlign: "center", fontFamily: F, fontSize: 16, lineHeight: 1.6, color: "rgba(255,255,255,0.38)", opacity: end }}>
            In partnership with ViewTrade | IFSCA-regulated in GIFT City · Mirae Asset Capital Markets (IFSC) Pvt. Ltd. · IFSCA Broker Dealer Registration Number: CMI2026BDK1072
            <br />
            Compliant with RBI&apos;s Liberalised Remittance Scheme (LRS) · *Eligible fractional US stocks and ETFs only.
          </div>
        </>
      ) : null}

      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, mixBlendMode: "overlay", opacity: 0.35, pointerEvents: "none" }}>
        <filter id="grain2">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} seed={frame % 12} />
          <feColorMatrix values="0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0.55 0" />
        </filter>
        <rect width={1920} height={1080} filter="url(#grain2)" />
      </svg>

      {/* sound: unchanged from v1 (music bed + designed hits), plus a soft tick when each morph lands */}
      <Html5Audio src={staticFile("audio/music.wav")} volume={(f) => 0.5 * Math.min(1, f / 12)} />
      {(
        [
          [0.15, "shimmer", 0.3],
          [S.door - 0.6, "riser", 0.45],
          [S.door, "door", 0.6],
          [S.us - 0.6, "whoosh", 0.45],
          [S.us, "impact", 0.85],
          [S.slice, "swish", 0.35],
          [S.slice + 0.95, "pop", 0.45],
          [S.count + 0.25, "shimmer", 0.4],
          [S.count + 0.35, "flap", 0.3],
          [S.digital + 2.2, "chime", 0.45],
          [S.digital + 2.8, "whoosh", 0.3],
          [S.app + 0.05, "swish", 0.35],
          [S.app + 1.55, "swish", 0.25],
          [S.app + 2.45, "pop", 0.3],
          [S.end + 0.02, "swish", 0.3],
          [LOGO_T - 0.45, "whoosh", 0.25],
          [LOGO_T, "sting", 0.7],
        ] as [number, string, number][]
      ).map(([at, name, vol], i) => (
        <Sequence key={i} from={Math.round(at * FPS)} durationInFrames={75} layout="none">
          <Html5Audio src={staticFile(`sfx/${name}.wav`)} volume={vol} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
