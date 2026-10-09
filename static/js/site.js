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

    // Quiet fade-in for images and video further down; what's on screen when the page opens is simply there
    var opened = performance.now();
    var fio = new IntersectionObserver(function (es) {
      var now = performance.now() - opened < 400;
      es.forEach(function (en) {
        if (!en.isIntersecting) return;
        if (now) { en.target.style.transition = 'none'; en.target.classList.add('in'); void en.target.offsetWidth; en.target.style.transition = ''; }
        else en.target.classList.add('in');
        fio.unobserve(en.target);
      });
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

// Home: the side panels (foundry to the left, About to the right, the blog above), the Work link, the two lists that
// open in place (work and blog), projects and articles, and the project hover hook.
(function () {
  var stage = document.querySelector('[data-stage]');
  var root = document.documentElement;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };

  // One list, two uses: the work list below home and the blog list above it. Collapsed, only the Selected rows show; See
  // more opens the rest in place, and on the blog it also reveals topics that filter the rows. Every change runs in three
  // steps, transform and opacity only: rows that leave fade out, rows that stay glide to their new places (measured first
  // and last), and rows that arrive fade in one after another between them.
  //   o.address(state): keeps the address in step (the work list's #archive)
  //   o.wait: ignore clicks while a change is running (the blog)
  //   o.glideHead: the head glides too (the blog's list is anchored to the bottom of its screen, so its head moves)
  function List(section, o) {
    var L = { section: section, list: $('.works', section), toggle: $('.archive-toggle', section), label: $('.work-label', section),
              head: $('.work-head', section), topics: $('.blog-topics', section), live: $('[data-count]', section),
              timer: 0, busy: false, state: { open: false, topic: 'All' }, years: {} };
    L.rows = $$('.work-row', L.list);
    $$('.yr', L.list).forEach(function (y) { L.years[y.textContent] = y; });
    var tops = function (els) { return els.map(function (r) { return r.getBoundingClientRect().top; }); };
    var moving = function (els) { return o.glideHead ? els.concat([L.head]) : els; };
    L.shows = function (r, st) {
      if (!st.open) return !r.classList.contains('extra');
      return st.topic === 'All' || (r.getAttribute('data-tags') || '').split('|').indexOf(st.topic) >= 0;
    };
    function glide(els, before) {
      var after = tops(els);
      els.forEach(function (r, n) { r.classList.remove('glide'); r.style.transform = 'translateY(' + (before[n] - after[n]) + 'px)'; });
      void L.list.offsetWidth;
      els.forEach(function (r) { r.classList.add('glide'); r.style.transform = ''; });
    }
    L.clean = function () {
      L.rows.concat(o.glideHead ? [L.head] : [], L.topics ? [L.topics] : []).forEach(function (r) { r.classList.remove('glide', 'rise', 'go', 'fall'); r.style.transform = ''; });
    };
    // The year in the margin sits on the first showing row of its year
    function years(animate) {
      var first = {};
      L.rows.forEach(function (r) { var y = r.getAttribute('data-year'); if (y && !first[y] && L.shows(r, L.state)) first[y] = r; });
      Object.keys(L.years).forEach(function (y) {
        var span = L.years[y], r = first[y];
        if (!r || span.parentNode === r) return;
        r.insertBefore(span, r.firstChild);
        if (animate) { span.classList.add('moved'); void span.offsetWidth; span.classList.remove('moved'); }
      });
    }
    function apply(st, animate) {
      L.state = st;
      L.list.classList.toggle('is-open', st.open);
      if (L.topics) {
        L.topics.hidden = !st.open;
        L.rows.forEach(function (r) { r.classList.toggle('out', !L.shows(r, st)); });
        years(animate);
      }
    }
    L.set = function (st, animate) {
      var was = L.state;
      if (st.open === was.open && st.topic === was.topic) return;
      clearTimeout(L.timer); L.clean();
      L.toggle.setAttribute('aria-expanded', st.open);
      L.toggle.textContent = L.toggle.getAttribute(st.open ? 'data-close-label' : 'data-open-label');
      L.label.textContent = L.label.getAttribute(st.open ? 'data-open' : 'data-closed');
      if (L.topics) $$('button', L.topics).forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-topic') === st.topic); });
      if (o.address) o.address(st);
      var leaving = L.rows.filter(function (r) { return L.shows(r, was) && !L.shows(r, st); }),
          arriving = L.rows.filter(function (r) { return !L.shows(r, was) && L.shows(r, st); }),
          staying = moving(L.rows.filter(function (r) { return L.shows(r, was) && L.shows(r, st); }));
      var topicsIn = L.topics && st.open && !was.open, topicsOut = L.topics && !st.open && was.open;
      if (L.live) {
        var n = L.rows.filter(function (r) { return L.shows(r, st); }).length;
        L.live.textContent = n + ' ' + L.live.getAttribute(n === 1 ? 'data-one' : 'data-many');
      }
      if (!animate || reduce) { apply(st, false); L.busy = false; return; }
      L.busy = true;
      var settle = function () {
        var before = tops(staying);
        arriving.forEach(function (r, n) { r.style.setProperty('--i', n); r.classList.add('rise'); });
        if (topicsIn) L.topics.classList.add('rise');
        apply(st, true);
        leaving.forEach(function (r) { r.classList.remove('fall'); });
        if (topicsOut) L.topics.classList.remove('fall');
        glide(staying, before);
        arriving.forEach(function (r) { r.classList.add('go'); });
        if (topicsIn) L.topics.classList.add('go');
        // the glide takes --open (.7s); the last arrival starts at 160ms + 14ms a row and takes .5s
        L.timer = setTimeout(function () { L.clean(); L.busy = false; }, Math.max(700, arriving.length ? 660 + 14 * arriving.length : 0) + 100);
      };
      if (leaving.length || topicsOut) {
        leaving.forEach(function (r) { r.classList.add('fall'); });
        if (topicsOut) L.topics.classList.add('fall');
        L.timer = setTimeout(settle, 250);
      } else settle();
    };
    L.toggle.addEventListener('click', function () {
      if (o.wait && L.busy) return;
      L.set({ open: !L.state.open, topic: 'All' }, true);  // See less also resets the topic to All
    });
    if (L.topics) L.topics.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-topic]');
      if (!b || L.busy) return;
      L.set({ open: true, topic: b.getAttribute('data-topic') }, true);
    });
    // Center the column on its content: as wide as the widest row of the full list, tags included
    L.fit = function () {
      L.list.classList.add('measuring'); L.head.style.width = 'max-content';
      var w = Math.ceil(Math.max(L.list.getBoundingClientRect().width, L.head.getBoundingClientRect().width));
      L.list.classList.remove('measuring'); L.head.style.width = '';
      section.style.setProperty('--work-w', w + 'px');
    };
    L.fit();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(L.fit);
    var rt; window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(L.fit, 150); });
    return L;
  }

  // Focus that follows a click lands quietly (no ring); after a key press the ring shows, for keyboard users
  var byKey = false;
  document.addEventListener('keydown', function () { byKey = true; }, true);
  document.addEventListener('pointerdown', function () { byKey = false; }, true);
  var place = function (el) { el.focus({ preventScroll: true, focusVisible: byKey }); };
  var articles = $('#articles') && List($('#articles'), { wait: true, glideHead: true });
  if (!stage) return;
  root.classList.add('js');
  var home = $('[data-home]'), panels = { foundry: $('#foundry'), about: $('#about'), blog: $('#blog') };
  var url = function (hash) { return location.pathname + location.search + (hash || ''); };
  var current = '', pushed = false;  // pushed: this visit added the panel's entry, so closing can step back over it
  var leaving = false, homeTitle = document.title;  // leaving: Home or Esc is stepping back through history to the cover

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
    // Leaving the blog: once the slide has finished, empty the article slot, so the next visit starts at the list
    if (articles && name === 'blog') { clearTimeout(blogReset); resetBlog(); }
    if (articles && was === 'blog' && name !== 'blog') { document.title = homeTitle; blogReset = setTimeout(resetBlog, instant ? 0 : slideMs); }
    if (name) { panels[name].scrollTop = 0; place($('[data-studio]', panels[name])); }
    else if (was && animate) { var l = $('[data-go="' + was + '"]'); if (l) place(l); }
  }
  function closePanel() {
    // From an article, step back over its entries too (and the blog's own, if this visit added it)
    var steps = (current === 'blog' && history.state && history.state.depth) || 0;
    if (pushed) steps += 1;
    if (steps) {
      leaving = true;
      history.go(-steps);  // popstate slides it home
    }
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

  // Work: scroll so the list (its heading and rows) sits in the middle of the screen, #work in the address, focus on it.
  // If the list is taller than the screen, its top sits a little below the top edge instead.
  var work = $('#work');
  function centerWork(smooth) {
    var head = $('.work-head', work).getBoundingClientRect(), rows = $('#works').getBoundingClientRect();
    var top = head.top, h = rows.bottom - head.top;
    var y = window.scrollY + top - (h < innerHeight * .9 ? (innerHeight - h) / 2 : innerHeight * .08);
    window.scrollTo({ top: Math.max(0, y), behavior: smooth && !reduce ? 'smooth' : 'auto' });
  }
  $$('[data-go="work"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      history.pushState(null, '', url('#work'));
      centerWork(true);
      work.focus({ preventScroll: true });
    });
  });

  // The work list opens in place; See more puts #archive in the address, See less takes it out
  var list = $('#works'), workList = List(work, { address: function (st) {
    history.replaceState(history.state, '', url(st.open ? '#archive' : (location.hash === '#archive' ? '#work' : location.hash)));
  } }), rows = workList.rows;
  var setOpen = function (open, animate) { workList.set({ open: open, topic: 'All' }, animate); };
  // Home, beside See more: up to the top of home, focus on the Work option
  $('[data-top]').addEventListener('click', function (e) {
    e.preventDefault();
    history.replaceState(history.state, '', location.pathname + location.search);
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
    var w = $('[data-go="work"]'); if (w) place(w);
  });

  // A project opens as a screen below home. Its page is fetched once, its content dropped into the panel, and the view
  // slides down to it; Back, Esc or the browser's back button slide up to the list exactly as it was. The address is the
  // project's own, so a reload or a shared link simply opens the project page.
  var pp = $('#project'), ppInner = $('.project-inner', pp), ppOpen = false, ppPushed = false, ppFrom = null, cache = {};
  pp.inert = true;
  var projectOf = function (u) { var m = u && new URL(u, location.href).pathname.match(/^\/projects\/([^\/]+)$/); return m && m[1]; };
  function fetchProject(slug) {
    if (cache[slug]) return Promise.resolve(cache[slug]);
    return fetch('/projects/' + slug).then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); }).then(function (t) {
      var d = new DOMParser().parseFromString(t, 'text/html');
      if (d.querySelector('[data-page-only]')) throw new Error('page');  // 3D or interactive pieces: open the page itself
      return (cache[slug] = { html: d.querySelector('main').innerHTML, title: d.title });
    });
  }
  function showProject(open, animate) {
    var instant = !animate || reduce;
    if (instant) { stage.classList.add('no-anim'); pp.classList.add('no-anim'); }
    stage.classList.toggle('is-project', open);
    pp.classList.toggle('is-open', open);
    root.classList.toggle('is-locked', open);
    ppOpen = open; pp.inert = !open; home.inert = open;
    if (instant) { void pp.offsetWidth; stage.classList.remove('no-anim'); pp.classList.remove('no-anim'); }
    if (open) { var b = $('[data-back]', pp); if (b) place(b); }
    else {
      document.title = homeTitle;
      if (list.classList.contains('is-open') && location.hash !== '#archive') history.replaceState(history.state, '', location.pathname + location.search + '#archive');
      var r = work.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) centerWork(false);  // back onto the work list, wherever the project came from
      if (ppFrom && animate) place(ppFrom);
    }
  }
  function openProject(slug, animate, push) {
    return fetchProject(slug).then(function (p) {
      ppInner.innerHTML = p.html; pp.scrollTop = 0; document.title = p.title;
      if (window.opmetProject) window.opmetProject(ppInner);  // films and notes on the project just dropped in
      $$('video[data-loop]', pp).forEach(function (v) { if (!reduce) { v.preload = 'auto'; var x = v.play(); if (x && x.catch) x.catch(function () {}); } });
      if (push) { history.pushState({ project: slug }, '', '/projects/' + slug); ppPushed = true; }
      showProject(true, animate);
    }).catch(function () { location.href = '/projects/' + slug; });
  }
  function closeProject() {
    if (ppPushed) history.back();  // popstate slides up
    else { history.replaceState(null, '', '/' + (list.classList.contains('is-open') ? '#archive' : '#work')); showProject(false, true); }
  }
  list.addEventListener('click', function (e) {
    var a = e.target.closest('.work-row a');
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button) return;
    var slug = projectOf(a.href); if (!slug) return;
    e.preventDefault(); ppFrom = a; openProject(slug, true, true);
  });
  pp.addEventListener('click', function (e) {
    var a = e.target.closest('a'); if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button) return;
    if (a.hasAttribute('data-back') || a.getAttribute('href') === '/#work') { e.preventDefault(); closeProject(); return; }
    if (a.getAttribute('href') === '/#archive') { e.preventDefault(); setOpen(true, false); closeProject(); return; }  // All work: up to the full list
    if (a.hasAttribute('data-totop')) return;  // handled below, for the panel and the page alike
    var slug = projectOf(a.href);
    if (slug) { e.preventDefault(); fetchProject(slug).then(function () { openProject(slug, false, false).then(function () { history.replaceState({ project: slug }, '', '/projects/' + slug); }); }); }
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && ppOpen) closeProject(); });
  window.addEventListener('popstate', function () {
    var slug = projectOf(location.href);
    ppPushed = false;
    if (slug && !ppOpen) openProject(slug, true, false);
    else if (!slug && ppOpen) showProject(false, true);
  });

  // Hover hook for later: every project row says when the pointer or keyboard focus enters and leaves it
  rows.forEach(function (r) {
    var fire = function (name) { r.dispatchEvent(new CustomEvent(name, { bubbles: true, detail: { slug: r.getAttribute('data-project') } })); };
    r.addEventListener('pointerenter', function () { fire('project:enter'); });
    r.addEventListener('pointerleave', function () { fire('project:leave'); });
    r.addEventListener('focusin', function (e) { if (!r.contains(e.relatedTarget)) fire('project:enter'); });
    r.addEventListener('focusout', function (e) { if (!r.contains(e.relatedTarget)) fire('project:leave'); });
  });

  // The blog: an article opens above the list. Its page is fetched once and its <article> dropped into the slot, with the
  // panel's scroll corrected so the list doesn't move; then the panel scrolls up to the article's first line. Reading
  // to the end brings you back to the list, which simply follows the article. The address is the article's own.
  var blogPanel = panels.blog, slot = $('[data-article]', blogPanel), shown = null, articleCache = {}, blogReset = 0;
  var cssVar = function (n) { return getComputedStyle(root).getPropertyValue(n); };
  var slideMs = parseFloat(cssVar('--slide')) * 1000 || 900;
  var curve = (cssVar('--slide-ease').match(/-?[\d.]+/g) || [.65, 0, .35, 1]).map(Number);
  // The stage's curve, for scrolling (native smooth scrolling can't take one): solve x(s) = t, return y(s)
  function ease(t) {
    var lo = 0, hi = 1, u = t, b = function (s, p1, p2) { return 3 * (1 - s) * (1 - s) * s * p1 + 3 * (1 - s) * s * s * p2 + s * s * s; };
    for (var i = 0; i < 24; i++) { u = (lo + hi) / 2; if (b(u, curve[0], curve[2]) < t) lo = u; else hi = u; }
    return b(u, curve[1], curve[3]);
  }
  var raf = 0;
  function scrollPanel(to, done) {
    cancelAnimationFrame(raf);
    to = Math.max(0, Math.min(to, blogPanel.scrollHeight - blogPanel.clientHeight));
    var from = blogPanel.scrollTop, t0 = performance.now();
    if (reduce || Math.abs(to - from) < 1) { blogPanel.scrollTop = to; if (done) done(); return; }
    (function step(now) {
      var p = Math.min(1, (now - t0) / slideMs);
      blogPanel.scrollTop = from + (to - from) * ease(p);
      if (p < 1) raf = requestAnimationFrame(step); else if (done) done();
    })(t0);
  }
  if (blogPanel) ['wheel', 'touchstart'].forEach(function (ev) { blogPanel.addEventListener(ev, function () { cancelAnimationFrame(raf); }, { passive: true }); });
  // Change what's above the list without moving the list: measure its head before and after, and scroll by the difference
  function holdList(change) {
    var head = $('.work-head', blogPanel), y = head.getBoundingClientRect().top;
    change();
    blogPanel.scrollTop += head.getBoundingClientRect().top - y;
  }
  function markRow(slug) {
    articles.rows.forEach(function (r) {
      var on = r.getAttribute('data-slug') === slug, a = $('a', r);
      r.classList.toggle('is-current', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
  }
  var articleOf = function (u) { var m = u && new URL(u, location.href).pathname.match(/^\/blog\/([^\/]+)$/); return m && m[1]; };
  function fetchArticle(slug) {
    if (articleCache[slug]) return Promise.resolve(articleCache[slug]);
    return fetch('/blog/' + slug).then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); }).then(function (t) {
      var d = new DOMParser().parseFromString(t, 'text/html');
      return (articleCache[slug] = { html: d.querySelector('article').outerHTML, title: d.title });
    });
  }
  function showArticle(slug, push) {
    return fetchArticle(slug).then(function (a) {
      if (current !== 'blog') return;
      holdList(function () { slot.innerHTML = a.html; });
      if (push) history.pushState({ article: slug, depth: ((history.state && history.state.depth) || 0) + 1 }, '', '/blog/' + slug);
      shown = slug; document.title = a.title; markRow(slug);
      $('h1', slot).focus({ preventScroll: true });
      scrollPanel(slot.getBoundingClientRect().top - blogPanel.getBoundingClientRect().top + blogPanel.scrollTop);
    }).catch(function () { location.href = '/blog/' + slug; });
  }
  // Back from an article: down to the list, then the article goes and the list stays exactly where it is
  function hideArticle() {
    if (!shown) return;
    shown = null;
    scrollPanel(blogPanel.scrollHeight - blogPanel.clientHeight, function () {
      if (shown) return;  // another article opened meanwhile
      holdList(function () { slot.innerHTML = ''; });
      markRow(null); document.title = homeTitle;
    });
  }
  function resetBlog() {
    if (!articles) return;
    cancelAnimationFrame(raf);
    slot.innerHTML = ''; shown = null; markRow(null); blogPanel.scrollTop = 0;
  }
  if (articles) articles.list.addEventListener('click', function (e) {
    var a = e.target.closest('.work-row a');
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button) return;
    var slug = articleOf(a.href); if (!slug) return;
    e.preventDefault(); showArticle(slug, true);
  });

  // Arriving at #foundry (or #foundry/<id>) or #about opens that panel at once; #archive opens the list at once
  function sync(first) {
    var h = location.hash.slice(1).split(/[\/?]/)[0];  // #foundry/<id> is the foundry with a product open, #foundry?digital filtered
    setPanel(panels[h] ? h : '', !first);
    if (h === 'archive') setOpen(true, false);
  }
  panels.foundry.inert = panels.about.inert = panels.blog.inert = true;
  sync(true);
  if (location.hash === '#archive') work.scrollIntoView();
  if (location.hash === '#work') { centerWork(false); window.addEventListener('load', function () { centerWork(false); }); }
  window.addEventListener('popstate', function () {
    if (leaving) {
      leaving = false; pushed = false;
      if (location.hash || articleOf(location.href)) history.replaceState(null, '', '/');
      // Stepping back can land on an earlier entry such as #work, and the browser then restores that entry's scroll
      // (just after this event). Home goes to the cover, so hold the page at the top while it does.
      var hold = function () { if (window.scrollY) window.scrollTo(0, 0); };
      hold(); setPanel('', true);
      window.addEventListener('scroll', hold);
      setTimeout(function () { hold(); window.removeEventListener('scroll', hold); }, 400);
      return;
    }
    var slug = articles && articleOf(location.href);
    if (slug) { if (current !== 'blog') setPanel('blog', true); if (slug !== shown) showArticle(slug, false); return; }  // forward onto an article
    if (articles && current === 'blog' && location.hash === '#blog') { hideArticle(); return; }  // back from an article, to the list
    pushed = false; sync(false);
  });
})();

// Back to top, at the end of a project: in the panel it scrolls the panel, on a project page the page; focus goes to Back
document.addEventListener('click', function (e) {
  var a = e.target.closest('[data-totop]'); if (!a) return;
  e.preventDefault();
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var panel = a.closest('.project-panel');
  (panel || window).scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  var back = (panel || document).querySelector('[data-back]'); if (back) back.focus({ preventScroll: true });
});

// A project page: films that play once and rest, and notes that turn from gray to ink on the reading line. The same code
// runs on a project page and on a project dropped into the panel on home (site.js calls window.opmetProject for it).
(function () {
  var reduce = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  function films(root) {
    Array.prototype.forEach.call(root.querySelectorAll('.pp video[data-rest]'), function (v) {
      var state = 'idle', again = root.querySelector('[data-again="' + v.id + '"]'), sound = root.querySelector('[data-sound="' + v.id + '"]'), r = v.dataset.rest;
      function rest() { try { v.currentTime = r === 'end' ? Math.max(0, v.duration - 0.05) : parseFloat(r); } catch (e) {} }
      function offer(t) { if (again) { again.hidden = false; again.textContent = t; } }
      v.addEventListener('ended', function () { state = 'done'; rest(); offer('Play again'); });
      if (again) again.addEventListener('click', function (e) { e.preventDefault(); if (state === 'done') v.currentTime = 0; state = 'playing'; again.hidden = true; v.play(); });
      if (sound) sound.addEventListener('click', function (e) { e.preventDefault(); v.muted = false; v.controls = true; state = 'playing'; sound.hidden = true; if (again) again.hidden = true; v.play(); });
      if (sound) return;                                    // a film with sound plays only when asked
      if (reduce || !('IntersectionObserver' in window)) { offer('Play'); return; }  // reduced motion: nothing plays until clicked
      new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          var seen = e.intersectionRect.height >= Math.min(e.boundingClientRect.height * 0.6, innerHeight * 0.35);
          if (seen && state !== 'done') { if (v.paused) { state = 'playing'; var p = v.play(); if (p && p.catch) p.catch(function () { offer('Play'); }); } }
          else if (!e.isIntersecting && !v.paused) v.pause();
        });
      }, { threshold: [0, .1, .2, .3, .4, .5, .6, .7, .8, .9, 1] }).observe(v);
    });
  }
  var queued = false;
  function read() {
    queued = false;
    var h = innerHeight;
    Array.prototype.forEach.call(document.querySelectorAll('.pp [data-read]'), function (r) {
      var b = r.getBoundingClientRect(); r.classList.toggle('on', b.top < h * 0.62 && b.bottom > h * 0.38);
    });
  }
  function soon() { if (!queued) { queued = true; requestAnimationFrame(read); } }
  window.opmetProject = function (root) { films(root); read(); };
  if (document.querySelector('.pp')) window.opmetProject(document);
  document.addEventListener('scroll', soon, { passive: true, capture: true });  // the page, or the project panel on home
  window.addEventListener('resize', soon);
})();

// The foundry: objects in space. Products float at scattered slots and depths in a field you scroll; the filter row
// regroups them; a click opens a product in place (#foundry/<id>), with its text on the right and its images below it.
// Slots come from build.py (data-slots, x and y at 1440 wide, and a depth d); x scales with the panel's width.
(function () {
  var fd = document.querySelector('[data-foundry]');
  if (!fd) return;
  var $ = function (s, el) { return (el || fd).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || fd).querySelectorAll(s)); };
  var mq = function (q) { return window.matchMedia && matchMedia(q).matches; };
  var reduce = mq('(prefers-reduced-motion: reduce)');
  var panel = fd.closest('.foundry-panel'), field = $('[data-field]'), space = $('.fd-space'), left = $('[data-left]'), text = $('[data-text]');
  var home = $('.fd-home'), homeV = $('.fd-v', home), homeW = $('.fd-w', home);
  var filters = $$('[data-filter]');
  var SLOTS = fd.getAttribute('data-slots').split(' ').map(function (t) { var p = t.split(',').map(Number); return { x: p[0], y: p[1], d: p[2] }; });
  var items = $$('.fd-item').map(function (el) {
    return { el: el, id: el.getAttribute('data-id'), kind: el.getAttribute('data-kind'), link: $('.fd-link', el), turn: $('.fd-turn', el), oy: 161 };
  });
  var byId = {}; items.forEach(function (it) { byId[it.id] = it; });
  var st = { filter: 'all', y: 0, ps: 0, hover: null, open: null, rx: 0, ry: 0 };
  var W = 1440, H = 900, phone = false, hoverable = false, slots = [], pushed = false, drag = null, dragEl = null, raf = 0;

  function measure() {
    W = fd.clientWidth || innerWidth; H = fd.clientHeight || innerHeight;
    phone = mq('(max-width: 720px)');
    hoverable = !phone && mq('(hover: hover) and (pointer: fine)');
    var s = W / 1440;
    // Phones: one column, centered. Not yet designed.
    slots = phone ? items.map(function (_, i) { return { x: (W - 340) / 2, y: 96 + i * 430, d: .9 }; })
                  : SLOTS.map(function (p) { return { x: p.x * s, y: p.y, d: p.d }; });
    fd.style.setProperty('--fd-w', W + 'px');
    items.forEach(function (it) { it.oy = it.link.offsetHeight * .4; });  // the scale's origin: 50% 40%
  }

  // The product's own motion (spin, sway, drift, tumble) eases to a new speed over 600 ms (ease-out cubic), through
  // the Web Animations API, so it never stops dead or jumps. The bob keeps its pace.
  function ramp(it, target) {
    var anims = [];
    $$('.fd-obj', it.el).forEach(function (n) { n.getAnimations().forEach(function (a) { if (a.animationName) anims.push(a); }); });
    if (!anims.length) return;
    var start = anims[0].playbackRate, t0 = performance.now();
    cancelAnimationFrame(it.ramp);
    var step = function (t) {
      var k = Math.min(1, (t - t0) / 600), r = start + (target - start) * (1 - Math.pow(1 - k, 3));
      anims.forEach(function (a) { a.playbackRate = r; });
      if (k < 1) it.ramp = requestAnimationFrame(step);
    };
    it.ramp = requestAnimationFrame(step);
  }

  function visible() { return items.filter(function (it) { return st.filter === 'all' || it.kind === st.filter; }); }

  // Everything follows from the state: each product's slot, depth, parallax, scale and whether it shows
  function render() {
    var vis = visible();
    items.forEach(function (it, all) {
      var vi = vis.indexOf(it), on = vi !== -1, slot = slots[on ? vi : all];
      var dy = reduce || phone ? 0 : Math.round(st.y * (1 - slot.d) * .9);
      var isOpen = st.open === it.id, shown = st.open ? isOpen : on;
      var k = (on ? slot.d : slot.d * .6) * (st.hover === it.id ? 1.05 : 1), tf;
      if (isOpen) {
        var cx = phone ? W / 2 : W * 470 / 1440, cy = phone ? 230 : H / 2, z = phone ? 1.1 : 1.9;
        tf = 'translate(' + Math.round(cx - (slot.x + 170)) + 'px, ' + Math.round(cy - (slot.y + dy - st.y + it.oy)) + 'px) scale(' + z + ')';
      } else tf = 'translate(0px, 0px) scale(' + (st.open ? slot.d * .6 : k) + ')';
      it.el.style.left = slot.x + 'px';
      it.el.style.top = slot.y + 'px';
      it.el.style.transform = 'translate3d(0, ' + (isOpen ? dy - st.ps : dy) + 'px, 0)';
      it.link.style.transform = tf;
      it.el.classList.toggle('is-gone', !shown);
      it.el.classList.toggle('is-open', isOpen);
      it.link.tabIndex = shown ? 0 : -1;
      it.turn.style.transform = isOpen && (st.rx || st.ry) ? 'rotateX(' + st.rx + 'deg) rotateY(' + st.ry + 'deg)' : '';
    });
    if (!st.open) {
      var last = slots[Math.max(vis.length, 1) - 1];
      space.style.height = Math.round(last.y + 420 * last.d + (phone ? 120 : 260)) + 'px';
    }
    text.style.transform = phone && st.open ? 'translateY(' + -st.ps + 'px)' : '';
  }
  function frame() { if (!raf) raf = requestAnimationFrame(function () { raf = 0; render(); }); }
  // One frame without transitions: arriving at a product, or a resize
  function still(fn) { fd.classList.add('no-anim'); fn(); void fd.offsetWidth; fd.classList.remove('no-anim'); }

  // Phones: the product, then the text, then the images, all in one column
  function stack() {
    if (!phone) { ['--fd-text-top', '--fd-drag-top', '--fd-spacer-h'].forEach(function (v) { fd.style.removeProperty(v); }); return; }
    var top = 230 + 179 * 1.1 + 40, d = st.open && $('.fd-detail:not([hidden])', text);
    fd.style.setProperty('--fd-drag-top', (top - 34) + 'px');
    fd.style.setProperty('--fd-text-top', top + 'px');
    fd.style.setProperty('--fd-spacer-h', (top + (d ? d.offsetHeight : 240) + 48) + 'px');
  }

  // Focus without scrolling; the browser can drop it while it settles a history step, so put it back if so
  function focus(el) {
    el.focus({ preventScroll: true });
    setTimeout(function () { if (!document.activeElement || document.activeElement === document.body) el.focus({ preventScroll: true }); }, 60);
  }
  function show(id) {
    $$('[data-for]').forEach(function (el) { el.hidden = el.getAttribute('data-for') !== id; });
  }
  function setHome(open) {
    var l = home.getAttribute(open ? 'data-back-label' : 'data-home-label');
    homeV.textContent = homeW.textContent = l;
  }

  function openView(id, animate) {
    var it = byId[id]; if (!it || st.open === id) return;
    var go = function () {
      if (st.open) closeView(false);
      left.scrollTop = 0;
      st.open = id; st.hover = null; st.rx = st.ry = 0; st.ps = 0;
      show(id); stack();
      fd.classList.add('is-open');
      setHome(true);
      ramp(it, 1);
      render();
      focus($('.fd-detail:not([hidden]) .fd-d-name', text));
    };
    animate && !reduce ? go() : still(go);
  }
  function closeView(animate) {
    if (!st.open) return;
    var it = byId[st.open];
    var go = function () {
      if (dragEl) { ramp(dragEl, 1); dragEl = null; }
      drag = null; fd.classList.remove('is-grabbing');
      left.scrollTop = 0;
      st.open = null; st.rx = st.ry = 0; st.ps = 0;
      fd.classList.remove('is-open');
      setHome(false);
      render();
      if (animate) focus(it.link);
    };
    animate && !reduce ? go() : still(go);
  }
  // Back, a click on empty space and Esc: step back over the entry this visit added, or rewrite the address
  function leave() {
    if (pushed) history.back();  // popstate closes the view
    else { history.replaceState(null, '', fieldUrl()); closeView(true); }
  }
  // The address: #foundry/<id> for an open product, #foundry?digital or #foundry?physical for a filtered field
  function fieldUrl() { return location.pathname + location.search + '#foundry' + (st.filter === 'all' ? '' : '?' + st.filter); }
  function fromHash(animate) {
    var m = location.hash.match(/^#foundry\/([\w-]+)$/), id = m && byId[m[1]] ? m[1] : null;
    if (!m && /^#foundry(\?|$)/.test(location.hash)) {
      var f = (location.hash.match(/^#foundry\?(\w+)$/) || [])[1];
      setFilter(filters.some(function (b) { return b.getAttribute('data-filter') === f; }) ? f : 'all', animate);
    }
    if (id) openView(id, animate);
    else closeView(animate);
  }

  // The field
  field.addEventListener('scroll', function () { st.y = field.scrollTop; frame(); }, { passive: true });
  left.addEventListener('scroll', function () { st.ps = left.scrollTop; frame(); }, { passive: true });

  items.forEach(function (it) {
    var a = it.link;
    a.addEventListener('click', function (e) {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button) return;
      e.preventDefault();
      if (st.open) return;
      history.pushState(null, '', location.pathname + location.search + '#foundry/' + it.id); pushed = true;
      openView(it.id, true);
    });
    // Hover: slow to a fifth, and grow a little. Leaving eases back to full speed.
    a.addEventListener('pointerenter', function (e) {
      if (e.pointerType !== 'mouse' || !hoverable || st.open) return;
      ramp(it, .2); st.hover = it.id; render();
    });
    a.addEventListener('pointerleave', function (e) {
      if (drag && dragEl === it) return;
      if (e.pointerType === 'mouse') ramp(it, 1);
      if (st.hover === it.id) { st.hover = null; render(); }
    });
    // Drag to rotate, once open: across turns it, up and down tips it (to 70 degrees either way)
    a.addEventListener('pointerdown', function (e) {
      if (st.open !== it.id || e.button) return;
      e.preventDefault();
      drag = { x: e.clientX, y: e.clientY, rx: st.rx, ry: st.ry }; dragEl = it;
      try { a.setPointerCapture(e.pointerId); } catch (err) {}
      ramp(it, 0);
      fd.classList.add('is-grabbing');
    });
    a.addEventListener('pointermove', function (e) {
      if (!drag || dragEl !== it) return;
      st.ry = drag.ry + (e.clientX - drag.x) * .5;
      st.rx = Math.max(-70, Math.min(70, drag.rx - (e.clientY - drag.y) * .4));
      it.turn.style.transform = 'rotateX(' + st.rx + 'deg) rotateY(' + st.ry + 'deg)';
    });
    var release = function (e) {
      if (!drag || dragEl !== it) return;
      drag = null; fd.classList.remove('is-grabbing');
      var r = a.getBoundingClientRect(), inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      if (e.pointerType !== 'mouse' || !inside) ramp(it, 1);  // the cursor has left (or there was no cursor): back to full speed
    };
    a.addEventListener('pointerup', release);
    a.addEventListener('pointercancel', release);
    a.addEventListener('dragstart', function (e) { e.preventDefault(); });
  });

  // While a product is open, wheel and touch scrolling anywhere on the panel scroll the column of images; while the
  // field shows, they scroll the field (so the page behind never moves).
  fd.addEventListener('wheel', function (e) {
    var target = st.open ? left : field;
    if (target.contains(e.target)) return;
    e.preventDefault();
    target.scrollTop += e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? H : 1);
  }, { passive: false });
  var ty = null;
  fd.addEventListener('touchstart', function (e) { ty = e.touches.length === 1 ? e.touches[0].clientY : null; }, { passive: true });
  fd.addEventListener('touchmove', function (e) {
    if (!st.open || ty === null || drag || left.contains(e.target) || (byId[st.open] && byId[st.open].link.contains(e.target))) return;
    var y = e.touches[0].clientY;
    e.preventDefault();
    left.scrollTop += ty - y; ty = y;
  }, { passive: false });

  $('[data-veil]').addEventListener('click', function () { if (st.open) leave(); });
  left.addEventListener('click', function (e) { if (st.open && !e.target.closest('.fd-img')) leave(); });
  // Back (Home while a product is open) and Esc close the view, before the panel's own handlers see them
  fd.addEventListener('click', function (e) {
    if (st.open && e.target.closest('.fd-home')) { e.preventDefault(); e.stopPropagation(); leave(); }
  }, true);
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && st.open && !panel.inert) { e.preventDefault(); e.stopImmediatePropagation(); leave(); }
  }, true);
  window.addEventListener('popstate', function () { pushed = false; fromHash(true); });

  // The filter row: All, Digital, Physical. Matching products glide to the first slots; the rest fade, shrink and blur.
  function setFilter(key, animate) {
    if (key === st.filter) return;
    var go = function () {
      st.filter = key; st.hover = null;
      filters.forEach(function (x) { x.setAttribute('aria-pressed', x.getAttribute('data-filter') === key ? 'true' : 'false'); });
      render();
    };
    animate && !reduce ? go() : still(go);
  }
  filters.forEach(function (b) {
    b.addEventListener('click', function () {
      setFilter(b.getAttribute('data-filter'), true);
      history.replaceState(null, '', fieldUrl());
    });
  });
  // The Foundry link on home writes #foundry; keep the filter that's showing in the address
  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-go="foundry"]') && st.filter !== 'all') history.replaceState(null, '', fieldUrl());
  });
  // Hover: the word's weight follows the cursor across it, 200 at the left to 900 at the right. A hidden copy at 900
  // holds each word's width, so nothing shifts.
  filters.concat(home).forEach(function (b) {
    var v = $('.fd-v', b);
    b.addEventListener('mousemove', function (e) {
      if (!hoverable) return;
      var r = b.getBoundingClientRect(), t = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
      v.style.fontWeight = Math.round(200 + t * 700);
    });
    b.addEventListener('mouseleave', function () { v.style.fontWeight = ''; });
  });

  var rt;
  window.addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(function () { still(function () { measure(); stack(); render(); }); }, 120);
  });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { still(function () { measure(); stack(); render(); }); });

  still(function () { measure(); render(); });
  fromHash(false);
})();
