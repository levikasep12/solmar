// Mara Voss: a body that walks, sprints and jumps, and a controller that either steers her
// or hands her to whichever car she has climbed into. Entering a car (E) and carjacking a
// moving one (F) both go through here, as do health, the weapon slot and the hospital wake-up.

import * as THREE from 'three';
import { PLAYER, COMBAT, CAR_TYPES } from './config.js';

function buildBody() {
  const group = new THREE.Group();
  const jacket = new THREE.MeshStandardMaterial({ color: 0xb8452f, roughness: 0.75 });
  const jeans = new THREE.MeshStandardMaterial({ color: 0x2c3444, roughness: 0.9 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xd8a883, roughness: 0.7 });
  const hair = new THREE.MeshStandardMaterial({ color: 0x2a1b12, roughness: 0.85 });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.72, 0.32), jacket);
  torso.position.y = 1.22;
  torso.castShadow = true;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 10, 8), skin);
  head.position.y = 1.74;
  head.castShadow = true;
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.205, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), hair);
  cap.position.y = 1.77;
  const legs = [];
  for (const sx of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.82, 0.22), jeans);
    leg.position.set(sx * 0.14, 0.44, 0);
    leg.castShadow = true;
    group.add(leg);
    legs.push(leg);
  }
  const arms = [];
  for (const sx of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.66, 0.18), jacket);
    arm.position.set(sx * 0.36, 1.26, 0);
    arm.castShadow = true;
    group.add(arm);
    arms.push(arm);
  }
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.34), new THREE.MeshStandardMaterial({ color: 0x1c1f24, metalness: 0.7, roughness: 0.35 }));
  gun.position.set(0.36, 1.05, 0.3);
  gun.visible = false;
  group.add(gun);
  group.add(torso, head, cap);
  group.userData = { legs, arms, gun, head };
  return group;
}

export function createPlayer(scene) {
  const mesh = buildBody();
  scene.add(mesh);
  const state = {
    x: PLAYER.startX,
    z: PLAYER.startZ,
    heading: PLAYER.startHeading,
    vy: 0,
    y: 0.3,
    onFoot: true,
    car: null,
    health: PLAYER.health,
    maxHealth: PLAYER.health,
    ammo: COMBAT.startAmmo,
    hasPistol: false,
    weapon: 'fists',
    phase: 0,
    moving: false,
    sprinting: false,
    speed: 0,
    punchCooldown: 0,
    shootCooldown: 0,
    dead: false,
    invuln: 0,
    lastSafe: { x: PLAYER.startX, z: PLAYER.startZ },
    enterCooldown: 0,
  };

  function place(x, z, heading) {
    state.x = x;
    state.z = z;
    if (heading !== undefined) state.heading = heading;
    state.y = 0.3;
    state.vy = 0;
  }

  function spawnAt(x, z, heading) {
    if (state.car) {
      state.car.driver = 'none';
      state.car.throttle = 0;
      state.car = null;
    }
    state.onFoot = true;
    state.dead = false;
    state.health = state.maxHealth;
    state.invuln = 2;
    place(x, z, heading ?? state.heading);
    mesh.visible = true;
    mesh.position.set(x, 0.3, z);
    mesh.rotation.set(0, state.heading, 0);
  }

  function enterCar(car, vehicles) {
    if (!car || !state.onFoot || state.dead) return false;
    const dx = car.x - state.x;
    const dz = car.z - state.z;
    if (Math.hypot(dx, dz) > 4.6) return false;
    if (car.driver === 'player') return false;
    const wasAi = car.driver === 'ai';
    if (car.driver === 'ai' && car.speed > 9) return false; // too fast to pull open: use F
    car.driver = 'player';
    car.ai = null;
    car.throttle = 0;
    car.steerInput = 0;
    car.handbrake = false;
    state.car = car;
    state.onFoot = false;
    state.speed = car.speed;
    mesh.visible = false;
    state.enterCooldown = 0.35;
    return { car, wasAi };
  }

  function exitCar(vehicles) {
    const car = state.car;
    if (!car) return false;
    car.driver = 'none';
    car.throttle = 0;
    car.steerInput = 0;
    car.handbrake = false;
    car.speed *= 0.4;
    state.car = null;
    state.onFoot = true;
    state.enterCooldown = 0.35;
    const side = 1.9;
    const ox = car.x + Math.cos(car.heading) * side;
    const oz = car.z - Math.sin(car.heading) * side;
    place(ox, oz, car.heading);
    mesh.visible = true;
    mesh.position.set(ox, 0.3, oz);
    return true;
  }

  function damage(amount, effects, camera) {
    if (state.invuln > 0 || state.dead) return false;
    state.health = Math.max(0, state.health - amount);
    state.invuln = 0.25;
    effects.blood(state.x, state.y + 1.2, state.z);
    camera.addTrauma(Math.min(0.35, amount * 0.01));
    if (state.health <= 0) state.dead = true;
    return state.dead;
  }

  function heal(v) {
    state.health = Math.min(state.maxHealth, state.health + v);
  }

  function updateOnFoot(dt, input, city, camera) {
    const forward = (input.down('KeyW') ? 1 : 0) - (input.down('KeyS') ? 1 : 0);
    const strafe = (input.down('KeyD') ? 1 : 0) - (input.down('KeyA') ? 1 : 0);
    state.sprinting = input.down('ShiftLeft') || input.down('ShiftRight');
    const speed = state.sprinting ? PLAYER.run : PLAYER.walk;
    let mx = 0;
    let mz = 0;
    if (forward !== 0 || strafe !== 0) {
      const camYaw = camera.yaw;
      const sin = Math.sin(camYaw);
      const cos = Math.cos(camYaw);
      const dirX = -sin * forward + cos * strafe;
      const dirZ = -cos * forward - sin * strafe;
      const len = Math.hypot(dirX, dirZ) || 1;
      mx = (dirX / len) * speed;
      mz = (dirZ / len) * speed;
      state.heading = Math.atan2(mx, mz);
      state.moving = true;
    } else {
      state.moving = false;
    }
    const nx = state.x + mx * dt;
    const nz = state.z + mz * dt;
    if (!city.insideBuilding(nx, nz, 0.5) && Math.abs(nx) < 350 && nz < 380 && nz > -330) {
      state.x = nx;
      state.z = nz;
    } else if (!city.insideBuilding(nx, state.z, 0.5)) {
      state.x = nx;
    } else if (!city.insideBuilding(state.x, nz, 0.5)) {
      state.z = nz;
    }
    if (state.y <= 0.31 && input.pressed('Space')) {
      state.vy = PLAYER.jump;
    }
    state.vy -= 16 * dt;
    state.y += state.vy * dt;
    if (state.y < 0.3) { state.y = 0.3; state.vy = 0; }
    state.speed = state.moving ? speed : 0;
    state.phase += dt * (state.moving ? (state.sprinting ? 11 : 7.5) : 2);
    mesh.position.set(state.x, state.y, state.z);
    mesh.rotation.y = state.heading;
    const legs = mesh.userData.legs;
    const arms = mesh.userData.arms;
    const swing = state.moving ? Math.sin(state.phase) * 0.62 : 0;
    legs[0].rotation.x = swing;
    legs[1].rotation.x = -swing;
    arms[0].rotation.x = -swing * 0.8;
    arms[1].rotation.x = swing * 0.8;
    if (state.punchCooldown > 0.05) {
      arms[1].rotation.x = -1.6;
      arms[1].rotation.z = 0;
    }
    mesh.userData.gun.visible = state.weapon === 'pistol';
  }

  function updateDriving(dt, input, vehicles, effects, audio) {
    const car = state.car;
    if (!car) return;
    const throttle = (input.down('KeyW') ? 1 : 0) - (input.down('KeyS') ? 1 : 0);
    const steer = (input.down('KeyA') ? 1 : 0) - (input.down('KeyD') ? 1 : 0);
    car.throttle = throttle;
    car.steerInput = steer;
    car.handbrake = input.down('Space');
    state.speed = car.speed;
    state.x = car.x;
    state.z = car.z;
    state.heading = car.heading;
    if (car.handbrake && Math.abs(car.speed) > 9) {
      effects.dust(car.x - Math.sin(car.heading) * 1.5, 0.2, car.z - Math.cos(car.heading) * 1.5);
      audio.skid();
    }
    if (car.health < 30 && Math.random() < 0.05) {
      effects.dust(car.x, 1.1, car.z + Math.cos(car.heading) * 1.8);
    }
  }

  function update(dt, input, city, vehicles, effects, camera, audio) {
    if (state.dead) return;
    state.invuln = Math.max(0, state.invuln - dt);
    state.punchCooldown = Math.max(0, state.punchCooldown - dt);
    state.shootCooldown = Math.max(0, state.shootCooldown - dt);
    state.enterCooldown = Math.max(0, state.enterCooldown - dt);
    if (state.onFoot) updateOnFoot(dt, input, city, camera);
    else updateDriving(dt, input, vehicles, effects, audio);
  }

  return {
    mesh, state, place, spawnAt, enterCar, exitCar, damage, heal, update,
    setWeapon(w) {
      if (w === 'pistol' && !state.hasPistol) return false;
      state.weapon = w;
      return true;
    },
  };
}

export { CAR_TYPES };
