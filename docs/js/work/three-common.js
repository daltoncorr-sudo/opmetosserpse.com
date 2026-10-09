/* three-common.js

   What the 3D pieces on a project page share (the wine bottle, the badge on
   its lanyard, the phones): one pinned copy of three.js, added the first time
   any of them scrolls near the screen and never for a page without one, and
   the studio soft-box the glass and metal have to reflect.

   DCThree.lazy(el, start)  calls start(THREE) once, when el is near the
                            viewport and three.js has arrived; calls
                            start(null) if it could not (no WebGL, no
                            network), which is the cue to leave the flat
                            pictures in place.
   DCThree.env(THREE)       the soft-box, as an equirectangular canvas texture.
   DCThree.hasGL()          whether a WebGL context can be made at all. */
(function () {
'use strict';
var URL = '/js/vendor/three.min.js';
var waiting = null;

function load(ok, fail) {
  if (window.THREE) return ok();
  if (waiting) { waiting.push([ok, fail]); return; }
  waiting = [[ok, fail]];
  var s = document.createElement('script');
  s.src = URL; s.crossOrigin = 'anonymous';
  s.onload = function () { waiting.forEach(function (w) { w[0](); }); };
  s.onerror = function () { var w = waiting; waiting = null; w.forEach(function (x) { x[1](); }); };
  document.head.appendChild(s);
}

function hasGL() {
  try {
    var c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl')));
  } catch (e) { return false; }
}

function lazy(el, start) {
  var went = false;
  function go() {
    if (went) return; went = true;
    if (!hasGL()) return start(null);
    load(function () {
      try { start(window.THREE); } catch (e) { if (window.console) console.warn(e); start(null); }
    }, function () { start(null); });
  }
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { io.disconnect(); go(); } }, { rootMargin: '300px 0px' });
    io.observe(el);
  } else go();
}

/* a dark room with a soft light above and tall strips at the sides: what gives
   a bottle or a phone its long highlights */
function env(THREE) {
  var c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  var g = c.getContext('2d');
  g.fillStyle = '#0d0d0f'; g.fillRect(0, 0, 512, 256);
  var sky = g.createLinearGradient(0, 0, 0, 256);
  sky.addColorStop(0, 'rgba(255,255,255,.55)'); sky.addColorStop(.4, 'rgba(255,255,255,0)');
  g.fillStyle = sky; g.fillRect(0, 0, 512, 256);
  [[70, 34], [200, 18], [330, 40], [450, 14]].forEach(function (b) {
    var gr = g.createLinearGradient(b[0], 0, b[0] + b[1], 0);
    gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.5, 'rgba(255,255,255,.95)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(b[0], 30, b[1], 190);
  });
  var t = new THREE.CanvasTexture(c);
  t.mapping = THREE.EquirectangularReflectionMapping;
  return t;
}

/* a WebGL renderer with the site's look, sized to a host element */
function renderer(THREE, host) {
  var w = host.clientWidth || 400, h = host.clientHeight || 500;
  var r = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  r.setSize(w, h);
  r.outputEncoding = THREE.sRGBEncoding;
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.toneMappingExposure = 1.05;
  return r;
}

window.DCThree = { lazy: lazy, env: env, hasGL: hasGL, renderer: renderer };
})();
