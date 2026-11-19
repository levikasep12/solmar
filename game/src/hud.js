// HUD: cash, stars, health, speed, weapon, objective, subtitles and toasts, plus the live
// minimap. The minimap is a real 2D canvas map of the avenue grid, recentred on the player
// and turned so the player always faces up: roads, the mission waypoint, police blips, the
// spray shop and hospital, nearby traffic, and the player arrow on top.

import { CELL, GRID, CITY_HALF, LINES, PALETTE } from './config.js';

const STAR_COUNT = 5;

export function createHud() {
  const el = {
    hud: document.getElementById('hud'),
    cash: document.getElementById('cash'),
    clock: document.getElementById('clock'),
    stars: [...document.querySelectorAll('#stars span')],
    healthFill: document.getElementById('health-fill'),
    objective: document.getElementById('objective'),
    objectiveText: document.getElementById('objective-text'),
    speedo: document.getElementById('speedo'),
    speedValue: document.getElementById('speed-value'),
    weapon: document.getElementById('weapon-name'),
    toast: document.getElementById('toast'),
    subtitle: document.getElementById('subtitle'),
    minimap: document.getElementById('minimap'),
  };
  const ctx = el.minimap.getContext('2d');
  let toastTimer = 0;
  let subtitleTimer = 0;
  const mapScale = 2.1;
  const MAP_RANGE = 150;

  function show(v) {
    el.hud.classList.toggle('hidden', !v);
  }

  function setCash(v) {
    el.cash.textContent = `$${Math.max(0, Math.floor(v)).toLocaleString('en-US')}`;
  }

  function setStars(n) {
    for (let i = 0; i < STAR_COUNT; i += 1) {
      el.stars[i].classList.toggle('lit', i < n);
    }
  }

  function setHealth(ratio, hasWeapon) {
    const pct = Math.max(0, Math.min(1, ratio)) * 100;
    el.healthFill.style.width = `${pct}%`;
    el.healthFill.style.background = pct < 30
      ? 'linear-gradient(90deg,#e04a38,#ff8a5a)'
      : pct < 60 ? 'linear-gradient(90deg,#e0a13a,#ffd06a)' : 'linear-gradient(90deg,#8fd06a,#d7e06a)';
    el.weapon.textContent = hasWeapon;
  }

  function setSpeed(kmh, visible) {
    el.speedo.classList.toggle('hidden', !visible);
    if (visible) el.speedValue.textContent = String(Math.round(kmh));
  }

  function setObjective(text, timer) {
    if (!text) {
      el.objective.classList.add('hidden');
      return;
    }
    el.objective.classList.remove('hidden');
    el.objectiveText.innerHTML = timer
      ? `${escapeHtml(text)} <span class="timer">${timer}</span>`
      : escapeHtml(text);
  }

  function setClock(minutes) {
    const total = 18 * 60 + 40 + Math.floor(minutes);
    const h = Math.floor(total / 60) % 24;
    const m = total % 60;
    el.clock.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} · SOLMAR`;
  }

  function toast(text, seconds = 2.6) {
    el.toast.textContent = text;
    el.toast.classList.add('show');
    toastTimer = seconds;
  }

  function subtitle(who, line, seconds = 4.2) {
    el.subtitle.innerHTML = `<span class="who">${escapeHtml(who)}:</span> ${escapeHtml(line)}`;
    el.subtitle.classList.add('show');
    subtitleTimer = seconds;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  function update(dt) {
    if (toastTimer > 0) {
      toastTimer -= dt;
      if (toastTimer <= 0) el.toast.classList.remove('show');
    }
    if (subtitleTimer > 0) {
      subtitleTimer -= dt;
      if (subtitleTimer <= 0) el.subtitle.classList.remove('show');
    }
  }

  /**
   * Paint the minimap. `view` carries everything that moves: player, cars, police, waypoint.
   */
  function drawMinimap(view) {
    const w = el.minimap.width;
    const h = el.minimap.height;
    const cx = w / 2;
    const cy = h / 2;
    const range = MAP_RANGE;
    const scale = (w / 2) / range;
    const heading = view.heading ?? 0;

    ctx.save();
    ctx.clearRect(0, 0, w, h);
    ctx.beginPath();
    ctx.arc(cx, cy, w / 2 - 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#2b2620';
    ctx.fillRect(0, 0, w, h);

    const px = view.x;
    const pz = view.z;
    const cos = Math.cos(-heading);
    const sin = Math.sin(-heading);
    function toMap(x, z) {
      const dx = x - px;
      const dz = z - pz;
      const rx = dx * cos - dz * sin;
      const rz = dx * sin + dz * cos;
      return [cx + rx * scale, cy + rz * scale];
    }

    // Blocks: pavement fill between the avenues.
    ctx.fillStyle = '#4a4238';
    const blockSpan = CELL - 18;
    for (let i = 0; i < GRID * 2; i += 1) {
      for (let j = 0; j < GRID * 2; j += 1) {
        const bx = LINES[0] + i * CELL + 9;
        const bz = LINES[0] + j * CELL + 9;
        const [sx, sy] = toMap(bx + blockSpan / 2, bz + blockSpan / 2);
        if (Math.hypot(sx - cx, sy - cy) > range * scale + 90) continue;
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(-heading);
        ctx.fillRect((-blockSpan / 2) * scale, (-blockSpan / 2) * scale, blockSpan * scale, blockSpan * scale);
        ctx.restore();
      }
    }
    // Roads.
    ctx.strokeStyle = '#8f8878';
    ctx.lineWidth = Math.max(3, 18 * scale);
    ctx.beginPath();
    for (const line of LINES) {
      const [ax, ay] = toMap(-CITY_HALF, line);
      const [bx2, by2] = toMap(CITY_HALF, line);
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx2, by2);
      const [cx2, cy2] = toMap(line, -CITY_HALF);
      const [dx2, dy2] = toMap(line, CITY_HALF);
      ctx.moveTo(cx2, cy2);
      ctx.lineTo(dx2, dy2);
    }
    ctx.stroke();
    // Beach and sea edge.
    const [bax, bay] = toMap(-CITY_HALF, CITY_HALF + 22);
    const [bbx, bby] = toMap(CITY_HALF, CITY_HALF + 22);
    ctx.strokeStyle = '#d9bd8c';
    ctx.lineWidth = Math.max(4, 40 * scale);
    ctx.beginPath();
    ctx.moveTo(bax, bay);
    ctx.lineTo(bbx, bby);
    ctx.stroke();
    const [sax, say] = toMap(-CITY_HALF, CITY_HALF + 62);
    const [sbx, sby] = toMap(CITY_HALF, CITY_HALF + 62);
    ctx.strokeStyle = '#2c6b7c';
    ctx.lineWidth = Math.max(6, 40 * scale);
    ctx.beginPath();
    ctx.moveTo(sax, say);
    ctx.lineTo(sbx, sby);
    ctx.stroke();

    // Spray shop (a spray can dot), hospital cross.
    if (view.spray) {
      const [sx, sy] = toMap(view.spray.x, view.spray.z);
      blip(sx, sy, 5, '#4fc3d9', 'S');
    }
    if (view.hospital) {
      const [sx, sy] = toMap(view.hospital.x, view.hospital.z);
      blip(sx, sy, 5, '#e8666a', 'H');
    }

    // Traffic cars: small pale marks.
    ctx.fillStyle = '#dfe8f0';
    for (const car of view.cars ?? []) {
      const [sx, sy] = toMap(car.x, car.z);
      if (Math.hypot(sx - cx, sy - cy) > w / 2 - 8) continue;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(-heading + car.heading);
      ctx.fillRect(-2, -3.5, 4, 7);
      ctx.restore();
    }

    // Police blips pulse.
    const pulse = 0.6 + Math.sin(performance.now() * 0.008) * 0.4;
    for (const cop of view.police ?? []) {
      const [sx, sy] = toMap(cop.x, cop.z);
      if (Math.hypot(sx - cx, sy - cy) > w / 2 - 8) continue;
      ctx.fillStyle = `rgba(255,74,74,${pulse})`;
      ctx.beginPath();
      ctx.arc(sx, sy, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffd0c8';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Side jobs and packages.
    for (const mark of view.marks ?? []) {
      const [sx, sy] = toMap(mark.x, mark.z);
      if (Math.hypot(sx - cx, sy - cy) > w / 2 - 8) continue;
      blip(sx, sy, mark.size ?? 4, mark.color, mark.label);
    }

    // Mission waypoint: a gold diamond with a ring, and an off-map arrow at the rim.
    if (view.waypoint) {
      const [sx, sy] = toMap(view.waypoint.x, view.waypoint.z);
      const d = Math.hypot(sx - cx, sy - cy);
      if (d < w / 2 - 12) {
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(Math.PI / 4);
        ctx.fillStyle = PALETTE.blipMission;
        ctx.fillRect(-6, -6, 12, 12);
        ctx.strokeStyle = '#fff4d0';
        ctx.lineWidth = 2;
        ctx.strokeRect(-6, -6, 12, 12);
        ctx.restore();
      } else {
        const a = Math.atan2(sy - cy, sx - cx);
        const ex = cx + Math.cos(a) * (w / 2 - 14);
        const ey = cy + Math.sin(a) * (w / 2 - 14);
        ctx.save();
        ctx.translate(ex, ey);
        ctx.rotate(a);
        ctx.fillStyle = PALETTE.blipMission;
        ctx.beginPath();
        ctx.moveTo(9, 0);
        ctx.lineTo(-6, -6);
        ctx.lineTo(-6, 6);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }

    // Player arrow, always pointing up.
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = '#fff8e8';
    ctx.strokeStyle = '#1b140d';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.lineTo(7, 8);
    ctx.lineTo(0, 4);
    ctx.lineTo(-7, 8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // North marker.
    const north = -heading;
    ctx.save();
    ctx.translate(cx + Math.sin(north) * (w / 2 - 20), cy - Math.cos(north) * (w / 2 - 20));
    ctx.fillStyle = '#ffd98a';
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('N', 0, 0);
    ctx.restore();

    ctx.restore();
    // Rim.
    ctx.strokeStyle = 'rgba(255,210,140,0.35)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, w / 2 - 2, 0, Math.PI * 2);
    ctx.stroke();
  }

  function blip(x, y, r, color, label) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    if (label) {
      ctx.fillStyle = '#1b140d';
      ctx.font = 'bold 9px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, x, y + 0.5);
    }
  }

  return {
    show, setCash, setStars, setHealth, setSpeed, setObjective, setClock,
    toast, subtitle, update, drawMinimap,
  };
}
