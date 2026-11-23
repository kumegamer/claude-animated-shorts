import { Composition, registerRoot } from "remotion";
import { PocketEclipse } from "./videos/PocketEclipse";
import { BridgeShort, BRIDGE_FRAMES } from "./videos/bridge/Bridge";

import { KiteShort } from "./videos/kite/KiteShort";
import { KITE_FPS, KITE_FRAMES } from "./videos/kite/story";

import { FPS as CONTINUITY_FPS, FRAMES as CONTINUITY_FRAMES } from "./videos/kite/continuity/story";

const Root = () => (
  <>
    <Composition
      id="BridgeShort"
      component={BridgeShort}
      durationInFrames={BRIDGE_FRAMES}
      fps={30}
      width={1080}
      height={1920}
    />
    <Composition
      id="PocketEclipse"
      component={PocketEclipse}
      durationInFrames={150}
      fps={30}
      width={540}
      height={960}
    />
    <Composition
      id="LayangLayangPulang"
      component={KiteShort}
      durationInFrames={KITE_FRAMES}
      fps={KITE_FPS}
      width={540}
      height={960}
    />
    <Composition
      id="LayangLayangPulang15"
      component={KiteShort}
      defaultProps={{ edition: "continuity" as const }}
      durationInFrames={CONTINUITY_FRAMES}
      fps={CONTINUITY_FPS}
      width={540}
      height={960}
    />
  </>
);

registerRoot(Root);
