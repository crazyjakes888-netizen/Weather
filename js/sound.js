/* ============================================
   Ambient sound engine.
   Plays pre-rendered audio loops (assets/audio)
   through Web Audio for seamless looping:
   - ambient.mp3: calm bedtime-style music pad
   - rain.mp3: rainfall, layered in during rain
   Thunder and the alert bell are synthesized.
   If the files fail to load/decode, a simple
   synth pad + noise rain take their place.
   Browsers only allow audio after a user
   gesture, so playback starts on first tap.
   ============================================ */

const Sound = (function () {
  const AMBIENT_URL = "assets/audio/ambient.mp3";
  const RAIN_URL = "assets/audio/rain.mp3";

  let ctx = null;
  let master = null;
  let ambientGain = null;
  let rainGain = null;
  let started = false;
  let enabled = localStorage.getItem("weather-sound") !== "off";
  let scene = { rain: 0, thunder: false };
  const sources = { ambient: "none", rain: "none" };

  const AMBIENT_LEVEL = 0.45;

  function ensure() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.6;
    master.connect(ctx.destination);
    ambientGain = ctx.createGain();
    ambientGain.gain.value = 0;
    ambientGain.connect(master);
    rainGain = ctx.createGain();
    rainGain.gain.value = 0;
    rainGain.connect(master);

    loadLoop(AMBIENT_URL, ambientGain).then(
      () => (sources.ambient = "file"),
      () => {
        sources.ambient = "synth";
        buildSynthPad();
      },
    );
    loadLoop(RAIN_URL, rainGain).then(
      () => (sources.rain = "file"),
      () => {
        sources.rain = "synth";
        buildSynthRain();
      },
    );
  }

  async function loadLoop(url, gainNode) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`audio fetch failed (${response.status})`);
    const buffer = await ctx.decodeAudioData(await response.arrayBuffer());
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    src.connect(gainNode);
    src.start();
  }

  // ---------- Synth fallbacks (used only if the files can't play) ----------

  function buildSynthPad() {
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 900;
    filter.connect(ambientGain);
    const notes = [110, 164.81, 220, 277.18]; // A2 E3 A3 C#4
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = i < 2 ? "sine" : "triangle";
      osc.frequency.value = freq;
      osc.detune.value = (i % 2 ? 1 : -1) * 3;
      const gain = ctx.createGain();
      gain.gain.value = 0.12;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.05 + i * 0.023;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.04;
      lfo.connect(lfoGain);
      lfoGain.connect(gain.gain);
      osc.connect(gain);
      gain.connect(filter);
      osc.start();
      lfo.start();
    });
  }

  function noiseBuffer(seconds) {
    const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  function buildSynthRain() {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(4);
    src.loop = true;
    const highpass = ctx.createBiquadFilter();
    highpass.type = "highpass";
    highpass.frequency.value = 300;
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.value = 1400;
    src.connect(highpass);
    highpass.connect(lowpass);
    lowpass.connect(rainGain);
    src.start();
  }

  // ---------- Playback control ----------

  function apply() {
    if (!started || !ctx) return;
    const t = ctx.currentTime;
    ambientGain.gain.setTargetAtTime(enabled ? AMBIENT_LEVEL : 0, t, 1.2);
    rainGain.gain.setTargetAtTime(enabled ? scene.rain : 0, t, 1.2);
  }

  function start() {
    if (!enabled) return;
    ensure();
    if (!ctx) return;
    if (ctx.state !== "running") {
      ctx.resume();
      // iOS unlock trick: play a silent buffer inside the user gesture.
      const buf = ctx.createBuffer(1, 1, 22050);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.start(0);
    }
    started = true;
    apply();
  }

  // Low rumble with a falling filter sweep; called after a lightning flash.
  function thunder() {
    if (!started || !enabled || !ctx) return;
    const t = ctx.currentTime;
    const dur = 2.5 + Math.random() * 1.5;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(dur);
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(320, t);
    filter.frequency.exponentialRampToValueAtTime(60, t + dur);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.5, t + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t);
    src.stop(t + dur);
  }

  // Soft two-partial chime for new weather alerts.
  function bell() {
    if (!started || !enabled || !ctx) return;
    const t = ctx.currentTime;
    [880, 1320].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(i ? 0.05 : 0.12, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
      osc.connect(gain);
      gain.connect(master);
      osc.start(t);
      osc.stop(t + 1.7);
    });
  }

  function setScene(next) {
    scene = { rain: 0, thunder: false, ...next };
    apply();
  }

  function toggle() {
    enabled = !enabled;
    localStorage.setItem("weather-sound", enabled ? "on" : "off");
    if (enabled && !started) start(); // the toggle click is itself a gesture
    apply();
    return enabled;
  }

  function isEnabled() {
    return enabled;
  }

  function status() {
    return { started, enabled, ...sources };
  }

  // Keep trying on every gesture until the context is actually running —
  // iOS in particular can ignore the first resume attempt.
  const GESTURES = ["pointerdown", "touchend", "click", "keydown"];
  function onGesture() {
    start();
    if (ctx && ctx.state === "running") {
      GESTURES.forEach((evt) => document.removeEventListener(evt, onGesture));
    }
  }
  GESTURES.forEach((evt) => document.addEventListener(evt, onGesture));

  // iOS suspends audio when the tab is hidden; resume on return.
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && started && ctx && ctx.state !== "running") {
      ctx.resume();
    }
  });

  return { setScene, thunder, bell, toggle, isEnabled, status };
})();
window.Sound = Sound;
