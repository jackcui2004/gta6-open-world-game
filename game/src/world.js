// The simulation: the player on foot and in cars, traffic, pedestrians, the police,
// the wanted level, money, health, pickups and the camera. No drawing and no browser
// in here except localStorage for the save: step() advances one fixed step and returns
// what happened as bit flags, so the caller can react without the world knowing about
// screens or sound. The mission rules live in missions.js; the taxi fares live here.

import {
  STEP, WORLD, PLAYER, CAR, TRAFFIC, PEDESTRIAN, POLICE, WANTED, MONEY, PICKUP,
  SAVE_KEY,
} from './config.js';
import { buildCity, ROADS_V, ROADS_H } from './city.js';
import { createMissionState, updateMissions, isFreeRoam } from './missions.js';
import { pick, range } from './random.js';

export const EVENT_BUSTED = 1;
export const EVENT_WASTED = 2;

const CAR_COLORS = ['#e63946', '#457b9d', '#f4d35e', '#2a9d8f', '#e07a5f', '#6d6875', '#f4f1de', '#90be6d'];
const TAXI_COLOR = '#f4d35e';

function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function angleLerp(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

export function createWorld(random) {
  const city = buildCity(random);
  const loc = city.locations;

  const state = {
    city,
    time: 0,
    money: MONEY.start,
    earned: 0,
    health: PLAYER.health,
    wanted: 0,
    wantedTimer: 0,
    crimeCooldown: 0,
    bustTimer: 0,
    saveTimer: 0,
    player: {
      x: loc.safehouse.x,
      y: loc.safehouse.y,
      angle: -Math.PI / 2,
      onFoot: true,
      car: -1,
      punchCooldown: 0,
      invulnerable: 0,
      walkAngle: -Math.PI / 2,
    },
    cars: [],
    pedestrians: [],
    pickups: [],
    particles: [],
    skids: [],
    mission: createMissionState(),
    taxi: { active: false, dest: null, destName: '', cooldown: 6, customer: -1 },
    camera: { x: loc.safehouse.x, y: loc.safehouse.y, zoom: 1 },
    shake: 0,
    toasts: [],
    sfx: [],
    stats: { carsStolen: 0, missionsDone: 0 },
  };

  function toast(text) {
    const existing = state.toasts.find((t) => t.text === text);
    if (existing) {
      existing.ttl = 4;
      return;
    }
    state.toasts.push({ text, ttl: 4 });
  }

  function sfx(name) {
    state.sfx.push(name);
  }

  function burst(x, y, color, count, speed) {
    for (let i = 0; i < count; i += 1) {
      const a = random() * Math.PI * 2;
      const v = range(random, speed * 0.3, speed);
      state.particles.push({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        life: range(random, 0.3, 0.8), maxLife: 0.8, color, size: range(random, 2, 5),
      });
    }
    if (state.particles.length > 240) state.particles.splice(0, state.particles.length - 240);
  }

  function addWanted(n) {
    if (state.crimeCooldown > 0) return;
    state.crimeCooldown = 2;
    state.wantedTimer = 0;
    const before = state.wanted;
    state.wanted = Math.min(WANTED.max, state.wanted + n);
    if (state.wanted > before) {
      toast(state.wanted === 1 ? 'The cops are onto you — 1 star.' : `Wanted level ${state.wanted} stars!`);
      sfx('siren');
    }
  }

  function spawnCar(kind, x, y, angle, opts) {
    const car = {
      x, y, angle,
      vx: 0, vy: 0, speed: 0,
      color: opts && opts.color ? opts.color : pick(random, CAR_COLORS),
      kind,
      health: kind === 'police' ? 200 : CAR.health,
      owner: opts && opts.owner ? opts.owner : 'npc',
      driver: kind === 'traffic',
      isPolice: kind === 'police',
      ramCooldown: 0,
      axis: opts && opts.axis ? opts.axis : 'v',
      dir: opts && opts.dir ? opts.dir : 1,
      cruise: TRAFFIC.speed * range(random, 0.85, 1.15),
      lastCross: -1,
      punchCooldown: 0,
      wreck: false,
      smoke: 0,
    };
    state.cars.push(car);
    return state.cars.length - 1;
  }

  function spawnParkedCars() {
    for (const spot of city.parkedSpots) {
      spawnCar('parked', spot.x, spot.y, spot.angle, { owner: 'npc' });
    }
  }

  function spawnTraffic() {
    for (let i = 0; i < TRAFFIC.count; i += 1) {
      const p = city.randomRoadPoint(random);
      const onV = ROADS_V.some((rx) => Math.abs(p.x - rx) < 1);
      const carAxis = onV ? 'v' : 'h';
      const dir = random() < 0.5 ? 1 : -1;
      const idx = spawnCar('traffic', p.x, p.y, carAxis === 'v' ? (dir === 1 ? Math.PI / 2 : -Math.PI / 2) : (dir === 1 ? 0 : Math.PI), {
        axis: carAxis, dir,
      });
      const car = state.cars[idx];
      if (carAxis === 'v') car.x = p.x + (dir === 1 ? -24 : 24);
      else car.y = p.y + (dir === 1 ? 24 : -24);
    }
  }

  function spawnPedestrian(kind, x, y) {
    const target = city.randomSidewalkPoint(random);
    state.pedestrians.push({
      x, y,
      angle: random() * Math.PI * 2,
      tx: target.x, ty: target.y,
      speed: PEDESTRIAN.walkSpeed * range(random, 0.8, 1.2),
      kind: kind || 'walker',
      state: 'walk',
      downTimer: 0,
      waitTimer: 0,
      fleeX: 0, fleeY: 0,
      shirt: pick(random, ['#e63946', '#457b9d', '#f4d35e', '#2a9d8f', '#e07a5f', '#6d6875', '#f4f1de', '#90be6d']),
    });
    return state.pedestrians.length - 1;
  }

  function spawnPedestrians() {
    for (let i = 0; i < PEDESTRIAN.count; i += 1) {
      const p = city.randomSidewalkPoint(random);
      spawnPedestrian('walker', p.x, p.y);
    }
    // Lenny the debtor waits in Palma Park for the debt job.
    spawnPedestrian('debtor', loc.park.x + 40, loc.park.y - 20);
  }

  /** A sidewalk point that is not inside a building (a pickup must be reachable). */
  function randomOpenSidewalkPoint() {
    for (let tries = 0; tries < 20; tries += 1) {
      const p = city.randomSidewalkPoint(random);
      if (!city.isSolid(p.x, p.y)) return p;
    }
    return city.randomSidewalkPoint(random);
  }

  function spawnPickups() {
    for (let i = 0; i < PICKUP.cashCount; i += 1) {
      const p = randomOpenSidewalkPoint();
      state.pickups.push({ x: p.x, y: p.y, kind: 'cash', active: true, respawn: 0 });
    }
    for (let i = 0; i < PICKUP.healthCount; i += 1) {
      const p = randomOpenSidewalkPoint();
      state.pickups.push({ x: p.x, y: p.y, kind: 'health', active: true, respawn: 0 });
    }
  }

  function reset(save) {
    state.time = 0;
    state.money = save && save.money !== undefined ? save.money : MONEY.start;
    state.earned = save && save.earned !== undefined ? save.earned : 0;
    state.health = PLAYER.health;
    state.wanted = 0;
    state.wantedTimer = 0;
    state.crimeCooldown = 0;
    state.bustTimer = 0;
    state.saveTimer = 0;
    state.player.x = loc.safehouse.x;
    state.player.y = loc.safehouse.y;
    state.player.angle = -Math.PI / 2;
    state.player.onFoot = true;
    state.player.car = -1;
    state.player.punchCooldown = 0;
    state.player.invulnerable = 0;
    state.cars = [];
    state.pedestrians = [];
    state.pickups = [];
    state.particles = [];
    state.skids = [];
    state.mission = createMissionState();
    if (save && save.missionIndex !== undefined) state.mission.index = save.missionIndex;
    state.taxi = { active: false, dest: null, destName: '', cooldown: 6, customer: -1 };
    state.camera.x = loc.safehouse.x;
    state.camera.y = loc.safehouse.y;
    state.camera.zoom = 1;
    state.shake = 0;
    state.toasts = [];
    state.sfx = [];
    state.stats = { carsStolen: 0, missionsDone: 0 };
    spawnParkedCars();
    spawnTraffic();
    spawnPedestrians();
    spawnPickups();
  }

  function saveGame() {
    try {
      const best = Number.parseInt(window.localStorage.getItem('solmar-bay.best.v1') ?? '0', 10) || 0;
      if (state.earned > best) window.localStorage.setItem('solmar-bay.best.v1', String(state.earned));
      window.localStorage.setItem(SAVE_KEY, JSON.stringify({
        money: state.money, earned: state.earned, missionIndex: state.mission.index,
      }));
    } catch {
      // Storage can be off: the save then lasts this visit only.
    }
  }

  function loadSave() {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function readBest() {
    try {
      return Number.parseInt(window.localStorage.getItem('solmar-bay.best.v1') ?? '0', 10) || 0;
    } catch {
      return 0;
    }
  }

  // ---- player on foot -------------------------------------------------------

  function nearestCar(maxDist) {
    let best = -1;
    let bestD = maxDist;
    for (let i = 0; i < state.cars.length; i += 1) {
      const c = state.cars[i];
      if (c.wreck || c.kind === 'police') continue;
      const d = dist(state.player.x, state.player.y, c.x, c.y);
      if (d < bestD) { bestD = d; best = i; }
    }
    return best;
  }

  function enterCar(index) {
    const car = state.cars[index];
    if (!car || car.wreck) return;
    const wasNpc = car.owner === 'npc';
    if (car.driver) {
      // Yank the driver out: they flee on foot, and it counts as a theft.
      car.driver = false;
      const d = spawnPedestrian('walker', car.x + 30, car.y + 30);
      state.pedestrians[d].state = 'flee';
      state.pedestrians[d].fleeX = car.x + 200;
      state.pedestrians[d].fleeY = car.y + 200;
    }
    car.owner = 'player';
    car.kind = 'player';
    state.player.onFoot = false;
    state.player.car = index;
    state.player.x = car.x;
    state.player.y = car.y;
    if (wasNpc) {
      state.stats.carsStolen += 1;
      addWanted(WANTED.stealCar);
      toast('Nice wheels. That one is yours now.');
      sfx('steal');
    }
  }

  function exitCar() {
    const car = state.cars[state.player.car];
    if (!car) return;
    const sideX = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
    const sideY = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
    state.player.x = sideX;
    state.player.y = sideY;
    city.resolveCircle(state.player, PLAYER.radius);
    state.player.onFoot = true;
    state.player.car = -1;
    state.player.angle = car.angle;
    if (state.taxi.active) {
      state.taxi.active = false;
      state.taxi.cooldown = 8;
      toast('Your fare walked off. The taxi job is cancelled.');
    }
  }

  function punch() {
    const p = state.player;
    if (p.punchCooldown > 0) return;
    p.punchCooldown = PLAYER.punchCooldown;
    sfx('punch');
    const reach = PLAYER.punchRange + 14;
    let hit = -1;
    let hitD = reach;
    for (let i = 0; i < state.pedestrians.length; i += 1) {
      const ped = state.pedestrians[i];
      if (ped.state === 'down') continue;
      const dx = ped.x - state.player.x;
      const dy = ped.y - state.player.y;
      const dd = Math.hypot(dx, dy);
      if (dd > reach) continue;
      const facing = Math.cos(p.angle) * dx + Math.sin(p.angle) * dy;
      if (facing < 0) continue;
      if (dd < hitD) { hitD = dd; hit = i; }
    }
    if (hit === -1) return;
    const ped = state.pedestrians[hit];
    burst(ped.x, ped.y, '#ffffff', 6, 120);
    if (ped.kind === 'debtor') {
      state.mission.debtorHits += 1;
      ped.state = 'down';
      ped.downTimer = 1.2;
      toast(`Lenny takes a hit — ${3 - state.mission.debtorHits} more to go.`);
      if (state.mission.debtorHits >= 3) {
        burst(ped.x, ped.y, '#ffd60a', 16, 200);
        ped.state = 'flee';
        ped.fleeX = ped.x - 300;
        ped.fleeY = ped.y - 300;
      }
    } else {
      ped.state = 'down';
      ped.downTimer = 2.5;
      addWanted(WANTED.punchPedestrian);
      toast('You punched a pedestrian! The cops noticed.');
    }
  }

  function stepPlayerOnFoot(dt, input, actions) {
    const p = state.player;
    const mv = input.move();
    const speed = mv.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
    let dx = mv.x;
    let dy = mv.y;
    const len = Math.hypot(dx, dy);
    if (len > 0) {
      dx /= len;
      dy /= len;
      p.x += dx * speed * dt;
      p.y += dy * speed * dt;
      p.walkAngle = Math.atan2(dy, dx);
      p.angle = p.walkAngle;
    }
    city.resolveCircle(p, PLAYER.radius);
    if (p.punchCooldown > 0) p.punchCooldown -= dt;
    if (p.invulnerable > 0) p.invulnerable -= dt;
    if (actions & 8) punch();
    if (actions & 4) {
      const car = nearestCar(64);
      if (car !== -1) enterCar(car);
    }
  }

  // ---- driving --------------------------------------------------------------

  function carFrontRear(car) {
    const fx = car.x + Math.cos(car.angle) * (CAR.length / 2 - 6);
    const fy = car.y + Math.sin(car.angle) * (CAR.length / 2 - 6);
    const rx = car.x - Math.cos(car.angle) * (CAR.length / 2 - 6);
    const ry = car.y - Math.sin(car.angle) * (CAR.length / 2 - 6);
    return { fx, fy, rx, ry };
  }

  function collideCarWithWorld(car, isPlayerCar) {
    const { fx, fy, rx, ry } = carFrontRear(car);
    let hit = false;
    if (city.isSolid(fx, fy) || city.isSolid(rx, ry)) hit = true;
    if (hit) {
      const speed = Math.hypot(car.vx, car.vy);
      car.x -= car.vx * STEP * 2;
      car.y -= car.vy * STEP * 2;
      if (speed > 160) {
        const damage = Math.min(20, (speed - 160) / 20);
        car.health -= damage;
        burst(car.x, car.y, '#ffb703', 10, 180);
        state.shake = Math.min(12, state.shake + speed / 60);
        if (isPlayerCar) {
          sfx('crash');
          if (speed > 380) state.health = Math.max(1, state.health - 8);
        }
      }
      const along = Math.cos(car.angle) * car.vx + Math.sin(car.angle) * car.vy;
      car.vx = Math.cos(car.angle) * along * -0.25;
      car.vy = Math.sin(car.angle) * along * -0.25;
      car.speed = Math.hypot(car.vx, car.vy);
      return true;
    }
    return false;
  }

  function stepPlayerCar(dt, input, actions) {
    const car = state.cars[state.player.car];
    if (!car || car.wreck) {
      state.player.onFoot = true;
      state.player.car = -1;
      return;
    }
    const mv = input.move();
    const forward = { x: Math.cos(car.angle), y: Math.sin(car.angle) };
    let forwardSpeed = forward.x * car.vx + forward.y * car.vy;
    const throttle = mv.y < 0 ? 1 : 0;
    const braking = mv.y > 0;
    if (throttle) forwardSpeed += CAR.accel * dt;
    if (braking) {
      if (forwardSpeed > 20) forwardSpeed -= CAR.brake * dt;
      else forwardSpeed -= CAR.reverseAccel * dt;
    }
    forwardSpeed -= forwardSpeed * 0.25 * dt;
    if (!throttle && !braking) forwardSpeed -= forwardSpeed * 0.6 * dt;
    forwardSpeed = clamp(forwardSpeed, -CAR.maxReverse, CAR.maxSpeed);
    const steerInput = mv.x;
    const steerFactor = clamp(Math.abs(forwardSpeed) / 180, 0, 1) * (forwardSpeed >= 0 ? 1 : -1);
    car.angle += steerInput * CAR.steer * steerFactor * dt;
    const fwd = { x: Math.cos(car.angle), y: Math.sin(car.angle) };
    let latX = car.vx - fwd.x * (fwd.x * car.vx + fwd.y * car.vy);
    let latY = car.vy - fwd.y * (fwd.x * car.vx + fwd.y * car.vy);
    const keep = Math.exp(-CAR.grip * dt);
    latX *= keep;
    latY *= keep;
    car.vx = fwd.x * forwardSpeed + latX;
    car.vy = fwd.y * forwardSpeed + latY;
    car.speed = Math.hypot(car.vx, car.vy);
    car.x += car.vx * dt;
    car.y += car.vy * dt;
    if (Math.abs(steerInput) > 0.7 && car.speed > 300 && random() < 0.35) {
      state.skids.push({ x: car.x, y: car.y, angle: car.angle, life: 1.4 });
    }
    collideCarWithWorld(car, true);
    state.player.x = car.x;
    state.player.y = car.y;
    state.player.angle = car.angle;
    if (car.health <= 0 && !car.wreck) {
      car.wreck = true;
      burst(car.x, car.y, '#ff6b35', 30, 320);
      burst(car.x, car.y, '#3a3a3a', 20, 160);
      state.shake = 14;
      sfx('crash');
      toast('Your car is wrecked! Get out and find another one.');
      exitCar();
      return;
    }
    if (actions & 4) exitCar();
    // Skid marks fade.
    for (let i = state.skids.length - 1; i >= 0; i -= 1) {
      state.skids[i].life -= dt;
      if (state.skids[i].life <= 0) state.skids.splice(i, 1);
    }
  }

  // ---- traffic ---------------------------------------------------------------

  function nextIntersectionCoord(car) {
    if (car.axis === 'v') {
      const ahead = ROADS_H.filter((y) => (car.dir === 1 ? y > car.y + 5 : y < car.y - 5));
      return car.dir === 1 ? Math.min(...ahead) : Math.max(...ahead);
    }
    const ahead = ROADS_V.filter((x) => (car.dir === 1 ? x > car.x + 5 : x < car.x - 5));
    return car.dir === 1 ? Math.min(...ahead) : Math.max(...ahead);
  }

  function updateTraffic(dt) {
    for (const car of state.cars) {
      if (car.kind !== 'traffic') continue;
      // Slow down for the car ahead.
      let blocked = false;
      for (const other of state.cars) {
        if (other === car || other.wreck) continue;
        const dx = other.x - car.x;
        const dy = other.y - car.y;
        const ahead = car.axis === 'v' ? dy * car.dir : dx * car.dir;
        const side = car.axis === 'v' ? Math.abs(dx) : Math.abs(dy);
        if (ahead > 0 && ahead < 78 && side < 30) { blocked = true; break; }
      }
      const speed = blocked ? 0 : car.cruise;
      if (car.axis === 'v') car.y += car.dir * speed * dt;
      else car.x += car.dir * speed * dt;
      car.speed = speed;
      car.angle = car.axis === 'v' ? (car.dir === 1 ? Math.PI / 2 : -Math.PI / 2) : (car.dir === 1 ? 0 : Math.PI);
      // At an intersection, sometimes turn onto the cross street.
      const cross = nextIntersectionCoord(car);
      if (cross !== Infinity && cross !== -Infinity) {
        const along = car.axis === 'v' ? car.y : car.x;
        const passed = car.dir === 1 ? along >= cross : along <= cross;
        if (passed && car.lastCross !== cross) {
          car.lastCross = cross;
          if (random() < 0.35) {
            const newDir = random() < 0.5 ? 1 : -1;
            if (car.axis === 'v') {
              car.axis = 'h';
              car.dir = newDir;
              car.y = cross + (newDir === 1 ? 24 : -24);
            } else {
              car.axis = 'v';
              car.dir = newDir;
              car.x = cross + (newDir === 1 ? -24 : 24);
            }
          }
        }
      }
      // Turn around at the map edge, and respawn far-away cars near the player.
      if (car.x < 60 || car.x > WORLD.width - 260 || car.y < 60 || car.y > WORLD.height - 60) {
        car.dir *= -1;
      }
      if (dist(car.x, car.y, state.player.x, state.player.y) > 1100) {
        const p = city.randomRoadPoint(random);
        car.x = p.x;
        car.y = p.y;
        car.lastCross = -1;
      }
    }
  }

  // ---- pedestrians -----------------------------------------------------------

  function updatePedestrians(dt) {
    for (const ped of state.pedestrians) {
      if (ped.state === 'down') {
        ped.downTimer -= dt;
        if (ped.downTimer <= 0) {
          if (ped.kind === 'debtor') {
            // Lenny is too scared to run: he stays put for the next punch.
            ped.state = 'walk';
          } else {
            ped.state = 'flee';
            ped.fleeX = ped.x + (random() < 0.5 ? -300 : 300);
            ped.fleeY = ped.y + (random() < 0.5 ? -300 : 300);
          }
        }
        continue;
      }
      if (ped.kind === 'debtor' && ped.state === 'walk') {
        // Lenny waits in the park until the debt job reaches him.
        ped.tx = ped.x;
        ped.ty = ped.y;
      }
      if (ped.kind === 'taxi') {
        // A fare customer waits where they stand.
        continue;
      }
      let tx = ped.tx;
      let ty = ped.ty;
      let speed = ped.speed;
      if (ped.state === 'flee') {
        tx = ped.fleeX;
        ty = ped.fleeY;
        speed = PEDESTRIAN.fleeSpeed;
      }
      const dx = tx - ped.x;
      const dy = ty - ped.y;
      const d = Math.hypot(dx, dy);
      if (d < 14) {
        if (ped.state === 'flee') {
          ped.state = 'walk';
          const t = city.randomSidewalkPoint(random);
          ped.tx = t.x;
          ped.ty = t.y;
        } else if (ped.waitTimer > 0) {
          ped.waitTimer -= dt;
        } else {
          const t = city.randomSidewalkPoint(random);
          ped.tx = t.x;
          ped.ty = t.y;
          if (random() < 0.25) ped.waitTimer = range(random, 1, 4);
        }
        continue;
      }
      ped.x += (dx / d) * speed * dt;
      ped.y += (dy / d) * speed * dt;
      ped.angle = Math.atan2(dy, dx);
      city.resolveCircle(ped, 12);
      // Scared by a fast car nearby: run.
      const playerCar = state.player.car === -1 ? null : state.cars[state.player.car];
      const threat = playerCar && playerCar.speed > 120 ? playerCar : null;
      if (threat && dist(ped.x, ped.y, threat.x, threat.y) < 90 && ped.state !== 'flee') {
        ped.state = 'flee';
        ped.fleeX = ped.x + (ped.x - threat.x);
        ped.fleeY = ped.y + (ped.y - threat.y);
      }
    }
    // Cars hitting pedestrians: they go down, and a hit by the player's car is a crime.
    // Lenny the debtor is mission-critical and waits in the park: a cop chasing the
    // player across the grass must not flatten him and stall the debt job.
    for (const car of state.cars) {
      if (car.wreck || car.speed < 60) continue;
      for (const ped of state.pedestrians) {
        if (ped.state === 'down' || ped.kind === 'taxi' || ped.kind === 'debtor') continue;
        if (dist(car.x, car.y, ped.x, ped.y) < 30) {
          ped.state = 'down';
          ped.downTimer = 2.5;
          burst(ped.x, ped.y, '#ffffff', 8, 140);
          if (car.kind === 'player') {
            addWanted(WANTED.hitPedestrian);
            toast('You hit a pedestrian!');
            sfx('crash');
            state.shake = Math.min(10, state.shake + 4);
          }
        }
      }
    }
    // A traffic car hitting the player on foot hurts.
    if (state.player.onFoot && state.player.invulnerable <= 0) {
      for (const car of state.cars) {
        if (car.kind !== 'traffic' || car.speed < 50) continue;
        if (dist(car.x, car.y, state.player.x, state.player.y) < 30) {
          state.health -= 15;
          state.player.invulnerable = PLAYER.invulnerable;
          state.player.x += (state.player.x - car.x) * 0.4;
          state.player.y += (state.player.y - car.y) * 0.4;
          burst(state.player.x, state.player.y, '#ef233c', 8, 140);
          state.shake = 8;
          sfx('crash');
          toast('Hit by a car! -15 health.');
          break;
        }
      }
    }
  }

  // ---- police ----------------------------------------------------------------

  function policeCars() {
    return state.cars.filter((c) => c.kind === 'police' && !c.wreck);
  }

  function updatePolice(dt) {
    let busted = false;
    const target = POLICE.carsPerStar[state.wanted] || 0;
    const cops = policeCars();
    // Spawn up to the wanted level's count, off-screen on a road.
    if (cops.length < target) {
      for (let tries = 0; tries < 12 && policeCars().length < target; tries += 1) {
        const p = city.randomRoadPoint(random);
        if (dist(p.x, p.y, state.player.x, state.player.y) < POLICE.spawnRange) continue;
        spawnCar('police', p.x, p.y, 0, { color: POLICE.police, owner: 'police' });
      }
    }
    // When the heat is gone, the cops drive off and disappear far away.
    if (state.wanted === 0) {
      for (let i = state.cars.length - 1; i >= 0; i -= 1) {
        const car = state.cars[i];
        if (car.kind === 'police' && dist(car.x, car.y, state.player.x, state.player.y) > 850) {
          state.cars.splice(i, 1);
          if (state.player.car > i) state.player.car -= 1;
        }
      }
    }
    // Chase: steer at the player, ram their car, and bust them on foot.
    for (const car of policeCars()) {
      const dx = state.player.x - car.x;
      const dy = state.player.y - car.y;
      const d = Math.hypot(dx, dy) || 1;
      const desired = Math.atan2(dy, dx);
      // Look ahead: if a building is in the way, swing around it.
      const probeX = car.x + Math.cos(desired) * 80;
      const probeY = car.y + Math.sin(desired) * 80;
      let aim = desired;
      if (city.isSolid(probeX, probeY)) {
        const leftX = car.x + Math.cos(desired - 1.1) * 80;
        const leftY = car.y + Math.sin(desired - 1.1) * 80;
        const rightX = car.x + Math.cos(desired + 1.1) * 80;
        const rightY = car.y + Math.sin(desired + 1.1) * 80;
        aim = city.isSolid(leftX, leftY) ? desired + 1.1 : desired - 1.1;
        if (!city.isSolid(leftX, leftY) && city.isSolid(rightX, rightY)) aim = desired - 1.1;
      }
      car.angle = angleLerp(car.angle, aim, Math.min(1, 3.2 * dt));
      car.vx = Math.cos(car.angle) * POLICE.speed;
      car.vy = Math.sin(car.angle) * POLICE.speed;
      car.speed = POLICE.speed;
      car.x += car.vx * dt;
      car.y += car.vy * dt;
      collideCarWithWorld(car, false);
      const playerCar = state.player.car === -1 ? null : state.cars[state.player.car];
      if (car.ramCooldown > 0) car.ramCooldown -= dt;
      if (playerCar && !playerCar.wreck && car.ramCooldown <= 0 && dist(car.x, car.y, playerCar.x, playerCar.y) < 56) {
        car.ramCooldown = 1.2;
        playerCar.health -= 3;
        playerCar.vx += (playerCar.x - car.x) * 2;
        playerCar.vy += (playerCar.y - car.y) * 2;
        car.vx *= -0.4;
        car.vy *= -0.4;
        burst(playerCar.x, playerCar.y, '#ffb703', 8, 160);
        state.shake = Math.min(10, state.shake + 3);
        sfx('crash');
        addWanted(WANTED.ramPolice);
      }
    }
    // Foot cops at 3+ stars: they run the player down and punch.
    const footTarget = POLICE.footPerStar[state.wanted] || 0;
    let footCops = state.pedestrians.filter((p) => p.kind === 'cop');
    while (footCops.length < footTarget) {
      const a = random() * Math.PI * 2;
      const idx = spawnPedestrian('cop', state.player.x + Math.cos(a) * 220, state.player.y + Math.sin(a) * 220);
      state.pedestrians[idx].speed = 205;
      state.pedestrians[idx].shirt = '#1d3557';
      footCops = state.pedestrians.filter((p) => p.kind === 'cop');
    }
    if (state.wanted === 0) {
      for (let i = state.pedestrians.length - 1; i >= 0; i -= 1) {
        if (state.pedestrians[i].kind === 'cop') state.pedestrians.splice(i, 1);
      }
    }
    for (const cop of state.pedestrians) {
      if (cop.kind !== 'cop') continue;
      const dx = state.player.x - cop.x;
      const dy = state.player.y - cop.y;
      const d = Math.hypot(dx, dy) || 1;
      cop.x += (dx / d) * cop.speed * dt;
      cop.y += (dy / d) * cop.speed * dt;
      cop.angle = Math.atan2(dy, dx);
      city.resolveCircle(cop, 12);
      if (d < 30 && cop.punchCooldown === undefined) cop.punchCooldown = 0;
      if (d < 30) {
        cop.punchCooldown -= dt;
        if (cop.punchCooldown <= 0 && state.player.invulnerable <= 0) {
          cop.punchCooldown = 1;
          state.health -= 10;
          state.player.invulnerable = 0.6;
          state.player.x += (dx / d) * -30;
          state.player.y += (dy / d) * -30;
          state.shake = 7;
          sfx('punch');
          toast('A cop is beating you down! Run!');
        }
      }
    }
    // Busted: a cop car sits on the player on foot for a moment.
    if (state.player.onFoot && state.wanted > 0) {
      let near = false;
      for (const car of policeCars()) {
        if (dist(car.x, car.y, state.player.x, state.player.y) < 95) { near = true; break; }
      }
      if (near) {
        state.bustTimer += dt;
        if (state.bustTimer > 1.5) busted = true;
      } else {
        state.bustTimer = Math.max(0, state.bustTimer - dt * 2);
      }
    } else {
      state.bustTimer = 0;
    }
    return busted;
  }

  // ---- pickups, taxi, wanted decay -------------------------------------------

  function updatePickups(dt) {
    for (const pk of state.pickups) {
      if (!pk.active) {
        pk.respawn -= dt;
        if (pk.respawn <= 0) {
          const p = randomOpenSidewalkPoint();
          pk.x = p.x;
          pk.y = p.y;
          pk.active = true;
        }
        continue;
      }
      if (dist(pk.x, pk.y, state.player.x, state.player.y) < 30) {
        pk.active = false;
        pk.respawn = 60;
        if (pk.kind === 'cash') {
          state.money += MONEY.cashPickup;
          state.earned += MONEY.cashPickup;
          toast(`+$${MONEY.cashPickup} cash.`);
        } else {
          state.health = Math.min(PLAYER.health, state.health + 30);
          toast('+30 health.');
        }
        burst(pk.x, pk.y, pk.kind === 'cash' ? '#70e000' : '#ef233c', 10, 140);
        sfx('pickup');
      }
    }
  }

  function updateTaxi(dt, actions) {
    const taxi = state.taxi;
    if (taxi.cooldown > 0) taxi.cooldown -= dt;
    // Keep one fare customer waiting once the player has wheels.
    const hasCustomer = state.pedestrians.some((p) => p.kind === 'taxi');
    if (!taxi.active && !hasCustomer && state.mission.index >= 1 && taxi.cooldown <= 0) {
      const a = random() * Math.PI * 2;
      const r = range(random, 300, 600);
      let x = clamp(state.player.x + Math.cos(a) * r, 60, WORLD.width - 300);
      let y = clamp(state.player.y + Math.sin(a) * r, 60, WORLD.height - 60);
      if (city.isSolid(x, y)) {
        const p = randomOpenSidewalkPoint();
        x = p.x;
        y = p.y;
      }
      const idx = spawnPedestrian('taxi', x, y);
      state.pedestrians[idx].shirt = '#70e000';
      taxi.customer = idx;
    }
    // Press T in a car near a waiting customer to take the fare.
    if (!taxi.active && (actions & 16) && !state.player.onFoot) {
      for (let i = 0; i < state.pedestrians.length; i += 1) {
        const ped = state.pedestrians[i];
        if (ped.kind !== 'taxi') continue;
        if (dist(ped.x, ped.y, state.player.x, state.player.y) < 80) {
          const dests = [loc.garage, loc.docks, loc.bank, loc.safehouse, loc.hospital, loc.beach];
          const dest = pick(random, dests);
          state.pedestrians.splice(i, 1);
          taxi.active = true;
          taxi.dest = { x: dest.x, y: dest.y };
          taxi.destName = dest.name;
          toast(`Fare accepted — take your passenger to ${dest.name}.`);
          sfx('mission');
          break;
        }
      }
    }
    if (taxi.active && !state.player.onFoot && dist(state.player.x, state.player.y, taxi.dest.x, taxi.dest.y) < 120) {
      state.money += MONEY.taxiFare;
      state.earned += MONEY.taxiFare;
      toast(`Fare paid — +$${MONEY.taxiFare}.`);
      sfx('mission');
      taxi.active = false;
      taxi.dest = null;
      taxi.cooldown = 8;
    }
  }

  function updateWanted(dt) {
    if (state.wanted <= 0) return;
    state.wantedTimer += dt;
    let nearestCop = Infinity;
    for (const car of policeCars()) {
      nearestCop = Math.min(nearestCop, dist(car.x, car.y, state.player.x, state.player.y));
    }
    if (state.wantedTimer > WANTED.decaySeconds && nearestCop > 450) {
      state.wanted -= 1;
      state.wantedTimer = 0;
      toast(state.wanted === 0 ? 'You lost the cops. Clean.' : `Heat dropping — ${state.wanted} star(s) left.`);
    }
  }

  function updateCamera(dt) {
    const p = state.player;
    const car = p.car === -1 ? null : state.cars[p.car];
    let lookX = p.x;
    let lookY = p.y;
    let zoomTarget = 1;
    if (car && !p.onFoot) {
      lookX += car.vx * 0.22;
      lookY += car.vy * 0.22;
      zoomTarget = car.speed > 380 ? 0.82 : 0.92;
    }
    const k = 1 - Math.exp(-4.5 * dt);
    state.camera.x += (lookX - state.camera.x) * k;
    state.camera.y += (lookY - state.camera.y) * k;
    state.camera.zoom += (zoomTarget - state.camera.zoom) * k;
    const halfW = 640 / state.camera.zoom;
    const halfH = 360 / state.camera.zoom;
    state.camera.x = clamp(state.camera.x, halfW, WORLD.width - halfW);
    state.camera.y = clamp(state.camera.y, halfH, WORLD.height - halfH);
    state.shake = Math.max(0, state.shake - dt * 22);
  }

  function updateParticles(dt) {
    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const pt = state.particles[i];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= 0.98;
      pt.vy *= 0.98;
      pt.life -= dt;
      if (pt.life <= 0) state.particles.splice(i, 1);
    }
  }

  // ---- the step ---------------------------------------------------------------

  function stepWorld(dt, input, actions) {
    state.time += dt;
    if (state.crimeCooldown > 0) state.crimeCooldown -= dt;
    for (let i = state.toasts.length - 1; i >= 0; i -= 1) {
      state.toasts[i].ttl -= dt;
      if (state.toasts[i].ttl <= 0) state.toasts.splice(i, 1);
    }
    if (state.player.onFoot) stepPlayerOnFoot(dt, input, actions);
    else stepPlayerCar(dt, input, actions);
    updateTraffic(dt);
    updatePedestrians(dt);
    const busted = updatePolice(dt);
    updatePickups(dt);
    updateTaxi(dt, actions);
    const missionEvents = [];
    updateMissions(state.mission, state, dt, missionEvents);
    for (const e of missionEvents) {
      if (e.type === 'toast') toast(e.text);
      else if (e.type === 'sfx') sfx(e.name);
    }
    updateWanted(dt);
    updateCamera(dt);
    updateParticles(dt);
    state.saveTimer += dt;
    if (state.saveTimer > 5) {
      state.saveTimer = 0;
      saveGame();
    }
    let flags = 0;
    if (busted) flags |= EVENT_BUSTED;
    if (state.health <= 0) flags |= EVENT_WASTED;
    return flags;
  }

  reset(null);

  return {
    state,
    reset,
    saveGame,
    loadSave,
    readBest,
    toast,
    sfx,
    addWanted,
    burst,
    step: stepWorld,
  };
}
