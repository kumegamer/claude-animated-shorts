import { useMemo } from "react";
import { AbsoluteFill, Easing, interpolate, random, useCurrentFrame, useVideoConfig } from "remotion";
import { AdditiveBlending, DoubleSide } from "three";
import { ReadyThreeCanvas } from "../ReadyThreeCanvas";

const vertexShader = `
  varying vec3 surface;
  void main() {
    surface = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const sunShader = `
  uniform float seconds;
  varying vec3 surface;

  float hash(vec3 p) {
    return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
  }

  float noise(vec3 p) {
    vec3 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x),
          mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
      mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
          mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
      f.z);
  }

  void main() {
    vec3 n = normalize(surface);
    vec3 p = n * 5.0 + vec3(seconds * .12, 0.0, 0.0);
    float clouds = .60 * noise(p) + .28 * noise(p * 2.5) + .12 * noise(p * 9.0);
    float grain = noise(p * 27.0);
    float heat = smoothstep(.18, .81, clouds * .88 + grain * .12);
    vec3 color = mix(vec3(.74, .15, .12), vec3(1.0, .86, .53), heat);
    color = mix(color, vec3(1.0, .74, .37), .36 * pow(1.0 - n.z, 3.0));
    gl_FragColor = vec4(color, 1.0);
  }
`;

const coronaShader = `
  uniform float seconds;
  uniform float totality;
  varying vec3 surface;

  void main() {
    float r = length(surface.xy);
    float a = atan(surface.y, surface.x);
    float rays = .40 + .22 * sin(a * 9.0 + seconds) + .14 * sin(a * 21.0 - seconds * .4);
    float rim = exp(-18.0 * abs(r - 1.41));
    float glow = exp(-max(0.0, r - 1.35) * 5.0) * rays;
    float intensity = (rim * .50 + glow) * (1.0 - smoothstep(1.55, 2.6, r));
    gl_FragColor = vec4(1.0, .44 + .32 * totality, .22 + .48 * totality,
      intensity * (.58 + .52 * totality));
  }
`;

const stations = Array.from({ length: 72 }, (_, index) => ({
  angle: index * Math.PI / 36,
  major: index % 6 === 0,
}));

const stars = Array.from({ length: 70 }, (_, index) => ({
  x: random(`star-x-${index}`) * 7.1 - 3.55,
  y: random(`star-y-${index}`) * 10 - 5,
  size: .007 + random(`star-size-${index}`) * .014,
}));

const EclipseScene = ({ seconds, moonX, totality }: {
  seconds: number;
  moonX: number;
  totality: number;
}) => {
  const sunUniforms = useMemo(() => ({ seconds: { value: 0 } }), []);
  const coronaUniforms = useMemo(() => ({
    seconds: { value: 0 },
    totality: { value: 0 },
  }), []);
  sunUniforms.seconds.value = seconds;
  coronaUniforms.seconds.value = seconds;
  coronaUniforms.totality.value = totality;

  return (
    <>
      {stars.map(({ x, y, size }) => (
        <mesh key={x} position={[x, y, -2]}>
          <circleGeometry args={[size, 8]} />
          <meshBasicMaterial color={x > 0 ? "#9eb4cf" : "#deb994"} transparent opacity={.34 + totality * .48} />
        </mesh>
      ))}
      <group rotation={[0, 0, -.19 + seconds * .075]}>
        <mesh>
          <ringGeometry args={[2.53, 2.545, 128]} />
          <meshBasicMaterial color="#a26955" transparent opacity={.75} side={DoubleSide} />
        </mesh>
        <mesh>
          <ringGeometry args={[2.92, 2.926, 128]} />
          <meshBasicMaterial color="#7c8ba9" transparent opacity={.45} side={DoubleSide} />
        </mesh>
        {stations.map(({ angle, major }) => (
          <mesh
            key={angle}
            position={[Math.cos(angle) * 2.72, Math.sin(angle) * 2.72, 0]}
            rotation={[0, 0, angle]}
          >
            <planeGeometry args={[major ? .18 : .08, major ? .021 : .009]} />
            <meshBasicMaterial color={major ? "#ffd092" : "#8e8492"} />
          </mesh>
        ))}
      </group>
      <group rotation={[.98, -.22, -.35 - seconds * .075]}>
        <mesh>
          <torusGeometry args={[2.31, .016, 8, 112]} />
          <meshBasicMaterial color="#d89972" transparent opacity={.76} />
        </mesh>
        <mesh position={[2.31, 0, 0]}>
          <sphereGeometry args={[.058, 16, 12]} />
          <meshBasicMaterial color="#ffe1a9" />
        </mesh>
      </group>
      <mesh position={[0, 0, -.28]}>
        <planeGeometry args={[5.2, 5.2]} />
        <shaderMaterial
          vertexShader={vertexShader}
          fragmentShader={coronaShader}
          uniforms={coronaUniforms}
          transparent
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>
      <mesh>
        <sphereGeometry args={[1.31, 64, 40]} />
        <shaderMaterial vertexShader={vertexShader} fragmentShader={sunShader} uniforms={sunUniforms} />
      </mesh>
      <mesh position={[moonX, 0, 1.69]}>
        <sphereGeometry args={[1.35, 64, 40]} />
        <meshBasicMaterial color="#101625" />
      </mesh>
    </>
  );
};

const phaseLabels = ["Approach", "Totality", "Reappearance"];

export const PocketEclipse = () => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const seconds = frame / fps;
  const moonX = interpolate(seconds, [0, 2.16, 2.5, 2.84, 5], [-2.96, -.26, 0, .26, 2.96], {
    easing: Easing.inOut(Easing.sin),
  });
  const totality = interpolate(Math.abs(moonX), [0, 1.5], [1, 0], {
    extrapolateRight: "clamp",
  });
  const phase = seconds < 2.19 ? 0 : seconds < 2.81 ? 1 : 2;

  return (
    <AbsoluteFill style={{
      background: "radial-gradient(ellipse at 50% 51%, #342333 0%, #161a2a 42%, #0b101c 82%)",
      color: "#fff1db",
    }}>
      <ReadyThreeCanvas
        width={width}
        height={height}
        orthographic
        camera={{ position: [0, 0, 10], zoom: 74, near: .1, far: 30 }}
        gl={{ alpha: true, antialias: true }}
      >
        <EclipseScene seconds={seconds} moonX={moonX} totality={totality} />
      </ReadyThreeCanvas>
      <header style={{ position: "absolute", top: 75, left: 0, right: 0, textAlign: "center" }}>
        <div style={{ font: "600 13px monospace", color: "#e2ad8b", letterSpacing: 5 }}>
          SUN · MOON · EARTH
        </div>
        <h1 style={{
          fontFamily: "Georgia, serif", fontWeight: 400, fontSize: 78,
          lineHeight: .83, letterSpacing: -5, margin: "26px 0 0",
        }}>
          Pocket<br />Eclipse
        </h1>
      </header>
      <footer style={{
        position: "absolute", bottom: 79, left: 68, right: 68,
        font: "600 14px monospace", letterSpacing: 2, textTransform: "uppercase",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
          <span>{phaseLabels[phase]}</span>
          <span style={{ color: "#d2a086" }}>0{phase + 1} / 03</span>
        </div>
        <div style={{ height: 2, background: "#79616f" }}>
          <div style={{
            width: `${100 * Math.min(1, (frame + 1) / (5 * fps))}%`,
            height: "100%",
            background: "#ffd099",
          }} />
        </div>
      </footer>
    </AbsoluteFill>
  );
};
