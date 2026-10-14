import React, { useLayoutEffect, useRef } from "react";
import { Img, staticFile } from "remotion";
import { COLS, N, PITCH, ROWS, hash } from "./field";
import { DOOR, MAP, SEGS, T, VERB_AT, arcAt, delayFor, ease, segAt } from "./board";
import { C, FONT, L, inExpo, tw } from "./theme";
import { Kinetic } from "./ui";
import { Board3D } from "./Board3D";

const COL: Record<number, string> = {
  1: C.navy,
  2: C.orange,
  3: "#B4BFCC",
  4: "#FFFFFF",
  5: "#FAD2AC",
  6: "#C6D0DC",
};
const OFF = "#E1E6EC";
const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
const mixHex = (a: string, b: string, p: number) => {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `rgb(${pa.map((v, i) => Math.round(lerp(v, pb[i], p))).join(",")})`;
};

/** Camera: breathing drift, the push through the doorway, and the pull-back out of the logo. */
export const camera = (t: number) => {
  let s = 1 + 0.012 * Math.sin(t * 0.8);
  let ox = 972;
  let oy = 540;

  if (t >= T.logo) {
    s = lerp(1, 0.45, ease((t - T.logo - 0.35) / 0.6));
    ox = 40 * PITCH + 12;
    oy = 18 * PITCH + 12;
  }
  return { s, ox, oy };
};

const Canvas: React.FC<{ t: number }> = ({ t }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const g = ref.current!.getContext("2d")!;
    g.clearRect(0, 0, 1920, 1080);
    const k = segAt(t);
    const seg = SEGS[k];
    const prev = k > 0 ? SEGS[k - 1].mask(seg.at) : new Uint8Array(N);
    const cur = seg.mask(t);
    const dl = delayFor(k);
    const flip = seg.flip ?? 0.16;

    const appear = ease(t / 0.45);
    const grey = t >= T.game && t < T.unflood ? ease((t - T.game) / 0.5) : 0;
    const noise = t >= T.complex + 0.1 && t < T.unflood ? ease((t - T.complex - 0.1) / 0.5) * (1 - grey * 0.6) : 0;
    const light = t >= T.swing && t < T.unorange ? ease((t - T.swing) / 0.7) : 0;
    const swirl = t >= T.swirl && t < T.zero;
    const wash = t >= T.digital + 0.1 && t < T.habit ? ease((t - T.digital - 0.1) / 1.8) : 0;
    const fadeOut = t >= T.logo + 0.5 ? ease((t - T.logo - 0.5) / 0.35) : 0;

    for (let i = 0; i < N; i++) {
      const c = i % COLS;
      const r = Math.floor(i / COLS);
      const x = c * PITCH + PITCH / 2;
      const y = r * PITCH + PITCH / 2;

      // flood to solid navy ("Not anymore.") and the orange room (US stocks)
      const navy = clamp((t - T.flood - (c / COLS) * 0.22) / 0.12) * (1 - clamp((t - T.unflood - (c / COLS) * 0.26) / 0.12));
      const orangeFill = t >= T.orange ? 1 - clamp((t - T.unorange - (1 - c / COLS) * 0.3) / 0.14) : 0;
      if (navy > 0 || orangeFill > 0) {
        const col = orangeFill > 0 ? C.orange : C.navy;
        const f = Math.max(navy, orangeFill);
        const sz = lerp(6, 24.6, f);
        g.fillStyle = col;
        g.beginPath();
        g.roundRect(x - sz / 2, y - sz / 2, sz, sz, lerp(5, 0, f));
        g.fill();
        if (f >= 1) {
          // a faint dot texture stays inside the solid fields
          g.fillStyle = orangeFill > 0 ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.05)";
          g.beginPath();
          g.roundRect(x - 3, y - 3, 6, 6, 3);
          g.fill();
        }
        if (orangeFill >= 1) {
          // white columns rising like a ticker, behind the type
          const h = 6 + ((c * 7) % 9) + Math.sin(t * 2 + c) * 1.5 + (c / COLS) * 10;
          if (ROWS - r < h * ease((t - T.orange - (c % 9) * 0.02) / 0.8)) {
            g.fillStyle = "rgba(255,255,255,0.20)";
            g.beginPath();
            g.roundRect(x - 7, y - 7, 14, 14, 5);
            g.fill();
          }
        }
        continue;
      }

      const p = clamp((t - seg.at - dl[i]) / flip);
      let v = p < 0.5 ? prev[i] : cur[i];
      let grow = p < 0.5 ? 1 - p * 2 : p * 2 - 1;
      if (prev[i] === cur[i]) grow = 1;
      if (swirl && k > 0 && seg.at <= T.swirl) v = 0;
      if (fadeOut > 0) grow *= 1 - fadeOut;

      let size: number;
      let col: string;
      if (t < 0.6 && !v) {
        const R = (t / 0.55) * 48;
        const d = Math.hypot(c - 40, (r - 22) * 1.25);
        const band = 1 - Math.abs(d - R) / 2.2;
        if (band > 0 && hash(i, 3) < 0.55) {
          g.fillStyle = hash(i, 5) < 0.18 ? C.orange : C.navy;
          const z = 13 * band * (1 - t / 0.6);
          g.beginPath();
          g.roundRect(x - z / 2, y - z / 2, z, z, Math.min(5, z / 2));
          g.fill();
          continue;
        }
      }
      if (v) {
        size = 17 * grow;
        col = COL[v];
        if (grey > 0 && (v === 1 || v === 2)) col = mixHex(COL[v], "#B4BFCC", grey);
        if (v === 3 || v === 6) size = 13 * grow;
        if (v === 3 && t >= T.habit && t < T.choice + 0.6) size *= 0.75 + 0.35 * Math.max(0, Math.sin(t * 5 - c * 0.35));
      } else {
        size = 5 * appear * (1 - fadeOut);
        col = OFF;
        const d = Math.hypot(c - DOOR.cx, (r - DOOR.cy) * 1.2);
        if (light > 0 && d < 30) {
          const a = light * Math.pow(1 - d / 30, 1.4);
          col = mixHex(OFF, "#F7A055", a);
          size = lerp(5, 13, a);
        }
        if (noise > 0 && c > 24 && c < 56 && r > 4 && r < 40 && hash(i, Math.floor(t * 14)) < 0.1 * noise) {
          col = mixHex(C.navy, "#B4BFCC", grey);
          size = 9;
        }
        if (wash > 0 && c / COLS < wash) {
          col = "#F9C493";
          size = 10;
        }
      }
      if (size <= 0.3) continue;
      g.fillStyle = col;
      g.beginPath();
      g.roundRect(x - size / 2, y - size / 2, size, size, Math.min(6, size / 2));
      g.fill();
    }

    // the five-verb dots spin into a vortex, then fall into the zero
    if (swirl) {
      const u = (t - T.swirl) / (T.zero - T.swirl);
      const src = SEGS[VERB_AT.length].mask(T.swirl);
      for (let i = 0; i < N; i++) {
        if (!src[i]) continue;
        const c = i % COLS;
        const r = Math.floor(i / COLS);
        const x0 = c * PITCH + 12 - 972;
        const y0 = r * PITCH + 12 - 540;
        const a0 = Math.atan2(y0, x0);
        const r0 = Math.hypot(x0, y0);
        const orbit = 260 + hash(i) * 220;
        const ang = a0 + u * u * 6 + u * 1.5;
        let rad = lerp(r0, orbit, ease(u / 0.35));
        if (u > 0.78) rad *= 1 - ease((u - 0.78) / 0.22);
        const x = 972 + Math.cos(ang) * rad * 1.35;
        const y = 540 + Math.sin(ang) * rad;
        const sz = lerp(17, 12, ease(u / 0.3));
        g.fillStyle = src[i] === 2 ? C.orange : C.navy;
        g.beginPath();
        g.roundRect(x - sz / 2, y - sz / 2, sz, sz, 5);
        g.fill();
      }
    }

    // motes rising out of the open door
    if (light > 0 && t < T.orange) {
      for (let m = 0; m < 16; m++) {
        const st = T.swing + 0.3 + (m % 8) * 0.07;
        const q = clamp((t - st) / 1.1);
        if (q <= 0 || q >= 1) continue;
        const x = (DOOR.cx - 5 + (m * 7) % 11) * PITCH + 12;
        const y = (DOOR.cy + 9) * PITCH - q * (300 + (m % 5) * 70);
        g.fillStyle = m % 3 ? "rgba(245,130,32," + (1 - q) + ")" : "rgba(255,210,170," + (1 - q) + ")";
        g.beginPath();
        g.roundRect(x - 5, y - 9, 10, 18, 5);
        g.fill();
      }
    }
  }, [t]);
  return <canvas ref={ref} width={1920} height={1080} style={{ position: "absolute", left: 0, top: 0 }} />;
};

/** Small white card that carries the spoken line (one idea per beat). */
const Card: React.FC<{ t: number; text: string; at: number; out: number; x?: number; y: number; grey?: boolean; bold?: boolean; anchor?: "center" | "left" }> = ({
  t,
  text,
  at,
  out,
  x = 960,
  y,
  grey,
  bold,
  anchor = "center",
}) => {
  if (t < at - 0.1 || t > out + 0.05) return null;
  const inn = tw(t, at - 0.1, at + 0.25);
  const ex = tw(t, out - 0.2, out, 0, 1, inExpo);
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        transform: `translate(${anchor === "center" ? "-50%" : "0"}, ${(1 - inn) * 24 - ex * 16}px)`,
        opacity: inn * (1 - ex),
        background: "#fff",
        borderRadius: 22,
        padding: "22px 44px 14px",
        boxShadow: "0 1px 2px rgba(13,42,74,.05),0 10px 28px rgba(13,42,74,.08),0 30px 70px rgba(13,42,74,.08)",
      }}
    >
      <Kinetic t={t} text={text} at={at} size={46} weight={bold ? 700 : 600} color={grey ? C.grey : C.navy} stagger={0.09} />
    </div>
  );
};

export const Board: React.FC<{ t: number }> = ({ t }) => {
  const cam = camera(t);
  const logoIn = t >= T.logo + 0.45 ? ease((t - T.logo - 0.45) / 0.3) : 0;
  const end = ease((t - T.logo - 0.8) / 0.4);
  const toOrange = t >= T.push && t < T.orange ? Math.pow(clamp((t - (T.orange - 0.22)) / 0.22), 1.5) : 0;
  const [usx, usy] = [MAP.US[0] * 24 + 24, MAP.US[1] * 24 + 24];
  const tap = t > T.tap ? clamp((t - T.tap) / 0.5) : 0;
  const [mx, my] = arcAt(ease((t - T.map - 0.05) / 0.6));
  return (
    <div style={{ position: "absolute", inset: 0, background: C.soft, overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 40%, #FFFFFF 0%, #F6F8FB 45%, #EEF2F6 100%)" }} />
      <div style={{ position: "absolute", inset: 0, transformOrigin: `${cam.ox}px ${cam.oy}px`, transform: `scale(${cam.s})` }}>
        <Board3D t={t} />
        {toOrange > 0 ? <div style={{ position: "absolute", inset: -2000, background: C.orange, opacity: toOrange }} /> : null}
        {logoIn > 0 ? (
          <Img src={staticFile("brand/mstock-logo-color.svg")} style={{ position: "absolute", left: 240, top: 183, width: 1440, opacity: logoIn }} />
        ) : null}
      </div>

      {/* paper vignette only at the edges, so the board never reads flat */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 62%, rgba(13,42,74,0.06) 100%)" }} />

      {/* 1. the day */}
      <Card t={t} text="Your whole day runs on American companies." at={L[0].start} out={L[1].start - 0.05} y={850} />
      <Card t={t} text="How many do you own?" at={L[1].start} out={L[2].start - 0.05} y={900} />
      {/* 2. the door stays shut */}
      <Card t={t} text="Too far." at={L[2].start} out={L[3].start - 0.04} y={930} />
      <Card t={t} text="Too expensive." at={L[3].start} out={L[4].start - 0.04} y={930} />
      <Card t={t} text="Too complicated." at={L[4].start} out={L[5].start - 0.04} y={930} />
      <Card t={t} text="Somebody else's game." at={L[5].start} out={T.flood + 0.05} y={930} grey />

      {/* 3. Not anymore. (brand on screen by ~10.5 s) */}
      {t >= T.flood + 0.15 && t < T.unflood + 0.2 ? (
        <>
          <div style={{ position: "absolute", left: 150, top: 380, opacity: 1 - tw(t, T.unflood - 0.05, T.unflood + 0.15) }}>
            <Kinetic t={t} text="Not anymore." at={L[6].start} size={176} color="#fff" align="left" stagger={0.16} colors={{ 1: C.orange }} />
          </div>
          <Img
            src={staticFile("brand/mstock-logo-white.svg")}
            style={{ position: "absolute", right: 150, bottom: 110, height: 92, opacity: tw(t, L[6].start + 0.35, L[6].start + 0.6) * (1 - tw(t, T.unflood - 0.05, T.unflood + 0.15)) }}
          />
        </>
      ) : null}
      <Card t={t} text="We opened the door." at={L[7].start} out={T.push + 0.15} y={900} />

      {/* 4. US stocks, now on m.Stock */}
      {t >= T.orange && t < T.unorange + 0.15 ? (
        <div style={{ position: "absolute", inset: 0, opacity: 1 - tw(t, T.unorange - 0.12, T.unorange + 0.04) }}>
          <div style={{ position: "absolute", left: 0, right: 0, top: 300, transform: `translateY(${-tw(t, L[9].start - 0.05, L[9].start + 0.35) * 50}px)` }}>
            <Kinetic t={t} text="US STOCKS" at={L[8].start} size={250} color="#fff" stagger={0.1} />
          </div>
          <div style={{ position: "absolute", left: 0, right: 0, top: 640, display: "flex", justifyContent: "center", alignItems: "center", gap: 30 }}>
            <Kinetic t={t} text="Now on" at={L[9].start} size={64} weight={600} color="#fff" />
            <div style={{ overflow: "hidden", height: 150, display: "flex", alignItems: "center" }}>
              <Img src={staticFile("brand/mstock-logo-white.svg")} style={{ height: 140, transform: `translateY(${(1 - tw(t, L[9].start + 0.25, L[9].start + 0.7)) * 110}%)` }} />
            </div>
          </div>
        </div>
      ) : null}

      {/* 5. 5,000+ and buy from India */}
      <Card t={t} text="stocks and ETFs" at={L[10].start + 1.05} out={T.map - 0.02} y={600} />
      <Card t={t} text="Buy from India." at={L[11].start} out={L[12].start - 0.08} x={150} y={880} anchor="left" />
      {t >= T.map + 0.5 && t < L[12].start - 0.05 ? (
        <div style={{ position: "absolute", left: usx, top: usy + 34, transform: `translate(-50%,0) scale(${1 - 0.07 * Math.sin(tap * Math.PI)})`, opacity: tw(t, T.map + 0.5, T.map + 0.75) * (1 - tw(t, L[12].start - 0.2, L[12].start - 0.05)) }}>
          <div style={{ position: "absolute", inset: -26 * tap, borderRadius: 60, border: `4px solid ${C.orange}`, opacity: tap > 0 ? 1 - tap : 0 }} />
          <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 40, color: "#fff", background: t > T.tap + 0.08 ? C.orange : C.navy, borderRadius: 60, padding: "14px 54px" }}>Buy</div>
        </div>
      ) : null}
      {t > T.map + 0.05 && t < T.map + 0.7 ? (
        <div style={{ position: "absolute", left: mx * 24 + 12, top: my * 24 + 12, width: 30, height: 30, marginLeft: -15, marginTop: -15, borderRadius: 15, background: C.orange, boxShadow: "0 0 0 10px rgba(245,130,32,0.2)" }} />
      ) : null}

      {/* 6. own a piece, from $1 */}
      <Card t={t} text="Own a piece." at={L[12].start} out={L[13].start - 0.04} y={860} />
      <Card t={t} text="From $1*" at={L[13].start} out={T.digital - 0.05} y={860} bold />
      {t >= L[13].start && t < T.digital ? (
        <div style={{ position: "absolute", left: 150, bottom: 52, fontFamily: FONT, fontWeight: 600, fontSize: 24, color: C.grey, opacity: tw(t, L[13].start, L[13].start + 0.3) }}>*Eligible fractional US stocks and ETFs only.</div>
      ) : null}

      {/* 7. 100% digital */}
      <Card t={t} text="100% digital account opening." at={L[14].start + 0.15} out={T.habit - 0.04} y={770} />

      {/* 8. habit → choice */}
      <Card t={t} text="Customer by habit." at={L[15].start} out={L[16].start - 0.04} y={930} grey />
      <Card t={t} text="Shareholder by choice." at={L[16].start} out={T.logo + 0.75} y={930} bold />

      {/* 9. lockup */}
      {end > 0 ? (
        <>
          <div style={{ position: "absolute", left: 0, right: 0, top: 690, textAlign: "center", opacity: end, transform: `translateY(${(1 - end) * 20}px)` }}>
            <div style={{ display: "inline-block", fontFamily: FONT, fontWeight: 700, fontSize: 30, letterSpacing: "0.16em", color: C.navy, border: `3px solid ${C.navy}`, borderRadius: 60, padding: "14px 36px" }}>
              US STOCKS <span style={{ color: C.orange }}>·</span> NOW OPEN
            </div>
          </div>
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 40, textAlign: "center", fontFamily: FONT, fontSize: 17, lineHeight: 1.6, color: C.grey, opacity: end }}>
            In partnership with ViewTrade | IFSCA-regulated in GIFT City · Mirae Asset Capital Markets (IFSC) Pvt. Ltd. · IFSCA Broker Dealer Registration Number: CMI2026BDK1072
            <br />
            Compliant with RBI&apos;s Liberalised Remittance Scheme (LRS) · *Eligible fractional US stocks and ETFs only.
          </div>
        </>
      ) : null}
    </div>
  );
};
