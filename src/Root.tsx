import React from "react";
import { Composition, continueRender, delayRender, staticFile } from "remotion";
import { setLogo } from "./field";
import { Film } from "./Film";
import { FPS, H, W } from "./theme";

const weights = [400, 600, 700, 800];
const handle = delayRender("Loading Open Sans");
Promise.all(
  weights.map((w) => {
    const face = new FontFace("Open Sans", `url(${staticFile(`fonts/open-sans-latin-${w}-normal.woff2`)}) format('woff2')`, { weight: String(w) });
    document.fonts.add(face);
    return face.load();
  }),
).then(
  () =>
    new Promise<void>((res) => {
      const img = new Image();
      img.onload = () => {
        setLogo(img);
        res();
      };
      img.onerror = () => res();
      img.src = staticFile("brand/mstock-logo-color.svg");
    }),
).then(() => continueRender(handle));

export const Root: React.FC = () => (
  <Composition id="USStocks30" component={Film} durationInFrames={30 * FPS} fps={FPS} width={W} height={H} />
);
