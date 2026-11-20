// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps (several in a slow frame, none in a fast one), and the renderer paints what is
// there. The game moves between five screens: title, play, paused, busted and wasted.
// Progress saves to localStorage; a save on the title screen offers Continue.
//
// ?seed=N fixes the world. ?shot=start|drive|mission|chase (with &seed=N) stages that
// scene instead of running the loop, paints it twice and sets window.__shotReady for
// a screenshot.

import { STEP, SAVE_KEY } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_BUSTED, EVENT_WASTED } from './world.js';
import {
  ACTION_CONFIRM, ACTION_PAUSE, ACTION_MUTE, createInput,
} from './input.js';
import {
  createRenderer, SCREEN_BUSTED, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WASTED,
} from './render.js';
import { stageShot } from './shots.js';
import { createAudio } from './audio.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  // The staged run leaves a pile of toasts behind; the frame reads cleaner without them.
  world.state.toasts = [];
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, { best: scene.best, saveExists: false, showHow: false });
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let showHow = false;
  let buttons = [];
  let save = readSave();
  let best = world.readBest();
  let lost = 0;
  let accumulator = 0;
  let last = performance.now();

  function announce(message) {
    status.textContent = message;
  }

  function startGame(fresh) {
    const keep = fresh ? null : readSave();
    world.reset(keep);
    if (fresh) {
      try {
        window.localStorage.removeItem(SAVE_KEY);
      } catch {
        // Storage can be off.
      }
    }
    save = readSave();
    best = world.readBest();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Steal a car and meet Marty.');
  }

  function endRun(kind) {
    lost = Math.floor(world.state.money * 0.12);
    world.state.money = Math.max(0, world.state.money - lost);
    world.saveGame();
    screen = kind;
    announce(kind === SCREEN_BUSTED ? `Busted. You lost $${lost}.` : `Wasted. You lost $${lost}.`);
  }

  function respawn(kind) {
    const loc = world.state.city.locations;
    const spot = kind === SCREEN_BUSTED ? loc.policeStation : loc.hospital;
    world.state.player.x = spot.x;
    world.state.player.y = spot.y;
    world.state.player.onFoot = true;
    world.state.player.car = -1;
    world.state.player.angle = -Math.PI / 2;
    world.state.health = 100;
    world.state.wanted = 0;
    world.state.wantedTimer = 0;
    world.state.bustTimer = 0;
    // The cops that caught the player drive off.
    world.state.cars = world.state.cars.filter((c) => c.kind !== 'police');
    world.state.pedestrians = world.state.pedestrians.filter((p) => p.kind !== 'cop');
    world.state.camera.x = spot.x;
    world.state.camera.y = spot.y;
    world.saveGame();
    screen = SCREEN_PLAY;
    announce('Back on the streets.');
  }

  function clickButton(click) {
    if (!click) return null;
    for (const b of buttons) {
      if (click.x >= b.x && click.x <= b.x + b.w && click.y >= b.y && click.y <= b.y + b.h) return b.id;
    }
    return null;
  }

  function handleActions() {
    const actions = input.takeActions();
    const click = input.takeClick();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Muted.' : 'Sound on.');
    }
    if (screen === SCREEN_TITLE) {
      const hit = clickButton(click);
      if (hit === 'continue') startGame(false);
      else if (hit === 'new') startGame(true);
      else if (hit === 'how') showHow = true;
      else if (hit === 'back') showHow = false;
      else if ((actions & ACTION_CONFIRM) && !showHow) startGame(save !== null);
      else if ((actions & ACTION_CONFIRM) && showHow) showHow = false;
      return;
    }
    if (screen === SCREEN_PAUSED) {
      const hit = clickButton(click);
      if (hit === 'resume' || (actions & (ACTION_PAUSE | ACTION_CONFIRM))) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      } else if (hit === 'restart') {
        startGame(false);
      } else if (hit === 'quit') {
        world.saveGame();
        save = readSave();
        screen = SCREEN_TITLE;
        showHow = false;
      }
      return;
    }
    if (screen === SCREEN_BUSTED || screen === SCREEN_WASTED) {
      const hit = clickButton(click);
      if (hit === 'continue' || (actions & ACTION_CONFIRM)) respawn(screen);
      return;
    }
    if (actions & ACTION_PAUSE) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  }

  function step() {
    const actions = input.takeActions();
    // Mute is handled in handleActions; keep the rest for the world.
    const events = world.step(STEP, input, actions);
    if (events & EVENT_BUSTED) endRun(SCREEN_BUSTED);
    else if (events & EVENT_WASTED) endRun(SCREEN_WASTED);
    for (const name of world.state.sfx.splice(0)) audio.play(name);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP && screen === SCREEN_PLAY) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    buttons = renderer.draw(world.state, screen, {
      best, saveExists: save !== null, showHow, lost,
    });
  }

  // Leaving the tab pauses a running game rather than letting the cops close in unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  // The first gesture unlocks sound.
  window.addEventListener('pointerdown', () => audio.unlock(), { once: true });
  window.addEventListener('keydown', () => audio.unlock(), { once: true });

  announce('Solmar Bay. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
