/**
 * Dot-matrix "ticker board" that fills the frame. Every hero shape in the
 * film is a mask on this grid; dots flip between masks with a ripple.
 */
import { FONT } from "./theme";

export const COLS = 80;
export const ROWS = 45;
export const PITCH = 24; // 80 × 24 = 1920, 45 × 24 = 1080
export const N = COLS * ROWS;

/** 0 off · 1 navy · 2 orange · 3 grey · 4 white · 5 soft orange */
export type Mask = Uint8Array;
export const blank = (): Mask => new Uint8Array(N);

const S = 6; // supersampling per dot
let _ctx: CanvasRenderingContext2D | null = null;
const ctx = () => {
  if (!_ctx) {
    const c = document.createElement("canvas");
    c.width = COLS * S;
    c.height = ROWS * S;
    _ctx = c.getContext("2d", { willReadFrequently: true })!;
  }
  return _ctx;
};

/** Rasterise any canvas drawing (in dot units) into a mask. */
export const draw = (paint: (g: CanvasRenderingContext2D) => void, code = 1, threshold = 0.42, into?: Mask): Mask => {
  const g = ctx();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, COLS * S, ROWS * S);
  g.setTransform(S, 0, 0, S, 0, 0);
  g.fillStyle = "#000";
  g.strokeStyle = "#000";
  paint(g);
  const d = g.getImageData(0, 0, COLS * S, ROWS * S).data;
  const m = into ?? blank();
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      let a = 0;
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) a += d[((r * S + y) * COLS * S + c * S + x) * 4 + 3];
      if (a / (S * S * 255) > threshold) m[r * COLS + c] = code;
    }
  }
  return m;
};

export const text = (
  str: string,
  o: { x?: number; y?: number; size: number; weight?: number; code?: number; align?: CanvasTextAlign; into?: Mask; tracking?: number },
): Mask =>
  draw(
    (g) => {
      g.font = `${o.weight ?? 800} ${o.size}px ${FONT}`;
      g.textAlign = o.align ?? "center";
      g.textBaseline = "middle";
      (g as unknown as { letterSpacing: string }).letterSpacing = `${o.tracking ?? 0.6}px`;
      g.fillText(str, o.x ?? COLS / 2, o.y ?? ROWS / 2);
    },
    o.code ?? 1,
    0.42,
    o.into,
  );

const cache = new Map<string, Mask>();
export const memo = (key: string, make: () => Mask): Mask => {
  let m = cache.get(key);
  if (!m) {
    m = make();
    cache.set(key, m);
  }
  return m;
};

export const merge = (...ms: Mask[]): Mask => {
  const out = blank();
  for (const m of ms) for (let i = 0; i < N; i++) if (m[i]) out[i] = m[i];
  return out;
};

export const shift = (m: Mask, dx: number, dy: number, recode?: number): Mask => {
  const out = blank();
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      const v = m[r * COLS + c];
      if (!v) continue;
      const nr = r + dy;
      const nc = c + dx;
      if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;
      out[nr * COLS + nc] = recode ?? v;
    }
  return out;
};

/** Logo raster, colours read back from the artwork (orange m, navy Stock). */
let logoImg: HTMLImageElement | null = null;
export const setLogo = (img: HTMLImageElement) => {
  logoImg = img;
};
export const logoMask = (width: number, cx: number, cy: number): Mask =>
  memo(`logo${width}`, () => {
    const g = ctx();
    const h = width * (225 / 650);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, COLS * S, ROWS * S);
    g.setTransform(S, 0, 0, S, 0, 0);
    if (logoImg) g.drawImage(logoImg, cx - width / 2, cy - h / 2, width, h);
    const d = g.getImageData(0, 0, COLS * S, ROWS * S).data;
    const m = blank();
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) {
        let a = 0;
        let red = 0;
        for (let y = 0; y < S; y++)
          for (let x = 0; x < S; x++) {
            const k = ((r * S + y) * COLS * S + c * S + x) * 4;
            a += d[k + 3];
            red += d[k] * d[k + 3];
          }
        if (a / (S * S * 255) > 0.35) m[r * COLS + c] = red / a > 128 ? 2 : 1;
      }
    return m;
  });

export const hash = (i: number, j = 0) => {
  const x = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
  return x - Math.floor(x);
};
