import * as THREE from 'three';
import { LunarSite } from '../data/lunarSites';

// Fast deterministic 3D value noise for seamless spherical lunar terrain
function hash3(ix: number, iy: number, iz: number): number {
  let n = ix * 374761393 + iy * 668265263 + iz * 1274126177;
  n = (n ^ (n >> 13)) * 1274126177;
  return ((n ^ (n >> 16)) >>> 0) / 4294967295;
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function noise3D(x: number, y: number, z: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);
  const fx = smoothstep(x - ix);
  const fy = smoothstep(y - iy);
  const fz = smoothstep(z - iz);

  const c000 = hash3(ix, iy, iz);
  const c100 = hash3(ix + 1, iy, iz);
  const c010 = hash3(ix, iy + 1, iz);
  const c110 = hash3(ix + 1, iy + 1, iz);
  const c001 = hash3(ix, iy, iz + 1);
  const c101 = hash3(ix + 1, iy, iz + 1);
  const c011 = hash3(ix, iy + 1, iz + 1);
  const c111 = hash3(ix + 1, iy + 1, iz + 1);

  const x00 = lerp(c000, c100, fx);
  const x10 = lerp(c010, c110, fx);
  const x01 = lerp(c001, c101, fx);
  const x11 = lerp(c011, c111, fx);

  return lerp(lerp(x00, x10, fy), lerp(x01, x11, fy), fz);
}

export function fbm3D(x: number, y: number, z: number, octaves = 5): number {
  let value = 0;
  let amp = 0.5;
  let freq = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    value += amp * noise3D(x * freq, y * freq, z * freq);
    norm += amp;
    amp *= 0.5;
    freq *= 2.07;
  }
  return value / norm;
}

interface MareBasin {
  lat: number;
  lon: number;
  radiusDeg: number;
  depth: number;
  darkness: number;
}

// Major real selenographic basaltic maria & South Pole-Aitken basin
const MARE_BASINS: MareBasin[] = [
  { lat: 32.8, lon: 344.4, radiusDeg: 24, depth: -0.35, darkness: 0.44 }, // Mare Imbrium
  { lat: 28.0, lon: 17.5, radiusDeg: 14, depth: -0.28, darkness: 0.42 }, // Mare Serenitatis
  { lat: 8.5, lon: 31.4, radiusDeg: 15, depth: -0.25, darkness: 0.41 }, // Mare Tranquillitatis
  { lat: 18.4, lon: 302.6, radiusDeg: 32, depth: -0.34, darkness: 0.43 }, // Oceanus Procellarum
  { lat: 17.0, lon: 59.1, radiusDeg: 9, depth: -0.26, darkness: 0.4 }, // Mare Crisium
  { lat: -21.3, lon: 343.4, radiusDeg: 13, depth: -0.24, darkness: 0.43 }, // Mare Nubium
  { lat: -7.8, lon: 51.3, radiusDeg: 12, depth: -0.22, darkness: 0.41 }, // Mare Fecunditatis
  { lat: -15.2, lon: 34.6, radiusDeg: 10, depth: -0.21, darkness: 0.42 }, // Mare Nectaris
  { lat: -53.0, lon: 191.0, radiusDeg: 38, depth: -0.45, darkness: 0.16 }, // South Pole-Aitken Basin
];

interface CraterFeature {
  ux: number;
  uy: number;
  uz: number;
  angRadiusRad: number;
  depth: number;
  rimHeight: number;
  hasRays: boolean;
}

function latLonToUnit(latDeg: number, lonDeg: number): [number, number, number] {
  const lat = (latDeg * Math.PI) / 180;
  const lon = (lonDeg * Math.PI) / 180;
  const cl = Math.cos(lat);
  return [cl * Math.sin(lon), Math.sin(lat), cl * Math.cos(lon)];
}

function buildCraterCatalog(): CraterFeature[] {
  const craters: CraterFeature[] = [];

  // Iconic real lunar craters + South Pole craters
  const namedCraters: Array<[number, number, number, number, number, boolean]> = [
    [-43.3, 348.8, 3.2, 0.38, 0.18, true], // Tycho
    [9.6, 340.0, 3.4, 0.36, 0.16, true], // Copernicus
    [23.7, 312.6, 2.2, 0.32, 0.16, true], // Aristarchus
    [8.1, 322.0, 1.8, 0.28, 0.14, true], // Kepler
    [-89.9, 130.0, 1.4, 0.42, 0.24, false], // Shackleton Crater
    [-88.5, 273.0, 1.8, 0.38, 0.19, false], // de Gerlache
    [-87.5, 355.0, 2.3, 0.4, 0.2, false], // Haworth
    [-88.1, 44.9, 2.2, 0.38, 0.18, false], // Shoemaker
    [-85.9, 0.45, 2.5, -0.1, 0.36, false], // Malapert Massif uplift
    [-84.9, 324.5, 3.1, 0.36, 0.17, false], // Cabeus
    [-85.2, 53.5, 2.7, 0.34, 0.16, false], // Nobile
    [-19.4, 267.2, 6.2, 0.46, 0.24, false], // Mare Orientale inner ring
  ];

  for (const [lat, lon, rDeg, depth, rim, rays] of namedCraters) {
    const [ux, uy, uz] = latLonToUnit(lat, lon);
    craters.push({
      ux,
      uy,
      uz,
      angRadiusRad: (rDeg * Math.PI) / 180,
      depth,
      rimHeight: rim,
      hasRays: rays,
    });
  }

  // Deterministic procedural impact crater field across the whole Moon (especially highlands & South Pole)
  let seed = 42197;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  for (let i = 0; i < 165; i++) {
    const u = rand() * 2 - 1;
    const theta = rand() * Math.PI * 2;
    const s = Math.sqrt(Math.max(0, 1 - u * u));
    const ux = s * Math.cos(theta);
    const uy = u;
    const uz = s * Math.sin(theta);
    // Bias smaller craters
    const rDeg = 1.1 + Math.pow(rand(), 2.2) * 7.5;
    craters.push({
      ux,
      uy,
      uz,
      angRadiusRad: (rDeg * Math.PI) / 180,
      depth: 0.16 + rand() * 0.24,
      rimHeight: 0.08 + rand() * 0.12,
      hasRays: false,
    });
  }

  return craters;
}

const CRATER_CATALOG = buildCraterCatalog();

const MARE_UNIT_CENTERS = MARE_BASINS.map((m) => ({
  ...m,
  unit: latLonToUnit(m.lat, m.lon),
  angRad: (m.radiusDeg * Math.PI) / 180,
}));

/**
 * Deterministic elevation + albedo sampler at unit sphere direction (ux, uy, uz).
 * Returns height in [-0.6, +0.6] km-scaled model units and albedo scalar in [0.18, 0.85].
 */
export function sampleMoonSurface(
  ux: number,
  uy: number,
  uz: number,
): { height: number; albedo: number; mareFactor: number } {
  const macro = fbm3D(ux * 2.4 + 3.1, uy * 2.4 + 1.7, uz * 2.4 - 2.2, 4);
  const mid = fbm3D(ux * 8.5 - 1.3, uy * 8.5 + 4.4, uz * 8.5 + 0.8, 4);
  const fine = fbm3D(ux * 24.0, uy * 24.0, uz * 24.0, 3);

  let height = (macro - 0.5) * 0.42 + (mid - 0.5) * 0.18 + (fine - 0.5) * 0.06;
  let mareFactor = 0;

  // Maria basins (smooth, dark basaltic plains)
  for (let i = 0; i < MARE_UNIT_CENTERS.length; i++) {
    const m = MARE_UNIT_CENTERS[i];
    const dot = THREE.MathUtils.clamp(
      ux * m.unit[0] + uy * m.unit[1] + uz * m.unit[2],
      -1,
      1,
    );
    const ang = Math.acos(dot);
    const warpedAng = ang / (m.angRad * (0.85 + 0.35 * macro));
    if (warpedAng < 1.35) {
      const t = 1 - smoothstep(THREE.MathUtils.clamp((warpedAng - 0.55) / 0.8, 0, 1));
      height += m.depth * t;
      mareFactor = Math.max(mareFactor, t * m.darkness);
    }
  }

  // Smooth terrain slightly inside maria
  height = lerp(height, height * 0.45 - 0.12, mareFactor * 1.4);

  let rayBrightness = 0;

  // Impact craters
  for (let i = 0; i < CRATER_CATALOG.length; i++) {
    const c = CRATER_CATALOG[i];
    const dx = ux - c.ux;
    const dy = uy - c.uy;
    const dz = uz - c.uz;
    const chordSq = dx * dx + dy * dy + dz * dz;
    const maxAngle = c.angRadiusRad * (c.hasRays ? 4.8 : 2.1);
    if (chordSq > maxAngle * maxAngle) continue;

    const ang = 2 * Math.asin(Math.min(1, Math.sqrt(chordSq) * 0.5));
    const r = ang / c.angRadiusRad;

    if (r < 1.9) {
      if (r < 0.85) {
        // Crater bowl
        const bowl = Math.cos((r / 0.85) * (Math.PI * 0.5));
        height -= c.depth * Math.pow(bowl, 1.35);
      }
      // Raised crater rim crest around r = 1.0
      const rimDist = Math.abs(r - 1.0);
      if (rimDist < 0.55) {
        const rim = Math.exp(-(rimDist * rimDist) / 0.065);
        height += c.rimHeight * rim;
        rayBrightness += rim * 0.12;
      }
    }

    if (c.hasRays && r >= 0.9 && r < 4.8) {
      const azNoise = noise3D(
        (ux - c.ux) * 32,
        (uy - c.uy) * 32,
        (uz - c.uz) * 32,
      );
      const streak = Math.pow(azNoise, 2.2) * (1 - (r - 0.9) / 3.9);
      rayBrightness += streak * 0.24;
    }
  }

  // Highlands anorthosite albedo vs basaltic mare albedo
  const baseAlbedo = 0.54 + (macro - 0.5) * 0.14 + (fine - 0.5) * 0.08;
  const mareAlbedo = baseAlbedo * (1 - mareFactor * 1.25);
  const albedo = THREE.MathUtils.clamp(mareAlbedo + rayBrightness, 0.16, 0.86);

  return { height, albedo, mareFactor };
}

export function sampleLunarElevationAtLatLon(
  latDeg: number,
  lonDeg: number,
): number {
  const [ux, uy, uz] = latLonToUnit(latDeg, lonDeg);
  return sampleMoonSurface(ux, uy, uz).height;
}

export interface LunarGlobeMaps {
  albedoMap: THREE.CanvasTexture;
  normalMap: THREE.DataTexture;
  roughnessMap: THREE.DataTexture;
  dispose: () => void;
}

export function createLunarGlobeMaps(maxAnisotropy: number): LunarGlobeMaps {
  const width = 1024;
  const height = 512;

  const heightGrid = new Float32Array(width * height);
  const albedoCanvas = document.createElement('canvas');
  albedoCanvas.width = width;
  albedoCanvas.height = height;
  const ctx = albedoCanvas.getContext('2d')!;
  const imgData = ctx.createImageData(width, height);
  const roughData = new Uint8Array(width * height * 4);

  for (let py = 0; py < height; py++) {
    // Three.js SphereGeometry UV: v=1 at top (+Y North Pole), canvas py=0 is top
    const v = 1 - py / (height - 1);
    const latDeg = (v - 0.5) * 180;
    const latRad = (latDeg * Math.PI) / 180;
    const cosLat = Math.cos(latRad);
    const sinLat = Math.sin(latRad);

    for (let px = 0; px < width; px++) {
      // SphereGeometry u=0.5 aligns with +X or -Z? Let's match exact Three.js SphereGeometry UV mapping:
      // In Three.js SphereGeometry, phi goes from 0..2PI; x = -r*cos(phi)*sin(theta), z = r*sin(phi)*sin(theta).
      // Wait: if we rotate the Moon mesh or sample directly from vertex positions, we don't even rely on Sphere UV seams for displacement!
      // For texture alignment with standard SphereGeometry: u = px / (width - 1), phi = u * 2 * PI
      // x = -cos(phi) * cosLat, z = sin(phi) * cosLat.
      // Let's align SphereGeometry by rotating mesh Y = -Math.PI / 2 or computing exact (ux, uy, uz) from phi:
      const u = px / (width - 1);
      const phi = u * Math.PI * 2;
      // Standard Three.js SphereGeometry direction at (u, v) when rotated -PI/2 around Y?
      // Wait: in Three.js SphereGeometry:
      // vertex.x = -radius * Math.cos(u * 2*PI) * Math.sin(v_theta)
      // vertex.y = radius * Math.cos(v_theta)
      // vertex.z = radius * Math.sin(u * 2*PI) * Math.sin(v_theta)
      // where v_theta = (1 - v) * PI = py/(height-1) * PI.
      // Let's use EXACTLY Three.js SphereGeometry's local unit vector (vx, vy, vz),
      // and then we rotate the Sphere mesh by Y = +Math.PI/2? Wait:
      // At lon=0 (+Z): we want (0, 0, 1). In SphereGeometry at u=0.25 (phi=PI/2): vx = 0, vz = +1!
      // At lon=90E (+X): we want (1, 0, 0). At u=0.5 (phi=PI): vx = +1, vz = 0!
      // YES!! Three.js SphereGeometry natively maps:
      // u = 0.25 -> (0, cosLat, +1*cosLat) = Prime Meridian (+Z)!
      // u = 0.50 -> (+1*cosLat, y, 0) = 90° East (+X)!
      // u = 0.75 -> (0, y, -1*cosLat) = 180° Far Side (-Z)!
      // u = 0.00 -> (-1*cosLat, y, 0) = 90° West (-X)!
      // Zero rotation needed — Three.js SphereGeometry natively matches our selenographic frame!
      const ux = -Math.cos(phi) * cosLat;
      const uy = sinLat;
      const uz = Math.sin(phi) * cosLat;

      const sample = sampleMoonSurface(ux, uy, uz);
      const idx = py * width + px;
      heightGrid[idx] = sample.height;

      // Subtle warm-cool regolith mineral tinting (titanium-rich maria slightly bluish-slate, highlands warm-neutral gray)
      const val = sample.albedo;
      const rCol = Math.round(
        THREE.MathUtils.clamp((val * 238 - sample.mareFactor * 16), 18, 245),
      );
      const gCol = Math.round(
        THREE.MathUtils.clamp((val * 236 - sample.mareFactor * 10), 18, 244),
      );
      const bCol = Math.round(
        THREE.MathUtils.clamp((val * 233 + sample.mareFactor * 6), 20, 242),
      );

      const p4 = idx * 4;
      imgData.data[p4] = rCol;
      imgData.data[p4 + 1] = gCol;
      imgData.data[p4 + 2] = bCol;
      imgData.data[p4 + 3] = 255;

      const rough = Math.round(
        THREE.MathUtils.clamp(228 - sample.mareFactor * 26, 175, 246),
      );
      const outP4 = ((height - 1 - py) * width + px) * 4;
      roughData[outP4] = rough;
      roughData[outP4 + 1] = rough;
      roughData[outP4 + 2] = rough;
      roughData[outP4 + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  const albedoMap = new THREE.CanvasTexture(albedoCanvas);
  albedoMap.colorSpace = THREE.SRGBColorSpace;
  albedoMap.wrapS = THREE.RepeatWrapping;
  albedoMap.wrapT = THREE.ClampToEdgeWrapping;
  albedoMap.anisotropy = maxAnisotropy;
  albedoMap.needsUpdate = true;

  // Tangent-space normal map from heightGrid (DataTexture uses flipY = false, so row 0 is v=0 South Pole)
  const normData = new Uint8Array(width * height * 4);
  const strength = 5.2;
  for (let py = 0; py < height; py++) {
    const pyNorth = Math.max(0, py - 1);
    const pySouth = Math.min(height - 1, py + 1);
    const outPy = height - 1 - py;
    for (let px = 0; px < width; px++) {
      const pxL = (px - 1 + width) % width;
      const pxR = (px + 1) % width;
      const hL = heightGrid[py * width + pxL];
      const hR = heightGrid[py * width + pxR];
      const hNorth = heightGrid[pyNorth * width + px];
      const hSouth = heightGrid[pySouth * width + px];

      const dx = (hL - hR) * strength;
      const dy = (hSouth - hNorth) * strength;
      const dz = 1.0;
      const invLen = 1 / Math.sqrt(dx * dx + dy * dy + dz * dz);

      const p4 = (outPy * width + px) * 4;
      normData[p4] = Math.round((dx * invLen * 0.5 + 0.5) * 255);
      normData[p4 + 1] = Math.round((dy * invLen * 0.5 + 0.5) * 255);
      normData[p4 + 2] = Math.round((dz * invLen * 0.5 + 0.5) * 255);
      normData[p4 + 3] = 255;
    }
  }

  const normalMap = new THREE.DataTexture(normData, width, height, THREE.RGBAFormat);
  normalMap.wrapS = THREE.RepeatWrapping;
  normalMap.wrapT = THREE.ClampToEdgeWrapping;
  normalMap.anisotropy = maxAnisotropy;
  normalMap.needsUpdate = true;

  const roughnessMap = new THREE.DataTexture(
    roughData,
    width,
    height,
    THREE.RGBAFormat,
  );
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.ClampToEdgeWrapping;
  roughnessMap.needsUpdate = true;

  return {
    albedoMap,
    normalMap,
    roughnessMap,
    dispose: () => {
      albedoMap.dispose();
      normalMap.dispose();
      roughnessMap.dispose();
    },
  };
}

export function createEarthGlobeMap(maxAnisotropy: number): THREE.CanvasTexture {
  const width = 512;
  const height = 256;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(width, height);

  for (let py = 0; py < height; py++) {
    const v = 1 - py / (height - 1);
    const lat = (v - 0.5) * Math.PI;
    const cl = Math.cos(lat);
    const sl = Math.sin(lat);
    for (let px = 0; px < width; px++) {
      const phi = (px / (width - 1)) * Math.PI * 2;
      const ux = -Math.cos(phi) * cl;
      const uy = sl;
      const uz = Math.sin(phi) * cl;

      const continent = fbm3D(ux * 2.1 + 7.2, uy * 2.1 - 1.4, uz * 2.1 + 3.5, 4);
      const clouds = fbm3D(ux * 4.8 - 2.1, uy * 4.8 + 5.1, uz * 4.8 - 0.7, 4);
      const polarIce = Math.abs(uy) > 0.84 + (continent - 0.5) * 0.12;

      let r = 18;
      let g = 58;
      let b = 122;

      if (polarIce) {
        r = 225;
        g = 235;
        b = 245;
      } else if (continent > 0.52) {
        const arid = THREE.MathUtils.clamp((continent - 0.52) * 3.5, 0, 1);
        r = Math.round(lerp(56, 152, arid));
        g = Math.round(lerp(96, 134, arid));
        b = Math.round(lerp(52, 92, arid));
      }

      const cloudAlpha = THREE.MathUtils.clamp((clouds - 0.52) * 2.4, 0, 0.85);
      r = Math.round(lerp(r, 242, cloudAlpha));
      g = Math.round(lerp(g, 247, cloudAlpha));
      b = Math.round(lerp(b, 252, cloudAlpha));

      const p4 = (py * width + px) * 4;
      img.data[p4] = r;
      img.data[p4 + 1] = g;
      img.data[p4 + 2] = b;
      img.data[p4 + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Local 12km x 12km crater-rim relief sampler for the 3D Local Terrain Inspector.
 * The lander is placed near the origin (0, 0) on an elevated connecting ridge / crater rim
 * overlooking a deep permanently shadowed crater bowl offset along ridgeAzimuthDeg.
 */
export function sampleLocalTerrainHeightKm(
  site: LunarSite,
  xKm: number,
  zKm: number,
): number {
  const { rimRadiusKm, bowlDepthKm, ridgeAzimuthDeg, roughnessScale, seed } =
    site.craterProfile;

  const azRad = (ridgeAzimuthDeg * Math.PI) / 180;
  // Offset primary crater center so the rim passes directly under (0, 0)
  const cx = Math.sin(azRad) * rimRadiusKm;
  const cz = Math.cos(azRad) * rimRadiusKm;

  const dx = xKm - cx;
  const dz = zKm - cz;
  const dist = Math.sqrt(dx * dx + dz * dz);
  const rNorm = dist / rimRadiusKm;

  let h = 0;

  // Deep crater bowl inside rNorm < 1, terraced crater wall, and elevated rim crest at rNorm = 1
  if (rNorm < 0.92) {
    const t = rNorm / 0.92;
    h -= bowlDepthKm * Math.pow(Math.cos(t * Math.PI * 0.5), 1.4);
  }
  const rimDist = Math.abs(rNorm - 1.0);
  h += 0.42 * Math.exp(-(rimDist * rimDist) / 0.085);

  // Connecting saddle ridge passing through (0, 0) perpendicular to crater vector
  const saddle = Math.exp(-(xKm * xKm + zKm * zKm) / 4.2) * 0.24;
  h += saddle;

  // Multi-scale regolith undulations & micro-craters
  const sOff = seed * 0.137;
  const macroNoise = fbm3D(xKm * 0.35 + sOff, 0.5, zKm * 0.35 - sOff, 4);
  const microNoise = fbm3D(xKm * 1.4 - sOff, 1.2, zKm * 1.4 + sOff, 3);
  h += (macroNoise - 0.5) * 0.42 * roughnessScale;
  h += (microNoise - 0.5) * 0.09 * roughnessScale;

  // Flatten immediate 220m landing ellipse pad at (0,0) slightly so lander sits realistically on a selectable pad
  const padDist = Math.sqrt(xKm * xKm + zKm * zKm);
  if (padDist < 0.45) {
    const blend = smoothstep(padDist / 0.45);
    const padTarget = 0.58;
    h = lerp(padTarget, h, blend);
  }

  return h;
}
