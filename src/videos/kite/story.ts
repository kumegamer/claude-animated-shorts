import { Easing, interpolate } from "remotion";

export const KITE_FPS = 30;
export const KITE_FRAMES = 300;

const track = (time: number, times: number[], values: number[]) =>
  interpolate(time, times, values, {
    easing: Easing.inOut(Easing.sin),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

export function kiteStory(frame: number) {
  const time = frame / KITE_FPS;
  const childX = interpolate(time, [0, 2, 5.5, 6.5], [-5.4, -3.8, -.1, .52], {
    extrapolateRight: "clamp",
  });
  const neighborX = track(time, [0, 3.7, 5.0, 10], [2.5, 2.5, 1.62, 1.62]);
  const kiteTimes = [0, 2, 2.65, 3.75, 4.98, 5.55, 6.6, 7.32, 8.5, 10];
  const kiteX = track(time, kiteTimes, [-4.85, -3.25, -2.42, -.87, 1.73, 1.66, .70, .82, 1.43, 2.12]);
  const kiteY = track(time, kiteTimes, [2.02, 2.25, 2.98, 2.74, 1.69, 1.68, 1.37, 1.49, 2.75, 3.32]);
  const groupX = track(time, [0, 3.25, 4.85, 6.65, 10], [0, 0, .52, .46, .64]);
  const aimX = childX * (1 - groupX) + neighborX * groupX + track(time, [0, 3.45, 5, 10], [.44, .4, .07, .13]);
  const aimY = track(time, [0, 2.8, 5.1, 7.2, 9.5, 10], [1.55, 1.77, 1.45, 1.43, 1.92, 1.98]);

  return {
    time, childX, neighborX, kiteX, kiteY,
    roll: track(time, [0, 2, 3.5, 5.1, 7.5, 10], [-.035, .012, -.046, .016, -.016, .021]),
    camera: [
      aimX + track(time, [0, 5, 10], [1.18, .42, -.73]),
      track(time, [0, 5.8, 10], [2.50, 1.94, 2.27]),
      track(time, [0, 2.7, 4.7, 6.9, 10], [6.35, 6.1, 8.18, 5.8, 6.73]),
    ] as const,
    aim: [aimX, aimY, -.13] as const,
  };
}
