// Solmar Bay: the city itself. A fixed 3200x2400 map of roads, blocks, buildings, a
// beach on the east edge, a park in the middle and a port in the north-west corner.
// All names, characters and places are original. The city knows what is solid (buildings,
// the sea, the map edge) and where the roads run, so cars, pedestrians and the police can
// all move through the same streets.

import { WORLD, PALETTE } from './config.js';
import { pick, range } from './random.js';

export const ROAD_W = 110;
export const ROADS_V = [400, 1000, 1600, 2200, 2800];
export const ROADS_H = [400, 900, 1400, 1900];
const BEACH_X = 2900;
const SEA_X = 3050;

const BANDS_X = [0, 455, 1055, 1655, 2255, 2855];
const BANDS_Y = [0, 455, 955, 1455, 1955];

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function buildCity(random) {
  const buildings = [];
  const trees = [];
  const palms = [];
  const containers = [];

  // Buildings fill every block except the park, the port and the beach strip.
  for (let bx = 0; bx < BANDS_X.length - 1; bx += 1) {
    for (let by = 0; by < BANDS_Y.length - 1; by += 1) {
      const x0 = BANDS_X[bx];
      const y0 = BANDS_Y[by];
      // The far edge of a block is the near edge of the next road: the next band
      // value is that road's far edge (centre + 55), so subtract the full 110.
      // (Using -55 put buildings 37 px inside the road on the +x/+y side, which
      // trapped the safehouse spawn against a wall and clipped the traffic lanes.)
      const x1 = bx + 1 < BANDS_X.length ? BANDS_X[bx + 1] - 110 : WORLD.width;
      const y1 = by + 1 < BANDS_Y.length ? BANDS_Y[by + 1] - 110 : WORLD.height;
      if (x0 >= BEACH_X) continue;
      // Palma Park: the middle block is green, not built on.
      if (bx === 2 && by === 2) continue;
      // Port Solmar: the north-west block holds containers instead of buildings.
      if (bx === 0 && by === 0) continue;
      const cols = x1 - x0 > 260 ? 2 : 1;
      const rows = y1 - y0 > 260 ? 2 : 1;
      for (let cx = 0; cx < cols; cx += 1) {
        for (let cy = 0; cy < rows; cy += 1) {
          const w = (x1 - x0) / cols - 36;
          const h = (y1 - y0) / rows - 36;
          const x = x0 + 18 + cx * ((x1 - x0) / cols);
          const y = y0 + 18 + cy * ((y1 - y0) / rows);
          buildings.push({ x, y, w, h, color: pick(random, PALETTE.buildingRoof) });
        }
      }
    }
  }

  // Port containers: solid, colourful boxes stacked by the docks.
  const containerColors = ['#c1440e', '#2a6f97', '#e9c46a', '#588157', '#bc4b51'];
  for (let i = 0; i < 9; i += 1) {
    containers.push({
      x: 60 + (i % 3) * 110,
      y: 70 + Math.floor(i / 3) * 90,
      w: 92,
      h: 62,
      color: containerColors[i % containerColors.length],
    });
  }

  // Park trees, beach palms and a few street trees on the sidewalks.
  for (let i = 0; i < 26; i += 1) {
    trees.push({ x: range(random, 1090, 1510), y: range(random, 990, 1310), r: range(random, 14, 22) });
  }
  for (let i = 0; i < 18; i += 1) {
    palms.push({ x: range(random, 2915, 3035), y: range(random, 60, 2340), r: range(random, 12, 18) });
  }
  for (let i = 0; i < 30; i += 1) {
    const road = pick(random, ROADS_V);
    trees.push({ x: road + (random() < 0.5 ? -78 : 78), y: range(random, 60, 2340), r: range(random, 10, 15) });
  }

  // Named places the story sends the player to; each sits on a road or in the park.
  const locations = {
    garage: { x: 1000, y: 470, name: "Marty's Garage" },
    docks: { x: 400, y: 330, name: 'Port Solmar' },
    park: { x: 1300, y: 1150, name: 'Palma Park' },
    bank: { x: 1600, y: 470, name: 'Solmar Bay Bank' },
    safehouse: { x: 2500, y: 1400, name: "Rico's Safehouse" },
    hospital: { x: 1000, y: 1650, name: 'Solmar General' },
    policeStation: { x: 2200, y: 470, name: 'Solmar PD' },
    burger: { x: 1300, y: 1400, name: 'Burger Barn' },
    beach: { x: 2970, y: 1200, name: 'Solmar Beach' },
  };

  const parkedSpots = [
    { x: 1072, y: 620, angle: Math.PI / 2 },
    { x: 1672, y: 1020, angle: Math.PI / 2 },
    { x: 2272, y: 1520, angle: -Math.PI / 2 },
    { x: 472, y: 1520, angle: Math.PI / 2 },
    { x: 1072, y: 2020, angle: -Math.PI / 2 },
    { x: 2872, y: 520, angle: Math.PI / 2 },
    { x: 472, y: 1020, angle: -Math.PI / 2 },
    { x: 2272, y: 820, angle: Math.PI / 2 },
    { x: 1672, y: 2020, angle: Math.PI / 2 },
    { x: 2872, y: 2020, angle: -Math.PI / 2 },
  ];

  const city = { buildings, trees, palms, containers, locations, parkedSpots };

  /** True when the point is inside a building, a container, the sea or off the map. */
  function isSolid(x, y) {
    if (x < 12 || y < 12 || x > WORLD.width - 12 || y > WORLD.height - 12) return true;
    if (x > SEA_X) return true;
    for (const b of buildings) if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return true;
    for (const c of containers) if (x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h) return true;
    return false;
  }

  /** True when the point is on a road (with a little slack for the kerb). */
  function onRoad(x, y) {
    for (const rx of ROADS_V) if (Math.abs(x - rx) < ROAD_W / 2 + 8) return true;
    for (const ry of ROADS_H) if (Math.abs(y - ry) < ROAD_W / 2 + 8) return true;
    return false;
  }

  /** True when the point is sand or sea (the beach strip on the east edge). */
  function onBeach(x, y) {
    return x > BEACH_X;
  }

  /** Push a circle out of every solid thing it overlaps; returns true when it moved. */
  function resolveCircle(pos, radius) {
    let moved = false;
    for (let pass = 0; pass < 3; pass += 1) {
      if (pos.x < 12 + radius) { pos.x = 12 + radius; moved = true; }
      if (pos.y < 12 + radius) { pos.y = 12 + radius; moved = true; }
      if (pos.x > WORLD.width - 12 - radius) { pos.x = WORLD.width - 12 - radius; moved = true; }
      if (pos.y > WORLD.height - 12 - radius) { pos.y = WORLD.height - 12 - radius; moved = true; }
      if (pos.x > SEA_X - radius) { pos.x = SEA_X - radius; moved = true; }
      for (const b of buildings) {
        const cx = Math.max(b.x, Math.min(pos.x, b.x + b.w));
        const cy = Math.max(b.y, Math.min(pos.y, b.y + b.h));
        const dx = pos.x - cx;
        const dy = pos.y - cy;
        const d2 = dx * dx + dy * dy;
        if (d2 < radius * radius) {
          if (d2 > 0.01) {
            const d = Math.sqrt(d2);
            pos.x = cx + (dx / d) * radius;
            pos.y = cy + (dy / d) * radius;
          } else {
            pos.x = b.x - radius;
          }
          moved = true;
        }
      }
      for (const c of containers) {
        const cx = Math.max(c.x, Math.min(pos.x, c.x + c.w));
        const cy = Math.max(c.y, Math.min(pos.y, c.y + c.h));
        const dx = pos.x - cx;
        const dy = pos.y - cy;
        const d2 = dx * dx + dy * dy;
        if (d2 < radius * radius) {
          if (d2 > 0.01) {
            const d = Math.sqrt(d2);
            pos.x = cx + (dx / d) * radius;
            pos.y = cy + (dy / d) * radius;
          } else {
            pos.x = c.x - radius;
          }
          moved = true;
        }
      }
    }
    return moved;
  }

  /** A random point on a road edge (a sidewalk), for pedestrians to walk to. */
  function randomSidewalkPoint(randomFn) {
    if (randomFn() < 0.5) {
      const road = pick(randomFn, ROADS_V);
      const side = randomFn() < 0.5 ? -78 : 78;
      return { x: road + side, y: range(randomFn, 60, WORLD.height - 60) };
    }
    const road = pick(randomFn, ROADS_H);
    const side = randomFn() < 0.5 ? -78 : 78;
    return { x: range(randomFn, 60, WORLD.width - 260), y: road + side };
  }

  /** A random point on a road, for traffic and police to spawn on. */
  function randomRoadPoint(randomFn) {
    if (randomFn() < 0.5) {
      return { x: pick(randomFn, ROADS_V), y: range(randomFn, 60, WORLD.height - 60) };
    }
    return { x: range(randomFn, 60, WORLD.width - 260), y: pick(randomFn, ROADS_H) };
  }

  /** The nearest road intersection to a point, for routing. */
  function nearestIntersection(x, y) {
    let best = null;
    let bestD = Infinity;
    for (const rx of ROADS_V) {
      for (const ry of ROADS_H) {
        const d = (rx - x) * (rx - x) + (ry - y) * (ry - y);
        if (d < bestD) { bestD = d; best = { x: rx, y: ry }; }
      }
    }
    return best;
  }

  return {
    ...city,
    isSolid,
    onRoad,
    onBeach,
    resolveCircle,
    randomSidewalkPoint,
    randomRoadPoint,
    nearestIntersection,
    rectsOverlap,
  };
}
