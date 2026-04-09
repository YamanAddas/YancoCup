import { useRef, useCallback, useState, useEffect, useMemo, Component } from "react";
import type { ReactNode, ErrorInfo } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { Vector3 } from "three";
import Globe from "r3f-globe";
import type { GlobeMethods } from "r3f-globe";
import cities from "../../data/cities.json";
import CityPopup from "./CityPopup";

/** Catch internal r3f-globe/Kapsule errors that fire during unmount/cleanup */
class GlobeErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(_error: Error, _info: ErrorInfo) {
    // Suppress __kapsuleInstance errors from three-globe internals
  }
  componentDidMount() {
    // Catch unhandled errors from r3f-globe/Kapsule during React effect cleanup.
    // These fire outside the render cycle so ErrorBoundary alone can't catch them.
    this._onError = (event: ErrorEvent) => {
      if (event.error?.toString?.().includes("kapsuleInstance") ||
          event.message?.includes("kapsuleInstance")) {
        event.preventDefault();
      }
    };
    this._onRejection = (event: PromiseRejectionEvent) => {
      const msg = event.reason?.toString?.() ?? "";
      if (msg.includes("kapsuleInstance")) {
        event.preventDefault();
      }
    };
    window.addEventListener("error", this._onError);
    window.addEventListener("unhandledrejection", this._onRejection);
  }
  componentWillUnmount() {
    if (this._onError) window.removeEventListener("error", this._onError);
    if (this._onRejection) window.removeEventListener("unhandledrejection", this._onRejection);
  }
  private _onError?: (event: ErrorEvent) => void;
  private _onRejection?: (event: PromiseRejectionEvent) => void;
  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

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

/** Detect mobile/low-end device */
function useDeviceProfile() {
  return useMemo(() => {
    const isMobile = window.innerWidth < 640;
    const isLowEnd = (navigator.hardwareConcurrency ?? 4) < 4;
    return { isMobile, isLowEnd, isReduced: isMobile || isLowEnd };
  }, []);
}

function GlobeInner({
  onCityClick,
  flyToCity,
}: {
  onCityClick: (city: City | null) => void;
  flyToCity: City | null;
}) {
  const globeRef = useRef<GlobeMethods>(undefined);
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const device = useDeviceProfile();
  const [autoRotate, setAutoRotate] = useState(!device.isMobile);
  const resumeTimerRef = useRef<number>(0);
  const flyTargetRef = useRef<Vector3 | null>(null);
  const isFlyingRef = useRef(false);
  const mountedRef = useRef(true);
  const { invalidate } = useThree();

  // Track mount state to prevent post-unmount state updates
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearTimeout(resumeTimerRef.current);
      isFlyingRef.current = false;
      flyTargetRef.current = null;
    };
  }, []);

  // Fly camera to selected city
  useEffect(() => {
    if (!mountedRef.current) return;
    if (flyToCity && globeRef.current) {
      try {
        const coords = globeRef.current.getCoords(flyToCity.lat, flyToCity.lng);
        const dir = new Vector3(coords.x, coords.y, coords.z).normalize();
        flyTargetRef.current = dir.multiplyScalar(CAMERA_DISTANCE);
        isFlyingRef.current = true;
        setAutoRotate(false);
        clearTimeout(resumeTimerRef.current);
        invalidate();
      } catch {
        // Globe instance may be destroyed during unmount
      }
    }
  }, [flyToCity, invalidate]);

  // Animate fly-to each frame
  useFrame(({ camera }) => {
    if (!mountedRef.current) return;
    if (isFlyingRef.current && flyTargetRef.current) {
      camera.position.lerp(flyTargetRef.current, FLY_LERP_SPEED);
      camera.lookAt(0, 0, 0);
      controlsRef.current?.update();

      if (camera.position.distanceTo(flyTargetRef.current) < FLY_ARRIVE_THRESHOLD) {
        isFlyingRef.current = false;
        flyTargetRef.current = null;
        // Only resume auto-rotate on desktop
        if (!device.isMobile) {
          resumeTimerRef.current = window.setTimeout(() => {
            if (mountedRef.current) setAutoRotate(true);
          }, AUTO_ROTATE_RESUME_MS);
        }
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

  // Resume auto-rotate 10s after user stops interacting (desktop only)
  const handleControlEnd = useCallback(() => {
    if (device.isMobile) return;
    clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = window.setTimeout(() => {
      if (mountedRef.current) setAutoRotate(true);
    }, AUTO_ROTATE_RESUME_MS);
  }, [device.isMobile]);

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
        bumpImageUrl={device.isReduced ? undefined : EARTH_BUMP_URL}
        showAtmosphere={!device.isLowEnd}
        atmosphereColor="#00ff88"
        atmosphereAltitude={0.2}
        pointsData={cities}
        pointLat="lat"
        pointLng="lng"
        pointColor={() => "#00ff88"}
        pointAltitude={0.02}
        pointRadius={device.isMobile ? 0.5 : 0.4}
        pointResolution={device.isReduced ? 6 : 12}
        labelsData={device.isLowEnd ? [] : cities}
        labelLat="lat"
        labelLng="lng"
        labelText="city"
        labelColor={() => "#ffffff"}
        labelSize={device.isMobile ? 0.8 : 0.6}
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
  const device = useDeviceProfile();

  return (
    <div className="relative w-full h-full">
      <GlobeErrorBoundary>
        <Canvas
          frameloop="demand"
          camera={{ position: [0, 0, 250], fov: 50 }}
          style={{ background: "transparent" }}
          gl={{ antialias: !device.isReduced, alpha: true }}
          dpr={device.isMobile ? [1, 1.5] : [1, 2]}
        >
          <GlobeInner onCityClick={setSelectedCity} flyToCity={selectedCity} />
        </Canvas>
      </GlobeErrorBoundary>

      {selectedCity && (
        <CityPopup
          city={selectedCity}
          onClose={() => setSelectedCity(null)}
        />
      )}
    </div>
  );
}
