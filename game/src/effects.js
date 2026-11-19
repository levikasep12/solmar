// The little things that sell a hit: spark and dust particles, a muzzle flash light,
// tyre smoke when the handbrake bites, and the screen flash and low-health vignette.
// Everything is pooled — a burst of sparks never allocates mid-frame.

import * as THREE from 'three';

const MAX_PARTICLES = 180;

export function createEffects(scene) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(MAX_PARTICLES * 3);
  const colors = new Float32Array(MAX_PARTICLES * 3);
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({
    size: 0.34, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false, sizeAttenuation: true,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  scene.add(points);

  const pool = [];
  for (let i = 0; i < MAX_PARTICLES; i += 1) {
    pool.push({ life: 0, max: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, r: 1, g: 1, b: 1 });
  }
  let cursor = 0;

  const flash = document.getElementById('flash');
  const vignette = document.getElementById('vignette');
  let flashTime = 0;

  function emit(x, y, z, count, spread, speed, color) {
    for (let i = 0; i < count; i += 1) {
      const p = pool[cursor];
      cursor = (cursor + 1) % MAX_PARTICLES;
      p.life = p.max = 0.35 + Math.random() * 0.5;
      p.x = x + (Math.random() - 0.5) * spread;
      p.y = y + (Math.random() - 0.5) * spread;
      p.z = z + (Math.random() - 0.5) * spread;
      p.vx = (Math.random() - 0.5) * speed;
      p.vy = Math.random() * speed * 0.8;
      p.vz = (Math.random() - 0.5) * speed;
      p.r = color.r; p.g = color.g; p.b = color.b;
    }
  }

  const spark = new THREE.Color(0xffd27a);
  const smoke = new THREE.Color(0xcfc4b4);
  const blood = new THREE.Color(0xd6483a);

  function update(dt) {
    let index = 0;
    for (const p of pool) {
      if (p.life > 0) {
        p.life -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        p.vy -= 9 * dt;
        if (p.y < 0.05) { p.y = 0.05; p.vy *= -0.35; p.vx *= 0.7; p.vz *= 0.7; }
        const fade = Math.max(0, p.life / p.max);
        positions[index * 3] = p.x;
        positions[index * 3 + 1] = p.y;
        positions[index * 3 + 2] = p.z;
        colors[index * 3] = p.r * fade;
        colors[index * 3 + 1] = p.g * fade;
        colors[index * 3 + 2] = p.b * fade;
        index += 1;
      }
    }
    for (let i = index; i < MAX_PARTICLES; i += 1) {
      positions[i * 3] = 0;
      positions[i * 3 + 1] = -999;
      positions[i * 3 + 2] = 0;
    }
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.color.needsUpdate = true;
    geometry.setDrawRange(0, MAX_PARTICLES);

    if (flashTime > 0) {
      flashTime -= dt;
      flash.style.opacity = String(Math.max(0, flashTime * 2.2));
    }
  }

  return {
    update,
    sparks(x, y, z) { emit(x, y, z, 14, 0.5, 7, spark); },
    dust(x, y, z) { emit(x, y, z, 8, 0.8, 2.6, smoke); },
    blood(x, y, z) { emit(x, y, z, 10, 0.4, 4, blood); },
    muzzle(x, y, z) { emit(x, y, z, 6, 0.16, 5, spark); },
    flash(alpha = 0.35) { flashTime = alpha; },
    health(ratio) {
      const low = ratio < 0.34 && ratio > 0;
      vignette.style.opacity = ratio <= 0 ? '0' : String(Math.max(0, (0.34 - ratio) / 0.34) * 0.9);
    },
  };
}
