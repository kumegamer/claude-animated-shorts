import { useThree } from "@react-three/fiber";
import { EffectComposer } from "@react-three/postprocessing";
import { ToneMappingEffect, ToneMappingMode } from "postprocessing";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useRemotionEnvironment, useVideoConfig } from "remotion";
import * as THREE from "three";
import { ReadyThreeCanvas } from "../../ReadyThreeCanvas";
import { GradeEffect, GRADES } from "../../../templates/bridge/grade";
import { InkPass } from "../../../templates/bridge/ink";
import { LensBlur } from "../../../templates/bridge/lensblur";
import { kiteStory } from "./story";
import { makeStreet, streetPalettes } from "./Street";
import { Kite, Players } from "./Players";
import { ContinuityCharacters } from "./continuity/Characters";
import { KiteRig } from "./continuity/KiteRig";
import { cameraAt, FPS, windAt } from "./continuity/story";

const PrimeComposer = ({ onReady }: { onReady: () => void }) => {
  const { isRendering } = useRemotionEnvironment();
  const advance = useThree((state) => state.advance);
  useEffect(() => {
    if (!isRendering) return;
    onReady();
    advance(performance.now());
  }, [advance, isRendering, onReady]);
  return null;
};

type Edition = "preview" | "continuity";

const Scene = ({ onReady, edition }: { onReady: () => void; edition: Edition }) => {
  const frame = useCurrentFrame();
  const { camera, scene } = useThree();
  const cam = camera as THREE.PerspectiveCamera;
  const street = useMemo(makeStreet, []);
  const cast = useMemo(() => edition === "continuity"
    ? { edition, players: new ContinuityCharacters(), kite: new KiteRig() } as const
    : { edition, players: new Players(), kite: new Kite() } as const, [edition]);
  const post = useMemo(() => ({
    ink: new InkPass(scene, cam, { color: "#271c29", widthNear: 4.4, widthFar: 2.5, strength: .9 }),
    lens: new LensBlur({ maxCoC: 18 }),
    tone: new ToneMappingEffect({ mode: ToneMappingMode.NEUTRAL }),
    grade: new GradeEffect(GRADES.day, .72),
  }), [cam, scene]);
  const sun = useMemo(() => {
    const light = new THREE.DirectionalLight("#fff0d4", 2.4);
    light.position.set(-8, 15, 9);
    light.target.position.set(0, 0, -3);
    light.castShadow = true;
    light.shadow.mapSize.set(1024, 1024);
    Object.assign(light.shadow.camera, { left: -17, right: 17, top: 13, bottom: -15, near: 1, far: 45 });
    light.shadow.bias = -.00028;
    light.shadow.normalBias = .025;
    return light;
  }, []);
  scene.background = street.sky;
  scene.fog = street.fog;
  streetPalettes();
  let time: number;
  let focus: THREE.Vector3;
  let wind = 1;
  if (cast.edition === "continuity") {
    time = frame / FPS;
    const shot = cameraAt(time);
    cam.position.set(...shot.pos);
    cam.lookAt(...shot.aim);
    cam.rotateZ(shot.roll);
    cam.updateMatrixWorld();
    const hand = cast.players.pose(frame, time, cam);
    cast.kite.pose(frame, time, hand, cam);
    focus = new THREE.Vector3(...shot.focus);
    post.lens.cInf = shot.dof;
    wind = 1 + windAt(time) * .52;
  } else {
    const beat = kiteStory(frame);
    time = beat.time;
    cam.position.set(...beat.camera);
    cam.lookAt(...beat.aim);
    cam.rotateZ(beat.roll);
    cam.updateMatrixWorld();
    cast.players.pose(beat, cam);
    cast.kite.pose(beat);
    focus = new THREE.Vector3(...beat.aim);
    post.lens.cInf = 16;
  }
  street.flags.forEach((flag, i) => {
    flag.rotation.x = .32 * wind * Math.sin(time * 6.1 + i * .61);
    flag.rotation.z = .10 * wind * Math.sin(time * 4.4 + i);
  });
  post.lens.focus = focus.sub(cam.position).dot(cam.getWorldDirection(new THREE.Vector3()));

  return (
    <>
      <primitive object={street.root} dispose={null} />
      <primitive object={cast.players.root} dispose={null} />
      <primitive object={cast.kite.root} dispose={null} />
      <primitive object={sun} />
      <primitive object={sun.target} />
      <EffectComposer multisampling={0}>
        <primitive object={post.ink} dispose={null} />
        <primitive object={post.lens.pre} dispose={null} />
        <primitive object={post.lens.main} dispose={null} />
        <primitive object={post.tone} dispose={null} />
        <primitive object={post.grade} dispose={null} />
        <PrimeComposer onReady={onReady} />
      </EffectComposer>
    </>
  );
};

export const KiteShort = ({ edition = "preview" }: { edition?: Edition }) => {
  const { width, height } = useVideoConfig();
  const composerReady = useRef(false);
  const onReady = useCallback(() => { composerReady.current = true; }, []);
  return (
    <AbsoluteFill style={{ background: "#92bde8" }}>
      <ReadyThreeCanvas
        width={width}
        height={height}
        dpr={1}
        shadows="basic"
        gl={{ antialias: false }}
        camera={{ fov: 37, near: .15, far: 70 }}
        isSceneReady={() => composerReady.current}
      >
        <Scene onReady={onReady} edition={edition} />
      </ReadyThreeCanvas>
    </AbsoluteFill>
  );
};
