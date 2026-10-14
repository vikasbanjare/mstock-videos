/**
 * The ticker-board storyboard: what the dot matrix shows at every moment.
 * Each segment names a mask (a function of film time) and where its flip ripple starts.
 */
import { geoContains } from "d3-geo";
import { feature } from "topojson-client";
import land110 from "world-atlas/land-110m.json";
import { COLS, Mask, N, ROWS, blank, draw, logoMask, memo, merge, shift, text } from "./field";
import { L } from "./theme";

export type Origin = [number, number] | "left" | "right";
export type Seg = { at: number; mask: (t: number) => Mask; origin: Origin; spread?: number; flip?: number };

const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const ease = (x: number) => 1 - Math.pow(1 - clamp(x), 3);

export const VERB_AT = [0.45, 1.0, 1.55, 2.1, 2.65];
const VERBS = ["SCROLL", "STREAM", "SEARCH", "RIDE", "PAY"];

/* ---------------------------------------------------------------- shapes */
export const DOOR = { cx: 40, cy: 22, w: 15, h: 25 };

const doorPath = (g: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number) => {
  const r = w / 2;
  const top = cy - h / 2;
  const bot = cy + h / 2;
  g.beginPath();
  g.moveTo(cx - r, bot);
  g.lineTo(cx - r, top + r);
  g.arc(cx, top + r, r, Math.PI, 0);
  g.lineTo(cx + r, bot);
};

const door = (s: number, opts: { open?: number; lock?: number; lockDy?: number; jitter?: number } = {}) =>
  memo(`door${s.toFixed(3)}|${(opts.open ?? 0).toFixed(2)}|${opts.lock ?? 0}|${(opts.lockDy ?? 0).toFixed(1)}|${opts.jitter ?? 0}`, () => {
    const w = DOOR.w * s;
    const h = DOOR.h * s;
    const cx = DOOR.cx;
    const cy = DOOR.cy + (1 - s) * 6;
    const open = opts.open ?? 0;
    // the doorway, lit, shows through as the panel swings
    const room = open > 0
      ? draw((g) => {
          doorPath(g, cx, cy, w - 2, h - 1);
          g.closePath();
          g.fill();
        }, 2)
      : blank();
    const frame = draw((g) => {
      g.lineWidth = 1.15;
      doorPath(g, cx, cy, w, h);
      g.stroke();
      g.beginPath();
      g.moveTo(cx - w / 2 - 3, cy + h / 2);
      g.lineTo(cx + w / 2 + 3, cy + h / 2);
      g.stroke();
    }, 1);
    // panel: full width when shut, a narrowing strip on the hinge side as it opens
    const pw = (w - 2) * (1 - open * 0.86);
    const panel = draw((g) => {
      g.lineWidth = 1;
      const x0 = cx - (w - 2) / 2;
      g.strokeRect(x0 + 0.5, cy - h / 2 + w / 2 + 1, Math.max(1, pw - 1), h - w / 2 - 2);
      if (open < 0.2) {
        g.beginPath();
        g.arc(cx + (w - 2) / 2 - 2.2, cy + 1.5, 0.9, 0, Math.PI * 2);
        g.fill();
      }
    }, 1);
    let lock = blank();
    if (opts.lock) {
      const lx = cx + (opts.jitter ?? 0);
      const ly = cy + (opts.lockDy ?? 0);
      lock = draw((g) => {
        g.lineWidth = 1.05;
        g.beginPath();
        g.moveTo(lx - 2, ly - 1);
        g.lineTo(lx - 2, ly - 3);
        g.arc(lx, ly - 3, 2, Math.PI, 0);
        g.lineTo(lx + 2, ly - 1);
        g.stroke();
        g.fillRect(lx - 3.4, ly - 1, 6.8, 5.4);
        g.clearRect(lx - 0.5, ly + 0.6, 1, 2);
      }, 2);
    }
    return merge(room, panel, frame, lock);
  });

const bars = (p: number, dx = 0) => {
  const hs = [2, 4, 3, 5, 4, 6, 5, 7, 9];
  const out = blank();
  hs.forEach((h, i) => {
    const hh = Math.round(h * clamp(p * 1.4 - i * 0.06));
    const c = 27 + i * 3 + dx;
    for (let k = 0; k < hh; k++) {
      const r = 38 - k;
      for (const cc of [c, c + 1]) if (cc < COLS && r >= 0) out[r * COLS + cc] = i === hs.length - 1 ? 2 : 1;
    }
  });
  return out;
};

const WORLD = (() => {
  const landGeo = feature(land110 as any, (land110 as any).objects.land) as any;
  const m = blank();
  const lon0 = -128;
  const lon1 = 104;
  const lat0 = 62;
  const lat1 = -8;
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      const lon = lon0 + ((c + 0.5) / COLS) * (lon1 - lon0);
      const lat = lat0 + ((r + 0.5) / ROWS) * (lat1 - lat0);
      if (geoContains(landGeo, [lon, lat])) m[r * COLS + c] = 6;
    }
  const at = (lon: number, lat: number): [number, number] => [
    Math.round(((lon - lon0) / (lon1 - lon0)) * COLS - 0.5),
    Math.round(((lat - lat0) / (lat1 - lat0)) * ROWS - 0.5),
  ];
  return { m, IN: at(78.9, 22), US: at(-97, 39) };
})();
export const MAP = { IN: WORLD.IN, US: WORLD.US };

const arcPoint = (p: number): [number, number] => {
  const [x0, y0] = WORLD.IN;
  const [x1, y1] = WORLD.US;
  const cx = (x0 + x1) / 2;
  const cy = Math.min(y0, y1) - 16;
  const x = (1 - p) ** 2 * x0 + 2 * (1 - p) * p * cx + p * p * x1;
  const y = (1 - p) ** 2 * y0 + 2 * (1 - p) * p * cy + p * p * y1;
  return [x, y];
};
export const arcAt = arcPoint;

const mapMask = (arc: number) => {
  const m = new Uint8Array(WORLD.m);
  const steps = 60;
  for (let i = 0; i <= steps * arc; i++) {
    const [x, y] = arcPoint(i / steps);
    const c = Math.round(x);
    const r = Math.round(y);
    if (r >= 0 && r < ROWS && c >= 0 && c < COLS) m[r * COLS + c] = 2;
  }
  const put = ([c, r]: [number, number], code: number) => {
    for (const [dc, dr] of [[0, 0], [1, 0], [0, 1], [1, 1]]) m[(r + dr) * COLS + c + dc] = code;
  };
  put(WORLD.IN, 2);
  put(WORLD.US, 1);
  return m;
};

const block = (lift: number) => {
  const out = blank();
  const c0 = 14;
  const r0 = 10;
  const n = 18;
  const k = 6;
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) {
      const piece = c >= n - k && r < k;
      if (piece) continue;
      out[(r0 + r) * COLS + c0 + c] = 1;
    }
  const dx = Math.round(lift * 9);
  const dy = Math.round(-lift * 4);
  for (let r = 0; r < k; r++)
    for (let c = 0; c < k; c++) {
      const rr = r0 + r + dy;
      const cc = c0 + n - k + c + dx;
      if (rr >= 0) out[rr * COLS + cc] = 2;
    }
  return out;
};

const chart = (p: number) => {
  const out = blank();
  for (let c = 4; c < 76; c += 2) {
    const k = (c - 4) / 72;
    const h = Math.round((5 + k * 24 + Math.sin(c * 0.7) * 2.2) * clamp(p * 1.6 - k * 0.6));
    for (let i = 0; i < h; i++) {
      const r = 39 - i;
      if (r < 2) continue;
      out[r * COLS + c] = i === h - 1 ? 2 : 1;
    }
  }
  return out;
};

const habit = () =>
  memo("habit", () => {
    const out = blank();
    for (let r = 8; r < 38; r += 3) for (let c = 6; c < 74; c += 3) out[r * COLS + c] = 3;
    return out;
  });

const tape = memo("tape", () =>
  draw((g) => {
    g.font = `800 8.4px 'Open Sans', sans-serif`;
    (g as unknown as { letterSpacing: string }).letterSpacing = "0.9px";
    g.textBaseline = "middle";
    g.fillText("TECH  ·  HEALTHCARE  ·  ETFs  ·  ENERGY  ·  ", 0, 37.6);
  }, 3),
);
const TAPE_W = 92;
const tapeAt = (t: number) => {
  // the band scrolls left one dot per 1/7 s
  const shiftBy = Math.floor(t * 7) % TAPE_W;
  const out = blank();
  for (let r = 34; r < 42; r++)
    for (let c = 0; c < COLS; c++) {
      const src = (c + shiftBy) % TAPE_W;
      if (src < COLS && tape[r * COLS + src]) out[r * COLS + c] = 3;
    }
  return out;
};

/* ---------------------------------------------------------------- the timeline */
const verb = (i: number) =>
  memo(`verb${i}`, () => {
    const m = text(VERBS[i], { y: 18, size: 18, weight: 800, tracking: 1.4 });
    // orange rule under the word, same width as the word
    let c0 = COLS;
    let c1 = 0;
    for (let k = 0; k < N; k++) if (m[k]) {
      c0 = Math.min(c0, k % COLS);
      c1 = Math.max(c1, k % COLS);
    }
    for (let c = c0; c <= c1; c++) m[28 * COLS + c] = 2;
    return m;
  });

export const T = {
  verbs: VERB_AT,
  swirl: L[1].start - 0.05,
  zero: L[1].end + 0.06,
  far: L[2].start,
  pricey: L[3].start,
  complex: L[4].start,
  rattle: L[4].start + 0.4,
  game: L[5].start,
  flood: L[6].start - 0.12,
  unflood: L[7].start - 0.14,
  unlock: L[7].start + 0.12,
  swing: L[7].start + 0.5,
  push: L[8].start - 0.45,
  orange: L[8].start,
  unorange: L[10].start - 0.14,
  count: L[10].start,
  map: L[11].start - 0.04,
  tap: L[11].start + 0.85,
  piece: L[12].start - 0.02,
  lift: L[12].start + 0.35,
  dollar: L[13].start,
  digital: L[14].start - 0.03,
  habit: L[15].start - 0.02,
  choice: L[16].start,
  logo: L[16].end - 0.75,
};

export const SEGS: Seg[] = [
  { at: 0, mask: () => blank(), origin: [40, 22], spread: 0.3 },
  ...VERB_AT.map((at, i): Seg => ({ at, mask: () => verb(i), origin: "left", spread: 0.22, flip: 0.14 })),
  { at: T.zero, mask: () => memo("zero", () => text("0", { y: 21.5, size: 40 })), origin: [40, 22], spread: 0.22 },
  {
    at: T.far,
    mask: (t) => door(1 - 0.42 * ease((t - T.far - 0.2) / 0.8)),
    origin: [40, 22],
    spread: 0.3,
  },
  {
    at: T.pricey,
    mask: (t) => merge(door(0.58), bars(ease((t - T.pricey) / 0.9))),
    origin: [40, 38],
    spread: 0.2,
  },
  {
    at: T.complex,
    mask: (t) => {
      const r = t > T.rattle && t < T.rattle + 0.6 ? Math.round(Math.sin((t - T.rattle) * 60) * 1.2) : 0;
      return merge(door(0.58, { lock: 1, jitter: r }), bars(1));
    },
    origin: [40, 24],
    spread: 0.18,
  },
  { at: T.unflood, mask: () => merge(door(1, { lock: 1 })), origin: "left", spread: 0.3 },
  {
    at: T.unlock,
    mask: (t) => {
      const drop = ease((t - T.unlock - 0.2) / 0.35);
      const open = ease((t - T.swing) / 0.6);
      return door(1, { lock: drop < 1 ? 1 : 0, lockDy: drop * 9, open });
    },
    origin: [40, 22],
    spread: 0.05,
  },
  {
    at: T.unorange,
    mask: (t) => merge(memo("count", () => {
      const m = text("5,000", { x: 34, y: 15, size: 19 });
      return merge(m, text("+", { x: 64, y: 15, size: 19, code: 2 }));
    }), tapeAt(t)),
    origin: "left",
    spread: 0.45,
  },
  { at: T.map, mask: (t) => mapMask(ease((t - T.map - 0.05) / 0.6)), origin: [WORLD.IN[0], WORLD.IN[1]], spread: 0.4 },
  { at: T.piece, mask: (t) => block(ease((t - T.lift) / 0.5)), origin: [23, 19], spread: 0.25 },
  {
    at: T.dollar,
    mask: () => merge(block(1), memo("dollar", () => text("$1", { x: 58, y: 21, size: 20, code: 2 }))),
    origin: [58, 21],
    spread: 0.25,
  },
  { at: T.digital, mask: () => memo("pct", () => text("100%", { y: 17, size: 19 })), origin: "left", spread: 0.35 },
  { at: T.habit, mask: () => habit(), origin: [40, 22], spread: 0.35 },
  { at: T.choice, mask: (t) => chart(ease((t - T.choice) / 1.2)), origin: "left", spread: 0.55 },
  { at: T.logo, mask: () => logoMask(60, 40, 18), origin: [40, 18], spread: 0.35 },
];

export const segAt = (t: number) => {
  let i = 0;
  while (i + 1 < SEGS.length && SEGS[i + 1].at <= t) i++;
  return i;
};

const delays = new Map<number, Float32Array>();
export const delayFor = (k: number) => {
  let d = delays.get(k);
  if (d) return d;
  const s = SEGS[k];
  d = new Float32Array(N);
  let max = 0;
  for (let i = 0; i < N; i++) {
    const c = i % COLS;
    const r = Math.floor(i / COLS);
    let v: number;
    if (s.origin === "left") v = c;
    else if (s.origin === "right") v = COLS - c;
    else v = Math.hypot(c - s.origin[0], (r - s.origin[1]) * 1.25);
    d[i] = v;
    max = Math.max(max, v);
  }
  for (let i = 0; i < N; i++) d[i] = (d[i] / max) * (s.spread ?? 0.3);
  delays.set(k, d);
  return d;
};

export { shift };
