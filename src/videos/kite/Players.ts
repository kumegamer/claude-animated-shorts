import * as THREE from "three";
import { Actor, Pool, Fx } from "../../../templates/bridge/cast";
import { bodyFront, bodySide, fxContact, type Expr, type Outfit } from "../../../templates/bridge/toon";
import type { kiteStory } from "./story";

const child: Outfit = {
  jacket: "#0c9293", pants: "#3e4873", boots: "#f5dcca",
  hat: "cap", cap: "#ec8a30", skin: "#d89564", build: "kid",
};
const neighbor: Outfit = {
  jacket: "#a75274", pants: "#344e70", boots: "#734835",
  hat: "hair", hair: "#302235", skin: "#b77852", build: "stout", buttons: "#eac488",
};

const blink = (t: number, beats: number[]) => beats.some((at) => Math.abs(t - at) < .068);

export class Players {
  readonly root = new THREE.Group();
  private readonly pool = new Pool();
  private readonly actors = [new Actor(this.root), new Actor(this.root)];
  private readonly shadows = [new Fx(this.root), new Fx(this.root)];

  pose(beat: ReturnType<typeof kiteStory>, camera: THREE.PerspectiveCamera) {
    const { time, childX, neighborX } = beat;
    const childFace: Expr = time < 2.06 ? "smile" : time < 2.88 ? "shock" :
      time < 5.23 ? "nervous" : time < 6.68 ? "relief" : time < 8.1 ? "grin" : "laugh";
    const neighborFace: Expr = time < 4.22 ? "neutral" : time < 4.98 ? "shock" :
      time < 6.68 ? "smile" : "grin";
    const cast = [{
      x: childX, z: .18, size: 1.07, outfit: child, face: childFace, walking: time < 6.32,
      phase: (childX + 5.4) / 1.10, mirror: false, blink: blink(time, [1.1, 3.8, 6.0, 8.76]),
      wave: time >= 7.26 ? Math.sin((time - 7.26) * 4.6) * .65 : undefined,
    }, {
      x: neighborX, z: -.19, size: 1.04, outfit: neighbor, face: neighborFace, walking: time >= 3.72 && time < 4.72,
      phase: (2.5 - neighborX) / 1.11, mirror: true, blink: blink(time, [.9, 2.51, 5.92, 7.39, 9.3]),
      wave: time > 4.66 && time < 6.8 ? Math.sin((time - 4.66) * 2.2) * .65 : undefined,
    }];

    cast.forEach((role, i) => {
      const actor = this.actors[i];
      actor.mesh.visible = true;
      actor.mesh.castShadow = true;
      actor.mesh.position.set(role.x, 0, role.z);
      actor.mesh.rotation.y = Math.atan2(camera.position.x - role.x, camera.position.z - role.z);
      actor.mesh.scale.set(role.mirror ? -role.size : role.size, role.size, role.size);
      actor.r = this.pool.req(`cast-${i}-${Math.round(time * 30)}`, 420, 700, .7, (pen) => {
        const opts = { phase: role.phase, expr: role.face, blink: role.blink, seed: i === 0 ? 26 : 54 };
        if (role.walking) {
          bodySide(pen, role.outfit, { ...opts, stride: .69, stomp: .86 });
        } else {
          bodyFront(pen, role.outfit, { ...opts, mode: "stand", facing: 1, look: .65,
            tilt: 1.5 * Math.sin(time * 3.2), headTilt: role.wave === undefined ? 0 : -5,
            wave: role.wave });
        }
      });
      const shadow = this.shadows[i];
      shadow.mesh.visible = true;
      shadow.mesh.position.set(role.x, .008, role.z);
      shadow.mesh.rotation.x = -Math.PI / 2;
      shadow.mesh.scale.set(.69 * role.size, .53 * role.size, 1);
      shadow.r = this.pool.req("blob|kite-contact", 128, 128, 1, (pen) => fxContact(pen, "#8f746f"));
    });
    this.pool.flush();
    for (const actor of this.actors) actor.bind();
    for (const shadow of this.shadows) shadow.bind();
  }
}

export class Kite {
  readonly root = new THREE.Group();
  private readonly flyer = new THREE.Group();
  private readonly tail = new THREE.Group();
  private readonly string = new THREE.Line(
    new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(new Float32Array(33), 3)),
    new THREE.LineBasicMaterial({ color: "#5d3e54", transparent: true, opacity: .65 }),
  );

  constructor() {
    const panel = (points: [number, number][], color: string) => {
      const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
      const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
      mesh.position.z = this.flyer.children.length * .002;
      this.flyer.add(mesh);
    };
    panel([[0, .37], [-.26, .07], [0, -.35], [.26, .07]], "#492339");
    panel([[0, .335], [-.228, .065], [0, .065]], "#ffb34e");
    panel([[0, .335], [.228, .065], [0, .065]], "#f86d53");
    panel([[-.228, .065], [0, -.317], [0, .065]], "#ed654c");
    panel([[.228, .065], [0, -.317], [0, .065]], "#c73e61");

    for (let i = 0; i < 8; i++) {
      const material = new THREE.MeshBasicMaterial({ color: i % 2 ? "#ec6a53" : "#eaa949" });
      const ribbon = new THREE.Mesh(new THREE.BoxGeometry(.013, .10, .015), material);
      const bow = new THREE.Mesh(new THREE.BoxGeometry(.105, .031, .018), material);
      ribbon.add(bow);
      bow.rotation.z = .3 * (-1) ** i;
      this.tail.add(ribbon);
    }
    this.string.frustumCulled = false;
    this.root.add(this.flyer, this.tail, this.string);
  }

  pose(beat: ReturnType<typeof kiteStory>) {
    const { childX, kiteX, kiteY, time } = beat;
    const airborne = time > 2 && time < 4.98 || time > 7.32;
    this.flyer.position.set(kiteX, kiteY, .32 + .15 * Math.sin(time * 3.4));
    this.flyer.rotation.set(.10 * Math.sin(time * 3), .54 * Math.sin(time * 2.6), -.14 + .30 * Math.sin(time * 3.6));
    this.tail.position.copy(this.flyer.position);
    this.tail.children.forEach((ribbon, i) => {
      const lag = (i + 1) / 8;
      ribbon.position.set(.42 * lag * Math.sin(time * 6.2 - lag * 4) - .33 * lag,
        -.29 - lag * (airborne ? .48 : .63), -.09 * lag);
      ribbon.rotation.z = -.27 + .74 * Math.cos(time * 6.2 - lag * 4);
    });
    this.string.visible = time < 2 || time >= 7.32;
    if (this.string.visible) {
      const points = this.string.geometry.getAttribute("position");
      for (let i = 0; i < points.count; i++) {
        const p = i / (points.count - 1);
        points.setXYZ(i, THREE.MathUtils.lerp(childX + .24, kiteX, p),
          THREE.MathUtils.lerp(time < 2 ? .96 : 1.32, kiteY - .12, p) - .19 * Math.sin(p * Math.PI),
          THREE.MathUtils.lerp(.31, this.flyer.position.z + .01, p));
      }
      points.needsUpdate = true;
    }
  }
}
