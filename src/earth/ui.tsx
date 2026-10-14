/** Shared 2D layers for the four films: tracked-caps type, end card, grain, sound. */
import React from "react";
import { AbsoluteFill, Html5Audio, Img, Sequence, staticFile } from "remotion";
import { FONT, FPS, inOut, outExpo, tw } from "../theme";

export const Caps: React.FC<{ t: number; at: number; out: number; children: React.ReactNode; size?: number; y: number; dim?: boolean }> = ({
  t,
  at,
  out,
  children,
  size = 34,
  y,
  dim,
}) => {
  const a = tw(t, at, at + 0.9, 0, 1, outExpo) * (1 - tw(t, out - 0.35, out, 0, 1, inOut));
  if (a <= 0) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: y,
        textAlign: "center",
        fontFamily: FONT,
        fontWeight: dim ? 400 : 600,
        fontSize: size,
        letterSpacing: "0.32em",
        color: dim ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.92)",
        opacity: a,
        filter: `blur(${(1 - a) * 8}px)`,
        transform: `translateY(${(1 - a) * 10}px)`,
        textShadow: "0 0 24px rgba(0,0,0,0.6)",
      }}
    >
      {children}
    </div>
  );
};

export const FOOTNOTE = "*ELIGIBLE FRACTIONAL US STOCKS AND ETFS ONLY.";

/** Black end card: a spark of light resolves into the logo, then line + legal footer. Still after +1.1 s. */
export const EndCard: React.FC<{ t: number; at: number }> = ({ t, at }) => {
  const toBlack = tw(t, at - 0.5, at + 0.2, 0, 1, inOut);
  const logo = tw(t, at + 0.1, at + 0.9, 0, 1, outExpo);
  const foot = tw(t, at + 0.6, at + 1.1);
  const spark = Math.exp(-Math.pow((t - at) / 0.18, 2));
  if (toBlack <= 0) return null;
  return (
    <>
      <AbsoluteFill style={{ background: "#02040a", opacity: toBlack }} />
      {spark > 0.01 ? (
        <div
          style={{
            position: "absolute",
            left: 960 - 160,
            top: 470 - 160,
            width: 320,
            height: 320,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(255,214,150,0.95) 0%, rgba(245,130,32,0.35) 18%, rgba(245,130,32,0) 60%)",
            opacity: spark,
            transform: `scale(${0.4 + spark})`,
          }}
        />
      ) : null}
      {logo > 0 ? (
        <>
          <div style={{ position: "absolute", left: 960 - 420, top: 320, width: 840, height: 300, background: "radial-gradient(ellipse at 50% 50%, rgba(245,130,32,0.16), rgba(245,130,32,0) 65%)", opacity: logo }} />
          <Img src={staticFile("brand/mstock-logo-dark.svg")} style={{ position: "absolute", left: 960 - 330, top: 340, width: 660, opacity: logo, filter: `blur(${(1 - logo) * 14}px)`, transform: `scale(${1.05 - 0.05 * logo})` }} />
          <div style={{ position: "absolute", left: 0, right: 0, top: 640, textAlign: "center", fontFamily: FONT, fontWeight: 600, fontSize: 26, letterSpacing: "0.32em", color: "rgba(255,255,255,0.85)", opacity: foot }}>
            US STOCKS, NOW ON m.STOCK
          </div>
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 38, textAlign: "center", fontFamily: FONT, fontSize: 16, lineHeight: 1.6, color: "rgba(255,255,255,0.38)", opacity: foot }}>
            In partnership with ViewTrade | IFSCA-regulated in GIFT City · Mirae Asset Capital Markets (IFSC) Pvt. Ltd. · IFSCA Broker Dealer Registration Number: CMI2026BDK1072
            <br />
            Compliant with RBI&apos;s Liberalised Remittance Scheme (LRS) · *Eligible fractional US stocks and ETFs only.
          </div>
        </>
      ) : null}
    </>
  );
};

export const Grain: React.FC<{ frame: number; id: string }> = ({ frame, id }) => (
  <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, mixBlendMode: "overlay", opacity: 0.2, pointerEvents: "none" }}>
    <filter id={id}>
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} seed={frame % 12} />
      <feColorMatrix values="0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0.55 0" />
    </filter>
    <rect width={1920} height={1080} filter={`url(#${id})`} />
  </svg>
);

export const Vignette: React.FC = () => (
  <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 45%, rgba(0,0,0,0.55) 100%)" }} />
);

/** The approved music bed plus designed hits [time, sfx name, volume]. */
export const Sound: React.FC<{ cues: [number, string, number][] }> = ({ cues }) => (
  <>
    <Html5Audio src={staticFile("audio/music.wav")} volume={(f) => 0.5 * Math.min(1, f / 18)} />
    {cues.map(([at, name, vol], i) => (
      <Sequence key={i} from={Math.max(0, Math.round(at * FPS))} durationInFrames={75} layout="none">
        <Html5Audio src={staticFile(`sfx/${name}.wav`)} volume={vol} />
      </Sequence>
    ))}
  </>
);
