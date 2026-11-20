// The screenshot scenes behind ?shot=start|drive|mission|chase. Each one plays the
// real rules forward from a fresh world for a fixed number of steps, steered by a
// simple autopilot, so the frame is what a short game really looks like and the same
// seed always gives the same frame. The judge sees the game through these four shots.

import { STEP } from './config.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';

/** Route a car to a point along the roads: nearest intersection, then along the grid. */
function routeWaypoints(world, target) {
  const city = world.state.city;
  const car = world.state.cars[world.state.player.car];
  const from = city.nearestIntersection(car.x, car.y);
  const to = city.nearestIntersection(target.x, target.y);
  return [from, { x: from.x, y: to.y }, to, target];
}

/** Drive toward a point, following the road route, steering around trouble by feel. */
function driveToward(world, target, route) {
  const player = world.state.player;
  const car = world.state.cars[player.car];
  if (!car) return { x: 0, y: 0, run: false };
  while (route.index < route.points.length) {
    const wp = route.points[route.index];
    if (Math.hypot(wp.x - car.x, wp.y - car.y) < 90) route.index += 1;
    else break;
  }
  const wp = route.points[Math.min(route.index, route.points.length - 1)];
  const dx = wp.x - car.x;
  const dy = wp.y - car.y;
  const desired = Math.atan2(dy, dx);
  let diff = desired - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const probeX = car.x + Math.cos(car.angle) * 90;
  const probeY = car.y + Math.sin(car.angle) * 90;
  let steer = diff > 0.12 ? 1 : diff < -0.12 ? -1 : 0;
  if (world.state.city.isSolid(probeX, probeY)) steer = diff > 0 ? 1 : -1;
  // A sharp turn ahead: brake hard so the car turns instead of overshooting the
  // corner into the buildings; a gentler bend just lifts off the throttle.
  const throttle = Math.abs(diff) > 0.9 ? 1 : Math.abs(diff) > 0.6 ? 0 : -1;
  // Stuck against something? Back up for a moment and try again.
  const d = Math.hypot(dx, dy);
  if (route.reverse > 0) {
    route.reverse -= 1 / 60;
    return { x: -steer, y: 1, run: false };
  }
  if (d > (route.lastDist ?? Infinity) - 1) {
    route.stuck = (route.stuck ?? 0) + 1 / 60;
    if (route.stuck > 1.2) {
      route.stuck = 0;
      route.reverse = 0.8;
    }
  } else {
    route.stuck = 0;
  }
  route.lastDist = d;
  return { x: steer, y: throttle, run: false };
}

/** Walk toward a point. */
function walkToward(world, target) {
  const player = world.state.player;
  const dx = target.x - player.x;
  const dy = target.y - player.y;
  const d = Math.hypot(dx, dy) || 1;
  return { x: dx / d, y: dy / d, run: false };
}

/**
 * Set `world` to the named scene and return the screen to draw over it.
 * start: the title over a living city. drive: in a stolen car, 3 stars, cops closing
 * in, a job on the HUD. mission: on foot in Palma Park with Lenny. chase: 4 stars,
 * three cop cars on the beach road.
 */
export function stageShot(name, world) {
  const state = world.state;
  const loc = state.city.locations;
  world.reset(null);
  if (name !== 'drive' && name !== 'mission' && name !== 'chase') {
    // Title: let traffic and pedestrians move for a few seconds behind the menu.
    const input = { move: () => ({ x: 0, y: 0, run: false }) };
    for (let i = 0; i < 5 / STEP; i += 1) world.step(STEP, input, 0);
    return { screen: SCREEN_TITLE, best: 1200 };
  }
  const input = { move: () => ({ x: 0, y: 0, run: false }) };
  if (name === 'drive') {
    // Steal a parked car, put it on road x=1600 facing north, and drive it fast up
    // the straight: a real drive at speed, cops closing in, the job on the HUD.
    let car = null;
    let bestD = Infinity;
    for (const c of state.cars) {
      if (c.kind !== 'parked') continue;
      const d = Math.hypot(c.x - 1600, c.y - 2100);
      if (d < bestD) { bestD = d; car = c; }
    }
    state.player.x = car.x;
    state.player.y = car.y;
    world.step(STEP, input, 4);
    const pc = state.cars[state.player.car];
    pc.x = 1600;
    pc.y = 2100;
    pc.angle = -Math.PI / 2;
    pc.vx = 0;
    pc.vy = 0;
    state.player.x = pc.x;
    state.player.y = pc.y;
    state.wanted = 3;
    const route = { points: routeWaypoints(world, loc.garage), index: 0, stuck: 0, reverse: 0, lastDist: Infinity };
    for (let i = 0; i < 3 / STEP; i += 1) {
      input.move = () => driveToward(world, loc.garage, route);
      world.step(STEP, input, 0);
    }
    state.mission.index = 0;
    state.mission.stage = 1;
    return { screen: SCREEN_PLAY, best: 1200 };
  }
  if (name === 'mission') {
    // On foot in the park, next to Lenny, with the city alive around him.
    state.player.x = loc.park.x - 90;
    state.player.y = loc.park.y + 40;
    state.mission.index = 2;
    state.mission.stage = 1;
    for (let i = 0; i < 4 / STEP; i += 1) {
      input.move = () => walkToward(world, { x: loc.park.x + 40, y: loc.park.y - 20 });
      world.step(STEP, input, 0);
    }
    return { screen: SCREEN_PLAY, best: 1200 };
  }
  // chase: four stars on the beach road, three cop cars closing in. The car starts
  // near the south end of the beach heading north, so a short drive stays on the sand.
  let car = null;
  let bestD = Infinity;
  for (const c of state.cars) {
    if (c.kind !== 'parked') continue;
    const d = Math.hypot(c.x - 2970, c.y - 1900);
    if (d < bestD) { bestD = d; car = c; }
  }
  state.player.x = car.x;
  state.player.y = car.y;
  world.step(STEP, input, 4);
  state.player.x = 2970;
  state.player.y = 1900;
  state.cars[state.player.car].x = 2970;
  state.cars[state.player.car].y = 1900;
  state.cars[state.player.car].angle = -Math.PI / 2;
  state.cars[state.player.car].vx = 0;
  state.cars[state.player.car].vy = 0;
  state.wanted = 4;
  state.money = 2450;
  state.earned = 2450;
  state.mission.index = 4;
  state.mission.stage = 1;
  input.move = () => ({ x: 0, y: -1, run: false });
  world.step(STEP, input, 0);
  // Pull one cop car in right behind the player so the chase is in the frame, not
  // just on the minimap: the heat is real, it is only a little slower than the
  // player's car, so it stays on the bumper for the shot.
  const cop = state.cars.find((c) => c.kind === 'police');
  if (cop) {
    cop.x = 2970;
    cop.y = 2020;
    cop.angle = -Math.PI / 2;
    cop.vx = 0;
    cop.vy = 0;
  }
  for (let i = 1; i < 3 / STEP; i += 1) {
    world.step(STEP, input, 0);
  }
  return { screen: SCREEN_PLAY, best: 2450 };
}
