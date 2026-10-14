import React from "react";
import { AbsoluteFill, Html5Audio, Sequence, staticFile, useCurrentFrame } from "remotion";
import { Board } from "./Board";
import { T, VERB_AT } from "./board";
import { FPS, L } from "./theme";

type Cue = [at: number, name: string, vol?: number];

// Every designed sound sits on a visual event, and structural hits sit in VO gaps.
const CUES: Cue[] = [
  [0.0, "swish", 0.35],
  ...VERB_AT.map((v): Cue => [v, "flap", 0.32]),
  [T.swirl, "whoosh", 0.35],
  [T.zero, "thud", 0.85],
  [T.far, "flap", 0.3],
  [T.pricey, "flap", 0.26],
  [T.complex + 0.05, "pop", 0.35],
  [T.rattle, "rattle", 0.6],
  [T.flood, "whoosh", 0.5],
  [L[6].start + 0.02, "thud", 0.4],
  [T.unflood, "whoosh", 0.35],
  [T.unlock + 0.2, "unlock", 0.8],
  [T.swing, "door", 0.6],
  [T.swing + 0.45, "riser", 0.55],
  [T.swing + 0.5, "shimmer", 0.3],
  [T.orange, "impact", 0.9],
  [L[9].start + 0.25, "swish", 0.35],
  [T.unorange, "whoosh", 0.45],
  [T.unorange + 0.08, "flap", 0.35],
  [T.map, "flap", 0.3],
  [T.map + 0.1, "swish", 0.3],
  [T.tap, "tap", 0.75],
  [T.piece, "flap", 0.28],
  [T.lift, "pop", 0.5],
  [T.dollar + 0.05, "pop", 0.45],
  [T.digital, "flap", 0.3],
  [T.digital + 1.9, "chime", 0.45],
  [T.habit, "flap", 0.24],
  [T.choice, "swish", 0.3],
  [T.choice + 0.05, "flap", 0.3],
  [T.logo, "flap", 0.4],
  [T.logo + 0.35, "sting", 0.7],
  [T.logo + 0.4, "shimmer", 0.25],
];

/** Music sits under the voice and opens up in the gaps and on the end card. */
const musicVolume = (t: number) => {
  let dist = 99;
  for (const l of L) {
    if (t >= l.start - 0.05 && t <= l.end + 0.05) dist = 0;
    else dist = Math.min(dist, Math.abs(t - l.start), Math.abs(t - l.end));
  }
  const duck = 0.13 + (0.22 - 0.13) * Math.min(1, dist / 0.3);
  const tail = L[L.length - 1].end;
  const end = t > tail ? 0.22 + (0.42 - 0.22) * Math.min(1, (t - tail) / 0.4) : duck;
  return end * Math.min(1, t / 0.15);
};

export const Film: React.FC = () => {
  const t = useCurrentFrame() / FPS;
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <Board t={t} />
      <Html5Audio src={staticFile("audio/vo.wav")} />
      <Html5Audio src={staticFile("audio/music.wav")} volume={(f) => musicVolume(f / FPS)} />
      {CUES.map(([at, name, vol = 0.5], i) => (
        <Sequence key={i} from={Math.max(0, Math.round(at * FPS))} durationInFrames={75} layout="none">
          <Html5Audio src={staticFile(`sfx/${name}.wav`)} volume={vol} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
