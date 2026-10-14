// Renders the storyboard style frames: one HTML file per frame, screenshotted by headless Chromium at 1920x1080.
// Run: node storyboards/frames/build.mjs
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { geoEquirectangular, geoContains } from "d3-geo";
import { feature } from "topojson-client";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const OUT = path.join(ROOT, "storyboards/frames/html");
const PNG = path.join(ROOT, "storyboards/frames/png");
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(PNG, { recursive: true });

const CHROME = ["/opt/pw-browsers/chromium-1194/chrome-linux/chrome", "chromium", "google-chrome"].find((p) => {
  try {
    return p.startsWith("/") ? fs.existsSync(p) : true;
  } catch {
    return false;
  }
});

const rel = (p) => path.relative(OUT, path.join(ROOT, p));
const logoColor = fs.readFileSync(path.join(ROOT, "public/brand/mstock-logo-color.svg"), "utf8");
const logoWhite = fs.readFileSync(path.join(ROOT, "public/brand/mstock-logo-white.svg"), "utf8");
// The orange comma from the m.Stock logo: the film's carrier object in concept 1.
const COMMA_D = logoColor.match(/d="(M 378\.175781 325\.222656[^"]*)"/)[1];
const comma = (h, fill = "#F58220", extra = "") =>
  `<svg viewBox="366 284 30 43" style="height:${h}px;width:${(h * 30) / 43}px;overflow:visible;${extra}"><path d="${COMMA_D}" fill="${fill}"/></svg>`;

const CSS = `
@font-face{font-family:'Open Sans';font-weight:400;src:url(${rel("public/fonts/open-sans-latin-400-normal.woff2")})}
@font-face{font-family:'Open Sans';font-weight:600;src:url(${rel("public/fonts/open-sans-latin-600-normal.woff2")})}
@font-face{font-family:'Open Sans';font-weight:700;src:url(${rel("public/fonts/open-sans-latin-700-normal.woff2")})}
@font-face{font-family:'Open Sans';font-weight:800;src:url(${rel("public/fonts/open-sans-latin-800-normal.woff2")})}
:root{--paper:#F5F6F8;--white:#FFFFFF;--navy:#043B72;--ink:#0D2A4A;--slate:#5B6B80;--mist:#8A97A8;--line:#DCE2EA;--orange:#F58220;--tint:#FFF1E4}
*{box-sizing:border-box}
html,body{margin:0;width:1920px;height:1080px;overflow:hidden;background:var(--paper)}
body{font-family:'Open Sans',sans-serif;color:var(--navy);-webkit-font-smoothing:antialiased}
.f{position:absolute;inset:0;overflow:hidden}
.abs{position:absolute}
.grain{position:absolute;inset:0;pointer-events:none;mix-blend-mode:multiply;opacity:.55}
.vig{position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse at 50% 45%,rgba(255,255,255,0) 55%,rgba(13,42,74,.06) 100%)}
.cap{font-weight:600;font-size:60px;letter-spacing:-.01em;line-height:1.12}
.lab{font-weight:700;font-size:24px;letter-spacing:.18em;text-transform:uppercase}
.mono{font-family:'DejaVu Sans Mono',monospace}
.shadow{box-shadow:0 1px 2px rgba(13,42,74,.05),0 10px 28px rgba(13,42,74,.08),0 30px 70px rgba(13,42,74,.08)}
`;
const GRAIN = `<svg class="grain" width="1920" height="1080"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 .45  0 0 0 0 .47  0 0 0 0 .5  0 0 0 .09 0"/></filter><rect width="1920" height="1080" filter="url(#n)"/></svg>`;
const page = (body, { bg = "var(--paper)", script = "" } = {}) =>
  `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body style="background:${bg}"><div class="f">${body}</div>${GRAIN}<div class="vig"></div>${script}</body></html>`;

/* -------------------------------------------------- shared pieces */
const footer = `<div class="abs" style="left:0;right:0;bottom:42px;text-align:center;font-size:17px;line-height:1.6;color:var(--mist)">In partnership with ViewTrade | IFSCA-regulated in GIFT City · Mirae Asset Capital Markets (IFSC) Pvt. Ltd. · IFSCA Broker Dealer Registration Number: CMI2026BDK1072<br>Compliant with RBI's Liberalised Remittance Scheme (LRS) · *Eligible fractional US stocks and ETFs only.</div>`;
const logoBlock = (w, white = false) => `<div style="width:${w}px">${(white ? logoWhite : logoColor).replace("<svg ", `<svg style="width:${w}px;height:auto;display:block" `)}</div>`;
const chip = (t, dark = false) =>
  `<div style="display:inline-block;font-weight:700;font-size:28px;letter-spacing:.16em;color:${dark ? "#fff" : "var(--navy)"};border:2.5px solid ${dark ? "#fff" : "var(--navy)"};border-radius:60px;padding:14px 34px">${t}</div>`;

// thin-line pictograms (2px navy), drawn on a 48 box
const PICT = {
  scroll: `<rect x="14" y="4" width="20" height="40" rx="5"/><path d="M19 14h10M19 21h7M19 28h10M19 35h6"/>`,
  stream: `<rect x="4" y="9" width="40" height="28" rx="6"/><path d="M21 17l9 6-9 6z"/><path d="M8 43h32"/>`,
  search: `<circle cx="21" cy="21" r="12"/><path d="M30 30l11 11"/>`,
  ride: `<path d="M8 32l4-11c1-3 3-4 6-4h12c3 0 5 1 6 4l4 11"/><rect x="6" y="30" width="36" height="9" rx="4"/><circle cx="14" cy="39" r="3"/><circle cx="34" cy="39" r="3"/>`,
  pay: `<rect x="4" y="11" width="40" height="27" rx="5"/><path d="M4 19h40M10 31h10"/>`,
};
const pict = (k, size = 44, color = "var(--navy)", sw = 2.4) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 48 48" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${PICT[k]}</svg>`;

/* -------------------------------------------------- dotted world map (concept 4) */
const topo = JSON.parse(fs.readFileSync(path.join(ROOT, "node_modules/world-atlas/land-110m.json"), "utf8"));
const land = feature(topo, topo.objects.land);
const proj = geoEquirectangular().scale(330).translate([960, 610]).center([-10, 22]);
let MAPDOTS = "";
{
  const step = 15;
  for (let y = 120; y < 1000; y += step)
    for (let x = 60; x < 1860; x += step) {
      const ll = proj.invert([x, y]);
      if (ll && geoContains(land, ll)) MAPDOTS += `<circle cx="${x}" cy="${y}" r="3.1"/>`;
    }
}
const IN = proj([78.9, 21.5]);
const US = proj([-98, 39]);

/* -------------------------------------------------- frames */
const F = {};

/* ===== Concept 1 · The comma ===== */
F["c1-1"] = page(`
  <div class="abs cap" style="left:160px;top:190px;font-size:64px">Your whole day runs on<br><b style="font-weight:700">American companies.</b></div>
  <div class="abs" style="left:160px;right:160px;top:742px;height:3px;background:var(--line);border-radius:2px"></div>
  <div class="abs" style="left:160px;width:812px;top:742px;height:3px;background:var(--navy);border-radius:2px"></div>
  ${[["07:40", "scroll", "Scroll"], ["09:15", "stream", "Stream"], ["13:05", "search", "Search"], ["18:30", "ride", "Ride"], ["21:50", "pay", "Pay"]]
    .map(([t, k, v], i) => {
      const x = 260 + i * 350;
      const done = i < 2;
      const now = i === 2;
      const c = done || now ? "var(--navy)" : "#B7C2D0";
      return `<div class="abs" style="left:${x - 100}px;width:200px;top:560px;text-align:center">
        <div style="opacity:${now ? 1 : done ? 0.85 : 0.6}">${pict(k, 52, c)}</div>
        <div style="font-size:22px;font-weight:600;color:var(--mist);margin-top:18px;font-variant-numeric:tabular-nums">${t}</div>
      </div>
      <div class="abs" style="left:${x - 9}px;top:734px;width:18px;height:18px;border-radius:9px;background:${done || now ? "var(--navy)" : "#fff"};border:3px solid ${c}"></div>
      <div class="abs lab" style="left:${x - 120}px;width:240px;top:790px;text-align:center;font-size:22px;color:${c}">${v}</div>`;
    })
    .join("")}
  <div class="abs" style="left:944px;top:648px;transform:rotate(-8deg);filter:drop-shadow(0 10px 14px rgba(245,130,32,.35))">${comma(72)}</div>
  <div class="abs" style="left:900px;top:658px;opacity:.28;transform:rotate(-8deg)">${comma(64)}</div>
  <div class="abs" style="left:862px;top:668px;opacity:.12;transform:rotate(-8deg)">${comma(56)}</div>
`);

F["c1-2"] = page(`
  <div class="abs cap" style="left:160px;top:190px;font-size:64px">How many<br>do you own?</div>
  <div class="abs" style="left:900px;top:120px;font-size:860px;font-weight:300;line-height:1;color:transparent;-webkit-text-stroke:3px var(--navy);letter-spacing:-.04em">0</div>
  <div class="abs" style="left:1215px;top:520px;transform:rotate(14deg);filter:drop-shadow(0 18px 20px rgba(245,130,32,.35))">${comma(96)}</div>
  <div class="abs" style="left:1208px;top:900px;width:120px;height:18px;border-radius:50%;background:radial-gradient(rgba(13,42,74,.18),rgba(13,42,74,0) 70%)"></div>
`);

F["c1-3"] = page(`
  <div class="abs" style="left:0;right:0;top:868px;height:2px;background:var(--line)"></div>
  <div class="abs" style="left:1010px;top:228px;width:400px;height:642px;border:3px solid var(--navy);border-bottom:none;border-radius:6px 6px 0 0"></div>
  <div class="abs" style="left:1028px;top:246px;width:364px;height:624px;border-radius:2px;background:radial-gradient(ellipse at 40% 80%,#FFE3C6 0%,#FBA45C 38%,#F58220 64%,#D96410 100%);box-shadow:0 0 180px 50px rgba(245,130,32,.28)"></div>
  <div class="abs" style="left:1028px;top:246px;width:364px;height:624px;transform-origin:left center;transform:perspective(1400px) rotateY(-74deg);background:#fff;border:3px solid var(--navy);border-radius:2px">
    <div class="abs" style="left:36px;right:36px;top:40px;height:250px;border:2.5px solid var(--line)"></div>
    <div class="abs" style="left:36px;right:36px;bottom:40px;height:250px;border:2.5px solid var(--line)"></div>
  </div>
  <div class="abs" style="left:640px;top:868px;width:1200px;height:212px;background:linear-gradient(to bottom,rgba(245,130,32,.40),rgba(245,130,32,0));clip-path:polygon(32% 0,66% 0,100% 100%,0 100%)"></div>
  <div class="abs" style="left:1176px;top:776px;transform:rotate(-90deg);filter:drop-shadow(0 0 22px rgba(255,255,255,.9))">${comma(70, "#fff")}</div>
  ${[[1150, 520], [1270, 430], [1320, 610], [1110, 680], [1240, 330], [1350, 720]].map(([x, y], i) => `<div class="abs" style="left:${x}px;top:${y}px;width:${6 + (i % 3) * 3}px;height:${6 + (i % 3) * 3}px;border-radius:50%;background:#FFE7CF;opacity:.85"></div>`).join("")}
  <div class="abs cap" style="left:160px;top:420px;font-size:64px">We opened<br>the door.</div>
`);

F["c1-4"] = page(`
  <div class="abs" style="left:160px;top:300px;display:flex;align-items:flex-end;font-weight:800;font-size:300px;line-height:.86;letter-spacing:-.045em;color:var(--navy)">
    <span>5</span><span style="display:inline-block;width:70px;position:relative;top:44px;margin:0 6px">${comma(120)}</span><span>000+</span>
  </div>
  <div class="abs" style="left:168px;top:640px;font-size:52px;font-weight:600;color:var(--slate)">stocks and ETFs</div>
  <div class="abs" style="left:1360px;top:230px;width:420px;height:600px;-webkit-mask-image:linear-gradient(transparent,#000 22%,#000 78%,transparent)">
    ${["Technology", "Healthcare", "Index ETFs", "Consumer", "Energy", "Semiconductors", "Financials", "Bond ETFs", "Media"].map((s, i) => `<div style="height:66px;display:flex;align-items:center;gap:18px;font-size:30px;font-weight:${i === 4 ? 700 : 600};color:${i === 4 ? "var(--navy)" : "var(--mist)"};border-bottom:1.5px solid var(--line)"><span style="width:10px;height:10px;border-radius:5px;background:${i === 4 ? "var(--navy)" : "#C9D2DE"}"></span>${s}</div>`).join("")}
  </div>
`);

F["c1-5"] = page(`
  <div class="abs" style="left:530px;top:350px">${logoBlock(860)}</div>
  <div class="abs" style="left:430px;top:395px;opacity:.18;transform:rotate(-12deg)">${comma(60)}</div>
  <div class="abs" style="left:380px;top:410px;opacity:.08;transform:rotate(-18deg)">${comma(52)}</div>
  <div class="abs" style="left:0;right:0;top:720px;text-align:center">${chip('US STOCKS <span style="color:var(--orange)">·</span> NOW OPEN')}</div>
  ${footer}
`);

/* ===== Concept 2 · Receipt to share ===== */
const receipt = ({ w = 560, rows = [], total = "", rot = 0, x = 0, y = 0, scale = 1, tear = "" }) => `
  <div class="abs shadow" style="left:${x}px;top:${y}px;width:${w}px;transform:rotate(${rot}deg) scale(${scale});transform-origin:top left;background:#FFFEFB;padding:46px 46px 70px;clip-path:polygon(0 0,100% 0,100% calc(100% - 16px),${Array.from({ length: 29 }, (_, i) => `${100 - (i * 100) / 28}% ${i % 2 ? "100%" : "calc(100% - 16px)"}`).join(",")})${tear}">
    <div class="mono" style="text-align:center;font-size:30px;font-weight:700;letter-spacing:.2em;color:#222">YOUR DAY</div>
    <div class="mono" style="text-align:center;font-size:20px;color:#666;margin-top:6px">MON · 14 OCT</div>
    <div style="border-top:2px dashed #BBB;margin:26px 0"></div>
    ${rows.map(([t, v]) => `<div class="mono" style="display:flex;font-size:25px;color:#333;margin:10px 0"><span style="width:110px;color:#888">${t}</span><span style="flex:1;overflow:hidden;white-space:nowrap">${v} ${".".repeat(40)}</span><span>✓</span></div>`).join("")}
    <div style="border-top:2px dashed #BBB;margin:26px 0"></div>
    ${total}
    <div style="margin-top:34px;height:64px;background:repeating-linear-gradient(90deg,#222 0 3px,transparent 3px 7px,#222 7px 8px,transparent 8px 13px,#222 13px 17px,transparent 17px 19px)"></div>
  </div>`;
const ROWS = [["07:40", "SCROLL"], ["09:15", "STREAM"], ["13:05", "SEARCH"], ["18:30", "RIDE"], ["21:50", "PAY"]];
const ownedZero = `<div class="mono" style="display:flex;align-items:baseline;font-size:30px;font-weight:700;color:#111"><span style="flex:1;white-space:nowrap;overflow:hidden">SHARES OWNED ${".".repeat(30)}</span><span style="font-size:84px;line-height:1;color:var(--navy)">0</span></div>`;

F["c2-1"] = page(`
  <div class="abs" style="left:300px;top:-40px;width:640px;height:46px;border-radius:0 0 18px 18px;background:#1C2B3D"></div>
  ${receipt({ x: 340, y: -140, rows: ROWS, total: ownedZero.replace("0</span>", "</span>"), rot: 0 })}
  <div class="abs cap" style="left:1060px;top:380px;font-size:62px">Your whole day runs on<br><b style="font-weight:700">American companies.</b></div>
`);

F["c2-2"] = page(`
  ${receipt({ x: 380, y: 70, rows: ROWS, total: ownedZero, rot: -2.5 })}
  <div class="abs cap" style="left:1130px;top:430px;font-size:66px">How many<br>do you own?</div>
  <svg class="abs" style="left:768px;top:418px" width="220" height="140"><ellipse cx="110" cy="70" rx="96" ry="54" fill="none" stroke="var(--orange)" stroke-width="5" stroke-linecap="round" stroke-dasharray="520 40" transform="rotate(-6 110 70)"/></svg>
`);

F["c2-3"] = page(`
  <div class="abs" style="left:0;top:0;width:1920px;height:1080px;background:radial-gradient(ellipse at 50% 50%,#FFE7CF 0%,#FBA35A 30%,#F58220 55%,#C9590C 100%)"></div>
  <div class="abs" style="left:-20px;top:-30px;width:860px;height:1140px;background:#FFFEFB;transform:rotate(-2.2deg);box-shadow:20px 0 60px rgba(120,50,0,.35);clip-path:polygon(0 0,100% 0,${Array.from({ length: 30 }, (_, i) => `${96 + (i % 2 ? 4 : 0) - (i % 3)}% ${(i * 100) / 29}%`).join(",")},0 100%)">
    <div class="mono" style="position:absolute;left:190px;top:300px;font-size:44px;color:#333;line-height:2.1">18:30&nbsp;&nbsp;RIDE ......<br>21:50&nbsp;&nbsp;PAY .......<br><b style="color:#111">SHARES OWNED ...</b></div>
  </div>
  <div class="abs" style="left:1090px;top:-30px;width:860px;height:1140px;background:#FFFEFB;transform:rotate(2.4deg);box-shadow:-20px 0 60px rgba(120,50,0,.35);clip-path:polygon(${Array.from({ length: 30 }, (_, i) => `${(i % 2 ? 0 : 4) + (i % 3)}% ${(i * 100) / 29}%`).join(",")},100% 100%,100% 0)">
    <div class="mono" style="position:absolute;left:60px;top:300px;font-size:44px;color:#333;line-height:2.1">.... ✓<br>.... ✓<br><b style="color:#111">..... 0</b></div>
  </div>
  <div class="abs cap" style="left:190px;top:820px;font-size:60px;transform:rotate(-2.2deg)">We opened the door.</div>
`);

const guilloche = (w, h, c = "#043B72") => {
  let p = "";
  for (let k = 0; k < 7; k++) {
    let d = "";
    for (let i = 0; i <= 240; i++) {
      const t = (i / 240) * Math.PI * 2;
      const r = 1 + 0.04 * Math.sin(t * 18 + k) + 0.02 * Math.sin(t * 7 - k);
      const x = w / 2 + Math.cos(t) * (w / 2 - 30 - k * 6) * r;
      const y = h / 2 + Math.sin(t) * (h / 2 - 30 - k * 6) * r;
      d += `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
    }
    p += `<path d="${d}Z" fill="none" stroke="${c}" stroke-width=".8" opacity=".35"/>`;
  }
  return p;
};
const rosette = (r, c) => {
  let p = "";
  for (let k = 0; k < 24; k++) p += `<ellipse cx="0" cy="0" rx="${r}" ry="${r * 0.32}" transform="rotate(${k * 7.5})" fill="none" stroke="${c}" stroke-width="1.1"/>`;
  return p;
};
const certificate = ({ x, y, rot = 0, w = 1060, h = 620, body = "", seal = true, z = "" }) => `
  <div class="abs shadow" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px;transform:rotate(${rot}deg);background:#FFFDF8;${z}">
    <svg class="abs" style="inset:0" width="${w}" height="${h}">
      <rect x="18" y="18" width="${w - 36}" height="${h - 36}" fill="none" stroke="#043B72" stroke-width="2"/>
      <rect x="28" y="28" width="${w - 56}" height="${h - 56}" fill="none" stroke="#043B72" stroke-width=".8"/>
      ${guilloche(w, h)}
      ${seal ? `<g transform="translate(${w - 150} ${h - 140})">${rosette(70, "#F58220")}<circle r="30" fill="#F58220"/></g>` : ""}
    </svg>
    <div class="abs" style="inset:0;padding:80px 90px">${body}</div>
  </div>`;

F["c2-4"] = page(`
  ${certificate({ x: 470, y: 170, rot: -6, seal: false, body: "" })}
  ${certificate({ x: 440, y: 200, rot: 3, seal: false, body: "" })}
  ${certificate({
    x: 430,
    y: 220,
    rot: -1,
    body: `<div style="font-size:22px;font-weight:700;letter-spacing:.34em;color:var(--mist)">CERTIFICATE OF OWNERSHIP</div>
      <div style="font-size:132px;font-weight:800;letter-spacing:-.02em;margin-top:30px;line-height:1">US STOCKS</div>
      <div style="display:flex;align-items:center;gap:22px;margin-top:34px;font-size:40px;font-weight:600;color:var(--slate)">Now on ${logoBlock(250)}</div>
      <div style="margin-top:52px;font-size:30px;font-weight:600;color:var(--navy)">5,000+ stocks and ETFs</div>`,
  })}
`);

F["c2-5"] = page(`
  ${receipt({ x: 210, y: 210, rows: ROWS.slice(0, 3), total: "", rot: -3, w: 470 })}
  <div class="abs" style="left:780px;top:220px;width:60px;height:640px;background:linear-gradient(90deg,#E9EDF2,#FFFDF8 40%,#D9DFE7);box-shadow:0 30px 60px rgba(13,42,74,.18);transform:skewY(-4deg)"></div>
  ${certificate({
    x: 960,
    y: 250,
    w: 760,
    h: 470,
    rot: 2,
    body: `<div style="font-size:18px;font-weight:700;letter-spacing:.3em;color:var(--mist)">SHAREHOLDER</div><div style="font-size:84px;font-weight:800;margin-top:24px;line-height:1">US STOCKS</div>`,
  })}
  <div class="abs" style="left:210px;top:880px;font-size:44px;font-weight:600;color:var(--mist)">Customer by habit.</div>
  <div class="abs" style="left:960px;top:870px;font-size:60px;font-weight:700">Shareholder by choice.</div>
`);

/* ===== Concept 3 · Two sides ===== */
const half = (side, inner, bg) =>
  `<div class="abs" style="${side}:0;top:0;width:960px;height:1080px;background:${bg};overflow:hidden">${inner}</div>`;
F["c3-1"] = page(`
  ${half("left", `
    <div class="abs lab" style="left:120px;top:120px;color:var(--mist)">You use</div>
    ${["Scroll", "Stream", "Search", "Ride", "Pay"].map((v, i) => `<div class="abs" style="left:120px;top:${250 + i * 120}px;display:flex;align-items:center;gap:28px;font-size:${i === 2 ? 76 : 58}px;font-weight:${i === 2 ? 800 : 600};color:${i === 2 ? "var(--navy)" : "#9AA7B8"}">${pict(["scroll", "stream", "search", "ride", "pay"][i], i === 2 ? 64 : 48, i === 2 ? "var(--navy)" : "#B5C0CE")}${v}</div>`).join("")}
  `, "var(--paper)")}
  ${half("right", `
    <div class="abs lab" style="left:120px;top:120px;color:var(--mist)">You own</div>
    <div class="abs" style="left:300px;top:200px;font-size:560px;font-weight:300;color:transparent;-webkit-text-stroke:3px #C9D2DE;line-height:1">0</div>
  `, "#ECEFF3")}
  <div class="abs" style="left:958px;top:0;width:4px;height:1080px;background:var(--navy)"></div>
  <div class="abs cap" style="left:120px;top:860px;font-size:50px">Your whole day runs on<br><b style="font-weight:700">American companies.</b></div>
`);

F["c3-2"] = page(`
  ${half("left", `<div class="abs" style="left:120px;top:400px;font-size:84px;font-weight:800;line-height:1.15;color:#9AA7B8">Too far.<br>Too expensive.<br><span style="color:var(--navy)">Too complicated.</span></div>`, "var(--paper)")}
  ${half("right", `<div class="abs" style="left:300px;top:200px;font-size:560px;font-weight:300;color:transparent;-webkit-text-stroke:3px #D3DAE3;line-height:1">0</div>`, "#E6E9EE")}
  <div class="abs" style="left:950px;top:0;width:20px;height:1080px;background:var(--navy)"></div>
  <svg class="abs" style="left:900px;top:430px" width="120" height="170" viewBox="0 0 120 170"><path d="M30 78 V48 a30 30 0 0 1 60 0 V78" fill="none" stroke="#043B72" stroke-width="12" stroke-linecap="round"/><rect x="10" y="72" width="100" height="90" rx="18" fill="#043B72"/><circle cx="60" cy="108" r="11" fill="#F58220"/><rect x="55" y="112" width="10" height="26" rx="5" fill="#F58220"/></svg>
`);

F["c3-3"] = page(`
  ${half("left", `<div class="abs" style="left:120px;top:420px;font-size:72px;font-weight:600;color:var(--navy);line-height:1.2">We opened<br>the door.</div>`, "var(--paper)")}
  ${half("right", ``, "#ECEFF3")}
  <div class="abs" style="left:780px;top:0;width:360px;height:1080px;background:radial-gradient(ellipse at 50% 60%,#FFE4C8 0%,#FBA45C 35%,#F58220 70%,rgba(245,130,32,.0) 100%)"></div>
  <div class="abs" style="left:770px;top:0;width:12px;height:1080px;background:var(--navy);transform:translateX(-6px)"></div>
  <div class="abs" style="left:1138px;top:0;width:12px;height:1080px;background:var(--navy)"></div>
  <div class="abs" style="left:640px;top:0;width:640px;height:1080px;background:radial-gradient(ellipse at 50% 55%,rgba(245,130,32,.25),rgba(245,130,32,0) 65%)"></div>
`);

F["c3-4"] = page(`
  ${half("left", `
    <div class="abs lab" style="left:120px;top:120px;color:var(--mist)">You use</div>
    ${["scroll", "stream", "search", "ride", "pay"].map((k, i) => `<div class="abs" style="left:${140 + (i % 3) * 230}px;top:${300 + Math.floor(i / 3) * 230}px;width:170px;height:170px;border-radius:40px;background:#fff;display:flex;align-items:center;justify-content:center" class="shadow">${pict(k, 80, "#9AA7B8")}</div>`).join("")}
    <div class="abs" style="left:120px;top:900px;font-size:46px;font-weight:600;color:var(--mist)">Customer by habit.</div>`, "var(--paper)")}
  ${half("right", `
    <div class="abs lab" style="left:120px;top:120px;color:rgba(255,255,255,.6)">You own</div>
    ${["scroll", "stream", "search", "ride", "pay"].map((k, i) => `<div class="abs" style="left:${140 + (i % 3) * 230}px;top:${300 + Math.floor(i / 3) * 230}px;width:170px;height:170px;border-radius:40px;background:${i === 1 ? "var(--orange)" : "rgba(255,255,255,.1)"};display:flex;align-items:flex-end;justify-content:center;gap:12px;padding-bottom:40px">${[0.4, 0.65, 1].map((h) => `<div style="width:18px;height:${70 * h}px;border-radius:9px;background:#fff;opacity:${i === 1 ? 1 : 0.8}"></div>`).join("")}</div>`).join("")}
    <div class="abs" style="left:120px;top:890px;font-size:58px;font-weight:700;color:#fff">Shareholder by choice.</div>`, "var(--navy)")}
`);

/* ===== Concept 4 · One line ===== */
F["c4-1"] = page(`
  <svg class="abs" style="left:0;top:0" width="1920" height="1080" fill="none" stroke="var(--orange)" stroke-width="7" stroke-linecap="round" stroke-linejoin="round">
    <path d="M-20 700 C 120 700 200 640 250 560 L 250 380 Q 250 340 290 340 L 380 340 Q 420 340 420 380 L 420 620 Q 420 660 380 660 L 290 660 Q 250 660 250 620
      M 420 560 C 520 560 520 470 600 470 L 600 410 Q 600 380 630 380 L 820 380 Q 850 380 850 410 L 850 560 Q 850 590 820 590 L 630 590 Q 600 590 600 560 L 600 470
      M 690 430 L 760 485 L 690 540 Z
      M 850 520 C 940 520 960 470 1010 470 A 66 66 0 1 1 1010 471 M 1056 522 L 1110 576
      C 1170 636 1220 600 1250 560 L 1290 500 Q 1300 486 1320 486 L 1440 486 Q 1460 486 1470 500 L 1510 560 L 1510 600 L 1240 600 L 1240 560
      M 1510 580 C 1560 580 1580 520 1620 520 L 1780 520 Q 1800 520 1800 540 L 1800 640 Q 1800 660 1780 660 L 1620 660 Q 1600 660 1600 640 L 1600 540 M 1600 560 L 1800 560 M 1800 600 C 1860 600 1880 600 1940 600"/>
    <circle cx="1255" cy="602" r="16" fill="#F5F6F8"/><circle cx="1495" cy="602" r="16" fill="#F5F6F8"/>
  </svg>
  <div class="abs cap" style="left:160px;top:160px;font-size:62px">Your whole day runs on<br><b style="font-weight:700">American companies.</b></div>
  ${["Scroll", "Stream", "Search", "Ride", "Pay"].map((v, i) => `<div class="abs lab" style="left:${[250, 640, 960, 1290, 1620][i]}px;top:${i % 2 ? 640 : 720}px;font-size:20px;color:var(--mist)">${v}</div>`).join("")}
`);

const mapSvg = (extra) => `<svg class="abs" style="left:0;top:0" width="1920" height="1080"><g fill="#C9D2DE">${MAPDOTS}</g>${extra}</svg>`;
F["c4-2"] = page(`
  ${mapSvg(`
    <path d="M ${IN[0]} ${IN[1]} C ${IN[0] - 260} ${IN[1] - 420}, ${US[0] + 820} ${US[1] - 420}, ${US[0] + 560} ${US[1] + 120}" fill="none" stroke="var(--orange)" stroke-width="6" stroke-linecap="round"/>
    <path d="M ${US[0] + 560} ${US[1] + 120} q -10 60 -6 120" fill="none" stroke="var(--orange)" stroke-width="6" stroke-linecap="round" stroke-dasharray="2 16"/>
    <circle cx="${IN[0]}" cy="${IN[1]}" r="14" fill="var(--orange)"/><circle cx="${IN[0]}" cy="${IN[1]}" r="30" fill="none" stroke="var(--orange)" stroke-width="3" opacity=".4"/>
    <circle cx="${US[0]}" cy="${US[1]}" r="12" fill="var(--navy)"/>`)}
  <div class="abs lab" style="left:${IN[0] - 40}px;top:${IN[1] + 40}px;font-size:20px;color:var(--slate)">India</div>
  <div class="abs lab" style="left:${US[0] - 20}px;top:${US[1] + 36}px;font-size:20px;color:var(--slate)">US</div>
  <div class="abs cap" style="left:160px;top:820px;font-size:72px;font-weight:700">Too far.</div>
`);

F["c4-3"] = page(`
  ${mapSvg(`
    <path d="M ${IN[0]} ${IN[1]} C ${IN[0] - 300} ${IN[1] - 520}, ${US[0] + 300} ${US[1] - 520}, ${US[0]} ${US[1]}" fill="none" stroke="var(--orange)" stroke-width="6" stroke-linecap="round"/>
    <circle cx="${IN[0]}" cy="${IN[1]}" r="14" fill="var(--orange)"/>
    <circle cx="${US[0]}" cy="${US[1]}" r="14" fill="var(--navy)"/><circle cx="${US[0]}" cy="${US[1]}" r="34" fill="none" stroke="var(--navy)" stroke-width="3" opacity=".35"/>`)}
  <div class="abs" style="left:${US[0] - 80}px;top:${US[1] + 50}px;font-size:34px;font-weight:700;color:#fff;background:var(--navy);border-radius:50px;padding:14px 52px">Buy</div>
  <div class="abs cap" style="left:160px;top:820px;font-size:72px;font-weight:700">Buy from India.</div>
`);

F["c4-4"] = page(`
  <svg class="abs" style="left:0;top:0" width="1920" height="1080" fill="none">
    <path d="M 120 820 L 300 760 L 420 790 L 560 700 L 680 730 L 820 620 L 940 650 L 1080 520 L 1200 560 L 1340 430 L 1460 450 L 1600 330" stroke="var(--orange)" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="1600" cy="330" r="14" fill="var(--orange)"/><circle cx="1600" cy="330" r="36" fill="none" stroke="var(--orange)" stroke-width="3" opacity=".35"/>
    ${[120, 300, 420, 560, 680, 820, 940, 1080, 1200, 1340, 1460, 1600].map((x) => `<line x1="${x}" x2="${x}" y1="880" y2="892" stroke="#C9D2DE" stroke-width="3"/>`).join("")}
    <line x1="120" x2="1700" y1="880" y2="880" stroke="var(--line)" stroke-width="2"/>
  </svg>
  <div class="abs" style="left:160px;top:200px;font-size:46px;font-weight:600;color:var(--mist)">Customer by habit.</div>
  <div class="abs" style="left:160px;top:270px;font-size:84px;font-weight:800">Shareholder by choice.</div>
`);

/* ===== Concept 5 · Ticker board (dot matrix drawn on canvas) ===== */
const board = (spec) =>
  page(`<canvas id="c" width="1920" height="1080" class="abs" style="left:0;top:0"></canvas>${spec.html ?? ""}`, {
    bg: spec.bg ?? "var(--paper)",
    script: `<script>
(async () => {
  await document.fonts.load("800 100px 'Open Sans'");
  const COLS = 80, ROWS = 45, P = 24, S = 6;
  const off = document.createElement("canvas"); off.width = COLS * S; off.height = ROWS * S;
  const g = off.getContext("2d");
  const mask = (draw) => { g.clearRect(0,0,off.width,off.height); g.save(); g.scale(S,S); draw(g); g.restore();
    const d = g.getImageData(0,0,off.width,off.height).data; const m = new Uint8Array(COLS*ROWS);
    for (let r=0;r<ROWS;r++) for (let c=0;c<COLS;c++){ let a=0; for(let y=0;y<S;y++) for(let x=0;x<S;x++) a+=d[((r*S+y)*COLS*S+c*S+x)*4+3]; m[r*COLS+c]=a/(S*S*255)>.42?1:0;} return m; };
  const txt = (s, x, y, size, w=800) => (c) => { c.font = w + " " + size + "px 'Open Sans'"; c.textAlign="center"; c.textBaseline="middle"; c.fillStyle="#000"; c.fillText(s, x, y); };
  ${spec.js}
  const ctx = document.getElementById("c").getContext("2d");
  for (let r=0;r<ROWS;r++) for (let c=0;c<COLS;c++){
    const v = cell(c, r); const x = c*P+P/2, y = r*P+P/2;
    const s = v.s ?? (v.on ? 17 : 5); ctx.fillStyle = v.col;
    ctx.beginPath(); ctx.roundRect(x-s/2, y-s/2, s, s, Math.min(6, s/2)); ctx.fill();
  }
})();
</script>`,
  });

F["c5-1"] = board({
  js: `const word = mask(txt("SCROLL", 40, 18, 17, 700)); const bar = (c,r) => r===29 && c>=22 && c<=58;
  const cell = (c,r) => { const i=r*COLS+c; if (word[i]) return {on:1,col:"#043B72"}; if (bar(c,r)) return {on:1,col:"#F58220",s:13}; const d=Math.hypot(c-40,(r-19)*1.6); return {on:0,col: d<34 ? "#D9E0E8" : "#E7EBF0"}; };`,
  html: `<div class="abs shadow" style="left:460px;top:820px;width:1000px;padding:26px 0;background:#fff;border-radius:22px;text-align:center;font-size:40px;font-weight:600">Your whole day runs on American companies.</div>`,
});
F["c5-2"] = board({
  js: `const z = mask(txt("0", 40, 22, 40)); const cell = (c,r) => { const i=r*COLS+c; if (z[i]) return {on:1,col:"#043B72"}; return {on:0,col:"#E2E7ED"}; };`,
  html: `<div class="abs shadow" style="left:660px;top:880px;width:600px;padding:22px 0;background:#fff;border-radius:22px;text-align:center;font-size:40px;font-weight:600">How many do you own?</div>`,
});
F["c5-3"] = board({
  bg: "#043B72",
  js: `const cell = (c,r) => { const sweep = c < 52; if (sweep) return {on:1,col:"#043B72",s:25}; const k = (c-52)/28; return {on:0,col:"rgba(4,59,114,"+(0.25+0.75*(1-k))+")", s: 25 - k*18}; };`,
  html: `<div class="abs" style="left:150px;top:400px;font-size:180px;font-weight:800;color:#fff;letter-spacing:-.03em">Not <span style="color:var(--orange)">anymore.</span></div>`,
});
F["c5-4"] = board({
  js: `const n = mask(txt("5,000+", 40, 17, 19)); const tape = mask(txt("TECH · HEALTHCARE · ETFs · ENERGY", 52, 37.5, 8.5, 800));
  const cell = (c,r) => { const i=r*COLS+c; if (n[i]) return {on:1,col: c>=58 ? "#F58220" : "#043B72"}; if (r>=33 && r<=41) return tape[i] ? {on:1,col:"#8A97A8",s:13} : {on:0,col:"#E1E6EC"}; return {on:0,col:"#E7EBF0"}; };`,
  html: `<div class="abs shadow" style="left:720px;top:620px;width:480px;padding:20px 0;background:#fff;border-radius:22px;text-align:center;font-size:40px;font-weight:600">stocks and ETFs</div>`,
});

/* -------------------------------------------------- write + screenshot */
for (const [id, html] of Object.entries(F)) {
  const file = path.join(OUT, `${id}.html`);
  fs.writeFileSync(file, html);
  execFileSync(CHROME, [
    "--headless",
    "--no-sandbox",
    "--disable-gpu",
    "--hide-scrollbars",
    "--allow-file-access-from-files",
    "--virtual-time-budget=4000",
    "--window-size=1920,1080",
    `--screenshot=${path.join(PNG, `${id}.png`)}`,
    `file://${file}`,
  ], { stdio: "ignore" });
  process.stdout.write(id + " ");
}
console.log("\ndone");
