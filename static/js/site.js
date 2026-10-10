// Opmet Osserpse: controls, clock, hover previews, quiet video. No tracking, no cookies.

// Controls: one system for every list link, toggle and filter (build.py ctl(), site.css .ctl). The hover sweeps the
// word's weight with the cursor, thin at its left edge to black at its right; a hidden copy at the heaviest weight holds
// the width, so nothing moves. Only with a fine pointer that hovers; with reduced motion the word simply turns bold.
//   opmetCtl.label(el, text): change a control's words (both copies)
//   opmetFilters(group, pick): one filter row (buttons with data-filter and aria-pressed); pick(key) on a click;
//     returns set(key), which marks the chosen one
(function () {
  var mq = function (q) { return !!(window.matchMedia && matchMedia(q).matches); };
  var fine = mq('(hover: hover) and (pointer: fine)'), reduce = mq('(prefers-reduced-motion: reduce)'), cur = null;
  window.opmetCtl = {
    label: function (el, text) {
      var w = el.querySelector('.ctl-w'), v = el.querySelector('.ctl-v');
      if (w && v) { w.textContent = v.textContent = text; } else el.textContent = text;
    }
  };
  function rest(c) { var v = c && c.querySelector('.ctl-v'); if (v) v.style.fontWeight = ''; }
  if (fine) {
    document.addEventListener('mousemove', function (e) {
      var c = e.target.closest ? e.target.closest('.ctl') : null;
      if (c !== cur) { rest(cur); cur = c; }
      var v = c && c.querySelector('.ctl-v'); if (!v) return;
      var r = c.getBoundingClientRect(), t = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
      v.style.fontWeight = reduce ? 700 : Math.round(200 + t * 700);
    }, { passive: true });
    document.addEventListener('mouseout', function (e) { if (cur && !(e.relatedTarget && cur.contains(e.relatedTarget))) { rest(cur); cur = null; } });
  }
  window.opmetFilters = function (group, pick) {
    var buttons = Array.prototype.slice.call(group.querySelectorAll('button[data-filter]'));
    group.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-filter]');
      if (b && group.contains(b)) pick(b.getAttribute('data-filter'));
    });
    return { set: function (key) { buttons.forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-filter') === key ? 'true' : 'false'); }); } };
  };
})();

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

// Home: the side panels (foundry to the left, About to the right, the Journal above), the Work link, the two lists that
// open in place (work and the Journal), projects and articles, and the project hover hook. The Journal's own pages use
// the list and the article engine too.
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
    // The work list's rows come in the Selected order (work.json); open, they run newest first (data-n). Rows move as
    // whole elements, so focus order always follows what's on screen.
    var closedOrder = L.rows.slice(), openOrder = L.rows.every(function (r) { return r.hasAttribute('data-n'); }) &&
      L.rows.slice().sort(function (a, b) { return a.getAttribute('data-n') - b.getAttribute('data-n'); });
    function arrange(open) { if (openOrder) (open ? openOrder : closedOrder).forEach(function (r) { L.list.appendChild(r); }); }
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
      arrange(st.open);
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
      opmetCtl.label(L.toggle, L.toggle.getAttribute(st.open ? 'data-close-label' : 'data-open-label'));
      L.label.textContent = L.label.getAttribute(st.open ? 'data-open' : 'data-closed');
      if (L.filters) L.filters.set(st.topic);
      if (o.address) o.address(st);
      var leaving = L.rows.filter(function (r) { return L.shows(r, was) && !L.shows(r, st); }),
          arriving = (openOrder ? (st.open ? openOrder : closedOrder) : L.rows).filter(function (r) { return !L.shows(r, was) && L.shows(r, st); }),
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
    if (L.topics) L.filters = opmetFilters(L.topics, function (key) { if (!L.busy) L.set({ open: true, topic: key }, true); });
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

  // The Journal: an article opens above the list, under the masthead. Its page is fetched once and its entry (All
  // articles, then the <article>) dropped into the slot, with the scroll corrected so the list doesn't move; then the
  // view scrolls to the top: the masthead, and the article's first line. Reading to the end brings you to the list,
  // which simply follows the article, and the address follows you: /journal/<slug> while you read, /journal/ at the
  // list. The same engine runs in the panel above home (box: the panel) and on the Journal's own pages (box: the page).
  var cssVar = function (n) { return getComputedStyle(root).getPropertyValue(n); };
  var slideMs = parseFloat(cssVar('--slide')) * 1000 || 900;
  var curve = (cssVar('--slide-ease').match(/-?[\d.]+/g) || [.65, 0, .35, 1]).map(Number);
  // The stage's curve, for scrolling (native smooth scrolling can't take one): solve x(s) = t, return y(s)
  function ease(t) {
    var lo = 0, hi = 1, u = t, b = function (s, p1, p2) { return 3 * (1 - s) * (1 - s) * s * p1 + 3 * (1 - s) * s * s * p2 + s * s * s; };
    for (var i = 0; i < 24; i++) { u = (lo + hi) / 2; if (b(u, curve[0], curve[2]) < t) lo = u; else hi = u; }
    return b(u, curve[1], curve[3]);
  }
  var articleOf = function (u) { var m = u && new URL(u, location.href).pathname.match(/^\/journal\/([^\/]+?)(?:\.html)?$/); return m && m[1]; };
  var depth = function () { return (history.state && history.state.depth) || 0; };
  function Journal(box, o) {
    var page = box === document.scrollingElement, scope = page ? document : box, slot = $('[data-article]', scope);
    var J = { shown: null, title: '', list: o.title }, cache = {}, raf = 0, moving = false;
    var boxTop = function () { return page ? 0 : box.getBoundingClientRect().top; };
    var view = function () { return page ? innerHeight : box.clientHeight; };
    function scrollTo(to, done) {
      cancelAnimationFrame(raf);
      to = Math.max(0, Math.min(to, box.scrollHeight - view()));
      var from = box.scrollTop, t0 = performance.now();
      // no motion with reduced motion, or in a tab nobody can see (it gets no animation frames): straight there
      if (reduce || document.hidden || Math.abs(to - from) < 1) { box.scrollTop = to; moving = false; if (done) done(); return; }
      moving = true;
      (function step(now) {
        var p = Math.min(1, (now - t0) / slideMs);
        box.scrollTop = from + (to - from) * ease(p);
        if (p < 1) raf = requestAnimationFrame(step); else { moving = false; if (done) done(); }
      })(t0);
    }
    ['wheel', 'touchstart', 'keydown'].forEach(function (ev) { (page ? window : box).addEventListener(ev, function () { cancelAnimationFrame(raf); moving = false; }, { passive: true }); });
    // Change what's above the list without moving the list: measure its head before and after, and scroll by the difference
    function holdList(change) {
      var head = $('.work-head', scope); if (!head) { change(); return; }
      var y = head.getBoundingClientRect().top;
      change();
      box.scrollTop += head.getBoundingClientRect().top - y;
    }
    function markRow(slug) {
      if (articles) articles.rows.forEach(function (r) {
        var on = r.getAttribute('data-slug') === slug, a = $('a', r);
        r.classList.toggle('is-current', on);
        if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
      });
    }
    function fetchEntry(slug) {
      if (cache[slug]) return Promise.resolve(cache[slug]);
      return fetch('/journal/' + slug).then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); }).then(function (t) {
        var d = new DOMParser().parseFromString(t, 'text/html');
        return (cache[slug] = { html: d.querySelector('[data-article]').innerHTML, title: d.title });
      });
    }
    function show(slug, push) {
      return fetchEntry(slug).then(function (a) {
        if (o.active && !o.active()) return;
        moving = true;  // the address follows the reader, not this move
        holdList(function () { slot.innerHTML = a.html; });
        if (push) history.pushState({ article: slug, depth: depth() + 1 }, '', '/journal/' + slug);
        else if (location.pathname !== '/journal/' + slug) history.replaceState(history.state, '', '/journal/' + slug);  // back onto an article read to its end
        J.shown = slug; J.title = a.title; document.title = a.title; markRow(slug);
        var h = $('h1', slot); if (h) h.focus({ preventScroll: true });
        scrollTo(0, function () { if (J.shown === slug && location.pathname !== '/journal/' + slug) history.replaceState(history.state, '', '/journal/' + slug); });
      }).catch(function () { location.href = '/journal/' + slug; });
    }
    // Back to the list: down to it, then the article goes and the list stays exactly where it is
    function hide() {
      if (!J.shown) return;
      J.shown = null; moving = true;
      scrollTo(box.scrollHeight - view(), function () {
        if (J.shown) return;  // another article opened meanwhile
        holdList(function () { slot.innerHTML = ''; });
        markRow(null); document.title = J.list;
        var l = articles && $('.work-label', scope); if (l) { l.setAttribute('tabindex', '-1'); l.focus({ preventScroll: true }); }
      });
    }
    J.reset = function () { cancelAnimationFrame(raf); moving = false; slot.innerHTML = ''; J.shown = null; markRow(null); box.scrollTop = 0; };
    J.go = function (slug) { if (slug) { if (slug !== J.shown) show(slug, false); } else hide(); };
    J.adopt = function (slug) { J.shown = slug; J.title = document.title; };  // an article already on the page
    // Which article an entry in the history holds: its address says, or (once the reader reached the list and the address
    // followed to /journal/) the entry remembers it
    J.of = function () { return articleOf(location.href) || (location.pathname === '/journal/' && history.state && history.state.article) || null; };
    if (articles) articles.list.addEventListener('click', function (e) {
      var a = e.target.closest('.work-row a');
      if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button) return;
      var slug = articleOf(a.href); if (!slug) return;
      e.preventDefault(); show(slug, true);
    });
    // All articles, under the masthead: back to the list, as a step of its own
    scope.addEventListener('click', function (e) {
      var a = e.target.closest('[data-all]');
      if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button) return;
      e.preventDefault();
      if (!J.shown) return;
      history.pushState({ depth: depth() + 1 }, '', '/journal/');
      hide();
    });
    // The address follows the reader: once the article has scrolled away and the list is in view, it's /journal/
    (page ? window : box).addEventListener('scroll', function () {
      if (!J.shown || moving || (o.active && !o.active())) return;
      var art = $('article', slot); if (!art) return;
      var past = art.getBoundingClientRect().bottom - boxTop() < view() * .25;
      var want = past ? '/journal/' : '/journal/' + J.shown;
      if (location.pathname !== want) { history.replaceState(history.state, '', want); document.title = past ? J.list : J.title; }
    }, { passive: true });
    return J;
  }

  // The Journal's own pages, /journal/ and /journal/<slug>: the same list and articles, scrolling the page itself
  var own = $('[data-journal]');
  if (own && articles) {
    var jp = Journal(document.scrollingElement, { title: own.getAttribute('data-title') });
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';  // the Journal places the view itself on back and forward
    if (articleOf(location.href)) jp.adopt(articleOf(location.href));
    history.replaceState({ depth: 0, article: articleOf(location.href) }, '', location.pathname.replace(/\.html$/, '') + location.search);
    window.addEventListener('popstate', function () { jp.go(jp.of()); });
  }
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
    if (name === 'blog' && window.scrollY) window.scrollTo(0, 0);  // the Journal sits above the top of the page
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
    if (name === 'blog') { clearTimeout(blogReset); resetBlog(); document.title = panels.blog.getAttribute('data-title') || homeTitle; }
    if (was === 'blog' && name !== 'blog') { document.title = homeTitle; blogReset = setTimeout(resetBlog, instant ? 0 : slideMs); }
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
    else { history.replaceState(null, '', current === 'blog' ? '/' : url()); setPanel('', true); }
  }
  ['foundry', 'about', 'blog'].forEach(function (name) {
    $$('[data-go="' + name + '"]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        if (name === 'blog') { if (location.pathname !== '/journal/') { history.pushState(null, '', '/journal/'); pushed = true; } }
        else if (location.hash !== '#' + name) { history.pushState(null, '', url('#' + name)); pushed = true; }
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
  // slides down to it; Esc or the browser's back button slide up to the list exactly as it was. In the panel the
  // masthead (data-cover) slides up to the cover, and All work (data-all-work, under the masthead and at the end) to
  // the full list, centered; on a project page loaded by itself they are plain links to / and /#archive. The address
  // is the project's own, so a reload or a shared link simply opens the project page.
  //   ppThen: where closing leads: '' the list as it was, 'cover' the cover, 'archive' the full list
  var pp = $('#project'), ppInner = $('.project-inner', pp), ppOpen = false, ppPushed = false, ppFrom = null, ppThen = '', cache = {};
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
    if (open) { var b = $('.mast-name', pp); if (b) place(b); return; }
    var then = ppThen; ppThen = '';
    document.title = homeTitle;
    if (then === 'cover') { toCover(); return; }
    if (then === 'archive') setOpen(true, false);
    if (list.classList.contains('is-open') && location.hash !== '#archive') history.replaceState(history.state, '', location.pathname + location.search + '#archive');
    // Back onto the work list, as it was; centered if it's off screen (wherever the project came from), and always for
    // All work, which lands on the full list
    var r = work.getBoundingClientRect();
    if (then === 'archive' || r.bottom < 0 || r.top > innerHeight) centerWork(false);
    if (then === 'archive') place(work);
    else if (ppFrom && animate) place(ppFrom);
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
  function closeProject(then) {
    ppThen = then || '';
    if (ppPushed) history.back();  // popstate slides up
    else { history.replaceState(null, '', '/' + (list.classList.contains('is-open') ? '#archive' : '#work')); showProject(false, true); }
  }
  // The cover: the top of home, the address plain /, focus on the Work option. Stepping back in the history can make the
  // browser restore that entry's scroll just after; hold the page at the top while it would.
  function toCover() {
    history.replaceState(history.state, '', location.pathname + location.search);
    var hold = function () { if (window.scrollY) window.scrollTo(0, 0); };
    hold(); window.addEventListener('scroll', hold);
    setTimeout(function () { hold(); window.removeEventListener('scroll', hold); }, 400);
    var w = $('[data-go="work"]'); if (w) place(w);
  }
  list.addEventListener('click', function (e) {
    var a = e.target.closest('.work-row a');
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button) return;
    var slug = projectOf(a.href); if (!slug) return;
    e.preventDefault(); ppFrom = a; openProject(slug, true, true);
  });
  pp.addEventListener('click', function (e) {
    var a = e.target.closest('a'); if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button) return;
    if (a.hasAttribute('data-cover')) { e.preventDefault(); closeProject('cover'); return; }  // the masthead: up to the cover
    if (a.hasAttribute('data-all-work')) { e.preventDefault(); closeProject('archive'); return; }  // All work: up to the full list
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

  // The Journal in its panel: the engine above, with the panel as the box that scrolls
  var blogReset = 0, journal = panels.blog && $('[data-article]', panels.blog) ? Journal(panels.blog, {
    title: panels.blog.getAttribute('data-title'), active: function () { return current === 'blog'; } }) : null;
  function resetBlog() { if (journal) journal.reset(); }

  // Arriving at #foundry (or #foundry/<id>) or #about opens that panel at once; #archive opens the list at once
  function sync(first) {
    var h = location.hash.slice(1).split(/[\/?]/)[0];  // #foundry/<id> is the foundry with a product open, #foundry?digital filtered
    if (location.pathname.indexOf('/journal') === 0) h = 'blog';
    else if (h === 'blog') history.replaceState(history.state, '', '/journal/');  // the old address
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
      if (location.hash || location.pathname !== '/') history.replaceState(null, '', '/');
      // Stepping back can land on an earlier entry such as #work, and the browser then restores that entry's scroll
      // (just after this event). Home goes to the cover, so hold the page at the top while it does.
      var hold = function () { if (window.scrollY) window.scrollTo(0, 0); };
      hold(); setPanel('', true);
      window.addEventListener('scroll', hold);
      setTimeout(function () { hold(); window.removeEventListener('scroll', hold); }, 400);
      return;
    }
    var slug = journal && journal.of();
    if (slug) { if (current !== 'blog') setPanel('blog', true); journal.go(slug); return; }  // forward onto an article
    if (journal && current === 'blog' && location.pathname === '/journal/') { journal.go(null); return; }  // back from an article, to the list
    pushed = false; sync(false);
  });
})();

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
  var home = $('.fd-home');
  var filters = $$('[data-filter]'), filterRow = opmetFilters($('[data-fd-filters]'), function (key) {
    setFilter(key, true);
    history.replaceState(null, '', fieldUrl());
  });
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
    opmetCtl.label(home, home.getAttribute(open ? 'data-back-label' : 'data-home-label'));
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
      filterRow.set(key);
      render();
    };
    animate && !reduce ? go() : still(go);
  }
  // The Foundry link on home writes #foundry; keep the filter that's showing in the address
  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-go="foundry"]') && st.filter !== 'all') history.replaceState(null, '', fieldUrl());
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

// The lightbox: one site component. Any picture inside an element marked data-lightbox opens full size on the paper; the
// pictures in that element are its group (a Journal article; later, a project page). A click, Esc or the back button
// closes it; the arrow keys and a swipe step through the group. Focus stays inside while it's open and returns to the
// picture after. Fades only, instant with reduced motion. Pictures dropped in later (an article in the panel on home)
// work too. data-lightbox-skip on an <img> leaves it out (the Journal's handwritten notes).
(function () {
  if (!window.HTMLDialogElement || !document.body) return;
  var reduce = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  var root = document.documentElement, SEL = '[data-lightbox] img:not([data-lightbox-skip])';
  var ms = parseFloat(getComputedStyle(root).getPropertyValue('--t')) * 1000 || 500;
  var box, pic, group = [], at = 0, opener = null, pushed = false, closing = false, timer = 0, x0 = null, swiped = false;
  // Each picture can be reached and opened from the keyboard
  function prep(el) {
    var imgs = Array.prototype.slice.call(el.querySelectorAll ? el.querySelectorAll(SEL) : []);
    if (el.matches && el.matches(SEL)) imgs.push(el);
    imgs.forEach(function (i) { if (!i.hasAttribute('tabindex')) { i.tabIndex = 0; i.setAttribute('role', 'button'); } });
  }
  prep(document);
  if (window.MutationObserver) new MutationObserver(function (ms) {
    ms.forEach(function (m) { Array.prototype.forEach.call(m.addedNodes, function (n) { if (n.nodeType === 1) prep(n); }); });
  }).observe(document.body, { childList: true, subtree: true });
  function make() {
    box = document.createElement('dialog'); box.className = 'lightbox'; box.tabIndex = -1;
    pic = document.createElement('img'); pic.alt = ''; pic.decoding = 'async';
    box.appendChild(pic); document.body.appendChild(box);
    box.addEventListener('click', function () { if (swiped) { swiped = false; return; } close(); });
    box.addEventListener('cancel', function (e) { e.preventDefault(); close(); });
    box.addEventListener('close', function () {  // however it closed: tidy up, and focus back on the picture
      clearTimeout(timer); closing = false; box.classList.remove('on'); root.classList.remove('lb-open');
      if (pushed) { pushed = false; history.back(); }
      if (opener) opener.focus({ preventScroll: true });
    });
    box.addEventListener('touchstart', function (e) { x0 = e.touches.length === 1 ? e.touches[0].clientX : null; }, { passive: true });
    box.addEventListener('touchend', function (e) {
      if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0; x0 = null;
      if (Math.abs(dx) > 40) { swiped = true; step(dx < 0 ? 1 : -1); setTimeout(function () { swiped = false; }, 500); }
    }, { passive: true });
  }
  function show(i) {
    at = (i + group.length) % group.length;
    var src = group[at];
    pic.classList.add('out');
    pic.onload = function () { pic.classList.remove('out'); };  // fades in once it's there
    pic.sizes = '100vw'; pic.srcset = src.getAttribute('srcset') || ''; pic.src = src.currentSrc || src.src;
    if (pic.complete && pic.naturalWidth) pic.classList.remove('out');
    box.setAttribute('aria-label', src.alt || '');
  }
  function step(d) { if (group.length > 1) show(at + d); }
  function open(img) {
    var g = img.closest('[data-lightbox]');
    group = Array.prototype.filter.call(g.querySelectorAll('img'), function (x) { return x.matches(SEL); });
    if (!box) make();
    clearTimeout(timer); closing = false; opener = img;
    show(group.indexOf(img));
    if (!box.open) box.showModal();
    root.classList.add('lb-open'); box.focus();
    void box.offsetWidth; box.classList.add('on');
    // its own entry in the history, so the back button closes it (the address stays the same)
    if (!pushed) { history.pushState(Object.assign({}, history.state, { lightbox: true }), '', location.href); pushed = true; }
  }
  function close(fromHistory) {
    if (!box || !box.open || closing) return;
    closing = true;
    if (pushed && !fromHistory) { pushed = false; history.back(); }
    box.classList.remove('on');
    timer = setTimeout(function () { box.close(); }, reduce ? 0 : ms);
  }
  document.addEventListener('click', function (e) {
    var img = e.target.closest && e.target.closest(SEL);
    if (!img || img.closest('a') || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button) return;
    e.preventDefault(); open(img);
  });
  // While it's open it takes the keys first, so Esc closes the lightbox and not the panel under it
  window.addEventListener('keydown', function (e) {
    if (box && box.open) {
      var k = e.key;
      if (k === 'Escape' || k === 'Enter' || k === ' ') close();
      else if (k === 'ArrowRight' || k === 'ArrowLeft') step(k === 'ArrowRight' ? 1 : -1);
      else if (k === 'Tab') box.focus();
      else return;
      e.preventDefault(); e.stopPropagation(); return;
    }
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches(SEL)) { e.preventDefault(); e.stopPropagation(); open(e.target); }
  }, true);
  window.addEventListener('popstate', function () {
    var mine = history.state && history.state.lightbox;
    if (box && box.open && !mine) { pushed = false; close(true); }
    else if (mine && !(box && box.open)) {  // forward onto a closed lightbox's entry: nothing to show there
      var st = Object.assign({}, history.state); delete st.lightbox; history.replaceState(st, '', location.href);
    }
  });
})();
