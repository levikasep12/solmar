[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/levikasep12/solmar/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/levikasep12/solmar/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# SOLMAR — a coastal crime sandbox

Golden hour on the coast. Mara Voss drives for hire — and the whole city is
on the meter. SOLMAR is an original open-world crime game in the browser,
built with three.js: a seeded coastal city with avenues, towers, palms and
the sea, free to drive, explore, and get into trouble in.

- **Three story jobs** — First Fare, The Getaway, Harbor Run — chained
  missions with contacts, timers, and cash on success.
- **Wanted system** — police chases that escalate with your stars, from a
  single patrol car to roadblocks and a helicopter.
- **Side work** — taxi fares, a checkpoint time trial, and ten hidden
  packages scattered around the city.
- **On foot and behind the wheel** — carjack traffic, sprint, jump, punch,
  shoot, and lose the heat at the spray shop.
- **A seeded city** — add `?seed=N` to the address for a different Solmar.
  Progress (cash, missions, packages) saves in the browser; Continue picks
  it back up.
- **Staged screenshots** — `?shot=chase|street|mission|start&seed=N` frames
  the same moment every time; the four shots in `screenshots/` were taken
  that way.

## Run it

Node 22, no build step, no network needed once loaded:

```sh
node serve.ts
```

Then open <http://localhost:8080> in a desktop browser.

## Controls

| Key | Action |
| --- | --- |
| WASD | Walk / drive |
| Shift | Sprint |
| Space | Jump / handbrake |
| E | Enter / exit car |
| F | Carjack |
| Click | Punch / shoot |
| Mouse drag | Orbit camera |
| 1 / 2 | Fists / pistol |
| Esc | Pause |
| M | Mute |

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
