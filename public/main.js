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

  // Hero call demo: plays the transcript line by line, then shows the booking result
  const demo = document.querySelector('[data-call-demo]');
  if (demo && !reduceMotion) {
    const items = [...demo.querySelectorAll('.msg, .result-chip')];
    const replay = demo.querySelector('[data-replay]');
    let timers = [];
    const play = () => {
      timers.forEach(clearTimeout);
      timers = [];
      demo.classList.remove('done');
      replay.hidden = true;
      items.forEach((el) => el.classList.remove('shown'));
      let t = 500;
      items.forEach((el, i) => {
        const isChip = el.classList.contains('result-chip');
        timers.push(setTimeout(() => el.classList.add('shown'), t));
        t += isChip ? 250 : 900 + el.textContent.length * 12;
        if (i === items.length - 1) {
          timers.push(setTimeout(() => { demo.classList.add('done'); replay.hidden = false; }, t));
        }
      });
    };
    replay.addEventListener('click', play);
    // Start when visible so the animation isn't missed
    const startIo = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { play(); startIo.disconnect(); }
    }, { threshold: 0.3 });
    startIo.observe(demo);
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
      const res = await fetch('/api/demo-request', {
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
