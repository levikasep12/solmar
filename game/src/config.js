// Tuning for SOLMAR: one sun-soaked coastal city built from a seeded street grid.
// Everything that shapes the world or the feel of driving lives here so the rest of
// the code reads as behaviour, not numbers.

export const STEP = 1 / 60;
export const MAX_FRAME = 0.2;
export const SAVE_KEY = 'solmar-save-v1';

// --- street grid -----------------------------------------------------------
export const CELL = 88;
export const GRID = 3; // road lines at -3..3 times CELL: seven avenues each way
export const LINES = Array.from({ length: GRID * 2 + 1 }, (_, i) => (i - GRID) * CELL);
export const ROAD_HALF = 9;
export const SIDEWALK = 5;
export const CITY_HALF = (GRID + 0.5) * CELL; // 308
export const LAND_WEST = -340;
export const BEACH_Z = 308;
export const SHORE_Z = 372;
export const SEA_WEST = -340;

// --- palette: golden hour on the coast -------------------------------------
export const PALETTE = {
  skyTop: 0x5d7fb4,
  skyHorizon: 0xffd39a,
  sun: 0xffbf74,
  fog: 0xf2cfa0,
  fogNear: 150,
  fogFar: 640,
  sunLight: 0xffd2a0,
  hemiSky: 0xffd9b0,
  hemiGround: 0x6b5442,
  asphalt: 0x35353c,
  roadLine: 0xe8d9b0,
  sidewalk: 0xb7ac9c,
  lot: 0x8d8477,
  sand: 0xe2c58e,
  sea: 0x2c6b7c,
  grass: 0x6f8c4a,
  buildingWarm: [0xd9a86a, 0xc98f7a, 0xe3c49a, 0xb98b74, 0xd7bd93, 0xc9a48b, 0xe0b07f, 0xbba08c],
  palm: 0x4f7f3e,
  foliage: 0x5f8340,
  taxi: 0xefc32a,
  police: 0x24344d,
  marker: 0xffc247,
  blipMission: 0xffd24a,
  blipPolice: 0xff4a4a,
  blipCar: 0xdfe8f0,
  pedShirts: [0xd96a4a, 0x4f7fa8, 0xe0c060, 0x8d5b9e, 0x4f9a76, 0xd9819a, 0xdfe0d4],
  pedPants: [0x3a3f4a, 0x5a4a3a, 0x2f3a44, 0x6b6048],
};

// --- the cars of Solmar -----------------------------------------------------
// top m/s, accel m/s^2, brake m/s^2, steer rad/s at speed, len/wid/hgt in metres.
export const CAR_TYPES = {
  sedan: { name: 'Sedan', color: 0xd6d0c2, top: 31, accel: 10, brake: 20, steer: 2.0, len: 4.6, wid: 2.0, hgt: 1.15, roof: 0.62, weight: 1 },
  coupe: { name: 'Coupe', color: 0xa93b2f, top: 36, accel: 12, brake: 21, steer: 2.2, len: 4.4, wid: 2.0, hgt: 1.0, roof: 0.55, weight: 0.9 },
  pickup: { name: 'Pickup', color: 0x48613f, top: 29, accel: 9, brake: 18, steer: 1.8, len: 5.1, wid: 2.15, hgt: 1.2, roof: 0.6, weight: 1.2 },
  van: { name: 'Van', color: 0xcbbd9f, top: 26, accel: 8, brake: 17, steer: 1.7, len: 5.4, wid: 2.2, hgt: 1.75, roof: 0.1, weight: 1.3 },
  sports: { name: 'Comet', color: 0xe2b23c, top: 45, accel: 16, brake: 24, steer: 2.5, len: 4.4, wid: 2.02, hgt: 0.9, roof: 0.45, weight: 0.8 },
  taxi: { name: 'Taxi', color: 0xefc32a, top: 32, accel: 10, brake: 20, steer: 2.0, len: 4.7, wid: 2.0, hgt: 1.2, roof: 0.6, weight: 1 },
  police: { name: 'Patrol', color: 0x24344d, top: 38, accel: 14, brake: 22, steer: 2.3, len: 4.8, wid: 2.05, hgt: 1.2, roof: 0.6, weight: 1.1 },
};
export const TRAFFIC_TYPES = ['sedan', 'coupe', 'pickup', 'van', 'sports', 'taxi'];

// --- player ----------------------------------------------------------------
export const PLAYER = {
  walk: 5.4,
  run: 9.2,
  jump: 5.6,
  radius: 0.5,
  health: 100,
  startX: 84,
  startZ: 84,
  startHeading: Math.PI,
  eye: 1.6,
};
export const COMBAT = {
  punchRange: 2.4,
  punchDamage: 14,
  pistolRange: 65,
  pistolDamage: 34,
  startAmmo: 12,
  pickupAmmo: 8,
};

// --- wanted ----------------------------------------------------------------
export const WANTED = {
  max: 5,
  decayDelay: 13, // seconds out of sight before a star cools
  decayEvery: 7,
  policeSpawnDistance: 110,
  maxChasers: 4,
};

export const MISSION_STARTS = [
  { x: -264, z: 88, name: 'First Fare' },
  { x: 88, z: 176, name: 'The Getaway' },
  { x: -264, z: -88, name: 'Harbor Run' },
];
export const POI = {
  spray: { x: 176, z: 44 },
  hospital: { x: 176, z: -176 },
  fareSpot: { x: 88, z: -44 },
  trialStart: { x: 44, z: 176 },
};

export const CASH = { mission: [500, 900, 1500], package: 100, fare: 250, trial: 400, ammo: 60 };
