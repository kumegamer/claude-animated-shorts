import * as THREE from "three";
import { NOINK } from "../../../../templates/bridge/ink";
import { CATCH, clamp, FPS, FRAMES, lerp, ramp, RELEASE, spoolAt, windAt } from "./story";

const STEPS = 4;
const DT = 1 / (FPS * STEPS);
const SEGMENTS = 32;

const lineLength = (t: number) =>
  1.66 + .52 * ramp(t, 2.62, 3.32) + .41 * ramp(t, 10.84, 12.68);

function solveFlight() {
  const position = new THREE.Vector3(-4.84, 2.43, .11);
  const velocity = new THREE.Vector3(.65, 0, 0);
  const delta = new THREE.Vector3();
  const anchor = new THREE.Vector3();
  const target = new THREE.Vector3();
  const poses: { position: THREE.Vector3; velocity: THREE.Vector3; tension: number }[] = [];
  for (let i = 0; i < FRAMES * STEPS; i++) {
    const t = i * DT;
    anchor.set(...spoolAt(t));
    const wind = windAt(t);
    const floatAway = ramp(t, RELEASE, RELEASE + .62) * (1 - ramp(t, CATCH - .54, CATCH + .29));
    const low = ramp(t, CATCH - .31, CATCH + .85) * (1 - ramp(t, 10.64, 11.75));
    const high = ramp(t, 10.80, 12.70);
    target.set(
      anchor.x + .48 + .63 * wind + .56 * floatAway + 1.13 * low + 1.02 * high,
      anchor.y + 1.44 + .54 * wind - .13 * floatAway - 1.08 * low + .40 * high + .085 * Math.sin(5.2 * t),
      .16 + .14 * sine(t * 3.1) - .18 * floatAway,
    );
    velocity.addScaledVector(delta.copy(target).sub(position), 13.0 * DT);
    velocity.y -= .29 * DT;
    velocity.multiplyScalar(Math.exp(-4.4 * DT));
    position.addScaledVector(velocity, DT);
    delta.copy(position).sub(anchor);
    const radius = lineLength(t);
    const distance = delta.length();
    if (distance > radius) {
      delta.multiplyScalar(1 / distance);
      position.copy(anchor).addScaledVector(delta, radius);
      velocity.addScaledVector(delta, -Math.max(0, velocity.dot(delta)));
    }
    if (i % STEPS === 0) {
      poses.push({
        position: position.clone(), velocity: velocity.clone(),
        tension: clamp((distance / radius - .62) / .38, 0, 1),
      });
    }
  }
  return poses;
}

const sine = Math.sin;
const makeMaterial = (color: string) => new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide });

export class KiteRig {
  readonly root = new THREE.Group();
  private readonly sail = new THREE.Group();
  private readonly tail = new THREE.Group();
  private readonly reel = new THREE.Group();
  private readonly vertices = new THREE.BufferAttribute(new Float32Array((SEGMENTS + 1) * 6), 3)
    .setUsage(THREE.DynamicDrawUsage);
  private readonly line = new THREE.Mesh(new THREE.BufferGeometry(), makeMaterial("#684254"));
  private readonly flight = solveFlight();

  constructor() {
    const panel = (points: [number, number][], color: string) => {
      const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
      const piece = new THREE.Mesh(new THREE.ShapeGeometry(shape), makeMaterial(color));
      piece.position.z = this.sail.children.length * .002;
      this.sail.add(piece);
    };
    panel([[0, .37], [-.26, .07], [0, -.36], [.26, .07]], "#492339");
    panel([[0, .335], [-.228, .065], [0, .065]], "#ffb34e");
    panel([[0, .335], [.228, .065], [0, .065]], "#f86d53");
    panel([[-.228, .065], [0, -.317], [0, .065]], "#ed654c");
    panel([[.228, .065], [0, -.317], [0, .065]], "#c73e61");

    const ribbonColors = [makeMaterial("#e96755"), makeMaterial("#efb257")];
    for (let i = 0; i < 9; i++) {
      const segment = new THREE.Group();
      const thread = new THREE.Mesh(new THREE.BoxGeometry(.014, .107, .025), makeMaterial("#774454"));
      const bow = new THREE.Mesh(new THREE.BoxGeometry(.106, .033, .035), ribbonColors[i % 2]);
      segment.add(thread, bow);
      bow.rotation.z = .26 * (-1) ** i;
      this.tail.add(segment);
    }

    const axle = new THREE.Mesh(new THREE.BoxGeometry(.122, .053, .055), makeMaterial("#bb7952"));
    const thread = new THREE.Mesh(new THREE.BoxGeometry(.075, .061, .064), makeMaterial("#f5d59d"));
    this.reel.add(axle, thread);

    const indices: number[] = [];
    for (let i = 0; i < SEGMENTS * 2; i += 2) {
      indices.push(i, i + 1, i + 2, i + 2, i + 1, i + 3);
    }
    this.line.geometry.setIndex(indices);
    this.line.geometry.setAttribute("position", this.vertices);
    this.line.layers.set(NOINK);
    this.line.frustumCulled = false;
    this.root.add(this.sail, this.tail, this.reel, this.line);
  }

  pose(frame: number, time: number, grip: THREE.Vector3 | null, camera: THREE.PerspectiveCamera) {
    const { position, velocity, tension } = this.flight[frame];
    const wind = windAt(time);
    this.sail.position.copy(position);
    this.sail.rotation.set(
      .11 + .12 * sine(time * 3.3) * wind,
      .23 * sine(time * 2.9) + .20 * wind,
      -.16 - .23 * velocity.x + .14 * sine(time * 4.8) * (1 - .4 * tension),
    );
    this.sail.updateMatrixWorld();
    const stitch = this.sail.localToWorld(new THREE.Vector3(0, -.09, .014));
    const tip = this.sail.localToWorld(new THREE.Vector3(0, -.35, .006));
    this.tail.position.copy(tip);
    this.tail.children.forEach((segment, i) => {
      const s = (i + .5) / this.tail.children.length;
      const beat = time * 7.4 - s * 4.5;
      segment.position.set(
        s * (-.22 * velocity.x + .20 * sine(beat)) - .07 * wind * s,
        -.76 * s + .08 * sine(beat) * s,
        -.061 * s + .042 * s * sine(beat),
      );
      segment.rotation.z = .35 * sine(beat + 1.2) - .24 * velocity.x;
    });

    const end = grip ?? new THREE.Vector3(...spoolAt(time));
    this.reel.position.copy(end);
    this.reel.rotation.z = grip ? -.26 + .16 * tension : time * 8.6;
    const side = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
    const slack = lerp(.285, .043, tension);
    const center = new THREE.Vector3();
    for (let i = 0; i <= SEGMENTS; i++) {
      const s = i / SEGMENTS;
      const belly = sine(s * Math.PI);
      center.copy(end).lerp(stitch, s);
      center.y -= belly * slack;
      center.x -= belly * .18 * wind * (1 - tension);
      center.z += .065 * sine(time * 6.2 + s * 7) * belly * (1 - tension);
      // Widen across the strand in screen space, including near-vertical string poses.
      this.vertices.setXYZ(i * 2, center.x - side.x * .010, center.y - .007, center.z - side.z * .010);
      this.vertices.setXYZ(i * 2 + 1, center.x + side.x * .010, center.y + .007, center.z + side.z * .010);
    }
    this.vertices.needsUpdate = true;
  }
}
