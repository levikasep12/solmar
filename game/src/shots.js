// The four screenshot scenes behind ?shot=chase|street|mission|start&seed=N. Each one resets
// the seeded world, runs the real fixed-step simulation forward with a scripted autopilot
// (a car held at the throttle down an avenue, the player standing on a sidewalk), then sets
// the scene's state — wanted level, police, an active mission — places the camera, and hands
// the HUD the numbers to paint. The same seed always frames the same moment.

import { STEP } from './config.js';

function simulate(world, steps, keys = []) {
  const input = world.input;
  for (const key of keys) input.hold(key);
  for (let i = 0; i < steps; i += 1) {
    world.update(input);
    input.endFrame();
  }
  for (const key of keys) input.release(key);
}

function placeInCar(world, type, x, z, heading, speed) {
  const car = world.vehicles.add(type, x, z, heading, { driver: 'player' });
  car.speed = speed;
  car.throttle = 1;
  const state = world.player.state;
  state.car = car;
  state.onFoot = false;
  state.x = x;
  state.z = z;
  state.heading = heading;
  state.speed = speed;
  world.player.mesh.visible = false;
  return car;
}

function parkCop(world, index, x, z, heading, speed) {
  const units = world.police.units;
  const unit = units[index];
  if (!unit) return;
  const car = unit.car;
  car.x = x;
  car.z = z;
  car.heading = heading;
  car.speed = speed;
  car.siren = true;
  car.throttle = 1;
  car.mesh.position.set(x, 0, z);
  car.mesh.rotation.y = heading;
}

function behindCamera(world, x, z, heading, distance, height, lookAhead) {
  world.camera.position.set(x + 3.4, height, z - distance);
  world.camera.lookAt(x, 1.2, z + lookAhead);
  void heading;
}

function baseScene(world, cash) {
  return {
    screen: 'play',
    hudVisible: true,
    cash,
    wanted: 0,
    health: 1,
    weapon: 'Fists',
    speed: 0,
    speedVisible: false,
    objective: null,
    clock: 0,
  };
}

/** ?shot=chase — the cover: fast downtown, three stars, two patrol cars, a live mission. */
function sceneChase(world) {
  world.reset(2);
  const car = placeInCar(world, 'sports', 0, -40, 0, 26);
  simulate(world, 60, ['KeyW']);
  car.throttle = 1;
  car.speed = Math.max(26, car.speed);
  world.police.setWanted(3);
  world.police.ensureChasers(2);
  parkCop(world, 0, car.x + 7, car.z - 4, 0, 21);
  parkCop(world, 1, car.x - 7, car.z - 4, 0, 24);
  world.missions.startMission(2);
  world.missions.debugSetStage(1);
  world.missions.active.timer = 74;
  behindCamera(world, car.x, car.z, car.heading, 20, 8.6, 10);
  const scene = baseScene(world, 12450);
  scene.wanted = 3;
  scene.health = 0.78;
  scene.weapon = 'Pistol · 9';
  scene.speed = Math.abs(car.speed) * 3.6;
  scene.speedVisible = true;
  scene.objective = world.missions.objective();
  scene.clock = 6;
  window.__shotNote = 'chase: Mara at speed in a sports car through downtown, 3 stars, two patrol cars with sirens behind, traffic, minimap with police blips, objective HUD.';
  return scene;
}

/** ?shot=street — on foot on a busy boulevard. */
function sceneStreet(world) {
  world.reset(0);
  const px = 13.5;
  const pz = 44;
  world.player.spawnAt(px, pz, 0);
  for (const [dx, dz] of [[1.6, 6], [-1.4, 11], [1.2, -6], [-1.8, -12], [0.8, 17]]) {
    world.pedestrians.addStanding(px + dx, pz + dz, 99);
  }
  simulate(world, 90, []);
  // One parked sedan at the east curb so the avenue isn't empty asphalt: the
  // seeded parked cars all landed elsewhere, and the note promises cars.
  world.vehicles.add('sedan', 6.6, 56, 0, { driver: 'none' });
  // Camera in the avenue looking north along it: the old spot sat 1.7 m from
  // the building face and the wall ate the left half of the frame, and looking
  // north-east at Mara made the same face the whole backdrop. From here the
  // avenue runs away to the crosswalk, Mara and the peds stand along the east
  // sidewalk, and the towers frame both sides instead of filling one.
  world.camera.position.set(px - 9.5, 2.4, pz - 10);
  world.camera.lookAt(px - 6.5, 1.5, pz + 14);
  const scene = baseScene(world, 3400);
  scene.wanted = 0;
  scene.health = 1;
  scene.weapon = 'Fists';
  scene.speed = 0;
  scene.speedVisible = false;
  scene.objective = { text: 'Drive to the First Fare marker', timer: null };
  scene.clock = 4;
  window.__shotNote = 'street: Mara on foot on a downtown sidewalk at golden hour, pedestrians and parked cars nearby, traffic passing on the avenue, palms and towers, minimap HUD.';
  return scene;
}

/** ?shot=mission — Harbor Run in progress, driving for the waypoint. */
function sceneMission(world) {
  world.reset(2);
  const car = placeInCar(world, 'sedan', 176, 130, 0, 22);
  simulate(world, 36, ['KeyW']);
  car.throttle = 1;
  car.speed = Math.max(20, car.speed);
  world.missions.startMission(2);
  world.missions.debugSetStage(1);
  world.missions.active.timer = 68;
  world.police.setWanted(2);
  world.police.ensureChasers(1);
  parkCop(world, 0, car.x - 6, car.z + 2, 0, 20);
  behindCamera(world, car.x, car.z, car.heading, 13, 6.6, 14);
  const scene = baseScene(world, 7300);
  scene.wanted = 2;
  scene.health = 0.92;
  scene.weapon = 'Pistol · 6';
  scene.speed = Math.abs(car.speed) * 3.6;
  scene.speedVisible = true;
  scene.objective = world.missions.objective();
  scene.clock = 8;
  window.__shotNote = 'mission: Harbor Run underway, Mara driving a sedan north toward the marina waypoint, 2 stars and a patrol car behind, timer and objective on the HUD, gold blip on the minimap.';
  return scene;
}

/** ?shot=start — the title screen over a slow orbit of the golden-hour city. */
function sceneStart(world) {
  world.reset(0);
  simulate(world, 40, []);
  world.camera.position.set(-118, 74, -206);
  world.camera.lookAt(14, 22, 104);
  const scene = baseScene(world, 0);
  scene.screen = 'title';
  scene.hudVisible = false;
  window.__shotNote = 'start: SOLMAR title screen over a wide golden-hour view of the city — downtown towers, boulevard, palms and the sea toward the sun — with the Play / Continue / How to play menu.';
  return scene;
}

const SCENES = { chase: sceneChase, street: sceneStreet, mission: sceneMission, start: sceneStart };

export function stageShot(name, world) {
  world.cameraLocked = true;
  const scene = (SCENES[name] ?? sceneStart)(world);
  world.cameraLocked = true;
  return scene;
}
