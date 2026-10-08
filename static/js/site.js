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
