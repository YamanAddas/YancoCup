import { useRef, useCallback, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import Globe from "r3f-globe";
import type { GlobeMethods } from "r3f-globe";
import cities from "../../data/cities.json";
import CityPopup from "./CityPopup";

interface City {
  id: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
  venue: string;
  capacity: number;
}

const EARTH_NIGHT_URL =
  "https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-night.jpg";
const EARTH_BUMP_URL =
  "https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-topology.png";

function GlobeInner({
  onCityClick,
}: {
  onCityClick: (city: City | null) => void;
}) {
  const globeRef = useRef<GlobeMethods>(undefined);

  const handleClick = useCallback(
    (_layer: string, data: object | undefined) => {
      if (data && "id" in data) {
        onCityClick(data as City);
      } else {
        onCityClick(null);
      }
    },
    [onCityClick],
  );

  return (
    <>
      <ambientLight intensity={0.8} />
      <directionalLight position={[50, 30, 50]} intensity={1.2} />

      <Globe
        ref={globeRef}
        globeImageUrl={EARTH_NIGHT_URL}
        bumpImageUrl={EARTH_BUMP_URL}
        showAtmosphere={true}
        atmosphereColor="#00ff88"
        atmosphereAltitude={0.2}
        pointsData={cities}
        pointLat="lat"
        pointLng="lng"
        pointColor={() => "#00ff88"}
        pointAltitude={0.02}
        pointRadius={0.4}
        pointResolution={12}
        labelsData={cities}
        labelLat="lat"
        labelLng="lng"
        labelText="city"
        labelColor={() => "#ffffff"}
        labelSize={0.6}
        labelAltitude={0.03}
        labelDotRadius={0.3}
        labelIncludeDot={false}
        labelResolution={2}
        onClick={handleClick}
      />

      <OrbitControls
        autoRotate
        autoRotateSpeed={0.4}
        enableZoom={true}
        minDistance={150}
        maxDistance={400}
        enablePan={false}
      />
    </>
  );
}

export default function GlobeScene() {
  const [selectedCity, setSelectedCity] = useState<City | null>(null);

  return (
    <div className="relative w-full h-full">
      <Canvas
        frameloop="demand"
        camera={{ position: [0, 0, 250], fov: 50 }}
        style={{ background: "transparent" }}
        gl={{ antialias: true, alpha: true }}
      >
        <GlobeInner onCityClick={setSelectedCity} />
      </Canvas>

      {selectedCity && (
        <CityPopup
          city={selectedCity}
          onClose={() => setSelectedCity(null)}
        />
      )}
    </div>
  );
}
