import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { LunarSite } from '../data/lunarSites';
import { SiteAssessment } from '../utils/lunarEphemeris';
import { fbm3D, sampleLocalTerrainHeightKm } from '../three/lunarTextures';
import { createLunarLanderRig } from '../three/landerModel';
import { detectSoftwareWebGL } from '../three/webglUtils';

interface LocalTerrainViewportProps {
  site: LunarSite;
  assessment: SiteAssessment;
  showSlopeMap: boolean;
  maxSlopeLimitDeg: number;
}

const PATCH_SIZE_KM = 12;
const SEGMENTS = 128;

export const LocalTerrainViewport: React.FC<LocalTerrainViewportProps> = ({
  site,
  assessment,
  showSlopeMap,
  maxSlopeLimitDeg,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);

  const apiRef = useRef<{
    rebuildTerrain: (
      site: LunarSite,
      slopeMode: boolean,
      maxSlope: number,
    ) => void;
    updateLighting: (assessment: SiteAssessment) => void;
  } | null>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareWebGL();
    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.setPixelRatio(
      isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2),
    );
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const width = container.clientWidth || 640;
    const height = container.clientHeight || 420;
    renderer.setSize(width, height);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x05080f);
    scene.fog = new THREE.FogExp2(0x05080f, 0.042);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    scene.environmentIntensity = 0.22;
    pmrem.dispose();

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 120);
    camera.position.set(5.4, 3.8, 6.2);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.07;
    controls.minDistance = 2.2;
    controls.maxDistance = 16;
    controls.maxPolarAngle = Math.PI * 0.48;
    controls.target.set(0, 0.7, 0);
    controls.update();

    // Solar key light casting crisp crater rim shadows
    const sunLight = new THREE.DirectionalLight(0xfff7ea, 3.2);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 1;
    sunLight.shadow.camera.far = 45;
    const d = 8.5;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.bias = -0.0005;
    sunLight.shadow.normalBias = 0.025;
    scene.add(sunLight);

    const hemiFill = new THREE.HemisphereLight(0x3a5c8a, 0x0b0f17, 0.28);
    scene.add(hemiFill);

    // Local displaced crater terrain patch
    const terrainGeo = new THREE.PlaneGeometry(
      PATCH_SIZE_KM,
      PATCH_SIZE_KM,
      SEGMENTS,
      SEGMENTS,
    );
    terrainGeo.rotateX(-Math.PI / 2);
    const count = terrainGeo.attributes.position.count;
    const colorAttr = new THREE.BufferAttribute(new Float32Array(count * 3), 3);
    terrainGeo.setAttribute('color', colorAttr);

    const terrainMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.92,
      metalness: 0.04,
      envMapIntensity: 0.24,
    });
    const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
    terrainMesh.castShadow = true;
    terrainMesh.receiveShadow = true;
    scene.add(terrainMesh);

    // Subtle elevation grid rings centered on the landing pad
    const padGuides = new THREE.Group();
    const guideMat = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.3,
    });
    const guideGeos: THREE.BufferGeometry[] = [];
    [0.5, 1.5, 3.0].forEach((r) => {
      const pts: THREE.Vector3[] = [];
      for (let a = 0; a <= 64; a++) {
        const ang = (a / 64) * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(ang) * r, 0, Math.sin(ang) * r));
      }
      const g = new THREE.BufferGeometry().setFromPoints(pts);
      guideGeos.push(g);
      padGuides.add(new THREE.Line(g, guideMat));
    });
    scene.add(padGuides);

    // Composite 3D Lander Rig grounded flush at (0, h(0,0), 0)
    const lander = createLunarLanderRig();
    lander.group.scale.setScalar(0.32);
    scene.add(lander.group);

    // Sun & Earth Horizon Direction Beams above landing pad
    const sunBeamGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(),
      new THREE.Vector3(0, 1, 0),
    ]);
    const sunBeamMat = new THREE.LineBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.9,
    });
    const sunBeam = new THREE.Line(sunBeamGeo, sunBeamMat);
    scene.add(sunBeam);

    const earthBeamGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(),
      new THREE.Vector3(0, 0, 1),
    ]);
    const earthBeamMat = new THREE.LineDashedMaterial({
      color: 0x38bdf8,
      dashSize: 0.25,
      gapSize: 0.15,
      transparent: true,
      opacity: 0.85,
    });
    const earthBeam = new THREE.Line(earthBeamGeo, earthBeamMat);
    scene.add(earthBeam);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    let frameId = 0;
    let renderBusy = false;
    let renderDirty = false;
    let disposed = false;

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
        const moved = controls.update();
        renderer.render(scene, camera);
        const done = () => {
          renderBusy = false;
          if (renderDirty || (moved && controls.enableDamping)) {
            requestRender();
          }
        };
        if (isSoftwareGl) afterDraw(done);
        else done();
      });
    };

    controls.addEventListener('change', requestRender);

    const rebuildTerrain = (
      activeSite: LunarSite,
      slopeMode: boolean,
      maxSlope: number,
    ) => {
      const pos = terrainGeo.attributes.position as THREE.BufferAttribute;
      const col = terrainGeo.attributes.color as THREE.BufferAttribute;

      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const z = pos.getZ(i);
        const y = sampleLocalTerrainHeightKm(activeSite, x, z);
        pos.setY(i, y);
      }
      pos.needsUpdate = true;
      terrainGeo.computeVertexNormals();
      const norm = terrainGeo.attributes.normal as THREE.BufferAttribute;

      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const z = pos.getZ(i);
        const ny = THREE.MathUtils.clamp(norm.getY(i), 0, 1);
        const slopeDeg = (Math.acos(ny) * 180) / Math.PI;

        if (slopeMode) {
          if (slopeDeg <= maxSlope * 0.65) {
            // Safe grade: cool slate-cyan
            col.setXYZ(i, 0.24, 0.54, 0.68);
          } else if (slopeDeg <= maxSlope) {
            // Caution grade: amber
            col.setXYZ(i, 0.78, 0.56, 0.18);
          } else {
            // Steep / hazard grade: terracotta-crimson
            col.setXYZ(i, 0.74, 0.25, 0.24);
          }
        } else {
          // Authentic lunar highlands regolith shading (subtle albedo + ambient occlusion in crater bowls)
          const grain = fbm3D(x * 1.9 + 2, y * 1.9, z * 1.9 - 1, 3);
          const bowlShade = THREE.MathUtils.clamp(0.42 + (y + 1.2) * 0.2, 0.26, 0.78);
          const v = bowlShade * (0.86 + grain * 0.24);
          col.setXYZ(i, v * 0.98, v * 0.98, v);
        }
      }
      col.needsUpdate = true;

      const centerY = sampleLocalTerrainHeightKm(activeSite, 0, 0);
      lander.group.position.set(0, centerY, 0);

      // Snap range rings to terrain height
      guideGeos.forEach((g) => {
        const gPos = g.attributes.position as THREE.BufferAttribute;
        for (let k = 0; k < gPos.count; k++) {
          const gx = gPos.getX(k);
          const gz = gPos.getZ(k);
          gPos.setY(k, sampleLocalTerrainHeightKm(activeSite, gx, gz) + 0.03);
        }
        gPos.needsUpdate = true;
      });

      controls.target.set(0, centerY + 0.35, 0);
      requestRender();
    };

    const updateLighting = (evalData: SiteAssessment) => {
      const sunEl = Math.max(evalData.effectiveSunElevationDeg, -4) * (Math.PI / 180);
      const sunAz = evalData.sunAzimuthDeg * (Math.PI / 180);
      // Local ENU: +X = East, -Z = North (so azimuth 0° North points -Z, 90° East points +X)
      const sunDir = new THREE.Vector3(
        Math.cos(sunEl) * Math.sin(sunAz),
        Math.sin(sunEl),
        -Math.cos(sunEl) * Math.cos(sunAz),
      ).normalize();

      // Keep shadow-casting directional light slightly above -1° so deep craters stay dramatically shadowed
      const lightDir = sunDir.clone();
      if (lightDir.y < 0.015) {
        sunLight.intensity = evalData.isSunlit ? 2.4 : 0.35;
        lightDir.y = Math.max(lightDir.y, 0.02);
        lightDir.normalize();
      } else {
        sunLight.intensity = 3.25;
      }
      sunLight.position.copy(lightDir).multiplyScalar(22);

      const earthEl = evalData.effectiveEarthElevationDeg * (Math.PI / 180);
      const earthAz = evalData.earthAzimuthDeg * (Math.PI / 180);
      const earthDir = new THREE.Vector3(
        Math.cos(earthEl) * Math.sin(earthAz),
        Math.sin(earthEl),
        -Math.cos(earthEl) * Math.cos(earthAz),
      ).normalize();

      const origin = lander.group.position.clone().add(new THREE.Vector3(0, 0.45, 0));
      const sAttr = sunBeam.geometry.attributes.position as THREE.BufferAttribute;
      const sEnd = origin.clone().addScaledVector(sunDir, 4.8);
      sAttr.setXYZ(0, origin.x, origin.y, origin.z);
      sAttr.setXYZ(1, sEnd.x, sEnd.y, sEnd.z);
      sAttr.needsUpdate = true;

      const eAttr = earthBeam.geometry.attributes.position as THREE.BufferAttribute;
      const eEnd = origin.clone().addScaledVector(earthDir, 4.8);
      eAttr.setXYZ(0, origin.x, origin.y, origin.z);
      eAttr.setXYZ(1, eEnd.x, eEnd.y, eEnd.z);
      eAttr.needsUpdate = true;
      earthBeam.computeLineDistances();

      // Aim lander dish & solar wing
      lander.dishPivot.rotation.y = Math.atan2(earthDir.x, earthDir.z);
      lander.solarPivot.rotation.y = Math.atan2(sunDir.x, sunDir.z);

      requestRender();
    };

    apiRef.current = { rebuildTerrain, updateLighting };
    rebuildTerrain(site, showSlopeMap, maxSlopeLimitDeg);
    updateLighting(assessment);

    const onResize = () => {
      if (!container || disposed) return;
      const w = container.clientWidth || 640;
      const h = container.clientHeight || 420;
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
      controls.dispose();
      terrainGeo.dispose();
      terrainMat.dispose();
      guideGeos.forEach((g) => g.dispose());
      guideMat.dispose();
      sunBeamGeo.dispose();
      sunBeamMat.dispose();
      earthBeamGeo.dispose();
      earthBeamMat.dispose();
      lander.dispose();
      envTex.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
      apiRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    apiRef.current?.rebuildTerrain(site, showSlopeMap, maxSlopeLimitDeg);
  }, [site, showSlopeMap, maxSlopeLimitDeg]);

  useEffect(() => {
    apiRef.current?.updateLighting(assessment);
  }, [assessment, site]);

  return (
    <div className="relative w-full h-[380px] lg:h-[420px] rounded-lg overflow-hidden border border-slate-800/90 bg-[#05080F]">
      <div
        ref={mountRef}
        className="w-full h-full"
        aria-label={`Local 3D crater relief terrain for ${site.name}`}
      />
      <div className="pointer-events-none absolute top-3 left-3 flex items-center gap-3 text-xs font-mono-tabular text-slate-300 bg-[#070B13]/90 border border-slate-800 px-2.5 py-1.5 rounded">
        <span>12 × 12 km Local Relief</span>
        <span className="text-slate-600">·</span>
        <span className="text-amber-400">Sun Ray</span>
        <span className="text-slate-600">·</span>
        <span className="text-sky-400">Earth Sightline</span>
      </div>
    </div>
  );
};
