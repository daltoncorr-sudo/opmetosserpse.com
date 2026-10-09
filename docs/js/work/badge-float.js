/* Badges, floating: the festival's passes laid out the way they were
   photographed, each one drifting on its own, that you can pick up, throw
   and turn over.

   The page ships the layout as plain images (.badge-float > .bf-badge >
   img), placed by CSS, so without this script they still sit in their
   arrangement. This adds, per badge:

     figure.bf-badge        where it is: left/top and its tilt from CSS,
                            plus `translate` when you drag it
       .bf-float            the drift (a CSS animation)
         .bf-tilt           the lean toward the pointer (sprung, here)
           .bf-flip         the turn (a CSS transition)
             .bf-face--front / .bf-face--back

   One owner per element and property, so a drag, the drift, the lean and
   the flip never fight over one transform.

   A tap turns a badge over; a drag moves it, and it keeps a little of the
   throw when you let go. The back is made from the front: its own colours,
   blurred, with the festival mark, the pass, a barcode and the fine print
   (data-* on the .badge-float). */
(function () {
  'use strict';
  var still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia('(pointer: fine)').matches;

  function barcode(seed) {
    var s = '', x = 2, r = seed * 137.508 + 11;
    for (var i = 0; i < 30; i++) {
      r = (r * 9301 + 49297) % 233280;
      var w = (r % 3) + 1;
      r = (r * 9301 + 49297) % 233280;
      s += '<rect x="' + x + '" y="0" width="' + w + '" height="30" fill="currentColor"/>';
      x += w + (r % 2) + 1;
    }
    return '<svg class="bf-back-barcode" viewBox="0 0 ' + (x + 2) + ' 30" preserveAspectRatio="none" aria-hidden="true">' + s + '</svg>';
  }

  function build(stage) {
    if (stage.dataset.ready) return;
    stage.dataset.ready = '1';
    var code = stage.dataset.code || '';
    var year = stage.dataset.year || '';
    var logo = stage.dataset.logo || '';
    var lines = (stage.dataset.fine || '').split('|');
    var badges = [].slice.call(stage.querySelectorAll('.bf-badge'));
    var top = badges.length + 1;

    badges.forEach(function (fig, i) {
      var img = fig.querySelector('img');
      if (!img) return;
      var name = img.dataset.name || img.alt.replace(/ badge$/i, '');
      var float = document.createElement('div');
      float.className = 'bf-float';
      float.style.animationDelay = (-1.3 * i - 0.4) + 's';
      float.style.animationDuration = (6 + (i * 0.83) % 2.4).toFixed(2) + 's';
      var tilt = document.createElement('div');
      tilt.className = 'bf-tilt';
      var flip = document.createElement('div');
      flip.className = 'bf-flip';
      var front = document.createElement('div');
      front.className = 'bf-face bf-face--front';
      var back = document.createElement('div');
      back.className = 'bf-face bf-face--back';
      back.setAttribute('aria-hidden', 'true');
      var art = document.createElement('div');
      art.className = 'bf-back-art';
      art.style.backgroundImage = 'url("' + (img.currentSrc || img.src) + '")';
      back.appendChild(art);
      back.insertAdjacentHTML('beforeend',
        '<span class="bf-hole"></span>' +
        (logo ? '<img class="bf-back-logo" src="' + logo + '" alt="" loading="lazy" decoding="async" draggable="false">' : '') +
        '<span class="bf-back-type">' + name + '</span>' +
        '<span class="bf-back-code">' + barcode(i + 1) +
          '<span>' + code + '-' + year + '-' + String(1000 + ((i + 3) * 379) % 9000) + '</span></span>' +
        '<span class="bf-back-fine">' + lines.join('<br>') + '</span>');
      img.draggable = false;
      front.appendChild(img);
      front.insertAdjacentHTML('beforeend', '<span class="bf-hole"></span><span class="bf-sheen" aria-hidden="true"></span>');
      flip.append(front, back);
      tilt.appendChild(flip);
      float.appendChild(tilt);
      fig.appendChild(float);

      fig.tabIndex = 0;
      fig.setAttribute('role', 'button');
      fig.setAttribute('aria-pressed', 'false');
      fig.setAttribute('aria-label', name + ' badge. Press to turn it over');

      function raise() { fig.style.zIndex = String(++top); }
      function turn() {
        raise();
        var on = !fig.classList.contains('is-flipped');
        fig.classList.toggle('is-flipped', on);
        fig.setAttribute('aria-pressed', String(on));
        // a lift while it turns, so it reads as picked up, not spun
        if (!still) {
          tilt.animate([{ scale: 1 }, { scale: 1.07, offset: 0.4 }, { scale: 1 }],
            { duration: 820, easing: 'cubic-bezier(0.3, 0.7, 0.2, 1)' });
        }
      }

      // ── the lean: toward the pointer, sprung ──
      var lean = { x: 0, y: 0, tx: 0, ty: 0, raf: 0 };
      function paintLean() {
        lean.x += (lean.tx - lean.x) * 0.16;
        lean.y += (lean.ty - lean.y) * 0.16;
        tilt.style.transform = 'rotateX(' + (-lean.y * 9).toFixed(2) + 'deg) rotateY(' + (lean.x * 11).toFixed(2) + 'deg)';
        front.style.setProperty('--sx', (50 + lean.x * 40).toFixed(1) + '%');
        front.style.setProperty('--sy', (50 + lean.y * 40).toFixed(1) + '%');
        if (Math.abs(lean.tx - lean.x) + Math.abs(lean.ty - lean.y) > 0.002) lean.raf = requestAnimationFrame(paintLean);
        else lean.raf = 0;
      }
      function leanTo(x, y) {
        lean.tx = x; lean.ty = y;
        if (!lean.raf && !still) lean.raf = requestAnimationFrame(paintLean);
      }
      if (fine) {
        fig.addEventListener('pointermove', function (e) {
          if (drag.on) return;
          var r = fig.getBoundingClientRect();
          leanTo(((e.clientX - r.left) / r.width - 0.5) * 2, ((e.clientY - r.top) / r.height - 0.5) * 2);
        });
        fig.addEventListener('pointerleave', function () { leanTo(0, 0); fig.classList.remove('is-hover'); });
        fig.addEventListener('pointerenter', function () { fig.classList.add('is-hover'); });
      }

      // ── the drag, and the throw ──
      var drag = { on: false, id: null, sx: 0, sy: 0, ox: 0, oy: 0, x: 0, y: 0, vx: 0, vy: 0, t: 0, moved: false, raf: 0 };
      function place() { fig.style.translate = drag.x.toFixed(1) + 'px ' + drag.y.toFixed(1) + 'px'; }
      // keep at least a third of the badge inside the stage
      function bounds() {
        var s = stage.getBoundingClientRect(), f = fig.getBoundingClientRect();
        var bx = f.left - drag.x - s.left, by = f.top - drag.y - s.top;   // where it sits undragged
        return {
          minX: -bx - f.width * 0.66, maxX: s.width - bx - f.width * 0.34,
          minY: -by - f.height * 0.5, maxY: s.height - by - f.height * 0.5
        };
      }
      function coast() {
        drag.vx *= 0.92; drag.vy *= 0.92;
        drag.x += drag.vx; drag.y += drag.vy;
        var b = bounds();
        if (drag.x < b.minX || drag.x > b.maxX) { drag.x = Math.min(b.maxX, Math.max(b.minX, drag.x)); drag.vx *= -0.35; }
        if (drag.y < b.minY || drag.y > b.maxY) { drag.y = Math.min(b.maxY, Math.max(b.minY, drag.y)); drag.vy *= -0.35; }
        place();
        if (Math.abs(drag.vx) + Math.abs(drag.vy) > 0.15) drag.raf = requestAnimationFrame(coast);
        else drag.raf = 0;
      }
      fig.addEventListener('pointerdown', function (e) {
        if (e.button) return;
        cancelAnimationFrame(drag.raf);
        drag.on = true; drag.moved = false; drag.id = e.pointerId;
        drag.sx = e.clientX; drag.sy = e.clientY; drag.ox = drag.x; drag.oy = drag.y;
        drag.vx = drag.vy = 0; drag.t = performance.now();
        raise();
      });
      fig.addEventListener('pointermove', function (e) {
        if (!drag.on || e.pointerId !== drag.id) return;
        var dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
        if (!drag.moved) {
          if (dx * dx + dy * dy < 49) return;
          // a mostly-vertical swipe on a phone is the page scrolling, not a drag
          if (e.pointerType === 'touch' && Math.abs(dy) > Math.abs(dx) * 1.2) { drag.on = false; return; }
          drag.moved = true;
          fig.setPointerCapture(e.pointerId);
          fig.classList.add('is-held');
          leanTo(0, 0);
        }
        var now = performance.now(), dt = Math.max(8, now - drag.t);
        var nx = drag.ox + dx, ny = drag.oy + dy;
        drag.vx = (nx - drag.x) / dt * 16; drag.vy = (ny - drag.y) / dt * 16;
        drag.x = nx; drag.y = ny; drag.t = now;
        place();
        e.preventDefault();
      });
      function release(e) {
        if (!drag.on || (e && e.pointerId !== drag.id)) return;
        drag.on = false;
        fig.classList.remove('is-held');
        if (drag.moved) {
          if (!still) drag.raf = requestAnimationFrame(coast);
        } else if (e && e.type === 'pointerup') {
          turn();
        }
      }
      fig.addEventListener('pointerup', release);
      fig.addEventListener('pointercancel', release);
      fig.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); turn(); }
      });
    });
    stage.classList.add('is-live');
  }

  function init() { [].forEach.call(document.querySelectorAll('.badge-float'), build); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  // A project opened in place (work-cards.js) brings its badges in after
  // this script may already have run, so any stage that turns up later is
  // built as it arrives. One watcher per page, however often the script is
  // loaded; build() skips a stage that's already live.
  if (!window.__bfWatch && 'MutationObserver' in window) {
    window.__bfWatch = new MutationObserver(function (list) {
      for (var i = 0; i < list.length; i++) {
        var added = list[i].addedNodes;
        for (var j = 0; j < added.length; j++) {
          var n = added[j];
          if (n.nodeType === 1 && (n.matches('.badge-float:not([data-ready])') || n.querySelector('.badge-float:not([data-ready])'))) { init(); return; }
        }
      }
    });
    window.__bfWatch.observe(document.documentElement, { childList: true, subtree: true });
  }
})();
