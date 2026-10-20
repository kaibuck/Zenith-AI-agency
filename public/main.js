(() => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reduceMotion) document.documentElement.classList.add('js-anim');

  document.querySelectorAll('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });

  // Header border on scroll
  const header = document.querySelector('[data-header]');
  const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 8);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  // Mobile nav
  const toggle = document.querySelector('[data-nav-toggle]');
  const links = document.querySelector('[data-nav-links]');
  const setNav = (open) => {
    links.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    toggle.querySelector('use').setAttribute('href', open ? '#i-x' : '#i-menu');
  };
  toggle.addEventListener('click', () => setNav(!links.classList.contains('open')));
  links.addEventListener('click', (e) => { if (e.target.closest('a')) setNav(false); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && links.classList.contains('open')) { setNav(false); toggle.focus(); }
  });

  // Scroll reveal
  const reveals = document.querySelectorAll('.reveal');
  if (!reduceMotion && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const siblings = [...entry.target.parentElement.children];
        entry.target.style.transitionDelay = `${siblings.indexOf(entry.target) * 60}ms`;
        entry.target.classList.add('in');
        io.unobserve(entry.target);
      });
    }, { threshold: 0.15 });
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add('in'));
  }

  // Page scroll progress bar
  const bar = document.querySelector('[data-scroll-bar]');
  const updateBar = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    bar.style.transform = `scaleX(${max > 0 ? scrollY / max : 0})`;
  };

  // Scroll story: the phone call is scrubbed by scroll position through the pinned section
  const story = document.querySelector('[data-story]');
  const phone = story && story.querySelector('[data-phone]');
  let updateStory = () => {};
  if (phone && !reduceMotion) {
    document.documentElement.classList.add('js-story');
    const ANSWER_AT = 0.06, END_AT = 0.93, NOTIF_AT = 0.84, CALL_SECONDS = 102;
    const CAPTION_AT = [0, ANSWER_AT, 0.2, 0.46, 0.8];
    const caps = [...story.querySelectorAll('[data-cap]')];
    const items = [...story.querySelectorAll('.bubbles > [data-at]')];
    const typing = story.querySelector('[data-typing]');
    const status = story.querySelector('[data-call-status]');
    const notif = story.querySelector('[data-notif]');
    const progress = story.querySelector('[data-progress]');
    const fmt = (sec) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
    let lastActive = -1;
    const mobile = window.matchMedia('(max-width: 900px)');
    const mouse = { x: 0, y: 0 };
    // Keyframes of [rotateX, rotateY, rotateZ] in degrees against story progress
    const POSE = [[0, 14, -26, -3], [0.06, 8, -12, -1], [0.3, 3, -3, 0], [0.55, 4, 8, 1], [0.8, 2, -7, -1], [1, 6, 14, 2]];
    const ease = (t) => t * t * (3 - 2 * t);
    const poseAt = (p) => {
      let i = 0;
      while (i < POSE.length - 2 && p > POSE[i + 1][0]) i++;
      const [p0, ...a] = POSE[i];
      const [p1, ...b] = POSE[i + 1];
      const t = ease(Math.min(1, Math.max(0, (p - p0) / (p1 - p0))));
      return a.map((v, k) => v + (b[k] - v) * t);
    };
    if (window.matchMedia('(pointer: fine)').matches) {
      story.addEventListener('pointermove', (e) => {
        mouse.x = e.clientX / innerWidth - 0.5;
        mouse.y = e.clientY / innerHeight - 0.5;
        requestFrame();
      });
      story.addEventListener('pointerleave', () => { mouse.x = 0; mouse.y = 0; requestFrame(); });
    }
    // Pause the looping phone animations while the story is offscreen
    new IntersectionObserver(([entry]) => story.classList.toggle('paused', !entry.isIntersecting)).observe(story);

    updateStory = () => {
      const rect = story.getBoundingClientRect();
      const span = story.offsetHeight - innerHeight;
      const p = Math.min(1, Math.max(0, -rect.top / span));

      const live = p >= ANSWER_AT;
      const ended = p >= END_AT;
      phone.classList.toggle('ringing', !live);
      phone.classList.toggle('live', live);
      phone.classList.toggle('ended', ended);
      // 3D pose: starts angled, turns to face you while answering, then sways as the call goes on
      const [rx, ry, rz] = poseAt(p);
      const tilt = mobile.matches ? 0.6 : 1;
      phone.style.setProperty('--rx', `${((rx + mouse.y * -8) * tilt).toFixed(2)}deg`);
      phone.style.setProperty('--ry', `${((ry + mouse.x * 12) * tilt).toFixed(2)}deg`);
      phone.style.setProperty('--rz', `${(rz * tilt).toFixed(2)}deg`);
      phone.style.setProperty('--sc', (0.9 + Math.min(1, p / ANSWER_AT) * 0.1).toFixed(3));
      phone.style.setProperty('--glare', `${(-(ry + mouse.x * 12) * 1.6).toFixed(1)}%`);
      status.textContent = !live ? 'Incoming call…'
        : ended ? `Call ended · ${fmt(CALL_SECONDS)}`
        : fmt((p - ANSWER_AT) / (END_AT - ANSWER_AT) * CALL_SECONDS);

      // Bubbles appear in order; an agent reply shows "typing…" just before it lands
      let typingBefore = null;
      items.forEach((el) => {
        const at = parseFloat(el.dataset.at);
        el.classList.toggle('on', p >= at);
        if (!typingBefore && p < at && p >= at - 0.045 && el.classList.contains('agent')) typingBefore = el;
      });
      typing.classList.toggle('on', !!typingBefore);
      if (typingBefore) typingBefore.before(typing); else items[items.length - 1].after(typing);

      notif.classList.toggle('show', p >= NOTIF_AT);

      const active = CAPTION_AT.reduce((acc, at, i) => (p >= at ? i : acc), 0);
      if (active !== lastActive) {
        caps.forEach((c, i) => c.classList.toggle('active', i === active));
        lastActive = active;
      }
      progress.style.transform = `scaleX(${p})`;
    };
  }

  let ticking = false;
  const onFrame = () => { ticking = false; updateBar(); updateStory(); };
  const requestFrame = () => { if (!ticking) { ticking = true; requestAnimationFrame(onFrame); } };
  window.addEventListener('scroll', requestFrame, { passive: true });
  window.addEventListener('resize', requestFrame);
  onFrame();

  // Feature cards tilt toward the cursor in 3D
  if (!reduceMotion && window.matchMedia('(pointer: fine)').matches) {
    document.querySelectorAll('.card').forEach((card) => {
      card.addEventListener('pointermove', (e) => {
        const r = card.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        card.style.setProperty('--tilt-x', (-y).toFixed(3));
        card.style.setProperty('--tilt-y', x.toFixed(3));
        card.style.setProperty('--tilt', `${(Math.hypot(x, y) * 14).toFixed(2)}deg`);
        card.style.setProperty('--lift', '-4px');
      });
      card.addEventListener('pointerleave', () => {
        card.style.setProperty('--tilt', '0deg');
        card.style.setProperty('--lift', '0px');
      });
    });
  }

  // Demo request form
  const form = document.querySelector('[data-demo-form]');
  if (!form) return;
  const status = form.querySelector('.form-status');
  const submit = form.querySelector('button[type="submit"]');
  const rules = {
    name: (v) => (v.trim() ? '' : 'Please enter your name.'),
    company: (v) => (v.trim() ? '' : 'Please enter your business name.'),
    phone: (v) => (v.replace(/\D/g, '').length >= 10 ? '' : 'Please enter a valid phone number, including area code.'),
  };
  const validate = (input) => {
    const msg = rules[input.name] ? rules[input.name](input.value) : '';
    const err = form.querySelector(`#${input.id}-err`);
    if (err) err.textContent = msg;
    input.setAttribute('aria-invalid', msg ? 'true' : 'false');
    if (msg) input.setAttribute('aria-describedby', [input.id + '-err', input.id === 'f-phone' ? 'f-phone-help' : ''].join(' ').trim());
    return !msg;
  };
  Object.keys(rules).forEach((name) => {
    const input = form.elements[name];
    input.addEventListener('blur', () => { if (input.value) validate(input); });
    input.addEventListener('input', () => { if (input.getAttribute('aria-invalid') === 'true') validate(input); });
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const invalid = Object.keys(rules).map((n) => form.elements[n]).filter((input) => !validate(input));
    if (invalid.length) { invalid[0].focus(); return; }

    submit.disabled = true;
    status.className = 'form-status';
    status.textContent = 'Sending…';
    try {
      const res = await fetch(form.dataset.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(new FormData(form))),
      });
      if (!res.ok) throw new Error(String(res.status));
      form.reset();
      status.classList.add('ok');
      status.textContent = "Thanks! We'll text you shortly to set up your demo.";
    } catch {
      status.classList.add('err');
      status.textContent = 'Something went wrong. Please try again in a moment.';
    } finally {
      submit.disabled = false;
    }
  });
})();
