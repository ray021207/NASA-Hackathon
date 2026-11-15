/* Groundwater-inspired contour motion.
   Decorative only: it does not animate or alter scientific map measurements. */
(() => {
  'use strict';
  const visual = document.querySelector('.overview-visual');
  const canvas = visual?.querySelector('.overview-fluid');
  if (!visual || !canvas || !canvas.getContext) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const coarse = window.matchMedia('(pointer: coarse)');
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return;

  const TWO_PI = Math.PI * 2;
  const pointer = { x: 0, y: 0, targetX: 0, targetY: 0, strength: 0, targetStrength: 0 };
  let width = 1, height = 1, scale = 1, frameId = 0, lastDraw = 0;
  let inView = false;
  let phase = 0;

  const hero = visual.closest('.overview-hero');
  const logo = visual.querySelector('.overview-rings img');
  let dissolve = 0;
  let logoParticles = [];
  let logoBox = { x: 0, y: 0, w: 1, h: 1 };
  let scrollFrame = 0;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  // Sample the team's existing Arizona logo, rather than inventing another mark.
  // Sampled pixels break into a fine point mesh as the real image fades on scroll.
  function sampleLogo() {
    if (!logo?.naturalWidth) return;
    try {
      const scan = document.createElement('canvas');
      scan.width = 108; scan.height = 108;
      const scanCtx = scan.getContext('2d', { willReadFrequently: true });
      if (!scanCtx) return;
      scanCtx.drawImage(logo, 0, 0, 108, 108);
      const data = scanCtx.getImageData(0, 0, 108, 108).data;
      const bg = [data[0], data[1], data[2], data[3]];
      const bgIsTransparent = bg[3] < 80;
      const points = [];
      for (let y = 3; y < 108; y += 5) {
        for (let x = 3; x < 108; x += 5) {
          const i = (y * 108 + x) * 4;
          const alpha = data[i + 3];
          const delta = Math.abs(data[i] - bg[0]) +
            Math.abs(data[i + 1] - bg[1]) + Math.abs(data[i + 2] - bg[2]);
          if (alpha < 90 || (!bgIsTransparent && delta < 88)) continue;
          points.push({
            u: x / 108, v: y / 108,
            tint: (data[i] * 2 + data[i + 1] + data[i + 2]) / 4,
            seed: Math.sin(x * 83.29 + y * 17.41),
          });
        }
      }
      logoParticles = points;
      updateLogoBox();
    } catch {
      // Non-critical artwork: if pixels cannot be read, the CSS fade still works.
      logoParticles = [];
    }
  }

  function updateLogoBox() {
    if (!logo) return;
    const art = logo.getBoundingClientRect();
    const box = visual.getBoundingClientRect();
    logoBox = { x: art.left - box.left, y: art.top - box.top, w: art.width, h: art.height };
  }

  function syncScroll() {
    scrollFrame = 0;
    if (!hero || reduced.matches) {
      dissolve = 0;
    } else {
      const rect = hero.getBoundingClientRect();
      dissolve = clamp((-rect.top - 14) / Math.max(220, rect.height * 0.62), 0, 1);
    }
    const logoFade = clamp(1 - Math.max(0, dissolve - 0.06) / 0.64, 0, 1);
    visual.style.setProperty('--logo-opacity', logoFade.toFixed(3));
    visual.style.setProperty('--logo-blur', (7 * dissolve).toFixed(2) + 'px');
    visual.style.setProperty('--logo-scale', (1 + dissolve * 0.07).toFixed(3));
    visual.style.setProperty('--rings-opacity', (1 - dissolve * 0.42).toFixed(3));
    visual.style.setProperty('--label-opacity', clamp(1 - dissolve * 1.5, 0, 1).toFixed(3));
    updateLogoBox();
  }

  function scheduleScroll() {
    if (!scrollFrame) scrollFrame = requestAnimationFrame(syncScroll);
  }

  function drawLogoMesh() {
    if (dissolve <= 0.08 || dissolve >= 0.99 || !logoParticles.length) return;
    const emergence = clamp((dissolve - 0.08) * 4, 0, 1);
    const disappearance = clamp((0.99 - dissolve) * 3.4, 0, 1);
    const strength = emergence * disappearance;
    const cx = logoBox.x + logoBox.w / 2;
    const cy = logoBox.y + logoBox.h / 2;
    const drift = dissolve * 0.15 * Math.min(width, height);
    ctx.save();
    ctx.lineWidth = 0.7;
    for (const p of logoParticles) {
      const baseX = logoBox.x + p.u * logoBox.w;
      const baseY = logoBox.y + p.v * logoBox.h;
      const dx = (baseX - cx) / Math.max(1, logoBox.w / 2);
      const dy = (baseY - cy) / Math.max(1, logoBox.h / 2);
      const flow = Math.sin(phase * 0.9 + p.u * 9 + p.v * 7);
      const x = baseX + (dx * 0.8 + flow * 0.35) * drift;
      const y = baseY + (dy * 0.7 - flow * 0.55) * drift;
      ctx.fillStyle = p.tint < 125
        ? 'rgba(82,102,75,' + (strength * 0.7).toFixed(3) + ')'
        : 'rgba(166,75,42,' + (strength * 0.58).toFixed(3) + ')';
      ctx.fillRect(x, y, 1.2, 1.2);
      if (dissolve > 0.28 && p.seed > 0.72) {
        ctx.strokeStyle = 'rgba(82,102,75,' + (strength * 0.23).toFixed(3) + ')';
        ctx.beginPath(); ctx.moveTo(x, y);
        ctx.lineTo(x + 6 + flow * 4, y + 7 - flow * 4); ctx.stroke();
      }
    }
    ctx.restore();
  }

  function resize() {
    const bounds = visual.getBoundingClientRect();
    width = Math.max(1, bounds.width);
    height = Math.max(1, bounds.height);
    scale = Math.min(window.devicePixelRatio || 1, 1.75);
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    pointer.x = pointer.targetX = width / 2;
    pointer.y = pointer.targetY = height / 2;
    updateLogoBox();
  }

  function draw(time) {
    ctx.clearRect(0, 0, width, height);
    const span = Math.min(width, height);
    const cx = width * 0.5;
    const cy = height * 0.49;
    const radiusMax = span * 0.45;
    phase += (time - lastDraw || 24) * 0.00027;
    const movement = pointer.strength;
    const mouseRadius = Math.max(60, span * 0.24);
    const mouseAngle = Math.atan2(pointer.y - cy, pointer.x - cx);

    // Closely spaced, gently distorted contours evoke subsurface deformation.
    for (let ring = 0; ring < 11; ring++) {
      const radius = span * (0.16 + ring * 0.027);
      const outerness = ring / 10;
      ctx.beginPath();
      for (let point = 0; point <= 144; point++) {
        const angle = point / 144 * TWO_PI;
        const ux = Math.cos(angle);
        const uy = Math.sin(angle);
        const slowWave = Math.sin(angle * 3 + phase * 1.1 + ring * 0.34) * (2.2 + outerness * 3.4);
        const foldedWave = Math.cos(angle * 5 - phase * 0.8 + ring * 0.23) * (1.8 + outerness * 2.4);
        const r = radius + slowWave + foldedWave;
        let x = cx + ux * r;
        let y = cy + uy * r;
        const dist = Math.hypot(x - pointer.x, y - pointer.y);
        const proximity = Math.exp(-(dist * dist) / (2 * mouseRadius * mouseRadius));
        const shear = movement * proximity * (11 + outerness * 22);
        // The displacement leads the pointer and eases back with spring-like inertia.
        x += shear * Math.cos(mouseAngle + Math.PI / 2) + ux * shear * 0.32;
        y += shear * Math.sin(mouseAngle + Math.PI / 2) + uy * shear * 0.32;
        if (point === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
      const warm = ring % 4 === 1;
      const opacity = ring < 3 ? 0.12 : (0.2 - outerness * 0.06);
      ctx.strokeStyle = warm
        ? 'rgba(166,75,42,' + opacity.toFixed(3) + ')'
        : 'rgba(82,102,75,' + opacity.toFixed(3) + ')';
      ctx.lineWidth = ring % 3 === 0 ? 1.2 : 0.85;
      ctx.stroke();
    }

    // A quiet pulse is visible only when somebody interacts with the illustration.
    if (movement > 0.03) {
      const r = Math.max(15, radiusMax * (0.18 + 0.16 * Math.sin(phase * 2)));
      const halo = ctx.createRadialGradient(pointer.x, pointer.y, 0, pointer.x, pointer.y, r);
      halo.addColorStop(0, 'rgba(166,75,42,' + (0.045 * movement).toFixed(3) + ')');
      halo.addColorStop(1, 'rgba(166,75,42,0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(pointer.x, pointer.y, r, 0, TWO_PI);
      ctx.fill();
    }
    drawLogoMesh();
  }

  function stop() {
    if (frameId) cancelAnimationFrame(frameId);
    frameId = 0;
    visual.style.removeProperty('--fluid-shift-x');
    visual.style.removeProperty('--fluid-shift-y');
  }

  function frame(time) {
    frameId = 0;
    if (reduced.matches || !inView || document.hidden) return;
    // Cap the decorative effect to approximately 40 fps; use 30 fps on touch devices.
    const minInterval = coarse.matches ? 33 : 25;
    if (time - lastDraw >= minInterval) {
      pointer.x += (pointer.targetX - pointer.x) * 0.09;
      pointer.y += (pointer.targetY - pointer.y) * 0.09;
      pointer.strength += (pointer.targetStrength - pointer.strength) * 0.075;
      const shiftX = (pointer.x / width - 0.5) * pointer.strength * 14;
      const shiftY = (pointer.y / height - 0.5) * pointer.strength * 14;
      visual.style.setProperty('--fluid-shift-x', shiftX.toFixed(2) + 'px');
      visual.style.setProperty('--fluid-shift-y', shiftY.toFixed(2) + 'px');
      draw(time);
      lastDraw = time;
    }
    frameId = requestAnimationFrame(frame);
  }

  function start() {
    if (!frameId && inView && !document.hidden && !reduced.matches) {
      lastDraw = 0;
      frameId = requestAnimationFrame(frame);
    }
  }

  visual.addEventListener('pointermove', event => {
    if (coarse.matches || reduced.matches) return;
    const bounds = visual.getBoundingClientRect();
    pointer.targetX = event.clientX - bounds.left;
    pointer.targetY = event.clientY - bounds.top;
    pointer.targetStrength = 1;
  }, { passive: true });
  visual.addEventListener('pointerleave', () => { pointer.targetStrength = 0; }, { passive: true });

  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(visual);
  else window.addEventListener('resize', resize, { passive: true });
  resize();
  if (logo?.complete && logo.naturalWidth) sampleLogo();
  else logo?.addEventListener('load', sampleLogo, { once: true });
  window.addEventListener('scroll', scheduleScroll, { passive: true });
  window.addEventListener('resize', scheduleScroll, { passive: true });
  syncScroll();

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => {
      inView = entries.some(entry => entry.isIntersecting);
      if (inView) start(); else stop();
    }, { rootMargin: '100px 0px' }).observe(visual);
  } else {
    inView = true;
    start();
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop(); else start();
  });
  if (reduced.addEventListener) reduced.addEventListener('change', () => {
    if (reduced.matches) { stop(); ctx.clearRect(0, 0, width, height); }
    else start();
    syncScroll();
  });

  // The same restrained pace carries into the editorial sections on scroll.
  const reveals = document.querySelectorAll(
    '.overview-narrative-head, .overview-narrative-grid article, ' +
    '.overview-purpose-header, .overview-audiences article, ' +
    '.overview-proof-heading, .overview-proof-card, ' +
    '.overview-evidence-copy, .overview-steps > div'
  );
  if (!reduced.matches && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('motion-visible');
        observer.unobserve(entry.target);
      }
    }, { threshold: 0.08, rootMargin: '0px 0px -30px 0px' });
    document.documentElement.classList.add('motion-active');
    reveals.forEach((element, index) => {
      element.classList.add('motion-reveal');
      // Keep grouped panels flowing together instead of a theatrical cascade.
      if (element.matches('.overview-narrative-grid article, .overview-proof-card, .overview-audiences article')) {
        element.style.setProperty('--reveal-delay', (index % 3) * 65 + 'ms');
      }
      observer.observe(element);
    });
  }
})();

/* Scroll motion: word-by-word text reveal, rising cards and charts, figure unmask, soft hero parallax, progress line.
   Decorative only; it never touches measurements. Skipped for reduced motion. The page-wide class (scroll-fx) is added LAST, so a failure leaves normal, fully readable text. */
(() => {
  'use strict';
  try {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!reduced || reduced.matches) return;
    const root = document.documentElement;
    const visible = el => !!(el.offsetParent || el.getClientRects().length);
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

    // progress line
    const bar = document.createElement('div');
    bar.className = 'scroll-progress';
    bar.setAttribute('aria-hidden', 'true');
    document.body.append(bar);

    // word-by-word reveal (text is kept as is; each word is wrapped in a span)
    const items = [];
    const skip = 'button, a, script, style, [data-nisar], [data-pump]';
    const split = el => {
      const words = [];
      const walk = node => {
        [...node.childNodes].forEach(child => {
          if (child.nodeType === 3) {
            const frag = document.createDocumentFragment();
            child.textContent.split(/(\s+)/).forEach(part => {
              if (!part) return;
              if (/^\s+$/.test(part)) { frag.append(part); return; }
              const s = document.createElement('span');
              s.className = 'w';
              s.textContent = part;
              frag.append(s);
              words.push(s);
            });
            child.replaceWith(frag);
          } else if (child.nodeType === 1 && !child.matches(skip)) walk(child);
        });
      };
      walk(el);
      return words;
    };
    document.querySelectorAll('.overview-lede, .overview-subcopy, .evidence-head p, .overview-narrative-head > p, .overview-purpose-header > p, .overview-proof-heading > p, .nisar-surface-lede, .overview-lede-note')
      .forEach(el => { const words = split(el); if (words.length > 3) items.push({ el, words, shown: -1 }); });

    // rise-in cards and charts, figure unmask
    const rises = [...document.querySelectorAll('.quick-answers li, .viz, .nisar-figure figcaption')];
    // Images are never hidden by this script (an earlier clip-path "unmask" could leave figures blank if the browser never reported them visible).
    rises.forEach(el => el.classList.add('fx-reveal'));
    rises.forEach((el, i) => el.style.setProperty('--d', (i % 3) * 80 + 'ms'));
    const reveal = el => el.classList.add('fx-in');
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(entries => entries.forEach(e => { if (e.isIntersecting) { reveal(e.target); io.unobserve(e.target); } }), { threshold: 0.05 });
      rises.forEach(el => io.observe(el));
    } else rises.forEach(reveal);
    // Safety net: anything on screen that is still hidden gets revealed, whether or not the observer fired.
    const sweep = () => {
      const vh = window.innerHeight || 800;
      document.querySelectorAll('.fx-reveal:not(.fx-in)').forEach(el => {
        if (!visible(el)) return;
        const r = el.getBoundingClientRect();
        if (r.top < vh && r.bottom > 0) reveal(el);
      });
    };
    setTimeout(sweep, 1200);
    window.addEventListener('hashchange', () => setTimeout(sweep, 900));
    document.addEventListener('click', () => setTimeout(sweep, 900));
    window.addEventListener('scroll', () => { clearTimeout(sweep.t); sweep.t = setTimeout(sweep, 250); }, { passive: true });

    // hero parallax and scroll-linked bits
    const heroVisual = document.querySelector('.overview-visual');
    let queued = false;
    function update() {
      queued = false;
      const vh = window.innerHeight || 800;
      const max = Math.max(1, root.scrollHeight - vh);
      bar.style.transform = 'scaleX(' + clamp(window.scrollY / max, 0, 1).toFixed(4) + ')';
      if (heroVisual && window.innerWidth > 800 && visible(heroVisual)) heroVisual.style.translate = '0 ' + clamp(window.scrollY * 0.12, 0, 70).toFixed(1) + 'px';
      items.forEach(it => {
        if (!visible(it.el)) return;
        const r = it.el.getBoundingClientRect();
        const p = clamp((0.92 * vh - r.top) / (0.5 * vh), 0, 1);
        const n = Math.round(p * it.words.length);
        if (n === it.shown) return;
        it.words.forEach((w, i) => w.classList.toggle('on', i < n));
        it.shown = n;
      });
    }
    const queue = () => { if (!queued) { queued = true; requestAnimationFrame(update); } };
    window.addEventListener('scroll', queue, { passive: true });
    window.addEventListener('resize', queue);
    window.addEventListener('hashchange', () => { queue(); setTimeout(queue, 200); setTimeout(queue, 700); });
    document.addEventListener('click', () => { setTimeout(queue, 60); setTimeout(queue, 400); });
    reduced.addEventListener?.('change', () => { if (reduced.matches) root.classList.remove('scroll-fx'); });
    update();
    root.classList.add('scroll-fx');           // last: until here everything is plain, readable text
  } catch (error) {
    document.documentElement.classList.remove('scroll-fx');
  }
})();
