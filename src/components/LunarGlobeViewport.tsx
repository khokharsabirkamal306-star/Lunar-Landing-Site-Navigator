import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { LUNAR_SITES, LunarSite } from '../data/lunarSites';
import {
  LunarEphemerisState,
  SiteAssessment,
  selenographicToVector3,
} from '../utils/lunarEphemeris';
import {
  createEarthGlobeMap,
  createLunarGlobeMaps,
  sampleLunarElevationAtLatLon,
  sampleMoonSurface,
} from '../three/lunarTextures';
import { createLunarLanderRig } from '../three/landerModel';
import { createStarfield, detectSoftwareWebGL } from '../three/webglUtils';

export type CameraPreset = 'south-pole' | 'orbital' | 'surface-rim' | 'earth-view';

interface LunarGlobeViewportProps {
  sites: LunarSite[];
  selectedSiteId: string;
  onSelectSite: (siteId: string) => void;
  ephemeris: LunarEphemerisState;
  assessments: Record<string, SiteAssessment>;
  cameraPreset: CameraPreset;
  presetTrigger: number;
  showGraticule: boolean;
  showVectors: boolean;
  showMarkers: boolean;
  isPlaying: boolean;
}

const MOON_RADIUS = 10;
const RELIEF_SCALE = 0.28;
const _up = new THREE.Vector3(0, 1, 0);
const _tmpVec = new THREE.Vector3();
const _tmpVec2 = new THREE.Vector3();
const _tmpQuat = new THREE.Quaternion();

export const LunarGlobeViewport: React.FC<LunarGlobeViewportProps> = ({
  sites,
  selectedSiteId,
  onSelectSite,
  ephemeris,
  assessments,
  cameraPreset,
  presetTrigger,
  showGraticule,
  showVectors,
  showMarkers,
  isPlaying,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [contextLost, setContextLost] = useState(false);
  const [hoveredSite, setHoveredSite] = useState<{
    site: LunarSite;
    x: number;
    y: number;
  } | null>(null);

  const onSelectSiteRef = useRef(onSelectSite);
  onSelectSiteRef.current = onSelectSite;
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;

  // Imperative scene handle for updating ephemeris, site selection, and camera without recreating WebGL context
  const sceneApiRef = useRef<{
    updateEphemeris: (eph: LunarEphemerisState) => void;
    updateSelection: (siteId: string) => void;
    updateVisibility: (graticule: boolean, vectors: boolean, markers: boolean) => void;
    flyToPreset: (preset: CameraPreset, siteId: string, eph: LunarEphemerisState) => void;
    requestRender: () => void;
  } | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareWebGL();
    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.setPixelRatio(
      isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2),
    );
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    renderer.setSize(width, height);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    container.appendChild(renderer.domElement);

    const onLost = (e: Event) => {
      e.preventDefault();
      setContextLost(true);
    };
    const onRestored = () => {
      setContextLost(false);
    };
    renderer.domElement.addEventListener('webglcontextlost', onLost);
    renderer.domElement.addEventListener('webglcontextrestored', onRestored);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x04070d);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    scene.environmentIntensity = 0.16;
    pmrem.dispose();

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.05, 600);
    camera.position.set(1.2, -20.5, 4.8);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.minDistance = 11.15;
    controls.maxDistance = 42;
    controls.enablePan = false;
    controls.target.set(0, -9.2, 0);
    controls.update();

    // Starfield
    const stars = createStarfield(2400, 260);
    scene.add(stars.points);

    // Lighting rig: Sun key light + Earthshine cool hemisphere + subtle limb fill
    const sunLight = new THREE.DirectionalLight(0xfff7ea, 3.15);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 75;
    const d = 11.5;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.bias = -0.0004;
    sunLight.shadow.normalBias = 0.02;
    scene.add(sunLight);

    const earthshineHemi = new THREE.HemisphereLight(0x406ca8, 0x0a0d14, 0.24);
    scene.add(earthshineHemi);

    const rimFill = new THREE.DirectionalLight(0x5274a8, 0.22);
    rimFill.position.set(-18, 12, -20);
    scene.add(rimFill);

    // High-detail displaced Moon Globe
    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const moonMaps = createLunarGlobeMaps(maxAniso);
    const moonGeo = new THREE.SphereGeometry(MOON_RADIUS, 160, 120);
    const posAttr = moonGeo.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const vx = posAttr.getX(i);
      const vy = posAttr.getY(i);
      const vz = posAttr.getZ(i);
      const len = Math.sqrt(vx * vx + vy * vy + vz * vz) || 1;
      const ux = vx / len;
      const uy = vy / len;
      const uz = vz / len;
      const { height: h } = sampleMoonSurface(ux, uy, uz);
      const r = MOON_RADIUS + h * RELIEF_SCALE;
      posAttr.setXYZ(i, ux * r, uy * r, uz * r);
    }
    posAttr.needsUpdate = true;
    moonGeo.computeVertexNormals();
    moonGeo.computeBoundingSphere();

    const moonMat = new THREE.MeshStandardMaterial({
      map: moonMaps.albedoMap,
      normalMap: moonMaps.normalMap,
      normalScale: new THREE.Vector2(1.4, 1.4),
      roughnessMap: moonMaps.roughnessMap,
      roughness: 0.94,
      metalness: 0.03,
      envMapIntensity: 0.22,
    });
    const moonMesh = new THREE.Mesh(moonGeo, moonMat);
    moonMesh.castShadow = true;
    moonMesh.receiveShadow = true;
    scene.add(moonMesh);

    // Selenographic Polar Graticule Group
    const graticuleGroup = new THREE.Group();
    const gratMat = new THREE.LineBasicMaterial({
      color: 0x64748b,
      transparent: true,
      opacity: 0.28,
    });
    const gratAccentMat = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.38,
    });
    const gratGeos: THREE.BufferGeometry[] = [];

    const addLatCircle = (latDeg: number, accent = false) => {
      const pts: THREE.Vector3[] = [];
      for (let lon = 0; lon <= 360; lon += 4) {
        pts.push(selenographicToVector3(latDeg, lon, MOON_RADIUS + 0.16));
      }
      const g = new THREE.BufferGeometry().setFromPoints(pts);
      gratGeos.push(g);
      graticuleGroup.add(new THREE.Line(g, accent ? gratAccentMat : gratMat));
    };
    [-85, -80, -70, -45, 0, 45].forEach((lat) => addLatCircle(lat, lat === -85 || lat === 0));

    for (let lon = 0; lon < 360; lon += 30) {
      const pts: THREE.Vector3[] = [];
      for (let lat = -90; lat <= 90; lat += 4) {
        pts.push(selenographicToVector3(lat, lon, MOON_RADIUS + 0.16));
      }
      const g = new THREE.BufferGeometry().setFromPoints(pts);
      gratGeos.push(g);
      graticuleGroup.add(new THREE.Line(g, lon === 0 ? gratAccentMat : gratMat));
    }
    scene.add(graticuleGroup);

    // Distant Earth Globe along real optical libration vector
    const earthTex = createEarthGlobeMap(maxAniso);
    const earthGeo = new THREE.SphereGeometry(2.5, 48, 32);
    const earthMat = new THREE.MeshStandardMaterial({
      map: earthTex,
      roughness: 0.72,
      metalness: 0.05,
      emissive: new THREE.Color(0x0b1f3a),
      emissiveIntensity: 0.35,
    });
    const earthMesh = new THREE.Mesh(earthGeo, earthMat);
    scene.add(earthMesh);

    const earthHaloGeo = new THREE.SphereGeometry(2.68, 36, 24);
    const earthHaloMat = new THREE.MeshBasicMaterial({
      color: 0x60a5fa,
      transparent: true,
      opacity: 0.16,
      side: THREE.BackSide,
      depthWrite: false,
    });
    const earthHalo = new THREE.Mesh(earthHaloGeo, earthHaloMat);
    earthMesh.add(earthHalo);

    // Vectors Group (Sun incidence ray + Earth Line-of-Sight ray from active site)
    const vectorsGroup = new THREE.Group();
    const sunRayGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(),
      new THREE.Vector3(0, 1, 0),
    ]);
    const sunRayMat = new THREE.LineBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.85,
    });
    const sunRayLine = new THREE.Line(sunRayGeo, sunRayMat);
    vectorsGroup.add(sunRayLine);

    const earthRayGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(),
      new THREE.Vector3(0, 0, 1),
    ]);
    const earthRayMat = new THREE.LineDashedMaterial({
      color: 0x38bdf8,
      dashSize: 0.6,
      gapSize: 0.35,
      transparent: true,
      opacity: 0.82,
    });
    const earthRayLine = new THREE.Line(earthRayGeo, earthRayMat);
    vectorsGroup.add(earthRayLine);
    scene.add(vectorsGroup);

    // Landing Site Markers + Lander Rig
    const markersGroup = new THREE.Group();
    const lander = createLunarLanderRig();
    lander.group.scale.setScalar(0.24);
    markersGroup.add(lander.group);

    const markerEntries: Array<{
      site: LunarSite;
      root: THREE.Group;
      surfacePos: THREE.Vector3;
      normal: THREE.Vector3;
      beaconMesh: THREE.Mesh;
      ringMesh: THREE.Mesh;
      hitProxy: THREE.Mesh;
    }> = [];

    const pinGeo = new THREE.CylinderGeometry(0.018, 0.025, 0.38, 10);
    const headGeo = new THREE.SphereGeometry(0.085, 16, 16);
    const ringGeo = new THREE.RingGeometry(0.16, 0.22, 32);
    ringGeo.rotateX(-Math.PI / 2);
    const hitGeo = new THREE.SphereGeometry(0.45, 10, 10);
    const hitMat = new THREE.MeshBasicMaterial({ visible: false });
    const markerMaterials: THREE.Material[] = [hitMat];

    for (const site of sites) {
      const h = sampleLunarElevationAtLatLon(site.latDeg, site.lonDeg);
      const surfaceR = MOON_RADIUS + h * RELIEF_SCALE;
      const surfacePos = selenographicToVector3(site.latDeg, site.lonDeg, surfaceR);
      const normal = surfacePos.clone().normalize();

      const root = new THREE.Group();
      root.position.copy(surfacePos);
      root.quaternion.setFromUnitVectors(_up, normal);

      const accent = new THREE.Color(site.accentHex);
      const pinMat = new THREE.MeshStandardMaterial({
        color: 0xdbeafe,
        metalness: 0.8,
        roughness: 0.3,
      });
      const headMat = new THREE.MeshStandardMaterial({
        color: accent,
        emissive: accent,
        emissiveIntensity: 0.55,
        roughness: 0.3,
      });
      const rMat = new THREE.MeshBasicMaterial({
        color: accent,
        transparent: true,
        opacity: 0.78,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      });
      markerMaterials.push(pinMat, headMat, rMat);

      const pin = new THREE.Mesh(pinGeo, pinMat);
      pin.position.y = 0.19;
      root.add(pin);

      const beaconMesh = new THREE.Mesh(headGeo, headMat);
      beaconMesh.position.y = 0.4;
      root.add(beaconMesh);

      const ringMesh = new THREE.Mesh(ringGeo, rMat);
      ringMesh.position.y = 0.015;
      root.add(ringMesh);

      const hitProxy = new THREE.Mesh(hitGeo, hitMat);
      hitProxy.position.y = 0.22;
      hitProxy.layers.set(1);
      hitProxy.userData.site = site;
      root.add(hitProxy);

      markersGroup.add(root);
      markerEntries.push({
        site,
        root,
        surfacePos,
        normal,
        beaconMesh,
        ringMesh,
        hitProxy,
      });
    }
    scene.add(markersGroup);

    // Pre-compile shaders on hardware GPUs
    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Camera transition state
    let tweenActive = false;
    const camGoalPos = new THREE.Vector3().copy(camera.position);
    const camGoalTarget = new THREE.Vector3().copy(controls.target);

    controls.addEventListener('start', () => {
      tweenActive = false;
    });

    // Raycasting on layer 1 for fast site picking
    const raycaster = new THREE.Raycaster();
    raycaster.layers.set(1);
    const pointer = new THREE.Vector2();
    let pointerDownPos = { x: 0, y: 0 };
    let lastMoveCheck = 0;

    const hitProxies = markerEntries.map((m) => m.hitProxy);

    const onPointerDown = (e: PointerEvent) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
    };

    const onPointerUp = (e: PointerEvent) => {
      const dist = Math.hypot(
        e.clientX - pointerDownPos.x,
        e.clientY - pointerDownPos.y,
      );
      if (dist > 6) return; // Ignore orbit drag
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(hitProxies, false);
      if (hits.length > 0) {
        const site = hits[0].object.userData.site as LunarSite | undefined;
        if (site) onSelectSiteRef.current(site.id);
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      const now = performance.now();
      if (now - lastMoveCheck < 45) return;
      lastMoveCheck = now;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(hitProxies, false);
      if (hits.length > 0) {
        const site = hits[0].object.userData.site as LunarSite | undefined;
        if (site) {
          renderer.domElement.style.cursor = 'pointer';
          setHoveredSite({
            site,
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
          });
          return;
        }
      }
      renderer.domElement.style.cursor = 'grab';
      setHoveredSite(null);
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointermove', onPointerMove);

    // Coalesced render-on-demand + software WebGL fence sync pacing
    let frameId = 0;
    let renderBusy = false;
    let renderDirty = false;
    let disposed = false;
    let lastClock = performance.now();

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (!gl || typeof gl.fenceSync !== 'function') {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) {
          if (sync) gl.deleteSync(sync);
          return;
        }
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    const requestRender = () => {
      if (disposed) return;
      if (renderBusy) {
        renderDirty = true;
        return;
      }
      renderBusy = true;
      frameId = requestAnimationFrame(() => {
        if (disposed) return;
        renderDirty = false;
        const now = performance.now();
        const delta = Math.min((now - lastClock) / 1000, 0.1);
        lastClock = now;

        let needsMoreFrames = false;

        if (tweenActive) {
          const factor = 1 - Math.exp(-5.5 * delta);
          camera.position.lerp(camGoalPos, factor);
          controls.target.lerp(camGoalTarget, factor);
          if (
            camera.position.distanceToSquared(camGoalPos) < 0.0004 &&
            controls.target.distanceToSquared(camGoalTarget) < 0.0004
          ) {
            camera.position.copy(camGoalPos);
            controls.target.copy(camGoalTarget);
            tweenActive = false;
          } else {
            needsMoreFrames = true;
          }
        }

        const moved = controls.update();
        if (moved && controls.enableDamping) {
          needsMoreFrames = true;
        }

        renderer.render(scene, camera);

        const done = () => {
          renderBusy = false;
          if (renderDirty || needsMoreFrames || isPlayingRef.current) {
            requestRender();
          }
        };
        if (isSoftwareGl) {
          afterDraw(done);
        } else {
          done();
        }
      });
    };

    controls.addEventListener('change', requestRender);

    // Track current state inside API handlers
    let currentSiteId = selectedSiteId;
    let currentEph = ephemeris;

    const updateVectorsAndLander = () => {
      const activeEntry =
        markerEntries.find((m) => m.site.id === currentSiteId) || markerEntries[0];
      if (!activeEntry) return;

      // Orient & place full 3D Lander on active site
      lander.group.position.copy(activeEntry.surfacePos);
      lander.group.quaternion.setFromUnitVectors(_up, activeEntry.normal);

      // Update Sun ray & Earth ray originating from active site
      const sunEnd = _tmpVec
        .copy(activeEntry.surfacePos)
        .addScaledVector(currentEph.sunDirSelenographic, 7.5);
      const sunAttr = sunRayLine.geometry.attributes.position as THREE.BufferAttribute;
      sunAttr.setXYZ(
        0,
        activeEntry.surfacePos.x,
        activeEntry.surfacePos.y,
        activeEntry.surfacePos.z,
      );
      sunAttr.setXYZ(1, sunEnd.x, sunEnd.y, sunEnd.z);
      sunAttr.needsUpdate = true;

      const earthPos = earthMesh.position;
      const earthAttr = earthRayLine.geometry.attributes
        .position as THREE.BufferAttribute;
      earthAttr.setXYZ(
        0,
        activeEntry.surfacePos.x,
        activeEntry.surfacePos.y,
        activeEntry.surfacePos.z,
      );
      earthAttr.setXYZ(1, earthPos.x, earthPos.y, earthPos.z);
      earthAttr.needsUpdate = true;
      earthRayLine.computeLineDistances();

      // Rotate lander dish toward Earth and solar wing toward Sun in local coordinates
      const invLanderQuat = _tmpQuat.copy(lander.group.quaternion).invert();
      const localSun = _tmpVec
        .copy(currentEph.sunDirSelenographic)
        .applyQuaternion(invLanderQuat);
      lander.solarPivot.rotation.y = Math.atan2(localSun.x, localSun.z);

      const localEarth = _tmpVec2
        .copy(currentEph.earthDirSelenographic)
        .applyQuaternion(invLanderQuat);
      lander.dishPivot.rotation.y = Math.atan2(localEarth.x, localEarth.z);
    };

    const updateEphemeris = (eph: LunarEphemerisState) => {
      currentEph = eph;
      sunLight.position.copy(eph.sunDirSelenographic).multiplyScalar(48);
      earthMesh.position.copy(eph.earthDirSelenographic).multiplyScalar(78);
      earthMesh.lookAt(0, 0, 0);
      updateVectorsAndLander();
      requestRender();
    };

    const updateSelection = (siteId: string) => {
      currentSiteId = siteId;
      for (const entry of markerEntries) {
        const active = entry.site.id === siteId;
        entry.beaconMesh.scale.setScalar(active ? 1.45 : 0.9);
        entry.ringMesh.scale.setScalar(active ? 1.6 : 1.0);
        // Hide simple pin on active site since full 3D Lander occupies the pad
        entry.beaconMesh.visible = !active;
      }
      updateVectorsAndLander();
      requestRender();
    };

    const updateVisibility = (
      graticule: boolean,
      vectors: boolean,
      markers: boolean,
    ) => {
      graticuleGroup.visible = graticule;
      vectorsGroup.visible = vectors;
      markersGroup.visible = markers;
      requestRender();
    };

    const flyToPreset = (
      preset: CameraPreset,
      siteId: string,
      eph: LunarEphemerisState,
    ) => {
      const entry =
        markerEntries.find((m) => m.site.id === siteId) || markerEntries[0];
      if (!entry) return;

      if (preset === 'south-pole') {
        camGoalTarget.set(0, -9.2, 0);
        camGoalPos.set(0.8, -20.8, 5.2);
      } else if (preset === 'orbital') {
        camGoalTarget.set(0, -1.6, 0);
        camGoalPos.set(13.5, -13.0, 20.5);
      } else if (preset === 'surface-rim') {
        camGoalTarget.copy(entry.surfacePos).addScaledVector(entry.normal, 0.28);
        const tangent = new THREE.Vector3(1, 0, 0)
          .cross(entry.normal)
          .normalize();
        if (tangent.lengthSq() < 0.01) tangent.set(0, 0, 1);
        camGoalPos
          .copy(entry.surfacePos)
          .addScaledVector(entry.normal, 1.55)
          .addScaledVector(tangent, 2.25);
      } else if (preset === 'earth-view') {
        camGoalTarget.copy(entry.surfacePos).addScaledVector(eph.earthDirSelenographic, 3.0);
        camGoalPos
          .copy(entry.surfacePos)
          .addScaledVector(entry.normal, 0.95)
          .addScaledVector(eph.earthDirSelenographic, -2.4);
      }

      tweenActive = true;
      requestRender();
    };

    sceneApiRef.current = {
      updateEphemeris,
      updateSelection,
      updateVisibility,
      flyToPreset,
      requestRender,
    };

    // Initial state sync
    updateEphemeris(ephemeris);
    updateSelection(selectedSiteId);
    updateVisibility(showGraticule, showVectors, showMarkers);
    flyToPreset(cameraPreset, selectedSiteId, ephemeris);

    const onResize = () => {
      if (!container || disposed) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      requestRender();
    };
    window.addEventListener('resize', onResize);

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', onResize);
      controls.removeEventListener('change', requestRender);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('webglcontextlost', onLost);
      renderer.domElement.removeEventListener('webglcontextrestored', onRestored);
      controls.dispose();
      stars.dispose();
      moonMaps.dispose();
      moonGeo.dispose();
      moonMat.dispose();
      earthTex.dispose();
      earthGeo.dispose();
      earthMat.dispose();
      earthHaloGeo.dispose();
      earthHaloMat.dispose();
      sunRayGeo.dispose();
      sunRayMat.dispose();
      earthRayGeo.dispose();
      earthRayMat.dispose();
      gratGeos.forEach((g) => g.dispose());
      gratMat.dispose();
      gratAccentMat.dispose();
      pinGeo.dispose();
      headGeo.dispose();
      ringGeo.dispose();
      hitGeo.dispose();
      markerMaterials.forEach((m) => m.dispose());
      lander.dispose();
      envTex.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
      sceneApiRef.current = null;
    };
    // Mount WebGL canvas once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reactive updates pushed cleanly into WebGL without tearing down canvas
  useEffect(() => {
    sceneApiRef.current?.updateEphemeris(ephemeris);
  }, [ephemeris]);

  useEffect(() => {
    sceneApiRef.current?.updateSelection(selectedSiteId);
  }, [selectedSiteId]);

  useEffect(() => {
    sceneApiRef.current?.updateVisibility(showGraticule, showVectors, showMarkers);
  }, [showGraticule, showVectors, showMarkers]);

  useEffect(() => {
    sceneApiRef.current?.flyToPreset(cameraPreset, selectedSiteId, ephemeris);
    // Only trigger camera flight when preset or trigger increments, or site changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraPreset, presetTrigger, selectedSiteId]);

  const hoveredAssessment = hoveredSite ? assessments[hoveredSite.site.id] : null;

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#04070D]">
      <div
        ref={containerRef}
        className="w-full h-full"
        aria-label="Interactive 3D Lunar South Pole and Globe Viewport"
      />

      {contextLost && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#06090F] text-slate-300 text-sm">
          WebGL rendering context suspended. Restoring lunar terrain viewport...
        </div>
      )}

      {hoveredSite && hoveredAssessment && (
        <div
          className="pointer-events-none absolute z-20 px-3 py-2 bg-[#0B111C] border border-slate-700/80 rounded-md shadow-lg text-xs"
          style={{
            left: Math.min(hoveredSite.x + 14, (containerRef.current?.clientWidth || 800) - 220),
            top: Math.max(hoveredSite.y - 54, 12),
          }}
        >
          <div className="font-medium text-slate-100">{hoveredSite.site.name}</div>
          <div className="font-mono-tabular text-slate-400 mt-0.5">
            Sun {hoveredAssessment.effectiveSunElevationDeg >= 0 ? '+' : ''}
            {hoveredAssessment.effectiveSunElevationDeg.toFixed(1)}° · Earth{' '}
            {hoveredAssessment.effectiveEarthElevationDeg >= 0 ? '+' : ''}
            {hoveredAssessment.effectiveEarthElevationDeg.toFixed(1)}°
          </div>
        </div>
      )}
    </div>
  );
};
