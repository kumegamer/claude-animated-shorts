import * as THREE from "three";
import { Actor, Fx, Pool, SU } from "../../../../templates/bridge/cast";
import {
  INK, bodyFront, fxContact, headBlob, mix, type Expr, type Outfit, type Pen,
} from "../../../../templates/bridge/toon";
import { actorsAt, CATCH, clamp, HANDOFF, handsAt, lerp, ramp, RELEASE, type Point } from "./story";

type XY = [number, number];

const child: Outfit = {
  jacket: "#0c9293", pants: "#3e4873", boots: "#f5dcca",
  hat: "cap", cap: "#ec8a30", skin: "#d89564", build: "kid",
};
const neighbor: Outfit = {
  jacket: "#a75274", pants: "#344e70", boots: "#734835",
  hat: "hair", hair: "#302235", skin: "#b77852", build: "stout", buttons: "#eac488",
};

export function feetAt(distance: number, stride: number, run: boolean, settling: number) {
  return [0, .5].map((offset) => {
    const phase = distance / stride + offset;
    const cycle = Math.floor(phase);
    const progress = phase - cycle;
    const anchor = (cycle - offset + .34) * stride;
    // Use a duty cycle tied to the contact's index, so a gait change never moves an existing plant.
    const duty = run && cycle - offset >= 2.5 && cycle - offset <= 5.5 ? .45 : .65;
    const swing = clamp((progress - duty) / (1 - duty), 0, 1);
    const offsetX = anchor + stride * ramp(swing, 0, 1) - distance;
    const lift = Math.sin(swing * Math.PI) ** .92 * (duty < .5 ? .19 : .088);
    return { offsetX, lift: lift * (1 - settling), roll: swing > 0 ? Math.sin(swing * 2 * Math.PI) * -.44 : 0 };
  });
}

const blink = (time: number, beats: number[]) =>
  Math.max(...beats.map((at) => Math.max(0, 1 - Math.abs(time - at) / .09)));

function strokeLimb(pen: Pen, a: XY, b: XY, bend: number, color: string, width: number) {
  const k: XY = [lerp(a[0], b[0], .51) + bend, lerp(a[1], b[1], .47)];
  pen.stroke([a, k, b], width, color);
}

type Role = {
  x: number; z: number; size: number; direction: number; distance: number; stride: number;
  outfit: Outfit; seed: number; face: Expr; blink: number; hip: number; lean: number;
  look: number; running: boolean; settling: number; closing: number; hand: Point | null; idle: number;
};

function drawActor(pen: Pen, role: Role, hands: XY | null, yawCos: number, time: number) {
  const { outfit, seed, face, direction } = role;
  const feet = feetAt(role.distance, role.stride, role.running, role.settling);
  const stance = role.distance / role.stride;
  const step = Math.sin(stance * Math.PI * 2) * (1 - role.settling);
  const hip: XY = [300, role.hip];
  const shoulder: XY = [300 + role.lean, role.hip - (seed === 26 ? 149 : 177)];
  const waist = seed === 26 ? 65 : 91;
  const tone = mix(outfit.jacket, INK, .48);

  feet.forEach(({ offsetX, lift, roll }, i) => {
    const finalSpace = i === 0 ? .135 : -.10;
    const closing = i === 0 ? role.closing : 0;
    const stepX = lerp(offsetX, finalSpace, closing) / (role.size * SU * yawCos);
    const closeLift = .062 * Math.sin(Math.PI * closing);
    const ankle: XY = [300 + stepX, 965 - (lift + closeLift) / (role.size * SU)];
    const upper: XY = [hip[0] + (i ? 11 : -9), hip[1] - (i ? 0 : 4)];
    strokeLimb(pen, upper, ankle, seed === 26 ? 29 : 20, mix(outfit.pants, INK, i ? .47 : .65), 14);
    const angle = roll * (1 - role.settling);
    const toe: XY = [ankle[0] + 32 * Math.cos(angle), ankle[1] + 32 * Math.sin(angle)];
    pen.stroke([ankle, toe], 19, INK);
    pen.stroke([ankle, toe], 11, i ? outfit.boots : mix(outfit.boots, INK, .24));
  });

  const farHand: XY = [shoulder[0] - 48 - step * (role.running ? 66 : 40), shoulder[1] + 144 - 24 * Math.abs(step)];
  strokeLimb(pen, [shoulder[0] - 29, shoulder[1] + 32], farHand, -21, mix(tone, INK, .24), 12);
  pen.dot(...farHand, 12);

  const torso: XY[] = [
    [shoulder[0] - waist * .70, shoulder[1] + 5],
    [shoulder[0] + waist * .64, shoulder[1] + 4],
    [hip[0] + waist * .83, hip[1] - 25],
    [hip[0] + waist * .53, hip[1] + 10],
    [hip[0] - waist * .48, hip[1] + 9],
    [hip[0] - waist * .83, hip[1] - 29],
  ];
  // Use the template's rounded, inked contour and painted crescent on the jacket.
  const contour: XY[] = [];
  torso.forEach((corner, i) => {
    const prev = torso[(i + torso.length - 1) % torso.length];
    const next = torso[(i + 1) % torso.length];
    contour.push([lerp(corner[0], prev[0], .19), lerp(corner[1], prev[1], .19)], corner,
      [lerp(corner[0], next[0], .19), lerp(corner[1], next[1], .19)]);
  });
  pen.gradFill(contour, outfit.jacket, mix(outfit.jacket, INK, .29), -2.0);
  pen.inkRing(contour, 10, .7);
  for (let i = 1; i <= 3; i++) {
    pen.dot(lerp(shoulder[0], hip[0], i / 4) + 14, lerp(shoulder[1], hip[1], i / 4), 5.8, outfit.buttons ?? tone);
  }

  const near: XY = hands ?? [
    shoulder[0] + 53 + step * (role.running ? 76 : 43),
    shoulder[1] + 129 - (role.running ? 64 : 36) * Math.abs(step) - role.idle,
  ];
  strokeLimb(pen, [shoulder[0] + 27, shoulder[1] + 22], near, hands ? -23 : 22 * Math.sign(step || 1), tone, 14);
  pen.dot(...near, hands ? 15 : 13, INK);
  if (hands) pen.dot(...near, 8, outfit.skin);

  // Use the upstream face, hair or hat, and lid library. Clip the stationary reference drawing at its chin.
  const hh = headBlob(seed, seed === 26 ? 112 : 118, 1).b * 2;
  const referenceChin = 975 - (seed === 26 ? 1.85 : 2.47) * hh;
  const ctx = pen.g;
  ctx.save();
  ctx.translate(shoulder[0] - 300, shoulder[1] - referenceChin + 12);
  ctx.beginPath();
  ctx.rect(0, 0, 600, referenceChin + 4);
  ctx.clip();
  bodyFront(pen, outfit, {
    seed, mode: "stand", expr: face, facing: 1, blink: role.blink,
    headTilt: role.look * direction + 1.4 * Math.sin(time * 4.2), look: clamp(1 - role.look * .08, -.5, 1),
  });
  ctx.restore();
}

export class ContinuityCharacters {
  readonly root = new THREE.Group();
  private readonly pool = new Pool();
  private readonly actors = [new Actor(this.root), new Actor(this.root)];
  private readonly shadows = [new Fx(this.root), new Fx(this.root)];

  pose(frame: number, t: number, camera: THREE.PerspectiveCamera) {
    const { childX, neighborX } = actorsAt(t);
    const { child: childHand, neighbor: neighborHand } = handsAt(t);
    const run = ramp(t, 3.53, 4.42) * (1 - ramp(t, 6.18, 7.26));
    const brace = ramp(t, 2.76, 3.42) * (1 - ramp(t, RELEASE, 3.96));
    const relief = ramp(t, 6.67, 7.65) * (1 - ramp(t, 8.1, 8.85));
    const worry = ramp(t, 3.53, 3.78) * (1 - ramp(t, 6.57, 7.0));
    const dist = childX + 5.65;
    const miraDist = 2.65 - neighborX;
    const holdChild = t < RELEASE || t > 8.48;
    const holdNeighbor = t >= 6.30 && t < 9.53;
    const childFace: Expr = t < 2.82 ? "smile" : t < 3.66 ? "shock" : t < 6.87 ? "nervous"
      : t < 7.67 ? "relief" : t < 9.34 ? "smile" : t < 12.1 ? "grin" : t % 1.2 < .47 ? "laugh" : "smile";
    const miraFace: Expr = t < 5.28 ? "neutral" : t < 6.89 ? "shock" : t < 8.54 ? "relief"
      : t < 9.58 ? "smile" : t < 12.0 ? "grin" : "smile_closed";
    const roles: Role[] = [{
      x: childX, z: .17, size: 1.07, direction: 1, distance: dist, stride: 1.07,
      outfit: child, seed: 26, face: childFace, blink: blink(t, [1.02, 2.61, 4.58, 6.18, 7.45, 8.76, 10.28, 12.62, 14.31]),
      hip: 754 + 22 * brace - 11 * relief + (10 + 13 * run) * Math.cos(dist / 1.07 * 4 * Math.PI) * (1 - ramp(t, 6.88, 7.24)),
      lean: -34 * brace + 47 * run + 8 + 10 * relief,
      look: -6 * brace - 9 * worry + 8 * ramp(t, 7.7, 8.5) - 21 * ramp(t, 10.73, 12.0),
      running: true, settling: ramp(t, 6.87, 7.24), closing: ramp(t, 7.19, 7.59), hand: holdChild ? childHand : null,
      idle: 41 * worry,
    }, {
      x: neighborX, z: .01, size: 1.04, direction: -1, distance: miraDist, stride: .72,
      outfit: neighbor, seed: 54, face: miraFace, blink: blink(t, [5.01, 7.25, 8.26, 9.11, 10.65, 12.1, 14.12]),
      hip: 688 + 13 * Math.cos(miraDist / .72 * 4 * Math.PI) * ramp(t, 5.15, 5.5) * (1 - ramp(t, 6.72, 7.05)),
      lean: 15 * ramp(t, 5.34, 6.30) - 33 * ramp(t, 6.61, 6.91) + 18 * ramp(t, 7.0, 7.51),
      look: -7 * ramp(t, 5.41, 6.35) + 20 * ramp(t, 8, 8.51) - 22 * ramp(t, 11.0, 12.35),
      running: false, settling: t < 5.15 ? 1 : ramp(t, 6.75, 7.05), closing: ramp(t, 7.02, 7.38),
      hand: holdNeighbor ? neighborHand : null, idle: 8 + 7 * Math.sin(t * 4),
    }];

    const anchored = roles.map((role, i) => {
      const actor = this.actors[i];
      const yaw = clamp(Math.atan2(camera.position.x - role.x, camera.position.z - role.z), -.27, .27);
      actor.mesh.visible = true;
      actor.mesh.castShadow = true;
      actor.mesh.position.set(role.x, .008, role.z);
      actor.mesh.rotation.y = yaw;
      actor.mesh.scale.set(role.direction * role.size, role.size, role.size);
      actor.mesh.updateMatrixWorld();
      const cos = Math.cos(yaw);
      const grip = role.hand && new THREE.Vector3(
        (role.hand[0] - role.x) / (cos * role.direction * role.size),
        (role.hand[1] - .008) / role.size, 0,
      );
      const hand: XY | null = grip && [300 + grip.x / SU, 975 - grip.y / SU];
      actor.r = this.pool.req(`continuity-${i}-${frame}`, 480, 800, .8,
        (pen) => drawActor(pen, role, hand, cos, t));

      const shadow = this.shadows[i];
      shadow.mesh.visible = true;
      shadow.mesh.position.set(role.x, .009, role.z);
      shadow.mesh.rotation.x = -Math.PI / 2;
      shadow.mesh.scale.set(i ? .69 : .65, .55, 1);
      shadow.r = this.pool.req("blob|continuity", 128, 128, 1, (pen) => fxContact(pen, "#927c81"));
      return grip && actor.mesh.localToWorld(grip);
    });
    this.pool.flush();
    this.actors.forEach((actor) => actor.bind());
    this.shadows.forEach((shadow) => shadow.bind());
    const receiving = anchored[0];
    const giving = anchored[1];
    if (t > HANDOFF - .05 && t < HANDOFF + .05 && receiving && giving) {
      return giving.clone().lerp(receiving, ramp(t, HANDOFF - .05, HANDOFF + .05));
    }
    return t <= RELEASE || t >= HANDOFF ? receiving : t >= CATCH ? giving : null;
  }
}
