import { useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import Globe from "r3f-globe";
import type { GlobeMethods } from "r3f-globe";

const EARTH_NIGHT_URL =
  "https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-night.jpg";
const EARTH_BUMP_URL =
  "https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-topology.png";

export default function GlobeScene() {
  const globeRef = useRef<GlobeMethods>(undefined);

  return (
    <Canvas
      frameloop="demand"
      camera={{ position: [0, 0, 250], fov: 50 }}
      style={{ background: "transparent" }}
      gl={{ antialias: true, alpha: true }}
    >
      <ambientLight intensity={0.8} />
      <directionalLight position={[50, 30, 50]} intensity={1.2} />

      <Globe
        ref={globeRef}
        globeImageUrl={EARTH_NIGHT_URL}
        bumpImageUrl={EARTH_BUMP_URL}
        showAtmosphere={true}
        atmosphereColor="#00ff88"
        atmosphereAltitude={0.2}
      />

      <OrbitControls
        autoRotate
        autoRotateSpeed={0.4}
        enableZoom={true}
        minDistance={150}
        maxDistance={400}
        enablePan={false}
      />
    </Canvas>
  );
}
