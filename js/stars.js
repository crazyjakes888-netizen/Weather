/* ============================================
   Animated background engine.
   Base look: black sky with twinkling stars and
   shooting-star tracers (the homepage).
   The weather view switches the background to
   match live conditions: rain, snow, clouds,
   fog, thunderstorms, or a clear-day glow.
   ============================================ */

const Background = (function () {
  const canvas = document.getElementById("stars");
  const ctx = canvas.getContext("2d");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let width = 0;
  let height = 0;
  let mode = "stars";
  let sceneIsDay = false;
  let sceneTwilight = false;

  let stars = [];
  let shootingStars = [];
  let nextShootingStarAt = 0;
  let rainDrops = [];
  let snowFlakes = [];
  let clouds = [];
  let flashAlpha = 0;
  let nextFlashAt = 0;

  // How each mode composes the scene.
  const MODES = {
    stars: { starDim: 1, shooting: true },
    "clear-day": { starDim: 0.3, glow: true },
    cloudy: { starDim: 0.35, clouds: true },
    fog: { starDim: 0.25, clouds: true, fog: true },
    drizzle: { starDim: 0.25, clouds: true, rain: 70, rainSpeed: 380, rainLen: 9, rainAlpha: 0.35 },
    rain: { starDim: 0.2, clouds: true, rain: 160, rainSpeed: 700, rainLen: 16, rainAlpha: 0.5 },
    thunder: { starDim: 0.15, clouds: true, rain: 210, rainSpeed: 850, rainLen: 20, rainAlpha: 0.55, lightning: true },
    snow: { starDim: 0.3, clouds: true, snow: 130 },
  };

  function conf() {
    return MODES[mode] || MODES.stars;
  }

  // Daytime sky gradients per scene; night stays black with stars.
  const SKY_DAY = {
    "clear-day": ["#2f74c9", "#8ec9f5"],
    cloudy: ["#5b7a99", "#a3b8cb"],
    fog: ["#8a97a5", "#bcc6d0"],
    drizzle: ["#4a5d73", "#8299ae"],
    rain: ["#42536b", "#75899e"],
    thunder: ["#2b3646", "#4f5f71"],
    snow: ["#6f8299", "#b5c4d4"],
  };
  const SKY_TWILIGHT = ["#1d2c5e", "#d97548"];

  function skyColors() {
    if (sceneTwilight && ["clear-day", "stars", "cloudy"].includes(mode)) {
      return SKY_TWILIGHT;
    }
    if (!sceneIsDay) return null;
    return SKY_DAY[mode] || null;
  }

  // ---------- Setup ----------

  let lastW = 0;
  let lastH = 0;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    // Mobile browsers fire resize when the URL bar hides/shows while
    // scrolling; only regenerate the scene on a real size change.
    const regenerate =
      stars.length === 0 || Math.abs(w - lastW) > 2 || Math.abs(h - lastH) > lastH * 0.25;
    lastW = w;
    lastH = h;
    width = w;
    height = h;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (regenerate) {
      makeStars();
      makeParticles();
    }
    if (reducedMotion) drawStatic();
  }

  function makeStars() {
    const count = Math.floor((width * height) / 5000);
    stars = Array.from({ length: count }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      radius: Math.random() * 1.1 + 0.3,
      baseAlpha: Math.random() * 0.5 + 0.3,
      twinkleSpeed: Math.random() * 1.5 + 0.3,
      twinklePhase: Math.random() * Math.PI * 2,
      driftSpeed: Math.random() * 0.9 + 0.2,
    }));
  }

  function makeParticles() {
    const c = conf();
    rainDrops = !c.rain
      ? []
      : Array.from({ length: c.rain }, () => ({
          x: Math.random() * (width + 100) - 50,
          y: Math.random() * height,
          speed: c.rainSpeed * (0.7 + Math.random() * 0.6),
          len: c.rainLen * (0.7 + Math.random() * 0.6),
        }));
    snowFlakes = !c.snow
      ? []
      : Array.from({ length: c.snow }, () => ({
          x: Math.random() * width,
          y: Math.random() * height,
          r: 0.8 + Math.random() * 1.7,
          speed: 18 + Math.random() * 35,
          phase: Math.random() * Math.PI * 2,
        }));
    clouds = !c.clouds && !c.fog
      ? []
      : Array.from({ length: 6 }, (_, i) => ({
          x: Math.random() * width,
          y: (height / 7) * i * 0.9 + Math.random() * 40,
          rx: 160 + Math.random() * 220,
          ry: 30 + Math.random() * 40,
          speed: 4 + Math.random() * 10,
          alpha: 0.03 + Math.random() * 0.035,
        }));
  }

  // ---------- Drawing ----------

  function drawSky() {
    const colors = skyColors();
    if (!colors) return false;
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, colors[0]);
    gradient.addColorStop(1, colors[1]);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    return true;
  }

  function drawStars(now) {
    const t = now / 1000;
    let dim = conf().starDim;
    if (skyColors()) {
      if (!sceneTwilight) return; // stars invisible in daylight
      dim *= 0.35; // faint stars at dusk/dawn
    }
    for (const star of stars) {
      const twinkle = 0.5 + 0.5 * Math.sin(t * star.twinkleSpeed + star.twinklePhase);
      ctx.globalAlpha = star.baseAlpha * (0.4 + 0.6 * twinkle) * dim;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function driftStars(dt) {
    for (const star of stars) {
      star.x += star.driftSpeed * dt * 0.4;
      star.y += star.driftSpeed * dt;
      if (star.y > height + 2) {
        star.y = -2;
        star.x = Math.random() * width;
      }
      if (star.x > width + 2) star.x = -2;
    }
  }

  function drawGlow() {
    const cx = width * 0.75;
    const cy = height * 0.16;
    // Visible sun disc with a soft halo on the day sky.
    const sun = ctx.createRadialGradient(cx, cy, 0, cx, cy, 90);
    sun.addColorStop(0, "rgba(255, 250, 225, 0.95)");
    sun.addColorStop(0.35, "rgba(255, 235, 170, 0.55)");
    sun.addColorStop(1, "rgba(255, 225, 140, 0)");
    ctx.fillStyle = sun;
    ctx.fillRect(cx - 90, cy - 90, 180, 180);
    const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(width, height) * 0.5);
    halo.addColorStop(0, "rgba(255, 230, 160, 0.22)");
    halo.addColorStop(1, "rgba(255, 220, 140, 0)");
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, width, height);
  }

  function drawClouds(dt) {
    const daylight = !!skyColors();
    for (const cloud of clouds) {
      cloud.x += cloud.speed * dt;
      if (cloud.x - cloud.rx > width) cloud.x = -cloud.rx;
      ctx.beginPath();
      ctx.ellipse(cloud.x, cloud.y, cloud.rx, cloud.ry, 0, 0, Math.PI * 2);
      // Bright soft clouds against a day sky, dark wisps at night.
      ctx.fillStyle = daylight
        ? `rgba(255, 255, 255, ${Math.min(cloud.alpha * 6, 0.42)})`
        : `rgba(170, 185, 205, ${cloud.alpha})`;
      ctx.fill();
    }
  }

  function drawFog(now) {
    const t = now / 1000;
    for (let i = 0; i < 3; i++) {
      const y = height * (0.3 + 0.25 * i) + Math.sin(t * 0.15 + i * 2) * 30;
      const gradient = ctx.createLinearGradient(0, y - 70, 0, y + 70);
      gradient.addColorStop(0, "rgba(190, 200, 215, 0)");
      gradient.addColorStop(0.5, "rgba(190, 200, 215, 0.05)");
      gradient.addColorStop(1, "rgba(190, 200, 215, 0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, y - 70, width, 140);
    }
  }

  function drawRain(dt) {
    const c = conf();
    ctx.strokeStyle = `rgba(160, 190, 255, ${c.rainAlpha})`;
    ctx.lineWidth = 1.1;
    ctx.lineCap = "round";
    ctx.beginPath();
    for (const drop of rainDrops) {
      drop.y += drop.speed * dt;
      drop.x += drop.speed * 0.12 * dt;
      if (drop.y - drop.len > height) {
        drop.y = -drop.len;
        drop.x = Math.random() * (width + 100) - 50;
      }
      ctx.moveTo(drop.x, drop.y);
      ctx.lineTo(drop.x - drop.len * 0.12, drop.y - drop.len);
    }
    ctx.stroke();
  }

  function drawSnow(now, dt) {
    const t = now / 1000;
    ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
    for (const flake of snowFlakes) {
      flake.y += flake.speed * dt;
      flake.x += Math.sin(t * 0.8 + flake.phase) * 12 * dt;
      if (flake.y - flake.r > height) {
        flake.y = -flake.r;
        flake.x = Math.random() * width;
      }
      ctx.beginPath();
      ctx.arc(flake.x, flake.y, flake.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawLightning(now, dt) {
    if (now >= nextFlashAt) {
      flashAlpha = 0.4 + Math.random() * 0.2;
      nextFlashAt = now + 2500 + Math.random() * 5500;
      // Flash first, thunder rolls in shortly after.
      if (typeof Sound !== "undefined") {
        setTimeout(() => Sound.thunder(), 150 + Math.random() * 900);
      }
    }
    if (flashAlpha > 0.004) {
      ctx.fillStyle = `rgba(225, 235, 255, ${flashAlpha})`;
      ctx.fillRect(0, 0, width, height);
      flashAlpha *= Math.pow(0.0001, dt); // fast decay
    }
  }

  // ---------- Shooting stars ----------

  function spawnShootingStar(now) {
    const fromLeft = Math.random() < 0.5;
    const angle = fromLeft
      ? Math.PI / 4 + (Math.random() - 0.5) * 0.3
      : (3 * Math.PI) / 4 + (Math.random() - 0.5) * 0.3;
    const speed = 400 + Math.random() * 500;
    shootingStars.push({
      x: Math.random() * width,
      y: Math.random() * height * 0.4,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0,
      maxLife: 0.9 + Math.random() * 0.7,
      trail: 90 + Math.random() * 110,
    });
    nextShootingStarAt = now + 1200 + Math.random() * 3000;
  }

  function drawShootingStars(dt) {
    shootingStars = shootingStars.filter((s) => s.life < s.maxLife);
    for (const s of shootingStars) {
      s.life += dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;

      const progress = s.life / s.maxLife;
      const alpha = progress < 0.15 ? progress / 0.15 : 1 - (progress - 0.15) / 0.85;

      const norm = Math.hypot(s.vx, s.vy);
      const tailX = s.x - (s.vx / norm) * s.trail;
      const tailY = s.y - (s.vy / norm) * s.trail;

      const gradient = ctx.createLinearGradient(s.x, s.y, tailX, tailY);
      gradient.addColorStop(0, `rgba(255, 255, 255, ${0.9 * alpha})`);
      gradient.addColorStop(0.4, `rgba(180, 200, 255, ${0.35 * alpha})`);
      gradient.addColorStop(1, "rgba(180, 200, 255, 0)");

      ctx.strokeStyle = gradient;
      ctx.lineWidth = 1.6;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(tailX, tailY);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(s.x, s.y, 1.8, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.shadowColor = "rgba(255, 255, 255, 0.8)";
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  // ---------- Main loop ----------

  let lastFrame = performance.now();

  function frame(now) {
    const dt = Math.min((now - lastFrame) / 1000, 0.05);
    lastFrame = now;
    const c = conf();

    ctx.clearRect(0, 0, width, height);
    drawSky();
    drawStars(now);
    driftStars(dt);
    if (c.glow) drawGlow();
    if (c.clouds) drawClouds(dt);
    if (c.fog) drawFog(now);
    if (c.rain) drawRain(dt);
    if (c.snow) drawSnow(now, dt);
    if (c.lightning) drawLightning(now, dt);
    if (c.shooting) {
      if (now >= nextShootingStarAt) spawnShootingStar(now);
      drawShootingStars(dt);
    }

    requestAnimationFrame(frame);
  }

  function drawStatic() {
    ctx.clearRect(0, 0, width, height);
    drawSky();
    drawStars(performance.now());
    const c = conf();
    if (c.glow) drawGlow();
    if (c.clouds) drawClouds(0);
  }

  // ---------- Public API ----------

  function setWeather(newMode, { isDay = false, twilight = false } = {}) {
    const resolved = MODES[newMode] ? newMode : "stars";
    if (resolved === mode && isDay === sceneIsDay && twilight === sceneTwilight) {
      return; // same scene — don't reshuffle particles
    }
    mode = resolved;
    sceneIsDay = isDay;
    sceneTwilight = twilight;
    shootingStars = [];
    flashAlpha = 0;
    nextFlashAt = performance.now() + 1500;
    makeParticles();
    if (reducedMotion) drawStatic();
  }

  resize();
  window.addEventListener("resize", resize);

  if (!reducedMotion) {
    nextShootingStarAt = performance.now() + 800;
    requestAnimationFrame(frame);
  }

  return { setWeather };
})();
