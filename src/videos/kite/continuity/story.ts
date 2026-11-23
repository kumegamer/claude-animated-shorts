import * as THREE from "three";

export const FPS = 30;
export const FRAMES = 450;
export const SHOTS = [
  { a: 0, b: 84, name: "Establishing" },
  { a: 84, b: 231, name: "Tracking and catch" },
  { a: 231, b: 324, name: "Handoff close-up" },
  { a: 324, b: 450, name: "Final two-shot" },
] as const;

export type Point = readonly [number, number, number];
export const clamp = THREE.MathUtils.clamp;
export const lerp = THREE.MathUtils.lerp;
export const ease = (x: number) => {
  const u = clamp(x, 0, 1);
  return u * u * (3 - 2 * u);
};
export const ramp = (t: number, a: number, b: number) => ease((t - a) / (b - a));

type Key = readonly [number, number, number];
// Position and velocity at each key. Both are continuous across the keys.
function motion(t: number, keys: readonly Key[]) {
  const end = keys.findIndex(([at]) => at > t);
  if (end < 0) return keys[keys.length - 1][1];
  if (end === 0) return keys[0][1];
  const [t0, x0, v0] = keys[end - 1];
  const [t1, x1, v1] = keys[end];
  const span = t1 - t0;
  const s = (t - t0) / span;
  const s2 = s * s;
  const s3 = s2 * s;
  return (2 * s3 - 3 * s2 + 1) * x0 + (s3 - 2 * s2 + s) * span * v0
    + (-2 * s3 + 3 * s2) * x1 + (s3 - s2) * span * v1;
}

const childPath: readonly Key[] = [
  [0, -5.65, .66], [2.73, -3.89, .64], [3.55, -3.36, .58],
  [4.40, -2.48, 1.55], [6.04, -.05, 1.23], [7.25, .66, 0], [15, .66, 0],
];
const neighborPath: readonly Key[] = [
  [0, 2.65, 0], [5.15, 2.65, 0], [6.10, 2.14, -.62], [7.05, 1.77, 0], [15, 1.77, 0],
];

export const RELEASE = 3.58;
export const CATCH = 6.87;
export const HANDOFF = 9.22;

export function actorsAt(t: number) {
  return { childX: motion(t, childPath), neighborX: motion(t, neighborPath) };
}

export function windAt(t: number) {
  const gust = Math.exp(-(((t - 3.32) / .48) ** 2));
  const second = Math.exp(-(((t - 11.47) / .78) ** 2));
  return .25 + 1.35 * gust + .61 * second + .18 * Math.sin(t * 2.9);
}

export function handsAt(t: number) {
  const { childX, neighborX } = actorsAt(t);
  const brace = ramp(t, 2.7, 3.32) * (1 - ramp(t, RELEASE, 3.85));
  const childReach = ramp(t, 8.53, HANDOFF);
  const releaseLift = ramp(t, 10.66, 11.56) * (1 - ramp(t, 12.15, 13.25));
  const catchReach = ramp(t, 6.3, CATCH) * (1 - ramp(t, CATCH + .10, 7.55));
  const offer = ramp(t, 8.0, HANDOFF);
  const giveBack = 1 - ramp(t, HANDOFF + .06, 9.75);
  const child: Point = [
    childX + lerp(.32 + .095 * brace, .52, childReach) - .10 * ramp(t, HANDOFF, 10.1),
    lerp(.90 + .23 * brace + .023 * Math.sin(t * 9), 1.14, childReach) + .29 * releaseLift,
    .30,
  ];
  const neighbor: Point = [
    neighborX - lerp(.24 + .26 * catchReach, .59, offer * giveBack),
    lerp(1.02 + .50 * catchReach, 1.14, offer * giveBack),
    .30,
  ];
  return { child, neighbor };
}

export function spoolAt(t: number): Point {
  const hands = handsAt(t);
  if (t <= RELEASE || t >= HANDOFF) return hands.child;
  if (t >= CATCH) return hands.neighbor;

  const u = (t - RELEASE) / (CATCH - RELEASE);
  const from = handsAt(RELEASE).child;
  const to = handsAt(CATCH).neighbor;
  return [
    lerp(from[0], to[0], ease(u)),
    lerp(from[1], to[1], ease(u)) + 1.05 * Math.sin(u * Math.PI) + .13 * Math.sin(4 * Math.PI * u) * Math.sin(u * Math.PI),
    .30 + .29 * Math.sin(u * Math.PI),
  ];
}

export function cameraAt(t: number) {
  const { childX, neighborX } = actorsAt(t);
  if (t < SHOTS[1].a / FPS) {
    const u = ramp(t, 0, 2.8);
    return {
      pos: [childX + 2.35 - .75 * u, 4.25 - .78 * u, 10.55 - 1.6 * u] as Point,
      aim: [childX + 1.05, 1.85, -.15] as Point,
      focus: [childX, 1.23, .12] as Point, roll: -.026, dof: 9,
    };
  }
  if (t < SHOTS[2].a / FPS) {
    const two = ramp(t, 5.43, 6.72);
    const chase = ramp(t, 3.72, 4.1) * (1 - ramp(t, 6.45, 7.0));
    const center = lerp(childX + .69, (childX + neighborX) / 2 + .17, two);
    const bump = Math.sin((t - 2.8) * 4.6) * Math.exp(-2.5 * Math.abs(t - 3.37));
    return {
      pos: [center + .73 - .55 * two, 2.40 + .29 * two, 6.65 + .76 * chase + 1.15 * two] as Point,
      aim: [center, 1.63 + .30 * chase + .22 * two, .12] as Point,
      focus: [lerp(childX, 1.24, two), 1.37, .20] as Point,
      roll: -.025 + .025 * two + .018 * bump, dof: 16,
    };
  }
  if (t < SHOTS[3].a / FPS) {
    const u = ramp(t, 7.7, 10.8);
    return {
      pos: [1.40 - .20 * u, 1.92 + .11 * u, 4.97 - .22 * u] as Point,
      aim: [1.23, 1.40 + .15 * u, .13] as Point,
      focus: [1.20, lerp(1.18, 1.64, u), .24] as Point, roll: -.022 + .021 * u, dof: 24,
    };
  }
  const u = ramp(t, 10.8, 15);
  return {
    pos: [.90 - .24 * u, 2.60 + .33 * u, 7.13 + .54 * u] as Point,
    aim: [1.31 + .41 * u, 1.54 + .68 * u, .12] as Point,
    focus: [1.25, 1.56, .19] as Point, roll: -.018 + .024 * u, dof: 16,
  };
}
