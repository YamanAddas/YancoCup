import { useRef, useCallback, useState, useEffect } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { Vector3 } from "three";
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

const CAMERA_DISTANCE = 250;
const FLY_LERP_SPEED = 0.04;
const FLY_ARRIVE_THRESHOLD = 2;
const AUTO_ROTATE_RESUME_MS = 10_000;

function GlobeInner({
  onCityClick,
  flyToCity,
}: {
  onCityClick: (city: City | null) => void;
  flyToCity: City | null;
}) {
  const globeRef = useRef<GlobeMethods>(undefined);
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const [autoRotate, setAutoRotate] = useState(true);
  const resumeTimerRef = useRef<number>(0);
  const flyTargetRef = useRef<Vector3 | null>(null);
  const isFlyingRef = useRef(false);
  const { invalidate } = useThree();

  // Fly camera to selected city
  useEffect(() => {
    if (flyToCity && globeRef.current) {
      const coords = globeRef.current.getCoords(flyToCity.lat, flyToCity.lng);
      const dir = new Vector3(coords.x, coords.y, coords.z).normalize();
      flyTargetRef.current = dir.multiplyScalar(CAMERA_DISTANCE);
      isFlyingRef.current = true;
      setAutoRotate(false);
      clearTimeout(resumeTimerRef.current);
      invalidate();
    }
  }, [flyToCity, invalidate]);

  // Animate fly-to each frame
  useFrame(({ camera }) => {
    if (isFlyingRef.current && flyTargetRef.current) {
      camera.position.lerp(flyTargetRef.current, FLY_LERP_SPEED);
      camera.lookAt(0, 0, 0);
      controlsRef.current?.update();

      if (camera.position.distanceTo(flyTargetRef.current) < FLY_ARRIVE_THRESHOLD) {
        isFlyingRef.current = false;
        flyTargetRef.current = null;
        resumeTimerRef.current = window.setTimeout(() => {
          setAutoRotate(true);
        }, AUTO_ROTATE_RESUME_MS);
      }
      invalidate();
    }
  });

  // Pause auto-rotate when user interacts
  const handleControlStart = useCallback(() => {
    setAutoRotate(false);
    isFlyingRef.current = false;
    flyTargetRef.current = null;
    clearTimeout(resumeTimerRef.current);
  }, []);

  // Resume auto-rotate 10s after user stops interacting
  const handleControlEnd = useCallback(() => {
    clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = window.setTimeout(() => {
      setAutoRotate(true);
    }, AUTO_ROTATE_RESUME_MS);
  }, []);

  useEffect(() => {
    return () => clearTimeout(resumeTimerRef.current);
  }, []);

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
        ref={controlsRef}
        autoRotate={autoRotate}
        autoRotateSpeed={0.4}
        enableZoom={true}
        minDistance={150}
        maxDistance={400}
        enablePan={false}
        enableDamping
        onStart={handleControlStart}
        onEnd={handleControlEnd}
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
        <GlobeInner onCityClick={setSelectedCity} flyToCity={selectedCity} />
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
