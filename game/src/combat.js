// Combat: a left click is a punch on foot (nearest person in reach) or, with the pistol
// drawn, a hitscan shot that sparks off walls and cars. Health, ammo and pickups live here
// too, and police bullets come in through the same damage call so death is one path.

import * as THREE from 'three';
import { COMBAT, PALETTE } from './config.js';

export function createCombat(scene, city, vehicles, pedestrians, player, effects, audio, rng) {
  const pickups = [];
  const pickupGroup = new THREE.Group();
  scene.add(pickupGroup);

  const healthMat = new THREE.MeshStandardMaterial({ color: 0xff6b5a, emissive: 0xff3a2a, emissiveIntensity: 0.7 });
  const ammoMat = new THREE.MeshStandardMaterial({ color: 0xffd24a, emissive: 0xffb020, emissiveIntensity: 0.8 });
  const packageMat = new THREE.MeshStandardMaterial({ color: 0x62d0a8, emissive: 0x2f9a78, emissiveIntensity: 0.9 });

  function makePickup(kind, x, z, index) {
    let mesh;
    if (kind === 'health') {
      mesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), healthMat);
      const bar1 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.16), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      const bar2 = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.5, 0.16), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      mesh.add(bar1, bar2);
    } else if (kind === 'ammo') {
      mesh = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.28, 0.28), ammoMat);
    } else {
      mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.42), packageMat);
    }
    mesh.position.set(x, 1.1, z);
    mesh.castShadow = true;
    pickupGroup.add(mesh);
    const pickup = { kind, x, z, mesh, index, taken: false };
    pickups.push(pickup);
    return pickup;
  }

  function spawnWorldPickups(counts) {
    for (const p of pickups) pickupGroup.remove(p.mesh);
    pickups.length = 0;
    const spots = [];
    const blocks = city.blocks.filter((b) => !b.isPark);
    let guard = 0;
    while (spots.length < counts.ammo + counts.health && guard < 300) {
      guard += 1;
      const b = rng.pick(blocks);
      const x = b.cx + rng.range(-26, 26);
      const z = b.cz + rng.range(-26, 26);
      if (city.insideBuilding(x, z, 1)) continue;
      if (spots.some((s) => Math.hypot(s.x - x, s.z - z) < 40)) continue;
      spots.push({ x, z });
    }
    for (let i = 0; i < counts.ammo; i += 1) {
      const s = spots[i];
      if (s) makePickup('ammo', s.x, s.z, i);
    }
    for (let i = 0; i < counts.health; i += 1) {
      const s = spots[counts.ammo + i];
      if (s) makePickup('health', s.x, s.z, i);
    }
  }

  function spawnPackages(coords) {
    coords.forEach((c, i) => makePickup('package', c.x, c.z, i));
  }

  function clearPickups() {
    for (const p of pickups) pickupGroup.remove(p.mesh);
    pickups.length = 0;
  }

  function collect(pickup, save) {
    pickup.taken = true;
    pickupGroup.remove(pickup.mesh);
    const index = pickups.indexOf(pickup);
    if (index >= 0) pickups.splice(index, 1);
    audio.pickup();
    if (pickup.kind === 'ammo') {
      player.state.ammo += COMBAT.pickupAmmo;
      player.state.hasPistol = true;
      return { kind: 'ammo', text: `+${COMBAT.pickupAmmo} rounds` };
    }
    if (pickup.kind === 'health') {
      player.heal(35);
      return { kind: 'health', text: 'Health restored' };
    }
    if (pickup.kind === 'package') {
      if (save) save.packages.push(pickup.index);
      return { kind: 'package', text: 'Hidden package found' };
    }
    return { kind: 'none', text: '' };
  }

  /** Fire the pistol if it is drawn and loaded. Returns true when a shot went off. */
  function shoot(camera, onHit) {
    const s = player.state;
    if (s.weapon !== 'pistol' || s.ammo <= 0 || s.shootCooldown > 0 || s.dead) return false;
    s.ammo -= 1;
    s.shootCooldown = 0.22;
    audio.gunshot();
    effects.flash(0.16);
    camera.addTrauma(0.16);
    const origin = new THREE.Vector3(s.x, s.y + 1.3, s.z);
    const dir = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), s.heading);
    // Aim slightly down the camera's look so a shot lands where the crosshair points.
    dir.y = Math.sin(camera.pitch * -0.35);
    dir.normalize();
    effects.muzzle(origin.x + dir.x * 0.7, origin.y, origin.z + dir.z * 0.7);
    let bestDist = COMBAT.pistolRange;
    let hit = null;
    let hitType = null;
    for (const p of pedestrians.people) {
      if (p.gone || p.down > 0) continue;
      const dx = p.x - origin.x;
      const dz = p.z - origin.z;
      const along = dx * dir.x + dz * dir.z;
      if (along <= 0 || along > bestDist) continue;
      const side = Math.abs(dx * dir.z - dz * dir.x);
      if (side < 0.85 && along < bestDist) {
        bestDist = along;
        hit = p;
        hitType = 'ped';
      }
    }
    for (const car of vehicles.cars) {
      const dx = car.x - origin.x;
      const dz = car.z - origin.z;
      const along = dx * dir.x + dz * dir.z;
      if (along <= 0 || along > bestDist) continue;
      const side = Math.abs(dx * dir.z - dz * dir.x);
      if (side < car.radius * 0.7) {
        bestDist = along;
        hit = car;
        hitType = 'car';
      }
    }
    const endX = origin.x + dir.x * bestDist;
    const endZ = origin.z + dir.z * bestDist;
    if (hitType === 'ped') {
      pedestrians.scare(endX, endZ, 40, 1.4);
      pedestrians.knockDown(hit, origin.x, origin.z, 1.2);
      effects.blood(endX, 1.2, endZ);
      onHit?.('ped', hit, COMBAT.pistolDamage);
    } else if (hitType === 'car') {
      hit.health = Math.max(0, hit.health - 8);
      effects.sparks(endX, 1.0, endZ);
      pedestrians.scare(endX, endZ, 30, 1);
      onHit?.('car', hit, 8);
    } else {
      effects.sparks(endX, 1.0, endZ);
    }
    return true;
  }

  function punch(onHit) {
    const s = player.state;
    if (s.punchCooldown > 0 || s.dead) return false;
    s.punchCooldown = 0.42;
    audio.punch();
    const target = pedestrians.nearest(s.x, s.z, COMBAT.punchRange, (p) => {
      const dx = p.x - s.x;
      const dz = p.z - s.z;
      const facing = Math.atan2(dx, dz);
      let diff = Math.abs(((facing - s.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      return diff < 1.4;
    });
    if (target) {
      effects.blood(target.x, 1.3, target.z);
      pedestrians.knockDown(target, s.x, s.z, 1.6);
      pedestrians.scare(target.x, target.z, 22, 1);
      audio.hit();
      onHit?.('ped', target, COMBAT.punchDamage);
      return true;
    }
    return false;
  }

  function update(dt) {
    for (const p of pickups) {
      p.mesh.rotation.y += dt * 1.7;
      p.mesh.position.y = 1.05 + Math.sin(performance.now() * 0.002 + p.index) * 0.16;
    }
  }

  return {
    pickups, spawnWorldPickups, spawnPackages, clearPickups, collect, shoot, punch, update,
    /** Collect any pickup close to the player and hand back what it was. */
    takeNearby(x, z, save) {
      for (const p of [...pickups]) {
        const dx = p.x - x;
        const dz = p.z - z;
        if (dx * dx + dz * dz < 5) {
          const result = collect(p, save);
          return result;
        }
      }
      return null;
    },
  };
}

export { PALETTE };
