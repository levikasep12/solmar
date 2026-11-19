// SOLMAR boots here: one WebGL renderer, one seeded city, one fixed-step simulation at
// 1/60 s, and the screens (title, play, pause, hospital, mission complete, stats). Input is
// read each frame; the world advances in whole steps; the camera and HUD paint what is
// there. ?seed=N rebuilds the same city, ?shot=name stages a screenshot scene instead.

import * as THREE from 'three';
import { STEP, MAX_FRAME, PLAYER, POI, CASH, CAR_TYPES, CITY_HALF, SAVE_KEY } from './config.js';
import { createRandom, streamFor } from './random.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createCity } from './city.js';
import { createVehicles } from './vehicles.js';
import { createTraffic, fillParked } from './traffic.js';
import { createPedestrians } from './pedestrians.js';
import { createPlayer } from './player.js';
import { createPolice } from './police.js';
import { createCombat } from './combat.js';
import { createMissions } from './missions.js';
import { createCamera } from './camera.js';
import { createHud } from './hud.js';
import { createEffects } from './effects.js';
import { loadSave, writeSave, emptySave, hasSave, clearSave } from './save.js';
import { stageShot } from './shots.js';
import { installDebug } from './debug.js';

const errors = [];
window.addEventListener('error', (e) => errors.push(String(e.message ?? e.error ?? 'error')));
window.addEventListener('unhandledrejection', (e) => errors.push(`unhandled: ${String(e.reason)}`));

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const SEED = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const statusEl = document.getElementById('status');
const screens = {
  title: document.getElementById('title'),
  help: document.getElementById('help'),
  pause: document.getElementById('pause'),
  gameover: document.getElementById('gameover'),
  missiondone: document.getElementById('missiondone'),
  stats: document.getElementById('stats'),
};
const hud = createHud();
const audio = createAudio();
let currentScreen = 'title';
let save = loadSave();
let world = null;
let menuOrbit = 0;

function announce(message) {
  statusEl.textContent = message;
}

function setScreen(name) {
  currentScreen = name;
  for (const [key, el] of Object.entries(screens)) el.classList.toggle('hidden', key !== name);
  hud.show(name === 'play' || name === 'paused');
  if (name === 'title') screens.title.classList.remove('hidden');
}

// ---------------------------------------------------------------------------
// The world
// ---------------------------------------------------------------------------
function packageSpots(seed) {
  const rng = streamFor(seed, 'packages');
  const spots = [];
  let guard = 0;
  while (spots.length < 10 && guard < 500) {
    guard += 1;
    const x = rng.range(-260, 260);
    const z = rng.range(-260, 300);
    if (Math.abs(x) < 14 || Math.abs(z) < 14) continue;
    if (spots.some((s) => Math.hypot(s.x - x, s.z - z) < 70)) continue;
    spots.push({ x, z });
  }
  return spots;
}

function buildWorld(seed, input) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.35, 1500);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;

  const city = createCity(scene, streamFor(seed, 'city'));
  const vehicles = createVehicles(scene);
  const traffic = createTraffic(vehicles, city, streamFor(seed, 'traffic'), 20);
  const parked = [];
  const pedestrians = createPedestrians(scene, city, streamFor(seed, 'peds'), 30);
  const player = createPlayer(scene);
  const effects = createEffects(scene);
  const cameraRig = createCamera(camera, input);
  const packageCoords = packageSpots(seed);

  const world = {
    scene, camera, renderer, city, vehicles, traffic, pedestrians, player, effects, cameraRig,
    hud, audio, input, seed, packageCoords,
    cameraLocked: false,
    forceSim: false,
    clockMinutes: 0,
    saveDirty: 0,
    lastPlayerPos: { x: player.state.x, z: player.state.z },
    stats: { distance: 0 },
  };

  const police = createPolice(scene, vehicles, player, city, pedestrians, effects, audio, streamFor(seed, 'police'));
  const combat = createCombat(scene, city, vehicles, pedestrians, player, effects, audio, streamFor(seed, 'combat'));
  const missions = createMissions(scene, player, vehicles, police, pedestrians, hud, audio, effects, streamFor(seed, 'missions'), {
    onMissionComplete(index, reward) {
      save.cash += reward;
      save.mission = Math.max(save.mission, index + 1);
      save.stats.missions += 1;
      audio.cash();
      showMissionDone(missions.active?.def?.name ?? 'Job', reward);
      persist();
    },
    onMissionFail() { persist(); },
    onMissionStart() { persist(); },
    onSideReward(amount, text) {
      save.cash += amount;
      hud.toast(`${text} +$${amount}`, 2.8);
      audio.cash();
      persist();
    },
    onCrime: (n) => hud.setStars(n),
  });
  world.police = police;
  world.combat = combat;
  world.missions = missions;

  function persist() {
    save.pos = { x: player.state.x, z: player.state.z, heading: player.state.heading };
    save.ammo = player.state.ammo;
    save.hasPistol = player.state.hasPistol;
    writeSave(save);
  }
  world.persist = persist;

  function resetWorld(progress) {
    vehicles.clear();
    traffic.reset();
    parked.length = 0;
    fillParked(vehicles, city, streamFor(seed, 'parked'), 14).forEach((c) => parked.push(c));
    pedestrians.reset();
    police.reset();
    combat.clearPickups();
    combat.spawnWorldPickups({ ammo: 6, health: 4 });
    const remaining = packageCoords.filter((_, i) => !save.packages.includes(i));
    combat.spawnPackages(remaining);
    const start = save.pos ?? { x: PLAYER.startX, z: PLAYER.startZ, heading: PLAYER.startHeading };
    player.spawnAt(start.x, start.z, start.heading);
    player.state.hasPistol = save.hasPistol;
    player.state.ammo = save.ammo;
    player.state.weapon = save.hasPistol ? 'pistol' : 'fists';
    missions.resetStory(progress ?? save.mission);
    hud.setStars(0);
    hud.setCash(save.cash);
    hud.setHealth(1, player.state.weapon === 'pistol' ? 'Pistol' : 'Fists');
    hud.setSpeed(0, false);
    world.clockMinutes = 0;
    world.cameraLocked = false;
  }
  world.reset = resetWorld;

  function addCash(amount) {
    save.cash = Math.max(0, save.cash + amount);
    hud.setCash(save.cash);
  }
  world.addCash = addCash;

  function crime(amount, message) {
    police.crime(amount, (stars) => {
      hud.setStars(stars);
      if (message) hud.toast(message, 2.2);
    });
    save.stats.crimes += 1;
  }
  world.crime = crime;

  function nearestEnterable() {
    return vehicles.near(player.state.x, player.state.z, 5.2, (c) => c.driver !== 'player');
  }
  world.nearestEnterable = nearestEnterable;

  function handleActions() {
    const p = player.state;
    if (input.takePressed('KeyE')) {
      if (p.onFoot) {
        const car = nearestEnterable();
        if (car && car.driver !== 'ai') {
          player.enterCar(car);
          audio.click();
          hud.toast(`Driving a ${car.def.name}`, 1.6);
          if (car.driver !== 'player') { /* no crime for parked */ }
        } else if (car) {
          hud.toast('Moving too fast — press F to carjack', 1.8);
        } else {
          hud.toast('No car nearby', 1.2);
        }
      } else {
        const car = p.car;
        player.exitCar();
        if (car) hud.toast('On foot', 1.2);
      }
    }
    if (input.takePressed('KeyF')) {
      if (p.onFoot) {
        const car = vehicles.near(p.x, p.z, 5.6, (c) => c.driver === 'ai' || c.driver === 'none');
        if (car) {
          const wasAi = car.driver === 'ai';
          car.driver = 'player';
          car.ai = null;
          car.throttle = 0;
          p.car = car;
          p.onFoot = false;
          player.mesh.visible = false;
          p.enterCooldown = 0.35;
          if (wasAi) {
            crime(2, 'Carjacking!');
            save.stats.stolen += 1;
            const occupant = pedestrians.nearest(car.x, car.z, 4);
            if (occupant) pedestrians.knockDown(occupant, car.x, car.z, 2.2);
            police.ensureChasers(1);
          }
          audio.click();
        }
      }
    }
    if (input.takePressed('Digit1')) player.setWeapon('fists');
    if (input.takePressed('Digit2')) {
      if (player.setWeapon('pistol')) hud.toast('Pistol drawn', 1.2);
      else hud.toast('No pistol yet — find ammo pickups', 2);
    }
    if (input.takePressed('KeyM')) {
      const muted = audio.mute();
      hud.toast(muted ? 'Sound off' : 'Sound on', 1.4);
    }
    if (input.takePressed('KeyP') || input.takePressed('Escape')) {
      setScreen('paused');
      announce('Paused.');
    }
    if (input.takeClick()) {
      if (player.state.weapon === 'pistol') {
        const fired = combat.shoot(cameraRig, (type) => {
          if (type === 'ped') { crime(1, 'Shots fired!'); }
        });
        if (fired) {
          crime(1, null);
          pedestrians.scare(player.state.x, player.state.z, 45, 1.3);
        }
      } else {
        const hit = combat.punch((type, target) => {
          pedestrians.scare(target.x, target.z, 20, 1);
        });
        if (hit) crime(1, 'Assault!');
      }
    }
    // Pick up whatever is underfoot.
    const pickup = combat.takeNearby(player.state.x, player.state.z, save);
    if (pickup) {
      hud.toast(pickup.text, 1.8);
      if (pickup.kind === 'package') {
        save.stats.packages += 1;
        save.cash += CASH.package;
        hud.setCash(save.cash);
        audio.cash();
        persist();
      }
    }
  }

  function checkCarCrimes() {
    for (const car of vehicles.cars) {
      if (Math.abs(car.speed) < 6) continue;
      for (const person of pedestrians.people) {
        if (person.gone || person.down > 0) continue;
        const dx = person.x - car.x;
        const dz = person.z - car.z;
        if (dx * dx + dz * dz < 3.4) {
          pedestrians.knockDown(person, car.x, car.z, 1.4);
          pedestrians.scare(car.x, car.z, 34, 1.3);
          effects.blood(person.x, 1, person.z);
          audio.hit();
          if (car.driver === 'player') {
            crime(2, 'Hit a pedestrian!');
            save.cash = Math.max(0, save.cash - 50);
            hud.setCash(save.cash);
          }
        }
      }
      if (car.driver === 'player' && car.speed > 8) {
        for (const unit of police.units) {
          const cop = unit.car;
          const dx = cop.x - car.x;
          const dz = cop.z - car.z;
          if (dx * dx + dz * dz < 12 && police.wanted === 0) {
            crime(2, 'Rammed a police car!');
            break;
          }
        }
      }
    }
  }

  function update(inputRef) {
    const p = player.state;
    if (!world.forceSim && (currentScreen !== 'play' || p.dead)) return;
    handleActions();
    player.update(STEP, inputRef, city, vehicles, effects, cameraRig, audio);
    vehicles.update(STEP, city);
    const sirenNear = police.wanted > 0 && police.units.some((u) => Math.hypot(u.car.x - p.x, u.car.z - p.z) < 70);
    traffic.update(STEP, sirenNear);
    pedestrians.update(STEP, p);
    police.update(STEP, (damage) => {
      if (player.damage(damage, effects, cameraRig)) onPlayerDeath();
    });
    combat.update(STEP);
    missions.update(STEP);
    checkCarCrimes();

    if (p.car) {
      const dx = p.car.x - world.lastPlayerPos.x;
      const dz = p.car.z - world.lastPlayerPos.z;
      const moved = Math.hypot(dx, dz);
      if (moved < 20) save.stats.distance += moved;
      world.lastPlayerPos = { x: p.car.x, z: p.car.z };
    } else {
      world.lastPlayerPos = { x: p.x, z: p.z };
    }

    const entry = missions.checkEntry();
    if (entry === 'mission') hud.toast('Job started', 1.6);
    if (entry === 'trial') hud.toast('Time trial started', 1.6);

    const objective = missions.objective();
    hud.setObjective(objective.text, objective.timer);
    hud.setStars(police.wanted);
    hud.setCash(save.cash);
    hud.setHealth(p.health / p.maxHealth, p.weapon === 'pistol' ? `Pistol · ${p.ammo}` : 'Fists');
    hud.setSpeed(Math.abs(p.speed) * 3.6, !p.onFoot);
    hud.setClock(world.clockMinutes);
    hud.update(STEP);
    world.clockMinutes += STEP / 60;

    audio.engine(p.car ? p.car.speed : 0, Boolean(p.car));
    audio.siren(police.wanted > 0);
    effects.health(p.health / p.maxHealth);

    if (p.dead) onPlayerDeath();

    save.played += STEP;
    world.saveDirty += STEP;
    if (world.saveDirty > 8) {
      world.saveDirty = 0;
      persist();
    }
  }
  world.update = update;

  function onPlayerDeath() {
    if (currentScreen === 'gameover') return;
    save.stats.deaths += 1;
    const loss = Math.min(save.cash, 200);
    save.cash -= loss;
    document.getElementById('gameover-loss').textContent = `-$${loss}`;
    police.clear();
    hud.setStars(0);
    player.state.dead = false;
    setScreen('gameover');
    audio.hospital();
    announce('Wasted. Wake up at the hospital.');
  }
  world.onPlayerDeath = onPlayerDeath;

  function respawnAtHospital() {
    const h = POI.hospital;
    player.spawnAt(h.x, h.z, Math.PI);
    player.state.health = player.state.maxHealth;
    police.clear();
    hud.setStars(0);
    hud.setHealth(1, player.state.weapon === 'pistol' ? 'Pistol' : 'Fists');
    setScreen('play');
    hud.toast('Solmar General patched you up', 2.6);
    persist();
  }
  world.respawnAtHospital = respawnAtHospital;

  function render() {
    if (!world.cameraLocked) {
      cameraRig.update(1 / 60, {
        x: player.state.x,
        z: player.state.z,
        heading: player.state.heading,
        onFoot: player.state.onFoot,
        speed: player.state.speed,
      }, city);
    }
    const view = {
      x: player.state.x,
      z: player.state.z,
      heading: player.state.onFoot ? player.state.heading : player.state.heading,
      cars: vehicles.cars.filter((c) => c.driver === 'ai' || c.driver === 'none'),
      police: police.policePositions(),
      waypoint: missions.waypoint(),
      spray: POI.spray,
      hospital: POI.hospital,
      marks: [
        ...missions.markers.map((m) => ({ x: m.x, z: m.z, color: m.color, size: 4 })),
        ...combat.pickups.filter((pk) => pk.kind === 'package' && Math.hypot(pk.x - player.state.x, pk.z - player.state.z) < 55)
          .map((pk) => ({ x: pk.x, z: pk.z, color: 0x62d0a8, size: 3 })),
      ],
    };
    hud.drawMinimap(view);
    city.update(1 / 60, performance.now() * 0.001);
    renderer.render(scene, camera);
  }
  world.render = render;

  world.resize = () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  };

  return world;
}

// ---------------------------------------------------------------------------
// Screens and menus
// ---------------------------------------------------------------------------
function showMissionDone(name, reward) {
  document.getElementById('missiondone-title').textContent = 'MISSION COMPLETE';
  document.getElementById('missiondone-sub').textContent = `${name} — the coast remembers.`;
  document.getElementById('missiondone-cash').textContent = `+$${reward}`;
  setScreen('missiondone');
  announce(`Mission complete. ${name}.`);
}

function renderStats() {
  const table = document.getElementById('stats-table');
  const rows = [
    ['Cash', `$${Math.floor(save.cash).toLocaleString('en-US')}`],
    ['Story missions', `${Math.min(3, save.mission)} / 3`],
    ['Cars stolen', save.stats.stolen],
    ['Distance driven', `${(save.stats.distance / 1000).toFixed(2)} km`],
    ['Hidden packages', `${save.stats.packages} / 10`],
    ['Taxi fares', save.stats.fares],
    ['Time trials', save.stats.trials],
    ['Crimes', save.stats.crimes],
    ['Deaths', save.stats.deaths],
    ['Time played', `${Math.floor(save.played / 60)} min`],
  ];
  table.innerHTML = rows.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('');
}

function newGame(keepProgress) {
  save = keepProgress ? loadSave() : emptySave();
  if (!keepProgress) clearSave();
  if (!world) world = buildWorld(SEED, input);
  world.reset(save.mission);
  hud.setCash(save.cash);
  setScreen('play');
  announce('Playing SOLMAR. Drive to a gold marker to start a job.');
  audio.unlock();
}

function persistAll() {
  if (!world) return;
  save.pos = { x: world.player.state.x, z: world.player.state.z, heading: world.player.state.heading };
  save.ammo = world.player.state.ammo;
  save.hasPistol = world.player.state.hasPistol;
  writeSave(save);
}

function bindMenus() {
  document.getElementById('btn-play').addEventListener('click', () => { audio.click(); newGame(false); });
  document.getElementById('btn-continue').addEventListener('click', () => {
    audio.click();
    if (hasSave()) newGame(true);
    else newGame(false);
  });
  document.getElementById('btn-help').addEventListener('click', () => { audio.click(); setScreen('help'); });
  document.getElementById('btn-help-back').addEventListener('click', () => { audio.click(); setScreen('title'); });
  document.getElementById('btn-stats').addEventListener('click', () => { audio.click(); save = loadSave(); renderStats(); setScreen('stats'); });
  document.getElementById('btn-stats-back').addEventListener('click', () => { audio.click(); setScreen(currentScreen === 'paused' ? 'paused' : 'title'); });
  document.getElementById('btn-stats-pause').addEventListener('click', () => { audio.click(); renderStats(); setScreen('stats'); });
  document.getElementById('btn-resume').addEventListener('click', () => { audio.click(); setScreen('play'); });
  document.getElementById('btn-quit').addEventListener('click', () => {
    audio.click();
    persistAll();
    setScreen('title');
    save = loadSave();
  });
  document.getElementById('btn-hospital').addEventListener('click', () => {
    audio.click();
    if (world) world.respawnAtHospital();
  });
  document.getElementById('btn-missiondone').addEventListener('click', () => { audio.click(); setScreen('play'); });
  window.addEventListener('resize', () => { if (world) world.resize(); });
}

// ---------------------------------------------------------------------------
// Loops
// ---------------------------------------------------------------------------
let input = null;

function runShot(name) {
  input = createVirtualInput();
  world = buildWorld(SEED, input);
  world.forceSim = true;
  const scene = stageShot(name, world);
  world.cameraLocked = true;
  setScreen(scene.screen ?? 'title');
  if (scene.hudVisible === false) hud.show(false);
  else hud.show(true);
  hud.setCash(scene.cash ?? save.cash);
  hud.setStars(scene.wanted ?? 0);
  if (scene.objective) hud.setObjective(scene.objective.text, scene.objective.timer);
  hud.setHealth(scene.health ?? 1, scene.weapon ?? 'Fists');
  hud.setSpeed(scene.speed ?? 0, scene.speedVisible ?? false);
  hud.setClock(scene.clock ?? 0);
  world.render();
  requestAnimationFrame(() => {
    world.render();
    window.__shotReady = true;
  });
}

function runGame() {
  input = createInput(canvas);
  bindMenus();
  setScreen('title');
  const clock = new THREE.Clock();
  let accumulator = 0;

  function frame() {
    requestAnimationFrame(frame);
    const dt = Math.min(MAX_FRAME, clock.getDelta());
    if (!world) {
      // Title orbit over a live city: build once, then drift the camera around it.
      world = buildWorld(SEED, input);
      world.reset(save.mission);
      world.cameraLocked = true;
      setScreen('title');
    }
    if (currentScreen === 'play') {
      accumulator += dt;
      let steps = 0;
      while (accumulator >= STEP && steps < 4) {
        world.update(input);
        accumulator -= STEP;
        steps += 1;
      }
      input.endFrame();
    } else {
      accumulator = 0;
      if (currentScreen === 'title') {
        menuOrbit += dt * 0.055;
        const r = 128;
        const cx = 20 + Math.sin(menuOrbit) * r;
        const cz = 60 + Math.cos(menuOrbit) * r;
        world.camera.position.set(cx, 42 + Math.sin(menuOrbit * 0.7) * 6, cz);
        world.camera.lookAt(20, 14, 40);
        cityTick(dt);
        hud.drawMinimap({
          x: cx, z: cz, heading: menuOrbit + Math.PI,
          cars: world.vehicles.cars.filter((c) => c.driver === 'ai'),
          police: [], waypoint: null, spray: POI.spray, hospital: POI.hospital, marks: [],
        });
        world.renderer.render(world.scene, world.camera);
        input.endFrame();
        return;
      }
      input.endFrame();
    }
    if (currentScreen === 'play' || currentScreen === 'paused') {
      if (currentScreen === 'paused') {
        world.cameraLocked = true;
      } else {
        world.cameraLocked = false;
      }
      world.render();
    }
  }

  function cityTick(dt) {
    world.city.update(dt, performance.now() * 0.001);
    world.traffic.update(STEP * 0.5, false);
    world.pedestrians.update(STEP, world.player.state);
    world.vehicles.update(STEP, world.city);
  }

  // Leaving the tab pauses rather than letting the city run unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && currentScreen === 'play') {
      setScreen('paused');
      persistAll();
      announce('Paused.');
    }
  });

  window.addEventListener('beforeunload', persistAll);
  announce('SOLMAR. Press Play to start.');
  requestAnimationFrame(frame);
}

/** A stand-in for the keyboard used by the staged scenes: the same `down`/`pressed` shape. */
function createVirtualInput() {
  const held = new Set();
  const once = new Set();
  return {
    down(code) { return held.has(code); },
    pressed(code) { return once.has(code); },
    takePressed(code) { const had = once.has(code); once.delete(code); return had; },
    takeClick() { return false; },
    pointer: { dragging: false, dx: 0, dy: 0, wheel: 0, clicked: false, moved: 0 },
    hold(code) { held.add(code); },
    release(code) { held.delete(code); },
    tap(code) { once.add(code); },
    endFrame() { once.clear(); },
  };
}

installDebug({ getWorld: () => world, errors, getScreen: () => currentScreen, getSave: () => save, getSeed: () => SEED });

if (shotName) runShot(shotName);
else runGame();

export { buildWorld, CASH, SAVE_KEY, CAR_TYPES, CITY_HALF };
