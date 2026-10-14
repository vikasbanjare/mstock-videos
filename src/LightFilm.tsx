/**
 * "Light" film: one source of m.Stock orange light in a dark navy world carries the whole script.
 * crack of light → door → horizon → ring and slice → 5,000 points → progress ring → ₹ → one app → rising line → logo.
 * No voice-over and no subtitles: the script lives in the scene as small, light-weight type.
 */
import React, { useLayoutEffect, useRef } from "react";
import { AbsoluteFill, Html5Audio, Img, Sequence, staticFile, useCurrentFrame } from "remotion";
import { FPS, inExpo, inOut, outExpo, tw } from "./theme";

const OR = "#F58220";
const HOT = "#FFC48A";
const INK = "rgba(255,255,255,0.9)";
const DIM = "rgba(255,255,255,0.46)";
const F = "'Open Sans', sans-serif";

// scene starts sit on music beats
export const S = { door: 4.09, us: 7.46, slice: 10.95, count: 14.46, digital: 17.95, app: 21.97, end: 25.48 };

const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const hash = (i: number, j = 0) => {
  const x = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
  return x - Math.floor(x);
};
const win = (t: number, a: number, b: number, fi = 0.5, fo = 0.4) => Math.min(tw(t, a, a + fi), 1 - tw(t, b - fo, b, 0, 1, inExpo));

/** A line of type that resolves out of blur, word by word, and leaves the same way. */
const Line: React.FC<{ t: number; text: string; at: number; out: number; size?: number; weight?: number; color?: string; y: number; x?: number; align?: "center" | "left"; accent?: number[] }> = ({
  t,
  text,
  at,
  out,
  size = 52,
  weight = 300,
  color = INK,
  y,
  x,
  align = "center",
  accent = [],
}) => {
  if (t < at - 0.05 || t > out + 0.05) return null;
  const words = text.split(" ");
  const leave = tw(t, out - 0.45, out, 0, 1, inExpo);
  return (
    <div
      style={{
        position: "absolute",
        top: y,
        left: x ?? 0,
        right: x === undefined ? 0 : undefined,
        textAlign: align,
        fontFamily: F,
        fontSize: size,
        fontWeight: weight,
        letterSpacing: weight <= 300 ? "0.01em" : "-0.02em",
        color,
        whiteSpace: "nowrap",
        opacity: 1 - leave,
        filter: `blur(${leave * 10}px)`,
      }}
    >
      {words.map((w, i) => {
        const p = tw(t, at + i * 0.11, at + i * 0.11 + 0.7);
        return (
          <span key={i} style={{ display: "inline-block", opacity: p, filter: `blur(${(1 - p) * 12}px)`, transform: `translateY(${(1 - p) * 14}px)`, color: accent.includes(i) ? OR : undefined }}>
            {w}
            {i < words.length - 1 ? " " : ""}
          </span>
        );
      })}
    </div>
  );
};

/** Soft light: a sharp core plus two blurred copies, added on top of the dark. */
const glow = (a: number, c = OR) => `0 0 ${6 + 10 * a}px ${1 + 2 * a}px ${c}, 0 0 ${40 + 60 * a}px ${8 + 14 * a}px rgba(245,130,32,${0.35 * a})`;

/* --------------------------------------------------------------------- particles (5,000 points) */
const Field: React.FC<{ t: number }> = ({ t }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const g = ref.current!.getContext("2d")!;
    g.clearRect(0, 0, 1920, 1080);
    const a = S.count + 0.25;
    const b = S.digital + 0.95;
    if (t < a || t > b + 0.1) return;
    const burst = tw(t, a, a + 1.1, 0, 1, outExpo);
    const gather = tw(t, S.digital - 0.1, b, 0, 1, inOut);
    const fade = 1 - tw(t, b - 0.15, b + 0.1);
    for (let i = 0; i < 5000; i++) {
      const th = hash(i) * Math.PI * 2;
      const ph = Math.acos(2 * hash(i, 1) - 1);
      const R = 300 + hash(i, 2) * 900;
      // a slowly turning sphere of points that bursts from the slice and drifts toward camera
      const rot = t * 0.12;
      let x = Math.sin(ph) * Math.cos(th + rot) * R * burst;
      let y = Math.cos(ph) * R * burst * 0.62;
      let z = Math.sin(ph) * Math.sin(th + rot) * R * burst + (t - a) * 140;
      // then every point streams into the progress ring
      const ang = (i / 5000) * Math.PI * 2 - Math.PI / 2;
      const rx = Math.cos(ang) * 210;
      const ry = Math.sin(ang) * 210;
      x = x + (rx - x) * gather;
      y = y + (ry - y) * gather;
      z = z * (1 - gather);
      const persp = 900 / (900 - Math.min(z, 820));
      const px = 960 + x * persp;
      const py = 540 + y * persp;
      if (px < -20 || px > 1940 || py < -20 || py > 1100) continue;
      const k = hash(i, 4);
      const s = (0.8 + k * 1.8) * persp;
      const alpha = (0.25 + 0.75 * hash(i, 5)) * fade * clamp(burst * 2);
      g.fillStyle = k > 0.86 ? `rgba(245,130,32,${alpha})` : k > 0.55 ? `rgba(255,214,176,${alpha * 0.9})` : `rgba(160,190,230,${alpha * 0.7})`;
      g.beginPath();
      g.arc(px, py, s, 0, Math.PI * 2);
      g.fill();
    }
  }, [t]);
  return <canvas ref={ref} width={1920} height={1080} style={{ position: "absolute", inset: 0, mixBlendMode: "screen" }} />;
};

/* --------------------------------------------------------------------- odometer for 5,000+ */
const Odometer: React.FC<{ t: number; at: number }> = ({ t, at }) => {
  const digits = ["5", ",", "0", "0", "0", "+"];
  return (
    <div style={{ display: "flex", justifyContent: "center", fontFamily: F, fontWeight: 600, fontSize: 210, lineHeight: 1, color: "#fff", letterSpacing: "-0.03em" }}>
      {digits.map((d, i) => {
        if (d === "," || d === "+") {
          const p = tw(t, at + 0.9, at + 1.3);
          return (
            <span key={i} style={{ opacity: p, color: d === "+" ? OR : "#fff", textShadow: d === "+" ? glow(0.6) : undefined }}>
              {d}
            </span>
          );
        }
        // each column rolls through the digits and lands on its own value, left to right
        const land = at + 0.55 + i * 0.12;
        const p = tw(t, at, land, 0, 1, outExpo);
        const target = Number(d) + 10;
        const pos = target * p;
        return (
          <span key={i} style={{ display: "inline-block", height: 210, overflow: "hidden", verticalAlign: "top" }}>
            <span style={{ display: "block", transform: `translateY(${-pos * 210}px)`, filter: `blur(${(1 - p) * 6}px)` }}>
              {Array.from({ length: 21 }, (_, k) => (
                <span key={k} style={{ display: "block", height: 210 }}>
                  {k % 10}
                </span>
              ))}
            </span>
          </span>
        );
      })}
    </div>
  );
};

/* --------------------------------------------------------------------- the film */
export const LightFilm: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;

  // 1 ── crack of light, then the door opens and we push through it
  const crackH = tw(t, 0.15, 1.1, 0, 480, outExpo);
  const flicker = 0.88 + 0.12 * Math.sin(t * 23) * Math.sin(t * 7.3);
  const doorW = tw(t, S.door - 0.1, S.door + 1.2, 2, 380, inOut);
  const push = tw(t, S.us - 1.0, S.us, 0, 1, (x) => Math.pow(x, 2.6));
  const pushScale = (1 + 0.07 * tw(t, 0, S.us - 1.0, 0, 1, (x) => x)) * (1 + push * 9);
  const whiteout = tw(t, S.us - 0.25, S.us - 0.02, 0, 1);
  const doorOn = t < S.us + 0.6;

  // 2 ── the light settles into a horizon line
  const hz = win(t, S.us - 0.05, S.slice + 0.15, 0.6, 0.5);
  const hzW = tw(t, S.us, S.us + 0.9, 0, 1600, outExpo);

  // 3 ── ring, disc and the slice
  const ring = tw(t, S.slice + 0.1, S.slice + 0.9, 0, 1, inOut);
  const sliceOut = tw(t, S.slice + 0.9, S.slice + 1.5, 0, 1, outExpo);
  const sliceGone = tw(t, S.count - 0.2, S.count + 0.25, 0, 1, inExpo);
  const discOn = win(t, S.slice + 0.1, S.count + 0.2, 0.5, 0.35);

  // 4 ── progress ring and rupee
  const prog = tw(t, S.digital + 0.7, S.digital + 2.2, 0, 1, inOut);
  const ringOn = win(t, S.digital + 0.6, S.digital + 3.2, 0.3, 0.45);
  const rupee = win(t, S.digital + 2.85, S.app + 0.55, 0.6, 0.3);

  // 5 ── India and US become one app
  const arc = tw(t, S.app + 0.3, S.app + 1.1, 0, 1, inOut);
  const meet = tw(t, S.app + 1.4, S.app + 2.2, 0, 1, inOut);
  const appOn = win(t, S.app + 0.1, S.end + 0.5, 0.4, 0.4);

  // 6 ── rising line and logo
  const chart = tw(t, S.end + 0.1, S.end + 1.6, 0, 1, inOut);
  const logoT = 27.75;
  const logo = tw(t, logoT, logoT + 0.7, 0, 1, outExpo);
  const lineOut = tw(t, logoT - 0.1, logoT + 0.3);
  const end = tw(t, logoT + 0.6, logoT + 1.1);

  const R = 230;
  const C2 = 2 * Math.PI * R;
  const pts = Array.from({ length: 13 }, (_, i) => [180 + i * 130, 820 - i * 38 - Math.sin(i * 1.7) * 34] as const);
  const path = pts.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join(" ");
  const head = Math.min(pts.length - 1, chart * (pts.length - 1));
  const hi = Math.floor(head);
  const hf = head - hi;
  const hx = pts[hi][0] + ((pts[Math.min(hi + 1, pts.length - 1)][0] - pts[hi][0]) * hf);
  const hy = pts[hi][1] + ((pts[Math.min(hi + 1, pts.length - 1)][1] - pts[hi][1]) * hf);

  return (
    <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 46%, #0C1E36 0%, #071226 42%, #02060D 100%)", overflow: "hidden" }}>
      {/* drifting navy haze so the dark is never flat */}
      <div style={{ position: "absolute", inset: -200, background: `radial-gradient(ellipse at ${40 + Math.sin(t * 0.3) * 8}% ${55 + Math.cos(t * 0.25) * 6}%, rgba(4,59,114,0.55) 0%, rgba(4,59,114,0) 55%)` }} />

      {/* 1 ─ crack → door → push */}
      {doorOn ? (
        <div style={{ position: "absolute", inset: 0, transformOrigin: "960px 540px", transform: `scale(${pushScale})` }}>
          {/* floor spill */}
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
          {/* bloom */}
          <div style={{ position: "absolute", left: 960 - doorW / 2 - 120, top: 300 - 120, width: doorW + 240, height: crackH + 240, borderRadius: 60, background: OR, filter: "blur(70px)", opacity: 0.22 + 0.5 * tw(t, S.door, S.door + 1.2) }} />
          {/* the opening itself */}
          <div
            style={{
              position: "absolute",
              left: 960 - doorW / 2,
              top: 540 - crackH / 2,
              width: doorW,
              height: crackH,
              borderRadius: doorW > 20 ? 4 : 1,
              background: `radial-gradient(ellipse at 50% 60%, #FFFFFF 0%, ${HOT} ${18 + 10 * tw(t, S.door, S.door + 1)}%, ${OR} 70%, #C8590A 100%)`,
              boxShadow: glow(flicker),
              opacity: flicker,
            }}
          />
          {/* motes in the beam */}
          {Array.from({ length: 22 }, (_, i) => {
            const st = S.door + 0.6 + (i % 11) * 0.12;
            const q = clamp((t - st) / 2.2);
            if (q <= 0 || q >= 1) return null;
            const x = 960 + (hash(i) - 0.5) * doorW * 1.4 + Math.sin(t * 2 + i) * 10;
            const y = 760 - q * (380 + hash(i, 1) * 200);
            return <div key={i} style={{ position: "absolute", left: x, top: y, width: 4, height: 4, borderRadius: 2, background: HOT, opacity: Math.sin(q * Math.PI) * 0.8, boxShadow: `0 0 8px ${OR}` }} />;
          })}
        </div>
      ) : null}
      <Line t={t} text="How many do you own?" at={0.7} out={S.door - 0.05} y={880} />
      <Line t={t} text="Now you can." at={S.door + 0.45} out={S.us - 0.75} y={880} weight={400} />
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 50%, #FFF4EA 0%, #FFD0A0 40%, #F58220 100%)", opacity: whiteout * (1 - tw(t, S.us - 0.02, S.us + 0.3)) }} />

      {/* 2 ─ horizon: US stocks, on m.Stock */}
      {hz > 0 ? (
        <>
          <div style={{ position: "absolute", left: 960 - hzW / 2, top: 598, width: hzW, height: 3, borderRadius: 2, background: `linear-gradient(90deg, rgba(245,130,32,0), ${HOT} 30%, #fff 50%, ${HOT} 70%, rgba(245,130,32,0))`, boxShadow: glow(0.8), opacity: hz }} />
          <div style={{ position: "absolute", left: 960 - hzW / 2, top: 560, width: hzW, height: 80, background: "radial-gradient(ellipse at 50% 50%, rgba(245,130,32,0.35), rgba(245,130,32,0) 70%)", filter: "blur(10px)", opacity: hz }} />
          <div style={{ position: "absolute", left: 0, right: 0, top: 360, textAlign: "center", opacity: hz }}>
            <div
              style={{
                display: "inline-block",
                fontFamily: F,
                fontWeight: 600,
                fontSize: 170,
                letterSpacing: "-0.03em",
                color: "#fff",
                clipPath: `inset(0 ${100 - tw(t, S.us + 0.25, S.us + 1.2, 0, 100, outExpo)}% 0 0)`,
                textShadow: "0 0 40px rgba(245,130,32,0.25)",
              }}
            >
              US stocks,
            </div>
          </div>
          <div style={{ position: "absolute", left: 0, right: 0, top: 660, display: "flex", justifyContent: "center", alignItems: "center", gap: 26, opacity: hz * tw(t, S.us + 1.6, S.us + 2.2), filter: `blur(${(1 - tw(t, S.us + 1.6, S.us + 2.2)) * 10}px)` }}>
            <span style={{ fontFamily: F, fontWeight: 300, fontSize: 64, color: INK }}>on</span>
            <Img src={staticFile("brand/mstock-logo-dark.svg")} style={{ height: 120 }} />
          </div>
        </>
      ) : null}

      {/* 3 ─ ring, disc, slice: own a slice, from $1 */}
      {discOn > 0 ? (
        <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, opacity: discOn }}>
          <defs>
            <radialGradient id="disc" cx="40%" cy="35%">
              <stop offset="0%" stopColor="#1C3D66" />
              <stop offset="100%" stopColor="#0A1A30" />
            </radialGradient>
            <radialGradient id="slice" cx="30%" cy="30%">
              <stop offset="0%" stopColor="#FFD3A6" />
              <stop offset="55%" stopColor={OR} />
              <stop offset="100%" stopColor="#C2560A" />
            </radialGradient>
            <filter id="soft"><feGaussianBlur stdDeviation="18" /></filter>
          </defs>
          <g transform="translate(640 540)">
            <circle r={R} fill="url(#disc)" opacity={ring} />
            <circle r={R} fill="none" stroke={HOT} strokeWidth={2.5} strokeDasharray={C2} strokeDashoffset={C2 * (1 - ring)} transform="rotate(-90)" />
            {/* slice: a 40° wedge that lifts out of the disc */}
            <g transform={`translate(${sliceOut * 70 * (1 - sliceGone)} ${-sliceOut * 46 * (1 - sliceGone)}) scale(${1 - sliceGone})`} opacity={tw(t, S.slice + 0.7, S.slice + 1.0)}>
              <path d={`M0 0 L${R} 0 A${R} ${R} 0 0 0 ${R * Math.cos((-40 * Math.PI) / 180)} ${R * Math.sin((-40 * Math.PI) / 180)} Z`} fill={OR} filter="url(#soft)" opacity={0.6 * sliceOut} />
              <path d={`M0 0 L${R} 0 A${R} ${R} 0 0 0 ${R * Math.cos((-40 * Math.PI) / 180)} ${R * Math.sin((-40 * Math.PI) / 180)} Z`} fill="url(#slice)" />
            </g>
          </g>
        </svg>
      ) : null}
      <Line t={t} text="Own a slice." at={S.slice + 1.0} out={S.count - 0.1} x={1060} y={330} align="left" size={60} />
      {t > S.slice + 1.9 && t < S.count + 0.1 ? (
        <div style={{ position: "absolute", left: 1060, top: 430, display: "flex", alignItems: "baseline", gap: 24, opacity: win(t, S.slice + 1.9, S.count + 0.1, 0.4, 0.35) }}>
          <span style={{ fontFamily: F, fontWeight: 300, fontSize: 60, color: INK }}>From</span>
          <svg width={330} height={230} style={{ overflow: "visible" }}>
            <defs>
              <linearGradient id="dollar" x1="0" x2="1" y1="0" y2="1">
                <stop offset="0%" stopColor="#FFFFFF" />
                <stop offset={`${clamp(tw(t, S.slice + 2.1, S.slice + 3.0)) * 100}%`} stopColor={HOT} />
                <stop offset="100%" stopColor={OR} />
              </linearGradient>
            </defs>
            <text x={0} y={200} fontFamily="Open Sans" fontWeight={600} fontSize={240} letterSpacing="-6" fill="url(#dollar)">
              $1
            </text>
            <text x={262} y={96} fontFamily="Open Sans" fontWeight={400} fontSize={90} fill={OR}>
              *
            </text>
          </svg>
        </div>
      ) : null}
      <div style={{ position: "absolute", left: 1060, top: 980, fontFamily: F, fontSize: 22, color: DIM, opacity: win(t, S.slice + 2.0, S.count + 0.1, 0.4, 0.35) }}>*Eligible fractional US stocks and ETFs only.</div>

      {/* 4 ─ 5,000 points of light */}
      <Field t={t} />
      {t > S.count + 0.3 && t < S.digital + 0.1 ? (
        <div style={{ position: "absolute", left: 0, right: 0, top: 360, opacity: win(t, S.count + 0.3, S.digital + 0.1, 0.3, 0.45) }}>
          <Odometer t={t} at={S.count + 0.35} />
        </div>
      ) : null}
      <Line t={t} text="US stocks and ETFs" at={S.count + 1.4} out={S.digital + 0.05} y={620} size={50} />

      {/* 5 ─ progress ring: 100% digital, then ₹ */}
      {ringOn > 0 ? (
        <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, opacity: ringOn }}>
          <circle cx={960} cy={500} r={210} fill="none" stroke="rgba(255,255,255,0.09)" strokeWidth={6} />
          <circle cx={960} cy={500} r={210} fill="none" stroke={OR} strokeWidth={6} strokeLinecap="round" strokeDasharray={2 * Math.PI * 210} strokeDashoffset={2 * Math.PI * 210 * (1 - prog)} transform="rotate(-90 960 500)" style={{ filter: `drop-shadow(0 0 10px ${OR})` }} />
          <text x={960} y={540} textAnchor="middle" fontFamily="Open Sans" fontWeight={600} fontSize={120} fill="#fff" opacity={tw(t, S.digital + 0.8, S.digital + 1.2)}>
            {Math.round(prog * 100)}%
          </text>
        </svg>
      ) : null}
      <Line t={t} text="digital account opening." at={S.digital + 1.0} out={S.digital + 3.1} y={790} size={50} />
      {rupee > 0 ? (
        <div style={{ position: "absolute", left: 0, right: 0, top: 230, textAlign: "center", fontFamily: F, fontWeight: 300, fontSize: 330, lineHeight: 1, color: HOT, opacity: rupee * (1 - arc), textShadow: glow(0.9), filter: `blur(${(1 - tw(t, S.digital + 2.85, S.digital + 3.4)) * 14}px)` }}>
          ₹
        </div>
      ) : null}
      <Line t={t} text="Add funds in rupees." at={S.digital + 3.1} out={S.app + 0.2} y={790} size={50} />

      {/* 6 ─ India and US, one app */}
      {appOn > 0 ? (
        <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, opacity: appOn * (1 - tw(t, S.end - 0.1, S.end + 0.4)) }}>
          <defs>
            <filter id="g2"><feGaussianBlur stdDeviation="6" /></filter>
          </defs>
          {(() => {
            const lx = 560 + meet * 400;
            const rx = 1360 - meet * 400;
            const y = 500;
            const d = `M${lx} ${y} Q 960 ${y - 260 * (1 - meet)} ${rx} ${y}`;
            const L2 = 1000;
            return (
              <>
                <path d={d} fill="none" stroke={OR} strokeWidth={8} filter="url(#g2)" opacity={0.7 * (1 - meet)} pathLength={L2} strokeDasharray={L2} strokeDashoffset={L2 * (1 - arc)} />
                <path d={d} fill="none" stroke={HOT} strokeWidth={2.5} opacity={1 - meet} pathLength={L2} strokeDasharray={L2} strokeDashoffset={L2 * (1 - arc)} />
                {[lx, rx].map((x, i) => (
                  <g key={i} opacity={1 - meet}>
                    <circle cx={x} cy={y} r={9} fill="#fff" style={{ filter: `drop-shadow(0 0 12px ${OR})` }} />
                    <text x={x} y={y + 56} textAnchor="middle" fontFamily="Open Sans" fontWeight={600} fontSize={22} letterSpacing="5" fill={DIM}>
                      {i ? "US" : "INDIA"}
                    </text>
                  </g>
                ))}
                {/* the two points meet and draw one app */}
                <rect
                  x={960 - 130}
                  y={500 - 260}
                  width={260}
                  height={520}
                  rx={56}
                  fill={`rgba(255,255,255,${0.03 * tw(t, S.app + 2.4, S.app + 2.8)})`}
                  stroke={HOT}
                  strokeWidth={3}
                  pathLength={1}
                  strokeDasharray={1}
                  strokeDashoffset={1 - tw(t, S.app + 1.8, S.app + 2.6, 0, 1, inOut)}
                  style={{ filter: `drop-shadow(0 0 14px ${OR})` }}
                />
                <circle cx={960} cy={500} r={14 * meet} fill={OR} style={{ filter: `drop-shadow(0 0 16px ${OR})` }} opacity={tw(t, S.app + 2.0, S.app + 2.4)} />
              </>
            );
          })()}
        </svg>
      ) : null}
      <Line t={t} text="One app for Indian and US investing." at={S.app + 1.5} out={S.end - 0.05} y={860} size={50} />

      {/* 7 ─ habit → choice, the line rises */}
      {chart > 0 && lineOut < 1 ? (
        <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, opacity: 1 - lineOut }}>
          <defs>
            <linearGradient id="lg" x1="0" x2="1">
              <stop offset="0%" stopColor="rgba(245,130,32,0)" />
              <stop offset="60%" stopColor={OR} />
              <stop offset="100%" stopColor={HOT} />
            </linearGradient>
          </defs>
          <path d={path} fill="none" stroke="url(#lg)" strokeWidth={4} strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - chart} style={{ filter: `drop-shadow(0 0 10px ${OR})` }} />
          <circle cx={hx} cy={hy} r={10} fill="#fff" style={{ filter: `drop-shadow(0 0 14px ${OR})` }} />
        </svg>
      ) : null}
      <Line t={t} text="Customer by habit." at={S.end + 0.15} out={logoT} x={180} y={250} align="left" size={50} color={DIM} />
      <Line t={t} text="Shareholder by choice." at={S.end + 1.0} out={logoT} x={180} y={320} align="left" size={84} weight={600} color="#fff" accent={[2]} />

      {/* 8 ─ lockup: the light lands as the logo */}
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

      {/* film grain over everything */}
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, mixBlendMode: "overlay", opacity: 0.35, pointerEvents: "none" }}>
        <filter id="grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} seed={frame % 12} />
          <feColorMatrix values="0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0.55 0" />
        </filter>
        <rect width={1920} height={1080} filter="url(#grain)" />
      </svg>

      {/* sound: music bed and designed hits, no voice-over */}
      <Html5Audio src={staticFile("audio/music.wav")} volume={(f) => 0.5 * Math.min(1, f / 12)} />
      {(
        [
          [0.15, "shimmer", 0.3],
          [S.door - 0.6, "riser", 0.45],
          [S.door, "door", 0.6],
          [S.us - 0.6, "whoosh", 0.45],
          [S.us, "impact", 0.85],
          [S.slice, "swish", 0.35],
          [S.slice + 0.9, "pop", 0.45],
          [S.count + 0.25, "shimmer", 0.4],
          [S.count + 0.35, "flap", 0.3],
          [S.digital + 2.2, "chime", 0.45],
          [S.digital + 2.85, "whoosh", 0.3],
          [S.app + 0.3, "swish", 0.35],
          [S.app + 2.0, "pop", 0.35],
          [S.end + 0.1, "swish", 0.3],
          [logoT, "sting", 0.7],
        ] as [number, string, number][]
      ).map(([at, name, vol], i) => (
        <Sequence key={i} from={Math.round(at * FPS)} durationInFrames={75} layout="none">
          <Html5Audio src={staticFile(`sfx/${name}.wav`)} volume={vol} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
