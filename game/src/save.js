// localStorage save: cash, story progress, packages, stats and where Mara was standing
// (or which car she was in). Private windows can refuse storage, so every read and write
// is wrapped — a missing save is just a new game, never a crash.

import { SAVE_KEY, PLAYER } from './config.js';

export function emptySave() {
  return {
    cash: 0,
    mission: 0, // index of the next story mission, 0..3 (3 = all done)
    missionStage: 0,
    packages: [],
    ammo: 0,
    hasPistol: false,
    stats: { missions: 0, stolen: 0, distance: 0, packages: 0, fares: 0, trials: 0, crimes: 0, deaths: 0 },
    pos: { x: PLAYER.startX, z: PLAYER.startZ, heading: PLAYER.startHeading },
    played: 0,
  };
}

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return emptySave();
    const data = JSON.parse(raw);
    return { ...emptySave(), ...data, stats: { ...emptySave().stats, ...(data.stats ?? {}) } };
  } catch {
    return emptySave();
  }
}

export function writeSave(save) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    return true;
  } catch {
    return false;
  }
}

export function hasSave() {
  try {
    return window.localStorage.getItem(SAVE_KEY) !== null;
  } catch {
    return false;
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // nothing to do
  }
}
