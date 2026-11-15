import * as THREE from 'three';

export interface LanderRig {
  group: THREE.Group;
  dishPivot: THREE.Group;
  solarPivot: THREE.Group;
  beaconRing: THREE.Mesh;
  dispose: () => void;
}

/**
 * Builds a composite 9-part procedural Artemis-class Lunar Lander / Beacon assembly.
 * Origin (0, 0, 0) sits flush at the bottom of the 4 landing footpads.
 */
export function createLunarLanderRig(): LanderRig {
  const group = new THREE.Group();
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    materials.push(m);
    return m;
  };

  // Calibrated PBR material hierarchy (roughness varies >= 0.25 across adjacent parts)
  const thermalCeramicMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xe6eaf0,
      roughness: 0.72,
      metalness: 0.12,
    }),
  );

  const kaptonGoldMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xd99b2e,
      metalness: 0.92,
      roughness: 0.22,
      anisotropy: 0.75,
      clearcoat: 0.2,
    }),
  );

  const titaniumStrutMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x8e99a8,
      metalness: 0.85,
      roughness: 0.32,
    }),
  );

  const carbonNozzleMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x1e242e,
      metalness: 0.55,
      roughness: 0.58,
    }),
  );

  const solarCellMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x132b4f,
      metalness: 0.65,
      roughness: 0.16,
      clearcoat: 0.6,
    }),
  );

  const viewportGlassMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x0b1626,
      metalness: 0.1,
      roughness: 0.08,
      clearcoat: 1.0,
    }),
  );

  // 1. Surface Landing Pad Marker Ring (polygonOffset prevents z-fighting)
  const ringGeo = trackGeo(new THREE.RingGeometry(0.95, 1.08, 48));
  ringGeo.rotateX(-Math.PI / 2);
  const ringMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.72,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    }),
  );
  const beaconRing = new THREE.Mesh(ringGeo, ringMat);
  beaconRing.position.y = 0.015;
  group.add(beaconRing);

  // 2. 4 Articulated Landing Struts & Footpads grounded at y = 0
  const padGeo = trackGeo(new THREE.CylinderGeometry(0.14, 0.17, 0.04, 16));
  const legGeo = trackGeo(new THREE.CylinderGeometry(0.032, 0.036, 0.72, 10));
  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI) / 2 + Math.PI / 4;
    const padX = Math.cos(angle) * 0.68;
    const padZ = Math.sin(angle) * 0.68;

    const pad = new THREE.Mesh(padGeo, titaniumStrutMat);
    pad.position.set(padX, 0.02, padZ);
    pad.castShadow = true;
    pad.receiveShadow = true;
    group.add(pad);

    const leg = new THREE.Mesh(legGeo, titaniumStrutMat);
    leg.position.set(padX * 0.72, 0.34, padZ * 0.72);
    leg.lookAt(padX * 0.45, 0.64, padZ * 0.45);
    leg.rotateX(Math.PI / 2);
    leg.castShadow = true;
    group.add(leg);
  }

  // 3. Descent Engine Nozzle Bell (LatheGeometry)
  const bellPoints = [
    new THREE.Vector2(0.08, 0.44),
    new THREE.Vector2(0.11, 0.34),
    new THREE.Vector2(0.18, 0.2),
    new THREE.Vector2(0.22, 0.12),
  ];
  const bellGeo = trackGeo(new THREE.LatheGeometry(bellPoints, 20));
  const bell = new THREE.Mesh(bellGeo, carbonNozzleMat);
  bell.castShadow = true;
  group.add(bell);

  // 4. Octagonal Descent Stage Chassis (Kapton Gold MLI Lower Body)
  const descentGeo = trackGeo(new THREE.CylinderGeometry(0.48, 0.52, 0.38, 8));
  const descentStage = new THREE.Mesh(descentGeo, kaptonGoldMat);
  descentStage.position.y = 0.62;
  descentStage.castShadow = true;
  descentStage.receiveShadow = true;
  group.add(descentStage);

  // 5. Structural Equipment Collar Ring
  const collarGeo = trackGeo(new THREE.CylinderGeometry(0.45, 0.5, 0.08, 8));
  const collar = new THREE.Mesh(collarGeo, titaniumStrutMat);
  collar.position.y = 0.85;
  collar.castShadow = true;
  group.add(collar);

  // 6. Upper Crew / Instrument Ascent Module
  const ascentGeo = trackGeo(new THREE.CylinderGeometry(0.32, 0.4, 0.48, 8));
  const ascentStage = new THREE.Mesh(ascentGeo, thermalCeramicMat);
  ascentStage.position.y = 1.13;
  ascentStage.castShadow = true;
  ascentStage.receiveShadow = true;
  group.add(ascentStage);

  // 7. Optical Navigation Window Housing
  const visorGeo = trackGeo(new THREE.BoxGeometry(0.24, 0.14, 0.08));
  const visor = new THREE.Mesh(visorGeo, viewportGlassMat);
  visor.position.set(0, 1.18, 0.35);
  group.add(visor);

  // 8. Gimbaled High-Gain Parabolic Dish (rotates toward Earth)
  const dishPivot = new THREE.Group();
  dishPivot.position.set(-0.24, 1.42, 0.08);
  const mastGeo = trackGeo(new THREE.CylinderGeometry(0.022, 0.025, 0.18, 8));
  const dishMast = new THREE.Mesh(mastGeo, titaniumStrutMat);
  dishMast.position.y = 0.06;
  dishPivot.add(dishMast);

  const dishPoints = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.08, 0.018),
    new THREE.Vector2(0.16, 0.055),
    new THREE.Vector2(0.22, 0.105),
  ];
  const dishGeo = trackGeo(new THREE.LatheGeometry(dishPoints, 20));
  dishGeo.rotateX(Math.PI / 2); // Point dish bowl along +Z of dishPivot
  const dishMesh = new THREE.Mesh(dishGeo, thermalCeramicMat);
  dishMesh.position.y = 0.16;
  dishMesh.castShadow = true;
  dishPivot.add(dishMesh);

  const feedGeo = trackGeo(new THREE.CylinderGeometry(0.012, 0.018, 0.12, 8));
  feedGeo.rotateX(Math.PI / 2);
  const feed = new THREE.Mesh(feedGeo, titaniumStrutMat);
  feed.position.set(0, 0.16, 0.08);
  dishPivot.add(feed);
  group.add(dishPivot);

  // 9. Vertical Solar Array Mast & Wing (tracks Sun azimuth)
  const solarPivot = new THREE.Group();
  solarPivot.position.set(0.26, 1.42, -0.06);
  const solarMastGeo = trackGeo(new THREE.CylinderGeometry(0.02, 0.02, 0.34, 8));
  const solarMast = new THREE.Mesh(solarMastGeo, titaniumStrutMat);
  solarMast.position.y = 0.17;
  solarPivot.add(solarMast);

  const panelGeo = trackGeo(new THREE.BoxGeometry(0.48, 0.24, 0.02));
  const solarPanel = new THREE.Mesh(panelGeo, solarCellMat);
  solarPanel.position.y = 0.36;
  solarPanel.castShadow = true;
  solarPivot.add(solarPanel);
  group.add(solarPivot);

  return {
    group,
    dishPivot,
    solarPivot,
    beaconRing,
    dispose: () => {
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
    },
  };
}
