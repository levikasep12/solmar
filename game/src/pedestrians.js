// Pedestrians: about thirty people walking the block sidewalks, and some of them crossing
// at the crosswalks between blocks. They scatter when a shot rings out or a car climbs the
// curb, then walk again once their nerves settle. Every body is primitives; a shared gait
// is drawn from a per-person phase so the crowd never marches in step.

import * as THREE from 'three';
import { PALETTE } from './config.js';

function buildPed(rng) {
  const group = new THREE.Group();
  const shirt = new THREE.MeshStandardMaterial({ color: rng.pick(PALETTE.pedShirts), roughness: 0.9 });
  const pants = new THREE.MeshStandardMaterial({ color: rng.pick(PALETTE.pedPants), roughness: 0.95 });
  const skin = new THREE.MeshStandardMaterial({ color: rng.pick([0xd7a77f, 0xa9714c, 0x8a5233, 0xe8be9a]), roughness: 0.8 });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.74, 0.3), shirt);
  torso.position.y = 1.18;
  torso.castShadow = true;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 6), skin);
  head.position.y = 1.7;
  head.castShadow = true;
  const legs = [];
  for (const sx of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.78, 0.2), pants);
    leg.position.set(sx * 0.13, 0.42, 0);
    leg.castShadow = true;
    group.add(leg);
    legs.push(leg);
  }
  const arms = [];
  for (const sx of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.6, 0.16), shirt);
    arm.position.set(sx * 0.33, 1.24, 0);
    arm.castShadow = true;
    group.add(arm);
    arms.push(arm);
  }
  group.add(torso, head);
  group.userData.legs = legs;
  group.userData.arms = arms;
  group.userData.head = head;
  return group;
}

export function createPedestrians(scene, city, rng, count = 30) {
  const people = [];
  let group;

  function spawnOne() {
    const block = rng.pick(city.blocks.filter((b) => !b.isPark)) ?? city.blocks[0];
    const side = rng.int(0, 3);
    const radius = 30.5;
    const along = rng.range(-26, 26);
    const dir = rng.chance(0.5) ? 1 : -1;
    const stands = rng.chance(0.12);
    const mesh = buildPed(rng);
    scene.add(mesh);
    const person = {
      mesh, block, side, along, dir, radius,
      speed: rng.range(1.1, 1.75),
      phase: rng.range(0, 6.28),
      panic: 0,
      dead: 0,
      down: false,
      gone: false,
      crossing: 0,
      x: 0, z: 0, heading: 0,
      stands,
      item: null,
    };
    // A few stand still with a phone out, as people do on a warm evening.
    position(person);
    people.push(person);
    return person;
  }

  function position(person) {
    const b = person.block;
    const r = person.radius;
    const a = person.along;
    let x;
    let z;
    if (person.side === 0) { x = b.cx + a; z = b.cz - r; }
    else if (person.side === 1) { x = b.cx + r; z = b.cz + a; }
    else if (person.side === 2) { x = b.cx - a; z = b.cz + r; }
    else { x = b.cx - r; z = b.cz - a; }
    person.x = x;
    person.z = z;
    const forward = person.dir > 0 ? 1 : -1;
    const headings = [Math.PI / 2, Math.PI, -Math.PI / 2, 0];
    person.heading = headings[person.side] * forward;
    person.mesh.position.set(x, 0.3, z);
    person.mesh.rotation.y = person.heading;
  }

  function reset() {
    for (const p of people) scene.remove(p.mesh);
    people.length = 0;
    for (let i = 0; i < count; i += 1) spawnOne();
  }

  function walk(person, dt, moved, speed) {
    const half = 26;
    if (person.crossing > 0) {
      person.crossing -= dt;
      person.x += Math.sin(person.heading) * speed * dt * 1.3;
      person.z += Math.cos(person.heading) * speed * dt * 1.3;
      if (person.crossing <= 0) {
        person.side = (person.side + 2) % 4;
        person.along = (person.side === 0 || person.side === 2) ? clampAlong(person.x - person.block.cx) : clampAlong(person.z - person.block.cz);
      }
    } else {
      person.along += person.dir * speed * dt;
      if (person.along > half) {
        person.along = half;
        if (person.panic <= 0 && Math.random() < 0.35) {
          person.crossing = 3.2;
          person.heading = person.dir > 0 ? (person.side === 1 ? -Math.PI / 2 : person.heading) : person.heading;
        } else person.dir = -1;
      }
      if (person.along < -half) {
        person.along = -half;
        if (person.panic <= 0 && Math.random() < 0.35) {
          person.crossing = 3.2;
        } else person.dir = 1;
      }
      position(person);
    }
    const bob = Math.abs(Math.sin(person.phase + moved * 6)) * 0.06;
    person.mesh.position.set(person.x, 0.3 + bob, person.z);
    const swing = Math.sin(person.phase + moved * 8) * 0.55;
    const legs = person.mesh.userData.legs;
    const arms = person.mesh.userData.arms;
    legs[0].rotation.x = swing;
    legs[1].rotation.x = -swing;
    arms[0].rotation.x = -swing * 0.8;
    arms[1].rotation.x = swing * 0.8;
    if (person.panic > 0) {
      person.mesh.rotation.x = 0.15;
    } else {
      person.mesh.rotation.x = 0;
    }
    person.mesh.rotation.y = person.heading;
  }

  function clampAlong(v) {
    return Math.max(-26, Math.min(26, v));
  }

  function scare(x, z, radius, strength = 1) {
    for (const p of people) {
      if (p.down || p.gone) continue;
      const dx = p.x - x;
      const dz = p.z - z;
      const d = Math.hypot(dx, dz);
      if (d > radius) continue;
      p.panic = Math.max(p.panic, 3.5 * strength);
      p.heading = Math.atan2(dx, dz);
      p.away = true;
    }
  }

  function update(dt, player) {
    for (const p of people) {
      if (p.gone) continue;
      if (p.down > 0) {
        p.down -= dt;
        p.mesh.rotation.z = Math.max(0, p.mesh.rotation.z - dt * 3);
        p.mesh.rotation.x = Math.min(1.5, p.mesh.rotation.x + dt * 3);
        if (p.down <= 0) {
          p.down = 0;
          p.gone = true;
          scene.remove(p.mesh);
        }
        continue;
      }
      const speed = p.panic > 0 ? p.speed * 3.4 : p.speed;
      const moved = dt * speed * 0.35;
      p.phase += moved;
      if (p.panic > 0) {
        p.panic -= dt;
        p.x += Math.sin(p.heading) * speed * dt;
        p.z += Math.cos(p.heading) * speed * dt;
        if (p.panic <= 0) {
          p.along = (p.side === 0 || p.side === 2) ? clampAlong(p.x - p.block.cx) : clampAlong(p.z - p.block.cz);
          p.crossing = 0;
        }
        const bob = Math.abs(Math.sin(p.phase * 3)) * 0.05;
        p.mesh.position.set(p.x, 0.3 + bob, p.z);
        p.mesh.rotation.y = p.heading;
        p.mesh.rotation.x = 0.22;
      } else if (!p.stands) {
        walk(p, dt, moved, p.speed);
      }
      if (player && player.onFoot) {
        const dx = p.x - player.x;
        const dz = p.z - player.z;
        if (dx * dx + dz * dz < 4) {
          const d = Math.max(0.3, Math.sqrt(dx * dx + dz * dz));
          p.x += (dx / d) * dt * 1.4;
          p.z += (dz / d) * dt * 1.4;
        }
      }
    }
  }

  function nearest(x, z, maxDist, filter) {
    let best = null;
    let bestD = maxDist * maxDist;
    for (const p of people) {
      if (p.gone || p.down > 0) continue;
      if (filter && !filter(p)) continue;
      const dx = p.x - x;
      const dz = p.z - z;
      const d = dx * dx + dz * dz;
      if (d < bestD) { bestD = d; best = p; }
    }
    return best;
  }

  function knockDown(p, fromX, fromZ, force) {
    if (p.down > 0 || p.gone) return false;
    p.down = 1.6;
    p.panic = 0;
    p.heading = Math.atan2(p.x - fromX, p.z - fromZ);
    p.x += Math.sin(p.heading) * force;
    p.z += Math.cos(p.heading) * force;
    p.mesh.position.set(p.x, 0.3, p.z);
    p.mesh.rotation.z = 1.2;
    return true;
  }

  return { people, reset, update, scare, nearest, knockDown, spawnOne, clear() {
    for (const p of people) scene.remove(p.mesh);
    people.length = 0;
  }, addStanding(x, z, timer) {
    const p = spawnOne();
    p.x = x; p.z = z; p.stands = true; p.missionPed = true;
    p.mesh.position.set(x, 0.3, z);
    p.timer = timer;
    return p;
  } };
}
