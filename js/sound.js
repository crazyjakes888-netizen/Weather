/* ============================================
   Ambient sound engine (Web Audio, no files).
   - Soft bedtime-style synth pad, very subtle
   - Rain noise layered in during rain scenes
   - Thunder rumble triggered by lightning
   Browsers only allow audio after a user
   gesture, so playback starts on first tap.
   ============================================ */

const Sound = (function () {
  let ctx = null;
  let master = null;
  let ambientGain = null;
  let rainGain = null;
  let started = false;
  let enabled = localStorage.getItem("weather-sound") !== "off";
  let scene = { rain: 0, thunder: false };

  const AMBIENT_LEVEL = 0.9;

  function ensure() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.4;
    master.connect(ctx.destination);
    buildAmbient();
    buildRain();
  }

  // Warm A-major pad with slow, phase-offset "breathing" per voice.
  function buildAmbient() {
    ambientGain = ctx.createGain();
    ambientGain.gain.value = 0;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 900;
    ambientGain.connect(filter);
    filter.connect(master);

    const notes = [110, 164.81, 220, 277.18]; // A2 E3 A3 C#4
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = i < 2 ? "sine" : "triangle";
      osc.frequency.value = freq;
      osc.detune.value = (i % 2 ? 1 : -1) * 3;
      const gain = ctx.createGain();
      gain.gain.value = 0.028;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.05 + i * 0.023;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.012;
      lfo.connect(lfoGain);
      lfoGain.connect(gain.gain);
      osc.connect(gain);
      gain.connect(ambientGain);
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

  // Looped, band-passed noise — level set per scene (drizzle/rain/storm).
  function buildRain() {
    rainGain = ctx.createGain();
    rainGain.gain.value = 0;
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
    rainGain.connect(master);
    src.start();
  }

  function apply() {
    if (!started || !ctx) return;
    const t = ctx.currentTime;
    ambientGain.gain.setTargetAtTime(enabled ? AMBIENT_LEVEL : 0, t, 1.2);
    rainGain.gain.setTargetAtTime(enabled ? scene.rain : 0, t, 1.2);
  }

  function start() {
    if (started || !enabled) return;
    ensure();
    if (!ctx) return;
    ctx.resume();
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

  function onFirstGesture() {
    start();
    if (started) {
      document.removeEventListener("pointerdown", onFirstGesture);
      document.removeEventListener("keydown", onFirstGesture);
    }
  }
  document.addEventListener("pointerdown", onFirstGesture);
  document.addEventListener("keydown", onFirstGesture);

  return { setScene, thunder, bell, toggle, isEnabled };
})();
window.Sound = Sound;
