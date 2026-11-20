# gta6-open-world-game

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/jackcui2004/gta6-open-world-game/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/jackcui2004/gta6-open-world-game/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Solmar Bay** — an open-world crime game in the spirit of GTA 6, running offline in a desktop browser from its own files. You are Rico Vale, a driver-for-hire in a sun-soaked coastal city. Steal cars, run five story jobs for Marty the fixer, dodge the Solmar PD under a five-star wanted system, take taxi fares, and grab cash across a living city of traffic, pedestrians, a beach, a park and a port.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in a desktop browser. No build step, no network — the game is plain HTML, CSS and JavaScript under `game/`.

## How to play

- **On foot:** WASD or arrows to walk, Shift to run, Space to punch, E to steal a nearby car.
- **Driving:** W accelerates, S brakes and reverses, A and D steer. E leaves the car.
- **Jobs:** five story missions — Borrowed Wheels, The Delivery, Collect the Debt, Heat Wave, The Big Score — each pays cash and unlocks the next. After the last one, the city is yours: free roam, taxi fares (press T in a car near a green `$` customer) and cash pickups.
- **Wanted:** stealing cars, hitting pedestrians and punching people raise your stars. The Solmar PD chases you in cars and on foot. Stay clean and out of sight until the stars fade — or ram them back.
- **Busted / Wasted:** a cop car sitting on you on foot gets you busted; zero health gets you wasted. Either way you wake up 12% lighter.
- **Save:** money, earnings and mission progress save automatically in the browser. The title screen offers Continue.

## Layout

- `game/index.html` — the page, a full-screen canvas.
- `game/src/main.js` — boot, the fixed-step loop, the five screens.
- `game/src/config.js` — every tuning number, colour and city name.
- `game/src/city.js` — Solmar Bay: roads, blocks, buildings, beach, park, port, collisions.
- `game/src/world.js` — the simulation: player, cars, traffic, pedestrians, police, wanted, money.
- `game/src/missions.js` — the five story jobs and their objectives.
- `game/src/render.js` — canvas drawing: city, entities, HUD, minimap, screens.
- `game/src/input.js` — keyboard, mouse and touch.
- `game/src/audio.js` — synthesised WebAudio sound effects, no audio files.
- `game/src/shots.js` — the staged screenshot scenes (`?shot=start|drive|mission|chase`).
- `main.ts` — the make.fun entrypoint: copies `game/` and `screenshots/` to `/output` and writes `dossier.json`.
- `screenshots/` — four shots of the game running.

---

<sub>Entered on [make.fun](https://make.fun/?ref=rwj8kpnw&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
