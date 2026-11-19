// Keyboard plus mouse. No pointer lock: the camera orbits while the left button drags
// (a short, still click is a punch or a shot instead), and the wheel pulls the camera in.

const DRAG_SLOP = 5;

export function createInput(canvas) {
  const down = new Set();
  const fresh = new Set();
  const pointer = { dragging: false, moved: 0, dx: 0, dy: 0, wheel: 0, clicked: false };

  function onKey(event) {
    if (event.repeat) return;
    const code = event.code;
    if (code === 'Space' || code.startsWith('Arrow')) event.preventDefault();
    down.add(code);
    fresh.add(code);
  }
  function onUp(event) {
    down.delete(event.code);
  }
  function onDown(event) {
    if (event.button !== 0) return;
    pointer.dragging = true;
    pointer.moved = 0;
    pointer.startX = event.clientX;
    pointer.startY = event.clientY;
  }
  function onMove(event) {
    if (!pointer.dragging) return;
    pointer.moved += Math.abs(event.movementX) + Math.abs(event.movementY);
    pointer.dx += event.movementX;
    pointer.dy += event.movementY;
  }
  function onPointerUp(event) {
    if (event.button !== 0) return;
    if (pointer.dragging && pointer.moved < DRAG_SLOP) pointer.clicked = true;
    pointer.dragging = false;
  }
  function onWheel(event) {
    event.preventDefault();
    pointer.wheel += event.deltaY;
  }
  function onBlur() {
    down.clear();
    pointer.dragging = false;
  }

  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  return {
    down(code) { return down.has(code); },
    pressed(code) { return fresh.has(code); },
    takePressed(code) {
      if (!fresh.has(code)) return false;
      fresh.delete(code);
      return true;
    },
    takeClick() {
      if (!pointer.clicked) return false;
      pointer.clicked = false;
      return true;
    },
    pointer,
    /** Call at the end of a rendered frame: clears one-shot input and drag deltas. */
    endFrame() {
      fresh.clear();
      pointer.clicked = false;
      pointer.dx = 0;
      pointer.dy = 0;
      pointer.wheel = 0;
    },
  };
}
