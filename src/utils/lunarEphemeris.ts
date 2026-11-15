import * as THREE from 'three';
import { LunarSite } from '../data/lunarSites';

export type MissionPriority = 'balanced' | 'power' | 'comms' | 'terrain';

export interface LunarEphemerisState {
  date: Date;
  julianDate: number;
  subSolarLatDeg: number;
  subSolarLonDeg: number;
  subEarthLatDeg: number;
  subEarthLonDeg: number;
  sunDirSelenographic: THREE.Vector3;
  earthDirSelenographic: THREE.Vector3;
  lunarDayPhaseDeg: number;
  illuminationFraction: number;
}

export interface SiteAssessment {
  site: LunarSite;
  sunElevationDeg: number;
  effectiveSunElevationDeg: number;
  sunAzimuthDeg: number;
  earthElevationDeg: number;
  effectiveEarthElevationDeg: number;
  earthAzimuthDeg: number;
  isSunlit: boolean;
  hasDirectEarthLineOfSight: boolean;
  solarScore: number;
  commsScore: number;
  terrainScore: number;
  compositeIndex: number;
  suitabilityLabel: 'Nominal' | 'Marginal' | 'Shadowed';
}

export interface SynodicSample {
  dayOffset: number;
  dateLabel: string;
  sunElevationDeg: number;
  effectiveSunDeg: number;
  earthElevationDeg: number;
  effectiveEarthDeg: number;
}

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

function normalizeDeg(deg: number): number {
  const m = deg % 360;
  return m < 0 ? m + 360 : m;
}

export function dateToJulianDate(date: Date): number {
  return date.getTime() / 86400000 + 2440587.5;
}

/**
 * Convert selenographic (latDeg, lonDeg) to right-handed Three.js unit vector:
 * +Y = North Pole (+90 lat)
 * +Z = Prime Meridian (0 lon, facing Earth)
 * +X = 90 deg East
 */
export function selenographicToVector3(
  latDeg: number,
  lonDeg: number,
  radius = 1,
  target = new THREE.Vector3(),
): THREE.Vector3 {
  const lat = latDeg * DEG2RAD;
  const lon = lonDeg * DEG2RAD;
  const cosLat = Math.cos(lat);
  target.set(
    radius * cosLat * Math.sin(lon),
    radius * Math.sin(lat),
    radius * cosLat * Math.cos(lon),
  );
  return target;
}

/**
 * Analytical lunar ephemeris in the Mean Earth / Polar Axis (ME) frame.
 * Computes sub-solar coordinates (including 1.5424 deg obliquity) and
 * sub-Earth optical libration (longitude +-7.7 deg, latitude +-6.7 deg).
 */
export function computeLunarEphemeris(date: Date): LunarEphemerisState {
  const jd = dateToJulianDate(date);
  const d = jd - 2451545.0; // Days since J2000.0

  // Fundamental lunar & solar orbital arguments (degrees)
  const D = normalizeDeg(297.8501921 + 12.19074912 * d); // Mean elongation
  const M = normalizeDeg(357.5291092 + 0.98560028 * d); // Solar mean anomaly
  const Mp = normalizeDeg(134.9633964 + 13.06499295 * d); // Lunar mean anomaly
  const F = normalizeDeg(93.272095 + 13.22935024 * d); // Lunar argument of latitude
  const Omega = normalizeDeg(125.04452 - 0.05295377 * d); // Ascending node of lunar orbit
  const Lsun = normalizeDeg(
    280.46646 + 0.98564736 * d + 1.914602 * Math.sin(M * DEG2RAD),
  );

  // Sub-solar longitude in ME frame (synodic rotation ~29.53 days)
  const subSolarLonDeg = normalizeDeg(
    180 -
      D -
      6.289 * Math.sin(Mp * DEG2RAD) +
      2.1 * Math.sin(M * DEG2RAD) -
      1.274 * Math.sin((Mp - 2 * D) * DEG2RAD),
  );

  // Sub-solar latitude from 1.5424 deg lunar axial tilt relative to ecliptic
  const sunNodeDiff = (Lsun - Omega) * DEG2RAD;
  const subSolarLatDeg =
    RAD2DEG * Math.asin(Math.sin(1.5424 * DEG2RAD) * Math.sin(sunNodeDiff));

  // Optical libration in longitude & latitude (sub-Earth point)
  const subEarthLonDeg =
    -6.289 * Math.sin(Mp * DEG2RAD) -
    1.274 * Math.sin((Mp - 2 * D) * DEG2RAD) -
    0.658 * Math.sin(2 * D * DEG2RAD);
  const subEarthLatDeg = -6.68 * Math.sin(F * DEG2RAD);

  const sunDirSelenographic = selenographicToVector3(
    subSolarLatDeg,
    subSolarLonDeg,
    1,
  ).normalize();
  const earthDirSelenographic = selenographicToVector3(
    subEarthLatDeg,
    subEarthLonDeg,
    1,
  ).normalize();

  const phaseAngleRad = Math.acos(
    THREE.MathUtils.clamp(
      sunDirSelenographic.dot(earthDirSelenographic),
      -1,
      1,
    ),
  );
  const illuminationFraction = 0.5 * (1 + Math.cos(phaseAngleRad));

  return {
    date,
    julianDate: jd,
    subSolarLatDeg,
    subSolarLonDeg,
    subEarthLatDeg,
    subEarthLonDeg,
    sunDirSelenographic,
    earthDirSelenographic,
    lunarDayPhaseDeg: D,
    illuminationFraction,
  };
}

function getLocalENU(latDeg: number, lonDeg: number) {
  const up = selenographicToVector3(latDeg, lonDeg, 1).normalize();
  const lon = lonDeg * DEG2RAD;
  const east = new THREE.Vector3(Math.cos(lon), 0, -Math.sin(lon)).normalize();
  const north = new THREE.Vector3().crossVectors(up, east).normalize();
  return { east, north, up };
}

function computeElAz(
  targetDir: THREE.Vector3,
  east: THREE.Vector3,
  north: THREE.Vector3,
  up: THREE.Vector3,
): { elevationDeg: number; azimuthDeg: number } {
  const sinEl = THREE.MathUtils.clamp(targetDir.dot(up), -1, 1);
  const elevationDeg = Math.asin(sinEl) * RAD2DEG;
  const compE = targetDir.dot(east);
  const compN = targetDir.dot(north);
  const azimuthDeg = normalizeDeg(Math.atan2(compE, compN) * RAD2DEG);
  return { elevationDeg, azimuthDeg };
}

export function evaluateSiteAtDate(
  site: LunarSite,
  ephemeris: LunarEphemerisState,
  priority: MissionPriority = 'balanced',
  maxSlopeLimitDeg = 12,
): SiteAssessment {
  const { east, north, up } = getLocalENU(site.latDeg, site.lonDeg);

  const sun = computeElAz(ephemeris.sunDirSelenographic, east, north, up);
  const earth = computeElAz(ephemeris.earthDirSelenographic, east, north, up);

  // Elevation above mean sphere slightly widens geometric horizon dip (~sqrt(2h/R))
  const horizonDipBonusDeg =
    site.elevationKm > 0
      ? Math.sqrt((2 * site.elevationKm) / 1737.4) * RAD2DEG
      : 0;

  const effectiveSunElevationDeg =
    sun.elevationDeg + horizonDipBonusDeg - site.horizonMaskDeg;
  const effectiveEarthElevationDeg =
    earth.elevationDeg + horizonDipBonusDeg - site.horizonMaskDeg * 0.7;

  const isSunlit = effectiveSunElevationDeg > -0.26; // Solar angular radius ~0.265 deg
  const hasDirectEarthLineOfSight = effectiveEarthElevationDeg > 0;

  // Derived engineering metrics (0-100) from actual geometric elevation & slope margins
  const solarScore = Math.round(
    THREE.MathUtils.clamp(((effectiveSunElevationDeg + 2.5) / 8.5) * 100, 0, 100),
  );
  const commsScore = Math.round(
    THREE.MathUtils.clamp(
      ((effectiveEarthElevationDeg + 1.5) / 11.5) * 100,
      0,
      100,
    ),
  );
  const terrainScore = Math.round(
    THREE.MathUtils.clamp(
      100 - (site.meanSlopeDeg / Math.max(maxSlopeLimitDeg, 6)) * 55 - site.horizonMaskDeg * 8,
      5,
      100,
    ),
  );

  let weights = { solar: 0.4, comms: 0.3, terrain: 0.3 };
  if (priority === 'power') weights = { solar: 0.6, comms: 0.2, terrain: 0.2 };
  if (priority === 'comms') weights = { solar: 0.25, comms: 0.55, terrain: 0.2 };
  if (priority === 'terrain') weights = { solar: 0.25, comms: 0.2, terrain: 0.55 };

  const compositeIndex = Math.round(
    solarScore * weights.solar +
      commsScore * weights.comms +
      terrainScore * weights.terrain,
  );

  let suitabilityLabel: 'Nominal' | 'Marginal' | 'Shadowed' = 'Nominal';
  if (!isSunlit && effectiveSunElevationDeg < -1.0) {
    suitabilityLabel = 'Shadowed';
  } else if (!isSunlit || !hasDirectEarthLineOfSight || site.meanSlopeDeg > maxSlopeLimitDeg) {
    suitabilityLabel = 'Marginal';
  }

  return {
    site,
    sunElevationDeg: sun.elevationDeg,
    effectiveSunElevationDeg,
    sunAzimuthDeg: sun.azimuthDeg,
    earthElevationDeg: earth.elevationDeg,
    effectiveEarthElevationDeg,
    earthAzimuthDeg: earth.azimuthDeg,
    isSunlit,
    hasDirectEarthLineOfSight,
    solarScore,
    commsScore,
    terrainScore,
    compositeIndex,
    suitabilityLabel,
  };
}

export function computeSynodicProfile(
  site: LunarSite,
  centerDate: Date,
  spanDays = 30,
  sampleCount = 61,
): SynodicSample[] {
  const samples: SynodicSample[] = [];
  const halfSpanMs = (spanDays / 2) * 86400000;
  const stepMs = (spanDays * 86400000) / Math.max(sampleCount - 1, 1);

  for (let i = 0; i < sampleCount; i++) {
    const t = new Date(centerDate.getTime() - halfSpanMs + i * stepMs);
    const eph = computeLunarEphemeris(t);
    const evalRes = evaluateSiteAtDate(site, eph);
    const dayOffset = (t.getTime() - centerDate.getTime()) / 86400000;
    const month = t.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
    const day = String(t.getUTCDate()).padStart(2, '0');
    samples.push({
      dayOffset,
      dateLabel: `${month} ${day}`,
      sunElevationDeg: evalRes.sunElevationDeg,
      effectiveSunDeg: evalRes.effectiveSunElevationDeg,
      earthElevationDeg: evalRes.earthElevationDeg,
      effectiveEarthDeg: evalRes.effectiveEarthElevationDeg,
    });
  }
  return samples;
}

export function formatSelenographicCoord(latDeg: number, lonDeg: number): string {
  const latStr = `${Math.abs(latDeg).toFixed(2)}° ${latDeg < 0 ? 'S' : 'N'}`;
  const normLon = normalizeDeg(lonDeg);
  const lonStr =
    normLon <= 180
      ? `${normLon.toFixed(2)}° E`
      : `${(360 - normLon).toFixed(2)}° W`;
  return `${latStr}, ${lonStr}`;
}
