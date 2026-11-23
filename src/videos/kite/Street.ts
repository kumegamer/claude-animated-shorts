import * as THREE from "three";
import { Batch, V, boxGeo, house, lam, prop } from "../../../templates/bridge/build";
import { ctex, cobbleHD, rep } from "../../../templates/bridge/paint";
import { LIGHTS, LOOK } from "../../../templates/bridge/lights";
import { CHAR, TONE } from "../../../templates/bridge/shade";
import { noInkFallback } from "../../../templates/bridge/ink";

const skyTexture = () => ctex("kite-street-sky", 256, 512, (ctx) => {
  const gradient = ctx.createLinearGradient(0, 0, 0, 512);
  gradient.addColorStop(0, "#548cc7");
  gradient.addColorStop(.53, "#8fc5e8");
  gradient.addColorStop(1, "#f9d6b0");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 256, 512);
});

export const streetPalettes = () => {
  const light = LIGHTS.day;
  TONE.uLitCol.value.set(1.64, 1.51, 1.37);
  TONE.uShadeCol.value.set(.41, .43, .59);
  TONE.uShadeLift.value.set(...light.lift);
  TONE.uLambert.value = light.lambert;
  TONE.uSideK.value = light.sideK;
  TONE.uTerm.value = light.term;
  TONE.uBounce.value.set(.018, .010, 0);
  TONE.uSat.value = LOOK.day.sat;
  CHAR.uCharTint.value.set(...light.charTint);
  CHAR.uCharShade.value = light.charShade;
  CHAR.uGrad.value = light.charGrad;
  CHAR.uBodyGrad.value = light.bodyGrad;
  CHAR.uSideTint.value.set(...light.sideTint);
};

const pennantColors = ["#d45450", "#f4b956", "#4c999e", "#dc7965"];

export function makeStreet() {
  const root = new THREE.Group();
  const batch = new Batch();
  // The houses, painted façades, trim, cobbles, and kit fallbacks are the upstream bridge modules.
  for (const [x, z, angle, height, style] of [
    [-13, -10, -.13, 6.3, 1], [-7.4, -10.8, -.08, 5.4, 3],
    [-1.5, -11.4, 0, 6.4, 2], [4.4, -10, .12, 5.8, 0],
    [10.1, -9.1, .17, 6.6, 5], [15.8, -11, .09, 5.8, 6],
    [-10, -23, -.2, 8, 0], [1, -25, .16, 7.5, 6], [11, -22, .2, 8.2, 4],
  ]) {
    house(batch, x, z, angle, 5.45, 4.4, height, style, 0);
  }
  for (const [x, z, size] of [[-9, -4.4, 4.1], [.3, -6.7, 4.0], [8.5, -3.8, 5.0]]) {
    prop(batch, {}, "tree_oak", x, .12, z, size, x);
  }
  const pavement = lam("kite-street-cobbles", () => ({ map: rep(cobbleHD(), 1, 1) }));
  batch.add(boxGeo(V(-30, -.30, -41), V(30, -.014, 13), 3.2), pavement);
  const curb = lam("kite-street-curb", () => ({ color: "#d7a77b" }));
  batch.add(boxGeo(V(-23, -.02, -7.5), V(23, .13, -4.65), 2), curb);
  const pot = lam("kite-street-planter", () => ({ color: "#b15d45" }));
  const leaf = lam("kite-street-leaf", () => ({ color: "#4c924c" }));
  for (const [x, z] of [[-7.8, -2.75], [-4.25, -5.1], [2.9, -4.3], [6.6, -3.3]]) {
    batch.add(new THREE.CylinderGeometry(.55, .39, .49, 10).translate(x, .25, z), pot);
    for (let i = 0; i < 5; i++) {
      const angle = i * Math.PI * .4;
      batch.add(new THREE.IcosahedronGeometry(.37, 1)
        .translate(x + .25 * Math.cos(angle), .58 + .22 * (i % 2), z + .31 * Math.sin(angle)), leaf);
      batch.add(new THREE.IcosahedronGeometry(.12, 1)
        .translate(x + .35 * Math.cos(angle), .88 + .17 * (i % 2), z + .4 * Math.sin(angle)),
      lam(`kite-petal-${i % 3}`, () => ({ color: ["#d94b69", "#ffd372", "#ed9073"][i % 3] })));
    }
  }
  batch.build(root);

  const cablePoints = Array.from({ length: 33 }, (_, i) => {
    const x = -13 + i * .75;
    return V(x, 3.9 - .67 * Math.sin(i / 32 * Math.PI), -4.2 - i * .079);
  });
  const curve = new THREE.CatmullRomCurve3(cablePoints);
  const cable = new THREE.Mesh(new THREE.TubeGeometry(curve, 32, .014, 4), new THREE.MeshBasicMaterial({ color: "#473348" }));
  root.add(cable);

  const flags = Array.from({ length: 23 }, (_, i) => {
    const geometry = new THREE.BufferGeometry().setAttribute("position",
      new THREE.Float32BufferAttribute([-.21, 0, 0, .21, 0, 0, 0, -.48, .06], 3));
    geometry.computeVertexNormals();
    const flag = new THREE.Mesh(
      geometry,
      lam(`kite-pennant-${i % 4}`, () => ({ color: pennantColors[i % 4], side: THREE.DoubleSide })),
    );
    flag.position.copy(curve.getPoint((i + .5) / 23));
    root.add(flag);
    return flag;
  });
  noInkFallback(root);
  return { root, flags, sky: skyTexture(), fog: new THREE.Fog("#b7c5df", 13, 48) };
}
