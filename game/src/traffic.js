// Traffic. About twenty AI cars stream along the avenue lanes, two-way, right-hand side,
// with a lane offset they hold, slowing for whatever is in front of them and pulling for
// the curb when a siren comes near. Cars that leave the city wrap to the far end of the
// same avenue, so the streets always have someone on them without spawning mid-frame.

import { CITY_HALF, CAR_TYPES, TRAFFIC_TYPES } from './config.js';

const LANE = 4.2;
const CURB = 7.2;
const LOOKAHEAD = 17;

export function createTraffic(vehicles, city, rng, count = 20) {
  const entries = [];

  function lanePoint(entry, t = entry.t) {
    const line = entry.line;
    if (entry.axis === 'x') {
      const z = line + entry.dir * entry.offset;
      return { x: t, z };
    }
    const x = line - entry.dir * entry.offset;
    return { x, z: t };
  }

  function headingFor(entry) {
    if (entry.axis === 'x') return entry.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    return entry.dir > 0 ? 0 : Math.PI;
  }

  function spawn() {
    const type = rng.pick(TRAFFIC_TYPES);
    const axis = rng.chance(0.5) ? 'x' : 'z';
    const dir = rng.chance(0.5) ? 1 : -1;
    const line = rng.pick(city.lines);
    const t = rng.range(-CITY_HALF + 20, CITY_HALF - 20);
    const entry = { axis, dir, line, offset: LANE, t, cruise: rng.range(0.42, 0.8), panic: 0 };
    const p = lanePoint(entry);
    const car = vehicles.add(type, p.x, p.z, headingFor(entry), {
      driver: 'ai',
      color: rng.chance(0.25) ? rng.pick([0xcfd6d2, 0x2f3a44, 0x7a3b32, 0xdcd0b4]) : undefined,
    });
    car.ai = entry;
    car.cruiseSpeed = 0;
    entry.car = car;
    entries.push(entry);
  }

  function clear() {
    entries.length = 0;
  }

  function reset() {
    clear();
    for (let i = 0; i < count; i += 1) spawn();
  }

  function avoid(entry, car) {
    const aheadX = Math.sin(car.heading);
    const aheadZ = Math.cos(car.heading);
    let block = Infinity;
    for (const other of vehicles.cars) {
      if (other === car) continue;
      const dx = other.x - car.x;
      const dz = other.z - car.z;
      const along = dx * aheadX + dz * aheadZ;
      if (along <= 0 || along > LOOKAHEAD) continue;
      const side = Math.abs(dx * aheadZ - dz * aheadX);
      if (side < 2.6) block = Math.min(block, along);
    }
    return block;
  }

  function update(dt, sirenNear) {
    for (const entry of entries) {
      const car = entry.car;
      if (car.driver !== 'ai') continue;
      if (car.health <= 0) {
        car.throttle = 0;
        car.steerInput = 0;
        continue;
      }
      const targetOffset = sirenNear ? CURB : LANE;
      entry.offset += (targetOffset - entry.offset) * Math.min(1, dt * 1.2);
      const cruise = car.def.top * (sirenNear ? 0.22 : entry.cruise);
      const gap = avoid(entry, car);
      let desired = cruise;
      if (gap < LOOKAHEAD) desired = cruise * Math.max(0, (gap - 4) / (LOOKAHEAD - 4));
      if (gap < 5) desired = 0;
      const diff = desired - car.speed;
      car.throttle = diff > 1 ? Math.min(1, diff * 0.4) : diff < -1 ? Math.max(-1, diff * 0.5) : 0;
      car.steerInput = 0;
      car.handbrake = false;
      entry.t += car.speed * dt * entry.dir;
      const p = lanePoint(entry);
      car.x = p.x;
      car.z = p.z;
      car.heading = headingFor(entry);
      if (entry.t > CITY_HALF + 40) entry.t = -CITY_HALF - 34;
      if (entry.t < -CITY_HALF - 40) entry.t = CITY_HALF + 34;
    }
  }

  function forNearby(x, z, radius, fn) {
    for (const entry of entries) {
      const car = entry.car;
      const dx = car.x - x;
      const dz = car.z - z;
      if (dx * dx + dz * dz < radius * radius) fn(car, entry);
    }
  }

  function policeNear() {
    for (const entry of entries) {
      if (entry.car.driver === 'ai') entry.car.ai.alert = 1;
    }
  }

  return { entries, spawn, reset, update, clear, forNearby, policeNear };
}

/** Parked cars along the curbs: the ones a player can walk up to and drive off. */
export function fillParked(vehicles, city, rng, count = 14) {
  const placed = [];
  let guard = 0;
  while (placed.length < count && guard < 400) {
    guard += 1;
    const axis = rng.chance(0.5) ? 'x' : 'z';
    const line = rng.pick(city.lines);
    const t = rng.range(-CITY_HALF + 24, CITY_HALF - 24);
    if (city.lines.some((l) => Math.abs(t - l) < 16)) continue;
    const dir = rng.chance(0.5) ? 1 : -1;
    const type = rng.pick(TRAFFIC_TYPES);
    const heading = axis === 'x' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
    const x = axis === 'x' ? t : line - dir * 6.6;
    const z = axis === 'x' ? line + dir * 6.6 : t;
    if (placed.some((p) => Math.hypot(p.x - x, p.z - z) < 12)) continue;
    const car = vehicles.add(type, x, z, heading, { driver: 'none' });
    placed.push(car);
    void CAR_TYPES;
  }
  return placed;
}
