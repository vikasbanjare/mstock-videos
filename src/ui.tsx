import React from "react";
import { C, FONT, H, W, inExpo, outExpo, tw } from "./theme";

/** Words rise in one by one; the whole line lifts away at `out`. */
export const Kinetic: React.FC<{
  t: number;
  text: string;
  at: number;
  out?: number;
  size: number;
  weight?: number;
  color?: string;
  stagger?: number;
  colors?: Record<number, string>;
  style?: React.CSSProperties;
  align?: "left" | "center" | "right";
  tracking?: number;
}> = ({ t, text, at, out = 99, size, weight = 800, color = C.navy, stagger = 0.06, colors = {}, style, align = "center", tracking = -0.02 }) => {
  const words = text.split(" ");
  const leave = tw(t, out - 0.22, out, 0, 1, inExpo);
  return (
    <div
      style={{
        fontFamily: FONT,
        fontSize: size,
        fontWeight: weight,
        letterSpacing: `${tracking}em`,
        lineHeight: 1.04,
        color,
        textAlign: align,
        whiteSpace: "nowrap",
        opacity: 1 - leave,
        transform: `translateY(${-leave * size * 0.35}px)`,
        ...style,
      }}
    >
      {words.map((w, i) => {
        const p = tw(t, at + i * stagger, at + i * stagger + 0.45);
        return (
          <span key={i} style={{ display: "inline-block", overflow: "hidden", verticalAlign: "top", paddingBottom: size * 0.12 }}>
            <span
              style={{
                display: "inline-block",
                transform: `translateY(${(1 - p) * 105}%)`,
                color: colors[i] ?? color,
              }}
            >
              {w}
              {i < words.length - 1 ? " " : ""}
            </span>
          </span>
        );
      })}
    </div>
  );
};

/** Rounded bar — the film's core motif (a candle, a tally, a slice). */
export const Pill: React.FC<{
  x: number;
  y: number;
  w?: number;
  h: number;
  color: string;
  opacity?: number;
  origin?: "bottom" | "center";
}> = ({ x, y, w = 22, h, color, opacity = 1, origin = "bottom" }) => (
  <div
    style={{
      position: "absolute",
      left: x - w / 2,
      top: origin === "bottom" ? y - h : y - h / 2,
      width: w,
      height: Math.max(0, h),
      borderRadius: w / 2,
      background: color,
      opacity,
    }}
  />
);

export const Center: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", ...style }}>{children}</div>
);

export const Abs: React.FC<{ x: number; y: number; children: React.ReactNode; anchor?: "center" | "left"; style?: React.CSSProperties }> = ({
  x,
  y,
  children,
  anchor = "center",
  style,
}) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      transform: anchor === "center" ? "translate(-50%, -50%)" : "translate(0, -50%)",
      ...style,
    }}
  >
    {children}
  </div>
);

/** Fine paper grid with plus marks at a few intersections. */
export const Grid: React.FC<{ t: number; opacity?: number; dark?: boolean }> = ({ t, opacity = 1, dark }) => {
  const cell = 96;
  const drift = (t * 6) % cell;
  const stroke = dark ? "rgba(255,255,255,0.07)" : C.line;
  const marks: [number, number][] = [
    [4, 2],
    [15, 2],
    [2, 8],
    [17, 9],
    [9, 10],
  ];
  return (
    <div style={{ position: "absolute", inset: 0, opacity, overflow: "hidden" }}>
      <svg width={W + cell} height={H + cell} style={{ position: "absolute", left: -drift, top: -drift * 0.5 }}>
        <defs>
          <pattern id={dark ? "gd" : "gl"} width={cell} height={cell} patternUnits="userSpaceOnUse">
            <path d={`M ${cell} 0 L 0 0 0 ${cell}`} fill="none" stroke={stroke} strokeWidth={1.2} />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${dark ? "gd" : "gl"})`} />
        {marks.map(([cx, cy], i) => (
          <g key={i} transform={`translate(${cx * cell}, ${cy * cell})`} stroke={dark ? "rgba(255,255,255,0.25)" : "#C9D3DF"} strokeWidth={2}>
            <line x1={-7} x2={7} />
            <line y1={-7} y2={7} />
          </g>
        ))}
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: dark
            ? "radial-gradient(ellipse at center, rgba(4,59,114,0) 40%, rgba(2,30,60,0.55) 100%)"
            : "radial-gradient(ellipse at center, rgba(255,255,255,0) 45%, rgba(255,255,255,0.9) 100%)",
        }}
      />
    </div>
  );
};

export const enter = (t: number, at: number, dur = 0.5) => tw(t, at, at + dur, 0, 1, outExpo);
