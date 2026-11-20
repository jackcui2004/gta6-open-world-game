// The story: five jobs for Rico Vale, a driver-for-hire in Solmar Bay, then free roam
// with taxi fares. Each mission is a small state machine: a target on the map, an
// objective line for the HUD, and a payout. All names and places are original.

export const MISSIONS = [
  {
    id: 'wheels',
    title: 'Borrowed Wheels',
    briefing: "Marty needs a driver. First, get yourself a car — any car. Walk up to one and press E.",
    payout: 200,
  },
  {
    id: 'delivery',
    title: 'The Delivery',
    briefing: 'Package in the trunk. Get it to Port Solmar before the clock runs out.',
    payout: 350,
  },
  {
    id: 'debt',
    title: 'Collect the Debt',
    briefing: "Lenny owes Marty three hundred. Find him in Palma Park and remind him — on foot.",
    payout: 300,
  },
  {
    id: 'heat',
    title: 'Heat Wave',
    briefing: 'Time to learn the heat. Get the cops on you, then shake them off.',
    payout: 250,
  },
  {
    id: 'score',
    title: 'The Big Score',
    briefing: 'One last job: the Solmar Bay Bank. Grab the cash and get to the safehouse.',
    payout: 1500,
  },
];

export function createMissionState() {
  return { index: 0, stage: 0, timer: 0, debtorHits: 0, done: false };
}

export function isFreeRoam(mission) {
  return mission.index >= MISSIONS.length;
}

export function missionTitle(mission) {
  if (isFreeRoam(mission)) return 'King of Solmar';
  return MISSIONS[mission.index].title;
}

/** The current objective line for the HUD. */
export function missionObjective(mission, world) {
  if (isFreeRoam(mission)) {
    if (world.taxi && world.taxi.active) return `Taxi fare: take your passenger to ${world.taxi.destName}.`;
    return 'Free roam — grab cash, take taxi fares (T near a $ customer), stay out of trouble.';
  }
  const m = MISSIONS[mission.index];
  switch (m.id) {
    case 'wheels':
      return mission.stage === 0
        ? 'Steal a car — walk up to one and press E.'
        : "Drive to Marty's Garage.";
    case 'delivery':
      return `Deliver the package to Port Solmar — ${Math.max(0, Math.ceil(mission.timer))}s left.`;
    case 'debt':
      return mission.stage === 0
        ? 'Find Lenny in Palma Park.'
        : `Teach Lenny a lesson — punch him ${3 - mission.debtorHits} more ${3 - mission.debtorHits === 1 ? 'time' : 'times'} with Space.`;
    case 'heat':
      return mission.stage === 0
        ? 'Get the cops on you — reach 2 wanted stars.'
        : 'Now lose them — stay clean until the stars are gone.';
    case 'score':
      return mission.stage === 0
        ? 'Drive to the Solmar Bay Bank.'
        : 'You grabbed the cash! Escape to the safehouse!';
    default:
      return m.briefing;
  }
}

/** The current target marker on the map (and minimap), or null. */
export function missionTarget(mission, world) {
  if (isFreeRoam(mission)) {
    if (world.taxi && world.taxi.active) return { x: world.taxi.dest.x, y: world.taxi.dest.y, label: world.taxi.destName };
    return null;
  }
  const loc = world.city.locations;
  const m = MISSIONS[mission.index];
  switch (m.id) {
    case 'wheels':
      return mission.stage === 0 ? null : { x: loc.garage.x, y: loc.garage.y, label: loc.garage.name };
    case 'delivery':
      return { x: loc.docks.x, y: loc.docks.y, label: loc.docks.name };
    case 'debt':
      return { x: loc.park.x, y: loc.park.y, label: 'Lenny' };
    case 'heat':
      return null;
    case 'score':
      return mission.stage === 0
        ? { x: loc.bank.x, y: loc.bank.y, label: loc.bank.name }
        : { x: loc.safehouse.x, y: loc.safehouse.y, label: loc.safehouse.name };
    default:
      return null;
  }
}

function completeMission(mission, world, events) {
  const m = MISSIONS[mission.index];
  world.money += m.payout;
  world.earned += m.payout;
  events.push({ type: 'toast', text: `Job done: ${m.title} — +$${m.payout}` });
  events.push({ type: 'sfx', name: 'mission' });
  mission.index += 1;
  mission.stage = 0;
  mission.timer = 0;
  mission.debtorHits = 0;
  if (isFreeRoam(mission)) {
    mission.done = true;
    events.push({ type: 'toast', text: 'King of Solmar — the city is yours now.' });
  } else {
    events.push({ type: 'toast', text: `New job: ${MISSIONS[mission.index].title} — ${MISSIONS[mission.index].briefing}` });
  }
}

function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

/**
 * Advance the mission state machine one step. `world` carries the player, the wanted
 * level and the money; `events` collects toasts and sounds for the main loop.
 */
export function updateMissions(mission, world, dt, events) {
  if (isFreeRoam(mission)) return;
  const loc = world.city.locations;
  const player = world.player;
  const m = MISSIONS[mission.index];

  if (m.id === 'wheels') {
    if (mission.stage === 0 && !player.onFoot) {
      mission.stage = 1;
      events.push({ type: 'toast', text: 'Nice wheels. Now drive to Marty\'s Garage.' });
    } else if (mission.stage === 1 && !player.onFoot && dist(player.x, player.y, loc.garage.x, loc.garage.y) < 110) {
      completeMission(mission, world, events);
    }
    return;
  }

  if (m.id === 'delivery') {
    if (mission.timer <= 0) mission.timer = 95;
    mission.timer -= dt;
    if (mission.timer <= 0) {
      mission.timer = 95;
      events.push({ type: 'toast', text: 'Too slow — the package goes back. Try again.' });
      return;
    }
    if (!player.onFoot && dist(player.x, player.y, loc.docks.x, loc.docks.y) < 110) {
      completeMission(mission, world, events);
    }
    return;
  }

  if (m.id === 'debt') {
    const debtor = world.pedestrians.find((p) => p.kind === 'debtor');
    if (!debtor) return;
    if (mission.stage === 0 && player.onFoot && dist(player.x, player.y, debtor.x, debtor.y) < 120) {
      mission.stage = 1;
      events.push({ type: 'toast', text: "There's Lenny. Teach him a lesson — Space to punch." });
    } else if (mission.stage === 1 && mission.debtorHits >= 3) {
      completeMission(mission, world, events);
    }
    return;
  }

  if (m.id === 'heat') {
    if (mission.stage === 0 && world.wanted >= 2) {
      mission.stage = 1;
      events.push({ type: 'toast', text: 'Two stars! Now lose them — stay clean and out of sight.' });
    } else if (mission.stage === 1 && world.wanted === 0) {
      completeMission(mission, world, events);
    }
    return;
  }

  if (m.id === 'score') {
    if (mission.stage === 0 && dist(player.x, player.y, loc.bank.x, loc.bank.y) < 110) {
      mission.stage = 1;
      world.wanted = Math.max(world.wanted, 3);
      world.wantedTimer = 0;
      events.push({ type: 'toast', text: 'You grabbed $1,500! Three stars — get to the safehouse!' });
      events.push({ type: 'sfx', name: 'siren' });
    } else if (mission.stage === 1 && dist(player.x, player.y, loc.safehouse.x, loc.safehouse.y) < 110) {
      completeMission(mission, world, events);
    }
    return;
  }
}
