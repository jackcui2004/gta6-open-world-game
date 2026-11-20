// Keyboard, mouse and touch input, read every frame. Actions are edge-triggered bits the
// game consumes once (confirm, pause, enter car, punch, taxi); the movement vector is a
// live -1..1 pair. WASD and arrows both steer; E enters or leaves a car; Space punches on
// foot and handbrakes in a car; Shift runs; P or Escape pauses; M mutes; T takes a taxi fare.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_PUNCH = 8;
export const ACTION_TAXI = 16;
export const ACTION_MUTE = 32;

const KEYMAP = {
  KeyW: 'up',
  ArrowUp: 'up',
  KeyS: 'down',
  ArrowDown: 'down',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  ShiftLeft: 'run',
  ShiftRight: 'run',
};

export function createInput(canvas) {
  const held = { up: false, down: false, left: false, right: false, run: false };
  let actions = 0;
  let click = null;

  function keyDown(event) {
    const name = KEYMAP[event.code];
    if (name) {
      held[name] = true;
      event.preventDefault();
      return;
    }
    if (event.repeat) return;
    if (event.code === 'Space') {
      actions |= ACTION_PUNCH;
      event.preventDefault();
    } else if (event.code === 'Enter') {
      actions |= ACTION_CONFIRM;
    } else if (event.code === 'KeyE') {
      actions |= ACTION_ENTER;
    } else if (event.code === 'KeyP' || event.code === 'Escape') {
      actions |= ACTION_PAUSE;
    } else if (event.code === 'KeyT') {
      actions |= ACTION_TAXI;
    } else if (event.code === 'KeyM') {
      actions |= ACTION_MUTE;
    }
  }

  function keyUp(event) {
    const name = KEYMAP[event.code];
    if (name) held[name] = false;
  }

  function onPointerDown(event) {
    const rect = canvas.getBoundingClientRect();
    click = {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height),
    };
    actions |= ACTION_CONFIRM;
  }

  function onBlur() {
    held.up = held.down = held.left = held.right = held.run = false;
  }

  window.addEventListener('keydown', keyDown);
  window.addEventListener('keyup', keyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('pointerdown', onPointerDown);

  /** Live movement vector, -1..1 on each axis. */
  function move() {
    return {
      x: (held.right ? 1 : 0) - (held.left ? 1 : 0),
      y: (held.down ? 1 : 0) - (held.up ? 1 : 0),
      run: held.run,
    };
  }

  /** The actions since the last call, as bits; reading clears them. */
  function takeActions() {
    const taken = actions;
    actions = 0;
    return taken;
  }

  /** The last pointer click in canvas pixels, or null; reading clears it. */
  function takeClick() {
    const taken = click;
    click = null;
    return taken;
  }

  return { move, takeActions, takeClick };
}
