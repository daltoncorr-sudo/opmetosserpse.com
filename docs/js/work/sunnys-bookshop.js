/* Sunny's Bookshop (work/sunnys-bookshop): the page viewers and the videos.

   Page viewer (.sb-viewer, three on the page): one page at a time on a grey
   stage. Previous / Next, ← → while it has focus, a swipe on touch. Its
   pages are the links in its "View all pages" list, which is all that shows
   without this script (with the first page). Only the page on show and its
   two neighbours are ever fetched.

   Videos (video[data-inview]): silent loops that play while they're on
   screen. Under reduced motion they stay paused on their poster. The film
   has a Sound on / Sound off toggle. The ones further down fetch nothing,
   not even their poster, until they come near.

   work-cards.js runs this again each time a project opens in place, so
   everything it sets up is marked and skipped the second time. */
(function () {
  'use strict';
  var still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var seen = 'IntersectionObserver' in window;

  /* ── Page viewer ── */
  [].forEach.call(document.querySelectorAll('.sb-viewer'), function (root) {
    if (root.dataset.sbReady) return;
    root.dataset.sbReady = '1';
    var links = [].slice.call(root.querySelectorAll('.sb-viewer-all a'));
    var img = root.querySelector('.sb-viewer-stage img');
    var count = root.querySelector('.sb-viewer-count');
    if (!links.length || !img) return;
    var pages = links.map(function (a) {
      return {
        srcset: a.dataset.small + ' ' + a.dataset.sw + 'w, ' + a.getAttribute('href') + ' ' + a.dataset.w + 'w',
        src: a.getAttribute('href'), alt: a.dataset.alt, text: a.textContent
      };
    });
    var cur = 0, near = !seen;
    var warmed = {};
    function warm(i) {
      i = (i + pages.length) % pages.length;
      if (warmed[i]) return;
      warmed[i] = true;
      var pre = new Image();
      pre.sizes = img.sizes;
      pre.srcset = pages[i].srcset;
      pre.src = pages[i].src;
    }
    function show(i) {
      cur = (i + pages.length) % pages.length;
      var p = pages[cur];
      img.srcset = p.srcset;
      img.src = p.src;
      img.alt = p.alt;
      count.textContent = p.text;
      warmed[cur] = true;
      if (near) { warm(cur - 1); warm(cur + 1); }
    }
    root.classList.add('is-live');
    root.querySelector('.sb-viewer-prev').addEventListener('click', function () { show(cur - 1); });
    root.querySelector('.sb-viewer-next').addEventListener('click', function () { show(cur + 1); });
    // ← → turn the page (and stop here: on a project page they'd also
    // shuffle to the next project)
    root.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      e.stopPropagation();
      show(cur + (e.key === 'ArrowRight' ? 1 : -1));
    });
    var stage = root.querySelector('.sb-viewer-stage'), tx = null, ty = 0;
    stage.addEventListener('touchstart', function (e) { tx = e.changedTouches[0].clientX; ty = e.changedTouches[0].clientY; }, { passive: true });
    stage.addEventListener('touchend', function (e) {
      if (tx === null) return;
      var dx = e.changedTouches[0].clientX - tx, dy = e.changedTouches[0].clientY - ty;
      tx = null;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) show(cur + (dx < 0 ? 1 : -1));
    });
    // the neighbours are fetched once the viewer is close to the screen
    if (seen) {
      var io = new IntersectionObserver(function (es) {
        if (!es[0].isIntersecting) return;
        io.disconnect();
        near = true;
        warm(cur - 1); warm(cur + 1);
      }, { rootMargin: '300px 0px' });
      io.observe(root);
    } else {
      show(0);
    }
  });

  /* ── Videos ── */
  [].forEach.call(document.querySelectorAll('video[data-inview]'), function (v) {
    if (v.dataset.sbReady) return;
    v.dataset.sbReady = '1';
    v.muted = true;
    v.removeAttribute('controls');   // there for when this script isn't
    var wants = !still;              // play while on screen
    if (still) {
      v.removeAttribute('autoplay');
      v.pause();
      if (v.currentTime > 0) v.load();   // back to the poster
    }
    function play() { var p = v.play(); if (p && p.catch) p.catch(function () {}); }

    var btn = v.parentNode.querySelector('.sb-sound');
    if (btn) {
      btn.hidden = false;
      var label = function () { btn.textContent = v.muted ? 'Sound on' : 'Sound off'; };
      btn.addEventListener('click', function () {
        v.muted = !v.muted;
        if (!v.muted) { wants = true; if (v.paused) play(); }
        label();
      });
      label();
    }

    // a video further down holds its poster (data-poster) until it's close
    if (v.dataset.poster) {
      var dress = function () { v.poster = v.dataset.poster; };
      if (!seen) dress();
      else {
        var near = new IntersectionObserver(function (es) {
          if (es[es.length - 1].isIntersecting) { near.disconnect(); dress(); }
        }, { rootMargin: '600px 0px' });
        near.observe(v);
      }
    }

    if (!seen) { if (wants) play(); return; }
    new IntersectionObserver(function (es) {
      var e = es[es.length - 1];
      if (e.isIntersecting && wants) play();
      else if (!e.isIntersecting) v.pause();
    }, { threshold: 0.25 }).observe(v);
  });
})();
