// SOLMAR's city, built entirely in code: a seven-by-seven avenue grid, sidewalk blocks
// with warm towers (canvas-drawn windows), a palm-lined beach and boardwalk, a west
// harbor with piers and cranes, a park, lamps, traffic signals and signs. Buildings,
// trees, palms, lamps and road paint are instanced so the whole place costs a handful
// of draw calls. Golden-hour sun, warm hemisphere fill, soft fog, one 1024 shadow map.

import * as THREE from 'three';
import { PALETTE, CELL, GRID, CITY_HALF, BEACH_Z, LINES } from './config.js';

const UP = new THREE.Vector3(0, 1, 0);
const BLOCK_MIN = LINES[0];
const BLOCK_SPAN = 70;
const LOT = 60;

function canvasTexture(width, height, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext('2d'), width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/** A lit-for-evening window grid, one texture per building height class. */
function windowTexture(floors, shop) {
  return canvasTexture(128, 256, (ctx, w, h) => {
    ctx.fillStyle = '#e6d6bd';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(90,70,52,0.16)';
    for (let f = 0; f < floors; f += 1) ctx.fillRect(0, (f / floors) * h, w, 2);
    const cols = 4;
    const lights = ['#2f4154', '#38495c', '#2a3949', '#ffd492', '#ffcf85', '#3c4d5f'];
    const cellH = h / floors;
    for (let f = 0; f < floors; f += 1) {
      for (let c = 0; c < cols; c += 1) {
        const x = 8 + c * ((w - 16) / cols);
        const y = f * cellH + cellH * 0.24;
        const ww = (w - 16) / cols - 7;
        const wh = cellH * 0.5;
        ctx.fillStyle = lights[Math.floor(Math.random() * lights.length)];
        ctx.fillRect(x, y, ww, wh);
        ctx.fillStyle = 'rgba(255,240,210,0.22)';
        ctx.fillRect(x, y, ww, 2);
      }
    }
    if (shop) {
      const g = h / floors;
      ctx.fillStyle = '#5b3b2e';
      ctx.fillRect(0, h - g, w, g);
      ctx.fillStyle = '#8c3f33';
      ctx.fillRect(0, h - g, w, g * 0.22);
      ctx.fillStyle = '#ffdda4';
      for (let c = 0; c < 3; c += 1) {
        ctx.fillRect(10 + c * 40, h - g * 0.7, 28, g * 0.45);
      }
    }
  });
}

export function makeLabelTexture(text, bg, fg) {
  return canvasTexture(512, 128, (ctx, w, h) => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = fg;
    ctx.lineWidth = 6;
    ctx.strokeRect(8, 8, w - 16, h - 16);
    ctx.fillStyle = fg;
    ctx.font = 'bold 62px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, h / 2 + 3);
  });
}

function instance(geometry, material, items, opts = {}) {
  const mesh = new THREE.InstancedMesh(geometry, material, Math.max(1, items.length));
  const matrix = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const color = new THREE.Color();
  items.forEach((item, i) => {
    pos.set(item.x, item.y, item.z);
    quat.setFromAxisAngle(UP, item.rot ?? 0);
    scale.set(item.sx ?? 1, item.sy ?? 1, item.sz ?? 1);
    matrix.compose(pos, quat, scale);
    mesh.setMatrixAt(i, matrix);
    if (item.color !== undefined) mesh.setColorAt(i, color.set(item.color));
  });
  mesh.count = items.length;
  mesh.instanceMatrix.needsUpdate = true;
  if (items.length && items[0].color !== undefined) mesh.instanceColor.needsUpdate = true;
  mesh.castShadow = opts.cast !== false;
  mesh.receiveShadow = opts.receive !== false;
  mesh.frustumCulled = false;
  return mesh;
}

export function createCity(scene, rng) {
  const group = new THREE.Group();
  scene.add(group);
  const colliders = [];
  const buildings = [[], [], []];
  const roofs = [];
  const palms = [];
  const lamps = [];
  const crosswalks = [];
  const dashes = [];
  const signals = [];
  const parkTrees = [];
  const umbrellas = [];
  const containers = [];

  // --- ground, sea, asphalt --------------------------------------------------
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(2200, 2200),
    new THREE.MeshStandardMaterial({ color: PALETTE.sea, roughness: 0.18, metalness: 0.35 }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, -0.6, 0);
  sea.receiveShadow = true;
  group.add(sea);

  const land = new THREE.Mesh(
    new THREE.PlaneGeometry(712, 730),
    new THREE.MeshStandardMaterial({ color: 0x8b8172, roughness: 1 }),
  );
  land.rotation.x = -Math.PI / 2;
  land.position.set(6, 0, 11);
  land.receiveShadow = true;
  group.add(land);

  const asphalt = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY_HALF * 2, CITY_HALF * 2),
    new THREE.MeshStandardMaterial({ color: PALETTE.asphalt, roughness: 0.95 }),
  );
  asphalt.rotation.x = -Math.PI / 2;
  asphalt.position.set(0, 0.04, 0);
  asphalt.receiveShadow = true;
  group.add(asphalt);

  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(720, 74),
    new THREE.MeshStandardMaterial({ color: PALETTE.sand, roughness: 1 }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(6, 0.12, BEACH_Z + 33);
  sand.receiveShadow = true;
  group.add(sand);

  const surf = new THREE.Mesh(
    new THREE.PlaneGeometry(720, 26),
    new THREE.MeshStandardMaterial({ color: 0x9fd4d2, roughness: 0.6, transparent: true, opacity: 0.8 }),
  );
  surf.rotation.x = -Math.PI / 2;
  surf.position.set(6, 0.14, 379);
  group.add(surf);

  // --- block platforms, sidewalks, lots -------------------------------------
  const platformMat = new THREE.MeshStandardMaterial({ color: PALETTE.sidewalk, roughness: 0.95 });
  const lotMat = new THREE.MeshStandardMaterial({ color: PALETTE.lot, roughness: 1 });
  const curbGeom = new THREE.BoxGeometry(1, 1, 1);
  const platformItems = [];
  const lotItems = [];
  const parkBlock = { i: 0, j: 1 };
  for (let i = 0; i < GRID * 2; i += 1) {
    for (let j = 0; j < GRID * 2; j += 1) {
      const bx = BLOCK_MIN + i * CELL + 9;
      const bz = BLOCK_MIN + j * CELL + 9;
      platformItems.push({ x: bx + BLOCK_SPAN / 2, y: 0.1, z: bz + BLOCK_SPAN / 2, sx: BLOCK_SPAN, sy: 0.32, sz: BLOCK_SPAN });
      const isPark = i === parkBlock.i && j === parkBlock.j;
      lotItems.push({
        x: bx + BLOCK_SPAN / 2, y: 0.27, z: bz + BLOCK_SPAN / 2,
        sx: LOT, sy: 0.02, sz: LOT, color: isPark ? PALETTE.grass : PALETTE.lot,
      });
    }
  }
  group.add(instance(curbGeom, platformMat, platformItems, { cast: false }));
  group.add(instance(curbGeom, lotMat, lotItems.map((it) => ({ ...it, color: it.color })), { cast: false }));

  // --- crosswalks and centre dashes ----------------------------------------
  for (let a = 0; a < LINES.length; a += 1) {
    for (let b = 0; b < LINES.length; b += 1) {
      const x = LINES[a];
      const z = LINES[b];
      for (const side of [-1, 1]) {
        for (let s = -ROAD_STRIPE_MIN(); s <= ROAD_STRIPE_MIN(); s += 2.6) {
          crosswalks.push({ x: x + s, y: 0.06, z: z + side * 13, sx: 1.1, sy: 0.02, sz: 5.4 });
          crosswalks.push({ x: x + side * 13, y: 0.06, z: z + s, sx: 5.4, sy: 0.02, sz: 1.1 });
        }
      }
    }
  }
  function ROAD_STRIPE_MIN() { return 7.4; }
  for (const line of LINES) {
    for (let t = -CITY_HALF + 8; t < CITY_HALF; t += 11) {
      if (LINES.some((l) => Math.abs(t - l) < 17)) continue;
      dashes.push({ x: line, y: 0.055, z: t, sx: 0.24, sy: 0.02, sz: 3.6 });
      dashes.push({ x: t, y: 0.055, z: line, sx: 3.6, sy: 0.02, sz: 0.24 });
    }
  }
  const paintMat = new THREE.MeshStandardMaterial({ color: PALETTE.roadLine, roughness: 0.8 });
  group.add(instance(curbGeom, paintMat, crosswalks, { cast: false }));
  group.add(instance(curbGeom, paintMat, dashes, { cast: false }));

  // --- buildings by block ---------------------------------------------------
  const blocks = [];
  for (let i = 0; i < GRID * 2; i += 1) {
    for (let j = 0; j < GRID * 2; j += 1) {
      const bx = BLOCK_MIN + i * CELL + 9 + 5;
      const bz = BLOCK_MIN + j * CELL + 9 + 5;
      const cx = bx + LOT / 2;
      const cz = bz + LOT / 2;
      const isPark = i === parkBlock.i && j === parkBlock.j;
      blocks.push({ i, j, cx, cz, isPark });
      if (isPark) continue;
      const downtown = Math.abs(cx) < 140 && Math.abs(cz) < 140;
      const beachside = cz > 150;
      const west = cx < -180;
      const lots = [];
      const layout = rng.next();
      if (layout < 0.18) {
        lots.push({ x: cx, z: cz, w: 50, d: 50 });
      } else if (layout < 0.4) {
        lots.push({ x: cx - 14.5, z: cz, w: 26, d: 52 });
        lots.push({ x: cx + 14.5, z: cz, w: 26, d: 52 });
      } else {
        for (const ox of [-14.5, 14.5]) {
          for (const oz of [-14.5, 14.5]) {
            lots.push({ x: cx + ox, z: cz + oz, w: rng.range(22, 27), d: rng.range(22, 27) });
          }
        }
      }
      for (const lot of lots) {
        let h;
        if (downtown) h = rng.range(28, 76);
        else if (west) h = rng.range(7, 13);
        else if (beachside) h = rng.range(6, 15);
        else h = rng.range(9, 24);
        const color = rng.pick(PALETTE.buildingWarm);
        const bucket = h < 16 ? 0 : h < 34 ? 1 : 2;
        buildings[bucket].push({ x: lot.x, y: h / 2, z: lot.z, sx: lot.w, sy: h, sz: lot.d, color });
        roofs.push({ x: lot.x, y: h + 0.4, z: lot.z, sx: lot.w + 0.6, sy: 0.8, sz: lot.d + 0.6, color: 0x6a5849 });
        colliders.push({
          minX: lot.x - lot.w / 2, maxX: lot.x + lot.w / 2,
          minZ: lot.z - lot.d / 2, maxZ: lot.z + lot.d / 2,
        });
      }
    }
  }
  const boxGeom = new THREE.BoxGeometry(1, 1, 1);
  const windowTextures = [windowTexture(4, true), windowTexture(9, true), windowTexture(18, false)];
  buildings.forEach((list, index) => {
    if (!list.length) return;
    const material = new THREE.MeshStandardMaterial({
      map: windowTextures[index], color: 0xffffff, roughness: 0.9, metalness: 0.04,
    });
    group.add(instance(boxGeom, material, list));
  });
  group.add(instance(boxGeom, new THREE.MeshStandardMaterial({ roughness: 0.9, color: 0x8a7461 }), roofs));

  // --- palms, lamps, trees, signals ----------------------------------------
  for (let axis = 0; axis < 2; axis += 1) {
    for (const line of LINES) {
      for (let t = -CITY_HALF + 14; t < CITY_HALF - 8; t += 26) {
        if (LINES.some((l) => Math.abs(t - l) < 20)) continue;
        const sided = (Math.floor(t / 26) % 2 === 0) ? 1 : -1;
        const x = axis === 0 ? t : line + 12.6 * sided;
        const z = axis === 0 ? line + 12.6 * sided : t;
        palms.push({ x, y: 0.3, z, sx: rng.range(0.85, 1.15), sy: rng.range(0.85, 1.25), sz: rng.range(0.85, 1.15), rot: rng.range(0, 6.28) });
        if (Math.floor(t / 26) % 2 === 0) {
          lamps.push({ x: axis === 0 ? t + 7 : line - 10 * sided, y: 0.3, z: axis === 0 ? line - 10 * sided : t + 7, rot: 0 });
        }
      }
    }
  }
  for (const b of blocks) {
    if (!b.isPark) continue;
    for (let t = 0; t < 16; t += 1) {
      const a = rng.range(0, Math.PI * 2);
      const r = Math.sqrt(rng.next()) * 24;
      parkTrees.push({ x: b.cx + Math.cos(a) * r, y: 0.3, z: b.cz + Math.sin(a) * r, sx: rng.range(0.8, 1.3), sy: rng.range(0.8, 1.4), sz: rng.range(0.8, 1.3), rot: rng.range(0, 6.28) });
    }
  }

  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8a6a45, roughness: 1 });
  const palmMat = new THREE.MeshStandardMaterial({ color: PALETTE.palm, roughness: 0.9 });
  const palmTrunkGeom = new THREE.CylinderGeometry(0.2, 0.34, 7, 6);
  const palmCrownGeom = new THREE.SphereGeometry(2.7, 7, 5);
  const palmCrown2Geom = new THREE.SphereGeometry(1.9, 6, 4);
  const palmTrunks = palms.map((p) => ({ ...p, y: p.y + 3.5 * p.sy, sx: p.sx, sy: p.sy, sz: p.sz }));
  group.add(instance(palmTrunkGeom, trunkMat, palmTrunks));
  group.add(instance(palmCrownGeom, palmMat, palms.map((p) => ({ ...p, y: 7.1 * p.sy + 0.3, sy: p.sy * 0.42 }))));
  group.add(instance(palmCrown2Geom, palmMat, palms.map((p) => ({ ...p, y: 6.1 * p.sy + 0.3, sx: p.sx * 1.1, sy: p.sy * 0.34, sz: p.sz * 1.1 }))));

  const poleGeom = new THREE.CylinderGeometry(0.1, 0.13, 1, 6);
  const lampPoleMat = new THREE.MeshStandardMaterial({ color: 0x4c4c52, roughness: 0.7, metalness: 0.5 });
  group.add(instance(poleGeom, lampPoleMat, lamps.map((l) => ({ ...l, y: 4, sy: 8 }))));
  const lampHeadGeom = new THREE.BoxGeometry(1.9, 0.22, 0.7);
  const lampHeadMat = new THREE.MeshStandardMaterial({ color: 0x2e2e33, emissive: 0xffca7a, emissiveIntensity: 1.6 });
  group.add(instance(lampHeadGeom, lampHeadMat, lamps.map((l) => ({ ...l, y: 8.1 }))));

  const treeTrunkMat = new THREE.MeshStandardMaterial({ color: 0x6b5034, roughness: 1 });
  group.add(instance(new THREE.CylinderGeometry(0.24, 0.4, 3.4, 6), treeTrunkMat, parkTrees.map((t) => ({ ...t, y: 1.9 * t.sy, sy: t.sy }))));
  group.add(instance(new THREE.SphereGeometry(2.6, 7, 5), new THREE.MeshStandardMaterial({ color: PALETTE.foliage, roughness: 1 }), parkTrees.map((t) => ({ ...t, y: 5.0 * t.sy, sy: t.sy * 0.9 }))));

  for (const x of LINES) {
    for (const z of LINES) {
      for (const [ox, oz] of [[10.6, 10.6], [-10.6, -10.6], [10.6, -10.6], [-10.6, 10.6]]) {
        signals.push({ x: x + ox, y: 0.3, z: z + oz, axis: oz > 0 ? 0 : 1 });
      }
    }
  }
  group.add(instance(new THREE.CylinderGeometry(0.09, 0.11, 4.6, 5), lampPoleMat, signals.map((s) => ({ x: s.x, y: 2.6, z: s.z }))));
  group.add(instance(new THREE.BoxGeometry(0.5, 1.15, 0.5), new THREE.MeshStandardMaterial({ color: 0x22222a }), signals.map((s) => ({ x: s.x, y: 5.2, z: s.z }))));
  const lampGeom = new THREE.SphereGeometry(0.17, 6, 5);
  const signalLampMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const signalLamps = instance(lampGeom, signalLampMat, signals.flatMap((s) => ([
    { x: s.x, y: 5.55, z: s.z, color: 0x4a1010 },
    { x: s.x, y: 5.2, z: s.z, color: 0x4a3a10 },
    { x: s.x, y: 4.85, z: s.z, color: 0x0f3a18 },
  ])), { cast: false });
  group.add(signalLamps);

  // --- park fountain --------------------------------------------------------
  const park = blocks.find((b) => b.isPark);
  if (park) {
    const fountain = new THREE.Group();
    const basin = new THREE.Mesh(
      new THREE.CylinderGeometry(5, 5.4, 0.9, 20),
      new THREE.MeshStandardMaterial({ color: 0xb5aa98, roughness: 0.8 }),
    );
    basin.position.y = 0.45;
    const water = new THREE.Mesh(
      new THREE.CylinderGeometry(4.4, 4.4, 0.2, 20),
      new THREE.MeshStandardMaterial({ color: 0x5d9aa6, roughness: 0.15, metalness: 0.4 }),
    );
    water.position.y = 0.86;
    const column = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.8, 3, 10),
      new THREE.MeshStandardMaterial({ color: 0xc8bda8, roughness: 0.8 }),
    );
    column.position.y = 1.9;
    fountain.add(basin, water, column);
    fountain.position.set(park.cx, 0.3, park.cz);
    fountain.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    group.add(fountain);
  }

  // --- beach props ----------------------------------------------------------
  const boardwalk = new THREE.Mesh(
    new THREE.BoxGeometry(720, 0.5, 9),
    new THREE.MeshStandardMaterial({ color: 0xa07b53, roughness: 0.95 }),
  );
  boardwalk.position.set(6, 0.22, BEACH_Z - 1);
  boardwalk.receiveShadow = true;
  group.add(boardwalk);
  for (let x = -300; x <= 320; x += 38) {
    umbrellas.push({ x: x + rng.range(-8, 8), z: BEACH_Z + rng.range(12, 40), rot: rng.range(0, 6.28), color: rng.pick([0xd9584f, 0xe0a63c, 0x4f88a8, 0xd97f9a]) });
  }
  group.add(instance(new THREE.CylinderGeometry(0.06, 0.08, 2.6, 5), new THREE.MeshStandardMaterial({ color: 0xdddddd }), umbrellas.map((u) => ({ ...u, y: 1.4 }))));
  group.add(instance(new THREE.ConeGeometry(1.9, 1.1, 8), new THREE.MeshStandardMaterial({ roughness: 0.9 }), umbrellas.map((u) => ({ ...u, y: 2.6 }))));
  for (let x = -300; x <= 320; x += 46) {
    palms.push({ x, y: 0.3, z: BEACH_Z + 4, sx: 1.1, sy: 1.2, sz: 1.1, rot: rng.range(0, 6.28) });
  }

  // --- harbor: warehouses, piers, cranes, containers ------------------------
  const warehouseMat = new THREE.MeshStandardMaterial({ color: 0x8d7f6b, roughness: 0.95 });
  for (let z = -240; z <= 240; z += 80) {
    const w = new THREE.Mesh(new THREE.BoxGeometry(30, 9, 58), warehouseMat);
    w.position.set(-324, 4.5, z);
    w.castShadow = true;
    w.receiveShadow = true;
    group.add(w);
    colliders.push({ minX: -339, maxX: -309, minZ: z - 29, maxZ: z + 29 });
  }
  const pierMat = new THREE.MeshStandardMaterial({ color: 0x9a7c55, roughness: 0.95 });
  const craneMat = new THREE.MeshStandardMaterial({ color: 0xd9a53a, roughness: 0.6, metalness: 0.3 });
  const cranes = [];
  for (const z of [-196, -96, 44, 144]) {
    const pier = new THREE.Mesh(new THREE.BoxGeometry(96, 1, 15), pierMat);
    pier.position.set(-386, 0.5, z);
    pier.receiveShadow = true;
    group.add(pier);
    const crane = new THREE.Group();
    const tower = new THREE.Mesh(new THREE.BoxGeometry(3, 26, 3), craneMat);
    tower.position.y = 13;
    const boom = new THREE.Mesh(new THREE.BoxGeometry(30, 1.4, 2), craneMat);
    boom.position.set(-9, 26, 0);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(3.4, 3, 3.4), new THREE.MeshStandardMaterial({ color: 0x3f4a52 }));
    cab.position.y = 24;
    crane.add(tower, boom, cab);
    crane.position.set(-392, 1, z);
    crane.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    group.add(crane);
    cranes.push(crane);
    for (let c = 0; c < 5; c += 1) {
      containers.push({ x: -344 + rng.range(-4, 4), y: 1.4 + c * 0.1, z: z - 12 + c * 6, sx: 6.2, sy: 2.6, sz: 2.5, rot: 0, color: rng.pick([0xb04a3a, 0x3a6a8c, 0x4f7a48, 0xd9a53a]) });
    }
  }
  group.add(instance(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.9 }), containers.map((c, i) => ({ ...c, y: 1.5 + (i % 2) * 2.8 }))));

  // --- shop signs and billboards -------------------------------------------
  const signs = [
    { x: 74, z: 300, ry: 0, text: 'SOLMAR BEACH', bg: '#1e5a63', fg: '#ffe6ae' },
    { x: -20, z: 60, ry: Math.PI / 2, text: 'HOTEL AZUL', bg: '#7a2f35', fg: '#ffe1a8' },
    { x: 148, z: 24, ry: -Math.PI / 2, text: 'MAR VISTA', bg: '#2b4a6b', fg: '#ffd98a' },
    { x: -300, z: 20, ry: 0, text: 'PORT OF SOLMAR', bg: '#3a4a3a', fg: '#f2d9a0' },
    { x: 44, z: 208, ry: Math.PI, text: 'EL SOL', bg: '#b4552f', fg: '#fff0c8' },
  ];
  for (const sign of signs) {
    const mat = new THREE.MeshBasicMaterial({ map: makeLabelTexture(sign.text, sign.bg, sign.fg) });
    const panel = new THREE.Mesh(new THREE.BoxGeometry(10, 2.6, 0.25), mat);
    panel.position.set(sign.x, 6.4, sign.z);
    panel.rotation.y = sign.ry;
    const legMat = new THREE.MeshStandardMaterial({ color: 0x33333a });
    for (const off of [-3.6, 3.6]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 5.2, 0.2), legMat);
      leg.position.set(sign.x + Math.cos(sign.ry) * off, 2.6, sign.z - Math.sin(sign.ry) * off);
      group.add(leg);
    }
    group.add(panel);
  }

  // --- sky, sun, fog --------------------------------------------------------
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(900, 24, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        top: { value: new THREE.Color(PALETTE.skyTop) },
        horizon: { value: new THREE.Color(PALETTE.skyHorizon) },
      },
      vertexShader: 'varying vec3 vPos; void main(){ vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'varying vec3 vPos; uniform vec3 top; uniform vec3 horizon; void main(){ float h = clamp(normalize(vPos).y * 1.6 + 0.16, 0.0, 1.0); gl_FragColor = vec4(mix(horizon, top, pow(h, 0.75)), 1.0); }',
    }),
  );
  scene.add(sky);
  scene.fog = new THREE.Fog(PALETTE.fog, PALETTE.fogNear, PALETTE.fogFar);
  scene.background = new THREE.Color(PALETTE.skyHorizon);

  const sunTex = canvasTexture(128, 128, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,247,214,1)');
    g.addColorStop(0.22, 'rgba(255,205,130,0.95)');
    g.addColorStop(0.6, 'rgba(255,170,90,0.28)');
    g.addColorStop(1, 'rgba(255,150,80,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
  const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunTex, transparent: true, depthWrite: false, fog: false }));
  sunSprite.scale.set(190, 190, 1);
  sunSprite.position.set(-430, 74, 660);
  scene.add(sunSprite);

  const sun = new THREE.DirectionalLight(PALETTE.sunLight, 2.6);
  sun.position.set(-150, 120, 200);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.near = 10;
  sun.shadow.camera.far = 520;
  sun.shadow.camera.left = -120;
  sun.shadow.camera.right = 120;
  sun.shadow.camera.top = 120;
  sun.shadow.camera.bottom = -120;
  sun.shadow.bias = -0.0006;
  scene.add(sun);
  scene.add(sun.target);
  scene.add(new THREE.HemisphereLight(PALETTE.hemiSky, PALETTE.hemiGround, 1.5));

  // extra palms planted above are appended to the two palm instanced meshes
  const extraPalmStart = palms.length;
  const beachPalms = palms.slice(-12);
  if (beachPalms.length) {
    group.add(instance(palmTrunkGeom, trunkMat, beachPalms.map((p) => ({ ...p, y: p.y + 3.5 * p.sy }))));
    group.add(instance(palmCrownGeom, palmMat, beachPalms.map((p) => ({ ...p, y: 7.1 * p.sy + 0.3, sy: p.sy * 0.42 }))));
  }

  const signalColor = new THREE.Color();
  const reds = [0xff3b2f, 0xffb020, 0x35e06a];

  return {
    group,
    lines: LINES,
    blocks,
    colliders,
    cranes,
    sunSprite,
    sun,
    /** True when a point is on drivable asphalt. */
    onRoad(x, z) {
      if (Math.abs(x) > CITY_HALF || z > CITY_HALF || z < -CITY_HALF) return false;
      for (const l of LINES) {
        if (Math.abs(x - l) < 9 || Math.abs(z - l) < 9) return true;
      }
      return false;
    },
    /** True on the paved sidewalk ring of a block. */
    onSidewalk(x, z) {
      for (const b of blocks) {
        const dx = Math.abs(x - b.cx);
        const dz = Math.abs(z - b.cz);
        if (dx < 35 && dz < 35 && (dx > 25 || dz > 25)) return true;
      }
      return false;
    },
    insideBuilding(x, z, pad = 0) {
      for (let i = 0; i < colliders.length; i += 1) {
        const c = colliders[i];
        if (x > c.minX - pad && x < c.maxX + pad && z > c.minZ - pad && z < c.maxZ + pad) return true;
      }
      return false;
    },
    /** Nearest point on a road centreline: used to place cars and police. */
    nearestLane(x, z) {
      let best = { x, z, axis: 'x', line: 0 };
      let bestD = Infinity;
      for (const l of LINES) {
        let d = Math.abs(z - l);
        if (d < bestD) { bestD = d; best = { x, z: l, axis: 'x', line: l }; }
        d = Math.abs(x - l);
        if (d < bestD) { bestD = d; best = { x: l, z, axis: 'z', line: l }; }
      }
      return best;
    },
    update(dt, elapsed) {
      const phase = (elapsed % 16) / 16;
      const vertical = phase < 0.5 ? 2 : phase < 0.58 ? 1 : 0;
      const horizontal = phase < 0.5 ? 0 : phase < 0.58 ? 0 : 2;
      for (let i = 0; i < signals.length; i += 1) {
        const s = signals[i];
        for (let k = 0; k < 3; k += 1) {
          const lit = (s.axis === 0 ? horizontal : vertical) === k;
          signalColor.set(lit ? reds[k] : 0x2a2a2a);
          signalLamps.setColorAt(i * 3 + k, signalColor);
        }
      }
      signalLamps.instanceColor.needsUpdate = true;
      for (let i = 0; i < cranes.length; i += 1) {
        cranes[i].rotation.y = Math.sin(elapsed * 0.12 + i) * 0.6;
      }
    },
    extraPalmStart,
  };
}
