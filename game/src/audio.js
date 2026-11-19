// Every sound in SOLMAR is made here with the Web Audio API: an engine drone that rises
// with speed, a two-tone siren, gunshots, the punch, pickups, crashes and UI clicks.
// No files, no samples, no network.

export function createAudio() {
  let ctx = null;
  let master = null;
  let engine = null;
  let siren = null;
  let noiseBuffer = null;
  let muted = false;
  let unlocked = false;

  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.35;
    master.connect(ctx.destination);
    const length = Math.floor(ctx.sampleRate * 0.6);
    noiseBuffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    let seed = 1234567;
    for (let i = 0; i < length; i += 1) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      data[i] = (seed / 0x3fffffff) - 1;
    }
    return ctx;
  }

  function resume() {
    if (!ensure()) return;
    unlocked = true;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  function noise(duration, freq, q, volume, type = 'lowpass') {
    if (!unlocked || !ensure() || muted) return;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const gain = ctx.createGain();
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + duration);
    src.connect(filter).connect(gain).connect(master);
    src.start(now);
    src.stop(now + duration + 0.02);
  }

  function tone(freq, duration, volume, type = 'sine', slide = 0) {
    if (!unlocked || !ensure() || muted) return;
    const osc = ctx.createOscillator();
    osc.type = type;
    const gain = ctx.createGain();
    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(freq, now);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), now + duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + duration);
    osc.connect(gain).connect(master);
    osc.start(now);
    osc.stop(now + duration + 0.03);
  }

  function startEngine() {
    if (!ensure() || engine) return;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    const sub = ctx.createOscillator();
    sub.type = 'triangle';
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 520;
    const gain = ctx.createGain();
    gain.gain.value = 0.0001;
    osc.frequency.value = 48;
    sub.frequency.value = 24;
    osc.connect(filter);
    sub.connect(filter);
    filter.connect(gain).connect(master);
    osc.start();
    sub.start();
    engine = { osc, sub, filter, gain };
  }

  function startSiren() {
    if (!ensure() || siren) return;
    const osc = ctx.createOscillator();
    osc.type = 'square';
    const lfo = ctx.createOscillator();
    lfo.type = 'square';
    lfo.frequency.value = 1.7;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 170;
    const gain = ctx.createGain();
    gain.gain.value = 0.0001;
    osc.frequency.value = 760;
    lfo.connect(lfoGain).connect(osc.frequency);
    osc.connect(gain).connect(master);
    osc.start();
    lfo.start();
    siren = { osc, lfo, gain };
  }

  return {
    resume,
    mute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.35;
      return muted;
    },
    unlock() {
      resume();
      startEngine();
      startSiren();
    },
    engine(speed, active) {
      if (!engine) return;
      const now = ctx.currentTime;
      const hz = 46 + Math.abs(speed) * 5.2;
      engine.osc.frequency.setTargetAtTime(hz, now, 0.08);
      engine.sub.frequency.setTargetAtTime(hz * 0.5, now, 0.08);
      engine.filter.frequency.setTargetAtTime(320 + Math.abs(speed) * 26, now, 0.1);
      engine.gain.gain.setTargetAtTime(active ? 0.05 + Math.min(0.06, Math.abs(speed) * 0.0025) : 0.0001, now, 0.12);
    },
    siren(on) {
      if (!siren) return;
      siren.gain.gain.setTargetAtTime(on && !muted ? 0.045 : 0.0001, ctx.currentTime, 0.2);
    },
    gunshot() {
      noise(0.22, 1400, 0.7, 0.5);
      tone(120, 0.12, 0.25, 'sawtooth', -70);
    },
    punch() {
      noise(0.1, 420, 1.2, 0.32);
    },
    hit() {
      tone(140, 0.1, 0.2, 'square', -60);
    },
    crash() {
      noise(0.5, 380, 0.9, 0.55);
      tone(70, 0.35, 0.3, 'triangle', -30);
    },
    skid() {
      noise(0.12, 900, 2.5, 0.12, 'bandpass');
    },
    pickup() {
      tone(880, 0.12, 0.16);
      setTimeout(() => tone(1320, 0.16, 0.14), 90);
    },
    cash() {
      tone(660, 0.1, 0.14);
      setTimeout(() => tone(990, 0.12, 0.14), 80);
      setTimeout(() => tone(1320, 0.16, 0.12), 170);
    },
    click() {
      tone(320, 0.08, 0.12, 'square');
    },
    mission() {
      [440, 554, 659, 880].forEach((hz, i) => setTimeout(() => tone(hz, 0.22, 0.14), i * 110));
    },
    fail() {
      tone(220, 0.3, 0.18, 'sawtooth', -120);
    },
    hospital() {
      [392, 330, 262].forEach((hz, i) => setTimeout(() => tone(hz, 0.3, 0.12), i * 160));
    },
  };
}
