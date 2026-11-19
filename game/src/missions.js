// The story and the side work. Three chained jobs for Mara Voss — First Fare, The Getaway,
// Harbor Run — each a small stage machine with a marker in the world, objective text, a
// minimap waypoint, contact dialogue and cash on success. Failing (timer out, car wrecked,
// caught) lets the player retry from the marker. Also here: taxi fares, the checkpoint time
// trial, and the ten hidden packages.

import * as THREE from 'three';
import { MISSION_STARTS, POI, CASH, CITY_HALF } from './config.js';
import { makeLabelTexture } from './city.js';

const MISSION_TEXT = [
  {
    name: 'First Fare',
    contact: 'Rosa',
    lines: [
      'Mara! My sister needs a ride from the boardwalk. Don\'t scratch the paint.',
      'She\'s at the south lot by the beach. Pick her up and take her to Mar Vista.',
      'Good. The meter\'s running — keep it smooth.',
    ],
  },
  {
    name: 'The Getaway',
    contact: 'Dex',
    lines: [
      'Job went sideways. The crew is waiting at El Sol, and every patrol in Solmar is awake.',
      'Get them to the spray shop on the east side. Lose the heat, change the plates.',
      'Clean car, clean exit. That\'s how it\'s done.',
    ],
  },
  {
    name: 'Harbor Run',
    contact: 'Ines',
    lines: [
      'Package at the harbor, second warehouse. It needs to be at the marina in ninety seconds.',
      'Police know something\'s moving tonight. Drive like the tide is behind you.',
      'Delivered. You just made a lot of people on this coast very happy.',
    ],
  },
];

const STORY = [
  {
    name: 'First Fare',
    stages: [
      { text: 'Drive to the pickup at the south lot', target: POI.fareSpot, radius: 7, kind: 'go' },
      { text: 'Take the contact to Mar Vista', target: { x: 196, z: 176 }, radius: 9, kind: 'deliver' },
    ],
    reward: CASH.mission[0],
    failTime: 0,
  },
  {
    name: 'The Getaway',
    stages: [
      { text: 'Pick up the crew at El Sol', target: { x: 44, z: -176 }, radius: 8, kind: 'go' },
      { text: 'Lose the heat — reach the Spray Shop', target: POI.spray, radius: 8, kind: 'evade', wanted: 2 },
    ],
    reward: CASH.mission[1],
    failTime: 0,
  },
  {
    name: 'Harbor Run',
    stages: [
      { text: 'Collect the package at the harbor', target: { x: -296, z: -120 }, radius: 8, kind: 'go' },
      { text: 'Deliver the package to the marina', target: { x: 240, z: 236 }, radius: 10, kind: 'timed', seconds: 90 },
    ],
    reward: CASH.mission[2],
    failTime: 90,
  },
];

function ringMesh(radius, color) {
  const group = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(radius * 0.86, radius, 40),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.42;
  const column = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.9, radius * 0.9, 9, 24, 1, true),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.14, side: THREE.DoubleSide, depthWrite: false }),
  );
  column.position.y = 4.5;
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.5, 30, 8, 1, true),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }),
  );
  beam.position.y = 15;
  group.add(ring, column, beam);
  group.userData.ring = ring;
  return group;
}

function signMesh(text, bg) {
  const mat = new THREE.MeshBasicMaterial({ map: makeLabelTexture(text, bg, '#ffe9b8'), transparent: true });
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(9, 2.25), mat);
  panel.position.y = 4.6;
  return panel;
}

export function createMissions(scene, player, vehicles, police, pedestrians, hud, audio, effects, rng, hooks) {
  const markerGroup = new THREE.Group();
  scene.add(markerGroup);
  const markers = [];
  let active = null;
  let storyDone = 0;
  let taxi = null;
  let trial = null;
  let trialBest = null;

  function addMarker(x, z, radius, color, label) {
    const mesh = ringMesh(radius, color);
    mesh.position.set(x, 0.2, z);
    if (label) {
      const sign = signMesh(label, '#2a1c10');
      sign.position.y = 5.2;
      sign.rotation.y = 0;
      mesh.add(sign);
      mesh.userData.sign = sign;
    }
    markerGroup.add(mesh);
    const marker = { x, z, radius, mesh, color };
    markers.push(marker);
    return marker;
  }

  function removeMarker(marker) {
    markerGroup.remove(marker.mesh);
    const index = markers.indexOf(marker);
    if (index >= 0) markers.splice(index, 1);
  }

  function clearMarkers() {
    for (const m of markers) markerGroup.remove(m.mesh);
    markers.length = 0;
  }

  function buildStoryMarkers() {
    clearMarkers();
    if (storyDone < 3) {
      const start = MISSION_STARTS[storyDone];
      addMarker(start.x, start.z, 6, 0xffc247, start.name.toUpperCase());
    }
    addMarker(POI.spray.x, POI.spray.z, 5, 0x4fc3d9, 'SPRAY');
    addMarker(POI.trialStart.x, POI.trialStart.z, 5, 0xa07ce0, 'TIME TRIAL');
    taxi = { marker: addMarker(POI.fareSpot.x + 12, POI.fareSpot.z, 4.5, 0x62d0a8, 'TAXI'), stage: 0 };
  }

  function resetStory(progress) {
    storyDone = progress ?? 0;
    active = null;
    trial = null;
    buildStoryMarkers();
  }

  function startMission(index) {
    const def = STORY[index];
    active = {
      index,
      stage: 0,
      def,
      timer: def.stages[0].seconds ?? 0,
      marker: null,
      crew: null,
      ended: false,
      clock: 0,
    };
    hud.subtitle(MISSION_TEXT[index].contact, MISSION_TEXT[index].lines[0]);
    audio.mission();
    setStageMarker();
    hooks?.onMissionStart?.(index);
  }

  function setStageMarker() {
    if (!active) return;
    if (active.marker) removeMarker(active.marker);
    const stage = active.def.stages[active.stage];
    active.marker = addMarker(stage.target.x, stage.target.z, stage.radius, 0xffc247, active.def.name.toUpperCase());
  }

  function endMission(success, reason) {
    if (!active || active.ended) return;
    active.ended = true;
    const index = active.index;
    if (active.marker) removeMarker(active.marker);
    if (active.crew) { pedestrians.people.splice(pedestrians.people.indexOf(active.crew), 1); scene.remove(active.crew.mesh); }
    if (success) {
      storyDone = Math.max(storyDone, index + 1);
      hud.subtitle(MISSION_TEXT[index].contact, MISSION_TEXT[index].lines[2]);
      audio.mission();
      hooks?.onMissionComplete?.(index, active.def.reward);
      active = null;
      buildStoryMarkers();
    } else {
      const def = active.def;
      active = null;
      hud.toast(`Mission failed — ${reason ?? 'try again'}`, 3.4);
      audio.fail();
      hooks?.onMissionFail?.(index);
      // Retry marker: put the story marker back so the player can drive to it again.
      buildStoryMarkers();
      void def;
    }
  }

  function distanceTo(x, z) {
    return Math.hypot(player.state.x - x, player.state.z - z);
  }

  function inCar() {
    return player.state.car !== null;
  }

  function updateMission(dt) {
    if (!active) return;
    active.clock += dt;
    const stage = active.def.stages[active.stage];
    if (active.crew) {
      active.crew.x = player.state.x;
      active.crew.z = player.state.z;
    }
    if (active.marker) {
      active.marker.mesh.rotation.y += dt * 0.6;
      const sign = active.marker.mesh.userData.sign;
      if (sign) sign.rotation.y = -active.marker.mesh.rotation.y;
      active.marker.mesh.position.y = 0.2 + Math.sin(performance.now() * 0.002) * 0.08;
    }

    if (stage.kind === 'timed') {
      active.timer -= dt;
      if (active.timer <= 0) {
        endMission(false, 'out of time');
        return;
      }
    }
    if (active.def.name === 'The Getaway' && active.stage === 1) {
      // The crew job starts hot: two stars until the spray shop.
      if (police.wanted < 2) police.setWanted(2);
    }
    if (active.def.name === 'Harbor Run' && active.stage === 1) {
      if (police.wanted < 2) police.setWanted(2);
    }

    const d = distanceTo(stage.target.x, stage.target.z);
    if (d > stage.radius) return;

    if (stage.kind === 'go' || stage.kind === 'deliver') {
      if (stage.kind === 'deliver' && !inCar()) {
        hud.toast('You need a car for this — E to get in', 2.2);
        return;
      }
      if (stage.kind === 'deliver' && inCar() && player.state.car.speed > 14) return;
      if (active.crew) {
        scene.remove(active.crew.mesh);
        const i = pedestrians.people.indexOf(active.crew);
        if (i >= 0) pedestrians.people.splice(i, 1);
        active.crew = null;
      }
      active.stage += 1;
      if (active.stage >= active.def.stages.length) {
        endMission(true);
      } else {
        active.timer = active.def.stages[active.stage].seconds ?? 0;
        hud.subtitle(MISSION_TEXT[active.index].contact, MISSION_TEXT[active.index].lines[1]);
        setStageMarker();
        if (active.def.name === 'The Getaway') {
          police.crime(2, hooks?.onCrime);
          const p = pedestrians.addStanding(player.state.x + 1.6, player.state.z + 1.2, 99);
          active.crew = p;
        }
      }
    } else if (stage.kind === 'evade') {
      if (police.wanted === 0 && inCar() && player.state.car.speed < 12) {
        active.stage += 1;
        endMission(true);
      } else if (police.wanted > 0) {
        hud.toast('Lose the police first — or hit the Spray Shop', 1.6);
      }
    }
  }

  function updateTaxi(dt) {
    if (!taxi) return;
    if (taxi.stage === 0) {
      const m = taxi.marker;
      if (m) m.mesh.rotation.y += dt * 0.6;
      if (distanceTo(m.x, m.z) < 6 && inCar() && player.state.car.speed < 6) {
        taxi.stage = 1;
        if (m) removeMarker(m);
        taxi.dest = { x: rng.pick([-240, -120, 120, 240]), z: rng.pick([-200, 40, 200, 260]) };
        taxi.marker = addMarker(taxi.dest.x, taxi.dest.z, 7, 0x62d0a8, 'FARE');
        taxi.farePed = pedestrians.addStanding(player.state.x + 2, player.state.z + 1, 99);
        hud.toast('Fare aboard — drive to the green marker', 2.6);
      }
    } else if (taxi.stage === 1) {
      if (taxi.marker) taxi.marker.mesh.rotation.y += dt * 0.6;
      if (taxi.marker && distanceTo(taxi.marker.x, taxi.marker.z) < 9 && inCar()) {
        if (player.state.car.speed < 10) {
          removeMarker(taxi.marker);
          if (taxi.farePed) {
            scene.remove(taxi.farePed.mesh);
            const i = pedestrians.people.indexOf(taxi.farePed);
            if (i >= 0) pedestrians.people.splice(i, 1);
          }
          taxi.stage = 0;
          audio.cash();
          hooks?.onSideReward?.(CASH.fare, 'Fare paid');
          taxi.marker = addMarker(POI.fareSpot.x + 12, POI.fareSpot.z, 4.5, 0x62d0a8, 'TAXI');
        }
      }
    }
  }

  function startTrial() {
    const route = [
      { x: 44, z: 176 }, { x: -44, z: 176 }, { x: -132, z: 176 }, { x: -132, z: 88 },
      { x: -132, z: 0 }, { x: -44, z: 0 }, { x: 44, z: 0 }, { x: 44, z: 88 },
    ];
    trial = { route, index: 0, time: 0, limit: 55, marker: null, best: trialBest };
    trial.marker = addMarker(route[0].x, route[0].z, 6, 0xa07ce0, 'CHECKPOINT 1');
    hud.toast('Time trial — hit every checkpoint', 2.6);
    audio.mission();
  }

  function endTrial(success) {
    if (!trial) return;
    if (trial.marker) removeMarker(trial.marker);
    if (success) {
      if (!trialBest || trial.time < trialBest) trialBest = trial.time;
      audio.cash();
      hooks?.onSideReward?.(CASH.trial, `Trial in ${trial.time.toFixed(1)}s`);
    } else {
      hud.toast('Time trial failed — try the marker again', 2.8);
      audio.fail();
    }
    trial = null;
  }

  function updateTrial(dt) {
    if (!trial) return;
    trial.time += dt;
    if (trial.time > trial.limit) {
      endTrial(false);
      return;
    }
    if (trial.marker) trial.marker.mesh.rotation.y += dt * 0.8;
    const point = trial.route[trial.index];
    if (distanceTo(point.x, point.z) < 8 && inCar()) {
      trial.index += 1;
      audio.pickup();
      if (trial.index >= trial.route.length) {
        endTrial(true);
        return;
      }
      if (trial.marker) removeMarker(trial.marker);
      const next = trial.route[trial.index];
      trial.marker = addMarker(next.x, next.z, 6, 0xa07ce0, `CHECKPOINT ${trial.index + 1}`);
    }
  }

  function update(dt) {
    updateMission(dt);
    updateTaxi(dt);
    updateTrial(dt);
    for (const m of markers) {
      if (m.mesh.userData.sign) m.mesh.userData.sign.rotation.y = -m.mesh.rotation.y;
    }
  }

  function waypoint() {
    if (active) {
      const stage = active.def.stages[active.stage];
      return { x: stage.target.x, z: stage.target.z };
    }
    if (trial) {
      const point = trial.route[trial.index];
      return { x: point.x, z: point.z };
    }
    if (taxi && taxi.stage === 1 && taxi.dest) return { x: taxi.dest.x, z: taxi.dest.z };
    if (storyDone < 3) {
      const start = MISSION_STARTS[storyDone];
      return { x: start.x, z: start.z };
    }
    return null;
  }

  function objective() {
    if (active) {
      const stage = active.def.stages[active.stage];
      let timer = null;
      if (stage.kind === 'timed') timer = `${Math.max(0, Math.ceil(active.timer))}s`;
      return { text: `${active.def.name}: ${stage.text}`, timer };
    }
    if (trial) return { text: `Time trial: checkpoint ${trial.index + 1} of ${trial.route.length}`, timer: `${Math.max(0, Math.ceil(trial.limit - trial.time))}s` };
    if (taxi && taxi.stage === 1) return { text: 'Taxi fare: drive to the green marker', timer: null };
    if (storyDone < 3) return { text: `Drive to the ${MISSION_STARTS[storyDone].name} marker`, timer: null };
    return { text: 'Free roam Solmar — side jobs are on the map', timer: null };
  }

  /** Called by main when the player stands in a story marker or the trial marker. */
  function checkEntry() {
    if (active) return null;
    if (storyDone < 3) {
      const start = MISSION_STARTS[storyDone];
      if (distanceTo(start.x, start.z) < 7) {
        startMission(storyDone);
        return 'mission';
      }
    }
    if (!trial && distanceTo(POI.trialStart.x, POI.trialStart.z) < 6 && inCar()) {
      startTrial();
      return 'trial';
    }
    return null;
  }

  return {
    markers,
    get active() { return active; },
    get storyDone() { return storyDone; },
    get trialBest() { return trialBest; },
    get taxi() { return taxi; },
    resetStory, startMission, endMission, update, waypoint, objective, checkEntry,
    failActive(reason) { if (active) endMission(false, reason); },
    clearAll() {
      active = null;
      trial = null;
      clearMarkers();
    },
    taxiStage() { return taxi ? taxi.stage : 0; },
    /** Used by the staged screenshot scenes to jump a mission to a later stage. */
    debugSetStage(stage) {
      if (!active) return;
      active.stage = Math.min(stage, active.def.stages.length - 1);
      active.timer = active.def.stages[active.stage].seconds ?? 0;
      setStageMarker();
    },
  };
}
