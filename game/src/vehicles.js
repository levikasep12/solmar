// The cars of Solmar: six civilian shapes (sedan, coupe, pickup, van, sports, taxi) plus
// the patrol car, each modelled from primitives and each with its own weight, grip and
// top speed. This module owns car state and drives every car's simple bicycle physics;
// traffic, police and the player only hand it throttle, steer and handbrake.

import * as THREE from 'three';
import { CAR_TYPES } from './config.js';

const UP = new THREE.Vector3(0, 1, 0);
const scratch = new THREE.Vector3();

function paint(color) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.42, metalness: 0.28 });
}

function buildCarMesh(type) {
  const def = CAR_TYPES[type];
  const group = new THREE.Group();
  const bodyMat = paint(def.color);
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x1d2026, roughness: 0.5, metalness: 0.2 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x2c3c4c, roughness: 0.12, metalness: 0.65 });
  const chromeMat = new THREE.MeshStandardMaterial({ color: 0xb9bcc2, roughness: 0.3, metalness: 0.85 });
  const L = def.len;
  const W = def.wid;
  const H = def.hgt;

  const lower = new THREE.Mesh(new THREE.BoxGeometry(W, H * 0.62, L), bodyMat);
  lower.position.y = 0.34 + H * 0.31;
  lower.castShadow = true;
  lower.receiveShadow = true;
  group.add(lower);

  let cabinLen = L * 0.48;
  let cabinZ = -L * 0.06;
  if (type === 'van') { cabinLen = L * 0.82; cabinZ = L * 0.03; }
  if (type === 'pickup') { cabinLen = L * 0.36; cabinZ = L * 0.18; }
  if (type === 'sports') { cabinLen = L * 0.42; cabinZ = -L * 0.02; }
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(W * 0.9, H * 0.55 + 0.16, cabinLen), glassMat);
  cabin.position.set(0, 0.34 + H * 0.62 + (H * 0.55) / 2 - 0.02, cabinZ);
  cabin.castShadow = true;
  group.add(cabin);

  const roof = new THREE.Mesh(new THREE.BoxGeometry(W * 0.86, 0.1, cabinLen * 0.92), bodyMat);
  roof.position.set(0, cabin.position.y + (H * 0.55 + 0.16) / 2, cabinZ);
  group.add(roof);

  if (type === 'pickup') {
    const bed = new THREE.Mesh(new THREE.BoxGeometry(W * 0.94, H * 0.5, L * 0.4), bodyMat);
    bed.position.set(0, 0.34 + H * 0.25, -L * 0.26);
    bed.castShadow = true;
    group.add(bed);
  }

  const wheelGeom = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
  const wheels = [];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const wheel = new THREE.Mesh(wheelGeom, darkMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(sx * (W / 2 - 0.02), 0.38, sz * (L / 2 - 0.78));
      wheel.castShadow = true;
      group.add(wheel);
      wheels.push(wheel);
    }
  }

  for (const sx of [-1, 1]) {
    const light = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.06), new THREE.MeshStandardMaterial({ color: 0xfff1c4, emissive: 0xffe6a8, emissiveIntensity: 0.9 }));
    light.position.set(sx * W * 0.32, 0.62, L / 2 + 0.01);
    group.add(light);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.05), new THREE.MeshStandardMaterial({ color: 0x8c1c18, emissive: 0x8c1c18, emissiveIntensity: 0.5 }));
    tail.position.set(sx * W * 0.32, 0.64, -L / 2 - 0.01);
    group.add(tail);
  }
  const plate = new THREE.Mesh(new THREE.BoxGeometry(W * 0.34, 0.12, 0.04), chromeMat);
  plate.position.set(0, 0.5, L / 2 + 0.02);
  group.add(plate);

  if (type === 'taxi') {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.28, 0.4), new THREE.MeshStandardMaterial({ color: 0xfff3c4, emissive: 0xffd24a, emissiveIntensity: 1.2 }));
    sign.position.set(0, roof.position.y + 0.2, cabinZ + 0.1);
    group.add(sign);
  }

  let beacon = null;
  if (type === 'police') {
    beacon = new THREE.Group();
    for (const [sx, col] of [[-1, 0xff2a3a], [1, 0x2a6bff]]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.22, 0.34), new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 1.8 }));
      bar.position.set(sx * 0.34, 0, 0);
      beacon.add(bar);
    }
    beacon.position.set(0, roof.position.y + 0.18, cabinZ);
    group.add(beacon);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(W + 0.02, 0.26, L * 0.6), new THREE.MeshStandardMaterial({ color: 0xe8ecf2, roughness: 0.5 }));
    stripe.position.set(0, 0.62, -0.1);
    group.add(stripe);
  }

  group.userData.wheels = wheels;
  group.userData.beacon = beacon;
  group.userData.roofY = roof.position.y;
  return group;
}

export function createVehicles(scene) {
  const cars = [];
  let nextId = 1;

  function add(type, x, z, heading, options = {}) {
    const def = CAR_TYPES[type];
    const mesh = buildCarMesh(type);
    const color = options.color;
    if (color !== undefined) {
      mesh.children[0].material = paint(color);
    }
    const car = {
      id: nextId++,
      type,
      def,
      color: color ?? def.color,
      x, z, heading,
      speed: 0,
      steer: 0,
      steerInput: 0,
      throttle: 0,
      handbrake: false,
      health: 100,
      driver: options.driver ?? 'none',
      isPolice: type === 'police',
      siren: false,
      mesh,
      radius: Math.max(def.len, def.wid) * 0.52,
      skid: false,
      wobble: 0,
      stuck: 0,
      ai: options.ai ?? null,
      brakeLight: 0,
    };
    mesh.position.set(x, 0, z);
    mesh.rotation.y = heading;
    scene.add(mesh);
    cars.push(car);
    return car;
  }

  function remove(car) {
    const index = cars.indexOf(car);
    if (index >= 0) cars.splice(index, 1);
    scene.remove(car.mesh);
    car.mesh.traverse((o) => {
      if (o.isMesh) {
        o.geometry.dispose?.();
        if (o.material?.map) o.material.map.dispose?.();
        o.material?.dispose?.();
      }
    });
  }

  function clear() {
    for (const car of [...cars]) remove(car);
  }

  /** Distance-squared helper used by AI and by the enter-car search. */
  function near(x, z, maxDist, filter) {
    let best = null;
    let bestD = maxDist * maxDist;
    for (const car of cars) {
      if (filter && !filter(car)) continue;
      const dx = car.x - x;
      const dz = car.z - z;
      const d = dx * dx + dz * dz;
      if (d < bestD) { bestD = d; best = car; }
    }
    return best;
  }

  function collideBuildings(car) {
    const half = car.def.wid * 0.5;
    const front = car.def.len * 0.5;
    const fx = car.x + Math.sin(car.heading) * front;
    const fz = car.z + Math.cos(car.heading) * front;
    const rx = car.x + Math.cos(car.heading) * half;
    const rz = car.z - Math.sin(car.heading) * half;
    if (car.x > 320 || car.x < -345 || car.z > 382 || car.z < -320) {
      car.x -= Math.sin(car.heading) * Math.min(2, Math.abs(car.speed) * 0.06);
      car.z -= Math.cos(car.heading) * Math.min(2, Math.abs(car.speed) * 0.06);
      car.speed *= -0.2;
      car.wobble = 0.4;
      return true;
    }
    return false;
  }

  function update(dt, city) {
    for (const car of cars) {
      const def = car.def;
      const maxSpeed = def.top;
      const accel = def.accel;
      if (car.driver === 'none') {
        car.speed *= 1 - Math.min(1, dt * 3);
        if (Math.abs(car.speed) < 0.02) car.speed = 0;
      } else {
        if (car.throttle > 0) {
          car.speed += accel * car.throttle * dt;
        } else if (car.throttle < 0) {
          car.speed += def.brake * car.throttle * dt;
        } else {
          car.speed *= 1 - Math.min(1, dt * 0.7);
        }
        if (car.handbrake) car.speed *= 1 - Math.min(1, dt * 3.4);
        car.speed = Math.max(-maxSpeed * 0.34, Math.min(maxSpeed, car.speed));
      }

      const grip = Math.min(1, Math.abs(car.speed) / 7);
      car.steer += (car.steerInput - car.steer) * Math.min(1, dt * 9);
      const turn = car.steer * def.steer * grip * (car.handbrake ? 1.5 : 1) * Math.sign(car.speed || 1);
      car.heading += turn * dt * Math.min(1, Math.abs(car.speed) / 6 + 0.2);

      const nx = car.x + Math.sin(car.heading) * car.speed * dt;
      const nz = car.z + Math.cos(car.heading) * car.speed * dt;

      let blocked = false;
      if (city) {
        const pad = 0;
        const probes = [
          [nx + Math.sin(car.heading) * def.len * 0.45, nz + Math.cos(car.heading) * def.len * 0.45],
          [nx, nz],
          [nx - Math.sin(car.heading) * def.len * 0.45, nz - Math.cos(car.heading) * def.len * 0.45],
        ];
        for (const [px, pz] of probes) {
          if (city.insideBuilding(px, pz, pad)) { blocked = true; break; }
        }
      }
      if (blocked) {
        car.speed *= -0.28;
        car.wobble = Math.min(1, Math.abs(car.speed) * 0.1 + 0.2);
        car.health = Math.max(0, car.health - Math.abs(car.speed) * 0.35);
        car.x -= Math.sin(car.heading) * 0.35;
        car.z -= Math.cos(car.heading) * 0.35;
      } else {
        car.x = nx;
        car.z = nz;
      }

      // Car versus car: push apart and bleed speed on the harder hit.
      for (const other of cars) {
        if (other.id <= car.id) continue;
        const dx = other.x - car.x;
        const dz = other.z - car.z;
        const min = car.radius + other.radius;
        const d2 = dx * dx + dz * dz;
        if (d2 > 0.0001 && d2 < min * min) {
          const d = Math.sqrt(d2);
          const push = (min - d) * 0.5;
          car.x -= (dx / d) * push;
          car.z -= (dz / d) * push;
          other.x += (dx / d) * push;
          other.z += (dz / d) * push;
          const closing = Math.abs(car.speed) + Math.abs(other.speed);
          car.speed *= 0.72;
          other.speed *= 0.72;
          car.wobble = Math.max(car.wobble, 0.5);
          other.wobble = Math.max(other.wobble, 0.5);
          if (closing > 12) {
            car.health = Math.max(0, car.health - closing * 0.28);
            other.health = Math.max(0, other.health - closing * 0.28);
          }
        }
      }

      car.wobble *= 1 - Math.min(1, dt * 4);
      const mesh = car.mesh;
      mesh.position.set(car.x, Math.abs(car.wobble) * 0.12, car.z);
      mesh.rotation.y = car.heading;
      mesh.rotation.z = car.wobble * 0.16 * Math.sin(car.x * 2.1);
      const wheels = mesh.userData.wheels;
      if (wheels) {
        const spin = car.speed * dt * 2.6;
        for (let i = 0; i < 4; i += 1) {
          wheels[i].rotation.x += spin;
          if (i < 2) wheels[i].rotation.y = car.steer * 0.42;
        }
      }
      const beacon = mesh.userData.beacon;
      if (beacon) {
        const flash = car.siren ? (Math.floor(performance.now() / 160) % 2 === 0 ? 1 : -1) : 0;
        beacon.children[0].material.emissiveIntensity = flash > 0 && car.siren ? 2.4 : 0.12;
        beacon.children[1].material.emissiveIntensity = flash < 0 && car.siren ? 2.4 : 0.12;
      }
      if (car.health <= 0 && car.driver === 'ai') {
        car.speed *= 0.9;
      }
      car.stuck = Math.abs(car.speed) < 0.4 ? car.stuck + dt : 0;
    }
  }

  return {
    cars, add, remove, clear, near, update,
    get(id) { return cars.find((c) => c.id === id) ?? null; },
    forEach(fn) { cars.forEach(fn); },
  };
}

export { buildCarMesh };
