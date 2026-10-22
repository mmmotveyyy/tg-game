// =====================================================================
//  МУЗЫКА И ЗВУКИ — синтезируются прямо в браузере, файлов нет.
//  Настроения: under (туннели), calm (станции), surface (поверхность),
//  fight (бой), good (хороший финал), bad (смерть).
// =====================================================================

const Sound = (() => {
  let ctx = null, master, music, fx, droneF, droneG, windG, noiseBuf;
  let mood = "under", step = 0;
  let muted = false;
  try { muted = localStorage.getItem("lt-muted") === "1"; } catch (e) {}

  // notes — из каких нот собирается мелодия, pad — как часто звучит нота (в тиках по 0.25 с)
  const MOODS = {
    under:   { cutoff: 260, drone: 0.16, wind: 0,    pad: 16, notes: [110, 130.8, 146.8, 164.8, 196], drips: 0.08 },
    calm:    { cutoff: 420, drone: 0.09, wind: 0,    pad: 8,  notes: [220, 261.6, 293.7, 329.6, 392], drips: 0.02 },
    surface: { cutoff: 200, drone: 0.12, wind: 0.14, pad: 20, notes: [110, 116.5, 146.8, 164.8], drips: 0 },
    fight:   { cutoff: 700, drone: 0.2,  wind: 0,    pad: 8,  notes: [110, 116.5, 155.6], drips: 0, pulse: true },
    good:    { cutoff: 500, drone: 0.05, wind: 0,    pad: 6,  notes: [261.6, 329.6, 392, 440, 523.3], drips: 0 },
    bad:     { cutoff: 150, drone: 0.14, wind: 0.05, pad: 24, notes: [55, 58.3, 82.4], drips: 0.03 },
  };

  function makeNoise(sec) {
    const b = ctx.createBuffer(1, ctx.sampleRate * sec, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }

  function makeReverb(sec) {
    const len = ctx.sampleRate * sec;
    const b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    return b;
  }

  function tone(freq, o = {}) {
    const { dur = 0.3, type = "sine", gain = 0.2, attack = 0.005, dest = fx, when = 0, slide = 0 } = o;
    const t = ctx.currentTime + when;
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(dest);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  function noise(dur, o = {}) {
    const { gain = 0.3, freq = 1000, q = 1, type = "bandpass", dest = fx, when = 0 } = o;
    const t = ctx.currentTime + when;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(dest);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  // запускается по первому касанию экрана (браузеры не дают играть звук раньше)
  function init() {
    if (ctx) { if (ctx.state === "suspended" && !document.hidden) ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    noiseBuf = makeNoise(2);

    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.9;
    master.connect(ctx.destination);

    const rev = ctx.createConvolver();
    rev.buffer = makeReverb(3.5);
    const revOut = ctx.createGain();
    revOut.gain.value = 0.6;
    rev.connect(revOut).connect(master);

    music = ctx.createGain();
    music.gain.value = 0.55;
    music.connect(master);
    music.connect(rev);

    fx = ctx.createGain();
    fx.gain.value = 0.5;
    fx.connect(master);

    // низкий гул метро
    droneF = ctx.createBiquadFilter();
    droneF.type = "lowpass"; droneF.frequency.value = 260; droneF.Q.value = 3;
    droneG = ctx.createGain();
    droneG.gain.value = 0;
    droneF.connect(droneG).connect(music);
    [55, 55.3, 82.6].forEach((f) => {
      const o = ctx.createOscillator();
      o.type = "sawtooth"; o.frequency.value = f;
      o.connect(droneF); o.start();
    });
    const lfo = ctx.createOscillator(), lfoG = ctx.createGain();
    lfo.frequency.value = 0.06; lfoG.gain.value = 90;
    lfo.connect(lfoG).connect(droneF.frequency); lfo.start();

    // ветер на поверхности
    const wind = ctx.createBufferSource();
    wind.buffer = noiseBuf; wind.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass"; bp.frequency.value = 450; bp.Q.value = 0.7;
    windG = ctx.createGain();
    windG.gain.value = 0;
    wind.connect(bp).connect(windG).connect(music);
    wind.start();
    const wl = ctx.createOscillator(), wlG = ctx.createGain();
    wl.frequency.value = 0.11; wlG.gain.value = 250;
    wl.connect(wlG).connect(bp.frequency); wl.start();

    setInterval(tick, 250);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) ctx.suspend(); else ctx.resume();
    });
    applyMood();
  }

  function tick() {
    if (!ctx || ctx.state !== "running") return;
    const m = MOODS[mood];
    step++;
    if (step % m.pad === 0) {
      const f = m.notes[Math.floor(Math.random() * m.notes.length)];
      tone(f, { dur: 4, type: "triangle", gain: 0.07, attack: 1.2, dest: music });
      if (Math.random() < 0.5) tone(f * 1.5, { dur: 3.5, gain: 0.04, attack: 1.5, dest: music, when: 0.3 });
    }
    if (m.drips && Math.random() < m.drips) {
      tone(1400 + Math.random() * 1400, { dur: 0.12, gain: 0.05, dest: music, slide: 900 });
    }
    if (m.pulse) {
      // тревожное «сердцебиение»
      if (step % 4 === 0) tone(110, { dur: 0.25, gain: 0.35, dest: music, slide: 40 });
      if (step % 4 === 1) tone(100, { dur: 0.2, gain: 0.2, dest: music, slide: 40 });
    }
  }

  function applyMood() {
    if (!ctx) return;
    const m = MOODS[mood], t = ctx.currentTime;
    droneF.frequency.setTargetAtTime(m.cutoff, t, 1.5);
    droneG.gain.setTargetAtTime(m.drone, t, 1.5);
    windG.gain.setTargetAtTime(m.wind, t, 2);
  }

  function setMood(m) {
    if (!MOODS[m] || m === mood) return;
    mood = m;
    step = 0;
    applyMood();
  }

  function toggle() {
    muted = !muted;
    try { localStorage.setItem("lt-muted", muted ? "1" : "0"); } catch (e) {}
    if (ctx) master.gain.setTargetAtTime(muted ? 0 : 0.9, ctx.currentTime, 0.1);
    return muted;
  }

  // обёртка: звуковой эффект играет, только если звук включён
  const sfx = (fn) => (when = 0) => { if (ctx && !muted) fn(when); };

  return {
    init,
    setMood,
    toggle,
    isMuted: () => muted,
    click: sfx((w) => tone(900, { dur: 0.05, type: "square", gain: 0.04, when: w })),
    hit:   sfx((w) => { noise(0.15, { gain: 0.5, freq: 800, q: 0.8, when: w }); tone(150, { dur: 0.15, gain: 0.3, slide: 60, when: w }); }),
    crit:  sfx((w) => { noise(0.25, { gain: 0.7, freq: 1200, q: 0.6, when: w }); tone(220, { dur: 0.3, type: "square", gain: 0.15, slide: 50, when: w }); }),
    miss:  sfx((w) => noise(0.12, { gain: 0.2, freq: 3000, q: 2, when: w })),
    hurt:  sfx((w) => { tone(220, { dur: 0.25, type: "sawtooth", gain: 0.15, slide: 90, when: w }); noise(0.1, { gain: 0.3, freq: 300, when: w }); }),
    shot:  sfx((w) => { noise(0.3, { gain: 0.6, freq: 2500, q: 0.5, type: "highpass", when: w }); tone(90, { dur: 0.2, gain: 0.3, slide: 40, when: w }); }),
    boom:  sfx((w) => { noise(0.8, { gain: 0.9, freq: 200, q: 0.5, type: "lowpass", when: w }); tone(70, { dur: 0.6, gain: 0.4, slide: 30, when: w }); }),
    heal:  sfx((w) => [523.3, 659.3, 784].forEach((f, i) => tone(f, { dur: 0.3, gain: 0.07, when: w + i * 0.07 }))),
    coin:  sfx((w) => { tone(1300, { dur: 0.08, type: "square", gain: 0.05, when: w }); tone(1800, { dur: 0.12, type: "square", gain: 0.05, when: w + 0.07 }); }),
    win:   sfx((w) => [261.6, 329.6, 392, 523.3].forEach((f, i) => tone(f, { dur: 0.35, type: "square", gain: 0.06, when: w + i * 0.09 }))),
    level: sfx((w) => [392, 493.9, 587.3, 784, 987.8].forEach((f, i) => tone(f, { dur: 0.4, type: "triangle", gain: 0.1, when: w + i * 0.08 }))),
    death: sfx((w) => tone(220, { dur: 2, type: "sawtooth", gain: 0.15, slide: 35, when: w })),
  };
})();
