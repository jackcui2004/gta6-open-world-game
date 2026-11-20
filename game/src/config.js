// Every tuning number and colour in one place. The world is a fixed 3200x2400 logical
// city, Solmar Bay; the camera follows the player and the renderer scales the view to
// the window, so no rule below depends on the screen size.

export const WORLD = { width: 3200, height: 2400 };

// Logical view size the camera frames (the canvas is letterboxed to this aspect).
export const VIEW = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 13,
  walkSpeed: 170,
  runSpeed: 265,
  health: 100,
  punchRange: 34,
  punchDamage: 34,
  punchCooldown: 0.45,
  invulnerable: 1.0,
};

export const CAR = {
  length: 54,
  width: 26,
  accel: 420,
  brake: 620,
  reverseAccel: 240,
  maxSpeed: 520,
  maxReverse: 150,
  steer: 3.2,
  grip: 3.2,
  health: 120,
  crashDamage: 14,
};

export const TRAFFIC = {
  count: 14,
  speed: 150,
  spacing: 260,
};

export const PEDESTRIAN = {
  count: 26,
  walkSpeed: 55,
  fleeSpeed: 150,
};

export const POLICE = {
  // cars per wanted level, and how far away a cop car gives up the chase
  carsPerStar: [0, 1, 2, 2, 3, 4],
  footPerStar: [0, 0, 0, 2, 3, 4],
  speed: 440,
  bustRange: 30,
  giveUpRange: 900,
  spawnRange: 620,
};

export const WANTED = {
  max: 5,
  decaySeconds: 26,
  stealCar: 1,
  hitPedestrian: 1,
  punchPedestrian: 1,
  ramPolice: 1,
};

export const MONEY = {
  start: 150,
  bustedLoss: 0.12,
  wastedLoss: 0.12,
  cashPickup: 40,
  taxiFare: 120,
};

export const PICKUP = {
  cashCount: 10,
  healthCount: 6,
  radius: 14,
};

/** Seconds a mission's timer lasts, where the mission has one. */
export const MISSION_TIME = { delivery: 95, bigScoreEscape: 75 };

export const PALETTE = {
  grass: '#7fb069',
  sand: '#e8d29a',
  sea: '#2e86ab',
  seaDeep: '#1d6a8a',
  sidewalk: '#c9c2b4',
  road: '#3c3f46',
  roadLine: '#e8d44d',
  curb: '#8f887a',
  buildingRoof: ['#c96f4a', '#d9a05b', '#7d8ca3', '#a8576b', '#5b8a72', '#b08968', '#8e6fb8', '#4a7d96'],
  buildingEdge: '#00000033',
  park: '#6da34a',
  tree: '#2f6b2f',
  treeLight: '#4c9a4c',
  palm: '#3f7d3a',
  player: '#f4f1de',
  playerShirt: '#e63946',
  police: '#1d3557',
  policeLight: '#ff4444',
  taxi: '#f4d35e',
  mission: '#ffd60a',
  text: '#f8f9fa',
  muted: '#adb5bd',
  panel: '#14213dcc',
  hudBg: '#14213daa',
  star: '#ffd60a',
  starEmpty: '#495057',
  health: '#70e000',
  healthLow: '#ef233c',
  minimapBg: '#0d1b2acc',
  minimapRoad: '#6c757d',
  minimapSea: '#2e86ab',
  minimapPlayer: '#ffffff',
  minimapPolice: '#ff4d6d',
  minimapMission: '#ffd60a',
  minimapTaxi: '#70e000',
  toast: '#ffd60a',
  damage: '#ef233c',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the save (money, mission progress, best) is kept between visits (this browser only). */
export const SAVE_KEY = 'solmar-bay.save.v1';
export const BEST_KEY = 'solmar-bay.best.v1';

/** City flavour: original names, characters and places, nothing borrowed. */
export const CITY = {
  name: 'Solmar Bay',
  hero: 'Rico Vale',
  fixer: 'Marty',
  debtor: 'Lenny',
  bank: 'Solmar Bay Bank',
  safehouse: "Rico's Safehouse",
};
