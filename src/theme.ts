import { Easing, interpolate } from "remotion";
import timings from "./timings.json";

export const FPS = 30;
export const W = 1920;
export const H = 1080;

export const C = {
  orange: "#F58220",
  navy: "#043B72",
  ink: "#0B2545",
  grey: "#8A97A8",
  line: "#E4E9F0",
  soft: "#F6F8FB",
  paper: "#FFFFFF",
  tint: "#FFF1E4",
  navySoft: "#E7EEF6",
};

export const FONT = "'Open Sans', sans-serif";

export const outExpo = Easing.bezier(0.16, 1, 0.3, 1);
export const inOut = Easing.bezier(0.65, 0, 0.35, 1);
export const inExpo = Easing.bezier(0.7, 0, 0.84, 0);
export const backOut = Easing.bezier(0.34, 1.56, 0.64, 1);

/** Voice-over lines placed by tools/build_audio.py, in film seconds. */
export const L = timings.lines;
export const BEATS: number[] = timings.beats;

/** Clamped interpolation over film seconds. */
export const tw = (
  t: number,
  t0: number,
  t1: number,
  from = 0,
  to = 1,
  easing: (x: number) => number = outExpo,
) =>
  interpolate(t, [t0, t1], [from, to], {
    easing,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

/** 0 → 1 → 0 window: fades in over `fin`, holds, fades out over `fout`. */
export const win = (t: number, t0: number, t1: number, fin = 0.25, fout = 0.2) =>
  Math.min(tw(t, t0, t0 + fin), 1 - tw(t, t1 - fout, t1, 0, 1, inExpo));

export const mix = (a: number, b: number, p: number) => a + (b - a) * p;
