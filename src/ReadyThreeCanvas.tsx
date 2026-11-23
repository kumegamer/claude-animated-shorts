import { useFrame } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import { useLayoutEffect, useRef, type ComponentProps } from "react";
import { useDelayRender, useRemotionEnvironment } from "remotion";

const FirstDraw = ({ onDraw }: { onDraw: () => void }) => {
  useFrame(() => {
    // Run after this tick's draw, including any subsequent composer callbacks.
    queueMicrotask(onDraw);
  });
  return null;
};

export const ReadyThreeCanvas = ({
  children,
  isSceneReady,
  ...props
}: ComponentProps<typeof ThreeCanvas> & { isSceneReady?: () => boolean }) => {
  const { isRendering } = useRemotionEnvironment();
  const { delayRender, continueRender } = useDelayRender();
  const pending = useRef<number | null>(null);

  useLayoutEffect(() => {
    if (!isRendering) return;
    const handle = delayRender("Waiting for the first WebGL draw");
    pending.current = handle;
    return () => {
      if (pending.current !== handle) return;
      pending.current = null;
      continueRender(handle);
    };
  }, [isRendering, delayRender, continueRender]);

  const onDraw = () => {
    const handle = pending.current;
    if (handle === null || isSceneReady?.() === false) return;
    pending.current = null;
    continueRender(handle);
  };

  return (
    <ThreeCanvas {...props}>
      {children}
      {isRendering && <FirstDraw onDraw={onDraw} />}
    </ThreeCanvas>
  );
};
