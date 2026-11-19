// Third-person camera: it orbits with a mouse drag and eases back behind the car while
// driving, tilts up on foot, and pulls in when a building would block the view. A small
// trauma value from crashes shakes it. No pointer lock, so it works in every browser.

import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);

export function createCamera(camera, input) {
  let yaw = Math.PI;
  let pitch = 0.32;
  let distance = 8.4;
  let trauma = 0;
  const position = new THREE.Vector3();
  const target = new THREE.Vector3();
  const look = new THREE.Vector3();

  function addTrauma(amount) {
    trauma = Math.min(1, trauma + amount);
  }

  /**
   * @param focus {{x,z,heading,onFoot,speed}}
   */
  function update(dt, focus, city) {
    const dragging = input.pointer.dragging;
    if (dragging) {
      yaw -= input.pointer.dx * 0.006;
      pitch = Math.max(-0.15, Math.min(0.95, pitch + input.pointer.dy * 0.004));
    }
    if (input.pointer.wheel) distance = Math.max(4.5, Math.min(16, distance + input.pointer.wheel * 0.01));

    const driving = !focus.onFoot;
    const speedFactor = Math.min(1, Math.abs(focus.speed) / 24);
    if (driving && !dragging) {
      const behind = focus.heading + Math.PI;
      let delta = ((behind - yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      yaw += delta * Math.min(1, dt * (1.4 + speedFactor * 2.2));
      pitch += (0.26 - pitch) * Math.min(1, dt * 1.2);
    } else if (!driving && !dragging) {
      const behind = focus.heading + Math.PI;
      let delta = ((behind - yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      yaw += delta * Math.min(1, dt * 1.1);
      pitch += (0.34 - pitch) * Math.min(1, dt * 0.9);
    }

    const wantDistance = (driving ? 9.4 + speedFactor * 3.2 : 5.6) * (distance / 8.4);
    const height = Math.sin(pitch) * wantDistance + 1.1;
    const flat = Math.cos(pitch) * wantDistance;

    target.set(focus.x, focus.onFoot ? 1.55 : 1.25, focus.z);
    position.set(
      focus.x + Math.sin(yaw) * flat,
      target.y + height,
      focus.z + Math.cos(yaw) * flat,
    );

    if (city) {
      const pad = 1.4;
      if (city.insideBuilding(position.x, position.z, pad)) {
        const step = Math.max(1, flat * 0.1);
        for (let d = flat; d > 2; d -= step) {
          const px = focus.x + Math.sin(yaw) * d;
          const pz = focus.z + Math.cos(yaw) * d;
          if (!city.insideBuilding(px, pz, pad)) {
            position.set(px, target.y + Math.sin(pitch) * d + 1.1, pz);
            break;
          }
        }
      }
    }
    if (position.y < 0.8) position.y = 0.8;

    trauma = Math.max(0, trauma - dt * 1.6);
    const shake = trauma * trauma * 0.9;
    const time = performance.now() * 0.001;
    camera.position.set(
      position.x + Math.sin(time * 37) * shake,
      position.y + Math.sin(time * 41 + 1) * shake * 0.7,
      position.z + Math.cos(time * 33) * shake,
    );
    look.copy(target);
    look.x += Math.sin(time * 29) * shake * 0.4;
    camera.lookAt(look);
  }

  return {
    update,
    addTrauma,
    setOrbit(y, p, d) { yaw = y; pitch = p; distance = d; },
    orbit(y, p, d) { yaw = y; pitch = p; if (d !== undefined) distance = d; },
    get yaw() { return yaw; },
    get pitch() { return pitch; },
    get distance() { return distance; },
    addYaw(v) { yaw += v; },
    addPitch(v) { pitch = Math.max(-0.15, Math.min(0.95, pitch + v)); },
  };
}
