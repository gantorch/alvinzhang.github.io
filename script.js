(() => {
  const canvas = document.getElementById('cursor-canvas');
  const ctx = canvas && canvas.getContext ? canvas.getContext('2d', { alpha: true }) : null;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isTouchCapable = matchMedia('(hover: none), (pointer: coarse)').matches;

  // If we cannot draw or motion is reduced, bail gracefully
  if (!canvas || !ctx || prefersReducedMotion) {
    document.body.classList.remove('cursor-hidden');
    if (canvas) canvas.style.display = 'none';
    return;
  }

  // Enable custom cursor
  document.body.classList.add('cursor-hidden');

  // Resize handling
  function resize() {
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const w = Math.floor(window.innerWidth);
    const h = Math.floor(window.innerHeight);
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', resize, { passive: true });
  resize();

  // Colors inspired by warm firefly yellows
  const palette = ['#fff176', '#ffecb3', '#ffe082', '#ffd54f', '#fdd835', '#fff59d'];

  // Particle system
  const NUM_PARTICLES = 26;
  const particles = [];
  const rng = (min, max) => Math.random() * (max - min) + min;

  const mouse = {
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
    vx: 0,
    vy: 0,
    lastX: null,
    lastY: null,
    lastMoveAt: performance.now(),
    isDown: false,
  };

  // Initialize particles
  for (let i = 0; i < NUM_PARTICLES; i++) {
    particles.push({
      x: mouse.x + rng(-20, 20),
      y: mouse.y + rng(-20, 20),
      size: rng(1.5, 3.8),
      color: palette[(Math.random() * palette.length) | 0],
      orbitOffset: rng(0, Math.PI * 2),
      followStrength: rng(0.08, 0.22),
      jitter: rng(0.3, 1.0),
      opacity: rng(0.5, 0.9),
    });
  }

  // Movement & input
  function handlePointerMove(e) {
    const x = e.clientX;
    const y = e.clientY;
    const now = performance.now();
    if (mouse.lastX != null) {
      mouse.vx = x - mouse.lastX;
      mouse.vy = y - mouse.lastY;
    }
    mouse.x = x;
    mouse.y = y;
    mouse.lastX = x;
    mouse.lastY = y;
    mouse.lastMoveAt = now;
  }
  function handlePointerDown() {
    mouse.isDown = true;
  }
  function handlePointerUp() {
    mouse.isDown = false;
  }

  window.addEventListener('pointermove', handlePointerMove, { passive: true });
  window.addEventListener('pointerdown', handlePointerDown, { passive: true });
  window.addEventListener('pointerup', handlePointerUp, { passive: true });

  // Touch devices: let the native cursor be shown; still render subtle glow near touch
  if (isTouchCapable) {
    document.body.classList.remove('cursor-hidden');
  }

  // Animation loop
  let lastTime = performance.now();
  const IDLE_THRESHOLD_MS = 160;

  function draw() {
    const now = performance.now();
    const dt = Math.min(64, now - lastTime);
    lastTime = now;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'lighter';

    const idle = now - mouse.lastMoveAt > IDLE_THRESHOLD_MS;

    // Core cursor glow
    const coreSize = mouse.isDown ? 7 : 5;
    const coreOpacity = mouse.isDown ? 0.8 : 0.65;
    ctx.save();
    ctx.globalAlpha = coreOpacity;
    ctx.shadowColor = 'rgba(255, 240, 170, 0.85)';
    ctx.shadowBlur = mouse.isDown ? 30 : 18;
    ctx.fillStyle = '#fff8c4';
    ctx.beginPath();
    ctx.arc(mouse.x, mouse.y, coreSize, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Particle behavior
    if (idle) {
      // Encircle when still: orbit around the cursor
      const orbitRadius = mouse.isDown ? 26 : 20;
      const orbitSpeed = (mouse.isDown ? 0.0022 : 0.0016) * dt; // radians per ms scaled by dt
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.orbitOffset += orbitSpeed + 0.0005 * Math.sin(now * 0.002 + i); // subtle organic wobble
        const targetX = mouse.x + Math.cos(p.orbitOffset + (i * (Math.PI * 2)) / particles.length) * orbitRadius;
        const targetY = mouse.y + Math.sin(p.orbitOffset + (i * (Math.PI * 2)) / particles.length) * orbitRadius;
        p.x += (targetX - p.x) * (0.12 + p.followStrength * 0.5);
        p.y += (targetY - p.y) * (0.12 + p.followStrength * 0.5);
      }
    } else {
      // Follow when moving: create a trailing cluster that eases toward the pointer
      // Lead particle follows the cursor; each subsequent particle trails the previous one
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const leaderX = i === 0 ? mouse.x : particles[i - 1].x;
        const leaderY = i === 0 ? mouse.y : particles[i - 1].y;
        const strength = i === 0 ? 0.25 : p.followStrength;
        // subtle velocity-based offset for "motion tail"
        const lag = Math.min(14, i * 0.9);
        const offsetX = mouse.vx * (lag * 0.06);
        const offsetY = mouse.vy * (lag * 0.06);
        const targetX = leaderX - offsetX;
        const targetY = leaderY - offsetY;
        p.x += (targetX - p.x) * strength;
        p.y += (targetY - p.y) * strength;
      }
    }

    // Render particles
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      const flicker = 0.85 + Math.sin(now * 0.01 + i) * 0.08;
      const size = Math.max(1, p.size * flicker + (mouse.isDown ? 0.6 : 0));

      ctx.save();
      ctx.globalAlpha = Math.min(1, p.opacity * (mouse.isDown ? 1 : 0.9));
      ctx.fillStyle = p.color;
      ctx.shadowColor = 'rgba(255, 240, 170, 0.7)';
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.arc(p.x + rng(-p.jitter, p.jitter), p.y + rng(-p.jitter, p.jitter), size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    requestAnimationFrame(draw);
  }

  requestAnimationFrame(draw);
})();


