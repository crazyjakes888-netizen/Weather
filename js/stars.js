/* ============================================
   Starfield background — twinkling stars plus
   shooting-star tracers on a full-screen canvas.
   ============================================ */

(function () {
  const canvas = document.getElementById("stars");
  const ctx = canvas.getContext("2d");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let width = 0;
  let height = 0;
  let stars = [];
  let shootingStars = [];
  let nextShootingStarAt = 0;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    makeStars();
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
      driftSpeed: Math.random() * 2 + 0.5, // slow downward-right drift, px/s
    }));
  }

  function spawnShootingStar(now) {
    // Start near the top, streak diagonally down.
    const fromLeft = Math.random() < 0.5;
    const angle = fromLeft
      ? Math.PI / 4 + (Math.random() - 0.5) * 0.3 // down-right
      : (3 * Math.PI) / 4 + (Math.random() - 0.5) * 0.3; // down-left
    const speed = 400 + Math.random() * 500; // px/s
    shootingStars.push({
      x: Math.random() * width,
      y: Math.random() * height * 0.4,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0,
      maxLife: 0.9 + Math.random() * 0.7, // seconds
      trail: 90 + Math.random() * 110, // tracer length in px
    });
    nextShootingStarAt = now + 1200 + Math.random() * 3000;
  }

  function drawStars(now) {
    const t = now / 1000;
    for (const star of stars) {
      const twinkle = 0.5 + 0.5 * Math.sin(t * star.twinkleSpeed + star.twinklePhase);
      ctx.globalAlpha = star.baseAlpha * (0.4 + 0.6 * twinkle);
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

  function drawShootingStars(dt) {
    shootingStars = shootingStars.filter((s) => s.life < s.maxLife);
    for (const s of shootingStars) {
      s.life += dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;

      // Fade in quickly, fade out at end of life.
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

      // Bright head with a soft glow.
      ctx.beginPath();
      ctx.arc(s.x, s.y, 1.8, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.shadowColor = "rgba(255, 255, 255, 0.8)";
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  let lastFrame = performance.now();

  function frame(now) {
    const dt = Math.min((now - lastFrame) / 1000, 0.05);
    lastFrame = now;

    ctx.clearRect(0, 0, width, height);
    drawStars(now);
    driftStars(dt);

    if (now >= nextShootingStarAt) spawnShootingStar(now);
    drawShootingStars(dt);

    requestAnimationFrame(frame);
  }

  resize();
  window.addEventListener("resize", resize);

  if (reducedMotion) {
    // Static starfield only — no animation, no tracers.
    drawStars(performance.now());
  } else {
    nextShootingStarAt = performance.now() + 800;
    requestAnimationFrame(frame);
  }
})();
