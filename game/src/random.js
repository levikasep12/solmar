// A seeded generator (mulberry32) so ?seed=N always rebuilds the same city, the same
// traffic and the same pedestrian spawns. One instance per concern keeps the streams
// independent: adding a lamp must not reshuffle the pedestrians.

export function createRandom(seed) {
  let state = (seed >>> 0) || 0x9e3779b9;
  function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  return {
    next,
    range(min, max) {
      return min + next() * (max - min);
    },
    int(min, max) {
      return Math.floor(min + next() * (max - min + 1));
    },
    pick(list) {
      return list[Math.floor(next() * list.length)];
    },
    chance(p) {
      return next() < p;
    },
  };
}

/** A cheap separate stream from a string key, so one seed feeds many independent systems. */
export function streamFor(seed, salt) {
  let h = (seed ^ 0x811c9dc5) >>> 0;
  for (let i = 0; i < salt.length; i += 1) {
    h ^= salt.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return createRandom(h);
}
