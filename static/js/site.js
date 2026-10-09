// Opmet Osserpse: clock, filters, hover previews, quiet video. No tracking, no cookies.
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Clock, in AP style: "Wednesday, Oct. 7, 9:41 a.m."
  var clock = document.querySelector('[data-clock]');
  if (clock) {
    var tz = clock.getAttribute('data-tz') || 'America/Los_Angeles';
    var place = clock.getAttribute('data-place') || '';
    var MON = ['Jan.', 'Feb.', 'March', 'April', 'May', 'June', 'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.'];
    var tick = function () {
      var parts = {};
      try {
        new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'long', month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })
          .formatToParts(new Date()).forEach(function (p) { parts[p.type] = p.value; });
      } catch (e) { return; }
      var ap = (parts.dayPeriod || '').toLowerCase() === 'am' ? 'a.m.' : 'p.m.';
      var time = parts.minute === '00' ? parts.hour + ' ' + ap : parts.hour + ':' + parts.minute + ' ' + ap;
      if (parts.hour === '12' && parts.minute === '00') time = ap === 'p.m.' ? 'noon' : 'midnight';
      clock.textContent = (place ? place + ', ' : '') + parts.weekday + ', ' + MON[+parts.month - 1] + ' ' + parts.day + ', ' + time;
    };
    tick(); setInterval(tick, 15000);
  }

  // Sector filters on the projects list
  var filters = document.querySelector('[data-filters]');
  if (filters) {
    var rows = Array.prototype.slice.call(document.querySelectorAll('[data-sector]'));
    filters.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      var s = b.getAttribute('data-filter');
      Array.prototype.forEach.call(filters.querySelectorAll('button'), function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      rows.forEach(function (r) { r.hidden = !(s === 'All' || r.getAttribute('data-sector') === s); });
      try { history.replaceState(null, '', s === 'All' ? location.pathname : location.pathname + '?sector=' + encodeURIComponent(s)); } catch (err) {}
    });
    var q = new URLSearchParams(location.search).get('sector');
    if (q) { var btn = filters.querySelector('[data-filter="' + q.replace(/"/g, '') + '"]'); if (btn) btn.click(); }
  }

  // Hover preview: one fixed place to the right of the list, crossfading between projects
  var preview = document.querySelector('.preview');
  if (preview && window.matchMedia('(hover: hover)').matches) {
    var imgs = [preview.querySelector('img'), preview.appendChild(document.createElement('img'))], cur = 0, want = '';
    imgs[1].alt = '';
    var timer = 0;
    var hide = function () { want = ''; imgs.forEach(function (i) { i.classList.remove('on'); }); };
    var show = function (src) {
      clearTimeout(timer);
      if (src === want) return;
      want = src;
      var next = imgs[1 - cur];
      next.onload = function () { if (want !== src) return; next.classList.add('on'); imgs[cur].classList.remove('on'); cur = 1 - cur; };
      next.src = src;
      if (next.complete && next.naturalWidth) next.onload();
    };
    Array.prototype.forEach.call(document.querySelectorAll('a[data-preview]'), function (a) {
      a.addEventListener('mouseenter', function () { show(a.getAttribute('data-preview')); });
      a.addEventListener('mouseleave', function () { clearTimeout(timer); timer = setTimeout(hide, 150); });  // brief grace, so moving between names crossfades
    });
  }

  // Videos: play only when on screen; never with reduced motion
  var vids = document.querySelectorAll('video[data-loop]');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (en) {
        var v = en.target;
        if (en.isIntersecting && !reduce) { if (v.preload === 'none') v.preload = 'auto'; var p = v.play(); if (p && p.catch) p.catch(function () {}); }
        else v.pause();
      });
    }, { rootMargin: '200px 0px' });
    Array.prototype.forEach.call(vids, function (v) { io.observe(v); });

    // Quiet fade-in for images and video
    var fio = new IntersectionObserver(function (es) {
      es.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in'); fio.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -5% 0px' });
    Array.prototype.forEach.call(document.querySelectorAll('.fade'), function (el) { fio.observe(el); });
  } else {
    Array.prototype.forEach.call(document.querySelectorAll('.fade'), function (el) { el.classList.add('in'); });
  }
})();

// The hand on the cover. The moves, their lengths and the timing come from data-* attributes that
// build.py writes from moves/ (see moves.py). First move after a delay, then a random move every
// interval, never the same twice in a row, only while the cover is on screen and the tab is open.
(function () {
  var mark = document.querySelector('.cover .mark');
  if (!mark || !window.matchMedia || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var dur = {}, moves = (mark.getAttribute('data-moves') || '').split(' ').filter(Boolean).map(function (x) {
    var p = x.split(':'); dur[p[0]] = +p[1] || 3000; return p[0];
  });
  if (!moves.length) return;
  var first = mark.getAttribute('data-first'), delay = +mark.getAttribute('data-delay') || 3200,
      every = +mark.getAttribute('data-interval') || 10000, last = '', seen = true, busy = false, timer;
  if ('IntersectionObserver' in window) new IntersectionObserver(function (e) { seen = e[0].isIntersecting; }).observe(mark);
  function done() {
    clearTimeout(timer);
    moves.forEach(function (m) { mark.classList.remove('m-' + m); });
    busy = false;
  }
  function play(m) {
    if (!seen || document.hidden || busy) return;
    if (!m || dur[m] === undefined) { do { m = moves[Math.floor(Math.random() * moves.length)]; } while (m === last && moves.length > 1); }
    last = m; busy = true;
    mark.classList.add('m-' + m);
    timer = setTimeout(done, dur[m] + 400); // in case animationend never fires
  }
  mark.addEventListener('animationend', function (e) { if (e.target === mark) done(); });
  setTimeout(function () { play(first); setInterval(function () { play(); }, every); }, delay);
})();

// Home: the foundry stage, the Work and About links, the Archive with its tag filter, and the project hover hook.
(function () {
  var stage = document.querySelector('[data-stage]');
  if (!stage) return;
  var root = document.documentElement;
  root.classList.add('js');
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };
  var foundry = $('#foundry'), home = $('[data-home]'), foundryLink = $('[data-go="foundry"]');
  var url = function (hash) { return location.pathname + location.search + (hash || ''); };
  var pushed = false;  // whether this visit added the #foundry entry, so closing can step back over it

  // Foundry: the stage slides one screen right to reveal it. #foundry in the address; back, Esc and Studio slide home.
  function setFoundry(open, animate) {
    if (open === stage.classList.contains('is-foundry') && !root.classList.contains('at-foundry')) return;
    if (!animate || reduce) { stage.classList.add('no-anim'); }
    stage.classList.toggle('is-foundry', open);
    root.classList.remove('at-foundry');
    foundry.inert = !open; home.inert = open;
    if (!animate || reduce) { void stage.offsetWidth; stage.classList.remove('no-anim'); }
    if (open) $('#foundry-title').focus({ preventScroll: true });
    else if (animate && foundryLink) foundryLink.focus({ preventScroll: true });
  }
  function closeFoundry() {
    if (pushed) history.back();  // popstate slides it home
    else { history.replaceState(null, '', url()); setFoundry(false, true); }
  }
  foundryLink && foundryLink.addEventListener('click', function (e) {
    e.preventDefault();
    if (location.hash !== '#foundry') { history.pushState(null, '', url('#foundry')); pushed = true; }
    setFoundry(true, true);
  });
  $('[data-studio]').addEventListener('click', function (e) { e.preventDefault(); closeFoundry(); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && stage.classList.contains('is-foundry')) closeFoundry();
  });

  // Work and About: smooth scroll, the hash in the address, focus where the reader lands
  function go(id, focusEl) {
    var el = document.getElementById(id);
    history.pushState(null, '', url('#' + id));
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    focusEl.focus({ preventScroll: true });
  }
  $$('[data-go="work"]').forEach(function (a) { a.addEventListener('click', function (e) { e.preventDefault(); go('work', $('#work-title')); }); });
  $$('[data-go="about"]').forEach(function (a) { a.addEventListener('click', function (e) { e.preventDefault(); go('about', $('#about')); }); });

  // The Archive: opens in place. What follows it slides down (transform only) while its rows rise and fade in.
  var archive = $('#archive'), toggle = $('.archive-toggle'), after = $('#about'), busy = 0;
  var input = $('#tag-search'), active = $('[data-active]'), clearBtn = $('[data-clear]'), empty = $('[data-empty]'), count = $('[data-count]');
  var rows = $$('.work-row', archive), years = $$('.year', archive), picked = [];
  function slide(el, from, cover) {
    el.classList.remove('is-sliding'); el.style.transform = 'translateY(' + from + 'px)';
    el.style.setProperty('--cover', (cover || 0) + 'px');
    void el.offsetWidth;
    el.classList.add('is-sliding'); el.style.transform = '';
  }
  function setArchive(open, animate) {
    if (open === !archive.hidden) return;
    clearTimeout(busy);
    archive.classList.remove('is-opening', 'go', 'is-closing'); after.classList.remove('is-sliding'); after.style.transform = '';
    toggle.setAttribute('aria-expanded', open);
    toggle.textContent = toggle.getAttribute(open ? 'data-close-label' : 'data-open-label');
    history.replaceState(history.state, '', location.pathname + query() + (open ? '#archive' : (location.hash === '#archive' ? '#work' : location.hash)));
    animate = animate && !reduce;
    if (open) {
      archive.hidden = false; filter();
      if (!animate) return;
      var h = archive.offsetHeight + parseFloat(getComputedStyle(archive).marginTop);
      archive.classList.add('is-opening'); slide(after, -h, h);
      void archive.offsetWidth; archive.classList.add('go');
      busy = setTimeout(function () { archive.classList.remove('is-opening', 'go'); after.classList.remove('is-sliding'); }, 1200);
    } else {
      if (!animate) { archive.hidden = true; return; }
      var h2 = archive.offsetHeight + parseFloat(getComputedStyle(archive).marginTop);
      archive.classList.add('is-closing'); slide(after, h2, 0);
      busy = setTimeout(function () { archive.hidden = true; archive.classList.remove('is-closing'); after.classList.remove('is-sliding'); }, 720);
    }
  }
  toggle.addEventListener('click', function () { setArchive(archive.hidden, true); });

  // Tag search, inside the Archive only. Clicked tags and the typed text combine with AND. State lives in ?tag= (and ?q=).
  var norm = function (s) { return (s || '').trim().toLowerCase(); };
  function query() {
    var p = new URLSearchParams();
    picked.forEach(function (t) { p.append('tag', t); });
    if (norm(input.value)) p.set('q', input.value.trim());
    var s = p.toString().replace(/\+/g, '%20');
    return s ? '?' + s : '';
  }
  function filter() {
    var q = norm(input.value), want = picked.map(norm), shown = 0;
    archive.style.minHeight = '';
    rows.forEach(function (r) { r.hidden = false; });
    years.forEach(function (y) { y.hidden = false; });
    var full = archive.hidden ? 0 : archive.offsetHeight;  // hold this height while filtering, so the page doesn't move
    rows.forEach(function (r) {
      var tags = r.getAttribute('data-tags').split('|');
      var ok = want.every(function (t) { return tags.indexOf(t) > -1; }) && (!q || tags.some(function (t) { return t.indexOf(q) > -1; }));
      r.hidden = !ok; if (ok) shown++;
    });
    years.forEach(function (y) { y.hidden = !$$('.work-row', y).some(function (r) { return !r.hidden; }); });
    var on = !!(want.length || q);
    if (on && full) archive.style.minHeight = full + 'px';
    empty.hidden = shown > 0;
    clearBtn.hidden = !on;
    count.textContent = on ? (shown ? shown + (shown === 1 ? ' project' : ' projects') : empty.textContent) : '';
    $$('.tag', archive).forEach(function (b) { b.setAttribute('aria-pressed', want.indexOf(norm(b.getAttribute('data-tag'))) > -1); });
    active.innerHTML = '';
    picked.forEach(function (t) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'chip'; b.setAttribute('data-tag', t);
      b.innerHTML = '<span class="vh">Remove </span>'; b.appendChild(document.createTextNode(t));
      active.appendChild(b);
    });
  }
  function update() { filter(); history.replaceState(history.state, '', location.pathname + query() + location.hash); }
  function toggleTag(t) {
    var i = picked.map(norm).indexOf(norm(t));
    if (i > -1) picked.splice(i, 1); else picked.push(t);
    update();
  }
  archive.addEventListener('click', function (e) {
    var b = e.target.closest('.tag, .chip'); if (!b) return;
    var t = b.getAttribute('data-tag'), wasChip = b.classList.contains('chip');
    toggleTag(t);
    if (wasChip) (active.querySelector('.chip') || input).focus();
  });
  input.addEventListener('input', update);
  input.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    var hit = $$('#tag-vocab option').map(function (o) { return o.value; }).filter(function (t) { return norm(t) === norm(input.value); })[0];
    if (hit) { input.value = ''; if (picked.map(norm).indexOf(norm(hit)) < 0) picked.push(hit); update(); }
  });
  clearBtn.addEventListener('click', function () { picked = []; input.value = ''; update(); input.focus(); });

  // Hover hook for later: every project row says when the pointer or keyboard focus enters and leaves it
  $$('[data-project]').forEach(function (r) {
    var fire = function (name) { r.dispatchEvent(new CustomEvent(name, { bubbles: true, detail: { slug: r.getAttribute('data-project') } })); };
    r.addEventListener('pointerenter', function () { fire('project:enter'); });
    r.addEventListener('pointerleave', function () { fire('project:leave'); });
    r.addEventListener('focusin', function (e) { if (!r.contains(e.relatedTarget)) fire('project:enter'); });
    r.addEventListener('focusout', function (e) { if (!r.contains(e.relatedTarget)) fire('project:leave'); });
  });

  // Arriving: #foundry opens the foundry at once; #archive or ?tag= opens the Archive at once
  var params = new URLSearchParams(location.search);
  picked = params.getAll('tag').filter(Boolean);
  input.value = params.get('q') || '';
  function sync(first) {
    setFoundry(location.hash === '#foundry', !first);
    if (location.hash === '#archive' || (first && (picked.length || input.value))) setArchive(true, false);
  }
  foundry.inert = true;
  sync(true);
  if (!archive.hidden && location.hash !== '#foundry') $('#work').scrollIntoView();
  window.addEventListener('popstate', function () { pushed = false; sync(false); });
})();
