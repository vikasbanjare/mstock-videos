import React from "react";
import { Composition, continueRender, delayRender, staticFile } from "remotion";
import { setLogo } from "./field";
import { IndiaFilm } from "./earth/IndiaFilm";
import { TapFilm } from "./earth/TapFilm";
import { WindowFilm } from "./earth/WindowFilm";
import { WorldFilm } from "./earth/WorldFilm";
import { Film } from "./Film";
import { LightFilm } from "./LightFilm";
import { LightFilm2 } from "./LightFilm2";
import { FPS, H, W } from "./theme";

const weights = [300, 400, 600, 700, 800];
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
  <>
    <Composition id="OwnAWindow" component={WindowFilm} durationInFrames={30 * FPS} fps={FPS} width={W} height={H} />
    <Composition id="FourPercent" component={WorldFilm} durationInFrames={30 * FPS} fps={FPS} width={W} height={H} />
    <Composition id="OneTapAway" component={TapFilm} durationInFrames={30 * FPS} fps={FPS} width={W} height={H} />
    <Composition id="IndiaSwitchesOff" component={IndiaFilm} durationInFrames={30 * FPS} fps={FPS} width={W} height={H} />
    <Composition id="Light30v2" component={LightFilm2} durationInFrames={30 * FPS} fps={FPS} width={W} height={H} />
    <Composition id="Light30" component={LightFilm} durationInFrames={30 * FPS} fps={FPS} width={W} height={H} />
    <Composition id="USStocks30" component={Film} durationInFrames={30 * FPS} fps={FPS} width={W} height={H} />
  </>
);
