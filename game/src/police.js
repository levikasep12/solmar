// Wanted level and the police. Stars 1-5: patrol cars spawn off the player's shoulder and
// chase and ram at one star, foot officers join at three, and at five a roadblock and a
// circling helicopter arrive. The level cools when the player stays out of sight, and the
// Spray Shop clears it in one go. Every crime funnels through crime() so the HUD, the
// cooldown clock and the chases all agree.

import * as THREE from 'three';
import { WANTED, PALETTE } from './config.js';

export function createPolice(scene, vehicles, player, city, pedestrians, effects, audio, rng) {
  const units = [];
  const officers = [];
  let wanted = 0;
  let heat = 0; // seconds since last seen
  let sinceSpawn = 0;
  let cooldown = 0;
  let lastKnown = { x: 0, z: 0 };
  let helicopter = null;
  let roadblock = null;
  const officerGroup = new THREE.Group();
  scene.add(officerGroup);

  function buildOfficer() {
    const g = new THREE.Group();
    const navy = new THREE.MeshStandardMaterial({ color: 0x25314a, roughness: 0.85 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xc79a76, roughness: 0.8 });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.72, 0.32), navy);
    torso.position.y = 1.2;
    torso.castShadow = true;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 8, 6), skin);
    head.position.y = 1.72;
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.1, 8), new THREE.MeshStandardMaterial({ color: 0x1a2438 }));
    cap.position.y = 1.86;
    const legs = [];
    for (const sx of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.8, 0.2), new THREE.MeshStandardMaterial({ color: 0x1d2740 }));
      leg.position.set(sx * 0.14, 0.42, 0);
      g.add(leg);
      legs.push(leg);
    }
    g.add(torso, head, cap);
    g.userData.legs = legs;
    return g;
  }

  function spawnUnit() {
    if (units.length >= WANTED.maxChasers) return null;
    const angle = rng.range(0, Math.PI * 2);
    const dist = WANTED.policeSpawnDistance + rng.range(0, 30);
    let x = player.state.x + Math.cos(angle) * dist;
    let z = player.state.z + Math.sin(angle) * dist;
    x = Math.max(-300, Math.min(300, x));
    z = Math.max(-300, Math.min(300, z));
    const near = city.nearestLane(x, z);
    if (near.axis === 'x') { x = near.x; z = near.line + 4.2; }
    else { x = near.line - 4.2; z = near.z; }
    const car = vehicles.add('police', x, z, Math.atan2(player.state.x - x, player.state.z - z), { driver: 'ai' });
    car.ai = { police: true, mode: 'chase' };
    car.siren = true;
    const unit = { car, state: 'chase', fire: rng.range(0.6, 1.6), stuck: 0, reverse: 0 };
    units.push(unit);
    return unit;
  }

  function spawnOfficer() {
    if (officers.length >= 4) return;
    const angle = rng.range(0, Math.PI * 2);
    const dist = 34 + rng.range(0, 12);
    const x = player.state.x + Math.cos(angle) * dist;
    const z = player.state.z + Math.sin(angle) * dist;
    if (city.insideBuilding(x, z, 1)) return;
    const mesh = buildOfficer();
    mesh.position.set(x, 0.3, z);
    officerGroup.add(mesh);
    officers.push({ mesh, x, z, heading: 0, fire: rng.range(0.8, 2), dead: false, health: 70 });
  }

  function clearUnits() {
    for (const unit of units) vehicles.remove(unit.car);
    units.length = 0;
    for (const o of officers) officerGroup.remove(o.mesh);
    officers.length = 0;
    removeHelicopter();
    removeRoadblock();
  }

  function removeHelicopter() {
    if (helicopter) {
      scene.remove(helicopter.group);
      helicopter = null;
    }
  }

  function makeHelicopter() {
    const group = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(1.1, 2.2, 4, 8), new THREE.MeshStandardMaterial({ color: 0x24344d, roughness: 0.5, metalness: 0.4 }));
    body.rotation.z = Math.PI / 2;
    body.castShadow = true;
    const tail = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.3, 0.3), new THREE.MeshStandardMaterial({ color: 0x1d2b40 }));
    tail.position.set(-2.8, 0.2, 0);
    const rotor = new THREE.Mesh(new THREE.BoxGeometry(7, 0.08, 0.4), new THREE.MeshStandardMaterial({ color: 0x2a2a2a }));
    rotor.position.y = 1.1;
    const light = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshStandardMaterial({ color: 0xfff0b0, emissive: 0xffe080, emissiveIntensity: 3 }));
    light.position.set(0.4, -1.2, 0);
    const beam = new THREE.SpotLight(0xfff2c4, 0, 160, 0.32, 0.5, 1.2);
    beam.position.set(0.4, -1.2, 0);
    const target = new THREE.Object3D();
    group.add(body, tail, rotor, light, beam, target);
    beam.target = target;
    scene.add(group);
    helicopter = { group, rotor, beam, target, angle: 0 };
  }

  function removeRoadblock() {
    if (!roadblock) return;
    for (const car of roadblock) vehicles.remove(car);
    roadblock = null;
  }

  function makeRoadblock() {
    if (roadblock) return;
    const heading = player.state.heading;
    const ahead = 70;
    const cx = player.state.x + Math.sin(heading) * ahead;
    const cz = player.state.z + Math.cos(heading) * ahead;
    const near = city.nearestLane(cx, cz);
    roadblock = [];
    for (const off of [-4, 4]) {
      const x = near.axis === 'x' ? near.x + off : near.line;
      const z = near.axis === 'x' ? near.line : near.z + off;
      const car = vehicles.add('police', x, z, heading + Math.PI / 2, { driver: 'none' });
      car.siren = true;
      roadblock.push(car);
    }
    for (let i = 0; i < 2; i += 1) spawnOfficer();
  }

  function crime(amount, notify) {
    if (amount <= 0) return;
    const before = wanted;
    wanted = Math.min(WANTED.max, wanted + amount);
    heat = 0;
    cooldown = 0;
    lastKnown = { x: player.state.x, z: player.state.z };
    if (wanted > before && notify) notify(wanted);
    if (wanted >= 5) makeRoadblock();
    if (wanted >= 5 && !helicopter) makeHelicopter();
  }

  function clear() {
    wanted = 0;
    heat = 0;
    cooldown = 0;
    clearUnits();
  }

  function canSee() {
    // Police "see" the player when close enough or when the player is loud (in a car).
    const d = Math.hypot(player.state.x - lastKnown.x, player.state.z - lastKnown.z);
    if (d < 24) return true;
    for (const unit of units) {
      const dd = Math.hypot(player.state.x - unit.car.x, player.state.z - unit.car.z);
      if (dd < 62) return true;
    }
    for (const o of officers) {
      if (Math.hypot(player.state.x - o.x, player.state.z - o.z) < 40) return true;
    }
    return false;
  }

  function update(dt, onHit) {
    if (wanted > 0) {
      if (canSee()) {
        heat = 0;
        lastKnown = { x: player.state.x, z: player.state.z };
        cooldown = 0;
      } else {
        heat += dt;
        if (heat > WANTED.decayDelay) {
          cooldown += dt;
          if (cooldown > WANTED.decayEvery) {
            cooldown = 0;
            wanted = Math.max(0, wanted - 1);
            if (wanted === 0) clearUnits();
          }
        }
      }
      sinceSpawn += dt;
      if (sinceSpawn > 2.4 && units.length < Math.min(WANTED.maxChasers, wanted + 1)) {
        sinceSpawn = 0;
        spawnUnit();
      }
      if (wanted >= 3 && officers.length < Math.min(4, wanted - 1) && sinceSpawn > 1.6) {
        spawnOfficer();
      }
      if (wanted >= 5) {
        if (!helicopter) makeHelicopter();
        if (!roadblock) makeRoadblock();
      }
    } else {
      if (units.length) clearUnits();
    }

    // Patrol cars: drive at the player, ram when close, bail out if wrecked.
    for (const unit of [...units]) {
      const car = unit.car;
      if (car.health <= 0) {
        if (car.driver !== 'none') {
          car.driver = 'none';
          car.siren = false;
          if (Math.hypot(player.state.x - car.x, player.state.z - car.z) < 40) spawnOfficer();
        }
        continue;
      }
      if (car.driver === 'none') continue;
      const tx = player.state.x;
      const tz = player.state.z;
      const dx = tx - car.x;
      const dz = tz - car.z;
      const dist = Math.hypot(dx, dz);
      const want = Math.atan2(dx, dz);
      let diff = ((want - car.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      car.steerInput = Math.max(-1, Math.min(1, diff * 1.6));
      const aggro = Math.min(1, 0.5 + wanted * 0.1);
      if (dist > 12) car.throttle = 1;
      else if (dist > 6) car.throttle = 0.35;
      else car.throttle = -0.2;
      car.handbrake = Math.abs(diff) > 1.5 && Math.abs(car.speed) > 14;
      if (dist < 3.6 && Math.abs(car.speed) > 6) {
        // Ram: hurt the player's car and the player if on foot.
        if (player.state.car) {
          player.state.car.health = Math.max(0, player.state.car.health - 6 * aggro);
          effects.sparks(car.x, 1, car.z);
        } else if (player.state.onFoot) {
          onHit?.(9 * aggro);
        }
      }
      if (Math.abs(car.speed) < 0.5 && dist > 20) unit.stuck += dt;
      else unit.stuck = 0;
      if (unit.stuck > 3) {
        unit.stuck = 0;
        car.x += Math.cos(car.heading) * 4;
        car.z -= Math.sin(car.heading) * 4;
      }
      if (car.speed > 20 && Math.random() < 0.2) {
        effects.dust(car.x, 0.4, car.z);
      }
      unit.car.siren = wanted > 0;
    }

    // Officers on foot: close in and shoot once the player is at two stars or more.
    for (const o of officers) {
      if (o.dead) continue;
      const dx = player.state.x - o.x;
      const dz = player.state.z - o.z;
      const d = Math.hypot(dx, dz);
      o.heading = Math.atan2(dx, dz);
      if (d > 12) {
        const step = Math.min(d - 11, 4.4 * dt);
        const nx = o.x + (dx / (d || 1)) * step;
        const nz = o.z + (dz / (d || 1)) * step;
        if (!city.insideBuilding(nx, nz, 0.4)) { o.x = nx; o.z = nz; }
      }
      const legs = o.mesh.userData.legs;
      const swing = Math.sin(performance.now() * 0.008 + o.x) * 0.5;
      legs[0].rotation.x = swing;
      legs[1].rotation.x = -swing;
      o.mesh.position.set(o.x, 0.3, o.z);
      o.mesh.rotation.y = o.heading;
      o.fire -= dt;
      if (wanted >= 2 && o.fire <= 0 && d < 42 && player.state.onFoot) {
        o.fire = rng.range(0.9, 1.8);
        audio.gunshot();
        effects.muzzle(o.x + Math.sin(o.heading) * 0.5, 1.2, o.z + Math.cos(o.heading) * 0.5);
        const chance = Math.max(0.2, 0.8 - d / 60);
        if (rng.next() < chance) {
          onHit?.(7 + wanted * 1.6);
          effects.blood(player.state.x, 1.3, player.state.z);
        }
      }
    }

    // Helicopter: circles above, spotlight on the player, no shots.
    if (helicopter) {
      helicopter.angle += dt * 0.5;
      const r = 46;
      const hx = player.state.x + Math.cos(helicopter.angle) * r;
      const hz = player.state.z + Math.sin(helicopter.angle) * r;
      helicopter.group.position.set(hx, 34 + Math.sin(helicopter.angle * 1.7) * 1.5, hz);
      helicopter.group.rotation.y = -helicopter.angle;
      helicopter.rotor.rotation.y += dt * 30;
      helicopter.beam.intensity = 180;
      helicopter.target.position.set(player.state.x, 0, player.state.z);
      helicopter.target.updateMatrixWorld();
    }
  }

  function hitOfficer(damage) {
    for (const o of officers) {
      if (o.dead) continue;
      if (Math.hypot(player.state.x - o.x, player.state.z - o.z) < 3) {
        o.health -= damage;
        if (o.health <= 0) {
          o.dead = true;
          officerGroup.remove(o.mesh);
          officers.splice(officers.indexOf(o), 1);
        }
        return true;
      }
    }
    return false;
  }

  return {
    units, officers,
    get wanted() { return wanted; },
    get heat() { return heat; },
    crime, clear, update, hitOfficer, spawnUnit, spawnOfficer,
    clearUnits,
    helicopterActive() { return helicopter !== null; },
    policePositions() {
      const list = units.map((u) => ({ x: u.car.x, z: u.car.z }));
      for (const o of officers) list.push({ x: o.x, z: o.z });
      if (helicopter) list.push({ x: helicopter.group.position.x, z: helicopter.group.position.z });
      return list;
    },
    reset() { clear(); },
    setWanted(n) {
      wanted = Math.max(0, Math.min(5, n));
      heat = 0;
      cooldown = 0;
      if (wanted > 0) lastKnown = { x: player.state.x, z: player.state.z };
      if (wanted >= 5 && !helicopter) makeHelicopter();
    },
    ensureChasers(n) {
      while (units.length < n) {
        if (!spawnUnit()) break;
      }
    },
    officerGroup,
  };
}

export { PALETTE };
