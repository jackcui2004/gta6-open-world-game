// Tiny WebAudio sound effects, synthesised on the spot: no audio files, no network.
// The context starts on the first user gesture; M mutes everything.

export function createAudio() {
  let ctx = null;
  let muted = false;
  let sirenNodes = null;

  function ensure() {
    if (ctx) return ctx;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      ctx = new AudioContext();
    } catch {
      ctx = null;
    }
    return ctx;
  }

  function unlock() {
    const c = ensure();
    if (c && c.state === 'suspended') c.resume().catch(() => {});
  }

  function tone(freq, dur, type, gain, slideTo) {
    if (muted) return;
    const c = ensure();
    if (!c) return;
    const t = c.currentTime;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(gain || 0.12, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g);
    g.connect(c.destination);
    osc.start(t);
    osc.stop(t + dur);
  }

  function noise(dur, gain) {
    if (muted) return;
    const c = ensure();
    if (!c) return;
    const t = c.currentTime;
    const len = Math.floor(c.sampleRate * dur);
    const buffer = c.createBuffer(1, len, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource();
    src.buffer = buffer;
    const g = c.createGain();
    g.gain.setValueAtTime(gain || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(g);
    g.connect(c.destination);
    src.start(t);
  }

  function startSiren() {
    if (muted || sirenNodes) return;
    const c = ensure();
    if (!c) return;
    const osc = c.createOscillator();
    const g = c.createGain();
    const lfo = c.createOscillator();
    const lfoGain = c.createGain();
    osc.type = 'sine';
    osc.frequency.value = 750;
    lfo.type = 'sine';
    lfo.frequency.value = 0.8;
    lfoGain.gain.value = 250;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    g.gain.value = 0.035;
    osc.connect(g);
    g.connect(c.destination);
    osc.start();
    lfo.start();
    sirenNodes = { osc, lfo, g };
  }

  function stopSiren() {
    if (!sirenNodes) return;
    try {
      sirenNodes.osc.stop();
      sirenNodes.lfo.stop();
    } catch {
      // Already stopped.
    }
    sirenNodes = null;
  }

  function play(name) {
    if (muted) return;
    ensure();
    switch (name) {
      case 'pickup':
        tone(880, 0.12, 'sine', 0.14, 1320);
        break;
      case 'punch':
        noise(0.12, 0.25);
        tone(120, 0.1, 'square', 0.1, 60);
        break;
      case 'crash':
        noise(0.3, 0.3);
        tone(90, 0.25, 'sawtooth', 0.12, 40);
        break;
      case 'steal':
        tone(440, 0.1, 'square', 0.08, 660);
        break;
      case 'mission':
        tone(523, 0.12, 'sine', 0.14);
        setTimeout(() => tone(659, 0.12, 'sine', 0.14), 110);
        setTimeout(() => tone(784, 0.22, 'sine', 0.14), 220);
        break;
      case 'siren':
        startSiren();
        setTimeout(stopSiren, 4000);
        break;
      default:
        break;
    }
  }

  function toggleMute() {
    muted = !muted;
    if (muted) stopSiren();
    return muted;
  }

  return { unlock, play, toggleMute, isMuted: () => muted };
}
