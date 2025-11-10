(() => {
  const canvas = document.getElementById('cursor-canvas');
  const ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null;
  if (!canvas || !ctx) return;

  const noCursor = window.matchMedia('(hover: none), (pointer: coarse)').matches;
  if (noCursor) {
    canvas.style.display = 'none';
    return;
  }

  const sizeScale = 1.2;
  const spawnRate = 2;
  const lifetimeMs = 2800;
  const speedScale = 0.2;
  const maxParticles = 400;
  const wanderStrength = 0.195;
  const followStrength = 0.08;
  const emissionRadius = 28;

  const TWO_PI = Math.PI * 2;
  const wander = wanderStrength;
  const follow = followStrength;
  const maxSpeed = 1 + 6 * speedScale;
  const vScale = speedScale;
  const dead = 900;

  let pendingResize = false;
  let resizeRafId = 0;
  const performResize = () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
    pendingResize = false;
  };
  const onResize = () => {
    if (!pendingResize) {
      pendingResize = true;
      resizeRafId = window.requestAnimationFrame(performResize);
    }
  };
  performResize();
  window.addEventListener('resize', onResize, { passive: true });

  let mouse = { x: canvas.width / 2, y: canvas.height / 2, out: true };
  let isPageVisible = !document.hidden;

  const handleMouseMove = (e) => {
    const x = e.clientX;
    const y = e.clientY;
    mouse = { x, y, out: false };
    if (!rafId && isPageVisible) {
      lastTime = performance.now();
      rafId = window.requestAnimationFrame(loop);
    }
  };
  const handleMouseOut = () => {
    mouse.out = true;
  };
  const handleVisibilityChange = () => {
    isPageVisible = !document.hidden;
    if (isPageVisible) {
      if (!rafId) {
        lastTime = performance.now();
        rafId = window.requestAnimationFrame(loop);
      }
    } else if (rafId) {
      window.cancelAnimationFrame(rafId);
      rafId = 0;
    }
  };

  window.addEventListener('mousemove', handleMouseMove, { passive: true });
  window.addEventListener('mouseout', handleMouseOut, { passive: true });
  document.addEventListener('visibilitychange', handleVisibilityChange);

  /** @type {Array<{x:number,y:number,xv:number,yv:number,s:number,life:number,lifetime:number,phase:number,flickerSpeed:number}>} */
  let particles = [];
  let spawnAccumulator = 0;
  let type = 0;
  let lastTime = 0;
  let rafId = 0;

  const newParticle = () => {
    type = type ? 0 : 1;
    const angle = Math.random() * TWO_PI;
    const radius = Math.sqrt(Math.random()) * emissionRadius;
    const sx = mouse.x + Math.cos(angle) * radius;
    const sy = mouse.y + Math.sin(angle) * radius;

    const outward = 0.6 + Math.random() * 0.6;
    const tangential = (Math.random() - 0.5) * 0.6;
    const vx = (Math.cos(angle) * outward - Math.sin(angle) * tangential) * vScale;
    const vy = (Math.sin(angle) * outward + Math.cos(angle) * tangential) * vScale;
    const base = type ? 1.3 : 1.6;

    particles.push({
      x: sx,
      y: sy,
      xv: vx,
      yv: vy,
      s: (type ? base + Math.random() : base) * sizeScale * (1 + Math.random()),
      life: 0,
      lifetime: Math.max(300, lifetimeMs),
      phase: Math.random() * TWO_PI,
      flickerSpeed: 1 + Math.random() * 2
    });
  };

  const startColor = { r: 255, g: 222, b: 120 };
  const endColor = { r: 255, g: 248, b: 180 };

  const draw = () => {
    if (particles.length === 0) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const p of particles) {
      const t = Math.max(0, Math.min(1, p.life / p.lifetime));
      const ct = Math.pow(t, 0.6);
      const r = Math.round(startColor.r + (endColor.r - startColor.r) * ct);
      const g = Math.round(startColor.g + (endColor.g - startColor.g) * ct);
      const b = Math.round(startColor.b + (endColor.b - startColor.b) * ct);
      const flicker = 0.6 + 0.4 * Math.sin(p.phase);
      ctx.globalAlpha = flicker;
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.s, 0, TWO_PI);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  };

  const calculate = (time) => {
    const dt = Math.min(100, time - lastTime);
    lastTime = time;

    if (!mouse.out) {
      spawnAccumulator += (dt / 1000) * Math.max(0, spawnRate);
      for (; spawnAccumulator >= 1; spawnAccumulator -= 1) newParticle();
    }

    const particleOverflow = particles.length - maxParticles;
    if (particleOverflow > 0) {
      particles = particles.slice(particleOverflow);
    }

    for (const p of particles) {
      p.xv += (Math.random() - 0.5) * wander;
      p.yv += (Math.random() - 0.5) * wander;

      if (!mouse.out) {
        const dx = mouse.x - p.x;
        const dy = mouse.y - p.y;
        const d2 = dx * dx + dy * dy;
        if (d2 > dead) {
          const inv = 1 / Math.sqrt(d2);
          p.xv += dx * inv * follow * 0.2;
          p.yv += dy * inv * follow * 0.2;
        } else {
          const inv = 1 / Math.max(1, Math.sqrt(d2));
          p.xv -= dx * inv * follow * 0.15;
          p.yv -= dy * inv * follow * 0.15;
        }
      }

      p.xv *= 0.985;
      p.yv *= 0.985;

      const speed = Math.hypot(p.xv, p.yv);
      if (speed > maxSpeed) {
        const s = maxSpeed / speed;
        p.xv *= s;
        p.yv *= s;
      }

      if (p.x < 0 || p.x > canvas.width) p.xv *= -0.8;
      if (p.y < 0 || p.y > canvas.height) p.yv *= -0.8;

      p.x += p.xv;
      p.y += p.yv;

      p.life += dt;
      p.phase += p.flickerSpeed * (dt / 1000);
    }

      for (let i = particles.length - 1; i >= 0; i--) {
      if (particles[i].life >= particles[i].lifetime) {
        const last = particles[particles.length - 1];
        if (last) particles[i] = last;
        particles.pop();
      }
    }
  };

  const loop = (time) => {
    draw();
    calculate(time);
    if (particles.length === 0 && mouse.out) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      rafId = 0;
      return;
    }
    rafId = window.requestAnimationFrame(loop);
  };

  const start = (time) => {
    lastTime = time;
    rafId = window.requestAnimationFrame(loop);
  };

  if (!mouse.out) {
    rafId = window.requestAnimationFrame(start);
  }
})();

(() => {
  const emailEl = document.querySelector('.copy-email');
  if (!emailEl) return;
  const email = (emailEl.getAttribute('data-email') || emailEl.textContent || '').trim();

  const tooltip = document.createElement('div');
  tooltip.className = 'copy-tooltip';
  tooltip.textContent = 'copied';
  document.body.appendChild(tooltip);

  let mouseX = 0;
  let mouseY = 0;
  let visible = false;
  let fadeTimer = 0;

  function positionTooltip() {
    if (!visible) return;
    tooltip.style.transform = `translate(${mouseX + 14}px, ${mouseY + 18}px)`;
  }

  window.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    positionTooltip();
  }, { passive: true });

  emailEl.addEventListener('click', async (e) => {
    e.preventDefault();
    try {
      await navigator.clipboard.writeText(email);
    } catch {
    }
    visible = true;
    positionTooltip();
    tooltip.style.opacity = '1';
    clearTimeout(fadeTimer);
    fadeTimer = setTimeout(() => {
      tooltip.style.opacity = '0';
      visible = false;
    }, 3000);
  });
})();

