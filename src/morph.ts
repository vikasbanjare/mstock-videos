/**
 * One light line that changes shape through the film. Shapes are SVG path strings; each is sampled into
 * the same number of points along its length, and a morph blends point by point with a travelling ripple,
 * so the line is always one continuous stroke (never a crossfade).
 */
export type Pt = [number, number];
const N = 220;
const cache = new Map<string, Pt[]>();

export const sample = (d: string): Pt[] => {
  const hit = cache.get(d);
  if (hit) return hit;
  const el = document.createElementNS("http://www.w3.org/2000/svg", "path");
  el.setAttribute("d", d);
  const len = el.getTotalLength();
  const pts: Pt[] = [];
  for (let i = 0; i < N; i++) {
    const p = el.getPointAtLength((i / (N - 1)) * len);
    pts.push([p.x, p.y]);
  }
  cache.set(d, pts);
  return pts;
};

const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

/** Blend shape a into b; `p` 0..1, the change travels along the line from one end (wave 0..1 of the duration). */
export const blend = (a: Pt[], b: Pt[], p: number, wave = 0.35): Pt[] =>
  a.map((pa, i) => {
    const k = Math.max(0, Math.min(1, (p - (i / (N - 1)) * wave) / (1 - wave)));
    const e = ease(k);
    const pb = b[i];
    return [pa[0] + (pb[0] - pa[0]) * e, pa[1] + (pb[1] - pa[1]) * e];
  });

export const toD = (pts: Pt[], from = 0, to = 1) => {
  const a = Math.floor(from * (pts.length - 1));
  const b = Math.max(a + 1, Math.ceil(to * (pts.length - 1)));
  let d = "";
  for (let i = a; i <= b && i < pts.length; i++) d += `${i === a ? "M" : "L"}${pts[i][0].toFixed(1)} ${pts[i][1].toFixed(1)}`;
  return d;
};

/* ---------------------------------------------------------------- the shapes, in frame pixels */
export const SHAPES = {
  crack: "M960 300 L960 780",
  horizon: "M160 600 L1760 600",
  ring: "M640 310 A230 230 0 1 1 639.9 310",
  progress: "M960 330 A210 210 0 1 1 959.9 330",
  // ₹ as one continuous stroke: top bar, bowl, second bar, back, tail down to the right
  rupee: "M1065 300 L855 300 C1000 300 1032 336 1032 372 L1072 372 L1032 372 C1032 420 990 446 885 446 L862 446 L1048 650",
  arc: "M560 500 Q960 230 1360 500",
  app: "M960 240 L1034 240 Q1090 240 1090 296 L1090 704 Q1090 760 1034 760 L886 760 Q830 760 830 704 L830 296 Q830 240 886 240 Z",
  chart: "M180 820 L310 778 L440 760 L570 690 L700 700 L830 640 L960 650 L1090 560 L1220 540 L1350 545 L1480 470 L1610 420 L1740 350",
  comma: "M796 470 L801 488",
};
