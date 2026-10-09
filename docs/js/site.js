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

// Home: the side panels (foundry to the left, About to the right), the Work link, the list that opens in place,
// and the project hover hook.
(function () {
  var stage = document.querySelector('[data-stage]');
  if (!stage) return;
  var root = document.documentElement;
  root.classList.add('js');
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };
  var home = $('[data-home]'), panels = { foundry: $('#foundry'), about: $('#about'), blog: $('#blog') };
  var url = function (hash) { return location.pathname + location.search + (hash || ''); };
  var current = '', pushed = false;  // pushed: this visit added the panel's entry, so closing can step back over it

  // A panel slides in from its side (transform only); its name goes in the address. Back, Esc and Studio slide home.
  function setPanel(name, animate) {
    var was = current;
    if (name === was && !root.classList.contains('at-' + name)) return;
    var instant = !animate || reduce;
    if (name === 'blog' && window.scrollY) window.scrollTo(0, 0);  // the blog sits above the top of the page
    root.classList.toggle('is-locked', name === 'blog');
    if (instant) stage.classList.add('no-anim');
    stage.classList.toggle('is-foundry', name === 'foundry');
    stage.classList.toggle('is-about', name === 'about');
    stage.classList.toggle('is-blog', name === 'blog');
    root.classList.remove('at-foundry', 'at-about', 'at-blog');
    current = name;
    Object.keys(panels).forEach(function (k) { panels[k].inert = k !== name; });
    home.inert = !!name;
    if (instant) { void stage.offsetWidth; stage.classList.remove('no-anim'); }
    if (name) { panels[name].scrollTop = 0; $('[data-studio]', panels[name]).focus({ preventScroll: true }); }
    else if (was && animate) { var l = $('[data-go="' + was + '"]'); if (l) l.focus({ preventScroll: true }); }
  }
  function closePanel() {
    if (pushed) history.back();  // popstate slides it home
    else { history.replaceState(null, '', url()); setPanel('', true); }
  }
  ['foundry', 'about', 'blog'].forEach(function (name) {
    $$('[data-go="' + name + '"]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        if (location.hash !== '#' + name) { history.pushState(null, '', url('#' + name)); pushed = true; }
        setPanel(name, true);
      });
    });
  });
  $$('[data-studio]').forEach(function (a) { a.addEventListener('click', function (e) { e.preventDefault(); closePanel(); }); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && current) closePanel(); });

  // Work: smooth scroll, #work in the address, focus on the list
  var work = $('#work');
  $$('[data-go="work"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      history.pushState(null, '', url('#work'));
      work.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
      work.focus({ preventScroll: true });
    });
  });

  // The list opens in place: the rows already showing glide apart to their new places while the rest fade in
  // between them. Closing fades the extras out, then the rest glide back together. Transform and opacity only.
  var list = $('#works'), toggle = $('.archive-toggle'), label = $('.work-label'), rows = $$('.work-row', list), extras = $$('.extra', list), timer = 0;
  var tops = function (els) { return els.map(function (r) { return r.getBoundingClientRect().top; }); };
  function glide(els, before) {
    var after = tops(els);
    els.forEach(function (r, n) { r.classList.remove('glide'); r.style.transform = 'translateY(' + (before[n] - after[n]) + 'px)'; });
    void list.offsetWidth;
    els.forEach(function (r) { r.classList.add('glide'); r.style.transform = ''; });
  }
  function clean() { rows.forEach(function (r) { r.classList.remove('glide', 'rise', 'go', 'fall'); r.style.transform = ''; }); }
  function setOpen(open, animate) {
    if (open === list.classList.contains('is-open')) return;
    clearTimeout(timer); clean();
    toggle.setAttribute('aria-expanded', open);
    toggle.textContent = toggle.getAttribute(open ? 'data-close-label' : 'data-open-label');
    label.textContent = label.getAttribute(open ? 'data-open' : 'data-closed');
    history.replaceState(history.state, '', url(open ? '#archive' : (location.hash === '#archive' ? '#work' : location.hash)));
    var kept = rows.filter(function (r) { return !r.classList.contains('extra'); });
    if (!animate || reduce) { list.classList.toggle('is-open', open); return; }
    if (open) {
      var before = tops(kept);
      extras.forEach(function (r) { r.classList.add('rise'); });
      list.classList.add('is-open');
      glide(kept, before);
      extras.forEach(function (r) { r.classList.add('go'); });
      timer = setTimeout(clean, 1400);
    } else {
      extras.forEach(function (r) { r.classList.add('fall'); });
      timer = setTimeout(function () {
        var before = tops(kept);
        list.classList.remove('is-open'); clean();
        glide(kept, before);
        timer = setTimeout(clean, 800);
      }, 250);
    }
  }
  toggle.addEventListener('click', function () { setOpen(!list.classList.contains('is-open'), true); });

  // Center the column on its content: as wide as the widest row of the full list, tags included
  function fit() {
    list.classList.add('measuring');
    var w = Math.ceil(list.getBoundingClientRect().width);
    list.classList.remove('measuring');
    work.style.setProperty('--work-w', w + 'px');
  }
  fit();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
  var rt; window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(fit, 150); });

  // Into a project and back. As the page swaps, the clicked title is named project-title; the project page's h1 has the
  // same name, so the browser glides one into the other while the pages crossfade. The list's state and the row's place
  // are kept for the return.
  var KEY = 'oo-return';
  var projectOf = function (u) { var m = u && new URL(u, location.href).pathname.match(/^\/projects\/([^\/]+)$/); return m && m[1]; };
  function untag() {
    $$('[data-vt]').forEach(function (el) { el.style.viewTransitionName = ''; el.removeAttribute('data-vt'); });
  }
  function tag(slug) {
    untag();
    var row = $('.work-row[data-project="' + slug + '"]', list);
    if (!row || !row.getClientRects().length) return false;
    var title = row.querySelector('a, .plain');
    title.style.viewTransitionName = 'project-title'; title.setAttribute('data-vt', '');
    return true;
  }
  list.addEventListener('click', function (e) {
    var a = e.target.closest('.work-row a'); if (!a) return;
    try { sessionStorage.setItem(KEY, JSON.stringify({ slug: a.closest('[data-project]').getAttribute('data-project'), top: a.getBoundingClientRect().top, open: list.classList.contains('is-open') })); } catch (err) {}
  });
  window.addEventListener('pageswap', function (e) {
    var to = e.activation && e.activation.entry && projectOf(e.activation.entry.url);
    if (e.viewTransition && to && !reduce) tag(to);
  });
  window.addEventListener('pagereveal', function (e) {
    untag();
    var from = window.navigation && navigation.activation && navigation.activation.from && projectOf(navigation.activation.from.url);
    var st = null; try { st = JSON.parse(sessionStorage.getItem(KEY)); } catch (err) {}
    if (!from || !st || st.slug !== from) return;
    if (st.open) setOpen(true, false);  // back onto the same list
    var row = $('.work-row[data-project="' + from + '"]', list);
    if (row) { var a = row.querySelector('a, .plain'); window.scrollTo(0, window.scrollY + a.getBoundingClientRect().top - st.top); }
    if (e.viewTransition && !reduce && tag(from)) e.viewTransition.finished.finally(untag);
  });

  // Hover hook for later: every project row says when the pointer or keyboard focus enters and leaves it
  rows.forEach(function (r) {
    var fire = function (name) { r.dispatchEvent(new CustomEvent(name, { bubbles: true, detail: { slug: r.getAttribute('data-project') } })); };
    r.addEventListener('pointerenter', function () { fire('project:enter'); });
    r.addEventListener('pointerleave', function () { fire('project:leave'); });
    r.addEventListener('focusin', function (e) { if (!r.contains(e.relatedTarget)) fire('project:enter'); });
    r.addEventListener('focusout', function (e) { if (!r.contains(e.relatedTarget)) fire('project:leave'); });
  });

  // Arriving at #foundry or #about opens that panel at once; #archive opens the list at once
  function sync(first) {
    var h = location.hash.slice(1);
    setPanel(panels[h] ? h : '', !first);
    if (h === 'archive') setOpen(true, false);
  }
  panels.foundry.inert = panels.about.inert = panels.blog.inert = true;
  sync(true);
  if (location.hash === '#archive') work.scrollIntoView();
  window.addEventListener('popstate', function () { pushed = false; sync(false); });
})();

// Project pages: Back returns to the list you came from (the way back zooms out onto it); straight in, it opens the work list.
(function () {
  var back = document.querySelector('[data-back]');
  if (!back) return;
  back.addEventListener('click', function (e) {
    var ref = null; try { ref = document.referrer && new URL(document.referrer); } catch (err) {}
    if (ref && ref.origin === location.origin && ref.pathname === '/' && history.length > 1) { e.preventDefault(); history.back(); }
  });
})();
