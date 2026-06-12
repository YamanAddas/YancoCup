import { useState, useEffect } from "react";
import { WORKER_URL } from "./api";

/** Strip diacritics: "Müller" → "Muller", "Magalhães" → "Magalhaes" */
export function stripDiacritics(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/**
 * Find a player photo by fuzzy name matching.
 * API-Football uses short names ("B. Saka", "Kepa") while football-data.org
 * and ESPN use full names ("Bukayo Saka", "Kepa Arrizabalaga"). We try
 * multiple strategies with diacritics-stripped comparison for accented names.
 */
export function findPhoto(name: string, photos: Record<string, string>): string | undefined {
  if (!name || Object.keys(photos).length === 0) return undefined;
  // Exact match
  if (photos[name]) return photos[name];

  const norm = (s: string) => stripDiacritics(s.toLowerCase().replace(/[.\-']/g, "").trim());
  const fdNorm = norm(name);
  const entries = Object.entries(photos);

  // Pass 1: normalized exact match
  for (const [k, v] of entries) {
    if (norm(k) === fdNorm) return v;
  }

  const fdParts = fdNorm.split(/\s+/).filter(Boolean);
  if (fdParts.length === 0) return undefined;
  const fdLast = fdParts[fdParts.length - 1]!;
  const fdFirst = fdParts[0]!;

  // Compound surname: "Van Dijk" → "van dijk", "De Bruyne" → "de bruyne"
  // Take last 2+ parts for compound matching: "virgil van dijk" → "van dijk"
  const fdCompound = fdParts.length >= 3 ? fdParts.slice(-2).join(" ") : null;

  for (const [k, v] of entries) {
    const afNorm = norm(k);
    const afParts = afNorm.split(/\s+/).filter(Boolean);
    if (afParts.length === 0) continue;
    const afLast = afParts[afParts.length - 1]!;
    const afFirst = afParts[0]!;
    const afCompound = afParts.length >= 2 ? afParts.slice(-2).join(" ") : null;

    // Last name match: "Bukayo Saka" ↔ "B Saka"
    if (fdLast.length > 2 && afLast === fdLast) return v;
    // Compound surname match: "Virgil van Dijk" ↔ "V. van Dijk"
    if (fdCompound && afCompound && fdCompound === afCompound) return v;
    // AF single name is fd first name: "Kepa" ↔ "Kepa Arrizabalaga"
    if (afParts.length === 1 && afNorm === fdFirst) return v;
    // FD single name is AF first name: "Gabriel" ↔ "Gabriel Magalhães"
    if (fdParts.length === 1 && fdNorm === afFirst) return v;
    // Initial + last name: "B Saka" ↔ "Bukayo Saka" (initial stripped of dot)
    if (afParts.length >= 2 && afFirst.length === 1) {
      if (afLast === fdLast && fdFirst[0] === afFirst[0]) return v;
    }
    // FD contains AF name or vice versa (handles mononyms and partial)
    if (afNorm.length > 3 && fdNorm.includes(afNorm)) return v;
    if (fdNorm.length > 3 && afNorm.includes(fdNorm)) return v;
  }
  return undefined;
}

// Module-level cache: photo maps change rarely (worker caches them 30 days)
const photoCache = new Map<number, Record<string, string>>();

/** Fetch the player-photo map for a team (worker proxy, cached per session) */
export function useTeamPhotos(teamId: number | null | undefined): Record<string, string> {
  const [photos, setPhotos] = useState<Record<string, string>>(
    teamId != null ? photoCache.get(teamId) ?? {} : {},
  );

  useEffect(() => {
    if (teamId == null) return;
    const cached = photoCache.get(teamId);
    if (cached) {
      setPhotos(cached);
      return;
    }
    let cancelled = false;
    fetch(`${WORKER_URL}/api/team/${teamId}/photos`)
      .then((r) => (r.ok ? r.json() : { photos: {} }))
      .then((j: { photos?: Record<string, string> }) => {
        const map = j.photos ?? {};
        photoCache.set(teamId, map);
        if (!cancelled) setPhotos(map);
      })
      .catch(() => {
        if (!cancelled) setPhotos({});
      });
    return () => {
      cancelled = true;
    };
  }, [teamId]);

  return photos;
}
