import * as THREE from 'three';

export function detectSoftwareWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export function createStarfield(count = 2200, radius = 260): {
  points: THREE.Points;
  dispose: () => void;
} {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);

  // Realistic Planckian stellar tints (O/B blue-white, A white, F/G warm white, K/M amber)
  const palette = [
    new THREE.Color(0xcad8ff),
    new THREE.Color(0xeef3ff),
    new THREE.Color(0xfff6ea),
    new THREE.Color(0xffe1b8),
    new THREE.Color(0xffc994),
  ];

  let seed = 918273;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  for (let i = 0; i < count; i++) {
    const u = rand() * 2 - 1;
    const theta = rand() * Math.PI * 2;
    const s = Math.sqrt(Math.max(0, 1 - u * u));
    const r = radius + (rand() - 0.5) * 40;

    positions[i * 3] = r * s * Math.cos(theta);
    positions[i * 3 + 1] = r * u;
    positions[i * 3 + 2] = r * s * Math.sin(theta);

    const col = palette[Math.floor(rand() * palette.length)];
    const brightness = 0.45 + Math.pow(rand(), 2.2) * 0.55;
    colors[i * 3] = col.r * brightness;
    colors[i * 3 + 1] = col.g * brightness;
    colors[i * 3 + 2] = col.b * brightness;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: 0.68,
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
  });

  const points = new THREE.Points(geometry, material);
  return {
    points,
    dispose: () => {
      geometry.dispose();
      material.dispose();
    },
  };
}
