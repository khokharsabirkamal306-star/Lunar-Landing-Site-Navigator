export interface LunarSite {
  id: string;
  name: string;
  regionLabel: string;
  latDeg: number; // Negative for South Pole (-90 to 0)
  lonDeg: number; // East longitude 0..360
  elevationKm: number; // Above 1737.4 km reference sphere
  meanSlopeDeg: number;
  maxReliefM: number;
  horizonMaskDeg: number; // Local terrain horizon obstruction angle
  accentHex: string;
  geologySummary: string;
  craterProfile: {
    rimRadiusKm: number;
    bowlDepthKm: number;
    ridgeAzimuthDeg: number;
    roughnessScale: number;
    seed: number;
  };
}

export const LUNAR_RADIUS_KM = 1737.4;

export const LUNAR_SITES: LunarSite[] = [
  {
    id: 'shackleton-ridge',
    name: 'Shackleton Connecting Ridge',
    regionLabel: 'Shackleton–de Gerlache Saddle',
    latDeg: -89.62,
    lonDeg: 131.4,
    elevationKm: 2.14,
    meanSlopeDeg: 6.4,
    maxReliefM: 185,
    horizonMaskDeg: 0.9,
    accentHex: '#38BDF8',
    geologySummary:
      'Elevated anorthositic ridge linking Shackleton and de Gerlache craters, combining broad solar persistence with shallow traverse grades toward adjacent PSR floors.',
    craterProfile: {
      rimRadiusKm: 3.4,
      bowlDepthKm: 1.45,
      ridgeAzimuthDeg: 42,
      roughnessScale: 0.85,
      seed: 101,
    },
  },
  {
    id: 'malapert-massif',
    name: 'Malapert Massif',
    regionLabel: 'Malapert Mountain Summit Plateau',
    latDeg: -85.96,
    lonDeg: 0.45,
    elevationKm: 4.92,
    meanSlopeDeg: 7.8,
    maxReliefM: 240,
    horizonMaskDeg: 0.4,
    accentHex: '#F59E0B',
    geologySummary:
      'High-relief Earth-facing massif nearly aligned with the lunar prime meridian. Elevated 4.9 km summit maintains uninterrupted direct-to-Earth line-of-sight across libration.',
    craterProfile: {
      rimRadiusKm: 4.1,
      bowlDepthKm: 1.15,
      ridgeAzimuthDeg: 0,
      roughnessScale: 0.95,
      seed: 204,
    },
  },
  {
    id: 'de-gerlache-rim',
    name: 'de Gerlache Rim 2',
    regionLabel: 'de Gerlache Eastern Rim',
    latDeg: -88.48,
    lonDeg: 283.6,
    elevationKm: 1.62,
    meanSlopeDeg: 9.2,
    maxReliefM: 215,
    horizonMaskDeg: 1.4,
    accentHex: '#34D399',
    geologySummary:
      'Terraced polar crater rim bordering cold-trap ejecta blankets. Steep inner crater wall requires targeted descent corridor selection to avoid >15° boulder fields.',
    craterProfile: {
      rimRadiusKm: 3.1,
      bowlDepthKm: 1.65,
      ridgeAzimuthDeg: 295,
      roughnessScale: 1.1,
      seed: 307,
    },
  },
  {
    id: 'haworth-rim',
    name: 'Haworth Rim',
    regionLabel: 'Haworth–Shoemaker Massif',
    latDeg: -87.45,
    lonDeg: 354.8,
    elevationKm: 0.84,
    meanSlopeDeg: 11.5,
    maxReliefM: 320,
    horizonMaskDeg: 2.1,
    accentHex: '#FB7185',
    geologySummary:
      'Rugged rim sector overlooking the Haworth permanently shadowed basin. Offers proximity to hydrogen-bearing cold traps at the cost of steeper local slopes and horizon masking.',
    craterProfile: {
      rimRadiusKm: 2.9,
      bowlDepthKm: 1.95,
      ridgeAzimuthDeg: 340,
      roughnessScale: 1.32,
      seed: 419,
    },
  },
  {
    id: 'nobile-rim',
    name: 'Nobile Rim 1',
    regionLabel: 'Nobile Western Rim',
    latDeg: -85.2,
    lonDeg: 53.5,
    elevationKm: 1.88,
    meanSlopeDeg: 8.1,
    maxReliefM: 195,
    horizonMaskDeg: 1.2,
    accentHex: '#A78BFA',
    geologySummary:
      'Broad plateau overlooking the Nobile impact structure. Provides wide hazard-avoidance landing ellipses and access to older highlands regolith stratigraphy.',
    craterProfile: {
      rimRadiusKm: 3.8,
      bowlDepthKm: 1.35,
      ridgeAzimuthDeg: 65,
      roughnessScale: 0.9,
      seed: 523,
    },
  },
  {
    id: 'leibnitz-beta',
    name: 'Leibnitz Beta Plateau',
    regionLabel: 'Leibnitz Rim Spur',
    latDeg: -85.42,
    lonDeg: 31.2,
    elevationKm: 3.45,
    meanSlopeDeg: 7.1,
    maxReliefM: 165,
    horizonMaskDeg: 0.8,
    accentHex: '#FBBF24',
    geologySummary:
      'High-elevation spur on the Leibnitz crater complex rim. Combines moderate regional slopes with favorable geometry for both solar array tracking and Earth relay.',
    craterProfile: {
      rimRadiusKm: 4.3,
      bowlDepthKm: 1.25,
      ridgeAzimuthDeg: 28,
      roughnessScale: 0.78,
      seed: 631,
    },
  },
];
