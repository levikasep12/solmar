// The one hook the browser driver reads: window.__game.state() returns a small, flat
// snapshot (screen, wanted, cash, mission, errors). Error strings are collected in main.js
// from window.onerror and unhandled rejections, so a clean state means a clean frame.

export function installDebug({ getWorld, errors, getScreen, getSave, getSeed }) {
  window.__game = {
    state() {
      const world = getWorld();
      const player = world?.player?.state;
      const active = world?.missions?.active;
      let mission = 'none';
      if (active) mission = active.def.name;
      else if (world?.missions) mission = `story ${world.missions.storyDone}/3`;
      return {
        screen: getScreen(),
        wanted: world?.police?.wanted ?? 0,
        cash: Math.floor(getSave()?.cash ?? 0),
        mission,
        onFoot: player ? player.onFoot : null,
        speed: player ? Math.round(Math.abs(player.speed) * 3.6) : 0,
        seed: getSeed(),
        errors: errors.slice(-20),
      };
    },
  };
}
